# Manual QA Blocker And Cleanup

Attempted local dev server:

```sh
npm run dev -- --port 3001
```

Server output showed `Ready` on `http://localhost:3001`.

Attempted HTTP QA:

```sh
curl -sS -X POST http://localhost:3001/api/products/auto-setup ...
curl -sS -X POST http://127.0.0.1:3001/api/products/auto-setup ...
```

Both sandboxed curl calls failed with:

```text
Failed to connect ... Couldn't connect to server
```

`lsof` confirmed the server was listening on port 3001. The required escalated local HTTP retry was rejected by the approval reviewer due usage limit, so no further local HTTP/browser workaround was attempted.

Cleanup:

```sh
lsof -nP -iTCP:3001 -sTCP:LISTEN
```

Exit code: 1, no output. Port 3001 is clear.
