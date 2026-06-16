import { API } from "../common/api.js";
import { request } from "./request.js";

// ========== 用户 ==========

export async function syncUserLogin(params: {
  userId: string;
  email: string;
  username: string;
  access_token: string;
}) {
  return request(API.USER_LOGIN, { body: params });
}

export async function syncUserLogout(params: { userId: string }) {
  return request(API.USER_LOGOUT, { body: params });
}

// ========== 快捷命令 ==========

export interface CreateShortcutCommandParams {
  userId: string;
  name: string;
  description: string;
  script: string;
}

export async function createShortcutCommand(
  params: CreateShortcutCommandParams
) {
  return request(API.SHORTCUT_COMMAND_CREATE, { body: params });
}

export interface DeleteShortcutCommandParams {
  userId: string;
  id: string;
}

export async function deleteShortcutCommand(
  params: DeleteShortcutCommandParams
) {
  return request(API.SHORTCUT_COMMAND_DELETE, { body: params });
}

export interface ListShortcutCommandsParams {
  userId: string;
  pageIndex?: number;
  pageSize?: number;
  status?: boolean;
}

export async function listShortcutCommands(params: ListShortcutCommandsParams) {
  return request(API.SHORTCUT_COMMAND_LIST, {
    body: {
      pageIndex: params.pageIndex ?? 1,
      pageSize: params.pageSize ?? 20,
      status: params.status ?? true,
      userId: params.userId,
    },
  });
}

export interface UpdateShortcutCommandParams {
  userId: string;
  id: string;
  name?: string;
  description?: string;
  script?: string;
}

export async function updateShortcutCommand(
  params: UpdateShortcutCommandParams
) {
  return request(API.SHORTCUT_COMMAND_UPDATE, { body: params });
}

export interface UpdateShortcutCommandStatusParams {
  userId: string;
  id: string;
  status: boolean;
}

export async function updateShortcutCommandStatus(
  params: UpdateShortcutCommandStatusParams
) {
  return request(API.SHORTCUT_COMMAND_UPDATE_STATUS, { body: params });
}
