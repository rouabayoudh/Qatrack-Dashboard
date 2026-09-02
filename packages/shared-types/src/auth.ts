export interface LoginDTO {
  email: string;
  password: string;
  jiraDomain?: string;
  rememberMe?: boolean;
}

export interface AuthResponse {
  accessToken: string;
  user: UserSummary;
  expiresIn: number;
}

export type UserRole = 'TESTER' | 'QA_LEAD' | 'PRODUCT_OWNER' | 'DEVELOPER' | 'VIEWER';

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
}