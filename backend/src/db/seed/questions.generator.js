/**
 * Banco de reactivos demo de 1.º a 6.º para las habilidades clave de cada grado
 * (`SKILL_GRADE_RANGE`: sin fracciones en 1.º y 2.º ni multiplicación en 1.º). Niveles
 * aproximados al Programa Sintético (Plan 2022) y por validar con docentes.
 * Cada reactivo trae 4 opciones (1 correcta + 3 distractores con error típico) y 3 pistas
 * graduadas que no revelan la respuesta.
 */
import { isSkillInGrade } from '../../modules/curriculum/curriculum.domain.js';
import { fmt } from './random.js';
import { READING_ERROR_EXPLANATIONS, READING_HINTS, READING_TEXTS } from './reading.data.js';

export const QUESTIONS_PER_SKILL_AND_GRADE = 4;

const MAX_ATTEMPTS = 100;

const normalize = (text) =>
  String(text).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** ¿Alguna pista contiene literalmente la respuesta (como palabra/número completo)? */
export function hintsMentionAnswer(hints, answer) {
  const escaped = normalize(answer).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(^|[^\\p{L}\\p{N}/])${escaped}($|[^\\p{L}\\p{N}/])`, 'u');
  return hints.some((hint) => pattern.test(normalize(hint)));
}

function isUsable(question) {
  const texts = [question.correct, ...question.distractors.map((d) => d.text)];
  return (
    question.distractors.length === 3 &&
    new Set(texts.map(normalize)).size === 4 &&
    !hintsMentionAnswer(question.hints, question.correct)
  );
}

const d = (text, tag, explanation) => ({ text: String(text), tag, explanation });

// ───────────────────────── Valor posicional ─────────────────────────

const PLACE_NAMES = [
  'unidades', 'decenas', 'centenas', 'unidades de millar', 'decenas de millar', 'centenas de millar', 'unidades de millón',
  'decenas de millón', 'centenas de millón', 'unidades de millar de millón',
];

/** Cifras por grado: 1.º 2 · 2.º 3 · 3.º 4 · 4.º 5 · 5.º 9 · 6.º 10 (Fase 5: hasta nueve cifras y más). */
const PLACE_DIGITS = { 1: 2, 2: 3, 3: 4, 4: 5, 5: 9, 6: 10 };

function placeValue(grade, rng) {
  const digits = PLACE_DIGITS[grade];
  // Cifras distintas; con 10 cifras entra el 0, que nunca va al inicio ni es la cifra preguntada.
  let cifras = rng.shuffle(digits === 10 ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] : [1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, digits);
  if (cifras[0] === 0) cifras = [...cifras.slice(1), 0];
  const number = Number(cifras.join(''));
  let k = digits === 2 ? 1 : rng.int(1, digits - 1); // lugar contado desde la derecha (0 = unidades)
  if (cifras[digits - 1 - k] === 0) k = k === 1 ? 2 : k - 1;
  const digit = cifras[digits - 1 - k];
  const value = digit * 10 ** k;

  const other = digit === 9 ? 2 : digit + 1;
  const exampleValue = other * 10 ** k;
  const exampleNumber = exampleValue + rng.int(1, 9);

  return {
    stem: `En el número ${fmt(number)}, ¿cuánto vale el ${digit}?`,
    correct: fmt(value),
    distractors: [
      d(fmt(digit), 'face_value', 'Toma solo la cifra sin considerar el lugar que ocupa.'),
      d(fmt(digit * 10 ** (k + 1)), 'place_shift_up', 'Cuenta un lugar de más hacia la izquierda.'),
      k >= 2
        ? d(fmt(digit * 10 ** (k - 1)), 'place_shift_down', 'Cuenta un lugar de menos hacia la izquierda.')
        : d(fmt(number), 'whole_number', 'Da el número completo en lugar del valor de la cifra.'),
    ],
    hints: [
      `Ubica el ${digit} y cuenta su lugar desde la derecha: unidades, decenas, centenas…`,
      `El ${digit} está en las ${PLACE_NAMES[k]}. Cada lugar hacia la izquierda vale 10 veces más que el anterior.`,
      `Ejemplo parecido: en el ${fmt(exampleNumber)}, el ${other} está en las ${PLACE_NAMES[k]} y vale ${fmt(exampleValue)}.`,
    ],
    difficulty: k >= 3 ? 3 : k === 2 ? 2 : 1,
  };
}

const dec = (value) => String(Number(value.toFixed(2)));

/** Número con décimos que nunca es entero (p. ej. 4.5, nunca 4.0). */
function tenths(rng, min, max) {
  let n;
  do n = rng.int(min, max); while (n % 10 === 0);
  return n / 10;
}

/** Entero en el rango que no es múltiplo de 10 (evita "descompón 20" o un producto parcial de 0). */
function notMultipleOf10(rng, min, max) {
  let n;
  do n = rng.int(min, max); while (n % 10 === 0);
  return n;
}

// ───────────────────────── Multiplicación ─────────────────────────

const GROUP_CONTEXTS = [
  { group: 'bolsas', item: 'canicas', each: 'cada una', how: 'Cuántas' },
  { group: 'platos', item: 'galletas', each: 'cada uno', how: 'Cuántas' },
  { group: 'cajas', item: 'crayones', each: 'cada una', how: 'Cuántos' },
  { group: 'mesas', item: 'lápices', each: 'cada una', how: 'Cuántos' },
];

function multiplication(grade, rng) {
  // 2.º: grupos iguales con factores hasta 10 (sumas iteradas).
  if (grade === 2) {
    const a = rng.int(2, 5);
    const b = rng.int(2, 9);
    const c = rng.pick(GROUP_CONTEXTS);
    const product = a * b;
    const y = [2, 3, 4, 5, 6, 7].find((v) => 2 * v !== product && v !== product && v !== b) ?? 2;
    return {
      stem: `Hay ${a} ${c.group} con ${b} ${c.item} ${c.each}. ¿${c.how} ${c.item} hay en total?`,
      correct: String(product),
      distractors: [
        d(a + b, 'adds_instead_of_multiplying', 'Suma los dos números en lugar de juntar grupos iguales.'),
        d(product - b, 'one_group_missing', 'Cuenta un grupo de menos.'),
        d(product + b, 'one_group_extra', 'Cuenta un grupo de más.'),
      ],
      hints: [
        `¿Cuántos grupos hay y ${c.how.toLowerCase()} ${c.item} tiene cada grupo?`,
        `Puedes sumar ${b} tantas veces como ${c.group} haya.`,
        `Ejemplo parecido: 2 ${c.group} con ${y} ${c.item} son ${y} + ${y} = ${2 * y} ${c.item}.`,
      ],
      difficulty: 1,
    };
  }

  // 3.º: repertorio de una cifra.
  if (grade === 3) {
    const a = rng.int(3, 9);
    const b = rng.int(3, 10);
    const [x, y] = [rng.int(2, 9), rng.int(2, 9)];
    return {
      stem: `¿Cuánto es ${a} × ${b}?`,
      correct: String(a * b),
      distractors: [
        d(a + b, 'adds_instead_of_multiplying', 'Suma los números en lugar de multiplicarlos.'),
        d(a * (b - 1), 'neighbor_fact_down', 'Confunde el resultado con el de la tabla anterior.'),
        d(a * (b + 1), 'neighbor_fact_up', 'Confunde el resultado con el de la tabla siguiente.'),
      ],
      hints: [
        `Piensa en ${a} × ${b} como ${b} grupos de ${a}.`,
        `Si ya sabes cuánto es ${a} × ${b - 1}, súmale ${a} más.`,
        `Ejemplo parecido: ${x} × ${y} = ${x * y}, porque son ${y} grupos de ${x}.`,
      ],
      difficulty: 2,
    };
  }

  // 4.º: hasta tres cifras por dos cifras (productos parciales).
  if (grade === 4) {
    const a = rng.int(102, 489);
    const b = notMultipleOf10(rng, 12, 48);
    const bTens = Math.floor(b / 10);
    const bUnits = b % 10;
    const x = rng.int(102, 489);
    const y = notMultipleOf10(rng, 12, 39);
    const yTens = Math.floor(y / 10) * 10;
    const yUnits = y % 10;
    return {
      stem: `¿Cuánto es ${a} × ${b}?`,
      correct: fmt(a * b),
      distractors: [
        d(fmt(a * bUnits + a * bTens), 'forgets_place_shift', 'Olvida que el segundo producto parcial vale decenas (no lo recorre un lugar).'),
        d(fmt(a * bUnits), 'multiplies_only_units', 'Multiplica solo por las unidades del segundo número.'),
        d(fmt(a * (b + 1)), 'one_group_extra', 'Suma un grupo de más al final.'),
      ],
      hints: [
        `Descompón ${b} en decenas y unidades.`,
        `Multiplica ${a} por cada parte; recuerda que el producto por las decenas vale 10 veces más.`,
        `Ejemplo parecido: ${x} × ${y} = ${x} × ${yTens} + ${x} × ${yUnits} = ${fmt(x * yTens)} + ${fmt(x * yUnits)} = ${fmt(x * y)}.`,
      ],
      difficulty: 3,
    };
  }

  // 5.º: número decimal por número natural.
  if (grade === 5) {
    const a = tenths(rng, 11, 99);
    const n = rng.int(3, 9);
    const ex = tenths(rng, 11, 49);
    return {
      stem: `Un listón mide ${dec(a)} m. ¿Cuántos metros miden ${n} listones iguales?`,
      correct: dec(a * n),
      distractors: [
        d(fmt(Math.round(a * 10) * n), 'ignores_decimal_point', 'Multiplica sin tomar en cuenta el punto decimal.'),
        d(dec((a * n) / 10), 'misplaces_decimal_point', 'Coloca el punto decimal en el lugar equivocado.'),
        d(dec(a + n), 'adds_instead_of_multiplying', 'Suma los números en lugar de multiplicarlos.'),
      ],
      hints: [
        `¿Cuántas veces se repite la medida de un listón?`,
        `Multiplica como si no hubiera punto y al final deja tantas cifras decimales como tiene ${dec(a)}.`,
        `Ejemplo parecido: 2 listones de ${dec(ex)} m miden ${dec(ex)} + ${dec(ex)} = ${dec(ex * 2)} m.`,
      ],
      difficulty: 3,
    };
  }

  // 6.º: número decimal entre número natural (reparto).
  // El total a repartir siempre lleva décimos (si no, no es división de decimales).
  let q;
  let n;
  do {
    q = tenths(rng, 11, 99);
    n = rng.int(3, 8);
  } while ((Math.round(q * 10) * n) % 10 === 0);
  const total = q * n;
  const ex = tenths(rng, 11, 49);
  return {
    stem: `Se reparten ${dec(total)} litros de agua en ${n} garrafones iguales. ¿Cuántos litros lleva cada garrafón?`,
    correct: dec(q),
    distractors: [
      d(fmt(Math.round(q * 10)), 'ignores_decimal_point', 'Divide sin tomar en cuenta el punto decimal.'),
      d(dec(q / 10), 'misplaces_decimal_point', 'Coloca el punto decimal en el lugar equivocado.'),
      d(dec(total * n), 'multiplies_instead_of_dividing', 'Multiplica cuando el problema pide repartir.'),
    ],
    hints: [
      '¿Qué operación sirve para repartir en partes iguales?',
      `Divide ${dec(total)} entre ${n}; puedes pensar primero en los enteros y luego en los décimos.`,
      `Ejemplo parecido: ${dec(ex * 2)} litros en 2 garrafones son ${dec(ex)} litros en cada uno.`,
    ],
    difficulty: 3,
  };
}

// ───────────────────────── Fracciones ─────────────────────────

const STRIP_OBJECTS = ['tira de papel', 'barra de chocolate', 'cuerda'];
/** Pares de denominadores sin múltiplo común obvio para 6.º (denominador común = producto). */
const COPRIME_PAIRS = [[2, 3], [3, 4], [2, 5], [3, 5], [4, 5]];
const coprimeNumerator = (den, rng) => {
  const options = Array.from({ length: den - 1 }, (_, i) => i + 1).filter((n) => {
    let [x, y] = [n, den];
    while (y) [x, y] = [y, x % y];
    return x === 1;
  });
  return rng.pick(options);
};

function fractions(grade, rng) {
  // 3.º: medios, cuartos y octavos con modelos de tiras (primer acercamiento formal).
  if (grade === 3) {
    const den = rng.pick([4, 8]);
    const num = rng.int(1, den - 1);
    const obj = rng.pick(STRIP_OBJECTS);
    const exDen = den === 4 ? 8 : 4;
    // El ejemplo nunca vale lo mismo que la respuesta (3/4 revelaría 6/8).
    let exNum;
    do exNum = rng.int(1, exDen - 1); while (exNum * den === num * exDen);
    return {
      stem: `Una ${obj} se divide en ${den} partes iguales y se ${num === 1 ? 'pinta' : 'pintan'} ${num}. ¿Qué fracción de la ${obj} está pintada?`,
      // El dibujo es la pregunta: la misma tira que describe el enunciado.
      visual: { type: 'fraction_bar', parts: den, shaded: num },
      correct: `${num}/${den}`,
      distractors: [
        d(`${den}/${num}`, 'inverts_fraction', 'Invierte el numerador y el denominador.'),
        d(`${den - num}/${den}`, 'counts_unshaded', 'Cuenta las partes sin pintar.'),
        d(`${num}/${den - num}`, 'part_to_part', 'Compara las partes pintadas con las no pintadas en lugar de con el total.'),
      ],
      hints: [
        'Cuenta todas las partes: pintadas y sin pintar.',
        'El total de partes va abajo y las partes pintadas van arriba.',
        `Ejemplo parecido: si de ${exDen} partes iguales pintas ${exNum}, está pintado ${exNum}/${exDen}.`,
      ],
      difficulty: 2,
    };
  }

  // 4.º: fracciones equivalentes (tercios, quintos, sextos).
  if (grade === 4) {
    const den = rng.pick([3, 5, 6]);
    const num = rng.int(1, den - 1);
    const k = rng.int(2, 3);
    const exDen = den === 5 ? 3 : 5;
    const exK = k === 2 ? 3 : 2;
    return {
      stem: `¿Qué fracción es equivalente a ${num}/${den}?`,
      correct: `${num * k}/${den * k}`,
      distractors: [
        d(`${num * k}/${den}`, 'multiplies_only_numerator', 'Multiplica solo el numerador.'),
        d(`${num}/${den * k}`, 'multiplies_only_denominator', 'Multiplica solo el denominador.'),
        d(`${num + k}/${den + k}`, 'adds_same_number', 'Suma el mismo número arriba y abajo en lugar de multiplicar.'),
      ],
      hints: [
        'Una fracción equivalente representa la misma parte del entero.',
        'Multiplica el numerador y el denominador por el mismo número.',
        `Ejemplo parecido: 1/${exDen} = ${exK}/${exDen * exK}, porque 1 × ${exK} = ${exK} y ${exDen} × ${exK} = ${exDen * exK}.`,
      ],
      difficulty: 2,
    };
  }

  // 5.º: suma con distinto denominador cuando uno es múltiplo del otro.
  if (grade === 5) {
    const den = rng.int(2, 6);
    const n1 = rng.int(1, den - 1);
    const n2 = rng.int(1, 2 * den - 1);
    const big = 2 * den;
    // Ejemplo con otro denominador: ninguna fracción de la pista (1/e, 1/2e, 2/2e, 3/2e) puede valer
    // lo mismo que la respuesta (2·n1 + n2)/big; si no, la revelaría.
    const answerNum = 2 * n1 + n2;
    const sameValue = (num, den2) => num * big === answerNum * den2;
    const exDen = [3, 4, 5, 7, 9].find((e) => e !== den
      && !sameValue(1, e) && !sameValue(1, 2 * e) && !sameValue(3, 2 * e));
    return {
      stem: `Calcula ${n1}/${den} + ${n2}/${big}.`,
      correct: `${2 * n1 + n2}/${big}`,
      distractors: [
        d(`${n1 + n2}/${den + big}`, 'adds_denominators', 'Suma también los denominadores.'),
        d(`${n1 + n2}/${big}`, 'no_common_denominator', 'Suma los numeradores sin convertir antes a un denominador común.'),
        d(`${2 * n1 + n2}/${den}`, 'keeps_smaller_denominator', 'Convierte el numerador pero conserva el denominador menor.'),
      ],
      hints: [
        'Los denominadores son distintos: ¿uno es múltiplo del otro?',
        `Convierte ${n1}/${den} en una fracción equivalente con denominador ${big}.`,
        `Ejemplo parecido: 1/${exDen} + 1/${2 * exDen} = 2/${2 * exDen} + 1/${2 * exDen} = 3/${2 * exDen}.`,
      ],
      difficulty: 3,
    };
  }

  // 6.º: suma con denominadores distintos sin múltiplo obvio (denominador común = producto).
  const [d1, d2] = rng.pick(COPRIME_PAIRS);
  const n1 = coprimeNumerator(d1, rng);
  const n2 = coprimeNumerator(d2, rng);
  const common = d1 * d2;
  const [e1, e2] = COPRIME_PAIRS.find(([a, b]) => a !== d1 || b !== d2);
  return {
    stem: `Calcula ${n1}/${d1} + ${n2}/${d2}.`,
    correct: `${n1 * d2 + n2 * d1}/${common}`,
    distractors: [
      d(`${n1 + n2}/${d1 + d2}`, 'adds_denominators', 'Suma también los denominadores.'),
      d(`${n1 + n2}/${common}`, 'no_equivalent_numerators', 'Usa un denominador común pero no convierte los numeradores.'),
      d(`${n1 + n2}/${Math.max(d1, d2)}`, 'keeps_larger_denominator', 'Suma los numeradores y conserva el denominador mayor.'),
    ],
    hints: [
      'Los denominadores son distintos y ninguno es múltiplo del otro: busca un denominador común.',
      `Un denominador común de ${d1} y ${d2} es ${common}; convierte cada fracción a una equivalente con ese denominador.`,
      `Ejemplo parecido: 1/${e1} + 1/${e2} = ${e2}/${e1 * e2} + ${e1}/${e1 * e2} = ${e1 + e2}/${e1 * e2}.`,
    ],
    difficulty: 3,
  };
}

// ───────────────────────── Resolución de problemas ─────────────────────────

const PEOPLE = ['Ana', 'Luis', 'Rosa', 'Beto', 'Carmen', 'Tomás', 'Lía', 'Hugo'];
const ITEMS = ['canicas', 'estampas', 'galletas', 'semillas', 'calcomanías'];
const ONE_STEP_RANGES = {
  1: { a: [9, 15], b: [2, 6], delta: 1 },
  2: { a: [35, 89], b: [11, 29], delta: 10 },
  3: { a: [350, 899], b: [105, 299], delta: 10 },
  4: { a: [3500, 8999], b: [1050, 2999], delta: 100 },
};

function problemSolving(grade, rng) {
  const name = rng.pick(PEOPLE);

  if (grade <= 4) {
    const r = ONE_STEP_RANGES[grade];
    const a = rng.int(...r.a);
    const b = rng.int(...r.b);
    const c = rng.int(...r.b);
    const item = rng.pick(ITEMS);
    const adds = rng.chance(0.5);
    const correct = adds ? a + b : a - b;
    const calcError = grade === 1
      ? d(fmt(correct + 1), 'counting_error', 'Cuenta uno de más.')
      : d(fmt(correct + r.delta), 'regrouping_error', 'Se equivoca al reagrupar al hacer la operación.');
    const [x, y] = [rng.int(4, 9), rng.int(2, 3)];

    return {
      stem: adds
        ? `${name} tenía ${fmt(a)} ${item}. Le regalaron ${fmt(b)} más. Su primo tiene ${fmt(c)} ${item}. ¿Cuántas ${item} tiene ${name} ahora?`
        : `${name} tenía ${fmt(a)} ${item} y regaló ${fmt(b)} a sus amigos. Su primo tiene ${fmt(c)} ${item}. ¿Cuántas ${item} le quedan a ${name}?`,
      correct: fmt(correct),
      distractors: [
        d(fmt(adds ? a - b : a + b), 'wrong_operation', adds ? 'Resta cuando la cantidad aumenta.' : 'Suma cuando la cantidad disminuye.'),
        d(fmt(adds ? a + c : a - c), 'uses_irrelevant_data', 'Usa un dato que no sirve para responder la pregunta.'),
        calcError,
      ],
      hints: [
        '¿Qué pregunta el problema? Subraya solo los datos que sirven para responder.',
        `¿A ${name} le dieron o le quitaron ${item}? Eso te dice si debes sumar o restar.`,
        adds
          ? `Ejemplo parecido: si tienes ${x} y te regalan ${y}, ahora tienes ${x + y}; lo que tiene otra persona no cambia tu cantidad.`
          : `Ejemplo parecido: si tienes ${x} y regalas ${y}, te quedan ${x - y}; lo que tiene otra persona no cambia tu cantidad.`,
      ],
      difficulty: grade <= 2 ? 1 : 2,
    };
  }

  const money = (n) => `$${fmt(n)}`;
  const example = 'Ejemplo parecido: 3 lápices de $7 cuestan $21; si pagas con $50, te dan $29 de cambio.';

  if (grade === 5) {
    const n = rng.int(2, 6);
    const p = rng.int(12, 45);
    const total = n * p;
    const bill = total < 200 ? 200 : 500;
    return {
      stem: `${name} compra ${n} cuadernos de ${money(p)} cada uno y paga con un billete de ${money(bill)}. ¿Cuánto le dan de cambio?`,
      correct: money(bill - total),
      distractors: [
        d(money(bill - p), 'ignores_quantity', 'Usa el precio de un solo cuaderno.'),
        d(money(total), 'stops_at_first_step', 'Calcula el total de la compra pero no el cambio.'),
        d(money(bill + total), 'wrong_operation', 'Suma cuando debe restar.'),
      ],
      hints: [
        '¿Qué pregunta el problema? Subraya solo los datos que sirven para responder.',
        'Primero calcula cuánto cuesta toda la compra; después piensa cuánto sobra del billete.',
        example,
      ],
      difficulty: 3,
    };
  }

  const n = rng.int(2, 5);
  const p = rng.int(25, 85);
  const q = rng.int(150, 350);
  const total = n * p + q;
  const bill = total < 500 ? 500 : 1000;
  return {
    stem: `${name} compra ${n} libretas de ${money(p)} cada una y una mochila de ${money(q)}. Paga con un billete de ${money(bill)}. ¿Cuánto le dan de cambio?`,
    correct: money(bill - total),
    distractors: [
      d(money(bill - n * p), 'forgets_an_item', 'Olvida sumar uno de los artículos.'),
      d(money(total), 'stops_at_first_step', 'Calcula el total de la compra pero no el cambio.'),
      d(money(bill - (p + q)), 'ignores_quantity', 'Usa el precio de una sola libreta.'),
    ],
    hints: [
      '¿Qué pregunta el problema? Anota qué compra y cuánto cuesta cada cosa.',
      'Primero calcula cuánto cuesta toda la compra (todas las libretas y la mochila); después resta del billete.',
      example,
    ],
    difficulty: 3,
  };
}

// ───────────────────────── Comprensión lectora ─────────────────────────

function readingQuestions(grade) {
  const text = READING_TEXTS.find((t) => t.grade === grade);
  return text.questions.map((item) => ({
    stem: `${text.title}\n\n${text.text}\n\n${item.q}`,
    correct: item.correct,
    distractors: item.distractors.map(([optionText, tag]) => d(optionText, tag, READING_ERROR_EXPLANATIONS[tag])),
    hints: READING_HINTS[item.type],
    difficulty: item.type === 'detail' ? 1 : item.type === 'main' ? 2 : 3,
  }));
}

// ───────────────────────── Banco completo ─────────────────────────

const GENERATORS = {
  place_value: placeValue,
  multiplication,
  fractions,
  problem_solving: problemSolving,
};

/**
 * @returns {Array<{ skill: string, grade: number, stem: string, correct: string, distractors: Array, hints: string[], difficulty: number }>}
 */
export function generateQuestionBank(rng) {
  const bank = [];
  for (let grade = 1; grade <= 6; grade += 1) {
    for (const [skill, generate] of Object.entries(GENERATORS)) {
      if (!isSkillInGrade(skill, grade)) continue;
      const stems = new Set();
      while (stems.size < QUESTIONS_PER_SKILL_AND_GRADE) {
        let question = null;
        for (let attempt = 0; attempt < MAX_ATTEMPTS && !question; attempt += 1) {
          const candidate = generate(grade, rng);
          if (isUsable(candidate) && !stems.has(candidate.stem)) question = candidate;
        }
        if (!question) throw new Error(`No se pudo generar un reactivo válido (${skill}, ${grade}.º)`);
        stems.add(question.stem);
        bank.push({ skill, grade, ...question });
      }
    }

    for (const question of readingQuestions(grade)) {
      if (!isUsable(question)) throw new Error(`Reactivo de lectura inválido (${grade}.º): ${question.stem}`);
      bank.push({ skill: 'reading_comprehension', grade, ...question });
    }
  }
  return bank;
}
