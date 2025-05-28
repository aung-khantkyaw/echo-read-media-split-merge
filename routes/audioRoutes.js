const express = require("express");
const multer = require("multer");
const { splitAudioByDuration } = require("../utils/audioUtils");
const { v2: cloudinary } = require("cloudinary");
const fs = require("fs/promises");
const path = require("path");

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

router.post("/split", upload.single("audio"), async (req, res) => {
  try {
    const duration = parseInt(req.body.duration || "600");
    const files = await splitAudioByDuration(req.file.path, duration);
    res.json({ message: "Audio split and uploaded", files });
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
