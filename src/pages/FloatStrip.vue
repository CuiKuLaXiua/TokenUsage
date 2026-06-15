<template>
  <div class="strip" :class="[edge, { hidden }]" :data-theme="theme" :data-accent="accent" :data-preset="preset" @mousedown="onDown">
    <div
      v-for="(seg, i) in segments"
      :key="i"
      class="seg"
      :style="seg.filled ? { background: seg.color } : { background: 'var(--border-light)' }"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from "vue";
import { useAppStore } from "@/stores/app";
import { useUsageAggregation } from "@/composables/useUsageAggregation";

const store = useAppStore();
const agg = useUsageAggregation();
const hidden = ref(true);
const edge = ref("");
const theme = ref("dark");
const accent = ref(localStorage.getItem("accent") || "forest");
const preset = ref(localStorage.getItem("preset") || "midnight");
const SEGMENTS = 20;
let unsubEdgeDock: (() => void) | null = null;
let unsubTheme: (() => void) | null = null;

const segments = computed(() => {
  const pct = Math.min(100, Math.max(0, agg.mainRing.value.percent));
  const filled = Math.round((pct / 100) * SEGMENTS);
  return Array.from({ length: SEGMENTS }, (_, i) => {
    const t = i / (SEGMENTS - 1);
    const h = 120 - t * 115;
    const s = 65 + t * 18;
    const l = 48 - t * 12;
    return { color: `hsl(${h}, ${s}%, ${l}%)`, filled: i < filled };
  });
});

onMounted(async () => {
  // 读取初始主题
  const s = localStorage.getItem("theme");
  if (s) theme.value = s;
  const savedPreset = localStorage.getItem("preset");
  if (savedPreset) preset.value = savedPreset;
  // 先注册 listener，再异步加载数据（防止 IPC 在 loadConfig 期间到达而丢失）
  unsubEdgeDock = window.electronAPI.onEdgeDockChanged((s) => {
    hidden.value = !s.isDocked;
    if (s.edge) edge.value = `edge-${s.edge}`;
  });
  const initState = await window.electronAPI.getEdgeDockState();
  if (initState) {
    hidden.value = !initState.isDocked;
    if (initState.edge) edge.value = `edge-${initState.edge}`;
  }
  // 主题同步（与 FloatWindow 保持一致）
  unsubTheme = window.electronAPI.onThemeChanged((t) => {
    theme.value = t.mode;
    accent.value = t.accent;
    preset.value = t.preset;
    localStorage.setItem("theme", t.mode);
    localStorage.setItem("accent", t.accent);
    localStorage.setItem("preset", t.preset);
  });
  try {
    await store.loadConfig();
  } catch {}
});

onUnmounted(() => {
  unsubEdgeDock?.();
  unsubTheme?.();
});

function onDown(e: MouseEvent) {
  if (e.button !== 0) return;
  window.electronAPI.stripMousedown();
}
</script>

<style scoped>
.strip {
  position: relative;
  width: 8px;
  height: 100vh;
  background: var(--bg-primary);
  display: flex;
  flex-direction: column-reverse;
  gap: 1px;
  overflow: hidden;
  opacity: 1;
  border-radius: 4px;
  box-shadow: 0 0 12px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 0 rgba(255, 255, 255, 0.06);
  cursor: pointer;
  /* 入场动画 */
  transition: transform 0.38s var(--ease-spring),
    opacity 0.28s ease,
    width 0.25s var(--ease-spring);
}

/* 呼吸光效 */
.strip::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 4px;
  background: var(--accent);
  opacity: 0;
  filter: blur(8px);
  pointer-events: none;
  animation: stripBreathe 3s ease-in-out infinite;
}

@keyframes stripBreathe {
  0%, 100% { opacity: 0.08; transform: scaleY(0.97); }
  50% { opacity: 0.18; transform: scaleY(1.02); }
}

/* hover 扩展 */
.strip:hover {
  width: 10px;
}

/* click 按压 */
.strip:active {
  transform: scaleY(0.96);
  transition: transform 0.1s ease;
}

/* ── 隐藏状态 ── */
.strip.hidden {
  opacity: 0;
  pointer-events: none;
  transition: transform 0.22s ease-in, opacity 0.18s ease-in, width 0.2s ease-in;
}
.strip.hidden::after {
  animation: none;
  opacity: 0;
}

/* ── 方向：朝向屏幕边缘吸入 ── */

/* 左/右贴边：水平吸入 */
.strip.edge-left,
.strip.edge-right {
  transform: scaleX(1);
  transform-origin: center;
}
.strip.edge-left {
  transform-origin: left center;
}
.strip.edge-right {
  transform-origin: right center;
}
.strip.hidden.edge-left,
.strip.hidden.edge-right {
  transform: scaleX(0);
}

/* 顶部贴边：纵向吸入 */
.strip.edge-top {
  transform: scaleY(1);
  transform-origin: center top;
}
.strip.hidden.edge-top {
  transform: scaleY(0);
}

/* ── 色段 ── */
.seg {
  flex: 1;
  min-height: 0;
  border-radius: 2px;
  transition: background 0.4s var(--ease-smooth), opacity 0.3s ease;
}
</style>
