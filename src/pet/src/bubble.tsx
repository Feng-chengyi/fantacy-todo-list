/**
 * 桌宠气泡：显示主窗口转发来的提醒文本，数秒后自动消失。
 * 可点击唤回主窗口；自带鼠标穿透开关（默认穿透，悬停时捕获）。
 * 定位由 PetApp 以屏幕感知偏移计算并通过 style 注入（适配动态窗口尺寸）。
 */
import type { CSSProperties, Ref } from 'react'

interface Props {
  text: string
  style?: CSSProperties
  rootRef?: Ref<HTMLDivElement>
}

export function Bubble({ text, style, rootRef }: Props) {
  if (!text) return null
  return (
    <div
      ref={rootRef}
      className="pet-bubble"
      style={style}
      onClick={() => void window.petApi.focusMain()}
      onMouseEnter={() => void window.petApi.setIgnoreMouse(false)}
      onMouseLeave={() => void window.petApi.setIgnoreMouse(true)}
    >
      {text}
    </div>
  )
}
