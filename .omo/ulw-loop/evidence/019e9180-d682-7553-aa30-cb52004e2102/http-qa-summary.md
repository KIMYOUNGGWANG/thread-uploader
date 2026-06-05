# HTTP Manual QA Summary

Server:

```sh
npm run dev -- --port 3001
```

Ready request artifact:

- `.omo/ulw-loop/evidence/019e9180-d682-7553-aa30-cb52004e2102/C001-http-ready.json`

Observed summary:

```json
{
  "status": "ready",
  "score": 100,
  "canStartCampaign": true,
  "qualityProfile": "product_growth",
  "topics": 3,
  "formulas": 3,
  "campaign": "product_growth_baseline",
  "landingUrl": "https://invoiceflow.app"
}
```

Edge request artifact:

- `.omo/ulw-loop/evidence/019e9180-d682-7553-aa30-cb52004e2102/C002-http-edge.json`

Observed summary:

```json
{
  "status": "needs_input",
  "score": 20,
  "canStartCampaign": false,
  "gapFields": [
    "oneLineDescription",
    "targetCustomer",
    "offerPromise",
    "landingUrl"
  ],
  "topics": 0
}
```
