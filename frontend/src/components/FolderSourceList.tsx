import React from 'react';

export interface FolderSource {
  path: string;
  recursive: boolean;
  scannedFiles: string[];
  error?: string;
}

interface FolderSourceListProps {
  sources: FolderSource[];
  looseFiles: string[];
  onAddFolder: () => void;
  onAddFiles: () => void;
  onRemoveSource: (index: number) => void;
  onRescan: (index: number, recursive: boolean) => void;
  onClear: () => void;
}

export const FolderSourceList: React.FC<FolderSourceListProps> = ({
  sources, looseFiles, onAddFolder, onAddFiles, onRemoveSource, onRescan, onClear,
}) => {
  return (
    <div className="card" style={{ padding: 'var(--space-4)' }}>
      {sources.length === 0 && looseFiles.length === 0 ? (
        <div className="flex gap-3" style={{ flexWrap: 'wrap' }}>
          <button onClick={onAddFiles} className="btn btn-sm btn-primary">选择文件</button>
          <button onClick={onAddFolder} className="btn btn-sm btn-ghost">选择文件夹</button>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {sources.map((src, i) => (
              <div key={i} style={{
                background: 'var(--color-bg-surface)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-3) var(--space-4)',
              }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2" style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: 16 }}>📁</span>
                    <span className="text-sm" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={src.path}>
                      {src.path}
                    </span>
                    <span className="text-xs text-muted">({src.scannedFiles.length} 张)</span>
                  </div>
                  <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
                    <button onClick={() => onRescan(i, !src.recursive)} className="btn-icon" title="重新扫描" style={{ fontSize: 14 }}>↻</button>
                    <button onClick={() => onRemoveSource(i)} className="btn-icon" title="移除" style={{ fontSize: 16 }}>×</button>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-2">
                  <label className="checkbox-label" style={{ fontSize: 12 }}>
                    <input type="radio" name={`recursive-${i}`} checked={src.recursive} onChange={() => { if (!src.recursive) onRescan(i, true); }} />
                    递归子目录
                  </label>
                  <label className="checkbox-label" style={{ fontSize: 12 }}>
                    <input type="radio" name={`recursive-${i}`} checked={!src.recursive} onChange={() => { if (src.recursive) onRescan(i, false); }} />
                    仅当前目录
                  </label>
                </div>
                {src.error && (
                  <div className="text-xs text-danger mt-2" style={{ color: 'var(--color-danger)' }}>
                    ⚠ {src.error}
                  </div>
                )}
              </div>
            ))}
            {looseFiles.length > 0 && (
              <div className="flex items-center gap-2" style={{ padding: 'var(--space-2) var(--space-4)' }}>
                <span style={{ fontSize: 16 }}>📦</span>
                <span className="text-sm">单独添加的文件</span>
                <span className="text-xs text-muted">({looseFiles.length} 张)</span>
              </div>
            )}
          </div>
          <div className="flex gap-3 mt-4" style={{ flexWrap: 'wrap' }}>
            <button onClick={onAddFiles} className="btn btn-sm btn-primary">+ 选择文件</button>
            <button onClick={onAddFolder} className="btn btn-sm btn-ghost">+ 选择文件夹</button>
            <button onClick={onClear} className="btn btn-sm btn-ghost" style={{ marginLeft: 'auto' }}>清空</button>
          </div>
          <div className="text-xs text-muted mt-3">
            总计: {sources.reduce((sum, s) => sum + s.scannedFiles.length, 0) + looseFiles.length} 张
          </div>
        </>
      )}
    </div>
  );
};
