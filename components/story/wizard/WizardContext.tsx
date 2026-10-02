'use client'

import { createContext, useContext } from 'react'

interface WizardConfig {
  betaMode: boolean
  /** image_generation_enabled is false — illustrations will be skipped. Independent of betaMode. */
  imagesPaused: boolean
  /** Launch scope (Phase 2A): the Learning toggle belongs to the deferred Learning Tools product. */
  learningModeEnabled: boolean
  /** Launch scope (Phase 2A): teen/adult audiences (and 18+ consent) are hidden until the flag is on. */
  extendedAudiences: boolean
}

export const WizardConfigContext = createContext<WizardConfig>({ betaMode: false, imagesPaused: false, learningModeEnabled: false, extendedAudiences: false })
export const useWizardConfig = () => useContext(WizardConfigContext)
