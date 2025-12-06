// AUDIO converter: MP4 → MP3

import { promisify } from "util";
import { exec } from "child_process";
import path from "path";

const execAsync = promisify(exec);

export async function convertMp4ToMp3(inputPath, outputDir, baseName) {
  const out = path.join(outputDir, `${baseName}.mp3`);
  await execAsync(
    `ffmpeg -y -i "${inputPath}" -vn -acodec libmp3lame -q:a 2 "${out}"`
  );
  return out;
}