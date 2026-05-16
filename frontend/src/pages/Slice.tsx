import React, { useState, useEffect } from 'react';
import { GroupedFileList, FolderEntry } from '../components/GroupedFileList';
import { useBatch } from '../hooks/useBatch';
import { useProgressContext } from '../hooks/useProgress';
import { SaveModeSelector, SaveModeConfig } from '../components/SaveModeSelector';

export const Slice: React.FC = () => {
  const [folders, setFolders] = useState<FolderEntry[]>([]);
  const [looseFiles, setLooseFiles] = useState<string[]>([]);
  const [recursive, setRecursive] = useState(true);
  const [sliceCount, setSliceCount] = useState(25);
  const [contrast, setContrast] = useState(1.0);
  const [saturation, setSaturation] = useState(1.0);
  const [sliceMode, setSliceMode] = useState<'count' | 'height'>('count');
  const [sliceHeight, setSliceHeight] = useState(1200);
  const [saveModeConfig, setSaveModeConfig] = useState<SaveModeConfig>({ mode: 'subdir', prefixName: 'output', subdirName: 'output', outputDir: '' });
  const { state, startBatch, cancelBatch, openOutputDir } = useBatch();
  const { setIdleText } = useProgressContext();
  const allFiles = [...folders.flatMap(f => f.scannedFiles), ...looseFiles];

  useEffect(() => {
    const count = allFiles.length;
    setIdleText(count > 0 ? `${count} 张图片 · 就绪` : '0 张图片 · 就绪');
  }, [allFiles, setIdleText]);

  // Auto-recommend slice height = width × 1.5, so each slice satisfies
  // Taobao's 宝贝详情图 restriction (h/w ≤ 2).
  useEffect(() => {
    if (sliceMode !== 'height' || allFiles.length === 0) return;
    (async () => {
      try {
        const info = await (window as any).go.main.App.GetImageInfo(allFiles[0]);
        if (info?.width) {
          setSliceHeight(Math.max(1, Math.round(info.width * 1.5)));
        }
      } catch { /* ignore */ }
    })();
  }, [sliceMode, allFiles[0]]);

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

  const handleSelectOutputDir = async () => {
    try {
      const dir = await (window as any).go.main.App.SelectOutputDir();
      if (dir) setSaveModeConfig(prev => ({ ...prev, outputDir: dir }));
    } catch { /* no-op */ }
  };

  const handleRun = async () => {
    await startBatch('SliceImages', {
      sourcePaths: allFiles,
      outputDir: saveModeConfig.mode === 'custom'
        ? (saveModeConfig.outputDir || (allFiles.length > 0 ? allFiles[0].substring(0, allFiles[0].lastIndexOf('\\')) : ''))
        : '',
      saveMode: saveModeConfig.mode,
      prefixName: saveModeConfig.prefixName,
      subdirName: saveModeConfig.subdirName,
      sliceMode,
      sliceCount,
      sliceHeight: sliceMode === 'height' ? sliceHeight : 0,
      contrast,
      saturation,
    });
  };

  return (
    <div>
      <h2 className="page-title">图片切片</h2>

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
            onDropFiles={(paths) => setLooseFiles(prev => [...prev, ...paths.filter(p => !prev.includes(p))])}
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
              <span className="card-label">切片参数</span>
            </div>

            <div className="flex-col gap-6" style={{ display: 'flex' }}>
              <div className="form-row">
                <label className="form-label">切片方式</label>
                <select value={sliceMode} onChange={e => setSliceMode(e.target.value as 'count' | 'height')} className="select" style={{ width: 160 }}>
                  <option value="count">按数量切片</option>
                  <option value="height">按高度切片</option>
                </select>
              </div>
              {sliceMode === 'count' ? (
                <div className="form-row">
                  <label className="form-label">切片数量</label>
                  <input type="number" value={sliceCount}
                    onChange={e => setSliceCount(Math.max(1, Number(e.target.value)))}
                    className="input" style={{ width: 100 }} min={1} max={1000} />
                </div>
              ) : (
                <div className="form-row">
                  <label className="form-label">切片高度</label>
                  <input type="number" value={sliceHeight}
                    onChange={e => setSliceHeight(Math.max(1, Number(e.target.value)))}
                    className="input" style={{ width: 100 }} min={1} />
                  <span className="text-sm text-muted">px</span>
                </div>
              )}
              <div className="form-row">
                <label className="form-label">对比度</label>
                <input type="range" min="10" max="200" value={contrast * 100}
                  onChange={e => setContrast(Number(e.target.value) / 100)}
                  style={{ width: 200 }} />
                <span className="text-sm text-muted" style={{ minWidth: 32 }}>{contrast.toFixed(1)}</span>
              </div>
              <div className="form-row">
                <label className="form-label">饱和度</label>
                <input type="range" min="10" max="200" value={saturation * 100}
                  onChange={e => setSaturation(Number(e.target.value) / 100)}
                  style={{ width: 200 }} />
                <span className="text-sm text-muted" style={{ minWidth: 32 }}>{saturation.toFixed(1)}</span>
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
              <button onClick={cancelBatch} className="btn btn-danger btn-lg btn-full">
                取消处理
              </button>
            ) : (
              <button onClick={handleRun} disabled={allFiles.length === 0} className="btn btn-primary btn-lg btn-full">
                开始切片
              </button>
            )}
          </div>

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
