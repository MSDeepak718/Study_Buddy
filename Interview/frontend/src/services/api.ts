import axios from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import type {
  DocumentInfo, InterviewConfig, InterviewConfigRequest,
  StartInterviewRequest, SessionInfo, QuestionData,
  DashboardData, User, AuthResponse,
} from '../types';

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ===== Auth =====
export const loginUser = async (email: string, password: string): Promise<AuthResponse> => {
  const { data } = await api.post('/auth/login', { email, password });
  return data;
};

export const registerUser = async (name: string, email: string, password: string, role: 'admin' | 'student'): Promise<AuthResponse> => {
  const { data } = await api.post('/auth/register', { name, email, password, role });
  return data;
};

export const getMe = async (): Promise<User> => {
  const { data } = await api.get('/auth/me');
  return data;
};

// ===== Documents =====
export const uploadDocument = async (file: File): Promise<{ id: string; filename: string; status: string; message: string }> => {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post('/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export const listDocuments = async (): Promise<{ documents: DocumentInfo[]; total: number }> => {
  const { data } = await api.get('/documents');
  return data;
};

export const deleteDocument = async (id: string) => {
  const { data } = await api.delete(`/documents/${id}`);
  return data;
};

// ===== Interview Config =====
export const createConfig = async (config: InterviewConfigRequest): Promise<InterviewConfig> => {
  const { data } = await api.post('/interviews/configure', config);
  return data;
};

export const listConfigs = async (): Promise<InterviewConfig[]> => {
  const { data } = await api.get('/interviews/configurations');
  return data;
};

export const deleteConfig = async (id: string): Promise<{ message: string }> => {
  const { data } = await api.delete(`/interviews/configurations/${id}`);
  return data;
};

export const updateConfig = async (id: string, config: InterviewConfigRequest): Promise<InterviewConfig> => {
  const { data } = await api.put(`/interviews/configurations/${id}`, config);
  return data;
};

// ===== Interview Sessions =====
export const startInterview = async (req: StartInterviewRequest) => {
  const { data } = await api.post('/interviews/start', req);
  return data;
};

export const getSession = async (sessionId: string): Promise<SessionInfo> => {
  const { data } = await api.get(`/interviews/${sessionId}`);
  return data;
};

export const generateQuestion = async (sessionId: string): Promise<QuestionData> => {
  const { data } = await api.post(`/interviews/${sessionId}/question`);
  return data;
};

export const submitAnswer = async (sessionId: string, questionId: string, answerText: string): Promise<any> => {
  const { data } = await api.post(`/interviews/${sessionId}/answer`, {
    question_id: questionId,
    answer_text: answerText,
  });
  return data;
};

export const completeInterview = async (sessionId: string) => {
  const { data } = await api.post(`/interviews/${sessionId}/complete`);
  return data;
};

export const completeVoiceInterview = async (sessionId: string, transcript: { speaker: string; text: string; timestamp: number }[]) => {
  const { data } = await api.post(`/interviews/${sessionId}/voice/complete`, { transcript });
  return data;
};

export const listSessions = async (): Promise<SessionInfo[]> => {
  const { data } = await api.get('/interviews/sessions/list');
  return data;
};

// ===== Dashboard =====
export const getDashboard = async (sessionId: string): Promise<DashboardData> => {
  const { data } = await api.get(`/dashboard/${sessionId}`);
  return data;
};

export default api;
