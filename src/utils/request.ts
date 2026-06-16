import { config } from "../common/config.js";

interface RequestOptions {
  method?: "GET" | "POST";
  body?: Record<string, unknown>;
}

export async function request<T = unknown>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = "POST", body } = options;
  const url = `${config.baseUrl}${path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    throw new Error(`请求 ${path} 失败: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<T>;
}
