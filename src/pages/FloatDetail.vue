<template>
  <div
    ref="detailRef"
    class="float-detail"
    :data-theme="theme"
    :data-accent="accent"
    @mouseenter="onDetailEnter"
    @mouseleave="onDetailLeave"
  >
    <!-- Model List -->
    <div class="detail-models">
      <div
        v-for="(model, i) in store.models"
        :key="model.id"
        class="detail-card"
        :style="{ animationDelay: i * 40 + 'ms' }"
      >
        <FloatModelCard :model="model" @fetch="fetchModel(model)" />
      </div>
    </div>

    <!-- Empty -->
    <div v-if="store.models.length === 0" class="detail-empty">
      <el-icon :size="20" class="empty-icon"><DataAnalysis /></el-icon>
      <span>右键主窗口菜单添加模型</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, nextTick } from 'vue'
import { DataAnalysis } from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'
import type { ModelConfig } from '@/stores/app'
import FloatModelCard from '@/components/FloatModelCard.vue'

const store = useAppStore()
const theme = ref('light')
const accent = ref(localStorage.getItem('accent') || 'forest')
const detailRef = ref<HTMLElement | null>(null)
let unsubCfg: (() => void) | null = null

// ── Hover bridge ──
// 通过 IPC 通知主进程，主进程再广播给主悬浮窗
function broadcastHover(state: 'enter' | 'leave') {
  window.electronAPI.notifyDetailHover(state)
}

function onDetailEnter() {
  broadcastHover('enter')
}

function onDetailLeave() {
  broadcastHover('leave')
}

// ── Fetch ──
async function fetchModel(m: ModelConfig) {
  await store.requestRefresh(m.id)
}

function fitHeight() {
  nextTick(() => {
    const el = detailRef.value
    if (!el) return
    // 将 height 设为 0 后测量 scrollHeight，获取真实内容高度
    // （height: auto 时 scrollHeight 等于 clientHeight，测量不准）
    el.style.height = '0'
    el.offsetHeight
    const contentH = el.scrollHeight
    el.style.height = ''
    window.electronAPI.resizeDetailWindow(window.innerWidth, contentH + 4)
  })
}

// ── Lifecycle ──
onMounted(async () => {
  const s = localStorage.getItem('theme')
  if (s) theme.value = s
  try {
    await store.loadConfig()
  } catch {}
  fitHeight()
  unsubCfg = window.electronAPI.onConfigUpdated(() => {
    store.loadConfig().then(() => fitHeight()).catch(() => {})
  })
})

onUnmounted(() => {
  store.stopSubscription()
  unsubCfg?.()
})
</script>

<style scoped>
.float-detail {
  width: 100%;
  height: 100vh;
  background: var(--bg-primary);
  overflow-y: auto;
  overflow-x: hidden;
  user-select: none;
  display: flex;
  flex-direction: column;
  /* 玻璃边框效果 */
  border-radius: 14px;
  border: 1px solid var(--glass-border);
  box-shadow:
    0 20px 60px rgba(0, 0, 0, 0.3),
    0 0 0 1px rgba(255, 255, 255, 0.05) inset;
  /* 入场动画 */
  animation: detailEnter 0.25s var(--ease-spring) both;
}

@keyframes detailEnter {
  from {
    opacity: 0;
    transform: scale(0.96) translateX(-8px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateX(0);
  }
}

/* 滚动条 */
.float-detail::-webkit-scrollbar {
  width: 3px;
}
.float-detail::-webkit-scrollbar-thumb {
  background: var(--border-light);
  border-radius: 2px;
}

/* ── Cards ── */
.detail-card {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-light);
  transition:
    transform 0.25s var(--ease-spring),
    box-shadow 0.25s,
    background 0.25s,
    border-radius 0.25s;
  border-radius: 0;
}
.detail-card:hover {
  transform: translateY(-1px);
  background: var(--glass-bg);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  border-radius: 12px;
}
.detail-card:last-child {
  border-bottom: none;
}

/* 入场动画 */
.detail-models .detail-card {
  animation: cardPopIn 0.35s var(--ease-spring) both;
}

@keyframes cardPopIn {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* ── Empty ── */
.detail-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-placeholder);
}
.empty-icon {
  color: var(--text-placeholder);
  animation: emptyPulse 3s ease-in-out infinite;
}
@keyframes emptyPulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.7; }
}
</style>
