import React, { useState } from 'react';
import { GroupedFileList, FolderEntry } from '../components/GroupedFileList';
import { BatchProgress } from '../components/BatchProgress';
import { useBatch } from '../hooks/useBatch';
import { SaveModeSelector, SaveModeConfig } from '../components/SaveModeSelector';

export const ConvertResize: React.FC = () => {
  const [folders, setFolders] = useState<FolderEntry[]>([]);
  const [looseFiles, setLooseFiles] = useState<string[]>([]);
  const [recursive, setRecursive] = useState(true);
  const [convertTo, setConvertTo] = useState('');
  const [resizeMode, setResizeMode] = useState('');
  const [resizeValue, setResizeValue] = useState(100);
  const [resizeWidth, setResizeWidth] = useState(1440);
  const [resizeHeight, setResizeHeight] = useState(600);
  const [saveModeConfig, setSaveModeConfig] = useState<SaveModeConfig>({ mode: 'subdir', prefixName: 'output', subdirName: 'output', outputDir: '' });
  const { state, startBatch, cancelBatch, openOutputDir } = useBatch();
  const allFiles = [...folders.flatMap(f => f.scannedFiles), ...looseFiles];

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
          <GroupedFileList
            folders={folders}
            looseFiles={looseFiles}
            onAddFiles={handleSelectFiles}
            onAddFolder={handleSelectFolder}
            onRemoveFolder={(i) => setFolders(prev => prev.filter((_, j) => j !== i))}
            onRemoveFile={(i) => setLooseFiles(prev => prev.filter((_, j) => j !== i))}
            onClear={() => { setFolders([]); setLooseFiles([]); }}
          />
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

              <div className="form-row">
                <label className="checkbox-label">
                  <input type="checkbox" checked={recursive} onChange={e => handleRecursiveChange(e.target.checked)} />
                  递归子目录
                </label>
                {folders.length > 0 && <span className="text-xs text-muted ml-4">更改后将重新扫描所有文件夹</span>}
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
