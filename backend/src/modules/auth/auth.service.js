/**
 * Módulo auth — Capa 2 (Aplicación): casos de uso de inicio de sesión.
 */
import bcrypt from 'bcryptjs';
import { HttpError } from '../../shared/errors/HttpError.js';
import { signToken } from '../../shared/utils/tokens.js';
import {
  ROLES,
  STAFF_ROLES,
  buildStaffClaims,
  buildStudentClaims,
  parseJoinCode,
  parseLoginInput,
  parseStudentId,
  toGroupSummary,
  toStaffProfile,
  toStudentCard,
} from './auth.domain.js';

const INVALID_CREDENTIALS = () => new HttpError(401, 'INVALID_CREDENTIALS', 'Correo o contraseña incorrectos.');
const GROUP_NOT_FOUND = () =>
  new HttpError(404, 'GROUP_NOT_FOUND', 'No encontramos ese código. Revísalo con tu maestra o maestro.');

/**
 * @param {{ repository: ReturnType<import('./auth.repository.js').createAuthRepository>, config: ReturnType<import('../../config/env.js').loadConfig> }} deps
 */
export function createAuthService({ repository, config }) {
  const { jwtSecret, auth } = config;
  // Hash de referencia para comparar aunque el correo no exista: misma latencia en ambos casos
  // (evita enumerar correos). Se calcula al iniciar, no en la primera petición.
  const dummyHash = bcrypt.hashSync('axi-dummy-password', 10);

  const issueStaffSession = (user) => {
    const { token, expiresAt } = signToken(buildStaffClaims(user), { secret: jwtSecret, expiresIn: auth.teacherTokenTtl });
    return { token, expiresAt, user: toStaffProfile(user) };
  };

  const issueStudentSession = (student, group) => {
    const { token, expiresAt } = signToken(buildStudentClaims(student, group), {
      secret: jwtSecret,
      expiresIn: auth.studentTokenTtl,
    });
    return { token, expiresAt, student: toStudentCard(student), group: toGroupSummary(group) };
  };

  const assertQuickLoginEnabled = () => {
    if (!auth.quickLoginEnabled) {
      throw new HttpError(403, 'QUICK_LOGIN_DISABLED', 'El acceso rápido de demostración está desactivado.');
    }
  };

  const findDemoStaff = (email, role) => {
    const user = repository.findStaffByEmail(email);
    if (!user || user.role !== role) {
      throw new HttpError(404, 'DEMO_DATA_MISSING', 'No hay datos de demostración. Ejecuta `npm run seed`.');
    }
    return user;
  };
  const findDemoTeacher = () => findDemoStaff(auth.quickLoginTeacherEmail, ROLES.TEACHER);

  return {
    /** Login de docente/director con correo y contraseña. */
    async login(body) {
      const { email, password } = parseLoginInput(body);
      const user = repository.findStaffByEmail(email);
      const matches = await bcrypt.compare(password, user?.password_hash ?? dummyHash);
      if (!user || !matches || !STAFF_ROLES.includes(user.role)) throw INVALID_CREDENTIALS();
      return issueStaffSession(user);
    },

    quickLoginStatus() {
      return { enabled: auth.quickLoginEnabled };
    },

    /** "Entrar como Docente": sesión de la docente demo. */
    quickLoginTeacher() {
      assertQuickLoginEnabled();
      return issueStaffSession(findDemoTeacher());
    },

    /** "Entrar como Directivo": sesión del director demo (solo lectura de su escuela). */
    quickLoginDirector() {
      assertQuickLoginEnabled();
      return issueStaffSession(findDemoStaff(auth.quickLoginDirectorEmail, ROLES.DIRECTOR));
    },

    /** "Entrar como Alumno": primer alumno activo del grupo más reciente de la docente demo. */
    quickLoginStudent() {
      assertQuickLoginEnabled();
      const teacher = findDemoTeacher();
      const group = repository.findLatestGroupOfTeacher(teacher.id);
      const student = group && repository.findFirstActiveStudent(group.id);
      if (!student) {
        throw new HttpError(404, 'DEMO_DATA_MISSING', 'No hay datos de demostración. Ejecuta `npm run seed`.');
      }
      return issueStudentSession(student, group);
    },

    /** Paso 1 del alumno: código de grupo → tarjetas para elegir. */
    joinGroup(body) {
      const code = parseJoinCode(body?.joinCode);
      const group = repository.findGroupByJoinCode(code);
      if (!group) throw GROUP_NOT_FOUND();
      return { group: toGroupSummary(group), students: repository.listActiveStudents(group.id).map(toStudentCard) };
    },

    /** Paso 2 del alumno: elige su tarjeta → sesión de alumno. */
    selectStudent(body) {
      const code = parseJoinCode(body?.joinCode);
      const studentId = parseStudentId(body?.studentId);
      const group = repository.findGroupByJoinCode(code);
      if (!group) throw GROUP_NOT_FOUND();
      const student = repository.findActiveStudent(group.id, studentId);
      if (!student) {
        throw new HttpError(404, 'STUDENT_NOT_IN_GROUP', 'Esa tarjeta no pertenece a este grupo.');
      }
      return issueStudentSession(student, group);
    },

    /** Identidad de la sesión actual (`req.auth`). */
    me(claims) {
      const id = Number(claims.sub);
      if (claims.role === ROLES.STUDENT) {
        const group = repository.findGroupById(claims.groupId);
        const student = group && repository.findActiveStudent(group.id, id);
        if (!student) throw new HttpError(401, 'SESSION_INVALID', 'Tu sesión ya no es válida. Vuelve a entrar.');
        return { role: ROLES.STUDENT, student: toStudentCard(student), group: toGroupSummary(group) };
      }
      const user = repository.findStaffById(id);
      if (!user) throw new HttpError(401, 'SESSION_INVALID', 'Tu sesión ya no es válida. Vuelve a entrar.');
      return { role: user.role, user: toStaffProfile(user) };
    },
  };
}
