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
    const durationMinutes = parseInt(req.body.duration || "60", 10);
    const durationSeconds = durationMinutes * 60; // seconds

    const chunks = await splitAudioByDuration(req.file.path, durationSeconds);
    res.status(200).json({ files: chunks });
  } catch (error) {
    console.error("Error in /api/audio/split:", error);
    res.status(500).json({ error: error.message });
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
