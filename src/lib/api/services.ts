import { apiClient } from './client';
import type {
  ApiResponse, PaginatedResponse,
  Engagement, Milestone, RetentionTimer,
  Notification, User, CreateEngagementInput,
} from '@/types';

// ----------------------------------------------------------
// Auth
// ----------------------------------------------------------
export const authApi = {
  getNonce: async (address: string): Promise<string> => {
    const { data } = await apiClient.get<ApiResponse<{ nonce: string }>>(
      `/auth/nonce?address=${address}`,
    );
    return data.data.nonce;
  },
  login: async (payload: {
    stellarAddress: string;
    signedNonce: string;
    signature: string;
  }): Promise<{ accessToken: string; user: User }> => {
    const { data } = await apiClient.post<
      ApiResponse<{ accessToken: string; user: User }>
    >('/auth/login', payload);
    return data.data;
  },
};

// ----------------------------------------------------------
// Engagements
// ----------------------------------------------------------
export const engagementsApi = {
  create: async (input: CreateEngagementInput & {
    txHash: string;
    companyAddress: string;
    tokenAddress: string;
    createdLedger?: number;
  }): Promise<Engagement> => {
    const { data } = await apiClient.post<ApiResponse<Engagement>>('/engagements', input);
    return data.data;
  },

  list: async (params?: {
    companyAddress?: string;
    recruiterAddress?: string;
    arbiterAddress?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<Engagement>> => {
    const { data } = await apiClient.get<ApiResponse<PaginatedResponse<Engagement>>>(
      '/engagements', { params },
    );
    return data.data;
  },

  get: async (id: string): Promise<Engagement> => {
    const { data } = await apiClient.get<ApiResponse<Engagement>>(`/engagements/${id}`);
    return data.data;
  },

  sync: async (id: string): Promise<void> => {
    await apiClient.post(`/engagements/${id}/sync`);
  },
};

// ----------------------------------------------------------
// Milestones
// ----------------------------------------------------------
export const milestonesApi = {
  list: async (engagementId: string): Promise<Milestone[]> => {
    const { data } = await apiClient.get<ApiResponse<Milestone[]>>(
      `/engagements/${engagementId}/milestones`,
    );
    return data.data;
  },

  get: async (engagementId: string, index: number): Promise<Milestone> => {
    const { data } = await apiClient.get<ApiResponse<Milestone>>(
      `/engagements/${engagementId}/milestones/${index}`,
    );
    return data.data;
  },

  /** Get retention countdown timer for a Locked milestone */
  getTimer: async (engagementId: string, index: number): Promise<RetentionTimer> => {
    const { data } = await apiClient.get<ApiResponse<RetentionTimer>>(
      `/engagements/${engagementId}/milestones/${index}/timer`,
    );
    return data.data;
  },

  /** Store the off-chain written reason for a raised dispute */
  submitDisputeReason: async (engagementId: string, index: number, reason: string): Promise<void> => {
    await apiClient.post(`/engagements/${engagementId}/milestones/${index}/dispute-reason`, { reason });
  },
};

// ----------------------------------------------------------
// Notifications
// ----------------------------------------------------------
export const notificationsApi = {
  list: async (params?: {
    unreadOnly?: boolean;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<Notification>> => {
    const { data } = await apiClient.get<ApiResponse<PaginatedResponse<Notification>>>(
      '/notifications', { params },
    );
    return data.data;
  },
  markRead: async (id: string): Promise<void> => {
    await apiClient.patch(`/notifications/${id}/read`);
  },
  markAllRead: async (): Promise<void> => {
    await apiClient.patch('/notifications/read-all');
  },
};

// ----------------------------------------------------------
// IPFS upload (proxied through backend so the pinning key stays server-side)
// ----------------------------------------------------------
export const uploadApi = {
  /**
   * POST /upload/proof  — multipart/form-data, field name "file"
   * Backend pins to the configured pinning service and returns { cid }.
   * onProgress receives 0–100.
   */
  uploadProof: (
    file: File,
    onProgress?: (pct: number) => void,
  ): Promise<{ cid: string }> => {
    const form = new FormData();
    form.append('file', file);
    return apiClient
      .post<ApiResponse<{ cid: string }>>('/upload/proof', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (onProgress && e.total) {
            onProgress(Math.round((e.loaded * 100) / e.total));
          }
        },
      })
      .then((res) => res.data.data);
  },
};

// ----------------------------------------------------------
// Events
// ----------------------------------------------------------
export const eventsApi = {
  list: async (params?: { engagementId?: string; page?: number; limit?: number }) => {
    const { data } = await apiClient.get('/events', { params });
    return data.data;
  },
};
