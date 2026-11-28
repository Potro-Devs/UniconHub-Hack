import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { buildOmrLayout } from '../../backend/src/modules/paper-mode/paper-mode.omr.domain.js';
import {
  applyOmrScanToDraft,
  clearReviewQuestion,
  clearReviewSupport,
} from '../src/features/paper-mode/paper-mode.logic.js';
import {
  computeCoverGuideRect,
  computeHomography,
  scanOmrImage,
} from '../src/features/paper-mode/omr.scanner.js';

function makeQuestions(count) {
  return Array.from({ length: count }, (_, idx) => {
    const qid = 200 + idx;
    return {
      id: qid,
      position: idx + 1,
      options: ['A', 'B', 'C', 'D'].map((label, optIdx) => ({
        id: qid * 10 + optIdx + 1,
        label,
      })),
    };
  });
}

function invert3x3(m) {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const D = -(b * i - c * h);
  const E = a * i - c * g;
  const F = -(a * h - b * g);
  const G = b * f - c * e;
  const H = -(a * f - c * d);
  const I = a * e - b * d;
  const det = a * A + b * B + c * C;
  return [A / det, D / det, G / det, B / det, E / det, H / det, C / det, F / det, I / det];
}

function makeCorners({ width, height, angleDeg = 0, scale = 0.78, skewX = 0, skewY = 0 }) {
  const cx = width / 2;
  const cy = height / 2;
  const frameAspect = 516 / 696;
  const frameH = height * scale;
  const frameW = frameH * frameAspect;
  const hw = frameW / 2;
  const hh = frameH / 2;
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const raw = [
    { x: -hw + skewX, y: -hh + skewY },
    { x: hw - skewX, y: -hh - skewY },
    { x: hw + skewX * 0.5, y: hh },
    { x: -hw - skewX * 0.5, y: hh },
  ];
  return raw.map((p) => ({
    x: cx + p.x * cos - p.y * sin,
    y: cy + p.x * sin + p.y * cos,
  }));
}

function renderSyntheticSheet(layout, {
  width = 760,
  height = 1020,
  angleDeg = 0,
  scale = 0.78,
  skewX = 0,
  skewY = 0,
  filledOptions = {}, // { questionId: { optionId: intensity (0..1) } }
  supportFill = 0,
  shadowMode = null, // 'heavy' | 'low_light' | null
  noiseAmp = 5,
} = {}) {
  const dstCorners = makeCorners({ width, height, angleDeg, scale, skewX, skewY });
  const H = computeHomography(dstCorners);
  const Hinv = invert3x3(H);
  const frame = layout.fiducials.frame;
  const halfMarker = layout.fiducials.markerSizePt / 2;
  const halfCell = layout.codeStrip.cellSizePt / 2;

  const data = new Uint8ClampedArray(width * height * 4);

  // Precomputa burbujas en coordenadas PDF para rasterizado rápido
  const bubbles = [
    {
      x: layout.supportBubble.x,
      y: layout.supportBubble.y,
      r: layout.supportBubble.r,
      fill: supportFill,
    },
  ];
  for (const q of layout.questions) {
    const qFills = filledOptions[q.questionId] ?? {};
    for (const opt of q.options) {
      bubbles.push({
        x: opt.x,
        y: opt.y,
        r: opt.r,
        fill: qFills[opt.optionId] ?? 0,
      });
    }
  }

  const fiducials = Object.values(layout.fiducials.corners);
  const cells = [
    { x: layout.codeStrip.blackRef.x, y: layout.codeStrip.blackRef.y, dark: true },
    { x: layout.codeStrip.whiteRef.x, y: layout.codeStrip.whiteRef.y, dark: false },
    ...layout.codeStrip.bits.map((b) => ({ x: b.x, y: b.y, dark: b.value === 1 })),
  ];

  let seed = 1337;
  const nextNoise = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return ((seed / 0xffffffff) - 0.5) * 2 * noiseAmp;
  };

  for (let py = 0; py < height; py += 1) {
    for (let px = 0; px < width; px += 1) {
      const w = Hinv[6] * px + Hinv[7] * py + Hinv[8];
      const u = (Hinv[0] * px + Hinv[1] * py + Hinv[2]) / w;
      const v = (Hinv[3] * px + Hinv[4] * py + Hinv[5]) / w;
      const sx = frame.x + u * frame.width;
      const sy = frame.y + v * frame.height;

      let lum = 48; // mesa oscura alrededor de la hoja
      if (sx >= 0 && sx <= layout.page.widthPt && sy >= 0 && sy <= layout.page.heightPt) {
        lum = 248; // papel blanco

        // Marcas fiduciales
        for (const f of fiducials) {
          if (Math.abs(sx - f.x) <= halfMarker && Math.abs(sy - f.y) <= halfMarker) {
            lum = 12;
            break;
          }
        }

        // Tira de código
        if (lum > 100 && Math.abs(sy - layout.codeStrip.blackRef.y) <= halfCell + 1) {
          for (const c of cells) {
            const dx = Math.abs(sx - c.x);
            const dy = Math.abs(sy - c.y);
            if (dx <= halfCell && dy <= halfCell) {
              if (c.dark) lum = 15;
              else if (dx >= halfCell - 0.8 || dy >= halfCell - 0.8) lum = 185;
              break;
            }
          }
        }

        // Burbujas
        if (lum > 100) {
          for (const b of bubbles) {
            const dx = sx - b.x;
            const dy = sy - b.y;
            if (Math.abs(dx) > b.r + 1.5 || Math.abs(dy) > b.r + 1.5) continue;
            const dist = Math.hypot(dx, dy);
            if (dist <= b.r + 0.6 && dist >= b.r - 0.8) {
              lum = 25; // borde del círculo
            } else if (dist < b.r * 0.82) {
              if (b.fill > 0) {
                lum = Math.round(248 - b.fill * 225);
              } else if (dist < b.r * 0.34) {
                lum = 155; // letra guía impresa dentro de burbuja vacía
              }
            }
            break;
          }
        }
      }

      if (shadowMode === 'heavy' && sx > 280) {
        lum = Math.round(lum * 0.22);
      } else if (shadowMode === 'low_light') {
        lum = Math.round(92 + (lum / 255) * 24);
      }

      const finalLum = Math.max(0, Math.min(255, Math.round(lum + nextNoise())));
      const idx = (py * width + px) * 4;
      data[idx] = finalLum;
      data[idx + 1] = finalLum;
      data[idx + 2] = finalLum;
      data[idx + 3] = 255;
    }
  }

  return { data, width, height };
}

describe('omr.scanner · lectura OMR en navegador', () => {
  test('hoja limpia de 4 reactivos (1 columna) y apoyo marcado: 100% de precisión', () => {
    const questions = makeQuestions(4);
    const layout = buildOmrLayout({ assignmentId: 12, title: 'Fracciones', groupLabel: '3.º A', questions });
    const chosen = [0, 2, 1, 3];
    const filledOptions = {};
    questions.forEach((q, idx) => {
      filledOptions[q.id] = { [q.options[chosen[idx]].id]: 0.92 };
    });

    const img = renderSyntheticSheet(layout, { filledOptions, supportFill: 0.92 });
    const result = scanOmrImage(img, layout);

    assert.equal(result.ok, true);
    assert.equal(result.code, 'P-12');
    assert.equal(result.supportUsed, true);
    assert.equal(result.supportUncertain, false);
    assert.equal(result.uncertainCount, 0);
    questions.forEach((q, idx) => {
      assert.equal(result.answers[q.id], q.options[chosen[idx]].id);
    });
  });

  test('hoja de 25 reactivos (2 columnas) inclinada ~7° con perspectiva leve: >= 95% (100%)', () => {
    const questions = makeQuestions(25);
    const layout = buildOmrLayout({ assignmentId: 345, title: 'Repaso', questions });
    const filledOptions = {};
    const expected = {};
    questions.forEach((q, idx) => {
      if (idx === 12) {
        expected[q.id] = null; // sin respuesta intencional
      } else {
        const opt = q.options[idx % 4];
        filledOptions[q.id] = { [opt.id]: 0.88 };
        expected[q.id] = opt.id;
      }
    });

    const img = renderSyntheticSheet(layout, {
      width: 820,
      height: 1080,
      angleDeg: 7,
      skewX: 16,
      skewY: 8,
      filledOptions,
      supportFill: 0,
    });
    const result = scanOmrImage(img, layout);

    assert.equal(result.ok, true);
    assert.equal(result.supportUsed, false);
    let matches = 0;
    for (const q of questions) {
      if (result.answers[q.id] === expected[q.id]) matches += 1;
    }
    assert.equal(matches, questions.length);
  });

  test('hoja muy inclinada (~18°): rechaza con SHEET_TILTED y mensaje de acercar al marco', () => {
    const questions = makeQuestions(4);
    const layout = buildOmrLayout({ assignmentId: 12, title: 'Fracciones', questions });
    const img = renderSyntheticSheet(layout, { angleDeg: 18, scale: 0.62 });
    const result = scanOmrImage(img, layout);

    assert.equal(result.ok, false);
    assert.equal(result.reason, 'SHEET_TILTED');
    assert.match(result.message, /marco/i);
  });

  test('sombra fuerte o poca luz: avisa sin leer respuestas falsas', () => {
    const questions = makeQuestions(4);
    const layout = buildOmrLayout({ assignmentId: 12, title: 'Fracciones', questions });

    const shadowed = renderSyntheticSheet(layout, { shadowMode: 'heavy' });
    const shadowRes = scanOmrImage(shadowed, layout);
    assert.equal(shadowRes.ok, false);
    assert.ok(['SHADOW_DETECTED', 'FIDUCIALS_NOT_FOUND', 'LOW_CONTRAST'].includes(shadowRes.reason));

    const dark = renderSyntheticSheet(layout, { shadowMode: 'low_light' });
    const darkRes = scanOmrImage(dark, layout);
    assert.equal(darkRes.ok, false);
    assert.ok(['LOW_LIGHT', 'LOW_CONTRAST', 'FIDUCIALS_NOT_FOUND'].includes(darkRes.reason));
  });

  test('hoja de otra prueba (P-99 vs P-12): rechaza con WRONG_ASSIGNMENT', () => {
    const questions = makeQuestions(4);
    const expectedLayout = buildOmrLayout({ assignmentId: 12, title: 'Prueba 12', questions });
    const scannedLayout = buildOmrLayout({ assignmentId: 99, title: 'Prueba 99', questions });

    const img = renderSyntheticSheet(scannedLayout, {});
    const result = scanOmrImage(img, expectedLayout);

    assert.equal(result.ok, false);
    assert.equal(result.reason, 'WRONG_ASSIGNMENT');
    assert.equal(result.detectedCode, 'P-99');
    assert.equal(result.expectedCode, 'P-12');
  });

  test('doble marca, marca tenue y apoyo tenue: marca para revisión docente', () => {
    const questions = makeQuestions(4);
    const layout = buildOmrLayout({ assignmentId: 12, title: 'Fracciones', questions });
    const filledOptions = {
      [questions[0].id]: { [questions[0].options[0].id]: 0.90 }, // clara
      [questions[1].id]: { [questions[1].options[0].id]: 0.88, [questions[1].options[1].id]: 0.85 }, // doble marca
      [questions[2].id]: { [questions[2].options[2].id]: 0.27 }, // tenue
      // q[3] sin marca
    };

    const img = renderSyntheticSheet(layout, { filledOptions, supportFill: 0.26 });
    const result = scanOmrImage(img, layout);

    assert.equal(result.ok, true);
    assert.equal(result.answers[questions[0].id], questions[0].options[0].id);
    assert.equal(result.answers[questions[1].id], null);
    assert.equal(result.answers[questions[2].id], questions[2].options[2].id);
    assert.equal(result.answers[questions[3].id], null);

    assert.equal(result.supportUsed, true);
    assert.equal(result.supportUncertain, true);
    assert.match(result.uncertainQuestions[questions[1].id].reason, /Varias marcas/);
    assert.match(result.uncertainQuestions[questions[2].id].reason, /Marca tenue/);
    assert.equal(result.uncertainCount, 3);
  });

  test('computeCoverGuideRect compensa object-fit: cover en sensores vertical y horizontal', () => {
    const portrait = computeCoverGuideRect(1080, 1920, 360, 480);
    assert.ok(portrait.x >= 0 && portrait.y >= 0);
    assert.ok(portrait.width > 0 && portrait.height > 0);
    assert.ok(Math.abs(portrait.width / portrait.height - 516 / 696) < 0.02);

    const landscape = computeCoverGuideRect(1920, 1080, 360, 480);
    assert.ok(landscape.x > 0);
    assert.ok(Math.abs(landscape.width / landscape.height - 516 / 696) < 0.02);
  });

  test('applyOmrScanToDraft filtra IDs inválidos, incluye verificación del alumno con lenguaje neutro y clearReview limpia dudas', () => {
    const questions = makeQuestions(3);
    const { draft, review } = applyOmrScanToDraft(questions, {
      answers: {
        [questions[0].id]: questions[0].options[1].id,
        [questions[1].id]: 999999, // opción inexistente descartada
        888888: 123,
      },
      supportUsed: true,
      supportUncertain: true,
      uncertainQuestions: {
        [questions[1].id]: { status: 'faint', reason: 'Marca tenue en B' },
      },
    }, 'Fernanda A.');

    assert.equal(draft.answers[questions[0].id], questions[0].options[1].id);
    assert.equal(draft.answers[questions[1].id], null);
    assert.equal(draft.answers[questions[2].id], null);
    assert.equal(draft.supportUsed, true);
    assert.equal(review.answeredCount, 1);
    assert.equal(review.uncertainCount, 2);
    assert.doesNotMatch(review.summary, /estés lista/i);
    assert.match(review.summary, /verifica que la hoja sea de Fernanda A\./i);

    const clean = applyOmrScanToDraft(questions, {
      answers: { [questions[0].id]: questions[0].options[0].id },
      supportUsed: false,
      supportUncertain: false,
      uncertainQuestions: {},
    }, 'Fernanda A.');
    assert.doesNotMatch(clean.review.summary, /estés lista/i);
    assert.match(clean.review.summary, /Verifica que la hoja sea de Fernanda A\. y guarda la hoja\./);

    const afterQ = clearReviewQuestion(review, questions[1].id);
    assert.equal(afterQ.uncertainQuestions[questions[1].id], undefined);
    assert.equal(afterQ.uncertainCount, 1);

    const afterAll = clearReviewSupport(afterQ);
    assert.equal(afterAll.supportUncertain, false);
    assert.equal(afterAll.uncertainCount, 0);
  });
});
