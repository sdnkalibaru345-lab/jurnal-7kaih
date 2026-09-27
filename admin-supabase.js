(() => {
  const SUPABASE_URL = 'https://jwqrojjyrcevyvcdlsjy.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_-fxedCs7T1lzP8hzAlyOYw_vJPLP68P';
  const SESSION_KEY = 'j7-admin-session-v1';
  let session = null;

  const style = document.createElement('style');
  style.textContent = `
    #adminAuth{position:fixed;inset:0;z-index:100;background:radial-gradient(circle at 8% 0,#dcfce7,transparent 40%),#f3f7f5;display:grid;place-items:center;padding:20px}
    #adminAuth.hidden{display:none}.auth-card{width:min(430px,100%);background:#fff;border:1px solid #dbe8e2;border-radius:25px;padding:27px;box-shadow:0 24px 70px #063c2d19}.auth-brand{display:flex;align-items:center;gap:13px}.auth-brand img{width:58px;height:58px;object-fit:contain}.auth-brand p,.auth-card>p{color:#66756f;font-size:13px;line-height:1.55;margin:3px 0 0}.auth-card h1{font-size:25px;margin:22px 0 6px}.auth-error{background:#fff1f2;color:#9f1239;border-radius:12px;padding:12px;font-size:13px;margin-top:12px}.auth-card .wide{width:100%}.cloud-status{color:#166534!important;background:#dcfce7!important}.sidebar-foot .logout-admin{width:100%;margin-top:12px;background:#ffffff12;color:#fff;border-color:#ffffff30}`;
  document.head.appendChild(style);

  const authLayer = document.createElement('section');
  authLayer.id = 'adminAuth';
  authLayer.innerHTML = `<form class="auth-card" id="adminLoginForm"><div class="auth-brand"><img src="assets/logo-kb3.png" alt="Logo SDN Kalibaru 3"><div><strong>SDN Kalibaru 3</strong><p>Jurnal 7 Kebiasaan Anak Indonesia Hebat</p></div></div><h1>Masuk Panel Admin</h1><p>Gunakan akun administrator sekolah yang terdaftar.</p><div class="field"><label>Email</label><input class="control" name="email" type="email" autocomplete="username" required></div><div class="field"><label>Kata sandi</label><input class="control" name="password" type="password" autocomplete="current-password" required></div><button class="btn primary wide">Masuk</button><div id="adminLoginError" class="auth-error hidden"></div></form>`;
  document.body.appendChild(authLayer);

  function remember(value) {
    session = value;
    if (value) localStorage.setItem(SESSION_KEY, JSON.stringify(value));
    else localStorage.removeItem(SESSION_KEY);
  }
  async function auth(path, body) {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
      method: 'POST', headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error_description || data.msg || 'Gagal masuk.');
    return data;
  }
  async function refreshSession() {
    if (!session?.refresh_token) throw new Error('Sesi berakhir. Silakan masuk kembali.');
    const data = await auth('token?grant_type=refresh_token', { refresh_token: session.refresh_token });
    remember({ access_token: data.access_token, refresh_token: data.refresh_token, expires_at: Math.floor(Date.now() / 1000) + data.expires_in, user: data.user });
  }
  async function adminApi(action, payload = {}, retried = false) {
    if (!session) throw new Error('Silakan masuk terlebih dahulu.');
    if (session.expires_at < Date.now() / 1000 + 60) await refreshSession();
    const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-api`, {
      method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...payload })
    });
    if (response.status === 401 && !retried) { await refreshSession(); return adminApi(action, payload, true); }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Operasi gagal diproses.');
    return data;
  }
  async function loadCloudData() {
    const data = await adminApi('list');
    classes = data.classes.map(item => ({ id: item.id, name: item.name, active: item.is_active }));
    students = data.students.map(item => ({ id: item.id, name: item.name, classId: item.class_id, active: item.is_active, pin: item.pin || '' }));
    render();
  }
  function showError(message) {
    const box = document.getElementById('adminLoginError');
    box.textContent = message;
    box.classList.remove('hidden');
  }
  async function enterAdmin() {
    try {
      await loadCloudData();
      try { await loadMusic(); } catch (_) {}
      authLayer.classList.add('hidden');
      const badge = document.querySelector('.prototype');
      if (badge) { badge.textContent = '● SUPABASE AKTIF'; badge.classList.add('cloud-status'); }
      const foot = document.querySelector('.sidebar-foot');
      if (foot && !foot.querySelector('.logout-admin')) {
        foot.querySelector('strong').textContent = session.user?.email || 'Administrator';
        const button = document.createElement('button'); button.className = 'btn logout-admin'; button.textContent = 'Keluar'; button.onclick = () => { remember(null); location.reload(); }; foot.appendChild(button);
      }
    } catch (error) {
      remember(null);
      showError(error.message === 'Akses administrator diperlukan.' ? 'Akun ini belum terdaftar sebagai administrator.' : error.message);
    }
  }
  document.getElementById('adminLoginForm').addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.submitter, form = new FormData(event.currentTarget), error = document.getElementById('adminLoginError');
    button.disabled = true; error.classList.add('hidden');
    try {
      const data = await auth('token?grant_type=password', { email: form.get('email'), password: form.get('password') });
      remember({ access_token: data.access_token, refresh_token: data.refresh_token, expires_at: Math.floor(Date.now() / 1000) + data.expires_in, user: data.user });
      await enterAdmin();
    } catch (err) { showError(err.message); }
    finally { button.disabled = false; }
  });

  window.save = () => {};
  window.openStudent = function (id = '') {
    const student = students.find(item => item.id === id) || { name: '', classId: '', active: true };
    dialog.innerHTML = `<div class="dialog-head"><h2>${id ? 'Edit siswa' : 'Tambah siswa'}</h2><p>${id ? 'Perubahan nama atau kelas tidak mengubah PIN siswa.' : 'PIN dibuat otomatis jika kolom PIN dikosongkan.'}</p></div><form onsubmit="submitStudent(event,'${id}')"><div class="dialog-body"><div class="field"><label>Nama lengkap</label><input required name="name" class="control" value="${esc(student.name)}"></div><div class="field"><label>Kelas</label><select required name="classId" class="control"><option value="">Pilih kelas</option>${classes.filter(item => item.active || item.id === student.classId).map(item => `<option value="${item.id}" ${item.id === student.classId ? 'selected' : ''}>${esc(item.name)}</option>`).join('')}</select></div>${id ? (student.pin ? `<div class="import-note"><strong>PIN aktif: ${esc(student.pin)}</strong><br>PIN tetap sama meskipun kelas siswa diubah.</div>` : '<div class="field"><label>PIN aktif saat ini *</label><input required name="existingPin" class="control" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" placeholder="Masukkan sekali untuk ditampilkan di panel"><small>PIN diverifikasi tanpa mengubah PIN login siswa.</small></div>') : '<div class="field"><label>PIN 6 digit (opsional)</label><input name="pin" class="control" inputmode="numeric" pattern="[0-9]{6}" maxlength="6"></div>'}<label class="switch-row"><span><strong>Siswa aktif</strong><small>Dapat masuk dan mengisi jurnal.</small></span><input name="active" type="checkbox" ${student.active ? 'checked' : ''}></label><div id="cloudDialogError" class="import-errors hidden"></div></div><div class="dialog-foot"><button type="button" class="btn" onclick="closeDialog()">Batal</button><button class="btn primary">Simpan siswa</button></div></form>`;
    backdrop.classList.remove('hidden');
  };
  window.submitStudent = async function (event, id) {
    event.preventDefault(); const button = event.submitter, form = new FormData(event.currentTarget); button.disabled = true;
    try {
      const result = await adminApi('saveStudent', { id, name: form.get('name'), classId: form.get('classId'), pin: form.get('pin'), existingPin: form.get('existingPin'), isActive: form.get('active') === 'on' });
      closeDialog(); await loadCloudData();
      if (result.generatedPin) alert(`PIN ${form.get('name')}: ${result.generatedPin}`);
    } catch (error) { const box = document.getElementById('cloudDialogError'); box.textContent = error.message; box.classList.remove('hidden'); }
    finally { button.disabled = false; }
  };
  window.toggleStudent = async function (id) {
    const student = students.find(item => item.id === id); if (!student) return;
    try { await adminApi('toggleStudent', { id, isActive: !student.active }); await loadCloudData(); } catch (error) { alert(error.message); }
  };
  window.submitClass = async function (event, id) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    try { await adminApi('saveClass', { id, name: form.get('name'), isActive: form.get('active') === 'on' }); closeDialog(); await loadCloudData(); } catch (error) { alert(error.message); }
  };
  window.toggleClass = async function (id) {
    const item = classes.find(value => value.id === id); if (!item) return;
    try { await adminApi('saveClass', { id, name: item.name, isActive: !item.active }); await loadCloudData(); } catch (error) { alert(error.message); }
  };
  window.confirmImport = async function () {
    if (!syncPlan || !confirm('Terapkan sinkronisasi? Tidak ada siswa atau riwayat yang dihapus.')) return;
    const rows = [
      ...syncPlan.updates.map(({ old, row }) => ({ id: old.id, name: row.name, classId: row.classId })),
      ...syncPlan.unchanged.map(({ old, row }) => ({ id: old.id, name: row.name, classId: row.classId })),
      ...syncPlan.additions.map(row => ({ id: '', name: row.name, classId: row.classId }))
    ];
    const button = document.getElementById('confirmImport'); button.disabled = true;
    try {
      const result = await adminApi('syncStudents', { rows }); closeDialog(); await loadCloudData();
      if (result.generatedPins?.length) {
        const sheet = XLSX.utils.json_to_sheet(result.generatedPins.map(item => ({ 'nama siswa': item.name, 'PIN baru': item.pin }))), book = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(book, sheet, 'PIN Baru'); XLSX.writeFile(book, 'PIN-Baru-Siswa-Jurnal7KAIH.xlsx');
        alert(`${result.generatedPins.length} siswa baru ditambahkan. File PIN baru sudah diunduh.`);
      } else alert('Sinkronisasi selesai. Tidak ada PIN baru.');
    } catch (error) { alert(error.message); button.disabled = false; }
  };


  let musicConfig = null;
  let musicLoaded = false;
  const MUSIC_BUCKET = "background-music";

  function musicPublicUrl(path) {
    return path ? SUPABASE_URL + "/storage/v1/object/public/" + MUSIC_BUCKET + "/" + path.split("/").map(encodeURIComponent).join("/") : "";
  }
  async function loadMusic() {
    try {
      const data = await adminApi("getMusic");
      musicConfig = data.music || { is_active:false, title:"", artist:"", audio_path:null, cover_path:null };
      musicLoaded = true;
      if (view === "music" && window.renderMusic) window.renderMusic();
    } catch (error) {
      musicLoaded = false;
      if (view === "music") panel.innerHTML = '<div class="music-admin"><div class="import-errors">' + esc(error.message) + '</div></div>';
    }
  }
  function musicExt(name, fallback) {
    const match = String(name || "").toLowerCase().match(/\.([a-z0-9]+)$/);
    const ext = match ? match[1] : fallback;
    return ["mp3","mpeg","wav","ogg","webm","m4a","jpg","jpeg","png","webp"].includes(ext) ? ext : fallback;
  }
  async function uploadMusicObject(file, kind) {
    if (!file) return null;
    const max = kind === "audio" ? 25 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > max) throw new Error(kind === "audio" ? "File musik maksimal 25 MB." : "Cover maksimal 5 MB.");
    const ext = musicExt(file.name, kind === "audio" ? "mp3" : "jpg");
    const path = kind + "/" + Date.now() + "-" + Math.random().toString(36).slice(2,8) + "." + ext;
    const url = SUPABASE_URL + "/storage/v1/object/" + MUSIC_BUCKET + "/" + path.split("/").map(encodeURIComponent).join("/");
    const response = await fetch(url, {
      method:"POST",
      headers:{apikey:SUPABASE_KEY,Authorization:"Bearer " + session.access_token,"Content-Type":file.type || (kind==="audio" ? "audio/mpeg" : "image/jpeg"),"x-upsert":"false"},
      body:file
    });
    if (!response.ok) throw new Error((await response.text().catch(()=> "")) || "Upload file gagal.");
    return path;
  }
  async function deleteMusicObject(path) {
    if (!path) return;
    try {
      const url = SUPABASE_URL + "/storage/v1/object/" + MUSIC_BUCKET + "/" + path.split("/").map(encodeURIComponent).join("/");
      await fetch(url,{method:"DELETE",headers:{apikey:SUPABASE_KEY,Authorization:"Bearer " + session.access_token}});
    } catch (_) {}
  }
  window.renderMusic = function() {
    if (!musicLoaded) {
      panel.innerHTML = '<div class="music-admin"><div class="import-note">Memuat pengaturan musik…</div></div>';
      loadMusic();
      return;
    }
    const m = musicConfig || {};
    const cover = m.cover_path ? '<img src="' + musicPublicUrl(m.cover_path) + '" alt="Cover musik">' : "♫";
    const audio = m.audio_path ? '<audio class="music-audio-preview" controls preload="metadata" src="' + musicPublicUrl(m.audio_path) + '"></audio>' : "";
    panel.innerHTML =
      '<div class="music-admin"><div class="music-admin-grid">' +
      '<section class="music-current"><h3>Musik halaman utama</h3><p>Musik ini tampil di bawah kotak “Halo, nama siswa” pada halaman utama jurnal. Siswa menekan Play untuk mulai mendengarkan.</p>' +
      '<div class="music-preview"><div class="music-preview-cover">' + cover + '</div><div><div class="music-preview-title">' + esc(m.title || "Belum ada judul") + '</div><div class="music-preview-artist">' + esc(m.artist || "Belum ada penyanyi") + '</div><span class="music-status ' + (m.is_active ? "on" : "off") + '">' + (m.is_active ? "● AKTIF" : "○ NONAKTIF") + '</span></div></div>' +
      audio +
      '<div class="music-actions">' + (m.audio_path ? '<span class="music-help">Gunakan pemutar audio di atas untuk preview.</span>' : "") + (m.is_active ? '<button class="btn danger" onclick="disableMusic()">Nonaktifkan musik</button>' : "") + '</div></section>' +
      '<section class="music-form"><h3>Ganti musik</h3><p>Upload file baru jika ingin mengganti. Cover bersifat opsional; tanpa cover akan otomatis memakai ikon musik abu-abu.</p><div class="music-top-save"><button id="saveMusicTopBtn" class="btn primary" type="button" onclick="saveMusic()">💾 Simpan perubahan</button></div>' +
      '<div class="field"><label>Judul lagu</label><input id="musicTitleInput" class="control" value="' + esc(m.title || "") + '" placeholder="Contoh: Semangat Pagi"></div>' +
      '<div class="field"><label>Nama penyanyi</label><input id="musicArtistInput" class="control" value="' + esc(m.artist || "") + '" placeholder="Contoh: SDN Kalibaru 3"></div>' +
      '<div class="field"><label>File musik ' + (m.audio_path ? "(opsional untuk mengganti)" : "*") + '</label><input id="musicAudioInput" class="control" type="file" accept="audio/mpeg,audio/mp4,audio/wav,audio/ogg,audio/webm"></div>' +
      '<p class="music-help">Format: MP3, M4A, WAV, OGG, atau WEBM. Maksimal 25 MB.</p>' +
      '<div class="field"><label>Cover lagu (opsional)</label><input id="musicCoverInput" class="control" type="file" accept="image/jpeg,image/png,image/webp"></div>' +
      (m.cover_path ? '<label class="switch-row"><span><strong>Hapus cover lama</strong><small>Jika dicentang, box siswa memakai ikon musik abu-abu.</small></span><input id="musicRemoveCover" type="checkbox"></label>' : "") +
      '<label class="switch-row"><span><strong>Musik aktif</strong><small>Tampilkan box musik di halaman utama siswa.</small></span><input id="musicActiveInput" type="checkbox" ' + (m.is_active ? "checked" : "") + '></label>' +
      '<div id="musicFormError" class="import-errors hidden"></div><div class="music-save-row"><div class="left"><button class="btn" type="button" onclick="loadMusic()">↻ Muat ulang</button></div><button id="saveMusicBtn" class="btn primary" type="button" onclick="saveMusic()">Simpan pengaturan</button></div></section></div></div>';
  };
  window.saveMusic = async function() {
    const button=document.getElementById("saveMusicBtn"), errorBox=document.getElementById("musicFormError");
    if(!button)return;
    button.disabled=true; errorBox.classList.add("hidden");
    const old=musicConfig||{};
    let newAudio=null,newCover=null;
    try {
      const title=document.getElementById("musicTitleInput").value.trim();
      const artist=document.getElementById("musicArtistInput").value.trim();
      const active=document.getElementById("musicActiveInput").checked;
      const audioFile=document.getElementById("musicAudioInput").files[0];
      const coverFile=document.getElementById("musicCoverInput").files[0];
      const removeCover=document.getElementById("musicRemoveCover")?.checked;
      if(active && !title) throw new Error("Judul lagu wajib diisi.");
      if(active && !artist) throw new Error("Nama penyanyi wajib diisi.");
      if(active && !audioFile && !old.audio_path) throw new Error("File musik wajib diunggah.");
      if(audioFile)newAudio=await uploadMusicObject(audioFile,"audio");
      if(coverFile)newCover=await uploadMusicObject(coverFile,"cover");
      const audioPath=newAudio||old.audio_path||null;
      const coverPath=removeCover?null:(newCover||old.cover_path||null);
      await adminApi("saveMusic",{title,artist,audioPath,coverPath,isActive:active});
      if(newAudio && old.audio_path) await deleteMusicObject(old.audio_path);
      if((newCover||removeCover) && old.cover_path) await deleteMusicObject(old.cover_path);
      await loadMusic();
      alert("Pengaturan musik berhasil disimpan.");
    } catch(error) {
      if(newAudio) await deleteMusicObject(newAudio);
      if(newCover) await deleteMusicObject(newCover);
      errorBox.textContent=error.message||"Gagal menyimpan pengaturan musik.";
      errorBox.classList.remove("hidden");
    } finally { button.disabled=false; }
  };
  window.disableMusic = async function() {
    if(!confirm("Nonaktifkan musik di halaman utama?"))return;
    try { await adminApi("saveMusic",{title:musicConfig?.title||"",artist:musicConfig?.artist||"",audioPath:musicConfig?.audio_path||null,coverPath:musicConfig?.cover_path||null,isActive:false}); await loadMusic(); alert("Musik halaman utama dinonaktifkan."); }
    catch(error){ alert(error.message); }
  };

  try { remember(JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')); } catch (_) { remember(null); }
  if (session) enterAdmin();
})();
