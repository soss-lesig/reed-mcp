# CLAUDE.md

## Part A: Standing Instructions

This is the reed-mcp project. A Model Context Protocol server wrapping the Reed.co.uk Jobseeker API, built for use with AI assistants during a UK job search.

The architectural reasoning behind every decision in this project lives in the Obsidian vault at `/Users/drewbs/dev/drewbs-vault/mayus-vault/projects/reed-mcp/DECISIONS.md`. Read it before making any structural changes. If a decision needs revisiting, add a new dated entry to that file rather than mutating an existing one.

### Ground Rules

- **Explain before executing.** Walk through planned changes before writing anything. One step at a time.
- **Never commit or push without explicit sign-off.** Stage changes, show `git status`, wait for confirmation.
- **British English.** No long em dashes in any written content.
- **Conventional commits.** `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`. Short messages, detail in PR descriptions later.
- **Branch naming:** `feature/kebab-case`, `fix/kebab-case`.
- **Earn complexity.** No TypeScript, no monorepo, no tests yet. The scope is deliberately tight. If you think something needs adding, check `ROADMAP.md` in the vault for whether it's already been deferred or explicitly declined.
- **Vault-currency checkpoint.** Before starting any numbered build step, confirm the vault is current. If a decision was made, a lesson was learned, or something unexpected happened since the last vault write, write it to `DECISIONS.md` and/or `docs/session-notes.md` before proceeding. The walkthrough rule already enforces same-commit updates for code; this extends that discipline to decisions and session notes between steps.

### Language and Tooling

- **JavaScript, ESM.** `"type": "module"` in package.json. No TypeScript.
- **Node 20+** with the `--env-file=.env` flag for env loading. Never use the `dotenv` package.
- **MCP SDK:** `@modelcontextprotocol/sdk` (the official one). Dual transport: stdio and Streamable HTTP.
- **HTTP transport uses Express** for the minimal routing around `/mcp`.

### Code Documentation (enforced)

These four rules are enforced on every source file. The goal is that a reader who has never seen this codebase can understand any file on first read.

1. **JSDoc every exported function and class.** Document parameters with types, the return value, and any errors thrown. Single-line JSDoc is fine for one-arg helpers; multi-line for anything non-trivial.
2. **Per-file header comment at the top of every source file.** One paragraph, maximum five lines. Explains what the file is, why it exists, and how it relates to the rest of the codebase. Written in prose, not a bulleted list.
3. **Inline comments only for non-obvious choices.** Explain the *why*, not the *what*. "HTTP Basic with empty password (Reed's documented auth pattern)" is worth a comment. "Increment counter" is not.
4. **Decisions made during coding go in `DECISIONS.md` in the vault.** If an implementation choice emerges that was not planned in the Desktop session (e.g. "went with native fetch instead of axios because X", "structured the error response this way because Y"), add a new dated entry to the decisions log. This keeps architectural reasoning visible rather than buried in commit messages or inline comments.

### Code Walkthrough (enforced)

The vault file `docs/code-walkthrough.md` is a prose tour guide to the codebase, aimed at a reader who knows what MCP and the Reed API are but has not seen this code before. It has one section per source file plus an overview diagram and a shared types section.

**Update rule: the walkthrough is updated in the same commit as the code change it describes, or in a chained commit immediately after.** Never at session close. Walkthrough and code must not drift. If you edit `src/reed-client.js`, the matching section in `code-walkthrough.md` is updated in the same commit.

### Key File Locations

- **Repo:** `/Users/drewbs/dev/projects/repos/reed-mcp`
- **Vault:** `/Users/drewbs/dev/drewbs-vault/mayus-vault/projects/reed-mcp/`
  - `README.md` — project overview
  - `DECISIONS.md` — architectural decisions log (read this for the "why")
  - `ROADMAP.md` — build queue and deferred items
  - `docs/session-notes.md` — live session log, append new dated entries here as work progresses
  - `docs/code-walkthrough.md` — prose tour of the codebase, updated same-commit as code changes
  - `blog/` — blog post drafts (empty for now)

### Session Close Checklist

1. Append a dated entry to `docs/session-notes.md` in the vault summarising what was done and what was learned.
2. Tick off completed items in `ROADMAP.md`.
3. If any architectural decision was made or changed during the session, add a new entry to `DECISIONS.md` (never edit existing entries, add new dated ones).
4. Verify `docs/code-walkthrough.md` reflects the current state of the code. If any section is stale, that is a process failure worth noting in session-notes.
5. Stage all changes, show `git status`, wait for sign-off before committing.
6. Confirm `jcodemunch` indexing at session close (see below).

### Indexing

After the first working session, index the repo with `jcodemunch:index_folder` for future code lookups. Do this at session close, not session open, because the index would be invalidated by the session's own writes.

---

## Part B: Current Session Brief

**Session:** 2 (first build session; session 1 was planning in Claude Desktop on 2026-04-23)
**Date:** 2026-04-24
**Goal:** Ship v0.1.0. Public GitHub repo with a working dual-transport MCP server, deployable in 90 seconds via Railway, publishable to npm as `reed-mcp`.

### Build queue (in order)

Every step that creates or edits a `src/` file also updates the matching section in `docs/code-walkthrough.md` in the same commit, per the enforced rule above.

1. **npm init** — ESM package, `"type": "module"`, `"bin"` entry pointing at `src/index.stdio.js`, Node 20+ engine.
2. **Install dependencies** — `@modelcontextprotocol/sdk`, `express`, `zod`. No dev dependencies unless needed.
3. **Write `.env.example`** — just `REED_API_KEY=` with a comment pointing at the Reed developer portal.
4. **Write `LICENSE`** — MIT, year 2026, holder "Andrew Pendlebury".
5. **Build `src/reed-client.js`** — class-based client, constructor takes `{ apiKey }`, exposes `searchJobs(params)` and `getJobDetails(jobId)`. HTTP Basic Auth, key as username, empty password. Handles 429 and 403 as structured errors per the rate-limiting decision. Uses native `fetch` (Node 20+). Update walkthrough section.
6. **Build `src/tools/search-jobs.js`** — exports a zod schema matching Reed's search parameters and a handler function that takes `(args, client)` and returns MCP tool response format. Update walkthrough section.
7. **Build `src/tools/get-job-details.js`** — same shape, for the details endpoint. Update walkthrough section.
8. **Build `src/server.js`** — creates an `McpServer` instance, registers both tools, exports the configured server. Knows nothing about transports. Update walkthrough section.
9. **Build `src/index.stdio.js`** — imports the server, wraps it in `StdioServerTransport`, starts listening. Reads `REED_API_KEY` from env, fails loudly if missing. Update walkthrough section.
10. **Build `src/index.http.js`** — imports the server, wraps it in `StreamableHTTPServerTransport`, mounts on Express at `POST /mcp`. Reads `PORT` from env (Railway sets this), defaults to 3000. Update walkthrough section.
11. **Add npm scripts** — `start:stdio`, `start:http`, both using `node --env-file=.env src/index.*.js`.
12. **Write `Dockerfile`** — Node 20 alpine, copy package.json, install, copy src, expose PORT, CMD runs the HTTP entry point.
13. **Write `railway.json`** — minimum viable Railway template config for one-click deploy.
14. **Write `README.md`** — the product-facing README. Hero section, Railway deploy button, stdio config snippet for local clients, link to `docs/deploy.md` for alternatives. Credit @kld3v's reed_jobs_mcp in one line.
15. **Write `docs/deploy.md`** — Railway (primary), Docker, manual clone-and-run.
16. **Local test: stdio** — run `npm run start:stdio`, verify it starts and responds to a basic MCP initialize from a local Claude Desktop config pointing at it.
17. **Local test: HTTP** — run `npm run start:http`, curl the `/mcp` endpoint with a valid MCP initialize payload, verify response.
18. **Git init, first commit** — `chore: initial commit` with vault `DECISIONS.md` context referenced in the PR description later. Wait for sign-off before commit.
19. **Create GitHub repo** (public, MIT, no README conflict — ours lives in the repo). Push.
20. **Deploy to Railway** — point Railway at the GitHub repo, set `REED_API_KEY` env var, confirm public URL works.
21. **End-to-end test** — add the Railway URL as a custom connector in Claude.ai, run a real query, confirm it works.
22. **Tag v0.1.0** and push the tag.
23. **npm publish** — verify `reed-mcp` is available on npm, fall back to `@drewbs/reed-mcp` if not. Publish. (If time is short, this is the step to defer to a follow-up session.)
24. **Session close** — update `docs/session-notes.md`, tick `ROADMAP.md`, verify walkthrough is current, `jcodemunch:index_folder` this directory.

### Things NOT in scope this session

- Portfolio page on drewbs.dev (separate session).
- Blog post drafting (separate session; raw session notes go in the vault as we work).
- Tests.
- TypeScript.
- CI/CD, automated release workflows.
- Anything in the "Explicitly deferred" or "Not going to happen" sections of ROADMAP.md.

### Previous Session Summary

Session 1 (2026-04-23, Claude Desktop) was planning only. Produced the full vault scaffold (README, DECISIONS, ROADMAP, session-notes, code-walkthrough skeleton) and the repo scaffold (.claude config, .gitignore, this CLAUDE.md). No code written. All architectural decisions are captured in `DECISIONS.md`; read it first.
