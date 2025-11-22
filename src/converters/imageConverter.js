// src/converters/imageConverter.js
import { exec } from "child_process";
import { promisify } from "util";
import { log } from "../utils/logger.js";

const execAsync = promisify(exec);

/**
 * PNG -> JPG (example)
 */
export async function pngToJpg(inputPath, outputPath) {
  // Requires ImageMagick: `convert input.png output.jpg`
  const cmd = `convert "${inputPath}" -quality 90 "${outputPath}"`;
  log("Running image command:", cmd);
  await execAsync(cmd);
  return outputPath;
}
