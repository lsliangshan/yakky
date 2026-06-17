import type { UserInfo, ShortcutCommand, ApiResponse } from "../types";

const BASE = "/api";

async function request<T>(path: string, body?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`请求 ${path} 失败: ${res.status}`);
  }
  return res.json();
}

export async function getMe(): Promise<UserInfo> {
  return request<UserInfo>("/me");
}

export async function getUserDetail(userId: string): Promise<UserInfo> {
  const res = await request<ApiResponse<UserInfo>>("/backend/yakky-user/detail", { userId });
  return res.data;
}

export async function listShortcutCommands(params?: {
  userId?: string;
  pageIndex?: number;
  pageSize?: number;
}): Promise<ShortcutCommand[]> {
  const res = await request<ApiResponse<ShortcutCommand[]>>("/backend/yakky-shortcut-command/list", {
    userId: params?.userId ?? "",
    pageIndex: params?.pageIndex ?? 1,
    pageSize: params?.pageSize ?? 100,
    status: true,
  });
  return res.data;
}

export async function listLocalShortcutCommands(): Promise<ShortcutCommand[]> {
  return request<ShortcutCommand[]>("/local-commands");
}
