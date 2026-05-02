import React, { useState } from 'react';
import { ImageList } from '../components/ImageList';
import { useBatch } from '../hooks/useBatch';
import { BatchProgress } from '../components/BatchProgress';

const models = [
  { id: 'doubao-seedream-5-0-260128', name: 'Seedream 5.0' },
  { id: 'doubao-seedream-5-0-lite-260128', name: 'Seedream 5.0 Lite' },
  { id: 'doubao-seedream-4-5-251128', name: 'Seedream 4.5' },
  { id: 'doubao-seedream-4-0-250828', name: 'Seedream 4.0' },
  { id: 'doubao-seedream-3-0-t2i-250415', name: 'Seedream 3.0' },
];

const sizes = ['1024x1024', '2048x2048', '3072x3072', '4096x4096'];

export const AIBatch: React.FC = () => {
  const [files, setFiles] = useState<string[]>([]);
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState(models[0].id);
  const [size, setSize] = useState('2048x2048');
  const [seed, setSeed] = useState(-1);
  const [outputFormat, setOutputFormat] = useState('png');
  const [watermark, setWatermark] = useState(true);
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const { state, startBatch } = useBatch();

  const handleSelectFolder = async () => {
    try {
      const dir = await (window as any).go.main.App.SelectDirectory();
      if (dir) {
        const scanned = await (window as any).go.main.App.ScanDirectory(dir, false);
        if (scanned) setFiles(scanned);
      }
    } catch { /* no-op */ }
  };

  const handleSelectRefs = async () => {
    try {
      const result = await (window as any).go.main.App.SelectFiles();
      if (result) setReferenceImages(prev => [...prev, ...result]);
    } catch { /* no-op */ }
  };

  const handleRun = async () => {
    const outputDir = files.length > 0
      ? files[0].substring(0, files[0].lastIndexOf('\\'))
      : '';
    await startBatch('RunAIImageBatch', {
      sourcePaths: files,
      outputDir,
      prompt,
      model,
      size,
      seed: seed >= 0 ? seed : -1,
      outputFormat,
      watermark,
      referenceImages,
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
      <h2 style={{ margin: '0 0 20px', fontSize: 22, fontWeight: 600 }}>AI 图片生成</h2>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <button onClick={handleSelectFolder} style={btnStyle}>选择图片文件夹</button>
      </div>

      <ImageList files={files} onRemove={i => setFiles(files.filter((_, j) => j !== i))}
        onClear={() => setFiles([])} />

      <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Prompt */}
        <div>
          <label style={{ fontSize: 14, display: 'block', marginBottom: 4 }}>提示词 (Prompt)</label>
          <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
            rows={3}
            style={{ width: '100%', padding: '10px 14px', background: '#1a1a2e', color: '#fff',
              border: '1px solid #333', borderRadius: 6, fontSize: 14, resize: 'vertical',
              boxSizing: 'border-box', fontFamily: 'inherit' }}
            placeholder="描述你想要的图片内容..." />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ fontSize: 14, minWidth: 80 }}>模型</label>
          <select value={model} onChange={e => setModel(e.target.value)} style={selectStyle}>
            {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ fontSize: 14, minWidth: 80 }}>尺寸</label>
          <select value={size} onChange={e => setSize(e.target.value)} style={selectStyle}>
            {sizes.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ fontSize: 14, minWidth: 80 }}>随机种子</label>
          <input type="number" value={seed} onChange={e => setSeed(Number(e.target.value))}
            style={inputStyle} min={-1} />
          <span style={{ fontSize: 12, color: '#888' }}>-1 = 随机</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ fontSize: 14, minWidth: 80 }}>输出格式</label>
          <select value={outputFormat} onChange={e => setOutputFormat(e.target.value)} style={selectStyle}>
            <option value="png">PNG</option>
            <option value="jpeg">JPEG</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ fontSize: 14, minWidth: 80 }}>水印</label>
          <label style={{ fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={watermark} onChange={e => setWatermark(e.target.checked)} />
            添加 Seedream 水印
          </label>
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <label style={{ fontSize: 14, minWidth: 80 }}>参考图</label>
            <button onClick={handleSelectRefs} style={btnStyle}>选择参考图</button>
          </div>
          {referenceImages.length > 0 && (
            <div style={{ fontSize: 13, color: '#888' }}>
              {referenceImages.length} 张参考图
            </div>
          )}
        </div>
      </div>

      <button onClick={handleRun} disabled={state.running || files.length === 0 || !prompt}
        style={{ ...btnStyle, marginTop: 24, background: state.running ? '#555' : '#e94560',
          width: '100%', padding: '12px 0', fontSize: 16 }}>
        {state.running ? '处理中...' : '开始 AI 生成'}
      </button>

      <BatchProgress progress={state.progress} />
    </div>
  );
};
