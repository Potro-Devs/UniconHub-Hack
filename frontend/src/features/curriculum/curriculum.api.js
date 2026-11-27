import { apiClient } from '@/shared/api/client';

/** Avance y cobertura del grupo autenticado. La API conserva los campos omitidos al guardar. */
export const curriculumApi = {
  list: (groupId, options) =>
    apiClient.get(`/curriculum/groups/${encodeURIComponent(groupId)}`, options),
  coverage: (groupId, options) =>
    apiClient.get(`/curriculum/groups/${encodeURIComponent(groupId)}/coverage`, options),
  updateContent: (groupId, contentId, patch, options) =>
    apiClient.patch(
      `/curriculum/groups/${encodeURIComponent(groupId)}/contents/${encodeURIComponent(contentId)}`,
      patch,
      options,
    ),
};
