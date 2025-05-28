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
  try {
    const merged = await mergePdfs(req.files.map((f) => f.path));
    res.download(merged);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
