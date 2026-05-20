import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

export interface LaunchIntent {
  page: 'convert' | 'slice' | 'watermark' | 'aibatch'
  files: string[]
}

interface IntentContextValue {
  pending: LaunchIntent | null
  setPending: (intent: LaunchIntent | null) => void
}

const IntentContext = createContext<IntentContextValue>({
  pending: null,
  setPending: () => {},
})

export function IntentProvider({ children }: { children: ReactNode }) {
  const [pending, setPendingState] = useState<LaunchIntent | null>(null)

  const setPending = useCallback((intent: LaunchIntent | null) => {
    setPendingState(intent)
  }, [])

  return (
    <IntentContext.Provider value={{ pending, setPending }}>
      {children}
    </IntentContext.Provider>
  )
}

export function useIntentContext(): IntentContextValue {
  return useContext(IntentContext)
}
