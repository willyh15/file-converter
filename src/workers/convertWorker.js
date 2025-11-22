// src/workers/convertWorker.js
import { Worker, Job } from "bullmq";
import { fileURLToPath } from "url";
import path from "path";
import { redisConnection } from "../queue.js";
import { pngToJpg } from "../converters/imageConverter.js";
import { mp4ToMp3 } from "../converters/audioConverter.js";
import { log } from "../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const worker = new Worker(
  "convertQueue",
  async (job /** @type {Job} */) => {
    const { tool, inputPath, outputPath } = job.data;
    log("Worker received job:", job.id, "tool:", tool);

    switch (tool) {
      case "image:png-to-jpg":
        await pngToJpg(inputPath, outputPath);
        break;
      case "audio:mp4-to-mp3":
        await mp4ToMp3(inputPath, outputPath);
        break;
      default:
        throw new Error(`Unknown tool: ${tool}`);
    }

    return { outputPath };
  },
  { connection: redisConnection }
);

worker.on("completed", (job) => {
  log("Job completed:", job.id);
});

worker.on("failed", (job, err) => {
  log("Job failed:", job?.id, err?.message);
});

log("Convert worker started from", __dirname);
