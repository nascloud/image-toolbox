import React, { useState } from 'react';
import { ImageList } from '../components/ImageList';
import { useBatch } from '../hooks/useBatch';
import { BatchProgress } from '../components/BatchProgress';

export const Slice: React.FC = () => {
  const [files, setFiles] = useState<string[]>([]);
  const [sliceCount, setSliceCount] = useState(25);
  const [contrast, setContrast] = useState(1.0);
  const [saturation, setSaturation] = useState(1.0);
  const { state, startBatch } = useBatch();

  const handleSelectFolder = async () => {
    try {
      const dir = await (window as any).go.main.App.SelectDirectory();
      if (dir) {
        const scanned = await (window as any).go.main.App.ScanDirectory(dir, false);
        if (scanned) setFiles(scanned);
      }
    } catch { /* no-op */ }
  };

  const handleRun = async () => {
    const outputDir = files.length > 0
      ? files[0].substring(0, files[0].lastIndexOf('\\'))
      : '';
    await startBatch({
      sourcePaths: files,
      outputDir,
      sliceCount,
      contrast,
      saturation,
    });
  };

  const btnStyle: React.CSSProperties = {
    padding: '8px 20px', background: '#0f3460', color: '#fff',
    border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14,
  };
  const inputStyle: React.CSSProperties = {
    padding: '8px 12px', background: '#1a1a2e', color: '#fff',
    border: '1px solid #333', borderRadius: 6, fontSize: 14, width: 80,
  };
  const labelStyle: React.CSSProperties = { fontSize: 14, minWidth: 80 };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 20px', fontSize: 22, fontWeight: 600 }}>图片切片</h2>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <button onClick={handleSelectFolder} style={btnStyle}>选择文件夹</button>
      </div>

      <ImageList files={files} onRemove={i => setFiles(files.filter((_, j) => j !== i))}
        onClear={() => setFiles([])} />

      <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={labelStyle}>切片数量</label>
          <input type="number" value={sliceCount}
            onChange={e => setSliceCount(Math.max(1, Number(e.target.value)))}
            style={inputStyle} min={1} max={1000} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={labelStyle}>对比度</label>
          <input type="range" min="10" max="200" value={contrast * 100}
            onChange={e => setContrast(Number(e.target.value) / 100)}
            style={{ width: 200 }} />
          <span style={{ fontSize: 13, color: '#888' }}>{contrast.toFixed(1)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={labelStyle}>饱和度</label>
          <input type="range" min="10" max="200" value={saturation * 100}
            onChange={e => setSaturation(Number(e.target.value) / 100)}
            style={{ width: 200 }} />
          <span style={{ fontSize: 13, color: '#888' }}>{saturation.toFixed(1)}</span>
        </div>
      </div>

      <button onClick={handleRun} disabled={state.running || files.length === 0}
        style={{ ...btnStyle, marginTop: 24, background: state.running ? '#555' : '#e94560',
          width: '100%', padding: '12px 0', fontSize: 16 }}>
        {state.running ? '处理中...' : '开始切片'}
      </button>

      <BatchProgress progress={state.progress} />
    </div>
  );
};
