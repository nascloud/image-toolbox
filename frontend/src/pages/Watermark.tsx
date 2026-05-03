import React, { useState } from 'react';
import { ImageList } from '../components/ImageList';
import { useBatch } from '../hooks/useBatch';
import { BatchProgress } from '../components/BatchProgress';
import { SaveModeSelector, SaveModeConfig } from '../components/SaveModeSelector';

export const Watermark: React.FC = () => {
  const [files, setFiles] = useState<string[]>([]);
  const [mode, setMode] = useState<'image' | 'text'>('image');
  const [watermarkImage, setWatermarkImage] = useState('');
  const [watermarkText, setWatermarkText] = useState('Watermark');
  const [opacity, setOpacity] = useState(1.0);
  const [position, setPosition] = useState('bottomRight');
  const [saveModeConfig, setSaveModeConfig] = useState<SaveModeConfig>({ mode: 'subdir', prefixName: 'output', subdirName: 'output', outputDir: '' });
  const [uniformWidth, setUniformWidth] = useState(false);
  const [uniformTarget, setUniformTarget] = useState(1440);
  const [outputWidth, setOutputWidth] = useState(false);
  const [outputTarget, setOutputTarget] = useState(1440);
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
        const scanned = await (window as any).go.main.App.ScanDirectory(dir, true);
        if (scanned) setFiles(prev => [...prev, ...scanned]);
        if (!saveModeConfig.outputDir) setSaveModeConfig(prev => ({ ...prev, outputDir: dir }));
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
      if (dir) setSaveModeConfig(prev => ({ ...prev, outputDir: dir }));
    } catch { /* no-op */ }
  };

  const handleRun = async () => {
    if (mode === 'image' && !watermarkImage) {
      // fallback to text mode with current text
      setMode('text');
    }
    await startBatch('WatermarkImages', {
      sourcePaths: files,
      outputDir: saveModeConfig.mode === 'custom'
        ? (saveModeConfig.outputDir || (files.length > 0 ? files[0].substring(0, files[0].lastIndexOf('\\')) : ''))
        : '',
      saveMode: saveModeConfig.mode,
      prefixName: saveModeConfig.prefixName,
      subdirName: saveModeConfig.subdirName,
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

  return (
    <div>
      <h2 className="page-title">水印</h2>

      <div className="flex gap-8" style={{ alignItems: 'stretch' }}>
        {/* ── LEFT COLUMN: files ── */}
        <div style={{ width: '35%', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="flex gap-3" style={{ flexWrap: 'wrap' }}>
              <button onClick={handleSelectFiles} className="btn btn-sm btn-primary">选择文件</button>
              <button onClick={handleSelectFolder} className="btn btn-sm btn-ghost">选择文件夹</button>
            </div>
            <div className="mt-4" style={{ flex: 1, minHeight: 0 }}>
              <ImageList files={files} onRemove={i => setFiles(files.filter((_, j) => j !== i))}
                onClear={() => setFiles([])} onDrop={paths => setFiles(prev => [...prev, ...paths])} onAddClick={handleSelectFiles} />
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN: config + action ── */}
        <div style={{ width: '65%', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SaveModeSelector
            config={saveModeConfig}
            onChange={setSaveModeConfig}
            onSelectOutputDir={handleSelectOutputDir}
            onOpenOutputDir={() => openOutputDir(saveModeConfig.outputDir)}
          />

          <div className="card">
            <div className="card-header">
              <span className="card-label">水印参数</span>
            </div>

            <div className="flex-col gap-6" style={{ display: 'flex' }}>
              <div className="form-row">
                <label className="form-label">水印类型</label>
                <select value={mode} onChange={e => setMode(e.target.value as 'image' | 'text')} className="select" style={{ width: 160 }}>
                  <option value="text">文字水印</option>
                  <option value="image">图片水印</option>
                </select>
              </div>

              {mode === 'text' ? (
                <div className="form-row">
                  <label className="form-label">水印文字</label>
                  <input type="text" value={watermarkText} onChange={e => setWatermarkText(e.target.value)}
                    className="input" style={{ flex: 1 }} />
                </div>
              ) : (
                <div className="form-row">
                  <label className="form-label">水印图片</label>
                  <span className="text-sm text-secondary" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {watermarkImage || '未选择'}
                  </span>
                  <button onClick={handleSelectWatermark} className="btn btn-sm btn-primary">选择图片</button>
                </div>
              )}

              <div className="form-row">
                <label className="form-label">透明度</label>
                <input type="range" min="0" max="100" value={opacity * 100}
                  onChange={e => setOpacity(Number(e.target.value) / 100)}
                  style={{ width: 200 }} />
                <span className="text-sm text-muted" style={{ minWidth: 32 }}>{Math.round(opacity * 100)}%</span>
              </div>

              <div className="form-row">
                <label className="form-label">位置</label>
                <select value={position} onChange={e => setPosition(e.target.value)} className="select" style={{ width: 160 }}>
                  <option value="tile">平铺</option>
                  <option value="center">居中</option>
                  <option value="bottomRight">右下角</option>
                  <option value="topLeft">左上角</option>
                </select>
              </div>

              <div className="form-row">
                <label className="checkbox-label" style={{ minWidth: 140 }}>
                  <input type="checkbox" checked={uniformWidth} onChange={e => setUniformWidth(e.target.checked)} />
                  统一输入宽度
                </label>
                {uniformWidth && (
                  <>
                    <input type="number" value={uniformTarget} onChange={e => setUniformTarget(Number(e.target.value))}
                      className="input" style={{ width: 80 }} min={1} />
                    <span className="text-sm text-muted">px</span>
                  </>
                )}
              </div>

              <div className="form-row">
                <label className="checkbox-label" style={{ minWidth: 140 }}>
                  <input type="checkbox" checked={outputWidth} onChange={e => setOutputWidth(e.target.checked)} />
                  统一输出宽度
                </label>
                {outputWidth && (
                  <>
                    <input type="number" value={outputTarget} onChange={e => setOutputTarget(Number(e.target.value))}
                      className="input" style={{ width: 80 }} min={1} />
                    <span className="text-sm text-muted">px</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Action */}
          <div className="mt-8">
            {state.running ? (
              <button onClick={cancelBatch} className="btn btn-danger btn-lg btn-full">
                取消处理
              </button>
            ) : (
              <button onClick={handleRun} disabled={files.length === 0} className="btn btn-primary btn-lg btn-full">
                添加水印
              </button>
            )}
          </div>

          <BatchProgress progress={state.progress} />
          {state.result && (
            <div className="result-summary">
              处理完成: {state.result.success || 0} 成功, {state.result.failed || 0} 失败
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
