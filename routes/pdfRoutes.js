const express = require("express");
const multer = require("multer");
const { splitPdfByPages, mergePdfs } = require("../utils/pdfUtils");
const router = express.Router();

const upload = multer({ dest: "uploads/" });

router.post("/split", upload.single("pdf"), async (req, res) => {
  try {
    const files = await splitPdfByPages(req.file.path);
    res.json({ message: "PDF split successful", files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/merge", upload.array("pdfs"), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: "No files uploaded" });
  }

  try {
    const mergedFilePath = await mergePdfs(req.files.map((f) => f.path));
    res.download(mergedFilePath, (err) => {
      if (err) {
        console.error("Error sending merged file:", err);
        res.status(500).send("Error sending merged file");
      } else {
        // Optional: delete uploaded files and merged file after sending
        req.files.forEach((file) => fs.unlinkSync(file.path));
        fs.unlinkSync(mergedFilePath);
      }
    });
  } catch (err) {
    console.error("Error in merge route:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
