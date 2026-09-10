# IKIM Transcription Tool

Doctors dictate operation reports, a speech model transcribes them, and someone has to fix what it got wrong. This is the tool that someone uses upload the audio and the model's first-pass transcript, correct it against the original, and tag the corrections that matter.

Built for the IKIM Full Stack Engineer coding challenge (Node/Express/Prisma/PostgreSQL + Vue 3).

## Run it

```bash
docker compose up
```

That's it. This starts PostgreSQL, runs pending migrations, and starts the backend (`http://localhost:4000`) and frontend (`http://localhost:5173`). Open `http://localhost:5173` and start uploading audio.

Requires Docker Desktop only, nothing else needs to be installed on the host.

## Local development (hot reload)

For active development, run the database in Docker and the backend/frontend locally with Yarn instead:

1. Start Postgres:

   ```bash
   docker compose up -d db
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
