<script setup lang="ts">
import type { UserInfo } from "../types";

defineProps<{
  user: UserInfo | null;
  loading: boolean;
}>();
</script>

<template>
  <header class="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
    <div class="flex items-center gap-3">
      <span class="text-lg font-semibold text-gray-800">Yakky</span>
    </div>
    <div v-if="loading" class="flex items-center gap-2 text-sm text-gray-400">
      <el-icon class="is-loading"><i class="i-loading" /></el-icon>
      加载用户信息...
    </div>
    <div v-else-if="user" class="flex items-center gap-3">
      <img
        v-if="user.avatarUrl"
        :src="user.avatarUrl"
        :alt="user.login"
        class="w-8 h-8 rounded-full"
      />
      <div class="text-sm text-gray-600">
        <span class="font-medium text-gray-800">{{ user.name || user.login }}</span>
        <span class="mx-1 text-gray-300">|</span>
        <span>{{ user.email || user.login }}</span>
        <span class="mx-1 text-gray-300">|</span>
        <span class="text-gray-400">ID: {{ user.githubId }}</span>
      </div>
    </div>
    <div v-else class="text-sm text-gray-400">
      未登录 - 请先执行 <code class="bg-gray-100 px-1 rounded">yak login</code>
    </div>
  </header>
</template>
