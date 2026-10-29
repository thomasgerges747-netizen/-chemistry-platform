/* لوحة الطالب: بيانات كاملة + QR، الحضور، الواجبات، النتائج، المتصدرون */
import { api, ApiError } from '../api.js';
import { esc, toast, badge, ring, spinner, formatDate, timeAgo, toArabicDigits as AR, emptyState, openModal, copyText, percent } from '../ui.js';
import { studentCard } from './auth.js';
import { downloadCard } from '../qr.js';
import { periodicTable, lessonsView, reactionsView, experimentsView, quizzesView } from './labs.js';
import { celebrate } from '../effects.js';

export function renderStudent(root, { state, navigate }) {
  const tabs = [
    { id: 'home', label: '🏠 الرئيسية' },
    { id: 'card', label: '🎫 بطاقتي' },
    { id: 'homework', label: '📝 الواجبات' },
    { id: 'table', label: '⚛️ الجدول الدوري' },
    { id: 'lessons', label: '📚 الدروس' },
    { id: 'lab', label: '🧪 مختبر التفاعلات' },
    { id: 'experiments', label: '🔬 التجارب' },
    { id: 'quiz', label: '🎯 الاختبارات' },
    { id: 'rank', label: '🏆 المتصدرون' },
  ];

  root.innerHTML = `
    <div class="tabs" id="stu-tabs">
      ${tabs.map((t) => `<button class="tab" data-tab="${t.id}">${t.label}</button>`).join('')}
    </div>
    <div id="stu-body" style="margin-top:16px">${spinner()}</div>`;

  const body = root.querySelector('#stu-body');
  const tabBar = root.querySelector('#stu-tabs');
  let current = state.tab && tabs.some((t) => t.id === state.tab) ? state.tab : 'home';
  let data = null;

  tabBar.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      current = btn.dataset.tab;
      syncTabs();
      paint();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  function syncTabs() {
    tabBar.querySelectorAll('.tab').forEach((b) => b.classList.toggle('is-active', b.dataset.tab === current));
  }
  syncTabs();

  async function load({ silent = false } = {}) {
    if (!silent) body.innerHTML = spinner();
    try {
      data = await api.get('/student/overview');
      state.profile = data.profile;
      paint();
    } catch (err) {
      body.innerHTML = emptyState('⚠️', 'تعذّر تحميل بياناتك', err.message);
    }
  }

  function paint() {
    if (!data) return;
    if (current !== 'table' && current !== 'lessons' && current !== 'lab' && current !== 'experiments' && current !== 'quiz') {
      if (current === 'home') return paintHome();
      if (current === 'card') return paintCard();
      if (current === 'homework') return paintHomework();
      if (current === 'rank') return paintRank();
    }
    if (current === 'table') return periodicTable(body, {});
    if (current === 'lessons') return lessonsView(body);
    if (current === 'lab') return reactionsView(body, { onQuiz: () => { current = 'quiz'; syncTabs(); paint(); } });
    if (current === 'experiments') return experimentsView(body);
    if (current === 'quiz') return paintQuizzes();
  }

  /* --------------------------- الرئيسية --------------------------- */
  function paintHome() {
    const p = data.profile;
    const pending = data.homeworks.filter((h) => !h.submission);
    body.innerHTML = `
      <div class="hero" style="padding:20px 0 6px">
        <span class="hero__badge">${badge('مسجّل ونشط', 'green')}</span>
        <h1>أهلاً <span class="grad">${esc(p.name)}</span></h1>
        <p class="lead">كودك <b style="font-family:var(--mono);letter-spacing:1.5px;color:var(--lime)">${esc(p.code)}</b> — مجموعتك: ${esc(p.group)}. كل الدروس والمختبرات مفتوحة لك.</p>
        <div class="hero__stats">
          <div class="stat"><strong>${AR(data.rank || 0)}</strong><span>ترتيبك</span></div>
          <div class="stat"><strong>${AR(p.points || 0)}</strong><span>نقاطك</span></div>
          <div class="stat"><strong>${AR(data.progress || 0)}٪</strong><span>تقدّم الواجبات</span></div>
          <div class="stat"><strong>${AR(data.attendance.length)}</strong><span>مرات الحضور</span></div>
        </div>
        <div class="hero__cta">
          <button class="btn btn--primary" data-go="homework">ابدأ الواجبات (${AR(pending.length)})</button>
          <button class="btn btn--ghost" data-go="table">استكشف الجدول الدوري</button>
        </div>
      </div>

      <div class="grid grid--kpi" style="margin-top:14px">
        <div class="kpi"><div class="kpi__icon">🎯</div><div class="kpi__value">${AR(data.avgQuiz)}٪</div><div class="kpi__label">متوسط الاختبارات</div></div>
        <div class="kpi"><div class="kpi__icon">📝</div><div class="kpi__value">${AR(data.homeworks.filter((h) => h.submission).length)}/${AR(data.homeworks.length)}</div><div class="kpi__label">واجبات مُسلّمة</div></div>
        <div class="kpi"><div class="kpi__icon">👥</div><div class="kpi__value">${AR(p.group)}</div><div class="kpi__label">مجموعتك</div></div>
        <div class="kpi"><div class="kpi__icon">📈</div><div class="kpi__value">${AR(data.totalStudents)}</div><div class="kpi__label">طالب على المنصة</div></div>
      </div>

      <div class="grid grid--2" style="margin-top:14px">
        <div class="card card--pad">
          <h4 style="margin-bottom:10px">📣 الإعلانات</h4>
          <div id="home-ann">${spinner('جارٍ التحميل…')}</div>
        </div>
        <div class="card card--pad">
          <h4 style="margin-bottom:10px">🎫 بطاقتك الرقمية</h4>
          <p style="font-size:12.5px;color:var(--txt-dim);line-height:1.9;margin-bottom:10px">امسح رمز QR من كاميرا المشرف لتسجيل الحضور. الكود: <b style="font-family:var(--mono);color:var(--lime)">${esc(p.code)}</b></p>
          <button class="btn btn--ghost btn--full" data-go="card">عرض البطاقة كاملة</button>
          <button class="btn btn--lime btn--block" data-dl-card style="margin-top:8px">تحميل البطاقة</button>
        </div>
      </div>

      <div class="card card--pad" style="margin-top:14px">
        <h4 style="margin-bottom:10px">📊 آخر نتائجك</h4>
        ${data.results.length
          ? `<div class="grid" style="gap:8px">${data.results
              .slice(0, 5)
              .map(
                (r) => `<div class="row-item"><div class="row-item__main"><div class="row-item__title">${esc(r.quizTitle)}</div><div class="row-item__sub">${timeAgo(r.at)}</div></div>
              <div class="row-item__side">${badge(`${AR(r.score)}/${AR(r.total)}`, percent(r.score, r.total) >= 50 ? 'green' : 'red')}</div></div>`,
              )
              .join('')}</div>`
          : '<div class="form-note">لم تخض اختباراً بعد — ابدأ من تبويب الاختبارات.</div>'}
      </div>`;

    body.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => {
      current = b.dataset.go;
      syncTabs();
      paint();
    }));
    body.querySelector('[data-dl-card]')?.addEventListener('click', () =>
      downloadCard(p).catch(() => toast('تعذّر تحميل البطاقة', 'error')),
    );
    loadAnnouncements(body.querySelector('#home-ann'));
  }

  async function loadAnnouncements(host) {
    try {
      const rows = await api.get('/announcements');
      host.innerHTML = rows.length
        ? `<div class="grid" style="gap:10px">${rows
            .map(
              (a) => `<div class="card" style="padding:12px">
                <div style="display:flex;gap:8px;align-items:center;margin-bottom:4px">
                  <strong style="font-size:13.5px">${esc(a.title)}</strong>
                  ${a.pinned ? badge('مثبّت', 'amber') : ''}
                </div>
                <p style="font-size:12.5px;color:var(--txt-dim);line-height:1.9">${esc(a.body)}</p>
                <div class="row-item__sub" style="margin-top:6px">${timeAgo(a.at)}</div>
              </div>`,
            )
            .join('')}</div>`
        : '<div class="form-note">لا توجد إعلانات حالياً.</div>';
    } catch {
      host.innerHTML = '<div class="form-note">تعذّر تحميل الإعلانات.</div>';
    }
  }

  /* ---------------------------- البطاقة ---------------------------- */
  async function paintCard() {
    body.innerHTML = spinner();
    body.innerHTML = `
      <div class="section-head">
        <div><h2>بطاقتك الرقمية</h2><p>هذه هي بياناتك الكاملة كما سجلتها — اعرضها على المشرف أو احفظها على الموبايل.</p></div>
      </div>
      <div id="card-host"></div>
      <div class="grid grid--2" style="margin-top:14px">
        <div class="card card--pad">
          <h4 style="margin-bottom:10px">سجل الحضور</h4>
          ${data.attendance.length
            ? `<div class="grid" style="gap:6px">${data.attendance
                .slice(0, 12)
                .map(
                  (a) => `<div class="meta-row"><span>${formatDate(a.at, true)}</span><span>${esc(a.session || 'حصة')} • ${a.method === 'camera' ? 'كاميرا' : 'يدوي'}</span></div>`,
                )
                .join('')}</div>`
            : '<div class="form-note">لم يُسجَّل حضورك بعد.</div>'}
        </div>
        <div class="card card--pad">
          <h4 style="margin-bottom:10px">حسابك</h4>
          <div class="meta-row"><span>تاريخ التسجيل</span><span>${formatDate(data.profile.createdAt, true)}</span></div>
          <div class="meta-row"><span>آخر دخول</span><span>${data.profile.lastLogin ? timeAgo(data.profile.lastLogin) : '—'}</span></div>
          <div class="meta-row"><span>الترتيب</span><span>${AR(data.rank)} من ${AR(data.totalStudents)}</span></div>
          <div class="meta-row"><span>الحالة</span><span>${data.profile.active ? 'نشط' : 'موقوف'}</span></div>
          <button class="btn btn--ghost btn--block" style="margin-top:12px" id="card-copy">نسخ كودي</button>
        </div>
      </div>`;

    const host = body.querySelector('#card-host');
    host.innerHTML = await studentCard(data.profile);
    host.querySelector('[data-card-download]')?.addEventListener('click', () =>
      downloadCard(data.profile).catch(() => toast('تعذّر تحميل البطاقة', 'error')),
    );
    host.querySelector('[data-card-copy]')?.addEventListener('click', (event) => copyText(event.currentTarget.dataset.cardCopy));
    body.querySelector('#card-copy')?.addEventListener('click', () => copyText(data.profile.code));
  }

  /* ---------------------------- الواجبات ---------------------------- */
  function paintHomework() {
    body.innerHTML = `
      <div class="section-head">
        <div><h2>الواجبات</h2><p>اكتب إجابتك ثم أرسلها — يستطيع المشرف تصحيحها وإضافة ملاحظات.</p></div>
        <div>${badge(`${AR(data.homeworks.filter((h) => h.submission).length)}/${AR(data.homeworks.length)} مُسلّم`, 'cyan')}</div>
      </div>
      <div id="hw-list" class="grid" style="gap:12px"></div>`;

    const list = body.querySelector('#hw-list');
    if (!data.homeworks.length) {
      list.innerHTML = emptyState('📭', 'لا توجد واجبات', 'لم ينشر المشرف واجبات بعد.');
      return;
    }
    list.innerHTML = data.homeworks
      .map((h) => {
        const sub = h.submission;
        const tone = !sub ? 'muted' : sub.status === 'graded' ? 'green' : 'amber';
        const label = !sub ? 'لم يُسلَّم' : sub.status === 'graded' ? `مُصحّح ${AR(sub.score)}/${AR(h.maxScore)}` : 'قيد التصحيح';
        return `
        <div class="card card--pad">
          <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:flex-start">
            <div style="min-width:0">
              <h4 style="font-size:15px">${esc(h.title)}</h4>
              <p style="font-size:12.5px;color:var(--txt-dim);line-height:1.9;margin-top:6px">${esc(h.body || '')}</p>
              <div class="row-item__sub" style="margin-top:8px">المجموعة: ${esc(h.group || 'الكل')} • الدرجة القصوى: ${AR(h.maxScore)} • آخر موعد: ${h.dueDate ? formatDate(h.dueDate) : '—'}</div>
            </div>
            <div>${badge(label, tone)}</div>
          </div>
          ${sub?.feedback ? `<div class="bubble" style="margin-top:10px"><strong>ملاحظة المشرف:</strong> ${esc(sub.feedback)}</div>` : ''}
          <div class="field" style="margin-top:12px">
            <label for="hw-${h.id}">إجابتك</label>
            <textarea id="hw-${h.id}" rows="4" placeholder="اكتب الحل خطوة بخطوة…" ${sub?.status === 'graded' ? 'disabled' : ''}>${esc(sub?.text || '')}</textarea>
            <small>${sub?.status === 'graded' ? 'تم تصحيح هذا الواجب ولا يمكن تعديله.' : 'يمكنك تعديل الإجابة قبل التصحيح.'}</small>
          </div>
          <div class="form-error" data-err="${h.id}" hidden></div>
          <button class="btn ${sub ? 'btn--ghost' : 'btn--primary'} btn--sm" data-submit="${h.id}" ${sub?.status === 'graded' ? 'disabled' : ''}>
            ${sub ? 'تحديث الإرسال' : 'تسليم الواجب'}
          </button>
        </div>`;
      })
      .join('');

    list.querySelectorAll('[data-submit]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.submit;
        const textarea = list.querySelector(`#hw-${id}`);
        const error = list.querySelector(`[data-err="${id}"]`);
        const text = textarea.value.trim();
        if (text.length < 10) {
          error.hidden = false;
          error.textContent = 'اكتب إجابة واضحة (١٠ أحرف على الأقل).';
          return;
        }
        error.hidden = true;
        btn.disabled = true;
        btn.textContent = 'جارٍ الإرسال…';
        try {
          await api.post(`/homeworks/${id}/submit`, { text });
          toast('تم تسليم الواجب (+٣ نقاط)', 'success');
          celebrate(window.innerWidth / 2, window.innerHeight / 2, 50);
          await load({ silent: true });
        } catch (err) {
          error.hidden = false;
          error.textContent = err.message;
          btn.disabled = false;
          btn.textContent = 'إعادة المحاولة';
        }
      });
    });
  }

  /* ---------------------------- المتصدرون ---------------------------- */
  async function paintRank() {
    body.innerHTML = spinner();
    try {
      const rows = await api.get('/leaderboard');
      body.innerHTML = `
        <div class="section-head">
          <div><h2>لوحة المتصدرين</h2><p>أعلى ٢٠ طالباً بالنقاط — النقاط من الواجبات والاختبارات والحضور.</p></div>
          <div>${badge(`ترتيبك ${AR(data.rank)}`, 'violet')}</div>
        </div>
        <div class="card card--pad">
          ${rows
            .map(
              (r, i) => `
            <div class="row-item ${r.name === data.profile.name ? 'is-active' : ''}">
              <div class="row-item__main">
                <div class="row-item__title">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : AR(r.rank)} — ${esc(r.name)}</div>
                <div class="row-item__sub">${esc(r.group)} • ${esc(r.code)}</div>
              </div>
              <div class="row-item__side">${badge(`${AR(r.points)} نقطة`, r.name === data.profile.name ? 'lime' : 'cyan')}</div>
            </div>`,
            )
            .join('')}
        </div>`;
    } catch (err) {
      body.innerHTML = emptyState('⚠️', 'تعذّر تحميل المتصدرين', err.message);
    }
  }

  /* ---------------------------- الاختبارات ---------------------------- */
  function paintQuizzes() {
    quizzesView(body, {
      onSubmit: async (payload) => {
        try {
          await api.post('/quiz-results', payload);
          toast('تم حفظ النتيجة في سجلك', 'success');
        } catch (err) {
          if (err instanceof ApiError && err.status === 401) return;
          toast(err.message, 'warn');
        }
      },
    });
  }

  load();
}
