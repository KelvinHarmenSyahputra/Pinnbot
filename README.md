# 🤖 Pinnbot — WhatsApp AI Companion & College Assistant

Pinnbot adalah WhatsApp AI Bot cerdas berbasis **Node.js (ESM)** dan **`@whiskeysockets/baileys`** yang dirancang khusus sebagai asisten tugas kuliah sekaligus teman ngobrol seru dengan persona **Gen-Z / Jaksel**.

Ditenagai oleh endpoint AI OpenAI-compatible (seperti **9router**, OpenAI, OpenRouter, Google AI Studio) dengan konsumsi RAM ultra-ringan (<50 MB) tanpa Chromium/Puppeteer.

---

## ✨ Fitur Utama

- 🧠 **Smart Trigger (Anti-Bentrok di Grup)**:
  - Bot hanya merespons jika:
    1. Namanya dipanggil (`pinnbot`, `cow`, `cil`, `pin`).
    2. Pesan bot di-reply (quoted message).
    3. Bot di-mention (`@bot`) atau via command (`/`).
  - Tidak akan menyamber obrolan pribadi antar anggota grup secara sembarangan.
  - Antrean pesan FIFO mencegah respons balapan saat dua orang chat bersamaan.
- 📝 **Teks ke Tulisan Tangan Double Folio (Anti-AI & Anti-Keluar Garis)**:
  - Mengubah teks ketikan menjadi gambar tulisan tangan di atas kertas double folio bergaris nyata.
  - Perhitungan batas piksel per kata yang presisi mencegah teks keluar garis atau menembus margin merah.
  - Sentuhan mikroskopis jitter baseline dan variasi tinta pulpen gel biru dongker.
- 📋 **Pengingat & Pelacak Tugas Kuliah (`/tugas`)**:
  - Catat tugas kuliah beserta deadline secara alami atau via command.
  - Tandai tugas selesai (`/tugas selesai <id/judul>`).
- 🎭 **Dynamic Mood Engine**:
  - Pinnbot memiliki 5 status mood dinamis (`senang`, `malas`, `marah`, `sedih`, `santai`) yang beradaptasi dengan konteks obrolan kalian.
- 🔒 **Strict Group Lockdown**:
  - Konfigurasi `ALLOWED_GROUP_ID` memastikan bot hanya aktif di grup khusus kalian bertiga dan mengabaikan chat lain.
- 🧹 **Sliding Window & Auto-Reset Memory**:
  - Menyimpan konteks aktif percakapan terakhir dan otomatis membersihkan log setelah 50 pesan agar token tetap hemat dan obrolan tetap segar.
  - Fakta permanen disimpan terpisah di `data/memory.json`.
- 🛠️ **Utility Lengkap**:
  - `/model <nama>`: Ganti model AI aktif tanpa restart.
  - `/status`: Cek status bot, mood aktif, dan beban tugas.
  - `/prompt <ide>`: Mode peracik prompt AI berkualitas tinggi.
  - `/stiker`: Konversi foto menjadi stiker WhatsApp via FFmpeg.
  - `/clear`: Bersihkan riwayat chat aktif manual.

---

## 🚀 Persyaratan Sistem

- **Node.js**: v20.x atau lebih baru.
- **Python 3**: dengan pustaka `Pillow` (untuk modul tulisan tangan double folio).
- **FFmpeg**: (untuk modul stiker WhatsApp).

---

## 🛠️ Panduan Instalasi & Menjalankan

### 1. Clone Repositori
```bash
git clone https://github.com/KelvinHarmenSyahputra/Pinnbot.git
cd Pinnbot
npm install
```

### 2. Konfigurasi Lingkungan
Salin file `.env.example` menjadi `.env`:
```bash
cp .env.example .env
```

Sesuaikan isinya:
```env
AI_BASE_URL=http://127.0.0.1:20852/v1
AI_API_KEY=your_api_key_here
AI_DEFAULT_MODEL=ag/gemini-3.8-flash-high
ALLOWED_GROUP_ID=120363xxxxxx@g.us
BOT_NAMES=pinnbot,cow,cil,pin
WHATSAPP_ENABLED=false
PORT=20856
```

### 3. Uji Coba Engine Backend (Tanpa WhatsApp)
Jalankan rangkaian tes otomatis untuk memastikan semua modul (AI, memori, tugas, tulisan tangan folio) bekerja 100%:
```bash
npm test
```

Jalankan backend test server:
```bash
npm start
```
*Server uji coba akan aktif di `http://127.0.0.1:20856`.*

### 4. Hubungkan ke WhatsApp
Ubah nilai di `.env`:
```env
WHATSAPP_ENABLED=true
```
Lalu jalankan bot:
```bash
npm start
```
Pindai (scan) kode QR yang muncul di terminal menggunakan aplikasi WhatsApp di HP Anda.

---

## 📁 Struktur Proyek

```
Pinnbot/
├── .env.example              # Template konfigurasi
├── .gitignore
├── README.md                 # Dokumentasi ini
├── package.json
├── assets/
│   └── fonts/Caveat.ttf      # Font tulisan tangan natural
├── data/
│   ├── memory.json           # Fakta permanen & mood state
│   └── tasks.json            # Database tugas kuliah
├── src/
│   ├── config.js             # Konfigurasi terpusat
│   ├── index.js              # Entrypoint (HTTP Test Server / Baileys WA)
│   ├── ai/
│   │   ├── memory.js         # Memory manager (sliding window & durable facts)
│   │   ├── prompts.js        # Persona Gen-Z Jaksel & Mood Engine
│   │   └── router.js         # AI client (9router / OpenAI-compatible)
│   ├── handlers/
│   │   ├── commands.js       # Handler command /status, /model, /tugas, dll
│   │   └── message.js        # Smart Trigger filter & queue anti-bentrok
│   └── tools/
│       ├── handwriting.py    # Generator tulisan tangan double folio (Pillow)
│       ├── handwriting.js    # Node.js wrapper untuk handwriting
│       ├── sticker.js        # FFmpeg WhatsApp sticker maker
│       └── tasks.js          # College task tracker
└── test/
    └── run_tests.js          # Automated verification test suite
```

---

## 📄 Lisensi
MIT License © 2026 KelvinHarmenSyahputra
