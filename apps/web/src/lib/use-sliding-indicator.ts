import { useLayoutEffect, useRef, useState } from "react"

interface IndicatorStyle {
  left: number
  width: number
}

/**
 * Позиция/ширина активного элемента (aria-pressed="true") внутри контейнера — чтобы под
 * текущим выбором в toggle group можно было отрисовать подложку, которая плавно "переезжает"
 * между кнопками (CSS-transition по left/width), а не мгновенно появляется/исчезает на каждой
 * кнопке по отдельности. Не трогает сам ToggleGroup — просто измеряет DOM снаружи.
 *
 * aria-pressed, а не data-state="on": в @base-ui/react Toggle не проставляет data-state
 * вообще (в отличие от Radix) — состояние отражено только через aria-pressed.
 */
export function useSlidingIndicator(activeKey: string) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<IndicatorStyle | null>(null)

  useLayoutEffect(() => {
    const container = containerRef.current
    const active = container?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (!container || !active) return

    const update = () => {
      const containerRect = container.getBoundingClientRect()
      const activeRect = active.getBoundingClientRect()
      setStyle({ left: activeRect.left - containerRect.left, width: activeRect.width })
    }

    update()

    // На случай переноса строки/изменения ширины кнопок (например, при повороте экрана
    // на мобильном) — подложка не должна "отстать" от реальной позиции активной кнопки.
    const resizeObserver = new ResizeObserver(update)
    resizeObserver.observe(container)
    return () => resizeObserver.disconnect()
  }, [activeKey])

  return { containerRef, style }
}
