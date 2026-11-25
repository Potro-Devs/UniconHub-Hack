import { apiClient } from '@/shared/api/client';

const groupPath = (groupId) => `/tutoring/groups/${encodeURIComponent(groupId)}`;

export const tutoringApi = {
  proposal: (groupId, skillCode, options) =>
    apiClient.get(`${groupPath(groupId)}/proposal${skillCode ? `?skillCode=${encodeURIComponent(skillCode)}` : ''}`, options),
  sessions: (groupId, options) => apiClient.get(`${groupPath(groupId)}/sessions`, options),
  createSession: (groupId, body) => apiClient.post(`${groupPath(groupId)}/sessions`, body),
  recordDemonstration: (groupId, pairId, correct) =>
    apiClient.patch(`${groupPath(groupId)}/pairs/${encodeURIComponent(pairId)}/demonstration`, { correct }),
  /** `part`: `cards` (tarjetas para repartir) o `key` (hoja solo para la maestra). */
  pdf: (groupId, sessionId, part) => apiClient.download(`${groupPath(groupId)}/sessions/${encodeURIComponent(sessionId)}/${part === 'key' ? 'key' : 'cards'}.pdf`),
};
