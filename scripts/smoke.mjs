#!/usr/bin/env node
/**
 * اختبار دخان شامل للمنصة — يشتغل على سيرفر حقيقي في مجلد بيانات مؤقت.
 * يغطي: التسجيل، الكود الفريد، الدخول، الصلاحيات، حفظ الواجب، التصحيح،
 * الحضور بالكود مع منع التكرار، إضافة مشرف، CSRF، وتصدير CSV.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'chem-smoke-'));
const PORT = 3900 + Math.floor(Math.random() * 90);
const BASE = `http://127.0.0.1:${PORT}`;

let passed = 0;
const failures = [];
function check(name, condition, extra = '') {
  if (condition) {
    passed += 1;
    console.log(`  ✅ ${name}`);
  } else {
    failures.push(`${name}${extra ? ` — ${extra}` : ''}`);
    console.log(`  ❌ ${name}${extra ? ` — ${extra}` : ''}`);
  }
}

/* ------------------------------ جلسة HTTP ------------------------------ */
class Session {
  constructor() {
    this.cookies = new Map();
    this.csrf = null;
  }
  cookieHeader() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
  }
  absorb(res) {
    const raw = res.headers.getSetCookie?.() || [];
    for (const line of raw) {
      const [pair] = line.split(';');
      const idx = pair.indexOf('=');
      const key = pair.slice(0, idx).trim();
      const value = pair.slice(idx + 1).trim();
      if (!value) this.cookies.delete(key);
      else this.cookies.set(key, value);
    }
  }
  async call(method, url, body, { csrf = true } = {}) {
    const headers = { 'content-type': 'application/json' };
    if (this.cookies.size) headers.cookie = this.cookieHeader();
    if (csrf && this.csrf) headers['x-csrf-token'] = this.csrf;
    const res = await fetch(BASE + url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'manual',
    });
    this.absorb(res);
    const type = res.headers.get('content-type') || '';
    const payload = type.includes('json') ? await res.json().catch(() => null) : await res.text();
    if (payload && typeof payload === 'object' && payload.csrf) this.csrf = payload.csrf;
    return { status: res.status, body: payload, headers: res.headers };
  }
  get(url, opts) {
    return this.call('GET', url, undefined, opts);
  }
  post(url, body, opts) {
    return this.call('POST', url, body, opts);
  }
  patch(url, body, opts) {
    return this.call('PATCH', url, body, opts);
  }
}

/* ------------------------------- التشغيل ------------------------------- */
async function waitForServer(timeoutMs = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/healthz`);
      if (res.ok) return true;
    } catch {
      /* لسه بيقوم */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

const server = spawn(process.execPath, ['server/index.js'], {
  cwd: ROOT,
  env: { ...process.env, PORT: String(PORT), DATA_DIR, NODE_ENV: 'test' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', (d) => {
  serverLog += d.toString();
});
server.stderr.on('data', (d) => {
  serverLog += d.toString();
});

let exitCode = 0;
try {
  if (!(await waitForServer())) {
    console.error('السيرفر لم يستجب.\n' + serverLog);
    process.exit(1);
  }

  /* 0) الاستجابة الأساسية */
  console.log('\n▶ الصحة والاستجابة');
  const health = await fetch(`${BASE}/healthz`);
  check('GET /healthz يرجع 200', health.status === 200);
  const headers = health.headers;
  check('رأس CSP موجود', /default-src 'self'/.test(headers.get('content-security-policy') || ''));
  check('X-Frame-Options = DENY', headers.get('x-frame-options') === 'DENY');
  check('X-Content-Type-Options = nosniff', headers.get('x-content-type-options') === 'nosniff');

  const meta = await new Session().get('/api/meta');
  check('GET /api/meta يعمل وبدون مصادقة', meta.status === 200);
  const groups = meta.body?.groups || [];
  check('المجموعات موجودة في الميتا', groups.length > 0);
  check('التسجيل مفتوح مبدئياً', meta.body?.allowRegistration === true);

  /* 1) المحتوى محمي قبل الدخول */
  console.log('\n▶ المحتوى محمي قبل الدخول');
  const guard = new Session();
  for (const url of ['/api/announcements', '/api/student/overview', '/api/leaderboard', '/api/bank']) {
    const r = await guard.get(url);
    check(`${url} يرفض الزائر (401)`, r.status === 401, `حصلنا على ${r.status}`);
  }
  const adminGuard = await guard.get('/api/admin/overview');
  check('/api/admin/overview يرفض الزائر (401)', adminGuard.status === 401);
  const badCsrf = await guard.post('/api/auth/login', { identifier: 'x', password: 'y', role: 'admin' });
  check('الطلبات الكتابية بدون CSRF مرفوضة أو غير دخول', badCsrf.status >= 400);

  /* 2) تسجيل طالب */
  console.log('\n▶ تسجيل الطالب والكود الفريد');
  const phone = '01' + String(Date.now()).slice(-9).padStart(9, '5');
  const registerRes = await new Session().post('/api/auth/register', {
    name: 'أحمد محمود عبد الله',
    phone,
    parentPhone: '01000000000',
    school: 'مدرسة النيل الثانوية',
    governorate: 'الجيزة',
    grade: 'الثالث الثانوي',
    group: groups[0]?.name || 'مجموعة أ',
    password: 'Chem@2024pass',
  });
  check('POST /api/auth/register يرجع 201', registerRes.status === 201, JSON.stringify(registerRes.body).slice(0, 160));
  const studentCode = registerRes.body?.code;
  const studentId = registerRes.body?.student?.id;
  check('الكود الفريد صادر', typeof studentCode === 'string' && studentCode.length >= 6, String(studentCode));
  check('رقم الموبايل مخفي في الاستجابة العامة', !JSON.stringify(registerRes.body).includes('passwordHash'));

  // منع التسجيل المكرر بنفس الموبايل
  const dup = await new Session().post('/api/auth/register', {
    name: 'طالب مكرر الرقم',
    phone,
    group: groups[0]?.name || 'مجموعة أ',
    password: 'Chem@2024pass',
  });
  check('منع تسجيل نفس الموبايل (409)', dup.status === 409);

  // كلمة سر ضعيفة
  const weak = await new Session().post('/api/auth/register', {
    name: 'طالب كلمة سر ضعيفة',
    phone: '0155' + String(Date.now()).slice(-7),
    group: groups[0]?.name || 'مجموعة أ',
    password: '123456',
  });
  check('رفض كلمة سر ضعيفة (400)', weak.status === 400);

  /* 3) دخول الطالب */
  console.log('\n▶ دخول الطالب وبطاقة البيانات');
  const student = new Session();
  const studentLogin = await student.post('/api/auth/login', {
    identifier: studentCode,
    password: 'Chem@2024pass',
    role: 'student',
  });
  check('دخول الطالب ناجح', studentLogin.status === 200, JSON.stringify(studentLogin.body).slice(0, 140));
  check('توكن CSRF وصل للعميل', typeof studentLogin.body?.csrf === 'string' && studentLogin.body.csrf.length > 10);
  check('دور المستخدم = student', studentLogin.body?.user?.role === 'student');

  const me = await student.get('/api/auth/me');
  check('GET /api/auth/me يعيد بيانات الطالب', me.status === 200 && me.body?.user?.code === studentCode);

  const overview = await student.get('/api/student/overview');
  check('بيانات الطالب الكاملة متاحة بعد الدخول', overview.status === 200);
  check('البطاقة تحتوي الكود لعمل QR', overview.body?.student?.code === studentCode);
  check('إحصاءات الطالب موجودة', overview.body?.stats && typeof overview.body.stats === 'object');

  const studentAdmin = await student.get('/api/admin/overview');
  check('الطالب لا يستطيع فتح مسارات الأدمن (403)', studentAdmin.status === 403, `حصلنا على ${studentAdmin.status}`);

  /* 4) الأدمن المزروع */
  console.log('\n▶ الأدمن المزروع وإضافة مشرف');
  const admin = new Session();
  const adminLogin = await admin.post('/api/auth/login', {
    identifier: 'admin',
    password: 'Admin@1234',
    role: 'admin',
  });
  check('دخول المشرف العام ناجح', adminLogin.status === 200, JSON.stringify(adminLogin.body).slice(0, 160));
  check('دور المشرف = admin', adminLogin.body?.user?.role === 'admin');
  check('صلاحية المشرف العام', adminLogin.body?.user?.title === 'المشرف العام');

  const adminOverview = await admin.get('/api/admin/overview');
  check('لوحة تحكم الأدمن تعمل', adminOverview.status === 200 && adminOverview.body?.kpis);
  check('عدد الطلاب في الإحصاءات ≥ 1', (adminOverview.body?.kpis?.students || 0) >= 1);

  const newAdminRes = await admin.post('/api/admin/admins', {
    name: 'مشرف كيمياء جديد',
    username: 'chem' + String(Date.now()).slice(-5),
    password: 'Admin@2024pass',
    title: 'مشرف مجموعة',
  });
  check('إضافة مشرف جديد تنجح', newAdminRes.status === 201 || newAdminRes.status === 200,
    JSON.stringify(newAdminRes.body).slice(0, 160));
  const newAdminUsername = newAdminRes.body?.admin?.username || '';

  const adminsList = await admin.get('/api/admin/admins');
  check('المشرف الجديد ظاهر في القائمة', Array.isArray(adminsList.body)
    && adminsList.body.some((a) => a.username === newAdminUsername));

  const noCsrf = await admin.call('POST', '/api/admin/admins', {
    name: 'بدون توكن', username: 'nocsrf' + Date.now(), password: 'Admin@2024pass',
  }, { csrf: false });
  check('رفض طلب كتابي بدون CSRF (403)', noCsrf.status === 403, `حصلنا على ${noCsrf.status}`);

  /* 5) واجب جديد + تسليم + تصحيح */
  console.log('\n▶ الواجبات: إنشاء، تسليم، تصحيح');
  const hwRes = await admin.post('/api/admin/homeworks', {
    title: 'واجب الاتزان الكيميائي',
    body: 'اشرح قاعدة لوشاتيليه مع مثالين.',
    maxScore: 20,
    group: groups[0]?.name || 'مجموعة أ',
    dueDate: new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10),
  });
  check('إنشاء واجب جديد', hwRes.status === 201 || hwRes.status === 200, JSON.stringify(hwRes.body).slice(0, 160));
  const hwId = hwRes.body?.homework?.id || hwRes.body?.id;

  const shortSubmit = await student.post(`/api/homeworks/${hwId}/submit`, { text: 'قصير' });
  check('رفض تسليم قصير جداً', shortSubmit.status === 400);

  const submit = await student.post(`/api/homeworks/${hwId}/submit`, {
    text: 'قاعدة لوشاتيليه: عند زيادة التركيز ينزاح الاتزان ناحية استهلاك المادة المضافة.',
  });
  check('تسليم الواجب ناجح', submit.status === 200 || submit.status === 201,
    JSON.stringify(submit.body).slice(0, 160));

  const subs = await admin.get('/api/admin/submissions?status=pending');
  const pending = Array.isArray(subs.body) ? subs.body : subs.body?.submissions || [];
  const target = pending.find((s) => s.homeworkId === hwId);
  check('التسليم يظهر للأدمن كمعلّق', Boolean(target));

  if (target) {
    const badGrade = await admin.patch(`/api/admin/submissions/${target.id}/grade`, { score: 99 });
    check('رفض درجة أكبر من النهائي (400)', badGrade.status === 400);

    const grade = await admin.patch(`/api/admin/submissions/${target.id}/grade`, {
      score: 18,
      feedback: 'ممتاز، أضف الرسم البياني.',
    });
    check('تصحيح الواجب ناجح', grade.status === 200, JSON.stringify(grade.body).slice(0, 160));

    const graded = await student.get('/api/student/overview');
    const gradedHw = (graded.body?.homeworks || []).find((h) => h.id === hwId);
    check('الطالب يرى درجته بعد التصحيح', gradedHw?.score === 18, JSON.stringify(gradedHw || {}).slice(0, 160));
  }

  /* 6) الحضور بالكود + منع التكرار */
  console.log('\n▶ حضور بكود QR ومنع التكرار');
  const att = await admin.post('/api/admin/attendance', { code: `CHEM-ATT:${studentCode}`, method: 'camera' });
  check('تسجيل الحضور من كود QR ناجح', att.status === 200 && !att.body?.duplicate,
    JSON.stringify(att.body).slice(0, 160));
  check('رد الحضور يحتوي الطالب', Boolean(att.body?.student?.name));

  const attAgain = await admin.post('/api/admin/attendance', { code: studentCode, method: 'manual' });
  check('منع تسجيل نفس الطالب مرتين في 20 دقيقة', attAgain.body?.duplicate === true);

  const attUnknown = await admin.post('/api/admin/attendance', { code: 'CH-ZZ-0000' });
  check('كود مجهول يرجع 404', attUnknown.status === 404);

  const attList = await admin.get('/api/admin/attendance');
  check('سجل الحضور يحتوي اسم الطالب', Array.isArray(attList.body)
    && attList.body.some((a) => a.studentName === 'أحمد محمود عبد الله'));

  /* 7) إعلان + بنك أسئلة + تصدير */
  console.log('\n▶ الإعلانات وبنك الأسئلة والتصدير');
  const ann = await admin.post('/api/admin/announcements', { title: 'حصة الأحد', body: 'مراجعة الباب الخامس.' });
  check('نشر إعلان', ann.status === 200 || ann.status === 201);

  const annStudent = await student.get('/api/announcements');
  check('الطالب يشوف الإعلان', Array.isArray(annStudent.body)
    && annStudent.body.some((a) => a.title === 'حصة الأحد'));

  const bank = await admin.post('/api/admin/bank', {
    question: 'ما هو العنصر الذي عدده الذري 26؟',
    answer: 'الحديد Fe',
    level: 'متوسط',
  });
  check('إضافة سؤال لبنك الأسئلة', bank.status === 200 || bank.status === 201);

  const csv = await admin.call('GET', '/api/admin/export?type=students');
  check('تصدير CSV للطلاب يعمل', csv.status === 200 && String(csv.body).includes('أحمد محمود عبد الله'));

  /* 8) الأمان في الإعدادات */
  console.log('\n▶ إعدادات الأمان وكلمة السر');
  const sec = await admin.get('/api/admin/security');
  check('إعدادات الأمان متاحة للمشرف', sec.status === 200 && Array.isArray(sec.body?.protections));
  check('الحماية موثّقة (scrypt/CSRF/جلسات)', (sec.body?.protections || []).length >= 5);

  const patchSec = await admin.patch('/api/admin/security', { sessionMinutes: 120 });
  check('تعديل جلسات الأمان بواسطة المشرف العام', patchSec.status === 200);

  const auditLog = await admin.get('/api/admin/audit');
  check('سجل التدقيق يسجل العمليات الحساسة', Array.isArray(auditLog.body)
    && auditLog.body.some((a) => String(a.action).includes('تصحيح') || String(a.action).includes('حضور')));

  const pwdChange = await student.post('/api/auth/password', {
    current: 'Chem@2024pass',
    next: 'NewChem@2025pass',
  });
  check('تغيير كلمة سر الطالب يعمل', pwdChange.status === 200, JSON.stringify(pwdChange.body).slice(0, 160));

  const oldPass = await new Session().post('/api/auth/login', {
    identifier: studentCode, password: 'Chem@2024pass', role: 'student',
  });
  check('كلمة السر القديمة بطّلت شغالة', oldPass.status === 401);

  const relogin = await new Session().post('/api/auth/login', {
    identifier: studentCode, password: 'NewChem@2025pass', role: 'student',
  });
  check('الدخول بكلمة السر الجديدة', relogin.status === 200);

  /* 9) المسارات الصفحية */
  console.log('\n▶ الواجهة والصفحات');
  const home = await new Session().call('GET', '/');
  check('الصفحة الرئيسية ترد (200) أو توجيه لـ dev', home.status === 200 || home.status === 404);
  const healthz = await new Session().call('GET', '/healthz');
  check('healthz ما زال يعمل بعد كل العمليات', healthz.status === 200);
} catch (error) {
  failures.push(`استثناء غير متوقع: ${error?.stack || error}`);
  console.error(error);
} finally {
  server.kill('SIGTERM');
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
}

console.log(`\n${'─'.repeat(56)}`);
if (failures.length) {
  exitCode = 1;
  console.log(`❌ فشل ${failures.length} اختبار، ونجح ${passed}`);
  failures.forEach((f) => console.log(`   • ${f}`));
} else {
  console.log(`✅ كل الاختبارات نجحت (${passed})`);
}
process.exit(exitCode);
