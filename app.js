require('dotenv').config();
const express = require('express');
const path = require('path');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// In-memory media storage
const mediaStore = [];

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer setup (store file temporarily on disk)
const upload = multer({
  dest: 'uploads/',
  limits: { 
    fileSize: 20 * 1024 * 1024, // 20MB per file
    files: 10 // Maximum 10 files per upload
  },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'video/mp4'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only jpg, jpeg, png, and mp4 files are allowed.'));
    }
  },
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // Add JSON parsing for delete requests

// Home page
app.get('/', (req, res) => {
  const success = req.query.success;
  res.render('index', { media: mediaStore, success: success });
});

// Upload page
app.get('/upload', (req, res) => {
  res.render('upload', { error: null, success: null });
});

// DELETE route for removing media
app.post('/delete', async (req, res) => {
  console.log('Delete request received:', req.body);
  
  const { public_id } = req.body;
  
  if (!public_id) {
    console.log('No public_id provided');
    return res.json({ success: false, error: 'No public_id provided' });
  }

  try {
    console.log('Attempting to delete from Cloudinary:', public_id);
    
    // Delete from Cloudinary
    const result = await cloudinary.uploader.destroy(public_id);
    console.log('Cloudinary delete result:', result);
    
    if (result.result === 'ok' || result.result === 'not found') {
      // Remove from local storage
      const index = mediaStore.findIndex(item => item.public_id === public_id);
      if (index !== -1) {
        mediaStore.splice(index, 1);
        console.log('Removed from local storage, index:', index);
      }
      
      console.log('Delete successful');
      res.json({ success: true, message: 'Media deleted successfully' });
    } else {
      console.log('Cloudinary delete failed:', result);
      res.json({ success: false, error: 'Failed to delete from Cloudinary' });
    }
  } catch (err) {
    console.error('Delete error:', err);
    res.json({ success: false, error: err.message });
  }
});

// POST /upload
app.post('/upload', upload.array('media', 10), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.render('upload', { error: 'No files uploaded.', success: null });
  }

  const results = {
    successful: [],
    failed: []
  };

  // Process each file
  for (const file of req.files) {
    try {
      // Upload to Cloudinary
      const result = await cloudinary.uploader.upload(file.path, {
        resource_type: file.mimetype.startsWith('video/') ? 'video' : 'image',
        folder: 'personal_gallery',
      });

      // Store metadata in memory
      const mediaItem = {
        url: result.secure_url,
        type: file.mimetype,
        uploadedAt: new Date().toLocaleString(),
        public_id: result.public_id,
        originalname: file.originalname,
      };
      
      mediaStore.unshift(mediaItem);
      results.successful.push(file.originalname);

      // Remove temp file
      fs.unlink(file.path, () => {});
    } catch (err) {
      // Remove temp file on error
      fs.unlink(file.path, () => {});
      results.failed.push({
        name: file.originalname,
        error: err.message
      });
    }
  }

  // Prepare response message
  let message = '';
  if (results.successful.length > 0) {
    message += `Successfully uploaded ${results.successful.length} file(s): ${results.successful.join(', ')}. `;
  }
  if (results.failed.length > 0) {
    message += `Failed to upload ${results.failed.length} file(s): ${results.failed.map(f => f.name).join(', ')}.`;
  }

  if (results.successful.length > 0) {
    // Redirect with success message
    res.redirect(`/?success=${encodeURIComponent(message)}`);
  } else {
    // All uploads failed
    res.render('upload', { 
      error: `All uploads failed. ${results.failed.map(f => `${f.name}: ${f.error}`).join('; ')}`, 
      success: null 
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
}); 