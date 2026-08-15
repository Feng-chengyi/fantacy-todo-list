/**
 * 桌宠气泡：显示主窗口转发来的提醒文本，数秒后自动消失。
 * 可点击唤回主窗口；自带鼠标穿透开关（默认穿透，悬停时捕获）。
 */
export function Bubble({ text }: { text: string }) {
  if (!text) return null
  return (
    <div
      className="pet-bubble"
      onClick={() => void window.petApi.focusMain()}
      onMouseEnter={() => void window.petApi.setIgnoreMouse(false)}
      onMouseLeave={() => void window.petApi.setIgnoreMouse(true)}
    >
      {text}
    </div>
  )
}
