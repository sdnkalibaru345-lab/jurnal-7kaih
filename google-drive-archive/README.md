# Penghubung arsip Google Drive

Kode `Code.gs` menjadi penerima arsip dari Supabase dan menulis satu baris ke tab
`ARSIP HARIAN`. ID entri dipakai sebagai kunci, sehingga pengiriman ulang memperbarui
baris yang sama dan tidak menggandakan data.

## Pemasangan satu kali

1. Buka spreadsheet **Arsip Jurnal 7 KAIH SDN Kalibaru 3**.
2. Pilih **Ekstensi → Apps Script**.
3. Ganti isi `Code.gs` dengan kode pada folder ini.
4. Buka **Project Settings → Script properties**, lalu tambahkan properti
   `ARCHIVE_SECRET`. Nilainya diberikan admin teknis dan tidak boleh dimasukkan ke GitHub.
5. Pilih **Deploy → New deployment → Web app**. Jalankan sebagai pemilik dan beri akses
   kepada **Anyone**; permintaan tetap dilindungi `ARCHIVE_SECRET`.
6. Salin URL Web App dan serahkan kepada admin teknis untuk dihubungkan ke Supabase.

Arsip menyimpan data jurnal, hasil tujuh kriteria capaian, nama orang tua/wali, dan
status konfirmasi. Gambar tanda tangan tidak dikirim atau disimpan.
