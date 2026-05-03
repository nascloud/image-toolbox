import React from 'react';
import { ProgressUpdate } from '../hooks/useBatch';

interface BatchProgressProps {
  progress: ProgressUpdate | null;
}

export const BatchProgress: React.FC<BatchProgressProps> = ({ progress }) => {
  if (!progress) return null;

  const pct = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;

  return (
    <div className="progress-container">
      <div className="progress-header">
        <span>{progress.completed} / {progress.total}</span>
        <span>{pct}%</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      {progress.current && (
        <div className="progress-current">{progress.current}</div>
      )}
      {progress.done && (
        <div className="progress-done">✓ 处理完成</div>
      )}
    </div>
  );
};
