# Security

This server is public and read-only: no authentication, no writes, no user data, no secrets, no outbound requests at request time.

Report a vulnerability to **security@tasksiddhi.com**. Please include the endpoint, the request and what you observed. We aim to reply within one business day (US Eastern).

Controls: 64 KB request cap, per-IP rate limit, JSON-RPC errors that never echo internals, no URL-fetching or file-reading tools, content served only from `data/site.json`.
