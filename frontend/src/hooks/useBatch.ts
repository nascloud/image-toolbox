import { useState, useCallback } from 'react';

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

  const startBatch = useCallback(async (request: any) => {
    setState({ running: true, progress: null, result: null });

    try {
      // Wails binds Go methods to window.go.main.App
      const result = await (window as any).go.main.App.ProcessImagesBatch(request);
      setState({ running: false, progress: null, result });
      return result;
    } catch (err: any) {
      setState({ running: false, progress: null, result: { error: err.message } });
    }
  }, []);

  return { state, startBatch };
}
