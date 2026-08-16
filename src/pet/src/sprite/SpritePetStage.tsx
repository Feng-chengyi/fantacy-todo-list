/**
 * 精灵渲染舞台：spritesheet 横排帧，background-position 换帧，pixelated 硬边缩放。
 * 联动动画状态由 usePetAnimState 驱动，此处只负责渲染当前帧。
 */
import type { PetCharacterId } from '../../../shared/types'
import { PET_ASSETS, PET_FRAME_H, PET_FRAME_W, type PetAnim } from './petAssets'
import { useSpriteAnim } from './useSpriteAnim'

interface Props {
  characterId: PetCharacterId
  scale: number
  /** 当前动画（受控） */
  anim: PetAnim
  /** 重复触发同动画时的重启序号（一次性动画连播） */
  restartKey: number
  /** 非循环动画播完回调（回落到持续状态动画） */
  onAnimFinish?: (anim: PetAnim) => void
}

export function SpritePetStage({ characterId, scale, anim, restartKey, onAnimFinish }: Props) {
  const { sheet, manifest } = PET_ASSETS[characterId]
  const frame = useSpriteAnim(manifest.animations, anim, restartKey, onAnimFinish)
  const frameCount = manifest.spritesheet.frameCount

  const w = PET_FRAME_W * scale
  const h = PET_FRAME_H * scale

  return (
    <div
      className="sprite-stage"
      style={{
        width: w,
        height: h,
        left: (window.innerWidth - w) / 2,
        top: (window.innerHeight - h) / 2,
        backgroundImage: `url(${sheet})`,
        backgroundSize: `${w * frameCount}px ${h}px`,
        backgroundPosition: `${-frame * w}px 0`,
        backgroundRepeat: 'no-repeat',
      }}
    />
  )
}
