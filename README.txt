============================================================
              PDF & Audio Split & Merge API
============================================================

Description:
------------
This Node.js-based REST API allows users to:

📘 PDF Features:
 - Upload and split PDF files into multiple smaller PDFs (based on page count)
 - Merge multiple PDF files from URLs

🎵 Audio Features:
 - Upload and split audio files (MP3, WAV, etc.) into smaller chunks (based on duration)
 - Merge multiple audio files

Uploads are temporarily saved and deleted after processing.
Files can be uploaded using multipart/form-data.

------------------------------------------------------------
Tech Stack:
-----------
 - Node.js
 - Express.js
 - Multer (file upload handling)
 - PDF-lib / PDFKit (PDF processing utilities)
 - FFmpeg (audio processing)
 - Cloudinary (audio cloud storage)
 - Docker (containerization)
 - Render (deployment)

------------------------------------------------------------
Directory Structure:
--------------------
index.js
routes/
 ├── pdfRoutes.js       --> Routes for PDF operations
 └── audioRoutes.js     --> Routes for Audio operations
utils/
 ├── pdfUtils.js        --> PDF processing logic (split, merge)
 └── audioUtils.js      --> Audio processing logic (split, merge)
uploads/
 ├── pdfs/              --> Temporary storage for PDF files
 └── audios/            --> Temporary storage for audio files

------------------------------------------------------------
Installation:
-------------
1. Clone the repository:
   > git clone https://github.com/aung-khantkyaw/large-file-split-and-upload-to-cloudinary
   > cd large-file-split-and-upload-to-cloudinary

2. Install dependencies:
   > npm install

3. Create a `.env` file in the root directory:
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret

4. Run the server:
   > node index.js

5. Or run with Docker:
   > docker build -t large-file-split-and-upload-to-cloudinary .
   > docker run -p 3000:3000 --name large-file-split-and-upload-to-cloudinary -d --env CLOUDINARY_CLOUD_NAME=your_cloud_name --env CLOUDINARY_API_KEY=your_api_key --env CLOUDINARY_API_SECRET=your_api_secret large-file-split-and-upload-to-cloudinary

------------------------------------------------------------
API Endpoints:
--------------

📘 PDF API
==========

[POST] /api/pdf/split
 - Form field: pdf (file), pages_per_chunk (optional, default = 10)
 - Returns: JSON with array of split PDF file URLs

[POST] /api/pdf/merge
 - Body:
   {
     "urls": ["https://...", "https://..."]
   }
 - Returns: Merged PDF file download

🎵 Audio API
============

[POST] /api/audio/split
 - Form field: audio (file), duration (optional, in minutes, default = 60)
 - Returns: JSON with array of split audio file URLs

[POST] /api/audio/merge
 - Form field: audios[] (multiple audio files)
 - Returns: Merged audio file download

📍 Health Check
===============

[GET] /health
 - Returns: "OK" (HTTP 200)

------------------------------------------------------------
Notes:
------
 - All uploaded files are temporary and automatically deleted after processing.
 - Audio files are uploaded and served from Cloudinary.
 - FFmpeg is required and already included in Docker.

------------------------------------------------------------
Example curl Commands:
----------------------

1. Split a PDF:
   > curl -F "pdf=@sample.pdf" -F "pages_per_chunk=5" http://localhost:3000/api/pdf/split

2. Merge PDFs:
   > curl -X POST -H "Content-Type: application/json" \
     -d '{"urls": ["url1", "url2"]}' \
     http://localhost:3000/api/pdf/merge

3. Split an audio file:
   > curl -F "audio=@sample.mp3" -F "duration=2" http://localhost:3000/api/audio/split

4. Merge audio files:
   > curl -F "audios=@part1.mp3" -F "audios=@part2.mp3" http://localhost:3000/api/audio/merge
