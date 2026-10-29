/* الجدول الدوري الكامل — 118 عنصراً
   صيغة مضغوطة: رمز | الاسم العربي | الاسم الإنجليزي | الكتلة | التصنيف | الحالة */
const RAW = `
H|هيدروجين|Hydrogen|1.008|n|gas
He|هيليوم|Helium|4.003|g|gas
Li|ليثيوم|Lithium|6.94|a|solid
Be|بيريليوم|Beryllium|9.012|k|solid
B|بورون|Boron|10.81|m|solid
C|كربون|Carbon|12.011|n|solid
N|نيتروجين|Nitrogen|14.007|n|gas
O|أكسجين|Oxygen|15.999|n|gas
F|فلور|Fluorine|18.998|h|gas
Ne|نيون|Neon|20.180|g|gas
Na|صوديوم|Sodium|22.990|a|solid
Mg|ماغنسيوم|Magnesium|24.305|k|solid
Al|ألومنيوم|Aluminium|26.982|p|solid
Si|سيليكون|Silicon|28.085|m|solid
P|فوسفور|Phosphorus|30.974|n|solid
S|كبريت|Sulfur|32.06|n|solid
Cl|كلور|Chlorine|35.45|h|gas
Ar|أرجون|Argon|39.948|g|gas
K|بوتاسيوم|Potassium|39.098|a|solid
Ca|كالسيوم|Calcium|40.078|k|solid
Sc|سكانديوم|Scandium|44.956|t|solid
Ti|تيتانيوم|Titanium|47.867|t|solid
V|فاناديوم|Vanadium|50.942|t|solid
Cr|كروم|Chromium|51.996|t|solid
Mn|منجنيز|Manganese|54.938|t|solid
Fe|حديد|Iron|55.845|t|solid
Co|كوبالت|Cobalt|58.933|t|solid
Ni|نيكل|Nickel|58.693|t|solid
Cu|نحاس|Copper|63.546|t|solid
Zn|زنك|Zinc|65.38|t|solid
Ga|جاليوم|Gallium|69.723|p|solid
Ge|جرمانيوم|Germanium|72.630|m|solid
As|زرنيخ|Arsenic|74.922|m|solid
Se|سيلينيوم|Selenium|78.971|n|solid
Br|بروم|Bromine|79.904|h|liquid
Kr|كريبتون|Krypton|83.798|g|gas
Rb|روبيديوم|Rubidium|85.468|a|solid
Sr|سترونشيوم|Strontium|87.62|k|solid
Y|إيتريوم|Yttrium|88.906|t|solid
Zr|زركونيوم|Zirconium|91.224|t|solid
Nb|نيوبيوم|Niobium|92.906|t|solid
Mo|موليبدينوم|Molybdenum|95.95|t|solid
Tc|تكنيتيوم|Technetium|98|t|solid
Ru|روثينيوم|Ruthenium|101.07|t|solid
Rh|روديوم|Rhodium|102.91|t|solid
Pd|بلاديوم|Palladium|106.42|t|solid
Ag|فضة|Silver|107.87|t|solid
Cd|كادميوم|Cadmium|112.41|t|solid
In|إنديوم|Indium|114.82|p|solid
Sn|قصدير|Tin|118.71|p|solid
Sb|أنتيمون|Antimony|121.76|m|solid
Te|تيلوريوم|Tellurium|127.60|m|solid
I|يود|Iodine|126.90|h|solid
Xe|زينون|Xenon|131.29|g|gas
Cs|سيزيوم|Caesium|132.91|a|solid
Ba|باريوم|Barium|137.33|k|solid
La|لانثانم|Lanthanum|138.91|l|solid
Ce|سيريوم|Cerium|140.12|l|solid
Pr|براسيوديميوم|Praseodymium|140.91|l|solid
Nd|نيوديميوم|Neodymium|144.24|l|solid
Pm|بروميثيوم|Promethium|145|l|solid
Sm|ساماريوم|Samarium|150.36|l|solid
Eu|يوروبيوم|Europium|151.96|l|solid
Gd|جادولينيوم|Gadolinium|157.25|l|solid
Tb|تربيوم|Terbium|158.93|l|solid
Dy|ديسبروسيوم|Dysprosium|162.50|l|solid
Ho|هولميوم|Holmium|164.93|l|solid
Er|إربيوم|Erbium|167.26|l|solid
Tm|ثوليوم|Thulium|168.93|l|solid
Yb|إتربيوم|Ytterbium|173.05|l|solid
Lu|لوتيشيوم|Lutetium|174.97|l|solid
Hf|هافنيوم|Hafnium|178.49|t|solid
Ta|تانتالم|Tantalum|180.95|t|solid
W|تنجستن|Tungsten|183.84|t|solid
Re|رينيوم|Rhenium|186.21|t|solid
Os|أزميوم|Osmium|190.23|t|solid
Ir|إيريديوم|Iridium|192.22|t|solid
Pt|بلاتين|Platinum|195.08|t|solid
Au|ذهب|Gold|196.97|t|solid
Hg|زئبق|Mercury|200.59|t|liquid
Tl|ثاليوم|Thallium|204.38|p|solid
Pb|رصاص|Lead|207.2|p|solid
Bi|بزموت|Bismuth|208.98|p|solid
Po|بولونيوم|Polonium|209|p|solid
At|أستاتين|Astatine|210|h|solid
Rn|رادون|Radon|222|g|gas
Fr|فرانسيوم|Francium|223|a|solid
Ra|راديوم|Radium|226|k|solid
Ac|أكتينيوم|Actinium|227|c|solid
Th|ثوريوم|Thorium|232.04|c|solid
Pa|بروتكتينيوم|Protactinium|231.04|c|solid
U|يورانيوم|Uranium|238.03|c|solid
Np|نبتونيوم|Neptunium|237|c|solid
Pu|بلوتونيوم|Plutonium|244|c|solid
Am|أمريسيوم|Americium|243|c|solid
Cm|كوريوم|Curium|247|c|solid
Bk|بركيليوم|Berkelium|247|c|solid
Cf|كاليفورنيوم|Californium|251|c|solid
Es|أينشتاينيوم|Einsteinium|252|c|solid
Fm|فرميوم|Fermium|257|c|solid
Md|مندليفيوم|Mendelevium|258|c|solid
No|نوبيليوم|Nobelium|259|c|solid
Lr|لورنسيوم|Lawrencium|266|c|solid
Rf|رذرفورديوم|Rutherfordium|267|t|solid
Db|دوبنيوم|Dubnium|268|t|solid
Sg|سيبورجيوم|Seaborgium|269|t|solid
Bh|بوريوم|Bohrium|270|t|solid
Hs|هاسيوم|Hassium|269|t|solid
Mt|مايتنريوم|Meitnerium|278|t|solid
Ds|دارمشتاتيوم|Darmstadtium|281|t|solid
Rg|رونتجينيوم|Roentgenium|282|t|solid
Cn|كوبرنيسيوم|Copernicium|285|t|solid
Nh|نيهونيوم|Nihonium|286|p|solid
Fl|فليروفيوم|Flerovium|289|p|solid
Mc|موسكوفيوم|Moscovium|290|p|solid
Lv|ليفرموريوم|Livermorium|293|p|solid
Ts|تينيسين|Tennessine|294|h|solid
Og|أوجانيسون|Oganesson|294|g|solid
`;

export const CATEGORIES = {
  a: { name: 'فلزات قلوية', color: '#ff7a59' },
  k: { name: 'فلزات قلوية أرضية', color: '#ffb347' },
  t: { name: 'فلزات انتقالية', color: '#4ea8ff' },
  p: { name: 'فلزات بعد انتقالية', color: '#7bdff2' },
  m: { name: 'أشباه فلزات', color: '#a3e635' },
  n: { name: 'لافلزات', color: '#22e3ff' },
  h: { name: 'هالوجينات', color: '#c084fc' },
  g: { name: 'غازات نبيلة', color: '#f472b6' },
  l: { name: 'لانثانيدات', color: '#facc15' },
  c: { name: 'أكتينيدات', color: '#fb7185' },
};

const PHASE_AR = { gas: 'غاز', liquid: 'سائل', solid: 'صلب' };

/** موضع العنصر في شبكة الجدول: [الصف، العمود] */
function layout(z) {
  if (z === 1) return [1, 1];
  if (z === 2) return [1, 18];
  if (z <= 10) return [2, [1, 2, 13, 14, 15, 16, 17, 18][z - 3]];
  if (z <= 18) return [3, [1, 2, 13, 14, 15, 16, 17, 18][z - 11]];
  if (z <= 36) return [4, z - 18];
  if (z <= 54) return [5, z - 36];
  if (z <= 56) return [6, z - 54];
  if (z <= 71) return [9, z - 57 + 3];
  if (z <= 86) return [6, z - 71 + 3];
  if (z <= 88) return [7, z - 86];
  if (z <= 103) return [10, z - 89 + 3];
  return [7, z - 103 + 3];
}

/** التوزيع الإلكتروني المختصر */
function electronConfig(z) {
  const order = [['1s', 2], ['2s', 2], ['2p', 6], ['3s', 2], ['3p', 6], ['4s', 2], ['3d', 10], ['4p', 6], ['5s', 2], ['4d', 10], ['5p', 6], ['6s', 2], ['4f', 14], ['5d', 10], ['6p', 6], ['7s', 2], ['5f', 14], ['6d', 10], ['7p', 6]];
  let left = z;
  const parts = [];
  for (const [label, cap] of order) {
    if (left <= 0) break;
    const take = Math.min(cap, left);
    parts.push(`${label}${take}`);
    left -= take;
  }
  return parts.join(' ');
}

export const ELEMENTS = RAW.trim()
  .split('\n')
  .map((line, index) => {
    const [symbol, ar, en, mass, cat, phase] = line.split('|');
    const z = index + 1;
    const [row, col] = layout(z);
    return {
      z,
      symbol,
      ar,
      en,
      mass: Number(mass),
      cat,
      catName: CATEGORIES[cat].name,
      color: CATEGORIES[cat].color,
      phase: PHASE_AR[phase],
      phaseKey: phase,
      row,
      col,
      config: electronConfig(z),
      neutrons: Math.max(0, Math.round(Number(mass)) - z),
    };
  });

const FACTS = {
  H: 'أخف عنصر في الكون وأكثرها وفرة، ويشكل ٧٥٪ من كتلة العناصر في النجوم.',
  He: 'الغاز النبيل الوحيد الذي لا يمكن تجميده عند الضغط الجوي العادي.',
  Li: 'يُستخدم في بطاريات الليثيوم أيون لأنه أخف الفلزات وأكثرها كهروسلبية.',
  C: 'يتحول إلى ألماس عند ضغوط عالية، ويشكل أساس كل الكيمياء العضوية.',
  N: 'يشكل ٧٨٪ من الغلاف الجوي، ورابطته الثلاثية من أقوى الروابط الكيميائية.',
  O: 'يساعد على الاحتراق ولا يشتعل، ويشكل الأوزون في الطبقة العليا.',
  Na: 'يتفاعل بعنف مع الماء منتجاً هيدروجين ولهباً أصفر، ويُخزن تحت الكيروسين.',
  Mg: 'يحترق بضوء أبيض ساطع ويُستخدم في ألعاب الإضاءة والألعاب النارية.',
  Al: 'أكثر الفلزات وفرة في القشرة الأرضية، وتتكون عليه طبقة أكسيد واقية.',
  Si: 'قلب صناعة أشباه الموصلات والشرائح الإلكترونية.',
  P: 'يشتق اسمه من كلمة «ضوء» لأنه يضيء في الظلام عند التعرض للأكسجين.',
  S: 'حمض الكبريتيك المشتق منه أكثر المواد الكيميائية إنتاجاً في العالم.',
  Cl: 'مطهر قوي، يُستخدم في تعقيم مياه الشرب وحمامات السباحة.',
  K: 'ضروري لانقباض العضلات ونقل السيالات العصبية، ولهب بنفسجي عند حرقه.',
  Ca: 'يشكل ١.٥٪ من وزن الإنسان، وأساس العظام والأصداف والرخام.',
  Fe: 'أكثر الفلزات استخداماً في الهندسة، وسبب لون الدم الأحمر (الهيموجلوبين).',
  Cu: 'من أفضل موصلات الكهرباء، ويتأكسد ليعطي اللون الأخضر المميز لتماثيل النحاس.',
  Zn: 'يحمي الحديد من الصدأ بعملية الجلفنة.',
  Ag: 'أفضل موصل للكهرباء والحرارة، ويتفاعل مع الكبريت فيسود لونه.',
  Au: 'لا يتأكسد في الهواء أو الماء، ولهذا يبقى لامعاً لآلاف السنين.',
  Hg: 'الفلز الوحيد السائل في درجة حرارة الغرفة، وأبخرةه سامة جداً.',
  Pb: 'يحمي من الأشعة السينية، لكنه سام ويؤثر على الجهاز العصبي.',
  I: 'يُستخرج من الطحالب البحرية، ونقصه يسبب تضخم الغدة الدرقية.',
  U: 'وقود المفاعلات النووية، وينتج طاقة تعادل ملايين أضعاف الفحم.',
  Ne: 'يضيء بلون أحمر برتقالي في لافتات الإعلانات.',
  Ar: 'يُستخدم كجو خامل في اللحام لحماية المعادن من الأكسدة.',
  Np: 'أول عنصر ما بعد اليورانيوم يتم تصنيعه، سُمي على اسم كوكب نبتون.',
  Fr: 'أكثر الفلزات نشاطاً كيميائياً ونصف عمره ٢٢ دقيقة فقط.',
  Ra: 'اكتشفته ماري كوري، ويُستخدم قديماً في الدهانات المضيئة (وكان خطيراً).',
  Ti: 'فلز خفيف ومقاوم للتآكل، يُستخدم في الطائرات والأطراف الصناعية.',
  Cr: 'يعطي الصلب المقاوم للصدأ لمعانه، ومركباته ملونة بألوان زاهية.',
  Mn: 'يُستخدم في صناعة الصلب وفي البطاريات الجافة.',
  Ni: 'يُستخدم في السبائك المقاومة للحرارة وفي عملات المعدن.',
  Br: 'أحد عنصرين سائلين فقط في الجدول، وله رائحة نفاذة مزعجة.',
  Xe: 'يُستخدم في مصابيح السيارات القوية وفي أجهزة التصوير.',
  Sn: 'يُستخدم في طلاء العلب المعدنية لحماية الغذاء من الصدأ.',
  Pt: 'عامل حفاز قوي في السيارات ومحولات العادم، وأغلى من الذهب أحياناً.',
  W: 'أعلى نقطة انصهار بين الفلزات (٣٤٢٢°م) ويُستخدم في فتيل اللمبات.',
  Bi: 'بلوراته تتخذ أشكالاً حلزونية جميلة، ويُستخدم في الأدوية.',
  Ga: 'ينصهر عند ٢٩.٧°م — أي في راحة اليد — ويُستخدم في الثنائيات الباعثة للضوء.',
};

export const elementFact = (el) =>
  FACTS[el.symbol] ||
  `${el.ar} عنصر من ${el.catName}، يقع في الدورة ${el.row > 7 ? (el.row === 9 ? 6 : 7) : el.row} من الجدول الدوري، عدده الذري ${el.z}.`;
