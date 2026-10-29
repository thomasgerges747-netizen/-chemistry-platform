/* لوحة الإدارة: إحصاءات، طلاب، حضور بالكاميرا، واجبات، تصحيح، إعلانات، أسئلة، مشرفون، أمان، سجل */
import jsQR from 'jsqr';
import { api } from '../api.js';
import {
  esc, toast, confirmDialog, openModal, closeModal, badge, spinner, emptyState, formatDate, timeAgo,
  toArabicDigits as AR, copyText, ring, percent,
} from '../ui.js';
import { celebrate } from '../effects.js';

const TABS = [
  { id: 'overview', label: '📊 نظرة عامة' },
  { id: 'attendance', label: '📷 الحضور بالكاميرا' },
  { id: 'students', label: '👨‍🎓 الطلاب' },
  { id: 'homeworks', label: '📝 الواجبات' },
  { id: 'grading', label: '✅ التصحيح' },
  { id: 'announcements', label: '📣 الإعلانات' },
  { id: 'bank', label: '🏦 بنك الأسئلة' },
  { id: 'admins', label: '🛡️ المشرفون' },
  { id: 'security', label: '🔐 الأمان' },
  { id: 'audit', label: '🧾 سجل التدقيق' },
];

export function renderAdmin(root, { state, navigate }) {
  const me = state.profile || {};
  const isOwner = me.title === 'المشرف العام';
  root.innerHTML = `
    <div class="tabs" id="adm-tabs">
      ${TABS.map((t) => `<button class="tab" data-tab="${t.id}">${t.label}</button>`).join('')}
    </div>
    <div id="adm-body" style="margin-top:16px">${spinner()}</div>`;

  const body = root.querySelector('#adm-body');
  const tabBar = root.querySelector('#adm-tabs');
  let current = state.tab && TABS.some((t) => t.id === state.tab) ? state.tab : 'overview';
  let stopScanner = null;

  function setTab(id) {
    current = id;
    sync();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function sync() {
    tabBar.querySelectorAll('.tab').forEach((b) => b.classList.toggle('is-active', b.dataset.tab === current));
    if (stopScanner && current !== 'attendance') {
      stopScanner();
      stopScanner = null;
    }
  }
  tabBar.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
  sync();

  const go = (view, tab) => navigate(view, { tab });
  body.addEventListener('click', (event) => {
    const target = event.target.closest('[data-tab-go]');
    if (target) setTab(target.dataset.tabGo);
  });

  function paint() {
    if (current === 'overview') return overview();
    if (current === 'attendance') return attendance();
    if (current === 'students') return students();
    if (current === 'homeworks') return homeworks();
    if (current === 'grading') return grading();
    if (current === 'announcements') return announcements();
    if (current === 'bank') return bank();
    if (current === 'admins') return admins();
    if (current === 'security') return security();
    if (current === 'audit') return audit();
  }

  /* =============================== النظرة العامة =============================== */
  async function overview() {
    body.innerHTML = spinner();
    try {
      const data = await api.get('/admin/overview');
      const max = Math.max(1, ...data.trend.map((d) => d.attendance));
      body.innerHTML = `
        <div class="grid grid--kpi">
          ${kpi('👨‍🎓', AR(data.kpis.students), 'طالب نشط')}
          ${kpi('✅', AR(data.kpis.todayAttendance), 'حضور اليوم')}
          ${kpi('📝', AR(data.kpis.pendingGrading), 'بانتظار التصحيح')}
          ${kpi('🎯', `${AR(data.kpis.avgQuiz)}٪`, 'متوسط الاختبارات')}
          ${kpi('🛡️', AR(data.kpis.admins), 'مشرفون')}
          ${kpi('📚', AR(data.kpis.homeworks), 'واجبات منشورة')}
          ${kpi('🏷️', AR(data.kpis.groups), 'مجموعات')}
          ${kpi('📈', AR(data.kpis.avgScore), 'متوسط الدرجات')}
        </div>

        <div class="grid grid--2" style="margin-top:14px">
          <div class="card card--pad">
            <h4 style="margin-bottom:14px">📈 الحضور آخر ٧ أيام</h4>
            <div class="chart">
              ${data.trend
                .map(
                  (d) => `<div class="chart__col">
                    <div class="chart__val">${AR(d.attendance)}</div>
                    <div class="chart__bar" style="height:${Math.max(6, Math.round((d.attendance / max) * 100))}%"></div>
                    <div class="chart__label">${esc(d.label)}</div>
                  </div>`,
                )
                .join('')}
            </div>
          </div>
          <div class="card card--pad">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
              <h4>⏳ تصحيح معلّق</h4>
              <button class="btn btn--ghost btn--xs" data-tab-go="grading">الكل</button>
            </div>
            ${data.pending.length
              ? data.pending
                  .map(
                    (s) => `<div class="row-item">
                      <div class="row-item__main">
                        <div class="row-item__title">${esc(s.studentName)}</div>
                        <div class="row-item__sub">${esc(s.homeworkTitle)} • ${timeAgo(s.at)}</div>
                      </div>
                      <div class="row-item__side">${badge('معلّق', 'amber')}</div>
                    </div>`,
                  )
                  .join('')
              : '<div class="form-note">لا توجد إجابات بانتظار التصحيح 🎉</div>'}
          </div>
        </div>

        <div class="grid grid--2" style="margin-top:14px">
          <div class="card card--pad">
            <h4 style="margin-bottom:10px">🏷️ المجموعات</h4>
            ${data.groups
              .map((g) => `<div class="meta-row"><span>${esc(g.name)}</span><span>${AR(g.count)} طالب</span></div>`)
              .join('')}
          </div>
          <div class="card card--pad">
            <h4 style="margin-bottom:10px">🧾 آخر العمليات</h4>
            ${data.recent.length
              ? data.recent
                  .map(
                    (a) => `<div class="meta-row"><span>${esc(a.action)} — ${esc(a.detail || '')}</span><span>${timeAgo(a.at)}</span></div>`,
                  )
                  .join('')
              : '<div class="form-note">لا توجد عمليات مسجلة.</div>'}
          </div>
        </div>

        <div class="card card--pad" style="margin-top:14px">
          <h4 style="margin-bottom:10px">⚡ اختصارات سريعة</h4>
          <div style="display:flex;flex-wrap:wrap;gap:8px">
            <button class="btn btn--primary btn--sm" data-tab-go="attendance">📷 ابدأ تسجيل الحضور</button>
            <button class="btn btn--ghost btn--sm" data-tab-go="homeworks">➕ واجب جديد</button>
            <button class="btn btn--ghost btn--sm" data-tab-go="admins">🛡️ إضافة مشرف</button>
            <button class="btn btn--ghost btn--sm" data-export="students">⬇️ تصدير الطلاب</button>
            <button class="btn btn--ghost btn--sm" data-export="attendance">⬇️ تصدير الحضور</button>
            <button class="btn btn--ghost btn--sm" data-export="grades">⬇️ تصدير الدرجات</button>
          </div>
        </div>`;

      body.querySelectorAll('[data-export]').forEach((b) =>
        b.addEventListener('click', () => exportCsv(b.dataset.export)),
      );
    } catch (err) {
      body.innerHTML = emptyState('⚠️', 'تعذّر تحميل الإحصاءات', err.message);
    }
  }

  const kpi = (icon, value, label) =>
    `<div class="kpi"><div class="kpi__icon">${icon}</div><div class="kpi__value">${value}</div><div class="kpi__label">${label}</div></div>`;

  async function exportCsv(type) {
    try {
      const blob = await api.blob(`/admin/export?type=${type}`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${type}-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
      toast('تم تجهيز الملف', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  /* =============================== الحضور =============================== */
  async function attendance() {
    body.innerHTML = `
      <div class="section-head">
        <div><h2>تسجيل الحضور</h2><p>امسح QR من بطاقة الطالب بالكاميرا، أو اكتب الكود يدوياً. كل حضور يمنح الطالب ٥ نقاط.</p></div>
        <div>${badge('يعمل على HTTPS فقط للكاميرا', 'muted')}</div>
      </div>

      <div class="grid grid--2">
        <div class="card card--pad">
          <h4 style="margin-bottom:10px">📷 ماسح البطاقات</h4>
          <div class="scanner" id="scanner">
            <video id="scan-video" playsinline muted></video>
            <div class="scanner__frame"></div>
            <div class="scanner__laser"></div>
            <div class="scanner__hint" id="scan-hint">اضغط «تشغيل الكاميرا» ثم وجّه البطاقة إلى الإطار</div>
          </div>
          <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
            <button class="btn btn--primary btn--sm" id="cam-start">تشغيل الكاميرا</button>
            <button class="btn btn--ghost btn--sm" id="cam-stop" disabled>إيقاف</button>
          </div>
          <div class="field" style="margin-top:12px">
            <label for="att-session">اسم الحصة</label>
            <input id="att-session" value="حصة اليوم" maxlength="60" />
          </div>
        </div>

        <div class="card card--pad">
          <h4 style="margin-bottom:10px">⌨️ إدخال يدوي</h4>
          <div class="field">
            <label for="att-code">كود الطالب</label>
            <input id="att-code" placeholder="مثال: STU2601" maxlength="30" autocomplete="off" />
            <small>الكود يظهر على بطاقة الطالب وفي ملفه.</small>
          </div>
          <button class="btn btn--lime btn--block" id="att-send">تسجيل الحضور</button>
          <div id="att-result" style="margin-top:12px"></div>
          <div class="card card--pad" style="margin-top:12px;background:rgba(255,255,255,.02)">
            <h4 style="font-size:13px;margin-bottom:8px">آخر تسجيلات اليوم</h4>
            <div id="att-today">${spinner('جارٍ التحميل…')}</div>
          </div>
        </div>
      </div>`;

    const hint = body.querySelector('#scan-hint');
    const result = body.querySelector('#att-result');
    const startBtn = body.querySelector('#cam-start');
    const stopBtn = body.querySelector('#cam-stop');

    startBtn.addEventListener('click', async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        hint.textContent = 'المتصفح لا يدعم الكاميرا — استخدم الإدخال اليدوي.';
        return;
      }
      try {
        stopScanner = await startCamera(body, async (payload) => {
          const code = String(payload).includes(':') ? String(payload).split(':').pop() : String(payload);
          await submitAttendance(code.trim().toUpperCase(), 'camera');
        });
        startBtn.disabled = true;
        stopBtn.disabled = false;
        hint.textContent = 'الكاميرا تعمل — وجّه بطاقة الطالب إلى الإطار';
      } catch (err) {
        hint.textContent = `تعذّر تشغيل الكاميرا: ${err.message || 'صلاحية مرفوضة'}`;
      }
    });
    stopBtn.addEventListener('click', () => {
      stopScanner?.();
      stopScanner = null;
      startBtn.disabled = false;
      stopBtn.disabled = true;
      hint.textContent = 'تم إيقاف الكاميرا';
    });

    async function submitAttendance(code, method) {
      if (!code) return;
      try {
        const data = await api.post('/admin/attendance', {
          code,
          method,
          session: body.querySelector('#att-session')?.value || 'حصة اليوم',
        });
        if (data.duplicate) {
          result.innerHTML = `<div class="banner banner--amber">${esc(data.message)}</div>`;
          toast(data.message, 'warn');
          return;
        }
        const s = data.student || {};
        result.innerHTML = `<div class="banner banner--green">✅ ${esc(data.message)} — ${esc(s.name || '')} (${esc(s.group || '')})</div>`;
        toast('تم تسجيل الحضور (+٥ نقاط)', 'success');
        celebrate(window.innerWidth / 2, window.innerHeight / 3, 40);
        loadToday();
      } catch (err) {
        result.innerHTML = `<div class="banner banner--red">⚠️ ${esc(err.message)}</div>`;
      }
    }

    body.querySelector('#att-send').addEventListener('click', () => {
      const input = body.querySelector('#att-code');
      const code = input.value.trim().toUpperCase();
      if (!code) return toast('اكتب كود الطالب', 'warn');
      submitAttendance(code, 'manual');
      input.value = '';
      input.focus();
    });
    body.querySelector('#att-code').addEventListener('keydown', (event) => {
      if (event.key === 'Enter') body.querySelector('#att-send').click();
    });

    async function loadToday() {
      const host = body.querySelector('#att-today');
      if (!host) return;
      try {
        const rows = await api.get('/admin/attendance');
        const today = new Date().toISOString().slice(0, 10);
        const list = rows.filter((r) => r.at.slice(0, 10) === today).slice(0, 8);
        host.innerHTML = list.length
          ? list
              .map(
                (r) => `<div class="meta-row"><span>${esc(r.studentName)}</span><span>${new Date(r.at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })} • ${r.method === 'camera' ? 'كاميرا' : 'يدوي'}</span></div>`,
              )
              .join('')
          : '<div class="form-note">لا تسجيلات اليوم بعد.</div>';
      } catch {
        host.innerHTML = '<div class="form-note">تعذّر تحميل السجل.</div>';
      }
    }
    loadToday();
  }

  async function startCamera(host, onCode) {
    const video = host.querySelector('#scan-video');
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    let stopped = false;
    let raf = 0;
    let lastCode = '';
    let lastAt = 0;

    const tick = () => {
      if (stopped) return;
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        try {
          const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const found = jsQR(image.data, image.width, image.height, { inversionAttempts: 'attemptBoth' });
          if (found?.data) {
            const now = Date.now();
            if (found.data !== lastCode || now - lastAt > 6000) {
              lastCode = found.data;
              lastAt = now;
              onCode(found.data);
            }
          }
        } catch {
          /* تجاهل إطارات غير قابلة للقراءة */
        }
      }
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    };
  }

  /* =============================== الطلاب =============================== */
  async function students() {
    body.innerHTML = `
      <div class="section-head">
        <div><h2>الطلاب</h2><p>بحث، تعديل، إعادة تعيين كلمة سر، أو حذف.</p></div>
        <div style="display:flex;gap:8px">
          <button class="btn btn--ghost btn--sm" data-export="students">⬇️ تصدير</button>
          <button class="btn btn--primary btn--sm" id="stu-add">➕ طالب جديد</button>
        </div>
      </div>
      <div class="card card--pad" style="margin-bottom:12px">
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <input id="stu-q" placeholder="ابحث بالاسم أو الكود أو الهاتف" style="flex:1;min-width:200px" />
          <select id="stu-group" style="min-width:150px"><option value="">كل المجموعات</option></select>
        </div>
      </div>
      <div class="card table-wrap"><table class="table"><thead>
        <tr><th>الطالب</th><th>الكود</th><th>المجموعة</th><th>النقاط</th><th>الحالة</th><th>إجراءات</th></tr>
      </thead><tbody id="stu-rows"><tr><td colspan="6">${spinner()}</td></tr></tbody></table></div>`;

    const rows = body.querySelector('#stu-rows');
    const q = body.querySelector('#stu-q');
    const groupSel = body.querySelector('#stu-group');

    async function loadGroups() {
      try {
        const meta = await api.get('/meta');
        groupSel.innerHTML = '<option value="">كل المجموعات</option>' + meta.groups.map((g) => `<option>${esc(g.name)}</option>`).join('');
      } catch { /* تجاهل */ }
    }

    async function loadList() {
      rows.innerHTML = `<tr><td colspan="6">${spinner()}</td></tr>`;
      try {
        const params = new URLSearchParams();
        if (q.value.trim()) params.set('q', q.value.trim());
        if (groupSel.value) params.set('group', groupSel.value);
        const list = await api.get(`/admin/students?${params.toString()}`);
        rows.innerHTML = list.length
          ? list
              .map(
                (s) => `<tr>
                  <td>${esc(s.name)}<div class="row-item__sub">${esc(s.phone || '—')}</div></td>
                  <td><code>${esc(s.code)}</code></td>
                  <td>${esc(s.group)}</td>
                  <td>${AR(s.points)}</td>
                  <td>${s.active ? badge('نشط', 'green') : badge('موقوف', 'red')}</td>
                  <td>
                    <button class="btn btn--ghost btn--xs" data-act="toggle" data-id="${s.id}" data-active="${s.active}">${s.active ? 'إيقاف' : 'تنشيط'}</button>
                    <button class="btn btn--ghost btn--xs" data-act="reset" data-id="${s.id}">كلمة سر</button>
                    <button class="btn btn--ghost btn--xs" data-act="del" data-id="${s.id}" data-name="${esc(s.name)}">حذف</button>
                  </td>
                </tr>`,
              )
              .join('')
          : '<tr><td colspan="6">لا نتائج مطابقة.</td></tr>';
      } catch (err) {
        rows.innerHTML = `<tr><td colspan="6">${esc(err.message)}</td></tr>`;
      }
    }

    rows.addEventListener('click', async (event) => {
      const btn = event.target.closest('[data-act]');
      if (!btn) return;
      const { act, id, name } = btn.dataset;
      try {
        if (act === 'toggle') {
          await api.patch(`/admin/students/${id}`, { active: btn.dataset.active !== 'true' });
          toast('تم تحديث حالة الطالب', 'success');
          loadList();
        } else if (act === 'reset') {
          const data = await api.post(`/admin/students/${id}/reset-password`, {});
          openModal({
            title: 'كلمة سر مؤقتة',
            body: `<p>كلمة السر الجديدة:</p><div class="copy-box">${esc(data.tempPassword)}</div>
                   <p class="form-note">انسخها وسلّمها للطالب الآن — لن تظهر مرة أخرى.</p>`,
            actions: [{ label: 'نسخ وإغلاق', kind: 'primary', onClick: () => { copyText(data.tempPassword); closeModal(); } }],
          });
        } else if (act === 'del') {
          if (!(await confirmDialog({ title: 'حذف طالب', message: `حذف ${name} وكل سجلاته؟ لا يمكن الرجوع.`, confirmLabel: 'حذف' }))) return;
          await api.del(`/admin/students/${id}`);
          toast('تم حذف الطالب', 'success');
          loadList();
        }
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    body.querySelector('#stu-add').addEventListener('click', () => studentForm(loadList));
    let timer = 0;
    q.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(loadList, 320);
    });
    groupSel.addEventListener('change', loadList);
    loadGroups();
    loadList();
  }

  function studentForm(onDone) {
    openModal({
      title: 'إضافة طالب',
      wide: true,
      body: `
        <div class="grid grid--2">
          <div class="field"><label>الاسم الرباعي</label><input id="f-name" maxlength="60" /></div>
          <div class="field"><label>الهاتف</label><input id="f-phone" maxlength="20" placeholder="01xxxxxxxxx" /></div>
          <div class="field"><label>هاتف ولي الأمر</label><input id="f-parent" maxlength="20" /></div>
          <div class="field"><label>المدرسة</label><input id="f-school" maxlength="80" /></div>
          <div class="field"><label>المحافظة</label><input id="f-gov" maxlength="40" /></div>
          <div class="field"><label>المجموعة</label><select id="f-group"></select></div>
        </div>
        <div class="form-error" id="f-err" hidden></div>`,
      actions: [
        { label: 'إلغاء', kind: 'ghost' },
        {
          label: 'إضافة الطالب',
          kind: 'primary',
          onClick: async () => {
            const payload = {
              name: document.getElementById('f-name').value.trim(),
              phone: document.getElementById('f-phone').value.trim(),
              parentPhone: document.getElementById('f-parent').value.trim(),
              school: document.getElementById('f-school').value.trim(),
              governorate: document.getElementById('f-gov').value.trim(),
              group: document.getElementById('f-group').value,
            };
            try {
              const data = await api.post('/admin/students', payload);
              closeModal();
              openModal({
                title: 'تمت الإضافة',
                body: `<p>الكود: <b style="font-family:var(--mono);color:var(--lime)">${esc(data.student.code)}</b></p>
                       <p>كلمة سر مؤقتة: <b style="font-family:var(--mono)">${esc(data.tempPassword)}</b></p>`,
                actions: [{ label: 'تم', kind: 'primary', onClick: closeModal }],
              });
              onDone?.();
            } catch (err) {
              const box = document.getElementById('f-err');
              box.hidden = false;
              box.textContent = err.message;
            }
          },
        },
      ],
    });
    api.get('/meta')
      .then((meta) => {
        const sel = document.getElementById('f-group');
        if (sel) sel.innerHTML = meta.groups.map((g) => `<option>${esc(g.name)}</option>`).join('');
      })
      .catch(() => {});
  }

  /* =============================== الواجبات =============================== */
  async function homeworks() {
    body.innerHTML = `
      <div class="section-head">
        <div><h2>الواجبات</h2><p>أنشئ واجباً وحدّد الدرجة القصوى والمجموعة وآخر موعد.</p></div>
        <div><button class="btn btn--primary btn--sm" id="hw-new">➕ واجب جديد</button></div>
      </div>
      <div class="card card--pad" id="hw-form-card" hidden>
        <div class="grid grid--2">
          <div class="field"><label>العنوان</label><input id="hw-title" maxlength="80" /></div>
          <div class="field"><label>الدرجة القصوى</label><input id="hw-max" type="number" min="1" max="100" value="10" /></div>
          <div class="field"><label>المجموعة</label><select id="hw-group"></select></div>
          <div class="field"><label>آخر موعد</label><input id="hw-due" type="date" /></div>
        </div>
        <div class="field"><label>الوصف</label><textarea id="hw-body" rows="3" maxlength="2000"></textarea></div>
        <div class="form-error" id="hw-err" hidden></div>
        <div style="display:flex;gap:8px"><button class="btn btn--lime btn--sm" id="hw-save">نشر الواجب</button>
        <button class="btn btn--ghost btn--sm" id="hw-cancel">إلغاء</button></div>
      </div>
      <div class="card table-wrap" style="margin-top:12px"><table class="table"><thead>
        <tr><th>الواجب</th><th>المجموعة</th><th>الدرجة</th><th>مُسلَّم</th><th>مُصحّح</th><th></th></tr>
      </thead><tbody id="hw-rows"><tr><td colspan="6">${spinner()}</td></tr></tbody></table></div>`;

    const formCard = body.querySelector('#hw-form-card');
    const rows = body.querySelector('#hw-rows');
    body.querySelector('#hw-new').addEventListener('click', () => {
      formCard.hidden = false;
      body.querySelector('#hw-title').focus();
    });
    body.querySelector('#hw-cancel').addEventListener('click', () => (formCard.hidden = true));

    try {
      const meta = await api.get('/meta');
      body.querySelector('#hw-group').innerHTML =
        '<option value="الكل">الكل</option>' + meta.groups.map((g) => `<option>${esc(g.name)}</option>`).join('');
    } catch { /* تجاهل */ }

    body.querySelector('#hw-save').addEventListener('click', async () => {
      const err = body.querySelector('#hw-err');
      const payload = {
        title: body.querySelector('#hw-title').value.trim(),
        body: body.querySelector('#hw-body').value.trim(),
        maxScore: Number(body.querySelector('#hw-max').value) || 10,
        group: body.querySelector('#hw-group').value,
        dueDate: body.querySelector('#hw-due').value || '',
      };
      try {
        await api.post('/admin/homeworks', payload);
        err.hidden = true;
        formCard.hidden = true;
        toast('تم نشر الواجب', 'success');
        load();
      } catch (e) {
        err.hidden = false;
        err.textContent = e.message;
      }
    });

    rows.addEventListener('click', async (event) => {
      const btn = event.target.closest('[data-del]');
      if (!btn) return;
      if (!(await confirmDialog({ title: 'حذف واجب', message: 'سيتم حذف الواجب وكل تسليماته.', confirmLabel: 'حذف' }))) return;
      try {
        await api.del(`/admin/homeworks/${btn.dataset.del}`);
        toast('تم الحذف', 'success');
        load();
      } catch (e) {
        toast(e.message, 'error');
      }
    });

    async function load() {
      rows.innerHTML = `<tr><td colspan="6">${spinner()}</td></tr>`;
      try {
        const list = await api.get('/admin/homeworks');
        rows.innerHTML = list.length
          ? list
              .map(
                (h) => `<tr>
                  <td>${esc(h.title)}<div class="row-item__sub">${esc((h.body || '').slice(0, 60))}…</div></td>
                  <td>${esc(h.group || 'الكل')}</td>
                  <td>${AR(h.maxScore)}</td>
                  <td>${AR(h.total)}</td>
                  <td>${AR(h.graded)}${h.pending ? ` <span style="color:var(--amber)">(${AR(h.pending)} معلّق)</span>` : ''}</td>
                  <td><button class="btn btn--ghost btn--xs" data-del="${h.id}">حذف</button></td>
                </tr>`,
              )
              .join('')
          : '<tr><td colspan="6">لا توجد واجبات بعد.</td></tr>';
      } catch (e) {
        rows.innerHTML = `<tr><td colspan="6">${esc(e.message)}</td></tr>`;
      }
    }
    load();
  }

  /* =============================== التصحيح =============================== */
  async function grading() {
    body.innerHTML = `
      <div class="section-head">
        <div><h2>تصحيح الواجبات</h2><p>راجع إجابة الطالب، أعطِ درجة وملاحظة — تُحتسب النقاط تلقائياً.</p></div>
        <div><select id="gr-filter">
          <option value="pending">المعلّقة فقط</option><option value="">الكل</option><option value="graded">المُصححة</option>
        </select></div>
      </div>
      <div id="gr-list" class="grid" style="gap:12px">${spinner()}</div>`;

    const list = body.querySelector('#gr-list');
    const filter = body.querySelector('#gr-filter');

    async function load() {
      list.innerHTML = spinner();
      try {
        const rows = await api.get(`/admin/submissions${filter.value ? `?status=${filter.value}` : ''}`);
        list.innerHTML = rows.length
          ? rows
              .map(
                (s) => `<div class="card card--pad">
                  <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
                    <div><h4 style="font-size:14.5px">${esc(s.studentName)} — ${esc(s.homeworkTitle)}</h4>
                    <div class="row-item__sub">${esc(s.studentCode)} • ${esc(s.group)} • ${timeAgo(s.at)}</div></div>
                    <div>${s.status === 'graded' ? badge(`${AR(s.score)}/${AR(s.maxScore)}`, 'green') : badge('بانتظار التصحيح', 'amber')}</div>
                  </div>
                  <div class="bubble" style="margin-top:10px;white-space:pre-wrap">${esc(s.text)}</div>
                  <div style="display:flex;gap:8px;align-items:flex-end;margin-top:10px;flex-wrap:wrap">
                    <div class="field" style="width:110px;margin:0">
                      <label>الدرجة (من ${AR(s.maxScore)})</label>
                      <input type="number" min="0" max="${s.maxScore}" value="${s.score ?? ''}" data-score="${s.id}" />
                    </div>
                    <div class="field" style="flex:1;min-width:180px;margin:0">
                      <label>ملاحظة</label>
                      <input maxlength="600" value="${esc(s.feedback || '')}" data-fb="${s.id}" placeholder="ملاحظة للطالب…" />
                    </div>
                    <button class="btn btn--primary btn--sm" data-grade="${s.id}" data-max="${s.maxScore}">حفظ</button>
                  </div>
                </div>`,
              )
              .join('')
          : emptyState('🎉', 'لا شيء هنا', 'لا توجد إجابات مطابقة للفلتر.');
      } catch (e) {
        list.innerHTML = emptyState('⚠️', 'تعذّر التحميل', e.message);
      }
    }

    list.addEventListener('click', async (event) => {
      const btn = event.target.closest('[data-grade]');
      if (!btn) return;
      const id = btn.dataset.grade;
      const score = Number(list.querySelector(`[data-score="${id}"]`).value);
      const feedback = list.querySelector(`[data-fb="${id}"]`).value.trim();
      const max = Number(btn.dataset.max);
      if (!Number.isFinite(score) || score < 0 || score > max) return toast(`الدرجة من ٠ إلى ${max}`, 'warn');
      btn.disabled = true;
      try {
        await api.patch(`/admin/submissions/${id}/grade`, { score, feedback });
        toast('تم حفظ الدرجة (+نقاط للطالب)', 'success');
        celebrate(window.innerWidth / 2, window.innerHeight / 3, 34);
        load();
      } catch (e) {
        toast(e.message, 'error');
        btn.disabled = false;
      }
    });

    filter.addEventListener('change', load);
    load();
  }

  /* =============================== الإعلانات =============================== */
  async function announcements() {
    body.innerHTML = `
      <div class="section-head">
        <div><h2>الإعلانات</h2><p>رسائل تظهر لكل الطلاب في صفحتهم الرئيسية.</p></div>
      </div>
      <div class="card card--pad">
        <div class="field"><label>العنوان</label><input id="an-title" maxlength="90" /></div>
        <div class="field"><label>النص</label><textarea id="an-body" rows="3" maxlength="800"></textarea></div>
        <label class="check"><input type="checkbox" id="an-pin" /> تثبيت في الأعلى</label>
        <div class="form-error" id="an-err" hidden></div>
        <button class="btn btn--primary btn--sm" id="an-save" style="margin-top:10px">نشر الإعلان</button>
      </div>
      <div id="an-list" class="grid" style="gap:10px;margin-top:12px">${spinner()}</div>`;

    const list = body.querySelector('#an-list');
    body.querySelector('#an-save').addEventListener('click', async () => {
      const err = body.querySelector('#an-err');
      try {
        await api.post('/admin/announcements', {
          title: body.querySelector('#an-title').value.trim(),
          body: body.querySelector('#an-body').value.trim(),
          pinned: body.querySelector('#an-pin').checked,
        });
        err.hidden = true;
        body.querySelector('#an-title').value = '';
        body.querySelector('#an-body').value = '';
        toast('تم نشر الإعلان', 'success');
        load();
      } catch (e) {
        err.hidden = false;
        err.textContent = e.message;
      }
    });

    list.addEventListener('click', async (event) => {
      const btn = event.target.closest('[data-del-ann]');
      if (!btn) return;
      try {
        await api.del(`/admin/announcements/${btn.dataset.delAnn}`);
        toast('تم الحذف', 'success');
        load();
      } catch (e) {
        toast(e.message, 'error');
      }
    });

    async function load() {
      list.innerHTML = spinner();
      try {
        const rows = await api.get('/announcements');
        list.innerHTML = rows.length
          ? rows
              .map(
                (a) => `<div class="card card--pad">
                  <div style="display:flex;justify-content:space-between;gap:8px">
                    <strong>${esc(a.title)} ${a.pinned ? badge('مثبّت', 'amber') : ''}</strong>
                    <button class="btn btn--ghost btn--xs" data-del-ann="${a.id}">حذف</button>
                  </div>
                  <p style="font-size:12.5px;color:var(--txt-dim);margin-top:6px;line-height:1.9">${esc(a.body)}</p>
                  <div class="row-item__sub" style="margin-top:6px">${esc(a.by || '')} • ${timeAgo(a.at)}</div>
                </div>`,
              )
              .join('')
          : '<div class="form-note">لا إعلانات بعد.</div>';
      } catch (e) {
        list.innerHTML = `<div class="form-note">${esc(e.message)}</div>`;
      }
    }
    load();
  }

  /* =============================== بنك الأسئلة =============================== */
  async function bank() {
    body.innerHTML = `
      <div class="section-head">
        <div><h2>بنك الأسئلة</h2><p>أسئلة إضافية يراها الطلاب في بنك الأسئلة.</p></div>
      </div>
      <div class="card card--pad">
        <div class="field"><label>السؤال</label><input id="bk-q" maxlength="200" /></div>
        <div class="grid grid--2">
          <div class="field"><label>الإجابة الصحيحة</label><input id="bk-a" maxlength="120" /></div>
          <div class="field"><label>الوحدة</label><select id="bk-unit"></select></div>
        </div>
        <div class="form-error" id="bk-err" hidden></div>
        <button class="btn btn--primary btn--sm" id="bk-save" style="margin-top:10px">إضافة السؤال</button>
      </div>
      <div id="bk-list" class="grid" style="gap:8px;margin-top:12px">${spinner()}</div>`;

    try {
      const meta = await api.get('/meta');
      body.querySelector('#bk-unit').innerHTML = (meta.units || []).map((u) => `<option>${esc(u)}</option>`).join('') || '<option>عام</option>';
    } catch {
      body.querySelector('#bk-unit').innerHTML = '<option>عام</option>';
    }

    body.querySelector('#bk-save').addEventListener('click', async () => {
      const err = body.querySelector('#bk-err');
      try {
        await api.post('/admin/bank', {
          question: body.querySelector('#bk-q').value.trim(),
          answer: body.querySelector('#bk-a').value.trim(),
          unit: body.querySelector('#bk-unit').value,
        });
        err.hidden = true;
        body.querySelector('#bk-q').value = '';
        body.querySelector('#bk-a').value = '';
        toast('تمت الإضافة', 'success');
        load();
      } catch (e) {
        err.hidden = false;
        err.textContent = e.message;
      }
    });

    async function load() {
      const list = body.querySelector('#bk-list');
      try {
        const rows = await api.get('/bank');
        list.innerHTML = rows.length
          ? rows
              .map(
                (r) => `<div class="card card--pad" style="padding:10px 12px">
                  <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap">
                    <div><strong style="font-size:13px">${esc(r.question)}</strong>
                    <div class="row-item__sub">الإجابة: ${esc(r.answer)} • ${esc(r.unit || 'عام')}</div></div>
                    <button class="btn btn--ghost btn--xs" data-del-bank="${r.id}">حذف</button>
                  </div>
                </div>`,
              )
              .join('')
          : '<div class="form-note">البنك فارغ.</div>';
      } catch (e) {
        list.innerHTML = `<div class="form-note">${esc(e.message)}</div>`;
      }
    }

    body.addEventListener('click', async (event) => {
      const btn = event.target.closest('[data-del-bank]');
      if (!btn) return;
      try {
        await api.del(`/admin/bank/${btn.dataset.delBank}`);
        toast('تم الحذف', 'success');
        load();
      } catch (e) {
        toast(e.message, 'error');
      }
    });
    load();
  }

  /* =============================== المشرفون =============================== */
  async function admins() {
    body.innerHTML = `
      <div class="section-head">
        <div><h2>المشرفون</h2><p>${isOwner ? 'أضف مشرفين أو أوقف حساباتهم. كلمات السر مشفّرة بـ scrypt.' : 'إضافة المشرفين متاحة للمشرف العام فقط — يمكنك عرض القائمة.'}</p></div>
        <div>${badge(isOwner ? 'مشرف عام' : 'مشرف', isOwner ? 'lime' : 'cyan')}</div>
      </div>
      ${isOwner ? `<div class="card card--pad">
        <h4 style="margin-bottom:10px">➕ إضافة مشرف جديد</h4>
        <div class="grid grid--2">
          <div class="field"><label>الاسم</label><input id="ad-name" maxlength="60" /></div>
          <div class="field"><label>اسم المستخدم (إنجليزي)</label><input id="ad-user" maxlength="30" dir="ltr" placeholder="supervisor1" /></div>
          <div class="field"><label>كلمة السر</label><input id="ad-pass" type="password" maxlength="64" /></div>
          <div class="field"><label>البريد (اختياري)</label><input id="ad-email" maxlength="80" dir="ltr" /></div>
          <div class="field"><label>الصلاحية</label><select id="ad-role">
            <option value="admin">مشرف</option><option value="owner">مشرف عام</option>
          </select></div>
        </div>
        <div class="form-error" id="ad-err" hidden></div>
        <button class="btn btn--primary btn--sm" id="ad-save" style="margin-top:10px">إضافة المشرف</button>
      </div>` : ''}
      <div id="ad-list" class="grid" style="gap:10px;margin-top:12px">${spinner()}</div>`;

    body.querySelector('#ad-save')?.addEventListener('click', async () => {
      const err = body.querySelector('#ad-err');
      try {
        await api.post('/admin/admins', {
          name: body.querySelector('#ad-name').value.trim(),
          username: body.querySelector('#ad-user').value.trim(),
          password: body.querySelector('#ad-pass').value,
          email: body.querySelector('#ad-email').value.trim(),
          role: body.querySelector('#ad-role').value,
        });
        err.hidden = true;
        ['#ad-name', '#ad-user', '#ad-pass', '#ad-email'].forEach((sel) => (body.querySelector(sel).value = ''));
        toast('تمت إضافة المشرف — يمكنه الدخول فوراً', 'success');
        celebrate(window.innerWidth / 2, window.innerHeight / 3, 44);
        load();
      } catch (e) {
        err.hidden = false;
        err.textContent = e.message;
      }
    });

    async function load() {
      const list = body.querySelector('#ad-list');
      try {
        const rows = await api.get('/admin/admins');
        list.innerHTML = rows
          .map(
            (a) => `<div class="card card--pad" style="padding:12px">
              <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center">
                <div>
                  <strong>${esc(a.name)}</strong> ${a.role === 'owner' ? badge('مشرف عام', 'lime') : badge('مشرف', 'cyan')}
                  <div class="row-item__sub">@${esc(a.username)} • ${a.lastLogin ? `آخر دخول ${timeAgo(a.lastLogin)}` : 'لم يدخل بعد'}</div>
                </div>
                <div style="display:flex;gap:6px">
                  ${a.active ? badge('نشط', 'green') : badge('موقوف', 'red')}
                  ${isOwner
                    ? `<button class="btn btn--ghost btn--xs" data-ad-toggle="${a.id}" data-active="${a.active}">${a.active ? 'إيقاف' : 'تنشيط'}</button>
                       <button class="btn btn--ghost btn--xs" data-ad-pass="${a.id}">كلمة سر</button>`
                    : ''}
                </div>
              </div>
            </div>`,
          )
          .join('');
      } catch (e) {
        list.innerHTML = `<div class="form-note">${esc(e.message)}</div>`;
      }
    }

    body.addEventListener('click', async (event) => {
      const toggle = event.target.closest('[data-ad-toggle]');
      const passBtn = event.target.closest('[data-ad-pass]');
      try {
        if (toggle) {
          await api.patch(`/admin/admins/${toggle.dataset.adToggle}`, { active: toggle.dataset.active !== 'true' });
          toast('تم التحديث', 'success');
          load();
        } else if (passBtn) {
          const value = prompt('كلمة السر الجديدة (٨ أحرف على الأقل، بها حرف ورقم):');
          if (!value) return;
          await api.patch(`/admin/admins/${passBtn.dataset.adPass}`, { password: value });
          toast('تم تغيير كلمة السر', 'success');
        }
      } catch (e) {
        toast(e.message, 'error');
      }
    });
    load();
  }

  /* =============================== الأمان =============================== */
  async function security() {
    body.innerHTML = spinner();
    try {
      const data = await api.get('/admin/security');
      const s = data.settings;
      body.innerHTML = `
        <div class="section-head">
          <div><h2>مركز الأمان</h2><p>إعدادات الحماية المطبقة على الخادم — التغيير متاح للمشرف العام.</p></div>
          <div>${data.isOwner ? badge('صلاحية كاملة', 'lime') : badge('قراءة فقط', 'muted')}</div>
        </div>
        <div class="grid grid--kpi">
          ${kpi('🔗', AR(data.activeSessions), 'جلسات نشطة')}
          ${kpi('⛔', AR(data.failedToday), 'محاولات فاشلة اليوم')}
          ${kpi('⏱️', `${AR(s.sessionMinutes)} د`, 'مدة الجلسة')}
          ${kpi('🔒', AR(s.maxAttempts), 'محاولات قبل القفل')}
        </div>
        <div class="grid grid--2" style="margin-top:14px">
          <div class="card card--pad">
            <h4 style="margin-bottom:10px">⚙️ الإعدادات</h4>
            <label class="check"><input type="checkbox" id="sec-locked" ${s.locked ? 'checked' : ''} ${data.isOwner ? '' : 'disabled'} /> إغلاق المنصة أمام الطلاب</label>
            <label class="check"><input type="checkbox" id="sec-reg" ${s.allowRegistration ? 'checked' : ''} ${data.isOwner ? '' : 'disabled'} /> السماح بالتسجيل الجديد</label>
            <div class="field" style="margin-top:10px"><label>رسالة الإغلاق</label>
              <input id="sec-msg" value="${esc(s.lockMessage || '')}" maxlength="160" ${data.isOwner ? '' : 'disabled'} /></div>
            <div class="field"><label>مدة الجلسة (دقيقة)</label>
              <input id="sec-session" type="number" min="10" max="480" value="${s.sessionMinutes}" ${data.isOwner ? '' : 'disabled'} /></div>
            <div class="form-error" id="sec-err" hidden></div>
            ${data.isOwner ? `<button class="btn btn--lime btn--sm" id="sec-save" style="margin-top:8px">حفظ الإعدادات</button>` : ''}
            <button class="btn btn--ghost btn--sm" id="sec-logout-all" style="margin-top:8px">إنهاء جميع الجلسات</button>
          </div>
          <div class="card card--pad">
            <h4 style="margin-bottom:10px">🛡️ الحمايات المفعّلة</h4>
            <div class="grid" style="gap:8px">
              ${data.protections.map((p) => `<div class="row-item"><div class="row-item__main"><div class="row-item__title" style="font-size:12.5px;font-weight:600">${esc(p)}</div></div><div class="row-item__side">${badge('مفعّل', 'green')}</div></div>`).join('')}
            </div>
          </div>
        </div>`;

      body.querySelector('#sec-save')?.addEventListener('click', async () => {
        const err = body.querySelector('#sec-err');
        try {
          await api.patch('/admin/security', {
            locked: body.querySelector('#sec-locked').checked,
            allowRegistration: body.querySelector('#sec-reg').checked,
            lockMessage: body.querySelector('#sec-msg').value,
            sessionMinutes: Number(body.querySelector('#sec-session').value),
          });
          toast('تم حفظ إعدادات الأمان', 'success');
        } catch (e) {
          err.hidden = false;
          err.textContent = e.message;
        }
      });
      body.querySelector('#sec-logout-all').addEventListener('click', async () => {
        if (!(await confirmDialog({ title: 'إنهاء الجلسات', message: 'سيتم خروج كل المشرفين والطلاب ما عداك.', confirmLabel: 'تنفيذ' }))) return;
        try {
          await api.patch('/admin/security', { forceLogout: true });
          toast('تم إنهاء جلسات الجميع', 'success');
        } catch (e) {
          toast(e.message, 'error');
        }
      });
    } catch (e) {
      body.innerHTML = emptyState('⚠️', 'تعذّر تحميل إعدادات الأمان', e.message);
    }
  }

  /* =============================== سجل التدقيق =============================== */
  async function audit() {
    body.innerHTML = spinner();
    try {
      const rows = await api.get('/admin/audit');
      body.innerHTML = `
        <div class="section-head">
          <div><h2>سجل التدقيق</h2><p>كل عملية حساسة تُسجَّل مع الفاعل والتفاصيل والوقت.</p></div>
          <div>${badge(`${AR(rows.length)} عملية`, 'violet')}</div>
        </div>
        <div class="card table-wrap"><table class="table"><thead>
          <tr><th>الوقت</th><th>المستخدم</th><th>العملية</th><th>التفاصيل</th></tr>
        </thead><tbody>
          ${rows.length
            ? rows
                .map(
                  (a) => `<tr><td style="white-space:nowrap">${formatDate(a.at, true)}</td><td>${esc(a.actor || '—')}</td>
                    <td>${esc(a.action)}</td><td>${esc(a.detail || '—')}</td></tr>`,
                )
                .join('')
            : '<tr><td colspan="4">السجل فارغ.</td></tr>'}
        </tbody></table></div>`;
    } catch (e) {
      body.innerHTML = emptyState('⚠️', 'تعذّر تحميل السجل', e.message);
    }
  }

  paint();
  return { destroy: () => stopScanner?.() };
}

/* تصدير صغير لاستخدامه من main.js في قائمة الحساب */
export function adminBadge(profile) {
  return percent(profile?.points || 0, 100);
}
