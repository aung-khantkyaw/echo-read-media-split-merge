const fs = require("fs");
const fsPromises = require("fs/promises");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const { v4: uuidv4 } = require("uuid");
const { v2: cloudinary } = require("cloudinary");

// --- IMPORTANT DEBUGGING: LOG THE ACTUAL VALUES (masked for security) ---
// This is crucial for confirming what Cloudinary SDK receives.
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

// Function to split audio file into chunks using FFmpeg
function splitWithFFmpeg(inputPath, duration, savedFilename) {
  return new Promise((resolve, reject) => {
    try {
      const resolvedInputPath = path.resolve(inputPath);
      const outputDir = path.dirname(resolvedInputPath);

      // Use the savedFilename for generating baseName for chunks
      // Normalizing ensures consistent Unicode representation
      const baseName = path
        .basename(savedFilename, path.extname(savedFilename))
        .normalize("NFC");

      const outputPattern = path.join(outputDir, `${baseName}_%03d.mp3`);

      console.log("Splitting audio using FFmpeg...");
      console.log("Input path:", resolvedInputPath);
      console.log("Output pattern:", outputPattern);
      console.log("Segment duration (sec):", duration);

      ffmpeg(resolvedInputPath)
        .outputOptions([
          "-f",
          "segment",
          "-segment_time",
          duration.toString(),
          "-reset_timestamps",
          "1",
          "-force_key_frames",
          `expr:gte(t,n_forced*${duration})`,
        ])
        .audioCodec("libmp3lame")
        .output(outputPattern)
        .on("start", (cmdLine) => {
          console.log("FFmpeg command:", cmdLine);
        })
        .on("stderr", (stderrLine) => {
          console.error("FFmpeg STDERR:", stderrLine);
        })
        .on("error", (err, stdout, stderr) => {
          console.error("FFmpeg ERROR:", err.message);
          console.error("FFmpeg STDERR:", stderr);
          reject(new Error(`FFmpeg failed: ${err.message}`));
        })
        .on("end", async () => {
          try {
            const files = await fsPromises.readdir(outputDir);
            const chunkPaths = files
              .filter((f) => f.startsWith(baseName + "_") && f.endsWith(".mp3"))
              .map((f) => path.join(outputDir, f));
            console.log("Split complete. Files:", chunkPaths);
            resolve(chunkPaths);
          } catch (err) {
            console.error("Failed to read output directory:", err);
            reject(err);
          }
        })
        .run();
    } catch (err) {
      console.error("Unexpected error in splitWithFFmpeg:", err);
      reject(err);
    }
  });
}

async function splitAudioByDuration(inputPath, duration, savedFilename) {
  const chunks = await splitWithFFmpeg(inputPath, duration, savedFilename);
  console.log("🧩 Total chunks to upload:", chunks.length);

  const urls = [];

  for (const chunkPath of chunks) {
    console.log("📤 Uploading chunk:", chunkPath);
    try {
      // Use a simplified, ASCII-only public_id for testing to rule out Unicode issues
      const baseNameWithoutExt = path.parse(savedFilename).name;
      const chunkNumber = path
        .basename(chunkPath, path.extname(chunkPath))
        .split("_")
        .pop();
      const publicIdForCloudinary = `book_audios/${baseNameWithoutExt}_chunk_${chunkNumber}_${uuidv4()}`;

      console.log(
        `Cloudinary public_id for this chunk: ${publicIdForCloudinary}`
      );

      const result = await cloudinary.uploader.upload(chunkPath, {
        resource_type: "raw", // Changed from "auto" to "raw" for specific audio files
        folder: "echo_read/book_audios",
        // public_id: `<span class="math-inline">\{path\.parse\(savedFilename\)\.name\}\_</span>{uuidv4()}_${path.basename(chunkPath, path.extname(chunkPath)).split("_").pop()}`,
        // Change to a simpler public_id for testing:
        public_id: `audio_chunk_${uuidv4()}_${path.basename(chunkPath, path.extname(chunkPath)).split("_").pop()}`,
        use_filename: false, // `public_id` will be used, so no need for original filename
        overwrite: true,
      });

      console.log("✅ Uploaded:", result.secure_url);

      const match = result.secure_url.match(/\/book_audios\/.+$/);
      if (match) {
        const relativePath = match[0].substring(1);
        urls.push(relativePath);
      } else {
        urls.push(result.secure_url);
      }
    } catch (err) {
      console.error(`❌ Failed to upload ${chunkPath}:`, err.message);
      // Log the full error object for more detailed insights from Cloudinary
      console.error("Full Cloudinary Error Object:", err);
      throw new Error(
        `Cloudinary upload failed for ${chunkPath}: ${err.message}`
      );
    } finally {
      try {
        await fsPromises.unlink(chunkPath);
        console.log("🗑️ Deleted temp file:", chunkPath);
      } catch (e) {
        console.warn(`⚠️ Failed to delete chunk ${chunkPath}:`, e.message);
      }
    }
  }

  return urls;
}

// --- mergeAudios function remains largely unchanged ---
function mergeAudios(audioPaths) {
  return new Promise((resolve, reject) => {
    const uploadsDir = path.dirname(audioPaths[0] || "uploads");
    const uniqueId = uuidv4();
    const output = path.join(uploadsDir, `merged_${uniqueId}.mp3`);
    const fileListPath = path.join(uploadsDir, `filelist_${uniqueId}.txt`);

    const fileListContent = audioPaths
      .map((p) => `file '${path.resolve(p)}'`)
      .join("\n");

    fs.writeFileSync(fileListPath, fileListContent);

    ffmpeg()
      .input(fileListPath)
      .inputOptions(["-f", "concat", "-safe", "0"])
      .outputOptions(["-c", "copy"])
      .output(output)
      .on("end", async () => {
        try {
          await fsPromises.unlink(fileListPath);
        } catch (e) {
          console.warn("Could not delete temp file list:", e.message);
        }
        resolve(output);
      })
      .on("error", (err) => {
        reject(err);
      })
      .run();
  });
}

module.exports = {
  splitWithFFmpeg,
  splitAudioByDuration,
  mergeAudios,
};
