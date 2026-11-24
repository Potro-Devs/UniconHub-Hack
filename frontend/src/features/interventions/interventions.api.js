import { apiClient } from '@/shared/api/client';

const groupPath = (groupId) => `/interventions/groups/${encodeURIComponent(groupId)}`;

export const interventionsApi = {
  list: (groupId, options) => apiClient.get(groupPath(groupId), options),
  create: (groupId, activityId, note) => apiClient.post(groupPath(groupId), note ? { activityId, note } : { activityId }),
};
