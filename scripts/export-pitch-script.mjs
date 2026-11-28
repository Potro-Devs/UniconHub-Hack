import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { APP_NAME } from '../frontend/src/config/brand.js';
import { PITCH_EXTRA_SOURCES, PITCH_SCENES, PITCH_DURATION, PITCH_SOURCE, TEAM_MEMBERS, TEAM_NAME } from '../frontend/src/features/pitch/pitch.content.js';

const stamp = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
let elapsed = 0;
const sections = PITCH_SCENES.map((scene) => {
  const start = elapsed;
  elapsed += scene.seconds;
  return `## ${stamp(start)}–${stamp(elapsed)} · ${scene.kicker}\n\n${scene.narration}`;
});
const words = PITCH_SCENES.map((scene) => scene.narration).join(' ').trim().split(/\s+/).length;
const document = `# Guion del pitch

Equipo **${TEAM_NAME}**: ${TEAM_MEMBERS.join(', ')}.

Duración de la animación: **${stamp(PITCH_DURATION)}**. Narración humana: ${words} palabras; ensayar a aproximadamente ${Math.round(words / (PITCH_DURATION / 60))} palabras por minuto, con pausas entre escenas.

${sections.join('\n\n')}

## Fuentes y alcance

${[PITCH_SOURCE, ...PITCH_EXTRA_SOURCES].map((source) => `- [${source.label}](${source.url})`).join('\n')}

Los porcentajes de PISA se refieren a estudiantes de 15 años evaluados en PISA 2022; motivan actuar desde primaria y no describen una medición del alumnado de ${APP_NAME}.

Las capturas de pantalla son del prototipo real con datos ficticios del seed demo; los nombres de alumnos no corresponden a personas reales. Las pistas y el contenido pedagógico requieren validación docente. El prototipo no presenta evidencia de impacto en escuelas.

## Preparar la grabación

1. Iniciar el frontend y abrir /pitch.
2. Ensayar con las notas del presentador y ajustar las pausas de la voz.
3. Abrir pantalla completa y activar modo limpio para grabar el escenario 16:9.
4. Activar **Sonido** (tecla M) para la música y los efectos, sintetizados en el navegador y apagados por defecto, y narrar el guion mientras se reproduce la animación.
5. Revisar que la grabación completa quede por debajo de tres minutos.

Para actualizar este documento después de editar el contenido de las escenas, ejecutar desde la raíz: node scripts/export-pitch-script.mjs.
`;
const target = fileURLToPath(new URL('../docs/pitch-guion.md', import.meta.url));
fs.writeFileSync(target, document, 'utf8');
console.log(`Guion actualizado: ${words} palabras, ${PITCH_DURATION} segundos.`);
