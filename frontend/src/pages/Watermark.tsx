import React, { useState, useEffect } from 'react';
import { GroupedFileList, FolderEntry } from '../components/GroupedFileList';
import { useBatch } from '../hooks/useBatch';
import { BatchProgress } from '../components/BatchProgress';
import { SaveModeSelector, SaveModeConfig } from '../components/SaveModeSelector';

export const Watermark: React.FC = () => {
  const [folders, setFolders] = useState<FolderEntry[]>([]);
  const [looseFiles, setLooseFiles] = useState<string[]>([]);
  const [recursive, setRecursive] = useState(true);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
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

  const allFiles = [...folders.flatMap(f => f.scannedFiles), ...looseFiles];

  // Auto-select first file when allFiles changes
  useEffect(() => {
    if (allFiles.length === 0) {
      setSelectedPath(null);
      setImageInfo(null);
      setPreviewDataUrl(null);
      return;
    }
    if (!selectedPath || !allFiles.includes(selectedPath)) {
      setSelectedPath(allFiles[0]);
    }
  }, [folders, looseFiles]);

  // Fetch image info when selected file changes
  useEffect(() => {
    if (!selectedPath) { setImageInfo(null); return; }
    (window as any).go.main.App.GetImageInfo(selectedPath)
      .then((info: any) => setImageInfo(info))
      .catch(() => setImageInfo(null));
  }, [selectedPath]);

  // Preview watermark
  useEffect(() => {
    if (!selectedPath) { setPreviewDataUrl(null); return; }

    let isCancelled = false;
    const timeout = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const dataUrl = await (window as any).go.main.App.PreviewWatermark({
          sourcePath: selectedPath,
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
  }, [selectedPath, mode, watermarkImage, watermarkText, opacity, position, fontSize, fontColor]);

  const handleSelectFiles = async () => {
    try {
      const result = await (window as any).go.main.App.SelectFiles();
      if (result) setLooseFiles(prev => [...prev, ...result.filter((p: string) => !prev.includes(p))]);
    } catch { /* no-op */ }
  };

  const handleSelectFolder = async () => {
    try {
      const dir = await (window as any).go.main.App.SelectDirectory();
      if (dir) {
        const scanned = await (window as any).go.main.App.ScanDirectory(dir, recursive);
        if (scanned) {
          setFolders(prev => {
            if (prev.some(f => f.path === dir)) return prev;
            return [...prev, { path: dir, scannedFiles: scanned }];
          });
        }
        if (!saveModeConfig.outputDir) setSaveModeConfig(prev => ({ ...prev, outputDir: dir }));
      }
    } catch { /* no-op */ }
  };

  const handleRecursiveChange = async (v: boolean) => {
    setRecursive(v);
    const updated = await Promise.all(folders.map(f =>
      (window as any).go.main.App.ScanDirectory(f.path, v)
        .then((scanned: string[]) => ({ path: f.path, scannedFiles: scanned || [] }))
    ));
    setFolders(updated);
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
      sourcePaths: allFiles,
      outputDir: saveModeConfig.mode === 'custom'
        ? (saveModeConfig.outputDir || (allFiles.length > 0 ? allFiles[0].substring(0, allFiles[0].lastIndexOf('\\')) : ''))
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
          <GroupedFileList
            folders={folders}
            looseFiles={looseFiles}
            onAddFiles={handleSelectFiles}
            onAddFolder={handleSelectFolder}
            onRemoveFolder={(i) => setFolders(prev => prev.filter((_, j) => j !== i))}
            onRemoveFile={(i) => setLooseFiles(prev => prev.filter((_, j) => j !== i))}
            onClear={() => { setFolders([]); setLooseFiles([]); }}
            onPreview={setSelectedPath}
            selectedPath={selectedPath || undefined}
          />
        </div>

        {/* ── MIDDLE COLUMN: Realtime Preview ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
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

              <div className="form-row">
                <label className="checkbox-label">
                  <input type="checkbox" checked={recursive} onChange={e => handleRecursiveChange(e.target.checked)} />
                  递归子目录
                </label>
                {folders.length > 0 && <span className="text-xs text-muted ml-4">更改后将重新扫描</span>}
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
              <button onClick={handleRun} disabled={allFiles.length === 0} className="btn btn-primary btn-lg btn-full">
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
