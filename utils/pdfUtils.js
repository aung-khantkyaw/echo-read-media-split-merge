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

async function splitPdfByPagesAndUpload(pdfPath) {
  const data = await fs.readFile(pdfPath);
  const pdfDoc = await PDFDocument.load(data);
  const totalPages = pdfDoc.getPageCount();

  const uploadedUrls = [];

  for (let i = 0; i < totalPages; i++) {
    const newPdf = await PDFDocument.create();
    const [page] = await newPdf.copyPages(pdfDoc, [i]);
    newPdf.addPage(page);

    const pdfBytes = await newPdf.save();
    const fileName = `split_${uuidv4()}.pdf`;
    const tempFilePath = path.join("uploads", fileName);
    await fs.writeFile(tempFilePath, pdfBytes);

    // Cloudinary upload (resource_type: raw for PDF)
    try {
      const result = await cloudinary.uploader.upload(tempFilePath, {
        resource_type: "raw",
        folder: "echo-read/ebooks",
        public_id: path.parse(fileName).name,
        use_filename: true,
        overwrite: true,
      });
      console.log("✅ Uploaded:", result.secure_url);

      const match = result.secure_url.match(/\/book_audio\/.+$/);

      if (match) {
        const relativePath = match[0].substring(1);
        uploadedUrls.push(relativePath);
      } else {
        uploadedUrls.push(result.secure_url);
      }
    } catch (err) {
      console.error(`Failed to upload PDF chunk ${fileName}:`, err);
      throw new Error("Cloudinary upload failed");
    } finally {
      // Temp file cleanup
      await fs.unlink(tempFilePath);
    }
  }

  return uploadedUrls; // Cloudinary URLs array
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

module.exports = { splitPdfByPagesAndUpload, mergePdfsFromUrls };
