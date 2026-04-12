# Lernen

An AI-powered document learning assistant built with NestJS. Upload PDFs, ask questions, and get context-aware answers grounded in your documents.

## Features

- **Document Q&A** — Upload PDFs and chat with them using RAG (ChromaDB + OpenAI embeddings)
- **Streaming responses** — Server-Sent Events for real-time AI output
- **Magic link auth** — Passwordless email sign-in + Google OAuth
- **Smart memory** — Automatic chat summarization to maintain long conversation context
- **S3 storage** — Cloudflare R2 for document storage with pre-signed URL support
- **Redis caching** — Upstash Redis for session and user data caching

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | NestJS 11 |
| Database | PostgreSQL + Drizzle ORM |
| Vector DB | ChromaDB (Cloud) |
| AI | OpenAI (GPT, embeddings) |
| Auth | JWT (access + refresh) + Passport |
| Storage | Cloudflare R2 (S3-compatible) |
| Cache / Queue | Upstash Redis + BullMQ |
| Email | Nodemailer (Gmail SMTP) |

## Getting Started

```bash
npm install
cp .env.example .env   # fill in your credentials
npm run generate-sql   # generate migrations
npm run migrate-sql    # apply migrations
npm run start:dev
```

API docs available at `http://localhost:{PORT}/api/v1/docs`

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` / `JWT_EXPIRATION` | Access token config |
| `REFRESH_JWT_SECRET` / `REFRESH_JWT_EXPIRATION` | Refresh token config |
| `OPENAI_API_KEY` | OpenAI API key |
| `CHROMA_API_KEY` / `CHROMA_TENANT` / `CHROMA_DATABASE` | ChromaDB Cloud credentials |
| `CLOUDFLARE_R2_ENDPOINT` / `CLOUDFLARE_R2_ACCESS_KEY_ID` / `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | R2 storage |
| `UPSTASH_REDIS_URL` / `UPSTASH_REDIS_TOKEN` | Redis cache |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URL` | Google OAuth |
| `GMAIL_USER` / `GMAIL_PASS` | Email delivery |

## API Overview

```
POST   /api/v1/auth/magic-link              # Request sign-in email
POST   /api/v1/auth/verify-token            # Verify magic link token
PUT    /api/v1/auth/onboard                 # Complete onboarding
POST   /api/v1/auth/google/callback         # Google OAuth sign-in
POST   /api/v1/auth/refresh                 # Refresh tokens

POST   /api/v1/chats/create                 # Create chat
GET    /api/v1/chats                        # List chats
GET    /api/v1/chats/:id/messages           # Get chat with messages
DELETE /api/v1/chats/:id/delete             # Delete chat

POST   /api/v1/chats/:id/upload-document    # Upload PDF
POST   /api/v1/chats/:id/request-upload-url # Get pre-signed S3 URL
POST   /api/v1/chats/:id/process-uploaded-document
DELETE /api/v1/chats/:id/remove-document

POST   /api/v1/chats/:id/send-buffered-message   # Buffered AI response
POST   /api/v1/chats/:id/sse/create-stream-session
GET    /api/v1/chats/:id/sse/stream-message      # Streaming AI response

GET    /api/v1/users/profile                # Get profile
PUT    /api/v1/users/update-profile         # Update profile
```

## Scripts

```bash
npm run start:dev       # Development with hot reload
npm run build           # Production build
npm run start:prod      # Run production build
npm run generate-sql    # Generate Drizzle migrations
npm run migrate-sql     # Apply migrations
```

## Architecture Notes

- **RAG pipeline**: PDF text is extracted per page via `pdfjs-serverless`, chunked with LangChain's `RecursiveCharacterTextSplitter` (1000 chars, 200 overlap), embedded with `text-embedding-3-small`, and stored in ChromaDB
- **Streaming**: Uses OpenAI Responses API with SSE; stream sessions are stored in Redis keyed by chat ID
- **Memory**: Every 6 messages, older turns are summarized with `gpt-5-nano` and stored in the `chat_summaries` table; recent 4 turns are always kept verbatim
- **Query rewriting**: When conversation history exists, the user's query is rewritten before vector retrieval to improve relevance



// start
prevous claude chat told me to add that testing. ps (it was teaching me about testing and we went though, unit, integration, API, security then performance. using this website as blue print: https://www.ramotion.com/blog/what-is-backend-testing/)



so it went over that quickly and then said we can move on to auth testing, so to make it more real, we use my exisiting project as the ground for it





this is the error from the spec.ts i  pasted;



 FAIL  src/core/auth/auth.service.spec.ts (14.653 s)

  AuthService

    sendMagicLink                                                                                                                                                                                        

      × creates a new user and sends magic link if user does not exist (34 ms)                                                                                                                           

      √ sends magic link to existing user without creating a new one (7 ms)                                                                                                                              

      √ does not expose the raw token in the response (6 ms)                                                                                                                                             

                                                                                                                                                                                                         

  ● AuthService › sendMagicLink › creates a new user and sends magic link if user does not exist                                                                                                         

                                                                                                                                                                                                         

    expect(jest.fn()).toHaveBeenCalledWith(...expected)

    Expected: "sign_in", "new@example.com", ObjectContaining {"tempToken": "mock-jwt-token"}

    Received: "sign_in", "test@example.com", {"id": "user-123", "tempToken": "mock-jwt-token"}

    Expected: "sign_in", "new@example.com", ObjectContaining {"tempToken": "mock-jwt-token"}

    Received: "sign_in", "test@example.com", {"id": "user-123", "tempToken": "mock-jwt-token"}

    Number of calls: 1

      90 |

      91 |       expect(result.message).toBe('Magic link sent! Please check your email.');

    > 92 |       expect(mockEmailService.sendEmail).toHaveBeenCalledWith(

         |                                          ^

      93 |         'sign_in',

      94 |         'new@example.com',

      95 |         expect.objectContaining({ tempToken: 'mock-jwt-token' })

      at Object.<anonymous> (core/auth/auth.service.spec.ts:92:42)

Test Suites: 1 failed, 1 total

Tests:       1 failed, 2 passed, 3 total

Snapshots:   0 total

Time:        15.226 s

Ran all test suites.







i will attach the github repo once you reply short response to this