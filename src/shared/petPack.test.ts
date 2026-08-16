/**
 * 宠物包清单校验 / pet-id 归一化纯函数单测（自定义宠物导入 Task 1）。
 */
import { describe, expect, it } from 'vitest'
import {
  normalizePetId,
  PET_FRAME_COUNT,
  PET_FRAME_H,
  PET_FRAME_W,
  PET_PACK_ANIMS,
  PET_SHEET_H,
  PET_SHEET_W,
  validatePetPackManifest,
  validatePetSheetSize,
} from './petPack'
import type { PetPackManifest } from './types'

/** 构造一份合法清单（未覆盖的字段全部合规） */
function buildManifest(patch?: Partial<PetPackManifest>): PetPackManifest {
  return {
    formatVersion: 2,
    spec: 'codex-custom-pet-v2',
    id: '我的猫猫',
    name: '我的猫猫',
    frame: { width: PET_FRAME_W, height: PET_FRAME_H },
    spritesheet: { file: 'sheet.png', layout: 'horizontal', frameCount: PET_FRAME_COUNT },
    animations: {
      idle: { frames: [0, 1], fps: 8, loop: true },
      'running-right': { frames: [2, 3], fps: 12, loop: true },
      'running-left': { frames: [4, 5], fps: 12, loop: true },
      waving: { frames: [6, 7], fps: 10, loop: false },
      jumping: { frames: [8, 9], fps: 10, loop: false },
      timing: { frames: [10, 11], fps: 6, loop: true },
      finishing: { frames: [12, 13, 14], fps: 10, loop: false },
    },
    ...patch,
  }
}

describe('validatePetPackManifest', () => {
  it('合法清单通过校验并原样返回 manifest', () => {
    const r = validatePetPackManifest(buildManifest())
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.manifest.id).toBe('我的猫猫')
  })

  it('formatVersion 错误失败', () => {
    const r = validatePetPackManifest(buildManifest({ formatVersion: 1 as unknown as 2 }))
    expect(r.ok).toBe(false)
  })

  it('spec 错误失败', () => {
    const r = validatePetPackManifest(buildManifest({ spec: 'other-spec' as unknown as 'codex-custom-pet-v2' }))
    expect(r.ok).toBe(false)
  })

  it('id 为空失败', () => {
    const r = validatePetPackManifest(buildManifest({ id: '' }))
    expect(r.ok).toBe(false)
  })

  it('name 为空失败', () => {
    const r = validatePetPackManifest(buildManifest({ name: '' }))
    expect(r.ok).toBe(false)
  })

  it('frame 尺寸错误失败', () => {
    const wrongW = validatePetPackManifest(
      buildManifest({ frame: { width: 100, height: PET_FRAME_H } })
    )
    expect(wrongW.ok).toBe(false)
    const wrongH = validatePetPackManifest(
      buildManifest({ frame: { width: PET_FRAME_W, height: 100 } })
    )
    expect(wrongH.ok).toBe(false)
  })

  it('frameCount 错误失败', () => {
    const r = validatePetPackManifest(
      buildManifest({
        spritesheet: { file: 'sheet.png', layout: 'horizontal', frameCount: PET_FRAME_COUNT - 1 },
      })
    )
    expect(r.ok).toBe(false)
  })

  it('spritesheet.layout 非 horizontal 失败', () => {
    const r = validatePetPackManifest(
      buildManifest({
        spritesheet: { file: 'sheet.png', layout: 'vertical' as unknown as 'horizontal', frameCount: PET_FRAME_COUNT },
      })
    )
    expect(r.ok).toBe(false)
  })

  it('缺少任一动画键失败（遍历 7 键）', () => {
    for (const key of PET_PACK_ANIMS) {
      const m = buildManifest()
      delete (m.animations as Record<string, unknown>)[key]
      const r = validatePetPackManifest(m)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error).toContain(key)
    }
  })

  it('帧索引越界（15 / -1）或非整数失败', () => {
    for (const bad of [15, -1, 1.5]) {
      const m = buildManifest()
      m.animations.idle.frames = [0, bad]
      const r = validatePetPackManifest(m)
      expect(r.ok).toBe(false)
    }
  })

  it('frames 为空数组失败', () => {
    const m = buildManifest()
    m.animations.jumping.frames = []
    const r = validatePetPackManifest(m)
    expect(r.ok).toBe(false)
  })

  it('fps 为 0 失败', () => {
    const m = buildManifest()
    m.animations.timing.fps = 0
    const r = validatePetPackManifest(m)
    expect(r.ok).toBe(false)
  })

  it('loop 非布尔失败', () => {
    const m = buildManifest()
    m.animations.waving.loop = 'yes' as unknown as boolean
    const r = validatePetPackManifest(m)
    expect(r.ok).toBe(false)
  })

  it('非对象输入失败', () => {
    expect(validatePetPackManifest(null).ok).toBe(false)
    expect(validatePetPackManifest('x').ok).toBe(false)
    expect(validatePetPackManifest([1, 2]).ok).toBe(false)
  })
})

describe('normalizePetId', () => {
  it('空白转连字符、去除标点、保留中文', () => {
    expect(normalizePetId('我的 猫猫!')).toBe('我的-猫猫')
  })

  it('非法路径字符被去除并转小写', () => {
    expect(normalizePetId('A/B\\C:D*E')).toBe('abcde')
  })

  it('全非法字符返回 pet', () => {
    expect(normalizePetId('///??***')).toBe('pet')
    expect(normalizePetId('')).toBe('pet')
  })

  it('超长名称按码点截断 40 字符', () => {
    expect(normalizePetId('a'.repeat(50))).toHaveLength(40)
    expect(normalizePetId('猫'.repeat(50))).toHaveLength(40)
  })

  it('连续分隔符合并、首尾分隔符去除', () => {
    expect(normalizePetId('a   b')).toBe('a-b')
    expect(normalizePetId('  -  猫 猫  -  ')).toBe('猫-猫')
  })
})

describe('validatePetSheetSize', () => {
  it('2880x208 通过', () => {
    expect(validatePetSheetSize(PET_SHEET_W, PET_SHEET_H)).toBe(true)
    expect(PET_SHEET_W).toBe(2880)
    expect(PET_SHEET_H).toBe(208)
  })

  it('其它尺寸失败', () => {
    expect(validatePetSheetSize(1920, 208)).toBe(false)
    expect(validatePetSheetSize(2880, 200)).toBe(false)
  })
})
