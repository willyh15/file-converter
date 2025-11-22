// src/server.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";
import convertRoute from "./routes/convert.js";
import statusRoute from "./routes/status.js";
import { ensureStorageDirs, getOutputPath } from "./utils/fileStorage.js";
import fs from "fs";
import { log } from "./utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

ensureStorageDirs();

app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

// Static frontend
app.use(express.static(path.join(__dirname, "..", "public")));

// API routes
app.use("/api/convert", convertRoute);
app.use("/api/status", statusRoute);

// Download route
app.get("/download/:file", (req, res) => {
  try {
    const { file } = req.params;
    const outputPath = getOutputPath(file);
    if (!fs.existsSync(outputPath)) {
      return res.status(404).send("File not found");
    }
    res.download(outputPath);
  } catch (err) {
    log("Error in /download:", err.message);
    res.status(500).send("Internal server error");
  }
});

// Health
app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  log(`Server listening on port ${PORT}`);
});
