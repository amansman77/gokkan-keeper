import { API_BASE_URL } from '../config';

interface FetchJsonOptions {
  withCredentials?: boolean;
  networkErrorMessage?: string;
}

async function fetchJson<T>(endpoint: string, options: RequestInit = {}, config: FetchJsonOptions = {}): Promise<T> {
  try {
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...(config.withCredentials ? { credentials: 'include' as const } : {}),
      ...options,
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...options.headers,
      },
    });
    if (!response.ok) {
      const body: unknown = await response.json().catch(() => null);
      const message =
        typeof body === 'object' && body !== null && 'error' in body
          ? String(body.error)
          : `HTTP error! status: ${response.status}`;
      throw new Error(message);
    }
    return response.json();
  } catch (error: unknown) {
    if (config.networkErrorMessage && error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(config.networkErrorMessage);
    }
    throw error;
  }
}

export const fetchPrivateApi = <T>(endpoint: string, options: RequestInit = {}) =>
  fetchJson<T>(endpoint, options, {
    withCredentials: true,
    networkErrorMessage: `API 서버에 연결할 수 없습니다. ${API_BASE_URL}가 실행 중인지 확인하세요.`,
  });

export const fetchPublicApi = <T>(endpoint: string, options: RequestInit = {}) =>
  fetchJson<T>(endpoint, options);

export const fetchAuthApi = <T>(endpoint: string, options: RequestInit = {}) =>
  fetchJson<T>(endpoint, options, { withCredentials: true });
