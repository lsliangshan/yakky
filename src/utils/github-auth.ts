const GITHUB_DEVICE_CODE_URL = "https://github.com/login/device/code";
const GITHUB_ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_API_URL = "https://api.github.com";

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
}

export async function requestDeviceCode(
  clientId: string
): Promise<DeviceCodeResponse> {
  const res = await fetch(GITHUB_DEVICE_CODE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      scope: "read:user user:email",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`请求 device code 失败: ${res.status} ${body}`);
  }

  return res.json() as Promise<DeviceCodeResponse>;
}

export async function pollForAccessToken(
  clientId: string,
  deviceCode: string
): Promise<string> {
  const res = await fetch(GITHUB_ACCESS_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      device_code: deviceCode,
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    }),
  });

  const data = (await res.json()) as Record<string, string>;

  if (data.error) {
    if (data.error === "authorization_pending") {
      return ""; // 用户还没确认
    }
    if (data.error === "slow_down") {
      throw new Error("请求过于频繁，请稍后再试");
    }
    if (data.error === "expired_token") {
      throw new Error("验证码已过期，请重新登录");
    }
    throw new Error(`获取 access token 失败: ${data.error_description || data.error}`);
  }

  return data.access_token || "";
}

export async function fetchGitHubUser(
  accessToken: string
): Promise<GitHubUser> {
  const res = await fetch(`${GITHUB_API_URL}/user`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "User-Agent": "yakky-cli",
    },
  });

  if (!res.ok) {
    throw new Error(`获取用户信息失败: ${res.status}`);
  }

  return res.json() as Promise<GitHubUser>;
}

export async function fetchGitHubEmail(
  accessToken: string
): Promise<string | null> {
  const res = await fetch(`${GITHUB_API_URL}/user/emails`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "User-Agent": "yakky-cli",
    },
  });

  if (!res.ok) return null;

  const emails = (await res.json()) as { email: string; primary: boolean }[];
  const primary = emails.find((e) => e.primary);
  return primary?.email || null;
}
