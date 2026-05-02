'use client'

import { createContext, useContext } from 'react'

interface WizardConfig {
  betaMode: boolean
}

export const WizardConfigContext = createContext<WizardConfig>({ betaMode: false })
export const useWizardConfig = () => useContext(WizardConfigContext)
