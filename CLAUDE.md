# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

YomuLog is a React Native (Expo) app for tracking reading progress. Users can add books by ISBN barcode scan or manual entry, record page bookmarks, write reading notes, and (upcoming) generate AI summaries of their notes via Gemini.

## Commands

```bash
# Start development (Metro bundler)
npx expo start

# Run on specific platform
npx expo start --ios
npx expo start --android

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run a single test file
npx jest __tests__/BookDetail.test.tsx
```

## Tech Stack

- **Framework**: React Native + Expo Router (file-based routing)
- **Language**: TypeScript
- **Backend**: Supabase (PostgreSQL + Auth + Edge Functions)
- **Styling**: NativeWind v4 (TailwindCSS for React Native)
- **Testing**: Jest + jest-expo + @testing-library/react-native

## Architecture

### Routing (Expo Router)

```text
app/
  _layout.tsx          # Root layout — handles auth redirect logic
  (auth)/
    login.tsx
    signup.tsx
  (tabs)/
    index.tsx          # Library screen (book list)
    add.tsx            # Add book screen (manual + barcode)
    settings.tsx
  book/
    [id].tsx           # Book detail (progress + notes)
    edit/[id].tsx      # Edit book metadata
```

### Auth Flow

`app/_layout.tsx` reads `useAuth()` → redirects unauthenticated users to `/(auth)/login`, authenticated users away from auth screens. Supabase session is persisted via `expo-sqlite/localStorage`.

### Data Layer

All Supabase calls go through `lib/supabase.ts`. The client uses `expo-sqlite/localStorage` for session storage (not `AsyncStorage`).

### Supabase Tables

| Table | Purpose |
|---|---|
| `books` | User's book library (`user_id`, `title`, `author`, `total_pages`, `current_page`, `status`, `cover_url`) |
| `bookmarks` | Page position history per day (`book_id`, `user_id`, `page_number`, `recorded_at`) — upsert with conflict on `(book_id, user_id, recorded_at)` |
| `reading_notes` | Per-book notes (`book_id`, `user_id`, `page_number`, `content`, `is_bookmarked`) |
| `book_summaries` | AI-generated summaries (planned — see `docs/ai_memo_feature_detail_design.md`) |

### ISBN Book Search (`services/bookSearch.ts`)

`searchByISBN()` tries OpenBD first (Japanese books), falls back to Open Library (international). Cover images come from NDL thumbnail or Open Library covers API.

### Styling Conventions

NativeWind classNames are used throughout. Custom color tokens defined in `tailwind.config.js`:
- `primary` (#3ea8ff), `accent` (#22c55e), `danger` (#ef4444)
- `bg-main`, `bg-sub`, `text-primary`, `text-secondary`, `border-light`, `border-main`

## Testing

Tests live in `__tests__/`. The Supabase client is mocked at `__mocks__/supabase.ts` — Jest auto-resolves this mock. When writing tests, import from `../../lib/supabase` and use the mock's named exports (`mockSignUp`, `mockSignInWithPassword`, etc.) to set up return values.

## Environment Variables

Create a `.env` file at the root:
```env
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

## Upcoming: AI Memo Summarization

See `docs/ai_memo_feature_detail_design.md` for the full design. Key points:
- Supabase Edge Function (`supabase/functions/summarize-memos/`) calls Gemini 2.0 Flash
- Requires `GEMINI_API_KEY` secret set in Supabase Dashboard
- DB migrations needed: `reading_notes.is_bookmarked`, `books.last_summarized_at`, new `book_summaries` table
- **Free Plan Edge Functions timeout in 2s — Pro Plan required for production**
- New component `components/AISummarySection.tsx` added to `app/book/[id].tsx`
