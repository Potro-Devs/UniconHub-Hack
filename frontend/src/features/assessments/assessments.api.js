import { apiClient } from '@/shared/api/client';

/**
 * Cliente HTTP para Cuestionarios y constructor (`/api/v1/assessments/quizzes`).
 */
export const assessmentsApi = {
  listAssignments(groupId, options) {
    return apiClient.get(`/assessments/groups/${encodeURIComponent(groupId)}/assignments`, options);
  },

  createAssignment(groupId, payload, options) {
    return apiClient.post(`/assessments/groups/${encodeURIComponent(groupId)}/assignments`, payload, options);
  },

  listQuizzes({ groupId, origin } = {}, options) {
    const params = new URLSearchParams();
    if (groupId != null) params.set('groupId', String(groupId));
    if (origin && origin !== 'all') params.set('origin', origin);
    const qs = params.toString();
    return apiClient.get(`/assessments/quizzes${qs ? `?${qs}` : ''}`, options);
  },

  getQuiz(quizId, { groupId } = {}, options) {
    const qs = groupId != null ? `?groupId=${encodeURIComponent(String(groupId))}` : '';
    return apiClient.get(`/assessments/quizzes/${quizId}${qs}`, options);
  },

  createQuiz(payload, options) {
    return apiClient.post('/assessments/quizzes', payload, options);
  },

  updateQuiz(quizId, payload, options) {
    return apiClient.patch(`/assessments/quizzes/${quizId}`, payload, options);
  },

  exportQuizPdf(quizId, { groupId } = {}, options) {
    const qs = groupId != null ? `?groupId=${encodeURIComponent(String(groupId))}` : '';
    return apiClient.download(`/assessments/quizzes/${quizId}/pdf${qs}`, options);
  },
};
