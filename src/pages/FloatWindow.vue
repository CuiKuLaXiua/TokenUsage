<template>
  <div
    ref="floatRef"
    class="float-window"
    :data-theme="theme"
    :data-accent="accent"
    :data-preset="preset"
    @contextmenu.prevent="showMenu($event)"
    @mouseenter="onFloatEnter"
    @mouseleave="onFloatLeave"
    @mousedown="onWindowDragStart"
    @dblclick="onDoubleClick"
  >
    <!-- 正常内容（贴边时隐藏，拖拽时显示） -->
    <template v-if="!isDocked || isDragging">
      <!-- Empty -->
      <div v-if="enabledModels.length === 0" class="float-empty">
        <div class="empty-icon-wrap">
          <el-icon :size="20" class="empty-float"><DataAnalysis /></el-icon>
        </div>
        <span>右键菜单添加模型</span>
      </div>

      <!-- List mode (compact overview) -->
      <template v-else-if="layoutMode === 'list'">
        <div class="compact-wrap">
          <div class="compact-card" :data-model-id="'__overview__'">
            <div class="ov-row">
              <div class="ov-ring" style="width: 40px; height: 40px">
                <TokenRing
                  :percent="agg.mainRing.value.percent"
                  :size="40"
                  :stroke="3"
                >
                  <div class="ov-ring-inner">
                    <span class="ov-pct">{{
                      agg.mainRing.value.source !== "none"
                        ? agg.mainRing.value.percent.toFixed(0)
                        : "—"
                    }}</span>
                    <span class="ov-pct-u">{{
                      agg.mainRing.value.source !== "none" ? "%" : ""
                    }}</span>
                  </div>
                </TokenRing>
              </div>
              <div class="ov-nums">
                <div class="ov-n" v-if="agg.tokenAgg.value">
                  <span class="ov-nv"
                    >{{ fmtLg(agg.tokenAgg.value.used) }}/{{
                      fmtLg(agg.tokenAgg.value.total)
                    }}</span
                  >
                  <span class="ov-nl"
                    >Token {{ agg.tokenAgg.value.percent.toFixed(0) }}%</span
                  >
                </div>
                <div class="ov-n" v-if="agg.percentAgg.value">
                  <span class="ov-nv warn"
                    >{{ agg.percentAgg.value.worstLabel }}
                    {{ agg.percentAgg.value.worstPercent.toFixed(0) }}%</span
                  >
                  <span class="ov-nl">时间窗口</span>
                </div>
                <div class="ov-n" v-if="agg.balanceAgg.value">
                  <span class="ov-nv ok"
                    >{{
                      agg.balanceAgg.value.currency === "CNY"
                        ? "¥"
                        : agg.balanceAgg.value.currency
                    }}{{ agg.balanceAgg.value.totalBalance.toFixed(0) }}</span
                  >
                  <span class="ov-nl">余额</span>
                </div>
              </div>
            </div>
            <div class="ov-types" v-if="agg.hasAnyData.value">
              <span class="ov-type-tag t"
                >T:{{ agg.typeCounts.value.token }}</span
              >
              <span class="ov-type-tag p"
                >P:{{ agg.typeCounts.value.percent }}</span
              >
              <span class="ov-type-tag b"
                >B:{{ agg.typeCounts.value.balance }}</span
              >
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
                <div class="ov-ring-lg" style="width: 58px; height: 58px">
                  <TokenRing
                    :percent="agg.mainRing.value.percent"
                    :size="58"
                    :stroke="5"
                  >
                    <div class="ov-ring-lg-in">
                      <span class="ov-pct-lg">{{
                        agg.mainRing.value.source !== "none"
                          ? agg.mainRing.value.percent.toFixed(1)
                          : "—"
                      }}</span>
                      <span class="ov-pct-u-lg">{{
                        agg.mainRing.value.source !== "none" ? "%" : ""
                      }}</span>
                    </div>
                  </TokenRing>
                </div>
                <div class="ov-stats">
                  <div class="ov-st" v-if="agg.tokenAgg.value">
                    <span class="ov-stv"
                      >{{ fmtLg(agg.tokenAgg.value.used) }}/{{
                        fmtLg(agg.tokenAgg.value.total)
                      }}</span
                    ><span class="ov-stl"
                      >Token {{ agg.tokenAgg.value.percent.toFixed(0) }}%</span
                    >
                  </div>
                  <div class="ov-st" v-if="agg.percentAgg.value">
                    <span class="ov-stv warn"
                      >{{ agg.percentAgg.value.worstLabel }}
                      {{ agg.percentAgg.value.worstPercent.toFixed(0) }}%</span
                    ><span class="ov-stl">最紧张窗口</span>
                  </div>
                  <div class="ov-st" v-if="agg.balanceAgg.value">
                    <span class="ov-stv ok"
                      >{{
                        agg.balanceAgg.value.currency === "CNY"
                          ? "¥"
                          : agg.balanceAgg.value.currency
                      }}{{ agg.balanceAgg.value.totalBalance.toFixed(2) }}</span
                    ><span class="ov-stl">余额</span>
                  </div>
                </div>
                <div class="ov-foot">
                  <span class="ov-cnt">{{ enabledModels.length }}</span
                  ><span class="ov-cntl">个模型</span>
                  <span class="ov-type-sep"></span>
                  <span class="ov-type-tag t"
                    >T{{ agg.typeCounts.value.token }}</span
                  >
                  <span class="ov-type-tag p"
                    >P{{ agg.typeCounts.value.percent }}</span
                  >
                  <span class="ov-type-tag b"
                    >B{{ agg.typeCounts.value.balance }}</span
                  >
                </div>
              </div>
            </div>

            <!-- Model slides -->
            <div
              v-for="model in enabledModels"
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
                      <div class="ms-ring" style="width: 44px; height: 44px">
                        <TokenRing
                          :percent="u(model.id).percent || 0"
                          :size="44"
                          :stroke="4"
                        >
                          <div class="ms-ring-in">
                            <span class="ms-rv">{{
                              (u(model.id).percent || 0).toFixed(0)
                            }}</span>
                            <span class="ms-ru">%</span>
                          </div>
                        </TokenRing>
                      </div>
                      <div class="ms-rows">
                        <div class="ms-r">
                          <span class="ms-k">套餐</span
                          ><span class="ms-v">{{ u(model.id).planName }}</span>
                        </div>
                        <div class="ms-r">
                          <span class="ms-k">已用</span
                          ><span class="ms-v">{{
                            fmtTk(u(model.id).used)
                          }}</span>
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
                          <span class="ms-tier-lb">{{ tier.label }}</span>
                          <!-- 重置时间（右上角） -->
                          <span
                            v-if="tier.resetAt"
                            class="ms-tier-reset-inline"
                          >
                            <el-icon :size="10"><Clock /></el-icon>
                            {{ fmtReset(tier.resetAt) }}
                          </span>
                        </div>
                        <div class="ms-tier-track-row">
                          <div class="ms-bar">
                            <div
                              class="ms-bar-f"
                              :style="{
                                width: '100%',
                                background: 'var(--progress-gradient)',
                                clipPath: `inset(0 calc(100% - ${tier.percent}%) 0 0)`,
                              }"
                            ></div>
                          </div>
                          <!-- 百分比（进度条右侧） -->
                          <span class="ms-tier-pc"
                            >{{ fmtPct(tier.percent) }}%</span
                          >
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
                    <div v-if="store.fetching[model.id]" class="ms-loading">
                      <el-icon :size="14" class="spin"><Loading /></el-icon>
                      <span>加载中...</span>
                    </div>
                    <button v-else class="ms-btn" @click="fetchModel(model)">
                      获取额度
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
              @mousedown.stop
              @click="go(n - 1)"
            ></i>
          </div>
        </div>
      </template>
    </template>

    <!-- 全屏遮罩：拖拽时防止事件截断 -->
    <div ref="dragOverlayRef" class="drag-overlay"></div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, nextTick, watch } from "vue";
import { Clock, DataAnalysis } from "@element-plus/icons-vue";
import { useAppStore } from "@/stores/app";
import type { ModelConfig } from "@/stores/app";
import { formatTokens, formatPercent, getProgressColor, formatResetTime } from "@/utils/format";
import { useUsageAggregation } from "@/composables/useUsageAggregation";
import { usePopupMutex } from "@/composables/usePopupMutex";
import { useFloatState } from "@/composables/useFloatState";
import TokenRing from "@/components/TokenRing.vue";

type LayoutMode = "list" | "carousel";

const store = useAppStore();
const agg = useUsageAggregation();
const mutex = usePopupMutex({
  onShowDetail: async () => {
    if (layoutMode.value !== "list") return;
    const bounds = await window.electronAPI.getFloatWindowBounds();
    if (!bounds) return;
    window.electronAPI.showFloatDetail({
      anchorX: bounds.x,
      anchorY: bounds.y,
      anchorW: bounds.width,
      anchorH: bounds.height,
    });
  },
  onHideDetail: () => {
    window.electronAPI.hideFloatDetail();
  },
  onHideCtxMenu: () => {
    window.electronAPI.hideCtxMenu();
  },
});
const float = useFloatState();
const { isDragging, isDocked } = float;
const hasMoved = float.hasMoved;
const theme = ref("light");
const accent = ref(localStorage.getItem("accent") || "forest");
const preset = ref(localStorage.getItem("preset") || "midnight");
const layoutMode = ref<LayoutMode>(
  (localStorage.getItem("floatLayout") as LayoutMode) || "list",
);
const idx = ref(0);
const carouselRef = ref<HTMLElement | null>(null);
const floatRef = ref<HTMLElement | null>(null);
const alwaysOnTop = ref(localStorage.getItem("floatAlwaysOnTop") !== "false");
let unsubCfg: (() => void) | null = null;
let unsubDetailHover: (() => void) | null = null;
let unsubCtxAction: (() => void) | null = null;
let unsubNativeCtx: (() => void) | null = null;
let unsubCtxClosed: (() => void) | null = null;
let unsubEdgeDock: (() => void) | null = null;
let unsubThemeChanged: (() => void) | null = null;

// ── Timer 集中管理 ──
const timers = {
  showDetail: null as ReturnType<typeof setTimeout> | null,
  hideDetail: null as ReturnType<typeof setTimeout> | null,
  resize: null as ReturnType<typeof setTimeout> | null,
  readySafety: null as ReturnType<typeof setTimeout> | null,
};

function clearAllTimers() {
  for (const key of Object.keys(timers) as (keyof typeof timers)[]) {
    if (timers[key]) {
      clearTimeout(timers[key]!);
      timers[key] = null;
    }
  }
}

// ── 详情窗口 hover 控制 ──
const isDetailHovered = ref(false);
const SHOW_DELAY = 350; // 悬停 350ms 后弹出详情
const HIDE_DELAY = 300; // 离开 300ms 后关闭详情

async function hideDetailWindow() {
  window.electronAPI.hideFloatDetail();
}

function onFloatEnter() {
  // 拖拽进行中时，不触发任何详情窗口逻辑
  if (isDragging.value) return;

  // 贴边状态：hover 弹出时立即取消贴边条显示
  if (isDocked.value) {
    float.undock();
  }
  if (layoutMode.value !== "list") return;
  if (timers.hideDetail) {
    clearTimeout(timers.hideDetail);
    timers.hideDetail = null;
  }
  if (timers.showDetail) return;
  timers.showDetail = setTimeout(() => {
    timers.showDetail = null;
    if (isDragging.value) return;
    // 互斥：如果右键菜单正打开，先关闭
    mutex.showDetail();
  }, SHOW_DELAY);
}

function onFloatLeave() {
  if (layoutMode.value !== "list" || isDragging.value) return;
  if (timers.showDetail) {
    clearTimeout(timers.showDetail);
    timers.showDetail = null;
  }
  if (timers.hideDetail) return;
  timers.hideDetail = setTimeout(() => {
    timers.hideDetail = null;
    // 如果详情窗口正在被 hover，不关闭
    if (!isDetailHovered.value) {
      hideDetailWindow();
    }
  }, HIDE_DELAY);
}

// Context menu state
const ctxMenuOpen = ref(false);
const ctxModel = ref<ModelConfig | null>(null);

// Computed
const enabledModels = computed(() => store.models.filter((m) => m.enabled));
const slideCount = computed(() => 1 + enabledModels.value.length);

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

// Resize — now only used for carousel mode
const FLOAT_WIDTH = 260;
const FLOAT_LIST_HEIGHT = 88;
const FLOAT_CAROUSEL_HEIGHT = 220;

// 标记是否需要在 resize 完成后发送 ready 信号
let shouldSendReadyAfterResize = false;

function resizeToFit() {
  // 取消上一次尚未执行的 resize，避免竞态
  if (timers.resize) {
    clearTimeout(timers.resize);
    timers.resize = null;
  }
  // 使用 setTimeout 而非 nextTick，等待浏览器完成布局绘制后再 resize
  // nextTick 可能在 v-if 分支切换的 DOM 更新完成前触发
  const mode = layoutMode.value;
  const targetH =
    mode === "carousel" ? FLOAT_CAROUSEL_HEIGHT : FLOAT_LIST_HEIGHT;
  window.electronAPI.debugLog(
    `resizeToFit: mode=${mode}, target=${FLOAT_WIDTH}x${targetH}`,
  );
  timers.resize = setTimeout(() => {
    timers.resize = null;
    window.electronAPI.debugLog(
      `resizeToFit: executing ${FLOAT_WIDTH}x${targetH}, shouldSendReady=${shouldSendReadyAfterResize}`,
    );
    window.electronAPI.resizeFloatWindow(FLOAT_WIDTH, targetH);
    // resize 完成后，如果需要发送 ready 信号则发送
    if (shouldSendReadyAfterResize) {
      shouldSendReadyAfterResize = false;
      // 清除安全定时器
      if (timers.readySafety) {
        clearTimeout(timers.readySafety);
        timers.readySafety = null;
      }
      window.electronAPI.debugLog(
        "[FloatWindow] resizeToFit: sending floatReady after resize",
      );
      // 使用 setTimeout 而不是 requestAnimationFrame，确保在窗口不可见时也能执行
      setTimeout(() => {
        window.electronAPI.floatReady();
      }, 0);
    }
  }, 50);
}

// Menu
async function showMenu(e: MouseEvent) {
  // 拖拽后不弹菜单，或拖拽状态残留时清理
  if (isDragging.value) {
    float.endDrag();
    cleanupDragListeners();
  }
  if (hasMoved.value) return;

  // 详情窗口与右键菜单互斥：打开菜单时取消详情定时器，互斥由 mutex 统一管理
  if (timers.showDetail) {
    clearTimeout(timers.showDetail);
    timers.showDetail = null;
  }
  if (timers.hideDetail) {
    clearTimeout(timers.hideDetail);
    timers.hideDetail = null;
  }
  mutex.showCtxMenu();

  // Walk up from target to find a model card
  let el = e.target as HTMLElement | null;
  ctxModel.value = null;
  while (el && el !== e.currentTarget) {
    const mid = el.dataset?.modelId;
    if (mid && mid !== "__overview__") {
      ctxModel.value = store.models.find((m) => m.id === mid) || null;
      break;
    }
    el = el.parentElement;
  }

  // 标记菜单已打开（由 ctx-menu-closed 事件重置）
  ctxMenuOpen.value = true;

  // 主进程统一管理菜单生命周期（复用窗口，show/hide）
  // e.screenX/Y 与 setPosition 使用相同的 DPI 感知坐标系，无需 DPR 转换
  window.electronAPI.showCtxMenu({
    screenX: Math.round(e.screenX),
    screenY: Math.round(e.screenY),
    modelId: ctxModel.value?.id ?? null,
    modelName: ctxModel.value?.name ?? null,
    theme: theme.value,
    preset: preset.value,
    layoutMode: layoutMode.value,
    alwaysOnTop: alwaysOnTop.value,
  });
}

function handleCtxMenuAction(action: string) {
  // 重置菜单状态，确保下次右键能正常弹出
  ctxMenuOpen.value = false;

  switch (action) {
    case "fetch-model":
      if (ctxModel.value) fetchModel(ctxModel.value);
      break;
    case "refresh-all":
      store.requestRefreshAll();
      break;
    case "set-layout:list":
      layoutMode.value = "list";
      localStorage.setItem("floatLayout", "list");
      mutex.hideDetail();
      nextTick(() => resizeToFit());
      break;
    case "set-layout:carousel":
      layoutMode.value = "carousel";
      localStorage.setItem("floatLayout", "carousel");
      mutex.hideDetail();
      nextTick(() => {
        idx.value = 0;
        go(0);
        updateActiveSlide();
        resizeToFit();
      });
      break;
    case "toggle-top":
      alwaysOnTop.value = !alwaysOnTop.value;
      localStorage.setItem("floatAlwaysOnTop", String(alwaysOnTop.value));
      window.electronAPI.setFloatAlwaysOnTop(alwaysOnTop.value);
      break;
    case "close-float":
      window.electronAPI.closeFloatWindow();
      break;
  }
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

// Drag to swipe (carousel)
let dragStartX = 0;
let dragScrollLeft = 0;
let dragging = false;

function onDragStart(e: MouseEvent) {
  const el = carouselRef.value;
  if (!el) return;
  e.stopPropagation();
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

function onDragEnd(_e: MouseEvent) {
  if (!dragging) return;
  dragging = false;
  const el = carouselRef.value;
  if (!el) return;
  el.style.scrollSnapType = "";
  el.style.cursor = "";
  // Snap to nearest slide — use clientWidth of container (each slide is 100% width)
  const target = Math.round(el.scrollLeft / el.clientWidth);
  go(Math.max(0, Math.min(slideCount.value - 1, target)));
}

// Window drag (IPC-based, replaces -webkit-app-region: drag)
let windowDragStartX = 0;
let windowDragStartY = 0;
const DRAG_THRESHOLD = 3;

function onWindowDragStart(e: MouseEvent) {
  // 贴边拖拽开始时立即取消贴边条
  if (isDocked.value) {
    float.undock();
  }
  // 忽略右键（右键菜单单独处理）
  if (e.button !== 0) return;

  // 菜单打开时点击浮窗其他区域 → 关闭菜单
  if (ctxMenuOpen.value) {
    ctxMenuOpen.value = false;
    window.electronAPI.hideCtxMenu();
    return;
  }

  windowDragStartX = e.screenX;
  windowDragStartY = e.screenY;
  float.startDrag(e.screenX, e.screenY);

  // 显示全屏遮罩，防止事件被其他元素截断
  showDragOverlay();

  // 使用 document 级别事件，防止快速拖拽时鼠标移出窗口导致中断
  document.addEventListener("mousemove", onDocMouseMove, true);
  document.addEventListener("mouseup", onDocMouseUp, true);
  // 额外添加 window 级别事件，作为兜底
  window.addEventListener("mouseup", onWindowMouseUp, true);
}

function onDocMouseMove(e: MouseEvent) {
  if (!isDragging.value) return;

  // 检测鼠标左键是否释放（buttons bit 0 为 0 表示左键已释放）
  if ((e.buttons & 1) === 0) {
    console.log("[FloatWindow] Left button released detected in mousemove");
    stopDrag();
    return;
  }

  const dx = e.screenX - windowDragStartX;
  const dy = e.screenY - windowDragStartY;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  // 超过阈值后启动拖拽（只调用一次，主进程会持续跟踪鼠标）
  if (!hasMoved.value && (absDx > DRAG_THRESHOLD || absDy > DRAG_THRESHOLD)) {
    float.markDragMoved();
    // 拖拽开始时关闭详情窗口
    hideDetailWindow();
    // 启动主进程拖拽（只需调用一次，主进程会持续跟踪鼠标）
    window.electronAPI.startWindowDrag({
      mouseX: windowDragStartX,
      mouseY: windowDragStartY,
    });
  }
}

function onDocMouseUp(e: MouseEvent) {
  // 只处理左键释放
  if (e.button !== 0) return;

  console.log("[FloatWindow] mouseup detected (document), stopping drag");
  stopDrag();
}

function onWindowMouseUp(e: MouseEvent) {
  // 只处理左键释放（兜底）
  if (e.button !== 0) return;

  console.log("[FloatWindow] mouseup detected (window), stopping drag");
  stopDrag();
}

function stopDrag() {
  // 防止重复调用
  if (!isDragging.value) return;

  console.log("[FloatWindow] stopDrag called");

  // 立即清理所有事件监听器和定时器
  cleanupDragListeners();

  // 结束拖拽状态，返回是否确实移动过
  const hadMoved = float.endDrag();

  // 总是调用 stopWindowDrag，确保主进程清理定时器
  if (hadMoved) {
    console.log("[FloatWindow] Calling stopWindowDrag");
    window.electronAPI.stopWindowDrag();
  }
}

function cleanupDragListeners() {
  document.removeEventListener("mousemove", onDocMouseMove, true);
  document.removeEventListener("mouseup", onDocMouseUp, true);
  window.removeEventListener("mouseup", onWindowMouseUp, true);
  // 隐藏遮罩
  hideDragOverlay();
}

function onWindowDragEnd() {
  cleanupDragListeners();
  if (!isDragging.value) return;
  const hadMoved = float.endDrag();
  if (hadMoved) {
    window.electronAPI.stopWindowDrag();
  }
}

// 全屏遮罩，防止拖拽时事件被其他元素截断
const dragOverlayRef = ref<HTMLElement | null>(null);

function showDragOverlay() {
  if (dragOverlayRef.value) {
    dragOverlayRef.value.style.display = "block";
  }
}

function hideDragOverlay() {
  if (dragOverlayRef.value) {
    dragOverlayRef.value.style.display = "none";
  }
}

function onDoubleClick(e: MouseEvent) {
  // 只响应左键双击，且不是拖拽状态
  if (e.button !== 0 || hasMoved.value) return;

  console.log("[FloatWindow] 双击打开主窗口");
  window.electronAPI.showMainWindow();
}

// Fetch
async function fetchModel(m: ModelConfig) {
  await store.requestRefresh(m.id);
}

// Lifecycle
onMounted(async () => {
  // 先从主进程拉取当前主题（单一真相源），回退到 localStorage
  try {
    const t = await window.electronAPI.getTheme();
    if (t) {
      theme.value = t.mode;
      accent.value = t.accent;
      preset.value = t.preset;
    }
  } catch {
    const s = localStorage.getItem("theme");
    if (s) theme.value = s;
    const savedPreset = localStorage.getItem("preset");
    if (savedPreset) preset.value = savedPreset;
  }
  // 标记需要在 resize 完成后发送 ready 信号
  shouldSendReadyAfterResize = true;
  window.electronAPI.debugLog(
    "[FloatWindow] onMounted: start, shouldSendReady=true",
  );

  // 安全超时：确保即使 resize 流程出问题，ready 信号也会在 300ms 后发送
  timers.readySafety = setTimeout(() => {
    if (shouldSendReadyAfterResize) {
      shouldSendReadyAfterResize = false;
      window.electronAPI.debugLog(
        "[FloatWindow] safety timer: sending floatReady",
      );
      window.electronAPI.floatReady();
    }
  }, 300);

  try {
    await store.loadConfig();
    resizeToFit();
    window.electronAPI.debugLog(
      "[FloatWindow] onMounted: resizeToFit called, timers.resize=" +
        !!timers.resize,
    );
  } catch {
    // loadConfig 失败时，直接发送 ready
    shouldSendReadyAfterResize = false;
    clearTimeout(timers.readySafety);
    window.electronAPI.debugLog(
      "[FloatWindow] onMounted: loadConfig failed, sending ready directly",
    );
    setTimeout(() => {
      window.electronAPI.floatReady();
    }, 0);
  }
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
  // 监听详情窗口 hover 状态，避免鼠标桥接时误关闭
  unsubDetailHover = window.electronAPI.onDetailHoverChanged((state) => {
    isDetailHovered.value = state === "enter";
    if (state === "enter") {
      // 详情窗口被 hover，取消关闭计时器
      if (timers.hideDetail) {
        clearTimeout(timers.hideDetail);
        timers.hideDetail = null;
      }
    } else {
      // 详情窗口失去 hover，开始延迟关闭
      onFloatLeave();
    }
  });
  // 监听菜单动作执行
  unsubCtxAction = window.electronAPI.onExecuteCtxMenuAction(
    (action: string) => {
      handleCtxMenuAction(action);
    },
  );
  // 监听原生 context-menu 事件（窗口未聚焦时的兜底，修复 Issue #1）
  unsubNativeCtx = window.electronAPI.onNativeContextMenu(
    (pos: { x: number; y: number }) => {
      // 详情窗口与右键菜单互斥
      if (timers.showDetail) {
        clearTimeout(timers.showDetail);
        timers.showDetail = null;
      }
      if (timers.hideDetail) {
        clearTimeout(timers.hideDetail);
        timers.hideDetail = null;
      }
      mutex.showCtxMenu();
      // DOM 事件已处理过则跳过
      if (ctxMenuOpen.value) return;
      ctxMenuOpen.value = true;
      // params.x/y 是窗口相对坐标，加上窗口屏幕位置转为绝对坐标
      window.electronAPI.showCtxMenu({
        screenX: Math.round(window.screenX + pos.x),
        screenY: Math.round(window.screenY + pos.y),
        modelId: null,
        modelName: null,
        theme: theme.value,
        preset: preset.value,
        layoutMode: layoutMode.value,
        alwaysOnTop: alwaysOnTop.value,
      });
    },
  );
  // 监听右键菜单关闭，重置状态
  unsubCtxClosed = window.electronAPI.onCtxMenuClosed(() => {
    ctxMenuOpen.value = false;
  });
  // 初始化贴边状态
  const s2 = await window.electronAPI.getEdgeDockState();
  if (s2?.isDocked && s2.edge) {
    float.dock(s2.edge);
  }
  unsubEdgeDock = window.electronAPI.onEdgeDockChanged((s) => {
    if (s.isDocked && s.edge) {
      float.dock(s.edge as "left" | "right" | "top");
    } else {
      float.undock();
    }
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
  // 如果 resize 已经完成（timer 为 null），直接发送 ready
  if (shouldSendReadyAfterResize && !timers.resize) {
    shouldSendReadyAfterResize = false;
    // 清除安全定时器
    if (timers.readySafety) {
      clearTimeout(timers.readySafety);
      timers.readySafety = null;
    }
    window.electronAPI.debugLog(
      "[FloatWindow] onMounted end: timers.resize is null, sending ready directly",
    );
    // 使用 setTimeout 而不是 requestAnimationFrame
    setTimeout(() => {
      window.electronAPI.floatReady();
    }, 0);
  } else {
    window.electronAPI.debugLog(
      "[FloatWindow] onMounted end: waiting for resize, timers.resize=" +
        !!timers.resize,
    );
  }
});
onUnmounted(() => {
  // 关闭详情窗口
  hideDetailWindow();
  store.stopSubscription();
  unsubCfg?.();
  unsubDetailHover?.();
  unsubCtxAction?.();
  unsubNativeCtx?.();
  unsubCtxClosed?.();
  unsubEdgeDock?.();
  unsubThemeChanged?.();
  cleanupDragListeners();
  // 统一清理所有定时器
  clearAllTimers();
  shouldSendReadyAfterResize = false;
});

// Re-resize when layout mode or model count changes
watch(layoutMode, (newVal) => {
  window.electronAPI.debugLog(`watch(layoutMode): changed to ${newVal}`);
  resizeToFit();
  if (layoutMode.value === "carousel") nextTick(updateActiveSlide);
});
watch(
  () => enabledModels.value.length,
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
    linear-gradient(180deg, rgba(107, 158, 122, 0.04) 0%, transparent 30%),
    var(--bg-primary);
  overflow: hidden;
  user-select: none;
  display: flex;
  flex-direction: column;
  /* 顶部边缘微光 */
  box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.04);
  position: relative;
}

/* 全屏遮罩：拖拽时防止事件截断 */
.drag-overlay {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 99999;
  cursor: grabbing;
  background: transparent;
}

.float-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 11px;
  color: var(--text-placeholder);
}

.empty-icon-wrap {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--glass-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-light);
}

.empty-float {
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

/* ═══ Compact list (overview only) ═══ */
.compact-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 6px;
}
.compact-card {
  width: 100%;
  padding: 3px 0;
}
.ov-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ov-ring {
  flex-shrink: 0;
  position: relative;
}
.ov-ring-inner {
  position: absolute;
  inset: 0;
  margin: auto;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--bg-primary);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.ov-pct {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1;
}
.ov-pct-u {
  font-size: 9px;
  color: var(--text-secondary);
  font-weight: 600;
}

/* ── 进度环容器 ── */

.ov-nums {
  flex: 1;
  display: flex;
  gap: 4px;
}
.ov-n {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  flex: 1 1 auto;
  background: var(--glass-bg);
  border-radius: 6px;
  padding: 4px 6px;
  min-width: 48px;
}
.ov-nv {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.ov-nv.warn {
  color: var(--warning);
}
.ov-nv.ok {
  color: var(--success);
}
.ov-nl {
  font-size: 9px;
  color: var(--text-secondary);
  white-space: nowrap;
}

/* ── type distribution row ── */
.ov-types {
  display: flex;
  justify-content: center;
  gap: 6px;
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px solid var(--border-light);
}

.ov-type-tag {
  font-size: 9px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 3px;
}

.ov-type-tag.t {
  color: var(--neon-amber);
  background: rgba(212, 168, 85, 0.12);
}
.ov-type-tag.p {
  color: var(--neon-red);
  background: rgba(212, 119, 106, 0.12);
}
.ov-type-tag.b {
  color: var(--neon-green);
  background: rgba(124, 196, 138, 0.12);
}

.ov-type-sep {
  width: 1px;
  height: 10px;
  background: var(--border-light);
  margin: 0 4px;
}

/* ═══ Carousel ═══ */
.carousel-wrap {
  flex: 1;
  overflow: hidden;
  position: relative;
  perspective: 900px;
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
    transform 0.35s var(--ease-spring),
    opacity 0.3s var(--ease-smooth);
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
  padding: 8px 10px 24px;
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
  gap: 8px;
}
.ov-ring-lg {
  flex-shrink: 0;
  position: relative;
}
.ov-ring-lg-in {
  position: absolute;
  inset: 0;
  margin: auto;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--bg-primary);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.ov-pct-lg {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1;
}
.ov-pct-u-lg {
  font-size: 10px;
  color: var(--text-secondary);
  font-weight: 600;
}
.ov-stats {
  display: flex;
  gap: 6px;
  width: 100%;
  padding: 0 4px;
}
.ov-st {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  flex: 1 1 auto;
  background: var(--glass-bg);
  border-radius: 8px;
  padding: 6px 8px;
  min-width: 56px;
}
.ov-stv {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.ov-stv.warn {
  color: var(--warning);
}
.ov-stv.ok {
  color: var(--success);
}
.ov-stl {
  font-size: 9px;
  color: var(--text-secondary);
  white-space: nowrap;
}
.ov-foot {
  display: flex;
  align-items: baseline;
  gap: 3px;
}
.ov-cnt {
  font-size: 16px;
  font-weight: 700;
  color: var(--accent);
}
.ov-cntl {
  font-size: 11px;
  color: var(--text-secondary);
}

/* model slide */
.model-slide {
  gap: 6px;
}
.ms-hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}
.ms-name {
  font-size: 13px;
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
  background: rgba(107, 158, 122, 0.12);
  color: var(--provider-openai);
}
.ms-badge.claude {
  background: rgba(196, 168, 130, 0.12);
  color: var(--provider-claude);
}
.ms-badge.deepseek {
  background: rgba(124, 196, 138, 0.12);
  color: var(--provider-deepseek);
}
.ms-badge.kimi {
  background: rgba(184, 160, 136, 0.12);
  color: var(--provider-kimi);
}
.ms-badge.mimo {
  background: rgba(212, 168, 85, 0.12);
  color: var(--provider-mimo);
}
.ms-badge.opencode {
  background: rgba(139, 92, 246, 0.12);
  color: #8b5cf6;
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
  position: relative;
}
.ms-ring-in {
  position: absolute;
  inset: 0;
  margin: auto;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--bg-primary);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.ms-rv {
  font-size: 13px;
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
  align-items: center;
  margin-bottom: 2px;
}
.ms-tier-lb {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
}
.ms-tier-reset-inline {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 9px;
  color: var(--text-placeholder);
  white-space: nowrap;
}
.ms-tier-track-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ms-bar {
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: var(--border-light);
  overflow: hidden;
}
.ms-bar-f {
  height: 100%;
  border-radius: 2px;
  transition: clip-path 0.8s var(--ease-spring);
}
.ms-tier-pc {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  min-width: 40px;
  text-align: right;
}

.ms-bal {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 4px;
}
.ms-bal-c {
  font-size: 14px;
  font-weight: 300;
  color: var(--text-secondary);
}
.ms-bal-v {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.ms-btn {
  align-self: center;
  padding: 5px 16px;
  border-radius: 6px;
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  color: var(--text-primary);
  font-size: 12px;
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

.ms-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 11px;
  color: var(--text-secondary);
  padding: 8px 0;
}

.spin {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* dots — fixed at bottom of carousel */
.dots {
  position: absolute;
  bottom: 4px;
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
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  min-height: 14px;
  cursor: pointer;
}
.dot::before {
  content: "";
  display: block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-secondary);
  opacity: 0.3;
  transition: all 0.2s;
}
.dot.on::before {
  width: 16px;
  border-radius: 3px;
  background: var(--accent);
  opacity: 1;
}
</style>
