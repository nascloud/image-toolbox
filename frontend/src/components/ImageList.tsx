import React from 'react';

interface ImageListProps {
  files: string[];
  onRemove: (index: number) => void;
  onClear: () => void;
}

export const ImageList: React.FC<ImageListProps> = ({ files, onRemove, onClear }) => {
  if (files.length === 0) {
    return (
      <div style={{ padding: 24, color: '#888', textAlign: 'center', border: '2px dashed #333', borderRadius: 8 }}>
        请选择图片文件或文件夹
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span>{files.length} 个文件</span>
        <button onClick={onClear} style={{ background: 'none', border: 'none', color: '#e94560', cursor: 'pointer' }}>
          清空
        </button>
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: 240, overflow: 'auto' }}>
        {files.map((f, i) => (
          <li key={i} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '6px 12px', borderBottom: '1px solid #222',
          }}>
            <span style={{ fontSize: 13, color: '#ccc' }}>{f}</span>
            <button onClick={() => onRemove(i)} style={{
              background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 16,
            }}>×</button>
          </li>
        ))}
      </ul>
    </div>
  );
};
