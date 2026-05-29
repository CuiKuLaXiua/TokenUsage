<template>
  <div
    ref="floatRef"
    class="float-window"
    :data-theme="theme"
    @contextmenu.prevent="showMenu($event)"
    @mouseenter="expandList"
    @mouseleave="collapseList"
  >
    <!-- Unified context menu -->
    <Teleport to="body">
      <div
        v-if="menuVisible"
        class="ctx-overlay"
        @click="menuVisible = false"
        @contextmenu.prevent="menuVisible = false"
      >
        <div
          class="ctx-menu"
          :style="{ left: menuX + 'px', top: menuY + 'px' }"
          @click.stop
        >
          <!-- Model-specific actions -->
          <template v-if="ctxModel">
            <div class="ctx-header">{{ ctxModel.name }}</div>
            <div class="ctx-item" @click="doFetch(ctxModel)">
              <el-icon :size="13"><Refresh /></el-icon><span>刷新额度</span>
            </div>
            <div class="ctx-sep"></div>
          </template>

          <!-- Global actions -->
          <div class="ctx-item" @click="doRefreshAll">
            <el-icon :size="13"><Refresh /></el-icon><span>刷新全部</span>
          </div>
          <div class="ctx-sep"></div>
          <div
            class="ctx-item"
            :class="{ active: layoutMode === 'list' }"
            @click="doLayout('list')"
          >
            <el-icon :size="13"><List /></el-icon><span>列表模式</span>
          </div>
          <div
            class="ctx-item"
            :class="{ active: layoutMode === 'carousel' }"
            @click="doLayout('carousel')"
          >
            <el-icon :size="13"><Grid /></el-icon><span>轮播模式</span>
          </div>
          <div class="ctx-sep"></div>
          <div
            class="ctx-item"
            :class="{ active: alwaysOnTop }"
            @click="doToggleTop"
          >
            <el-icon :size="13"><Top /></el-icon><span>窗口置顶</span>
          </div>
          <div class="ctx-sep"></div>
          <div class="ctx-item danger" @click="doClose">
            <el-icon :size="13"><Close /></el-icon><span>关闭悬浮窗</span>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Empty -->
    <div v-if="store.models.length === 0" class="float-empty">
      <span>右键菜单添加模型</span>
    </div>

    <!-- List mode -->
    <template v-else-if="layoutMode === 'list'">
      <div class="list-wrap">
        <div ref="listScrollRef" class="list-scroll">
          <!-- Overview -->
          <div class="list-card ov-card" :data-model-id="'__overview__'">
            <div class="ov-row">
              <div class="ov-ring" :style="ringCSS(usagePercent)">
                <div class="ov-ring-inner">
                  <span class="ov-pct">{{ usagePercent.toFixed(0) }}</span>
                  <span class="ov-pct-u">%</span>
                </div>
              </div>
              <div class="ov-nums">
                <div class="ov-n">
                  <span class="ov-nv">{{ fmtLg(totalTokens) }}</span
                  ><span class="ov-nl">总配额</span>
                </div>
                <div class="ov-n">
                  <span class="ov-nv warn">{{ fmtLg(usedTokens) }}</span
                  ><span class="ov-nl">已使用</span>
                </div>
                <div class="ov-n">
                  <span class="ov-nv ok">{{ fmtLg(remainingTokens) }}</span
                  ><span class="ov-nl">剩余</span>
                </div>
              </div>
            </div>
          </div>
          <!-- Models -->
          <div class="list-models" :class="{ expanded: listExpanded }">
            <div
              v-for="(model, i) in store.models"
              :key="model.id"
              class="list-card"
              :data-model-id="model.id"
              :style="{ animationDelay: i * 40 + 'ms' }"
            >
              <FloatModelCard :model="model" @fetch="fetchModel(model)" />
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Carousel mode -->
    <template v-else>
      <div class="carousel-wrap" @wheel.prevent="onWheel">
        <div
          ref="carouselRef"
          class="carousel-track"
          @scroll="onScroll"
          @mousedown="onDragStart"
          @mousemove="onDragMove"
          @mouseup="onDragEnd"
          @mouseleave="onDragEnd"
        >
          <!-- Overview slide -->
          <div class="cslide" :data-model-id="'__overview__'">
            <div class="cslide-body ov-slide">
              <div class="ov-ring-lg" :style="ringCSS(usagePercent, 80)">
                <div class="ov-ring-lg-in">
                  <span class="ov-pct-lg">{{ usagePercent.toFixed(1) }}</span>
                  <span class="ov-pct-u-lg">%</span>
                </div>
              </div>
              <div class="ov-stats">
                <div class="ov-st">
                  <span class="ov-stv">{{ fmtLg(totalTokens) }}</span
                  ><span class="ov-stl">总配额</span>
                </div>
                <div class="ov-st">
                  <span class="ov-stv warn">{{ fmtLg(usedTokens) }}</span
                  ><span class="ov-stl">已使用</span>
                </div>
                <div class="ov-st">
                  <span class="ov-stv ok">{{ fmtLg(remainingTokens) }}</span
                  ><span class="ov-stl">剩余</span>
                </div>
              </div>
              <div class="ov-foot">
                <span class="ov-cnt">{{ store.models.length }}</span
                ><span class="ov-cntl">个模型</span>
              </div>
            </div>
          </div>

          <!-- Model slides -->
          <div
            v-for="model in store.models"
            :key="model.id"
            class="cslide"
            :data-model-id="model.id"
          >
            <div class="cslide-body model-slide">
              <div class="ms-hd">
                <span class="ms-name">{{ model.name }}</span>
                <span class="ms-badge" :class="model.provider">{{
                  model.provider
                }}</span>
              </div>
              <div class="ms-bd">
                <template v-if="u(model.id)">
                  <!-- token -->
                  <template v-if="u(model.id).usageType === 'token'">
                    <div
                      class="ms-ring"
                      :style="ringCSS(u(model.id).percent || 0, 64)"
                    >
                      <div class="ms-ring-in">
                        <span class="ms-rv">{{
                          (u(model.id).percent || 0).toFixed(0)
                        }}</span>
                        <span class="ms-ru">%</span>
                      </div>
                    </div>
                    <div class="ms-rows">
                      <div class="ms-r">
                        <span class="ms-k">套餐</span
                        ><span class="ms-v">{{ u(model.id).planName }}</span>
                      </div>
                      <div class="ms-r">
                        <span class="ms-k">已用</span
                        ><span class="ms-v">{{ fmtTk(u(model.id).used) }}</span>
                      </div>
                      <div class="ms-r">
                        <span class="ms-k">总计</span
                        ><span class="ms-v">{{
                          fmtTk(u(model.id).total)
                        }}</span>
                      </div>
                      <div class="ms-r hl">
                        <span class="ms-k">剩余</span
                        ><span class="ms-v">{{
                          fmtTk(u(model.id).remaining)
                        }}</span>
                      </div>
                    </div>
                  </template>
                  <!-- percent -->
                  <template v-else-if="u(model.id).usageType === 'percent'">
                    <div
                      v-for="tier in u(model.id).tiers"
                      :key="tier.name"
                      class="ms-tier"
                    >
                      <div class="ms-tier-hd">
                        <span class="ms-tier-lb">{{ tier.label }}</span
                        ><span class="ms-tier-pc"
                          >{{ fmtPct(tier.percent) }}%</span
                        >
                      </div>
                      <div class="ms-bar">
                        <div
                          class="ms-bar-f"
                          :style="{
                            width: tier.percent + '%',
                            background: getColor(tier.percent),
                          }"
                        ></div>
                      </div>
                      <div class="ms-tier-ft">
                        <span
                          >{{ fmtTk(tier.used) }} /
                          {{ fmtTk(tier.total) }}</span
                        ><span class="hl">余 {{ fmtTk(tier.remaining) }}</span>
                      </div>
                      <div v-if="tier.resetAt" class="ms-tier-reset">
                        <el-icon :size="10"><Clock /></el-icon>
                        <span>{{ fmtReset(tier.resetAt) }}</span>
                      </div>
                    </div>
                  </template>
                  <!-- balance -->
                  <template v-else-if="u(model.id).usageType === 'balance'">
                    <div class="ms-bal">
                      <span class="ms-bal-c">¥</span
                      ><span class="ms-bal-v">{{
                        (u(model.id).balance || 0).toFixed(2)
                      }}</span>
                    </div>
                  </template>
                </template>
                <template v-else>
                  <button
                    class="ms-btn"
                    @click="fetchModel(model)"
                    :disabled="store.fetching[model.id]"
                  >
                    {{ store.fetching[model.id] ? "获取中..." : "获取额度" }}
                  </button>
                </template>
              </div>
            </div>
          </div>
        </div>

        <!-- Fixed dots -->
        <div v-if="slideCount > 1" class="dots">
          <i
            v-for="n in slideCount"
            :key="n"
            class="dot"
            :class="{ on: n - 1 === idx }"
            @click="go(n - 1)"
          ></i>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, nextTick, watch } from "vue";
import {
  Refresh,
  Close,
  Grid,
  List,
  Top,
  Clock,
} from "@element-plus/icons-vue";
import { useAppStore } from "@/stores/app";
import type { ModelConfig } from "@/stores/app";
import {
  formatTokens,
  formatPercent,
  getProgressColor,
  formatResetTime,
} from "@/utils/format";
import FloatModelCard from "@/components/FloatModelCard.vue";

type LayoutMode = "list" | "carousel";

const store = useAppStore();
const theme = ref("light");
const layoutMode = ref<LayoutMode>(
  (localStorage.getItem("floatLayout") as LayoutMode) || "list",
);
const idx = ref(0);
const carouselRef = ref<HTMLElement | null>(null);
const floatRef = ref<HTMLElement | null>(null);
const listScrollRef = ref<HTMLElement | null>(null);
const alwaysOnTop = ref(localStorage.getItem("floatAlwaysOnTop") !== "false");
let unsubCfg: (() => void) | null = null;

// List expand state
const listExpanded = ref(false)
let collapseTimer: ReturnType<typeof setTimeout> | null = null

function expandList() {
  if (collapseTimer) { clearTimeout(collapseTimer); collapseTimer = null }
  if (layoutMode.value !== 'list' || listExpanded.value) return
  listExpanded.value = true
  // 立即测量并动画缩放窗口，CSS 不再做过渡，由 Electron 窗口动画替代
  resizeToFit(true)
}
function collapseList() {
  if (layoutMode.value !== 'list' || menuVisible.value) return
  collapseTimer = setTimeout(() => {
    if (menuVisible.value) return
    listExpanded.value = false
    resizeToFit(true)
  }, 300)
}

// Menu state
const menuVisible = ref(false);
const menuX = ref(0);
const menuY = ref(0);
const ctxModel = ref<ModelConfig | null>(null);

// Computed
const totalTokens = computed(() =>
  Object.values(store.modelUsageMap)
    .filter((u) => u.usageType === "token")
    .reduce((s, u) => s + (u.total || 0), 0),
);
const usedTokens = computed(() =>
  Object.values(store.modelUsageMap)
    .filter((u) => u.usageType === "token")
    .reduce((s, u) => s + (u.used || 0), 0),
);
const remainingTokens = computed(() =>
  Object.values(store.modelUsageMap)
    .filter((u) => u.usageType === "token")
    .reduce((s, u) => s + (u.remaining || 0), 0),
);
const usagePercent = computed(() =>
  totalTokens.value === 0
    ? 0
    : Math.round((usedTokens.value / totalTokens.value) * 10000) / 100,
);
const slideCount = computed(() => 1 + store.models.length);

// Helpers
function u(id: string) {
  return store.modelUsageMap[id];
}
function fmtTk(v?: number) {
  return formatTokens(v ?? 0);
}
function fmtPct(v: number) {
  return formatPercent(v);
}
function getColor(p: number) {
  return getProgressColor(p);
}
function fmtReset(s: string) {
  return formatResetTime(s);
}
function fmtLg(n: number) {
  if (n >= 1e12) return (n / 1e12).toFixed(2) + "T";
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(2) + "K";
  return n.toFixed(2);
}
function ringCSS(pct: number, size = 80) {
  return {
    width: size + "px",
    height: size + "px",
    background: `conic-gradient(${getColor(pct)} ${pct}%, var(--border-light) 0)`,
  };
}

// Resize
const FLOAT_WIDTH = 280;
const MIN_HEIGHT = 80;
const MAX_HEIGHT = 500;

function resizeToFit(animate = false) {
  nextTick(() => {
    if (layoutMode.value === 'carousel') {
      const fn = animate ? window.electronAPI.resizeFloatWindowAnimated : window.electronAPI.resizeFloatWindow
      fn(FLOAT_WIDTH, 280, 300)
      return
    }

    const el = floatRef.value
    if (!el) return

    // 临时去掉 height:100vh，让容器缩到内容的自然高度再测量
    el.style.height = 'auto'
    el.offsetHeight // 强制回流
    const contentHeight = el.scrollHeight
    el.style.height = ''

    const height = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, contentHeight))
    const fn = animate ? window.electronAPI.resizeFloatWindowAnimated : window.electronAPI.resizeFloatWindow
    fn(FLOAT_WIDTH, height, 300)
  })
}

// Menu
function showMenu(e: MouseEvent) {
  // 展开菜单时取消任何待执行的收起
  if (collapseTimer) { clearTimeout(collapseTimer); collapseTimer = null }

  // Walk up from target to find a model card
  let el = e.target as HTMLElement | null
  ctxModel.value = null
  while (el && el !== e.currentTarget) {
    const mid = el.dataset?.modelId
    if (mid && mid !== '__overview__') {
      ctxModel.value = store.models.find(m => m.id === mid) || null
      break
    }
    el = el.parentElement
  }

  // 窗口较小时智能定位，避免菜单被裁剪
  const MENU_W = 150
  const MENU_H = 240
  let mx = e.clientX
  let my = e.clientY
  if (mx + MENU_W > window.innerWidth) mx = Math.max(4, window.innerWidth - MENU_W)
  if (my + MENU_H > window.innerHeight) my = Math.max(4, e.clientY - MENU_H)
  menuX.value = mx
  menuY.value = my
  menuVisible.value = true
}

function doFetch(m: ModelConfig) {
  menuVisible.value = false;
  fetchModel(m);
}
function doRefreshAll() {
  menuVisible.value = false;
  store.refreshAll();
}
function doLayout(mode: LayoutMode) {
  layoutMode.value = mode;
  localStorage.setItem("floatLayout", mode);
  menuVisible.value = false;
  if (mode === "carousel")
    nextTick(() => {
      idx.value = 0;
      go(0);
      updateActiveSlide();
    });
}
function doToggleTop() {
  alwaysOnTop.value = !alwaysOnTop.value;
  localStorage.setItem("floatAlwaysOnTop", String(alwaysOnTop.value));
  window.electronAPI.setFloatAlwaysOnTop(alwaysOnTop.value);
  menuVisible.value = false;
}
function doClose() {
  menuVisible.value = false;
  window.electronAPI.closeFloatWindow();
}

// Carousel
function updateActiveSlide() {
  const el = carouselRef.value;
  if (!el) return;
  const slides = el.querySelectorAll(".cslide");
  slides.forEach((s, i) => {
    s.classList.toggle("active", i === idx.value);
  });
}
function onScroll() {
  const el = carouselRef.value;
  if (!el) return;
  const w = el.querySelector(".cslide")?.clientWidth || 1;
  const newIdx = Math.round(el.scrollLeft / w);
  if (newIdx !== idx.value) {
    idx.value = newIdx;
    updateActiveSlide();
  }
}
function go(i: number) {
  const el = carouselRef.value;
  if (!el) return;
  idx.value = i;
  updateActiveSlide();
  el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
}
function onWheel(e: WheelEvent) {
  if (Math.abs(e.deltaY) < 10) return;
  const dir = e.deltaY > 0 ? 1 : -1;
  const next = Math.max(0, Math.min(slideCount.value - 1, idx.value + dir));
  if (next !== idx.value) go(next);
}

// Drag to swipe
let dragStartX = 0;
let dragScrollLeft = 0;
let dragging = false;

function onDragStart(e: MouseEvent) {
  const el = carouselRef.value;
  if (!el) return;
  dragging = true;
  dragStartX = e.pageX;
  dragScrollLeft = el.scrollLeft;
  el.style.scrollSnapType = "none";
  el.style.cursor = "grabbing";
}

function onDragMove(e: MouseEvent) {
  if (!dragging) return;
  const el = carouselRef.value;
  if (!el) return;
  const dx = e.pageX - dragStartX;
  el.scrollLeft = dragScrollLeft - dx;
}

function onDragEnd(e: MouseEvent) {
  if (!dragging) return;
  dragging = false;
  const el = carouselRef.value;
  if (!el) return;
  el.style.scrollSnapType = "";
  el.style.cursor = "";
  // Snap to nearest slide based on final scroll position
  const w = el.querySelector(".cslide")?.clientWidth || 1;
  const target = Math.round(el.scrollLeft / w);
  go(Math.max(0, Math.min(slideCount.value - 1, target)));
}

// Fetch
async function fetchModel(m: ModelConfig) {
  await store.fetchModelUsage(m);
}

// Lifecycle
onMounted(async () => {
  const s = localStorage.getItem("theme");
  if (s) theme.value = s;
  try {
    await store.loadConfig();
    resizeToFit();
    await store.refreshAll();
    resizeToFit();
  } catch {}
  if (layoutMode.value === "carousel") {
    nextTick(() => {
      idx.value = 0;
      updateActiveSlide();
    });
  }
  unsubCfg = window.electronAPI.onConfigUpdated(() => {
    store
      .loadConfig()
      .then(() => resizeToFit())
      .catch(() => {});
  });
});
onUnmounted(() => {
  store.stopAutoRefresh();
  unsubCfg?.();
});

// Re-resize when layout mode or model count changes
watch(layoutMode, () => {
  resizeToFit();
  if (layoutMode.value === "carousel") nextTick(updateActiveSlide);
});
watch(
  () => store.models.length,
  () => {
    resizeToFit();
    if (layoutMode.value === "carousel") nextTick(updateActiveSlide);
  },
);
</script>

<style scoped>
.float-window {
  height: 100vh;
  background:
    linear-gradient(180deg, rgba(0, 212, 255, 0.03) 0%, transparent 30%),
    var(--bg-primary);
  overflow: hidden;
  user-select: none;
  display: flex;
  flex-direction: column;
  /* 顶部边缘微光 */
  box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.06);
  -webkit-app-region: drag;
}

.float-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--text-placeholder);
  -webkit-app-region: no-drag;
}

/* ═══ List ═══ */
.list-wrap {
  flex: 1;
  overflow: hidden;
  -webkit-app-region: no-drag;
}

.list-scroll {
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
  scrollbar-color: var(--border-light) transparent;
}
.list-scroll::-webkit-scrollbar {
  width: 3px;
}
.list-scroll::-webkit-scrollbar-thumb {
  background: var(--border-light);
  border-radius: 2px;
}

.list-card {
  padding: 8px 10px;
  border-bottom: 1px solid var(--border-light);
  transition:
    transform 0.25s var(--ease-spring),
    box-shadow 0.25s,
    background 0.25s;
  border-radius: 0;
}
.list-card:hover {
  transform: translateY(-1px);
  background: var(--glass-bg);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  border-radius: 12px;
}
.list-card:last-child {
  border-bottom: none;
}

/* 模型列表折叠/展开 — 无 CSS 动画，由 Electron 窗口 resize 动画替代 */
.list-models {
  display: none;
  opacity: 0;
}
.list-models.expanded {
  display: block;
  opacity: 1;
}
.list-models.expanded .list-card {
  animation: cardPopIn 0.35s var(--ease-spring) both;
}
.list-models.expanded .list-card:nth-child(1) {
  animation-delay: 0.03s;
}
.list-models.expanded .list-card:nth-child(2) {
  animation-delay: 0.06s;
}
.list-models.expanded .list-card:nth-child(3) {
  animation-delay: 0.09s;
}
.list-models.expanded .list-card:nth-child(4) {
  animation-delay: 0.12s;
}
.list-models.expanded .list-card:nth-child(5) {
  animation-delay: 0.15s;
}
.list-models.expanded .list-card:nth-child(6) {
  animation-delay: 0.18s;
}
.list-models.expanded .list-card:nth-child(7) {
  animation-delay: 0.21s;
}
.list-models.expanded .list-card:nth-child(8) {
  animation-delay: 0.24s;
}
.list-models.expanded .list-card:nth-child(9) {
  animation-delay: 0.27s;
}
.list-models.expanded .list-card:nth-child(10) {
  animation-delay: 0.3s;
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

/* overview in list */
.ov-card {
  padding: 10px;
}
.ov-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.ov-ring {
  flex-shrink: 0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ov-ring-inner {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: var(--bg-primary);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.ov-pct {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1;
}
.ov-pct-u {
  font-size: 10px;
  color: var(--text-secondary);
  font-weight: 600;
}

/* ── 进度环呼吸光晕 ── */
.ov-ring,
.ov-ring-lg,
.ms-ring {
  position: relative;
}
.ov-ring::after,
.ov-ring-lg::after,
.ms-ring::after {
  content: "";
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  background: inherit;
  filter: blur(8px);
  opacity: 0.25;
  animation: ringBreath 3s ease-in-out infinite;
  z-index: -1;
}
@keyframes ringBreath {
  0%,
  100% {
    opacity: 0.15;
    transform: scale(0.92);
  }
  50% {
    opacity: 0.35;
    transform: scale(1.08);
  }
}

.ov-nums {
  flex: 1;
  display: flex;
  gap: 10px;
}
.ov-n {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  flex: 1;
}
.ov-nv {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}
.ov-nv.warn {
  color: var(--warning);
}
.ov-nv.ok {
  color: var(--success);
}
.ov-nl {
  font-size: 10px;
  color: var(--text-secondary);
}

/* ═══ Carousel ═══ */
.carousel-wrap {
  flex: 1;
  overflow: hidden;
  position: relative;
  perspective: 900px;
  -webkit-app-region: no-drag;
}
.carousel-track {
  display: flex;
  height: 100%;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  cursor: grab;
  user-select: none;
}
.carousel-track::-webkit-scrollbar {
  display: none;
}

.cslide {
  flex: 0 0 100%;
  scroll-snap-align: start;
  height: 100%;
  position: relative;
  display: flex;
  flex-direction: column;
  transition:
    transform 0.5s var(--ease-spring),
    opacity 0.4s var(--ease-smooth);
  opacity: 0.5;
  transform: scale(0.9) rotateY(6deg);
}
.cslide.active {
  opacity: 1;
  transform: scale(1) rotateY(0deg);
}

.cslide-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 10px 12px 28px;
  box-sizing: border-box;
  animation: slideEnter 0.45s var(--ease-spring) both;
}
@keyframes slideEnter {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* overview slide */
.ov-slide {
  align-items: center;
  justify-content: center;
  gap: 14px;
}
.ov-ring-lg {
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.ov-ring-lg-in {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: var(--bg-primary);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.ov-pct-lg {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1;
}
.ov-pct-u-lg {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 600;
}
.ov-stats {
  display: flex;
  gap: 14px;
}
.ov-st {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.ov-stv {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}
.ov-stv.warn {
  color: var(--warning);
}
.ov-stv.ok {
  color: var(--success);
}
.ov-stl {
  font-size: 10px;
  color: var(--text-secondary);
}
.ov-foot {
  display: flex;
  align-items: baseline;
  gap: 3px;
}
.ov-cnt {
  font-size: 20px;
  font-weight: 700;
  color: var(--accent);
}
.ov-cntl {
  font-size: 11px;
  color: var(--text-secondary);
}

/* model slide */
.model-slide {
  gap: 8px;
}
.ms-hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.ms-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ms-badge {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 5px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: var(--glass-bg);
  color: var(--text-secondary);
}
.ms-badge.openai {
  background: rgba(16, 163, 127, 0.12);
  color: #10a37f;
}
.ms-badge.claude {
  background: rgba(204, 132, 63, 0.12);
  color: #cc843f;
}
.ms-badge.deepseek {
  background: rgba(59, 130, 246, 0.12);
  color: #3b82f6;
}
.ms-badge.kimi {
  background: rgba(139, 92, 246, 0.12);
  color: #8b5cf6;
}
.ms-badge.mimo {
  background: rgba(255, 107, 0, 0.12);
  color: #ff6b00;
}

.ms-bd {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
}
.ms-ring {
  align-self: center;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ms-ring-in {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--bg-primary);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.ms-rv {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1;
}
.ms-ru {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-secondary);
}

.ms-rows {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ms-r {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
}
.ms-k {
  color: var(--text-secondary);
}
.ms-v {
  font-weight: 600;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}
.ms-r.hl .ms-v {
  color: var(--neon-green);
}

.ms-tier {
  margin-bottom: 5px;
}
.ms-tier:last-child {
  margin-bottom: 0;
}
.ms-tier-hd {
  display: flex;
  justify-content: space-between;
  margin-bottom: 2px;
}
.ms-tier-lb {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
}
.ms-tier-pc {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
}
.ms-bar {
  height: 4px;
  border-radius: 2px;
  background: var(--border-light);
  overflow: hidden;
  margin-bottom: 2px;
}
.ms-bar-f {
  height: 100%;
  border-radius: 2px;
  transition: width 0.8s var(--ease-spring);
}
.ms-tier-ft {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--text-secondary);
}
.ms-tier-ft .hl {
  color: var(--success);
  font-weight: 600;
}
.ms-tier-reset {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  color: var(--text-placeholder);
  margin-top: 1px;
}

.ms-bal {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 4px;
}
.ms-bal-c {
  font-size: 18px;
  font-weight: 300;
  color: var(--text-secondary);
}
.ms-bal-v {
  font-size: 30px;
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.ms-btn {
  align-self: center;
  padding: 7px 20px;
  border-radius: 8px;
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s;
}
.ms-btn:hover:not(:disabled) {
  background: var(--glass-bg-strong);
}
.ms-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* dots — fixed at bottom of carousel */
.dots {
  position: absolute;
  bottom: 6px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 4px;
  z-index: 2;
  pointer-events: auto;
}
.dot {
  display: block;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--text-secondary);
  opacity: 0.3;
  cursor: pointer;
  transition: all 0.2s;
}
.dot.on {
  width: 12px;
  border-radius: 2px;
  background: var(--accent);
  opacity: 1;
}

/* ═══ Context Menu ═══ */
.ctx-overlay {
  position: fixed;
  inset: 0;
  z-index: 9998;
}
.ctx-menu {
  position: fixed;
  z-index: 9999;
  min-width: 140px;
  background: var(--glass-bg-strong);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  padding: 6px;
  box-shadow:
    0 12px 40px rgba(0, 0, 0, 0.35),
    0 0 0 1px rgba(255, 255, 255, 0.05) inset;
  animation: menuElastic 0.35s var(--ease-spring) both;
  transform-origin: top left;
}
@keyframes menuElastic {
  0% {
    opacity: 0;
    transform: scale(0.5) translateY(-12px);
  }
  55% {
    transform: scale(1.06) translateY(2px);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
.ctx-header {
  padding: 6px 10px;
  font-size: 11px;
  font-weight: 700;
  color: var(--accent);
  opacity: 0.8;
}
.ctx-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 8px;
  font-size: 12px;
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.15s var(--ease-smooth);
}
.ctx-item:hover {
  background: var(--glass-bg);
  transform: translateX(2px);
}
.ctx-item:hover .el-icon {
  animation: iconWiggle 0.35s ease;
}
@keyframes iconWiggle {
  0%,
  100% {
    transform: rotate(0);
  }
  25% {
    transform: rotate(-10deg);
  }
  75% {
    transform: rotate(10deg);
  }
}
.ctx-item.active {
  color: var(--accent);
  background: rgba(0, 212, 255, 0.06);
}
.ctx-item.danger {
  color: #f87171;
}
.ctx-item.danger:hover {
  background: rgba(248, 113, 113, 0.1);
}
.ctx-sep {
  height: 1px;
  background: var(--border-light);
  margin: 4px 8px;
}
</style>
