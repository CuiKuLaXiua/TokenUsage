<template>
  <div class="strip" :class="[edge, { hidden }]" :data-theme="theme" :data-accent="accent" :data-preset="preset" @mousedown="onDown">
    <template v-if="data.hasTiers">
      <!-- column-reverse: DOM 7D, notch, 5H → 视觉 5H(上), notch, 7D(下) -->
      <div v-for="i in 10" :key="'s7-' + i" class="seg"
        :style="{ background: segColor(data.sevenDay, i) }" />
      <div class="notch">
        <div class="notch-line bright" />
        <div class="notch-line dark" />
        <div class="notch-line bright" />
      </div>
      <div v-for="i in 10" :key="'s5-' + i" class="seg"
        :style="{ background: segColor(data.fiveHour, i) }" />
    </template>
    <template v-else>
      <div v-for="i in 20" :key="'s-' + i" class="seg"
        :style="{ background: segColor(data.mainPercent, i, 20) }" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";

const hidden = ref(true);
const edge = ref("");
const theme = ref("dark");
const accent = ref(localStorage.getItem("accent") || "forest");
const preset = ref(localStorage.getItem("preset") || "midnight");

const data = ref({ fiveHour: 0, sevenDay: 0, hasTiers: false, mainPercent: 0 });

let unsubEdgeDock: (() => void) | null = null;
let unsubTheme: (() => void) | null = null;
let unsubUsage: (() => void) | null = null;

/** 统一渐变：底部绿(120°) → 顶部红(5°) */
function segColor(percent: number, i: number, total: number = 10) {
  const t = (i - 1) / (total - 1);
  const h = 120 - t * 115;
  const s = 65 + t * 18;
  const l = 48 - t * 12;
  const filled = Math.round((Math.min(100, Math.max(0, percent)) / 100) * total);
  if (i <= filled) {
    return `hsl(${h}, ${s}%, ${l}%)`;
  }
  return "var(--border-light)";
}

async function fetchData() {
  try { data.value = await window.electronAPI.getStripData(); } catch {}
}

onMounted(async () => {
  const s = localStorage.getItem("theme");
  if (s) theme.value = s;
  const savedPreset = localStorage.getItem("preset");
  if (savedPreset) preset.value = savedPreset;

  unsubEdgeDock = window.electronAPI.onEdgeDockChanged((s) => {
    hidden.value = !s.isDocked;
    if (s.edge) edge.value = `edge-${s.edge}`;
  });
  const initState = await window.electronAPI.getEdgeDockState();
  if (initState) {
    hidden.value = !initState.isDocked;
    if (initState.edge) edge.value = `edge-${initState.edge}`;
  }

  unsubTheme = window.electronAPI.onThemeChanged((t) => {
    theme.value = t.mode;
    accent.value = t.accent;
    preset.value = t.preset;
    localStorage.setItem("theme", t.mode);
    localStorage.setItem("accent", t.accent);
    localStorage.setItem("preset", t.preset);
  });

  await fetchData();
  unsubUsage = window.electronAPI.onUsageUpdated(() => fetchData());
});

onUnmounted(() => {
  unsubEdgeDock?.();
  unsubTheme?.();
  unsubUsage?.();
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
  padding: 2px;
  box-sizing: border-box;
  overflow: hidden;
  border-radius: 0;
  box-shadow: 0 0 12px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 0 rgba(255, 255, 255, 0.06);
  cursor: pointer;
  transition: transform 0.38s var(--ease-spring),
    opacity 0.28s ease,
    width 0.25s var(--ease-spring);
}

.strip::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 0;
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

.strip:hover { width: 10px; }
.strip:active { transform: scaleY(0.96); transition: transform 0.1s ease; }

.strip.hidden {
  opacity: 0;
  pointer-events: none;
  transition: transform 0.28s ease-out, opacity 0.22s ease-out, width 0.25s var(--ease-spring);
}
.strip.hidden::after { animation: none; opacity: 0; }

.strip.edge-left { transform-origin: left center; }
.strip.edge-right { transform-origin: right center; }
.strip.edge-top { transform-origin: center top; }
.strip.hidden.edge-left,
.strip.hidden.edge-right { transform: scaleX(0); }
.strip.hidden.edge-top { transform: scaleY(0); }

/* 分段 */
.seg {
  flex: 1;
  min-height: 0;
  border-radius: 0;
  transition: background 0.4s var(--ease-smooth);
}

/* 刻痕分隔线：亮线 + 深槽 + 亮线 */
.notch {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
}
.notch-line {
  width: 100%;
}
.notch-line.bright {
  height: 1px;
  background: rgba(255, 255, 255, 0.25);
}
.notch-line.dark {
  height: 3px;
  background: rgba(0, 0, 0, 0.5);
}
</style>
