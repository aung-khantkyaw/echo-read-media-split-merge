const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { PDFDocument } = require("pdf-lib");
const PDFMerger = require("pdf-merger-js");
const fetch = require("node-fetch");

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
  const merger = new PDFMerger();
  merger._tempFiles = [];

  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.statusText}`);
      const buffer = await res.buffer();

      const tempPath = path.join("uploads", `temp_${uuidv4()}.pdf`);
      await fs.promises.writeFile(tempPath, buffer);

      await merger.add(tempPath);
      merger._tempFiles.push(tempPath);
    } catch (err) {
      console.error(`❌ Error processing ${url}:`, err.message);
    }
  }

  const outputPath = path.join("uploads", `merged_${uuidv4()}.pdf`);
  await merger.save(outputPath);

  for (const file of merger._tempFiles) {
    fs.unlinkSync(file);
  }

  return outputPath;
}

module.exports = { splitPdfByPages, mergePdfsFromUrls };
