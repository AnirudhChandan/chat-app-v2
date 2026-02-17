const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");
require("dotenv").config();

// 1. Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 2. Configure Storage Engine
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "nexus_chat_uploads", // Folder name in your Cloudinary console
    allowed_formats: ["jpg", "png", "jpeg", "gif"], // Allowed file types
  },
});

// 3. Initialize Multer
const upload = multer({ storage: storage });

module.exports = { upload, cloudinary };
