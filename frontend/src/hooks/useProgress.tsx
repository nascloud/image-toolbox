import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { EventsOn, EventsOff } from '../../wailsjs/runtime';

export interface GlobalProgress {
  completed: number;
  total: number;
  current: string;
  error?: string;
  done: boolean;
  running: boolean;
}

export interface ProgressContextValue {
  progress: GlobalProgress | null;
  idleText: string;
  updateProgress: (p: GlobalProgress | null) => void;
  setIdleText: (text: string) => void;
}

const ProgressContext = createContext<ProgressContextValue>({
  progress: null,
  idleText: '0 张图片 · 就绪',
  updateProgress: () => {},
  setIdleText: () => {},
});

export const useProgressContext = () => useContext(ProgressContext);

export const ProgressProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [progress, setProgress] = useState<GlobalProgress | null>(null);
  const [idleText, setIdleText] = useState('0 张图片 · 就绪');

  const updateProgress = useCallback((p: GlobalProgress | null) => {
    setProgress(p);
  }, []);

  // Global batch-progress listener — persists across tab switches
  useEffect(() => {
    EventsOn('batch-progress', (update: any) => {
      setProgress({ ...update, running: true });
    });
    return () => {
      EventsOff('batch-progress');
    };
  }, []);

  return (
    <ProgressContext.Provider value={{ progress, idleText, updateProgress, setIdleText }}>
      {children}
    </ProgressContext.Provider>
  );
};
