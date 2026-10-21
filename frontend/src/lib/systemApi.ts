import { post, request } from './apiClient';
import type { Status } from '../types/api';

export const systemApi = {
  status: () => request<Status>('/status'),
  session: () => post<{ active: boolean }>('/session', {}),
};
