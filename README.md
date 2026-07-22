# PlateQ — Web-Based ANPR Proof of Concept (POC)

> **PlateQ ialah Proof of Concept web-based untuk live camera plate scanning, pengurusan kes kenderaan dan padanan nombor plat Malaysia.**
>
> Ketepatan ANPR bagi kenderaan bergerak, pelbagai format plat Malaysia dan keadaan dunia sebenar **masih memerlukan trained Malaysian plate detector, plate-specific recognition model serta field validation** sebelum boleh digunakan dalam operasi sebenar.

---

## ⚠️ Status Semasa — Baca Sebelum Deploy

| Bahagian | Status |
| --- | --- |
| Dashboard, CRUD dan CSV | ✅ Siap untuk POC |
| Carian manual dan database matching | ✅ Siap |
| Live camera preview | ✅ Siap |
| Multi-frame voting consensus | ✅ Ada |
| Duplicate suppression cooldown | ✅ Ada |
| Malaysian Plate Pattern Registry (13 kategori) | ✅ Ada |
| Responsive phone, tablet dan desktop | ✅ Siap |
| **Pengesanan plat sebenar menggunakan trained AI model** | ❌ Belum — menggunakan CV heuristic |
| **Ketepatan kereta bergerak** | ❌ Belum dibuktikan |
| **Kamera bergerak** | ❌ Belum dibuktikan |
| **Beberapa plat serentak (ujian sebenar)** | ❌ Belum dibuktikan |
| **Plat Malaysia pelbagai format (ujian lapangan)** | ❌ Belum dibuktikan |
| **Prestasi malam / glare / refleksi** | ❌ Belum dibuktikan |
| **Database production persistent** | ❌ Belum sesuai (in-memory fallback) |
| **Production-ready** | ❌ Belum |

---

## Apa yang sudah ada

PlateQ mempunyai antara muka penuh, aliran kerja, dan pipeline ANPR asas yang berfungsi sebagai POC:

1. **Antara muka lengkap** — Dashboard, carian, pengimbas kamera, CRUD kenderaan, history, settings, CSV import/export.
2. **Live camera preview** — Menggunakan HTML5 `MediaDevices.getUserMedia()` dengan kamera belakang secara automatik.
3. **Malaysian Plate Pattern Registry** — 13 keluarga plat dikodkan dalam `src/lib/anpr/patterns.ts`:
   - Standard Peninsular (`JSD8888`, `ANN7569`)
   - Letter-Number-Suffix (`W1234A`, `V123A`)
   - Sabah (`SAB1234`, `SA1234A`)
   - Sarawak (`QAA1234`, `QK1234`)
   - Langkawi dengan suffix (`KV1234E`)
   - Putrajaya (`PUTRAJAYA1234`)
   - EV Special JPJePlate (`EV1234`)
   - Diplomatik (`1122DP`, `DP1234`)
   - Kerajaan / Penguatkuasaan (`Z1234`, `POLIS1234`, `JKR1234`)
   - Siri Khas (`MADANI1`, `PATRIOT123`)
   - Motosikal 2-baris (`ABC/1234`)
   - Institusi (`UTM1234`, `UKM1234`)
   - Fallback kandidat sah
4. **IoU Multi-Object Tracker** — Mengekalkan identiti track merentas frame menggunakan Intersection over Union.
5. **Tesseract.js OCR Baseline** — Membaca aksara alphanumeric dengan whitelist `A-Z0-9`.
6. **Multi-frame consensus** — Mengundi keputusan OCR merentas beberapa frame sebelum menyemak database.
7. **Database-aware candidate ranking** — `EXACT MATCH` → `POSSIBLE MATCH` → `NONE` → `INSUFFICIENT_CONFIDENCE`.
8. **Character confusion engine** — Penjanaan kandidat positional untuk O/0, I/1, B/8, S/5, Z/2, G/6, A/4.
9. **Adaptive preprocessing variants** — Original, Grayscale/CLAHE, Inverted (untuk plat putih JPJePlate/teksi), 2-line splitter.
10. **9/9 unit tests lulus** — `npm test` dan `npm run build` berjaya.

---

## Apa yang belum ada — Keterbatasan Jujur

### 1. Tiada trained plate detector

Pipeline pengesanan semasa menggunakan **heuristic berasaskan tepi (edge density + contrast sliding window + NMS)**.

Bounding box untuk tracker datang dari:
- Sambungan Sobel edge filter
- Variance / contrast score
- Nisbah aspek plate-like region

Ini adalah **computer vision klasik, bukan trained neural network**.

Fail model seperti `plate-detector.onnx`, `LPRNet`, `CRNN`, `PP-OCR`, atau `YOLOv8-LP` **tidak wujud dalam projek ini**.

**Implikasi**: Pengesanan akan gagal atau tidak stabil untuk:
- Plat kecil di jarak jauh
- Plat yang separa tertutup
- Sudut steeper dari biasa
- Pencahayaan rendah
- Kereta bergerak laju
- Beberapa kereta dalam frame yang padat

### 2. Tesseract.js belum cukup untuk penggunaan lapangan

Tesseract boleh membaca plat demo yang besar dan jelas di skrin atau kertas. Tetapi **tidak terjamin** untuk:
- Kereta bergerak (*motion blur*)
- Kamera bergerak (*camera shake*)
- Plat kecil (motosikal, jarak jauh)
- Plat senget / perspektif tinggi
- Cahaya malam dan refleksi
- Plat kotor atau berhabuk
- Dua baris (bergantung pada heuristic splitter)
- JPJePlate EV, Sabah, Sarawak dalam keadaan sebenar

### 3. Membaca plat demo bukan ujian sebenar

Membaca `JSD8888` dari skrin telefon lain atau kertas cetak adalah **ujian OCR asas sahaja**, bukan ujian ANPR lapangan.

Ujian sebenar memerlukan:
- Plat sebenar pada bumper kenderaan
- Jarak beberapa meter
- Kereta bergerak
- Kamera bergerak (dalam tangan atau dipasang)
- Beberapa kenderaan dalam frame secara serentak

### 4. "Sehingga 8 track" belum bermaksud benar-benar boleh baca 8 plat

Tracker menyimpan sehingga 8 objek. Tetapi ini belum bermaksud:
- 8 bounding box datang dari detector sebenar
- OCR setiap plat tidak bercampur antara track
- Database check berlaku secara bebas untuk setiap track
- 2 match muncul pada masa yang sama dalam ujian lapangan

### 5. Penyimpanan bukan untuk production

Sistem menggunakan `.data/plateq.json` (fail tempatan) dengan **in-memory fallback** untuk Vercel.

Data mungkin:
- Hilang apabila instance restart
- Tidak konsisten antara server instances
- Hilang selepas deployment baru
- Tidak sesuai untuk beberapa pengguna serentak
- Tidak sesuai untuk audit kes operasi sebenar

Untuk production, gunakan **PostgreSQL**, **MySQL** atau database persistent yang lain.

---

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Lucide Icons
- **Live Camera**: HTML5 `MediaDevices.getUserMedia()`, Canvas API
- **Inference & ANPR (POC Baseline)**:
  - Full-frame plate candidate detection pipeline (CV heuristic — sliding window + edge score + NMS)
  - IoU tracking untuk mengekalkan identiti plat merentas frame
  - Canvas-based adaptive crop preprocessing (Original, Grayscale/CLAHE, Inverted, 2-line splitter)
  - Tesseract.js OCR sebagai baseline POC
  - Multi-frame consensus voting (per-track, tidak bercampur)
  - Malaysian plate normalisation (13 keluarga) dan database-aware candidate ranking
- **Audio & Feedback**: Web Audio API, HTML5 Vibration API
- **Database**: Repository pattern, fail JSON lokal, in-memory fallback
- **Testing**: Vitest (9 unit tests, `npm test` lulus)

> **Had**: Sistem masih menggunakan OCR heuristic baseline.
> Trained Malaysian plate detector dan plate-specific recognition model perlu disahkan sebelum production.

---

## Acceptance Criteria Sebelum Production-Ready

PlateQ hanya boleh dianggap sedia digunakan apabila mempunyai:

- [ ] Trained number plate detector sebenar (contoh: YOLOv8-LP, PP-OCRv3, atau setara)
- [ ] Fail model yang boleh dikenal pasti dan dimuatkan (`plate-detector.onnx` atau setara)
- [ ] Plate-specific recognition model yang dilatih dengan plat Malaysia sebenar
- [ ] Full-frame detection tanpa fixed centre crop
- [ ] Multi-vehicle tracking diuji dengan kenderaan sebenar
- [ ] Ujian plat sebenar pada bumper (bukan plat demo di skrin)
- [ ] Ujian kereta bergerak
- [ ] Ujian kamera bergerak
- [ ] Ujian siang dan malam
- [ ] Ujian plat Sabah, Sarawak, Langkawi, EV, dua baris dan motosikal
- [ ] Laporan full-plate accuracy mengikut kategori
- [ ] False exact match rate dilaporkan
- [ ] Purata masa detection (P50 dan P95 latency)
- [ ] Database production yang persistent (PostgreSQL atau setara)
- [ ] Pengesahan undang-undang dan akses data kes

---

## Arahan Pemasangan & Pembangunan

```bash
# Pemasangan dependencies
npm install

# Development server
npm run dev
# Buka http://localhost:3000

# Unit tests
npm test

# Production build
npm run build
```

---

## Struktur Projek

```
plate-Q/
├── src/
│   ├── app/
│   │   ├── page.tsx                    (Dashboard)
│   │   ├── search/page.tsx             (Carian Manual)
│   │   ├── scanner/page.tsx            (Live Camera ANPR Scanner)
│   │   ├── manage/page.tsx             (CRUD Kenderaan + CSV)
│   │   ├── history/page.tsx            (Log Sejarah)
│   │   ├── settings/page.tsx           (Tetapan Sistem)
│   │   ├── demo-plates/page.tsx        (Plat Demo Interaktif)
│   │   └── api/                        (Next.js API Routes)
│   ├── lib/
│   │   ├── anpr/
│   │   │   ├── patterns.ts             (Malaysian Plate Pattern Registry — 13 kategori)
│   │   │   ├── matchingEngine.ts       (Database-Aware Candidate Ranking)
│   │   │   ├── normaliser.ts           (Normalisasi + Character Confusion Engine)
│   │   │   ├── imageProcessor.ts       (Adaptive Preprocessing + Full-Frame Detector)
│   │   │   ├── ocrEngine.ts            (Tesseract.js OCR — Baseline POC)
│   │   │   ├── tracker.ts              (IoU Multi-Object Tracker)
│   │   │   ├── consensus.ts            (Multi-Frame Consensus Voting)
│   │   │   └── validationManifest.ts   (Test Dataset — 13 kategori)
│   │   ├── db/
│   │   │   ├── types.ts                (PlateCategory, PlateLayout, VehicleCase, ScannerSettings)
│   │   │   ├── seedData.ts             (12 contoh kenderaan pelbagai kategori)
│   │   │   ├── settingsDefaults.ts     (Default Settings)
│   │   │   └── repository.ts           (Repository Pattern + JSON persistence)
│   │   └── utils/
│   │       ├── audio.ts                (Web Audio API)
│   │       └── csv.ts                  (CSV Import/Export + Validation)
│   └── __tests__/
│       └── anpr.test.ts                (9 Unit Tests — semua lulus)
└── package.json
```

---

## Had & Penafian

1. **Keperluan HTTPS**: Akses kamera memerlukan HTTPS atau `localhost`.
2. **Penyimpanan Vercel**: In-memory fallback — data tidak persistent antara restarts.
3. **Penafian Operasi**: PlateQ ialah Proof-of-Concept. Semua keputusan pengesanan hendaklah disahkan secara visual sebelum sebarang tindakan operasi diambil.
4. **Ketepatan ANPR**: Sistem belum diuji dengan kenderaan bergerak, plat sebenar, keadaan malam atau beberapa kenderaan dalam frame secara serentak. Jangan gunakan dalam operasi lapangan tanpa ujian lapangan penuh dan pengesahan model yang sesuai.
