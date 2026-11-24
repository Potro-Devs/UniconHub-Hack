/** Casos de uso del ciclo "error detectado → actividad → nueva prueba". */
import { HttpError } from '../../shared/errors/HttpError.js';
import { createGroupAccess } from '../groups/groups.access.js';
import { parseInterventionInput, summarizeInterventionOutcome } from './interventions.domain.js';

const toDto = (row, outcome) => ({
  id: row.id, appliedAt: row.applied_at, note: row.note,
  activity: { id: row.activity_id, title: row.title, durationMinutes: row.duration_minutes, grouping: row.grouping },
  skillCode: row.skill_code, skillName: row.skill_name,
  targetErrorTag: row.target_error_tag, errorExplanation: row.error_explanation ?? null,
  outcome,
});

export function createInterventionsService({ repository, groupsRepository }) {
  const { findReadableGroup, findOwnGroup } = createGroupAccess(groupsRepository);
  const withOutcome = (groupId, row) => toDto(row, summarizeInterventionOutcome(repository.findOutcomeIds({
    groupId, skillId: row.skill_id, errorTag: row.target_error_tag, appliedAt: row.applied_at })));
  return {
    list(auth, groupId) {
      const group = findReadableGroup(auth, groupId);
      return { interventions: repository.listByGroup(group.id).map((row) => withOutcome(group.id, row)) };
    },
    create(auth, groupId, body) {
      const group = findOwnGroup(auth, groupId);
      const input = parseInterventionInput(body);
      const activity = repository.findActivityForGrade(input.activityId, group.grade);
      if (!activity) throw new HttpError(404, 'ACTIVITY_NOT_FOUND', 'Esa actividad no está en el catálogo de este grado.');
      const id = repository.create({ groupId: group.id, activityId: activity.id, skillId: activity.skill_id,
        errorTag: activity.target_error_tag ?? null, userId: Number(auth.sub), note: input.note });
      return withOutcome(group.id, repository.listByGroup(group.id).find((entry) => entry.id === id));
    },
  };
}
