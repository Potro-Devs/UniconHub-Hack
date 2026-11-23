/**
 * Módulo groups — Regla de acceso a grupos.
 *
 * **Única fuente de la regla de acceso a grupos.** Cualquier módulo que reciba un `groupId`
 * (assessments, curriculum, paper-mode, analytics...) debe usar `createGroupAccess` en lugar de
 * repetir la consulta, para que la autorización no diverja entre módulos.
 *
 * - `teacher`: solo grupos con `teacher_id = sub` y `school_id` de su sesión.
 * - `director`: solo lectura de los grupos de su escuela (`school_id`).
 * - Cualquier otro rol, grupo inexistente o ajeno → 404 `GROUP_NOT_FOUND` con el mismo cuerpo
 *   (no se revela qué ids existen).
 */
import { HttpError } from '../../shared/errors/HttpError.js';
import { ROLES } from '../auth/auth.domain.js';
import { parsePositiveId } from './groups.domain.js';

export const GROUP_NOT_FOUND = () => new HttpError(404, 'GROUP_NOT_FOUND', 'No encontramos ese grupo.');

/**
 * @param {Pick<ReturnType<import('./groups.repository.js').createGroupsRepository>, 'findGroupOfTeacher' | 'findGroupOfSchool'>} groupsRepository
 */
export function createGroupAccess(groupsRepository) {
  /**
   * Grupo visible para la sesión, o `null`. No lanza: sirve para validar recursos hijos
   * (p. ej. una asignación) y responder con el 404 propio de ese recurso.
   *
   * @param {{ role: string, sub: string, schoolId: number }} auth
   * @param {number} id Id ya validado.
   */
  const findReadableGroupById = (auth, id) => {
    if (auth.role === ROLES.DIRECTOR) return groupsRepository.findGroupOfSchool(id, auth.schoolId);
    if (auth.role === ROLES.TEACHER) return groupsRepository.findGroupOfTeacher(id, Number(auth.sub), auth.schoolId);
    return null;
  };

  return {
    findReadableGroupById,

    /** Grupo legible (docente dueño o director de la escuela). 400 si el id no es válido; 404 si no. */
    findReadableGroup(auth, groupId) {
      const group = findReadableGroupById(auth, parsePositiveId(groupId, 'id del grupo'));
      if (!group) throw GROUP_NOT_FOUND();
      return group;
    },

    /** Grupo editable: solo el docente dueño. Otro rol → 404, igual que un grupo inexistente. */
    findOwnGroup(auth, groupId) {
      const id = parsePositiveId(groupId, 'id del grupo');
      const group =
        auth.role === ROLES.TEACHER ? groupsRepository.findGroupOfTeacher(id, Number(auth.sub), auth.schoolId) : null;
      if (!group) throw GROUP_NOT_FOUND();
      return group;
    },
  };
}
