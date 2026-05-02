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
  const [outputDir, setOutputDir] = useState('');
  const [uniformWidth, setUniformWidth] = useState(false);
  const [uniformTarget, setUniformTarget] = useState(1440);
  const [outputWidth, setOutputWidth] = useState(false);
  const [outputTarget, setOutputTarget] = useState(1440);
  const { state, startBatch, cancelBatch, openOutputDir } = useBatch();

  const handleSelectFolder = async () => {
    try {
      const dir = await (window as any).go.main.App.SelectDirectory();
      if (dir) {
        const scanned = await (window as any).go.main.App.ScanDirectory(dir, true);
        if (scanned) setFiles(scanned);
        if (!outputDir) setOutputDir(dir);
      }
    } catch { /* no-op */ }
  };

  const handleSelectWatermark = async () => {
    try {
      const result = await (window as any).go.main.App.SelectFiles();
      if (result && result.length > 0) setWatermarkImage(result[0]);
    } catch { /* no-op */ }
  };

  const handleSelectOutputDir = async () => {
    try {
      const dir = await (window as any).go.main.App.SelectOutputDir();
      if (dir) setOutputDir(dir);
    } catch { /* no-op */ }
  };

  const handleRun = async () => {
    await startBatch('WatermarkImages', {
      sourcePaths: files,
      outputDir: outputDir || (files.length > 0 ? files[0].substring(0, files[0].lastIndexOf('\\')) : ''),
      watermarkImage: mode === 'image' ? watermarkImage : '',
      watermarkText: mode === 'text' ? watermarkText : '',
      opacity,
      position,
      fontSize: 12,
      fontColor: '#ffffff',
      uniformWidth: uniformWidth ? uniformTarget : 0,
      outputWidth: outputWidth ? outputTarget : 0,
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
      <h2 style={{ margin: '0 0 20px', fontSize: 22, fontWeight: 600 }}>水印</h2>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <button onClick={handleSelectFolder} style={btnStyle}>选择图片文件夹</button>
        <button onClick={handleSelectOutputDir} style={btnStyle}>输出目录</button>
        {outputDir && (
          <button onClick={() => openOutputDir(outputDir)} style={{ ...btnStyle, background: '#1a1a2e', border: '1px solid #333' }}>📂 打开</button>
        )}
      </div>

      {outputDir && (
        <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>输出目录: {outputDir}</div>
      )}

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
            <input type="text" value={watermarkText} onChange={e => setWatermarkText(e.target.value)}
              style={{ padding: '8px 12px', background: '#1a1a2e', color: '#fff',
                border: '1px solid #333', borderRadius: 6, fontSize: 14, flex: 1 }} />
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <label style={{ fontSize: 14, minWidth: 80 }}>水印图片</label>
            <span style={{ fontSize: 13, color: '#ccc', flex: 1 }}>{watermarkImage || '未选择'}</span>
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={uniformWidth} onChange={e => setUniformWidth(e.target.checked)} style={{ accentColor: '#e94560' }} />
            统一输入宽度
          </label>
          {uniformWidth && (
            <>
              <input type="number" value={uniformTarget} onChange={e => setUniformTarget(Number(e.target.value))} style={inputStyle} min={1} />
              <span style={{ fontSize: 13, color: '#888' }}>px</span>
            </>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={outputWidth} onChange={e => setOutputWidth(e.target.checked)} style={{ accentColor: '#e94560' }} />
            统一输出宽度
          </label>
          {outputWidth && (
            <>
              <input type="number" value={outputTarget} onChange={e => setOutputTarget(Number(e.target.value))} style={inputStyle} min={1} />
              <span style={{ fontSize: 13, color: '#888' }}>px</span>
            </>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
        {state.running ? (
          <button onClick={cancelBatch}
            style={{ ...btnStyle, background: '#dc2626', width: '100%', padding: '12px 0', fontSize: 16 }}>
            取消处理
          </button>
        ) : (
          <button onClick={handleRun} disabled={files.length === 0}
            style={{ ...btnStyle, marginTop: 0, background: files.length === 0 ? '#555' : '#e94560',
              width: '100%', padding: '12px 0', fontSize: 16 }}>
            添加水印
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
