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
function splitWithFFmpeg(inputPath, duration) {
  return new Promise((resolve, reject) => {
    try {
      const resolvedInputPath = path.resolve(inputPath);
      const outputDir = path.dirname(resolvedInputPath);
      const baseName = path.basename(
        resolvedInputPath,
        path.extname(resolvedInputPath)
      );
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

async function splitAudioByDuration(inputPath, duration) {
  const chunks = await splitWithFFmpeg(inputPath, duration);
  console.log("🧩 Total chunks to upload:", chunks.length);

  const urls = [];

  for (const chunkPath of chunks) {
    console.log("📤 Uploading chunk:", chunkPath);
    try {
      const result = await cloudinary.uploader.upload(chunkPath, {
        resource_type: "video",
        folder: "echo-read/book_audio",
        public_id: path.basename(chunkPath, path.extname(chunkPath)),
        use_filename: true,
        overwrite: true,
      });

      console.log("✅ Uploaded:", result.secure_url);

      const match = result.secure_url.match(/\/book_audio\/.+$/);

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

// Merge audio files using ffmpeg and return output path
function mergeAudios(audioPaths) {
  return new Promise((resolve, reject) => {
    const uploadsDir = "uploads";
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
