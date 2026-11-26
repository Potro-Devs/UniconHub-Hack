/**
 * Módulo diagnostics — Capa 2 (Aplicación): cierre de una sesión por habilidad.
 * Única fuente del corte de dominio en `skill_mastery_history`, compartida por el cierre en
 * pantalla (`diagnostics/complete`) y la captura en papel (`paper/capture`).
 * Debe llamarse dentro de una transacción.
 */
import { buildNextMasteryCut, getMasteryLevel } from '../analytics/analytics.domain.js';
import { canRecordMasteryCut, evaluateAchievements, scoreSession } from './diagnostics.domain.js';

/**
 * Agrupa las respuestas por habilidad, registra un corte inmutable para cada habilidad con al menos
 * 3 reactivos contestados y, si `recordAchievements`, guarda los logros de subir de nivel o mejorar.
 *
 * @param {{
 *   repository: ReturnType<import('./diagnostics.repository.js').createDiagnosticsRepository>,
 *   studentId: number,
 *   assignmentId: number,
 *   grade: number,
 *   questionRows: Array<{ id: number, skill_id: number, skill_code: string, skill_name: string }>,
 *   responses: Array<{ question_id: number, outcome_status: string }>,
 *   recordAchievements: boolean,
 * }} input
 * @returns {{ skills: object[], celebrations: object[] }} `celebrations` no incluye `block_completed`.
 */
export function closeSkillSessions({ repository, studentId, assignmentId, grade, questionRows, responses, recordAchievements }) {
  const responseByQuestion = new Map(responses.map((r) => [r.question_id, r]));
  const skillGroups = new Map();
  for (const q of questionRows) {
    if (!skillGroups.has(q.skill_id)) {
      skillGroups.set(q.skill_id, { skillId: q.skill_id, code: q.skill_code, name: q.skill_name, responses: [] });
    }
    skillGroups.get(q.skill_id).responses.push(responseByQuestion.get(q.id));
  }

  const skills = [];
  const celebrations = [];
  for (const sg of skillGroups.values()) {
    const session = scoreSession(sg.responses);
    const previousCuts = repository.listMasteryCuts(studentId, sg.skillId);
    const previousPercentage = previousCuts.length ? previousCuts[previousCuts.length - 1].mastery_percentage : null;

    let masteryRecorded = false;
    let masteryPercentage = previousPercentage;
    let message = null;

    if (canRecordMasteryCut(sg.responses)) {
      const cut = buildNextMasteryCut(previousCuts, session);
      repository.insertMasteryCut({ studentId, skillId: sg.skillId, assignmentId, grade, cut });
      const outcome = evaluateAchievements({
        blockCompleted: false,
        previousPercentage,
        currentPercentage: cut.mastery_percentage,
      });
      if (recordAchievements) {
        for (const c of outcome.celebrations) {
          repository.insertAchievement({ studentId, code: c.code, size: c.size, skillId: sg.skillId, assignmentId });
          celebrations.push({ code: c.code, size: c.size, skillCode: sg.code, skillName: sg.name });
        }
      }
      masteryRecorded = true;
      masteryPercentage = cut.mastery_percentage;
      message = outcome.message;
    }

    const level = masteryPercentage == null ? null : getMasteryLevel(masteryPercentage);
    skills.push({
      code: sg.code,
      name: sg.name,
      total: session.total,
      correctAutonomous: session.correctAutonomous,
      achievedWithSupport: session.achievedWithSupport,
      incorrect: session.incorrect,
      unanswered: session.unanswered,
      autonomousPercentage: session.autonomousPercentage,
      supportedPercentage: session.supportedPercentage,
      masteryRecorded,
      masteryPercentage,
      masteryLevel: level?.code ?? null,
      masteryLabel: level?.label ?? null,
      message,
    });
  }
  return { skills, celebrations };
}
