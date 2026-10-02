'use client'

import { createContext, useContext } from 'react'

interface WizardConfig {
  betaMode: boolean
  /** image_generation_enabled is false — illustrations will be skipped. Independent of betaMode. */
  imagesPaused: boolean
}

export const WizardConfigContext = createContext<WizardConfig>({ betaMode: false, imagesPaused: false })
export const useWizardConfig = () => useContext(WizardConfigContext)
