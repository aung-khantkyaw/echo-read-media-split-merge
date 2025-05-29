const fs = require("fs");
const fsPromises = require("fs/promises");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const { v4: uuidv4 } = require("uuid");
const { v2: cloudinary } = require("cloudinary");

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Function to split audio file into chunks using FFmpeg
function splitWithFFmpeg(inputPath, duration, savedFilename) {
  // Change parameter name
  return new Promise((resolve, reject) => {
    try {
      const resolvedInputPath = path.resolve(inputPath);
      const outputDir = path.dirname(resolvedInputPath); // Use the directory where the input file is

      // Use the savedFilename for generating baseName for chunks
      const baseName = path
        .basename(savedFilename, path.extname(savedFilename))
        .normalize("NFC"); // NFC normalization is good practice for Unicode filenames

      const outputPattern = path.join(outputDir, `${baseName}_%03d.mp3`); // Changed output pattern to use outputDir

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
            // Read files from the same outputDir where chunks were saved
            const files = await fsPromises.readdir(outputDir);
            const chunkPaths = files
              .filter((f) => f.startsWith(baseName + "_") && f.endsWith(".mp3"))
              .map((f) => path.join(outputDir, f)); // Ensure full path
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
  // Change parameter name
  const chunks = await splitWithFFmpeg(inputPath, duration, savedFilename); // Pass savedFilename
  console.log("🧩 Total chunks to upload:", chunks.length);

  const urls = [];

  for (const chunkPath of chunks) {
    console.log("📤 Uploading chunk:", chunkPath);
    try {
      const result = await cloudinary.uploader.upload(chunkPath, {
        resource_type: "video", // or 'raw' for audio files not treated as video
        folder: "echo_read/book_audios",
        // public_id: path.basename(chunkPath, path.extname(chunkPath)), // This is usually fine if baseName is good
        // Use a more robust public_id if needed, e.g., combining savedFilename base with uuid
        public_id: `${path.parse(savedFilename).name}_${uuidv4()}_${path
          .basename(chunkPath, path.extname(chunkPath))
          .split("_")
          .pop()}`,
        use_filename: true,
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
      throw new Error(`Cloudinary upload failed for ${chunkPath}`);
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

// mergeAudios function remains largely unchanged, but ensure it handles paths correctly
function mergeAudios(audioPaths) {
  return new Promise((resolve, reject) => {
    // Dynamically determine the uploads directory from one of the input paths if possible
    // Or stick to a hardcoded 'uploads' if files are always there
    const uploadsDir = path.dirname(audioPaths[0] || "uploads"); // Assumes all audioPaths are in the same dir
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
          await fsPromises.unlink(fileListPath); // Clean up temp txt
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
