import React, { useState, useCallback, useEffect, useRef } from 'react';
import { EventsOn } from '../../wailsjs/runtime/runtime';

const IMAGE_EXTS = ['.jpg', '.jpeg', '.jfif', '.png', '.webp', '.bmp', '.gif', '.tiff'];

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
  onDropFiles?: (paths: string[]) => void;
}

interface TreeNode {
  name: string;
  path?: string;
  children: TreeNode[];
  fileCount: number;
}

function pathSep(p: string): string {
  return p.includes('\\') ? '\\' : '/';
}

function buildTree(base: string, files: string[]): TreeNode[] {
  const sep = pathSep(base);
  const root: TreeNode[] = [];
  const map = new Map<string, TreeNode[]>();

  for (const fp of files) {
    let rel = fp.startsWith(base) ? fp.slice(base.length) : fp;
    if (rel.startsWith(sep)) rel = rel.slice(1);
    const parts = rel.split(sep);
    let level = root;
    let acc = '';
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i === parts.length - 1) {
        level.push({ name: part, path: fp, children: [], fileCount: 0 });
      } else {
        acc = acc ? acc + sep + part : part;
        let existing = level.find(n => n.name === part && n.children !== undefined);
        if (!existing) {
          existing = { name: part, children: [], fileCount: 0 };
          level.push(existing);
        }
        existing.fileCount++;
        level = existing.children;
      }
    }
  }
  return root;
}

interface FileTreeViewProps {
  nodes: TreeNode[];
  depth: number;
  expanded: Set<string>;
  onToggle: (key: string) => void;
  onPreview?: (path: string) => void;
  selectedPath?: string;
  prefix: string;
}

const FileTreeView: React.FC<FileTreeViewProps> = ({ nodes, depth, expanded, onToggle, onPreview, selectedPath, prefix }) => {
  return (
    <>
      {nodes.map((node, i) => {
        if (node.children.length > 0 || node.fileCount > 0) {
          const key = `${prefix}/${node.name}`;
          const isExpanded = expanded.has(key);
          return (
            <li key={key} style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                <div
                  onClick={() => onToggle(key)}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 6px', cursor: 'pointer', borderRadius: 'var(--radius-sm)', marginLeft: depth * 16 }}
                >
                  <span style={{ fontSize: 11, width: 12, textAlign: 'center', flexShrink: 0 }}>{isExpanded ? '▼' : '▶'}</span>
                  <span style={{ fontSize: 13, flexShrink: 0 }}>📂</span>
                  <span className="text-sm" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.name}</span>
                  <span className="text-xs text-muted" style={{ flexShrink: 0 }}>({node.fileCount} 张)</span>
              </div>
              {isExpanded && (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  <FileTreeView nodes={node.children} depth={depth + 1} expanded={expanded} onToggle={onToggle} onPreview={onPreview} selectedPath={selectedPath} prefix={key} />
                </ul>
              )}
            </li>
          );
        }
        return (
          <li key={node.path} onClick={() => onPreview?.(node.path!)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '3px 6px', cursor: onPreview ? 'pointer' : 'default',
            borderRadius: 'var(--radius-sm)', background: selectedPath === node.path ? 'var(--color-accent-glow)' : undefined,
            marginLeft: depth * 16 + 16,
          }}>
            <span className="text-xs text-muted" style={{ width: 12, flexShrink: 0, textAlign: 'center' }}>└─</span>
            <span className="text-sm text-secondary" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={node.path}>
              {node.name}
            </span>
          </li>
        );
      })}
    </>
  );
};

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

export const GroupedFileList: React.FC<GroupedFileListProps> = ({
  folders, looseFiles, onAddFolder, onAddFiles, onRemoveFolder, onRemoveFile, onClear, onPreview, selectedPath, onDropFiles,
}) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dragOver, setDragOver] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const total = folders.reduce((s, f) => s + f.scannedFiles.length, 0) + looseFiles.length;

  useEffect(() => {
    const off = EventsOn('app:file-drop', (x: number, y: number, paths: string[]) => {
      if (!pointInElement(x, y, dropRef.current)) return;
      const filtered = imagePaths(paths);
      if (filtered.length > 0) onDropFiles?.(filtered);
      setDragOver(false);
    });
    return () => {
      off();
    };
  }, [onDropFiles]);

  const toggleExpand = useCallback((key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  return (
    <div
      ref={dropRef}
      className="card"
      style={{
        flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0,
        ['--wails-drop-target' as any]: 'drop',
        outline: dragOver ? '2px dashed var(--color-accent)' : undefined,
        outlineOffset: -4,
      }}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const paths = imagePaths(Array.from(e.dataTransfer.files).map(f => (f as any).path || f.name));
        if (paths.length > 0) onDropFiles?.(paths);
      }}
    >
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
            {folders.map((folder, fi) => {
              const tree = buildTree(folder.path, folder.scannedFiles);
              return (
                <li key={`f-${fi}`} style={{ marginBottom: 'var(--space-3)' }}>
                  <div className="flex items-center justify-between" style={{ padding: '4px 0' }}>
                  <div className="flex items-center gap-2" style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: 14, flexShrink: 0 }}>📁</span>
                    <span className="text-sm" style={{ fontWeight: 500, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={folder.path}>
                      {folder.path}
                    </span>
                    <span className="text-xs text-muted" style={{ flexShrink: 0 }}>({folder.scannedFiles.length} 张)</span>
                    </div>
                    <button onClick={() => onRemoveFolder(fi)} className="btn-icon" title="移除文件夹" style={{ fontSize: 16, flexShrink: 0 }}>×</button>
                  </div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: '2px 0 0 0' }}>
                    <FileTreeView nodes={tree} depth={0} expanded={expanded} onToggle={toggleExpand} onPreview={onPreview} selectedPath={selectedPath} prefix={`f${fi}`} />
                  </ul>
                </li>
              );
            })}
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
                      <span className="text-xs text-muted" style={{ width: 12, flexShrink: 0, textAlign: 'center' }}>└─</span>
                      <span className="text-sm text-secondary" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} onClick={() => onPreview?.(fp)} title={fp}>
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
