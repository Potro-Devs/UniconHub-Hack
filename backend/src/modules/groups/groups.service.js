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
  buildInitials,
  buildNewStudent,
  generateInternalFolio,
  generateJoinCode,
  parseAvatarPatch,
  parseBulkInput,
  parseGroupInput,
  parseGroupPatch,
  parsePositiveId,
  parseStudentInput,
  parseStudentPatch,
  studentHasHistory,
  toGroupDto,
  toStudentDto,
} from './groups.domain.js';
import { createGroupAccess } from './groups.access.js';
import { readSpreadsheetRows } from './groups.import.js';
import { parseImportInput, rowsToStudentList } from './groups.import.domain.js';

const MAX_CODE_ATTEMPTS = 20;

const STUDENT_NOT_FOUND = () => new HttpError(404, 'STUDENT_NOT_FOUND', 'No encontramos a ese alumno.');
const STUDENT_HAS_HISTORY = (details) => new HttpError(409, 'STUDENT_HAS_HISTORY',
  'Este alumno ya tiene respuestas o historial. Para conservarlo, dalo de baja en lugar de eliminarlo.', details);
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

  /** Grupo propio de la docente y alumno activo en él; si no, 404 (no se revela qué ids existen). */
  const findOwnActiveStudent = (auth, groupId, studentId) => {
    const group = findOwnGroup(auth, groupId);
    const id = parsePositiveId(studentId, 'id del alumno');
    const student = repository.findActiveStudentInGroup(id, group.id);
    if (!student) throw STUDENT_NOT_FOUND();
    return { group, student };
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

    /** Corrige nombre(s) y/o apellido(s) de un alumno activo del grupo; recalcula las iniciales. */
    updateStudent(auth, groupId, studentId, body) {
      const { student } = findOwnActiveStudent(auth, groupId, studentId);
      const patch = parseStudentPatch(body);
      const firstNames = patch.firstNames ?? student.first_names;
      const lastNames = patch.lastNames ?? student.last_names;
      repository.updateStudentNames(student.id, { firstNames, lastNames, initials: buildInitials(firstNames, lastNames) });
      return toStudentDto(repository.findStudentById(student.id));
    },

    /**
     * Baja del grupo: la inscripción pasa a `withdrawn` con fecha. No borra nada: el historial
     * (respuestas, cortes, logros) se conserva para el seguimiento longitudinal.
     */
    withdrawStudent(auth, groupId, studentId) {
      const { group, student } = findOwnActiveStudent(auth, groupId, studentId);
      repository.withdrawStudent(group.id, student.id);
      return { studentId: student.id, groupId: group.id, status: 'withdrawn' };
    },

    /** Elimina a un alumno creado por error. Solo si no tiene ningún dato; si lo tiene → 409. */
    deleteStudent(auth, groupId, studentId) {
      const { group, student } = findOwnActiveStudent(auth, groupId, studentId);
      return transaction(() => {
        const counts = repository.countStudentData(student.id, group.id);
        if (studentHasHistory(counts)) throw STUDENT_HAS_HISTORY(counts);
        repository.deleteStudent(student.id);
        return { studentId: student.id, deleted: true };
      });
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
