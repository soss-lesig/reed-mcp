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
  - `README.md` - project overview
  - `DECISIONS.md` - architectural decisions log (read this for the "why")
  - `ROADMAP.md` - build queue and deferred items
  - `docs/session-notes.md` - live session log, append new dated entries here as work progresses
  - `docs/code-walkthrough.md` - prose tour of the codebase, updated same-commit as code changes
  - `blog/` - blog post drafts (empty for now)

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

**Session:** 4 (next Code session; session 3 was 2026-05-05, split between Desktop and Code)
**Date:** TBD
**Goal:** Continue v0.1.0 build. Step 8 (server.js) onwards.

### Completed steps

Steps 1-7 are done and committed. Current repo state: five commits on main, no remote, working tree clean.

| Commit | Step(s) | Message |
|--------|---------|---------|
| `e5d1193` | 1-4 | `chore: scaffold project` |
| `fc84aa2` | 5 | `feat: add Reed API client` |
| `fb61dfe` | 6 | `feat: add search_jobs MCP tool` |
| (from session 3) | 6.5 | `refactor: extract shared tool helpers` |
| (from session 3) | 7 | `feat: add get_job_details MCP tool` |

### Build queue (remaining)

Every step that creates or edits a `src/` file also updates the matching section in `docs/code-walkthrough.md` in the same commit, per the enforced rule above.

8. **Build `src/server.js`** - creates an `McpServer` instance, registers both tools, exports the configured server. Knows nothing about transports. Agreed shape: closure-binding loop, tool handlers stay `(args, client)`. DECISIONS.md entry deferred until the SDK schema-shape question is resolved (whether `server.tool` accepts a refined `ZodObject` or wants a raw `ZodRawShape`). Update walkthrough section.
9. **Build `src/index.stdio.js`** - imports the server, wraps it in `StdioServerTransport`, starts listening. Reads `REED_API_KEY` from env, fails loudly if missing. This is the `bin` target for `npx reed-mcp`. Update walkthrough section.
10. **Build `src/index.http.js`** - imports the server, wraps it in `StreamableHTTPServerTransport`, mounts on Express at `POST /mcp`. Reads `PORT` from env (Railway sets this), defaults to 3000. Update walkthrough section.
11. **Add npm scripts** - `start:stdio`, `start:http`, both using `node --env-file=.env src/index.*.js`.
12. **Write `Dockerfile`** - Node 20 alpine, copy package.json, install, copy src, expose PORT, CMD runs the HTTP entry point.
13. **Write `railway.json`** - minimum viable Railway template config for one-click deploy.
14. **Write `README.md`** - the product-facing README. Hero section, Railway deploy button, stdio config snippet for local clients, link to `docs/deploy.md` for alternatives. Credit @kld3v's reed_jobs_mcp in one line.
15. **Write `docs/deploy.md`** - Railway (primary), Docker, manual clone-and-run.
16. **Local test: stdio** - run `npm run start:stdio`, verify it starts and responds to a basic MCP initialise from a local Claude Desktop config pointing at it.
17. **Local test: HTTP** - run `npm run start:http`, curl the `/mcp` endpoint with a valid MCP initialise payload, verify response.
18. **Create GitHub repo** (public, MIT, no README conflict - ours lives in the repo). Push.
19. **Deploy to Railway** - point Railway at the GitHub repo, set `REED_API_KEY` env var, confirm public URL works.
20. **End-to-end test** - add the Railway URL as a custom connector in Claude.ai, run a real query, confirm it works.
21. **Tag v0.1.0** and push the tag.
22. **npm publish** - verify `reed-mcp` is available on npm, fall back to `@drewbs/reed-mcp` if not. Publish. (If time is short, this is the step to defer to a follow-up session.)
23. **Session close** - update `docs/session-notes.md`, tick `ROADMAP.md`, verify walkthrough is current, `jcodemunch:index_folder` this directory.

### Things NOT in scope

- Portfolio page on drewbs.dev (separate session).
- Blog post drafting (separate session; raw session notes go in the vault as we work).
- Tests.
- TypeScript.
- CI/CD, automated release workflows.
- Anything in the "Explicitly deferred" or "Not going to happen" sections of ROADMAP.md.

### Previous Sessions Summary

- **Session 1** (2026-04-23, Claude Desktop): Planning only. Full vault scaffold, all architectural decisions captured in DECISIONS.md.
- **Session 2** (2026-04-24, Claude Code): Steps 1-5 completed. Package scaffolding, dependencies, .env.example, LICENSE, reed-client.js.
- **Session 3** (2026-05-05, Desktop + Code): Git init corrected (brought forward from step 18). Step 6 (search-jobs.js) completed. Shared helpers extracted to _shared.js. Step 7 (get-job-details.js) completed. Extract-vs-duplicate decision resolved (extract first). Per-step commit policy established.
