/* نقطة الدخول: هيكل التطبيق، التوجيه، تهيئة الجلسة، شارة المبرمج وتذييل الكلاس */
import './styles.css';
import { api, auth, setCsrf, ApiError } from './api.js';
import { esc, toast, spinner, openModal, closeModal, badge, toArabicDigits as AR } from './ui.js';
import { startBackground } from './effects.js';
import { renderAuth } from './views/auth.js';
import { renderStudent } from './views/student.js';
import { renderAdmin } from './views/admin.js';
import { ELEMENTS } from './data/elements.js';

const state = {
  profile: null,
  meta: null,
  view: 'auth', // auth | student | admin
  tab: null,
  ready: false,
};

const app = document.getElementById('app');
let currentView = null;

function shell() {
  app.innerHTML = `
    <div class="credit-corner">💻 <b>المبرمج توماس</b></div>
    <canvas id="fx"></canvas>
    <div class="shell">
      <header class="topbar">
        <div class="brand">
          <div class="brand__mark"><span>⚛</span></div>
          <div class="brand__text">
            <strong>مختبر الكيمياء التفاعلي</strong>
            <small>د. محمود النجار</small>
          </div>
        </div>
        <div class="topbar__spacer"></div>
        <div class="topbar__actions" id="top-actions"></div>
      </header>
      <main id="view"></main>
      <footer class="site-foot">
        <div class="site-foot__class">
          <small>CLASS</small>
          <strong>your class</strong>
        </div>
        <div class="site-foot__links">
          <span>⚛ ${AR(ELEMENTS.length)} عنصراً تفاعلياً</span>
          <span>🧪 مختبر افتراضي</span>
          <span>🎯 اختبارات فورية</span>
          <span>📷 حضور بكود QR</span>
        </div>
        <div class="site-foot__author">منصة تعليمية بإشراف <b>د. محمود النجار</b> — تصميم وتطوير <b>المبرمج توماس</b></div>
      </footer>
    </div>`;
  startBackground(app.querySelector('#fx'));
  return {
    view: app.querySelector('#view'),
    actions: app.querySelector('#top-actions'),
  };
}

function paintTopActions(host) {
  const me = state.profile;
  if (!me) {
    host.innerHTML = `<span class="chip chip--live chip--hide-sm"><i></i> المنصة متاحة</span>`;
    return;
  }
  const isAdmin = me.role === 'admin';
  host.innerHTML = `
    <span class="chip chip--hide-sm">${isAdmin ? '🛡️' : '👨‍🎓'} <b>${esc(me.name)}</b></span>
    ${isAdmin ? '' : `<span class="chip chip--hide-sm">🏅 <b>${AR(me.points || 0)}</b> نقطة</span>`}
    <button class="btn btn--ghost btn--xs" id="btn-account">حسابي</button>
    <button class="btn btn--ghost btn--xs" id="btn-logout">خروج</button>`;

  host.querySelector('#btn-logout').addEventListener('click', async () => {
    try {
      await auth.logout();
    } catch {
      /* الجلسة قد تكون منتهية أصلاً */
    }
    state.profile = null;
    setCsrf(null);
    state.view = 'auth';
    state.tab = null;
    paintAuth();
  });

  host.querySelector('#btn-account').addEventListener('click', () => accountModal(me));
}

function accountModal(me) {
  const isAdmin = me.role === 'admin';
  openModal({
    title: 'حسابي',
    body: `
      <div class="meta-row"><span>الاسم</span><span>${esc(me.name)}</span></div>
      ${isAdmin ? `<div class="meta-row"><span>اسم المستخدم</span><span>@${esc(me.username || '')}</span></div>` : ''}
      ${isAdmin ? `<div class="meta-row"><span>الصلاحية</span><span>${esc(me.title || 'مشرف')}</span></div>` : ''}
      ${isAdmin ? '' : `<div class="meta-row"><span>الكود</span><span><code>${esc(me.code || '')}</code></span></div>`}
      ${isAdmin ? '' : `<div class="meta-row"><span>المجموعة</span><span>${esc(me.group || '—')}</span></div>`}
      <hr style="border-color:var(--line);margin:14px 0" />
      <h4 style="margin-bottom:8px">تغيير كلمة السر</h4>
      <div class="field"><label>كلمة السر الحالية</label><input type="password" id="pw-cur" maxlength="64" /></div>
      <div class="field"><label>كلمة السر الجديدة</label><input type="password" id="pw-new" maxlength="64" /></div>
      <div class="form-error" id="pw-err" hidden></div>`,
    actions: [
      { label: 'إغلاق', kind: 'ghost' },
      {
        label: 'تحديث كلمة السر',
        kind: 'primary',
        onClick: async () => {
          const cur = document.getElementById('pw-cur').value;
          const next = document.getElementById('pw-new').value;
          const err = document.getElementById('pw-err');
          try {
            await auth.changePassword(cur, next);
            closeModal();
            toast('تم تحديث كلمة السر', 'success');
          } catch (e) {
            err.hidden = false;
            err.textContent = e.message;
          }
        },
      },
    ],
  });
}

function paintAuth() {
  const parts = shell();
  paintTopActions(parts.actions);
  state.view = 'auth';
  const meta = state.meta || {};
  renderAuth(parts.view, {
    meta,
    onLogin: async (data) => {
      setCsrf(data.csrf);
      state.profile = data.user;
      if (data.user.role === 'admin') {
        state.view = 'admin';
        state.tab = 'overview';
        paintAdmin();
      } else {
        state.view = 'student';
        state.tab = 'home';
        paintStudent();
      }
    },
  });
}

function mount(role) {
  const parts = shell();
  paintTopActions(parts.actions);
  return parts;
}

function paintStudent() {
  const parts = mount();
  const instance = renderStudent(parts.view, {
    state,
    navigate: (view, opts = {}) => {
      if (opts.tab) state.tab = opts.tab;
      if (view === 'admin' && state.profile?.role === 'admin') paintAdmin();
      else paintStudent();
    },
  });
  currentView = instance;
}

function paintAdmin() {
  if (state.profile?.role !== 'admin') return paintStudent();
  const parts = mount();
  const instance = renderAdmin(parts.view, {
    state,
    navigate: (view, opts = {}) => {
      if (opts.tab) state.tab = opts.tab;
      if (view === 'student') paintStudent();
      else paintAdmin();
    },
  });
  currentView = instance;
}

async function boot() {
  app.innerHTML = `<div style="min-height:100vh;display:grid;place-items:center">${spinner('جارٍ تحميل المنصة…')}</div>`;
  try {
    state.meta = await api.get('/meta');
  } catch {
    state.meta = { groups: [], allowRegistration: true, stats: {} };
  }

  try {
    const session = await auth.me();
    setCsrf(session.csrf);
    state.profile = session.user;
    if (session.user.role === 'admin') {
      state.view = 'admin';
      state.tab = 'overview';
      paintAdmin();
    } else {
      state.view = 'student';
      state.tab = 'home';
      paintStudent();
    }
    return;
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401) {
      toast('تعذّر الاتصال بالخادم، جرّب إعادة تحميل الصفحة', 'error');
    }
  }

  if (state.meta?.locked) {
    paintAuth();
    toast(state.meta.lockMessage || 'المنصة مغلقة مؤقتاً', 'warn', 6500);
    return;
  }
  paintAuth();
}

/* فحص سريع لتهيئة الـ CSRF بعد أي عملية على المتصفح تعيد التحميل */
window.addEventListener('appjet:reauth', async () => {
  try {
    const session = await auth.me();
    setCsrf(session.csrf);
    state.profile = session.user;
  } catch {
    state.profile = null;
  }
});

boot();
