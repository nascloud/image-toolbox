import React from 'react';
import { ProgressUpdate } from '../hooks/useBatch';

interface BatchProgressProps {
  progress: ProgressUpdate | null;
}

export const BatchProgress: React.FC<BatchProgressProps> = ({ progress }) => {
  if (!progress) return null;

  const pct = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
        <span>{progress.completed} / {progress.total}</span>
        <span>{pct}%</span>
      </div>
      <div style={{ height: 6, background: '#333', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`, background: '#e94560',
          transition: 'width 0.3s', borderRadius: 3,
        }} />
      </div>
      {progress.current && (
        <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{progress.current}</div>
      )}
      {progress.done && (
        <div style={{ fontSize: 13, color: '#4caf50', marginTop: 8 }}>处理完成</div>
      )}
    </div>
  );
};
