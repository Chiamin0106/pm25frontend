<template>
  <a-card class="dashboard-header">
    <div class="dashboard-hero">
      <a-typography-title :level="2" class="page-title">PM2.5 測站濃度分析平台</a-typography-title>
    </div>

    <a-alert v-if="messageText" class="status-alert" type="success" show-icon :message="messageText" />
    <a-alert v-if="errorMessage" class="status-alert" type="error" show-icon :message="errorMessage" />
  </a-card>
</template>

<script setup>
// DashboardHeader 只負責顯示頁面標題，以及 App.vue 傳入的成功/錯誤訊息。
defineProps({
  // messageText 有值時顯示成功 alert。
  messageText: { type: String, default: '' },
  // errorMessage 有值時顯示錯誤 alert。
  errorMessage: { type: String, default: '' },
})
</script>
