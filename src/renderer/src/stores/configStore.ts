/**
 * 应用配置 store。
 */
import { create } from 'zustand'
import { DEFAULT_CONFIG } from '../../../shared/defaults'
import type { AppConfig } from '../../../shared/types'
import * as api from '../services/ipc'

interface ConfigState extends AppConfig {
  loaded: boolean
  load: () => Promise<void>
  update: (patch: Partial<AppConfig>) => Promise<void>
}

export const useConfigStore = create<ConfigState>((set) => ({
  ...DEFAULT_CONFIG,
  petPosition: { ...DEFAULT_CONFIG.petPosition },
  loaded: false,

  load: async () => {
    const cfg = await api.getConfig()
    set({ ...cfg, loaded: true })
  },

  update: async (patch) => {
    const cfg = await api.setConfig(patch)
    set({ ...cfg })
  },
}))
