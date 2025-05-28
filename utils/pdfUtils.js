const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { PDFDocument } = require("pdf-lib");

async function splitPdfByPages(pdfPath) {
  const data = await fs.promises.readFile(pdfPath);
  const pdfDoc = await PDFDocument.load(data);
  const totalPages = pdfDoc.getPageCount();
  const outputFiles = [];

  for (let i = 0; i < totalPages; i++) {
    const newPdf = await PDFDocument.create();
    const [page] = await newPdf.copyPages(pdfDoc, [i]);
    newPdf.addPage(page);

    const newPdfBytes = await newPdf.save();
    const fileName = `split_${uuidv4()}.pdf`;
    const filePath = path.join("uploads", fileName);
    await fs.promises.writeFile(filePath, newPdfBytes);
    outputFiles.push(filePath);
  }

  return outputFiles;
}

async function mergePdfsFromUrls(urls) {
  // Dynamically import PDFMerger (ESM-only)
  const { default: PDFMerger } = await import("pdf-merger-js");
  const merger = new PDFMerger();

  const tempFiles = [];

  try {
    for (const url of urls) {
      try {
        const res = await fetch(url);
        if (!res.ok)
          throw new Error(`Failed to fetch ${url}: ${res.statusText}`);

        // In Node.js 18+, Response.buffer() is not available; use arrayBuffer then Buffer.from
        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const tempPath = path.join("uploads", `temp_${uuidv4()}.pdf`);
        await fs.promises.writeFile(tempPath, buffer);

        await merger.add(tempPath);

        tempFiles.push(tempPath);
      } catch (err) {
        console.error(`❌ Error processing ${url}:`, err.message);
      }
    }

    const outputPath = path.join("uploads", `merged_${uuidv4()}.pdf`);
    await merger.save(outputPath);

    return outputPath;
  } finally {
    // Cleanup temp files even if error happens
    await Promise.all(
      tempFiles.map(async (file) => {
        try {
          await fs.promises.unlink(file);
        } catch (e) {
          console.warn(`⚠️ Failed to delete temp file ${file}:`, e.message);
        }
      })
    );
  }
}

module.exports = { splitPdfByPages, mergePdfsFromUrls };
