# IKIM Transcription Tool

Doctors dictate operation reports, a speech model transcribes them, and someone has to fix what it got wrong. This is the tool that someone uses upload the audio and the model's first-pass transcript, correct it against the original, and tag the corrections that matter.

Built for the IKIM Full Stack Engineer coding challenge (Node/Express/Prisma/PostgreSQL + Vue 3).

**Status:**

- Actively in progress.
- Ingest, audio upload, server-side duration checks, transcript pairing is built and tested.
- Work queue, annotation, and export are next.

## Prerequisites

- Node.js 22
- Yarn (classic, v1)
- Docker Desktop (for PostgreSQL)

## Setup

> The steps below run the database in Docker and the backend/frontend locally with Yarn, for fast reload during active development. Before final submission, this collapses to a single `docker compose up` starting the whole app, not yet wired since the app itself is still being built.

1. Start Postgres:

   ```bash
   docker compose up -d
   ```

2. Backend:

   ```bash
   cd backend
   yarn install
   yarn prisma migrate dev
   yarn prisma generate
   yarn dev
   ```

   Needs a `.env` file (gitignored) with:

   ```
   DATABASE_URL=postgresql://ikim:ikim@localhost:5432/transcription_tool
   PORT=4000
   ```

3. Frontend (separate terminal):
   ```bash
   cd frontend
   yarn install
   yarn dev
   ```
   Opens at `http://localhost:5173`.

## Testing

```bash
cd backend
yarn test
```
