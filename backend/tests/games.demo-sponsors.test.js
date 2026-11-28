import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { createApp } from '../src/app.js';
import { openDatabase } from '../src/config/database.js';
import { runMigrations } from '../src/db/migrate.js';
import { loadDemoSponsors } from '../src/modules/games/games.demo-sponsors.js';
import { applyDemoSponsor, findSponsoredGame, parseDemoSponsorsConfig } from '../src/modules/games/games.sponsored.domain.js';
import { configWith, silentLogger, startServer, tokenFor } from './helpers.js';

// PNG de 1×1 px válido.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

describe('marcas de demostración: validación de patrocinadores.json', () => {
  const files = new Set(['cuadernos.png', 'calc.svg', 'patrocinadores.json', 'secreto.txt']);

  test('acepta nombre y logo existentes; ignora lo inválido con aviso', () => {
    const { overrides, warnings } = parseDemoSponsorsConfig({
      grammar_fix: { name: '  Marca A  ', logo: 'cuadernos.png' },
      mental_math: { name: 'Marca B', logo: 'calc.svg' },
      symmetry: { name: 'Marca C', logo: 'no-existe.png' },
      fractions: { name: 'No patrocinado', logo: 'cuadernos.png' },
    }, files);
    assert.deepEqual(overrides.get('grammar_fix'), { name: 'Marca A', logo: 'cuadernos.png' });
    assert.deepEqual(overrides.get('mental_math'), { name: 'Marca B', logo: 'calc.svg' });
    // Sin logo válido el nombre sí se aplica, con el emblema genérico.
    assert.deepEqual(overrides.get('symmetry'), { name: 'Marca C', logo: null });
    assert.equal(overrides.has('fractions'), false);
    assert.equal(warnings.length, 2);
  });

  test('rechaza rutas, extensiones raras, nombres vacíos o largos y archivos que no son objeto', () => {
    for (const logo of ['../secreto.txt', 'sub/cuadernos.png', 'secreto.txt', '.png', 'a'.repeat(70) + '.png']) {
      assert.equal(parseDemoSponsorsConfig({ grammar_fix: { name: 'X', logo } }, files).overrides.get('grammar_fix').logo, null, logo);
    }
    for (const name of ['', '   ', 'x'.repeat(61), 42]) {
      assert.equal(parseDemoSponsorsConfig({ grammar_fix: { name, logo: 'cuadernos.png' } }, files).overrides.size, 0, String(name));
    }
    for (const raw of [null, [], 'texto', 3]) assert.equal(parseDemoSponsorsConfig(raw, files).overrides.size, 0);
  });

  test('applyDemoSponsor conserva demo y categoría; no toca juegos sin patrocinio', () => {
    const game = applyDemoSponsor(findSponsoredGame('grammar_fix'), { name: 'Marca A', logo: 'a.png' }, (logo) => `/x/${logo}`);
    assert.deepEqual(game.sponsor, { name: 'Marca A', category: 'Cuadernos y papelería', demo: true, logoUrl: '/x/a.png' });
    const own = { code: 'fractions', sponsor: null };
    assert.equal(applyDemoSponsor(own, { name: 'Y', logo: null }, () => null), own);
  });

  test('loadDemoSponsors: sin carpeta, sin archivo o con JSON roto → marca de ejemplo, sin romper', () => {
    assert.equal(loadDemoSponsors(null, silentLogger).overrides.size, 0);
    assert.equal(loadDemoSponsors(path.join(os.tmpdir(), 'axi-no-existe-xyz'), silentLogger).overrides.size, 0);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'axi-sponsors-'));
    try {
      assert.equal(loadDemoSponsors(dir, silentLogger).overrides.size, 0);
      fs.writeFileSync(path.join(dir, 'patrocinadores.json'), '{ esto no es json');
      assert.equal(loadDemoSponsors(dir, silentLogger).overrides.size, 0);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('marcas de demostración: API con la carpeta del servidor', () => {
  let dir;
  let api;
  let token;
  before(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'axi-sponsors-'));
    fs.writeFileSync(path.join(dir, 'cuadernos.png'), PNG);
    fs.writeFileSync(path.join(dir, 'privado.png'), PNG);
    fs.writeFileSync(path.join(dir, 'patrocinadores.json'), JSON.stringify({ grammar_fix: { name: 'Marca A', logo: 'cuadernos.png' }, mental_math: { name: 'Marca B' } }));
    const db = openDatabase(':memory:');
    runMigrations(db);
    const id = (sql, ...p) => Number(db.prepare(sql).run(...p).lastInsertRowid);
    const school = id("INSERT INTO schools (name) VALUES ('Escuela')");
    const teacher = id("INSERT INTO users (school_id,email,password_hash,full_name) VALUES (?,'t@test.mx','x','Docente')", school);
    const group = id("INSERT INTO groups (school_id,teacher_id,grade,section,school_year,join_code) VALUES (?,?,3,'A','2026-2027','SPON3A')", school, teacher);
    const student = id("INSERT INTO students (school_id,internal_folio,first_names,last_names,initials,avatar_color) VALUES (?,'AXI-SPONSOR1','Ana','Demo','AD','#123456')", school);
    id("INSERT INTO group_enrollments (group_id,student_id,status) VALUES (?,?,'active')", group, student);
    token = tokenFor({ role: 'student', sub: String(student), groupId: group, schoolId: school });
    api = await startServer(createApp({ db, config: configWith({ DEMO_SPONSORS_DIR: dir }), logger: silentLogger }));
  });
  after(async () => { await api.close(); fs.rmSync(dir, { recursive: true, force: true }); });

  test('el catálogo y el juego muestran la marca del servidor, siempre como demostración', async () => {
    const games = (await api.call('GET', '/api/v1/games', { token })).body.data.games;
    const grammar = games.find((g) => g.code === 'grammar_fix');
    assert.deepEqual(grammar.sponsor, { name: 'Marca A', category: 'Cuadernos y papelería', demo: true, logoUrl: '/api/v1/demo-sponsors/cuadernos.png' });
    assert.deepEqual(games.find((g) => g.code === 'mental_math').sponsor.logoUrl, null);
    assert.equal(games.find((g) => g.code === 'symmetry').sponsor.name, 'Marca patrocinadora de ejemplo');
    assert.ok(games.filter((g) => !g.sponsor).length === 3, 'los juegos propios siguen sin patrocinio');
    const one = (await api.call('GET', '/api/v1/games/grammar_fix', { token })).body.data.game;
    assert.equal(one.sponsor.name, 'Marca A');
  });

  test('solo se sirven los logos listados, con encabezados defensivos', async () => {
    const res = await fetch(`${api.base}/api/v1/demo-sponsors/cuadernos.png`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'image/png');
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.match(res.headers.get('content-security-policy'), /default-src 'none'/);
    assert.deepEqual(Buffer.from(await res.arrayBuffer()), PNG);
    for (const file of ['privado.png', 'patrocinadores.json', '..%2Fpatrocinadores.json', '%2E%2E%2Fetc']) {
      assert.equal((await fetch(`${api.base}/api/v1/demo-sponsors/${file}`)).status, 404, file);
    }
  });
});
