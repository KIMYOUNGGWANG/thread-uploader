# Malformed URL HTTP QA

Artifact:

- `.omo/ulw-loop/evidence/019e9180-d682-7553-aa30-cb52004e2102/C002-http-malformed-url.json`

Observed summary:

```json
{
  "status": "needs_input",
  "score": 75,
  "canStartCampaign": false,
  "gapFields": [
    "landingUrl"
  ],
  "messages": [
    "랜딩 URL은 https://, http://, 또는 /path 형식이어야 합니다."
  ]
}
```

Runtime cleanup:

```text
lsof -nP -iTCP:3001 -sTCP:LISTEN
```

Exit code: 1, no output. Checked at `Thu Jun 4 12:35:10 PDT 2026`.
