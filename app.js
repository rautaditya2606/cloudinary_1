require('dotenv').config();
const express = require('express');
const path = require('path');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3000;

// In-memory media storage with LRU-like behavior
const mediaStore = [];
const MAX_STORED_ITEMS = 100; // Prevent memory bloat

// Configure Cloudinary with optimized settings
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Performance optimizations
app.use(compression()); // Enable gzip compression
app.use(express.json({ limit: '10mb' })); // Limit JSON payload size
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cache static assets for 1 year
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1y',
  etag: true,
  lastModified: true
}));

// Multer setup with optimized settings
const upload = multer({
  dest: 'uploads/',
  limits: { 
    fileSize: 20 * 1024 * 1024, // 20MB per file
    files: 10, // Maximum 10 files per upload
    fieldSize: 1024 * 1024 // 1MB field size
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

// Helper function to manage media store size
function addToMediaStore(item) {
  mediaStore.unshift(item);
  if (mediaStore.length > MAX_STORED_ITEMS) {
    mediaStore.splice(MAX_STORED_ITEMS);
  }
}

// Helper function for optimized Cloudinary upload
async function uploadToCloudinary(filePath, mimeType, originalName) {
  const options = {
    resource_type: mimeType.startsWith('video/') ? 'video' : 'image',
    folder: 'personal_gallery',
    eager: mimeType.startsWith('image/') ? [
      { width: 300, height: 300, crop: 'fill', quality: 'auto', format: 'auto' },
      { width: 600, height: 600, crop: 'fill', quality: 'auto', format: 'auto' },
      { width: 1200, height: 1200, crop: 'limit', quality: 'auto', format: 'auto' }
    ] : undefined,
    eager_async: true,
    eager_notification_url: undefined,
    use_filename: true,
    unique_filename: true,
    overwrite: false,
    invalidate: true,
    transformation: mimeType.startsWith('image/') ? [
      { quality: 'auto', fetch_format: 'auto' }
    ] : undefined
  };

  const result = await cloudinary.uploader.upload(filePath, options);
  
  // Generate optimized URLs for different screen sizes
  if (mimeType.startsWith('image/')) {
    const baseUrl = result.secure_url;
    result.thumbnail_url = baseUrl.replace('/upload/', '/upload/f_auto,q_auto,w_300,h_300,c_fill/');
    result.medium_url = baseUrl.replace('/upload/', '/upload/f_auto,q_auto,w_600,h_600,c_fill/');
    result.full_url = baseUrl.replace('/upload/', '/upload/f_auto,q_auto/');
  }
  
  return result;
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Cache control headers
app.use((req, res, next) => {
  res.set('Cache-Control', 'public, max-age=300'); // 5 minutes for dynamic content
  next();
});

// Home page with optimized rendering
app.get('/', (req, res) => {
  const success = req.query.success;
  // Only send necessary data to template
  const mediaForTemplate = mediaStore.map(item => ({
    url: item.url,
    type: item.type,
    uploadedAt: item.uploadedAt,
    public_id: item.public_id,
    originalname: item.originalname
  }));
  
  res.render('index', { 
    media: mediaForTemplate, 
    success: success,
    mediaCount: mediaStore.length 
  });
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
    
    // Delete from Cloudinary with optimized settings
    const result = await cloudinary.uploader.destroy(public_id, {
      invalidate: true
    });
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

// POST /upload with optimized batch processing
app.post('/upload', upload.array('media', 10), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.render('upload', { error: 'No files uploaded.', success: null });
  }

  const results = {
    successful: [],
    failed: []
  };

  // Process files in parallel for better performance
  const uploadPromises = req.files.map(async (file) => {
    try {
      console.log(`Starting upload for: ${file.originalname}`);
      
      // Upload to Cloudinary with optimized settings
      const result = await uploadToCloudinary(file.path, file.mimetype, file.originalname);
      
      // Store metadata in memory
      const mediaItem = {
        url: result.secure_url,
        thumbnail_url: result.thumbnail_url || result.secure_url,
        medium_url: result.medium_url || result.secure_url,
        full_url: result.full_url || result.secure_url,
        type: file.mimetype,
        uploadedAt: new Date().toLocaleString(),
        public_id: result.public_id,
        originalname: file.originalname,
      };
      
      addToMediaStore(mediaItem);
      results.successful.push(file.originalname);

      // Remove temp file immediately
      fs.unlink(file.path, () => {});
      
      console.log(`Successfully uploaded: ${file.originalname}`);
      return { success: true, file: file.originalname };
    } catch (err) {
      console.error(`Upload failed for ${file.originalname}:`, err);
      
      // Remove temp file on error
      fs.unlink(file.path, () => {});
      results.failed.push({
        name: file.originalname,
        error: err.message
      });
      
      return { success: false, file: file.originalname, error: err.message };
    }
  });

  try {
    // Wait for all uploads to complete
    await Promise.all(uploadPromises);
    
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
  } catch (error) {
    console.error('Batch upload error:', error);
    res.render('upload', { 
      error: 'Upload processing failed. Please try again.', 
      success: null 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    mediaCount: mediaStore.length,
    memoryUsage: process.memoryUsage()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Compression: enabled`);
}); 