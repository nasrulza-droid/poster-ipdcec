# IPDCEC 2026 - International Scientific Poster Competition

Landing page promosi dan pendaftaran online untuk kompetisi **International Scientific Poster Competition** (IPDCEC 2026).

## Fitur Utama

- Hero section persuasif dengan countdown deadline.
- Ringkasan tema, subtema, timeline, syarat, dan kriteria penilaian.
- Form pendaftaran online dengan upload dokumen wajib.
- Redirect ke halaman konfirmasi setelah submit berhasil.
- Desain responsif untuk desktop dan mobile.

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

Catatan: pengiriman pertama memerlukan aktivasi email tujuan dari pesan verifikasi FormSubmit.

## Deploy ke GitHub Pages

Lihat langkah detail di panduan yang akan diberikan setelah setup repo selesai.
