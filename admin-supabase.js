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
    students = data.students.map(item => ({ id: item.id, name: item.name, classId: item.class_id, active: item.is_active, pin: item.pin_last_two ? `0000${item.pin_last_two}` : '' }));
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
    dialog.innerHTML = `<div class="dialog-head"><h2>${id ? 'Edit siswa' : 'Tambah siswa'}</h2><p>PIN baru hanya ditampilkan sekali setelah disimpan.</p></div><form onsubmit="submitStudent(event,'${id}')"><div class="dialog-body"><div class="field"><label>Nama lengkap</label><input required name="name" class="control" value="${esc(student.name)}"></div><div class="field"><label>Kelas</label><select required name="classId" class="control"><option value="">Pilih kelas</option>${classes.filter(item => item.active || item.id === student.classId).map(item => `<option value="${item.id}" ${item.id === student.classId ? 'selected' : ''}>${esc(item.name)}</option>`).join('')}</select></div><div class="field"><label>${id ? 'Ganti PIN (kosongkan jika tetap)' : 'PIN 6 digit (opsional)'}</label><input name="pin" class="control" inputmode="numeric" pattern="[0-9]{6}" maxlength="6"></div><label class="switch-row"><span><strong>Siswa aktif</strong><small>Dapat masuk dan mengisi jurnal.</small></span><input name="active" type="checkbox" ${student.active ? 'checked' : ''}></label><div id="cloudDialogError" class="import-errors hidden"></div></div><div class="dialog-foot"><button type="button" class="btn" onclick="closeDialog()">Batal</button><button class="btn primary">Simpan siswa</button></div></form>`;
    backdrop.classList.remove('hidden');
  };
  window.submitStudent = async function (event, id) {
    event.preventDefault(); const button = event.submitter, form = new FormData(event.currentTarget); button.disabled = true;
    try {
      const result = await adminApi('saveStudent', { id, name: form.get('name'), classId: form.get('classId'), pin: form.get('pin'), isActive: form.get('active') === 'on' });
      closeDialog(); await loadCloudData();
      if (result.generatedPin) alert(`PIN baru ${form.get('name')}: ${result.generatedPin}\nSimpan dan berikan kepada orang tua siswa.`);
    } catch (error) { const box = document.getElementById('cloudDialogError'); box.textContent = error.message; box.classList.remove('hidden'); }
    finally { button.disabled = false; }
  };
  window.resetPin = async function (id) {
    const student = students.find(item => item.id === id); if (!student || !confirm(`Buat PIN baru untuk ${student.name}?`)) return;
    try { const result = await adminApi('resetPin', { id }); await loadCloudData(); alert(`PIN baru ${student.name}: ${result.generatedPin}\nPIN lama sudah tidak berlaku.`); } catch (error) { alert(error.message); }
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

  try { remember(JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')); } catch (_) { remember(null); }
  if (session) enterAdmin();
})();
