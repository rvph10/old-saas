export interface ApiError {
    message: string;
    code: string;
    details?: any;
    context?: string;
  }
  
export interface ApiResponse<T = any> {
    data: T;
    error?: ApiError;
}

export interface LoginResponse {
  access_token: string;
  sessionId: string;
  user: {
    id: string;
    email: string;
    username: string;
    firstName?: string;
    lastName?: string;
  };
}