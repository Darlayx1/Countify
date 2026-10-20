# Countify

Aplikasi latihan berhitung berbahasa Indonesia. Empat mode, lima level, dan satu menit untuk melatih ketepatan serta fokus.

## Menjalankan aplikasi

Gunakan Node.js 24 dan npm. Dari direktori checkout:

```sh
npm ci
npm run dev
```

Aplikasi menggunakan base path `/Countify/`. Tidak membutuhkan backend, akun pengguna, atau environment variable. Font dan ikon disajikan bersama aplikasi.

```sh
npm test             # Generator soal, aritmetika eksak, timer, penalti, dan penyimpanan
npm run build        # TypeScript dan production build
npm run test:e2e     # Interaksi dan responsivitas menggunakan Chromium
npm run preview     # Menjalankan hasil production build
```

Untuk pengujian browser, Chromium di `/usr/bin/chromium` digunakan bila tersedia. Jika tidak tersedia, jalankan `npx playwright install --with-deps chromium`. Lokasi lain dapat diberikan melalui `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

## Aturan permainan

- Pilih penjumlahan, pengurangan, perkalian, atau pembagian dan satu dari lima tingkat.
- Setiap sesi berlangsung 60 detik tanpa jeda, termasuk saat tab tidak aktif.
- Jawaban benar menambah penghitung benar dan mengganti soal.
- Setiap jawaban salah menambah penghitung salah, mengurangi 10 detik, dan mempertahankan soal yang sama. Sesi selesai ketika waktu mencapai nol, termasuk akibat penalti.
- Input kosong atau belum lengkap diabaikan. Jawaban dikirim melalui Kirim atau Enter.
- Level 1–3 memakai bilangan bulat nonnegatif, level 4 mengenalkan negatif, dan level 5 menambahkan desimal eksak sampai dua digit. Pembagian tidak pernah membagi dengan nol.
- Koma dan titik diterima dari keyboard sebagai pemisah desimal. `0,5` dan `0,50` setara. Tidak perlu membulatkan.
- Keyboard: angka, Enter, Backspace, Delete/Escape untuk membersihkan, dan minus untuk mengganti tanda.
- Hasil dihitung berdasarkan jumlah jawaban benar; akurasi adalah benar ÷ (benar + salah). Rekor disimpan per mode dan level.
- Maksimal 50 sesi dan rekor disimpan di browser melalui `localStorage`. Browser lain tidak membagikan data ini. Mode penyimpanan terbatas tetap dapat bermain, tetapi data mungkin tidak bertahan setelah refresh.
- Sesi yang dibatalkan sebelum waktu habis tidak dicatat. Refresh mengakhiri sesi aktif.

## Deploy ke GitHub Pages

Workflow `.github/workflows/deploy.yml` menguji aplikasi dan memublikasikan `dist/` ketika kode masuk ke branch `main`. Pull request hanya menjalankan pemeriksaan.

Di GitHub repository **Settings → Pages → Build and deployment**, tetapkan **Source: GitHub Actions**. GitHub Actions dan GitHub Pages harus tersedia untuk repository serta paket akun yang digunakan; repository tidak diubah visibilitasnya secara otomatis.

Setelah workflow sukses, target situs adalah `https://darlayx1.github.io/Countify/`. Alamat ini merupakan target konfigurasi, bukan jaminan bahwa situs sudah dipublikasikan. Periksa hasil deployment pada tab Actions dan Pages.

Jika workflow belum pernah berjalan setelah Pages diaktifkan, jalankan **Verify and deploy Countify → Run workflow** pada branch `main`.

Pemeriksaan pascadeploy: HTTPS berhasil, aset JS/CSS/font termuat, refresh berfungsi, sesi benar/salah memperbarui status dan timer, dan riwayat bertahan setelah refresh.

Untuk lingkungan cloud dengan jaringan terbatas, izinkan `api.github.com` untuk pengelolaan/monitoring Pages dan `darlayx1.github.io` untuk verifikasi situs. Draft konfigurasi environment tidak sama dengan publikasi situs.
