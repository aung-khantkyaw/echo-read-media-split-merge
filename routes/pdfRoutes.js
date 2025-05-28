const express = require("express");
const multer = require("multer");
const { splitPdfByPagesAndUpload, mergePdfsFromUrls } = require("../utils/pdfUtils");
const router = express.Router();

const upload = multer({ dest: "uploads/" });

router.post("/split", upload.single("pdf"), async (req, res) => {
  try {
    const uploadedUrls = await splitPdfByPagesAndUpload(req.file.path);
    res.json({ files: uploadedUrls });
  } catch (err) {
    console.error("PDF split & upload error:", err);
    res.status(500).json({ error: err.message });
  } finally {
    // Delete uploaded original file
    try {
      if (req.file?.path) await fs.unlink(req.file.path);
    } catch (e) {
      console.warn("Failed to delete original PDF upload:", e);
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
    res.download(mergedFilePath, (err) => {
      if (err) {
        console.error("Error sending merged file:", err);
        res.status(500).send("Error sending merged file");
      } else {
        fs.unlinkSync(mergedFilePath);
      }
    });
  } catch (err) {
    console.error("Error merging PDFs:", err.message);
    res.status(500).json({ error: "Failed to merge PDFs" });
  }
});

module.exports = router;
