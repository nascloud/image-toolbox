import React, { useState } from 'react';
import { ImageList } from '../components/ImageList';
import { BatchProgress } from '../components/BatchProgress';
import { useBatch } from '../hooks/useBatch';
import { SaveModeSelector, SaveModeConfig } from '../components/SaveModeSelector';

export const Slice: React.FC = () => {
  const [files, setFiles] = useState<string[]>([]);
  const [sliceCount, setSliceCount] = useState(25);
  const [contrast, setContrast] = useState(1.0);
  const [saturation, setSaturation] = useState(1.0);
  const [saveModeConfig, setSaveModeConfig] = useState<SaveModeConfig>({ mode: 'subdir', prefixName: 'output', subdirName: 'output', outputDir: '' });
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
        const scanned = await (window as any).go.main.App.ScanDirectory(dir, false);
        if (scanned) setFiles(prev => [...prev, ...scanned]);
        if (!saveModeConfig.outputDir) setSaveModeConfig(prev => ({ ...prev, outputDir: dir }));
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
    await startBatch('SliceImages', {
      sourcePaths: files,
      outputDir: saveModeConfig.mode === 'custom'
        ? (saveModeConfig.outputDir || (files.length > 0 ? files[0].substring(0, files[0].lastIndexOf('\\')) : ''))
        : '',
      saveMode: saveModeConfig.mode,
      prefixName: saveModeConfig.prefixName,
      subdirName: saveModeConfig.subdirName,
      sliceCount,
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
              <span className="card-label">切片参数</span>
            </div>

            <div className="flex-col gap-6" style={{ display: 'flex' }}>
              <div className="form-row">
                <label className="form-label">切片数量</label>
                <input type="number" value={sliceCount}
                  onChange={e => setSliceCount(Math.max(1, Number(e.target.value)))}
                  className="input" style={{ width: 100 }} min={1} max={1000} />
              </div>
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
                开始切片
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
