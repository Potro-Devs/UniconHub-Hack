/**
 * Banco de reactivos demo calibrado de 1.º a 6.º para las 5 habilidades clave.
 * Cada reactivo trae 4 opciones (1 correcta + 3 distractores con error típico) y 3 pistas
 * graduadas que no revelan la respuesta.
 */
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
];

function placeValue(grade, rng) {
  const digits = grade + 1;
  const cifras = rng.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, digits);
  const number = Number(cifras.join(''));
  const k = digits === 2 ? 1 : rng.int(1, digits - 1); // lugar contado desde la derecha (0 = unidades)
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

// ───────────────────────── Multiplicación ─────────────────────────

const GROUP_CONTEXTS = [
  { group: 'bolsas', item: 'canicas', each: 'cada una', how: 'Cuántas' },
  { group: 'platos', item: 'galletas', each: 'cada uno', how: 'Cuántas' },
  { group: 'cajas', item: 'crayones', each: 'cada una', how: 'Cuántos' },
  { group: 'mesas', item: 'lápices', each: 'cada una', how: 'Cuántos' },
];

function multiplication(grade, rng) {
  if (grade <= 2) {
    const a = rng.int(2, grade === 1 ? 4 : 5);
    const b = rng.int(2, grade === 1 ? 5 : 9);
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
      difficulty: grade,
    };
  }

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

  if (grade === 4) {
    const a = rng.int(1, 4) * 10 + rng.int(3, 9); // unidades ≥ 3 para que haya reagrupación
    const b = rng.int(3, 9);
    const carryless = Math.floor(a / 10) * b * 10 + ((a % 10) * b) % 10;
    const x = rng.int(1, 4) * 10 + rng.int(3, 9);
    const y = rng.int(3, 9);
    return {
      stem: `¿Cuánto es ${a} × ${b}?`,
      correct: fmt(a * b),
      distractors: [
        d(fmt(carryless), 'ignores_carry', 'Olvida sumar lo que se lleva de las unidades a las decenas.'),
        d(fmt(Math.floor(a / 10) * 10 * b), 'multiplies_only_tens', 'Multiplica solo las decenas y olvida las unidades.'),
        d(fmt(a + b), 'adds_instead_of_multiplying', 'Suma los números en lugar de multiplicarlos.'),
      ],
      hints: [
        `Descompón ${a} en decenas y unidades.`,
        'Multiplica las decenas y las unidades por separado y al final suma los dos resultados.',
        `Ejemplo parecido: ${x} × ${y} = ${Math.floor(x / 10) * 10} × ${y} + ${x % 10} × ${y} = ${fmt(Math.floor(x / 10) * 10 * y)} + ${x % 10 * y} = ${fmt(x * y)}.`,
      ],
      difficulty: 2,
    };
  }

  // 5.º: dos cifras × dos cifras · 6.º: tres cifras × dos cifras
  const a = grade === 5 ? rng.int(23, 98) : rng.int(102, 489);
  const b = rng.int(12, grade === 5 ? 39 : 48);
  const bTens = Math.floor(b / 10);
  const bUnits = b % 10;
  const x = grade === 5 ? rng.int(23, 98) : rng.int(102, 489);
  const y = rng.int(12, 39);
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

// ───────────────────────── Fracciones ─────────────────────────

const UNIT_NAMES = { 2: 'un medio', 3: 'un tercio', 4: 'un cuarto', 5: 'un quinto', 6: 'un sexto', 8: 'un octavo' };
const WHOLE_OBJECTS = ['pizza', 'naranja', 'tortilla', 'hoja de papel'];
const STRIP_OBJECTS = ['tira de papel', 'barra de chocolate', 'cuerda'];

function fractions(grade, rng) {
  if (grade === 1) {
    const parts = rng.pick([2, 3, 4]);
    const [o1, o2] = [2, 3, 4].filter((n) => n !== parts);
    const example = rng.pick([5, 6, 8]);
    return {
      stem: `Se parte una ${rng.pick(WHOLE_OBJECTS)} en ${parts} partes iguales. ¿Cómo se llama cada parte?`,
      correct: UNIT_NAMES[parts],
      distractors: [
        d(UNIT_NAMES[o1], 'confuses_unit_fraction', 'Confunde el nombre de la fracción con el de otra cantidad de partes.'),
        d(UNIT_NAMES[o2], 'confuses_unit_fraction', 'Confunde el nombre de la fracción con el de otra cantidad de partes.'),
        d('un entero', 'part_as_whole', 'Confunde una parte con el entero completo.'),
      ],
      hints: [
        'Cuenta en cuántas partes iguales quedó.',
        'El nombre de cada parte depende de cuántas partes iguales hay en total.',
        `Ejemplo parecido: si partes un pastel en ${example} partes iguales, cada parte es ${UNIT_NAMES[example]}.`,
      ],
      difficulty: 1,
    };
  }

  if (grade <= 3) {
    const den = grade === 2 ? rng.int(3, 4) : rng.int(3, 8);
    const num = rng.int(1, den - 1);
    const obj = rng.pick(STRIP_OBJECTS);
    const exDen = den === 5 ? 6 : 5;
    const exNum = rng.int(1, exDen - 1);
    return {
      stem: `Una ${obj} se divide en ${den} partes iguales y se ${num === 1 ? 'pinta' : 'pintan'} ${num}. ¿Qué fracción de la ${obj} está pintada?`,
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
      difficulty: grade - 1,
    };
  }

  if (grade === 4) {
    const den = rng.int(2, 6);
    const num = rng.int(1, den - 1);
    const k = rng.int(2, 4);
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

  if (grade === 5) {
    const den = rng.int(5, 12);
    const n1 = rng.int(1, Math.floor(den / 2));
    const n2 = rng.int(1, den - n1);
    const exDen = den === 7 ? 9 : 7;
    return {
      stem: `Ana pintó ${n1}/${den} de una barda y Luis pintó ${n2}/${den}. ¿Qué parte de la barda pintaron entre los dos?`,
      correct: `${n1 + n2}/${den}`,
      distractors: [
        d(`${n1 + n2}/${2 * den}`, 'adds_denominators', 'Suma también los denominadores.'),
        d(`${n1 * n2}/${den}`, 'multiplies_numerators', 'Multiplica los numeradores en lugar de sumarlos.'),
        d(`${Math.abs(n1 - n2)}/${den}`, 'wrong_operation', 'Resta en lugar de sumar.'),
      ],
      hints: [
        'Fíjate: las dos fracciones tienen el mismo denominador.',
        'Si las partes son del mismo tamaño, solo sumas cuántas partes hay; el denominador no cambia.',
        `Ejemplo parecido: 2/${exDen} + 3/${exDen} = 5/${exDen}.`,
      ],
      difficulty: 2,
    };
  }

  // 6.º: un denominador es el doble del otro
  const den = rng.int(2, 6);
  const n1 = rng.int(1, den - 1);
  const n2 = rng.int(1, 2 * den - 1);
  const big = 2 * den;
  const exDen = den === 3 ? 4 : 3;
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
