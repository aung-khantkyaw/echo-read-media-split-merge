const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const { v4: uuidv4 } = require("uuid");

function splitAudioByDuration(filePath, durationInSeconds) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);

      const totalDuration = metadata.format.duration;
      const chunks = Math.ceil(totalDuration / durationInSeconds);
      const outputFiles = [];

      let completed = 0;

      for (let i = 0; i < chunks; i++) {
        const output = path.join("uploads", `chunk_${uuidv4()}.mp3`);
        ffmpeg(filePath)
          .setStartTime(i * durationInSeconds)
          .duration(durationInSeconds)
          .output(output)
          .on("end", () => {
            outputFiles.push(output);
            completed++;
            if (completed === chunks) resolve(outputFiles);
          })
          .on("error", reject)
          .run();
      }
    });
  });
}

function mergeAudios(audioPaths) {
  return new Promise((resolve, reject) => {
    const output = path.join("uploads", `merged_${uuidv4()}.mp3`);
    const fileListPath = path.join("uploads", `filelist_${uuidv4()}.txt`);

    const fileListContent = audioPaths
      .map((p) => `file '${path.resolve(p)}'`)
      .join("\n");
    fs.writeFileSync(fileListPath, fileListContent);

    ffmpeg()
      .input(fileListPath)
      .inputOptions(["-f concat", "-safe 0"])
      .outputOptions("-c copy")
      .output(output)
      .on("end", () => resolve(output))
      .on("error", reject)
      .run();
  });
}

module.exports = { splitAudioByDuration, mergeAudios };
