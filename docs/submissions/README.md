# Directory submission packets (prepared, NOT submitted)

Nothing here has been submitted anywhere. Each file is a ready-to-use packet. Submit in this order, and only after the three prerequisites hold.

## Prerequisites (owner actions)

1. **Host the server and publish DNS for `mcp.tasksiddhi.com`.** Today the name does not resolve, so every packet below points at an endpoint that does not exist yet. Deploy the Dockerfile (any container host), point `mcp.tasksiddhi.com` at it, then run `npm run probe -- https://mcp.tasksiddhi.com` and confirm all PASS.
2. **Add a `/mcp` page on tasksiddhi.com** (copy in `docs/website-patch.md`) and the one-line `llms.txt` addition, so directory listings have a canonical human page to link to.
3. **Decide the public repository location.** Directories show the repository URL publicly. Use a repository whose owner name matches the product's own entity (Soor LLC) before submitting.

## Order

| # | Directory | Packet | Needs |
|---|---|---|---|
| 1 | Official MCP Registry | `official-registry.md` | DNS TXT on tasksiddhi.com for namespace `com.tasksiddhi` |
| 2 | Smithery | `smithery.md` | endpoint live, public repo |
| 3 | Glama | `glama.md` | public repo, `glama.json` claim |
| 4 | PulseMCP | `pulsemcp.md` | endpoint live (it also ingests the official registry) |

Re-run the conformance probe before each submission.
