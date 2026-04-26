# 🎬 DriveStream

Platform streaming film pribadi berbasis Google Drive & Google Sheets — tanpa server, tanpa biaya hosting.

---

## Arsitektur

```
Google Drive (video)
       │
       ▼
Google Apps Script (API)  ←──→  TMDB API (metadata)
       │
       ▼
Google Sheets (database)
       │
       ▼
index.html (SPA frontend)
```

| Lapisan | Teknologi |
|---|---|
| Penyimpanan video | Google Drive |
| Database | Google Sheets (`Film_Library`, `User_Accounts`) |
| Backend / API | Google Apps Script (`doGet`) |
| Metadata | TMDB API |
| Frontend | HTML + Vanilla JS + Tailwind CSS CDN |
| Hosting | GitHub Pages / Laragon (lokal) |

---

## Fitur

### Katalog & Tampilan
- Hero section dengan poster backdrop otomatis dari film terbaru
- Grid film responsif (mobile → desktop)
- Baris tematik: *Ingin Ditonton*, *Lanjut Menonton*, per genre

### Pencarian
- Search bar dengan **autocomplete** — maks 8 saran, diurutkan berdasarkan kecocokan judul
- Highlight teks yang cocok (merah) di setiap saran
- Navigasi keyboard: `↑ ↓` untuk navigasi, `Enter` untuk memilih, `Escape` untuk tutup
- Hasil pencarian penuh diperbarui real-time saat mengetik

### Filter Genre
- Pill filter **multi-select** — pilih beberapa genre sekaligus
- Filter khusus: *Ingin Ditonton* dan *Riwayat Tontonan*

### Watchlist
- Tombol bookmark (🔖) di setiap kartu film
- Tersimpan di `localStorage`, tersedia tanpa login ulang
- Baris *Ingin Ditonton* muncul otomatis di beranda

### Riwayat Tontonan
- Film yang dibuka otomatis masuk riwayat (maks 40 entri)
- Tanda centang indigo di sudut poster film yang sudah ditonton

### Player
- Pemutar video via Google Drive embed iframe
- **Desktop**: panel info + episode + saran di sisi kanan
- **Mobile**: info + episode + saran di bawah video, terpisah antara *Episode Lainnya* dan *Film Lainnya*

### Navigasi Episode (Serial)
- Tombol **Episode Berikutnya** (indigo) dan **Episode Sebelumnya** (abu)
- Episode diurutkan otomatis berdasarkan `episode_num`
- Label nama episode ditampilkan di tombol

### Autentikasi
- Login berbasis SHA-256 hash — password tidak disimpan plain text
- Role `admin`: akses tombol Sinkronisasi
- Role `user`: hanya menonton
- Session tersimpan di `localStorage` (`ds_auth`)

---

## Struktur File

```
film-apps/
├── index.html      # SPA frontend (satu file lengkap)
├── code.gs         # Google Apps Script backend
├── prd_v1.md       # Product Requirements Document
└── README.md       # Dokumentasi ini
```

---

## Struktur Database (Google Sheets)

### Tab: `Film_Library`

| Kolom | Keterangan |
|---|---|
| `file_id` | ID unik file Google Drive |
| `file_name` | Nama asli file |
| `official_title` | Judul dari TMDB |
| `poster_url` | URL poster TMDB (`w500`) |
| `rating` | Skor TMDB |
| `overview` | Sinopsis |
| `release_date` | Tahun rilis |
| `sync_date` | Waktu sinkronisasi terakhir |
| `genres` | Genre dipisah koma (dari TMDB, sudah diterjemahkan ke Bahasa Indonesia) |
| `series_title` | Judul seri (jika episode) |
| `episode_num` | Nomor episode |

### Tab: `User_Accounts`

| Kolom | Keterangan |
|---|---|
| `username` | Username login |
| `password_hash` | SHA-256 dari password |
| `role` | `admin` atau `user` |
| `full_name` | Nama lengkap yang ditampilkan di navbar |

---

## Setup Awal

### 1. Google Sheets & Apps Script

1. Buat Google Spreadsheet baru
2. Buka **Extensions → Apps Script**
3. Salin seluruh isi `code.gs` ke editor
4. Ubah nilai di `CONFIG`:
   ```js
   const CONFIG = {
     TMDB_API_KEY:    'isi_api_key_tmdb_anda',
     DRIVE_FOLDER_ID: 'isi_id_folder_google_drive',
     ADMIN_PASSWORD_DEFAULT: 'password_admin'
   };
   ```
5. Jalankan fungsi `setupDatabase()` sekali untuk membuat sheet dan akun awal
6. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
7. Salin URL deployment

### 2. TMDB API Key

1. Daftar di [themoviedb.org](https://www.themoviedb.org)
2. Masuk → **Settings → API → Create**
3. Tempel API key ke `CONFIG.TMDB_API_KEY` di `code.gs`

### 3. Google Drive Folder

1. Buat folder di Google Drive khusus untuk video
2. Salin **Folder ID** dari URL: `drive.google.com/drive/folders/`**`FOLDER_ID`**
3. Tempel ke `CONFIG.DRIVE_FOLDER_ID`

### 4. Frontend

1. Buka `index.html`
2. Ganti nilai variabel `API` di bagian `<script>`:
   ```js
   const API = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';
   ```
3. Hosting di GitHub Pages atau buka langsung sebagai file lokal

---

## Format Nama File Video

Apps Script otomatis mendeteksi episode berdasarkan pola nama file:

| Pola | Contoh |
|---|---|
| `S01E03` | `Breaking.Bad.S01E03.mkv` |
| `Episode 5` | `Naruto Episode 5.mp4` |
| `Ep.12` | `One.Piece.Ep.12.mp4` |
| `E07` | `Attack.On.Titan.E07.mkv` |

Film biasa cukup ditulis judul saja: `Inception.2010.mp4`

---

## API Endpoints

Base URL: URL deployment Apps Script

| Action | Parameter | Keterangan |
|---|---|---|
| `getMovies` | — | Ambil seluruh data film dari `Film_Library` |
| `login` | `u`, `p` | Validasi login, `p` akan di-hash SHA-256 |
| `sync` | — | Picu sinkronisasi folder Drive (admin) |

Contoh:
```
GET {BASE_URL}?action=getMovies
GET {BASE_URL}?action=login&u=admin&p=admin123
GET {BASE_URL}?action=sync
```

---

## Akun Default

> Ganti password setelah setup pertama!

| Username | Password | Role |
|---|---|---|
| `admin` | `admin123` | Admin |
| `user` | `12345` | User |

---

## Format Video yang Didukung

`mp4` · `mkv` · `avi` · `mov` · `webm`

---

## Catatan

- Video diputar via **Google Drive embed iframe** — tidak bisa di-seek secara programatik (keterbatasan cross-origin)
- Data watchlist dan riwayat tersimpan di **localStorage** browser, bukan di server
- Sinkronisasi otomatis bisa diatur via **Apps Script Triggers** (waktu terjadwal)

---

*© 2026 DriveStream · wajibhimung*
