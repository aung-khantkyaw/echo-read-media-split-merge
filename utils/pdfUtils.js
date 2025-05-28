const fs = require("fs");
const path = require("path");
const { PDFDocument } = require("pdf-lib");
const { v4: uuidv4 } = require("uuid");

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
    fs.writeFileSync(filePath, newPdfBytes);
    outputFiles.push(filePath);
  }

  return outputFiles;
}

async function mergePdfs(paths) {
  const mergedPdf = await PDFDocument.create();

  for (const p of paths) {
    const bytes = await fs.promises.readFile(p);
    const doc = await PDFDocument.load(bytes);
    const pages = await mergedPdf.copyPages(doc, doc.getPageIndices());
    pages.forEach((p) => mergedPdf.addPage(p));
  }

  const finalPdf = await mergedPdf.save();
  const mergedPath = path.join("uploads", `merged_${uuidv4()}.pdf`);
  fs.writeFileSync(mergedPath, finalPdf);
  return mergedPath;
}

module.exports = { splitPdfByPages, mergePdfs };
