/**
 * MCP tool definition for fetching a single Reed job by ID. Calls Reed's
 * /jobs/{id} endpoint and renders the full job details, including the
 * complete description (no truncation). The user is asking for one specific
 * job in depth, so truncation would defeat the purpose. Field layout and
 * error mapping are shared with search-jobs.js via `_shared.js`.
 */

import { z } from 'zod';
import { ReedApiError } from '../reed-client.js';
import { formatJob, messageForError } from './_shared.js';

/** MCP tool name registered by the server. */
export const name = 'get_job_details';

/** Human-readable blurb shown in the tool's MCP metadata. */
export const description =
  'Fetch full details for a single Reed.co.uk job by its job ID. ' +
  'Returns the complete description and any extra fields Reed exposes for ' +
  'the details endpoint (contract type, expiration date, application count).';

/**
 * Zod schema for the get_job_details arguments. The single field, `jobId`,
 * accepts either numeric or string form because Reed's IDs are integer
 * values that may be passed around as strings (for example, extracted from
 * a Reed URL). The Reed client accepts both forms.
 */
export const schema = z.object({
  jobId: z
    .union([z.number().int().positive(), z.string().min(1)])
    .describe('Reed job ID. Accepts numeric ID (e.g. 12345678) or string form.'),
});

/**
 * Handle a get_job_details tool call.
 *
 * @param {z.infer<typeof schema>} args - Arguments validated against `schema`.
 * @param {import('../reed-client.js').default} client - Configured ReedClient.
 * @returns {Promise<{ content: Array<{type: string, text: string}>, isError?: boolean }>}
 *   MCP tool response. ReedApiError instances become `{ isError: true, ... }`
 *   with a code-specific message. Other errors propagate.
 */
export async function handler(args, client) {
  try {
    const job = await client.getJobDetails(args.jobId);
    return {
      content: [{ type: 'text', text: formatJob(job, { truncated: false }) }],
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
