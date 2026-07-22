# PlateQ - Real-Time ANPR/LPR Malaysian Vehicle Detector

**PlateQ** ialah sistem pengesan nombor plat kenderaan Malaysia berasaskan web (*real-time ANPR/LPR system*) yang dibina khas untuk kegunaan ejen repossession / penarik kereta.

Sistem ini beroperasi secara langsung melalui kamera telefon pintar, tablet atau komputer tanpa memerlukan pengguna menekan butang capture atau memuat naik foto secara manual.

---

## 🌟 Ciri-ciri Utama (Main Features)

1. **Aliran Kamera Langsung (Live Camera Pipeline)**:
   - Akses secara automatik ke kamera belakang peranti (`facing mode: environment`).
   - Pilihan penukaran kamera (*camera switch*), tetapan resolusi (480p, 720p, 1080p), dan kawalan lampu suluh (*torch/flashlight*).
2. **Pengesanan & Penjejakan Plat (Plate Detection & Tracking)**:
   - IoU (*Intersection over Union*) Tracker untuk mengesan dan menjejak sehingga 5 plat secara serentak merentas beberapa frame video.
   - Papan panduan visual sasaran (*alignment crosshair*) dan kotak pengesan (*bounding boxes*) secara *real-time*.
3. **Pengecaman & Multi-frame Consensus (OCR Engine)**:
   - Pemprosesan imej canvas (potongan plat, grayscale, penstrukturan kontras adaptif).
   - Pengenalan huruf & nombor Malaysia (whitelist A-Z dan 0-9).
   - Sistem pengundian multi-frame (*multi-frame voting*) untuk memastikannya stabil sebelum menyemak database.
4. **Normalisasi & Padanan Database (Plate Normalisation & Matching)**:
   - Pembersihan simbol, jarak, dash dan penukaran automatik ke huruf besar (`ANN 7569` → `ANN7569`).
   - Penjana alternatif kekeliruan aksara OCR (contoh: O/0, I/1, B/8, S/5, Z/2, G/6) untuk padanan *Possible Match*.
   - Amaran kritikal segera (*Exact Match*) dengan audio alarm Web Audio API dan getaran peranti (*Vibration API*).
   - Kawalan amaran duplikasi (*duplicate suppression cooldown*) untuk mengelakkan amaran berulang.
5. **Modul Pengurusan Kenderaan & CRUD (Manage Vehicles)**:
   - Pilihan carian, penapis status kes (*ACTIVE*, *ON_HOLD*, *RECOVERED*, *CLOSED*).
   - Modal Tambah, Edit, dan Padam kenderaan dengan pengesahan (*confirmation modal*).
   - Import & Export fail CSV dengan validasi baris, duplikasi dan cadangan template CSV.
6. **Halaman Plat Demo Interaktif (`/demo-plates`)**:
   - Menyediakan 8 plat sampel (seperti `JSD8888`, `ANN7569`, `WXY77B8`, `ABC9999`) dalam format gaya nombor plat Malaysia.
   - Boleh dibuka pada telefon lain atau dicetak untuk menguji kebolehan pengesanan kamera secara langsung.
7. **Mod Pengurusan Tetapan & Audit History (`/settings` & `/history`)**:
   - Rekod log sejarah carian dan pengesanan kamera.
   - Kawalan ambang keyakinan (*detection threshold*), undian consensus, dan mod debug FPS.

---

## 🛠️ Teknologi Yang Digunakan (Tech Stack)

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Lucide Icons
- **Inference & ANPR**: HTML5 MediaDevices API, Canvas API 2D Preprocessing, Web Worker OCR Engine (Tesseract.js with alphanumeric whitelist), IoU Plate Tracker
- **Database & Persistence**: Repository Pattern berasaskan fail JSON tempatan (`.data/plateq.json`) dengan *in-memory fallback* automatik untuk persekitaran serverless Vercel.
- **Audio & Feedback**: Web Audio API Sound Synthesizer, HTML5 Vibration API
- **Testing**: Vitest unit testing framework

---

## 🚀 Arahan Pemasangan & Pembangunan (Setup & Running)

### 1. Prasyarat
- Node.js versi 18.x ke atas
- npm (Node Package Manager)

### 2. Pemasangan Dependencies
```bash
npm install
```

### 3. Menjalankan Server Pembangunan (Development Server)
```bash
npm run dev
```
Buka pelayar di `http://localhost:3000`.

### 4. Menjalankan Ujian Unit (Unit Tests)
```bash
npm test
```

### 5. Membina Versi Produksi (Production Build)
```bash
npm run build
```

---

## 🧪 Cara Menguji Match Menggunakan Kamera Langsung (Live Camera Testing)

1. Buka laman **PlateQ** di komputer atau telefon anda.
2. Navigasi ke halaman **Demo Plates** (`/demo-plates`) pada skrin telefon lain atau cetak pada kertas.
3. Pada peranti pengimbas, buka menu **Scanner** (`/scanner`).
4. Halakan kamera ke arah nombor plat demo seperti **`JSD8888`** atau **`ANN7569`**.
5. Sistem akan:
   - Mengesan kawasan nombor plat secara automatik.
   - Melukis bounding box berwarna pada paparan kamera.
   - Membaca nombor plat merentas beberapa frame.
   - Menyemak database kes aktif.
   - Mengeluarkan modal amaran merah **MATCH FOUND** berserta bunyi alarm dan getaran.

---

## 📂 Struktur Projek (Project Architecture)

```
plate-Q/
├── src/
│   ├── app/
│   │   ├── layout.tsx (Root Layout & Viewport)
│   │   ├── page.tsx (Dashboard Overview)
│   │   ├── search/page.tsx (Manual Search Page)
│   │   ├── scanner/page.tsx (Live Camera ANPR Scanner)
│   │   ├── manage/page.tsx (Manage Vehicles & CSV CRUD)
│   │   ├── history/page.tsx (Scan & Search History Logs)
│   │   ├── settings/page.tsx (System & Scanner Settings)
│   │   ├── demo-plates/page.tsx (Interactive Demo Plates Viewer)
│   │   └── api/ (Next.js Server API Routes)
│   ├── components/
│   │   ├── layout/ (Header, BottomNav)
│   │   └── dashboard/ (StatCard)
│   ├── lib/
│   │   ├── anpr/ (normaliser.ts, tracker.ts, consensus.ts, imageProcessor.ts, ocrEngine.ts)
│   │   ├── db/ (types.ts, seedData.ts, repository.ts)
│   │   └── utils/ (audio.ts, csv.ts)
│   └── __tests__/ (anpr.test.ts)
├── .data/ (Local JSON persistent storage)
└── package.json
```

---

## ⚠️ Had & Penafian Deployment (Limitations & Disclaimer)

1. **Keperluan HTTPS Kamera**: Akses kamera (`getUserMedia`) dalam pelayar memerlukan sambungan secure **HTTPS** atau `localhost` semasa ujian tempatan.
2. **Penyimpanan Fail di Vercel**: Vercel beroperasi dalam persekitaran *read-only serverless*. Sistem PlateQ menggunakan *in-memory repository fallback* apabila dideploy ke Vercel supaya data demo kekal boleh diuji tanpa merosakkan aplikasi.
3. **Penafian Repossession**: PlateQ ialah sistem Proof-of-Concept. Semua hasil pengesanan dan padanan mungkin hendaklah disahkan secara visual sebelum sebarang tindakan diambil.
