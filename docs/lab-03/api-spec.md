# Lab 3 API Specification

## 1. API Conventions

Lab 3 shall extend the existing TokTickIT REST API under the `/api/v1` namespace.

### General Conventions

- API base path: `/api/v1`
- Request and response bodies use JSON unless an existing attachment operation requires multipart data.
- JSON field names use camelCase.
- Timestamps use ISO 8601 UTC format.
- Protected endpoints determine the current user from authenticated server-side context.
- Client-supplied requester identity shall not be trusted as authentication.
- Validation and authorization shall be enforced by the backend.
- Responses shall not expose password hashes, credentials, stack traces, or unnecessary internal implementation details.

### Success Responses

Successful responses shall use appropriate HTTP status codes and return only the data required by the client.

### Error Responses

Errors shall use safe, consistent JSON responses. A typical error shape is:

```json
{
  "error": "Safe message"
}
```

Additional structured validation information may be returned where useful, provided it does not expose sensitive implementation details.

## 2. Authentication Model

Lab 3 replaces the temporary Development Requester selection with real authenticated user context.

The authenticated server context shall provide at least:

- User identifier
- User identity required by the application
- Role
- Active-account state where required for authorization
- Password-change requirement where required

Permitted roles are:

- `Requester`
- `IT Staff`
- `Administrator`

The exact secure session mechanism may be selected during implementation, but it shall satisfy the following contract:

- Authentication state is established only after valid credentials are verified.
- Passwords are stored only as secure hashes.
- Protected endpoints reject unauthenticated requests.
- Backend authorization uses authenticated identity and role.
- Logout invalidates the active authenticated access.
- A required initial/reset password change blocks normal protected application use until completed.
- Inactive users cannot establish normal authenticated access.

## 3. Common HTTP Responses

Unless a more specific endpoint contract states otherwise, Lab 3 APIs shall use appropriate responses from the following categories:

| Status | Meaning |
|---|---|
| `200 OK` | Successful retrieval or update |
| `201 Created` | Resource successfully created |
| `204 No Content` | Successful operation with no response body where appropriate |
| `400 Bad Request` | Invalid request or validation failure |
| `401 Unauthorized` | Authentication is missing or invalid |
| `403 Forbidden` | Authenticated user lacks permission |
| `404 Not Found` | Requested resource does not exist or cannot be exposed |
| `409 Conflict` | Request conflicts with current resource or business state |
| `500 Internal Server Error` | Unexpected failure returned with safe feedback |

Authorization-sensitive resources may use `404` instead of exposing the existence of a resource where that behavior better preserves the existing ownership-isolation contract.

### Validation

The API shall validate:

- Required fields
- Supported enum or role values
- Valid identifiers
- Email format where applicable
- Unique email rules
- Password input according to the finalized implementation rules
- Ticket workflow operations
- Assignment targets
- Authorization and ownership requirements

Validation failures shall not be represented as successful operations.

## 4. Authentication Endpoints

### POST `/api/v1/auth/login`

Authenticates an active TokTickIT user.

#### Request

```json
{
  "email": "requester@example.com",
  "password": "user-password"
}
```

#### Success — `200 OK`

The response shall provide the authenticated user information required by the client.

```json
{
  "user": {
    "id": "user-id",
    "name": "Example User",
    "email": "requester@example.com",
    "role": "Requester",
    "mustChangePassword": false
  }
}
```

The secure authentication/session mechanism itself shall not expose sensitive credentials in the response.

#### Failure

- `400 Bad Request` — required login input is invalid or missing
- `401 Unauthorized` — credentials are invalid
- `403 Forbidden` — account is inactive
- `500 Internal Server Error` — unexpected authentication failure with safe feedback

Invalid-login feedback shall not unnecessarily reveal whether a specific account exists.

### GET `/api/v1/auth/me`

Returns the current authenticated user.

#### Success — `200 OK`

```json
{
  "user": {
    "id": "user-id",
    "name": "Example User",
    "email": "requester@example.com",
    "role": "Requester",
    "mustChangePassword": false
  }
}
```

#### Failure

- `401 Unauthorized` — no valid authenticated session exists
- `500 Internal Server Error` — unexpected failure with safe feedback

The response shall not contain a password or password hash.

### POST `/api/v1/auth/change-password`

Changes the password for the current authenticated user when a password change is required.

#### Request

```json
{
  "newPassword": "new-user-password",
  "confirmPassword": "new-user-password"
}
```

#### Success — `200 OK`

```json
{
  "user": {
    "id": "user-id",
    "name": "Example User",
    "email": "requester@example.com",
    "role": "Requester",
    "mustChangePassword": false
  }
}
```

#### Rules

- The user must already have valid authenticated context.
- New-password input must satisfy the finalized password validation rules.
- Confirmation must match the new password.
- The new password shall be stored only as a secure hash.
- Successful completion clears the required password-change state.
- Normal protected application access may then proceed according to the user's role.

#### Failure

- `400 Bad Request` — password input is invalid or confirmation does not match
- `401 Unauthorized` — no valid authenticated context exists
- `500 Internal Server Error` — unexpected failure with safe feedback

### POST `/api/v1/auth/logout`

Terminates the current authenticated access.

#### Success

`204 No Content`

#### Rules

After successful logout:

- The previous authenticated context shall no longer authorize protected requests.
- A later protected request without new authentication shall be rejected.

### Password-Change Gate

When `mustChangePassword` is true, the backend shall restrict normal protected application operations until the required password change is completed.

Only operations required to maintain the authenticated password-change flow, such as current-user retrieval, password change, and logout, shall remain available as appropriate.

This restriction shall be enforced by the backend rather than relying only on client-side routing.

## 5. Authenticated Requester Endpoints

Lab 3 shall preserve the existing Lab 2 Requester ticket and attachment API behavior while replacing the temporary Development Requester identity mechanism with authenticated Requester context.

The server shall determine the Requester from authentication. A client-supplied requester identifier shall not override the authenticated identity.

### Requester Ticket Creation

The existing Create Ticket endpoint shall continue to support authenticated Requesters.

#### Rules

- The caller must be authenticated as a Requester.
- Ticket ownership shall be assigned from the authenticated Requester identity.
- The client shall not be allowed to create a ticket as another Requester by supplying another requester identifier.
- Existing category, priority, description, validation, ticket-number generation, and other Lab 2 creation behavior shall remain compatible unless Lab 3 explicitly changes it.
- Successful creation shall preserve the existing Ticket and TicketEvent behavior.

#### Success

The existing successful Lab 2 creation response shall remain compatible where practical.

#### Failure

- `400 Bad Request` — invalid ticket input
- `401 Unauthorized` — authentication is missing or invalid
- `403 Forbidden` — authenticated role is not permitted to use the Requester operation
- `500 Internal Server Error` — unexpected failure with safe feedback

### Requester My Tickets

The existing My Tickets endpoint shall use authenticated Requester ownership.

#### Rules

- The caller must be an authenticated Requester.
- Only tickets owned by the authenticated Requester shall be returned.
- Client input shall not be trusted to select another Requester's ticket list.
- Existing Lab 2 list behavior shall remain compatible where practical.

#### Failure

- `401 Unauthorized` — authentication is missing or invalid
- `403 Forbidden` — authenticated role is not permitted to use the Requester operation
- `500 Internal Server Error` — unexpected failure with safe feedback

### Requester Ticket Detail

The existing Requester Ticket Detail endpoint shall continue to enforce ownership isolation.

#### Rules

- The caller must be an authenticated Requester.
- The requested ticket must be accessible to that Requester under the existing ownership rules.
- Another Requester's ticket shall not be exposed merely because its identifier is known.
- Existing permitted ticket information shall remain available.

#### Failure

- `401 Unauthorized` — authentication is missing or invalid
- `403 Forbidden` or `404 Not Found` — ticket access is not permitted, according to the finalized ownership-isolation behavior
- `404 Not Found` — permitted resource does not exist
- `500 Internal Server Error` — unexpected failure with safe feedback

### Requester Attachments

Existing Lab 2 Attachment endpoints shall remain compatible while using authenticated authorization.

#### Rules

- Attachment authorization shall be derived from the authenticated user and associated ticket.
- Requesters may access or perform attachment operations only when permitted by ticket ownership and the existing Lab 2 attachment rules.
- Knowing an attachment identifier shall not grant access.
- Existing attachment metadata behavior shall be preserved.
- Existing binary storage behavior shall be preserved.
- Existing soft-removal behavior shall remain compatible where applicable.

#### Failure

- `400 Bad Request` — invalid attachment operation
- `401 Unauthorized` — authentication is missing or invalid
- `403 Forbidden` or `404 Not Found` — attachment access is not permitted
- `404 Not Found` — permitted attachment does not exist
- `500 Internal Server Error` — unexpected failure with safe feedback

### Requester Identity Security

Requester APIs shall not rely on:

- Development Requester selection
- Client-side requester context as authorization
- Requester IDs supplied only for impersonating another user
- Hidden UI controls as the security boundary

The authenticated server context is the source of truth for Requester identity and authorization.

### Lab 2 Compatibility

Implementation shall reuse the existing Lab 2 endpoint paths and DTO shapes where practical.

If an existing Lab 2 endpoint must change because authentication replaces Development Requester selection, the change shall:

1. Preserve the original business behavior.
2. Remove dependence on client-selected requester identity.
3. Preserve existing Requester ownership isolation.
4. Preserve existing Ticket and Attachment data.
5. Be reflected in automated regression tests.

## 6. IT Staff Ticket Queue Endpoint

### GET `/api/v1/staff/tickets`

Returns the ticket queue for an authenticated IT Staff user.

### Authorization

- The caller must be authenticated.
- The caller must have the `IT Staff` role.
- Unauthorized roles shall be rejected by the backend.

### Query Parameters

The endpoint shall support the following queue controls:

| Parameter | Purpose |
|---|---|
| `search` | Search supported ticket information |
| `status` | Filter by permitted ticket status |
| `priority` | Filter by IT Priority |
| `assignment` | Filter assigned or unassigned tickets |
| `sortBy` | Select a supported sort field |
| `sortOrder` | `asc` or `desc` |
| `page` | Requested page number |
| `pageSize` | Number of tickets per page |

Additional filters may be added only when they support the Lab 3 requirements without unnecessary scope expansion.

### Search

Search behavior shall be deterministic and shall support the ticket information finalized for the queue, such as ticket number or other appropriate searchable fields.

Empty or unsupported search input shall be handled safely.

### Filters

Supported filter values shall be validated.

Invalid status, IT Priority, assignment, or other filter values shall not silently produce misleading results.

### Sorting

Only supported sort fields shall be accepted.

A deterministic secondary ordering shall be used where necessary so pagination remains stable when multiple records have the same primary sort value.

### Pagination

`page` and `pageSize` shall use validated positive values.

The API shall provide enough metadata for the client to render pagination correctly.

### Success — `200 OK`

A successful response shall use a structure similar to:

```json
{
  "items": [
    {
      "id": "ticket-id",
      "ticketNumber": "TKT-2026-00001",
      "requester": {
        "id": "user-id",
        "name": "Example Requester"
      },
      "category": {
        "id": 1,
        "name": "Example Category"
      },
      "status": "New",
      "itPriority": "Medium",
      "assignee": null
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 1,
    "totalPages": 1
  }
}
```

An assigned ticket may return an assignee object instead of `null`.

The final DTO may include additional existing ticket fields required by the UI, but shall avoid exposing unnecessary internal data.

### Empty and No-Results Behavior

A valid request with no matching tickets shall return:

- `200 OK`
- An empty `items` array
- Valid pagination metadata

An empty result is not a server error.

### Failure

- `400 Bad Request` — invalid query, filter, sort, or pagination input
- `401 Unauthorized` — authentication is missing or invalid
- `403 Forbidden` — authenticated user is not permitted to access the IT Staff queue
- `500 Internal Server Error` — unexpected failure with safe feedback

### Queue Consistency

The queue API shall provide sufficient data for the client to show:

- Ticket number
- Requester
- Category
- Status
- IT Priority
- Assigned IT Staff or Unassigned state
- Open-detail action

Status, IT Priority, assignment, search, filtering, sorting, and pagination behavior shall remain consistent between API tests and the final UI.

## 7. IT Staff Ticket Detail and Operations Endpoints

All endpoints in this section require valid authentication and the `IT Staff` role unless a more specific rule is documented.

### GET `/api/v1/staff/tickets/:ticketId`

Returns the authorized IT Staff Ticket Detail.

#### Success — `200 OK`

The response shall provide the information required by the Ticket Detail UI, including:

```json
{
  "ticket": {
    "id": "ticket-id",
    "ticketNumber": "TKT-2026-00001",
    "requester": {
      "id": "user-id",
      "name": "Example Requester"
    },
    "category": {
      "id": 1,
      "name": "Example Category"
    },
    "description": "Example ticket description",
    "status": "New",
    "itPriority": "Medium",
    "assignee": null,
    "requesterResolution": null
  }
}
```

The final DTO may include additional existing ticket information required by the UI, including permitted Attachment information.

#### Failure

- `401 Unauthorized` — authentication is missing or invalid
- `403 Forbidden` — authenticated role is not permitted
- `404 Not Found` — ticket does not exist
- `500 Internal Server Error` — unexpected failure with safe feedback

### POST `/api/v1/staff/tickets/:ticketId/claim`

Claims an unassigned ticket for the authenticated IT Staff user.

#### Success — `200 OK`

The response shall return the updated assignment information or updated Ticket Detail required by the client.

#### Rules

- The ticket must exist.
- The ticket must be claimable.
- The authenticated IT Staff user becomes the assignee.
- A conflicting claim shall not silently overwrite an existing assignment.
- Successful material assignment changes shall create the required TicketEvent.

#### Failure

- `401 Unauthorized`
- `403 Forbidden`
- `404 Not Found`
- `409 Conflict` — ticket cannot be claimed in its current assignment state
- `500 Internal Server Error`

### PATCH `/api/v1/staff/tickets/:ticketId/assignment`

Performs a permitted ticket reassignment.

#### Request

```json
{
  "assigneeId": "staff-user-id"
}
```

The finalized contract may permit a documented unassigned value if Lab 3 assignment rules require it.

#### Rules

- The target assignee must be a valid permitted IT Staff user.
- Unauthorized or invalid assignment targets shall be rejected.
- Successful material assignment changes shall create the required TicketEvent.

#### Failure

- `400 Bad Request` — invalid assignment input
- `401 Unauthorized`
- `403 Forbidden`
- `404 Not Found`
- `409 Conflict` — assignment conflicts with the current ticket state where applicable
- `500 Internal Server Error`

### PATCH `/api/v1/staff/tickets/:ticketId/priority`

Updates IT Priority.

#### Request

```json
{
  "itPriority": "Medium"
}
```

#### Rules

- Only values permitted by the finalized Lab 3 IT Priority model shall be accepted.
- The persisted value shall be returned or otherwise available to refresh the client.
- Successful material priority changes shall create the required TicketEvent.

#### Failure

- `400 Bad Request` — unsupported IT Priority
- `401 Unauthorized`
- `403 Forbidden`
- `404 Not Found`
- `500 Internal Server Error`

### PATCH `/api/v1/staff/tickets/:ticketId/status`

Performs a permitted ticket status transition.

#### Request

```json
{
  "status": "In Progress"
}
```

#### Rules

- The requested status must be a supported Lab 3 status.
- The transition must be permitted from the ticket's current status.
- Invalid transitions shall be rejected rather than silently accepted.
- Successful material status changes shall create the required TicketEvent.

#### Failure

- `400 Bad Request` — invalid status value
- `401 Unauthorized`
- `403 Forbidden`
- `404 Not Found`
- `409 Conflict` — requested transition is not permitted from the current state
- `500 Internal Server Error`

### Requester Resolution Indication

The Ticket Detail response shall include the Requester resolution information required by Lab 3 in a form that allows the UI to display the indication clearly.

The API shall preserve the meaning of this value rather than requiring the client to infer resolution state from unrelated fields.

### Attachment Continuity

IT Staff Ticket Detail shall integrate with the existing Attachment APIs where permitted.

Lab 3 shall reuse the existing attachment storage and metadata design rather than introduce duplicate attachment storage endpoints without a requirement.

Attachment operations shall:

- Require authentication
- Enforce applicable role and ticket authorization
- Preserve existing metadata behavior
- Preserve existing binary-storage behavior
- Return safe failures

### Operation Consistency

After a successful Ticket Detail operation:

- The persisted server state is the source of truth.
- The client shall be able to display the updated value.
- Required TicketEvent history shall be appended.
- Existing historical events shall not be rewritten.
- A failed operation shall not be represented by the UI as successfully persisted.

## 8. Public Comments and Internal Notes Endpoints

Public Comments and Internal Notes shall remain separate communication types with different visibility rules. The backend shall enforce this distinction.

### GET `/api/v1/staff/tickets/:ticketId/comments`

Returns Public Comments for an authorized IT Staff user.

#### Success — `200 OK`

```json
{
  "comments": [
    {
      "id": "comment-id",
      "body": "Example public comment",
      "author": {
        "id": "user-id",
        "name": "Example User",
        "role": "IT Staff"
      },
      "createdAt": "2026-09-18T09:00:00.000Z"
    }
  ]
}
```

#### Rules

- The ticket must exist and be accessible to the authenticated user.
- Only Public Comments shall be returned by this endpoint.
- Internal Notes shall never be included in the Public Comment response.

### POST `/api/v1/staff/tickets/:ticketId/comments`

Adds a Public Comment to a ticket.

#### Request

```json
{
  "body": "Example public comment"
}
```

#### Success — `201 Created`

The response shall return the created Public Comment.

#### Rules

- The caller must be authorized to add a Public Comment.
- Comment body is required and shall be validated.
- The author shall be determined from authenticated identity rather than trusted client-supplied author information.
- The created comment shall be associated with the correct ticket.
- Required event history shall be recorded where applicable.

#### Failure

- `400 Bad Request` — invalid comment input
- `401 Unauthorized` — authentication is missing or invalid
- `403 Forbidden` — user is not permitted to perform the operation
- `404 Not Found` — ticket does not exist or cannot be exposed
- `500 Internal Server Error` — unexpected failure with safe feedback

### Requester Public Comment Access

Requester access to Public Comments shall use authenticated Requester identity and ticket ownership.

Where the existing Requester Ticket Detail API includes Public Comments, only Public Comments for an authorized owned ticket shall be exposed.

A Requester shall never receive Internal Notes through a Requester Ticket Detail, comment, or related response.

### GET `/api/v1/staff/tickets/:ticketId/notes`

Returns Internal Notes for an authorized IT Staff user.

#### Success — `200 OK`

```json
{
  "notes": [
    {
      "id": "note-id",
      "body": "Example internal note",
      "author": {
        "id": "staff-user-id",
        "name": "Example IT Staff"
      },
      "createdAt": "2026-09-18T09:00:00.000Z"
    }
  ]
}
```

### POST `/api/v1/staff/tickets/:ticketId/notes`

Adds an Internal Note.

#### Request

```json
{
  "body": "Example internal note"
}
```

#### Success — `201 Created`

The response shall return the created Internal Note.

#### Rules

- Only an authorized IT Staff user may access or add Internal Notes.
- Note body is required and shall be validated.
- The author shall be determined from authenticated identity.
- The note shall be associated with the correct ticket.
- Required event history shall be recorded where applicable.

#### Failure

- `400 Bad Request` — invalid note input
- `401 Unauthorized` — authentication is missing or invalid
- `403 Forbidden` — authenticated user is not permitted to access Internal Notes
- `404 Not Found` — ticket does not exist
- `500 Internal Server Error` — unexpected failure with safe feedback

### Internal Note Isolation

Internal Notes are staff-only data.

The API shall ensure that Internal Notes are not exposed through:

- Requester Ticket Detail responses
- Requester Public Comment responses
- Requester Attachment responses
- Other Requester-facing DTOs
- Unauthorized direct API requests

Client-side hiding alone is not sufficient.

### Communication Data

Public Comments and Internal Notes may use separate database models or a safely discriminated shared model. The implementation choice must preserve their authorization and visibility differences.

Regardless of the persistence design:

- Public and internal communication types shall remain distinguishable.
- Author identity shall be preserved.
- Creation timestamp shall be preserved.
- Ticket association shall be preserved.
- Internal Notes shall remain inaccessible to Requesters.

## 9. Administrator User Management Endpoints

All endpoints in this section require valid authentication and the `Administrator` role.

### GET `/api/v1/admin/users`

Returns the user list for Administrator User Management.

#### Query Parameters

| Parameter | Purpose |
|---|---|
| `search` | Search users by name or email |
| `role` | Optional filter by permitted role |

#### Success — `200 OK`

```json
{
  "users": [
    {
      "id": "user-id",
      "name": "Example User",
      "email": "user@example.com",
      "role": "Requester",
      "isActive": true,
      "mustChangePassword": false
    }
  ]
}
```

Password values and password hashes shall never be returned.

#### Failure

- `400 Bad Request` — invalid search or role-filter input
- `401 Unauthorized` — authentication is missing or invalid
- `403 Forbidden` — authenticated user is not an Administrator
- `500 Internal Server Error` — unexpected failure with safe feedback

### POST `/api/v1/admin/users`

Creates a new TokTickIT user.

#### Request

```json
{
  "name": "Example User",
  "email": "user@example.com",
  "role": "Requester",
  "initialPassword": "initial-password",
  "isActive": true
}
```

#### Success — `201 Created`

The response shall return the created user without password information.

```json
{
  "user": {
    "id": "user-id",
    "name": "Example User",
    "email": "user@example.com",
    "role": "Requester",
    "isActive": true,
    "mustChangePassword": true
  }
}
```

#### Rules

- Name and email shall satisfy required validation.
- Email shall be unique.
- Exactly one permitted role shall be assigned.
- Permitted roles are `Requester`, `IT Staff`, and `Administrator`.
- Initial password shall satisfy the finalized password rules.
- The initial password shall be stored only as a secure hash.
- A newly created user shall have `mustChangePassword` or equivalent set to require a password change at first login.

#### Failure

- `400 Bad Request` — invalid user input
- `401 Unauthorized`
- `403 Forbidden`
- `409 Conflict` — email already exists
- `500 Internal Server Error`

### PATCH `/api/v1/admin/users/:userId`

Updates permitted account information.

#### Request

The request may contain permitted editable fields such as:

```json
{
  "name": "Updated User",
  "email": "updated@example.com",
  "role": "IT Staff",
  "isActive": true
}
```

Only documented editable fields shall be accepted.

#### Rules

- Email shall remain unique.
- Role shall be one of the three permitted roles.
- An Administrator shall not deactivate their own account.
- A role or activation change shall not leave TokTickIT without an active Administrator.
- Unsupported or protected account fields shall not be silently accepted.

#### Success — `200 OK`

The response shall return the updated user without password information.

#### Failure

- `400 Bad Request` — invalid update input
- `401 Unauthorized`
- `403 Forbidden` — operation is not permitted
- `404 Not Found` — user does not exist
- `409 Conflict` — duplicate email or prohibited account-state conflict
- `500 Internal Server Error`

### POST `/api/v1/admin/users/:userId/reset-password`

Sets a new initial password for an existing user.

#### Request

```json
{
  "initialPassword": "new-initial-password"
}
```

#### Success — `204 No Content`

#### Rules

- The target user must exist.
- The new initial password shall satisfy the finalized password rules.
- The password shall be stored only as a secure hash.
- The user's password-change requirement shall be set.
- The user shall be required to change the new initial password at the next login.
- The API shall not return the stored password or password hash.

#### Failure

- `400 Bad Request` — invalid password input
- `401 Unauthorized`
- `403 Forbidden`
- `404 Not Found` — target user does not exist
- `500 Internal Server Error`

### Administrator Safety Rules

The backend shall enforce the following rules regardless of client behavior:

1. An Administrator cannot deactivate their own account.
2. The system shall reject an operation that would leave TokTickIT without an active Administrator.
3. Non-Administrators cannot access Administrator User Management endpoints.
4. User deletion is not part of Lab 3.
5. Each user has exactly one permitted role.

### Direct API Authorization

Requester and IT Staff users shall receive a forbidden response when directly calling Administrator endpoints, even if they manually construct the HTTP request.

The User Management UI is not the security boundary.

## 10. Migration, Security, and Contract Decisions

### Lab 2 to Lab 3 Migration

Lab 3 shall migrate the existing application without destroying the working Lab 2 data.

The migration shall:

1. Introduce the authenticated User model required by Lab 3.
2. Migrate existing Development Requesters to Users with the Requester role.
3. Preserve existing Requester-to-Ticket ownership relationships.
4. Preserve existing Ticket records.
5. Preserve existing Attachment records and metadata.
6. Preserve existing Category records and integer identifiers.
7. Preserve existing TicketEvent history.
8. Add only the schema changes required for Lab 3.
9. Avoid destructive database reset as the normal migration strategy.

### Authentication Security

- Passwords shall never be stored in plain text.
- Passwords shall be stored using secure password hashing.
- Authentication responses shall never expose password hashes.
- Protected endpoints shall require valid authenticated context.
- Inactive accounts shall not receive normal authenticated access.
- Required password change shall be enforced by the backend.
- Logout shall invalidate authenticated access according to the selected session mechanism.

### Authorization Security

Authorization shall be enforced on the server.

The API shall not trust:

- Hidden or disabled client controls
- Client-side route guards alone
- Client-supplied role values
- Client-selected Requester identity
- Knowledge of a Ticket, Attachment, User, Comment, or Note identifier

Every protected operation shall authorize the authenticated user against the requested resource and operation.

### Internal Note Security

Internal Notes are staff-only information.

Requester-facing DTOs and endpoints shall be designed so Internal Notes are not accidentally serialized or returned to Requesters.

Automated direct API authorization tests shall verify this boundary.

### User Administration Security

Administrator APIs shall:

- Require the Administrator role
- Reject duplicate email addresses
- Enforce exactly one permitted role
- Prevent self-deactivation
- Prevent an operation that would leave no active Administrator
- Never return stored password hashes
- Require password change after an Administrator sets an initial password

### Existing API Compatibility

Existing Lab 2 Requester and Attachment endpoints shall be reused where practical.

Lab 3 shall modify authentication and authorization behavior where required without creating duplicate versions of already-working APIs merely to support the new User model.

Any necessary compatibility change shall be covered by regression tests.

### API and Database Transaction Consistency

Operations that update related application state shall use appropriate transactional behavior where needed to prevent partial updates.

For example, when a material ticket operation requires both a ticket-state change and a TicketEvent record, the implementation shall avoid leaving the system in an inconsistent partially updated state.

### Safe Failure Behavior

Unexpected API failures shall:

- Return safe feedback
- Avoid exposing stack traces or sensitive implementation details
- Avoid leaking authentication or authorization information
- Avoid representing failed writes as successful
- Preserve existing persisted data where the operation did not complete successfully

### Implementation Inspection

Before changing existing Lab 2 APIs or database relationships, the implementation agent shall inspect the current code and Prisma schema.

Existing working endpoint paths, DTOs, relationships, and attachment behavior shall be reused where they satisfy this contract.

If the current implementation requires a contract adjustment, the relevant Lab 3 contract document shall be updated deliberately before or together with the implementation change, including the reason for the decision.

### Contract Completion

This API specification, together with:

- `docs/lab-03/specification.md`
- `docs/lab-03/tests.md`
- `docs/lab-03/ui-spec.md`

forms the pre-implementation Lab 3 engineering contract.

Implementation shall remain traceable to these documents, and material deviations shall be documented rather than introduced silently.