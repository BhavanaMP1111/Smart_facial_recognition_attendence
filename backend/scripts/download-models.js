const fs = require('fs');
const path = require('path');
const https = require('https');

const BASE_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/';

const FILES = [
  'ssd_mobilenetv1_model-weights_manifest.json',
  'ssd_mobilenetv1_model-shard1',
  'ssd_mobilenetv1_model-shard2',
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model-shard1',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1',
  'face_recognition_model-shard2'
];

const TARGET_DIRS = [
  path.join(__dirname, '..', 'models_faceapi'),
  path.join(__dirname, '..', '..', 'frontend', 'public', 'models')
];

// Helper to download a single file
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: HTTP Status ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

async function main() {
  console.log('🤖 Face-API.js Models Downloader Started...');

  // Ensure directories exist
  for (const dir of TARGET_DIRS) {
    if (!fs.existsSync(dir)) {
      console.log(`📁 Creating directory: ${dir}`);
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const backendDir = TARGET_DIRS[0];
  const frontendDir = TARGET_DIRS[1];

  for (let i = 0; i < FILES.length; i++) {
    const fileName = FILES[i];
    const fileUrl = `${BASE_URL}${fileName}`;
    const localBackendPath = path.join(backendDir, fileName);
    const localFrontendPath = path.join(frontendDir, fileName);

    console.log(`\n⏳ [${i + 1}/${FILES.length}] Downloading ${fileName}...`);
    
    try {
      // Download to backend folder
      if (!fs.existsSync(localBackendPath)) {
        await downloadFile(fileUrl, localBackendPath);
        console.log(`   ✅ Saved to backend/models_faceapi`);
      } else {
        console.log(`   ⏭️ Backend model already exists, skipping download.`);
      }

      // Copy to frontend folder (or download if backend was skipped but frontend is missing)
      if (!fs.existsSync(localFrontendPath)) {
        fs.copyFileSync(localBackendPath, localFrontendPath);
        console.log(`   ✅ Copied to frontend/public/models`);
      } else {
        console.log(`   ⏭️ Frontend model already exists, skipping copy.`);
      }
    } catch (error) {
      console.error(`   ❌ Error processing ${fileName}: ${error.message}`);
    }
  }

  console.log('\n🎉 All face-api.js AI model files are configured successfully!');
}

main();
