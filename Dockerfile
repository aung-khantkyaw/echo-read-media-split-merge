# Base image
FROM node:18-bullseye

# ffmpeg install
RUN apt-get update && apt-get install -y ffmpeg

# App directory
WORKDIR /app

# Copy files and install dependencies
COPY package*.json ./
RUN npm install
COPY . .

# App runs on port 3000 (change if needed)
EXPOSE 3000

# Start the server
CMD ["node", "index.js"]
