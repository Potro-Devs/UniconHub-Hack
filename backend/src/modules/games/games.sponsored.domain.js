/**
 * Juegos con patrocinio educativo (DEMO, sin convenios). Reglas puras, sin diagnóstico ni persistencia.
 *
 * Modelo: una marca relacionada con la escuela financia un juego de aprendizaje; aparece solo como
 * "Este juego lo hace posible …". Sin anuncios, sin enlaces, sin el producto dentro de los retos y
 * nunca en pruebas, diagnósticos ni Modo Papel. Mientras no haya convenios, el patrocinador en el
 * repo es siempre "Marca patrocinadora de ejemplo" (`demo: true`). Para una demo, el servidor puede
 * mostrar otros nombres y logos desde una carpeta propia (`games.demo-sponsors.js`), nunca desde git.
 * Roadmap: interruptor por escuela/zona y conteo de partidas agregado y anónimo.
 */
import { DomainError } from '../../shared/errors/DomainError.js';

export const DEMO_SPONSOR_NAME = 'Marca patrocinadora de ejemplo';
const sponsor = (category) => Object.freeze({ name: DEMO_SPONSOR_NAME, category, demo: true, logoUrl: null });

const MAX_DEMO_NAME = 60;
const LOGO_FILE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,60}\.(png|jpe?g|webp|svg)$/i;

/**
 * Valida `patrocinadores.json` (marcas de demostración del servidor). Solo acepta los juegos
 * patrocinados, un nombre de 1–60 caracteres y un logo que exista en la carpeta, con nombre simple
 * (sin rutas). Lo inválido se ignora con un aviso: nunca rompe el arranque.
 *
 * @param {unknown} raw contenido del JSON
 * @param {Set<string>} files archivos presentes en la carpeta
 * @returns {{ overrides: Map<string, { name: string, logo: string | null }>, warnings: string[] }}
 */
export function parseDemoSponsorsConfig(raw, files) {
  const overrides = new Map();
  const warnings = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { overrides, warnings: ['El archivo debe ser un objeto JSON.'] };
  for (const [code, entry] of Object.entries(raw)) {
    if (!SPONSORED_CATALOG.some((game) => game.code === code)) { warnings.push(`"${code}" no es un juego patrocinado; se ignora.`); continue; }
    const name = typeof entry?.name === 'string' ? entry.name.trim() : '';
    if (!name || name.length > MAX_DEMO_NAME) { warnings.push(`"${code}": falta el nombre o pasa de ${MAX_DEMO_NAME} caracteres.`); continue; }
    let logo = null;
    if (entry.logo != null) {
      if (typeof entry.logo !== 'string' || !LOGO_FILE.test(entry.logo)) warnings.push(`"${code}": el logo debe ser un archivo .png, .jpg, .webp o .svg sin carpetas.`);
      else if (!files.has(entry.logo)) warnings.push(`"${code}": no encontré el archivo ${entry.logo}.`);
      else logo = entry.logo;
    }
    overrides.set(code, { name, logo });
  }
  return { overrides, warnings };
}

/** Aplica la marca de demostración del servidor a un juego patrocinado (sigue siendo `demo: true`). */
export function applyDemoSponsor(game, override, logoUrlFor) {
  if (!game?.sponsor || !override) return game;
  return { ...game, sponsor: { ...game.sponsor, name: override.name, logoUrl: logoUrlFor(override.logo) } };
}

export const SPONSORED_CATALOG = Object.freeze([
  Object.freeze({ code: 'grammar_fix', title: 'Corrige el cuaderno', skillCode: null, area: 'Lenguajes',
    description: 'Encuentra la palabra con un error en la oración y elige cómo se escribe bien.',
    sponsor: sponsor('Cuadernos y papelería') }),
  Object.freeze({ code: 'mental_math', title: 'Reto de cálculo mental', skillCode: null, area: 'Saberes y pensamiento científico',
    description: 'Elige las dos tarjetas que juntas llegan a la meta. ¡Sin calculadora!',
    sponsor: sponsor('Calculadoras') }),
  Object.freeze({ code: 'symmetry', title: 'Completa la figura', skillCode: null, area: 'Saberes y pensamiento científico',
    description: 'Pinta el otro lado para que la figura quede igual que en un espejo.',
    sponsor: sponsor('Útiles escolares') }),
]);

const band = (grade) => (grade <= 2 ? 0 : grade <= 4 ? 1 : 2);

// ───────── Corrige el cuaderno: [palabras, índice con error, opciones, opción correcta, pistas 2 y 3] ─────────
const GRAMMAR = [
  [
    [['El', 'pero', 'corre', 'en', 'el', 'parque.'], 1, ['pelo', 'perro', 'pera'], 1,
      'Algunas palabras cambian de significado si llevan r o rr entre vocales.',
      'Por ejemplo, "caro" y "carro" significan cosas distintas: el sonido fuerte entre vocales se escribe con rr.'],
    [['Mi', 'mamá', 'compró', 'una', 'bolsa', 'de', 'manzanaz.'], 6, ['manzanes', 'mansanas', 'manzanas'], 2,
      'Revisa cómo termina cada palabra cuando habla de varias cosas.',
      'Por ejemplo, de "lápiz" se dice "lápices" y de "flor" se dice "flores": el plural no termina en z.'],
    [['Ayer', 'yo', 'jugé', 'con', 'mis', 'amigos.'], 2, ['jugué', 'juge', 'jugúe'], 0,
      'Lee despacio las palabras que dicen lo que alguien hizo. ¿Alguna suena distinta de como está escrita?',
      'Por ejemplo, de "llegar" se escribe "llegué": a veces hace falta una u para conservar el sonido.'],
  ],
  [
    [['Los', 'niños', 'juega', 'en', 'el', 'patio.'], 2, ['juego', 'juegan', 'jugamos'], 1,
      'Fíjate quién hace la acción: ¿es una persona o son varias?',
      'Por ejemplo, se dice "la niña canta" y "las niñas cantan": la acción cambia si son varios.'],
    [['Mañana', 'vamos', 'al', 'museo', 'y', 'aprendimos', 'mucho.'], 5, ['aprendíamos', 'aprenderemos', 'aprendieron'], 1,
      'La oración dice cuándo pasa todo. ¿Todas las acciones están en el mismo tiempo?',
      'Por ejemplo, "El sábado iremos al cine y comeremos palomitas": ambas acciones hablan del futuro.'],
    [['¿Donde', 'dejaste', 'tu', 'cuaderno?'], 0, ['¿Dónde', '¿De', '¿Adónde'], 0,
      'Las palabras que preguntan, como qué, cómo o cuándo, tienen algo especial al escribirse.',
      'Por ejemplo, se escribe "¿Cuándo llegas?" con acento, pero "Te aviso cuando llegue" sin acento.'],
  ],
  [
    [['Hubieron', 'muchas', 'personas', 'en', 'la', 'feria.'], 0, ['Habían', 'Hubo', 'Hubimos'], 1,
      'Una de las palabras habla de que algo existió. Esa forma no cambia aunque sean muchas cosas.',
      'Por ejemplo, se dice "Hay un perro" y también "Hay tres perros": "hay" no cambia.'],
    [['El', 'agua', 'esta', 'muy', 'fría', 'hoy.'], 2, ['estás', 'está', 'ésta'], 1,
      'Busca la palabra que dice cómo se encuentra algo. ¿Dónde suena más fuerte?',
      'Por ejemplo, "papá" y "papa" significan cosas distintas por el acento en la última sílaba.'],
    [['Escribí', 'un', 'resúmen', 'del', 'cuento.'], 2, ['resumen', 'resumén', 'resúmenes'], 0,
      'Pronuncia cada palabra y fíjate dónde suena más fuerte. ¿Hace falta el acento que tiene?',
      'Por ejemplo, "joven" no lleva acento escrito porque suena fuerte en la penúltima sílaba y termina en n.'],
  ],
];

// ───────── Reto de cálculo mental: [meta, tarjetas]; exactamente un par suma la meta ─────────
const MENTAL = {
  1: [[10, [3, 6, 7, 2]], [12, [5, 9, 7, 4]], [15, [8, 6, 9, 4]]],
  2: [[20, [12, 9, 8, 13]], [30, [14, 17, 16, 12]], [50, [25, 18, 32, 27]]],
  3: [[100, [45, 37, 55, 64]], [200, [120, 95, 80, 115]], [250, [130, 147, 120, 95]]],
  4: [[100, [45, 37, 55, 64]], [500, [260, 175, 240, 310]], [1000, [450, 380, 550, 610]]],
  5: [[1000, [450, 380, 550, 610]], [1, [0.25, 0.6, 0.75, 0.3]], [750, [400, 280, 350, 460]]],
  6: [[1000, [450, 380, 550, 610]], [1, [0.25, 0.6, 0.75, 0.3]], [2.5, [1.2, 0.8, 1.3, 1.6]]],
};

// ───────── Completa la figura: mitad izquierda (1 = pintado); se pinta la derecha en espejo ─────────
const SYMMETRY = [
  [['10', '11', '01', '10'], ['01', '11', '10', '01'], ['11', '10', '10', '11']],
  [['100', '110', '011', '001', '110', '100'], ['011', '001', '111', '001', '011', '010'], ['101', '010', '110', '011', '010', '101']],
  // 5.º y 6.º: más filas y figuras menos regulares (mitad de 3 para que cada cuadro mida 44 px o más en celular).
  [['100', '110', '011', '001', '011', '110', '100'], ['001', '011', '110', '100', '111', '010', '001'], ['101', '011', '001', '111', '100', '010', '110']],
];

const toCents = (value) => Math.round(value * 100);
const fmt = (value) => (Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0$/, ''));

export function findSponsoredGame(gameCode) {
  const game = SPONSORED_CATALOG.find((entry) => entry.code === gameCode);
  return game ? { ...game, sponsor: { ...game.sponsor } } : null;
}

/** Tres retos deterministas por grado. El `material` nunca incluye la respuesta. */
export function buildSponsoredRounds(gameCode, grade) {
  if (gameCode === 'grammar_fix') return GRAMMAR[band(grade)].map(([words, , options, , hint2, hint3], index) => ({
    id: `${gameCode}-${index + 1}`,
    prompt: 'Encuentra la palabra que tiene un error.',
    instruction: 'Primero toca la palabra que está mal escrita. Después elige cómo se escribe bien.',
    material: { words: [...words], options: [...options] },
    hints: ['Lee la oración completa en voz baja y fíjate en cada palabra, una por una.', hint2, hint3],
  }));
  if (gameCode === 'mental_math') return MENTAL[grade].map(([target, cards], index) => ({
    id: `${gameCode}-${index + 1}`,
    prompt: `Elige dos tarjetas que juntas sumen ${fmt(target)}.`,
    instruction: 'Toca dos tarjetas. Puedes tocar una otra vez para soltarla. Piénsalo sin calculadora.',
    material: { target, cards: [...cards] },
    hints: [
      'Toma una tarjeta y piensa cuánto le falta para llegar a la meta.',
      !cards.every(Number.isInteger) ? 'Piensa en partes de un entero: por ejemplo, cuartos o décimos que se completan.'
        : 'Redondea a la decena o centena más cercana, suma y después ajusta lo que redondeaste.',
      'En otro ejemplo, para llegar a 40 con la tarjeta 25 faltan 15, así que buscarías la tarjeta 15. Haz lo mismo con tu meta.',
    ],
  }));
  if (gameCode === 'symmetry') {
    const sizes = SYMMETRY[band(grade)];
    return sizes.map((rows, index) => ({
      id: `${gameCode}-${index + 1}`,
      prompt: 'Pinta el lado derecho para que la figura quede igual que en un espejo.',
      instruction: 'La línea del centro es el espejo. Toca los cuadros del lado derecho para pintarlos o despintarlos.',
      material: { rows: rows.length, half: rows[0].length, left: rows.map((row) => [...row].map((cell) => cell === '1')) },
      hints: [
        'Mira la línea del centro: es como un espejo que refleja el lado izquierdo.',
        'Trabaja una fila a la vez: el cuadro pegado a la línea se refleja pegado a la línea.',
        'En otro ejemplo, si a la izquierda está pintado el cuadro más lejano de la línea, a la derecha también se pinta el más lejano.',
      ],
    }));
  }
  throw new RangeError('Juego desconocido.');
}

const invalid = () => new DomainError('VALIDATION_ERROR', 'Envía tu respuesta con los controles del juego.');
const isIndex = (value, length) => Number.isInteger(value) && value >= 0 && value < length;

/** Revisa la respuesta del reto; una respuesta incorrecta válida no es un error HTTP. */
export function checkSponsoredAnswer(gameCode, round, grade, answer) {
  const index = Number(round.id.split('-').pop()) - 1;
  if (gameCode === 'grammar_fix') {
    const { words, options } = round.material;
    if (!answer || typeof answer !== 'object' || Array.isArray(answer) || Object.keys(answer).length !== 2
      || !isIndex(answer.wordIndex, words.length) || !isIndex(answer.optionIndex, options.length)) throw invalid();
    const [, errorIndex, , fixIndex] = GRAMMAR[band(grade)][index];
    const foundWord = answer.wordIndex === errorIndex;
    const correct = foundWord && answer.optionIndex === fixIndex;
    return { correct, explanation: correct ? 'Encontraste la palabra y la escribiste bien. ¡Así se lee mejor!'
      : foundWord ? 'Encontraste la palabra con el error. Revisa otra vez cómo se escribe.'
        : 'Vuelve a leer la oración: una palabra se escribe distinto de como aparece.' };
  }
  if (gameCode === 'mental_math') {
    const { cards, target } = round.material;
    if (!Array.isArray(answer) || answer.length !== 2 || !answer.every((i) => isIndex(i, cards.length)) || answer[0] === answer[1]) throw invalid();
    const correct = toCents(cards[answer[0]]) + toCents(cards[answer[1]]) === toCents(target);
    return { correct, explanation: correct ? 'Las dos tarjetas juntas llegan justo a la meta.'
      : 'Esas dos tarjetas no llegan justo a la meta. Piensa cuánto le falta a una de ellas.' };
  }
  if (gameCode === 'symmetry') {
    const { rows, half, left } = round.material;
    if (!Array.isArray(answer) || answer.length !== rows
      || !answer.every((row) => Array.isArray(row) && row.length === half && row.every((cell) => typeof cell === 'boolean'))) throw invalid();
    const correct = answer.every((row, r) => row.every((cell, c) => cell === left[r][half - 1 - c]));
    return { correct, explanation: correct ? 'Los dos lados quedaron iguales, como en un espejo.'
      : 'Compara cada fila con su reflejo: el cuadro más cerca de la línea va más cerca de la línea.' };
  }
  throw invalid();
}
