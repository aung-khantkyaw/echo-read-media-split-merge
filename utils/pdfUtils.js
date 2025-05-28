const fs = require("fs/promises");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { PDFDocument } = require("pdf-lib");
const { v2: cloudinary } = require("cloudinary");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function splitPdfByPageCountAndUpload(
  pdfPath,
  pagesPerChunk,
  originalName
) {
  const data = await fs.readFile(pdfPath);
  const pdfDoc = await PDFDocument.load(data);
  const totalPages = pdfDoc.getPageCount();

  const uploadedUrls = [];

  const baseName = path.parse(originalName).name;

  for (let startPage = 0; startPage < totalPages; startPage += pagesPerChunk) {
    const newPdf = await PDFDocument.create();

    const endPage = Math.min(startPage + pagesPerChunk, totalPages);
    const copiedPages = await newPdf.copyPages(
      pdfDoc,
      Array.from({ length: endPage - startPage }, (_, i) => i + startPage)
    );
    copiedPages.forEach((page) => newPdf.addPage(page));

    const pdfBytes = await newPdf.save();

    const fileName = `split_${startPage + 1}_to_${endPage}_${baseName}.pdf`;
    const tempFilePath = path.join("uploads", fileName);
    await fs.writeFile(tempFilePath, pdfBytes);

    try {
      const result = await cloudinary.uploader.upload(tempFilePath, {
        resource_type: "raw",
        folder: "echo_read/ebooks",
        public_id: path.parse(fileName).name,
        use_filename: true,
        overwrite: true,
      });

      console.log("✅ Uploaded:", result.secure_url);

      const match = result.secure_url.match(/\/ebooks\/.+$/);
      if (match) {
        const relativePath = match[0].substring(1);
        uploadedUrls.push(relativePath);
      } else {
        uploadedUrls.push(result.secure_url);
      }
    } catch (err) {
      console.error(`❌ Failed to upload PDF chunk ${fileName}:`, err.message);
      throw new Error(`Cloudinary upload failed for ${fileName}`);
    } finally {
      try {
        await fs.unlink(tempFilePath);
        console.log("🗑️ Deleted temp file:", tempFilePath);
      } catch (e) {
        console.warn(`⚠️ Failed to delete temp PDF ${fileName}:`, e.message);
      }
    }
  }

  return uploadedUrls;
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

module.exports = { splitPdfByPageCountAndUpload, mergePdfsFromUrls };
