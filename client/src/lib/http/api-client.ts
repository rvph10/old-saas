import axios, { 
    AxiosInstance, 
    AxiosError, 
    InternalAxiosRequestConfig,
    AxiosResponse
  } from 'axios';
  import { API_BASE_URL, DEFAULT_HEADERS } from './constants';
  import { getSession, signOut } from 'next-auth/react';
  
  class ApiClient {
    private static instance: ApiClient;
    private axios: AxiosInstance;
  
    private constructor() {
      console.log('API URL:', API_BASE_URL);
      this.axios = axios.create({
          baseURL: API_BASE_URL,
          headers: DEFAULT_HEADERS,
          timeout: 10000,
          withCredentials: true,
      });
      this.setupInterceptors();
    }
  
    public static getInstance(): ApiClient {
      if (!ApiClient.instance) {
        ApiClient.instance = new ApiClient();
      }
      return ApiClient.instance;
    }
  
    private setupInterceptors() {
      this.axios.interceptors.request.use(
        async (config: InternalAxiosRequestConfig) => {
          const session = await getSession();
          
          if (session?.accessToken) {
            config.headers.Authorization = `Bearer ${session.accessToken}`;
          }
  
          if (session?.sessionId) {
            config.headers['session-id'] = session.sessionId;
          }
  
          return config;
        },
        (error: AxiosError) => {
          return Promise.reject(error);
        }
      );
  
      this.axios.interceptors.response.use(
        (response: AxiosResponse) => response,
        async (error: AxiosError) => {
          const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
  
          if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
  
            if (error.response?.data && (error.response.data as any).code === 'AUTH_003') {
              await signOut({ callbackUrl: '/auth/login' });
              return Promise.reject(error);
            }
          }
  
          return Promise.reject(this.handleError(error));
        }
      );
    }
  
    private handleError(error: AxiosError): Error {
      if (error.response?.data && typeof error.response.data === 'object') {
        const data = error.response.data as { message?: string };
        return new Error(data.message || 'An error occurred');
      }
      return error;
    }
  
    async get<T>(url: string, config = {}): Promise<T> {
      const response = await this.axios.get<T>(url, config);
      return response.data;
    }
  
    async post<T>(url: string, data = {}, config = {}): Promise<T> {
      const response = await this.axios.post<T>(url, data, config);
      return response.data;
    }
  
    async put<T>(url: string, data = {}, config = {}): Promise<T> {
      const response = await this.axios.put<T>(url, data, config);
      return response.data;
    }
  
    async delete<T>(url: string, config = {}): Promise<T> {
      const response = await this.axios.delete<T>(url, config);
      return response.data;
    }
  }
  
  export const apiClient = ApiClient.getInstance();