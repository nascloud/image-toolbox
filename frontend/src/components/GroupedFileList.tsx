import React from 'react';

export interface FolderEntry {
  path: string;
  scannedFiles: string[];
}

interface GroupedFileListProps {
  folders: FolderEntry[];
  looseFiles: string[];
  onAddFolder: () => void;
  onAddFiles: () => void;
  onRemoveFolder: (index: number) => void;
  onRemoveFile: (index: number) => void;
  onClear: () => void;
  onPreview?: (path: string) => void;
  selectedPath?: string;
}

export const GroupedFileList: React.FC<GroupedFileListProps> = ({
  folders, looseFiles, onAddFolder, onAddFiles, onRemoveFolder, onRemoveFile, onClear, onPreview, selectedPath,
}) => {
  const total = folders.reduce((s, f) => s + f.scannedFiles.length, 0) + looseFiles.length;

  return (
    <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div className="flex gap-3" style={{ flexWrap: 'wrap', padding: 'var(--space-4) var(--space-4) 0' }}>
        <button onClick={onAddFiles} className="btn btn-sm btn-primary">选择文件</button>
        <button onClick={onAddFolder} className="btn btn-sm btn-ghost">选择文件夹</button>
        {total > 0 && <button onClick={onClear} className="btn btn-sm btn-ghost" style={{ marginLeft: 'auto' }}>清空</button>}
      </div>
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0, padding: 'var(--space-3) var(--space-4)' }}>
        {total === 0 ? (
          <div className="empty-state" style={{ margin: 0, background: 'none', border: 'none' }} onClick={onAddFiles}>
            <span style={{ fontSize: 18 }}>📁</span>
            <span>点击选择或拖拽图片到此处</span>
          </div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {folders.map((folder, fi) => (
              <li key={`f-${fi}`} style={{ marginBottom: 'var(--space-3)' }}>
                <div className="flex items-center justify-between" style={{ padding: '4px 0' }}>
                  <div className="flex items-center gap-2" style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: 14 }}>📁</span>
                    <span className="text-sm" style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={folder.path}>
                      {folder.path}
                    </span>
                    <span className="text-xs text-muted">({folder.scannedFiles.length} 张)</span>
                  </div>
                  <button onClick={() => onRemoveFolder(fi)} className="btn-icon" title="移除文件夹" style={{ fontSize: 16, flexShrink: 0 }}>×</button>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: '2px 0 0 20px' }}>
                  {folder.scannedFiles.map((fp, j) => (
                    <li key={j} onClick={() => onPreview?.(fp)} style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '3px 6px', cursor: onPreview ? 'pointer' : 'default',
                      borderRadius: 'var(--radius-sm)', background: selectedPath === fp ? 'var(--color-accent-glow)' : undefined,
                    }}>
                      <span className="text-xs text-muted">└─</span>
                      <span className="text-sm text-secondary" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }} title={fp}>
                        {fp}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
            {looseFiles.length > 0 && (
              <li>
                <div className="flex items-center gap-2" style={{ padding: '4px 0 2px' }}>
                  <span style={{ fontSize: 14 }}>📦</span>
                  <span className="text-sm" style={{ fontWeight: 500 }}>单独添加的文件</span>
                  <span className="text-xs text-muted">({looseFiles.length} 张)</span>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: '2px 0 0 20px' }}>
                  {looseFiles.map((fp, j) => (
                    <li key={j} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 6px' }}>
                      <span className="text-xs text-muted">└─</span>
                      <span className="text-sm text-secondary" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }} onClick={() => onPreview?.(fp)} title={fp}>
                        {fp}
                      </span>
                      <button onClick={() => onRemoveFile(j)} className="btn-icon" title="移除" style={{ fontSize: 14, flexShrink: 0 }}>×</button>
                    </li>
                  ))}
                </ul>
              </li>
            )}
          </ul>
        )}
      </div>
      {total > 0 && (
        <div style={{ padding: '0 var(--space-4) var(--space-3)', fontSize: 12, color: 'var(--color-text-muted)' }}>
          总计: {total} 张
        </div>
      )}
    </div>
  );
};
