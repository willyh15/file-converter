// src/converters/imageConverter.js
import { promisify } from "util";
import { exec } from "child_process";
import path from "path";

const execAsync = promisify(exec);

// All image conversions use ImageMagick `convert` where possible.

export async function convertPngToJpg(inputPath, outputDir, baseName) {
  const out = path.join(outputDir, `${baseName}.jpg`);
  await execAsync(`convert "${inputPath}" -strip -quality 85 "${out}"`);
  return out;
}

export async function convertJpgToPng(inputPath, outputDir, baseName) {
  const out = path.join(outputDir, `${baseName}.png`);
  await execAsync(`convert "${inputPath}" -strip "${out}"`);
  return out;
}

export async function convertHeicToJpg(inputPath, outputDir, baseName) {
  const out = path.join(outputDir, `${baseName}.jpg`);
  // using ImageMagick (with HEIC delegates) or `heif-convert` fallback
  try {
    await execAsync(`convert "${inputPath}" -strip -quality 90 "${out}"`);
  } catch {
    await execAsync(`heif-convert "${inputPath}" "${out}"`);
  }
  return out;
}

export async function compressImage(inputPath, outputDir, baseName) {
  const outExt = path.extname(inputPath).toLowerCase() === ".png" ? "png" : "jpg";
  const out = path.join(outputDir, `${baseName}-compressed.${outExt}`);
  if (outExt === "png") {
    await execAsync(
      `convert "${inputPath}" -strip -define png:compression-level=9 "${out}"`
    );
  } else {
    await execAsync(`convert "${inputPath}" -strip -quality 75 "${out}"`);
  }
  return out;
}

export async function convertWebpToJpg(inputPath, outputDir, baseName) {
  const out = path.join(outputDir, `${baseName}.jpg`);
  await execAsync(`convert "${inputPath}" -strip -quality 85 "${out}"`);
  return out;
}

export async function convertGifToWebp(inputPath, outputDir, baseName) {
  const out = path.join(outputDir, `${baseName}.webp`);
  // Animated GIF -> animated WEBP
  await execAsync(
    `convert "${inputPath}" -coalesce -loop 0 -quality 80 "${out}"`
  );
  return out;
}

// PNG -> WEBP
export async function convertPngToWebp(inputPath, outputDir, baseName) {
  const out = path.join(outputDir, `${baseName}.webp`);
  await execAsync(`convert "${inputPath}" -strip -quality 80 "${out}"`);
  return out;
}

// JPG -> WEBP
export async function convertJpgToWebp(inputPath, outputDir, baseName) {
  const out = path.join(outputDir, `${baseName}.webp`);
  await execAsync(`convert "${inputPath}" -strip -quality 80 "${out}"`);
  return out;
}

// NEW: WEBP -> PNG
export async function convertWebpToPng(inputPath, outputDir, baseName) {
  const out = path.join(outputDir, `${baseName}.png`);
  await execAsync(`convert "${inputPath}" -strip "${out}"`);
  return out;
}