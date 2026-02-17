# LendFlow Workflow API

This backend powers borrower submission and lender pipeline review.

## Run

```bash
npm run api:dev
```

Default base URL: `http://localhost:5051`

Optional upload body limit in `.env`:

```bash
WORKFLOW_API_BODY_LIMIT=25mb
```

## Health & Docs

- `GET /api/workflows/health`
- `GET /api/workflows/docs`

## Submit Loan Application

Primary endpoint:
- `POST /api/workflows/applications`

Alias endpoint:
- `POST /api/workflows/applications/submit`

### Example (Purchase)

```bash
curl -X POST http://localhost:5051/api/workflows/applications/submit \
  -H "Content-Type: application/json" \
  -d '{
    "borrowerName": "Michael Chen",
    "property": "999 Demo Avenue, Austin, TX",
    "type": "Purchase",
    "amount": 420000,
    "purchaseDetails": {
      "purchasePrice": "385000",
      "rehabBudget": "60000",
      "arv": "575000",
      "compsValidationNote": "Confirmed COMPS are within at least 0.50 miles radius and sold in the last 6 months",
      "compsFiles": ["comp-1.pdf", "comp-2.pdf", "comp-3.pdf"],
      "propertyPhotos": ["front.jpg", "kitchen.jpg"],
      "purchaseContractFiles": ["purchase-contract.pdf"],
      "scopeOfWorkFiles": ["itemized-rehab-scope.pdf"],
      "exitStrategy": "Fix and Flip",
      "targetClosingDate": "2026-03-31"
    }
  }'
```

## Lender Pipeline

- `GET /api/workflows/lender/pipeline`
- New submissions appear as `New Loan Request`
- Includes AI assessment + pre-approval recommendation data

### Save Pre-Approval Decision

```bash
curl -X POST http://localhost:5051/api/workflows/lender/pipeline/LA-2026-1503/decision \
  -H "Content-Type: application/json" \
  -d '{"decision":"PRE_APPROVE"}'
```

Allowed decisions:
- `PRE_APPROVE`
- `DECLINE`
- `REQUEST_INFO`

## Lender Email Notifications

When a new request is submitted, the API can email lender recipients with:
- Quick request preview (borrower, property, type, amount, purchase details)
- Uploaded document previews/links (COMPS, property photos, purchase contract, scope of work)
- Action links/buttons:
1. Approve
2. Leave comment
3. Message borrower (sends to borrower email)
4. Deny with notes

Configure in `.env`:

```bash
SENDGRID_API_KEY=...
EMAIL_FROM=...
LENDER_NOTIFICATION_EMAILS=underwriting@example.com,ops@example.com
LENDER_EMAIL_ACTION_SECRET=replace-with-random-secret
LENDER_EMAIL_ACTION_BASE_URL=http://localhost:5051
LENDER_EMAIL_ACTION_TTL_MS=259200000
LENDER_PORTAL_BASE_URL=http://localhost:5173
LENDER_EMAIL_DOCUMENT_PREVIEW_MAX_FILES=10
```

Action endpoint pattern used by email links:
- `GET/POST /api/workflows/lender/email-actions/:id/:action?exp=...&sig=...`
- Actions: `approve`, `comment`, `message`, `deny`

Document preview endpoint used by email:
- `GET /api/workflows/lender/document-preview/:id/:group/:index?exp=...&sig=...`
- Groups: `compsFiles`, `propertyPhotos`, `purchaseContractFiles`, `scopeOfWorkFiles`

Viewer endpoint used by highlighted email links (with back/next photo arrows):
- `GET /api/workflows/lender/document-viewer/:id/:group/:index?exp=...&sig=...`

## Data Persistence

Applications are stored in:
- `server/data/workflow-applications.json`

So submitted applications persist across API restarts.
