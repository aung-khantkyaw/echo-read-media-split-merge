const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadDir;
    if (req.originalUrl.startsWith("/api/pdf")) {
      uploadDir = "uploads/pdfs/";
    } else if (req.originalUrl.startsWith("/api/audio")) {
      uploadDir = "uploads/audios/";
    } else {
      uploadDir = "uploads/temp/";
    }

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const filenameBuffer = Buffer.from(file.originalname, "binary");
    const decodedFilename = filenameBuffer.toString("utf8");

    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const fileExtension = path.extname(decodedFilename);
    const baseFilename = path.basename(decodedFilename, fileExtension);

    const finalFilename = `${baseFilename}_${uniqueSuffix}${fileExtension}`;

    cb(null, finalFilename);
  },
});

const upload = multer({ storage: storage });

const pdfRoutes = require("./routes/pdfRoutes")(upload);
const audioRoutes = require("./routes/audioRoutes")(upload);

app.use(express.json());

app.use("/api/pdf", pdfRoutes);
app.use("/api/audio", audioRoutes);

app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "File too large" });
    }
    return res.status(400).json({ message: err.message });
  } else if (err) {
    console.error("An unexpected error occurred:", err);
    return res
      .status(500)
      .json({ message: "Something went wrong!", error: err.message });
  }
  next();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
