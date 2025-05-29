const fs = require("fs/promises");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { PDFDocument } = require("pdf-lib");
const { v2: cloudinary } = require("cloudinary");

console.log("--- Cloudinary Configuration Values (for debugging) ---");
console.log("CLOUDINARY_CLOUD_NAME:", process.env.CLOUDINARY_CLOUD_NAME);
console.log(
  "CLOUDINARY_API_KEY:",
  process.env.CLOUDINARY_API_KEY
    ? `${process.env.CLOUDINARY_API_KEY.substring(
        0,
        4
      )}...${process.env.CLOUDINARY_API_KEY.substring(
        process.env.CLOUDINARY_API_KEY.length - 4
      )}`
    : "NOT SET"
);
console.log(
  "CLOUDINARY_API_SECRET:",
  process.env.CLOUDINARY_API_SECRET
    ? `************${process.env.CLOUDINARY_API_SECRET.substring(
        process.env.CLOUDINARY_API_SECRET.length - 4
      )}`
    : "NOT SET"
);
console.log("--------------------------------------------------");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function splitPdfByPageCountAndUpload(
  pdfPath,
  pagesPerChunk,
  savedFilename
) {
  const data = await fs.readFile(pdfPath);
  const pdfDoc = await PDFDocument.load(data);
  const totalPages = pdfDoc.getPageCount();

  const uploadedUrls = [];

  const baseName = path.parse(savedFilename).name;

  for (let startPage = 0; startPage < totalPages; startPage += pagesPerChunk) {
    const newPdf = await PDFDocument.create();

    const endPage = Math.min(startPage + pagesPerChunk, totalPages);
    const copiedPages = await newPdf.copyPages(
      pdfDoc,
      Array.from({ length: endPage - startPage }, (_, i) => i + startPage)
    );
    copiedPages.forEach((page) => newPdf.addPage(page));

    const pdfBytes = await newPdf.save();

    const chunkFileName = `split_${
      startPage + 1
    }_to_${endPage}_${baseName}_${uuidv4()}.pdf`;

    const tempFilePath = path.join(path.dirname(pdfPath), chunkFileName);
    console.log(`📝 Saving temporary PDF chunk to: ${tempFilePath}`);
    await fs.writeFile(tempFilePath, pdfBytes);

    try {
      const publicIdForCloudinary = `ebooks/${baseName}_part_${
        startPage + 1
      }_${uuidv4()}.pdf`;

      console.log(
        `📤 Uploading PDF chunk: ${tempFilePath} to Cloudinary with public_id: ${publicIdForCloudinary}`
      );

      const result = await cloudinary.uploader.upload(tempFilePath, {
        resource_type: "raw",
        folder: "echo_read",
        public_id: publicIdForCloudinary,
        overwrite: true,
      });

      console.log("✅ Uploaded:", result.secure_url);

      uploadedUrls.push(publicIdForCloudinary);
    } catch (err) {
      console.error(
        `❌ Failed to upload PDF chunk ${chunkFileName}:`,
        err.message
      );
      console.error("Full Cloudinary Error Object:", err);
      throw new Error(
        `Cloudinary upload failed for ${chunkFileName}: ${err.message}`
      );
    } finally {
      try {
        await fs.unlink(tempFilePath);
        console.log("🗑️ Deleted temp file:", tempFilePath);
      } catch (e) {
        console.warn(
          `⚠️ Failed to delete temp PDF ${chunkFileName}:`,
          e.message
        );
      }
    }
  }

  return uploadedUrls;
}

async function mergePdfsFromUrls(urls) {
  const { default: PDFMerger } = await import("pdf-merger-js");
  const merger = new PDFMerger();

  const tempFiles = [];

  const uploadsDir = path.join("uploads");
  try {
    await fs.mkdir(uploadsDir, { recursive: true });
  } catch (err) {
    console.error("❌ Failed to create uploads directory:", err.message);
    throw err;
  }

  try {
    for (const url of urls) {
      try {
        const res = await fetch(url);
        if (!res.ok)
          throw new Error(`Failed to fetch ${url}: ${res.statusText}`);

        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const tempPath = path.join(uploadsDir, `temp_${uuidv4()}.pdf`);
        await fs.writeFile(tempPath, buffer);

        await merger.add(tempPath);
        tempFiles.push(tempPath);
      } catch (err) {
        console.error(`❌ Error processing ${url}:`, err.message);
      }
    }

    const outputPath = path.join(uploadsDir, `merged_${uuidv4()}.pdf`);
    await merger.save(outputPath);

    return outputPath;
  } finally {
    await Promise.all(
      tempFiles.map(async (file) => {
        try {
          await fs.unlink(file);
        } catch (e) {
          console.warn(`⚠️ Failed to delete temp file ${file}:`, e.message);
        }
      })
    );
  }
}

module.exports = { splitPdfByPageCountAndUpload, mergePdfsFromUrls };
