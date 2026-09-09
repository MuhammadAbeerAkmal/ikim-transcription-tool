import express from "express";
import cors from "cors";
import { errorHandler } from "./middleware/errorHandler.js";
import { ingestRouter } from "./routes/ingest.js";
import { annotationsRouter } from "./routes/annotations.js";
import { itemsRouter } from "./routes/items.js";

export const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api", ingestRouter);
app.use("/api", annotationsRouter);
app.use("/api", itemsRouter);

app.use(errorHandler);
