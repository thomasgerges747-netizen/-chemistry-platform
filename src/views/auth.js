/* شاشة الدخول والتسجيل + كشف كود الطالب و QR */
import { auth, api } from '../api.js';
import { esc, toast, spinner, copyText } from '../ui.js';
import { drawQR, downloadCard } from '../qr.js';
import { celebrate } from '../effects.js';

const AR = (v) => String(v ?? '').replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);

export function renderAuth(root, { meta, onLogin }) {
  let mode = 'login';
  let role = 'student';
  let registered = null;

  root.innerHTML = `
    <div class="auth-wrap">
      <aside class="auth-aside">
        <h2>مختبر <span class="grad">الكيمياء</span> التفاعلي</h2>
        <p>منصة د. محمود النجار — ١١٨ عنصراً تفاعلياً، مختبر افتراضي، واجبات تُصحَّح، وحضور بكود QR من كاميرا التليفون.</p>

        <div class="atom-stage">
          <div class="atom">
            <div class="atom__core">⚛️</div>
            <div class="atom__ring"><span class="atom__electron"></span></div>
            <div class="atom__ring"><span class="atom__electron"></span></div>
            <div class="atom__ring"><span class="atom__electron"></span></div>
          </div>
        </div>

        <ul class="feature-list">
          <li>جدول دوري كامل بتوزيع إلكتروني وخصائص لكل عنصر.</li>
          <li>مختبر معادلات: شاهد التفاعل، الاعتلال، وملاحظات الأمان.</li>
          <li>اختبارات فورية بدرجات تُحفظ في سجلك.</li>
          <li>بطاقة طالب رقمية بكود QR لتسجيل الحضور.</li>
        </ul>

        <div class="floating-formulas">
          <span>2H₂ + O₂ → 2H₂O</span>
          <span>ΔG = ΔH − TΔS</span>
          <span>Kc = [C]ᶜ[D]ᵈ/[A]ᵃ[B]ᵇ</span>
          <span>pH = −log[H⁺]</span>
        </div>
      </aside>

      <section class="auth-card card card--pad">
        <div class="auth-tabs" role="tablist">
          <button type="button" data-mode="login" class="is-active">دخول</button>
          <button type="button" data-mode="register">تسجيل جديد</button>
        </div>
        <div id="auth-body"></div>
      </section>
    </div>`;

  const body = root.querySelector('#auth-body');
  const tabs = root.querySelectorAll('.auth-tabs button');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      if (mode === tab.dataset.mode) return;
      mode = tab.dataset.mode;
      registered = null;
      tabs.forEach((t) => t.classList.toggle('is-active', t === tab));
      paint();
    });
  });

  function paint() {
    if (registered) return paintCode();
    if (mode === 'login') return paintLogin();
    return paintRegister();
  }

  /* ---------------------------- الدخول ---------------------------- */
  function paintLogin() {
    body.innerHTML = `
      <form id="login-form" autocomplete="on">
        <div class="auth-tabs" style="margin-bottom:16px">
          <button type="button" data-role="student" class="${role === 'student' ? 'is-active' : ''}">طالب</button>
          <button type="button" data-role="admin" class="${role === 'admin' ? 'is-active' : ''}">مشرف</button>
        </div>

        <div class="field">
          <label for="lg-id">${role === 'admin' ? 'اسم المستخدم' : 'كود الطالب'}</label>
          <input id="lg-id" name="identifier" required autocomplete="username"
            placeholder="${role === 'admin' ? 'admin' : 'مثال: CH-3A-1042'}"
            style="${role === 'admin' ? '' : 'letter-spacing:1.6px;text-transform:uppercase'}" />
          <small>${role === 'admin' ? 'اسم المستخدم الذي أنشأه المشرف العام' : 'الكود الذي حصلت عليه عند التسجيل'}</small>
        </div>

        <div class="field">
          <label for="lg-pass">كلمة السر</label>
          <input id="lg-pass" name="password" type="password" required autocomplete="current-password" placeholder="••••••••" />
        </div>

        <div id="lg-error" class="form-error" hidden></div>

        <button class="btn btn--primary btn--block" type="submit">دخول المنصة</button>

        <p class="form-note">${role === 'admin'
          ? 'الدخول للمشرفين فقط. الحساب المزروع: <b>admin</b> — غيّر كلمة السر بعد أول دخول.'
          : 'نسيت كودك؟ تواصل مع المشرف عبر واتساب المجموعة.'}</p>
      </form>`;

    body.querySelectorAll('[data-role]').forEach((btn) => {
      btn.addEventListener('click', () => {
        role = btn.dataset.role;
        paintLogin();
      });
    });

    const form = body.querySelector('#login-form');
    const error = body.querySelector('#lg-error');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      error.hidden = true;
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      button.textContent = 'جارٍ التحقق…';
      try {
        const data = await auth.login(form.identifier.value.trim(), form.password.value, role);
        celebrate(window.innerWidth / 2, window.innerHeight * 0.32, 40);
        toast(`أهلاً ${data.user.name}`, 'success');
        onLogin(data);
      } catch (err) {
        error.hidden = false;
        error.textContent = err.message;
        button.disabled = false;
        button.textContent = 'دخول المنصة';
        form.password.select();
      }
    });
  }

  /* --------------------------- التسجيل --------------------------- */
  function paintRegister() {
    if (meta && meta.allowRegistration === false) {
      body.innerHTML = `<div class="empty"><div class="empty__icon">🔒</div><h4>التسجيل مغلق حالياً</h4><p>تواصل مع المشرف لفتح باب التسجيل أو لإنشاء حسابك.</p></div>`;
      return;
    }
    const groups = meta?.groups || [];
    body.innerHTML = `
      <form id="rg-form" autocomplete="on">
        <div class="field">
          <label for="rg-name">الاسم بالكامل</label>
          <input id="rg-name" name="name" required placeholder="مثال: أحمد محمد علي" />
        </div>
        <div class="field-row">
          <div class="field">
            <label for="rg-phone">موبايل الطالب</label>
            <input id="rg-phone" name="phone" required inputmode="numeric" placeholder="01xxxxxxxxx" maxlength="11" />
          </div>
          <div class="field">
            <label for="rg-parent">موبايل ولي الأمر</label>
            <input id="rg-parent" name="parentPhone" inputmode="numeric" placeholder="01xxxxxxxxx" maxlength="11" />
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label for="rg-school">المدرسة</label>
            <input id="rg-school" name="school" placeholder="اسم المدرسة" />
          </div>
          <div class="field">
            <label for="rg-gov">المحافظة</label>
            <input id="rg-gov" name="governorate" placeholder="مثال: القاهرة" />
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label for="rg-grade">الصف</label>
            <select id="rg-grade" name="grade">
              <option>الثالث الثانوي</option>
              <option>الثاني الثانوي</option>
              <option>الأول الثانوي</option>
            </select>
          </div>
          <div class="field">
            <label for="rg-group">المجموعة</label>
            <select id="rg-group" name="group" required>
              ${groups.map((g) => `<option value="${esc(g.name)}">${esc(g.name)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="field">
          <label for="rg-pass">كلمة السر</label>
          <input id="rg-pass" name="password" type="password" required autocomplete="new-password" placeholder="٨ أحرف على الأقل، حرف كبير ورقم ورمز" />
          <small>لن تُعرض كلمة السر بعد الحفظ — احتفظ بها في مكان آمن.</small>
        </div>

        <div id="rg-error" class="form-error" hidden></div>

        <button class="btn btn--primary btn--block" type="submit">إنشاء الحساب واستلام الكود</button>
        <p class="form-note">بالتسجيل أنت توافق على استخدام كودك الشخصي في الحضور والواجبات، ولا يجوز مشاركته مع غيرك.</p>
      </form>`;

    const form = body.querySelector('#rg-form');
    const error = body.querySelector('#rg-error');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      error.hidden = true;
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      button.textContent = 'جارٍ التسجيل…';
      try {
        const data = await auth.register({
          name: form.name.value.trim(),
          phone: form.phone.value.trim(),
          parentPhone: form.parentPhone.value.trim(),
          school: form.school.value.trim(),
          governorate: form.governorate.value.trim(),
          grade: form.grade.value,
          group: form.group.value,
          password: form.password.value,
        });
        registered = data.student;
        celebrate(window.innerWidth / 2, window.innerHeight * 0.3, 70);
        paintCode();
      } catch (err) {
        error.hidden = false;
        error.textContent = err.message;
        button.disabled = false;
        button.textContent = 'إنشاء الحساب واستلام الكود';
      }
    });
  }

  /* ------------------------ كشف الكود و QR ------------------------ */
  function paintCode() {
    const profile = registered;
    body.innerHTML = `
      <div class="form-success">
        <strong>تم إنشاء حسابك بنجاح 🎉</strong>
        <span>احتفظ بهذا الكود — هو مفتاح دخولك وحضورك.</span>
      </div>

      <div class="code-reveal">
        <small>كود الطالب</small>
        <strong id="code-value">${esc(profile.code)}</strong>
      </div>

      <div class="qr-box" style="margin:14px auto">
        <canvas id="qr-canvas" width="200" height="200"></canvas>
      </div>

      <div class="meta-row"><span>الاسم</span><span>${esc(profile.name)}</span></div>
      <div class="meta-row"><span>المجموعة</span><span>${esc(profile.group)}</span></div>
      <div class="meta-row"><span>المدرسة</span><span>${esc(profile.school || '—')}</span></div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">
        <button class="btn btn--ghost" id="copy-code">نسخ الكود</button>
        <button class="btn btn--ghost" id="dl-card">تحميل البطاقة</button>
        <button class="btn btn--primary" id="go-login">الدخول الآن</button>
      </div>`;

    const canvas = body.querySelector('#qr-canvas');
    drawQR(canvas, profile.code, 200).catch(() => toast('تعذّر رسم رمز QR', 'warn'));

    body.querySelector('#copy-code').addEventListener('click', () => copyText(profile.code));
    body.querySelector('#dl-card').addEventListener('click', () => downloadCard(profile).catch(() => toast('تعذّر تحميل البطاقة', 'error')));
    body.querySelector('#go-login').addEventListener('click', () => {
      registered = null;
      mode = 'login';
      role = 'student';
      tabs.forEach((t) => t.classList.toggle('is-active', t.dataset.mode === 'login'));
      paintLogin();
      body.querySelector('#lg-id').value = '';
    });
  }

  paint();
}

/** بطاقة الطالب الكاملة داخل لوحة التحكم */
export async function studentCard(profile) {
  const dataUrl = await import('../qr.js').then((m) => m.qrDataUrl(profile.code, 320));
  return `
    <div class="id-card">
      <div class="id-card__head">
        <div>
          <div class="id-card__name">${esc(profile.name)}</div>
          <div class="id-card__code">${esc(profile.code)}</div>
        </div>
        ${profile.active ? '<span class="badge badge--green">نشط</span>' : '<span class="badge badge--red">موقوف</span>'}
      </div>
      <div class="id-card__body">
        <div class="qr-box"><img src="${dataUrl}" alt="QR ${esc(profile.code)}" /></div>
        <div class="id-card__meta">
          <div class="meta-row"><span>المجموعة</span><span>${esc(profile.group || '—')}</span></div>
          <div class="meta-row"><span>الصف</span><span>${esc(profile.grade || '—')}</span></div>
          <div class="meta-row"><span>المدرسة</span><span>${esc(profile.school || '—')}</span></div>
          <div class="meta-row"><span>المحافظة</span><span>${esc(profile.governorate || '—')}</span></div>
          <div class="meta-row"><span>الموبايل</span><span>${AR(profile.phone || '—')}</span></div>
          <div class="meta-row"><span>ولي الأمر</span><span>${AR(profile.parentPhone || '—')}</span></div>
          <div class="meta-row"><span>النقاط</span><span>${AR(profile.points || 0)}</span></div>
        </div>
      </div>
      <div class="id-card__foot">
        <button class="btn btn--sm btn--ghost" data-card-copy="${esc(profile.code)}">نسخ الكود</button>
        <button class="btn btn--sm btn--lime" data-card-download>تحميل البطاقة PDF/PNG</button>
      </div>
    </div>`;
}

export { spinner, api };
