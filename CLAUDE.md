# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run setup        # Install deps, generate Prisma client, run migrations (first-time setup)
npm run dev          # Start dev server with Turbopack at http://localhost:3000
npm run build        # Production build
npm run test         # Run Vitest test suite
npm run lint         # Run ESLint
npm run db:reset     # Reset SQLite database to fresh state
```

Run a single test file:
```bash
npx vitest run src/path/to/__tests__/file.test.ts
```

Environment: copy `.env.example` to `.env` and set `ANTHROPIC_API_KEY` (optional — app runs with mock provider if absent) and `JWT_SECRET`.

## Architecture Overview

UIGen is an AI-powered React component generator with live preview. Users describe components in a chat interface; Claude generates code using tool calls; the code renders immediately in a sandboxed iframe.

### Key Data Flow

1. User sends message → `POST /api/chat` → Vercel AI SDK streams `streamText()` with Anthropic (Claude Haiku 4.5)
2. Claude calls tools (`str_replace_editor`, `file_manager`) to create/modify files
3. Tool results update the **virtual file system** (in-memory, no disk I/O)
4. Frontend subscribes to VFS changes → triggers JSX transformation → updates iframe preview

### Core Modules

- **`src/app/api/chat/route.ts`** — Streaming AI endpoint. Tools: `str_replace_editor` (view/create/str_replace/insert) and `file_manager`. Max 40 steps. System prompt uses Anthropic ephemeral cache.
- **`src/lib/file-system.ts`** — In-memory virtual file system with serialization for DB persistence.
- **`src/lib/contexts/`** — Two React contexts: `FileSystemContext` (VFS state + tool call handling) and `ChatContext` (messages + streaming state).
- **`src/lib/transform/jsx-transformer.ts`** — Babel standalone transforms JSX/TSX → blob URLs. Generates HTML with import maps pointing to esm.sh CDN for React/React-DOM. Entry point: `App.jsx` or `App.tsx`.
- **`src/lib/prompts/generation.tsx`** — System prompt: instructs Claude to use Tailwind, require `/App.jsx` as root, use `@/` aliases for non-library imports.
- **`src/lib/provider.ts`** — Selects real Anthropic vs. mock provider (mock used when no API key).
- **`src/actions/index.ts`** — Server actions for auth (signup/login/logout) and project CRUD.
- **`src/middleware.ts`** — Protects `/api/projects` and `/api/filesystem` routes with JWT.

### Authentication

JWT-based with HTTP-only cookies (`JWT_SECRET`, 7-day expiry). Anonymous users can work without auth — their projects are ephemeral. Registered users get project persistence via Prisma/SQLite.

### Database

Prisma with SQLite (`prisma/dev.db`). Two models: `User` and `Project`. Project `messages` and `data` (VFS) stored as JSON strings.

### UI Layout

3-panel with `react-resizable-panels`: Chat (left, 35%) | Preview/Code tabs (right, 65%). Code editor uses Monaco; UI primitives are Radix UI + Tailwind CSS v4 (shadcn/ui, new-york style).

### Testing

Tests in `__tests__/` directories alongside source. Covers VFS context, chat context, JSX transformer, and message components.

<!-- Author: Vang Nguyen -->
