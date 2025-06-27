# Personal Media Gallery

A secure and minimal personal media gallery web app built with Node.js, Express.js, and Cloudinary.

## Features

- **Multiple File Upload**: Upload up to 10 images (jpg, jpeg, png) and videos (mp4) at once
- **File Size Limits**: 20MB per file, 100MB total per upload session
- **Cloud Storage**: Files are securely stored on Cloudinary
- **Responsive Gallery**: Clean grid layout with hover effects
- **Modal Preview**: Click any media item to view in fullscreen modal
- **Delete Media**: Remove files from both Cloudinary and local storage
- **File Validation**: Client and server-side validation for file types and sizes
- **Progress Indicators**: Upload progress and detailed success/error messages
- **Batch Processing**: Upload multiple files with individual success/failure tracking
- **No Database**: Simple in-memory storage (resets on server restart)

## Tech Stack

- **Backend**: Node.js + Express.js
- **View Engine**: EJS
- **File Upload**: Multer (multiple file support)
- **Cloud Storage**: Cloudinary SDK
- **Styling**: Vanilla CSS (no frameworks)
- **Security**: dotenv for environment variables

## Setup

1. **Clone and Install Dependencies**
   ```bash
   npm install
   ```

2. **Create Environment File**
   Create a `.env` file in the root directory:
   ```
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   PORT=3000
   ```

3. **Get Cloudinary Credentials**
   - Sign up at [cloudinary.com](https://cloudinary.com)
   - Go to Dashboard → Account Details
   - Copy your Cloud Name, API Key, and API Secret

4. **Start the Server**
   ```bash
   npm start
   ```

5. **Access the App**
   - Home page: http://localhost:3000
   - Upload page: http://localhost:3000/upload

## Usage

### Uploading Media
1. Navigate to `/upload`
2. Select multiple images (jpg, jpeg, png) or videos (mp4) files
3. File validation happens automatically:
   - Each file must be under 20MB
   - Total upload must be under 100MB
   - Only allowed file types accepted
4. Click "Upload Files" to send to Cloudinary
5. You'll see detailed success/failure messages for each file
6. Redirected to home page with uploaded media

### Viewing Gallery
1. Visit the home page `/`
2. Click any media item to open in fullscreen modal
3. Use Escape key or click outside to close modal
4. Videos have controls in the modal

### Deleting Media
1. Hover over any media item in the gallery
2. Click the "🗑️ Delete" button that appears
3. Confirm deletion in the popup modal
4. File is removed from both Cloudinary and local storage
5. Gallery updates automatically

## Upload Limits

- **Per File**: Maximum 20MB
- **Per Upload Session**: Maximum 10 files, 100MB total
- **File Types**: jpg, jpeg, png, mp4 only
- **Supported Formats**: Images (JPEG, PNG), Videos (MP4)

## Security Features

- **No Frontend Credentials**: Cloudinary credentials are server-side only
- **File Validation**: Both client and server-side validation
- **Size Limits**: 20MB per file, 100MB total per session
- **Type Restrictions**: Only allowed file types accepted
- **Environment Variables**: Sensitive data in .env file
- **Batch Processing**: Individual file success/failure tracking
- **Secure Deletion**: Files removed from both Cloudinary and local storage

## File Structure

```
cloudinary_soul/
├── app.js              # Main server file
├── package.json        # Dependencies and scripts
├── .env               # Environment variables (create this)
├── uploads/           # Temporary upload directory
├── views/
│   ├── index.ejs      # Home page template
│   └── upload.ejs     # Upload page template
└── public/
    └── styles.css     # Stylesheet
```

## API Endpoints

- `GET /` - Home page with media gallery
- `GET /upload` - Upload page
- `POST /upload` - Handle multiple file uploads to Cloudinary
- `POST /delete` - Delete media from Cloudinary and local storage

## Customization

### Changing Upload Limits
1. Update `files: 10` in `app.js` (Multer config) for max files
2. Update `fileSize: 20 * 1024 * 1024` for per-file size limit
3. Update the 100MB total limit in `views/upload.ejs` JavaScript

### Adding New File Types
1. Update the `allowed` array in `app.js` (Multer config)
2. Update the `accept` attribute in `views/upload.ejs`
3. Update the validation in the upload page JavaScript

### Styling
- Modify `public/styles.css` for custom styling
- The app uses CSS Grid for responsive layout
- Modal styles are included for fullscreen preview
- Delete button styles can be customized

### Storage
- Currently uses in-memory array (resets on restart)
- To persist data, consider adding a JSON file or database

## Troubleshooting

**Upload Fails**
- Check your Cloudinary credentials in `.env`
- Ensure each file is under 20MB
- Verify total upload is under 100MB
- Verify file types are supported

**Delete Fails**
- Check Cloudinary credentials and permissions
- Ensure the file exists in your Cloudinary account
- Check browser console for error messages

**Server Won't Start**
- Make sure all dependencies are installed: `npm install`
- Check if port 3000 is available
- Verify `.env` file exists with correct credentials

**Modal Not Working**
- Check browser console for JavaScript errors
- Ensure media files are accessible via Cloudinary URLs

**Multiple Upload Issues**
- Check browser console for file validation errors
- Ensure you're not exceeding file count or size limits
- Verify all files are valid types

## License

ISC License 