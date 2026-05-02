import React, { useState } from 'react';
import { ImageList } from '../components/ImageList';
import { BatchProgress } from '../components/BatchProgress';
import { useBatch } from '../hooks/useBatch';

export const ConvertResize: React.FC = () => {
  const [files, setFiles] = useState<string[]>([]);
  const [convertTo, setConvertTo] = useState('');
  const [resizeMode, setResizeMode] = useState('');
  const [resizeValue, setResizeValue] = useState(100);
  const [resizeWidth, setResizeWidth] = useState(800);
  const [resizeHeight, setResizeHeight] = useState(600);
  const [outputDir, setOutputDir] = useState('');
  const [preserveOriginal, setPreserveOriginal] = useState(true);
  const [recursive, setRecursive] = useState(false);
  const { state, startBatch, cancelBatch, openOutputDir } = useBatch();

  const handleSelectFiles = async () => {
    try {
      const result = await (window as any).go.main.App.SelectFiles();
      if (result) setFiles(prev => [...prev, ...result]);
    } catch { /* no-op */ }
  };

  const handleSelectFolder = async () => {
    try {
      const dir = await (window as any).go.main.App.SelectDirectory();
      if (dir) {
        const scanned = await (window as any).go.main.App.ScanDirectory(dir, recursive);
        if (scanned) setFiles(scanned);
      }
    } catch { /* no-op */ }
  };

  const handleSelectOutputDir = async () => {
    try {
      const dir = await (window as any).go.main.App.SelectOutputDir();
      if (dir) setOutputDir(dir);
    } catch { /* no-op */ }
  };

  const handleRun = async () => {
    const req: any = {
      sourcePaths: files,
      outputDir: outputDir || (files.length > 0 ? files[0].substring(0, files[0].lastIndexOf('\\')) : ''),
      convertTo: convertTo || '',
      preserveOriginal,
    };
    if (resizeMode === 'ratio') {
      req.resizeMode = 'ratio';
      req.resizeValue = resizeValue / 100;
    } else if (resizeMode === 'dimensions') {
      req.resizeMode = 'dimensions';
      req.resizeWidth = resizeWidth;
      req.resizeHeight = resizeHeight;
    } else if (resizeMode === 'maxEdge') {
      req.resizeMode = 'maxEdge';
      req.resizeValue = resizeValue;
    }
    await startBatch('ProcessImagesBatch', req);
  };

  const handleCancel = async () => {
    await cancelBatch();
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
        <button onClick={handleSelectOutputDir} style={btnStyle}>输出目录</button>
        {outputDir && (
          <button onClick={() => openOutputDir(outputDir)} style={{ ...btnStyle, background: '#1a1a2e', border: '1px solid #333' }}>📂 打开</button>
        )}
      </div>

      {outputDir && (
        <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>输出目录: {outputDir}</div>
      )}

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
            <option value="dimensions">指定宽高</option>
            <option value="maxEdge">限制最大边</option>
          </select>
          {resizeMode === 'ratio' && (
            <>
              <input type="number" value={resizeValue} onChange={e => setResizeValue(Number(e.target.value))} style={inputStyle} min={1} />
              <span style={{ fontSize: 13, color: '#888' }}>%</span>
            </>
          )}
          {resizeMode === 'dimensions' && (
            <>
              <input type="number" value={resizeWidth} onChange={e => setResizeWidth(Number(e.target.value))} style={inputStyle} min={1} />
              <span style={{ fontSize: 13, color: '#888' }}>x</span>
              <input type="number" value={resizeHeight} onChange={e => setResizeHeight(Number(e.target.value))} style={inputStyle} min={1} />
              <span style={{ fontSize: 13, color: '#888' }}>px</span>
            </>
          )}
          {resizeMode === 'maxEdge' && (
            <>
              <input type="number" value={resizeValue} onChange={e => setResizeValue(Number(e.target.value))} style={inputStyle} min={1} />
              <span style={{ fontSize: 13, color: '#888' }}>px</span>
            </>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <label style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={preserveOriginal} onChange={e => setPreserveOriginal(e.target.checked)} style={{ accentColor: '#e94560' }} />
            保留原文件
          </label>
          <label style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={recursive} onChange={e => setRecursive(e.target.checked)} style={{ accentColor: '#e94560' }} />
            递归子目录
          </label>
        </div>

      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
        {state.running ? (
          <button onClick={handleCancel}
            style={{ ...btnStyle, background: '#dc2626', width: '100%', padding: '12px 0', fontSize: 16 }}>
            取消处理
          </button>
        ) : (
          <button onClick={handleRun} disabled={files.length === 0}
            style={{
              ...btnStyle, background: files.length === 0 ? '#555' : '#e94560',
              width: '100%', padding: '12px 0', fontSize: 16,
            }}>
            开始处理
          </button>
        )}
      </div>

      <BatchProgress progress={state.progress} />
      {state.result && (
        <div style={{ fontSize: 13, color: '#888', marginTop: 8, textAlign: 'center' }}>
          处理完成: {state.result.success || 0} 成功, {state.result.failed || 0} 失败
        </div>
      )}
    </div>
  );
};
