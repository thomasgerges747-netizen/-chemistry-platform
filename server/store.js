import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const KEYLEN = 64;

export const uid = (prefix = '') => prefix + crypto.randomBytes(9).toString('base64url');
export const nowISO = () => new Date().toISOString();

/* ------------------------------------------------------------------ */
/* كلمات المرور: scrypt + salt منفصل لكل حساب + مقارنة آمنة زمنياً      */
/* ------------------------------------------------------------------ */
export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, KEYLEN).toString('hex');
  return { salt, hash, algo: 'scrypt' };
}

export function verifyPassword(password, salt, hash) {
  try {
    const test = crypto.scryptSync(String(password), salt, KEYLEN);
    const known = Buffer.from(String(hash), 'hex');
    return known.length === test.length && crypto.timingSafeEqual(known, test);
  } catch {
    return false;
  }
}

export function passwordProblem(pw) {
  const value = String(pw || '');
  if (value.length < 8) return 'كلمة السر يجب أن تكون 8 أحرف على الأقل';
  if (!/[A-Za-z\u0600-\u06FF]/.test(value)) return 'كلمة السر يجب أن تحتوي على حرف واحد على الأقل';
  if (!/[0-9]/.test(value)) return 'كلمة السر يجب أن تحتوي على رقم واحد على الأقل';
  return null;
}

/* ------------------------------------------------------------------ */
/* توليد أكواد الطلاب                                                  */
/* ------------------------------------------------------------------ */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function randomBlock(n = 4) {
  let out = '';
  for (let i = 0; i < n; i += 1) out += ALPHABET[crypto.randomInt(0, ALPHABET.length)];
  return out;
}

export function makeStudentCode(db, group = '') {
  const year = new Date().getFullYear().toString().slice(-2);
  const letter = (db.groups.find((g) => g.name === group)?.tag) || 'G';
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const code = `NG${year}-${letter}${randomBlock(4)}`;
    if (!db.students.some((s) => s.code === code)) return code;
  }
  return `NG${year}-${randomBlock(8)}`;
}

/* ------------------------------------------------------------------ */
/* بيانات البداية                                                      */
/* ------------------------------------------------------------------ */
const GROUPS = [
  { id: 'grp-sat', name: 'مجموعة السبت ٤ عصراً', tag: 'S', color: '#22e3ff' },
  { id: 'grp-sun', name: 'مجموعة الأحد ٦ مساءً', tag: 'N', color: '#8b5cf6' },
  { id: 'grp-mon', name: 'مجموعة الاثنين ٧ مساءً', tag: 'M', color: '#f472b6' },
  { id: 'grp-online', name: 'مجموعة الأونلاين', tag: 'O', color: '#34d399' },
];

const SEED_STUDENTS = [
  ['أحمد محمد سيد', 'grp-sat', 'S', '01011234567', 'مدرسة المتفوقين', 148],
  ['مريم خالد عبد الله', 'grp-sat', 'S', '01122334455', 'مدرسة النيل', 172],
  ['يوسف إبراهيم حسن', 'grp-sun', 'N', '01233445566', 'مدرسة الأورمان', 96],
  ['سلمى طارق فؤاد', 'grp-sun', 'N', '01098765432', 'مدرسة الحرية', 205],
  ['عمر مصطفى كامل', 'grp-mon', 'M', '01555667788', 'مدرسة العروبة', 63],
  ['نور الدين أشرف', 'grp-online', 'O', '01066778899', 'مدرسة المنصورة', 118],
  ['هاجر سمير رزق', 'grp-mon', 'M', '01188990011', 'مدرسة السلام', 141],
  ['زياد حسن عبد الرحمن', 'grp-online', 'O', '01277889900', 'مدرسة الجيزة', 87],
];

function seed() {
  const db = {
    version: 3,
    createdAt: nowISO(),
    settings: {
      platformName: 'منصة الكيمياء',
      teacher: 'د. محمود النجار',
      locked: false,
      lockMessage: '',
      sessionMinutes: 90,
      maxAttempts: 6,
      lockMinutes: 10,
      allowRegistration: true,
    },
    groups: GROUPS,
    admins: [],
    students: [],
    attendance: [],
    homeworks: [],
    submissions: [],
    announcements: [],
    quizResults: [],
    bank: [],
    audit: [],
    loginAttempts: [],
  };

  const owner = hashPassword('Admin@1234');
  db.admins.push({
    id: 'adm-owner',
    username: 'admin',
    name: 'أ. محمود النجار',
    role: 'owner',
    title: 'المشرف العام',
    email: 'admin@chemistry.local',
    ...owner,
    active: true,
    createdAt: nowISO(),
    lastLogin: null,
  });

  const demo = hashPassword('Student@123');
  SEED_STUDENTS.forEach(([name, groupId, tag, phone, school, points], i) => {
    const group = GROUPS.find((g) => g.id === groupId);
    db.students.push({
      id: uid('stu-'),
      code: `NG26-${tag}${randomBlock(4)}`,
      name,
      phone,
      parentPhone: `0100000${String(1000 + i).slice(-4)}`,
      school,
      governorate: ['القاهرة', 'الجيزة', 'الدقهلية', 'أسيوط'][i % 4],
      grade: 'الثالث الثانوي',
      group: group.name,
      groupId,
      points,
      active: true,
      createdAt: new Date(Date.now() - (30 - i) * 864e5).toISOString(),
      ...demo,
      lastLogin: null,
    });
  });

  // حضور تاريخي
  for (let day = 0; day < 12; day += 1) {
    const date = new Date(Date.now() - day * 864e5);
    db.students.forEach((s, idx) => {
      if ((idx + day) % 3 === 0) {
        db.attendance.push({
          id: uid('att-'),
          studentId: s.id,
          code: s.code,
          at: new Date(date.setHours(16, (idx * 7) % 60, 0, 0)).toISOString(),
          method: idx % 4 === 0 ? 'camera' : 'manual',
          by: 'adm-owner',
          session: 'حصة مراجعة',
        });
      }
    });
  }

  db.homeworks.push(
    {
      id: uid('hw-'),
      title: 'واجب الاتزان الكيميائي',
      body: 'اشرح قاعدة لوشاتيليه مع تطبيق على تفاعل تكوين الأمونيا، ثم حل مسائل ثابت الاتزان Kc.',
      group: 'الكل',
      maxScore: 20,
      dueDate: new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10),
      by: 'adm-owner',
      createdAt: new Date(Date.now() - 2 * 864e5).toISOString(),
    },
    {
      id: uid('hw-'),
      title: 'تقرير عن الخلايا الجلفانية',
      body: 'ارسم خلية دانيال ووضح نصف التفاعل عند الأنود والكاثود مع اتجاه حركة الإلكترونات.',
      group: 'الكل',
      maxScore: 15,
      dueDate: new Date(Date.now() + 6 * 864e5).toISOString().slice(0, 10),
      by: 'adm-owner',
      createdAt: new Date(Date.now() - 1 * 864e5).toISOString(),
    },
    {
      id: uid('hw-'),
      title: 'أسئلة الكيمياء العضوية',
      body: 'قارن بين الألكانات والألكينات من حيث الصيغة العامة ونوع الرابطة والتفاعلات المميزة.',
      group: 'مجموعة السبت ٤ عصراً',
      maxScore: 10,
      dueDate: new Date(Date.now() + 9 * 864e5).toISOString().slice(0, 10),
      by: 'adm-owner',
      createdAt: nowISO(),
    },
  );

  const [hw1, hw2] = db.homeworks;
  db.submissions.push(
    {
      id: uid('sub-'),
      homeworkId: hw1.id,
      studentId: db.students[0].id,
      text: 'قاعدة لوشاتيليه: عند إحداث تغيير في نظام متزن يقاوم النظام هذا التغيير...',
      at: new Date(Date.now() - 36e5).toISOString(),
      score: 17,
      feedback: 'إجابة ممتازة، ينقصك رسم منحنى الاتزان.',
      status: 'graded',
      gradedBy: 'adm-owner',
      gradedAt: new Date(Date.now() - 18e5).toISOString(),
    },
    {
      id: uid('sub-'),
      homeworkId: hw1.id,
      studentId: db.students[1].id,
      text: 'زيادة الضغط تزيح الاتزان ناحية الحجم الأقل...',
      at: new Date(Date.now() - 2 * 36e5).toISOString(),
      score: null,
      feedback: '',
      status: 'pending',
      gradedBy: null,
      gradedAt: null,
    },
    {
      id: uid('sub-'),
      homeworkId: hw2.id,
      studentId: db.students[3].id,
      text: 'خلية دانيال: Zn → Zn2+ + 2e عند الأنود، Cu2+ + 2e → Cu عند الكاثود.',
      at: new Date(Date.now() - 5 * 36e5).toISOString(),
      score: null,
      feedback: '',
      status: 'pending',
      gradedBy: null,
      gradedAt: null,
    },
  );

  db.announcements.push(
    {
      id: uid('ann-'),
      title: 'بث مراجعة ليلة الامتحان',
      body: 'مراجعة نهائية على الكيمياء الكهربية يوم الخميس ٨ مساءً — الحضور عبر رابط المجموعة.',
      at: new Date(Date.now() - 4 * 36e5).toISOString(),
      by: 'أ. محمود النجار',
      pinned: true,
    },
    {
      id: uid('ann-'),
      title: 'تحديث مواعيد المجموعات',
      body: 'مجموعة السبت أصبحت ٤ عصراً بدلاً من ٣ عصراً بداية من الأسبوع القادم.',
      at: new Date(Date.now() - 30 * 36e5).toISOString(),
      by: 'أ. محمود النجار',
      pinned: false,
    },
  );

  db.bank.push(
    { id: uid('q-'), q: 'العنصر الذي عدده الذري ١٧ ينتمي إلى...', options: ['الفلزات القلوية', 'الهالوجينات', 'الغازات النبيلة', 'الفلزات الانتقالية'], answer: 1, chapter: 'الجدول الدوري' },
    { id: uid('q-'), q: 'وحدة قياس ثابت الاتزان Kc هي...', options: ['مول/لتر', 'لا وحدة له', 'لتر/مول', 'جول'], answer: 1, chapter: 'الاتزان الكيميائي' },
    { id: uid('q-'), q: 'في الخلية الجلفانية تحدث الأكسدة عند...', options: ['الكاثود', 'الأنود', 'الجسر الملحي', 'القطب القياسي'], answer: 1, chapter: 'الكيمياء الكهربية' },
    { id: uid('q-'), q: 'الصيغة العامة للألكينات هي...', options: ['CnH2n+2', 'CnH2n', 'CnH2n-2', 'CnH2n+1'], answer: 1, chapter: 'الكيمياء العضوية' },
    { id: uid('q-'), q: 'المحلول الذي pH له = ٣ يكون...', options: ['متعادل', 'قلوي', 'حمضي', 'ملحي'], answer: 2, chapter: 'الأحماض والقواعد' },
    { id: uid('q-'), q: 'عدد تأكسد الكبريت في H2SO4 يساوي...', options: ['+4', '+6', '-2', '0'], answer: 1, chapter: 'الأكسدة والاختزال' },
  );

  db.audit.push({ id: uid('log-'), at: nowISO(), actor: 'system', action: 'تهيئة المنصة', detail: 'إنشاء قاعدة البيانات الأولية', ip: '-' });
  return db;
}

/* ------------------------------------------------------------------ */
/* قراءة/كتابة                                                         */
/* ------------------------------------------------------------------ */
let cache = null;

export function load() {
  if (cache) return cache;
  try {
    if (fs.existsSync(DB_FILE)) {
      cache = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      return cache;
    }
  } catch (error) {
    console.error('[store] تعذر قراءة قاعدة البيانات، سيتم إعادة التهيئة:', error.message);
  }
  cache = seed();
  save();
  return cache;
}

export function save() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${DB_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(cache, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

export function mutate(fn) {
  const db = load();
  const result = fn(db);
  save();
  return result;
}

export function audit(db, actor, action, detail, ip) {
  db.audit.unshift({ id: uid('log-'), at: nowISO(), actor, action, detail, ip: ip || '-' });
  if (db.audit.length > 500) db.audit.length = 500;
}

export const publicStudent = (s) => ({
  id: s.id,
  code: s.code,
  name: s.name,
  phone: s.phone,
  parentPhone: s.parentPhone,
  school: s.school,
  governorate: s.governorate,
  grade: s.grade,
  group: s.group,
  groupId: s.groupId,
  points: s.points,
  active: s.active,
  createdAt: s.createdAt,
  lastLogin: s.lastLogin,
});

export const publicAdmin = (a) => ({
  id: a.id,
  username: a.username,
  name: a.name,
  role: a.role,
  title: a.title,
  email: a.email,
  active: a.active,
  createdAt: a.createdAt,
  lastLogin: a.lastLogin,
});
