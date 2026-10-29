import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  load,
  mutate,
  save,
  audit,
  uid,
  nowISO,
  hashPassword,
  verifyPassword,
  passwordProblem,
  makeStudentCode,
  publicStudent,
  publicAdmin,
} from './store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === 'production';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

/* ------------------------------------------------------------------ */
/* رؤوس الحماية                                                        */
/* ------------------------------------------------------------------ */
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "media-src 'self' blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'none'",
      "form-action 'self'",
      "object-src 'none'",
    ].join('; '),
  );
  if (IS_PROD) res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  next();
});

app.use(express.json({ limit: '256kb' }));

/* ------------------------------------------------------------------ */
/* أدوات مساعدة                                                        */
/* ------------------------------------------------------------------ */
const parseCookies = (header = '') =>
  header.split(';').reduce((acc, part) => {
    const idx = part.indexOf('=');
    if (idx > 0) acc[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
    return acc;
  }, {});

const str = (value, max = 200) => String(value ?? '').trim().slice(0, max);
const clientIp = (req) => (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim();

const sessions = new Map();
const attempts = new Map(); // key -> { count, until }
const globalHits = new Map(); // ip -> { count, resetAt }

function cookieOptions(req, maxAgeMs) {
  const secure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure,
    path: '/',
    maxAge: maxAgeMs,
  };
}

function readSession(req) {
  const sid = parseCookies(req.headers.cookie).sid;
  if (!sid) return null;
  const session = sessions.get(sid);
  if (!session) return null;
  const db = load();
  const ttl = (db.settings.sessionMinutes || 90) * 60 * 1000;
  if (Date.now() - session.lastSeen > ttl) {
    sessions.delete(sid);
    return null;
  }
  session.lastSeen = Date.now();
  return { ...session, sid };
}

function currentUser(session) {
  const db = load();
  if (!session) return null;
  if (session.role === 'admin') {
    const admin = db.admins.find((a) => a.id === session.userId);
    if (!admin || !admin.active) return null;
    return { role: 'admin', ...publicAdmin(admin) };
  }
  const student = db.students.find((s) => s.id === session.userId);
  if (!student || !student.active) return null;
  return { role: 'student', ...publicStudent(student) };
}

function requireAuth(req, res, next) {
  const session = readSession(req);
  const user = currentUser(session);
  if (!user) return res.status(401).json({ error: 'انتهت الجلسة، من فضلك سجّل الدخول من جديد' });
  req.session = session;
  req.user = user;
  return next();
}

const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'لا تملك صلاحية لهذا الإجراء' });
  return next();
};

// حماية CSRF: مقارنة هيدر الطلب مع توكن الجلسة
function requireCsrf(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const token = req.headers['x-csrf-token'];
  if (!token || !req.session || token !== req.session.csrf) {
    return res.status(403).json({ error: 'طلب غير موثوق (CSRF) — أعد تحميل الصفحة' });
  }
  return next();
}

// حد عام للطلبات
app.use('/api', (req, res, next) => {
  const ip = clientIp(req);
  const bucket = globalHits.get(ip) || { count: 0, resetAt: Date.now() + 60000 };
  if (Date.now() > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = Date.now() + 60000;
  }
  bucket.count += 1;
  globalHits.set(ip, bucket);
  if (bucket.count > 400) return res.status(429).json({ error: 'طلبات كثيرة جداً، حاول بعد دقيقة' });
  return next();
});

/* ------------------------------------------------------------------ */
/* المصادقة                                                            */
/* ------------------------------------------------------------------ */
app.post('/api/auth/login', (req, res) => {
  const db = load();
  const role = req.body?.role === 'admin' ? 'admin' : 'student';
  const identifier = str(req.body?.identifier, 60).toUpperCase();
  const password = String(req.body?.password ?? '');
  const ip = clientIp(req);

  if (!identifier || !password) return res.status(400).json({ error: 'أدخل البيانات المطلوبة' });
  if (db.settings.locked && role !== 'admin') {
    return res.status(423).json({ error: db.settings.lockMessage || 'المنصة مغلقة مؤقتاً بواسطة الإدارة' });
  }

  const key = `${ip}|${identifier}`;
  const record = attempts.get(key) || { count: 0, until: 0 };
  if (record.until && Date.now() < record.until) {
    const seconds = Math.ceil((record.until - Date.now()) / 1000);
    return res.status(429).json({ error: `تم إيقاف المحاولات مؤقتاً لحماية الحساب. حاول بعد ${seconds} ثانية` });
  }

  const fail = (message, actor) => {
    const next = { count: record.count + 1, until: 0 };
    const max = db.settings.maxAttempts || 6;
    if (next.count >= max) {
      next.count = 0;
      next.until = Date.now() + (db.settings.lockMinutes || 10) * 60000;
    }
    attempts.set(key, next);
    mutate((d) => audit(d, actor, 'محاولة دخول فاشلة', `المعرّف: ${identifier}`, ip));
    return res.status(401).json({ error: message, attemptsLeft: Math.max(0, max - (next.count || max)) });
  };

  if (role === 'admin') {
    const admin = db.admins.find((a) => a.username.toLowerCase() === identifier.toLowerCase());
    if (!admin) return fail('بيانات الدخول غير صحيحة');
    if (!admin.active) return res.status(403).json({ error: 'هذا الحساب موقوف، تواصل مع المشرف العام' });
    if (!verifyPassword(password, admin.salt, admin.hash)) return fail('بيانات الدخول غير صحيحة', admin.name);
    attempts.delete(key);
    const sid = crypto.randomBytes(32).toString('hex');
    const csrf = crypto.randomBytes(24).toString('hex');
    sessions.set(sid, { userId: admin.id, role: 'admin', csrf, createdAt: Date.now(), lastSeen: Date.now(), ip });
    admin.lastLogin = nowISO();
    mutate((d) => audit(d, admin.name, 'دخول مشرف', `@${admin.username}`, ip));
    res.cookie('sid', sid, cookieOptions(req, (db.settings.sessionMinutes || 90) * 60000));
    res.cookie('csrf', csrf, cookieOptions(req, (db.settings.sessionMinutes || 90) * 60000));
    return res.json({ user: currentUser({ userId: admin.id, role: 'admin' }), csrf, expiresIn: db.settings.sessionMinutes * 60 });
  }

  const student = db.students.find((s) => s.code.toUpperCase() === identifier);
  if (!student) return fail('كود الطالب غير موجود');
  if (!student.active) return res.status(403).json({ error: 'حسابك موقوف، تواصل مع الإدارة' });
  if (!verifyPassword(password, student.salt, student.hash)) return fail('كلمة السر غير صحيحة', student.name);
  attempts.delete(key);
  const sid = crypto.randomBytes(32).toString('hex');
  const csrf = crypto.randomBytes(24).toString('hex');
  sessions.set(sid, { userId: student.id, role: 'student', csrf, createdAt: Date.now(), lastSeen: Date.now(), ip });
  student.lastLogin = nowISO();
  mutate((d) => audit(d, student.name, 'دخول طالب', student.code, ip));
  res.cookie('sid', sid, cookieOptions(req, (db.settings.sessionMinutes || 90) * 60000));
  res.cookie('csrf', csrf, cookieOptions(req, (db.settings.sessionMinutes || 90) * 60000));
  return res.json({
    user: currentUser({ userId: student.id, role: 'student' }),
    csrf,
    expiresIn: (db.settings.sessionMinutes || 90) * 60,
  });
});

app.post('/api/auth/register', (req, res) => {
  const db = load();
  const ip = clientIp(req);
  if (!db.settings.allowRegistration) return res.status(403).json({ error: 'التسجيل متوقف حالياً، تواصل مع الإدارة' });
  const name = str(req.body?.name, 60);
  const phone = str(req.body?.phone, 20).replace(/[^\d+]/g, '');
  const parentPhone = str(req.body?.parentPhone, 20).replace(/[^\d+]/g, '');
  const school = str(req.body?.school, 80);
  const governorate = str(req.body?.governorate, 40);
  const grade = str(req.body?.grade, 30) || 'الثالث الثانوي';
  const group = str(req.body?.group, 60);
  const password = String(req.body?.password ?? '');

  if (name.length < 5) return res.status(400).json({ error: 'اكتب الاسم بالكامل (٥ أحرف على الأقل)' });
  if (!/^01\d{9}$/.test(phone)) return res.status(400).json({ error: 'رقم الموبايل يجب أن يكون ١١ رقماً ويبدأ بـ 01' });
  if (parentPhone && !/^01\d{9}$/.test(parentPhone)) return res.status(400).json({ error: 'رقم ولي الأمر غير صحيح' });
  const problem = passwordProblem(password);
  if (problem) return res.status(400).json({ error: problem });
  if (!db.groups.some((g) => g.name === group)) return res.status(400).json({ error: 'اختر مجموعة صحيحة' });
  if (db.students.some((s) => s.phone === phone)) return res.status(409).json({ error: 'رقم الموبايل مسجل بالفعل، استخدم كودك للدخول' });

  const created = mutate((d) => {
    const groupObj = d.groups.find((g) => g.name === group);
    const student = {
      id: uid('stu-'),
      code: makeStudentCode(d, group),
      name,
      phone,
      parentPhone,
      school,
      governorate,
      grade,
      group,
      groupId: groupObj?.id || '',
      points: 0,
      active: true,
      createdAt: nowISO(),
      ...hashPassword(password),
      lastLogin: null,
    };
    d.students.push(student);
    audit(d, name, 'تسجيل طالب جديد', student.code, ip);
    return student;
  });

  return res.status(201).json({ student: publicStudent(created), code: created.code });
});

app.post('/api/auth/logout', (req, res) => {
  const sid = parseCookies(req.headers.cookie).sid;
  if (sid) sessions.delete(sid);
  res.clearCookie('sid', { path: '/' });
  res.clearCookie('csrf', { path: '/' });
  return res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  const session = readSession(req);
  const user = currentUser(session);
  if (!user) return res.status(401).json({ error: 'لا توجد جلسة' });
  const db = load();
  return res.json({
    user,
    csrf: session.csrf,
    settings: {
      platformName: db.settings.platformName,
      teacher: db.settings.teacher,
      allowRegistration: db.settings.allowRegistration,
      locked: db.settings.locked,
    },
  });
});

app.post('/api/auth/password', requireAuth, requireCsrf, (req, res) => {
  const current = String(req.body?.current ?? '');
  const next = String(req.body?.next ?? '');
  const problem = passwordProblem(next);
  if (problem) return res.status(400).json({ error: problem });
  const db = load();
  const collection = req.user.role === 'admin' ? db.admins : db.students;
  const account = collection.find((a) => a.id === req.user.id);
  if (!account) return res.status(404).json({ error: 'الحساب غير موجود' });
  if (!verifyPassword(current, account.salt, account.hash)) return res.status(401).json({ error: 'كلمة السر الحالية غير صحيحة' });
  mutate((d) => {
    const target = (req.user.role === 'admin' ? d.admins : d.students).find((a) => a.id === req.user.id);
    Object.assign(target, hashPassword(next));
    audit(d, req.user.name, 'تغيير كلمة السر', `@${req.user.code || req.user.username}`, clientIp(req));
  });
  sessions.forEach((value, key) => {
    if (value.userId === req.user.id && key !== req.session.sid) sessions.delete(key);
  });
  return res.json({ ok: true });
});

/* ------------------------------------------------------------------ */
/* المحتوى العام                                                       */
/* ------------------------------------------------------------------ */
app.get('/api/meta', (req, res) => {
  const db = load();
  return res.json({
    platformName: db.settings.platformName,
    teacher: db.settings.teacher,
    groups: db.groups,
    allowRegistration: db.settings.allowRegistration,
    locked: db.settings.locked,
    lockMessage: db.settings.lockMessage,
    stats: {
      students: db.students.filter((s) => s.active).length,
      attendance: db.attendance.length,
      homeworks: db.homeworks.length,
      groups: db.groups.length,
    },
  });
});

app.get('/api/announcements', requireAuth, (req, res) => {
  const db = load();
  res.json(db.announcements.slice().sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.at.localeCompare(a.at)));
});

app.get('/api/leaderboard', requireAuth, (req, res) => {
  const db = load();
  const rows = db.students
    .filter((s) => s.active)
    .map((s) => ({ id: s.id, name: s.name, group: s.group, points: s.points, code: s.code }))
    .sort((a, b) => b.points - a.points)
    .slice(0, 20)
    .map((row, i) => ({ ...row, rank: i + 1, code: row.code.slice(0, 4) + '••••' }));
  res.json(rows);
});

app.get('/api/bank', requireAuth, (req, res) => {
  const db = load();
  res.json(db.bank);
});

/* ------------------------------------------------------------------ */
/* الطالب                                                              */
/* ------------------------------------------------------------------ */
app.get('/api/student/overview', requireAuth, requireRole('student'), (req, res) => {
  const db = load();
  const me = db.students.find((s) => s.id === req.user.id);
  const attendance = db.attendance.filter((a) => a.studentId === me.id).sort((a, b) => b.at.localeCompare(a.at));
  const submissions = db.submissions.filter((s) => s.studentId === me.id);
  const results = db.quizResults.filter((r) => r.studentId === me.id);
  const rank = db.students.filter((s) => s.active && s.points > me.points).length + 1;
  const totalPossible = db.homeworks.reduce((sum, h) => sum + h.maxScore, 0) || 1;
  const earned = submissions.filter((s) => s.status === 'graded').reduce((sum, s) => sum + (s.score || 0), 0);
  res.json({
    profile: publicStudent(me),
    homeworks: db.homeworks.map((h) => {
      const sub = submissions.find((s) => s.homeworkId === h.id);
      return { ...h, submission: sub || null };
    }),
    attendance,
    results,
    rank,
    totalStudents: db.students.filter((s) => s.active).length,
    progress: Math.min(100, Math.round((earned / totalPossible) * 100)),
    avgQuiz: results.length ? Math.round(results.reduce((sum, r) => sum + (r.score / r.total) * 100, 0) / results.length) : 0,
  });
});

app.post('/api/homeworks/:id/submit', requireAuth, requireRole('student'), requireCsrf, (req, res) => {
  const db = load();
  const homework = db.homeworks.find((h) => h.id === req.params.id);
  if (!homework) return res.status(404).json({ error: 'الواجب غير موجود' });
  const text = str(req.body?.text, 4000);
  if (text.length < 10) return res.status(400).json({ error: 'اكتب إجابة واضحة (١٠ أحرف على الأقل)' });
  const existing = db.submissions.find((s) => s.homeworkId === homework.id && s.studentId === req.user.id);
  if (existing && existing.status === 'graded') return res.status(409).json({ error: 'تم تصحيح هذا الواجب بالفعل' });
  mutate((d) => {
    const found = d.submissions.find((s) => s.homeworkId === homework.id && s.studentId === req.user.id);
    if (found) {
      found.text = text;
      found.at = nowISO();
    } else {
      d.submissions.push({
        id: uid('sub-'),
        homeworkId: homework.id,
        studentId: req.user.id,
        text,
        at: nowISO(),
        score: null,
        feedback: '',
        status: 'pending',
        gradedBy: null,
        gradedAt: null,
      });
    }
    const student = d.students.find((s) => s.id === req.user.id);
    if (student) student.points += 3;
    audit(d, req.user.name, 'تسليم واجب', homework.title, clientIp(req));
  });
  return res.json({ ok: true });
});

app.post('/api/quiz-results', requireAuth, requireRole('student'), requireCsrf, (req, res) => {
  const quizId = str(req.body?.quizId, 40);
  const quizTitle = str(req.body?.quizTitle, 80);
  const score = Math.max(0, Math.min(999, Number(req.body?.score) || 0));
  const total = Math.max(1, Math.min(999, Number(req.body?.total) || 1));
  if (score > total) return res.status(400).json({ error: 'بيانات نتيجة غير صحيحة' });
  mutate((d) => {
    d.quizResults.unshift({
      id: uid('qr-'),
      studentId: req.user.id,
      quizId,
      quizTitle,
      score,
      total,
      at: nowISO(),
    });
    const student = d.students.find((s) => s.id === req.user.id);
    if (student) student.points += Math.round((score / total) * 10);
  });
  return res.json({ ok: true });
});

/* ------------------------------------------------------------------ */
/* الأدمن: نظرة عامة                                                   */
/* ------------------------------------------------------------------ */
app.get('/api/admin/overview', requireAuth, requireRole('admin'), (req, res) => {
  const db = load();
  const dayKey = (iso) => iso.slice(0, 10);
  const days = [...Array(7)].map((_, i) => {
    const d = new Date(Date.now() - (6 - i) * 864e5);
    const key = d.toISOString().slice(0, 10);
    return {
      key,
      label: d.toLocaleDateString('ar-EG', { weekday: 'short' }),
      attendance: db.attendance.filter((a) => dayKey(a.at) === key).length,
    };
  });
  const pending = db.submissions.filter((s) => s.status === 'pending');
  const totalScores = db.submissions.filter((s) => s.status === 'graded');
  res.json({
    kpis: {
      students: db.students.filter((s) => s.active).length,
      admins: db.admins.length,
      todayAttendance: db.attendance.filter((a) => dayKey(a.at) === dayKey(nowISO())).length,
      pendingGrading: pending.length,
      homeworks: db.homeworks.length,
      avgScore: totalScores.length
        ? Math.round((totalScores.reduce((sum, s) => sum + (s.score || 0), 0) / totalScores.length) * 10) / 10
        : 0,
      avgQuiz: db.quizResults.length
        ? Math.round(db.quizResults.reduce((sum, r) => sum + (r.score / r.total) * 100, 0) / db.quizResults.length)
        : 0,
      groups: db.groups.length,
    },
    trend: days,
    recent: db.audit.slice(0, 8),
    pending: pending.slice(0, 5).map((s) => ({
      ...s,
      studentName: db.students.find((x) => x.id === s.studentId)?.name || 'طالب',
      homeworkTitle: db.homeworks.find((h) => h.id === s.homeworkId)?.title || 'واجب',
    })),
    groups: db.groups.map((g) => ({
      ...g,
      count: db.students.filter((s) => s.groupId === g.id && s.active).length,
    })),
  });
});

/* ------------------------------------------------------------------ */
/* الأدمن: الطلاب                                                      */
/* ------------------------------------------------------------------ */
app.get('/api/admin/students', requireAuth, requireRole('admin'), (req, res) => {
  const db = load();
  const q = str(req.query.q, 60).toLowerCase();
  const group = str(req.query.group, 60);
  const rows = db.students
    .filter((s) => (!q ? true : s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q) || s.phone.includes(q)))
    .filter((s) => (!group ? true : s.group === group))
    .map((s) => {
      const attendance = db.attendance.filter((a) => a.studentId === s.id);
      const subs = db.submissions.filter((x) => x.studentId === s.id);
      return {
        ...publicStudent(s),
        attendanceCount: attendance.length,
        lastAttendance: attendance.sort((a, b) => b.at.localeCompare(a.at))[0]?.at || null,
        graded: subs.filter((x) => x.status === 'graded').length,
        pending: subs.filter((x) => x.status === 'pending').length,
      };
    })
    .sort((a, b) => b.points - a.points);
  res.json(rows);
});

app.post('/api/admin/students', requireAuth, requireRole('admin'), requireCsrf, (req, res) => {
  const name = str(req.body?.name, 60);
  const phone = str(req.body?.phone, 20).replace(/[^\d+]/g, '');
  const group = str(req.body?.group, 60);
  if (name.length < 5) return res.status(400).json({ error: 'اسم الطالب مطلوب' });
  const db = load();
  if (!group) return res.status(400).json({ error: 'اختر المجموعة' });
  const tempPassword = `NG${crypto.randomInt(100000, 999999)}`;
  const created = mutate((d) => {
    const student = {
      id: uid('stu-'),
      code: makeStudentCode(d, group),
      name,
      phone,
      parentPhone: str(req.body?.parentPhone, 20).replace(/[^\d+]/g, ''),
      school: str(req.body?.school, 80),
      governorate: str(req.body?.governorate, 40),
      grade: str(req.body?.grade, 30) || 'الثالث الثانوي',
      group,
      groupId: d.groups.find((g) => g.name === group)?.id || '',
      points: 0,
      active: true,
      createdAt: nowISO(),
      ...hashPassword(tempPassword),
      lastLogin: null,
    };
    d.students.push(student);
    audit(d, req.user.name, 'إضافة طالب', `${name} — ${student.code}`, clientIp(req));
    return student;
  });
  return res.status(201).json({ student: publicStudent(created), tempPassword });
});

app.patch('/api/admin/students/:id', requireAuth, requireRole('admin'), requireCsrf, (req, res) => {
  const db = load();
  if (!db.students.some((s) => s.id === req.params.id)) return res.status(404).json({ error: 'الطالب غير موجود' });
  const updated = mutate((d) => {
    const student = d.students.find((s) => s.id === req.params.id);
    if (typeof req.body?.name === 'string' && str(req.body.name, 60).length >= 5) student.name = str(req.body.name, 60);
    if (typeof req.body?.phone === 'string') student.phone = str(req.body.phone, 20).replace(/[^\d+]/g, '');
    if (typeof req.body?.group === 'string' && d.groups.some((g) => g.name === req.body.group)) {
      student.group = req.body.group;
      student.groupId = d.groups.find((g) => g.name === req.body.group).id;
    }
    if (typeof req.body?.points === 'number') student.points = Math.max(0, Math.min(9999, req.body.points));
    if (typeof req.body?.active === 'boolean') student.active = req.body.active;
    audit(d, req.user.name, 'تعديل بيانات طالب', student.name, clientIp(req));
    return publicStudent(student);
  });
  return res.json(updated);
});

app.post('/api/admin/students/:id/reset-password', requireAuth, requireRole('admin'), requireCsrf, (req, res) => {
  const db = load();
  if (!db.students.some((s) => s.id === req.params.id)) return res.status(404).json({ error: 'الطالب غير موجود' });
  const temp = `NG${crypto.randomInt(100000, 999999)}`;
  mutate((d) => {
    const student = d.students.find((s) => s.id === req.params.id);
    Object.assign(student, hashPassword(temp));
    audit(d, req.user.name, 'إعادة تعيين كلمة سر', student.name, clientIp(req));
  });
  sessions.forEach((value, key) => {
    if (value.userId === req.params.id) sessions.delete(key);
  });
  return res.json({ tempPassword: temp });
});

app.delete('/api/admin/students/:id', requireAuth, requireRole('admin'), requireCsrf, (req, res) => {
  const db = load();
  const student = db.students.find((s) => s.id === req.params.id);
  if (!student) return res.status(404).json({ error: 'الطالب غير موجود' });
  mutate((d) => {
    d.students = d.students.filter((s) => s.id !== req.params.id);
    d.attendance = d.attendance.filter((a) => a.studentId !== req.params.id);
    d.submissions = d.submissions.filter((s) => s.studentId !== req.params.id);
    d.quizResults = d.quizResults.filter((r) => r.studentId !== req.params.id);
    audit(d, req.user.name, 'حذف طالب', student.name, clientIp(req));
  });
  sessions.forEach((value, key) => {
    if (value.userId === req.params.id) sessions.delete(key);
  });
  return res.json({ ok: true });
});

/* ------------------------------------------------------------------ */
/* الأدمن: الحضور (كاميرا / كود / يدوي)                                 */
/* ------------------------------------------------------------------ */
app.post('/api/admin/attendance', requireAuth, requireRole('admin'), requireCsrf, (req, res) => {
  const rawCode = str(req.body?.code, 30).toUpperCase().replace(/\s/g, '');
  const method = ['camera', 'manual'].includes(req.body?.method) ? req.body.method : 'manual';
  const sessionName = str(req.body?.session, 60) || 'حصة اليوم';
  if (!rawCode) return res.status(400).json({ error: 'لم يتم قراءة كود' });
  const db = load();
  const code = rawCode.includes(':') ? rawCode.split(':').pop() : rawCode;
  const student = db.students.find((s) => s.code.toUpperCase() === code);
  if (!student) return res.status(404).json({ error: `كود غير معروف: ${code}` });
  if (!student.active) return res.status(403).json({ error: 'حساب الطالب موقوف' });
  const recent = db.attendance.find(
    (a) => a.studentId === student.id && Date.now() - new Date(a.at).getTime() < 20 * 60000,
  );
  if (recent) {
    return res.status(200).json({
      duplicate: true,
      message: `تم تسجيل ${student.name} بالفعل قبل قليل`,
      student: publicStudent(student),
    });
  }
  const record = mutate((d) => {
    const entry = {
      id: uid('att-'),
      studentId: student.id,
      code: student.code,
      at: nowISO(),
      method,
      by: req.user.id,
      session: sessionName,
    };
    d.attendance.unshift(entry);
    const target = d.students.find((s) => s.id === student.id);
    target.points += 5;
    audit(d, req.user.name, 'تسجيل حضور', `${student.name} (${method === 'camera' ? 'كاميرا' : 'يدوي'})`, clientIp(req));
    return entry;
  });
  return res.status(201).json({
    attendance: record,
    student: publicStudent(student),
    message: `تم تسجيل حضور ${student.name} بنجاح`,
  });
});

app.get('/api/admin/attendance', requireAuth, requireRole('admin'), (req, res) => {
  const db = load();
  const date = str(req.query.date, 10);
  const rows = db.attendance
    .filter((a) => (!date ? true : a.at.slice(0, 10) === date))
    .slice(0, 500)
    .map((a) => ({ ...a, studentName: db.students.find((s) => s.id === a.studentId)?.name || 'محذوف' }));
  res.json(rows);
});

/* ------------------------------------------------------------------ */
/* الأدمن: الواجبات والتصحيح                                           */
/* ------------------------------------------------------------------ */
app.get('/api/admin/homeworks', requireAuth, requireRole('admin'), (req, res) => {
  const db = load();
  res.json(
    db.homeworks.map((h) => {
      const subs = db.submissions.filter((s) => s.homeworkId === h.id);
      return {
        ...h,
        total: subs.length,
        graded: subs.filter((s) => s.status === 'graded').length,
        pending: subs.filter((s) => s.status === 'pending').length,
      };
    }),
  );
});

app.post('/api/admin/homeworks', requireAuth, requireRole('admin'), requireCsrf, (req, res) => {
  const title = str(req.body?.title, 80);
  const body = str(req.body?.body, 2000);
  const maxScore = Math.max(1, Math.min(100, Number(req.body?.maxScore) || 10));
  const group = str(req.body?.group, 60) || 'الكل';
  const dueDate = str(req.body?.dueDate, 10);
  if (title.length < 4) return res.status(400).json({ error: 'عنوان الواجب قصير جداً' });
  if (body.length < 10) return res.status(400).json({ error: 'اكتب وصف الواجب' });
  const created = mutate((d) => {
    const homework = { id: uid('hw-'), title, body, group, maxScore, dueDate, by: req.user.id, createdAt: nowISO() };
    d.homeworks.unshift(homework);
    audit(d, req.user.name, 'إنشاء واجب', title, clientIp(req));
    return homework;
  });
  return res.status(201).json(created);
});

app.delete('/api/admin/homeworks/:id', requireAuth, requireRole('admin'), requireCsrf, (req, res) => {
  const db = load();
  const hw = db.homeworks.find((h) => h.id === req.params.id);
  if (!hw) return res.status(404).json({ error: 'الواجب غير موجود' });
  mutate((d) => {
    d.homeworks = d.homeworks.filter((h) => h.id !== req.params.id);
    d.submissions = d.submissions.filter((s) => s.homeworkId !== req.params.id);
    audit(d, req.user.name, 'حذف واجب', hw.title, clientIp(req));
  });
  return res.json({ ok: true });
});

app.get('/api/admin/submissions', requireAuth, requireRole('admin'), (req, res) => {
  const db = load();
  const status = str(req.query.status, 20);
  const rows = db.submissions
    .filter((s) => (!status ? true : s.status === status))
    .sort((a, b) => (a.status === 'pending' ? -1 : 1) - (b.status === 'pending' ? -1 : 1) || b.at.localeCompare(a.at))
    .map((s) => {
      const hw = db.homeworks.find((h) => h.id === s.homeworkId);
      const student = db.students.find((x) => x.id === s.studentId);
      return {
        ...s,
        maxScore: hw?.maxScore ?? 10,
        homeworkTitle: hw?.title || 'واجب محذوف',
        studentName: student?.name || 'طالب محذوف',
        studentCode: student?.code || '—',
        group: student?.group || '—',
      };
    });
  res.json(rows);
});

app.patch('/api/admin/submissions/:id/grade', requireAuth, requireRole('admin'), requireCsrf, (req, res) => {
  const db = load();
  const sub = db.submissions.find((s) => s.id === req.params.id);
  if (!sub) return res.status(404).json({ error: 'التسليم غير موجود' });
  const hw = db.homeworks.find((h) => h.id === sub.homeworkId);
  const maxScore = hw?.maxScore ?? 10;
  const score = Number(req.body?.score);
  const feedback = str(req.body?.feedback, 600);
  if (!Number.isFinite(score) || score < 0 || score > maxScore) {
    return res.status(400).json({ error: `الدرجة يجب أن تكون بين ٠ و ${maxScore}` });
  }
  const result = mutate((d) => {
    const target = d.submissions.find((s) => s.id === req.params.id);
    const wasGraded = target.status === 'graded';
    target.score = score;
    target.feedback = feedback;
    target.status = 'graded';
    target.gradedBy = req.user.id;
    target.gradedAt = nowISO();
    const student = d.students.find((s) => s.id === target.studentId);
    if (student) {
      if (!wasGraded) student.points += Math.round((score / maxScore) * 20);
      const sName = student.name;
      audit(d, req.user.name, 'تصحيح واجب', `${sName} — ${score}/${maxScore}`, clientIp(req));
    }
    return target;
  });
  return res.json(result);
});

/* ------------------------------------------------------------------ */
/* الأدمن: الإعلانات وبنك الأسئلة                                      */
/* ------------------------------------------------------------------ */
app.post('/api/admin/announcements', requireAuth, requireRole('admin'), requireCsrf, (req, res) => {
  const title = str(req.body?.title, 90);
  const body = str(req.body?.body, 800);
  if (title.length < 3 || body.length < 5) return res.status(400).json({ error: 'أكمل بيانات الإعلان' });
  const created = mutate((d) => {
    const item = { id: uid('ann-'), title, body, at: nowISO(), by: req.user.name, pinned: Boolean(req.body?.pinned) };
    d.announcements.unshift(item);
    audit(d, req.user.name, 'نشر إعلان', title, clientIp(req));
    return item;
  });
  return res.status(201).json(created);
});

app.delete('/api/admin/announcements/:id', requireAuth, requireRole('admin'), requireCsrf, (req, res) => {
  mutate((d) => {
    d.announcements = d.announcements.filter((a) => a.id !== req.params.id);
    audit(d, req.user.name, 'حذف إعلان', req.params.id, clientIp(req));
  });
  return res.json({ ok: true });
});

app.post('/api/admin/bank', requireAuth, requireRole('admin'), requireCsrf, (req, res) => {
  const q = str(req.body?.q, 300);
  const options = Array.isArray(req.body?.options) ? req.body.options.map((o) => str(o, 120)).slice(0, 4) : [];
  const answer = Number(req.body?.answer);
  const chapter = str(req.body?.chapter, 60) || 'عام';
  if (q.length < 8 || options.filter(Boolean).length < 2) return res.status(400).json({ error: 'أكمل نص السؤال واختيارين على الأقل' });
  if (!Number.isInteger(answer) || answer < 0 || answer >= options.length) return res.status(400).json({ error: 'حدد الإجابة الصحيحة' });
  const created = mutate((d) => {
    const item = { id: uid('q-'), q, options, answer, chapter };
    d.bank.push(item);
    audit(d, req.user.name, 'إضافة سؤال', q.slice(0, 40), clientIp(req));
    return item;
  });
  return res.status(201).json(created);
});

app.delete('/api/admin/bank/:id', requireAuth, requireRole('admin'), requireCsrf, (req, res) => {
  mutate((d) => {
    d.bank = d.bank.filter((q) => q.id !== req.params.id);
    audit(d, req.user.name, 'حذف سؤال', req.params.id, clientIp(req));
  });
  return res.json({ ok: true });
});

/* ------------------------------------------------------------------ */
/* المالك: إدارة المشرفين                                              */
/* ------------------------------------------------------------------ */
app.get('/api/admin/admins', requireAuth, requireRole('admin'), (req, res) => {
  const db = load();
  res.json(db.admins.map(publicAdmin));
});

app.post('/api/admin/admins', requireAuth, requireRole('admin'), requireCsrf, (req, res) => {
  if (req.user.role !== 'owner') {
    return res.status(403).json({ error: 'إضافة المشرفين متاحة للمشرف العام فقط' });
  }
  const username = str(req.body?.username, 30).toLowerCase();
  const name = str(req.body?.name, 60);
  const password = String(req.body?.password ?? '');
  const role = req.body?.role === 'owner' ? 'owner' : 'admin';
  if (!/^[a-z0-9._-]{4,30}$/.test(username)) return res.status(400).json({ error: 'اسم المستخدم يجب أن يكون ٤ أحرف إنجليزية على الأقل' });
  if (name.length < 3) return res.status(400).json({ error: 'اكتب اسم المشرف' });
  const problem = passwordProblem(password);
  if (problem) return res.status(400).json({ error: problem });
  const db = load();
  if (db.admins.some((a) => a.username === username)) return res.status(409).json({ error: 'اسم المستخدم موجود بالفعل' });
  const created = mutate((d) => {
    const admin = {
      id: uid('adm-'),
      username,
      name,
      role,
      title: role === 'owner' ? 'المشرف العام' : 'مشرف',
      email: str(req.body?.email, 80),
      ...hashPassword(password),
      active: true,
      createdAt: nowISO(),
      lastLogin: null,
    };
    d.admins.push(admin);
    audit(d, req.user.name, 'إضافة مشرف', `${name} (@${username}) — ${role}`, clientIp(req));
    return admin;
  });
  return res.status(201).json(publicAdmin(created));
});

app.patch('/api/admin/admins/:id', requireAuth, requireRole('admin'), requireCsrf, (req, res) => {
  if (req.user.role !== 'owner') return res.status(403).json({ error: 'التعديل متاح للمشرف العام فقط' });
  const db = load();
  const target = db.admins.find((a) => a.id === req.params.id);
  if (!target) return res.status(404).json({ error: 'المشرف غير موجود' });
  if (typeof req.body?.active === 'boolean' && target.role === 'owner' && !req.body.active) {
    return res.status(400).json({ error: 'لا يمكن إيقاف حساب المشرف العام' });
  }
  if (typeof req.body?.password === 'string' && req.body.password) {
    const problem = passwordProblem(req.body.password);
    if (problem) return res.status(400).json({ error: problem });
  }
  const result = mutate((d) => {
    const admin = d.admins.find((a) => a.id === req.params.id);
    if (typeof req.body?.name === 'string' && str(req.body.name, 60).length >= 3) admin.name = str(req.body.name, 60);
    if (typeof req.body?.active === 'boolean') admin.active = req.body.active;
    if (typeof req.body?.password === 'string' && req.body.password) {
      Object.assign(admin, hashPassword(req.body.password));
    }
    audit(d, req.user.name, 'تعديل مشرف', admin.name, clientIp(req));
    return publicAdmin(admin);
  });
  return res.json(result);
});

app.delete('/api/admin/admins/:id', requireAuth, requireRole('admin'), requireCsrf, (req, res) => {
  if (req.user.title !== 'المشرف العام') return res.status(403).json({ error: 'الحذف متاح للمشرف العام فقط' });
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'لا يمكنك حذف حسابك الحالي' });
  const db = load();
  const target = db.admins.find((a) => a.id === req.params.id);
  if (!target) return res.status(404).json({ error: 'المشرف غير موجود' });
  if (target.role === 'owner' && db.admins.filter((a) => a.role === 'owner').length === 1) {
    return res.status(400).json({ error: 'لا يمكن حذف المشرف العام الوحيد' });
  }
  mutate((d) => {
    d.admins = d.admins.filter((a) => a.id !== req.params.id);
    audit(d, req.user.name, 'حذف مشرف', target.name, clientIp(req));
  });
  sessions.forEach((value, key) => {
    if (value.userId === req.params.id) sessions.delete(key);
  });
  return res.json({ ok: true });
});

/* ------------------------------------------------------------------ */
/* الأدمن: سجل التدقيق ومركز الأمان وCSV                               */
/* ------------------------------------------------------------------ */
app.get('/api/admin/audit', requireAuth, requireRole('admin'), (req, res) => {
  const db = load();
  res.json(db.audit.slice(0, 120));
});

app.get('/api/admin/security', requireAuth, requireRole('admin'), (req, res) => {
  const db = load();
  const now = Date.now();
  const ttl = (db.settings.sessionMinutes || 90) * 60000;
  res.json({
    settings: {
      locked: db.settings.locked,
      lockMessage: db.settings.lockMessage,
      sessionMinutes: db.settings.sessionMinutes,
      maxAttempts: db.settings.maxAttempts,
      lockMinutes: db.settings.lockMinutes,
      allowRegistration: db.settings.allowRegistration,
    },
    activeSessions: [...sessions.values()].filter((s) => now - s.lastSeen < ttl).length,
    failedToday: db.audit.filter((a) => a.action === 'محاولة دخول فاشلة' && a.at.slice(0, 10) === nowISO().slice(0, 10)).length,
    isOwner: req.user.title === 'المشرف العام',
    protections: [
      'تشفير كلمات السر بـ scrypt مع salt مستقل لكل حساب',
      'جلسات HttpOnly + SameSite=Strict مع انتهاء تلقائي',
      'حماية CSRF عبر توكن مزدوج لكل طلب كتابة',
      'تحديد معدل المحاولات وقفل الحساب مؤقتاً بعد تكرار الفشل',
      'رؤوس حماية CSP / HSTS / nosniff / منع التضمين',
      'تحقق من الصلاحيات على الخادم (مشرف / مشرف عام)',
      'سجل تدقيق لكل عملية حساسة',
    ],
  });
});

app.patch('/api/admin/security', requireAuth, requireRole('admin'), requireCsrf, (req, res) => {
  const db = load();
  if (req.body?.forceLogout) {
    sessions.forEach((value, key) => {
      if (key !== req.session.sid) sessions.delete(key);
    });
    mutate((d) => audit(d, req.user.name, 'إنهاء كل الجلسات', 'إجراء أمني', clientIp(req)));
    return res.json({ ok: true, message: 'تم إنهاء جلسات الجميع' });
  }
  if (req.user.title !== 'المشرف العام') return res.status(403).json({ error: 'تعديل الإعدادات متاح للمشرف العام فقط' });
  const result = mutate((d) => {
    if (typeof req.body?.locked === 'boolean') d.settings.locked = req.body.locked;
    if (typeof req.body?.allowRegistration === 'boolean') d.settings.allowRegistration = req.body.allowRegistration;
    if (typeof req.body?.lockMessage === 'string') d.settings.lockMessage = str(req.body.lockMessage, 160);
    if (Number.isFinite(Number(req.body?.sessionMinutes))) {
      d.settings.sessionMinutes = Math.min(480, Math.max(10, Number(req.body.sessionMinutes)));
    }
    if (Number.isFinite(Number(req.body?.maxAttempts))) {
      d.settings.maxAttempts = Math.min(20, Math.max(3, Number(req.body.maxAttempts)));
    }
    audit(d, req.user.name, 'تعديل إعدادات الأمان', JSON.stringify({
      locked: d.settings.locked,
      registration: d.settings.allowRegistration,
    }), clientIp(req));
    return d.settings;
  });
  return res.json(result);
});

app.get('/api/admin/export', requireAuth, requireRole('admin'), (req, res) => {
  const db = load();
  const type = str(req.query.type, 20);
  const rows = [['نوع التصدير', type], []];
  if (type === 'attendance') {
    rows.push(['الطالب', 'الكود', 'التاريخ', 'الطريقة', 'المجموعة']);
    db.attendance.forEach((a) => {
      const s = db.students.find((x) => x.id === a.studentId);
      rows.push([s?.name || 'محذوف', a.code, a.at, a.method, s?.group || '']);
    });
  } else if (type === 'grades') {
    rows.push(['الطالب', 'الواجب', 'الدرجة', 'النهائية', 'الحالة', 'ملاحظة المشرف']);
    db.submissions.forEach((sub) => {
      const s = db.students.find((x) => x.id === sub.studentId);
      const hw = db.homeworks.find((h) => h.id === sub.homeworkId);
      rows.push([s?.name || '', hw?.title || '', sub.score ?? '', hw?.maxScore ?? '', sub.status, sub.feedback || '']);
    });
  } else {
    rows.push(['الاسم', 'الكود', 'المجموعة', 'الموبايل', 'ولي الأمر', 'المدرسة', 'النقاط', 'عدد الحضور']);
    db.students.forEach((s) => {
      rows.push([
        s.name,
        s.code,
        s.group,
        s.phone,
        s.parentPhone,
        s.school,
        s.points,
        db.attendance.filter((a) => a.studentId === s.id).length,
      ]);
    });
  }
  const csv = `\uFEFF${rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')}`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${type || 'students'}-${nowISO().slice(0, 10)}.csv"`);
  res.send(csv);
});

/* ------------------------------------------------------------------ */
/* الملفات الثابتة                                                     */
/* ------------------------------------------------------------------ */
app.get('/healthz', (req, res) => res.json({ ok: true, at: nowISO() }));

const dist = path.join(ROOT, 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist, { index: false, maxAge: IS_PROD ? '1h' : 0 }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    return res.sendFile(path.join(dist, 'index.html'));
  });
} else {
  app.get('/', (req, res) =>
    res.status(200).send('<h1 style="font-family:sans-serif">المنصة لم تُبنَ بعد — نفّذ npm run build</h1>'),
  );
}

app.use((req, res) => res.status(404).json({ error: 'المسار غير موجود' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[error]', err.message);
  if (res.headersSent) return;
  res.status(500).json({ error: 'حدث خطأ غير متوقع في الخادم' });
});

export function start(port = PORT) {
  load();
  save();
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`[chemistry] listening on 0.0.0.0:${port}`);
  });
  return server;
}

if (process.env.NODE_ENV !== 'test') start();
