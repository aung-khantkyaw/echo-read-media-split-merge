const express = require("express");
const {
  splitAudioByDurationAndUpload,
  mergeAudios,
} = require("../utils/audioUtils");
const { v2: cloudinary } = require("cloudinary");
const fs = require("fs/promises"); 
const path = require("path");

const router = express.Router();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

module.exports = (upload) => {
  router.post("/split", upload.single("audio"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No audio file uploaded." });
      }

      console.log("🔧 Received audio file:", req.file.path);
      console.log("Saved Filename (correctly decoded):", req.file.filename);

      const durationMinutes = parseInt(req.body.duration || "60", 10);
      const durationSeconds = durationMinutes * 60;

      const chunks = await splitAudioByDurationAndUpload(
        req.file.path,
        durationSeconds,
        req.file.filename
      );
      console.log("✅ Audio split complete. Chunks:", chunks);
      res.status(200).json({ files: chunks });
    } catch (error) {
      console.error("❌ Error in /api/audio/split:", error);
      res.status(500).json({ error: error.message });
    } finally {
      try {
        if (req.file?.path) {
          await fs.unlink(req.file.path);
          console.log(`Deleted temporary file: ${req.file.path}`);
        }
      } catch (e) {
        console.warn(
          `Failed to delete original audio upload at ${req.file?.path}:`,
          e
        );
      }
    }
  });

  router.post("/merge", upload.array("audios"), async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res
          .status(400)
          .json({ error: "No audio files provided for merging." });
      }
      const merged = await mergeAudios(req.files.map((f) => f.path));

      res.download(merged, async (err) => {
        if (err) {
          console.error("Error sending merged audio file:", err);
          res.status(500).send("Error sending merged audio file");
        } else {
          try {
            await fs.unlink(merged);
            console.log(`Deleted merged audio file: ${merged}`);
          } catch (e) {
            console.warn(`Failed to delete merged audio at ${merged}:`, e);
          }
        }
      });
    } catch (err) {
      console.error("Error merging audios:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
