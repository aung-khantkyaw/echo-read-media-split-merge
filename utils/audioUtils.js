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

// Split the audio file using ffmpeg by duration in seconds
function splitWithFFmpeg(inputPath, duration) {
  return new Promise((resolve, reject) => {
    const outputDir = path.dirname(inputPath);
    const baseName = path.basename(inputPath, path.extname(inputPath));
    const outputPattern = path.join(outputDir, `${baseName}_%03d.mp3`);

    ffmpeg(inputPath)
      .outputOptions(["-f segment", `-segment_time ${duration}`, "-c copy"])
      .output(outputPattern)
      .on("end", async () => {
        try {
          const files = await fsPromises.readdir(outputDir);
          const chunkPaths = files
            .filter((f) => f.startsWith(baseName + "_") && f.endsWith(".mp3"))
            .map((f) => path.join(outputDir, f));
          resolve(chunkPaths);
        } catch (err) {
          reject(err);
        }
      })
      .on("error", reject)
      .run();
  });
}

// Upload chunks to Cloudinary and return array of URLs
async function splitAudioByDuration(inputPath, duration) {
  const chunks = await splitWithFFmpeg(inputPath, duration);
  const urls = [];

  for (const chunkPath of chunks) {
    try {
      const result = await cloudinary.uploader.upload(chunkPath, {
        resource_type: "video", // Treat audio as video in Cloudinary
        folder: "book_audio",
      });
      urls.push(result.secure_url);
    } catch (err) {
      console.error(`Failed to upload ${chunkPath}:`, err.message);
    } finally {
      fs.unlinkSync(chunkPath); // Delete chunk after upload
    }
  }

  return urls;
}

// Merge audio files using ffmpeg and return output path
function mergeAudios(audioPaths) {
  return new Promise((resolve, reject) => {
    const uploadsDir = "uploads";
    const output = path.join(uploadsDir, `merged_${uuidv4()}.mp3`);
    const fileListPath = path.join(uploadsDir, `filelist_${uuidv4()}.txt`);

    const fileListContent = audioPaths
      .map((p) => `file '${path.resolve(p)}'`)
      .join("\n");

    fs.writeFileSync(fileListPath, fileListContent);

    ffmpeg()
      .input(fileListPath)
      .inputOptions(["-f concat", "-safe 0"])
      .outputOptions("-c copy")
      .output(output)
      .on("end", async () => {
        try {
          await fsPromises.unlink(fileListPath); // Clean up temp txt
        } catch (e) {
          console.warn("Could not delete temp file list:", e.message);
        }
        resolve(output);
      })
      .on("error", reject)
      .run();
  });
}

module.exports = {
  splitWithFFmpeg,
  splitAudioByDuration,
  mergeAudios,
};
