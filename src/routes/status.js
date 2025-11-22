// src/routes/status.js
import express from "express";
import fs from "fs";
import { convertQueue } from "../queue.js";
import { log } from "../utils/logger.js";

const router = express.Router();

router.get("/:id", async (req, res) => {
  try {
    const jobId = req.params.id;
    const job = await convertQueue.getJob(jobId);
    if (!job) {
      return res.status(404).json({ status: "not_found" });
    }

    const state = await job.getState();
    const result = job.returnvalue || job.data;

    let downloadUrl = null;

    if (state === "completed" && result?.outputPath && fs.existsSync(result.outputPath)) {
      const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
      const fileName = result.outputPath.split("/").pop();
      downloadUrl = `${baseUrl}/download/${encodeURIComponent(fileName)}`;
    }

    return res.json({
      status: state,
      downloadUrl,
    });
  } catch (err) {
    log("Error in /api/status:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
