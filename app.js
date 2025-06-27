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

// Multer setup with ultra-fast settings
const upload = multer({
  dest: 'uploads/',
  limits: { 
    fileSize: 10 * 1024 * 1024, // Reduced to 10MB per file for faster processing
    files: 5, // Reduced to 5 files per upload for faster processing
    fieldSize: 512 * 1024 // Reduced to 512KB field size
  },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'video/mp4'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only jpg, jpeg, png, and mp4 files are allowed.'));
    }
  },
  // Use memory storage for smaller files (faster)
  storage: multer.memoryStorage()
});

// Helper function to manage media store size
function addToMediaStore(item) {
  mediaStore.unshift(item);
  if (mediaStore.length > MAX_STORED_ITEMS) {
    mediaStore.splice(MAX_STORED_ITEMS);
  }
}

// Helper function for ultra-fast Cloudinary upload
async function uploadToCloudinary(fileBuffer, mimeType, originalName) {
  const options = {
    resource_type: mimeType.startsWith('video/') ? 'video' : 'image',
    folder: 'personal_gallery',
    // Remove eager transformations for faster upload
    use_filename: true,
    unique_filename: true,
    overwrite: false,
    // Disable invalidation for faster response
    invalidate: false,
    // Use faster upload settings
    chunk_size: 6000000, // 6MB chunks for faster uploads
    eager_async: false, // Disable async eager for immediate response
    // Optimize for speed
    quality: 'auto:low', // Faster processing
    fetch_format: 'auto'
  };

  // Convert buffer to temporary file for upload
  const tempPath = path.join(__dirname, 'uploads', `temp_${Date.now()}_${originalName}`);
  
  try {
    // Write buffer to temporary file
    fs.writeFileSync(tempPath, fileBuffer);
    
    // Upload the temporary file
    const result = await cloudinary.uploader.upload(tempPath, options);
    
    // Generate optimized URLs for different screen sizes (lazy loading)
    if (mimeType.startsWith('image/')) {
      const baseUrl = result.secure_url;
      result.thumbnail_url = baseUrl.replace('/upload/', '/upload/f_auto,q_auto,w_200,h_200,c_fill/');
      result.medium_url = baseUrl.replace('/upload/', '/upload/f_auto,q_auto,w_400,h_400,c_fill/');
      result.full_url = baseUrl.replace('/upload/', '/upload/f_auto,q_auto/');
    }
    
    return result;
  } finally {
    // Clean up temporary file
    try {
      fs.unlinkSync(tempPath);
    } catch (err) {
      console.error('Error removing temp file:', err);
    }
  }
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

// DELETE route for ultra-fast media removal
app.post('/delete', async (req, res) => {
  console.log('Delete request received:', req.body);
  
  const { public_id } = req.body;
  
  if (!public_id) {
    console.log('No public_id provided');
    return res.json({ success: false, error: 'No public_id provided' });
  }

  try {
    console.log('Attempting to delete from Cloudinary:', public_id);
    
    // Delete from Cloudinary with ultra-fast settings
    const result = await cloudinary.uploader.destroy(public_id, {
      invalidate: false, // Disable invalidation for faster response
      type: 'upload' // Specify type for faster lookup
    });
    console.log('Cloudinary delete result:', result);
    
    if (result.result === 'ok' || result.result === 'not found') {
      // Remove from local storage immediately
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

// POST /upload with ultra-fast batch processing
app.post('/upload', upload.array('media', 10), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.render('upload', { error: 'No files uploaded.', success: null });
  }

  const results = {
    successful: [],
    failed: []
  };

  // Process files in parallel with optimized settings
  const uploadPromises = req.files.map(async (file) => {
    try {
      console.log(`Starting upload for: ${file.originalname}`);
      
      // Upload to Cloudinary with ultra-fast settings
      const result = await uploadToCloudinary(file.buffer, file.mimetype, file.originalname);
      
      // Store metadata in memory (minimal data)
      const mediaItem = {
        url: result.secure_url,
        thumbnail_url: result.thumbnail_url || result.secure_url,
        medium_url: result.medium_url || result.secure_url,
        full_url: result.full_url || result.secure_url,
        type: file.mimetype,
        uploadedAt: new Date().toISOString(), // Use ISO string for faster parsing
        public_id: result.public_id,
        originalname: file.originalname,
      };
      
      addToMediaStore(mediaItem);
      results.successful.push(file.originalname);
      
      console.log(`Successfully uploaded: ${file.originalname}`);
      return { success: true, file: file.originalname };
    } catch (err) {
      console.error(`Upload failed for ${file.originalname}:`, err);
      
      results.failed.push({
        name: file.originalname,
        error: err.message
      });
      
      return { success: false, file: file.originalname, error: err.message };
    }
  });

  try {
    // Wait for all uploads to complete with timeout
    const uploadResults = await Promise.allSettled(uploadPromises);
    
    // Process results
    uploadResults.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.success) {
        // Already handled in the promise
      } else if (result.status === 'rejected') {
        const fileName = req.files[index]?.originalname || 'Unknown file';
        results.failed.push({ name: fileName, error: result.reason?.message || 'Upload failed' });
      }
    });
    
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