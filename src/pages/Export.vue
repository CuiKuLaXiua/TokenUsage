<template>
  <div class="export-page">
    <div class="section-card glass-surface" style="animation-delay: 0ms">
      <div class="section-header">
        <h3 class="section-title">数据导出</h3>
      </div>

      <div class="empty-state">
        <div class="empty-icon-wrap">
          <el-icon :size="48" class="empty-float"><Download /></el-icon>
        </div>
        <p class="empty-text">暂无数据可导出</p>
        <p class="empty-hint">获取模型额度后，可将数据导出为 CSV 或 JSON 格式</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Download } from '@element-plus/icons-vue'
</script>

<style scoped>
.export-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.empty-state {
  padding: 64px 0;
  gap: 14px;
}

.empty-icon-wrap {
  width: 88px;
  height: 88px;
  border-radius: 24px;
  margin-bottom: 4px;
}

.empty-text {
  font-size: 15px;
  font-weight: 600;
}

.empty-hint {
  font-size: 13px;
  color: var(--text-placeholder);
  text-align: center;
  max-width: 280px;
  line-height: 1.5;
}
</style>
