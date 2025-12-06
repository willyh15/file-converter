import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";
import convertRouter from "./routes/convert.js";
import { ensureStorageDirs } from "./utils/fileStorage.js";
import { log } from "./utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

// Ensure tmp/input and tmp/output exist
ensureStorageDirs();

app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

// Static frontend
app.use(express.static(path.join(__dirname, "..", "public")));

// API under /api/*
app.use("/api", convertRouter);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  log(`Server listening on port ${PORT}`);
});