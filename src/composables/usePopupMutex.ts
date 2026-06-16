import { ref } from "vue";

export type PopupType = "detail" | "ctxMenu" | null;

export interface PopupMutexOptions {
  onShowDetail?: () => void | Promise<void>;
  onHideDetail?: () => void | Promise<void>;
  onShowCtxMenu?: () => void | Promise<void>;
  onHideCtxMenu?: () => void | Promise<void>;
  onHideAll?: () => void | Promise<void>;
}

export function usePopupMutex(options: PopupMutexOptions = {}) {
  const current = ref<PopupType>(null);

  async function showDetail(): Promise<void> {
    if (current.value === "ctxMenu") {
      await options.onHideCtxMenu?.();
    }
    current.value = "detail";
    await options.onShowDetail?.();
  }

  async function hideDetail(): Promise<void> {
    if (current.value === "detail") {
      current.value = null;
      await options.onHideDetail?.();
    }
  }

  async function showCtxMenu(): Promise<void> {
    if (current.value === "detail") {
      await options.onHideDetail?.();
    }
    current.value = "ctxMenu";
    await options.onShowCtxMenu?.();
  }

  async function hideCtxMenu(): Promise<void> {
    if (current.value === "ctxMenu") {
      current.value = null;
      await options.onHideCtxMenu?.();
    }
  }

  async function hideAll(): Promise<void> {
    const prev = current.value;
    current.value = null;
    if (prev === "detail") {
      await options.onHideDetail?.();
    } else if (prev === "ctxMenu") {
      await options.onHideCtxMenu?.();
    }
    await options.onHideAll?.();
  }

  return {
    current,
    showDetail,
    hideDetail,
    showCtxMenu,
    hideCtxMenu,
    hideAll,
  };
}
