/**
 * Datos fijos del seed demo: escuela, docente, alumnos ficticios, temario y actividades.
 * Todos los nombres son ficticios. No se usa CURP.
 */

export const DEMO = Object.freeze({
  schoolName: 'Escuela Primaria Demo Axi',
  teacher: { email: 'docente@axi.demo', password: 'AxiDemo2026', fullName: 'Mtra. Elena Torres' },
  // Misma contraseña que la docente demo (en una base nueva se reutiliza el hash).
  director: { email: 'direccion@axi.demo', password: 'AxiDemo2026', fullName: 'Mtro. Ricardo Salinas' },
  currentGroup: { grade: 3, section: 'A', schoolYear: '2026-2027', joinCode: 'MAPA3A' },
  previousGroups: [
    { grade: 1, section: 'A', schoolYear: '2024-2025', joinCode: 'PRMA2X', endedAt: '2025-07-15 12:00:00' },
    { grade: 2, section: 'A', schoolYear: '2025-2026', joinCode: 'SEGA2A', endedAt: '2026-07-15 12:00:00' },
  ],
});

export const SKILLS = Object.freeze([
  { code: 'place_value', name: 'Valor posicional' },
  { code: 'problem_solving', name: 'Resolución de problemas' },
  { code: 'multiplication', name: 'Multiplicación' },
  { code: 'fractions', name: 'Fracciones' },
  { code: 'reading_comprehension', name: 'Comprensión lectora' },
]);

/** Promedio base del grupo actual por habilidad (alineado con el prototipo del frontend). */
export const SKILL_BASE = Object.freeze({
  place_value: 62,
  problem_solving: 44,
  multiplication: 50,
  fractions: 38,
  reading_comprehension: 56,
});

export const FIRST_NAMES = Object.freeze([
  'Sofía', 'Mateo', 'Valentina', 'Santiago', 'Regina', 'Diego', 'Ximena', 'Emiliano', 'Camila',
  'Leonardo', 'Renata', 'Iker', 'Valeria', 'Sebastián', 'Daniela', 'Gael', 'Mariana', 'Andrés',
  'Fernanda', 'Tadeo', 'Natalia', 'Julián', 'Paula', 'Rodrigo', 'Itzel', 'Bruno', 'Abril',
  'Joaquín', 'Lucía', 'Emilio', 'Ana Paula', 'Damián', 'Romina', 'Héctor', 'Alexa', 'Uriel',
  'Montserrat', 'Adrián', 'Frida', 'Ángel', 'Elena', 'Matías', 'Jimena', 'Óscar', 'Zoe',
]);

export const LAST_NAMES = Object.freeze([
  'Ramírez', 'Hernández', 'García', 'López', 'Martínez', 'Pérez', 'Sánchez', 'Cruz', 'Flores',
  'Gómez', 'Morales', 'Vázquez', 'Jiménez', 'Reyes', 'Díaz', 'Torres', 'Ruiz', 'Mendoza',
  'Aguilar', 'Ortiz', 'Castillo', 'Romero', 'Chávez', 'Rivera', 'Juárez', 'Moreno', 'Salazar',
]);

/**
 * Historial: los alumnos 0–39 cursaron 2.º A; los alumnos 0–29 también 1.º A.
 * Los alumnos 40–44 son nuevos en la escuela este ciclo.
 */
export const HISTORY = Object.freeze({ secondGradeCount: 40, firstGradeCount: 30 });

/**
 * Puntajes fijos de la alumna 0 (Sofía), que tiene historial de 1.º y 2.º.
 * Coinciden con el perfil de ejemplo del frontend. Solo se registran las habilidades del
 * programa de cada grado (sin fracciones en 1.º y 2.º ni multiplicación en 1.º).
 */
export const FEATURED_STUDENT = Object.freeze({
  current: { place_value: 71, problem_solving: 63, multiplication: 58, fractions: 36, reading_comprehension: 63 },
  secondGrade: { place_value: 55, problem_solving: 44, multiplication: 50, fractions: 30, reading_comprehension: 60 },
  firstGrade: { place_value: 48, problem_solving: 35, multiplication: 40, fractions: 25, reading_comprehension: 52 },
});

const SABERES = 'saberes_pensamiento_cientifico';
const LENGUAJES = 'lenguajes';

/**
 * Temario base por grado: un contenido por habilidad clave (título, PDA). `null` = la habilidad
 * no forma parte del programa de ese grado (ver `SKILL_GRADE_RANGE`). Los títulos siguen el
 * nombre más cercano del Programa Sintético (Plan 2022); los PDA son paráfrasis por validar con docentes.
 */
export const CURRICULUM_BY_SKILL = Object.freeze({
  place_value: [
    ['Estudio de los números hasta 100', 'Cuenta, lee, escribe y ordena números hasta 100 e identifica decenas y unidades.'],
    ['Estudio de los números hasta 1 000', 'Lee, escribe y ordena números menores que 1 000 usando centenas, decenas y unidades.'],
    ['Estudio de los números hasta 9 999', 'Compone y descompone números de hasta cuatro cifras según el valor de cada cifra.'],
    ['Estudio de los números de hasta cinco cifras', 'Lee, escribe y compara números de cinco cifras y explica el valor de cada una.'],
    ['Estudio de los números de hasta nueve cifras', 'Lee, escribe y compara números de hasta nueve cifras usando el valor posicional.'],
    ['Estudio de los números de más de nueve cifras', 'Usa el valor posicional para leer, escribir y comparar números de más de nueve cifras.'],
  ],
  multiplication: [
    null,
    ['Construcción de la noción de multiplicación', 'Resuelve problemas de grupos iguales con factores hasta 10 usando sumas iteradas y arreglos.'],
    ['Multiplicación y división, su relación como operaciones inversas', 'Resuelve problemas de multiplicación con el repertorio de una cifra y de reparto en partes iguales.'],
    ['Multiplicación de hasta tres cifras por dos', 'Multiplica números de hasta tres cifras por dos cifras y explica los productos parciales.'],
    ['Multiplicación de números decimales por naturales', 'Resuelve problemas que implican multiplicar un número decimal por un número natural.'],
    ['División de números decimales entre naturales', 'Resuelve problemas de reparto que implican dividir un número decimal entre un número natural.'],
  ],
  fractions: [
    null,
    null,
    ['Estudio de los números: fracciones', 'Identifica la unidad de referencia en medios, cuartos y octavos con material concreto y tiras.'],
    ['Fracciones equivalentes', 'Identifica y construye fracciones equivalentes con tercios, quintos y sextos.'],
    ['Suma de fracciones con distinto denominador (múltiplos)', 'Suma fracciones cuando un denominador es múltiplo del otro usando equivalencias.'],
    ['Suma de fracciones con distinto denominador', 'Suma fracciones con denominadores distintos buscando un denominador común.'],
  ],
  problem_solving: [
    ['Construcción de la noción de suma y resta', 'Resuelve problemas de agregar y quitar con números hasta 20.'],
    ['Problemas de suma y resta hasta 100', 'Resuelve problemas de suma y resta con números hasta 100 e identifica los datos útiles.'],
    ['Suma y resta, su relación como operaciones inversas', 'Resuelve problemas de suma y resta con números hasta 1 000.'],
    ['Problemas de suma y resta hasta 10 000', 'Resuelve problemas de suma y resta con números de cuatro cifras y descarta datos innecesarios.'],
    ['Problemas de varios pasos', 'Resuelve problemas de dos pasos que combinan multiplicación y resta con dinero.'],
    ['Problemas de varios pasos con dinero', 'Resuelve problemas de varios pasos con dinero y comprueba si el resultado es razonable.'],
  ],
  reading_comprehension: [
    ['Lectura compartida en voz alta', 'Escucha la lectura en voz alta de un cuento breve e identifica a los personajes y lo que hacen.'],
    ['Lectura compartida en voz alta', 'Comenta lo que sucede en un texto narrativo leído en voz alta y responde preguntas sobre él.'],
    ['Comprensión y producción de textos expositivos', 'Lee textos breves, identifica la idea más relevante y responde preguntas sobre lo que leyó.'],
    ['Comprensión y producción de resúmenes', 'Identifica la idea principal y las ideas de apoyo de un texto expositivo.'],
    ['Comprensión y producción de textos informativos', 'Distingue la información principal y la de apoyo en textos informativos.'],
    ['Comprensión y producción de textos informativos', 'Infiere información y explica el significado de palabras por su contexto en textos informativos.'],
  ],
});

export const formativeFieldFor = (skillCode) => (skillCode === 'reading_comprehension' ? LENGUAJES : SABERES);

/** Contenidos de 3.º sin habilidad clave asociada (el temario es más amplio que las 5 habilidades). */
export const EXTRA_THIRD_GRADE_CONTENTS = Object.freeze([
  ['Medición de longitud, masa y capacidad', 'Compara y mide longitudes, masas y capacidades con unidades convencionales.'],
  ['Medición del tiempo', 'Lee el reloj y calcula duraciones en horas y minutos.'],
  ['Figuras geométricas y sus características', 'Clasifica figuras por su número de lados y ángulos.'],
  ['Cuerpos geométricos y sus características', 'Describe cubos, prismas y pirámides por sus caras y vértices.'],
  ['Organización e interpretación de datos', 'Organiza datos en tablas y gráficas de barras y responde preguntas sobre ellos.'],
  ['Ubicación espacial', 'Describe y sigue trayectos usando puntos de referencia.'],
]);

/** Avance del temario de 3.º A (los contenidos no listados quedan `pending`). */
export const THIRD_GRADE_PROGRESS = Object.freeze({
  place_value: 'seen',
  problem_solving: 'seen',
  reading_comprehension: 'seen',
  multiplication: 'in_progress',
  fractions: 'in_progress',
  'Medición de longitud, masa y capacidad': 'seen',
});

export const ACTIVITIES = Object.freeze([
  {
    skill: 'place_value', gradeMin: 1, gradeMax: 3, title: 'Tablero de centenas', minutes: 15, grouping: 'En parejas',
    materials: 'Billetes de juguete de 100, 10 y 1', errorTag: 'face_value',
    description: 'Con billetes de juguete, armen los números que dicte un compañero y expliquen cuánto vale cada cifra.',
  },
  {
    skill: 'place_value', gradeMin: 4, gradeMax: 6, title: 'Lotería de valor posicional', minutes: 20, grouping: 'Equipos de 4',
    materials: 'Tarjetas con números grandes', errorTag: 'place_shift_up',
    description: 'Canten el valor de una cifra («vale 40 000») y marquen la tarjeta donde esa cifra ocupa ese lugar.',
  },
  {
    skill: 'multiplication', gradeMin: 2, gradeMax: 3, title: 'Arreglos rectangulares', minutes: 15, grouping: 'En parejas',
    materials: 'Fichas o semillas', errorTag: 'adds_instead_of_multiplying',
    description: 'Formen filas y columnas con fichas para representar multiplicaciones y cuenten el total de dos formas.',
  },
  {
    skill: 'multiplication', gradeMin: 4, gradeMax: 6, title: 'Multiplicar por partes', minutes: 20, grouping: 'Equipos de 3',
    materials: 'Cuadrícula y colores', errorTag: 'forgets_place_shift',
    description: 'Dibujen la multiplicación como un rectángulo dividido en decenas y unidades y sumen las áreas parciales.',
  },
  {
    skill: 'fractions', gradeMin: 3, gradeMax: 3, title: 'Tiras de fracciones', minutes: 20, grouping: 'En parejas',
    materials: 'Tiras de papel y colores', errorTag: 'inverts_fraction',
    description: 'Doblen tiras de papel en 2, 4 y 8 partes iguales, pinten una parte de cada tira y comparen los tamaños.',
  },
  {
    skill: 'fractions', gradeMin: 4, gradeMax: 6, title: 'Muro de fracciones', minutes: 25, grouping: 'Equipos de 4',
    materials: 'Muro de fracciones impreso', errorTag: 'adds_denominators',
    description: 'Usen el muro para encontrar fracciones equivalentes y comprobar sumas antes de hacer la cuenta.',
  },
  {
    skill: 'problem_solving', gradeMin: 1, gradeMax: 3, title: 'La tiendita', minutes: 20, grouping: 'Equipos de 4',
    materials: 'Etiquetas de precio y monedas de juguete', errorTag: 'wrong_operation',
    description: 'Compren y vendan; antes de calcular, digan qué pregunta el problema y si la cantidad aumenta o disminuye.',
  },
  {
    skill: 'problem_solving', gradeMin: 4, gradeMax: 6, title: 'Detectives de datos', minutes: 20, grouping: 'En parejas',
    materials: 'Tarjetas con problemas', errorTag: 'uses_irrelevant_data',
    description: 'Tachen en cada problema los datos que no sirven y expliquen el plan de solución antes de operar.',
  },
  {
    skill: 'reading_comprehension', gradeMin: 1, gradeMax: 3, title: 'Detectives de la idea principal', minutes: 20,
    grouping: 'En parejas', materials: 'Texto breve y lápices de color', errorTag: 'detail_as_main_idea',
    description: 'Lean en voz alta un texto breve, subrayen las palabras clave y digan en una frase de qué trata.',
  },
  {
    skill: 'reading_comprehension', gradeMin: 4, gradeMax: 6, title: 'Pistas del contexto', minutes: 20,
    grouping: 'Equipos de 3', materials: 'Textos con palabras resaltadas', errorTag: 'context_vocabulary',
    description: 'Descubran el significado de palabras nuevas usando las oraciones de alrededor y compruébenlo en el diccionario.',
  },
]);
