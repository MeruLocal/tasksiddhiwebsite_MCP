# Operations

## Deploy
Any container host. `docker build -t tasksiddhi-mcp . && docker run -p 3000:3000 -e PUBLIC_URL=https://mcp.tasksiddhi.com -e TRUST_PROXY=1 tasksiddhi-mcp`. Put TLS in front. Point `mcp.tasksiddhi.com` at it. Then: `npm run probe -- https://mcp.tasksiddhi.com`.

## Keep the content true
1. Check out the website trunk.
2. `npm run sync -- <checkout>` then `npm run verify` (tests fail on a price figure, a contradicted capability or a sibling brand).
3. Review the `data/site.json` diff, commit, deploy.
Do this on every website pricing/limits/comparison change and at least monthly: competitor facts carry their checked date and go stale. The response to every comparison says so.

## Weekly check
`npm run probe -- https://mcp.tasksiddhi.com` (10 assertions, zero dependencies), and confirm `/version` shows the expected `site_mirror.commit`.

## Not done here
No telemetry, no analytics, no third-party sinks. Add request-count logging at the host if wanted; logs contain method, path, status and duration only.
