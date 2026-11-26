/**
 * Módulo auth — Capa 3 (Dominio): validación de entradas, claims del token y
 * datos públicos de alumnos y docentes. Funciones puras sin I/O.
 */
import { DomainError } from '../../shared/errors/DomainError.js';
import { normalizeJoinCode } from '../groups/groups.domain.js';

export const ROLES = Object.freeze({ TEACHER: 'teacher', DIRECTOR: 'director', STUDENT: 'student' });
export const STAFF_ROLES = Object.freeze([ROLES.TEACHER, ROLES.DIRECTOR]);

/** bcrypt solo usa los primeros 72 bytes de la contraseña. */
export const MAX_PASSWORD_LENGTH = 72;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

/**
 * Valida el cuerpo de `POST /auth/login`.
 *
 * @returns {{ email: string, password: string }}
 */
export function parseLoginInput(body) {
  const email = normalizeEmail(body?.email);
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!EMAIL_PATTERN.test(email) || password.length === 0 || password.length > MAX_PASSWORD_LENGTH) {
    throw new DomainError('VALIDATION_ERROR', 'Escribe un correo y una contraseña válidos.');
  }
  return { email, password };
}

/**
 * Valida y normaliza el código de grupo que escribe el alumno.
 */
export function parseJoinCode(value) {
  const code = normalizeJoinCode(value);
  if (!code) {
    throw new DomainError('VALIDATION_ERROR', 'El código de grupo tiene 6 letras y números.');
  }
  return code;
}

export function parseStudentId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new DomainError('VALIDATION_ERROR', 'Elige tu tarjeta para entrar.');
  }
  return id;
}

/**
 * Claims del token de personal escolar. Solo identificadores: nunca nombres.
 */
export function buildStaffClaims(user) {
  return { sub: String(user.id), role: user.role, schoolId: user.school_id };
}

/**
 * Claims del token de alumno. Nunca incluye nombres ni `internal_folio`.
 */
export function buildStudentClaims(student, group) {
  return { sub: String(student.id), role: ROLES.STUDENT, schoolId: group.school_id, groupId: group.id };
}

export function toStaffProfile(user) {
  return { id: user.id, fullName: user.full_name, email: user.email, role: user.role, schoolId: user.school_id };
}

/**
 * Tarjeta del alumno para la pantalla "elige tu nombre": primer nombre + inicial del apellido,
 * iniciales y color. No expone apellidos completos ni el folio interno.
 */
export function toStudentCard(student) {
  const firstName = String(student.first_names).trim().split(/\s+/)[0];
  const lastInitial = String(student.last_names).trim().charAt(0);
  return {
    id: student.id,
    displayName: `${firstName} ${lastInitial}.`,
    initials: student.initials,
    avatarColor: student.avatar_color,
    avatarId: student.avatar_id ?? null,
  };
}

export function toGroupSummary(group) {
  return {
    id: group.id,
    name: `${group.grade}.º ${group.section}`,
    grade: group.grade,
    section: group.section,
    schoolYear: group.school_year,
  };
}

/**
 * Grupo del alumno con sesión (`GET /me`): agrega su código y el nombre del docente.
 * Nunca se usa en `student-join`, que es público y solo debe mostrar el grupo.
 */
export function toStudentGroupDto(group, teacher) {
  return { ...toGroupSummary(group), joinCode: group.join_code, teacherName: teacher?.full_name ?? null };
}
