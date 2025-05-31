# PDF & Audio Split & Merge API
This Node.js-based REST API provides robust functionalities for handling PDF and audio files, allowing users to split large files into smaller chunks and merge multiple files into one.

## 🚀 Features

### 📘 PDF Features:

* Upload and split PDF files into multiple smaller PDFs (based on page count).
* Merge multiple PDF files from provided URLs.

### 🎵 Audio Features:

* Upload and split audio files (MP3, WAV, etc.) into smaller chunks (based on duration).
* Merge multiple audio files.

**Note:** All uploaded files are temporarily saved and automatically deleted after processing. Files can be uploaded using `multipart/form-data`.

## 🛠️ Tech Stack

* **Node.js**: JavaScript runtime environment.
* **Express.js**: Web application framework for Node.js.
* **Multer**: Middleware for handling `multipart/form-data`, primarily used for file uploads.
* **PDF-lib / PDFKit**: Libraries for PDF processing utilities (splitting and merging).
* **FFmpeg**: Powerful command-line tool for audio and video processing.
* **Cloudinary**: Cloud-based service for audio cloud storage and delivery.
* **Docker**: Platform for developing, shipping, and running applications in containers.
* **Render**: Cloud platform for deploying web applications.

## 📁 Directory Structure
.
├── index.js
├── routes/
│   ├── pdfRoutes.js       --> Routes for PDF operations
│   └── audioRoutes.js     --> Routes for Audio operations
├── utils/
│   ├── pdfUtils.js        --> PDF processing logic (split, merge)
│   └── audioUtils.js      --> Audio processing logic (split, merge)
└── uploads/
├── pdfs/              --> Temporary storage for PDF files
└── audios/            --> Temporary storage for audio files

## ⚙️ Installation

To get this API up and running on your local machine, follow these steps:

1.  **Clone the repository:**

    ```bash
    git clone [https://github.com/aung-khantkyaw/large-file-split-and-upload-to-cloudinary](https://github.com/aung-khantkyaw/large-file-split-and-upload-to-cloudinary)
    cd large-file-split-and-upload-to-cloudinary

    ```

2.  **Install dependencies:**

    ```bash
    npm install

    ```

3.  **Create a `.env` file:**
    In the root directory of the project, create a file named `.env` and add your Cloudinary credentials:

    ```dotenv
    CLOUDINARY_CLOUD_NAME=your_cloud_name
    CLOUDINARY_API_KEY=your_api_key
    CLOUDINARY_API_SECRET=your_api_secret

    ```

4.  **Run the server:**

    ```bash
    node index.js

    ```

5.  **Or run with Docker:**

    ```bash
    docker build -t large-file-split-and-upload-to-cloudinary .
    docker run -p 3000:3000 --name large-file-split-and-upload-to-cloudinary -d --env CLOUDINARY_CLOUD_NAME=your_cloud_name --env CLOUDINARY_API_KEY=your_api_key --env CLOUDINARY_API_SECRET=your_api_secret large-file-split-and-upload-to-cloudinary

    ```

## 🚀 API Endpoints

The API is structured with clear endpoints for each operation.

### 📘 PDF API

* **Split a PDF file**

    * **Endpoint:** `POST /api/pdf/split`

    * **Form fields:**

        * `pdf` (file): The PDF file to be split.

        * `pages_per_chunk` (optional, default = 10): Number of pages per split PDF.

    * **Returns:** JSON array of split PDF file URLs.

* **Merge PDF files**

    * **Endpoint:** `POST /api/pdf/merge`

    * **Request Body (JSON):**

        ```json
        {
          "urls": ["https://...", "https://..."]
        }

        ```

    * **Returns:** Merged PDF file for download.

### 🎵 Audio API

* **Split an audio file**

    * **Endpoint:** `POST /api/audio/split`

    * **Form fields:**

        * `audio` (file): The audio file (MP3, WAV, etc.) to be split.

        * `duration` (optional, in minutes, default = 60): Duration of each audio chunk.

    * **Returns:** JSON array of split audio file URLs.

* **Merge audio files**

    * **Endpoint:** `POST /api/audio/merge`

    * **Form fields:**

        * `audios[]` (multiple audio files): Multiple audio files to be merged.

    * **Returns:** Merged audio file for download.

### 📍 Health Check

* **Endpoint:** `GET /health`

    * **Returns:** `"OK"` (HTTP 200)

## 📝 Notes

* All uploaded files are temporary and automatically deleted after processing to ensure privacy and optimize storage.

* Audio files are uploaded to and served from Cloudinary for efficient storage and delivery.

* FFmpeg is a core dependency for audio processing and is already included in the Docker image for easy deployment.

## 💡 Example cURL Commands

Here are some `curl` commands to test the API endpoints:

1.  **Split a PDF:**

    ```bash
    curl -F "pdf=@sample.pdf" -F "pages_per_chunk=5" http://localhost:3000/api/pdf/split

    ```

2.  **Merge PDFs:**

    ```bash
    curl -X POST -H "Content-Type: application/json" \
      -d '{"urls": ["url1", "url2"]}' \
      http://localhost:3000/api/pdf/merge

    ```

3.  **Split an audio file:**

    ```bash
    curl -F "audio=@sample.mp3" -F "duration=2" http://localhost:3000/api/audio/split

    ```

4.  **Merge audio files:**

    ```bash
    curl -F "audios=@part1.mp3" -F "audios=@part2.mp3" http://localhost:3000/api/audio/merge

    ```
