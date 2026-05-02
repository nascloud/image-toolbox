import React, { useState } from 'react';
import { ImageList } from '../components/ImageList';
import { BatchProgress } from '../components/BatchProgress';
import { useBatch } from '../hooks/useBatch';

export const ConvertResize: React.FC = () => {
  const [files, setFiles] = useState<string[]>([]);
  const [convertTo, setConvertTo] = useState('');
  const [resizeMode, setResizeMode] = useState('');
  const [resizeValue, setResizeValue] = useState(100);
  const [outputDir, setOutputDir] = useState('');
  const { state, startBatch } = useBatch();

  const handleSelectFiles = async () => {
    try {
      const result = await (window as any).go.main.App.SelectFiles();
      if (result) setFiles(prev => [...prev, ...result]);
    } catch { /* Wails dialog — no-op if not available */ }
  };

  const handleSelectFolder = async () => {
    try {
      const dir = await (window as any).go.main.App.SelectDirectory();
      if (dir) {
        setOutputDir(dir);
        const scanned = await (window as any).go.main.App.ScanDirectory(dir, false);
        if (scanned) setFiles(scanned);
      }
    } catch { /* no-op */ }
  };

  const handleRun = async () => {
    await startBatch({
      sourcePaths: files,
      outputDir: outputDir || (files.length > 0 ? files[0].substring(0, files[0].lastIndexOf('\\')) : ''),
      convertTo: convertTo || '',
      resizeMode: resizeMode || '',
      resizeValue: resizeValue / 100,
      preserveOriginal: true,
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

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px', background: '#1a1a2e', color: '#fff',
    border: '1px solid #333', borderRadius: 6, fontSize: 14, width: 80,
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 20px', fontSize: 22, fontWeight: 600 }}>格式转换 + 缩放</h2>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <button onClick={handleSelectFiles} style={btnStyle}>选择文件</button>
        <button onClick={handleSelectFolder} style={btnStyle}>选择文件夹</button>
      </div>

      <ImageList files={files} onRemove={i => setFiles(files.filter((_, j) => j !== i))} onClear={() => setFiles([])} />

      <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ fontSize: 14, minWidth: 80 }}>格式转换</label>
          <select value={convertTo} onChange={e => setConvertTo(e.target.value)} style={selectStyle}>
            <option value="">不转换</option>
            <option value="jpg">JPEG</option>
            <option value="png">PNG</option>
            <option value="webp">WebP</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ fontSize: 14, minWidth: 80 }}>缩放</label>
          <select value={resizeMode} onChange={e => setResizeMode(e.target.value)} style={selectStyle}>
            <option value="">不缩放</option>
            <option value="ratio">按比例</option>
            <option value="maxEdge">限制最大边</option>
          </select>
          {(resizeMode === 'ratio' || resizeMode === 'maxEdge') && (
            <>
              <input type="number" value={resizeValue}
                onChange={e => setResizeValue(Number(e.target.value))}
                style={inputStyle} min={1} />
              <span style={{ fontSize: 13, color: '#888' }}>{resizeMode === 'ratio' ? '%' : 'px'}</span>
            </>
          )}
        </div>
      </div>

      <button
        onClick={handleRun}
        disabled={state.running || files.length === 0}
        style={{
          ...btnStyle, marginTop: 24,
          background: state.running ? '#555' : '#e94560',
          width: '100%', padding: '12px 0', fontSize: 16,
        }}
      >
        {state.running ? '处理中...' : '开始处理'}
      </button>

      <BatchProgress progress={state.progress} />
    </div>
  );
};
