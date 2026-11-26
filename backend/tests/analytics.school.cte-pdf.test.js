/**
 * Panel de Dirección: casos límite del próximo CTE (fin de mes, bisiestos, cambio de año,
 * medianoche en Ciudad de México vs UTC con `now` inyectado), prioridades concisas
 * (máximo 3, orden, sin términos punitivos ni nombres de docentes) y PDF del panel
 * (solo director, Carta, B/N, páginas coherentes y sin nombres ni folios de alumnos).
 * Datos ficticios; SQLite :memory:.
 */
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { after, before, describe, test } from 'node:test';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';
import { openDatabase } from '../src/config/database.js';
import { runMigrations } from '../src/db/migrate.js';
import { runSeed } from '../src/db/seed.js';
import { createAnalyticsService } from '../src/modules/analytics/analytics.service.js';
import { createAnalyticsRepository } from '../src/modules/analytics/analytics.repository.js';
import { createGroupsRepository } from '../src/modules/groups/groups.repository.js';
import { createCurriculumRepository } from '../src/modules/curriculum/curriculum.repository.js';
import { renderSchoolPdf } from '../src/modules/analytics/analytics.export.js';
import {
  CTE_SESSIONS, MAX_PRIORITIES, buildSchoolPriorities, formatCteDate, lastFridayOfMonth, nextCteSession,
} from '../src/modules/analytics/analytics.school.domain.js';
import { configWith, silentLogger, startServer } from './helpers.js';

const PUNITIVE = /reprobad|malo|mala|deficiente|\bbajo\b|baja|peor|fracas|culpa|ranking|lugar/i;

// ───────────────────────── utilidades PDF ─────────────────────────

/** Texto de un PDF de PDFKit: descomprime los streams y une las cadenas hex de cada TJ. */
function pdfText(buffer) {
  const raw = buffer.toString('latin1');
  const streams = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  const lines = [];
  let m;
  while ((m = streams.exec(raw))) {
    let content;
    try { content = zlib.inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1'); } catch { continue; }
    for (const tj of content.matchAll(/\[([^\]]*)\]\s*TJ/g)) {
      lines.push([...tj[1].matchAll(/<([0-9a-fA-F]*)>/g)].map((h) => Buffer.from(h[1], 'hex').toString('latin1')).join(''));
    }
  }
  return lines.join('\n');
}
const pageCount = (buffer) => (buffer.toString('latin1').match(/\/Type \/Page\b(?!s)/g) ?? []).length;
const mediaBoxes = (buffer) => buffer.toString('latin1').match(/\/MediaBox \[[^\]]*\]/g) ?? [];
/** Todos los operadores de color de relleno/trazo del contenido. */
function colorOps(buffer) {
  const raw = buffer.toString('latin1');
  const ops = [];
  for (const m of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    let content;
    try { content = zlib.inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1'); } catch { continue; }
    for (const op of content.matchAll(/((?:[\d.]+\s+){1,4})(scn|SCN|rg|RG|g|G|k|K)\b/g)) ops.push(op[0].trim());
  }
  return ops;
}

// ───────────────────────── Consejo Técnico Escolar ─────────────────────────

describe('nextCteSession · casos límite', () => {
  test('fin de mes: el 31 de octubre apunta al 27 de noviembre (27 días)', () => {
    const next = nextCteSession('2026-10-31', '2026-2027');
    assert.equal(next.date, '2026-11-27');
    assert.equal(next.daysUntil, 27);
    assert.equal(next.source, 'calendar');
  });

  test('cada fecha oficial es el propio día (daysUntil 0) y el día anterior da 1', () => {
    for (const iso of CTE_SESSIONS['2026-2027']) {
      assert.equal(nextCteSession(iso, '2026-2027').daysUntil, 0, iso);
      const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - 1);
      const prev = d.toISOString().slice(0, 10);
      const next = nextCteSession(prev, '2026-2027');
      assert.equal(next.date, iso, prev);
      assert.equal(next.daysUntil, 1, prev);
    }
  });

  test('cambio de año: 31 de diciembre → 29 de enero (29 días), 1 de enero → 28 días', () => {
    assert.deepEqual(nextCteSession('2026-12-31', '2026-2027'), { date: '2027-01-29', label: 'viernes 29 de enero de 2027',
      month: 'enero 2027', daysUntil: 29, source: 'calendar' });
    assert.equal(nextCteSession('2027-01-01', '2026-2027').daysUntil, 28);
  });

  test('día después de la última sesión oficial → regla, salta julio y agosto', () => {
    const next = nextCteSession('2027-06-26', '2026-2027');
    assert.equal(next.source, 'rule');
    assert.equal(next.date, '2027-09-24');
    assert.equal(next.daysUntil, 90);
  });

  test('bisiesto: último viernes de febrero 2036 es el 29; 2028 es el 25 (29 es martes)', () => {
    assert.equal(lastFridayOfMonth(2036, 1), '2036-02-29');
    assert.equal(lastFridayOfMonth(2028, 1), '2028-02-25');
    assert.equal(lastFridayOfMonth(2027, 1), '2027-02-26');
    const leap = nextCteSession('2036-02-01', '2035-2036');
    assert.equal(leap.date, '2036-02-29');
    assert.equal(leap.daysUntil, 28);
    assert.equal(leap.source, 'rule');
  });

  test('daysUntil cuenta el 29 de febrero: 26/02/2028 → 31/03/2028 son 34 días', () => {
    const next = nextCteSession('2028-02-26', '2027-2028');
    assert.equal(next.date, '2028-03-31');
    assert.equal(next.daysUntil, 34);
  });

  test('último viernes = último día del mes (30/04/2027, 31/03/2028, 31/12/2027)', () => {
    assert.equal(lastFridayOfMonth(2027, 3), '2027-04-30');
    assert.equal(lastFridayOfMonth(2028, 2), '2028-03-31');
    assert.equal(lastFridayOfMonth(2027, 11), '2027-12-31');
    assert.equal(nextCteSession('2028-03-31', '2027-2028').daysUntil, 0);
  });

  test('la regla nunca cae en diciembre, julio ni agosto y siempre es viernes', () => {
    const start = Date.UTC(2027, 6, 1);
    for (let i = 0; i < 800; i += 3) {
      const iso = new Date(start + i * 86400000).toISOString().slice(0, 10);
      const next = nextCteSession(iso, '2099-2100');
      const date = new Date(`${next.date}T00:00:00Z`);
      assert.equal(date.getUTCDay(), 5, `${iso} → ${next.date}`);
      assert.ok(![6, 7, 11].includes(date.getUTCMonth()), `${iso} → ${next.date}`);
      assert.ok(next.daysUntil >= 0 && next.daysUntil <= 125, `${iso} → ${next.daysUntil}`);
      assert.equal(next.date, lastFridayOfMonth(date.getUTCFullYear(), date.getUTCMonth()));
    }
  });

  test('formatCteDate en español sin cero a la izquierda', () => {
    assert.equal(formatCteDate('2027-01-01'), 'viernes 1 de enero de 2027');
    assert.equal(formatCteDate('2036-02-29'), 'viernes 29 de febrero de 2036');
  });
});

describe('getSchool · CTE con la fecha de Ciudad de México (`now` inyectado)', () => {
  let db;
  let auth;
  const serviceAt = (iso) => createAnalyticsService({
    repository: createAnalyticsRepository(db), groupsRepository: createGroupsRepository(db),
    curriculumRepository: createCurriculumRepository(db), now: () => new Date(iso),
  });

  before(() => {
    db = openDatabase(':memory:');
    runMigrations(db);
    runSeed(db);
    const director = db.prepare("SELECT id, school_id FROM users WHERE role = 'director'").get();
    auth = { sub: director.id, userId: director.id, role: 'director', schoolId: director.school_id };
  });
  after(() => db.close());

  test('23:59 del 27/11 en CDMX (05:59Z del 28) sigue siendo "hoy"', () => {
    const { cte } = serviceAt('2026-11-28T05:59:59Z').getSchool(auth).data;
    assert.equal(cte.date, '2026-11-27');
    assert.equal(cte.daysUntil, 0);
  });

  test('00:00 del 28/11 en CDMX (06:00Z) ya pasa a la sesión de enero', () => {
    const { cte } = serviceAt('2026-11-28T06:00:00Z').getSchool(auth).data;
    assert.equal(cte.date, '2027-01-29');
    assert.equal(cte.daysUntil, 62);
  });

  test('en UTC ya es 27/11 pero en CDMX aún es 26/11: falta 1 día', () => {
    const { cte } = serviceAt('2026-11-27T03:00:00Z').getSchool(auth).data;
    assert.equal(cte.date, '2026-11-27');
    assert.equal(cte.daysUntil, 1);
  });

  test('cambio de año en CDMX: 31/12 22:00 local (01/01 04:00Z) cuenta desde el 31', () => {
    const { cte } = serviceAt('2027-01-01T04:00:00Z').getSchool(auth).data;
    assert.equal(cte.date, '2027-01-29');
    assert.equal(cte.daysUntil, 29);
  });
});

// ───────────────────────── Prioridades del mes ─────────────────────────

const g = (id, grade, section, over = {}) => ({
  id, grade, section, name: `${grade}.º ${section}`, schoolYear: '2026-2027', teacherName: `Mtra. Docente${id} Ficticia`,
  studentCount: 30, evaluatedStudentCount: 30, evidencePercentage: 100, needsSupportCount: 0, needsSupportPercentage: 0,
  coveragePercentage: 60, skills: [{ code: 'fractions', average: 40 }], ...over,
});
const SKILLS = [
  { code: 'fractions', name: 'Fracciones', average: 40, label: 'En proceso', grades: '3.º a 6.º' },
  { code: 'reading_comprehension', name: 'Comprensión lectora', average: 70, label: 'Logrado', grades: '1.º a 6.º' },
];

describe('buildSchoolPriorities · concisión y orden', () => {
  test('nunca más de MAX_PRIORITIES aunque apliquen los 4 tipos', () => {
    const groups = [
      g(1, 1, 'A', { evaluatedStudentCount: 2, evidencePercentage: 6.67, coveragePercentage: 0 }),
      g(2, 2, 'A', { needsSupportCount: 20, needsSupportPercentage: 66.67, coveragePercentage: 10 }),
    ];
    const p = buildSchoolPriorities(groups, SKILLS);
    assert.equal(p.length, MAX_PRIORITIES);
    assert.deepEqual(p.map((x) => x.type), ['evidence', 'skill', 'group_support']);
  });

  test('sin diagnóstico pendiente, el temario entra como tercera prioridad', () => {
    const groups = [g(1, 1, 'A', { coveragePercentage: 10 }), g(2, 2, 'A', { needsSupportCount: 20, needsSupportPercentage: 66.67 })];
    assert.deepEqual(buildSchoolPriorities(groups, SKILLS).map((x) => x.type), ['skill', 'group_support', 'coverage']);
  });

  test('group_support es un solo elemento con los grupos en orden de grado (no ranking por %)', () => {
    const groups = [
      g(5, 6, 'B', { needsSupportPercentage: 90 }), g(3, 2, 'B', { needsSupportPercentage: 55 }),
      g(4, 2, 'A', { needsSupportPercentage: 50 }), g(6, 4, 'A', { needsSupportPercentage: 49.99 }),
    ];
    const p = buildSchoolPriorities(groups, SKILLS).filter((x) => x.type === 'group_support');
    assert.equal(p.length, 1);
    assert.deepEqual(p[0].groupIds, [4, 3, 5]);
    assert.equal(p[0].title, 'Acompañar a 2.º A, 2.º B y 6.º B');
  });

  test('sin habilidades evaluadas no inventa prioridad de habilidad', () => {
    const p = buildSchoolPriorities([g(1, 1, 'A', { evaluatedStudentCount: 0, evidencePercentage: 0, skills: [] })],
      SKILLS.map((s) => ({ ...s, average: null })));
    assert.deepEqual(p.map((x) => x.type), ['evidence']);
  });

  test('textos sin términos punitivos ni nombres de docentes', () => {
    const groups = Array.from({ length: 6 }, (_, i) => g(i + 1, i + 1, 'A', {
      evaluatedStudentCount: i % 2 ? 30 : 5, evidencePercentage: i % 2 ? 100 : 16.67,
      needsSupportPercentage: 60, coveragePercentage: 5,
    }));
    for (const p of buildSchoolPriorities(groups, SKILLS)) {
      const text = `${p.title} ${p.detail} ${p.action}`;
      assert.doesNotMatch(text, PUNITIVE, text);
      assert.doesNotMatch(text, /Ficticia|Docente\d|Mtra\./, text);
      assert.ok(`${p.detail} ${p.action}`.length <= 140, text);
    }
  });

  test('el título sigue siendo corto (≤ 60) con 12 grupos sin diagnóstico al inicio del ciclo', () => {
    const groups = Array.from({ length: 12 }, (_, i) => g(i + 1, Math.floor(i / 2) + 1, i % 2 ? 'B' : 'A', {
      evaluatedStudentCount: 0, evidencePercentage: 0, needsSupportPercentage: 0,
    }));
    const p = buildSchoolPriorities(groups, SKILLS);
    for (const x of p) assert.ok(x.title.length <= 60, `${x.title.length}: ${x.title}`);
    assert.equal(p[0].title, 'Completar el diagnóstico de 1.º A, 1.º B, 2.º A y 9 más');
    assert.equal(p[0].groupIds.length, 12, 'el título se recorta pero groupIds conserva todos');
  });

  test('listNames: 3 grupos se listan completos; 4 pasan a "y 1 más"', () => {
    const sup = (n) => Array.from({ length: n }, (_, i) => g(i + 1, i + 1, 'A', { needsSupportPercentage: 60 }));
    const title = (n) => buildSchoolPriorities(sup(n), SKILLS).find((x) => x.type === 'group_support').title;
    assert.equal(title(3), 'Acompañar a 1.º A, 2.º A y 3.º A');
    assert.equal(title(4), 'Acompañar a 1.º A, 2.º A, 3.º A y 1 más');
  });
});

// ───────────────────────── PDF del panel ─────────────────────────

describe('GET /api/v1/analytics/school/export.pdf', () => {
  let db;
  let api;
  let director;
  let pdf;
  let text;
  const get = (token) => fetch(`${api.base}/api/v1/analytics/school/export.pdf`,
    token ? { headers: { authorization: `Bearer ${token}` } } : {});

  before(async () => {
    db = openDatabase(':memory:');
    runMigrations(db);
    runSeed(db);
    const other = Number(db.prepare("INSERT INTO schools (name) VALUES ('Escuela Ajena PDF')").run().lastInsertRowid);
    db.prepare("INSERT INTO users (school_id, email, password_hash, full_name, role) VALUES (?, 'dir-pdf@axi.test', ?, 'Mtro. Ajeno', 'director')")
      .run(other, bcrypt.hashSync('OtraClave2026', 4));
    api = await startServer(createApp({ db, config: configWith(), logger: silentLogger }));
    director = (await api.call('POST', '/api/v1/auth/quick-login/director')).body.data.token;
    const res = await get(director);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    pdf = Buffer.from(await res.arrayBuffer());
    text = pdfText(pdf);
  });
  after(async () => { await api.close(); db.close(); });

  test('401/403 con formato { error: { code, message } } (alumno y docente)', async () => {
    const teacher = (await api.call('POST', '/api/v1/auth/quick-login/teacher')).body.data.token;
    const student = (await api.call('POST', '/api/v1/auth/quick-login/student')).body.data.token;
    for (const [token, status] of [[undefined, 401], [teacher, 403], [student, 403], ['token-falso', 401]]) {
      const res = await get(token);
      assert.equal(res.status, status);
      assert.match(res.headers.get('content-type'), /application\/json/);
      const body = await res.json();
      assert.equal(typeof body.error.code, 'string');
      assert.equal(typeof body.error.message, 'string');
    }
  });

  test('Carta en cada página, blanco y negro, y pie "Página i de N" coherente con las páginas reales', () => {
    const n = pageCount(pdf);
    assert.ok(n >= 1 && n <= 6, `páginas: ${n}`);
    const boxes = mediaBoxes(pdf);
    assert.equal(boxes.length, n);
    for (const b of boxes) assert.equal(b, '/MediaBox [0 0 612 792]');
    for (let i = 1; i <= n; i += 1) assert.ok(text.includes(`Página ${i} de ${n}`), `pie ${i}/${n}`);
    const ops = colorOps(pdf);
    assert.ok(ops.length > 0, 'se detectaron operadores de color');
    for (const op of ops) assert.match(op, /^0 0 0 (scn|SCN|rg|RG)$|^0 (g|G)$/, op);
  });

  test('incluye grupos, docente y CTE (control positivo de la extracción de texto)', () => {
    const teacher = db.prepare("SELECT full_name FROM users WHERE role = 'teacher' LIMIT 1").get().full_name;
    assert.ok(text.includes(teacher), 'nombre del docente presente: la extracción funciona');
    assert.ok(text.includes('6.º A'));
    assert.match(text, /Próximo Consejo Técnico Escolar: viernes \d+ de \w+ de \d{4}/);
    assert.match(text, /Prioridades del mes/);
    const flat = text.split(/\s+/).join(' ');
    // La fecha oficial también lleva salvedad y el reporte aclara que no evalúa a docentes.
    assert.ok(flat.includes('(calendario SEP del ciclo; confirmar en el DOF)'));
    assert.ok(flat.includes('No es una evaluación del desempeño docente'));
  });

  test('no contiene nombres, apellidos ni folios de alumnos, ni CURP', () => {
    const joined = text.replace(/\n/g, ' ');
    const students = db.prepare('SELECT internal_folio, first_names, last_names FROM students').all();
    assert.ok(students.length > 200);
    for (const s of students) {
      for (const hay of [text, joined, pdf.toString('latin1')]) {
        assert.ok(!hay.includes(s.internal_folio), `folio ${s.internal_folio}`);
        assert.ok(!hay.includes(s.last_names), `apellidos ${s.last_names}`);
      }
    }
    assert.doesNotMatch(text, /CURP|folio interno|internal_folio/i);
  });

  test('un director de otra escuela sin grupos recibe un PDF vacío válido, sin datos demo', async () => {
    const login = await api.call('POST', '/api/v1/auth/login', { body: { email: 'dir-pdf@axi.test', password: 'OtraClave2026' } });
    const res = await get(login.body.data.token);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-disposition'), /panel-escuela-ciclo\.pdf/);
    const other = pdfText(Buffer.from(await res.arrayBuffer()));
    assert.ok(other.includes('Escuela Ajena PDF'));
    const demoSchool = db.prepare("SELECT s.name FROM schools s JOIN users u ON u.school_id = s.id WHERE u.role = 'teacher' LIMIT 1").get().name;
    assert.ok(!other.includes(demoSchool));
    assert.ok(!other.includes('6.º A'));
  });
});

describe('renderSchoolPdf con muchos grupos', () => {
  const dto = (groupCount) => ({
    school: { id: 1, name: 'Escuela Ficticia Grande', schoolYear: '2026-2027' },
    summary: { groupCount, teacherCount: groupCount, studentCount: groupCount * 40, evaluatedStudentCount: groupCount * 20,
      evidencePercentage: 50, needsSupportCount: 10, needsSupportPercentage: 1, coveragePercentage: 40 },
    cte: nextCteSession('2026-11-24', '2026-2027'),
    priorities: buildSchoolPriorities([g(1, 1, 'A', { evidencePercentage: 0 })], SKILLS),
    fields: [{ name: 'Lenguajes', assessed: true, average: 60, label: 'Logrado', evaluatedCount: 10, needsSupportCount: 1 },
      { name: 'De lo humano y lo comunitario', assessed: false, average: null, label: 'Sin evaluación en Axi' }],
    skills: SKILLS.map((s) => ({ ...s, evaluatedCount: 10, needsSupportCount: 2 })),
    groups: Array.from({ length: groupCount }, (_, i) => ({
      name: `${(i % 6) + 1}.º ${String.fromCharCode(65 + Math.floor(i / 6))}`,
      teacherName: `Mtra. Nombre Muy Largo de Docente Ficticia Número ${i + 1}`, studentCount: 40,
      evidencePercentage: 50, needsSupportPercentage: 10, prioritySkill: { name: 'Comprensión lectora' },
    })),
    typicalErrors: [{ skillName: 'Fracciones', explanation: 'Suma numeradores y denominadores (por validar con docente).', studentCount: 5, groupCount: 2 }],
  });

  test('60 grupos: páginas razonables, todas Carta y el pie coincide con el total', async () => {
    const buffer = await renderSchoolPdf(dto(60));
    const n = pageCount(buffer);
    assert.ok(n >= 3 && n <= 10, `páginas: ${n}`);
    assert.equal(mediaBoxes(buffer).length, n);
    const text = pdfText(buffer);
    assert.ok(text.includes(`Página ${n} de ${n}`));
    assert.ok(!text.includes(`Página ${n + 1}`));
    assert.ok(text.includes('Número 60'), 'el último grupo se imprime');
    // La cabecera de la tabla se repite en las páginas de continuación.
    assert.ok((text.match(/Con diagnóstico/g) ?? []).length >= 3);
  });

  test('0 grupos y sin CTE no truena', async () => {
    const data = { ...dto(0), cte: null, priorities: [], typicalErrors: [] };
    const text = pdfText(await renderSchoolPdf(data));
    assert.ok(text.includes('Sin alertas este mes.'));
  });
});
