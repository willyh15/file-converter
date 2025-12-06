// src/workers/convertWorker.js
import { Worker } from "bullmq";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import { log } from "../utils/logger.js";

import {
  convertPngToJpg,
  convertJpgToPng,
  convertHeicToJpg,
  compressImage,
  convertWebpToJpg,
  convertGifToWebp,
  convertPngToWebp,
  convertJpgToWebp,
} from "../converters/imageConverter.js";

import {
  compressPdf,
  pdfToJpg,
  jpgToPdf,
  mergePdf,
  splitPdf,
  deletePdfPages,
} from "../converters/pdfConverter.js";

import { convertMp4ToMp3 } from "../converters/audioConverter.js";
import { convertGifToMp4, convertMovToMp4 } from "../converters/videoConverter.js";
import { extractZipArchive } from "../converters/archiveConverter.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.join(__dirname, "..", "..");
const INPUT_DIR = path.join(ROOT_DIR, "tmp", "input");
const OUTPUT_DIR = path.join(ROOT_DIR, "tmp", "output");

const connection = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
  maxRetriesPerRequest: null,
};

function baseNameFromPath(p) {
  return path.parse(p).name;
}

// Queue name MUST match routes/convert.js
export const conversionWorker = new Worker(
  "file-conversions",
  async (job) => {
    const { tool, extraPayload } = job.data;
    log("Processing job", job.id, "tool:", tool);

    let parsedExtra = null;
    if (extraPayload) {
      try {
        parsedExtra = JSON.parse(extraPayload);
      } catch {
        parsedExtra = extraPayload;
      }
    }

    const inputFilename = job.data.inputFilename || null;
    const inputPath = inputFilename ? path.join(INPUT_DIR, inputFilename) : null;

    const inputFilenames = job.data.inputFilenames || [];
    const inputPathsMulti = inputFilenames.map((f) =>
      path.join(INPUT_DIR, f)
    );

    let outputPath;

    switch (tool) {
      // ======================
      // IMAGE TOOLS
      // ======================
      case "image:png-to-jpg": {
        const baseName = baseNameFromPath(inputPath);
        outputPath = await convertPngToJpg(inputPath, OUTPUT_DIR, baseName);
        break;
      }
      case "image:jpg-to-png": {
        const baseName = baseNameFromPath(inputPath);
        outputPath = await convertJpgToPng(inputPath, OUTPUT_DIR, baseName);
        break;
      }
      case "image:heic-to-jpg": {
        const baseName = baseNameFromPath(inputPath);
        outputPath = await convertHeicToJpg(inputPath, OUTPUT_DIR, baseName);
        break;
      }
      case "image:compress-image": {
        const baseName = baseNameFromPath(inputPath);
        outputPath = await compressImage(inputPath, OUTPUT_DIR, baseName);
        break;
      }
      case "image:webp-to-jpg": {
        const baseName = baseNameFromPath(inputPath);
        outputPath = await convertWebpToJpg(inputPath, OUTPUT_DIR, baseName);
        break;
      }
      case "image:gif-to-webp": {
        const baseName = baseNameFromPath(inputPath);
        outputPath = await convertGifToWebp(inputPath, OUTPUT_DIR, baseName);
        break;
      }
      case "image:png-to-webp": {
        const baseName = baseNameFromPath(inputPath);
        outputPath = await convertPngToWebp(inputPath, OUTPUT_DIR, baseName);
        break;
      }
      case "image:jpg-to-webp": {
        const baseName = baseNameFromPath(inputPath);
        outputPath = await convertJpgToWebp(inputPath, OUTPUT_DIR, baseName);
        break;
      }
      // NEW: WEBP → PNG (direct via ImageMagick)
      case "image:webp-to-png": {
        const baseName = baseNameFromPath(inputPath);
        const out = path.join(OUTPUT_DIR, `${baseName}.png`);
        const { exec } = await import("child_process");
        const { promisify } = await import("util");
        const execAsync = promisify(exec);
        await execAsync(`convert "${inputPath}" -strip "${out}"`);
        outputPath = out;
        break;
      }

      // ======================
      // PDF TOOLS
      // ======================
      case "pdf:compress-pdf": {
        const baseName = baseNameFromPath(inputPath);
        outputPath = path.join(OUTPUT_DIR, `${baseName}-compressed.pdf`);
        await compressPdf(inputPath, outputPath);
        break;
      }
      case "pdf:pdf-to-jpg": {
        const baseName = baseNameFromPath(inputPath);
        outputPath = path.join(OUTPUT_DIR, `${baseName}.jpg`);
        await pdfToJpg(inputPath, outputPath);
        break;
      }
      case "pdf:jpg-to-pdf": {
        const jpgPaths = inputPathsMulti.length ? inputPathsMulti : [inputPath];
        const outName = `jpg-to-pdf-${uuidv4()}.pdf`;
        outputPath = path.join(OUTPUT_DIR, outName);
        const inputsJoined = jpgPaths.map((p) => `"${p}"`).join(" ");
        const cmd = `convert ${inputsJoined} -auto-orient -strip "${outputPath}"`;
        log("Running multi JPG->PDF command:", cmd);
        const { exec } = await import("child_process");
        const { promisify } = await import("util");
        const execAsync = promisify(exec);
        await execAsync(cmd);
        break;
      }
      // NEW: PNG → PDF (supports single or multi-file)
      case "pdf:png-to-pdf": {
        const pngPaths = inputPathsMulti.length ? inputPathsMulti : [inputPath];
        const outName = `png-to-pdf-${uuidv4()}.pdf`;
        outputPath = path.join(OUTPUT_DIR, outName);
        const inputsJoined = pngPaths.map((p) => `"${p}"`).join(" ");
        const cmd = `convert ${inputsJoined} -auto-orient -strip "${outputPath}"`;
        log("Running multi PNG->PDF command:", cmd);
        const { exec } = await import("child_process");
        const { promisify } = await import("util");
        const execAsync = promisify(exec);
        await execAsync(cmd);
        break;
      }
      case "pdf:merge-pdf": {
        const pdfPaths = inputPathsMulti.length ? inputPathsMulti : [inputPath];
        const outName = `merged-${uuidv4()}.pdf`;
        outputPath = path.join(OUTPUT_DIR, outName);
        await mergePdf(pdfPaths, outputPath);
        break;
      }
      case "pdf:split-pdf": {
        outputPath = await splitPdf(inputPath, OUTPUT_DIR);
        break;
      }
      case "pdf:delete-pages": {
        let pagesToDeleteSpec = null;
        if (parsedExtra && typeof parsedExtra === "object" && parsedExtra.pagesToDelete) {
          pagesToDeleteSpec = String(parsedExtra.pagesToDelete).trim();
        } else if (typeof parsedExtra === "string") {
          pagesToDeleteSpec = parsedExtra.trim();
        }
        if (!pagesToDeleteSpec) {
          throw new Error("Missing pagesToDelete for pdf:delete-pages");
        }
        outputPath = await deletePdfPages(inputPath, OUTPUT_DIR, pagesToDeleteSpec);
        break;
      }

      // ======================
      // AUDIO
      // ======================
      case "audio:mp4-to-mp3": {
        const baseName = baseNameFromPath(inputPath);
        outputPath = await convertMp4ToMp3(inputPath, OUTPUT_DIR, baseName);
        break;
      }

      // ======================
      // VIDEO
      // ======================
      case "video:gif-to-mp4": {
        const baseName = baseNameFromPath(inputPath);
        outputPath = await convertGifToMp4(inputPath, OUTPUT_DIR, baseName);
        break;
      }
      case "video:mov-to-mp4": {
        const baseName = baseNameFromPath(inputPath);
        outputPath = await convertMovToMp4(inputPath, OUTPUT_DIR, baseName);
        break;
      }

      // ======================
      // ARCHIVE
      // ======================
      case "archive:zip-extract": {
        const baseName = baseNameFromPath(inputPath);
        outputPath = await extractZipArchive(inputPath, OUTPUT_DIR, baseName);
        break;
      }

      default:
        throw new Error(`Unknown tool in worker: ${tool}`);
    }

    if (!outputPath || !fs.existsSync(outputPath)) {
      throw new Error("Output file not created");
    }

    const outputFilename = path.basename(outputPath);
    log("Job", job.id, "completed with output:", outputFilename);
    return { outputFilename };
  },
  { connection }
);

conversionWorker.on("failed", (job, err) => {
  log("Job failed", job?.id, err);
});