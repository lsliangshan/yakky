<script setup lang="ts">
import { ref } from "vue";

const activeMenu = ref("shortcut-commands");
</script>

<template>
  <aside class="w-52 bg-white border-r border-gray-200 shrink-0">
    <el-menu
      :default-active="activeMenu"
      class="border-r-0 h-full"
      @select="(index: string) => activeMenu = index"
    >
      <el-menu-item index="shortcut-commands">
        <el-icon><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V6h5.17l2 2H20v10z"/></svg></el-icon>
        <span>快捷命令管理</span>
      </el-menu-item>
    </el-menu>
  </aside>
</template>
