/* مختبرات الكيمياء التفاعلية: الجدول الدوري، الدروس، التفاعلات، التجارب، الاختبارات */
import { ELEMENTS, CATEGORIES, elementFact } from '../data/elements.js';
import { UNITS, LESSONS, REACTIONS, EXPERIMENTS, QUIZZES } from '../data/content.js';
import { esc, toast, openModal, badge, ring, toArabicDigits as AR } from '../ui.js';
import { celebrate } from '../effects.js';

/* =========================== الجدول الدوري =========================== */
export function periodicTable(root, { onCard } = {}) {
  let filter = null;
  let query = '';

  root.innerHTML = `
    <div class="section-head">
      <div>
        <h2>الجدول الدوري التفاعلي</h2>
        <p>١١٨ عنصراً — اضغط على أي عنصر لرؤية توزيعه الإلكتروني وخصائصه.</p>
      </div>
      <div class="field" style="max-width:260px;margin:0">
        <input id="el-search" placeholder="ابحث بالاسم أو الرمز أو العدد الذري…" />
      </div>
    </div>
    <div id="pt-legend" class="legend"></div>
    <div class="card card--pad" style="margin-top:12px">
      <div class="pt-wrap"><div class="periodic" id="pt-grid"></div>div>
    </div>`;

  // إصلاح سريع لعلامة الإغلاق (يضمن صحّة البنية)
  root.querySelector('.pt-wrap').innerHTML = '<div class="periodic" id="pt-grid"></div>';

  const grid = root.querySelector('#pt-grid');
  const legend = root.querySelector('#pt-legend');

  Object.entries(CATEGORIES).forEach(([key, cat]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.style.setProperty('--lc', cat.color);
    btn.innerHTML = `<i></i>${esc(cat.name)}`;
    btn.addEventListener('click', () => {
      filter = filter === key ? null : key;
      legend.querySelectorAll('button').forEach((b) => b.classList.remove('is-active'));
      if (filter) btn.classList.add('is-active');
      paint();
    });
    legend.appendChild(btn);
  });

  function paint() {
    const term = query.trim().toLowerCase();
    const cells = [];
    ELEMENTS.forEach((el) => {
      const matches =
        (!filter || el.cat === filter) &&
        (!term ||
          el.symbol.toLowerCase().includes(term) ||
          el.ar.includes(term) ||
          el.en.toLowerCase().includes(term) ||
          String(el.z) === term);
      const position = `grid-row:${el.row};grid-column:${el.col}`;
      if (!matches) {
        cells.push(`<div class="el el--gap" style="${position}"></div>`);
        return;
      }
      cells.push(`
        <button type="button" class="el" data-z="${el.z}" style="${position};--el-color:${el.color}"
          title="${esc(el.ar)} — ${esc(el.catName)}" aria-label="${esc(el.ar)}">
          <span class="el__z">${el.z}</span>
          <span class="el__sym">${esc(el.symbol)}</span>
          <span class="el__name">${esc(el.ar)}</span>
        </button>`);
    });
    grid.innerHTML = cells.join('');
    grid.querySelectorAll('[data-z]').forEach((node) => {
      node.addEventListener('click', () => showElement(Number(node.dataset.z), onCard));
    });
  }

  root.querySelector('#el-search').addEventListener('input', (event) => {
    query = event.target.value;
    paint();
  });
  paint();
}

export function showElement(z, onCard) {
  const el = ELEMENTS.find((e) => e.z === z);
  if (!el) return;
  openModal({
    title: `${el.ar} (${el.symbol})`,
    subtitle: `${el.catName} • العدد الذري ${AR(el.z)}`,
    wide: true,
    body: `
      <div class="element-detail">
        <div class="element-badge" style="--el-color:${el.color}">
          <div>
            <div style="font-size:11px;opacity:.7">${el.z}</div>
            <strong style="font-size:30px;font-family:var(--mono)">${esc(el.symbol)}</strong>
            <div style="font-size:11px;opacity:.8">${esc(el.ar)}</div>
          </div>
        </div>
        <div>
          <div class="meta-row"><span>الاسم بالإنجليزية</span><span>${esc(el.en)}</span></div>
          <div class="meta-row"><span>الكتلة الذرية</span><span>${AR(el.mass)} u</span></div>
          <div class="meta-row"><span>العدد الذري</span><span>${AR(el.z)}</span></div>
          <div class="meta-row"><span>عدد النيوترونات (تقريبي)</span><span>${AR(el.neutrons)}</span></div>
          <div class="meta-row"><span>الحالة في الغرفة</span><span>${esc(el.phase)}</span></div>
          <div class="meta-row"><span>الدورة / المجموعة</span><span>${AR(el.row > 7 ? (el.row === 9 ? 6 : 7) : el.row)} / ${AR(el.col)}</span></div>
          <div class="meta-row"><span>التوزيع الإلكتروني</span><span style="font-family:var(--mono);font-size:11.5px">${esc(el.config)}</span></div>
          <div class="form-note" style="margin-top:12px">${esc(elementFact(el))}</div>
        </div>
      </div>`,
    actions: onCard
      ? [{ label: 'أضف لكراسة العناصر', variant: 'btn--lime', onClick: () => onCard(el) }, { label: 'إغلاق' }]
      : [{ label: 'إغلاق' }],
  });
}

/* ================================ الدروس ================================ */
export function lessonsView(root) {
  const unitOf = (id) => UNITS.find((u) => u.id === id);
  let openId = LESSONS[0]?.id;

  root.innerHTML = `
    <div class="section-head">
      <div>
        <h2>الدروس المشروحة</h2>
        <p>شرح مركز لكل وحدة — مقروء على الموبايل ومتوافق مع المنهج.</p>
      </div>
    </div>
    <div class="tabs" id="ls-tabs"></div>
    <div id="ls-body" style="margin-top:14px"></div>`;

  const tabs = root.querySelector('#ls-tabs');
  UNITS.forEach((unit) => {
    const count = LESSONS.filter((l) => l.unit === unit.id).length;
    const btn = document.createElement('button');
    btn.className = 'tab';
    btn.innerHTML = `${unit.icon} ${esc(unit.name)} <span class="tab__count">${AR(count)}</span>`;
    btn.addEventListener('click', () => {
      openId = LESSONS.find((l) => l.unit === unit.id)?.id || openId;
      paintTabs();
      paintBody();
    });
    btn.dataset.unit = unit.id;
    tabs.appendChild(btn);
  });

  function paintTabs() {
    const activeUnit = LESSONS.find((l) => l.id === openId)?.unit;
    tabs.querySelectorAll('.tab').forEach((t) => t.classList.toggle('is-active', t.dataset.unit === activeUnit));
  }

  function paintBody() {
    const lesson = LESSONS.find((l) => l.id === openId) || LESSONS[0];
    if (!lesson) {
      root.querySelector('#ls-body').innerHTML = '<div class="empty">لا توجد دروس</div>';
      return;
    }
    const unit = unitOf(lesson.unit);
    root.querySelector('#ls-body').innerHTML = `
      <div class="card card--pad">
        <div class="section-head" style="margin-bottom:10px">
          <div>
            <h2 style="font-size:18px">${esc(lesson.title)}</h2>
            <p>${esc(lesson.summary)}</p>
          </div>
          ${badge(`${AR(lesson.minutes)} دقيقة`, 'cyan')} ${badge(lesson.level, 'violet')}
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
          ${LESSONS.filter((l) => l.unit === lesson.unit)
            .map(
              (l) =>
                `<button class="chip ${l.id === lesson.id ? 'chip--live' : ''}" data-lesson="${l.id}"><b>${esc(l.title)}</b></button>`,
            )
            .join('')}
        </div>
        <div class="grid" style="gap:14px">
          ${lesson.sections
            .map(
              (s) => `
            <div class="card" style="padding:14px">
              <h4 style="color:var(--cyan);margin-bottom:6px">${esc(s.h)}</h4>
              <p style="font-size:13.5px;line-height:1.95;color:var(--txt-dim)">${esc(s.p)}</p>
              ${s.list ? `<ul style="margin:10px 0 0;padding-inline-start:18px;font-size:13px;color:var(--txt-dim);display:grid;gap:6px">${s.list.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}
            </div>`,
            )
            .join('')}
        </div>
        ${lesson.facts?.length
          ? `<div class="bubble" style="margin-top:12px"><strong>حقائق سريعة:</strong> ${lesson.facts.map((f) => esc(f)).join(' • ')}</div>`
          : ''}
        <div class="form-note" style="margin-top:12px">الوحدة: ${esc(unit?.name || '—')}</div>
      </div>`;
    root.querySelectorAll('[data-lesson]').forEach((b) =>
      b.addEventListener('click', () => {
        openId = b.dataset.lesson;
        paintTabs();
        paintBody();
      }),
    );
  }

  paintTabs();
  paintBody();
}

/* ============================== التفاعلات ============================== */
export function reactionsView(root, { onQuiz } = {}) {
  let activeType = null;
  const types = [...new Set(REACTIONS.map((r) => r.type))];

  root.innerHTML = `
    <div class="section-head">
      <div>
        <h2>مختبر التفاعلات</h2>
        <p>اضغط على التفاعل لمشاهدة المعادلة الموزونة، الملاحظات، وتحذيرات الأمان.</p>
      </div>
    </div>
    <div class="tabs" id="rx-tabs"></div>
    <div class="reaction-grid" id="rx-grid" style="margin-top:14px"></div>
    <div class="card card--pad" id="rx-lab" style="margin-top:16px"></div>`;

  const tabs = root.querySelector('#rx-tabs');
  const grid = root.querySelector('#rx-grid');
  const lab = root.querySelector('#rx-lab');

  types.forEach((type) => {
    const btn = document.createElement('button');
    btn.className = 'tab';
    btn.textContent = type;
    btn.dataset.type = type;
    btn.addEventListener('click', () => {
      activeType = activeType === type ? null : type;
      paint();
    });
    tabs.appendChild(btn);
  });

  function paint() {
    tabs.querySelectorAll('.tab').forEach((t) => t.classList.toggle('is-active', t.dataset.type === activeType));
    grid.innerHTML = REACTIONS.filter((r) => !activeType || r.type === activeType)
      .map(
        (r) => `
      <button class="reaction" data-rx="${r.id}" style="--rx-color:${r.color}">
        <div class="reaction__top">
          <span class="reaction__name">${esc(r.name)}</span>
          <span class="reaction__type">${esc(r.type)}</span>
        </div>
        <div class="reaction__eq">${esc(r.eq)}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
          ${badge(r.heat, r.heat.includes('طارد') ? 'amber' : 'cyan')}
        </div>
      </button>`,
      )
      .join('');
    grid.querySelectorAll('[data-rx]').forEach((node) => {
      node.addEventListener('click', () => select(node.dataset.rx));
    });
  }

  function select(id) {
    const r = REACTIONS.find((x) => x.id === id);
    if (!r) return;
    grid.querySelectorAll('.reaction').forEach((n) => n.classList.toggle('is-active', n.dataset.rx === id));
    lab.innerHTML = `
      <div class="section-head" style="margin-bottom:10px">
        <div>
          <h2 style="font-size:17px">${esc(r.name)}</h2>
          <p>${esc(r.type)}</p>
        </div>
        ${badge(r.heat, r.heat.includes('جداً') ? 'red' : 'amber')}
      </div>
      <div class="reaction__eq" style="font-size:clamp(15px,3.4vw,22px);padding:14px;border-radius:14px;background:rgba(34,227,255,.06);border:1px solid rgba(34,227,255,.2);text-align:center">${esc(r.eq)}</div>
      <div class="grid grid--2" style="margin-top:14px">
        <div class="card" style="padding:12px"><h4 style="font-size:13px;color:var(--cyan)">ما الذي تراه؟</h4><p style="font-size:13px;color:var(--txt-dim);line-height:1.9">${esc(r.observation)}</p></div>
        <div class="card" style="padding:12px"><h4 style="font-size:13px;color:var(--red)">تحذير الأمان</h4><p style="font-size:13px;color:var(--txt-dim);line-height:1.9">${esc(r.safety)}</p></div>
      </div>
      <div class="bubble" style="margin-top:12px"><strong>الموازنة:</strong> ${esc(r.balance)}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">
        <button class="btn btn--lime btn--sm" id="rx-celebrate">شغّل التفاعل ⚡</button>
        <button class="btn btn--ghost btn--sm" id="rx-quiz">اختبر فهمك</button>
      </div>`;
    lab.querySelector('#rx-celebrate').addEventListener('click', (event) => {
      const rect = event.target.getBoundingClientRect();
      celebrate(rect.left + rect.width / 2, rect.top, 60);
      toast('تم تشغيل المحاكاة البصرية', 'success');
    });
    lab.querySelector('#rx-quiz').addEventListener('click', () => onQuiz?.());
  }

  paint();
  select(REACTIONS[0]?.id);
}

/* =============================== التجارب =============================== */
export function experimentsView(root) {
  root.innerHTML = `
    <div class="section-head">
      <div>
        <h2>التجارب العملية</h2>
        <p>الخطوات والأدوات والنتيجة المتوقعة — آمنة للتجريب الذهني قبل المعمل.</p>
      </div>
    </div>
    <div class="grid grid--2" id="ex-grid"></div>`;

  root.querySelector('#ex-grid').innerHTML = EXPERIMENTS.map(
    (e) => `
    <div class="card card--pad">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <div class="flask"><div class="flask__neck"></div><div class="flask__liquid"></div></div>
        <h4 style="font-size:15px">${esc(e.title)}</h4>
      </div>
      <p style="font-size:13px;color:var(--txt-dim);line-height:1.9">${esc(e.goal)}</p>
      <div class="meta-row" style="margin-top:10px"><span>الأدوات</span><span>${e.tools.map((t) => esc(t)).join(' • ')}</span></div>
      <ol style="margin:10px 0 0;padding-inline-start:18px;font-size:12.5px;color:var(--txt-dim);display:grid;gap:6px">
        ${e.steps.map((s) => `<li>${esc(s)}</li>`).join('')}
      </ol>
      <div class="bubble" style="margin-top:10px"><strong>النتيجة:</strong> ${esc(e.result)}</div>
    </div>`,
  ).join('');
}

/* =============================== الاختبارات =============================== */
export function quizzesView(root, { onSubmit } = {}) {
  let activeQuiz = QUIZZES[0];
  let answers = {};
  let locked = false;

  root.innerHTML = `
    <div class="section-head">
      <div>
        <h2>الاختبارات السريعة</h2>
        <p>اختر إجابة لكل سؤال — النتيجة تُحفظ في سجلك وتضيف نقاطاً.</p>
      </div>
    </div>
    <div class="tabs" id="qz-tabs"></div>
    <div id="qz-body" style="margin-top:14px"></div>`;

  const tabs = root.querySelector('#qz-tabs');
  QUIZZES.forEach((q) => {
    const btn = document.createElement('button');
    btn.className = 'tab';
    btn.innerHTML = `${esc(q.title)} <span class="tab__count">${AR(q.questions.length)}</span>`;
    btn.dataset.quiz = q.id;
    btn.addEventListener('click', () => {
      activeQuiz = QUIZZES.find((x) => x.id === q.id);
      answers = {};
      locked = false;
      paint();
    });
    tabs.appendChild(btn);
  });

  function paint() {
    tabs.querySelectorAll('.tab').forEach((t) => t.classList.toggle('is-active', t.dataset.quiz === activeQuiz.id));
    const body = root.querySelector('#qz-body');
    body.innerHTML = `
      <div class="card card--pad">
        <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:12px">
          <div>
            <h4>${esc(activeQuiz.title)}</h4>
            <p style="font-size:12px;color:var(--txt-mute)">${AR(activeQuiz.questions.length)} سؤال • الوحدة: ${esc(UNITS.find((u) => u.id === activeQuiz.unit)?.name || '—')}</p>
          </div>
          <div id="qz-score"></div>
        </div>
        <div id="qz-questions" class="grid" style="gap:12px">
          ${activeQuiz.questions
            .map(
              (q, qi) => `
            <div class="quiz" data-q="${qi}">
              <p style="font-weight:700;font-size:13.5px;margin-bottom:8px">${AR(qi + 1)}. ${esc(q.q)}</p>
              <div class="grid" style="gap:6px">
                ${q.options
                  .map(
                    (opt, oi) =>
                      `<button type="button" class="option" data-q="${qi}" data-o="${oi}"><span class="option__mark">${'أبجد'[oi] || oi + 1}</span>${esc(opt)}</button>`,
                  )
                  .join('')}
              </div>
              <div class="explain" data-explain="${qi}" hidden></div>
            </div>`,
            )
            .join('')}
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">
          <button class="btn btn--primary" id="qz-submit">تصحيح الاختبار</button>
          <button class="btn btn--ghost" id="qz-reset">إعادة</button>
        </div>
      </div>`;

    body.querySelectorAll('.option').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (locked) return;
        const qi = btn.dataset.q;
        answers[qi] = Number(btn.dataset.o);
        body.querySelectorAll(`.option[data-q="${qi}"]`).forEach((o) => o.classList.toggle('is-picked', o === btn));
      });
    });

    body.querySelector('#qz-reset').addEventListener('click', () => {
      answers = {};
      locked = false;
      paint();
    });

    body.querySelector('#qz-submit').addEventListener('click', () => {
      if (locked) return;
      const total = activeQuiz.questions.length;
      if (Object.keys(answers).length < total) {
        toast('أجب عن كل الأسئلة أولاً', 'warn');
        return;
      }
      locked = true;
      let score = 0;
      activeQuiz.questions.forEach((q, qi) => {
        const picked = answers[qi];
        const correct = picked === q.answer;
        if (correct) score += 1;
        body.querySelectorAll(`.option[data-q="${qi}"]`).forEach((opt) => {
          const oi = Number(opt.dataset.o);
          opt.classList.remove('is-picked');
          if (oi === q.answer) opt.classList.add('is-correct');
          else if (oi === picked) opt.classList.add('is-wrong');
        });
        const explain = body.querySelector(`[data-explain="${qi}"]`);
        explain.hidden = false;
        explain.textContent = `${correct ? '✅ صحيح' : '❌ غير صحيح'} — ${q.explain}`;
      });
      const pct = Math.round((score / total) * 100);
      body.querySelector('#qz-score').innerHTML = `${ring(pct, 96, pct >= 60 ? 'var(--lime)' : 'var(--red)')}<div class="ring-wrap__value">${AR(pct)}٪</div>`;
      if (pct >= 80) celebrate(window.innerWidth / 2, window.innerHeight * 0.4, 70);
      toast(`نتيجتك: ${AR(score)} من ${AR(total)}`, pct >= 50 ? 'success' : 'warn');
      onSubmit?.({ quizId: activeQuiz.id, quizTitle: activeQuiz.title, score, total });
    });
  }

  paint();
}

/* ======================== بنك أسئلة الأدمن (يقابل الخادم) ======================== */
export function bankList(items, onDelete) {
  if (!items.length) return '<div class="empty"><div class="empty__icon">🗂️</div><h4>بنك الأسئلة فارغ</h4><p>أضف أسئلة ليستخدمها الطلاب في التدريب.</p></div>';
  return `<div class="grid" style="gap:10px">${items
    .map(
      (q) => `
    <div class="row-item">
      <div class="row-item__main">
        <div class="row-item__title">${esc(q.q)}</div>
        <div class="row-item__sub">${(q.options || []).map((o, i) => `${'أبجد'[i] || i + 1}) ${esc(o)}`).join(' • ')}</div>
        ${q.explain ? `<div class="row-item__sub" style="color:var(--lime)">${esc(q.explain)}</div>` : ''}
      </div>
      <div class="row-item__side">
        <button class="btn btn--sm btn--danger" data-del-q="${esc(q.id)}">حذف</button>
      </div>
    </div>`,
    )
    .join('')}</div>`;
}
