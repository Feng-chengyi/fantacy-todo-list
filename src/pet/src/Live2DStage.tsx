/**
 * Live2D 渲染舞台：PIXI.Application（透明）+ pixi-live2d-display 加载 Haru 模型。
 */
import { useEffect, useRef } from 'react'
import * as PIXI from 'pixi.js'
import { Live2DModel } from 'pixi-live2d-display/cubism4'

const STAGE_WIDTH = 320
const STAGE_HEIGHT = 420
const TARGET_WIDTH = 210

interface Props {
  onModelReady: (model: Live2DModel, baseScale: number) => void
}

export function Live2DStage({ onModelReady }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<PIXI.Application | null>(null)
  const readyRef = useRef(onModelReady)
  readyRef.current = onModelReady

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

    let cancelled = false
    Live2DModel.from('./live2d/haru/haru_greeter_t03.model3.json')
      .then((model) => {
        if (cancelled) {
          model.destroy()
          return
        }
        const baseScale = TARGET_WIDTH / model.width
        model.scale.set(baseScale)
        model.anchor.set(0.5, 0.5)
        model.x = STAGE_WIDTH / 2
        model.y = STAGE_HEIGHT - 90
        app.stage.addChild(model)
        readyRef.current(model, baseScale)
      })
      .catch((err) => {
        console.error('[pet] Live2D 模型加载失败：', err)
      })

    return () => {
      cancelled = true
      if (appRef.current) {
        appRef.current.destroy(true, { children: true })
        appRef.current = null
      }
    }
  }, [])

  return <div ref={containerRef} className="live2d-stage" />
}
