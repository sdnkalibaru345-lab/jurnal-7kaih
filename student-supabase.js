(function () {
  'use strict';

  const SUPABASE_URL = 'https://jwqrojjyrcevyvcdlsjy.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_-fxedCs7T1lzP8hzAlyOYw_vJPLP68P';
  const SESSION_KEY = 'j7-student-session-v1';
  const VAPID_PUBLIC_KEY = 'BBObhvP0qRN0yBAqChymWR2raH_uLc901SvNAyjkHuBnEAmkXHcbOaNzszTb7A41Q2yjF9mEIu1xdJJ2D3poT2k';
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
    .reminder-card{margin:12px 0 0;background:#fff7dc;border:1px solid #f1d98a;border-radius:20px;padding:16px 18px;display:flex;align-items:center;justify-content:space-between;gap:16px;box-shadow:0 4px 14px #17352d0b}
    .reminder-card h3{font-size:16px;margin:0 0 4px;color:#3f3210}.reminder-card p{font-size:13px;line-height:1.45;margin:0;color:#6e5b27}
    .reminder-button{flex:0 0 auto;border:0;border-radius:12px;min-height:44px;padding:10px 15px;background:#047857;color:#fff;font-weight:800;cursor:pointer}
    .reminder-button:disabled{opacity:.65;cursor:not-allowed}.reminder-card.active{background:#ecfdf5;border-color:#a7dfc7}.reminder-card.active h3{color:#065f46}.reminder-card.active p{color:#39715f}
    #introPage{place-items:stretch center}
    #introPage .step-card{min-height:calc(100dvh - 158px);display:flex;flex-direction:column}
    #introPage .step-actions{margin-top:auto;padding-top:32px}
    #downloadWindow,.recap-body .legend{display:none!important}
    @media(max-width:560px){.reminder-card{align-items:stretch;flex-direction:column;padding:15px 14px}.reminder-button{width:100%}}
    @media(max-width:767px){#introPage .step-card{min-height:calc(100dvh - 102px)}#introPage .step-actions{padding-top:24px}}
  `;
  document.head.appendChild(style);

  const journalTools = document.querySelector('.journal-tools');
  const reminderCard = document.createElement('section');
  reminderCard.className = 'reminder-card';
  reminderCard.innerHTML = `<div><h3>🔔 Pengingat jurnal</h3><p id="reminderStatus">Aktifkan notifikasi untuk diingatkan setiap pukul 20.00 WIB bila jurnal hari ini hingga 3 hari sebelumnya belum lengkap.</p></div><button id="reminderButton" class="reminder-button" type="button">Aktifkan Pengingat</button>`;
  journalTools?.after(reminderCard);
  const reminderButton = document.getElementById('reminderButton');
  const reminderStatus = document.getElementById('reminderStatus');

  function vapidKeyBytes(value) {
    const padding = '='.repeat((4 - value.length % 4) % 4);
    const raw = atob((value + padding).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(raw, char => char.charCodeAt(0));
  }

  function setReminderState(active, message) {
    reminderCard.classList.toggle('active', active);
    reminderStatus.textContent = message;
    reminderButton.textContent = active ? '✓ Pengingat Aktif' : 'Aktifkan Pengingat';
    reminderButton.disabled = active;
  }

  async function refreshReminderState() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setReminderState(false, 'Perangkat atau browser ini belum mendukung notifikasi pengingat.');
      reminderButton.disabled = true;
      return;
    }
    try {
      const registration = await navigator.serviceWorker.getRegistration('./');
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription && Notification.permission === 'granted') {
        setReminderState(true, 'Pengingat aktif. Notifikasi dikirim pukul 20.00 WIB bila ada jurnal yang belum lengkap.');
      } else if (Notification.permission === 'denied') {
        setReminderState(false, 'Notifikasi diblokir. Izinkan notifikasi untuk situs ini melalui pengaturan browser.');
        reminderButton.disabled = true;
      }
    } catch (_) {}
  }

  async function enableReminders() {
    if (!session?.token || reminderButton.disabled) return;
    reminderButton.disabled = true;
    reminderButton.textContent = 'Mengaktifkan...';
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        throw new Error('Browser ini belum mendukung notifikasi perangkat.');
      }
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Izin notifikasi belum diberikan.');
      const registration = await navigator.serviceWorker.register('./sw.js?v=1', { scope: './' });
      await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidKeyBytes(VAPID_PUBLIC_KEY)
        });
      }
      await studentApi('push-subscribe', { subscription: subscription.toJSON(), userAgent: navigator.userAgent });
      setReminderState(true, 'Pengingat aktif. Notifikasi dikirim pukul 20.00 WIB bila ada jurnal yang belum lengkap.');
    } catch (error) {
      setReminderState(false, error.message || 'Pengingat belum dapat diaktifkan.');
      reminderButton.disabled = Notification.permission === 'denied';
    }
  }

  reminderButton?.addEventListener('click', enableReminders);

  let recapTouchStartX = 0;
  let recapTouchStartY = 0;
  modal.addEventListener('touchstart', event => {
    if (!modal.querySelector('.calendar-grid') || event.touches.length !== 1) return;
    recapTouchStartX = event.touches[0].clientX;
    recapTouchStartY = event.touches[0].clientY;
  }, { passive: true });
  modal.addEventListener('touchend', event => {
    if (!modal.querySelector('.calendar-grid') || !recapTouchStartX || event.changedTouches.length !== 1) return;
    const deltaX = event.changedTouches[0].clientX - recapTouchStartX;
    const deltaY = event.changedTouches[0].clientY - recapTouchStartY;
    recapTouchStartX = recapTouchStartY = 0;
    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.25) return;
    const buttons = modal.querySelectorAll('.month-nav button');
    const target = deltaX > 0 ? buttons[0] : buttons[buttons.length - 1];
    if (target && !target.disabled) target.click();
  }, { passive: true });

  const hasContext = (text, pattern) => pattern.test(String(text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
  const isWorshipActivity = text => hasContext(text, /(ibadah|berdoa|doa|sembahyang|salat|sholat|mengaji|quran|alquran|alkitab|gereja|misa|kebaktian|renungan|puja|bhakti|meditasi|vihara|wihara|pura|kelenteng|liturgi|sakramen)/i);
  const isPhysicalActivity = text => hasContext(text, /(jalan(?: kaki)?|lari|senam|sepak bola|futsal|renang|sepeda|badminton|bulu tangkis|voli|basket|silat|karate|taekwondo|menari|dance|skipping|lompat|push.?up|sit.?up|plank|yoga|jogging|gym|olahraga)/i);
  const isStudyActivity = text => hasContext(text, /(belajar|membaca|baca buku|menulis|berhitung|mengerjakan (?:pr|tugas|soal)|latihan soal|menghafal|les|matematika|bahasa indonesia|bahasa inggris|bahasa sunda|ipas|ipa|ips|pancasila|agama|seni|pjok|koding|coding)/i);
  const isSocialActivity = text => hasContext(text, /(membantu|menolong|mencuci|menyapu|mengepel|memasak|merapikan|membersihkan|membereskan|membuang sampah|cuci piring|cuci baju|lipat baju|menjemur|kerja bakti|gotong royong|piket|bakti sosial|donasi|berbagi|menjaga adik|membantu (?:ibu|ayah|orang tua|ortu|tetangga)|kegiatan masyarakat|ronda|posyandu)/i);

  window.calculateAchievement = function () {
    if (!current || current.id === 'orangtua') return null;
    if (current.kind === 'time') {
      const value = modal.querySelector('input[type="time"]').value;
      if (current.id === 'bangun') return value >= '04:00' && value <= '05:00';
      if (current.id === 'tidur') return value >= '19:00' && value <= '21:00';
    }
    if (current.kind === 'worship') {
      const religion = modal.querySelector('select').value;
      if (religion === 'Islam') {
        return ['prayer0', 'prayer1', 'prayer2', 'prayer3', 'prayer4']
          .filter(name => modal.querySelector(`input[name="${name}"]:checked`)?.value === 'ya').length >= 3;
      }
      return isWorshipActivity(modal.querySelector('#religionDetails input')?.value || '');
    }
    if (current.id === 'olahraga') {
      return modal.querySelector('input[name="mainAnswer"]:checked')?.value === 'ya'
        && isPhysicalActivity(modal.querySelector('#conditionalDetails input')?.value || '');
    }
    if (current.kind === 'nutrition') {
      return ['food0', 'food1', 'food2', 'food3', 'food4']
        .filter(name => modal.querySelector(`input[name="${name}"]:checked`)?.value === 'ya').length >= 3;
    }
    if (current.id === 'belajar') {
      return modal.querySelector('input[name="mainAnswer"]:checked')?.value === 'ya'
        && [...modal.querySelectorAll('#conditionalDetails input')].some(input => isStudyActivity(input.value));
    }
    if (current.id === 'masyarakat') {
      return modal.querySelector('input[name="mainAnswer"]:checked')?.value === 'ya'
        && [...modal.querySelectorAll('#conditionalDetails input')].some(input => isSocialActivity(input.value));
    }
    return false;
  };

  const slideEntryButton = [...document.querySelectorAll('.slide-enter button')]
    .find(button => button.textContent.includes('Langsung masuk ke jurnal'));
  if (slideEntryButton) slideEntryButton.textContent = 'Mulai isi jurnal →';

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
    refreshReminderState();
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
      return {
        name: modal.querySelector('.field input').value.trim(),
        confirmed: true
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
    answers.orangtua = {
      name: String(answers.orangtua?.name || '').trim(),
      confirmed: true
    };
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

  window.downloadMonthlyPDF = async function (periodKey) {
    await document.fonts.load('700 24px Inter');
    const [year, monthNumber] = periodKey.split('-').map(Number);
    const month = monthNumber - 1;
    const period = new Date(year, month, 1);
    const days = new Date(year, month + 1, 0).getDate();
    const aspects = [
      ['bangun', 'Bangun Pagi'], ['ibadah', 'Taat Beribadah'],
      ['olahraga', 'Rajin Berolahraga'], ['makan', 'Makan Sehat dan Bergizi'],
      ['belajar', 'Gemar Belajar'], ['masyarakat', 'Bermasyarakat'],
      ['tidur', 'Tidur Cepat']
    ];
    const scores = aspects.map(([id, label]) => {
      let count = 0;
      for (let day = 1; day <= days; day++) {
        if (achievementByDate[dateKey(new Date(year, month, day, 12))]?.[id] === true) count++;
      }
      return { label, count, percent: Math.round(count / days * 100) };
    });
    const low = scores.filter(item => item.percent < 70).map(item => item.label);
    const good = scores.filter(item => item.percent >= 70).map(item => item.label);
    const periodName = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(period);
    const studentName = document.querySelector('.welcome h2').textContent.replace(/^Halo,\s*/, '').replace(/!$/, '').trim();
    const safeStudent = studentName.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const comment = good.length > low.length
      ? 'Kamu sudah menunjukkan perkembangan yang baik dalam menerapkan 7 Kebiasaan Anak Indonesia Hebat. Sebagian besar kebiasaanmu sudah konsisten di atas 70%. Pertahankan dan terus tingkatkan, terutama pada kebiasaan yang masih perlu perhatian lebih. Kerja bagus, terus semangat jadi pribadi hebat!'
      : 'Kamu masih perlu meningkatkan konsistensi dalam menerapkan 7 Kebiasaan Anak Indonesia Hebat. Beberapa kebiasaan sudah mulai terlihat, namun sebagian besar masih di bawah 70%. Ayo semangat memperbaiki dan membiasakan diri dengan hal-hal positif setiap hari. Bapak dan Ibu guru yakin kamu bisa lebih baik lagi!';
    const W = 1240, H = 1754;
    const loadImage = src => new Promise((resolve, reject) => {
      const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = src;
    });
    const [schoolLogo, programLogo] = await Promise.all([loadImage('assets/logo-kb3.png'), loadImage('assets/logo-7kaih.png')]);
    const makePage = () => {
      const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
      return { canvas, ctx };
    };
    const setFont = (ctx, size, weight = 600) => { ctx.font = `${weight} ${size}px Inter`; };
    const box = (ctx, x, y, width, height, color) => {
      ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, width, height, 24); ctx.fill();
    };
    const wrap = (ctx, text, x, y, width, step) => {
      let line = ''; const lines = [];
      for (const word of text.split(' ')) {
        const test = (line + ' ' + word).trim();
        if (line && ctx.measureText(test).width > width) { lines.push(line); line = word; } else line = test;
      }
      if (line) lines.push(line);
      lines.forEach((value, index) => ctx.fillText(value, x, y + index * step));
      return y + lines.length * step;
    };

    const first = makePage(), c = first.ctx;
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, 270);
    c.strokeStyle = '#111111'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, 269); c.lineTo(W, 269); c.stroke();
    c.drawImage(schoolLogo, 75, 55, 135, 134); c.drawImage(programLogo, 845, 75, 320, 94);
    c.fillStyle = '#000000'; setFont(c, 46, 800); c.fillText('CAPAIAN 7 KAIH', 245, 125);
    setFont(c, 34, 700); c.fillText('SDN Kalibaru 3', 245, 178);
    c.fillStyle = '#000000'; setFont(c, 38, 800); c.fillText(periodName, 85, 350);
    c.fillStyle = '#000000'; setFont(c, 32, 700); c.fillText(studentName, 85, 400);
    scores.forEach((item, index) => {
      const y = 485 + index * 145;
      c.fillStyle = '#000000'; setFont(c, 25, 700); c.fillText(item.label, 85, y);
      c.textAlign = 'right'; setFont(c, 38, 800); c.fillText(item.percent + '%', 1145, y + 5); c.textAlign = 'left';
      box(c, 420, y - 28, 620, 32, '#e5eee9'); box(c, 420, y - 28, 620 * item.percent / 100, 32, '#07865f');
      c.fillStyle = '#000000'; setFont(c, 18, 500); c.fillText(`${item.count} dari ${days} hari tercapai`, 85, y + 39);
    });
    c.fillStyle = '#000000'; setFont(c, 18, 500);
    c.fillText('Persentase = jumlah hari kebiasaan tercapai / total hari dalam bulan × 100%', 85, 1650);
    setFont(c, 15, 500); c.fillText('Diunduh dari Web Jurnal 7 Kebiasaan Anak Indonesia Hebat SDN Kalibaru 3', 85, 1695);

    const second = makePage(), d = second.ctx;
    d.fillStyle = '#ffffff'; d.fillRect(0, 0, W, 235);
    d.strokeStyle = '#111111'; d.lineWidth = 3; d.beginPath(); d.moveTo(0, 234); d.lineTo(W, 234); d.stroke();
    d.fillStyle = '#000000'; setFont(d, 45, 800); d.fillText('REFLEKSI DAN KOMENTAR GURU', 85, 115);
    setFont(d, 32, 700); d.fillText(studentName + ' · ' + periodName, 85, 172);
    d.fillStyle = '#000000'; setFont(d, 34, 800); d.fillText('Refleksi Diri', 85, 330);
    box(d, 70, 375, 1100, 360, '#f0f7f4'); d.fillStyle = '#000000'; setFont(d, 25, 700);
    let y = wrap(d, 'Hal yang harus ku tingkatkan: ' + (low.length ? low.join(', ') : 'Tidak ada.'), 105, 440, 1030, 39) + 55;
    wrap(d, 'Aku sudah baik dalam: ' + (good.length ? good.join(', ') : 'Belum ada.'), 105, y, 1030, 39);
    setFont(d, 34, 800); d.fillText('Komentar Guru', 85, 850);
    box(d, 70, 895, 1100, 465, '#fff7dc'); d.fillStyle = '#000000'; setFont(d, 25, 600);
    wrap(d, comment, 105, 965, 1030, 42);
    box(d, 70, 1455, 1100, 150, '#e9f5ef'); d.fillStyle = '#000000'; setFont(d, 24, 700);
    d.fillText('Terus lakukan kebiasaan baik setiap hari.', 105, 1518); setFont(d, 20, 500);
    d.fillText('Jurnal membantu kita mengenali perkembangan diri dan terus bertumbuh.', 105, 1563);
    d.fillStyle = '#000000'; setFont(d, 15, 500);
    d.fillText('Diunduh dari Web Jurnal 7 Kebiasaan Anak Indonesia Hebat SDN Kalibaru 3', 85, 1695);

    const toBytes = canvas => {
      const raw = atob(canvas.toDataURL('image/jpeg', .94).split(',')[1]);
      const bytes = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
      return bytes;
    };
    const pictures = [toBytes(first.canvas), toBytes(second.canvas)], encode = value => new TextEncoder().encode(value);
    const chunks = [], offsets = [0]; let length = 0;
    const push = value => { const bytes = typeof value === 'string' ? encode(value) : value; chunks.push(bytes); length += bytes.length; };
    const object = (number, value) => { offsets[number] = length; push(`${number} 0 obj\n${value}\nendobj\n`); };
    const imageObject = (number, bytes) => {
      offsets[number] = length;
      push(`${number} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${W} /Height ${H} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`);
      push(bytes); push('\nendstream\nendobj\n');
    };
    push('%PDF-1.4\n'); object(1, '<< /Type /Catalog /Pages 2 0 R >>');
    object(2, '<< /Type /Pages /Kids [3 0 R 6 0 R] /Count 2 >>');
    object(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /P 4 0 R >> >> /Contents 5 0 R >>');
    imageObject(4, pictures[0]); object(5, '<< /Length 32 >>\nstream\nq 595 0 0 842 0 0 cm /P Do Q\nendstream');
    object(6, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /P 7 0 R >> >> /Contents 8 0 R >>');
    imageObject(7, pictures[1]); object(8, '<< /Length 32 >>\nstream\nq 595 0 0 842 0 0 cm /P Do Q\nendstream');
    const xref = length; push('xref\n0 9\n0000000000 65535 f \n');
    for (let i = 1; i <= 8; i++) push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
    push(`trailer\n<< /Size 9 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
    const blob = new Blob(chunks, { type: 'application/pdf' }), link = document.createElement('a');
    const monthFile = new Intl.DateTimeFormat('id-ID', { month: 'long' }).format(period);
    link.href = URL.createObjectURL(blob); link.download = `Capaian-Jurnal7Kaih-${monthFile}-${year}-${safeStudent}.pdf`; link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1500);
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
