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

// Upload chunks to Cloudinary and return array of URLs
async function splitAudioByDuration(inputPath, duration) {
  const chunks = await splitWithFFmpeg(inputPath, duration);
  const urls = [];

  for (const chunkPath of chunks) {
    try {
      const result = await cloudinary.uploader.upload(chunkPath, {
        resource_type: "auto", // audio ကို auto မှတ်ပေးတာ
        folder: "book_audio",
      });
      urls.push(result.secure_url);
    } catch (err) {
      console.error(`Failed to upload ${chunkPath}:`, err.message);
    } finally {
      try {
        await fsPromises.unlink(chunkPath); // Delete chunk after upload
      } catch (e) {
        console.warn(`Failed to delete chunk ${chunkPath}:`, e.message);
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
