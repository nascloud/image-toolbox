import React, { useState, useCallback } from 'react';

interface ImageListProps {
  files: string[];
  onRemove: (index: number) => void;
  onClear: () => void;
  onDrop?: (paths: string[]) => void;
  onAddClick?: () => void;
}

const IMAGE_EXTS = ['.jpg', '.jpeg', '.jfif', '.png', '.webp', '.bmp', '.gif', '.tiff'];

export const ImageList: React.FC<ImageListProps> = ({ files, onRemove, onClear, onDrop, onAddClick }) => {
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const paths: string[] = [];
    for (const f of e.dataTransfer.files) {
      const p = (f as any).path || f.name;
      const ext = p.toLowerCase().slice(p.lastIndexOf('.'));
      if (IMAGE_EXTS.includes(ext)) {
        paths.push(p);
      }
    }
    if (paths.length > 0) {
      onDrop?.(paths);
    }
  }, [onDrop]);

  if (files.length === 0) {
    return (
      <div
        className="empty-state"
        style={{
          padding: '20px 24px', flexDirection: 'row', gap: 8, cursor: 'pointer',
          borderColor: dragOver ? 'var(--color-accent)' : undefined,
          background: dragOver ? 'var(--color-accent-glow)' : undefined,
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={onAddClick}
      >
        <span style={{ fontSize: 18 }}>📁</span>
        <span>{dragOver ? '释放以添加图片' : '点击选择或拖拽图片到此处'}</span>
      </div>
    );
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        borderRadius: 'var(--radius-2xl)',
        outline: dragOver ? '2px dashed var(--color-accent)' : undefined,
        outlineOffset: 2,
        transition: 'outline 150ms ease',
        flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0,
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-secondary">{files.length} 个文件</span>
        <div className="flex gap-2">
          <button onClick={onAddClick} className="btn btn-sm btn-ghost">+ 添加</button>
          <button onClick={onClear} className="btn btn-sm btn-ghost">清空</button>
        </div>
      </div>
      <ul style={{
        listStyle: 'none', padding: 0, margin: 0, flex: 1, overflow: 'auto', minHeight: 0,
      }}>
        {files.map((f, i) => (
          <li key={i} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '5px 8px', borderBottom: '1px solid var(--color-border-subtle)',
          }}>
            <span className="text-sm text-secondary" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              {f}
            </span>
            <button onClick={() => onRemove(i)} className="btn-icon" style={{ flexShrink: 0 }}>
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
