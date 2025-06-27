#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🚀 Cloudinary Media Gallery Setup');
console.log('==================================\n');

console.log('This script will help you create a .env file with your Cloudinary credentials.\n');

console.log('To get your Cloudinary credentials:');
console.log('1. Go to https://cloudinary.com/console');
console.log('2. Sign in or create an account');
console.log('3. Copy your Cloud Name, API Key, and API Secret from the Dashboard\n');

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function setup() {
  try {
    const cloudName = await question('Enter your Cloudinary Cloud Name: ');
    const apiKey = await question('Enter your Cloudinary API Key: ');
    const apiSecret = await question('Enter your Cloudinary API Secret: ');
    const port = await question('Enter port number (default: 3000): ') || '3000';

    const envContent = `# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=${cloudName}
CLOUDINARY_API_KEY=${apiKey}
CLOUDINARY_API_SECRET=${apiSecret}

# Server Configuration
PORT=${port}
NODE_ENV=development
`;

    const envPath = path.join(__dirname, '.env');
    
    if (fs.existsSync(envPath)) {
      const overwrite = await question('.env file already exists. Overwrite? (y/N): ');
      if (overwrite.toLowerCase() !== 'y') {
        console.log('Setup cancelled.');
        rl.close();
        return;
      }
    }

    fs.writeFileSync(envPath, envContent);
    
    console.log('\n✅ .env file created successfully!');
    console.log('\nNext steps:');
    console.log('1. Run: npm install');
    console.log('2. Run: npm start');
    console.log('3. Visit: http://localhost:' + port);
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
  } finally {
    rl.close();
  }
}

setup(); 