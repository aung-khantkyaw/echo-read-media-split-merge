const express = require("express");
const multer = require("multer");
const { splitPdfByPages, mergePdfsFromUrls } = require("../utils/pdfUtils");
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
    console.error("Error in merge route:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
