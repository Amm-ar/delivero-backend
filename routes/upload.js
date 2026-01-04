const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { protect } = require('../middleware/auth');

// Single image upload
router.post('/image', protect, upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    // Return the relative path for saving in the database
    const filePath = req.file.path.replace(/\\/g, '/');
    res.json({
        success: true,
        message: 'Image uploaded successfully',
        imageUrl: `/${filePath}`
    });
});

module.exports = router;
