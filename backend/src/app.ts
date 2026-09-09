import express from "express";
import cors from "cors";
import { errorHandler } from "./middleware/errorHandler.js";
import { ingestRouter } from "./routes/ingest.js";
import { annotationsRouter } from "./routes/annotations.js";
import { itemsRouter } from "./routes/items.js";
import { exportRouter } from "./routes/export.js";
import { STORAGE_DIR } from "./middleware/upload.js";

export const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Serves uploaded audio files directly for the frontend's <audio> player.
// Files are stored under a UUID-prefixed name (see upload.ts). The client
// derives that name from AudioFile.path, not the original filename.
app.use("/media", express.static(STORAGE_DIR));

app.use("/api", ingestRouter);
app.use("/api", annotationsRouter);
app.use("/api", itemsRouter);
app.use("/api", exportRouter);

app.use(errorHandler);
