/**
 * 统一空状态组件（N1.4）：icon + 标题 + 描述 + 可选主操作。
 * 各页面（待办/时间轴/待办集/倒数日）共用，替代散落的内联灰字 div；
 * 可选 petState 联动桌宠气泡（N1.2，60s 节流防刷屏）。
 */
import { useEffect } from 'react'
import { PET_STATE_TIPS, type PetState } from '../../../../shared/types'
import { showBubble } from '../../services/ipc'

/** 桌宠气泡节流：同一状态 60s 内只提示一次（页面来回切换不重复打扰） */
const lastPetTip = new Map<PetState, number>()
const PET_TIP_THROTTLE_MS = 60_000

interface EmptyStateProps {
  icon: string
  title: string
  desc?: string
  /** 主操作（如「新建任务」）；缺省不渲染按钮 */
  action?: { label: string; onClick: () => void }
  /** 联动桌宠状态：空状态挂载时让桌宠冒泡对应文案 */
  petState?: PetState
}

export function EmptyState({ icon, title, desc, action, petState }: EmptyStateProps) {
  useEffect(() => {
    if (!petState) return
    const now = Date.now()
    const last = lastPetTip.get(petState) ?? 0
    if (now - last < PET_TIP_THROTTLE_MS) return
    lastPetTip.set(petState, now)
    void showBubble(PET_STATE_TIPS[petState])
  }, [petState])

  return (
    <div className="empty-state empty-state-anim">
      <div className="empty-state-icon">{icon}</div>
      <div className="empty-state-title">{title}</div>
      {desc && <div className="empty-state-desc">{desc}</div>}
      {action && (
        <button className="primary-btn empty-state-action" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  )
}
