import { useState, useCallback } from 'react';
import { EventsOn, EventsOff } from '../../wailsjs/runtime';

export interface ProgressUpdate {
  completed: number;
  total: number;
  current: string;
  error?: string;
  done: boolean;
}

export interface BatchState {
  running: boolean;
  progress: ProgressUpdate | null;
  result: any | null;
}

export function useBatch() {
  const [state, setState] = useState<BatchState>({
    running: false,
    progress: null,
    result: null,
  });

  const startBatch = useCallback(async (method: string, request: any) => {
    setState({ running: true, progress: null, result: null });

    // Subscribe to progress events from Go backend
    EventsOn('batch-progress', (update: ProgressUpdate) => {
      setState(prev => ({ ...prev, progress: update }));
    });

    try {
      const fn = (window as any).go.main.App[method];
      if (!fn) throw new Error(`Wails method not found: ${method}`);
      const result = await fn(request);
      EventsOff('batch-progress');
      setState({ running: false, progress: null, result });
      return result;
    } catch (err: any) {
      EventsOff('batch-progress');
      setState({ running: false, progress: null, result: { error: err.message } });
    }
  }, []);

  return { state, startBatch };
}
