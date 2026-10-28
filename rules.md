# Project Guidelines & Rules: Motion Stock Engine

Dokumen ini berisi standar, aturan pengembangan, struktur proyek, dan spesifikasi teknis untuk pengembangan **Motion Stock Engine**. Engine ini bertugas meng-generate video animasi gerak (motion video) berbasis web technologies (HTML, CSS, JavaScript) dengan rendering berbasis Playwright dan stitching berbasis FFmpeg untuk kebutuhan aset komersial di **Adobe Stock Video**.

---

## 1. Deskripsi & Tujuan Proyek

- **Tujuan Utama**: Membuat motion video berkualitas komersial tinggi yang memenuhi standar kurasi ketat Adobe Stock.
- **Konsep Teknis**: Animasi dibuat menggunakan kode web (HTML/CSS/JS/Canvas/SVG/WebGL) secara presisi, dirender per frame secara deterministik melalui Playwright (Headless Chromium), lalu dikompilasi menjadi video MP4 berkualitas tinggi menggunakan FFmpeg.

---

## 2. Struktur Folder & Tanggung Jawab File

Struktur direktori wajib mengikuti arsitektur berikut:

```text
motion-stock-engine/
├── index.html       # Visual, layout, dan logika animasi (timeline & rendering target)
├── render.mjs       # Script Node.js Playwright untuk menangkap screenshot frame per frame & trigger FFmpeg
├── package.json     # Konfigurasi dependensi Node.js & script eksekusi
├── frames/          # Direktori penampungan sementara file screenshot (PNG)
├── output/          # Direktori hasil video akhir (.mp4)
├── rules.md         # Dokumen aturan dan standar proyek ini
└── prompt.txt       # Catatan prompt / referensi pengembangan
```

### Penjelasan Komponen:
1. **`index.html`**:
   - Berisi canvas/DOM container animasi beresolusi tetap (1920x1080).
   - Wajib menyediakan hook / API waktu deterministik (misalnya fungsi global `window.seekToFrame(frameIndex, totalFrames)` atau `window.seekToProgress(progress)`).
   - Seluruh styling dan script animasi diutamakan self-contained atau modular tanpa dependensi external CDN yang tidak stabil.
2. **`render.mjs`**:
   - Menggunakan Playwright Chromium dengan viewport tetap `1920x1080` (deviceScaleFactor: 1).
   - Menghitung total frame: $\text{Total Frame} = \text{Durasi (detik)} \times \text{FPS}$.
   - Melakukan loop pengambilan screenshot per frame secara berurutan dan menyimpannya ke folder `frames/frame_%04d.png`.
   - Menjalankan perintah FFmpeg setelah seluruh frame selesai dirender.
3. **`frames/`**:
   - Tempat penyimpanan frame PNG sementara selama proses rendering berlangsung.
   - Wajib dibersihkan secara otomatis sebelum rendering baru dimulai untuk mencegah frame sisa bercampur.
4. **`output/`**:
   - Menyimpan hasil akhir video `.mp4`.
   - File diberi nama deskriptif berdasarkan tema dan timestamp (misal: `abstract_particles_1080p_30fps.mp4`).

---

## 3. Alur Kerja (Pipeline)

```
┌──────────────┐     Playwright      ┌─────────────┐     FFmpeg      ┌─────────────────┐
│  index.html  │  ───────────────►   │   frames/   │  ───────────►   │   output/*.mp4  │
│  (Animasi)   │   (Frame capture)   │  (*.png)    │   (Encode)      │  (Adobe Stock)  │
└──────────────┘                     └─────────────┘                 └─────────────────┘
```

1. **Desain & Preview**: Buka `index.html` langsung di browser lokal untuk melihat visual dan mengatur pergerakan animasi secara interaktif.
2. **Deterministic Stepping**: Pastikan animasi tidak mengandalkan `Date.now()` atau `performance.now()` yang berjalan bebas (free-running time), melainkan di-drive oleh frame counter atau controlled progress.
3. **Automated Capture (`render.mjs`)**: Script Playwright membuka page, mengatur ukuran viewport, memanggil fungsi advance frame, dan mengambil screenshot lossless PNG per frame.
4. **FFmpeg Compilation**: Menggabungkan file urutan PNG menjadi video MP4 dengan profil encode optimal.
5. **Quality Review**: Meninjau hasil video akhir di `output/` sebelum diunggah ke Adobe Stock.

---

## 4. Spesifikasi & Kriteria Video (Adobe Stock Requirements)

Semua output video wajib memenuhi spesifikasi berikut:

| Parameter | Spesifikasi Wajib | Keterangan / Rekomendasi |
| :--- | :--- | :--- |
| **Format File** | `.mp4` | Format standar Adobe Stock |
| **Resolusi** | **Full HD (1920 x 1080)** | Aspect Ratio 16:9 wajib presisi |
| **Frame Rate** | **Minimal 30 fps** (30 fps atau 60 fps) | 30 fps untuk standar, 60 fps untuk ultra-smooth motion |
| **Durasi** | **5 – 15 detik** | Wajib berada dalam rentang 5-15 detik |
| **Codec Video** | **H.264** (`libx264`) | Kompatibel dengan spesifikasi h264/ProRes/PNG |
| **Pixel Format** | `yuv420p` | Wajib untuk kompatibilitas pemutar video & upload stock |
| **Color Space** | sRGB / Rec.709 | Menghindari pergeseran warna (color shift) saat di-encode |
| **Audio** | Tanpa Audio (Silent) | Adobe Stock video motion umumnya tidak memerlukan audio |

---

## 5. Standar Coding & Implementasi Teknis

### A. Aturan Animasi pada `index.html`
1. **Resolusi Kanvas**:
   - Root elemen / canvas harus berukuran tepat `width: 1920px; height: 1080px;`.
   - Hilangkan margin, padding, dan scrollbar (`overflow: hidden; margin: 0; padding: 0;`).
2. **Animasi Deterministik (Sangat Penting)**:
   - Dilarang membuat animasi yang hanya mengandalkan real-time `requestAnimationFrame` tanpa kendali waktu manual, karena Playwright membutuhkan waktu per screenshot yang tidak konstan.
   - Sediakan fungsi kontrol global pada `window`, contoh:
     ```javascript
     window.renderFrame = function(frameNumber, totalFrames) {
       const progress = frameNumber / (totalFrames - 1); // 0.0 - 1.0
       updateAnimation(progress);
     };
     ```
3. **Looping yang Mulus (Seamless Loop)**:
   - Jika tema video adalah background loop atau abstract motion, frame pertama (`progress = 0.0`) harus menyatu sempurna dengan frame terakhir (`progress = 1.0`).
4. **Desain Komersial**:
   - Dilarang menggunakan logo merek, trademark, teks berhak cipta, atau elemen berlisensi komersial pihak ketiga tanpa izin.
   - Gunakan palet warna modern, kontras yang baik, dan estetika motion graphics terkini.

### B. Aturan Script `render.mjs`
1. **ES Module (`.mjs`)**:
   - Gunakan sintaks modern ES Modules (`import/export`).
2. **Konfigurasi Playwright**:
   - Luncurkan browser headless dengan flag akselerasi grafis jika diperlukan (`--enable-webgl`, dll).
   - Viewport diatur ke `{ width: 1920, height: 1080 }` dengan `deviceScaleFactor: 1`.
3. **Manajemen Folder Frames**:
   - Sebelum mulai render: Bersihkan isi folder `frames/` jika ada sisa frame sebelumnya.
   - Penamaan frame berurutan: `frames/frame_%04d.png` (misal `frame_0001.png`, `frame_0002.png`, dst).
4. **Eksekusi FFmpeg**:
   - Integrasikan pemanggilan CLI FFmpeg secara otomatis setelah frame terakhir selesai disimpan.
   - Standar command FFmpeg yang digunakan:
     ```bash
     ffmpeg -y -framerate 30 -i frames/frame_%04d.png -c:v libx264 -pix_fmt yuv420p -crf 18 output/output_video.mp4
     ```
   - Opsi `-crf 18` memberikan visual lossless yang sangat cocok untuk stock footage tanpa artefak kompresi yang terlihat.

---

## 6. Standar Kualitas Adobe Stock (Quality Assurance Checklist)

Sebelum merilis/mengunggah video ke Adobe Stock, lakukan pengecekan berikut:

- [ ] **Resolusi Tepat**: Tepat 1920x1080 piksel (tidak ada pixel stretching atau border hitam).
- [ ] **Frame Rate Stabil**: Konsisten pada 30 fps (atau 60 fps), tidak ada stuttering atau dropped frame.
- [ ] **Durasi Valid**: Minimum 5 detik dan maksimum 15 detik.
- [ ] **Ketajaman Visual**: Tidak ada artefak kompresi kasar, banding warna ekstrem, atau blur yang tidak disengaja.
- [ ] **Penyajian Mulus**: Tidak ada glitch visual pada frame awal atau akhir.
- [ ] **Kebersihan Frame**: Folder `frames/` tidak mengotori repository git (`.gitignore` harus mengecualikan isi `frames/` dan video di `output/`).

---

## 7. Catatan Dependensi & Persyaratan Sistem

- **Node.js**: v18.0.0 ke atas.
- **Playwright**: Sudah terpasang via npm (`npx playwright install chromium`).
- **FFmpeg**: Wajib terpasang di sistem PATH komputer agar dapat dieksekusi dari script atau terminal.
- **Git Ignore**: Pastikan file sementara diabaikan:
  ```gitignore
  node_modules/
  frames/*.png
  output/*.mp4
  ```
