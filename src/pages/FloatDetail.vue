<template>
  <div
    ref="detailRef"
    class="float-detail"
    :data-theme="theme"
    :data-accent="accent"
    :data-preset="preset"
    @mouseenter="onDetailEnter"
    @mouseleave="onDetailLeave"
  >
    <!-- Model List -->
    <div class="detail-models">
      <div
        v-for="(model, i) in enabledModels"
        :key="model.id"
        class="detail-card"
        :style="{ animationDelay: i * 40 + 'ms' }"
      >
        <FloatModelCard :model="model" @fetch="fetchModel(model)" />
      </div>
    </div>

    <!-- 滚动提示：sticky 固定在可见区域底部，内容溢出时自然浮现 -->
    <div class="scroll-fade"></div>

    <!-- Empty -->
    <div v-if="enabledModels.length === 0" class="detail-empty">
      <el-icon :size="20" class="empty-icon"><DataAnalysis /></el-icon>
      <span>右键主窗口菜单添加模型</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed, watch, nextTick } from "vue";
import { DataAnalysis } from "@element-plus/icons-vue";
import { useAppStore } from "@/stores/app";
import type { ModelConfig } from "@/stores/app";
import FloatModelCard from "@/components/FloatModelCard.vue";

const store = useAppStore();
const theme = ref("light");
const accent = ref(localStorage.getItem("accent") || "forest");
const preset = ref(localStorage.getItem("preset") || "midnight");
const detailRef = ref<HTMLElement | null>(null);
const enabledModels = computed(() => store.models.filter((m) => m.enabled));
let unsubCfg: (() => void) | null = null;
let unsubThemeChanged: (() => void) | null = null;
let onWindowFocus: (() => void) | null = null;

// ── Hover bridge ──
// 通过 IPC 通知主进程，主进程再广播给主悬浮窗
function broadcastHover(state: "enter" | "leave") {
  window.electronAPI.notifyDetailHover(state);
}

function onDetailEnter() {
  broadcastHover("enter");
}

function onDetailLeave() {
  broadcastHover("leave");
}

// ── Fetch ──
async function fetchModel(m: ModelConfig) {
  await store.requestRefresh(m.id);
}

const DETAIL_MAX_HEIGHT = 420;

function fitHeight() {
  nextTick(() => {
    const el = detailRef.value;
    if (!el) return;
    el.style.height = "0";
    el.offsetHeight;
    const contentH = el.scrollHeight;
    el.style.height = "";
    const targetH = Math.min(contentH + 4, DETAIL_MAX_HEIGHT);
    window.electronAPI.resizeDetailWindow(window.outerWidth, targetH);
  });
}

// ── Lifecycle ──
onMounted(async () => {
  const s = localStorage.getItem("theme");
  if (s) theme.value = s;
  const savedPreset = localStorage.getItem("preset");
  if (savedPreset) preset.value = savedPreset;
  try {
    await store.loadConfig();
  } catch {}
  fitHeight();
  unsubCfg = window.electronAPI.onConfigUpdated(() => {
    store
      .loadConfig()
      .then(() => fitHeight())
      .catch(() => {});
  });
  // 监听主题变化（主窗口切换主题时实时同步）
  unsubThemeChanged = window.electronAPI.onThemeChanged((t) => {
    theme.value = t.mode;
    accent.value = t.accent;
    preset.value = t.preset;
    localStorage.setItem("theme", t.mode);
    localStorage.setItem("accent", t.accent);
    localStorage.setItem("preset", t.preset);
  });
  // 每次窗口显示时滚动到顶部
  onWindowFocus = () => {
    detailRef.value?.scrollTo(0, 0);
  };
  window.addEventListener("focus", onWindowFocus);

  // 通知主进程详情窗口已完成渲染，避免首次闪烁
  nextTick(() => {
    window.electronAPI.detailReady();
  });
});

onUnmounted(() => {
  store.stopSubscription();
  unsubCfg?.();
  unsubThemeChanged?.();
  if (onWindowFocus) window.removeEventListener("focus", onWindowFocus);
});

// 模型列表变化时自动调整窗口高度
watch(
  () => enabledModels.value.length,
  () => {
    fitHeight();
  },
);
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
    0 8px 24px rgba(0, 0, 0, 0.15),
    0 2px 8px rgba(0, 0, 0, 0.08);
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

/* 滚动条：默认隐藏，hover 时显现 */
.float-detail::-webkit-scrollbar {
  width: 4px;
}
.float-detail::-webkit-scrollbar-track {
  background: transparent;
}
.float-detail::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 4px;
  transition: background 0.3s;
}
.float-detail:hover::-webkit-scrollbar-thumb {
  background: var(--text-placeholder);
}
.float-detail:hover::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary);
}

/* ── Cards ── */
.detail-card {
  padding: 5px 6px;
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

/* ── 滚动提示遮罩 ── */
.scroll-fade {
  position: sticky;
  bottom: 0;
  flex-shrink: 0;
  height: 28px;
  background: linear-gradient(transparent, var(--bg-primary));
  pointer-events: none;
  transition: opacity 0.3s;
}
/* hover 时隐藏遮罩，由滚动条接管 */
.float-detail:hover .scroll-fade {
  opacity: 0;
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
  0%,
  100% {
    opacity: 0.4;
  }
  50% {
    opacity: 0.7;
  }
}
</style>
