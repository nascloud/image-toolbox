import React, { useEffect, useRef } from 'react';
import { useProgressContext, GlobalProgress } from '../hooks/useProgress';

export const StatusBar: React.FC = () => {
  const { progress, idleText, updateProgress } = useProgressContext();
  const doneTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (progress?.done) {
      doneTimerRef.current = setTimeout(() => {
        updateProgress(null);
      }, 5000);
    }
    return () => {
      if (doneTimerRef.current) clearTimeout(doneTimerRef.current);
    };
  }, [progress?.done, updateProgress]);

  const handleCancel = async () => {
    try {
      await (window as any).go.main.App.CancelBatch();
      updateProgress(null);
    } catch { /* no-op */ }
  };

  if (!progress) {
    return (
      <div className="status-bar status-bar-idle">
        {idleText}
      </div>
    );
  }

  if (progress.done) {
    const errorText = progress.error ? ` · ${progress.error}` : '';
    return (
      <div className="status-bar status-bar-done">
        ✓ 处理完成 · {progress.completed} 成功{errorText}
      </div>
    );
  }

  const pct = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
  return (
    <div className="status-bar status-bar-active">
      <span className="status-bar-progress-text">
        {progress.completed}/{progress.total} {pct}%
      </span>
      <div className="status-bar-track">
        <div className="status-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      {progress.current && (
        <span className="status-bar-current" title={progress.current}>
          {progress.current}
        </span>
      )}
      <button
        onClick={handleCancel}
        className="btn btn-sm btn-danger"
        style={{ flexShrink: 0, fontSize: 11, padding: '2px 10px', height: 26 }}
      >
        取消
      </button>
    </div>
  );
};
