import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { test } from 'node:test';
import { renderQuizPdf } from '../src/modules/assessments/assessments.pdf.js';

/** Verifica la geometría visible del PDF final, sin repetir la fórmula de altura del renderizador. */
test('plantilla de aventura reserva el gráfico entre enunciado y opciones incluso al cambiar de página', async () => {
  const questions = Array.from({ length: 8 }, (_, i) => ({
    position: i + 1, prompt: `ENUNCIADO${i + 1}`, questionType: 'multiple_choice',
    visual: { type: 'fraction_bar', parts: 4, shaded: 1 },
    options: [{ label: 'A', text: `OPCION${i + 1}` }, { label: 'B', text: `ALTERNATIVA${i + 1}` }],
  }));
  const buffer = await renderQuizPdf({ title: 'Geometria de fracciones', grade: 3, skill: { name: 'Fracciones' }, questions }, { supportField: true });
  let seen = 0;
  let pagesWithQuestions = 0;
  for (const match of buffer.toString('latin1').matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    let content;
    try { content = inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1'); } catch { continue; }
    const text = [...content.matchAll(/BT[\s\S]*?ET/g)].flatMap(([block]) => {
      const matrix = block.match(/1 0 0 1 ([\d.-]+) ([\d.-]+) Tm/);
      if (!matrix) return [];
      return [{ value: [...block.matchAll(/<([0-9a-f]+)>/gi)].map(([, hex]) => Buffer.from(hex, 'hex').toString('latin1')).join(''), y: 792 - Number(matrix[2]) }];
    });
    const prompts = text.filter((item) => /^ENUNCIADO\d+$/.test(item.value));
    if (!prompts.length) continue;
    pagesWithQuestions++;
    const bars = [...content.matchAll(/([\d.-]+) ([\d.-]+) 300 30 re/g)].map((m) => Number(m[2]));
    let previousAnswerY = -Infinity;
    for (const prompt of prompts) {
      const number = prompt.value.match(/\d+$/)[0];
      const option = text.find((item) => item.value === `OPCION${number}`);
      const alternative = text.find((item) => item.value === `ALTERNATIVA${number}`);
      assert.ok(option && alternative, `pregunta ${number}: las opciones quedan en la misma página`);
      assert.ok(prompt.y > previousAnswerY, `pregunta ${number}: no invade las opciones de la tarjeta anterior`);
      const bar = bars.find((y) => y > prompt.y && y + 30 < option.y);
      assert.ok(bar !== undefined, `pregunta ${number}: gráfico completo entre enunciado y primera opción`);
      assert.ok(alternative.y > option.y && alternative.y < 720, `pregunta ${number}: opciones antes del pie de página`);
      previousAnswerY = alternative.y;
      seen++;
    }
  }
  assert.equal(seen, questions.length);
  assert.ok(pagesWithQuestions > 1, 'el caso debe atravesar un salto de página');
});
