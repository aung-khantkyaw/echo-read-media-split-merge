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

async function mergePdfsFromUrls(urls) {
  const mergedPdf = await PDFDocument.create();

  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch: ${res.statusText}`);
      const bytes = await res.arrayBuffer();
      const doc = await PDFDocument.load(bytes);
      const pages = await mergedPdf.copyPages(doc, doc.getPageIndices());
      pages.forEach((page) => mergedPdf.addPage(page));
    } catch (err) {
      console.error(`❌ Error reading or merging file ${url}:`, err.message);
      // Skip file
    }
  }

  const finalPdf = await mergedPdf.save();
  const mergedPath = path.join("uploads", `merged_${uuidv4()}.pdf`);
  await fs.promises.writeFile(mergedPath, finalPdf);
  return mergedPath;
}

module.exports = { splitPdfByPages, mergePdfsFromUrls };
