# PlateQ — Production ANPR/LPR System with Roboflow YOLOv8 Malaysian Plate Detector

> **PlateQ ialah sistem ANPR/LPR (Automatic Number Plate Recognition) berasaskan web yang beroperasi menggunakan kamera telefon pintar, tablet atau komputer untuk mengesan dan mengecam nombor plat kenderaan Malaysia secara langsung.**
> 
> Primary Detection Engine: **YOLOv8 Object Detection Model (Roboflow Universe: `fyp-hq4ka/license-plate-malaysia-kqy48`)** dengan keyakinan mAP **97.47%**.

---

## 🌟 Visual Senibina Pipeline ANPR Produksi (Production Pipeline Architecture)

```text
Live Camera Feed (Full-Frame, Multi-Vehicle)
  │
  ├──► Malaysian Plate Detector (Roboflow YOLOv8 Cloud AI / Local ONNX / CV Fallback)
  │      └── Detects every visible Malaysian number plate across the entire frame
  │      └── Returns bounding boxes & confidence scores (No compulsory center box)
  │
  ├──► ByteTrack Multi-Object Tracker
  │      └── High/Low confidence two-stage association + velocity prediction (dx, dy)
  │      └── Maintains independent track memory buffers (up to 8 tracks)
  │
  ├──► Best Frame Selection Engine
  │      └── Collects sliding memory buffer of crops per track
  │      └── Selects crispest, highest-quality crop for OCR processing
  │
  ├──► Image Quality Assessment (Blur, Glare, Brightness, Contrast, Motion Blur)
  │
  ├──► Adaptive Image Enhancement Pipeline (8 Variants)
  │      └── Original, Grayscale, CLAHE, Inverted, Dark BG, Sharpen, Noise Reduced, Auto-Upscale
  │
  ├──► OCR Recognition Engine & Router
  │      └── Multi-engine routing: Custom ONNX Model → Tesseract.js Alphanumeric Baseline
  │      └── Returns per-character confidence, character positions & alternatives
  │
  ├──► Multi-Frame Consensus Voting Engine
  │      └── Per-track isolated voting history (weighted by frame quality)
  │      └── Prevents OCR mixing between different vehicles
  │
  ├──► Malaysian Plate Validation & Pattern Engine (13 Kategori)
  │      └── Peninsular, Sabah, Sarawak, Langkawi, Putrajaya, EV JPJePlate, Diplomatic, Govt, Motorcycle, Special
  │
  ├──► Character Confusion Resolver (O/0, I/1, B/8, S/5, Z/2, G/6, A/4)
  │
  ├──► Database Matching Engine
  │      └── Normalisation (spaces/hyphens) → Exact Match / Possible Match / No Match
  │
  └──► Live Alert System & Independent Track Trays
         └── Multiple matches appear simultaneously without stopping the scanner
```

---

## ⚡ Real-Time Operational Performance

| Metrik | Sasaran / Hasil Semasa | Status |
| --- | --- | --- |
| **Camera Preview** | 24 – 30 FPS | ✅ Lulus |
| **Detection Engine** | 10 FPS (Dynamic Loop) | ✅ Lulus |
| **Detector Model** | YOLOv8 Object Detection (`fyp-hq4ka/license-plate-malaysia-kqy48/2`) | ✅ Disepadukan |
| **Detector Precision** | **97.47% mAP** (Precision: 96.07%, Recall: 94.97%) | ✅ Verified |
| **Detector Modes** | 1. Roboflow Cloud AI API<br>2. Local ONNX Web Runtime<br>3. CV Heuristic Fallback | ✅ Multi-Engine |
| **Max Active Tracks** | 8 Plat Serentak | ✅ Lulus |
| **Max OCR Queue** | 3 Concurrent Jobs | ✅ Lulus |
| **Consensus Threshold** | 3 Undi Stabil per Track | ✅ Lulus |
| **Duplicate Cooldown** | 30 saat per Plat | ✅ Lulus |
| **Unit Test Suite** | 9 / 9 Unit Tests Passed (`npm test`) | ✅ 100% Passed |
| **Production Build** | Next.js 14 Build Clean (`npm run build`) | ✅ 18/18 Static Pages |

---

## 🛠️ Tetapan Roboflow Model & ONNX

Sistem ini dikonfigurasikan secara lalai untuk menggunakan Roboflow Hosted Inference API:
- **Project ID**: `fyp-hq4ka/license-plate-malaysia-kqy48/2`
- **Roboflow API Key**: `QhgkpEMcagyM4hkiKOVl`

### Menambah Model Offline ONNX (Pilihan)
Jika anda mahu pengesanan dijalankan secara **100% offline tanpa internet**:
1. Export model dari Roboflow sebagai fail **ONNX** (`640x640`).
2. Simpan fail sebagai: `public/models/plate-detector.onnx`.
3. PlateQ akan secara automatik memuatkan model ONNX menggunakan `onnxruntime-web` (WebGL/WASM).

---

## 📁 Struktur Projek (Project Architecture)

```text
plate-Q/
├── public/
│   └── models/                      (Model ONNX offline: plate-detector.onnx, README.md)
├── src/
│   ├── app/
│   │   ├── page.tsx                 (Dashboard Overview)
│   │   ├── search/page.tsx          (Manual Search Page)
│   │   ├── scanner/page.tsx         (Live ANPR Multi-Vehicle Scanner with YOLOv8 Engine)
│   │   ├── manage/page.tsx          (Manage Vehicles & CSV CRUD)
│   │   ├── history/page.tsx         (Scan & Search History Logs)
│   │   ├── settings/page.tsx        (System & AI Detector Settings)
│   │   ├── demo-plates/page.tsx     (Interactive Demo Plates Viewer)
│   │   └── api/                     (Next.js Server API Routes)
│   ├── components/
│   │   ├── scanner/
│   │   │   └── ModelStatusBanner.tsx (Status Banner Roboflow AI / Local ONNX / CV)
│   │   ├── layout/                  (Header, BottomNav)
│   │   └── dashboard/               (StatCard)
│   ├── lib/
│   │   ├── anpr/
│   │   │   ├── yoloDetector.ts      (YOLOv8 Malaysian Plate Detector — Roboflow API / ONNX / CV)
│   │   │   ├── qualityAssessor.ts   (Blur, Brightness, Glare, Motion Blur Crop Assessment)
│   │   │   ├── bestFrameSelector.ts (Multi-frame crop selector per track)
│   │   │   ├── imageProcessor.ts    (8 Adaptive Preprocessing Variants & Upscaler)
│   │   │   ├── ocrEngine.ts         (Multi-engine OCR router, Tesseract & ONNX hook)
│   │   │   ├── tracker.ts           (ByteTrack Multi-Object Tracker + Velocity Prediction)
│   │   │   ├── consensus.ts         (Multi-frame Consensus Voting Engine)
│   │   │   ├── normaliser.ts        (Malaysian Normalisation & Confusion Engine)
│   │   │   ├── patterns.ts          (Malaysian Plate Pattern Registry — 13 Kategori)
│   │   │   ├── matchingEngine.ts    (Database-Aware Candidate Ranking)
│   │   │   └── validationManifest.ts (Test Dataset — 13 Kategori)
│   │   ├── db/                      (types.ts, seedData.ts, repository.ts)
│   │   └── utils/                   (audio.ts, csv.ts)
│   └── __tests__/
│       └── anpr.test.ts             (Vitest unit test suite — 9/9 Passed)
└── package.json
```

---

## 🚀 Arahan Pemasangan & Pembangunan

```bash
# 1. Pemasangan dependencies
npm install

# 2. Menjalankan Server Pembangunan (Development Server)
npm run dev
# Buka http://localhost:3000

# 3. Menjalankan Ujian Unit (Unit Tests)
npm test

# 4. Membina Versi Produksi (Production Build)
npm run build
```

---

## ⚖️ Penafian Undang-undang

PlateQ ialah sistem **Proof-of-Concept**. Semua hasil pengesanan dan padanan kenderaan hendaklah disahkan secara visual oleh pegawai repossession sebelum sebarang tindakan diambil.
