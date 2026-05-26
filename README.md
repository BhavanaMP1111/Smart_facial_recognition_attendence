# SmartFace ID - Smart Face Identity Attendance System

A production-grade, highly scalable MERN stack Smart Face Identity Attendance System utilizing client-side TensorFlow.js for browser webcam capturing and server-side face recognition for IoT devices (e.g., ESP32-CAM or Raspberry Pi). 

---

## 🏗️ System Architecture

To ensure high performance and minimize server computational costs, the system features a **Dual-Path Face Recognition Architecture**:

```
+-----------------------------------------------------------------------------------+
|                                 DUAL-PATH FLOW                                    |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  1. Local Browser Webcam (Client-Side AI)                                         |
|     [Webcam] ---> [TensorFlow.js (face-api.js)] ---> [Mark Attendance Payload]    |
|                          (Compute descriptors)               |                    |
|                                                              v                    |
|                                                      [Express Backend]            |
|                                                              ^                    |
|  2. Remote IoT Nodes (Server-Side AI)                        |                    |
|     [ESP32-CAM] --(POST Base64 Frame)------------------------+                    |
|                                                              |                    |
|                                                              v                    |
|                                                    [Server face-api.js]           |
|                                                    (Compare with MongoDB)         |
|                                                              |                    |
|                                                              v                    |
|                                                      [MongoDB Database]           |
+-----------------------------------------------------------------------------------+
```

### 1. Client-Side Path (Local Webcams)
The browser downloads face-api.js neural weights once and runs the heavy face-detection and landmark-extraction operations locally on the client's CPU/GPU. After computing the face descriptor (128-dimensional vector), it matches it locally using standard Euclidean distance face matcher. Upon recognition, it makes a lightweight check-in API call to the server `/api/attendance/mark`.

### 2. Server-Side Path (IoT Devices & Bulk Imports)
Low-power remote microcontrollers (like ESP32-CAM) do not possess the memory or processing power to compile TensorFlow face recognition models. In this mode, they capture image frames and POST them directly via HTTP (base64 or multipart) to the backend route `/api/iot/attendance`. The Node backend uses `@vladmandic/face-api` (patched with node-canvas) to decode the frame, detect faces, compare vectors with the registered student list in MongoDB, mark attendance, and return results.

Similarly, during **Bulk Excel Importer uploads**, the server extractszipped passport photos, loads them into `canvas` buffers, runs the neural face recognition pipeline in Node.js to extract the 128-float biometric embeddings automatically, and saves the student profiles in MongoDB.

---

## 📂 Project Structure

```
SIC_IOT/
├── backend/
│   ├── config/              # MongoDB connection
│   ├── controllers/         # REST Controllers (Auth, Student, Attendance, unknown, IoT, Import)
│   ├── middleware/          # JWT auth & admin guard middleware
│   ├── models/              # Mongoose Schemas (User, Student, Attendance, UnknownDetection)
│   ├── models_faceapi/      # Backend Face-API.js neural weights (shards)
│   ├── routes/              # Express API Routes (including importRoutes.js)
│   ├── scripts/             # Model download and database seeding utilities
│   ├── services/            # Face recognition server-side service wrapper
│   ├── uploads/             # Static storage folder (including unzipped student photos)
│   ├── .env                 # Environment variables
│   ├── package.json         # Backend node scripts & dependencies
│   └── server.js            # Entry point
└── frontend/
    ├── public/
    │   └── models/          # Frontend Face-API.js neural weights (shards)
    ├── src/
    │   ├── components/      # Sidebar, WebcamFeed overlays
    │   ├── context/         # AuthContext, ThemeContext
    │   ├── hooks/           # useFaceApi React hook
    │   ├── pages/           # Login, Dashboard, RegisterStudent, BulkImport, ScanTerminal, Records
    │   ├── services/        # Axios API clients
    │   ├── App.jsx          # Route gates
    │   ├── index.css        # Tailwind directives and cyber glows
    │   └── main.jsx         # Render entry point
```

---

## ⚡ Setup & Installation

### Prerequisites
- Node.js (v16.x or higher)
- MongoDB running locally (`mongodb://localhost:27017`) or a MongoDB Atlas URI

### 1. Configure Environment variables
Create a `.env` file in the `backend/` folder:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/face_attendance_system
JWT_SECRET=super_secure_smart_campus_key_2026_face_recognition_iot
NODE_ENV=development
```

### 2. Run automated models downloader
The neural networks weights files must be downloaded and stored locally. Run this script to automatically fetch all the weights and copy them to both backend and frontend public directories:
```bash
cd backend
npm run download-models
```

### 3. Seed demo accounts
Initialize the MongoDB database with default administrator and teacher credentials for evaluation:
```bash
npm run seed
```

Default credentials seeded:
- **System Administrator** (Full CRUD permissions):
  - Email: `admin@campus.edu`
  - Password: `admin123`
- **Teacher Registrar** (Read & check-in logging permissions):
  - Email: `teacher@campus.edu`
  - Password: `teacher123`

### 4. Run the services
Start the Node Express API server:
```bash
cd backend
npm run dev
```

Start the React Vite development server (proxies API requests to port 5000):
```bash
cd frontend
npm install
npm run dev
```
Open your browser at `http://localhost:3000`.

---

## 📊 Bulk Student Importer Specifications

The system supports registering 1000+ students concurrently via spreadsheet datasets and a ZIP archive of passport photos.

### 1. Spreadsheet Format (.xlsx or .csv)
Your uploaded Excel or CSV sheet should contain the following headers:

| Student Name | USN | Department | Semester | Section | Email (optional) | Phone (optional) | Passport Photo |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Bhavana M P | 1SG22CS001 | CSE | 6 | A | bhavana@campus.edu | 9876543210 | bhavana.jpg |
| John Doe | 1SG22CS002 | CSE | 6 | B | john@campus.edu | 9876543211 | 1SG22CS002.png |

*Note: The `Passport Photo` column specifies the filename of the student's photo inside the uploaded ZIP archive. If omitted, the system will automatically look for `<USN>.jpg` or `<USN>.png` inside the ZIP.*

### 2. Photos ZIP Structure (.zip)
The ZIP file should contain all the passport photo files flat or within subdirectories:
```
photos.zip/
├── bhavana.jpg
├── 1SG22CS002.png
└── class_photos/
    └── 1SG22CS003.jpg
```

### 3. API Import Endpoint
- **URL**: `/api/students/import`
- **Method**: `POST`
- **Auth**: Required (`admin` role only, Bearer Token)
- **Content-Type**: `multipart/form-data`
- **Payload**:
  - `excel`: Excel/CSV file binary attachment
  - `zip`: ZIP archive binary attachment

---

## 📡 IoT Node Integration: ESP32-CAM Template

Here is a ready-to-run ESP32-CAM firmware configuration using the Arduino IDE. Set up the camera pins, connect to WiFi, capture a photo frame, and POST the binary payload directly to the Express server route.

```cpp
#include "esp_camera.h"
#include <WiFi.h>
#include <HTTPClient.h>

// WiFi Settings
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Server API Endpoint
const char* serverUrl = "http://YOUR_SERVER_IP:5000/api/iot/attendance";
const char* deviceId = "esp32_cam_class_a";

// Camera Pin Configurations (AI-Thinker Model)
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

void setup() {
  Serial.begin(115200);
  
  // WiFi Connection
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected!");

  // Camera Settings
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;

  // Frame size adjustment
  if(psramFound()){
    config.frame_size = FRAMESIZE_VGA; // 640x480 resolution (Ideal for face detection)
    config.jpeg_quality = 12;
    config.fb_count = 2;
  } else {
    config.frame_size = FRAMESIZE_SVGA;
    config.jpeg_quality = 12;
    config.fb_count = 1;
  }

  // Camera initialization
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed with error 0x%x", err);
    return;
  }
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    captureAndSendAttendance();
  }
  delay(5000); // Capture and scan every 5 seconds
}

void captureAndSendAttendance() {
  camera_fb_t * fb = esp_camera_fb_get();
  if(!fb) {
    Serial.println("Camera capture failed");
    return;
  }

  HTTPClient http;
  http.begin(serverUrl);
  
  // Set headers
  http.addHeader("x-device-id", deviceId);
  
  // Custom boundary for multipart POST
  String boundary = "ESP32CAMMultipartBoundary";
  http.addHeader("Content-Type", "multipart/form-data; boundary=" + boundary);

  // Compile payload body
  String head = "--" + boundary + "\r\nContent-Disposition: form-data; name=\"image\"; filename=\"capture.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n";
  String tail = "\r\n--" + boundary + "--\r\n";
  
  uint32_t extraLen = head.length() + tail.length();
  uint32_t totalLen = fb->len + extraLen;

  // Stream data over HTTP POST
  int httpResponseCode = http.sendRequest("POST", (uint8_t*)head.c_str(), head.length(), fb->buf, fb->len, (uint8_t*)tail.c_str(), tail.length());
  
  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.println("Response: " + response);
  } else {
    Serial.printf("Error code on sending POST: %d\n", httpResponseCode);
  }

  http.end();
  esp_camera_fb_return(fb);
}
```
