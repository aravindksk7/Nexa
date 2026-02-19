const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

interface RequestConfig extends RequestInit {
  data?: unknown;
}

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public errors?: Array<{ field: string; message: string }>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return null;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      throw new Error('Token refresh failed');
    }

    const data = await response.json();
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    return data.accessToken;
  } catch {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    return null;
  }
}

async function request<T>(
  endpoint: string,
  config: RequestConfig = {}
): Promise<T> {
  const { data, ...customConfig } = config;

  let accessToken = localStorage.getItem('accessToken');

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
    ...customConfig.headers,
  };

  const fetchConfig: RequestInit = {
    ...customConfig,
    headers,
    body: data ? JSON.stringify(data) : undefined,
  };

  let response = await fetch(`${API_BASE_URL}${endpoint}`, fetchConfig);

  // Handle token refresh on 401
  if (response.status === 401 && accessToken) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${newToken}`;
      response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...fetchConfig,
        headers,
      });
    }
  }

  const contentType = response.headers.get('content-type');
  const isJson = contentType?.includes('application/json');
  const responseData = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    throw new ApiError(
      response.status,
      responseData.message || responseData.error?.message || 'An error occurred',
      responseData.errors
    );
  }

  return responseData;
}

export const api = {
  get: <T>(endpoint: string, config?: RequestConfig) =>
    request<T>(endpoint, { ...config, method: 'GET' }),

  post: <T>(endpoint: string, data?: unknown, config?: RequestConfig) =>
    request<T>(endpoint, { ...config, method: 'POST', data }),

  put: <T>(endpoint: string, data?: unknown, config?: RequestConfig) =>
    request<T>(endpoint, { ...config, method: 'PUT', data }),

  patch: <T>(endpoint: string, data?: unknown, config?: RequestConfig) =>
    request<T>(endpoint, { ...config, method: 'PATCH', data }),

  delete: <T>(endpoint: string, config?: RequestConfig) =>
    request<T>(endpoint, { ...config, method: 'DELETE' }),

  upload: async <T>(
    endpoint: string,
    file: File,
    additionalData?: Record<string, string>
  ): Promise<T> => {
    const accessToken = localStorage.getItem('accessToken');

    const formData = new FormData();
    formData.append('file', file);
    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        formData.append(key, value);
      });
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
      },
      body: formData,
    });

    const responseData = await response.json();

    if (!response.ok) {
      throw new ApiError(
        response.status,
        responseData.message || responseData.error?.message || 'An error occurred',
        responseData.errors
      );
    }

    return responseData;
  },
};

export { ApiError };
