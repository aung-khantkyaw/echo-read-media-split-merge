const express = require("express");
const fs = require("fs").promises; // Use fs.promises for async operations
const {
  splitPdfByPageCountAndUpload,
  mergePdfsFromUrls,
} = require("../utils/pdfUtils");

const router = express.Router();

module.exports = (upload) => {
  // Accept 'upload' as an argument
  router.post("/split", upload.single("pdf"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No PDF file uploaded." });
      }

      const pagesPerChunk = parseInt(req.body.pages_per_chunk) || 10;
      // Pass the *saved* filename to your utility function if needed,
      // or use originalname for logging purposes (it might still be corrupted for logging)
      console.log("Received PDF file:", req.file.filename); // This is the correctly saved filename

      const uploadedUrls = await splitPdfByPageCountAndUpload(
        req.file.path,
        pagesPerChunk,
        req.file.filename // Pass the filename saved by Multer
      );
      console.log("✅ PDF split & upload completed:", uploadedUrls);
      res.json({ files: uploadedUrls });
    } catch (err) {
      console.error("PDF split & upload error:", err);
      res.status(500).json({ error: err.message });
    } finally {
      // Ensure the temporary uploaded file is deleted
      try {
        if (req.file?.path) {
          await fs.unlink(req.file.path);
          console.log(`Deleted temporary file: ${req.file.path}`);
        }
      } catch (e) {
        console.warn(
          `Failed to delete original PDF upload at ${req.file?.path}:`,
          e
        );
      }
    }
  });

  router.post("/merge", async (req, res) => {
    const { urls } = req.body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ error: "No URLs provided" });
    }

    try {
      const mergedFilePath = await mergePdfsFromUrls(urls);
      // Ensure the merged file is deleted after download
      res.download(mergedFilePath, async (err) => {
        // Use async callback here
        if (err) {
          console.error("Error sending merged file:", err);
          res.status(500).send("Error sending merged file");
        } else {
          try {
            await fs.unlink(mergedFilePath); // Use await for fs.unlink
            console.log(`Deleted merged file: ${mergedFilePath}`);
          } catch (e) {
            console.warn(
              `Failed to delete merged PDF at ${mergedFilePath}:`,
              e
            );
          }
        }
      });
    } catch (err) {
      console.error("Error merging PDFs:", err.message);
      res.status(500).json({ error: "Failed to merge PDFs" });
    }
  });

  return router;
};
