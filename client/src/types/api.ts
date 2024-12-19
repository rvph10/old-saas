export interface ApiResponse {
    message: string;
  }
  
  export interface VerificationResponse extends ApiResponse {
    verifiedAt?: string;
  }
  
  export interface EmailResendResponse extends ApiResponse {
    expiresAt?: string;
  }