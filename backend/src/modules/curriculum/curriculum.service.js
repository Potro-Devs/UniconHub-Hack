/**
 * Módulo curriculum — Capa 2 (Aplicación): temario del grupo, avance y cobertura.
 *
 * Autorización idéntica a `groups`:
 * - `teacher`: solo sus grupos (`teacher_id` + `school_id`); puede editar el avance.
 * - `director`: solo lectura de los grupos de su escuela.
 * - `student`: sin acceso (403 en las rutas).
 * Grupo o contenido inexistente o ajeno → 404 (no se revela qué ids existen).
 */
import { HttpError } from '../../shared/errors/HttpError.js';
import { createGroupAccess } from '../groups/groups.access.js';
import { parsePositiveId } from '../groups/groups.domain.js';
import {
  CURRICULUM_REVIEW_NOTICE,
  computeCoverage,
  computeCoverageBySkill,
  mergeCurriculumProgress,
  parseCurriculumPatch,
  phaseForGrade,
  toCurriculumContentDto,
} from './curriculum.domain.js';

const CONTENT_NOT_FOUND = () =>
  new HttpError(404, 'CONTENT_NOT_FOUND', 'No encontramos ese contenido en el temario del grupo.');

/**
 * @param {{
 *   repository: ReturnType<import('./curriculum.repository.js').createCurriculumRepository>,
 *   groupsRepository: ReturnType<import('../groups/groups.repository.js').createGroupsRepository>,
 *   transaction: <T>(fn: () => T) => T,
 * }} deps
 */
export function createCurriculumService({ repository, groupsRepository, transaction }) {
  // Regla de acceso única de `groups` (docente: propio; director: lectura de su escuela; resto → 404).
  const { findReadableGroup, findOwnGroup } = createGroupAccess(groupsRepository);

  const loadContents = (group) =>
    repository.listContentsWithProgress(group.id, group.grade).map(toCurriculumContentDto);

  const coverageOf = (contents) => ({
    ...computeCoverage(contents.length, contents.map((c) => ({ status: c.status }))),
    bySkill: computeCoverageBySkill(contents),
  });

  const groupMeta = (group) => ({ id: group.id, grade: group.grade, phase: phaseForGrade(group.grade) });

  return {
    getGroupCurriculum(auth, groupId) {
      const group = findReadableGroup(auth, groupId);
      const contents = loadContents(group);
      return {
        contents,
        meta: {
          count: contents.length,
          group: groupMeta(group),
          coverage: coverageOf(contents),
          contentReview: CURRICULUM_REVIEW_NOTICE,
        },
      };
    },

    getCoverage(auth, groupId) {
      const group = findReadableGroup(auth, groupId);
      return { coverage: coverageOf(loadContents(group)), meta: { group: groupMeta(group) } };
    },

    updateContentProgress(auth, groupId, contentId, body) {
      const group = findOwnGroup(auth, groupId);
      const id = parsePositiveId(contentId, 'id del contenido');
      const patch = parseCurriculumPatch(body);
      return transaction(() => {
        const current = repository.findContentWithProgress(group.id, id, group.grade);
        if (!current) throw CONTENT_NOT_FOUND();
        repository.upsertProgress(group.id, id, mergeCurriculumProgress(current, patch));
        return toCurriculumContentDto(repository.findContentWithProgress(group.id, id, group.grade));
      });
    },
  };
}
