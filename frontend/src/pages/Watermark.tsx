import React, { useState } from 'react';
import { ImageList } from '../components/ImageList';
import { useBatch } from '../hooks/useBatch';
import { BatchProgress } from '../components/BatchProgress';

export const Watermark: React.FC = () => {
  const [files, setFiles] = useState<string[]>([]);
  const [mode, setMode] = useState<'image' | 'text'>('text');
  const [watermarkImage, setWatermarkImage] = useState('');
  const [watermarkText, setWatermarkText] = useState('Watermark');
  const [opacity, setOpacity] = useState(0.5);
  const [position, setPosition] = useState('bottomRight');
  const { state, startBatch } = useBatch();

  const handleSelectFolder = async () => {
    try {
      const dir = await (window as any).go.main.App.SelectDirectory();
      if (dir) {
        const scanned = await (window as any).go.main.App.ScanDirectory(dir, true);
        if (scanned) setFiles(scanned);
      }
    } catch { /* no-op */ }
  };

  const handleSelectWatermark = async () => {
    try {
      const result = await (window as any).go.main.App.SelectFiles();
      if (result && result.length > 0) setWatermarkImage(result[0]);
    } catch { /* no-op */ }
  };

  const handleRun = async () => {
    const outputDir = files.length > 0
      ? files[0].substring(0, files[0].lastIndexOf('\\'))
      : '';
    await startBatch({
      sourcePaths: files,
      outputDir,
      watermarkImage: mode === 'image' ? watermarkImage : '',
      watermarkText: mode === 'text' ? watermarkText : '',
      opacity,
      position,
      fontSize: 12,
      fontColor: '#ffffff',
    });
  };

  const btnStyle: React.CSSProperties = {
    padding: '8px 20px', background: '#0f3460', color: '#fff',
    border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14,
  };
  const selectStyle: React.CSSProperties = {
    padding: '8px 12px', background: '#1a1a2e', color: '#fff',
    border: '1px solid #333', borderRadius: 6, fontSize: 14,
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 20px', fontSize: 22, fontWeight: 600 }}>水印</h2>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <button onClick={handleSelectFolder} style={btnStyle}>选择图片文件夹</button>
      </div>

      <ImageList files={files} onRemove={i => setFiles(files.filter((_, j) => j !== i))}
        onClear={() => setFiles([])} />

      <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ fontSize: 14, minWidth: 80 }}>水印类型</label>
          <select value={mode} onChange={e => setMode(e.target.value as 'image' | 'text')} style={selectStyle}>
            <option value="text">文字水印</option>
            <option value="image">图片水印</option>
          </select>
        </div>

        {mode === 'text' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <label style={{ fontSize: 14, minWidth: 80 }}>水印文字</label>
            <input type="text" value={watermarkText}
              onChange={e => setWatermarkText(e.target.value)}
              style={{ padding: '8px 12px', background: '#1a1a2e', color: '#fff',
                border: '1px solid #333', borderRadius: 6, fontSize: 14, flex: 1 }} />
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <label style={{ fontSize: 14, minWidth: 80 }}>水印图片</label>
            <span style={{ fontSize: 13, color: '#ccc', flex: 1 }}>
              {watermarkImage || '未选择'}
            </span>
            <button onClick={handleSelectWatermark} style={btnStyle}>选择图片</button>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ fontSize: 14, minWidth: 80 }}>透明度</label>
          <input type="range" min="0" max="100" value={opacity * 100}
            onChange={e => setOpacity(Number(e.target.value) / 100)}
            style={{ width: 200 }} />
          <span style={{ fontSize: 13, color: '#888' }}>{Math.round(opacity * 100)}%</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ fontSize: 14, minWidth: 80 }}>位置</label>
          <select value={position} onChange={e => setPosition(e.target.value)} style={selectStyle}>
            <option value="tile">平铺</option>
            <option value="center">居中</option>
            <option value="bottomRight">右下角</option>
            <option value="topLeft">左上角</option>
          </select>
        </div>
      </div>

      <button onClick={handleRun} disabled={state.running || files.length === 0}
        style={{ ...btnStyle, marginTop: 24, background: state.running ? '#555' : '#e94560',
          width: '100%', padding: '12px 0', fontSize: 16 }}>
        {state.running ? '处理中...' : '添加水印'}
      </button>

      <BatchProgress progress={state.progress} />
    </div>
  );
};
