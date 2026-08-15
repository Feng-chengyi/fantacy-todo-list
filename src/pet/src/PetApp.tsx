/**
 * 桌宠窗口根组件：整合 Live2D 渲染、点击/拖拽/滚轮/右键菜单、鼠标穿透、气泡。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, WheelEvent as ReactWheelEvent } from 'react'
import type { Live2DModel } from 'pixi-live2d-display'
import type { PomodoroState } from '../../shared/types'
import { Live2DStage } from './Live2DStage'
import { Bubble } from './bubble'
import { PomodoroBadge } from './PomodoroBadge'
import { DRAG_THRESHOLD, clampScale, pickMotionGroup } from './pet-events'

interface MenuState {
  x: number
  y: number
}

interface DragState {
  down: boolean
  moved: boolean
  lastX: number
  lastY: number
}

export function PetApp() {
  const modelRef = useRef<Live2DModel | null>(null)
  const baseScaleRef = useRef(1)
  const scaleRef = useRef(1)
  const dragRef = useRef<DragState>({ down: false, moved: false, lastX: 0, lastY: 0 })
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [bubble, setBubble] = useState<string | null>(null)
  const [pomodoro, setPomodoro] = useState<PomodoroState | null>(null)

  const onModelReady = useCallback((model: Live2DModel, baseScale: number) => {
    modelRef.current = model
    baseScaleRef.current = baseScale
    model.scale.set(baseScale * scaleRef.current)
  }, [])

  // 初始化：读配置应用缩放、监听气泡、默认鼠标穿透
  useEffect(() => {
    void window.petApi.getConfig().then((cfg) => {
      scaleRef.current = clampScale(cfg.petScale)
      const model = modelRef.current
      if (model) model.scale.set(baseScaleRef.current * scaleRef.current)
    })
    const offBubble = window.petApi.onBubble((text) => {
      setBubble(text)
      window.setTimeout(() => setBubble(null), 4000)
    })
    void window.petApi.setIgnoreMouse(true)
    return () => offBubble()
  }, [])

  // 订阅番茄钟陪伴状态（徽标常驻，区别于气泡）
  useEffect(() => {
    const offPomodoro = window.petApi.onPomodoro((state) => setPomodoro(state))
    return () => offPomodoro()
  }, [])

  // 点击随机动作
  const playRandom = useCallback(() => {
    const model = modelRef.current
    if (model) void model.motion(pickMotionGroup())
  }, [])

  // window 级 mousemove/mouseup：拖拽移窗（拖出热区仍可继续）
  useEffect(() => {
    const onMove = (e: MouseEvent): void => {
      const d = dragRef.current
      if (!d.down) return
      const dx = e.screenX - d.lastX
      const dy = e.screenY - d.lastY
      if (!d.moved && Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD) d.moved = true
      if (d.moved) {
        d.lastX = e.screenX
        d.lastY = e.screenY
        void window.petApi.moveWindow(dx, dy)
      }
    }
    const onUp = (): void => {
      const d = dragRef.current
      if (d.down && !d.moved) playRandom()
      d.down = false
      d.moved = false
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [playRandom])

  const onMouseDown = (e: ReactMouseEvent): void => {
    if (e.button !== 0) return
    dragRef.current = { down: true, moved: false, lastX: e.screenX, lastY: e.screenY }
  }

  const onWheel = (e: ReactWheelEvent): void => {
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    scaleRef.current = clampScale(scaleRef.current + delta)
    const model = modelRef.current
    if (model) model.scale.set(baseScaleRef.current * scaleRef.current)
    void window.petApi.setConfig({ petScale: scaleRef.current })
  }

  const onContextMenu = (e: ReactMouseEvent): void => {
    e.preventDefault()
    setMenu({ x: e.clientX, y: e.clientY })
  }

  return (
    <div className="pet-root">
      <Live2DStage onModelReady={onModelReady} />

      {/* 可交互热区：进入则捕获鼠标，离开则穿透（满足 PRD Q2 默认假设） */}
      <div
        className="pet-hit-area"
        onMouseDown={onMouseDown}
        onWheel={onWheel}
        onContextMenu={onContextMenu}
        onMouseEnter={() => void window.petApi.setIgnoreMouse(false)}
        onMouseLeave={() => void window.petApi.setIgnoreMouse(true)}
      />

      <Bubble text={bubble ?? ''} />
      <PomodoroBadge state={pomodoro} />

      {menu && (
        <div
          className="pet-menu"
          style={{ left: menu.x, top: menu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              void window.petApi.setVisible(false)
              setMenu(null)
            }}
          >
            隐藏桌宠
          </button>
          <button
            onClick={() => {
              void window.petApi.focusMain()
              setMenu(null)
            }}
          >
            显示主窗口
          </button>
          <button
            className="danger"
            onClick={() => {
              void window.petApi.quit()
              setMenu(null)
            }}
          >
            退出
          </button>
        </div>
      )}

      {menu && <div className="fixed inset-0 z-40" onClick={() => setMenu(null)} />}
    </div>
  )
}
