/* توليد رموز QR في المتصفح بدون اتصال بالخادم */
import QRCode from 'qrcode';

/** المحتوى الذي يُخزَّن داخل كود الحضور — البادئة تساعد الماسح في التمييز */
export const attendancePayload = (code) => `CHEM-ATT:${String(code || '').toUpperCase()}`;

/** استخراج كود الطالب من نص قرأه الماسح */
export function parseScan(raw) {
  const text = String(raw || '').trim().toUpperCase();
  if (!text) return '';
  if (text.startsWith('CHEM-ATT:')) return text.slice(9).trim();
  if (text.includes(':')) return text.split(':').pop().trim();
  return text;
}

/** رسم QR داخل عنصر canvas موجود */
export async function drawQR(canvas, code, size = 260) {
  if (!canvas) return;
  await QRCode.toCanvas(canvas, attendancePayload(code), {
    width: size,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#04121b', light: '#ffffff' },
  });
}

/** إرجاع QR كصورة dataURL (للعرض داخل <img> أو التحميل) */
export const qrDataUrl = (code, size = 260) =>
  QRCode.toDataURL(attendancePayload(code), {
    width: size,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#04121b', light: '#ffffff' },
  });

/** تحميل بطاقة الطالب كصورة PNG جاهزة للطباعة */
export async function downloadCard(profile) {
  const scale = 2;
  const width = 720;
  const height = 420;
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, '#0a1526');
  bg.addColorStop(0.55, '#071020');
  bg.addColorStop(1, '#0d1b31');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(width * 0.9, 0, 0, width * 0.9, 0, 520);
  glow.addColorStop(0, 'rgba(34,227,255,0.28)');
  glow.addColorStop(1, 'rgba(34,227,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = 'rgba(34,227,255,0.45)';
  ctx.lineWidth = 2;
  ctx.strokeRect(12, 12, width - 24, height - 24);

  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#22e3ff';
  ctx.font = '700 13px system-ui, sans-serif';
  ctx.fillText('منصة الكيمياء التفاعلية — د. محمود النجار', width - 40, 56);

  ctx.fillStyle = '#ffffff';
  ctx.font = '800 27px system-ui, sans-serif';
  ctx.fillText(String(profile.name || '').slice(0, 34), width - 40, 104);

  ctx.fillStyle = 'rgba(163,230,53,0.95)';
  ctx.font = '700 18px monospace';
  ctx.fillText(String(profile.code || ''), width - 40, 136);

  const rows = [
    ['المجموعة', profile.group],
    ['الصف', profile.grade],
    ['المدرسة', profile.school],
    ['المحافظة', profile.governorate],
    ['الموبايل', profile.phone],
    ['ولي الأمر', profile.parentPhone],
  ];
  let y = 182;
  rows.forEach(([label, value]) => {
    if (!value) return;
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(147,169,196,0.9)';
    ctx.font = '500 13px system-ui, sans-serif';
    ctx.fillText(label, width - 40, y);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#e8f1ff';
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.fillText(String(value).slice(0, 30), width - 150, y);
    y += 30;
  });

  const dataUrl = await qrDataUrl(profile.code, 220);
  const image = new Image();
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
    image.src = dataUrl;
  });
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(40, 132, 200, 200);
  ctx.drawImage(image, 50, 142, 180, 180);

  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(147,169,196,0.75)';
  ctx.font = '500 12px system-ui, sans-serif';
  ctx.fillText('امسح الكود لتسجيل الحضور • المبرمج توماس', width - 40, height - 34);

  const link = document.createElement('a');
  link.download = `بطاقة-${profile.code}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
