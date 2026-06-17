export interface UserInfo {
  id: number;
  githubId: number;
  login: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
}

export interface ShortcutCommand {
  id: number;
  userId: string;
  name: string;
  description: string | null;
  script: string;
  workspacePath: string | null;
  scriptPath: string | null;
  createdAt: string;
  updatedAt: string;
  author?: UserInfo;
}

export interface ApiResponse<T> {
  code: number;
  data: T;
  message: string;
}
