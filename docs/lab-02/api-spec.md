# Lab 2 API Specification

## 1. Purpose and Conventions

This document defines the REST API contract for the Lab 2 TokTickIT Requester Ticketing MVP. It supports Development Requester selection, reference data, Ticket creation, My Tickets, Ticket Detail, and Attachment management.

### Base Path

All new Lab 2 endpoints use:

`/api/v1`

Existing Lab 1 endpoints such as `/api/health` and `/api/categories` remain available and shall not be broken by Lab 2 implementation.

### General Conventions

- JSON request and response fields use camelCase.
- Timestamps are returned as ISO 8601 UTC strings.
- API responses use explicit DTOs and do not expose Prisma models directly.
- The backend is authoritative for validation, ownership, and system-generated values.
- Client-facing errors shall be safe and shall not expose stack traces, database details, storage paths, or other internal implementation details.
- File uploads use `multipart/form-data`.
- File downloads return binary content with an appropriate content type and download filename.

## 2. Development Requester Context

Lab 2 does not implement real authentication. Requester-specific API operations shall use a temporary Development Requester context for testing ownership behavior.

### Requester Context Header

Requester-specific requests shall include:

`X-Dev-Requester-Id: <development-requester-uuid>`

The header value must reference an active Development Requester.

This header is a Lab 2 testing mechanism only and must not be treated as authentication or authorization credentials. The backend shall still validate the Development Requester and enforce Ticket and Attachment ownership for every requester-specific operation.

If the header is missing, malformed, unknown, or references an inactive Development Requester, the API shall reject the requester-specific request with a safe client-facing error.

Changing the Development Requester in the UI shall cause subsequent requester-specific API requests to send the newly selected Requester identifier.

## 3. Reference Data Endpoints

### 3.1 List Development Requesters

`GET /api/v1/development-requesters`

Returns active Development Requesters available in the Lab 2 selector.

Requester context header: **Not required**

#### Success — `200 OK`

```json
{
  "items": [
    {
      "id": "uuid",
      "displayName": "Example Requester",
      "email": "requester@example.com"
    }
  ]
}
```

Inactive Development Requesters shall not be returned.

---

### 3.2 List Categories

`GET /api/v1/categories`

Returns the persisted Ticket Categories.

Requester context header: **Not required**

#### Success — `200 OK`

```json
{
  "items": [
    {
      "id": 1,
      "name": "Account and Access"
    }
  ]
}
```

---

### 3.3 List Related Systems

`GET /api/v1/related-systems`

Returns active Related Systems available for new Ticket creation.

Requester context header: **Not required**

#### Success — `200 OK`

```json
{
  "items": [
    {
      "id": "uuid",
      "name": "Example System"
    }
  ]
}
```

Inactive Related Systems shall not be returned.

## 4. Create Ticket

### 4.1 Create a Ticket

`POST /api/v1/tickets`

Creates a Ticket owned by the Development Requester identified by `X-Dev-Requester-Id`.

Requester context header: **Required**

#### Request Body

```json
{
  "categoryId": 1,
  "relatedSystemId": "uuid",
  "summary": "Unable to access student portal",
  "requestedPriority": "Medium",
  "description": "The portal rejects my login even after resetting my password."
}
```

The client shall not supply the Ticket Number, Requester ID in the body, Current Status, or creation timestamp.

#### Validation

- `categoryId` must reference an existing Category.
- `relatedSystemId` must reference an active Related System.
- `summary` is required and must contain 5–120 characters after trimming.
- `requestedPriority` must be `Low`, `Medium`, `High`, or `Urgent`.
- `description` is required and must contain 10–5000 characters after trimming.
- Unknown request fields shall not override backend-controlled Ticket values.

#### Success — `201 Created`

```json
{
  "id": "uuid",
  "ticketNumber": "TKT-2026-00001",
  "requester": {
    "id": "uuid",
    "displayName": "Example Requester"
  },
  "category": {
    "id": 1,
    "name": "Account and Access"
  },
  "relatedSystem": {
    "id": "uuid",
    "name": "Example System"
  },
  "summary": "Unable to access student portal",
  "requestedPriority": "Medium",
  "description": "The portal rejects my login even after resetting my password.",
  "currentStatus": "New",
  "createdAt": "2026-09-04T07:00:00.000Z",
  "updatedAt": "2026-09-04T07:00:00.000Z"
}
```

#### Creation Behavior

- The backend generates the unique Ticket Number using the `TKT-YYYY-NNNNN` format.
- Ticket Number generation shall remain safe under concurrent requests.
- The selected Development Requester from the request header becomes the Ticket owner.
- Current Status is always created as `New`.
- A Ticket-created Ticket Event is persisted in the same database transaction as the Ticket.
- Attachment upload is a separate operation and does not form part of this request.

## 5. My Tickets

### 5.1 List My Tickets

`GET /api/v1/tickets`

Returns only Tickets owned by the Development Requester identified by `X-Dev-Requester-Id`.

Requester context header: **Required**

### Query Parameters

- `search` — optional text search across Ticket Number, Summary, and Description.
- `status` — optional exact filter by Current Status. For Lab 2, the supported value is `New`.
- `categoryId` — optional Category filter using an integer Category ID.
- `relatedSystemId` — optional Related System UUID filter.
- `requestedPriority` — optional filter using `Low`, `Medium`, `High`, or `Urgent`.
- `sortBy` — optional; supported values are `createdAt`, `ticketNumber`, and `requestedPriority`.
- `sortOrder` — optional; supported values are `asc` and `desc`.
- `page` — optional positive integer; default `1`.
- `pageSize` — optional positive integer; default `10`, maximum `50`.

Search is case-insensitive. Search and filters may be combined.

When sorting by `requestedPriority`, the business order is `Low < Medium < High < Urgent`; descending order reverses this sequence.

Invalid query parameter values shall return `400 Bad Request` rather than being silently accepted.

#### Example

`GET /api/v1/tickets?search=portal&requestedPriority=High&sortBy=createdAt&sortOrder=desc&page=1&pageSize=10`

#### Success — `200 OK`

```json
{
  "items": [
    {
      "id": "uuid",
      "ticketNumber": "TKT-2026-00001",
      "summary": "Unable to access student portal",
      "category": {
        "id": 1,
        "name": "Account and Access"
      },
      "relatedSystem": {
        "id": "uuid",
        "name": "Example System"
      },
      "requestedPriority": "High",
      "currentStatus": "New",
      "createdAt": "2026-09-04T07:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "totalItems": 1,
    "totalPages": 1
  }
}
```

### Ownership Behavior

The requester identifier is taken only from `X-Dev-Requester-Id`. A client cannot request another Requester's Tickets through a query parameter.

An empty result is returned as `200 OK` with an empty `items` array and valid pagination metadata. The UI determines whether this represents the Requester's general empty state or a no-results state based on whether search or filters are currently applied.

## 6. Ticket Detail

### 6.1 Get Ticket Detail

`GET /api/v1/tickets/:ticketId`

Returns one Ticket owned by the Development Requester identified by `X-Dev-Requester-Id`.

Requester context header: **Required**

#### Success — `200 OK`

```json
{
  "id": "uuid",
  "ticketNumber": "TKT-2026-00001",
  "requester": {
    "id": "uuid",
    "displayName": "Example Requester"
  },
  "category": {
    "id": 1,
    "name": "Account and Access"
  },
  "relatedSystem": {
    "id": "uuid",
    "name": "Example System"
  },
  "summary": "Unable to access student portal",
  "requestedPriority": "Medium",
  "description": "The portal rejects my login even after resetting my password.",
  "currentStatus": "New",
  "createdAt": "2026-09-04T07:00:00.000Z",
  "updatedAt": "2026-09-04T07:00:00.000Z",
  "attachments": [
    {
      "id": "uuid",
      "originalFilename": "error-screen.png",
      "mimeType": "image/png",
      "sizeBytes": 245000,
      "uploadedAt": "2026-09-04T07:05:00.000Z"
    }
  ]
}
```

Only active Attachment metadata is returned in the Requester-facing Ticket Detail response.

### Ownership and Not-Found Behavior

The backend shall verify that the requested Ticket belongs to the current Development Requester.

If the Ticket does not exist or belongs to another Development Requester, the API shall return the same safe `404 Not Found` response. This prevents the API from revealing whether another Requester's Ticket exists.

Ticket fields are read-only in Lab 2. No Ticket update or status-change endpoint is provided.

## 7. Attachments

### 7.1 Upload Attachment

`POST /api/v1/tickets/:ticketId/attachments`

Uploads one Attachment to a Ticket owned by the Development Requester identified by `X-Dev-Requester-Id`.

Requester context header: **Required**

Content type: `multipart/form-data`

Form field:

- `file` — required file upload.

#### Validation

- Allowed types: JPG/JPEG, PNG, WEBP, and PDF.
- Maximum size: 5 MB per file.
- The Ticket may have no more than five active Attachments.
- The backend validates both the declared file type and permitted upload rules.
- The original filename is stored only as metadata and is not used directly as the storage object key.
- The binary object is stored in SeaweedFS; PostgreSQL stores Attachment metadata only.

#### Success — `201 Created`

```json
{
  "id": "uuid",
  "originalFilename": "error-screen.png",
  "mimeType": "image/png",
  "sizeBytes": 245000,
  "uploadedAt": "2026-09-04T07:05:00.000Z"
}
```

Successful upload persists an Attachment-added Ticket Event associated with the current Development Requester.

If the Ticket does not exist or belongs to another Requester, the API returns the same safe `404 Not Found` response.

---

### 7.2 Get Attachment Metadata

`GET /api/v1/tickets/:ticketId/attachments/:attachmentId`

Returns metadata for an active Attachment belonging to an owned Ticket.

Requester context header: **Required**

#### Success — `200 OK`

```json
{
  "id": "uuid",
  "originalFilename": "error-screen.png",
  "mimeType": "image/png",
  "sizeBytes": 245000,
  "uploadedAt": "2026-09-04T07:05:00.000Z"
}
```

A missing, removed, mismatched, or unauthorized Attachment returns the same safe `404 Not Found` response.

---

### 7.3 Download Attachment

`GET /api/v1/tickets/:ticketId/attachments/:attachmentId/download`

Downloads the active binary object for an Attachment belonging to an owned Ticket.

Requester context header: **Required**

#### Success — `200 OK`

The response contains the binary file with an appropriate `Content-Type` and safe `Content-Disposition` filename.

Missing, removed, mismatched, or unauthorized Attachments return the same safe `404 Not Found` response.

---

### 7.4 Soft-Remove Attachment

`DELETE /api/v1/tickets/:ticketId/attachments/:attachmentId`

Soft-removes an active Attachment belonging to an owned Ticket.

Requester context header: **Required**

#### Request Body

```json
{
  "reason": "Uploaded the wrong screenshot"
}
```

`reason` is required and must contain non-whitespace text after trimming.

#### Success — `200 OK`

```json
{
  "id": "uuid",
  "removedAt": "2026-09-04T07:10:00.000Z",
  "removalReason": "Uploaded the wrong screenshot",
  "removedByRequesterId": "uuid"
}
```

On successful removal:

- the Attachment metadata remains in PostgreSQL;
- `removedAt`, `removalReason`, and the removing Development Requester are recorded;
- the binary object is deleted from SeaweedFS;
- an Attachment-removed Ticket Event is persisted;
- the Attachment can no longer be retrieved or downloaded through Requester-facing Attachment endpoints.

The Attachment soft-removal metadata and corresponding Ticket Event shall be persisted in the same PostgreSQL transaction. The binary shall be deleted from SeaweedFS as part of the removal workflow. Storage and database failures shall be handled explicitly so the API does not report successful removal while the Attachment remains accessible, and partial failures shall return a safe error rather than a false success response.

## 8. Standard Errors and Status Codes

All API errors shall use a consistent, safe JSON structure.

### Error Response

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Some submitted values are invalid.",
    "fields": {
      "summary": "Summary must contain 5 to 120 characters."
    }
  }
}
```

The `fields` object is optional and is included when field-specific validation information is useful.

### Status Codes

- `400 Bad Request` — malformed input, invalid query parameters, invalid requester context, or validation failure.
- `404 Not Found` — requested Ticket or Attachment does not exist, is unavailable, or is not accessible by the current Development Requester.
- `409 Conflict` — the request conflicts with the current resource state, such as exceeding the maximum of five active Attachments.
- `413 Payload Too Large` — an uploaded file exceeds the 5 MB limit.
- `415 Unsupported Media Type` — the uploaded file type is not permitted.
- `500 Internal Server Error` — an unexpected server or storage failure occurred.

### Safe Error Rules

- Errors shall not expose stack traces, SQL/Prisma errors, storage paths, SeaweedFS internals, or other implementation details.
- Ownership failures shall not reveal whether another Requester's Ticket or Attachment exists.
- Validation errors should identify correctable fields where appropriate.
- Unexpected failures shall use a generic client-facing message while detailed diagnostics remain server-side.

## 9. Audit and Transaction Behavior

Ticket Events are internal append-only audit records. Lab 2 does not expose a Requester-facing API for creating, updating, or deleting Ticket Events directly.

The following actions shall create Ticket Events:

- successful Ticket creation;
- successful Attachment addition;
- successful Attachment soft removal.

Each Ticket Event records the parent Ticket, event type, acting Development Requester when applicable, timestamp, and event metadata required to describe the action.

### Transaction Rules

- Ticket creation and its Ticket-created event shall be persisted in the same PostgreSQL transaction.
- Attachment metadata creation and its Attachment-added event shall be persisted in the same PostgreSQL transaction after the binary has been stored successfully in SeaweedFS. If the database transaction fails, the uploaded binary shall be cleaned up so the operation does not leave an orphaned storage object.
- Attachment soft-removal metadata and its Attachment-removed event shall be persisted in the same PostgreSQL transaction.
- Ticket Events are append-only and are not modified or deleted through normal Lab 2 workflows.
- A failed operation shall not create a successful material-action Ticket Event.
- Storage and database failures shall return safe errors and shall not knowingly leave an Attachment available when the API reports that it was successfully removed.

Ticket Events are internal implementation/audit data and are not included in normal Requester-facing Ticket DTOs unless a later specification explicitly requires them.

## 10. Endpoint Summary

| Method | Endpoint | Requester Header | Purpose |
|---|---|---|---|
| GET | `/api/v1/development-requesters` | No | List active Development Requesters |
| GET | `/api/v1/categories` | No | List Ticket Categories |
| GET | `/api/v1/related-systems` | No | List active Related Systems |
| POST | `/api/v1/tickets` | Yes | Create a Ticket |
| GET | `/api/v1/tickets` | Yes | List/search/filter/sort/paginate My Tickets |
| GET | `/api/v1/tickets/:ticketId` | Yes | Get owned Ticket Detail |
| POST | `/api/v1/tickets/:ticketId/attachments` | Yes | Upload an Attachment |
| GET | `/api/v1/tickets/:ticketId/attachments/:attachmentId` | Yes | Get active Attachment metadata |
| GET | `/api/v1/tickets/:ticketId/attachments/:attachmentId/download` | Yes | Download an active Attachment |
| DELETE | `/api/v1/tickets/:ticketId/attachments/:attachmentId` | Yes | Soft-remove an Attachment |