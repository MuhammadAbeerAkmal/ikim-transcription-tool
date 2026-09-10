# IKIM Transcription Tool

Doctors dictate operation reports, a speech model transcribes them, and someone has to fix what it got wrong. This is the tool that someone uses to upload the audio and the model's first-pass transcript, correct it against the original, and tag the corrections that matter.

Built with Node/Express/Prisma/PostgreSQL + Vue 3

## Run it

**Prerequisite:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running. Nothing else needs to be installed on the host, Node.js, Yarn, and PostgreSQL all run inside the containers.

```bash
git clone https://github.com/MuhammadAbeerAkmal/ikim-transcription-tool.git
cd ikim-transcription-tool
docker compose up
```

That's it. This starts PostgreSQL, runs pending migrations, seeds a few demo items (so the work queue isn't empty on first launch), and starts the backend (`http://localhost:4000`) and frontend (`http://localhost:5173`). Open `http://localhost:5173` and start uploading audio.

## Local development (hot reload)

For active development, run the database in Docker and the backend/frontend locally with Yarn instead. Requires Node.js 22 and Yarn (classic, v1).

1. Start Postgres:

   ```bash
   docker compose up -d db
   ```

2. Backend needs a `.env` file (gitignored, not part of the repo):

   ```bash
   cd backend
   cat > .env << 'EOF'
   DATABASE_URL=postgresql://ikim:ikim@localhost:5432/transcription_tool
   PORT=4000
   EOF
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

Runs against a real database. If you haven't already set up "Local development" above, start Postgres and create `backend/.env` first:

```bash
docker compose up -d db
cd backend
cat > .env << 'EOF'
DATABASE_URL=postgresql://ikim:ikim@localhost:5432/transcription_tool
PORT=4000
EOF
```

Then, from `backend/`:

```bash
yarn install
yarn prisma migrate dev
yarn prisma generate
yarn test
```
