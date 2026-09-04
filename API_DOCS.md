# API Documentation for Frontend Integration

**Base URL:** `http://localhost:3000/api/v1`  
**Auth:** JWT Bearer token in `Authorization: Bearer <token>` header (except public routes)

---

## Authentication Routes (`/auth`)

### 1. POST `/auth/magic-link`
**Public** | Send magic link email for passwordless auth

**Rate Limit:** 3 requests per 60 seconds

**Request Body:**
```json
{ "email": "user@example.com" }
```

**Success (200):**
```json
{ "message": "Magic link sent! Please check your email" }
```

**Error Responses:**
- **400 Bad Request:** `{ "statusCode": 400, "message": "Validation failed", "error": "Bad Request" }`
- **429 Too Many Requests:** `{ "statusCode": 429, "message": "ThrottlerException: Too Many Requests", "error": "Too Many Requests" }` (if rate limit exceeded, retry after 60 seconds)
- **500 Internal Server Error:** `{ "statusCode": 500, "message": "Unexpected server error", "error": "Internal Server Error" }`

---

### 2. POST `/auth/verify-token`
**Public** | Verify magic link or Google pre-signin token

**Rate Limit:** 5 requests per 60 seconds

**Request Body:
```json
{ "token": "token-from-email-or-google" }
```

**Success (200) - User Onboarded:**
```json
{
  "message": "Sign in successful",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Success (200) - User Not Onboarded:**
```json
{
  "message": "User not onboarded",
  "data": {
    "onboarded": false,
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "provider": "email",
    "names": { "firstName": "John", "lastName": "Doe" }
  }
}
```

**Error Responses:**
- **400 Bad Request (Invalid):** `{ "statusCode": 400, "message": "Invalid token", "error": "Bad Request" }`
- **400 Bad Request (Expired):** `{ "statusCode": 400, "message": "Token has expired", "error": "Bad Request" }`
- **400 Bad Request (Consumed):** `{ "statusCode": 400, "message": "Token already used", "error": "Bad Request" }`
- **429 Too Many Requests:** `{ "statusCode": 429, "message": "ThrottlerException: Too Many Requests", "error": "Too Many Requests" }` (retry after 60 seconds)
- **500 Internal Server Error:** `{ "statusCode": 500, "message": "Unexpected server error", "error": "Internal Server Error" }`

**Flow:** Token is single-use. If onboarded → auth tokens. If not onboarded → redirect to `/auth/onboard`.

---

### 3. PUT `/auth/onboard`
**Public** | Complete user onboarding

**Rate Limit:** 3 requests per 60 seconds

**Query Parameters:**
- `provider` (required): `email` or `google`

**Request Body:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "firstName": "John",
  "lastName": "Doe",
  "educationLevel": "Bachelor's Degree",
  "preferences": ["Math", "Science"],
  "token": "verification-token"
}
```

**Success (200):**
```json
{
  "message": "User onboarding successful",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error Responses:**
- **400 Bad Request:** `{ "statusCode": 400, "message": "Invalid input data", "error": "Bad Request" }` (missing fields, user not found, etc.)
- **429 Too Many Requests:** `{ "statusCode": 429, "message": "ThrottlerException: Too Many Requests", "error": "Too Many Requests" }` (retry after 60 seconds)
- **500 Internal Server Error:** `{ "statusCode": 500, "message": "Unexpected server error", "error": "Internal Server Error" }`

---

### 4. POST `/auth/refresh`
**Protected (Refresh Token)** | Refresh access & refresh tokens

**Rate Limit:** 10 requests per 60 seconds

**Query Parameters:**
- `provider` (required): `email` or `google`

**Headers:**
- `Authorization: Bearer <refreshToken>`

**Success (200):**
```json
{
  "message": "Tokens refreshed",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error Responses:**
- **401 Unauthorized:** `{ "statusCode": 401, "message": "Sign in required", "error": "Unauthorized" }`
- **429 Too Many Requests:** `{ "statusCode": 429, "message": "ThrottlerException: Too Many Requests", "error": "Too Many Requests" }` (retry after 60 seconds)
- **500 Internal Server Error:** `{ "statusCode": 500, "message": "Unexpected server error", "error": "Internal Server Error" }`

---

### 5. POST `/auth/google/callback`
**Public** | Exchange Google authorization code for tokens

**Rate Limit:** 5 requests per 60 seconds

**Request Body:**
```json
{ "code": "google-authorization-code" }
```

**Success (200) - Onboarded User:**
```json
{
  "message": "Sign in successful",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "onboarded": true
  }
}
```

**Success (200) - Requires Onboarding:**
```json
{
  "message": "Please complete onboarding.",
  "data": {
    "token": "temp-onboarding-token",
    "provider": "google",
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "names": { "firstName": "John", "lastName": "Doe" },
    "onboarded": false
  }
}
```

**Error Responses:**
- **400 Bad Request (Token Exchange Failed):** `{ "statusCode": 400, "message": "Google token exchange failed", "error": "Bad Request" }`
- **400 Bad Request (User Info Failed):** `{ "statusCode": 400, "message": "Failed to fetch user info from Google", "error": "Bad Request" }`
- **400 Bad Request (Email Not Verified):** `{ "statusCode": 400, "message": "Google email not verified", "error": "Bad Request" }`
- **429 Too Many Requests:** `{ "statusCode": 429, "message": "ThrottlerException: Too Many Requests", "error": "Too Many Requests" }` (retry after 60 seconds)
- **500 Internal Server Error:** `{ "statusCode": 500, "message": "Unexpected server error", "error": "Internal Server Error" }`

**Flow:** If user not onboarded → use temp token at `/auth/onboard?provider=google`.

---

## User Routes (`/users`)

### 6. GET `/users/profile`
**Protected** | Get authenticated user's profile

**Rate Limit:** 30 requests per 60 seconds

**Headers:**
- `Authorization: Bearer <accessToken>`

**Success (200):**
```json
{
  "message": "User profile retrieved successfully",
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "student",
      "educationLevel": "Bachelor's Degree",
      "preferences": ["Math", "Science"]
    }
  }
}
```

**Error Responses:**
- **401 Unauthorized:** `{ "statusCode": 401, "message": "Sign in required", "error": "Unauthorized" }`
- **429 Too Many Requests:** `{ "statusCode": 429, "message": "ThrottlerException: Too Many Requests", "error": "Too Many Requests" }` (retry after 60 seconds)
- **500 Internal Server Error:** `{ "statusCode": 500, "message": "Unexpected server error", "error": "Internal Server Error" }`

---

### 7. PUT `/users/update-profile`
**Protected** | Update user profile

**Rate Limit:** 10 requests per 60 seconds

**Headers:**
- `Authorization: Bearer <accessToken>`

**Request Body:** (at least one field required)
```json
{
  "firstName": "Jane",
  "lastName": "Smith",
  "role": "teacher"
}
```

**Success (200):**
```json
{
  "message": "Profile updated successfully",
  "data": {
    "user": { ...updated user object }
  }
}
```

**Error Responses:**
- **400 Bad Request:** `{ "statusCode": 400, "message": ["At least one field (firstName, lastName, or role) must be provided"], "error": "Bad Request" }`
- **401 Unauthorized:** `{ "statusCode": 401, "message": "Sign in required", "error": "Unauthorized" }`
- **429 Too Many Requests:** `{ "statusCode": 429, "message": "ThrottlerException: Too Many Requests", "error": "Too Many Requests" }` (retry after 60 seconds)
- **500 Internal Server Error:** `{ "statusCode": 500, "message": "Unexpected server error", "error": "Internal Server Error" }`

**Note:** Users cannot update role to "admin".

---

### 8. GET `/users/all`
**Protected (Admin Only)** | Get all users

**Rate Limit:** 20 requests per 60 seconds

**Headers:**
- `Authorization: Bearer <accessToken>`

**Success (200):**
```json
{
  "message": "All users fetched successfully",
  "data": {
    "users": [ ...array of user objects ]
  }
}
```

**Error Responses:**
- **401 Unauthorized:** `{ "statusCode": 401, "message": "Sign in required", "error": "Unauthorized" }`
- **403 Forbidden:** `{ "statusCode": 403, "message": "Access denied", "error": "Forbidden" }`
- **429 Too Many Requests:** `{ "statusCode": 429, "message": "ThrottlerException: Too Many Requests", "error": "Too Many Requests" }` (retry after 60 seconds)
- **500 Internal Server Error:** `{ "statusCode": 500, "message": "Unexpected server error", "error": "Internal Server Error" }`

---

### 9. GET `/users/:identifier/user`
**Protected (Admin Only)** | Get user by ID or email

**Rate Limit:** 20 requests per 60 seconds

**Headers:**
- `Authorization: Bearer <accessToken>`

**Path Parameters:**
- `identifier`: User UUID or email address

**Success (200):**
```json
{
  "message": "User fetched successfully",
  "data": {
    "user": { ...user object }
  }
}
```

**Error Responses:**
- **400 Bad Request:** `{ "statusCode": 400, "message": "User not found", "error": "Bad Request" }`
- **401 Unauthorized:** `{ "statusCode": 401, "message": "Sign in required", "error": "Unauthorized" }`
- **403 Forbidden:** `{ "statusCode": 403, "message": "Access denied", "error": "Forbidden" }`
- **429 Too Many Requests:** `{ "statusCode": 429, "message": "ThrottlerException: Too Many Requests", "error": "Too Many Requests" }` (retry after 60 seconds)
- **500 Internal Server Error:** `{ "statusCode": 500, "message": "Unexpected server error", "error": "Internal Server Error" }`

---

## Chat Routes (`/chats`)

### 10. POST `/chats/create`
**Protected** | Create new empty chat

**Rate Limit:** 10 requests per 60 seconds

**Headers:**
- `Authorization: Bearer <accessToken>`

**Request Body:** (optional)
```json
{ "chatId": "custom-uuid-optional" }
```

**Success (201):**
```json
{
  "message": "Chat created successfully",
  "data": {
    "chat": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Chat",
      "createdAt": "2026-02-16T10:00:00.000Z"
    }
  }
}
```

**Error Responses:**
- **400 Bad Request:** `{ "statusCode": 400, "message": "Invalid UUID format", "error": "Bad Request" }`
- **401 Unauthorized:** `{ "statusCode": 401, "message": "Sign in required", "error": "Unauthorized" }`
- **409 Conflict:** `{ "statusCode": 409, "message": "A chat with this ID already exists", "error": "Conflict" }`
- **429 Too Many Requests:** `{ "statusCode": 429, "message": "ThrottlerException: Too Many Requests", "error": "Too Many Requests" }` (retry after 60 seconds)
- **500 Internal Server Error:** `{ "statusCode": 500, "message": "Unexpected server error", "error": "Internal Server Error" }`

---

### 11. GET `/chats`
**Protected** | Get all user's chats

**Rate Limit:** 30 requests per 60 seconds

**Headers:**
- `Authorization: Bearer <accessToken>`

**Success (200):**
```json
{
  "message": "Chats retrieved successfully",
  "data": {
    "chats": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "title": "My First Chat",
        "createdAt": "2026-02-16T10:00:00.000Z",
        "updatedAt": "2026-02-16T11:00:00.000Z"
      }
    ]
  }
}
```

**Error Responses:**
- **401 Unauthorized:** `{ "statusCode": 401, "message": "Sign in required", "error": "Unauthorized" }`
- **429 Too Many Requests:** `{ "statusCode": 429, "message": "ThrottlerException: Too Many Requests", "error": "Too Many Requests" }` (retry after 60 seconds)
- **500 Internal Server Error:** `{ "statusCode": 500, "message": "Unexpected server error", "error": "Internal Server Error" }`

---

### 12. GET `/chats/:chatId/messages`
**Protected** | Get specific chat with all messages & documents

**Rate Limit:** 30 requests per 60 seconds

**Headers:**
- `Authorization: Bearer <accessToken>`

**Path Parameters:**
- `chatId`: Chat UUID

**Success (200):**
```json
{
  "message": "Chat retrieved successfully",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "My Chat",
    "messages": [ ...array of messages ],
    "documents": [ ...array of documents ]
  }
}
```

**Error Responses:**
- **400 Bad Request:** `{ "statusCode": 400, "message": "Chat not found", "error": "Bad Request" }`
- **401 Unauthorized:** `{ "statusCode": 401, "message": "Sign in required", "error": "Unauthorized" }`
- **429 Too Many Requests:** `{ "statusCode": 429, "message": "ThrottlerException: Too Many Requests", "error": "Too Many Requests" }` (retry after 60 seconds)
- **500 Internal Server Error:** `{ "statusCode": 500, "message": "Unexpected server error", "error": "Internal Server Error" }`

---

### 13. GET `/chats/:chatId/messages/paginated`
**Protected** | Get paginated messages from chat

**Rate Limit:** 30 requests per 60 seconds

**Headers:**
- `Authorization: Bearer <accessToken>`

**Path Parameters:**
- `chatId`: Chat UUID

**Query Parameters:**
- `page` (default: 1): Page number
- `limit` (default: 50, max: 100): Messages per page

**Success (200):**
```json
{
  "message": "Messages retrieved successfully",
  "data": {
    "messages": [ ...array of messages ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 150,
      "totalPages": 3
    }
  }
}
```

**Error Responses:**
- **400 Bad Request:** `{ "statusCode": 400, "message": "Chat not found", "error": "Bad Request" }`
- **401 Unauthorized:** `{ "statusCode": 401, "message": "Sign in required", "error": "Unauthorized" }`
- **429 Too Many Requests:** `{ "statusCode": 429, "message": "ThrottlerException: Too Many Requests", "error": "Too Many Requests" }` (retry after 60 seconds)
- **500 Internal Server Error:** `{ "statusCode": 500, "message": "Unexpected server error", "error": "Internal Server Error" }`

---

### 14. POST `/chats/:chatId/send-buffered-message`
**Protected** | Send message to chat (non-streaming)

**Rate Limit:** 10 requests per 60 seconds

**Headers:**
- `Authorization: Bearer <accessToken>`

**Path Parameters:**
- `chatId`: Chat UUID or `"new"` to create new chat

**Request Body:**
```json
{
  "message": "What is quantum computing?",
  "selectedDocumentIds": ["doc-uuid-1", "doc-uuid-2"],
  "pageNumber": 5,
  "pageContent": "specific text from a page"
}
```
*Note: `selectedDocumentIds`, `pageNumber`, and `pageContent` are optional*

**Success (200):**
```json
{
  "message": "Message sent successfully",
  "data": {
    "chatId": "550e8400-e29b-41d4-a716-446655440000",
    "response": "AI assistant response...",
    "tokens": {
      "input": 100,
      "output": 200
    }
  }
}
```

**Error Responses:**
- **400 Bad Request:** `{ "statusCode": 400, "message": "Chat not found", "error": "Bad Request" }` (when chatId is not "new")
- **401 Unauthorized:** `{ "statusCode": 401, "message": "Sign in required", "error": "Unauthorized" }`
- **429 Too Many Requests:** `{ "statusCode": 429, "message": "ThrottlerException: Too Many Requests", "error": "Too Many Requests" }` (retry after 60 seconds)
- **500 Internal Server Error (OpenAI):** `{ "statusCode": 500, "message": "OpenAI API error message", "error": "Internal Server Error" }`
- **500 Internal Server Error (Generic):** `{ "statusCode": 500, "message": "Unexpected error occurred", "error": "Internal Server Error" }`

**Flow:** If chatId="new" → creates chat with title from first 16 characters of message. Uses GPT-4.1-mini with document search.

---

### 15. POST `/chats/:chatId/sse/create-stream-session`
**Protected** | Initialize streaming message session (SSE)

**Rate Limit:** 10 requests per 60 seconds

**Headers:**
- `Authorization: Bearer <accessToken>`

**Path Parameters:**
- `chatId`: Chat UUID

**Request Body:** Same as `/send-buffered-message`

**Success (200):**
```json
{
  "message": "Stream session created",
  "data": {
    "sessionId": "session-uuid"
  }
}
```

**Error Responses:**
- **401 Unauthorized:** `{ "statusCode": 401, "message": "Missing auth token", "error": "Unauthorized" }`
- **429 Too Many Requests:** `{ "statusCode": 429, "message": "ThrottlerException: Too Many Requests", "error": "Too Many Requests" }` (retry after 60 seconds)
- **500 Internal Server Error:** `{ "statusCode": 500, "message": "Unexpected server error", "error": "Internal Server Error" }`

**Flow:** Call this endpoint first, then connect SSE to `/chats/:chatId/sse/stream-message`.

---

### 16. SSE `/chats/:chatId/sse/stream-message`
**SSE Stream** | Stream AI response (connect after creating session)

**Rate Limit:** 30 requests per 60 seconds

**Path Parameters:**
- `chatId`: Chat UUID

**Returns:** Server-Sent Events stream with incremental response chunks

**Error Responses:**
- **429 Too Many Requests:** `{ "statusCode": 429, "message": "ThrottlerException: Too Many Requests", "error": "Too Many Requests" }` (retry after 60 seconds)

**Flow:** Opens persistent event stream. Client receives AI response in real-time chunks.

---

### 17. POST `/chats/:chatId/upload-document`
**Protected** | Upload documents (PDF/DOCX) to chat

**Rate Limit:** 5 requests per 60 seconds

**Headers:**
- `Authorization: Bearer <accessToken>`
- `Content-Type: multipart/form-data`

**Path Parameters:**
- `chatId`: Chat UUID or `"new"` to create new chat

**Form Data:**
- `files`: PDF or DOCX files (max 5 files, 10MB each)
- `message` (optional): Used as chat title if chatId="new" (first 16 chars)

**Success (200):**
```json
{
  "message": "All files uploaded successfully",
  "remainingSlots": 3,
  "chatId": "550e8400-e29b-41d4-a716-446655440000",
  "successfulUploads": [
    { "id": "doc-uuid-1", "name": "document.pdf" }
  ],
  "failedUploads": []
}
```

**Error Responses:**
- **400 Bad Request (No Files):** `{ "statusCode": 400, "message": "No files uploaded", "error": "Bad Request" }`
- **400 Bad Request (Chat Not Found):** `{ "statusCode": 400, "message": "Chat not found", "error": "Bad Request" }`
- **400 Bad Request (Invalid File Type):** `{ "statusCode": 400, "message": "Only docx or pdf files are allowed!", "error": "Bad Request" }`
- **400 Bad Request (File Too Large):** `{ "statusCode": 400, "message": "File too large", "error": "Bad Request" }`
- **401 Unauthorized:** `{ "statusCode": 401, "message": "Sign in required", "error": "Unauthorized" }`
- **413 Payload Too Large:** `{ "statusCode": 413, "message": "File too large", "error": "Payload Too Large" }`
- **429 Too Many Requests:** `{ "statusCode": 429, "message": "ThrottlerException: Too Many Requests", "error": "Too Many Requests" }` (retry after 60 seconds)
- **500 Internal Server Error:** `{ "statusCode": 500, "message": "Unexpected server error", "error": "Internal Server Error" }`

**Constraints:** Maximum 5 documents per chat total (existing + new uploads).

---

### 18. POST `/chats/:chatId/request-upload-url`
**Protected** | Get pre-signed S3 URL for direct upload

**Rate Limit:** 10 requests per 60 seconds

**Headers:**
- `Authorization: Bearer <accessToken>`

**Path Parameters:**
- `chatId`: Chat UUID

**Request Body:**
```json
{
  "fileName": "document.pdf",
  "fileType": "application/pdf",
  "fileSize": 1024000
}
```

**Success (200):**
```json
{
  "message": "Pre-signed URL generated",
  "data": {
    "uploadUrl": "https://s3.amazonaws.com/bucket/key?signature=...",
    "documentId": "550e8400-e29b-41d4-a716-446655440000",
    "s3Key": "documents/550e8400-e29b-41d4-a716-446655440000.pdf",
    "expiresIn": 900
  }
}
```

**Error Responses:**
- **400 Bad Request (Chat Not Found):** `{ "statusCode": 400, "message": "Chat not found", "error": "Bad Request" }`
- **400 Bad Request (Max Docs Reached):** `{ "statusCode": 400, "message": "Max documents reached", "error": "Bad Request" }`
- **401 Unauthorized:** `{ "statusCode": 401, "message": "Sign in required", "error": "Unauthorized" }`
- **429 Too Many Requests:** `{ "statusCode": 429, "message": "ThrottlerException: Too Many Requests", "error": "Too Many Requests" }` (retry after 60 seconds)
- **500 Internal Server Error:** `{ "statusCode": 500, "message": "Unexpected server error", "error": "Internal Server Error" }`

**Flow:** 
1. Call this endpoint to get uploadUrl and documentId
2. PUT file directly to uploadUrl from client
3. Call `/chats/:chatId/process-uploaded-document` with documentId

---

### 19. POST `/chats/:chatId/process-uploaded-document`
**Protected** | Process document after S3 upload

**Rate Limit:** 10 requests per 60 seconds

**Headers:**
- `Authorization: Bearer <accessToken>`

**Path Parameters:**
- `chatId`: Chat UUID

**Request Body:**
```json
{ "documentId": "550e8400-e29b-41d4-a716-446655440000" }
```

**Success (200):**
```json
{
  "message": "Document processed successfully",
  "data": {
    "document": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "fileName": "document.pdf",
      "fileType": "application/pdf",
      "fileSize": 1024000
    }
  }
}
```

**Error Responses:**
- **400 Bad Request (Doc Not Found):** `{ "statusCode": 400, "message": "Document not found", "error": "Bad Request" }`
- **400 Bad Request (Invalid PDF):** `{ "statusCode": 400, "message": "Invalid PDF", "error": "Bad Request" }`
- **401 Unauthorized:** `{ "statusCode": 401, "message": "Sign in required", "error": "Unauthorized" }`
- **429 Too Many Requests:** `{ "statusCode": 429, "message": "ThrottlerException: Too Many Requests", "error": "Too Many Requests" }` (retry after 60 seconds)
- **500 Internal Server Error (Processing Failed):** `{ "statusCode": 500, "message": "Processing failed", "error": "Internal Server Error" }`
- **500 Internal Server Error (Generic):** `{ "statusCode": 500, "message": "Unexpected server error", "error": "Internal Server Error" }`

**Flow:** Extracts text, generates embeddings, stores in OpenAI vector database.

---

### 20. DELETE `/chats/:chatId/remove-document`
**Protected** | Remove document from chat

**Rate Limit:** 10 requests per 60 seconds

**Headers:**
- `Authorization: Bearer <accessToken>`

**Path Parameters:**
- `chatId`: Chat UUID

**Request Body:**
```json
{ "documentId": "550e8400-e29b-41d4-a716-446655440000" }
```

**Success (204):** No Content

**Error Responses:**
- **400 Bad Request (Chat Not Found):** `{ "statusCode": 400, "message": "Chat not found", "error": "Bad Request" }`
- **400 Bad Request (Doc Not Found):** `{ "statusCode": 400, "message": "Document not found in this chat", "error": "Bad Request" }`
- **401 Unauthorized:** `{ "statusCode": 401, "message": "Sign in required", "error": "Unauthorized" }`
- **429 Too Many Requests:** `{ "statusCode": 429, "message": "ThrottlerException: Too Many Requests", "error": "Too Many Requests" }` (retry after 60 seconds)
- **500 Internal Server Error:** `{ "statusCode": 500, "message": "Unexpected server error", "error": "Internal Server Error" }`

**Flow:** Deletes from OpenAI vector store, OpenAI file storage, and database.

---

### 21. GET `/chats/:chatId/documents`
**Protected** | Get all documents in chat

**Rate Limit:** 30 requests per 60 seconds

**Headers:**
- `Authorization: Bearer <accessToken>`

**Path Parameters:**
- `chatId`: Chat UUID

**Success (200):**
```json
{
  "message": "Documents retrieved successfully",
  "data": {
    "documents": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "fileName": "document.pdf",
        "fileSize": 1024000,
        "fileType": "application/pdf",
        "uploadedAt": "2026-02-16T10:00:00.000Z"
      }
    ]
  }
}
```

**Error Responses:**
- **400 Bad Request:** `{ "statusCode": 400, "message": "Chat not found", "error": "Bad Request" }`
- **401 Unauthorized:** `{ "statusCode": 401, "message": "Sign in required", "error": "Unauthorized" }`
- **429 Too Many Requests:** `{ "statusCode": 429, "message": "ThrottlerException: Too Many Requests", "error": "Too Many Requests" }` (retry after 60 seconds)
- **500 Internal Server Error:** `{ "statusCode": 500, "message": "Unexpected server error", "error": "Internal Server Error" }`

---

### 22. GET `/chats/:chatId/documents/:documentId/sign`
**Protected** | Get signed download URL for document

**Rate Limit:** 20 requests per 60 seconds

**Headers:**
- `Authorization: Bearer <accessToken>`

**Path Parameters:**
- `chatId`: Chat UUID
- `documentId`: Document UUID

**Success (200):**
```json
{
  "message": "Signed URL generated successfully",
  "data": {
    "signedUrl": "https://s3.amazonaws.com/bucket/key?signature=...",
    "fileName": "document.pdf",
    "expiresIn": 86400
  }
}
```

**Error Responses:**
- **400 Bad Request (Chat Not Found):** `{ "statusCode": 400, "message": "Chat not found", "error": "Bad Request" }`
- **400 Bad Request (Doc Not Found):** `{ "statusCode": 400, "message": "Document not found in this chat", "error": "Bad Request" }`
- **401 Unauthorized:** `{ "statusCode": 401, "message": "Sign in required", "error": "Unauthorized" }`
- **429 Too Many Requests:** `{ "statusCode": 429, "message": "ThrottlerException: Too Many Requests", "error": "Too Many Requests" }` (retry after 60 seconds)
- **500 Internal Server Error:** `{ "statusCode": 500, "message": "Unexpected server error", "error": "Internal Server Error" }`

**Flow:** URL expires in 24 hours (86400 seconds). Use directly in browser/fetch to download file.

---

### 23. PATCH `/chats/:chatId/messages/:messageId/feedback`
**Protected** | Update message helpful status

**Rate Limit:** 20 requests per 60 seconds

**Headers:**
- `Authorization: Bearer <accessToken>`

**Path Parameters:**
- `chatId`: Chat UUID
- `messageId`: Message UUID

**Request Body:**
```json
{ "helpful": true }
```

**Success (200):**
```json
{
  "message": "Feedback updated successfully",
  "data": {
    "messageId": "550e8400-e29b-41d4-a716-446655440000",
    "helpful": true
  }
}
```

**Error Responses:**
- **400 Bad Request (Chat Not Found):** `{ "statusCode": 400, "message": "Chat not found", "error": "Bad Request" }`
- **400 Bad Request (Message Not Found):** `{ "statusCode": 400, "message": "Message not found in chat", "error": "Bad Request" }`
- **401 Unauthorized:** `{ "statusCode": 401, "message": "Sign in required", "error": "Unauthorized" }`
- **429 Too Many Requests:** `{ "statusCode": 429, "message": "ThrottlerException: Too Many Requests", "error": "Too Many Requests" }` (retry after 60 seconds)
- **500 Internal Server Error:** `{ "statusCode": 500, "message": "Unexpected server error", "error": "Internal Server Error" }`

---

### 24. DELETE `/chats/:chatId/delete`
**Protected** | Delete chat and all associated data

**Rate Limit:** 10 requests per 60 seconds

**Headers:**
- `Authorization: Bearer <accessToken>`

**Path Parameters:**
- `chatId`: Chat UUID

**Success (204):** No Content

**Error Responses:**
- **400 Bad Request:** `{ "statusCode": 400, "message": "Chat not found", "error": "Bad Request" }`
- **401 Unauthorized:** `{ "statusCode": 401, "message": "Sign in required", "error": "Unauthorized" }`
- **429 Too Many Requests:** `{ "statusCode": 429, "message": "ThrottlerException: Too Many Requests", "error": "Too Many Requests" }` (retry after 60 seconds)
- **500 Internal Server Error:** `{ "statusCode": 500, "message": "Unexpected server error", "error": "Internal Server Error" }`

**Flow:** Cascades delete to all messages and documents associated with chat.

---

### 25. POST `/chats/test/simple-message`
**Public** | Test endpoint (no auth/DB)

**Rate Limit:** 5 requests per 60 seconds

**Request Body:**
```json
{ "message": "test message" }
```

**Success (200):**
```json
{
  "message": "Response generated successfully",
  "data": {
    "userMessage": "test message",
    "assistantResponse": "AI response...",
    "model": "gpt-4.1-mini",
    "tokens": 150
  }
}
```

**Error Responses:**
- **400 Bad Request:** `{ "statusCode": 400, "message": "Message cannot be empty", "error": "Bad Request" }`
- **429 Too Many Requests:** `{ "statusCode": 429, "message": "ThrottlerException: Too Many Requests", "error": "Too Many Requests" }` (retry after 60 seconds)
- **500 Internal Server Error:** `{ "statusCode": 500, "message": "OpenAI error message", "error": "Internal Server Error" }`

---

## Common HTTP Status Codes

- **200 OK:** Request successful
- **201 Created:** Resource created successfully
- **204 No Content:** Request successful, no response body
- **400 Bad Request:** Validation errors, missing fields, resource not found
- **401 Unauthorized:** Missing/invalid/expired auth token
- **403 Forbidden:** Insufficient permissions
- **409 Conflict:** Resource already exists
- **413 Payload Too Large:** File size exceeds limit
- **429 Too Many Requests:** Rate limit exceeded (see Rate Limiting section below)
- **500 Internal Server Error:** Server or external API errors

---

## Authentication Flows

### Email Magic Link Flow
1. `POST /auth/magic-link` with email → email sent with token
2. User clicks link, extract token from URL
3. `POST /auth/verify-token` with token
   - If `onboarded: true` → save `accessToken` and `refreshToken`
   - If `onboarded: false` → proceed to step 4
4. `PUT /auth/onboard?provider=email` with user details → save tokens

### Google OAuth Flow
1. Frontend initiates Google OAuth and obtains authorization code
2. `POST /auth/google/callback` with code
   - If `onboarded: true` → save `accessToken` and `refreshToken`
   - If `onboarded: false` → save temp `token`, proceed to step 3
3. `PUT /auth/onboard?provider=google` with user details → save tokens

### Token Refresh Flow
- When `accessToken` expires (typically returns 401):
  1. `POST /auth/refresh?provider=email|google` with `refreshToken` in Authorization header
  2. Save new `accessToken` and `refreshToken`
  3. Retry original request with new `accessToken`

---

## Document Upload Flows

### Option A: Direct Upload via Multipart
1. `POST /chats/:chatId/upload-document` with `multipart/form-data`
2. Files processed and added to vector store automatically

### Option B: Pre-signed S3 URL Upload
1. `POST /chats/:chatId/request-upload-url` → receive `uploadUrl` and `documentId`
2. Client sends `PUT` request directly to `uploadUrl` with file binary
3. `POST /chats/:chatId/process-uploaded-document` with `documentId` → processing begins

**Recommendation:** Use Option B for large files to avoid backend timeout and provide upload progress feedback.

---

## Chat Messaging Flows

### Non-Streaming (Buffered)
1. `POST /chats/:chatId/send-buffered-message` with message
2. Wait for complete response
3. Receive full AI response in single payload

**Use Case:** Simple chat interfaces, mobile apps

### Streaming (SSE)
1. `POST /chats/:chatId/sse/create-stream-session` with message → receive `sessionId`
2. Establish SSE connection to `GET /chats/:chatId/sse/stream-message`
3. Receive response chunks in real-time via event stream

**Use Case:** Real-time chat interfaces, better UX for long responses

---

## Important Notes

### Authentication
- All protected routes require: `Authorization: Bearer <accessToken>`
- Refresh tokens should be stored securely (httpOnly cookies recommended)
- Access tokens typically expire faster than refresh tokens
- Use `/auth/refresh` endpoint when access token expires

### Chats
- `chatId` can be `"new"` in upload/send-message routes to auto-create chat
- Maximum 5 documents per chat
- Maximum 10MB per file
- Supported formats: PDF (.pdf), Word documents (.docx)
- Chat titles auto-generated from first message (first 16 characters)

### Messages
- Messages support optional document context via `selectedDocumentIds`
- Can provide specific page context with `pageNumber` and `pageContent`
- AI model: GPT-4.1-mini with file search capabilities
- Token usage returned with each message response

###Pagination
- Pages start at 1
- Default limit: 50 messages per page
- Maximum limit: 100 messages per page

### Timestamps
- All timestamps in ISO 8601 format (e.g., `"2026-02-16T10:00:00.000Z"`)

### UUIDs
- All resource IDs are UUID v4 format
- Custom UUIDs can be provided when creating chats (optional)

### Error Handling
- Always check `statusCode` and `message` fields in error responses
- Multiple error messages possible for same status code (check examples)
- 500 errors may contain specific OpenAI API error messages

### Rate Limiting
- All endpoints have rate limiting enabled to prevent abuse
- Limits vary by endpoint based on resource intensity (3-30 requests per 60 seconds)
- When rate limit is exceeded, a 429 error is returned with retry-after information
- Auth endpoints: 3-10 requests/minute depending on operation
- Read operations: 20-30 requests/minute
- Write/compute operations: 5-10 requests/minute
- After rate limit is exceeded, wait 60 seconds before retrying
- Implement exponential backoff in your client for production use
