import React, { useState, useCallback, useEffect, useRef } from 'react';
import { EventsOn } from '../../wailsjs/runtime/runtime';

interface ImageListProps {
  files: string[];
  onRemove: (index: number) => void;
  onClear: () => void;
  onDrop?: (paths: string[]) => void;
  onAddClick?: () => void;
  onPreview?: (index: number) => void;
  selectedIndex?: number;
}

const IMAGE_EXTS = ['.jpg', '.jpeg', '.jfif', '.png', '.webp', '.bmp', '.gif', '.tiff'];

function normalizeDroppedPath(path: string): string {
  let normalized = path.trim();
  if (normalized.startsWith('file:///')) {
    normalized = decodeURIComponent(normalized.replace(/^file:\/\/\//, ''));
  }
  return normalized;
}

function isReadableLocalPath(path: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(path) || path.startsWith('\\\\');
}

function imagePaths(paths: string[]): string[] {
  return paths
    .map(normalizeDroppedPath)
    .filter(p => {
      if (!isReadableLocalPath(p)) return false;
      const ext = p.toLowerCase().slice(p.lastIndexOf('.'));
      return IMAGE_EXTS.includes(ext);
    });
}

function pointInElement(x: number, y: number, el: HTMLElement | null): boolean {
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  const candidates = [
    { x, y },
    { x: x / window.devicePixelRatio, y: y / window.devicePixelRatio },
  ];
  return candidates.some(p => p.x >= rect.left && p.x <= rect.right && p.y >= rect.top && p.y <= rect.bottom);
}

export const ImageList: React.FC<ImageListProps> = ({ files, onRemove, onClear, onDrop, onAddClick, onPreview, selectedIndex }) => {
  const [dragOver, setDragOver] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const off = EventsOn('app:file-drop', (x: number, y: number, paths: string[]) => {
      if (!pointInElement(x, y, dropRef.current)) return;
      const filtered = imagePaths(paths);
      if (filtered.length > 0) onDrop?.(filtered);
      setDragOver(false);
    });

    return () => {
      off();
    };
  }, [onDrop]);

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

    const paths = imagePaths(Array.from(e.dataTransfer.files).map(f => (f as any).path || f.name));
    if (paths.length > 0) {
      onDrop?.(paths);
    }
  }, [onDrop]);

  if (files.length === 0) {
    return (
      <div
        ref={dropRef}
        className="empty-state"
        style={{
          padding: '20px 24px', flexDirection: 'row', gap: 8, cursor: 'pointer',
          ['--wails-drop-target' as any]: 'drop',
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
      ref={dropRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        borderRadius: 'var(--radius-2xl)',
        ['--wails-drop-target' as any]: 'drop',
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
          <li key={i} onClick={() => onPreview?.(i)} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '5px 8px', borderBottom: '1px solid var(--color-border-subtle)',
            background: selectedIndex === i ? 'var(--color-accent-glow)' : 'transparent',
            cursor: onPreview ? 'pointer' : 'default',
          }}>
            <span className="text-sm text-secondary" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, color: selectedIndex === i ? 'var(--color-accent)' : undefined }} title={f}>
              {f}
            </span>
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
              <button onClick={() => onRemove(i)} className="btn-icon" title="移除" style={{ fontSize: 16 }}>
                ×
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
