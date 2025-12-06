// src/converters/pdfConverter.js
import { exec } from "child_process";
import { promisify } from "util";
import { log } from "../utils/logger.js";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const execAsync = promisify(exec);

/**
 * Compress PDF using Ghostscript
 */
export async function compressPdf(inputPath, outputPath) {
  const cmd = `gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/ebook -dNOPAUSE -dQUIET -dBATCH -sOutputFile="${outputPath}" "${inputPath}"`;
  log("Running PDF compress command:", cmd);
  await execAsync(cmd);
  return outputPath;
}

/**
 * PDF -> JPG (first page only)
 */
export async function pdfToJpg(inputPath, outputPath) {
  // -density 150 for decent quality, [0] = first page
  const cmd = `convert -density 150 "${inputPath}[0]" -quality 90 "${outputPath}"`;
  log("Running PDF->JPG command:", cmd);
  await execAsync(cmd);
  return outputPath;
}

/**
 * JPG -> PDF (single image -> single-page PDF)
 */
export async function jpgToPdf(inputPath, outputPath) {
  const cmd = `convert "${inputPath}" -auto-orient -strip "${outputPath}"`;
  log("Running JPG->PDF command:", cmd);
  await execAsync(cmd);
  return outputPath;
}

/**
 * NEW: PNG -> PDF (single image -> single-page PDF)
 * Multi-file PNG → PDF is handled in the worker using a multi-input `convert` command.
 */
export async function pngToPdf(inputPath, outputPath) {
  const cmd = `convert "${inputPath}" -auto-orient -strip "${outputPath}"`;
  log("Running PNG->PDF command:", cmd);
  await execAsync(cmd);
  return outputPath;
}

/**
 * Merge multiple PDFs into one
 * Tries pdfunite first, falls back to Ghostscript if needed.
 */
export async function mergePdf(inputPaths, outputPath) {
  const inputsJoined = inputPaths.map((p) => `"${p}"`).join(" ");

  // Try pdfunite
  try {
    const cmdUnite = `pdfunite ${inputsJoined} "${outputPath}"`;
    log("Running PDF merge command (pdfunite):", cmdUnite);
    await execAsync(cmdUnite);
    return outputPath;
  } catch (err) {
    log("pdfunite failed, falling back to Ghostscript:", err?.message || err);
  }

  // Fallback: Ghostscript merge
  const cmdGs = `gs -dBATCH -dNOPAUSE -q -sDEVICE=pdfwrite -sOutputFile="${outputPath}" ${inputsJoined}`;
  log("Running PDF merge command (Ghostscript):", cmdGs);
  await execAsync(cmdGs);
  return outputPath;
}

/**
 * Split a single PDF into per-page PDFs and bundle them into a ZIP.
 *
 * Returns: absolute path to the ZIP file in outputDir.
 */
export async function splitPdf(inputPath, outputDir) {
  const baseName = path.parse(inputPath).name;
  const tempFolderName = `${baseName}-pages-${uuidv4()}`;
  const splitDir = path.join(outputDir, tempFolderName);

  fs.mkdirSync(splitDir, { recursive: true });

  // 1) Try pdfseparate (Poppler)
  try {
    const pattern = path.join(splitDir, `${baseName}-%03d.pdf`);
    const cmdSeparate = `pdfseparate "${inputPath}" "${pattern}"`;
    log("Running PDF split command (pdfseparate):", cmdSeparate);
    await execAsync(cmdSeparate);
  } catch (err) {
    log("pdfseparate failed, trying Ghostscript fallback:", err?.message || err);

    // 2) Fallback: Ghostscript per-page using pdfinfo to get page count
    try {
      const infoCmd = `pdfinfo "${inputPath}"`;
      log("Running pdfinfo for split fallback:", infoCmd);
      const { stdout } = await execAsync(infoCmd);

      const match = stdout.match(/Pages:\s+(\d+)/i);
      const pages = match ? parseInt(match[1], 10) : 0;
      if (!pages || Number.isNaN(pages)) {
        throw new Error("Unable to detect page count for PDF split");
      }

      for (let i = 1; i <= pages; i++) {
        const outPath = path.join(
          splitDir,
          `${baseName}-${String(i).padStart(3, "0")}.pdf`
        );
        const cmdGs = `gs -dBATCH -dNOPAUSE -q -sDEVICE=pdfwrite -dFirstPage=${i} -dLastPage=${i} -sOutputFile="${outPath}" "${inputPath}"`;
        log("Running PDF split command (Ghostscript, page " + i + "):", cmdGs);
        await execAsync(cmdGs);
      }
    } catch (fallbackErr) {
      log(
        "Ghostscript split fallback failed:",
        fallbackErr?.message || fallbackErr
      );
      throw fallbackErr;
    }
  }

  // 3) Zip all the per-page PDFs into a single archive
  const zipName = `${baseName}-pages-${uuidv4()}.zip`;
  const zipPath = path.join(outputDir, zipName);

  // Create ZIP from within the splitDir so we only include the page files
  const cmdZip = `cd "${splitDir}" && zip -r "${zipPath}" .`;
  log("Zipping split PDF pages:", cmdZip);
  await execAsync(cmdZip);

  return zipPath;
}

/**
 * Delete selected PDF pages and return a new single output PDF.
 */
export async function deletePdfPages(inputPath, outputDir, removeSpec) {
  const baseName = path.parse(inputPath).name;
  const tempFolderName = `${baseName}-keep-${uuidv4()}`;
  const splitDir = path.join(outputDir, tempFolderName);

  fs.mkdirSync(splitDir, { recursive: true });

  log("Parsing removeSpec:", removeSpec);

  // Convert: "1,3,7-10" => Set of numbers
  const removeSet = new Set();
  const parts = (removeSpec || "").split(",");
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (trimmed.includes("-")) {
      const [start, end] = trimmed.split("-").map(x => parseInt(x, 10));
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = start; i <= end; i++) removeSet.add(i);
      }
    } else {
      const n = parseInt(trimmed, 10);
      if (!isNaN(n)) removeSet.add(n);
    }
  }

  // Step 1: get page count
  let pages = 0;
  try {
    const infoCmd = `pdfinfo "${inputPath}"`;
    const { stdout } = await execAsync(infoCmd);
    const match = stdout.match(/Pages:\s+(\d+)/i);
    pages = match ? parseInt(match[1], 10) : 0;
  } catch (err) {
    log("pdfinfo failed:", err?.message || err);
  }
  if (!pages) throw new Error("Unable to detect pages for delete operation");

  log("Total pages:", pages);

  // fast path using pdfseparate + pdfunite
  try {
    // split all pages
    const pattern = path.join(splitDir, `${baseName}-%03d.pdf`);
    const cmdSeparate = `pdfseparate "${inputPath}" "${pattern}"`;
    log("Running pdfseparate:", cmdSeparate);
    await execAsync(cmdSeparate);

    // collect kept pages
    const keepPaths = [];
    for (let i = 1; i <= pages; i++) {
      if (removeSet.has(i)) continue;
      const num = String(i).padStart(3,"0");
      keepPaths.push(path.join(splitDir, `${baseName}-${num}.pdf`));
    }

    if (!keepPaths.length) throw new Error("No pages left after deletion");

    const outName = `${baseName}-deleted-${uuidv4()}.pdf`;
    const outPath = path.join(outputDir, outName);

    const inputsJoined = keepPaths.map(p => `"${p}"`).join(" ");
    const cmdUnite = `pdfunite ${inputsJoined} "${outPath}"`;
    log("Running pdfunite for delete:", cmdUnite);
    await execAsync(cmdUnite);

    return outPath;
  } catch (err) {
    log("Poppler path failed, using Ghostscript fallback:", err?.message || err);
  }

  // fallback: ghostscript page by page rebuild
  const keepList = [];
  for (let i = 1; i <= pages; i++) {
    if (!removeSet.has(i)) keepList.push(i);
  }
  if (!keepList.length) throw new Error("No pages left after deletion");

  const outName = `${baseName}-deleted-${uuidv4()}.pdf`;
  const outPath = path.join(outputDir, outName);

  // build single merged file via multiple gs calls
  // first create a temp list of single page PDFs
  const tempParts = [];
  for (const pageNum of keepList) {
    const num = String(pageNum).padStart(3,"0");
    const tempOut = path.join(splitDir, `${baseName}-${num}.pdf`);
    const cmdGs = `gs -dBATCH -dNOPAUSE -q -sDEVICE=pdfwrite -dFirstPage=${pageNum} -dLastPage=${pageNum} -sOutputFile="${tempOut}" "${inputPath}"`;
    log("Split single via GS:", cmdGs);
    await execAsync(cmdGs);
    tempParts.push(tempOut);
  }

  // merge all parts
  const merged = tempParts.map(p => `"${p}"`).join(" ");
  const cmdMerge = `gs -dBATCH -dNOPAUSE -q -sDEVICE=pdfwrite -sOutputFile="${outPath}" ${merged}`;
  log("Merging kept pages via GS:", cmdMerge);
  await execAsync(cmdMerge);

  return outPath;
}