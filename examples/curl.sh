#!/bin/sh
# Stateless: no session handshake needed. Each call is independent.
URL=${1:-https://mcp.tasksiddhi.com/mcp}
curl -s -X POST "$URL" -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"product_check_capability","arguments":{"need":"gantt chart"}}}'
