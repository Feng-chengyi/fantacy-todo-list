/**
 * Live2D 渲染舞台：PIXI.Application（透明）+ pixi-live2d-display 加载角色模型。
 *
 * 关键点：
 * 1. 按需导入 `pixi-live2d-display/cubism4` 不会自动注册 Ticker，必须手动
 *    `Live2DModel.registerTicker(PIXI.Ticker)`，否则模型停留在默认 T-pose、
 *    物理 / 眨眼 / 待机动作全部不更新（本次「双手交叉又展开」的头号根因）。
 * 2. 模型按 `modelId` 加载；切换角色时先移除并销毁旧模型，再加载新模型。
 */
import { useEffect, useRef } from 'react'
import * as PIXI from 'pixi.js'
import { Live2DModel, config as live2dConfig } from 'pixi-live2d-display/cubism4'
import { getPetModel } from '../../shared/defaults'
import type { PetModelId } from '../../shared/types'

// 全量导入 pixi.js 已自动注册 TickerPlugin / interaction 插件；
// 这里补注册 Live2DModel 的 Ticker，并把 PIXI 暴露到 window 作为兜底（幂等）。
;(window as any).PIXI = PIXI
Live2DModel.registerTicker(PIXI.Ticker)
PIXI.Application.registerPlugin(PIXI.TickerPlugin)
PIXI.Renderer.registerPlugin('interaction', PIXI.InteractionManager)

// 默认彻底静音：部分模型（如 Haru）的 TapBody motion 在 model3.json 里带 Sound 字段，
// pixi-live2d-display 会在播放动作时自动 new Audio 播放 wav。这里全局关闭声音入口，
// 仅保留视觉动作反应，避免桌宠间隔发出怪叫声。
live2dConfig.sound = false

const STAGE_WIDTH = 320
const STAGE_HEIGHT = 420
/** 默认显示宽度：原 210 缩小约一半 */
const TARGET_WIDTH = 108

interface Props {
  modelId: PetModelId
  onModelReady: (model: Live2DModel, baseScale: number) => void
}

export function Live2DStage({ modelId, onModelReady }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<PIXI.Application | null>(null)
  const modelRef = useRef<Live2DModel | null>(null)
  const readyRef = useRef(onModelReady)
  readyRef.current = onModelReady

  // 应用实例只创建一次；模型切换时复用同一 canvas / WebGL 上下文
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const app = new PIXI.Application({
      width: STAGE_WIDTH,
      height: STAGE_HEIGHT,
      backgroundAlpha: 0,
      transparent: true,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
    })
    container.appendChild(app.view)
    appRef.current = app

    return () => {
      modelRef.current = null
      if (appRef.current) {
        appRef.current.destroy(true, { children: true, texture: true, baseTexture: true })
        appRef.current = null
      }
    }
  }, [])

  // 模型加载 / 切换：modelId 变化时销毁旧模型并加载新模型
  useEffect(() => {
    const app = appRef.current
    if (!app) return

    let cancelled = false

    // 移除并销毁上一个模型，释放 GL 资源
    if (modelRef.current) {
      const prev = modelRef.current
      if (prev.parent) prev.parent.removeChild(prev)
      prev.destroy({ texture: true, baseTexture: true })
      modelRef.current = null
    }

    const info = getPetModel(modelId)
    Live2DModel.from(`./${info.path}`)
      .then((model) => {
        if (cancelled) {
          model.destroy({ texture: true, baseTexture: true })
          return
        }
        const baseScale = TARGET_WIDTH / model.width
        model.scale.set(baseScale)
        model.anchor.set(0.5, 0.5)
        model.x = STAGE_WIDTH / 2
        model.y = STAGE_HEIGHT - 90
        app.stage.addChild(model)
        modelRef.current = model
        readyRef.current(model, baseScale)
      })
      .catch((err) => {
        console.error(`[pet] 模型加载失败（${info.id}）：`, err)
      })

    return () => {
      cancelled = true
    }
  }, [modelId])

  return <div ref={containerRef} className="live2d-stage" />
}
