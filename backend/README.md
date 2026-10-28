# NyaySetu Backend

Node.js ES modules, Express 5, and MongoDB/Mongoose REST API. The frontend is a separate React
application; this backend does not serve or build frontend assets.

## Local setup

Requirements: a currently supported Node.js version (Node 20+ recommended), npm, and a reachable
MongoDB instance. From this `backend` directory:

```sh
npm install
```

In PowerShell, create the local environment file:

```powershell
Copy-Item .env.example .env
```

Edit `backend/.env` locally. Set `MONGODB_URI` to your own local MongoDB URI (for example
`mongodb://127.0.0.1:27017/nyaysetu`) or your privately configured Atlas connection string. Set
`JWT_SECRET` to a private random secret of at least 32 characters. Do not commit `.env` or paste
database credentials or JWT secrets into chat.

```dotenv
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/nyaysetu
JWT_SECRET=replace-with-a-private-random-secret-at-least-32-characters
JWT_EXPIRES_IN=1h
CLIENT_ORIGIN=http://localhost:8080
NODE_ENV=development
ML_SERVICE_URL=http://localhost:8001
```

`CLIENT_ORIGIN` must be one exact HTTP(S) origin: scheme, hostname, and optional port only, with no
path or trailing slash. The default development origin is `http://localhost:8080`. Use the actual
origin reported by the frontend development server if it differs. Production requires an explicit
non-wildcard origin. The CORS middleware allows requests from that configured origin; bearer-token
authentication does not require cookie credentials.

If startup fails with `querySrv ECONNREFUSED` for an Atlas `mongodb+srv` URI, Node.js may be using a
local DNS resolver that is not responding. Set `MONGODB_DNS_SERVERS` to comma-separated trusted DNS
server IP addresses (for example `8.8.8.8,1.1.1.1`), then restart the backend. This override affects
DNS lookups made by the backend process; leave it unset when the system resolver works.

Start the backend:

```sh
npm run dev
```

The server connects to MongoDB before listening on `PORT`, starts the deadline monitor, and closes
the monitor, HTTP listener, and MongoDB connection on SIGINT/SIGTERM. A database URI and a valid
JWT secret are required to start the full server. `npm test` runs isolated tests without MongoDB
credentials and does not connect to a real database.

## API conventions

Base URL for local use: `http://localhost:3000`. Endpoints that accept or return JSON use
`Content-Type: application/json`. JSON validation is strict for the documented request bodies;
unknown body fields are generally rejected.

Only health, registration, and login are public. For every other endpoint, send the JWT returned by
registration or login in the `Authorization` request header. Its value is the word `Bearer`, one
space, and then the JWT:

```http
Authorization: Bearer [token returned by login]
```

Example browser request:

```js
const authorizationValue = ["Bearer", token].join(" ");
const response = await fetch("http://localhost:3000/api/cases", {
  headers: { Authorization: authorizationValue },
});
const body = await response.json();
```

Keep tokens out of URLs and logs. Choose the frontend's token storage strategy with XSS risk in
mind; this API currently uses bearer tokens and does not issue an HttpOnly cookie.

Responses are not fully uniform yet. Successful feature responses usually use
`{ "success": true, "data": ... }`, sometimes with `message` and/or `pagination`. Authentication
responses use `message`, `user`, and `token` without a `success` wrapper. Validation failures
usually return:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [{ "field": "description", "message": "Too small: expected string to have >=10 characters" }]
}
```

Authentication errors may instead be `{ "message": "Invalid or expired token" }`. Missing resources
typically return HTTP 404 with `success: false` and `message`. Unmatched routes return
`{ "error": "Not Found" }`. In production, unhandled errors return
`{ "error": "Internal Server Error" }` without stack details. Some development-mode unhandled
errors include `{ "error": "...", "stack": "..." }`; clients should not depend on these
development-only details.

Common status codes include `400` for invalid input/IDs, `401` for missing or invalid
authentication, `404` for missing or non-owned records, `409` for duplicate accounts or invalid
state transitions, and `429` for the auth rate limit. Error bodies currently vary by handler:

```json
{ "message": "Invalid email or password" }
```

```json
{ "success": false, "message": "Case not found" }
```

```json
{ "message": "Too many authentication attempts. Please try again later." }
```

## Endpoints

### Health

| Method | Path | Auth |
|---|---|---|
| GET | `/api/health` | No |

Example response (`200`):

```json
{ "status": "ok", "message": "NyaySetu API is running" }
```

### Authentication

Registration and login share a rate limit of 10 attempts per IP per 15-minute window.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | No | Create account |
| POST | `/api/auth/login` | No | Authenticate |
| GET | `/api/auth/me` | Protected | Get current user |
| PATCH | `/api/auth/me` | Protected | Update the current user's name |

Register (`POST /api/auth/register`):

```json
{ "name": "Example User", "email": "user@example.test", "password": "a-long-password" }
```

Login (`POST /api/auth/login`):

```json
{ "email": "user@example.test", "password": "a-long-password" }
```

Both successful authentication operations return `200` for login or `201` for registration:

```json
{
  "message": "Registration successful",
  "user": { "id": "507f1f77bcf86cd799439011", "name": "Example User", "email": "user@example.test", "createdAt": "2026-10-28T00:00:00.000Z" },
  "token": "<JWT>"
}
```

Update the current user's name (`PATCH /api/auth/me`):

```json
{ "name": "Example User" }
```

Only `name` can be updated. Unknown fields such as `role`, `passwordHash`, or `email` are rejected.
The response is `{ "message": "Profile updated", "user": { "id", "name", "email", "createdAt" } }`.
Email and password changes are not currently supported.

Email is normalized to lowercase. Passwords must be at least 8 characters and no more than 72
UTF-8 bytes; they are bcrypt-hashed. Duplicate email returns `409`; invalid credentials return
`401`. Password hashes are not included in responses.

### Cases

All case operations require a bearer JWT. Case IDs are MongoDB ObjectIds. Records are scoped to the
authenticated user.

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/cases` | Create case |
| GET | `/api/cases?page=1&limit=20&type=RTI&status=DRAFT` | List/filter cases |
| GET | `/api/cases/:id` | Get one case |
| PATCH | `/api/cases/:id` | Update title, summary, details, location, or authority |
| PATCH | `/api/cases/:id/status` | Change status using allowed transitions |

Create:

```json
{
  "type": "RTI",
  "title": "Project records request",
  "summary": "Request project approval and expenditure records.",
  "details": "Please provide the recorded approval and expenditure information."
}
```

The server sets ownership, initial `DRAFT` status, and a creation event. Supported types are
`RTI`, `RIGHTS`, `CIVIC`. Supported statuses are `DRAFT`, `OPEN`, `IN_PROGRESS`,
`WAITING_FOR_RESPONSE`, `RESOLVED`, `CLOSED`. An illegal transition returns `409`.

Representative response (`201`):

```json
{
  "success": true,
  "message": "Case created",
  "data": {
    "_id": "507f1f77bcf86cd799439012",
    "type": "RTI",
    "title": "Project records request",
    "status": "DRAFT",
    "summary": "Request project approval and expenditure records.",
    "timeline": [{ "type": "CREATED", "title": "Case created" }],
    "createdAt": "2026-10-28T00:00:00.000Z",
    "updatedAt": "2026-10-28T00:00:00.000Z"
  }
}
```

Owner and internal `__v` fields are omitted. List responses have the shape
`{ "success": true, "data": [...], "pagination": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 } }`.

### RTI Assistant

All routes require bearer authentication. Drafts are template-based and saved in MongoDB. No RTI is
filed or sent.

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/rti/drafts` | Generate and save an application draft |
| POST | `/api/rti/drafts/:id/first-appeal` | Generate a first-appeal draft from an owned RTI application draft |
| POST | `/api/rti/cases/:id/action-taken-request` | Generate an action-taken request from an owned unresolved Civic case |
| GET | `/api/rti/drafts?page=1&limit=20` | List own drafts |
| GET | `/api/rti/drafts/:id` | Get own draft |
| PATCH | `/api/rti/drafts/:id` | Edit and save own draft |

Create example:

```json
{
  "description": "Please provide records about the public works project.",
  "caseId": "507f1f77bcf86cd799439012",
  "authority": { "name": "Authority name entered by the user" },
  "receivingOffice": { "name": "Receiving office entered by the user" }
}
```

Only `description` is required. Optional `submissionDate` must be `YYYY-MM-DD` and is recorded as
user-reported, not proof of filing. Optional `responseDeadline` accepts `dueDate`, `sourceType`
(`USER_PROVIDED`, `OFFICIAL_SOURCE`, `AI_GENERATED`), and optional source description/URL; it is
stored unverified and is not calculated. Linked cases must be the user's own RTI case.

Representative response:

```json
{
  "success": true,
  "message": "RTI draft saved. It has not been submitted.",
  "data": {
    "_id": "507f1f77bcf86cd799439013",
    "case": "507f1f77bcf86cd799439012",
    "description": "Please provide records about the public works project.",
    "applicationText": "Subject: Request for information\\n\\nPlease provide records about the public works project.\\n...",
    "status": "DRAFT",
    "filingStatus": "DRAFT_NOT_SUBMITTED",
    "submittedByNyaySetu": false
  }
}
```

Update accepts `description`, `applicationText`, `caseId`, `authority`, `receivingOffice`,
`submissionDate`, and `responseDeadline`; `null` clears nullable metadata fields. Unknown fields
are rejected.

First-appeal draft example:

```http
POST /api/rti/drafts/507f1f77bcf86cd799439013/first-appeal
Authorization: Bearer <JWT>
Content-Type: application/json
```

```json
{
  "grounds": "The response recorded in my request does not address the information requested.",
  "originalRequestReference": "Reference supplied by the user"
}
```

`grounds` is required. The source must be the authenticated user's `APPLICATION` draft. If that
draft links to an RTI case, the case must also belong to the authenticated user. The saved
`FIRST_APPEAL` draft records its source in `parentDraft` and reuses the source case when present.
The generated text is a review-only sample; authority and dates are not independently verified,
and no statutory rule or deadline is asserted.

Action-taken request example:

```http
POST /api/rti/cases/507f1f77bcf86cd799439012/action-taken-request
Authorization: Bearer <JWT>
Content-Type: application/json
```

The request body may be omitted or be an empty JSON object. The source must be the authenticated
user's unresolved Civic case with its associated civic complaint, at least 20 characters of issue
details, a location detail, and a user-identified authority. The saved
`ACTION_TAKEN_REQUEST` draft links to that case. Authority information remains unverified. Missing
required case facts return `400`; inaccessible cases return `404`. The draft is not submitted.

### Rights Companion

All routes require bearer authentication. Categories are `TENANT` and `GIG_WORKER_WORKPLACE`
(configurable with `RIGHTS_CATEGORIES`). Generated guidance and letters use templates and supplied
facts; no external AI or legal database is connected. Nothing is sent to a recipient.

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/rights/cases` | Create a rights case |
| POST | `/api/rights/guidance` | Generate procedural guidance |
| POST | `/api/rights/letters` | Generate formal letter draft |
| GET | `/api/rights/checklist?category=TENANT&urgent=false` | Get checklist |
| POST | `/api/rights/drafts` | Save generated/user-edited draft |
| GET | `/api/rights/drafts?page=1&limit=20&category=TENANT&kind=FORMAL_LETTER` | List own drafts |
| GET | `/api/rights/drafts/:id` | Get own draft |

Create case body:

```json
{ "category": "TENANT", "description": "The ceiling leak was reported to the property manager." }
```

Guidance body:

```json
{ "category": "TENANT", "description": "The ceiling leak was reported to the property manager.", "urgent": false }
```

Letter body:

```json
{
  "category": "TENANT",
  "facts": ["I reported a ceiling leak to the property manager on 12 October."],
  "requestedAction": "Please acknowledge the report and provide a written response.",
  "recipient": "Property manager (verify recipient)",
  "senderName": "Example User",
  "urgent": false
}
```

Guidance/letter generation returns `200` with
`{ "success": true, "message": "...", "data": { "title": "...", "content": "...", "verificationNotice": "...", "category": "...", "urgent": false } }`.
Saving a draft requires `category`, `kind` (`GUIDANCE` or `FORMAL_LETTER`), `title`, `content`,
and `verificationNotice`; include `description` for guidance or `facts` for a formal letter.
Optional `caseId` must refer to the authenticated user's RIGHTS case. Saved records are owner-scoped.
Urgent matters show configured referral text only; NyaySetu does not contact legal aid.

Example guidance response (`200`):

```json
{
  "success": true,
  "message": "Procedural guidance draft generated",
  "data": {
    "title": "Tenant issue — procedural guidance draft",
    "content": "Matter category: Tenant issue\\n...",
    "verificationNotice": "Procedural drafting assistance only, not legal advice...",
    "category": "TENANT",
    "urgent": false
  }
}
```

### Civic Fix

All routes require bearer authentication. Creating a complaint creates a `CIVIC` case and a
complaint record. The complaint is stored locally, not submitted. Images are metadata only; bytes
are not uploaded or stored by these endpoints.

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/civic` | Record complaint |
| GET | `/api/civic?page=1&limit=20&category=POTHOLES&status=OPEN` | List own complaints |
| GET | `/api/civic/:id` | Get own complaint |
| PATCH | `/api/civic/:id` | Update description, category, location, image metadata |
| PATCH | `/api/civic/:id/authority` | Record user-provided authority details |
| PATCH | `/api/civic/:id/status` | Change case status |
| GET | `/api/civic/duplicates` | Get heuristic possible duplicate groups |
| GET | `/api/civic/authority-suggestion` | Get authority finder availability |

Create body:

```json
{
  "description": "A large pothole is present near the north entrance.",
  "category": "POTHOLES",
  "location": { "city": "Example City", "coordinates": { "latitude": 12.9716, "longitude": 77.5946 } },
  "images": [{ "filename": "road-damage.jpg", "mimeType": "image/jpeg", "sizeBytes": 204800 }]
}
```

Categories are `POTHOLES`, `GARBAGE`, `STREETLIGHTS`, `DRAINAGE`, `WATER_SUPPLY`. Coordinates
must be finite latitude/longitude in their valid ranges. Up to five image metadata records of up to
10 MB each are accepted. Authority assignments remain unverified. Authority finder returns a
`null` suggestion. Duplicate groups are category-and-distance heuristics requiring human review;
image detection is not active.

Representative create response (`201`):

```json
{
  "success": true,
  "message": "Civic complaint recorded. It has not been submitted to an authority.",
  "data": {
    "_id": "507f1f77bcf86cd799439015",
    "case": {
      "_id": "507f1f77bcf86cd799439012",
      "type": "CIVIC",
      "title": "potholes: A large pothole is present near the north entrance.",
      "status": "OPEN"
    },
    "category": "POTHOLES",
    "images": [
      {
        "_id": "507f1f77bcf86cd799439017",
        "filename": "road-damage.jpg",
        "mimeType": "image/jpeg",
        "sizeBytes": 204800
      }
    ],
    "authoritySuggestion": {
      "suggestion": null,
      "verificationStatus": "NOT_AVAILABLE",
      "message": "An authority finder is not configured. No authority has been identified or assigned."
    },
    "imageDetection": {
      "active": false,
      "message": "Image detection is not active; no image analysis has been performed."
    },
    "submissionStatus": "NOT_SUBMITTED"
  }
}
```

### Documents

All document routes require bearer authentication. Generated text uses templates; content remains a
draft requiring review. No PDF, email, filing, or submission is performed. Documents and linked
cases are owner-scoped.

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/documents/generate` | Generate and save text draft |
| GET | `/api/documents?page=1&limit=20&type=RTI_APPLICATION&status=DRAFT&caseId=:id` | List own documents |
| GET | `/api/documents/:id` | Get own document |
| PATCH | `/api/documents/:id` | Edit own title/content or set DRAFT/FINAL |

Generation types: `RTI_APPLICATION`, `FIRST_APPEAL`, `RIGHTS_LETTER`, `CIVIC_COMPLAINT`. Each
type accepts only its documented fields; linked cases, if provided, must be the user's own
matching module case.

RTI example:

```json
{
  "type": "RTI_APPLICATION",
  "caseId": "507f1f77bcf86cd799439012",
  "description": "Please provide the records and status of the public works project."
}
```

Rights-letter example:

```json
{
  "type": "RIGHTS_LETTER",
  "category": "TENANT",
  "facts": ["I reported a ceiling leak on 12 October."],
  "requestedAction": "Please provide a written update."
}
```

Civic-complaint example:

```json
{
  "type": "CIVIC_COMPLAINT",
  "category": "STREETLIGHTS",
  "description": "The streetlight near the bus stop has not worked for several days.",
  "location": { "city": "Example City" }
}
```

First appeals accept user-provided `facts`, optional verified-by-user `date` string in `YYYY-MM-DD`,
`authorityName`, and `originalRequestReference`; missing details are placeholders. Generated
documents have `status: "DRAFT"`, `verificationStatus: "UNVERIFIED"`, and `reviewRequired: true`.
`PATCH` accepts `title`, `content`, and/or status `DRAFT` or `FINAL`. Editing content increments
`version` and resets review status. Marking FINAL records user review only, not independent legal
verification.

Representative response:

```json
{
  "success": true,
  "message": "Text draft generated and saved. It has not been filed or submitted.",
  "data": {
    "_id": "507f1f77bcf86cd799439014",
    "case": "507f1f77bcf86cd799439012",
    "title": "RTI application draft",
    "type": "RTI_APPLICATION",
    "source": "GENERATED",
    "status": "DRAFT",
    "content": "Subject: Request for information\\n...",
    "verificationStatus": "UNVERIFIED",
    "reviewRequired": true,
    "submissionStatus": "NOT_SUBMITTED"
  }
}
```

### Deadlines

All deadline routes require bearer authentication and operate on the authenticated user's deadlines
and cases. Dates can be user-supplied or rule-derived; the legal rule registry is intentionally
empty, so statutory dates are not automatically calculated. Verification is user attestation, not
independent legal verification. Reminder records are local only and are not delivered.

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/deadlines` | Create deadline for own case |
| GET | `/api/deadlines?page=1&limit=20&status=OVERDUE&caseId=:caseId` | List/filter own deadlines |
| GET | `/api/deadlines/cases/:caseId` | List own case's deadlines |
| GET | `/api/deadlines/:id` | Get own deadline |
| PATCH | `/api/deadlines/:id` | Update deadline/provenance |
| PATCH | `/api/deadlines/:id/status` | Mark COMPLETED or CANCELLED |
| POST | `/api/deadlines/:id/verify` | Record explicit user attestation |
| POST | `/api/deadlines/:id/reminders` | Schedule local reminder |
| PATCH | `/api/deadlines/:id/reminders/:reminderId` | Cancel local reminder |
| GET | `/api/deadlines/:id/escalation-eligibility` | Get operational review indication |

Create example:

```json
{
  "caseId": "507f1f77bcf86cd799439012",
  "title": "User-entered response date",
  "dueAt": "2026-11-28",
  "kind": "CONFIGURED",
  "dateBasis": "USER_SUPPLIED",
  "sourceType": "USER_PROVIDED",
  "sourceDescription": "Date entered by the user"
}
```

Statuses are `UPCOMING`, `DUE`, `OVERDUE`, `COMPLETED`, `CANCELLED`. Changing date or provenance
resets verification. Verify body:

```json
{ "confirmation": "I reviewed the source and confirm this date manually." }
```

Reminder body: `{ "scheduledAt": "2026-11-27T09:00:00.000Z" }`. Cancellation body:
`{ "status": "CANCELLED" }`. Responses use `{ "success": true, "data": { ...deadline fields..., "daysRemaining": 3, "daysOverdue": 0, "legalDeadlineNotice": "..." } }`.
The monitor runs once at server startup and hourly. It records deduplicated local timeline reminders;
it never sends messages or files documents. Eligible procedural drafts are samples for user review,
not submissions.

Example deadline response:

```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439016",
    "title": "User-entered response date",
    "dueAt": "2026-11-28T00:00:00.000Z",
    "kind": "CONFIGURED",
    "dateBasis": "USER_SUPPLIED",
    "status": "UPCOMING",
    "sourceType": "USER_PROVIDED",
    "verificationStatus": "UNVERIFIED",
    "daysRemaining": 31,
    "daysOverdue": 0,
    "legalDeadlineNotice": "Unverified date only. No statutory deadline has been determined."
  }
}
```

## Feature status and integrations

| Feature | Current backend behavior |
|---|---|
| Health, authentication, cases | Express routes backed by MongoDB; registration/login use bcrypt and JWT |
| RTI | Configurable text template; no portal filing or legal-rule service |
| Rights Companion | Configurable procedural/letter templates; no external AI, legal database, or contacted legal-aid provider |
| Civic Fix | MongoDB records and local duplicate heuristic; no government submission, authority finder, file upload, or active image model |
| Documents | Editable text drafts and metadata in MongoDB; no PDF generation or external submission |
| Deadlines | Stored date tracking, local reminder scheduling, hourly monitor; no email/SMS delivery and no configured statutory rule engine |
| ML | `src/services/mlService.js` has validated client contracts for future FastAPI calls, but no API controller currently invokes it; predictions are not active |
| Notifications/admin | No backend notification-center or admin-analytics routes are currently mounted |

## Frontend integration findings

The frontend files were inspected read-only. Its current `src/services/mock-service.ts` uses shared
in-memory mock data and does not call the Node backend (`fetch`/Axios API calls were not found in
`src`). The frontend is therefore not yet integrated with this API.

Important shape differences to reconcile in a separate frontend integration:

- Frontend case types are lowercase (`rti`, `rights`, `civic_fix`) and statuses include
  `drafted`, `awaiting_review`, `submitted`, `responded`, `deadline_breached`, and escalation
  states. Backend case types are uppercase `RTI`, `RIGHTS`, `CIVIC`, and statuses are
  `DRAFT`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_RESPONSE`, `RESOLVED`, `CLOSED`. Backend does not
  currently implement frontend workflow states such as `SUBMITTED` or `ESCALATED`.
- Frontend models use `id`, `caseId`, `authorityId`, and client-shaped event/deadline fields;
  backend responses use Mongo `_id`, `case`, owner-scoped records, and backend-specific nested
  structures. A deliberate mapping layer will be needed.
- Frontend documents use lowercase kinds, `plainLanguageContent`, `formalContent`, citation and
  version-history arrays. Backend documents use uppercase types and a single editable `content`
  field with a numeric `version`; those additional frontend document shapes are not implemented.
- The frontend currently has mock notifications, escalation approval, cross-module simulation, and
  admin/dashboard analytics. Equivalent backend routes are not mounted.
- Auth pages are present in the frontend, but no API call is currently connected; backend
  registration/login return the `{ user, token }` response described above.

Do not swap out the mock service until the frontend and backend agree on status transitions, IDs,
response schemas, notification/admin scope, and draft/document behavior.

## Recommended integration order

1. `GET /api/health` and configure the local API base URL/CORS.
2. Registration, login, and JWT handling with `GET /api/auth/me`.
3. Cases: map types/statuses and implement list/create/detail/update.
4. RTI drafts and template response shapes.
5. Rights Companion cases, guidance, letters, checklist, saved drafts.
6. Civic Fix complaints, unverified authority information, and heuristic duplicate groups.
7. Documents: reconcile frontend document/version fields with backend text-document schema.
8. Deadlines: map verification, due states, and local-only reminders; then decide whether notifications
   and admin endpoints are needed.

## Quick local endpoint check

With MongoDB running and `.env` configured, start the backend using `npm run dev`, then in another
terminal:

```powershell
Invoke-RestMethod http://localhost:3000/api/health

$registration = Invoke-RestMethod -Method Post `
  -Uri http://localhost:3000/api/auth/register `
  -ContentType "application/json" `
  -Body (@{
    name = "Example User"
    email = "user@example.test"
    password = "a-long-password"
  } | ConvertTo-Json)
$token = $registration.token
```

Use the returned token for a protected endpoint (replace the placeholder with the local response):

```powershell
$headers = @{ Authorization = "Bearer $token" }
Invoke-RestMethod http://localhost:3000/api/cases -Headers $headers
```

For a complete isolated test run that does not require MongoDB:

```sh
npm test
```
