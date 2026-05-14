import React, { useState } from 'react';
import { ImageList } from '../components/ImageList';
import { BatchProgress } from '../components/BatchProgress';
import { useBatch } from '../hooks/useBatch';
import { SaveModeSelector, SaveModeConfig } from '../components/SaveModeSelector';
import { FolderSourceList, FolderSource } from '../components/FolderSourceList';

export const ConvertResize: React.FC = () => {
  const [sources, setSources] = useState<FolderSource[]>([]);
  const [looseFiles, setLooseFiles] = useState<string[]>([]);
  const [convertTo, setConvertTo] = useState('');
  const [resizeMode, setResizeMode] = useState('');
  const [resizeValue, setResizeValue] = useState(100);
  const [resizeWidth, setResizeWidth] = useState(1440);
  const [resizeHeight, setResizeHeight] = useState(600);
  const [saveModeConfig, setSaveModeConfig] = useState<SaveModeConfig>({ mode: 'subdir', prefixName: 'output', subdirName: 'output', outputDir: '' });
  const { state, startBatch, cancelBatch, openOutputDir } = useBatch();
  const allFiles = [...sources.flatMap(s => s.scannedFiles), ...looseFiles];

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
        const scanned = await (window as any).go.main.App.ScanDirectory(dir, false);
        if (scanned) {
          setSources(prev => {
            if (prev.some(s => s.path === dir)) return prev;
            return [...prev, { path: dir, recursive: false, scannedFiles: scanned }];
          });
        }
      }
    } catch { /* no-op */ }
  };

  const handleSelectOutputDir = async () => {
    try {
      const dir = await (window as any).go.main.App.SelectOutputDir();
      if (dir) setSaveModeConfig(prev => ({ ...prev, outputDir: dir }));
    } catch { /* no-op */ }
  };

  const handleRun = async () => {
    const req: any = {
      sourcePaths: allFiles,
      outputDir: saveModeConfig.mode === 'custom'
        ? (saveModeConfig.outputDir || (allFiles.length > 0 ? allFiles[0].substring(0, allFiles[0].lastIndexOf('\\')) : ''))
        : '',
      saveMode: saveModeConfig.mode,
      prefixName: saveModeConfig.prefixName,
      subdirName: saveModeConfig.subdirName,
      convertTo: convertTo || '',
    };
    if (resizeMode === 'ratio') {
      req.resizeMode = 'ratio';
      req.resizeValue = resizeValue / 100;
    } else if (resizeMode === 'dimensions') {
      req.resizeMode = 'dimensions';
      req.resizeWidth = resizeWidth;
      req.resizeHeight = resizeHeight;
    } else if (resizeMode === 'width') {
      req.resizeMode = 'width';
      req.resizeWidth = resizeWidth;
    } else if (resizeMode === 'maxEdge') {
      req.resizeMode = 'maxEdge';
      req.resizeValue = resizeValue;
    }
    await startBatch('ProcessImagesBatch', req);
  };

  const handleCancel = async () => {
    await cancelBatch();
  };

  return (
    <div>
      <h2 className="page-title">转换</h2>

      <div className="flex gap-8" style={{ alignItems: 'stretch' }}>
        {/* ── LEFT COLUMN: files ── */}
        <div style={{ width: '35%', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <FolderSourceList
                sources={sources}
                looseFiles={looseFiles}
                onAddFiles={handleSelectFiles}
                onAddFolder={handleSelectFolder}
                onRemoveSource={(i) => setSources(prev => prev.filter((_, j) => j !== i))}
                onRescan={async (i, recursive) => {
                  const src = sources[i];
                  if (!src) return;
                  const path = src.path;
                  try {
                    const scanned = await (window as any).go.main.App.ScanDirectory(path, recursive);
                    if (scanned) {
                      setSources(prev => prev.map(s => s.path === path ? { ...s, recursive, scannedFiles: scanned } : s));
                    }
                  } catch { /* no-op */ }
                }}
                onClear={() => { setSources([]); setLooseFiles([]); }}
              />
              <div className="mt-4" style={{ flex: 1, minHeight: 0 }}>
                <ImageList files={allFiles} onRemove={i => setLooseFiles(prev => {
                  const looseIdx = i - sources.flatMap(s => s.scannedFiles).length;
                  if (looseIdx >= 0 && looseIdx < prev.length) {
                    return prev.filter((_, j) => j !== looseIdx);
                  }
                  return prev;
                })} onClear={() => { setSources([]); setLooseFiles([]); }} onDrop={paths => setLooseFiles(prev => [...prev, ...paths.filter(p => !prev.includes(p))])} onAddClick={handleSelectFiles} />
              </div>
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
              <span className="card-label">处理参数</span>
            </div>

            <div className="flex-col gap-6" style={{ display: 'flex' }}>
              <div className="form-row">
                <label className="form-label">格式转换</label>
                <select value={convertTo} onChange={e => setConvertTo(e.target.value)} className="select" style={{ width: 160 }}>
                  <option value="">不转换</option>
                  <option value="jpg">JPEG</option>
                  <option value="png">PNG</option>
                  <option value="webp">WebP</option>
                </select>
              </div>

              <div className="form-row">
                <label className="form-label">缩放</label>
                <select value={resizeMode} onChange={e => setResizeMode(e.target.value)} className="select" style={{ width: 160 }}>
                  <option value="">不缩放</option>
                  <option value="ratio">按比例</option>
                  <option value="dimensions">指定宽高</option>
                  <option value="width">指定宽度</option>
                  <option value="maxEdge">限制最大边</option>
                </select>
                {resizeMode === 'ratio' && (
                  <>
                    <input type="number" value={resizeValue} onChange={e => setResizeValue(Number(e.target.value))} className="input" style={{ width: 80 }} min={1} />
                    <span className="text-sm text-muted">%</span>
                  </>
                )}
                {resizeMode === 'dimensions' && (
                  <>
                    <input type="number" value={resizeWidth} onChange={e => setResizeWidth(Number(e.target.value))} className="input" style={{ width: 80 }} min={1} />
                    <span className="text-sm text-muted">x</span>
                    <input type="number" value={resizeHeight} onChange={e => setResizeHeight(Number(e.target.value))} className="input" style={{ width: 80 }} min={1} />
                    <span className="text-sm text-muted">px</span>
                  </>
                )}
                {resizeMode === 'width' && (
                  <>
                    <input type="number" value={resizeWidth} onChange={e => setResizeWidth(Number(e.target.value))} className="input" style={{ width: 80 }} min={1} />
                    <span className="text-sm text-muted">px (高自适应)</span>
                  </>
                )}
                {resizeMode === 'maxEdge' && (
                  <>
                    <input type="number" value={resizeValue} onChange={e => setResizeValue(Number(e.target.value))} className="input" style={{ width: 80 }} min={1} />
                    <span className="text-sm text-muted">px</span>
                  </>
                )}
              </div>


            </div>
          </div>

          {/* Action */}
          <div className="mt-8">
            {state.running ? (
              <button onClick={handleCancel} className="btn btn-danger btn-lg btn-full">
                取消处理
              </button>
            ) : (
              <button onClick={handleRun} disabled={allFiles.length === 0} className="btn btn-primary btn-lg btn-full">
                开始处理
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
