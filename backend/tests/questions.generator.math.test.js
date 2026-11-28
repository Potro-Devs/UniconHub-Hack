/**
 * Corrección matemática del banco generado (seed) con muchas semillas: la respuesta marcada
 * es correcta, ningún distractor equivale numéricamente a ella, los niveles por grado se
 * respetan y las pistas no revelan la respuesta (ni literal ni en forma equivalente).
 * Los niveles en sí son aproximados al Programa Sintético y quedan por validar con docentes.
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createRng } from '../src/db/seed/random.js';
import { generateQuestionBank, hintsMentionAnswer } from '../src/db/seed/questions.generator.js';
import { isSkillInGrade } from '../src/modules/curriculum/curriculum.domain.js';
import { DEFAULT_SEED } from '../src/db/seed.js';

const SEEDS = Array.from({ length: 120 }, (_, i) => i + 1).concat([42, 2026, 20251125, 0xdeadbeef, DEFAULT_SEED]);
const BANKS = SEEDS.map((seed) => ({ seed, bank: generateQuestionBank(createRng(seed)) }));
/** Solo el banco que carga `npm run seed` (lo que se ve en la demo). */
const DEMO_BANKS = BANKS.filter((b) => b.seed === DEFAULT_SEED);

const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
const int = (s) => Number(String(s).replace(/[\s$]/g, ''));
/** Décimos/centésimos a entero de centésimos para comparar sin errores de punto flotante. */
const cents = (s) => Math.round(Number(String(s).replace(/[\s$]/g, '')) * 100);

/** Valor numérico comparable: fracción → [num, den]; número → [centésimos, 100]. */
function value(text) {
  const t = String(text).trim();
  const f = t.match(/^(\d+)\/(\d+)$/);
  if (f) return [Number(f[1]), Number(f[2])];
  if (/^\$?\d{1,3}(?: \d{3})*(?:\.\d+)?$|^\$?\d+(?:\.\d+)?$/.test(t)) return [cents(t), 100];
  return null;
}
const sameValue = (a, b) => a && b && a[1] !== 0 && b[1] !== 0 && a[0] * b[1] === a[1] * b[0];

/** Fracciones y números que aparecen en un texto (números con espacio de miles estilo SEP). */
const fractionsIn = (text) => [...text.matchAll(/(\d+)\/(\d+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
/** Si la respuesta es dinero ("$3"), solo cuentan cantidades con "$" (no "3 lápices"). */
const numbersIn = (text, { money = false } = {}) =>
  [...text.replace(/\d+\/\d+/g, ' ').matchAll(/(\$?)(\d{1,3}(?: \d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)/g)]
    .filter((m) => !money || m[1] === '$')
    .map((m) => [cents(m[2]), 100]);

const where = (seed, q) => `semilla ${seed}, ${q.skill} ${q.grade}.º: ${q.stem.split('\n').pop()}`;

function forEach(skill, grade, fn, banks = BANKS) {
  let n = 0;
  for (const { seed, bank } of banks) {
    for (const q of bank) {
      if (q.skill !== skill || (grade && q.grade !== grade)) continue;
      fn(q, where(seed, q));
      n += 1;
    }
  }
  assert.ok(n > 0, `sin reactivos de ${skill} ${grade ?? ''}`);
}

describe('banco de reactivos: integridad general con varias semillas', () => {
  test('ningún texto tiene NaN, undefined, null, Infinity ni [object Object]', () => {
    for (const { seed, bank } of BANKS) {
      for (const q of bank) {
        const texts = [q.stem, q.correct, ...q.hints, ...q.distractors.flatMap((x) => [x.text, x.tag, x.explanation])];
        for (const t of texts) {
          assert.equal(typeof t, 'string', where(seed, q));
          assert.ok(t.trim().length > 0, `texto vacío en ${where(seed, q)}`);
          assert.ok(!/NaN|undefined|null|Infinity|\[object/.test(t), `"${t}" en ${where(seed, q)}`);
        }
        assert.equal(q.hints.length, 3, where(seed, q));
        assert.ok([1, 2, 3].includes(q.difficulty), where(seed, q));
        assert.ok(isSkillInGrade(q.skill, q.grade), where(seed, q));
      }
    }
  });

  test('ningún distractor es igual ni numéricamente equivalente a la respuesta (2/4 vs 1/2, 9 vs 9.0)', () => {
    for (const { seed, bank } of BANKS) {
      for (const q of bank) {
        const correct = value(q.correct);
        const texts = new Set([q.correct.trim()]);
        for (const x of q.distractors) {
          assert.ok(!texts.has(x.text.trim()), `distractor repetido "${x.text}" en ${where(seed, q)}`);
          texts.add(x.text.trim());
          assert.ok(!sameValue(correct, value(x.text)), `"${x.text}" equivale a "${q.correct}" en ${where(seed, q)}`);
        }
        // Tampoco dos distractores equivalentes entre sí (serían la misma opción para el alumno).
        const values = q.distractors.map((x) => value(x.text)).filter(Boolean);
        for (let i = 0; i < values.length; i += 1) {
          for (let j = i + 1; j < values.length; j += 1) {
            assert.ok(!sameValue(values[i], values[j]), `distractores equivalentes en ${where(seed, q)}: ${q.distractors.map((x) => x.text)}`);
          }
        }
      }
    }
  });

  test('ningún distractor es negativo ni una fracción con denominador 0', () => {
    for (const { seed, bank } of BANKS) {
      for (const q of bank) {
        for (const t of [q.correct, ...q.distractors.map((x) => x.text)]) {
          assert.ok(!/^-|\/0$/.test(t.trim()), `"${t}" en ${where(seed, q)}`);
        }
      }
    }
  });

  const hintLeaks = (banks, { fractions }) => {
    const leaks = [];
    for (const { seed, bank } of banks) {
      for (const q of bank) {
        if (!fractions) assert.ok(!hintsMentionAnswer(q.hints, q.correct), `pista literal en ${where(seed, q)}`);
        const correct = value(q.correct);
        const isFraction = q.correct.includes('/');
        if (!correct || q.skill === 'reading_comprehension' || isFraction !== fractions) continue;
        for (const hint of q.hints) {
          const found = isFraction ? fractionsIn(hint) : numbersIn(hint, { money: q.correct.startsWith('$') });
          if (found.some((v) => sameValue(v, correct))) leaks.push(`pista "${hint}" vale lo mismo que "${q.correct}" en ${where(seed, q)}`);
        }
      }
    }
    return leaks;
  };

  test('las pistas no mencionan la respuesta (literal ni como número equivalente)', () => {
    assert.deepEqual(hintLeaks(BANKS, { fractions: false }), []);
  });

  test('en el banco demo ninguna pista muestra una fracción equivalente a la respuesta', () => {
    assert.deepEqual(hintLeaks(DEMO_BANKS, { fractions: true }), []);
  });

  test('con cualquier semilla ninguna pista muestra una fracción equivalente a la respuesta (3.º: 3/4 vs 6/8; 5.º: 3/6 vs 5/10)', () => {
    assert.deepEqual(hintLeaks(BANKS, { fractions: true }), []);
  });

  test('semillas distintas producen bancos distintos (no es un banco fijo)', () => {
    const a = BANKS[0].bank.map((q) => q.stem).join('|');
    const b = BANKS[1].bank.map((q) => q.stem).join('|');
    assert.notEqual(a, b);
  });
});

describe('valor posicional', () => {
  const DIGITS = { 1: 2, 2: 3, 3: 4, 4: 5, 5: 9, 6: 10 };

  test('la respuesta es el valor de la cifra preguntada y el número tiene las cifras del grado', () => {
    forEach('place_value', null, (q, at) => {
      const m = q.stem.match(/^En el número ([\d ]+), ¿cuánto vale el (\d)\?$/);
      assert.ok(m, at);
      const number = m[1].replace(/ /g, '');
      assert.equal(m[1], number.replace(/\B(?=(\d{3})+(?!\d))/g, ' '), `separador de miles en ${at}`);
      assert.equal(number.length, DIGITS[q.grade], at);
      assert.notEqual(number[0], '0', `cero al inicio en ${at}`);
      assert.notEqual(m[2], '0', `pregunta por el 0 en ${at}`);
      const positions = [...number].flatMap((c, i) => (c === m[2] ? [i] : []));
      assert.equal(positions.length, 1, `la cifra ${m[2]} aparece ${positions.length} veces en ${at}`);
      const expected = Number(m[2]) * 10 ** (number.length - 1 - positions[0]);
      assert.equal(int(q.correct), expected, at);
      assert.ok(expected >= 10, `pregunta por las unidades en ${at}`);
    });
  });

  test('6.º usa 10 cifras e incluye el 0; 5.º usa 9 cifras', () => {
    forEach('place_value', 6, (q, at) => assert.match(q.stem, /número \d \d{3} \d{3} \d{3},/, at));
    forEach('place_value', 6, (q, at) => assert.ok(q.stem.match(/número ([\d ]+),/)[1].includes('0'), at));
    forEach('place_value', 5, (q, at) => assert.match(q.stem, /número \d{3} \d{3} \d{3},/, at));
  });
});

describe('multiplicación', () => {
  test('2.º y 3.º: el producto es correcto', () => {
    forEach('multiplication', 2, (q, at) => {
      const m = q.stem.match(/^Hay (\d+) \S+ con (\d+) /);
      assert.ok(m, at);
      assert.equal(int(q.correct), Number(m[1]) * Number(m[2]), at);
    });
    forEach('multiplication', 3, (q, at) => {
      const m = q.stem.match(/^¿Cuánto es (\d+) × (\d+)\?$/);
      assert.ok(m, at);
      assert.equal(int(q.correct), Number(m[1]) * Number(m[2]), at);
    });
  });

  test('4.º: tres cifras por dos cifras con producto correcto', () => {
    forEach('multiplication', 4, (q, at) => {
      const m = q.stem.match(/^¿Cuánto es (\d{3}) × (\d{2})\?$/);
      assert.ok(m, at);
      assert.equal(int(q.correct), Number(m[1]) * Number(m[2]), at);
    });
  });

  const noZeroDistractor = (banks) => forEach('multiplication', 4, (q, at) => {
    for (const x of q.distractors) assert.notEqual(int(x.text), 0, `distractor "${x.text}" (${x.tag}) en ${at}`);
  }, banks);
  test('4.º: en el banco demo ningún distractor vale 0', () => noZeroDistractor(DEMO_BANKS));
  test('4.º: con cualquier semilla ningún distractor vale 0 (segundo factor terminado en 0)', () => noZeroDistractor(BANKS));

  const decimalTimesNatural = (banks, { requireTenths }) => forEach('multiplication', 5, (q, at) => {
    const m = q.stem.match(/mide ([\d.]+) m\. ¿Cuántos metros miden (\d+) listones/);
    assert.ok(m, at);
    if (requireTenths) assert.match(m[1], /^\d+\.\d$/, `el listón mide un entero (${m[1]}): no es decimal × natural en ${at}`);
    assert.equal(cents(q.correct), cents(m[1]) * Number(m[2]), at);
  }, banks);
  test('5.º: el producto decimal × natural es correcto con cualquier semilla', () => decimalTimesNatural(BANKS, { requireTenths: false }));
  test('5.º: en el banco demo el factor siempre es decimal con décimos', () => decimalTimesNatural(DEMO_BANKS, { requireTenths: true }));
  test('5.º: con cualquier semilla el factor siempre es decimal con décimos', () => decimalTimesNatural(BANKS, { requireTenths: true }));

  test('6.º: el total siempre lleva décimos y el reparto es exacto', () => {
    forEach('multiplication', 6, (q, at) => {
      const m = q.stem.match(/^Se reparten ([\d.]+) litros de agua en (\d+) garrafones/);
      assert.ok(m, at);
      assert.match(m[1], /^\d+\.\d{1,2}$/, `total sin décimos en ${at}`);
      assert.notEqual(cents(m[1]) % 100, 0, at);
      assert.equal(cents(q.correct) * Number(m[2]), cents(m[1]), at);
    });
  });
});

describe('fracciones', () => {
  test('3.º: denominadores 4 u 8 y la fracción marcada (pizza, pastel o chocolate) es correcta', () => {
    forEach('fractions', 3, (q, at) => {
      // El dibujo es la fuente de verdad; el enunciado debe decir los mismos números.
      const { parts, shaded } = q.visual;
      assert.ok([4, 8].includes(parts), at);
      assert.ok(shaded >= 1 && shaded < parts, at);
      const m = q.stem.match(/ (\d+) (?:rebanadas|cuadritos) iguales y (?:Luis se come )?(\d+)[ .]/);
      assert.ok(m, at);
      assert.deepEqual([Number(m[1]), Number(m[2])], [parts, shaded], at);
      assert.equal(q.correct, `${shaded}/${parts}`, at);
    });
  });

  test('4.º: la respuesta es equivalente (distinta) y el denominador base es 3, 5 o 6', () => {
    forEach('fractions', 4, (q, at) => {
      const m = q.stem.match(/^¿Qué fracción es equivalente a (\d+)\/(\d+)\?$/);
      assert.ok(m, at);
      assert.ok(['3', '5', '6'].includes(m[2]), at);
      assert.ok(sameValue(value(q.correct), [Number(m[1]), Number(m[2])]), at);
      assert.notEqual(q.correct, `${m[1]}/${m[2]}`, at);
      // Ningún distractor puede ser también equivalente a la fracción del enunciado.
      for (const x of q.distractors) assert.ok(!sameValue(value(x.text), [Number(m[1]), Number(m[2])]), `"${x.text}" en ${at}`);
    });
  });

  for (const grade of [5, 6]) {
    test(`${grade}.º: la suma es correcta`, () => {
      forEach('fractions', grade, (q, at) => {
        const m = q.stem.match(/^Calcula (\d+)\/(\d+) \+ (\d+)\/(\d+)\.$/);
        assert.ok(m, at);
        const [n1, d1, n2, d2] = m.slice(1).map(Number);
        assert.ok(sameValue(value(q.correct), [n1 * d2 + n2 * d1, d1 * d2]), `${q.correct} en ${at}`);
      });
    });
  }

  test('5.º: un denominador es múltiplo del otro', () => {
    forEach('fractions', 5, (q, at) => {
      const [, , d1, , d2] = q.stem.match(/(\d+)\/(\d+) \+ (\d+)\/(\d+)/).map(Number);
      assert.ok(d1 !== d2 && (d2 % d1 === 0 || d1 % d2 === 0), at);
    });
  });

  test('6.º: denominadores coprimos, ninguno múltiplo del otro, y numeradores sin simplificar', () => {
    forEach('fractions', 6, (q, at) => {
      const [, n1, d1, n2, d2] = q.stem.match(/(\d+)\/(\d+) \+ (\d+)\/(\d+)/).map(Number);
      assert.ok(d1 !== d2 && d1 % d2 !== 0 && d2 % d1 !== 0, `denominadores múltiplos en ${at}`);
      assert.equal(gcd(d1, d2), 1, at);
      assert.equal(gcd(n1, d1), 1, at);
      assert.equal(gcd(n2, d2), 1, at);
    });
  });
});

describe('resolución de problemas', () => {
  test('1.º a 4.º: la operación de un paso es correcta e ignora el dato irrelevante', () => {
    for (const grade of [1, 2, 3, 4]) {
      forEach('problem_solving', grade, (q, at) => {
        const add = q.stem.match(/tenía ([\d ]+) \S+\. Le regalaron ([\d ]+) más/);
        const sub = q.stem.match(/tenía ([\d ]+) \S+ y regaló ([\d ]+) a sus amigos/);
        assert.ok(add || sub, at);
        const [a, b] = (add || sub).slice(1).map(int);
        assert.equal(int(q.correct), add ? a + b : a - b, at);
        assert.ok(int(q.correct) > 0, at);
      });
    }
  });

  test('5.º: el cambio es billete − cantidad × precio', () => {
    forEach('problem_solving', 5, (q, at) => {
      const m = q.stem.match(/compra (\d+) cuadernos de \$(\d+) cada uno y paga con un billete de \$([\d ]+)\./);
      assert.ok(m, at);
      const [n, p, bill] = m.slice(1).map(int);
      assert.ok(bill > n * p, at);
      assert.equal(int(q.correct), bill - n * p, at);
    });
  });

  test('6.º: el cambio es billete − (libretas + mochila)', () => {
    forEach('problem_solving', 6, (q, at) => {
      const m = q.stem.match(/compra (\d+) libretas de \$(\d+) cada una y una mochila de \$(\d+)\. Paga con un billete de \$([\d ]+)\./);
      assert.ok(m, at);
      const [n, p, mochila, bill] = m.slice(1).map(int);
      assert.ok(bill > n * p + mochila, at);
      assert.equal(int(q.correct), bill - (n * p + mochila), at);
    });
  });
});
