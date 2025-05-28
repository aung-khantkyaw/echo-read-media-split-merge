const express = require("express");
const multer = require("multer");
const { splitAudioByDuration, mergeAudios } = require("../utils/audioUtils");
const router = express.Router();

const upload = multer({ dest: "uploads/" });

router.post("/split", upload.single("audio"), async (req, res) => {
  try {
    const duration = parseInt(req.body.duration || "600"); // default: 10 min
    const files = await splitAudioByDuration(req.file.path, duration);
    res.json({ message: "Audio split successful", files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/merge", upload.array("audios"), async (req, res) => {
  try {
    const merged = await mergeAudios(req.files.map((f) => f.path));
    res.download(merged);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
