/**
 * Shared helpers for MCP tool handlers in this directory. Both search-jobs.js
 * and get-job-details.js import from here. The leading underscore signals
 * "internal to the tools directory": this module is not itself an MCP tool
 * and should never be registered as one.
 */

/**
 * Format a single Reed job result as a multi-line block. Used by both the
 * search and details tools. Optional Reed fields are printed only when
 * present, so the helper degrades gracefully whether the job came from a
 * search result (sparser) or the /jobs/{id} endpoint (richer).
 *
 * @param {object} job - One Reed job object.
 * @param {object} [options]
 * @param {boolean} [options.truncated=true] - If true, the description is
 *   truncated to ~240 chars. Pass false (from the details tool) to surface
 *   the full description.
 * @returns {string}
 */
export function formatJob(job, { truncated = true } = {}) {
  const salary = formatSalary(job.minimumSalary, job.maximumSalary, job.currency);
  const header = `[#${job.jobId}] ${job.jobTitle} - ${job.employerName}`;
  // Search results use `date`; details uses `datePosted`.
  const dateField = job.date || job.datePosted;
  const meta = [job.locationName, salary, dateField].filter(Boolean).join(' | ');

  const lines = [header];
  if (meta) lines.push(`  ${meta}`);

  // Optional fields surfaced only when Reed includes them in the response.
  if (job.contractType) lines.push(`  Contract type: ${job.contractType}`);
  if (job.expirationDate) lines.push(`  Expires: ${job.expirationDate}`);
  // Search results use `applications`; details uses `applicationCount`.
  const applicationCount = job.applicationCount ?? job.applications;
  if (applicationCount !== undefined && applicationCount !== null) {
    lines.push(`  Applications: ${applicationCount}`);
  }
  if (job.jobUrl) lines.push(`  ${job.jobUrl}`);
  if (job.externalUrl && job.externalUrl !== job.jobUrl) {
    lines.push(`  External: ${job.externalUrl}`);
  }

  if (job.jobDescription) {
    if (truncated) {
      lines.push(`  ${truncate(job.jobDescription, 240)}`);
    } else {
      // Full description: blank line separator, no indent, so wrapped text
      // reads as a paragraph rather than a hanging-indented block.
      lines.push('', job.jobDescription);
    }
  }

  return lines.join('\n');
}

/**
 * Format Reed's min/max salary fields as a single string. Tolerates partial
 * data (only min, only max, neither).
 *
 * @param {number|null|undefined} min
 * @param {number|null|undefined} max
 * @param {string|null|undefined} currency
 * @returns {string} e.g. "GBP 50000-70000", "GBP 50000+", or "" if absent.
 */
export function formatSalary(min, max, currency) {
  const cur = currency || 'GBP';
  if (min && max) return `${cur} ${min}-${max}`;
  if (min) return `${cur} ${min}+`;
  if (max) return `${cur} up to ${max}`;
  return '';
}

/**
 * Truncate a string to a maximum length, appending an ellipsis if cut.
 *
 * @param {string} text
 * @param {number} max
 * @returns {string}
 */
export function truncate(text, max) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * Map a ReedApiError to a user-facing message for MCP error responses. Both
 * tool handlers use this so the error wording is identical across tools.
 *
 * @param {import('../reed-client.js').ReedApiError} error
 * @returns {string}
 */
export function messageForError(error) {
  switch (error.code) {
    case 'RATE_LIMITED':
      return error.retryAfter !== undefined
        ? `Reed rate-limited the request. Retry after ${error.retryAfter} seconds.`
        : 'Reed rate-limited the request. Try again shortly.';
    case 'AUTH_FAILED':
      return 'Reed rejected the API key. Check that REED_API_KEY is set correctly.';
    case 'BAD_REQUEST':
      return `Reed rejected the request: ${error.message}`;
    case 'NOT_FOUND':
      return `Reed returned 404: ${error.message}`;
    case 'UPSTREAM_ERROR':
    default:
      return `Reed upstream problem: ${error.message}`;
  }
}
