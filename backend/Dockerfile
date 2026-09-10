FROM node:22-alpine

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .

# prisma.config.ts resolves DATABASE_URL at load time even for commands
# that don't touch a live database (like `generate`). The real value is
# injected by docker-compose at runtime; this build-time value only needs
# to be a well-formed connection string, not a reachable one.
ENV DATABASE_URL=postgresql://ikim:ikim@db:5432/transcription_tool
RUN yarn prisma generate
RUN yarn build

EXPOSE 4000

# Applies any pending migrations, then seeds a few demo items if the
# database is empty, so a fresh `docker compose up` lands on a queue with
# working, already-tagged examples instead of nothing. The seed script
# checks item count itself, so this is a no-op on restarts with real data.
CMD ["sh", "-c", "yarn prisma migrate deploy && node dist/scripts/seed.js; yarn start"]
