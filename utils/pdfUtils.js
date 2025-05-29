const fs = require("fs/promises");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { PDFDocument } = require("pdf-lib");
const { v2: cloudinary } = require("cloudinary");

// --- IMPORTANT DEBUGGING: LOG THE ACTUAL VALUES ---
// This is critical for confirming what Cloudinary SDK receives.
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
); // Mask most of the secret
console.log("--------------------------------------------------");

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function splitPdfByPageCountAndUpload(
  pdfPath,
  pagesPerChunk,
  savedFilename // This is Multer's saved filename (e.g., "ခင်ခင်ထူး_မင်္ဂလာလှည်း_1748494512510-467277255.mp3")
) {
  const data = await fs.readFile(pdfPath);
  const pdfDoc = await PDFDocument.load(data);
  const totalPages = pdfDoc.getPageCount();

  const uploadedUrls = [];

  // Use the savedFilename's base name for consistency
  const baseName = path.parse(savedFilename).name; // e.g., "ခင်ခင်ထူး_မင်္ဂလာလှည်း_1748494512510-467277255"

  for (let startPage = 0; startPage < totalPages; startPage += pagesPerChunk) {
    const newPdf = await PDFDocument.create();

    const endPage = Math.min(startPage + pagesPerChunk, totalPages);
    const copiedPages = await newPdf.copyPages(
      pdfDoc,
      Array.from({ length: endPage - startPage }, (_, i) => i + startPage)
    );
    copiedPages.forEach((page) => newPdf.addPage(page));

    const pdfBytes = await newPdf.save();

    // Create a unique temporary filename for the chunk
    // Ensure safe naming for temporary files, especially with unicode base names
    const chunkFileName = `split_${
      startPage + 1
    }_to_${endPage}_${baseName}_${uuidv4()}.pdf`;

    // Path to save the temporary chunk. This should be in your uploads directory.
    const tempFilePath = path.join(path.dirname(pdfPath), chunkFileName);
    console.log(`📝 Saving temporary PDF chunk to: ${tempFilePath}`);
    await fs.writeFile(tempFilePath, pdfBytes);

    try {
      // Use a more robust public_id that avoids potential issues with long or unicode paths
      // For now, let's stick to an ASCII-only public_id for testing
      const publicIdForCloudinary = `ebooks/${baseName}_part_${
        startPage + 1
      }_${uuidv4()}`;
      // OR, if you just want a simple test public_id:
      // const publicIdForCloudinary = `ebooks/split_pdf_chunk_${uuidv4()}`;

      console.log(
        `📤 Uploading PDF chunk: ${tempFilePath} to Cloudinary with public_id: ${publicIdForCloudinary}`
      );

      const result = await cloudinary.uploader.upload(tempFilePath, {
        resource_type: "raw", // PDF is typically 'raw'
        folder: "echo_read/ebooks",
        public_id: publicIdForCloudinary,
        // use_filename: true, // `public_id` overrides this, so it's less relevant when public_id is set
        overwrite: true, // Overwrite if a public_id collision occurs
      });

      console.log("✅ Uploaded:", result.secure_url);

      // Extract relative path or push full URL
      const match = result.secure_url.match(/\/ebooks\/.+$/);
      if (match) {
        uploadedUrls.push(match[0].substring(1)); // Store "ebooks/..."
      } else {
        uploadedUrls.push(result.secure_url); // Fallback to full URL
      }
    } catch (err) {
      console.error(
        `❌ Failed to upload PDF chunk ${chunkFileName}:`,
        err.message
      );
      // Log the full error object for more details
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

// mergePdfsFromUrls function remains unchanged (it uses URLs, not filenames directly)
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

        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Ensure temp path is always in a safe, known location
        const tempPath = path.join("uploads", `temp_${uuidv4()}.pdf`); // Changed from original
        await fs.writeFile(tempPath, buffer);

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
