import { ref, computed, onMounted, onUnmounted, type VNodeRef } from 'vue'

export interface UseMenuKeyboardNavigationOptions {
  /** 关闭菜单的回调 */
  onClose: () => void
  /** 执行菜单项的回调 */
  onActivate: (index: number) => void
}

/**
 * 自定义弹出菜单的键盘导航与可访问性封装。
 *
 * 提供：
 * - 菜单项焦点管理（↑/↓/Home/End）
 - Enter/Space 激活
 * - Esc 关闭
 * - 焦点项自动滚动到可视区域
 */
export function useMenuKeyboardNavigation(options: UseMenuKeyboardNavigationOptions) {
  const activeIndex = ref(-1)
  const itemRefs = ref<HTMLElement[]>([])

  const registerItem: VNodeRef = (el) => {
    if (el instanceof HTMLElement) {
      itemRefs.value.push(el)
    }
  }

  const clearItems = () => {
    itemRefs.value = []
  }

  const itemCount = computed(() => itemRefs.value.length)

  function focusItem(index: number) {
    if (index < 0 || index >= itemCount.value) return
    activeIndex.value = index
    const el = itemRefs.value[index]
    if (el) {
      el.focus()
      el.scrollIntoView({ block: 'nearest' })
    }
  }

  function focusFirst() {
    focusItem(0)
  }

  function focusLast() {
    focusItem(itemCount.value - 1)
  }

  function focusNext() {
    if (itemCount.value === 0) return
    const next = activeIndex.value < itemCount.value - 1 ? activeIndex.value + 1 : 0
    focusItem(next)
  }

  function focusPrev() {
    if (itemCount.value === 0) return
    const prev = activeIndex.value > 0 ? activeIndex.value - 1 : itemCount.value - 1
    focusItem(prev)
  }

  function activateCurrent() {
    if (activeIndex.value >= 0 && activeIndex.value < itemCount.value) {
      options.onActivate(activeIndex.value)
    }
  }

  function onKeydown(e: KeyboardEvent) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        focusNext()
        break
      case 'ArrowUp':
        e.preventDefault()
        focusPrev()
        break
      case 'Home':
        e.preventDefault()
        focusFirst()
        break
      case 'End':
        e.preventDefault()
        focusLast()
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        activateCurrent()
        break
      case 'Escape':
        e.preventDefault()
        options.onClose()
        break
    }
  }

  onMounted(() => {
    document.addEventListener('keydown', onKeydown)
    // 菜单显示后自动聚焦到第一个可交互项
    if (itemCount.value > 0) {
      focusFirst()
    }
  })

  onUnmounted(() => {
    document.removeEventListener('keydown', onKeydown)
  })

  return {
    activeIndex,
    registerItem,
    clearItems,
    focusItem,
    focusFirst,
    focusLast,
    focusNext,
    focusPrev,
    itemCount,
  }
}
