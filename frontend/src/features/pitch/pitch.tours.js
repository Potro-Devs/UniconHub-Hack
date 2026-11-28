/**
 * Recorridos guiados por capturas reales del prototipo (escritorio, 1440 px de ancho).
 * `rect` está en fracciones de la imagen (x, y, ancho, alto). `at` son segundos dentro de la
 * escena. `zoom` acerca la cámara a la zona. `ratio` = alto / ancho de la captura.
 * Todas las capturas usan datos ficticios del seed demo.
 */
import { APP_NAME, TEAM_LEARNING_NAME } from '../../config/brand.js';
import tourMapa from './assets/screens/tour-mapa.jpg';
import tourAlumno from './assets/screens/tour-alumno.jpg';
import tourConstructor from './assets/screens/tour-constructor.jpg';
import tourCaptura from './assets/screens/tour-captura.jpg';
import tourEquipos from './assets/screens/tour-equipos.jpg';
import tourMaya from './assets/screens/tour-maya.jpg';
import tourNahuatl from './assets/screens/tour-nahuatl.jpg';
import tourDireccion from './assets/screens/tour-direccion.jpg';

export const TOURS = Object.freeze({
  map: {
    problem: 'Con 45 alumnos, la docente no tiene tiempo de revisar examen por examen para saber a quién apoyar.',
    shots: [{ src: tourMapa, ratio: 2600 / 1440, address: `${APP_NAME} · Mapa del grupo` }],
    steps: [
      { at: 1.4, shot: 0, zoom: 1.75, rect: { x: 0.388, y: 0.155, w: 0.186, h: 0.083 }, title: '23 alumnos necesitan apoyo', text: 'Lo ve al abrir: quiénes requieren acompañamiento hoy.' },
      { at: 5.6, shot: 0, zoom: 1.75, rect: { x: 0.585, y: 0.155, w: 0.185, h: 0.083 }, title: 'Prioridad: Fracciones', text: 'La habilidad más débil del grupo, con su porcentaje y nivel.' },
      { at: 9.8, shot: 0, zoom: 1.3, rect: { x: 0.192, y: 0.246, w: 0.431, h: 0.227 }, title: 'Cada habilidad en % + etiqueta', text: 'Nunca solo color: Necesita apoyo, En proceso, Logrado, Dominado.' },
      { at: 14.4, shot: 0, zoom: 1.08, rect: { x: 0.192, y: 0.482, w: 0.775, h: 0.25 }, title: 'Alumno por alumno', text: 'Su avance por habilidad y su historial entre grados.' },
    ],
  },
  student: {
    problem: 'Un examen tradicional solo dice acertó o falló: no explica por qué ni da una segunda oportunidad.',
    shots: [{ src: tourAlumno, ratio: 1103 / 1440, address: `${APP_NAME} · Mi ejercicio` }],
    steps: [
      { at: 1.2, shot: 0, zoom: 1.45, rect: { x: 0.233, y: 0.177, w: 0.535, h: 0.122 }, title: 'Un reactivo a la vez', text: 'Botones grandes, sin tiempo límite ni castigos.' },
      { at: 4.8, shot: 0, zoom: 1.9, rect: { x: 0.251, y: 0.317, w: 0.497, h: 0.053 }, title: 'Pista 1 de 3', text: 'Orienta qué observar. Nunca revela la respuesta.' },
      { at: 8.4, shot: 0, zoom: 1.35, rect: { x: 0.251, y: 0.474, w: 0.497, h: 0.248 }, title: 'Cada opción es un error típico', text: `Si elige 4/1, ${APP_NAME} sabe que invirtió la fracción.` },
      { at: 12, shot: 0, zoom: 1.45, rect: { x: 0.233, y: 0.762, w: 0.535, h: 0.124 }, title: `${APP_NAME} acompaña`, text: '"Logrado con apoyo" se registra aparte del logro autónomo.' },
    ],
  },
  paper: {
    problem: '7 de cada 10 primarias no tienen internet o computadoras para sus alumnos.',
    shots: [
      { src: tourConstructor, ratio: 1698 / 1440, address: `${APP_NAME} · Constructor de cuestionarios` },
      { src: tourCaptura, ratio: 1290 / 1440, address: `${APP_NAME} · Captura de hojas` },
    ],
    steps: [
      { at: 1, shot: 0, zoom: 1.55, rect: { x: 0.192, y: 0.224, w: 0.449, h: 0.186 }, title: 'Arma el cuestionario', text: 'Por habilidad y grado, alineado al temario de la SEP.' },
      { at: 4.6, shot: 0, zoom: 1.6, rect: { x: 0.206, y: 0.701, w: 0.422, h: 0.141 }, title: `Opciones y pista de ${APP_NAME}`, text: 'Marca la correcta; la pista nunca revela la respuesta.' },
      { at: 9.4, shot: 1, zoom: 1.2, rect: { x: 0.376, y: 0.316, w: 0.417, h: 0.498 }, title: 'Imprime y captura', text: 'La hoja se responde sin internet; la docente toca A, B, C o D por alumno.' },
      { at: 13.8, shot: 1, zoom: 1.6, rect: { x: 0.376, y: 0.884, w: 0.417, h: 0.042 }, title: 'El mapa se actualiza', text: 'La evidencia en papel cuenta igual que en pantalla.' },
    ],
  },
  teams: {
    problem: 'Una docente no puede dar atención uno a uno a 45 alumnos al mismo tiempo.',
    shots: [{ src: tourEquipos, ratio: 1920 / 1440, address: `${APP_NAME} · ${TEAM_LEARNING_NAME}` }],
    steps: [
      { at: 1.2, shot: 0, zoom: 1.3, rect: { x: 0.208, y: 0.194, w: 0.754, h: 0.051 }, title: 'Elige la habilidad', text: `${APP_NAME} muestra cuántos pueden guiar y cuántos necesitan acompañamiento.` },
      { at: 4.8, shot: 0, zoom: 1.25, rect: { x: 0.208, y: 0.253, w: 0.754, h: 0.139 }, title: 'Equipos automáticos', text: '6 equipos y una mesa docente, formados con la evidencia del grupo.' },
      { at: 8.6, shot: 0, zoom: 1.2, rect: { x: 0.208, y: 0.4, w: 0.754, h: 0.156 }, title: '1 guía + hasta 2 compañeros', text: 'Se prefiere un guía que superó el mismo error.' },
      { at: 12.4, shot: 0, zoom: 1.65, rect: { x: 0.208, y: 0.561, w: 0.374, h: 0.073 }, title: 'Mesa docente', text: 'La maestra atiende a quien más apoyo necesita.' },
      { at: 16, shot: 0, zoom: 1.25, rect: { x: 0.192, y: 0.688, w: 0.786, h: 0.14 }, title: 'Tarjetas y demostración', text: 'Con 3 de 3 sin ayuda, ese alumno puede guiar después.' },
    ],
  },
  languages: {
    problem: 'Más de un millón de niñas y niños hablan una lengua indígena; casi todo el software educativo está solo en español.',
    shots: [
      { src: tourMaya, ratio: 1100 / 1440, address: `${APP_NAME} · Maaya t'aan` },
      { src: tourNahuatl, ratio: 900 / 1440, address: `${APP_NAME} · Nāhuatlahtōlli` },
    ],
    steps: [
      { at: 1, shot: 0, zoom: 1.7, rect: { x: 0.306, y: 0.011, w: 0.35, h: 0.049 }, title: 'El alumno, en maya', text: 'Káajbal, Xook, Báaxal… con el español debajo.' },
      { at: 4.2, shot: 0, zoom: 1.8, rect: { x: 0.109, y: 0.173, w: 0.294, h: 0.073 }, title: "Ba'ax ka wa'alik, Sofía!", text: 'El saludo en su lengua; el español no desaparece.' },
      { at: 7.6, shot: 1, zoom: 2.1, rect: { x: 0.0125, y: 0.353, w: 0.144, h: 0.058 }, title: 'La docente, en náhuatl', text: `Tlamachtianimeh: ${TEAM_LEARNING_NAME}.` },
      { at: 10.6, shot: 1, zoom: 2, rect: { x: 0.772, y: 0.089, w: 0.216, h: 0.051 }, title: 'Un toque para cambiar', text: 'Español, náhuatl o maya para todos los usuarios. Traducción en revisión con hablantes.' },
    ],
  },
  school: {
    problem: 'Al cambiar de grado o de docente, se pierde lo que ya se sabía del alumno.',
    shots: [{ src: tourDireccion, ratio: 940 / 1440, address: `${APP_NAME} · Escuela` }],
    steps: [
      { at: 1, shot: 0, zoom: 1.25, rect: { x: 0.192, y: 0.16, w: 0.785, h: 0.12 }, title: 'La escuela completa', text: 'Docentes, grupos y ciclo escolar en un solo lugar.' },
      { at: 4.8, shot: 0, zoom: 1.1, rect: { x: 0.192, y: 0.295, w: 0.785, h: 0.5 }, title: 'Cada docente y sus grupos', text: 'Base para promover grupos y trasladar alumnos con su historial.' },
      { at: 8.8, shot: 0, zoom: 1, rect: { x: 0.192, y: 0.295, w: 0.785, h: 0.5 }, title: 'Historial que viaja', text: 'Folio interno, sin CURP: el siguiente docente continúa donde se quedó.' },
    ],
  },
});
