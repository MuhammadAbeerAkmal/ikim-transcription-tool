import multer from "multer";
import path from "node:path";
import crypto from "node:crypto";
import fs from "node:fs";

const STORAGE_DIR = path.join(process.cwd(), "storage", "audio");
fs.mkdirSync(STORAGE_DIR, { recursive: true });

const ALLOWED_EXTENSIONS = new Set([".wav", ".mp3", ".m4a"]);

const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100MB

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, STORAGE_DIR),
  filename: (_req, file, cb) => {
    cb(null, `${crypto.randomUUID()}-${file.originalname}`);
  },
});

function fileFilter(
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) {
  const ext = path.extname(file.originalname).toLowerCase();

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    cb(new Error(`Unsupported file type: ${file.originalname} (${ext})`));
    return;
  }
  cb(null, true);
}

export const uploadAudio = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
});
