/* أدوات واجهة مشتركة: تهريب النصوص، التنبيهات، النوافذ المنبثقة، التنسيق */

export const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
export const toArabicDigits = (value) =>
  String(value ?? '').replace(/\d/g, (d) => AR_DIGITS[Number(d)]);

export function formatDate(iso, withTime = false) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const options = { day: 'numeric', month: 'long', year: 'numeric' };
  if (withTime) Object.assign(options, { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleDateString('ar-EG', options);
}

export const timeAgo = (iso) => {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return '—';
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'الآن';
  if (mins < 60) return `قبل ${toArabicDigits(mins)} دقيقة`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `قبل ${toArabicDigits(hours)} ساعة`;
  const days = Math.round(hours / 24);
  if (days < 30) return `قبل ${toArabicDigits(days)} يوم`;
  return formatDate(iso);
};

let toastHost = null;
export function toast(message, kind = 'info', timeout = 4200) {
  if (!toastHost) {
    toastHost = document.createElement('div');
    toastHost.className = 'toast-host';
    toastHost.setAttribute('aria-live', 'polite');
    document.body.appendChild(toastHost);
  }
  const node = document.createElement('div');
  node.className = `toast toast--${kind}`;
  node.innerHTML = `<span class="toast__dot"></span><span>${esc(message)}</span>`;
  toastHost.appendChild(node);
  requestAnimationFrame(() => node.classList.add('is-in'));
  const remove = () => {
    node.classList.remove('is-in');
    setTimeout(() => node.remove(), 320);
  };
  node.addEventListener('click', remove);
  setTimeout(remove, timeout);
  return remove;
}

/* نافذة منبثقة عامة تُرجع عنصر التحكم */
export function openModal({ title, subtitle = '', body, actions = [], wide = false, className = '' }) {
  closeModal();
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal ${wide ? 'modal--wide' : ''} ${className}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <header class="modal__head">
        <div>
          <h3>${esc(title)}</h3>
          ${subtitle ? `<p>${esc(subtitle)}</p>` : ''}
        </div>
        <button class="icon-btn" data-modal-close aria-label="إغلاق">✕</button>
      </header>
      <div class="modal__body">${body}</div>
      <footer class="modal__foot"></footer>
    </div>`;
  const footer = backdrop.querySelector('.modal__foot');
  actions.forEach((action) => {
    const btn = document.createElement('button');
    btn.className = `btn ${action.variant || 'btn--ghost'}`;
    btn.textContent = action.label;
    btn.addEventListener('click', async () => {
      if (!action.onClick) return closeModal();
      btn.disabled = true;
      const original = btn.textContent;
      btn.textContent = 'لحظة…';
      try {
        await action.onClick({ close: closeModal, modal: backdrop });
      } finally {
        btn.disabled = false;
        btn.textContent = original;
      }
    });
    footer.appendChild(btn);
  });
  if (!actions.length) footer.remove();
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) closeModal();
  });
  backdrop.querySelector('[data-modal-close]').addEventListener('click', closeModal);
  document.addEventListener('keydown', escHandler);
  document.body.appendChild(backdrop);
  document.body.classList.add('is-modal');
  requestAnimationFrame(() => backdrop.classList.add('is-in'));
  setTimeout(() => backdrop.querySelector('input,textarea,select')?.focus(), 180);
  return backdrop;
}

function escHandler(event) {
  if (event.key === 'Escape') closeModal();
}

export function closeModal() {
  const existing = document.querySelector('.modal-backdrop');
  if (existing) {
    existing.classList.remove('is-in');
    setTimeout(() => existing.remove(), 220);
  }
  document.body.classList.remove('is-modal');
  document.removeEventListener('keydown', escHandler);
}

export const confirmDialog = (options) =>
  new Promise((resolve) => {
    let settled = false;
    const settle = (value) => {
      if (settled) return;
      settled = true;
      closeModal();
      resolve(value);
    };
    openModal({
      title: options.title || 'تأكيد',
      subtitle: options.subtitle || '',
      body: `<p class="confirm-text">${esc(options.message || 'هل أنت متأكد؟')}</p>`,
      actions: [
        { label: options.cancelLabel || 'إلغاء', variant: 'btn--ghost', onClick: () => settle(false) },
        {
          label: options.confirmLabel || 'تأكيد',
          variant: options.danger ? 'btn--danger' : 'btn--primary',
          onClick: () => settle(true),
        },
      ],
    });
  });

export const spinner = (label = 'جارٍ التحميل…') =>
  `<div class="loader"><span class="loader__ring"></span><span>${esc(label)}</span></div>`;

export const emptyState = (icon, title, text) =>
  `<div class="empty"><div class="empty__icon">${icon}</div><h4>${esc(title)}</h4><p>${esc(text)}</p></div>`;

export const badge = (text, tone = 'cyan') => `<span class="badge badge--${tone}">${esc(text)}</span>`;

export const scoreTone = (score, max) => {
  const ratio = max ? score / max : 0;
  if (ratio >= 0.85) return 'green';
  if (ratio >= 0.6) return 'cyan';
  if (ratio >= 0.4) return 'amber';
  return 'red';
};

export const percent = (part, total) => (total ? Math.round((part / total) * 100) : 0);

/** رسم حلقة تقدم SVG */
export const ring = (value, size = 120, stroke = 'var(--cyan)') => {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, value)) / 100) * circumference;
  return `<svg class="ring" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">
      <circle cx="${size / 2}" cy="${size / 2}" r="${radius}" class="ring__track" stroke-width="8" fill="none" />
      <circle cx="${size / 2}" cy="${size / 2}" r="${radius}" stroke="${stroke}" stroke-width="8" fill="none"
        stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
        transform="rotate(-90 ${size / 2} ${size / 2})" class="ring__bar" />
    </svg>`;
};

/** عدّاد متحرك */
export function countUp(node, target, duration = 900) {
  if (!node) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) {
    node.textContent = toArabicDigits(Math.round(target));
    return;
  }
  const start = performance.now();
  const from = 0;
  const tick = (now) => {
    const progress = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    node.textContent = toArabicDigits(Math.round(from + (target - from) * eased));
    if (progress < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export function copyText(text) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(
      () => toast('تم النسخ إلى الحافظة', 'success'),
      () => toast('تعذّر النسخ، انسخ الرمز يدوياً', 'warn'),
    );
  } else {
    toast('النسخ التلقائي غير متاح على هذا المتصفح', 'warn');
  }
}

export const debounce = (fn, wait = 300) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
};
