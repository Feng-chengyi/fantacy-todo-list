/// <reference types="vite/client" />
import type { PetRendererApi } from '../../shared/types'

declare global {
  interface Window {
    petApi: PetRendererApi
  }
}

export {}
