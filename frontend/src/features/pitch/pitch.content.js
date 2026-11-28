import { APP_NAME, TEAM_LEARNING_NAME } from '../../config/brand.js';

export const PITCH_SOURCE = Object.freeze({
  label: 'OCDE · PISA 2022 · México · Estudiantes de 15 años',
  url: 'https://www.oecd.org/en/publications/pisa-2022-results-volume-i-and-ii-country-notes_ed6fbcc5-en/mexico_519eaf88-en.html',
});

/** Fuentes de los otros datos del guion. */
export const PITCH_EXTRA_SOURCES = Object.freeze([
  { label: 'UNESCO (reportado por El Imparcial, 2026) · 7 de cada 10 primarias sin internet o computadoras', url: 'https://www.elimparcial.com/mexico/2026/03/18/unesco-califica-a-mexico-sin-progreso-en-educacion-por-retroceso-en-lectura-y-la-falta-de-internet-en-7-de-cada-10-escuelas-primarias-del-pais/' },
  { label: 'INEGI · Niñas y niños de 3 a 14 años hablantes de lengua indígena (≈1.4 millones)', url: 'https://www.inegi.org.mx/contenidos/saladeprensa/aproposito/2021/EAP_Nino21.pdf' },
]);

export const TEAM_NAME = 'PotroDevs';
export const TEAM_MEMBERS = Object.freeze(['Raúl Treviño Licona', 'Lizbeth Ocampo Blanco', 'Osvaldo Estrada Lara']);

/**
 * Guion original para narración humana (2:48, debajo de 3 minutos). Cada recorrido parte de
 * un problema real y muestra en el sistema cómo lo resuelve. Las capturas son del prototipo
 * con datos ficticios del seed demo. `chapter` es el nombre corto del índice.
 */
export const PITCH_SCENES = Object.freeze([
  {
    id: 'title', seconds: 12, chapter: 'Portada', kicker: 'Hackathon · Educación primaria en México',
    title: APP_NAME, accent: 'Cada error abre un siguiente paso.',
    narration: `Somos ${TEAM_NAME}: Raúl Treviño, Lizbeth Ocampo y Osvaldo Estrada. Les presentamos ${APP_NAME}, una plataforma que ayuda a las primarias públicas de México a entender por qué se equivoca cada alumno.`,
  },
  {
    id: 'opening', seconds: 12, chapter: 'El salón', kicker: 'Cada alumno tiene una forma de pensar',
    title: '45 alumnos.', accent: '45 puntos de partida.',
    narration: 'Imagina un salón con cuarenta y cinco alumnos y una sola docente. ¿Cómo descubrir quién necesita ayuda y, sobre todo, por qué se equivoca?',
  },
  {
    id: 'context', seconds: 14, chapter: 'Contexto', kicker: 'El problema empieza antes',
    title: 'Entender a tiempo.', accent: 'Acompañar desde primaria.',
    narration: `En PISA dos mil veintidós, solo el treinta y cuatro por ciento de los jóvenes mexicanos de quince años alcanzó el nivel mínimo en matemáticas. ${APP_NAME} actúa antes: desde primaria.`,
  },
  {
    id: 'map', seconds: 20, chapter: 'Docente', kicker: 'Docente · Mapa del grupo',
    title: 'En segundos,', accent: 'sabe a quién acompañar.',
    narration: 'La docente abre el mapa de su grupo y en segundos sabe cuántos alumnos necesitan apoyo, qué habilidad atender primero y cómo va cada alumno, siempre con porcentaje y etiqueta. Así decide con evidencia, no con intuición.',
  },
  {
    id: 'diagnosis', seconds: 16, chapter: 'Error típico', kicker: 'Diferenciador · Diagnóstico del error típico',
    title: 'Su respuesta', accent: 'nos dice cómo ayudar.',
    narration: 'Un alumno suma numeradores y denominadores. No es solo un error: es una confusión concreta. Cada opción incorrecta está etiquetada con su error típico, así la docente sabe qué trabajar y con quién.',
  },
  {
    id: 'student', seconds: 16, chapter: 'Alumno', kicker: 'Alumno · Un reactivo a la vez',
    title: 'Pistas,', accent: 'no respuestas.',
    narration: 'El alumno resuelve un reactivo a la vez, sin tiempo límite, y puede pedir hasta tres pistas que nunca revelan la respuesta. Lo que logra con apoyo se registra aparte.',
  },
  {
    id: 'paper', seconds: 18, chapter: 'Modo papel', kicker: 'Diferenciador · Pensado para el salón real',
    title: 'Sin internet,', accent: 'también funciona.',
    narration: 'Según la UNESCO, siete de cada diez primarias no tienen internet o computadoras para sus alumnos. Por eso la docente arma el cuestionario, lo imprime en blanco y negro y captura las respuestas desde su celular.',
  },
  {
    id: 'teams', seconds: 20, chapter: 'En equipo', kicker: `Diferenciador · ${TEAM_LEARNING_NAME}`,
    title: 'Lo que uno comprende,', accent: 'puede ayudar a otro.',
    narration: `Con ${TEAM_LEARNING_NAME}, ${APP_NAME} forma equipos a partir de los resultados: un compañero guía acompaña hasta a dos, mientras la docente atiende a quien más lo necesita. Imprime tarjetas con pistas y, al final, cada alumno demuestra lo aprendido.`,
  },
  {
    id: 'languages', seconds: 14, chapter: 'Lenguas', kicker: 'Diferenciador · Inclusión',
    title: 'Español, náhuatl', accent: 'y maya.',
    narration: `Más de un millón de niñas y niños hablan una lengua indígena. ${APP_NAME} puede mostrarse en náhuatl o maya, con el español debajo, para alumnos y docentes.`,
  },
  {
    id: 'school', seconds: 14, chapter: 'Dirección', kicker: 'Dirección · Continuidad',
    title: 'Cambia de grado,', accent: 'su historia continúa.',
    narration: 'La dirección ve sus docentes y grupos, y el historial acompaña a cada alumno entre grados con un folio interno, sin pedir CURP.',
  },
  {
    id: 'closing', seconds: 12, chapter: APP_NAME, kicker: 'Diagnosticar · Acompañar · Dar continuidad',
    title: APP_NAME, accent: 'Cada error abre un siguiente paso.',
    narration: `${APP_NAME} convierte cada error en un siguiente paso. Lo siguiente es validarlo con docentes y probarlo en escuelas. Somos ${TEAM_NAME}. Gracias.`,
  },
]);

export const PITCH_DURATION = PITCH_SCENES.reduce((total, scene) => total + scene.seconds, 0);
