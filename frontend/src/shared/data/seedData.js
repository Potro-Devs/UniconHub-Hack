/**
 * Datos semilla locales para mostrar las ventanas modulares cargadas de inicio.
 */

/**
 * Código de acceso del grupo demo (coincide con `npm run seed` del backend).
 * Se reemplazará por el código real del grupo al conectar el módulo `groups`.
 */
export const DEMO_JOIN_CODE = 'MAPA3A';

function buildStudents() {
  let seed = 11;
  const r = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  const first = [
    'Sofía', 'Mateo', 'Valentina', 'Santiago', 'Regina', 'Diego', 'Ximena', 'Emiliano', 'Camila',
    'Leonardo', 'Renata', 'Iker', 'Valeria', 'Sebastián', 'Daniela', 'Gael', 'Mariana', 'Andrés',
    'Fernanda', 'Tadeo', 'Natalia', 'Julián', 'Paula', 'Rodrigo', 'Itzel', 'Bruno', 'Abril',
    'Joaquín', 'Lucía', 'Emilio', 'Ana Paula', 'Damián', 'Romina', 'Héctor', 'Alexa', 'Uriel',
    'Montserrat', 'Adrián', 'Frida', 'Ángel', 'Elena', 'Matías', 'Jimena', 'Óscar', 'Zoe',
  ];

  const last = [
    'Ramírez', 'Hernández', 'García', 'López', 'Martínez', 'Pérez', 'Sánchez', 'Cruz', 'Flores',
    'Gómez', 'Morales', 'Vázquez', 'Jiménez', 'Reyes', 'Díaz', 'Torres', 'Ruiz', 'Mendoza',
    'Aguilar', 'Ortiz', 'Castillo', 'Romero', 'Chávez', 'Rivera', 'Juárez', 'Moreno', 'Salazar',
  ];

  const clamp = (v) => Math.max(8, Math.min(98, Math.round(v)));

  const students = first.map((f, i) => {
    const ln = last[(i * 7) % last.length];
    const ab = (r() - 0.5) * 44;
    const sc = {};
    const prev = {};
    SKILLS.forEach((k) => {
      sc[k.id] = clamp(k.b + ab + (r() - 0.5) * 30);
    });
    ['place_value', 'problem_solving', 'reading_comprehension'].forEach((k) => {
      prev[k] = clamp(sc[k] - 4 - r() * 18);
    });
    return {
      i,
      first: f,
      name: `${f} ${ln}`,
      short: `${f.split(' ')[0]} ${ln[0]}.`,
      ini: `${f[0]}${ln[0]}`,
      sc,
      prev,
    };
  });

  Object.assign(students[0].sc, {
    place_value: 71,
    problem_solving: 63,
    multiplication: 58,
    fractions: 36,
    reading_comprehension: 63,
  });
  Object.assign(students[0].prev, { place_value: 55, problem_solving: 44, reading_comprehension: 60 });
  return students;
}

/**
 * Las 5 habilidades clave transversales del MVP (AGENTS.md §3).
 * `b` es el promedio base usado para generar puntajes ficticios.
 */
export const SKILLS = [
  { id: 'place_value', name: 'Valor posicional', b: 62 },
  { id: 'problem_solving', name: 'Resolución de problemas', b: 44 },
  { id: 'multiplication', name: 'Multiplicación', b: 50 },
  { id: 'fractions', name: 'Fracciones', b: 38 },
  { id: 'reading_comprehension', name: 'Comprensión lectora', b: 56 },
];

export const STUDENTS = buildStudents();

export const CURRICULUM_CONTENTS = [
  {
    id: 'c1',
    short: 'Números',
    t: 'Estudio de los números',
    pda: 'Lee, escribe y ordena números naturales hasta 1 000.',
    sk: ['place_value'],
    st: 'visto',
    tests: ['Números hasta 1 000 · prueba 1 · 8 reactivos'],
  },
  {
    id: 'c2',
    short: 'Fracciones',
    t: 'Estudio de los números: fracciones',
    pda: 'Usa medios, cuartos y octavos para expresar partes de un todo y compararlas.',
    sk: ['fractions'],
    st: 'curso',
    tests: ['Fracciones · prueba 1 · 10 reactivos', 'Fracciones · repaso con pistas · 6 reactivos'],
  },
  {
    id: 'c3',
    short: 'Suma y resta',
    t: 'Suma y resta, su relación como operaciones inversas',
    pda: 'Resuelve problemas de suma y resta con números hasta 1 000.',
    sk: ['problem_solving'],
    st: 'visto',
    tests: ['Suma y resta · prueba 1 · 8 reactivos'],
  },
  {
    id: 'c4',
    short: 'Mult. y división',
    t: 'Multiplicación y división, su relación como operaciones inversas',
    pda: 'Resuelve problemas de multiplicación hasta 10 × 10 y de reparto en partes iguales.',
    sk: ['multiplication'],
    st: 'curso',
    tests: ['Multiplicación y división · prueba 1 · 10 reactivos'],
  },
  {
    id: 'c5',
    short: 'Lectura',
    t: 'Comprensión de textos informativos y narrativos',
    pda: 'Lee textos breves, identifica la idea principal y responde preguntas sobre lo que leyó.',
    sk: ['reading_comprehension'],
    st: 'visto',
    tests: ['Comprensión lectora · prueba 1 · 8 reactivos'],
  },
  {
    id: 'c11',
    t: 'Medición de longitud, masa y capacidad',
    pda: 'Compara y mide longitudes, masas y capacidades con unidades convencionales.',
    sk: [],
    st: 'visto',
    tests: ['Medición · prueba 1 · 8 reactivos'],
  },
  {
    id: 'c6',
    t: 'Medición del tiempo',
    pda: 'Lee el reloj y calcula duraciones en horas y minutos.',
    sk: [],
    st: 'pend',
    tests: ['Medición del tiempo · prueba 1 · 8 reactivos'],
  },
  {
    id: 'c7',
    t: 'Figuras geométricas y sus características',
    pda: 'Clasifica figuras por su número de lados y ángulos.',
    sk: [],
    st: 'pend',
    tests: ['Figuras · prueba 1 · 8 reactivos'],
  },
  {
    id: 'c8',
    t: 'Cuerpos geométricos y sus características',
    pda: 'Describe cubos, prismas y pirámides por sus caras y vértices.',
    sk: [],
    st: 'pend',
    tests: [],
  },
  {
    id: 'c9',
    t: 'Organización e interpretación de datos',
    pda: 'Organiza datos en tablas y gráficas de barras y responde preguntas sobre ellos.',
    sk: [],
    st: 'pend',
    tests: ['Datos · prueba 1 · 6 reactivos'],
  },
  {
    id: 'c10',
    t: 'Ubicación espacial',
    pda: 'Describe y sigue trayectos usando puntos de referencia.',
    sk: [],
    st: 'pend',
    tests: [],
  },
];

export const SUGGESTED_ACTIVITIES = {
  fractions: {
    t: 'Tiras de fracciones',
    d: 'En parejas, doblen tiras de papel en 2, 4 y 8 partes iguales. Pinten una parte de cada tira y comparen cuál pedazo es más grande.',
    meta: '20 min · En parejas · Tiras de papel y colores',
    err: 'Escribe el total de partes arriba (4/1 en lugar de 1/4).',
  },
  multiplication: {
    t: 'Arreglos rectangulares',
    d: 'Formen filas y columnas con fichas para representar multiplicaciones y cuenten el total de dos formas.',
    meta: '15 min · En parejas · Fichas',
    err: 'Suma los números en lugar de multiplicarlos.',
  },
  place_value: {
    t: 'Tablero de centenas',
    d: 'Con billetes de juguete de 100, 10 y 1, armen números que dicte un compañero y escríbanlos.',
    meta: '15 min · En parejas · Billetes de juguete',
    err: 'Confunde decenas con centenas al escribir el número.',
  },
  problem_solving: {
    t: 'La tiendita',
    d: 'Compren y vendan con precios hasta 500 pesos; antes de calcular, digan qué pregunta el problema y qué datos sirven.',
    meta: '20 min · Equipos de 4 · Etiquetas de precio',
    err: 'Opera con todos los números del enunciado sin identificar qué se pregunta.',
  },
  reading_comprehension: {
    t: 'Detectives de la idea principal',
    d: 'Lean en voz alta un texto breve, subrayen las palabras clave de cada párrafo y digan en una frase de qué trata.',
    meta: '20 min · En parejas · Texto breve y lápices de color',
    err: 'Elige un detalle llamativo del texto en lugar de la idea principal.',
  },
};

export const FRACTION_SHEET = [
  { q: '¿Qué fracción de la barra está pintada?', bar: [4, 1], o: ['1/3', '1/4', '4/1', '3/4'], k: 1 },
  { q: '¿Qué fracción de la barra está pintada?', bar: [8, 3], o: ['5/8', '3/5', '3/8', '8/3'], k: 2 },
  { q: '¿Cuál es más grande?', o: ['1/4', '1/2', 'Son iguales', 'No se sabe'], k: 1 },
  { q: 'Ana tiene 1/4 de listón y Beto 2/4. ¿Cuánto tienen juntos?', o: ['3/8', '2/8', '1/2', '3/4'], k: 3 },
  { q: 'Una pizza tiene 8 partes iguales. Comiste 2. ¿Qué fracción comiste?', o: ['2/8', '8/2', '2/6', '6/8'], k: 0 },
  { q: '¿Cuántos cuartos forman un entero?', o: ['2', '4', '1', '8'], k: 1 },
  { q: '¿Qué fracción es igual a 1/2?', o: ['1/4', '2/8', '2/4', '1/8'], k: 2 },
  { q: 'Luis caminó 1/2 km y Rosa 1/4 km. ¿Quién caminó más?', o: ['Rosa', 'Igual', 'Luis', 'No se sabe'], k: 2 },
  { q: 'Ordena de menor a mayor: 1/2, 1/8, 1/4', o: ['1/2, 1/4, 1/8', '1/8, 1/4, 1/2', '1/4, 1/8, 1/2', '1/8, 1/2, 1/4'], k: 1 },
  { q: 'Si una barra se parte en 3 partes iguales, cada parte es…', o: ['3/1', '1/2', '3/3', '1/3'], k: 3 },
];

export const STUDENT_EXERCISES = [
  {
    s: 0,
    h: [
      'Cuenta en cuántas partes iguales está dividida la barra.',
      'Son 4 partes. El número de abajo dice el total. ¿Cuántas están pintadas? Ese va arriba.',
      'Ejemplo parecido: si una barra tiene 3 partes y pintas 1, es 1/3.',
    ],
  },
  {
    s: 1,
    h: [
      'Cuenta todas las partes de la barra, pintadas y sin pintar.',
      'Son 8 partes en total. Ahora cuenta solo las pintadas: ese número va arriba.',
      'Ejemplo parecido: 2 partes pintadas de 5 es 2/5.',
    ],
  },
  {
    s: 2,
    h: [
      'Imagina dos pizzas iguales. Una se parte en 2 y la otra en 4.',
      'Si partes en más pedazos, ¿cada pedazo queda más grande o más chico?',
      'Ejemplo parecido: 1/3 de un pastel es más grande que 1/6 del mismo pastel.',
    ],
  },
  {
    s: 6,
    h: [
      'Una fracción igual ocupa el mismo tamaño en la barra.',
      'Un medio es la mitad. ¿Cuántos cuartos llenan la mitad?',
      'Ejemplo parecido: 3/6 es igual a 1/2, porque 3 es la mitad de 6.',
    ],
  },
];

export const DISTRACTOR_ERRORS = [
  ['Usa las partes sin pintar como total', null, 'Invierte arriba y abajo', 'Cuenta las partes sin pintar'],
  ['Cuenta las partes sin pintar', 'Usa las partes sin pintar como total', null, 'Invierte arriba y abajo'],
  ['Cree que un número más grande abajo hace la fracción mayor', null, 'No compara el tamaño de las partes', 'No usa la imagen del entero'],
  ['Suma también los de abajo (4 + 4 = 8)', 'Suma solo los de abajo', 'Confunde 2/4 con el resultado', null],
  [null, 'Invierte arriba y abajo', 'Resta en lugar de contar el total', 'Cuenta lo que quedó'],
  ['Piensa en medios, no en cuartos', null, 'Confunde un cuarto con el entero', 'Piensa en octavos'],
  ['Iguala solo el número de arriba', 'Iguala solo el número de arriba', null, 'Iguala solo el número de arriba'],
  ['Cree que el 4 hace mayor la fracción', 'No compara las fracciones', null, 'No usa una imagen del entero'],
  ['Ordena al revés', null, 'Ordena sin una regla clara', 'Ordena sin una regla clara'],
  ['Invierte arriba y abajo', 'Usa medios por costumbre', 'Toma el entero completo', null],
];

export const SHEET_HINTS = FRACTION_SHEET.map((_, j) => {
  const match = STUDENT_EXERCISES.find((e) => e.s === j);
  if (match) return match.h;
  const extra = {
    3: ['Fíjate: los dos pedazos son cuartos.', 'Si las partes son del mismo tamaño, solo cuentas cuántas hay: 1 + 2.', 'Ejemplo parecido: 1/5 + 2/5 = 3/5.'],
    4: ['¿En cuántas partes iguales está la pizza?', 'El total (8) va abajo. Lo que comiste va arriba.', 'Ejemplo parecido: si comes 3 de 6 partes, comiste 3/6.'],
    5: ['Un cuarto es una de 4 partes iguales.', 'Dibuja un entero y pártelo en cuartos. Cuenta las partes.', 'Ejemplo parecido: 3 tercios forman un entero.'],
    7: ['Imagina el mismo camino partido en 2 y en 4.', 'Un medio del camino es más largo que un cuarto del mismo camino.', 'Ejemplo parecido: 1/2 vaso tiene más agua que 1/4 de vaso.'],
    8: ['¿Qué pedazo es más chico: partir en 8, en 4 o en 2?', 'Entre más partes, más chico cada pedazo. Empieza por el de más partes.', 'Ejemplo parecido: 1/6, 1/3, 1/2 ya está de menor a mayor.'],
    9: ['Cuenta cuántas partes iguales hay.', 'Cada parte es 1 de 3. Arriba va 1 y abajo va 3.', 'Ejemplo parecido: en 5 partes iguales, cada una es 1/5.'],
  };
  return extra[j];
});

export const FRACTIONS_PDA = [
  'Reconoce medios, cuartos y octavos como partes iguales de un todo.',
  'Compara fracciones del mismo entero usando tiras o dibujos.',
  'Resuelve problemas sencillos de suma de fracciones con el mismo denominador.',
];

export const SCHOOL_TEACHERS = [
  ['Mtra. Elena Torres', '3.º A · 3.º B', 'Activa'],
  ['Mtro. Raúl Méndez', '2.º B', 'Activo'],
  ['Mtra. Carmen Ávila', '1.º A', 'Activa'],
  ['Mtro. Jorge Salas', '4.º A · 4.º B', 'Invitación enviada'],
  ['Mtra. Ana Lucía Paz', '5.º A', 'Activa'],
  ['Mtro. Iván Cortés', '6.º A', 'Activo'],
  ['Mtra. Rosa Ibarra', 'Apoyo USAER', 'Activa'],
];

export const PROMO_GROUPS = [
  { id: 'g1a', from: '1.º A', to: '2.º A', n: 32 },
  { id: 'g2b', from: '2.º B', to: '3.º B', n: 38 },
  { id: 'g3a', from: '3.º A', to: '4.º A', n: 45 },
  { id: 'g5a', from: '5.º A', to: '6.º A', n: 36 },
  { id: 'g6a', from: '6.º A', to: 'Egresa de primaria', n: 34 },
];

export const SKILL_GLYPHS = {
  place_value: '123',
  problem_solving: '¿?',
  multiplication: '×',
  fractions: '½',
  reading_comprehension: 'Aa',
};

export const EVOLUTION_OFFSETS = {
  place_value: 6,
  problem_solving: 9,
  multiplication: 4,
  reading_comprehension: 5,
};

/**
 * Textos y reactivos de comprensión lectora de ejemplo (por validar con docente de primaria).
 */
export const READING_SHEET = [
  {
    passage:
      'Los ajolotes viven en los canales de Xochimilco. Respiran por unas branquias en forma de ramitas y pueden regenerar su cola si se lastiman.',
    q: '¿De qué trata principalmente este texto?',
    o: [
      'Solo habla del agua de los canales',
      'Explica dónde viven los ajolotes y cómo son',
      'Cuenta un cuento sobre peces voladores',
      'Describe cómo cuidar plantas en maceta',
    ],
    k: 1,
  },
  {
    passage:
      'Ayer por la tarde, Sofía sembró semillas de frijol en un vaso con algodón húmedo. Cada mañana revisa si ya salió un pequeño brote verde.',
    q: '¿Para qué revisa Sofía su vaso cada mañana?',
    o: [
      'Para cambiar las semillas por piedras',
      'Para ver si ya salió un brote del frijol',
      'Para regar las flores del jardín escolar',
      'Para secar el algodón al sol',
    ],
    k: 1,
  },
  {
    passage:
      'En la biblioteca de la escuela hay libros de cuentos, mapas y diccionarios. Para llevarte un libro a casa, primero anotas tu nombre con la maestra.',
    q: 'Según el texto, ¿qué debes hacer antes de llevarte un libro a casa?',
    o: [
      'Escribir un resumen del diccionario',
      'Anotar tu nombre con la maestra',
      'Pintar un mapa en el cuaderno',
      'Guardar el libro debajo de la mesa',
    ],
    k: 1,
  },
];

// Etiquetas de error típico de ejemplo — por validar con docente de primaria.
export const READING_DISTRACTOR_ERRORS = [
  ['detail_as_main_idea', null, 'off_topic', 'off_topic'],
  ['off_topic', null, 'prior_knowledge_over_text', 'literal_misread'],
  ['literal_misread', null, 'off_topic', 'off_topic'],
];

// Pistas de comprensión lectora de ejemplo — por validar con docente de primaria.
export const READING_EXERCISES = [
  {
    s: 0,
    h: [
      'Lee otra vez las dos oraciones y fíjate de qué animal habla todo el texto.',
      'La primera oración dice dónde vive ese animal y la segunda cuenta cómo es.',
      'Ejemplo parecido: si un texto dice "Las abejas hacen miel y viven en colmenas", trata sobre dónde viven y qué hacen las abejas.',
    ],
  },
  {
    s: 1,
    h: [
      'Busca en la segunda oración lo que Sofía espera notar cuando observa el vaso.',
      'Piensa qué ocurre después de colocar una semilla en algodón húmedo.',
      'Ejemplo parecido: "Luis plantó maíz y mira su maceta para notar una hojita" → revisa si la planta empieza a crecer.',
    ],
  },
  {
    s: 2,
    h: [
      'Fíjate en la segunda oración, donde se explica el paso necesario para llevar un libro.',
      'La palabra "primero" señala la acción que va antes de salir con el libro.',
      'Ejemplo parecido: "Para entrar al museo, primero muestras tu boleto en la puerta" → indica el paso previo para pasar.',
    ],
  },
];

export const STUDENT_QUIZZES = [
  {
    id: 'fractions-1',
    skillId: 'fractions',
    title: 'Fracciones · Prueba 1',
    heroTitle: 'Fracciones — Prueba 1: Medios, cuartos y octavos',
    classId: 'class-math-3a',
    classLabel: 'Matemáticas 3.º A',
    teacher: 'Mtra. Elena Torres',
    dueLabel: 'Para el 26 nov',
    status: 'pending_screen',
    modality: 'screen',
    ctaLabel: 'Empezar cuestionario',
    ctaTone: 'primary',
    questionCount: STUDENT_EXERCISES.length,
    exercises: STUDENT_EXERCISES,
    sheet: FRACTION_SHEET,
    distractorErrors: DISTRACTOR_ERRORS,
  },
  {
    id: 'reading-1',
    skillId: 'reading_comprehension',
    title: 'Lectura de textos breves',
    heroTitle: 'Comprensión lectora — Lectura de textos breves',
    classId: 'class-club-3',
    classLabel: 'Comprensión lectora · Club 3.º',
    teacher: 'Mtro. Carlos Ruiz',
    dueLabel: 'Programado · 28 nov',
    status: 'pending_screen',
    modality: 'screen',
    ctaLabel: 'Resolver ahora',
    ctaTone: 'ink',
    questionCount: READING_EXERCISES.length,
    exercises: READING_EXERCISES,
    sheet: READING_SHEET,
    distractorErrors: READING_DISTRACTOR_ERRORS,
  },
  {
    id: 'mult-paper-1',
    skillId: 'multiplication',
    title: 'Multiplicación y reparto',
    classId: 'class-math-3a',
    classLabel: 'Matemáticas 3.º A',
    teacher: 'Mtra. Elena Torres',
    status: 'completed_paper',
    modality: 'paper',
    isScreenLocked: true,
    scorePct: 64,
    note: 'Ya la respondiste en hoja impresa con tu maestra. Tu resultado ya está guardado.',
  },
];

export const STUDENT_CLASSES = [
  {
    id: 'class-math-3a',
    gradeLabel: '3.º A',
    code: DEMO_JOIN_CODE,
    name: 'Matemáticas',
    teacherLine: 'Mtra. Elena Torres · Saberes y pensamiento científico',
    ctaType: 'quizzes',
  },
  {
    id: 'class-esp-3a',
    gradeLabel: '3.º A',
    code: '3A9P4K',
    name: 'Español y Lectura',
    teacherLine: 'Mtra. Elena Torres · Lenguajes',
    ctaType: 'progress',
  },
  {
    id: 'class-club-3',
    gradeLabel: 'Club 3.º',
    code: 'CL4M8R',
    name: 'Club de Lectura',
    teacherLine: 'Mtro. Carlos Ruiz · Comprensión lectora',
    ctaType: 'quizzes',
  },
];

export const STUDENT_ACHIEVEMENTS = [
  {
    id: 'ach-autonomy',
    mascotColor: 'rosa',
    category: 'Autonomía',
    categoryTone: 'achieved',
    title: 'Sin pistas en Valor posicional',
    description: 'Resolviste 5 preguntas seguidas usando tus propias estrategias.',
    earnedAt: 'Obtenido el 18 nov 2026',
    isMilestone: true,
  },
  {
    id: 'ach-growth',
    mascotColor: 'azul',
    category: 'Crecimiento',
    categoryTone: 'mastered',
    title: 'Subiste de nivel',
    description: 'Pasaste de En proceso a Logrado en Fracciones.',
    earnedAt: 'Obtenido el 15 nov 2026',
    isMilestone: false,
  },
  {
    id: 'ach-support',
    mascotColor: 'amarillo',
    category: 'Con apoyo',
    categoryTone: 'in_progress',
    title: 'Explorador de pistas',
    description: 'Usaste una pista para entender un problema y lo terminaste con éxito.',
    earnedAt: 'Obtenido el 10 nov 2026',
    isMilestone: false,
  },
  {
    id: 'ach-reading',
    mascotColor: 'lila',
    category: 'Lectura',
    categoryTone: 'lilac',
    title: 'Lectura con calma',
    description: 'Completaste tu diagnóstico de comprensión lectora paso a paso.',
    earnedAt: 'Obtenido el 04 nov 2026',
    isMilestone: false,
  },
];
