<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import { listShortcutCommands, listLocalShortcutCommands, getUserDetail } from "../api";
import type { UserInfo, ShortcutCommand } from "../types";
import CommandCard from "../components/CommandCard.vue";

const props = defineProps<{
  user: UserInfo | null;
}>();

const activeTab = ref("all");
const commands = ref<ShortcutCommand[]>([]);
const loading = ref(false);

async function fetchCommands() {
  loading.value = true;
  try {
    let data: ShortcutCommand[];
    if (activeTab.value === "local") {
      data = await listLocalShortcutCommands();
    } else if (activeTab.value === "all") {
      data = await listShortcutCommands();
    } else {
      if (!props.user) {
        commands.value = [];
        return;
      }
      data = await listShortcutCommands({ userId: String(props.user.githubId) });
    }
    // Fetch author info for each command (only for backend data)
    if (activeTab.value !== "local") {
      const authorCache = new Map<string, UserInfo>();
      for (const cmd of data) {
        if (!cmd.userId) continue;
        if (!authorCache.has(cmd.userId)) {
          try {
            const author = await getUserDetail(cmd.userId);
            authorCache.set(cmd.userId, author);
          } catch {
            // ignore author fetch errors
          }
        }
        cmd.author = authorCache.get(cmd.userId);
      }
    }
    commands.value = data;
  } catch (e) {
    console.error("Failed to fetch commands:", e);
    commands.value = [];
  } finally {
    loading.value = false;
  }
}

watch(activeTab, fetchCommands);
onMounted(fetchCommands);
</script>

<template>
  <div>
    <h2 class="text-xl font-semibold text-gray-800 mb-4">快捷命令管理</h2>

    <el-tabs v-model="activeTab" class="mb-4">
      <el-tab-pane label="所有" name="all" />
      <el-tab-pane label="我的" name="mine" />
      <el-tab-pane label="本地命令" name="local" />
    </el-tabs>

    <div v-if="!user && activeTab !== 'local'" class="text-center text-gray-400 py-12">
      请先登录后查看快捷命令
    </div>

    <div v-else-if="loading" class="flex justify-center py-12">
      <el-icon class="is-loading" :size="24"><i class="i-loading" /></el-icon>
    </div>

    <div v-else-if="commands.length === 0" class="text-center text-gray-400 py-12">
      暂无快捷命令
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <CommandCard v-for="cmd in commands" :key="cmd.id" :command="cmd" />
    </div>
  </div>
</template>
