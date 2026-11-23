/**
 * Datos semilla locales para mostrar las ventanas modulares cargadas de inicio.
 */
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
    ['vp', 'sr', 'me'].forEach((k) => {
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

  Object.assign(students[0].sc, { vp: 71, sr: 80, mu: 58, di: 49, fr: 36, me: 63 });
  Object.assign(students[0].prev, { vp: 55, sr: 62, me: 60 });
  return students;
}

export const SKILLS = [
  { id: 'vp', name: 'Valor posicional', b: 74 },
  { id: 'sr', name: 'Suma y resta', b: 76 },
  { id: 'mu', name: 'Multiplicación', b: 61 },
  { id: 'di', name: 'División', b: 53 },
  { id: 'fr', name: 'Fracciones', b: 47 },
  { id: 'me', name: 'Medición', b: 66 },
];

export const STUDENTS = buildStudents();

export const CURRICULUM_CONTENTS = [
  {
    id: 'c1',
    short: 'Números',
    t: 'Estudio de los números',
    pda: 'Lee, escribe y ordena números naturales hasta 1 000.',
    sk: ['vp'],
    st: 'visto',
    tests: ['Números hasta 1 000 · prueba 1 · 8 reactivos'],
  },
  {
    id: 'c2',
    short: 'Fracciones',
    t: 'Estudio de los números: fracciones',
    pda: 'Usa medios, cuartos y octavos para expresar partes de un todo y compararlas.',
    sk: ['fr'],
    st: 'curso',
    tests: ['Fracciones · prueba 1 · 10 reactivos', 'Fracciones · repaso con pistas · 6 reactivos'],
  },
  {
    id: 'c3',
    short: 'Suma y resta',
    t: 'Suma y resta, su relación como operaciones inversas',
    pda: 'Resuelve problemas de suma y resta con números hasta 1 000.',
    sk: ['sr'],
    st: 'visto',
    tests: ['Suma y resta · prueba 1 · 8 reactivos'],
  },
  {
    id: 'c4',
    short: 'Mult. y división',
    t: 'Multiplicación y división, su relación como operaciones inversas',
    pda: 'Resuelve problemas de multiplicación hasta 10 × 10 y de reparto en partes iguales.',
    sk: ['mu', 'di'],
    st: 'curso',
    tests: ['Multiplicación y división · prueba 1 · 10 reactivos'],
  },
  {
    id: 'c5',
    short: 'Medición',
    t: 'Medición de longitud, masa y capacidad',
    pda: 'Compara y mide longitudes, masas y capacidades con unidades convencionales.',
    sk: ['me'],
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
  fr: {
    t: 'Tiras de fracciones',
    d: 'En parejas, doblen tiras de papel en 2, 4 y 8 partes iguales. Pinten una parte de cada tira y comparen cuál pedazo es más grande.',
    meta: '20 min · En parejas · Tiras de papel y colores',
    err: 'Escribe el total de partes arriba (4/1 en lugar de 1/4).',
  },
  di: {
    t: 'Repartos con fichas',
    d: 'Repartan 24 fichas en grupos iguales de distintas formas y escriban la división que representa cada reparto.',
    meta: '15 min · Equipos de 3 · Fichas o semillas',
    err: 'Reparte sin que todos los grupos queden iguales.',
  },
  mu: {
    t: 'Arreglos rectangulares',
    d: 'Formen filas y columnas con fichas para representar multiplicaciones y cuenten el total de dos formas.',
    meta: '15 min · En parejas · Fichas',
    err: 'Suma los números en lugar de multiplicarlos.',
  },
  vp: {
    t: 'Tablero de centenas',
    d: 'Con billetes de juguete de 100, 10 y 1, armen números que dicte un compañero y escríbanlos.',
    meta: '15 min · En parejas · Billetes de juguete',
    err: 'Confunde decenas con centenas al escribir el número.',
  },
  sr: {
    t: 'La tiendita',
    d: 'Compren y vendan con precios hasta 500 pesos; anoten la suma y el cambio de cada compra.',
    meta: '20 min · Equipos de 4 · Etiquetas de precio',
    err: 'Olvida agrupar las decenas al sumar.',
  },
  me: {
    t: 'Medimos el salón',
    d: 'Midan objetos del salón con regla y cinta, empezando siempre desde el cero, y comparen sus resultados.',
    meta: '20 min · En parejas · Regla y cinta métrica',
    err: 'Empieza a medir desde el 1 de la regla, no desde el 0.',
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
  vp: '123',
  sr: '+ −',
  mu: '×',
  di: '÷',
  fr: '½',
  me: 'cm',
};

export const EVOLUTION_OFFSETS = { vp: 6, sr: 9, mu: 4, di: 3, me: 5 };
