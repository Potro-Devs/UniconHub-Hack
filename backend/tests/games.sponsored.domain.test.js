import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  DEMO_SPONSOR_NAME,
  SPONSORED_CATALOG,
  buildSponsoredRounds,
  checkSponsoredAnswer,
} from '../src/modules/games/games.sponsored.domain.js';

const GRADES = [1, 2, 3, 4, 5, 6];
const cents = (n) => Math.round(n * 100);

describe('juegos patrocinados (demo): contenido', () => {
  test('el patrocinador es siempre la marca de ejemplo, sin enlaces ni logos reales', () => {
    for (const game of SPONSORED_CATALOG) {
      assert.equal(game.sponsor.name, DEMO_SPONSOR_NAME);
      assert.equal(game.sponsor.demo, true);
      assert.ok(!JSON.stringify(game).match(/https?:|www\.|\.com|logo/i), game.code);
    }
  });

  test('cada grado tiene 3 retos con 3 pistas y lenguaje no punitivo ni comercial', () => {
    for (const { code } of SPONSORED_CATALOG) for (const grade of GRADES) {
      const rounds = buildSponsoredRounds(code, grade);
      assert.equal(rounds.length, 3, `${code} ${grade}`);
      for (const round of rounds) {
        assert.equal(round.hints.length, 3);
        assert.ok(!/reprobado|malo|deficiente|bajo|compra|marca/i.test(JSON.stringify(round)), `${code} ${grade} ${round.id}`);
      }
    }
  });

  test('Corrige el cuaderno: una sola respuesta y ninguna pista menciona la corrección', () => {
    for (const grade of GRADES) for (const round of buildSponsoredRounds('grammar_fix', grade)) {
      const { words, options } = round.material;
      assert.equal(new Set(options).size, options.length, 'opciones distintas');
      const wins = [];
      for (let w = 0; w < words.length; w += 1) for (let o = 0; o < options.length; o += 1) {
        if (checkSponsoredAnswer('grammar_fix', round, grade, { wordIndex: w, optionIndex: o }).correct) wins.push([w, o]);
      }
      assert.equal(wins.length, 1, `${grade} ${round.id}`);
      const fix = options[wins[0][1]].replace(/[¿?.,]/g, '').toLowerCase();
      for (const hint of round.hints) assert.ok(!hint.toLowerCase().split(/[^a-záéíóúüñ]+/).includes(fix), `pista revela "${fix}": ${hint}`);
      // La palabra con error no es ya la corrección.
      assert.ok(!options.includes(words[wins[0][0]]));
    }
  });

  test('Cálculo mental: exactamente un par de tarjetas llega a la meta', () => {
    for (const grade of GRADES) for (const round of buildSponsoredRounds('mental_math', grade)) {
      const { cards, target } = round.material;
      const pairs = [];
      for (let i = 0; i < cards.length; i += 1) for (let j = i + 1; j < cards.length; j += 1) {
        if (cents(cards[i]) + cents(cards[j]) === cents(target)) pairs.push([i, j]);
      }
      assert.equal(pairs.length, 1, `${grade} meta ${target}`);
      assert.equal(checkSponsoredAnswer('mental_math', round, grade, pairs[0]).correct, true);
      assert.equal(checkSponsoredAnswer('mental_math', round, grade, [...pairs[0]].reverse()).correct, true);
      // Las pistas no nombran las tarjetas de la respuesta.
      for (const hint of round.hints) for (const i of pairs[0]) assert.ok(!hint.includes(` ${cards[i]} `) && !hint.includes(` ${cards[i]}.`), hint);
    }
  });

  test('Completa la figura: solo el reflejo exacto es correcto y ninguna figura viene vacía', () => {
    for (const grade of GRADES) for (const round of buildSponsoredRounds('symmetry', grade)) {
      const { left, half, rows } = round.material;
      assert.equal(left.length, rows);
      assert.ok(left.flat().some(Boolean));
      const mirror = left.map((row) => [...row].reverse());
      assert.equal(checkSponsoredAnswer('symmetry', round, grade, mirror).correct, true);
      // Copiar sin reflejar no cuenta (en las figuras no simétricas por sí mismas).
      const copy = left.map((row) => [...row]);
      if (JSON.stringify(copy) !== JSON.stringify(mirror)) assert.equal(checkSponsoredAnswer('symmetry', round, grade, copy).correct, false);
      assert.equal(mirror[0].length, half);
    }
  });
});
