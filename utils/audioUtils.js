const fs = require("fs");
const fsPromises = require("fs/promises");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const { v4: uuidv4 } = require("uuid");
const { v2: cloudinary } = require("cloudinary");

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
);
console.log("--------------------------------------------------");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function splitAudioByDurationAndUpload(
  inputPath,
  duration,
  savedFilename
) {
  const resolvedInputPath = path.resolve(inputPath);

  const rawBaseName = path.parse(savedFilename).name.normalize("NFC");
  const safeBaseName = rawBaseName.replace(/[^\w\-]/g, "");
  const outputDir = path.dirname(resolvedInputPath);
  const outputPattern = path.join(outputDir, `${safeBaseName}_%03d.mp3`);

  console.log("🎧 Splitting audio using FFmpeg...");
  console.log("📥 Input path:", resolvedInputPath);
  console.log("🧩 Output pattern:", outputPattern);
  console.log("⏱️ Segment duration:", duration, "seconds");

  const uploadedUrls = [];

  await new Promise((resolve, reject) => {
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
        console.log("🔧 FFmpeg command:", cmdLine);
      })
      .on("stderr", (stderrLine) => {
        console.error("⚙️ FFmpeg STDERR:", stderrLine);
      })
      .on("error", (err, stdout, stderr) => {
        console.error("❌ FFmpeg ERROR:", err.message);
        console.error("FFmpeg STDERR:", stderr);
        reject(new Error(`FFmpeg failed: ${err.message}`));
      })
      .on("end", resolve)
      .run();
  });

  const files = await fsPromises.readdir(outputDir);
  const chunks = files
    .filter((f) => f.startsWith(safeBaseName + "_") && f.endsWith(".mp3"))
    .map((f) => path.join(outputDir, f));

  console.log("🧩 Audio split complete. Chunks found:", chunks.length);

  for (const chunkPath of chunks) {
    const chunkNumber = path.basename(chunkPath, ".mp3").split("_").pop();

    const baseName = savedFilename.replace(/\.mp3$/, "");

    const publicId = `book_audios/${baseName}_part_${chunkNumber}`;

    const stats = await fsPromises.stat(chunkPath);
    const fileSizeInBytes = stats.size;
    const fileSizeInMB = (fileSizeInBytes / (1024 * 1024)).toFixed(2);

    console.log(`📦 Chunk size: ${fileSizeInMB} MB`);
    console.log(`📤 Uploading chunk: ${chunkPath}`);
    console.log(`➡️ Cloudinary public_id: ${publicId}`);

    try {
      const result = await cloudinary.uploader.upload(chunkPath, {
        resource_type: "video", // For audio files
        folder: "echo_read",
        public_id: publicId,
        overwrite: true,
      });

      console.log("✅ Uploaded:", result.secure_url);

      uploadedUrls.push(`${publicId}.mp3`);
    } catch (err) {
      console.error(`❌ Upload failed for ${chunkPath}:`, err.message);
      console.error("Full error:", err);
      throw new Error(
        `Cloudinary upload failed for ${chunkPath}: ${err.message}`
      );
    } finally {
      try {
        await fsPromises.unlink(chunkPath);
        console.log("🗑️ Deleted temp chunk:", chunkPath);
      } catch (e) {
        console.warn(`⚠️ Failed to delete temp chunk ${chunkPath}:`, e.message);
      }
    }
  }

  return uploadedUrls;
}

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
  splitAudioByDurationAndUpload,
  mergeAudios,
};
