import { apiClient } from '@/shared/api/client';

const assignmentPath = (id) => `/paper/assignments/${encodeURIComponent(id)}`;

export const paperApi = {
  listGroupAssignments: (groupId, options) => apiClient.get(`/assessments/groups/${encodeURIComponent(groupId)}/assignments`, options),
  getAssignment: (id, options) => apiClient.get(`/assessments/assignments/${encodeURIComponent(id)}`, options),
  getCaptureStatus: (id, options) => apiClient.get(`${assignmentPath(id)}/capture-status`, options),
  capture: (id, studentId, body, options) => apiClient.post(`${assignmentPath(id)}/capture/${encodeURIComponent(studentId)}`, body, options),
  downloadSheet: (id, options) => apiClient.download(`${assignmentPath(id)}/pdf`, options),
  downloadHints: (id, options) => apiClient.download(`${assignmentPath(id)}/hints-pdf`, options),
};
