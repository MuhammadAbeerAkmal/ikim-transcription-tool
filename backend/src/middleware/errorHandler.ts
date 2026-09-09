import type { ErrorRequestHandler } from "express";
import { MulterError } from "multer";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { ClientError } from "../lib/errors.js";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ClientError) {
    res.status(400).json({ error: err.message });
    return;
  }

  // P2025 is Prisma's "record not found" error, thrown by findUniqueOrThrow
  // and by update/delete when the given id doesn't exist. That's a client
  // mistake (404), not a server failure (500).
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2025"
  ) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: "Validation failed",
      details: err.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    });
    return;
  }

  if (err instanceof MulterError) {
    res.status(400).json({ error: `Upload error: ${err.message}` });
    return;
  }

  if (err instanceof Error && err.message.startsWith("Unsupported file type")) {
    res.status(400).json({ error: err.message });
    return;
  }

  console.error(err);
  res.status(500).json({ error: "Internal server error" });
};
