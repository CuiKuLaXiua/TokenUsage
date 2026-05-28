<template>
  <div class="usage-page">
    <div class="section-card glass-surface" style="animation-delay: 0ms">
      <div class="section-header">
        <h3 class="section-title">用量详情</h3>
      </div>

      <div class="empty-state">
        <div class="empty-icon-wrap">
          <el-icon :size="48" class="empty-float"><TrendCharts /></el-icon>
        </div>
        <p class="empty-text">暂无用量数据</p>
        <p class="empty-hint">配置模型并获取额度后，用量数据将在此展示</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { TrendCharts } from '@element-plus/icons-vue'
</script>

<style scoped>
.usage-page {
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
