import { apiClient } from '@/shared/api/client';

const gamePath = (code) => `/games/${encodeURIComponent(code)}`;
export const gamesApi = {
  list: (options) => apiClient.get('/games', options),
  game: (code, options) => apiClient.get(gamePath(code), options),
  check: (code, roundId, answer, options) => apiClient.post(`${gamePath(code)}/check`, { roundId, answer }, options),
};
