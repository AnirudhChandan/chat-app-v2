const express = require("express");
const router = express.Router();
const { upload } = require("../lib/cloudinary");

// POST /api/upload
// 'file' must match the key name used in Frontend FormData
router.post("/", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Multer + Cloudinary automatically puts the URL here:
    res.json({
      message: "Upload successful",
      url: req.file.path, // The remote Cloudinary URL
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ message: "Server error during upload" });
  }
});

module.exports = router;
