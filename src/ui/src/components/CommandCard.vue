<script setup lang="ts">
import type { ShortcutCommand } from "../types";

defineProps<{
  command: ShortcutCommand;
}>();
</script>

<template>
  <el-card class="command-card" shadow="hover">
    <template #header>
      <div class="flex items-center justify-between">
        <span class="font-semibold text-gray-800">{{ command.name }}</span>
        <el-tag size="small" type="info">{{ command.id }}</el-tag>
      </div>
    </template>
    <p class="text-sm text-gray-500 mb-3">{{ command.description || "暂无描述" }}</p>
    <div class="flex items-center gap-2 text-xs text-gray-400">
      <img
        v-if="command.author?.avatarUrl"
        :src="command.author.avatarUrl"
        :alt="command.author.login"
        class="w-5 h-5 rounded-full"
      />
      <span v-else class="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">?</span>
      <span>{{ command.author?.name || command.author?.login || "未知作者" }}</span>
    </div>
  </el-card>
</template>

<style scoped>
.command-card {
  transition: transform 0.2s;
}
.command-card:hover {
  transform: translateY(-2px);
}
</style>
