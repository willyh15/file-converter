// src/routes/convert.js
import express from "express";
import multer from "multer";
import path from "path";
import { convertQueue } from "../queue.js";
import { generateFileName, getInputPath, getOutputPath } from "../utils/fileStorage.js";
import { log } from "../utils/logger.js";

const router = express.Router();

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || "104857600", 10); // 100MB

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, getInputPath("")); // directory path only
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = generateFileName(ext);
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
});

router.post("/", upload.single("file"), async (req, res) => {
  try {
    const { tool } = req.body;
    if (!tool) {
      return res.status(400).json({ error: "Missing tool parameter" });
    }
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const inputPath = req.file.path;
    let outputExt;

    switch (tool) {
      case "image:png-to-jpg":
        outputExt = ".jpg";
        break;
      case "audio:mp4-to-mp3":
        outputExt = ".mp3";
        break;
      default:
        return res.status(400).json({ error: "Unknown tool" });
    }

    const outputFileName = generateFileName(outputExt);
    const outputPath = getOutputPath(outputFileName);

    const job = await convertQueue.add("convert", {
      tool,
      inputPath,
      outputPath,
    });

    log("Queued job", job.id, "tool:", tool);

    return res.json({
      jobId: job.id,
    });
  } catch (err) {
    log("Error in /api/convert:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
