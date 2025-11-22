// src/converters/audioConverter.js
import { exec } from "child_process";
import { promisify } from "util";
import { log } from "../utils/logger.js";

const execAsync = promisify(exec);

/**
 * MP4 -> MP3 (example)
 */
export async function mp4ToMp3(inputPath, outputPath) {
  // Requires ffmpeg
  const cmd = `ffmpeg -y -i "${inputPath}" -vn -acodec libmp3lame -q:a 2 "${outputPath}"`;
  log("Running audio command:", cmd);
  await execAsync(cmd);
  return outputPath;
}
