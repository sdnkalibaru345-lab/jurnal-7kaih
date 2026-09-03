(function () {
  'use strict';

  const SUPABASE_URL = 'https://jwqrojjyrcevyvcdlsjy.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_-fxedCs7T1lzP8hzAlyOYw_vJPLP68P';
  const SESSION_KEY = 'j7-student-session-v1';
  const draftsByDate = {};
  let session = readSession();
  let classes = [];
  let sending = false;

  const loginCard = document.querySelector('.login-card');
  loginCard.innerHTML = `
    <span class="test" style="background:#d1fae5;color:#065f46">TERHUBUNG</span>
    <h2>Masuk ke jurnal</h2>
    <p>Pilih kelas dan nama siswa, lalu masukkan PIN.</p>
    <div class="field"><label for="studentClass">Kelas</label><select id="studentClass" class="control"><option value="">Memuat kelas...</option></select></div>
    <div class="field"><label for="studentName">Nama siswa</label><select id="studentName" class="control" disabled><option value="">Pilih kelas terlebih dahulu</option></select></div>
    <div class="field"><label for="studentPin">PIN</label><input id="studentPin" class="control" type="password" inputmode="numeric" autocomplete="current-password" maxlength="6" pattern="[0-9]{6}" placeholder="6 digit PIN"></div>
    <p id="studentLoginError" class="hint" role="alert" style="display:none;color:#b91c1c;text-align:left"></p>
    <button id="studentLoginButton" class="primary wide" type="button">Masuk</button>
    <p class="hint">Gunakan PIN yang diberikan oleh admin sekolah.</p>`;

  const classSelect = document.getElementById('studentClass');
  const nameInput = document.getElementById('studentName');
  const pinInput = document.getElementById('studentPin');
  const loginButton = document.getElementById('studentLoginButton');
  const loginError = document.getElementById('studentLoginError');

  const style = document.createElement('style');
  style.textContent = `
    #studentLoginError.show{display:block!important}
    .control:disabled,.primary:disabled{cursor:not-allowed}
    .sync-note{font-size:12px;color:#63736e;margin-top:8px}
  `;
  document.head.appendChild(style);

  function readSession() {
    try {
      const value = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
      return value && value.token ? value : null;
    } catch (_) {
      return null;
    }
  }

  function saveSession(value) {
    session = value;
    if (value) localStorage.setItem(SESSION_KEY, JSON.stringify(value));
    else localStorage.removeItem(SESSION_KEY);
  }

  async function studentApi(action, payload = {}, token = session?.token) {
    const headers = { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' };
    if (token) headers['x-student-token'] = token;
    const response = await fetch(`${SUPABASE_URL}/functions/v1/student-api`, {
      method: 'POST', headers, body: JSON.stringify({ action, ...payload })
    });
    let data = {};
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) {
      const error = new Error(data.error || 'Operasi gagal diproses.');
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function setLoginError(message = '') {
    loginError.textContent = message;
    loginError.classList.toggle('show', Boolean(message));
  }

  function setLoginBusy(busy) {
    loginButton.disabled = busy;
    classSelect.disabled = busy;
    nameInput.disabled = busy;
    pinInput.disabled = busy;
    loginButton.textContent = busy ? 'Memeriksa...' : 'Masuk';
  }

  function populateClasses() {
    classSelect.innerHTML = '<option value="">Pilih kelas</option>' + classes
      .map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join('');
  }

  async function loadStudentNames() {
    const classId = classSelect.value;
    nameInput.disabled = true;
    nameInput.innerHTML = `<option value="">${classId ? 'Memuat nama siswa...' : 'Pilih kelas terlebih dahulu'}</option>`;
    setLoginError();
    if (!classId) return;
    try {
      const data = await studentApi('names', { classId }, null);
      const names = data.names || [];
      nameInput.innerHTML = '<option value="">Pilih nama siswa</option>' + names
        .map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
      nameInput.disabled = names.length === 0;
      if (!names.length) setLoginError('Belum ada siswa aktif pada kelas ini.');
    } catch (error) {
      nameInput.innerHTML = '<option value="">Nama siswa gagal dimuat</option>';
      setLoginError(error.message);
    }
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[char]);
  }

  function achievementMap(row) {
    return {
      bangun: row.achieved_bangun_pagi === true,
      ibadah: row.achieved_taat_beribadah === true,
      olahraga: row.achieved_rajin_berolahraga === true,
      makan: row.achieved_makan_sehat === true,
      belajar: row.achieved_gemar_belajar === true,
      masyarakat: row.achieved_bermasyarakat === true,
      tidur: row.achieved_tidur_cepat === true
    };
  }

  function responseAchievementMap(value) {
    return {
      bangun: value.achieved_bangun_pagi === true,
      ibadah: value.achieved_taat_beribadah === true,
      olahraga: value.achieved_rajin_berolahraga === true,
      makan: value.achieved_makan_sehat === true,
      belajar: value.achieved_gemar_belajar === true,
      masyarakat: value.achieved_bermasyarakat === true,
      tidur: value.achieved_tidur_cepat === true
    };
  }

  function loadEntries(entries) {
    Object.keys(progressByDate).forEach(key => delete progressByDate[key]);
    Object.keys(achievementByDate).forEach(key => delete achievementByDate[key]);
    Object.keys(draftsByDate).forEach(key => delete draftsByDate[key]);
    for (const entry of entries || []) {
      const key = entry.journal_date;
      progressByDate[key] = new Set(habits.map(habit => habit.id));
      achievementByDate[key] = achievementMap(entry);
      draftsByDate[key] = entry.answers || {};
    }
    done = progressByDate[activeDateKey] || (progressByDate[activeDateKey] = new Set());
    achievementByDate[activeDateKey] ||= {};
  }

  function showStudentApp(student, entries) {
    loadEntries(entries);
    document.querySelector('.welcome h2').textContent = `Halo, ${student.name}!`;
    const mode = document.querySelector('.mode');
    mode.textContent = `Kelas ${student.className}`;
    login.classList.add('hidden');
    app.classList.remove('hidden');
    selectJournalDate(activeDateKey);
    showIntro();
  }

  async function loginStudent() {
    const classId = classSelect.value;
    const name = nameInput.value.trim();
    const pin = pinInput.value.trim();
    setLoginError();
    if (!classId || !name || !/^\d{6}$/.test(pin)) {
      setLoginError('Pilih kelas, pilih nama siswa, dan isi PIN 6 digit.');
      return;
    }
    setLoginBusy(true);
    try {
      const loggedIn = await studentApi('login', { classId, name, pin }, null);
      saveSession({ token: loggedIn.token, student: loggedIn.student, expiresAt: loggedIn.expiresAt });
      pinInput.value = '';
      const data = await studentApi('list');
      showStudentApp(data.student, data.entries);
    } catch (error) {
      saveSession(null);
      setLoginError(error.message);
    } finally {
      setLoginBusy(false);
    }
  }

  function radioValue(name) {
    return modal.querySelector(`input[name="${name}"]:checked`)?.value || '';
  }

  function serializeCurrentHabit() {
    if (current.kind === 'time') return { time: modal.querySelector('input[type="time"]').value };
    if (current.kind === 'worship') {
      const religion = modal.querySelector('select').value;
      if (religion === 'Islam') return {
        religion,
        prayers: {
          subuh: radioValue('prayer0'), zuhur: radioValue('prayer1'),
          asar: radioValue('prayer2'), magrib: radioValue('prayer3'), isya: radioValue('prayer4')
        }
      };
      return { religion, worship: modal.querySelector('#religionDetails input')?.value.trim() || '' };
    }
    if (current.kind === 'conditional') {
      const performed = radioValue('mainAnswer') === 'ya';
      const fields = [...modal.querySelectorAll('#conditionalDetails input')].map(input => input.value.trim());
      if (current.id === 'olahraga') return { performed, detail: fields[0] || '' };
      if (current.id === 'belajar') return { performed, school: fields[0] || '', home: fields[1] || '' };
      return { performed, home: fields[0] || '', community: fields[1] || '' };
    }
    if (current.kind === 'nutrition') return {
      items: {
        pokok: radioValue('food0'), lauk: radioValue('food1'), buah: radioValue('food2'),
        sayur: radioValue('food3'), air: radioValue('food4')
      }
    };
    if (current.kind === 'signature') {
      const canvas = document.getElementById('signaturePad');
      return {
        name: modal.querySelector('.field input').value.trim(),
        signature: canvas.toDataURL('image/webp', 0.55)
      };
    }
    return {};
  }

  function showSendMessage(title, detail) {
    toast.querySelector('strong').textContent = title;
    toast.querySelector('small').textContent = detail;
    toast.classList.remove('hidden');
    clearTimeout(showSendMessage.timer);
    showSendMessage.timer = setTimeout(() => toast.classList.add('hidden'), 4200);
  }

  window.enterApp = loginStudent;
  loginButton.addEventListener('click', loginStudent);
  classSelect.addEventListener('change', loadStudentNames);
  pinInput.addEventListener('keydown', event => { if (event.key === 'Enter') loginStudent(); });

  window.leaveApp = async function () {
    const token = session?.token;
    saveSession(null);
    if (token) studentApi('logout', {}, token).catch(() => {});
    app.classList.add('hidden');
    login.classList.remove('hidden');
    pinInput.value = '';
    switchPage(introPage);
    window.scrollTo(0, 0);
  };

  window.saveHabit = function () {
    const button = document.getElementById('saveAspect');
    if (!current || button?.disabled) return;
    const aspectId = current.id;
    const achieved = calculateAchievement();
    draftsByDate[activeDateKey] ||= {};
    draftsByDate[activeDateKey][aspectId] = serializeCurrentHabit();
    if (aspectId !== 'orangtua') achievementByDate[activeDateKey][aspectId] = achieved;
    done.add(aspectId);
    closeModal();
    renderDates();
    render();
  };

  window.showToast = async function () {
    if (sending || done.size < 8) return;
    const answers = draftsByDate[activeDateKey];
    if (!answers || habits.some(habit => !answers[habit.id])) {
      showSendMessage('Isian belum siap dikirim', 'Buka dan simpan kembali setiap aspek jurnal.');
      return;
    }
    sending = true;
    const sendButton = document.getElementById('send');
    sendButton.disabled = true;
    const original = sendButton.textContent;
    sendButton.textContent = 'Menyimpan...';
    try {
      const result = await studentApi('save', { journalDate: activeDateKey, answers });
      achievementByDate[activeDateKey] = responseAchievementMap(result.achievements || {});
      progressByDate[activeDateKey] = new Set(habits.map(habit => habit.id));
      done = progressByDate[activeDateKey];
      renderDates();
      render();
      showSendMessage('✓ Jurnal berhasil disimpan', 'Data jurnal sudah tersimpan dengan aman.');
    } catch (error) {
      if (error.status === 401) {
        saveSession(null);
        setTimeout(() => window.leaveApp(), 900);
      }
      showSendMessage('Jurnal belum tersimpan', error.message);
    } finally {
      sending = false;
      sendButton.textContent = original;
      sendButton.disabled = done.size < 8;
    }
  };

  async function start() {
    try {
      const boot = await studentApi('bootstrap', {}, null);
      classes = boot.classes || [];
      populateClasses();
    } catch (error) {
      classSelect.innerHTML = '<option value="">Kelas gagal dimuat</option>';
      setLoginError('Koneksi ke database gagal. Muat ulang halaman.');
      return;
    }
    if (!session?.token) return;
    try {
      const data = await studentApi('list');
      session.student = data.student;
      saveSession(session);
      showStudentApp(data.student, data.entries);
    } catch (_) {
      saveSession(null);
    }
  }

  start();
})();
