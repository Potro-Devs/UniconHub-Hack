/** Orquestación de consultas autorizadas, sin escrituras. */
import { HttpError } from '../../shared/errors/HttpError.js';
import { createGroupAccess } from '../groups/groups.access.js';
import { parsePositiveId } from '../groups/groups.domain.js';
import { computeCoverage, CURRICULUM_REVIEW_NOTICE } from '../curriculum/curriculum.domain.js';
import { buildStudentSkills, summarizeGroupSkills, countStudentsNeedingSupport,
  findWeakestSkill, selectRecommendedActivity, toHistoryDto, parseAnalyticsSelection,
  selectAnalyticsStudents, summarizeGroupEvidence, summarizeAutonomyProgress, buildNextStep } from './analytics.domain.js';
import { renderAnalyticsPdf, renderAnalyticsXlsx } from './analytics.export.js';

const groupDto = (group) => ({ id: group.id, grade: group.grade, section: group.section, schoolYear: group.school_year });
const studentDto = (student) => ({ id: student.id, name: `${student.first_names} ${student.last_names}`,
  initials: student.initials, avatarColor: student.avatar_color });
const errorDtos = (rows) => rows.map((row) => ({ skillCode: row.skill_code,
  errorTag: row.error_tag, explanation: row.explanation, count: row.count, studentCount: row.student_count }));
const meta = { contentReview: CURRICULUM_REVIEW_NOTICE };

export function createAnalyticsService({ repository, groupsRepository, curriculumRepository }) {
  const { findReadableGroup } = createGroupAccess(groupsRepository);
  const service = {
    getGroup(auth, groupId, query = {}) {
      const group = findReadableGroup(auth, groupId);
      const skillRows = repository.listSkills();
      const selection = parseAnalyticsSelection(query, skillRows);
      const history = repository.listGroupHistory(group.id, group.school_id);
      const students = groupsRepository.listActiveStudents(group.id).map((student) => ({
        ...studentDto(student), skills: buildStudentSkills(skillRows, history.filter((cut) => cut.student_id === student.id)),
      }));
      const skills = summarizeGroupSkills(skillRows, students);
      const weakestSkill = findWeakestSkill(skills);
      const contents = curriculumRepository.listContentsWithProgress(group.id, group.grade);
      const coverage = computeCoverage(contents.length, contents.map((content) => ({ status: content.status ?? 'pending' })));
      const typicalErrors = errorDtos(repository.listTypicalErrors(group.id, group.school_id));
      const selectedStudents = selectAnalyticsStudents(students, selection);
      const recommendedActivity = selectRecommendedActivity(repository.listActivities(group.grade), weakestSkill?.code, typicalErrors);
      return { data: { group: groupDto(group), skills, students: selectedStudents,
        selection: { ...selection, studentCount: selectedStudents.length }, summary: {
        studentCount: students.length, needsSupportCount: countStudentsNeedingSupport(students),
        ...summarizeGroupEvidence(students),
        weakestSkill, coverage, typicalErrors, recommendedActivity,
        autonomyProgress: summarizeAutonomyProgress(skillRows, students),
        nextStep: buildNextStep(weakestSkill, typicalErrors, recommendedActivity),
      } }, meta };
    },
    getStudent(auth, groupId, studentId) {
      const group = findReadableGroup(auth, groupId);
      const id = parsePositiveId(studentId, 'id del alumno');
      const student = groupsRepository.findActiveStudentInGroup(id, group.id);
      if (!student) throw new HttpError(404, 'STUDENT_NOT_FOUND', 'No encontramos ese alumno en el grupo.');
      const history = repository.listStudentHistory(group.id, group.school_id, id);
      const skills = buildStudentSkills(repository.listSkills(), history);
      const weakestSkill = findWeakestSkill(skills.map((skill) => ({ ...skill, average: skill.masteryPercentage })));
      const typicalErrors = errorDtos(repository.listTypicalErrors(group.id, group.school_id, id));
      return { data: { group: groupDto(group), student: studentDto(student), skills,
        history: history.map(toHistoryDto).sort((a, b) => a.recordedAt.localeCompare(b.recordedAt) || a.id - b.id),
        typicalErrors,
        recommendedActivity: selectRecommendedActivity(repository.listActivities(group.grade), weakestSkill?.code, typicalErrors),
      }, meta };
    },
    async exportGroup(auth, groupId, query, format) {
      const { data } = service.getGroup(auth, groupId, query);
      const buffer = await (format === 'xlsx' ? renderAnalyticsXlsx(data) : renderAnalyticsPdf(data));
      return { buffer, filename: `diagnostico-grupo-${data.group.id}.${format}`,
        contentType: format === 'xlsx'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf' };
    },
  };
  return service;
}
