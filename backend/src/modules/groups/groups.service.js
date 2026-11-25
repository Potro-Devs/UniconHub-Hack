/**
 * Módulo groups — Capa 2 (Aplicación): casos de uso de grupos y alumnos.
 *
 * Autorización:
 * - `teacher`: solo sus grupos (`teacher_id = sub`) y los alumnos activos en ellos.
 * - `director`: solo lectura de los grupos y alumnos de su escuela.
 * - `student`: solo su propio avatar.
 * Si el recurso no existe o no es accesible se responde 404 (no se revela qué ids existen).
 */
import { HttpError } from '../../shared/errors/HttpError.js';
import { ROLES } from '../auth/auth.domain.js';
import { phaseForGrade } from '../curriculum/curriculum.domain.js';
import {
  assertGroupPatchAllowed,
  buildNewStudent,
  generateInternalFolio,
  generateJoinCode,
  parseAvatarPatch,
  parseBulkInput,
  parseGroupInput,
  parseGroupPatch,
  parsePositiveId,
  parseStudentInput,
  toGroupDto,
  toStudentDto,
} from './groups.domain.js';
import { createGroupAccess } from './groups.access.js';
import { readSpreadsheetRows } from './groups.import.js';
import { parseImportInput, rowsToStudentList } from './groups.import.domain.js';

const MAX_CODE_ATTEMPTS = 20;

const STUDENT_NOT_FOUND = () => new HttpError(404, 'STUDENT_NOT_FOUND', 'No encontramos a ese alumno.');
const GROUP_ALREADY_EXISTS = () =>
  new HttpError(409, 'GROUP_ALREADY_EXISTS', 'Ese grupo ya está registrado en tu escuela.');
const SESSION_INVALID = () => new HttpError(401, 'SESSION_INVALID', 'Tu sesión ya no es válida. Vuelve a entrar.');

/**
 * Genera un valor único con reintentos. Lanza 500 si se agotan (prácticamente imposible).
 */
function uniqueCode(generate, exists) {
  for (let i = 0; i < MAX_CODE_ATTEMPTS; i += 1) {
    const code = generate();
    if (!exists(code)) return code;
  }
  throw new Error('No se pudo generar un código único.');
}

/**
 * @param {{
 *   repository: ReturnType<import('./groups.repository.js').createGroupsRepository>,
 *   transaction: <T>(fn: () => T) => T,
 *   random?: () => number,
 * }} deps
 */
export function createGroupsService({ repository, transaction, random = Math.random }) {
  const toGroup = (row) => toGroupDto(row, phaseForGrade(row.grade));

  // Regla de acceso a grupos centralizada en `groups.access.js`.
  const { findReadableGroup, findOwnGroup } = createGroupAccess(repository);

  const assertNotDuplicate = (fields, excludeId) => {
    if (repository.groupExists(fields, excludeId)) throw GROUP_ALREADY_EXISTS();
  };

  const createStudent = (group, input) => {
    const draft = buildNewStudent(input, random);
    if (repository.folioExists(draft.internal_folio)) {
      draft.internal_folio = uniqueCode(() => generateInternalFolio(random), (folio) => repository.folioExists(folio));
    }
    const id = repository.insertStudent(group.school_id, draft);
    repository.enrollActive(group.id, id);
    return toStudentDto({ id, ...draft, avatar_id: null });
  };

  return {
    listGroups(auth) {
      const rows =
        auth.role === ROLES.DIRECTOR
          ? repository.listGroupsOfSchool(auth.schoolId)
          : repository.listGroupsOfTeacher(Number(auth.sub), auth.schoolId);
      return rows.map(toGroup);
    },

    createGroup(auth, body) {
      const input = parseGroupInput(body);
      const teacher = repository.findStaffById(Number(auth.sub));
      if (!teacher || teacher.role !== ROLES.TEACHER || teacher.school_id !== auth.schoolId) throw SESSION_INVALID();
      const fields = { ...input, schoolId: teacher.school_id };

      return transaction(() => {
        assertNotDuplicate(fields, 0);
        const joinCode = uniqueCode(() => generateJoinCode(random), (code) => repository.joinCodeExists(code));
        const id = repository.insertGroup({ ...fields, teacherId: teacher.id, joinCode });
        return toGroup(repository.findGroupOfSchool(id, teacher.school_id));
      });
    },

    getGroup(auth, groupId) {
      return toGroup(findReadableGroup(auth, groupId));
    },

    updateGroup(auth, groupId, body) {
      const group = findOwnGroup(auth, groupId);
      const patch = parseGroupPatch(body);
      assertGroupPatchAllowed(group, patch, repository.groupHasHistory(group.id));
      const next = {
        schoolId: group.school_id,
        grade: patch.grade ?? group.grade,
        section: patch.section ?? group.section,
        schoolYear: patch.schoolYear ?? group.school_year,
      };
      return transaction(() => {
        assertNotDuplicate(next, group.id);
        repository.updateGroup(group.id, next);
        return toGroup(repository.findGroupOfSchool(group.id, group.school_id));
      });
    },

    listStudents(auth, groupId) {
      const group = findReadableGroup(auth, groupId);
      return repository.listActiveStudents(group.id).map(toStudentDto);
    },

    addStudent(auth, groupId, body) {
      const group = findOwnGroup(auth, groupId);
      const input = parseStudentInput(body);
      return transaction(() => createStudent(group, input));
    },

    /**
     * Alta masiva todo o nada: si alguna línea es inválida se rechaza el lote sin guardar nada;
     * si todas son válidas, se crean en una sola transacción.
     */
    addStudentsBulk(auth, groupId, body) {
      const group = findOwnGroup(auth, groupId);
      const students = parseBulkInput(body);
      const created = transaction(() => students.map((input) => createStudent(group, input)));
      return { created };
    },

    /**
     * Vista previa de la importación desde Excel/CSV: lee el archivo y devuelve la lista
     * "Apellidos, Nombres" que la docente revisa y guarda con el alta por lista. No guarda nada.
     */
    async previewStudentImport(auth, groupId, body) {
      findOwnGroup(auth, groupId);
      const { kind, buffer } = parseImportInput(body);
      return rowsToStudentList(await readSpreadsheetRows(kind, buffer));
    },

    updateAvatar(auth, studentId, body) {
      const id = parsePositiveId(studentId, 'id del alumno');
      const patch = parseAvatarPatch(body);
      const student =
        auth.role === ROLES.STUDENT
          ? Number(auth.sub) === id && repository.findActiveStudentInGroup(id, Number(auth.groupId))
          : repository.findActiveStudentOfTeacher(id, Number(auth.sub), auth.schoolId);
      if (!student) throw STUDENT_NOT_FOUND();
      // Campo ausente → se conserva; `avatarId: null` → se quita.
      repository.updateAvatar(id, {
        avatarId: patch.avatarId !== undefined ? patch.avatarId : student.avatar_id,
        avatarColor: patch.avatarColor ?? student.avatar_color,
      });
      return toStudentDto(repository.findStudentById(id));
    },
  };
}
