/**
 * MCP tool definition for searching Reed jobs. Exports the tool name, a zod
 * schema describing arguments using Reed's exact field names, and a handler
 * that calls the Reed client and formats the response for MCP. ReedApiError
 * instances are caught and returned as structured tool errors so a rate-limit
 * or auth failure reaches the MCP client as a readable message rather than
 * crashing the server.
 */

import { z } from 'zod';
import { ReedApiError } from '../reed-client.js';
import { formatJob, messageForError } from './_shared.js';

/** MCP tool name registered by the server. */
export const name = 'search_jobs';

/** Human-readable blurb shown in the tool's MCP metadata. */
export const description =
  'Search Reed.co.uk for jobs matching the given criteria. ' +
  'At least one of `keywords` or `locationName` is required.';

/**
 * Zod schema for the search_jobs arguments. Field names mirror Reed's
 * Jobseeker /search API exactly: see DECISIONS.md (2026-04-24, parameter
 * naming) for why we do not translate. The .refine() rule enforces a usage
 * policy not in the API itself: callers must supply keywords or locationName,
 * so the tool never issues an unbounded query.
 */
export const schema = z
  .object({
    keywords: z
      .string()
      .optional()
      .describe('Free-text search terms, e.g. "senior backend engineer".'),
    locationName: z
      .string()
      .optional()
      .describe('Town or city to search around, e.g. "Manchester".'),
    distanceFromLocation: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe('Search radius in miles around `locationName`.'),
    permanent: z.boolean().optional().describe('Include permanent roles.'),
    contract: z.boolean().optional().describe('Include contract roles.'),
    temp: z.boolean().optional().describe('Include temporary roles.'),
    partTime: z.boolean().optional().describe('Include part-time roles.'),
    fullTime: z.boolean().optional().describe('Include full-time roles.'),
    minimumSalary: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe('Minimum annual salary in GBP.'),
    maximumSalary: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe('Maximum annual salary in GBP.'),
    postedByRecruitmentAgency: z
      .boolean()
      .optional()
      .describe('Include jobs posted by recruitment agencies.'),
    postedByDirectEmployer: z
      .boolean()
      .optional()
      .describe('Include jobs posted directly by the employer.'),
    graduate: z.boolean().optional().describe('Restrict to graduate roles.'),
    resultsToTake: z
      .number()
      .int()
      .positive()
      .optional()
      .describe('Number of results to return per call.'),
    resultsToSkip: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe('Offset for pagination.'),
    employerId: z
      .number()
      .int()
      .positive()
      .optional()
      .describe('Restrict to a specific Reed employer ID.'),
    employerProfileId: z
      .number()
      .int()
      .positive()
      .optional()
      .describe('Restrict to a specific Reed employer profile ID.'),
  })
  .refine((args) => Boolean(args.keywords) || Boolean(args.locationName), {
    message: 'At least one of `keywords` or `locationName` must be provided.',
  });

/**
 * Handle a search_jobs tool call.
 *
 * @param {z.infer<typeof schema>} args - Arguments validated against `schema`.
 * @param {import('../reed-client.js').default} client - Configured ReedClient.
 * @returns {Promise<{ content: Array<{type: string, text: string}>, isError?: boolean }>}
 *   MCP tool response. ReedApiError instances become `{ isError: true, ... }`
 *   with a code-specific message. Other errors propagate.
 */
export async function handler(args, client) {
  try {
    const result = await client.searchJobs(args);
    return {
      content: [{ type: 'text', text: formatResults(result) }],
    };
  } catch (error) {
    if (error instanceof ReedApiError) {
      return {
        isError: true,
        content: [{ type: 'text', text: messageForError(error) }],
      };
    }
    throw error;
  }
}

/**
 * Format Reed's search response as a human-readable summary aimed at an LLM
 * consumer. File-local because it is specific to multi-result search shape;
 * the per-job formatting is shared via `formatJob` in `_shared.js`.
 *
 * @param {object} result - Reed's parsed response, shape
 *   `{ results, totalResults, ambiguousLocations }`.
 * @returns {string}
 */
function formatResults(result) {
  const { results = [], totalResults = 0, ambiguousLocations = [] } = result;
  const lines = [`Found ${totalResults} jobs (returned ${results.length}).`];

  if (ambiguousLocations.length > 0) {
    lines.push(`Ambiguous locations: ${ambiguousLocations.join(', ')}.`);
  }

  for (const job of results) {
    lines.push('', formatJob(job));
  }

  return lines.join('\n');
}
