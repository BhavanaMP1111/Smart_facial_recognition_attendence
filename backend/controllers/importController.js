const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const AdmZip = require('adm-zip');
const canvas = require('canvas');
const Student = require('../models/Student');
const faceRecognitionService = require('../services/faceRecognitionService');
const faceapi = require('@vladmandic/face-api/dist/face-api.node-wasm.js');

const uploadsDir = path.join(__dirname, '..', 'uploads');
const studentsDir = path.join(uploadsDir, 'students');
const tempDir = path.join(uploadsDir, 'temp_zip');

// Ensure necessary directories exist
if (!fs.existsSync(studentsDir)) {
  fs.mkdirSync(studentsDir, { recursive: true });
}

/**
 * Normalizes Excel row keys to standardized attributes
 */
const normalizeRow = (row) => {
  const normalized = {};
  for (const key of Object.keys(row)) {
    const lowerKey = key.trim().toLowerCase();
    const val = row[key];
    
    if (lowerKey === 'student name' || lowerKey === 'name') {
      normalized.name = String(val).trim();
    } else if (lowerKey === 'usn' || lowerKey === 'roll number' || lowerKey === 'roll') {
      normalized.usn = String(val).trim().toUpperCase();
    } else if (lowerKey === 'department' || lowerKey === 'dept') {
      normalized.dept = String(val).trim();
    } else if (lowerKey === 'semester' || lowerKey === 'sem') {
      normalized.semester = String(val).trim();
    } else if (lowerKey === 'section' || lowerKey === 'sec') {
      normalized.section = String(val).trim().toUpperCase();
    } else if (
      lowerKey === 'photo' || 
      lowerKey === 'passport photo' || 
      lowerKey === 'photo name' || 
      lowerKey === 'filename' || 
      lowerKey === 'image' ||
      lowerKey === 'passport photo filename/path'
    ) {
      normalized.photo = String(val).trim();
    } else if (lowerKey === 'email') {
      normalized.email = String(val).trim();
    } else if (lowerKey === 'phone' || lowerKey === 'mobile' || lowerKey === 'contact') {
      normalized.phone = String(val).trim();
    }
  }
  return normalized;
};

/**
 * @desc    Bulk student registration via Excel and ZIP upload
 * @route   POST /api/students/import
 * @access  Private (Admin Only)
 */
const importStudents = async (req, res) => {
  let activeTempDir = '';
  try {
    // 1. Validate files
    if (!req.files || !req.files['excel'] || !req.files['zip']) {
      return res.status(400).json({
        success: false,
        message: 'Please upload both the Excel sheet (key: excel) and the Photos ZIP archive (key: zip)'
      });
    }

    const excelFile = req.files['excel'][0];
    const zipFile = req.files['zip'][0];

    // Ensure models are loaded
    await faceRecognitionService.initializeFaceRecognition();

    // 2. Parse Excel
    const workbook = xlsx.read(excelFile.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawRows = xlsx.utils.sheet_to_json(sheet);

    if (rawRows.length === 0) {
      return res.status(400).json({ success: false, message: 'Uploaded Excel sheet is empty' });
    }

    // 3. Extract ZIP photos
    const zip = new AdmZip(zipFile.buffer);
    const uniqueSessionId = `import_${Date.now()}`;
    activeTempDir = path.join(tempDir, uniqueSessionId);
    fs.mkdirSync(activeTempDir, { recursive: true });
    
    console.log(`📦 Unzipping photos to: ${activeTempDir}`);
    zip.extractAllTo(activeTempDir, true);

    // List all files in temp dir recursively to match photos inside subfolders
    const getAllFiles = (dirPath, arrayOfFiles) => {
      const files = fs.readdirSync(dirPath);
      arrayOfFiles = arrayOfFiles || [];
      
      files.forEach((file) => {
        if (fs.statSync(path.join(dirPath, file)).isDirectory()) {
          arrayOfFiles = getAllFiles(path.join(dirPath, file), arrayOfFiles);
        } else {
          arrayOfFiles.push({
            name: file,
            path: path.join(dirPath, file)
          });
        }
      });
      return arrayOfFiles;
    };

    const unzippedFiles = getAllFiles(activeTempDir);
    console.log(`📷 Found ${unzippedFiles.length} files in extracted ZIP.`);

    const successes = [];
    const failures = [];
    let duplicatesCount = 0;

    // 4. Process each student row
    for (let i = 0; i < rawRows.length; i++) {
      const rowNum = i + 2; // Excel header is Row 1
      const studentData = normalizeRow(rawRows[i]);
      
      // Basic validations
      if (!studentData.name || !studentData.usn || !studentData.dept || !studentData.semester) {
        failures.push({
          row: rowNum,
          usn: studentData.usn || 'N/A',
          name: studentData.name || 'N/A',
          reason: 'Missing mandatory fields: Name, USN, Department, or Semester'
        });
        continue;
      }

      // Validate and normalize department
      const allowedDepts = ['CSE', 'ISE', 'CSE(AIML)', 'AIDS', 'ECE', 'EEE'];
      const deptUpper = studentData.dept.trim().toUpperCase().replace(/\s+/g, '');
      let finalDept = '';

      if (allowedDepts.includes(deptUpper)) {
        finalDept = deptUpper;
      } else if (deptUpper.includes('AIML') || deptUpper.includes('AI&ML') || deptUpper.includes('ARTIFICIALINTELLIGENCE&MACHINELEARNING')) {
        finalDept = 'CSE(AIML)';
      } else if (deptUpper.includes('AIDS') || deptUpper.includes('AI&DS') || deptUpper.includes('ARTIFICIALINTELLIGENCE&DATASCIENCE')) {
        finalDept = 'AIDS';
      } else if (deptUpper.includes('COMPUTERSCIENCE') || deptUpper === 'CS') {
        finalDept = 'CSE';
      } else if (deptUpper.includes('INFORMATIONSCIENCE') || deptUpper === 'IS') {
        finalDept = 'ISE';
      } else if (deptUpper.includes('ELECTRONICS') || deptUpper === 'EC') {
        finalDept = 'ECE';
      } else if (deptUpper.includes('ELECTRICAL') || deptUpper === 'EE') {
        finalDept = 'EEE';
      } else {
        failures.push({
          row: rowNum,
          usn: studentData.usn || 'N/A',
          name: studentData.name || 'N/A',
          reason: `Invalid department: '${studentData.dept}'. Allowed: CSE, ISE, CSE(AIML), AIDS, ECE, EEE`
        });
        continue;
      }

      const usn = studentData.usn.toUpperCase();

      // Check Duplicates in DB
      const existingStudent = await Student.findOne({ usn });
      if (existingStudent) {
        duplicatesCount++;
        failures.push({
          row: rowNum,
          usn,
          name: studentData.name,
          reason: `Duplicate USN: student already enrolled in database`
        });
        continue;
      }

      // Check Duplicates in current spreadsheet list
      const currentDuplicate = successes.find(s => s.usn === usn);
      if (currentDuplicate) {
        failures.push({
          row: rowNum,
          usn,
          name: studentData.name,
          reason: `Spreadsheet row duplicate: USN occurs multiple times in spreadsheet`
        });
        continue;
      }

      // Find photo file in unzipped archive
      const photoName = studentData.photo || `${usn}.jpg`;
      const matchedFile = unzippedFiles.find(
        f => f.name.toLowerCase() === photoName.toLowerCase() || f.name.toLowerCase() === `${usn.toLowerCase()}.jpg` || f.name.toLowerCase() === `${usn.toLowerCase()}.png`
      );

      if (!matchedFile) {
        failures.push({
          row: rowNum,
          usn,
          name: studentData.name,
          reason: `Passport photo not found: searched for filename '${photoName}' or '${usn}.jpg'`
        });
        continue;
      }

      try {
        const descResult = await faceRecognitionService.extractEnrollmentDescriptor(fs.readFileSync(matchedFile.path));

        if (!descResult.success) {
          failures.push({
            row: rowNum,
            usn,
            name: studentData.name,
            reason: `Quality validation failed: ${descResult.reason}`
          });
          continue;
        }

        // Copy photo to production static folder named after the USN
        const destPhotoName = `${usn}.jpg`;
        const destPhotoPath = path.join(studentsDir, destPhotoName);
        fs.copyFileSync(matchedFile.path, destPhotoPath);
        const imageUrl = `/uploads/students/${destPhotoName}`;

        const descriptorArray = descResult.descriptor;

        // Create student profile in database
        const student = await Student.create({
          name: studentData.name,
          usn,
          department: finalDept,
          dept: finalDept,
          semester: studentData.semester,
          section: studentData.section || 'A',
          email: studentData.email || '',
          phone: studentData.phone || '',
          imageUrl,
          faceDescriptors: [descriptorArray]
        });

        successes.push({
          row: rowNum,
          usn,
          name: student.name,
          department: student.department,
          semester: student.semester,
          section: student.section
        });

      } catch (err) {
        console.error(`Error processing row ${rowNum} (${usn}):`, err.message);
        failures.push({
          row: rowNum,
          usn,
          name: studentData.name,
          reason: `Image processing error: ${err.message}`
        });
      }
    }

    // Refresh memory cache of descriptors if any students were added
    if (successes.length > 0) {
      await faceRecognitionService.clearDescriptorCache();
    }

    // Clean up temporary extracted ZIP files
    try {
      if (fs.existsSync(activeTempDir)) {
        fs.rmSync(activeTempDir, { recursive: true, force: true });
        console.log(`🧹 Temporary unzipped folder cleaned up: ${activeTempDir}`);
      }
    } catch (cleanupErr) {
      console.warn(`⚠️ Cleanup failed for ${activeTempDir}:`, cleanupErr.message);
    }

    res.json({
      success: true,
      summary: {
        totalRows: rawRows.length,
        successCount: successes.length,
        failedCount: failures.length,
        duplicatesCount
      },
      data: {
        successes,
        failures
      }
    });

  } catch (error) {
    console.error('🔥 Bulk Import Error:', error);
    // Cleanup on crash
    try {
      if (activeTempDir && fs.existsSync(activeTempDir)) {
        fs.rmSync(activeTempDir, { recursive: true, force: true });
      }
    } catch (e) {}
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  importStudents
};
