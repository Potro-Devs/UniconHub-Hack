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
  secondGrade: { place_value: 55, problem_solving: 44, multiplication: 50, reading_comprehension: 60 },
  firstGrade: { place_value: 48, problem_solving: 35, reading_comprehension: 52 },
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
    ['Estudio de los números: fracciones', 'Identifica la unidad de referencia en cuartos y octavos con material concreto y tiras (los medios se trabajan con material concreto).'],
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
    ['Lectura compartida en voz alta', 'La docente lee en voz alta un cuento breve; el alumno identifica a los personajes y lo que hacen.'],
    ['Lectura compartida en voz alta', 'La docente lee en voz alta un texto narrativo; el alumno comenta lo que sucede y responde preguntas sobre él.'],
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

export const COLLEAGUE_TEACHERS = Object.freeze([
  { email: 'carlos@axi.demo', fullName: 'Mtro. Carlos Mendoza' },
  { email: 'ana@axi.demo', fullName: 'Mtra. Ana Lucía Paz' },
]);

/**
 * Cuestionarios iniciales para "Cuestionarios y constructor":
 * - `own`: creados por la docente demo (`Mtra. Elena Torres`)
 * - `colleagueEmail`: creados por otros docentes de la escuela
 * - `originType: 'system'`: precargados por Axi
 */
export const SEED_QUIZZES = Object.freeze([
  {
    originType: 'teacher',
    ownerKey: 'demo',
    title: 'Problemas de suma y resta con datos extra',
    description: 'Detecta si el alumno opera con todos los números del enunciado sin identificar la pregunta.',
    skillCode: 'problem_solving',
    grade: 3,
    questions: [
      {
        questionType: 'multiple_choice',
        prompt: 'Lucía compró 12 lápices azules y 8 rojos. Si regaló 5 lápices azules, ¿cuántos lápices azules le quedaron?',
        options: [
          { label: 'A', text: '7 lápices azules', isCorrect: true },
          { label: 'B', text: '15 lápices azules', isCorrect: false },
          { label: 'C', text: '25 lápices azules', isCorrect: false },
          { label: 'D', text: '3 lápices azules', isCorrect: false },
        ],
        correctAnswer: '7 lápices azules',
        hint: 'Observa de qué color te pregunta al final y qué datos corresponden solo a ese color.',
      },
      {
        questionType: 'true_false',
        prompt: 'Si en un problema aparecen tres cantidades, siempre debemos sumarlas todas para responder.',
        options: [
          { label: 'A', text: 'Verdadero', isCorrect: false },
          { label: 'B', text: 'Falso', isCorrect: true },
        ],
        correctAnswer: 'Falso',
        hint: 'Piensa si todos los datos sirven para contestar la pregunta o algunos son solo información adicional.',
      },
      {
        questionType: 'fill_blank',
        prompt: 'En una caja había 40 canicas y en otra 25 bolsas de plástico. Si se perdieron 12 canicas, quedaron ___ canicas.',
        options: [],
        correctAnswer: '28',
        hint: 'Separa los objetos que son canicas de los que no se están contando.',
      },
    ],
  },
  {
    originType: 'teacher',
    ownerKey: 'demo',
    title: 'Fracciones cotidianas en tiras y repartos',
    description: 'Evaluación corta para revisar medios, cuartos y comparación básica antes del cierre del trimestre.',
    skillCode: 'fractions',
    grade: 3,
    questions: [
      {
        questionType: 'multiple_choice',
        prompt: '¿Qué fracción representa 1 parte pintada de una barra dividida en 4 partes iguales?',
        options: [
          { label: 'A', text: '1/3', isCorrect: false },
          { label: 'B', text: '1/4', isCorrect: true },
          { label: 'C', text: '4/1', isCorrect: false },
          { label: 'D', text: '3/4', isCorrect: false },
        ],
        correctAnswer: '1/4',
        hint: 'El número de abajo indica en cuántas partes iguales se partió toda la barra.',
      },
      {
        questionType: 'true_false',
        prompt: 'Un medio (1/2) de un pastel es más grande que un cuarto (1/4) del mismo pastel.',
        options: [
          { label: 'A', text: 'Verdadero', isCorrect: true },
          { label: 'B', text: 'Falso', isCorrect: false },
        ],
        correctAnswer: 'Verdadero',
        hint: 'Imagina que divides el mismo pastel entre 2 personas o entre 4 personas.',
      },
      {
        questionType: 'fill_blank',
        prompt: 'Si partes una naranja en 8 gajos iguales y tomas 3 gajos, tomaste la fracción ___ .',
        options: [],
        correctAnswer: '3/8',
        hint: 'Escribe arriba las partes que tomaste y abajo el total de gajos iguales.',
      },
    ],
  },
  {
    originType: 'teacher',
    ownerKey: 'carlos@axi.demo',
    title: 'Fracciones visuales: medios, cuartos y octavos',
    description: 'Ideal para grupos que inician fracciones y suelen invertir numerador y denominador.',
    skillCode: 'fractions',
    grade: 3,
    questions: [
      {
        questionType: 'multiple_choice',
        prompt: 'Sofía dobló una hoja en 8 rectángulos iguales y coloreó 5. ¿Qué fracción coloreó?',
        options: [
          { label: 'A', text: '8/5', isCorrect: false },
          { label: 'B', text: '5/8', isCorrect: true },
          { label: 'C', text: '5/3', isCorrect: false },
          { label: 'D', text: '3/8', isCorrect: false },
        ],
        correctAnswer: '5/8',
        hint: 'Cuenta primero todas las partes iguales de la hoja para colocar ese número abajo.',
      },
      {
        questionType: 'true_false',
        prompt: 'Dos cuartos (2/4) ocupan exactamente la misma cantidad que un medio (1/2).',
        options: [
          { label: 'A', text: 'Verdadero', isCorrect: true },
          { label: 'B', text: 'Falso', isCorrect: false },
        ],
        correctAnswer: 'Verdadero',
        hint: 'Compara la mitad de una tira de 4 partes iguales con una tira partida a la mitad.',
      },
      {
        questionType: 'fill_blank',
        prompt: 'Para completar un entero cuando ya tienes 1/4, te faltan ___ cuartos.',
        options: [],
        correctAnswer: '3/4',
        hint: 'Un entero dividido en cuartos tiene 4 partes iguales.',
      },
    ],
  },
  {
    originType: 'teacher',
    ownerKey: 'ana@axi.demo',
    title: 'Multiplicación y reparto en arreglos rectangulares',
    description: 'Relaciona filas y columnas con repartos equitativos sin confundir suma con multiplicación.',
    skillCode: 'multiplication',
    grade: 3,
    questions: [
      {
        questionType: 'multiple_choice',
        prompt: 'En el huerto hay 4 surcos con 6 plantas de maíz cada uno. ¿Cuántas plantas hay en total?',
        options: [
          { label: 'A', text: '10 plantas', isCorrect: false },
          { label: 'B', text: '20 plantas', isCorrect: false },
          { label: 'C', text: '24 plantas', isCorrect: true },
          { label: 'D', text: '28 plantas', isCorrect: false },
        ],
        correctAnswer: '24 plantas',
        hint: 'Suma 6 plantas cuatro veces o usa la tabla del 4.',
      },
      {
        questionType: 'true_false',
        prompt: 'Multiplicar 3 × 7 da el mismo resultado que multiplicar 7 × 3.',
        options: [
          { label: 'A', text: 'Verdadero', isCorrect: true },
          { label: 'B', text: 'Falso', isCorrect: false },
        ],
        correctAnswer: 'Verdadero',
        hint: 'Imagina girar un rectángulo de 3 filas por 7 columnas.',
      },
      {
        questionType: 'fill_blank',
        prompt: 'Si repartes 32 fichas en 4 equipos iguales, cada equipo recibe ___ fichas.',
        options: [],
        correctAnswer: '8',
        hint: 'Busca qué número multiplicado por 4 da 32.',
      },
    ],
  },
  {
    originType: 'system',
    ownerKey: null,
    title: 'Diagnóstico base SEP · Fracciones en partes iguales',
    description: 'Cuestionario precargado por Axi para identificar inversión de numerador y denominador.',
    skillCode: 'fractions',
    grade: 3,
    questions: [
      {
        questionType: 'multiple_choice',
        prompt: 'Una cinta se cortó en 4 trozos del mismo tamaño y se usaron 3. ¿Qué fracción de la cinta se usó?',
        options: [
          { label: 'A', text: '3/4', isCorrect: true },
          { label: 'B', text: '4/3', isCorrect: false },
          { label: 'C', text: '1/4', isCorrect: false },
          { label: 'D', text: '3/1', isCorrect: false },
        ],
        correctAnswer: '3/4',
        hint: 'Recuerda: partes usadas arriba, total de partes iguales abajo.',
      },
      {
        questionType: 'true_false',
        prompt: 'Si un chocolate está dividido en 3 pedazos de distinto tamaño, cada pedazo es exactamente 1/3.',
        options: [
          { label: 'A', text: 'Verdadero', isCorrect: false },
          { label: 'B', text: 'Falso', isCorrect: true },
        ],
        correctAnswer: 'Falso',
        hint: 'Fíjate en la condición indispensable de las fracciones: las partes deben ser iguales.',
      },
      {
        questionType: 'fill_blank',
        prompt: 'La mitad de 12 manzanas equivale a ___ manzanas.',
        options: [],
        correctAnswer: '6',
        hint: 'Divide las 12 manzanas en 2 grupos iguales.',
      },
    ],
  },
  {
    originType: 'system',
    ownerKey: null,
    title: 'Diagnóstico base SEP · Valor posicional hasta 10 000',
    description: 'Cuestionario precargado por Axi para verificar lectura y descomposición de cifras.',
    skillCode: 'place_value',
    grade: 3,
    questions: [
      {
        questionType: 'multiple_choice',
        prompt: 'En el número 4 728, ¿cuánto vale la cifra 7 según el lugar que ocupa?',
        options: [
          { label: 'A', text: '7', isCorrect: false },
          { label: 'B', text: '70', isCorrect: false },
          { label: 'C', text: '700', isCorrect: true },
          { label: 'D', text: '7 000', isCorrect: false },
        ],
        correctAnswer: '700',
        hint: 'Cuenta de derecha a izquierda: unidades, decenas, centenas.',
      },
      {
        questionType: 'true_false',
        prompt: 'El número 3 050 es mayor que el número 3 500.',
        options: [
          { label: 'A', text: 'Verdadero', isCorrect: false },
          { label: 'B', text: 'Falso', isCorrect: true },
        ],
        correctAnswer: 'Falso',
        hint: 'Compara primero las centenas de ambos números.',
      },
      {
        questionType: 'fill_blank',
        prompt: 'La suma 2 000 + 300 + 40 + 9 forma el número ___ .',
        options: [],
        correctAnswer: '2349',
        hint: 'Acomoda cada cifra en unidades de millar, centenas, decenas y unidades.',
      },
    ],
  },
  {
    originType: 'system',
    ownerKey: null,
    title: 'Diagnóstico base SEP · Comprensión lectora de textos breves',
    description: 'Cuestionario precargado por Axi sobre idea principal y vocabulario en contexto.',
    skillCode: 'reading_comprehension',
    grade: 3,
    questions: [
      {
        questionType: 'multiple_choice',
        prompt: 'Lee: "Las abejas visitan las flores para tomar néctar y, sin darse cuenta, llevan polen que ayuda a nacer frutos." ¿Cuál es la idea principal?',
        options: [
          { label: 'A', text: 'Las abejas vuelan muy rápido en el jardín.', isCorrect: false },
          { label: 'B', text: 'Al buscar alimento, las abejas ayudan a que nazcan frutos.', isCorrect: true },
          { label: 'C', text: 'Todas las flores tienen néctar dulce.', isCorrect: false },
          { label: 'D', text: 'Los frutos cambian de color en verano.', isCorrect: false },
        ],
        correctAnswer: 'Al buscar alimento, las abejas ayudan a que nazcan frutos.',
        hint: 'Busca la oración que resume qué hacen las abejas y para qué sirve.',
      },
      {
        questionType: 'true_false',
        prompt: 'La idea principal de un texto suele explicar de qué trata todo el párrafo y no solo un detalle suelto.',
        options: [
          { label: 'A', text: 'Verdadero', isCorrect: true },
          { label: 'B', text: 'Falso', isCorrect: false },
        ],
        correctAnswer: 'Verdadero',
        hint: 'Piensa si un dato pequeño puede resumir toda la lectura.',
      },
      {
        questionType: 'fill_blank',
        prompt: 'En "El sendero era tan angosto que solo pasaba una persona a la vez", "angosto" significa ___ .',
        options: [],
        correctAnswer: 'estrecho',
        hint: 'Usa la pista de que solo cabe una persona a la vez.',
      },
    ],
  },
]);
