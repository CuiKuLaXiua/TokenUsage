import { ref, computed } from "vue";

export type FloatPhase =
  | "idle"
  | "dragging"
  | "docked"
  | "revealing"
  | "hiding";

export interface DraggingState {
  phase: "dragging";
  startX: number;
  startY: number;
  hasMoved: boolean;
}

export interface DockedState {
  phase: "docked";
  edge: "left" | "right" | "top";
}

export type FloatState =
  | { phase: "idle" }
  | DraggingState
  | DockedState
  | { phase: "revealing" }
  | { phase: "hiding" };

export function useFloatState() {
  const state = ref<FloatState>({ phase: "idle" });

  const isDragging = computed(() => state.value.phase === "dragging");
  const isDocked = computed(() => state.value.phase === "docked");
  const hasMoved = computed(() =>
    state.value.phase === "dragging" ? state.value.hasMoved : false,
  );

  function transition(to: FloatState): void {
    state.value = to;
  }

  function startDrag(startX: number, startY: number): void {
    state.value = { phase: "dragging", startX, startY, hasMoved: false };
  }

  function markDragMoved(): void {
    if (state.value.phase === "dragging") {
      state.value = { ...state.value, hasMoved: true };
    }
  }

  function endDrag(): boolean {
    const hadMoved =
      state.value.phase === "dragging" && state.value.hasMoved;
    state.value = { phase: "idle" };
    return hadMoved;
  }

  function dock(edge: "left" | "right" | "top"): void {
    state.value = { phase: "docked", edge };
  }

  function undock(): void {
    if (state.value.phase === "docked") {
      state.value = { phase: "idle" };
    }
  }

  function reveal(): void {
    if (state.value.phase === "docked") {
      state.value = { phase: "revealing" };
    }
  }

  function finishReveal(): void {
    if (state.value.phase === "revealing") {
      state.value = { phase: "idle" };
    }
  }

  function hide(): void {
    if (state.value.phase === "idle") {
      state.value = { phase: "hiding" };
    }
  }

  function finishHide(edge?: "left" | "right" | "top"): void {
    if (state.value.phase === "hiding" && edge) {
      state.value = { phase: "docked", edge };
    }
  }

  return {
    state,
    isDragging,
    isDocked,
    hasMoved,
    transition,
    startDrag,
    markDragMoved,
    endDrag,
    dock,
    undock,
    reveal,
    finishReveal,
    hide,
    finishHide,
  };
}
