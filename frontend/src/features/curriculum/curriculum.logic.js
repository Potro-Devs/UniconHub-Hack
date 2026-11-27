/** Presentación del temario; las reglas y los porcentajes vienen del servidor. */
export const CONTENT_STATUSES = [
  { code: 'pending', label: 'Pendiente' },
  { code: 'in_progress', label: 'En curso' },
  { code: 'seen', label: 'Visto' },
];

const SKILL_NAMES = {
  fractions: 'Fracciones', multiplication: 'Multiplicaciones', place_value: 'Valor posicional',
  problem_solving: 'Resolución de problemas', reading_comprehension: 'Comprensión lectora',
};

export function skillsOfContents(contents) {
  return [...new Map(contents.filter((content) => content.skill?.code).map((content) => [content.skill.code, content.skill])).values()];
}

export function toggleSelection(values, value) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function assignmentLink(skillCode) {
  return `/docente/temario?${new URLSearchParams({ skill: skillCode, assign: '1' })}`;
}

/** Valida solo la forma del formulario, no el número de reactivos ni el dominio. */
export function assignmentFormErrors({ title, skills, recipients, studentIds, modality }) {
  const errors = {};
  if (!title.trim() || title.trim().length > 120) errors.title = 'Escribe un título de hasta 120 caracteres.';
  if (!skills.length) errors.skills = 'Elige al menos una habilidad.';
  if (recipients === 'selected' && !studentIds.length) errors.studentIds = 'Elige al menos un alumno.';
  if (!['screen', 'paper'].includes(modality)) errors.modality = 'Elige cómo responderán la prueba.';
  return errors;
}

export function assignmentPayload({ title, skills, recipients, studentIds, modality }) {
  return {
    title: title.trim(), modality, skills: [...new Set(skills)],
    ...(recipients === 'selected' ? { studentIds: [...new Set(studentIds)] } : {}),
  };
}

export function assignmentErrorMessage(error, skills = []) {
  if (error?.code === 'INSUFFICIENT_QUESTIONS_PER_SKILL') {
    const insufficient = error.details?.insufficient ?? [];
    if (insufficient.length) return insufficient.map(({ skill, count }) => {
      const name = skills.find((item) => item.code === skill)?.name ?? SKILL_NAMES[skill] ?? 'La habilidad elegida';
      return `${name} necesita al menos 3 reactivos y hay ${count}.`;
    }).join(' ');
  }
  if (error?.code === 'NO_ACTIVE_STUDENTS') return 'Agrega alumnos al grupo antes de asignar una prueba.';
  return error?.message || 'No pudimos asignar la prueba. Revisa tu conexión e inténtalo de nuevo.';
}

export function assignmentFieldError(error) {
  const field = error?.details?.field;
  return ['title', 'skills', 'studentIds', 'modality'].includes(field) ? field : null;
}
