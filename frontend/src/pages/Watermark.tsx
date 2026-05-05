import React, { useState, useEffect } from 'react';
import { ImageList } from '../components/ImageList';
import { useBatch } from '../hooks/useBatch';
import { BatchProgress } from '../components/BatchProgress';
import { SaveModeSelector, SaveModeConfig } from '../components/SaveModeSelector';

export const Watermark: React.FC = () => {
  const [files, setFiles] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mode, setMode] = useState<'image' | 'text'>('image');
  const [watermarkImage, setWatermarkImage] = useState('');
  const [watermarkText, setWatermarkText] = useState('Watermark');
  const [fontSize, setFontSize] = useState(48);
  const [fontColor, setFontColor] = useState('#ffffff');
  const [opacity, setOpacity] = useState(1.0);
  const [position, setPosition] = useState('bottomRight');
  const [saveModeConfig, setSaveModeConfig] = useState<SaveModeConfig>({ mode: 'subdir', prefixName: 'output', subdirName: 'output', outputDir: '' });
  const [uniformWidth, setUniformWidth] = useState(false);
  const [uniformTarget, setUniformTarget] = useState(1440);
  const [outputWidth, setOutputWidth] = useState(false);
  const [outputTarget, setOutputTarget] = useState(1440);
  const { state, startBatch, cancelBatch, openOutputDir } = useBatch();
  
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [imageInfo, setImageInfo] = useState<any>(null);

  // Fetch image info when selected file changes
  useEffect(() => {
    if (files.length === 0) {
      setImageInfo(null);
      return;
    }
    const idx = selectedIndex >= files.length ? 0 : selectedIndex;
    (window as any).go.main.App.GetImageInfo(files[idx])
      .then((info: any) => setImageInfo(info))
      .catch(() => setImageInfo(null));
  }, [files, selectedIndex]);

  useEffect(() => {
    if (files.length === 0) {
      setPreviewDataUrl(null);
      return;
    }
    const idx = selectedIndex >= files.length ? 0 : selectedIndex;
    if (idx !== selectedIndex) {
      setSelectedIndex(idx);
    }
    
    let isCancelled = false;
    const timeout = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const sourcePath = files[idx];
        const dataUrl = await (window as any).go.main.App.PreviewWatermark({
          sourcePath,
          watermarkImage: mode === 'image' ? watermarkImage : '',
          watermarkText: mode === 'text' ? watermarkText : '',
          opacity,
          position,
          fontSize,
          fontColor,
        });
        if (!isCancelled && dataUrl) {
          setPreviewDataUrl(dataUrl);
        }
      } catch (e) {
        console.error("Preview failed:", e);
      } finally {
        if (!isCancelled) setPreviewLoading(false);
      }
    }, 300);

    return () => {
      isCancelled = true;
      clearTimeout(timeout);
    };
  }, [files, selectedIndex, mode, watermarkImage, watermarkText, opacity, position, fontSize, fontColor]);

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
      fontSize,
      fontColor,
      uniformWidth: uniformWidth ? uniformTarget : 0,
      outputWidth: outputWidth ? outputTarget : 0,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <h2 className="page-title">水印</h2>

      <div className="flex gap-6" style={{ alignItems: 'stretch', flex: 1, minHeight: 0 }}>
        {/* ── LEFT COLUMN: files ── */}
        <div style={{ flex: '0 0 22%', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="flex gap-3" style={{ flexWrap: 'wrap' }}>
              <button onClick={handleSelectFiles} className="btn btn-sm btn-primary">选择文件</button>
              <button onClick={handleSelectFolder} className="btn btn-sm btn-ghost">选择文件夹</button>
            </div>
            <div className="mt-4" style={{ flex: 1, minHeight: 0 }}>
              <ImageList files={files} onRemove={i => setFiles(files.filter((_, j) => j !== i))}
                onClear={() => setFiles([])} onDrop={paths => setFiles(prev => [...prev, ...paths])} onAddClick={handleSelectFiles} onPreview={setSelectedIndex} selectedIndex={selectedIndex} />
            </div>
          </div>
        </div>

        {/* ── MIDDLE COLUMN: Realtime Preview ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          {/* Preview Image */}
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="card-label">实时预览</span>
              <div className="flex items-center gap-4">
                {previewLoading && <span className="text-xs text-muted">渲染中...</span>}
                {previewDataUrl && (
                  <>
                    <button onClick={() => setPreviewZoom(z => Math.max(0.25, z - 0.25))} className="btn-icon" title="缩小" style={{ fontSize: 14 }}>−</button>
                    <span className="text-xs text-muted">{Math.round(previewZoom * 100)}%</span>
                    <button onClick={() => setPreviewZoom(z => Math.min(3, z + 0.25))} className="btn-icon" title="放大" style={{ fontSize: 14 }}>+</button>
                    <button onClick={() => setPreviewZoom(1)} className="btn-icon" title="重置" style={{ fontSize: 12 }}>↺</button>
                  </>
                )}
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg-inset)', borderRadius: 'var(--radius-lg)' }}>
              {previewDataUrl ? (
                <img src={previewDataUrl} style={{ transform: `scale(${previewZoom})`, transformOrigin: 'center center', maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', transition: 'transform 0.2s' }} alt="preview" />
              ) : (
                <span className="text-secondary text-sm">选择一张图片以预览</span>
              )}
            </div>
          </div>

          {/* Image Info Panel */}
          <div className="card" style={{ flexShrink: 0 }}>
            <div className="card-header">
              <span className="card-label">图片信息</span>
            </div>
            {imageInfo ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-muted">文件名</span>
                  <span className="text-sm" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{imageInfo.fileName || '-'}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-muted">格式</span>
                  <span className="text-sm">{imageInfo.format || '-'}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-muted">尺寸</span>
                  <span className="text-sm">{imageInfo.width && imageInfo.height ? `${imageInfo.width} × ${imageInfo.height} px` : '-'}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-muted">大小</span>
                  <span className="text-sm">{imageInfo.fileSize ? (imageInfo.fileSize > 1024 * 1024 ? `${(imageInfo.fileSize / 1024 / 1024).toFixed(2)} MB` : `${(imageInfo.fileSize / 1024).toFixed(1)} KB`) : '-'}</span>
                </div>
              </div>
            ) : (
              <span className="text-sm text-muted">暂无图片信息</span>
            )}
          </div>
        </div>

        {/* ── RIGHT COLUMN: config + action ── */}
        <div style={{ flex: '0 0 28%', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', minWidth: 0 }}>
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
                <>
                  <div className="form-row">
                    <label className="form-label">水印文字</label>
                    <input type="text" value={watermarkText} onChange={e => setWatermarkText(e.target.value)}
                      className="input" style={{ flex: 1 }} />
                  </div>
                  <div className="form-row">
                    <label className="form-label">文字大小</label>
                    <input type="number" value={fontSize} onChange={e => setFontSize(Number(e.target.value))}
                      className="input" style={{ width: 80 }} min={8} max={500} />
                    <span className="text-sm text-muted">px</span>
                  </div>
                  <div className="form-row">
                    <label className="form-label">文字颜色</label>
                    <input type="color" value={fontColor} onChange={e => setFontColor(e.target.value)}
                      style={{ width: 60, height: 32, cursor: 'pointer', padding: 0, border: 'none', background: 'transparent' }} />
                  </div>
                </>
              ) : (
                <div className="form-row" style={{ flexWrap: 'wrap' }}>
                  <label className="form-label">水印图片</label>
                  <div className="flex items-center gap-4" style={{ flex: 1, minWidth: 0 }}>
                    <span className="text-sm text-secondary" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                      {watermarkImage ? watermarkImage.split('\\').pop() : '未选择'}
                    </span>
                    <button onClick={handleSelectWatermark} className="btn btn-sm btn-primary" style={{ flexShrink: 0 }}>选择</button>
                  </div>
                </div>
              )}

              <div className="form-row">
                <label className="form-label">透明度</label>
                <input type="range" min="0" max="100" value={opacity * 100}
                  onChange={e => setOpacity(Number(e.target.value) / 100)}
                  style={{ width: 160 }} />
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
          <div className="mt-4 mb-4">
            {state.running ? (
              <button onClick={cancelBatch} className="btn btn-danger btn-lg btn-full">
                取消处理
              </button>
            ) : (
              <button onClick={handleRun} disabled={files.length === 0} className="btn btn-primary btn-lg btn-full">
                开始添加水印
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
