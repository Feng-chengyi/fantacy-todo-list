/**
 * 桌宠窗口根组件：整合 Live2D 渲染、点击 / 拖拽 / 滚轮 / 右键菜单（含切换角色）、
 * 鼠标穿透、气泡与番茄徽标。
 *
 * 鼠标穿透策略：窗口默认穿透（setIgnoreMouse(true)）；指针悬停到热区 / 菜单时捕获，
 * 离开后恢复穿透。右键菜单打开期间强制捕获，避免「菜单按钮点不到、疑似死机」。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, WheelEvent as ReactWheelEvent } from 'react'
import type { Live2DModel } from 'pixi-live2d-display'
import type { PetModelId, PomodoroState } from '../../shared/types'
import { PET_MODELS, isPetModelId } from '../../shared/defaults'
import { Live2DStage } from './Live2DStage'
import { Bubble } from './bubble'
import { PomodoroBadge } from './PomodoroBadge'
import { DRAG_THRESHOLD, clampScale, pickTapMotionGroup } from './pet-events'

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
  const menuOpenRef = useRef(false)

  const [modelId, setModelId] = useState<PetModelId>('haru')
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [showRoles, setShowRoles] = useState(false)
  const [bubble, setBubble] = useState<string | null>(null)
  const [pomodoro, setPomodoro] = useState<PomodoroState | null>(null)

  /** 统一的鼠标穿透开关：interactive=true 表示捕获鼠标 */
  const setPetInteractive = useCallback((interactive: boolean) => {
    void window.petApi.setIgnoreMouse(!interactive)
  }, [])

  const onModelReady = useCallback((model: Live2DModel, baseScale: number) => {
    modelRef.current = model
    baseScaleRef.current = baseScale
    model.scale.set(baseScale * scaleRef.current)
  }, [])

  const closeMenu = useCallback(() => {
    setMenu(null)
    setShowRoles(false)
    menuOpenRef.current = false
    setPetInteractive(false)
  }, [setPetInteractive])

  const openMenu = useCallback(
    (x: number, y: number) => {
      menuOpenRef.current = true
      setShowRoles(false)
      setMenu({ x, y })
      setPetInteractive(true)
    },
    [setPetInteractive],
  )

  const switchModel = useCallback(
    (id: PetModelId) => {
      closeMenu()
      if (id === modelId) return
      // 立即清空旧模型引用，避免切换过程中对已销毁模型触发动作
      modelRef.current = null
      setModelId(id)
      void window.petApi.setConfig({ selectedModel: id })
    },
    [modelId, closeMenu],
  )

  // 点击随机动作：读取模型真实 Motions 分组（优先 TapBody，回退 Idle）
  const playRandom = useCallback(() => {
    const model = modelRef.current
    if (!model) return
    void model.motion(pickTapMotionGroup(model))
  }, [])

  // 初始化：读配置（角色 / 缩放）、订阅气泡与番茄、默认鼠标穿透
  useEffect(() => {
    let disposed = false
    void window.petApi.getConfig().then((cfg) => {
      if (disposed) return
      scaleRef.current = clampScale(cfg.petScale ?? 1)
      const model = modelRef.current
      if (model) model.scale.set(baseScaleRef.current * scaleRef.current)
      const target: PetModelId = isPetModelId(cfg.selectedModel) ? cfg.selectedModel : 'haru'
      setModelId((current) => (current === target ? current : target))
    })
    const offBubble = window.petApi.onBubble((text) => {
      setBubble(text)
      window.setTimeout(() => setBubble(null), 4000)
    })
    const offPomodoro = window.petApi.onPomodoro((state) => setPomodoro(state))
    setPetInteractive(false)
    return () => {
      disposed = true
      offBubble()
      offPomodoro()
    }
  }, [setPetInteractive])

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
    openMenu(e.clientX, e.clientY)
  }

  return (
    <div className="pet-root">
      <Live2DStage modelId={modelId} onModelReady={onModelReady} />

      {/* 可交互热区：进入则捕获鼠标，离开则穿透（菜单打开期间不穿透） */}
      <div
        className="pet-hit-area"
        onMouseDown={onMouseDown}
        onWheel={onWheel}
        onContextMenu={onContextMenu}
        onMouseEnter={() => setPetInteractive(true)}
        onMouseLeave={() => {
          if (!menuOpenRef.current) setPetInteractive(false)
        }}
      />

      <Bubble text={bubble ?? ''} />
      <PomodoroBadge state={pomodoro} />

      {menu && (
        <>
          <div
            className="pet-menu"
            style={{ left: menu.x, top: menu.y }}
            onMouseEnter={() => setPetInteractive(true)}
          >
            <button onClick={() => setShowRoles((v) => !v)}>
              切换角色 <span className="pet-menu-arrow">▸</span>
            </button>
            {showRoles && (
              <div className="pet-menu-sub">
                {PET_MODELS.map((m) => (
                  <button key={m.id} onClick={() => switchModel(m.id)}>
                    <span className="pet-menu-check">{m.id === modelId ? '✓' : ''}</span>
                    {m.name}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => {
                void window.petApi.setVisible(false)
                closeMenu()
              }}
            >
              隐藏桌宠
            </button>
            <button
              onClick={() => {
                void window.petApi.focusMain()
                closeMenu()
              }}
            >
              显示主窗口
            </button>
            <button
              className="danger"
              onClick={() => {
                void window.petApi.quit()
                closeMenu()
              }}
            >
              退出
            </button>
          </div>
          {/* 遮罩：点击空白处关闭菜单（z-40 低于菜单 z-50） */}
          <div className="fixed inset-0 z-40" onClick={closeMenu} />
        </>
      )}
    </div>
  )
}
