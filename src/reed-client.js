/**
 * HTTP client for the Reed.co.uk Jobseeker API. This is the only module that
 * talks to Reed's servers. It handles authentication, request serialisation,
 * and error mapping. Everything else in the codebase consumes this client
 * through its two public methods: searchJobs and getJobDetails.
 */

const BASE_URL = 'https://www.reed.co.uk/api/1.0';

/**
 * Structured error for non-2xx responses from the Reed API. Tool handlers
 * switch on the `code` property to produce appropriate MCP error responses.
 *
 * Valid codes (closed enum; adding a new one requires a DECISIONS.md entry):
 * RATE_LIMITED, AUTH_FAILED, UPSTREAM_ERROR, NOT_FOUND, BAD_REQUEST.
 */
export class ReedApiError extends Error {
  /**
   * @param {string} message - Human-readable description of what went wrong.
   * @param {object} options
   * @param {number} options.status - HTTP status code from Reed's response.
   * @param {'RATE_LIMITED'|'AUTH_FAILED'|'UPSTREAM_ERROR'|'NOT_FOUND'|'BAD_REQUEST'} options.code
   *   Semantic error code for tool handlers to switch on.
   * @param {number} [options.retryAfter] - Seconds to wait before retrying,
   *   normalised from the Retry-After header. Only present for RATE_LIMITED.
   */
  constructor(message, { status, code, retryAfter }) {
    super(message);
    this.name = 'ReedApiError';
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

/**
 * Thin HTTP wrapper around Reed's Jobseeker API. Handles authentication,
 * query serialisation, and error mapping. Has no MCP awareness: it returns
 * plain objects parsed from Reed's JSON responses.
 */
export default class ReedClient {
  /** @type {string} */
  #authHeader;

  /**
   * @param {object} options
   * @param {string} options.apiKey - Reed API key, used as the username in
   *   HTTP Basic auth with an empty password.
   */
  constructor({ apiKey }) {
    // Reed uses HTTP Basic auth: API key as username, empty password.
    const encoded = Buffer.from(`${apiKey}:`).toString('base64');
    this.#authHeader = `Basic ${encoded}`;
  }

  /**
   * Search for jobs matching the given parameters.
   *
   * @param {object} params - Reed search parameters using their exact field
   *   names (e.g. keywords, locationName, distanceFromLocation, minimumSalary).
   *   All fields are optional at this level; the tool-layer Zod schema enforces
   *   that at least keywords or locationName is present.
   * @returns {Promise<object>} Reed's search response, typically
   *   `{ results: Array, totalResults: number, ambiguousLocations: Array }`.
   * @throws {ReedApiError} On any non-2xx response from Reed.
   */
  async searchJobs(params = {}) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        query.append(key, String(value));
      }
    }
    const qs = query.toString();
    const path = qs ? `/search?${qs}` : '/search';
    return this.#request(path);
  }

  /**
   * Fetch full details for a single job by its Reed job ID.
   *
   * @param {number|string} jobId - The Reed job ID.
   * @returns {Promise<object>} The full job details object from Reed.
   * @throws {ReedApiError} On any non-2xx response from Reed.
   */
  async getJobDetails(jobId) {
    return this.#request(`/jobs/${jobId}`);
  }

  /**
   * Internal: makes an authenticated GET request to Reed and maps non-2xx
   * responses to ReedApiError instances.
   *
   * @param {string} path - URL path (with query string if needed), appended
   *   to the Reed API base URL.
   * @returns {Promise<object>} Parsed JSON response body.
   * @throws {ReedApiError}
   */
  async #request(path) {
    const response = await fetch(`${BASE_URL}${path}`, {
      headers: { Authorization: this.#authHeader },
    });

    if (!response.ok) {
      throw this.#errorFromResponse(response);
    }

    // Defend against empty or non-JSON 2xx responses.
    try {
      return await response.json();
    } catch {
      throw new ReedApiError(
        `Reed returned status ${response.status} with an unparseable body`,
        { status: response.status, code: 'UPSTREAM_ERROR' },
      );
    }
  }

  /**
   * Internal: maps a non-2xx Response to a ReedApiError with the appropriate
   * semantic code.
   *
   * @param {Response} response - The fetch Response object.
   * @returns {ReedApiError}
   */
  #errorFromResponse(response) {
    const { status } = response;

    if (status === 429) {
      const retryAfter = this.#parseRetryAfter(response.headers.get('retry-after'));
      return new ReedApiError(
        'Reed rate limit exceeded. Try again later.',
        { status, code: 'RATE_LIMITED', retryAfter },
      );
    }

    if (status === 401 || status === 403) {
      return new ReedApiError(
        'Reed rejected the API key. Check REED_API_KEY is valid.',
        { status, code: 'AUTH_FAILED' },
      );
    }

    if (status === 404) {
      return new ReedApiError(
        `Reed returned 404 for ${response.url}`,
        { status, code: 'NOT_FOUND' },
      );
    }

    if (status === 400) {
      return new ReedApiError(
        'Reed rejected the request as malformed',
        { status, code: 'BAD_REQUEST' },
      );
    }

    // 5xx and anything else we haven't explicitly mapped.
    return new ReedApiError(
      `Reed returned unexpected status ${status}`,
      { status, code: 'UPSTREAM_ERROR' },
    );
  }

  /**
   * Internal: normalises a Retry-After header value to seconds. Returns
   * undefined if the header is missing or unparseable.
   *
   * @param {string|null} headerValue - Raw Retry-After header.
   * @returns {number|undefined} Seconds to wait, or undefined.
   */
  #parseRetryAfter(headerValue) {
    if (!headerValue) return undefined;

    // Retry-After is either seconds (integer) or an HTTP-date.
    const asNumber = Number(headerValue);
    if (!Number.isNaN(asNumber) && asNumber >= 0) {
      return asNumber;
    }

    // Try parsing as HTTP-date and converting to seconds from now.
    const date = new Date(headerValue);
    if (!Number.isNaN(date.getTime())) {
      const seconds = Math.ceil((date.getTime() - Date.now()) / 1000);
      return seconds > 0 ? seconds : undefined;
    }

    return undefined;
  }
}
