# IPDCEC 2026 - International Scientific Poster Competition

Landing page promosi dan pendaftaran online untuk kompetisi **International Scientific Poster Competition** (IPDCEC 2026).

## Fitur Utama

- Hero section persuasif dengan countdown deadline.
- Ringkasan tema, subtema, timeline, syarat, dan kriteria penilaian.
- Form pendaftaran online dengan upload dokumen wajib.
- Redirect ke halaman konfirmasi setelah submit berhasil.
- Desain responsif untuk desktop dan mobile.
- Dukungan dua bahasa (Indonesia dan English) untuk halaman peserta.
- Hardening keamanan dasar untuk deployment statis (CSP, referrer policy, anti-bot form).

## Rute Bahasa

- Indonesia: `index.html` dan `success.html`
- English: `index-en.html` dan `success-en.html`

## Struktur Proyek

```text
.
├── index.html
├── success.html
├── styles.css
├── script.js
├── assets
│   ├── images
│   │   └── flyer.jpeg
│   └── docs
│       └── guidebook.pdf
└── README.md
```

## Menjalankan Secara Lokal

Cukup buka file `index.html` di browser.

Untuk pengalaman terbaik (simulasi hosting), jalankan server statis sederhana:

```powershell
# jika Python tersedia
python -m http.server 8080
```

Lalu akses `http://localhost:8080`.

## Form Pendaftaran

Form saat ini menggunakan FormSubmit:

- Endpoint: `https://formsubmit.co/ipdcec2026@gmail.com`
- Upload file didukung melalui `multipart/form-data`
- Redirect sukses ke `success.html`
- CAPTCHA FormSubmit diaktifkan dan honeypot anti-bot ditambahkan

Catatan: pengiriman pertama memerlukan aktivasi email tujuan dari pesan verifikasi FormSubmit.

## Admin Panel

Panel admin lama yang berbasis browser-only dinonaktifkan demi keamanan.

Alasan:

- Password client-side dan session browser tidak aman untuk produksi
- Penyimpanan data di `localStorage` mudah dimanipulasi

Rekomendasi produksi:

- Gunakan backend dengan autentikasi server-side
- Simpan data pendaftar di database terproteksi
- Tambahkan rate limiting dan validasi upload file di server

## Deploy ke GitHub Pages

Lihat langkah detail di panduan yang akan diberikan setelah setup repo selesai.

## Backend Aman (Baru)

Repository ini sekarang memiliki fondasi backend aman di folder `backend/` dengan fitur:

- Login admin server-side (JWT)
- Password admin di-hash (bcrypt)
- Rate limiting login dan endpoint API
- Penyimpanan data pendaftaran di SQLite
- Upload dokumen via backend multipart dengan validasi MIME dan size
- Rate limit khusus endpoint pendaftaran (anti abuse)

### Menjalankan Backend

```powershell
cd backend
copy .env.example .env
npm install
npm run init-admin
npm run dev
```

Konfigurasi CORS multi-origin:

- Gunakan `ALLOWED_ORIGINS` (dipisah koma) di `.env`
- Di production, pastikan daftar origin terisi agar hanya domain resmi yang bisa akses API

Health check:

```text
GET http://localhost:5001/api/health
```

### Integrasi Frontend ke Backend

Set atribut `data-api-base-url` di tag `<html>`:

- `index.html`
- `index-en.html`
- `admin.html`
- `admin-en.html`

Contoh:

```html
<html lang="id" data-api-base-url="https://api.ipdcec.online">
```

Catatan:

- Jika `data-api-base-url` diisi, frontend mengirim pendaftaran langsung ke backend API (termasuk file upload).
- Jika `data-api-base-url` kosong, frontend memakai FormSubmit sebagai fallback operasional.
- Jika sudah penuh pindah ke backend + file storage sendiri, endpoint FormSubmit bisa dihapus dari form.

Lokasi file upload backend:

- `backend/uploads/`

## Admin Dashboard Aman (Frontend)

Halaman admin sekarang memakai backend API dengan alur:

- Login email + password ke `/api/auth/login`
- Simpan token sesi admin di `sessionStorage`
- Ambil data pendaftar dari `/api/registrations/admin`
- Ubah status/hapus data via endpoint admin terautentikasi
- Export CSV dari `/api/registrations/admin/export.csv`
- Lihat audit log admin dari `/api/registrations/admin/logs`
- Unduh file peserta terproteksi dari `/api/registrations/admin/:id/files/:field`

Sebelum dipakai, pastikan:

- backend sudah jalan
- `data-api-base-url` mengarah ke host API backend yang benar
