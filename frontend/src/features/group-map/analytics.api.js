import { apiClient } from '@/shared/api/client';

const groupPath = (groupId) => `/analytics/groups/${encodeURIComponent(groupId)}`;

export function analyticsFiltersQuery({ skillCode = '', supportOnly = false } = {}) {
  const params = new URLSearchParams();
  if (skillCode) params.set('skillCode', skillCode);
  if (supportOnly) params.set('supportOnly', 'true');
  return params.size ? `?${params}` : '';
}

export const analyticsApi = {
  group: (groupId, options, filters) => apiClient.get(`${groupPath(groupId)}${analyticsFiltersQuery(filters)}`, options),
  student: (groupId, studentId, options) =>
    apiClient.get(`${groupPath(groupId)}/students/${encodeURIComponent(studentId)}`, options),
  export: (groupId, format, filters) =>
    apiClient.download(`${groupPath(groupId)}/export.${format}${analyticsFiltersQuery(filters)}`),
};
