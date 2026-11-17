# Setup Google Sheets + Apps Script

Panduan ini untuk menyambungkan dashboard ke Google Sheets sungguhan. Waktunya sekitar 15 menit dan semuanya gratis.

## 1. Buat Google Sheet

1. Buka [sheets.google.com](https://sheets.google.com) dan buat spreadsheet kosong.
2. Beri nama bebas, misalnya `DB Dashboard Teknisi`.

Tidak perlu membuat tab atau header apa pun. Semuanya dibuat otomatis oleh `Code.gs` saat pertama kali dipanggil.

## 2. Tempel Code.gs

1. Dari spreadsheet tadi, buka **Extensions > Apps Script**.
2. Hapus isi default editor, lalu tempel seluruh isi `Code.gs` dari repo ini.
3. Simpan (`Ctrl+S`).

## 3. Deploy sebagai Web App

1. Klik **Deploy > New deployment**, pilih tipe **Web app**.
2. Isi:
   - **Execute as**: Me
   - **Who has access**: Anyone
3. Klik **Deploy** dan izinkan akses ke spreadsheet saat diminta. Kalau muncul peringatan "Google hasn't verified this app", pilih **Advanced > Go to (nama proyek)**. Ini normal untuk script pribadi.
4. Salin **Web app URL** yang bentuknya `https://script.google.com/macros/s/.../exec`.

"Who has access: Anyone" diperlukan supaya halaman dashboard bisa memanggil API tanpa setiap user login ke akun Google. Login user tetap ditangani oleh sistem akun di dashboard sendiri.

## 4. Sambungkan dashboard

Buka `assets/app.js`, isi konstanta berikut dengan URL dari langkah 3:

```js
const DEFAULT_GAS_URL = "https://script.google.com/macros/s/.../exec";
```

Lalu buka `index.html` di browser atau upload ke hosting statis (Netlify, Vercel, GitHub Pages, dan sejenisnya). Bisa juga jalankan `python build_single_file.py` dan bagikan satu file HTML hasilnya.

## 5. Buat akun Admin pertama

Saat pertama dibuka, Sheet masih kosong, jadi dashboard otomatis menampilkan halaman **Buat Akun Admin Pertama**. Setelah login sebagai Admin:

- Buat akun Teknisi atau Logistik di tab **Kelola Akun**.
- Daftarkan rumah sakit dan buat akun RS-nya (username, password, dan nama operator per shift) di tab **Kelola Rumah Sakit**.

## Tab yang dibuat otomatis

| Tab | Isi |
|---|---|
| `Akun` | Akun Admin, Teknisi, dan Logistik |
| `Rumah_Sakit` | Data RS, nama operator, dan akun bersama RS |
| `Laporan_DOCS`, `Laporan_WWZ`, `Laporan_GOW` | Laporan harian per jenis mesin |
| `Laporan_Bulanan` | Arsip snapshot bulanan |
| `Sessions` | Token login aktif (kedaluwarsa 18 jam) |
| `Log_Aktivitas` | Riwayat login, kirim laporan, dan perubahan akun |
| `Sparepart_Master`, `SP_*` | Master sparepart, request, pengiriman, penerimaan, pemakaian, penyesuaian stok |
| `Notif_*` | Batas normal parameter mesin, daftar penerima email, dan log email notifikasi |

Password di tab `Akun` dan `Rumah_Sakit` masih disimpan plain text, jadi jangan bagikan akses edit Sheet ini ke orang lain. User cukup memakai dashboard.

## Kalau Code.gs diubah

Jangan buat deployment baru, karena URL-nya akan berubah. Pakai **Deploy > Manage deployments**, klik ikon pensil pada deployment yang aktif, pilih **Version: New version**, lalu **Deploy**. URL `/exec` tetap sama.

Untuk memastikan versi yang jalan sudah yang terbaru, buka URL `/exec` langsung di browser. Halaman itu menampilkan nilai `BACKEND_BUILD_VERSION` dari `Code.gs`.

## Troubleshooting

**Tidak bisa menghubungi server saat login**
- Pastikan `DEFAULT_GAS_URL` diakhiri `/exec`, bukan `/dev`.
- Pastikan "Who has access" diset ke **Anyone**.
- Buka URL `/exec` di tab baru. Harusnya muncul halaman versi backend, bukan halaman login Google.

**Perubahan Code.gs tidak berpengaruh**
- Deployment yang aktif belum diperbarui. Ikuti langkah di bagian "Kalau Code.gs diubah".

**Lupa password satu-satunya akun Admin**
- Buka Sheet, cari baris Role `admin` di tab `Akun`, lalu ubah kolom `Password` secara manual.
