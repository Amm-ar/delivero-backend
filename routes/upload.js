const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { protect } = require('../middleware/auth');

// Single image upload
router.post('/image', protect, upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    res.json({
        success: true,
        message: 'Image uploaded successfully',
        imageUrl: req.file.path
    });
});

module.exports = router;
