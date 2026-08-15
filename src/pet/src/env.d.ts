/// <reference types="vite/client" />
import type { PetRendererApi } from '../../shared/types'

declare global {
  interface Window {
    petApi: PetRendererApi
  }
}

/** Cubism 4 Core 全局对象（由 index.html 的 <script> 提前加载注入） */
declare const Live2DCubismCore: any

export {}
