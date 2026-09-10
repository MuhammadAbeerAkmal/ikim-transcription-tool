# IKIM Transcription Tool

Doctors dictate operation reports, a speech model transcribes them, and someone has to fix what it got wrong. This is the tool that someone uses upload the audio and the model's first-pass transcript, correct it against the original, and tag the corrections that matter.

Built with Node/Express/Prisma/PostgreSQL + Vue 3

## Run it

```bash
docker compose up
```

That's it. This starts PostgreSQL, runs pending migrations, seeds a few demo items (so the work queue isn't empty on first launch), and starts the backend (`http://localhost:4000`) and frontend (`http://localhost:5173`). Open `http://localhost:5173` and start uploading audio.

Requires only Docker Desktop on the host. Nothing else needs to be installed.

## Local development (hot reload)

For active development, run the database in Docker and the backend/frontend locally with Yarn instead. Requires Node.js 22 and Yarn (classic, v1).

1. Start Postgres:

   ```bash
   docker compose up -d db
   ```

2. Backend needs a `.env` file (gitignored) in `backend/`, created before the commands below:

   ```
   DATABASE_URL=postgresql://ikim:ikim@localhost:5432/transcription_tool
   PORT=4000
   ```

   Then:

   ```bash
   cd backend
   yarn install
   yarn prisma migrate dev
   yarn prisma generate
   yarn dev
   ```

3. Frontend (separate terminal):

   ```bash
   cd frontend
   yarn install
   yarn dev
   ```

   Opens at `http://localhost:5173`.

4. Optional: seed the same demo items the Docker path creates automatically:
   ```bash
   cd backend
   yarn seed
   ```
   Safe to run any time. It's a no-op once the database already has any items.

## Testing

Runs against a real database, so this needs the same local setup as "Local development" above: Postgres up (`docker compose up -d db`) and a `backend/.env` file with `DATABASE_URL` (see step 2 above).

```bash
cd backend
yarn install
yarn prisma migrate dev
yarn prisma generate
yarn test
```
