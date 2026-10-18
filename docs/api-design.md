# QuickNotes REST API design

This document describes the production QuickNotes API. It is separate from the browser exercise, which uses JSONPlaceholder as a practice service. All production endpoints use HTTPS, JSON request/response bodies, and `/v1` versioning. Authenticated requests send `Authorization: Bearer <access-token>`.

## Endpoints

| Method | Path | Description | Success status |
| --- | --- | --- | --- |
| `GET` | `/v1/notes` | List the authenticated user's notes, newest updated first; supports `limit` and `cursor` pagination. | `200 OK` |
| `GET` | `/v1/notes/{noteId}` | Read one note owned by the authenticated user. | `200 OK` |
| `POST` | `/v1/notes` | Create a note for the authenticated user. | `201 Created` |
| `PATCH` | `/v1/notes/{noteId}` | Update a note's title or body. | `200 OK` |
| `DELETE` | `/v1/notes/{noteId}` | Permanently delete a note owned by the authenticated user. | `204 No Content` |
| `GET` | `/v1/tags` | List the authenticated user's tags. | `200 OK` |
| `PUT` | `/v1/notes/{noteId}/tags/{tagId}` | Attach an existing tag to a note; repeated requests are idempotent. | `204 No Content` |
| `DELETE` | `/v1/notes/{noteId}/tags/{tagId}` | Remove a tag association from a note. | `204 No Content` |

`limit` defaults to 20 and is capped at 100. A response includes `nextCursor`, which is `null` when there are no more results. Note and tag IDs are opaque strings. The API derives `userId` from the token, so clients cannot create or edit another user's notes by supplying an owner ID.

## Create a note

Request:

```http
POST /v1/notes HTTP/1.1
Authorization: Bearer <access-token>
Content-Type: application/json
```

```json
{
  "title": "Ideas for Saturday",
  "body": "Visit the farmers market and pick up coffee."
}
```

`title` is required, trimmed, and limited to 100 characters. `body` is optional and limited to 20,000 characters.

Response (`201 Created`):

```json
{
  "data": {
    "id": "note_8f31a2",
    "title": "Ideas for Saturday",
    "body": "Visit the farmers market and pick up coffee.",
    "createdAt": "2026-10-18T09:15:00Z",
    "updatedAt": "2026-10-18T09:15:00Z",
    "tags": []
  }
}
```

## List notes

Request:

```http
GET /v1/notes?limit=2 HTTP/1.1
Authorization: Bearer <access-token>
```

Response (`200 OK`):

```json
{
  "data": [
    {
      "id": "note_8f31a2",
      "title": "Ideas for Saturday",
      "body": "Visit the farmers market and pick up coffee.",
      "createdAt": "2026-10-18T09:15:00Z",
      "updatedAt": "2026-10-18T09:15:00Z",
      "tags": []
    },
    {
      "id": "note_70bca4",
      "title": "Reading list",
      "body": "The left hand of darkness",
      "createdAt": "2026-10-17T16:22:00Z",
      "updatedAt": "2026-10-17T16:22:00Z",
      "tags": [{ "id": "tag_books", "name": "books" }]
    }
  ],
  "nextCursor": "eyJ1cGRhdGVkQXQiOiIyMDI2LTEwLTE3VDE2OjIyOjAwWiJ9"
}
```

## Errors

The API returns an appropriate HTTP status and a stable JSON error shape. `requestId` helps support staff trace a failure; clients should display the message without exposing server internals.

| Status | Meaning |
| --- | --- |
| `400 Bad Request` | Invalid JSON, invalid field, or malformed identifier. |
| `401 Unauthorized` | Missing, invalid, or expired access token. |
| `403 Forbidden` | Authenticated user lacks permission for the requested action. |
| `404 Not Found` | Note or tag does not exist or is not visible to this user. |
| `409 Conflict` | Request conflicts with current state, such as a duplicate tag name. |
| `422 Unprocessable Content` | Valid JSON that fails business validation. |
| `429 Too Many Requests` | Rate limit exceeded; response may include `Retry-After`. |
| `500 Internal Server Error` | Unexpected server failure. |

Example (`400 Bad Request`):

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Title is required and must be 100 characters or fewer.",
    "details": [{ "field": "title", "issue": "required" }],
    "requestId": "req_01J8KQ2W"
  }
}
```

## Behavior and security

- List and detail operations only return resources owned by the authenticated user; inaccessible resources return `404` to avoid revealing whether another user's ID exists.
- `PATCH` changes only supplied fields and validates the resulting note. `DELETE` is idempotent from the client's perspective; after successful deletion, the API returns `204` with no body.
- Use cursor pagination so inserts near the front of a long note list do not shift later pages as they would with offsets.
- Apply per-user and per-IP rate limits, validate request sizes, and use TLS for all traffic.
