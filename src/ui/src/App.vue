<script setup lang="ts">
import { ref, onMounted } from "vue";
import { getMe } from "./api";
import type { UserInfo } from "./types";
import AppHeader from "./components/AppHeader.vue";
import AppSidebar from "./components/AppSidebar.vue";
import ShortcutCommands from "./views/ShortcutCommands.vue";

const user = ref<UserInfo | null>(null);
const loading = ref(true);

onMounted(async () => {
  try {
    user.value = await getMe();
  } catch (e) {
    console.error("Failed to get user info:", e);
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="h-screen flex flex-col">
    <AppHeader :user="user" :loading="loading" />
    <div class="flex flex-1 overflow-hidden">
      <AppSidebar />
      <main class="flex-1 overflow-auto bg-gray-50 p-6">
        <ShortcutCommands :user="user" />
      </main>
    </div>
  </div>
</template>
