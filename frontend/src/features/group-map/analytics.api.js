import { apiClient } from '@/shared/api/client';

const groupPath = (groupId) => `/analytics/groups/${encodeURIComponent(groupId)}`;

export const analyticsApi = {
  group: (groupId, options) => apiClient.get(groupPath(groupId), options),
  student: (groupId, studentId, options) =>
    apiClient.get(`${groupPath(groupId)}/students/${encodeURIComponent(studentId)}`, options),
};
