# QuickNotes API Design

This is the API the backend team should build for the real QuickNotes service. It follows REST, so resources are plural nouns (`/notes`, `/tags`), the HTTP method says what to do, and the path says which item. Everything is sent and received as JSON over HTTPS.

- **Base URL:** `https://api.quicknotes.com/v1`
- **Authentication:** every endpoint except login needs the header `Authorization: Bearer <token>`. The token comes from `POST /auth/login`.
- **Ownership:** a user can only see and change their own notes. The server works out who the user is from the token, so the client never sends a user id.

## Endpoints

| Method | Path | Description | Success status |
|--------|------|-------------|----------------|
| POST | `/auth/login` | Log in with an email and password and get a token | 200 OK |
| GET | `/notes` | List the logged-in user's notes. Optional filters: `?category=work&search=report&page=1&limit=20` | 200 OK |
| GET | `/notes/{id}` | Get one note | 200 OK |
| POST | `/notes` | Create a new note | 201 Created |
| PATCH | `/notes/{id}` | Change some fields of a note | 200 OK |
| DELETE | `/notes/{id}` | Delete a note | 204 No Content |
| GET | `/tags` | List all tags | 200 OK |
| POST | `/notes/{id}/tags` | Add a tag to a note | 201 Created |

## Example: log in

Request:

```http
POST /v1/auth/login
Content-Type: application/json
```

```json
{
  "email": "amina@example.com",
  "password": "my-secret-password"
}
```

Response (200 OK):

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 3600
}
```

## Example: create a note

Request:

```http
POST /v1/notes
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json
```

```json
{
  "title": "Revise HTTP methods",
  "body": "GET reads, POST creates, PATCH updates, DELETE removes.",
  "category": "study",
  "tags": ["exams", "urgent"]
}
```

Response (201 Created):

```json
{
  "id": 42,
  "title": "Revise HTTP methods",
  "body": "GET reads, POST creates, PATCH updates, DELETE removes.",
  "category": "study",
  "tags": ["exams", "urgent"],
  "createdAt": "2026-10-28T09:15:00Z",
  "updatedAt": "2026-10-28T09:15:00Z"
}
```

Rules checked by the server: the title is required and must be 100 characters or fewer, and the category must be `personal`, `work` or `study`.

## Example: list notes

Request:

```http
GET /v1/notes?category=study&page=1&limit=2
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

Response (200 OK):

```json
{
  "notes": [
    {
      "id": 42,
      "title": "Revise HTTP methods",
      "body": "GET reads, POST creates, PATCH updates, DELETE removes.",
      "category": "study",
      "tags": ["exams", "urgent"],
      "createdAt": "2026-10-28T09:15:00Z"
    },
    {
      "id": 40,
      "title": "Practise SQL joins",
      "body": "",
      "category": "study",
      "tags": [],
      "createdAt": "2026-10-27T18:02:00Z"
    }
  ],
  "page": 1,
  "limit": 2,
  "total": 7
}
```

## Error codes

| Status | Name | When it happens |
|--------|------|-----------------|
| 400 | Bad Request | The request is invalid. For example, `POST /notes` with an empty title or a title over 100 characters. |
| 401 | Unauthorized | The user is not logged in. For example, `GET /notes` with no token, an expired token, or a wrong password on login. |
| 403 | Forbidden | The user is logged in but not allowed to do this. For example, `DELETE /notes/42` when note 42 belongs to someone else. |
| 404 | Not Found | The note or the URL does not exist. For example, `GET /notes/9999`. |
| 500 | Internal Server Error | Something broke on the server. For example, the database is down or there is a bug in the code. |

Every error uses the same body shape, so the client can always read it the same way.

400 Bad Request:

```json
{
  "error": {
    "status": 400,
    "code": "VALIDATION_ERROR",
    "message": "The title is required and must be 100 characters or fewer."
  }
}
```

401 Unauthorized:

```json
{
  "error": {
    "status": 401,
    "code": "UNAUTHORIZED",
    "message": "Your login has expired. Please log in again."
  }
}
```

403 Forbidden:

```json
{
  "error": {
    "status": 403,
    "code": "FORBIDDEN",
    "message": "You are not allowed to delete this note."
  }
}
```

404 Not Found:

```json
{
  "error": {
    "status": 404,
    "code": "NOT_FOUND",
    "message": "No note exists with id 9999."
  }
}
```

500 Internal Server Error:

```json
{
  "error": {
    "status": 500,
    "code": "SERVER_ERROR",
    "message": "Something went wrong on our side. Please try again later."
  }
}
```