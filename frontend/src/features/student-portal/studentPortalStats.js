import { LEVELS, getLevelIndex } from '@/config/brand';
import {
  EVOLUTION_OFFSETS,
  SKILLS,
  STUDENTS,
  STUDENT_ACHIEVEMENTS,
  STUDENT_QUIZZES,
} from '@/shared/data/seedData';

/**
 * Promedio ponderado evolutivo lineal (sesión i con peso w_i = i).
 * Replica la regla pura del dominio pedagógico en el cliente.
 */
export function weightedEvolution(scores) {
  if (!scores.length) return 0;
  let weightedSum = 0;
  let weightTotal = 0;
  scores.forEach((pct, idx) => {
    const w = idx + 1;
    weightedSum += w * pct;
    weightTotal += w;
  });
  return Math.round(weightedSum / weightTotal);
}

/**
 * Extrae el primer nombre amigable para saludar al estudiante.
 */
export function pickFirstName(displayName, fallback = 'Sofía') {
  const clean = String(displayName ?? '').trim();
  if (!clean) return fallback;
  return clean.split(/\s+/)[0] || fallback;
}

/**
 * Combina los cuestionarios semilla con las respuestas completadas en la sesión.
 */
export function getQuizItems(completedQuizzes = {}) {
  return STUDENT_QUIZZES.map((quiz) => {
    const completion = completedQuizzes[quiz.id] ?? null;
    const isPaperLocked = Boolean(quiz.isScreenLocked || quiz.status === 'completed_paper');

    let resolvedStatus = quiz.status;
    let scorePct = quiz.scorePct ?? null;

    if (isPaperLocked) {
      resolvedStatus = 'completed_paper';
    } else if (completion) {
      resolvedStatus = 'completed_screen';
      scorePct = completion.autonomousPct;
    }

    const levelIdx = scorePct != null ? getLevelIndex(scorePct) : null;
    return {
      ...quiz,
      resolvedStatus,
      isPaperLocked,
      completion,
      scorePct,
      levelIdx,
      level: levelIdx != null ? LEVELS[levelIdx] : null,
    };
  });
}

/**
 * Calcula resumen evolutivo de las 5 habilidades para el estudiante activo.
 */
export function getStudentSkillSummaries(stuIdx = 0, completedQuizzes = {}) {
  const student = STUDENTS[stuIdx] ?? STUDENTS[0];
  const completedList = Object.values(completedQuizzes);

  return SKILLS.map((skill) => {
    const basePct = student.sc?.[skill.id] ?? skill.b ?? 44;
    const initialPct =
      student.prev?.[skill.id] ??
      Math.max(18, basePct - (EVOLUTION_OFFSETS[skill.id] ?? 8) - 4);

    const skillCompletions = completedList.filter((item) => item.skillId === skill.id);
    const currentPct = skillCompletions.length
      ? weightedEvolution([initialPct, basePct, ...skillCompletions.map((c) => c.autonomousPct)])
      : basePct;

    const withSupportCount = skillCompletions.reduce(
      (sum, item) => sum + (item.withSupportCount ?? 0),
      0,
    );
    const autonomousCount = skillCompletions.reduce(
      (sum, item) => sum + (item.autonomousCount ?? 0),
      0,
    );

    const deltaPct = currentPct - initialPct;
    const levelIdx = getLevelIndex(currentPct);

    return {
      id: skill.id,
      name: skill.name,
      initialPct,
      currentPct,
      deltaPct,
      levelIdx,
      level: LEVELS[levelIdx],
      withSupportCount,
      autonomousCount,
      hasNewCompletion: skillCompletions.length > 0,
    };
  });
}

/**
 * Devuelve la lista de sellos logrados (semilla + logros desbloqueados en sesión).
 */
export function getEarnedAchievements(completedQuizzes = {}) {
  const completedList = Object.values(completedQuizzes);
  if (!completedList.length) return STUDENT_ACHIEVEMENTS;

  const latest = completedList[completedList.length - 1];
  return [
    {
      id: `ach-session-${latest.quizId}`,
      mascotColor: 'rosa',
      category: 'Recién logrado',
      categoryTone: 'mastered',
      title: `${latest.title} terminado`,
      description:
        latest.withSupportCount > 0
          ? `Completaste tu cuestionario con ${latest.autonomousCount} aciertos autónomos y ${latest.withSupportCount} logrados con apoyo.`
          : `Completaste tu cuestionario con ${latest.autonomousCount} aciertos autónomos sin pistas.`,
      earnedAt: 'Obtenido hoy',
      isMilestone: true,
    },
    ...STUDENT_ACHIEVEMENTS,
  ];
}
