const express = require("express");
const multer = require("multer");
const path = require("path"); // For path.extname and path.basename
const fs = require("fs"); // For creating directories

const app = express();

// --- Multer Storage Configuration ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadDir;
    // Determine destination based on the route path
    if (req.originalUrl.startsWith("/api/pdf")) {
      uploadDir = "uploads/pdfs/";
    } else if (req.originalUrl.startsWith("/api/audio")) {
      uploadDir = "uploads/audios/";
    } else {
      uploadDir = "uploads/temp/"; // Fallback for other uploads
    }

    // Create the directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // --- IMPORTANT for Myanmar Filenames ---
    // Treat the incoming file.originalname as a binary string (sequence of bytes)
    const filenameBuffer = Buffer.from(file.originalname, "binary");
    // Then interpret these bytes as UTF-8 to get the correct string
    const decodedFilename = filenameBuffer.toString("utf8");

    // Generate a unique filename to prevent overwrites, but keep the original name
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const fileExtension = path.extname(decodedFilename); // Get original extension
    const baseFilename = path.basename(decodedFilename, fileExtension); // Get filename without extension

    // Combine them: မြန်မာ_1700000000-123456789.pdf
    const finalFilename = `${baseFilename}_${uniqueSuffix}${fileExtension}`;

    cb(null, finalFilename);
  },
});

const upload = multer({ storage: storage });

// Import your route files, passing the 'upload' instance
const pdfRoutes = require("./routes/pdfRoutes")(upload);
const audioRoutes = require("./routes/audioRoutes")(upload);

app.use(express.json());

app.use("/api/pdf", pdfRoutes);
app.use("/api/audio", audioRoutes);

app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// --- Multer Error Handling (Optional but Recommended) ---
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "File too large" });
    }
    // Handle other Multer errors (e.g., wrong field name)
    return res.status(400).json({ message: err.message });
  } else if (err) {
    // Handle other generic errors
    console.error("An unexpected error occurred:", err);
    return res
      .status(500)
      .json({ message: "Something went wrong!", error: err.message });
  }
  next();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
