import React, { useState, useRef } from 'react';

interface ImageItem {
  id: number;
  name: string;
  path: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  error?: string;
}

const models = [
  { id: 'doubao-seedream-5-0-260128', name: 'Seedream 5.0' },
  { id: 'doubao-seedream-5-0-lite-260128', name: 'Seedream 5.0 Lite' },
  { id: 'doubao-seedream-4-5-251128', name: 'Seedream 4.5' },
  { id: 'doubao-seedream-4-0-250828', name: 'Seedream 4.0' },
  { id: 'doubao-seedream-3-0-t2i-250415', name: 'Seedream 3.0' },
];

const sizes = ['1024x1024', '2048x2048', '3072x3072', '4096x4096'];

const promptPresets = [
  { name: '默认人像', text: 'A beautiful portrait photo, high quality, detailed' },
  { name: '风景', text: 'A stunning landscape photo, golden hour lighting, 8k' },
  { name: '动漫风格', text: 'Anime style illustration, vibrant colors, detailed' },
];

export const AIBatch: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState(models[0].id);
  const [size, setSize] = useState('2048x2048');
  const [seed, setSeed] = useState(-1);
  const [outputFormat, setOutputFormat] = useState('png');
  const [watermark, setWatermark] = useState(true);
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [queue, setQueue] = useState<ImageItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [showCustomSeed, setShowCustomSeed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const refInputRef = useRef<HTMLInputElement>(null);

  const pendingCount = queue.filter(i => i.status === 'pending' || i.status === 'error').length;
  const completedCount = queue.filter(i => i.status === 'completed').length;

  const handleFileSelect = async () => {
    try {
      const dir = await (window as any).go.main.App.SelectDirectory();
      if (dir) {
        const scanned = await (window as any).go.main.App.ScanDirectory(dir, false);
        if (scanned) {
          const newItems: ImageItem[] = scanned.map((path: string, i: number) => ({
            id: queue.length + i,
            name: path.split('\\').pop() || path.split('/').pop() || path,
            path,
            status: 'pending' as const,
          }));
          setQueue(prev => [...prev, ...newItems]);
        }
      }
    } catch { /* no-op */ }
  };

  const handleReferenceUpload = () => {
    refInputRef.current?.click();
  };

  const handleReferenceChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const paths: string[] = [];
    for (let i = 0; i < files.length; i++) {
      // In Wails, we can't easily get the full path from a file input.
      // Instead use the file dialog
    }
    // Use Wails file dialog for reference images
    try {
      const result = await (window as any).go.main.App.SelectFiles();
      if (result) {
        setReferenceImages(prev => [...prev, ...result].slice(0, 12));
      }
    } catch { /* no-op */ }
  };

  const removeReference = (index: number) => {
    setReferenceImages(prev => prev.filter((_, i) => i !== index));
  };

  const retryItem = (id: number) => {
    setQueue(prev => prev.map(item =>
      item.id === id ? { ...item, status: 'pending' as const, error: undefined } : item
    ));
  };

  const removeItem = (id: number) => {
    setQueue(prev => prev.filter(item => item.id !== id));
  };

  const clearQueue = () => {
    setQueue([]);
  };

  const handleRun = async () => {
    if (queue.length === 0 || !prompt) return;
    setProcessing(true);

    const pending = queue.filter(i => i.status === 'pending');
    for (const item of pending) {
      setQueue(prev => prev.map(i =>
        i.id === item.id ? { ...i, status: 'processing' as const } : i
      ));

      try {
        const outputDir = item.path.substring(0, item.path.lastIndexOf('\\'));
        const fn = (window as any).go.main.App.RunAIImageBatch;
        const result = await fn({
          sourcePaths: [item.path],
          outputDir,
          prompt,
          model,
          size,
          seed: seed >= 0 ? seed : -1,
          outputFormat,
          watermark,
          referenceImages,
        });

        if (result && result.success && result.success > 0) {
          setQueue(prev => prev.map(i =>
            i.id === item.id ? { ...i, status: 'completed' as const } : i
          ));
        } else {
          setQueue(prev => prev.map(i =>
            i.id === item.id ? { ...i, status: 'error' as const, error: result?.error || '处理失败' } : i
          ));
        }
      } catch (err: any) {
        setQueue(prev => prev.map(i =>
          i.id === item.id ? { ...i, status: 'error' as const, error: err.message } : i
        ));
      }
    }

    setProcessing(false);
  };

  const retryAll = () => {
    setQueue(prev => prev.map(item =>
      item.status === 'error' ? { ...item, status: 'pending' as const, error: undefined } : item
    ));
  };

  const s = {
    card: {
      background: '#16213e',
      borderRadius: 12,
      padding: 16,
      border: '1px solid #1a2744',
    },
    input: {
      width: '100%' as const,
      padding: '10px 14px',
      background: '#0f1a30',
      color: '#e0e0e0',
      border: '1px solid #1e3a5f',
      borderRadius: 8,
      fontSize: 14,
      outline: 'none',
      boxSizing: 'border-box' as const,
      fontFamily: 'inherit',
    },
    select: {
      padding: '8px 12px',
      background: '#0f1a30',
      color: '#e0e0e0',
      border: '1px solid #1e3a5f',
      borderRadius: 8,
      fontSize: 13,
      outline: 'none',
    },
    btn: {
      padding: '8px 18px',
      border: 'none',
      borderRadius: 8,
      cursor: 'pointer' as const,
      fontSize: 13,
      color: '#fff',
      background: '#1e3a5f',
      transition: 'all 0.2s',
    },
    btnPrimary: {
      padding: '10px 24px',
      border: 'none',
      borderRadius: 8,
      cursor: 'pointer' as const,
      fontSize: 14,
      color: '#fff',
      background: '#e94560',
      fontWeight: 600,
    },
    label: {
      fontSize: 13,
      color: '#94a3b8',
      marginBottom: 6,
      display: 'block' as const,
    },
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#fff' }}>
          AI 图片生成
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>
          火山方舟 · Seedream 批量处理工具
        </p>
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'flex', gap: 20, flex: 1, minHeight: 0 }}>

        {/* ========== LEFT COLUMN: Parameters (35%) ========== */}
        <div style={{ width: '35%', display: 'flex', flexDirection: 'column', gap: 14, overflow: 'auto' }}>

          {/* Prompt */}
          <div style={s.card}>
            <label style={s.label}>提示词</label>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              rows={6}
              style={{ ...s.input, resize: 'vertical', height: 120, fontFamily: 'inherit' }}
              placeholder="输入图片生成提示词..."
            />
          </div>

          {/* Quick Prompts */}
          <div style={s.card}>
            <label style={s.label}>快速提示词</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {promptPresets.map(p => (
                <button
                  key={p.name}
                  onClick={() => setPrompt(p.text)}
                  style={{
                    ...s.btn,
                    background: '#0f1a30',
                    border: '1px solid #1e3a5f',
                    fontSize: 12,
                    padding: '5px 12px',
                  }}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* Parameters */}
          <div style={s.card}>
            <label style={s.label}>生成参数</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

              {/* Model */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: '#94a3b8' }}>模型</span>
                <select value={model} onChange={e => setModel(e.target.value)} style={{ ...s.select, width: 160 }}>
                  {models.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              {/* Size */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: '#94a3b8' }}>尺寸</span>
                <select value={size} onChange={e => setSize(e.target.value)} style={{ ...s.select, width: 160 }}>
                  {sizes.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Seed */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: '#94a3b8' }}>种子</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {!showCustomSeed ? (
                    <button
                      onClick={() => setShowCustomSeed(true)}
                      style={{ ...s.btn, fontSize: 12, padding: '4px 12px', color: '#94a3b8' }}
                    >
                      随机 ({seed === -1 ? '✓' : seed})
                    </button>
                  ) : (
                    <input
                      type="number"
                      value={seed}
                      onChange={e => setSeed(Number(e.target.value))}
                      onBlur={() => setShowCustomSeed(false)}
                      style={{ ...s.input, width: 80, padding: '6px 10px', fontSize: 13 }}
                      min={-1}
                      autoFocus
                    />
                  )}
                </div>
              </div>

              {/* Output format */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: '#94a3b8' }}>输出格式</span>
                <select value={outputFormat} onChange={e => setOutputFormat(e.target.value)} style={{ ...s.select, width: 160 }}>
                  <option value="png">PNG</option>
                  <option value="jpeg">JPEG</option>
                </select>
              </div>

              {/* Watermark */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: '#94a3b8' }}>水印</span>
                <label style={{ fontSize: 13, color: '#cbd5e1', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="checkbox"
                    checked={watermark}
                    onChange={e => setWatermark(e.target.checked)}
                    style={{ accentColor: '#e94560' }}
                  />
                  Seedream 水印
                </label>
              </div>

            </div>
          </div>

        </div>

        {/* ========== RIGHT COLUMN: Workflow (65%) ========== */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0 }}>

          {/* Reference Images Zone */}
          <div style={s.card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <label style={{ ...s.label, marginBottom: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                参考图
                <span style={{ fontSize: 11, color: '#64748b' }}>({referenceImages.length}/12)</span>
              </label>
              <button onClick={handleReferenceUpload} style={s.btn}>
                + 上传参考图
              </button>
              <input
                ref={refInputRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={handleReferenceChange}
              />
            </div>

            {referenceImages.length === 0 ? (
              <div
                onClick={handleReferenceUpload}
                style={{
                  border: '2px dashed #1e3a5f',
                  borderRadius: 10,
                  padding: '20px 0',
                  textAlign: 'center',
                  cursor: 'pointer',
                  color: '#64748b',
                  fontSize: 13,
                }}
              >
                <div style={{ fontSize: 24, marginBottom: 4 }}>+</div>
                拖拽或点击上传参考图
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                {referenceImages.map((img, i) => (
                  <div key={i} style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 8, overflow: 'hidden',
                      border: '1px solid #1e3a5f', background: '#0f1a30',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, color: '#64748b',
                    }}>
                      {img.split('\\').pop()?.split('/').pop()?.substring(0, 8) || 'ref'}
                    </div>
                    <button
                      onClick={() => removeReference(i)}
                      style={{
                        position: 'absolute', top: -6, right: -6, width: 18, height: 18,
                        borderRadius: '50%', border: 'none', background: '#ef4444',
                        color: '#fff', cursor: 'pointer', fontSize: 11,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >×</button>
                  </div>
                ))}
                {referenceImages.length < 12 && (
                  <div
                    onClick={handleReferenceUpload}
                    style={{
                      width: 48, height: 48, borderRadius: 8,
                      border: '2px dashed #1e3a5f', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#475569', fontSize: 18, flexShrink: 0,
                    }}
                  >+</div>
                )}
              </div>
            )}
          </div>

          {/* Batch Actions Bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <button onClick={clearQueue} style={{ ...s.btn, background: 'transparent', border: '1px solid #1e3a5f', color: '#94a3b8' }}>
              清空
            </button>
            <button onClick={handleFileSelect} style={s.btn}>
              + 添加图片
            </button>

            {queue.length > 0 && (
              <>
                {completedCount > 0 && (
                  <span style={{ fontSize: 12, color: '#64748b' }}>
                    {completedCount}/{queue.length} 完成
                  </span>
                )}
                <button onClick={retryAll} style={{ ...s.btn, background: '#1a1a2e', border: '1px solid #eab308', color: '#eab308', fontSize: 12, padding: '4px 12px' }}>
                  全部重试
                </button>
              </>
            )}

            <div style={{ flex: 1 }} />

            <button
              onClick={handleRun}
              disabled={processing || queue.length === 0 || !prompt}
              style={{
                ...s.btnPrimary,
                opacity: (processing || queue.length === 0 || !prompt) ? 0.5 : 1,
                cursor: (processing || queue.length === 0 || !prompt) ? 'not-allowed' : 'pointer',
              }}
            >
              {processing ? '处理中...' : `开始处理${pendingCount > 0 ? ` (${pendingCount}张)` : ''}`}
            </button>
          </div>

          {/* Image Queue */}
          <div style={{ ...s.card, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', padding: '6px 0 10px',
              fontSize: 12, color: '#64748b', borderBottom: '1px solid #1a2744', marginBottom: 8,
            }}>
              <span>图片队列</span>
              <span>{completedCount}/{queue.length} 完成</span>
            </div>

            <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
              {queue.length === 0 ? (
                <div
                  onClick={handleFileSelect}
                  style={{
                    border: '2px dashed #1e3a5f', borderRadius: 10, padding: '40px 0',
                    textAlign: 'center', cursor: 'pointer', color: '#64748b', fontSize: 13,
                  }}
                >
                  <div style={{ fontSize: 28, marginBottom: 4 }}>+</div>
                  拖拽或点击添加图片到队列
                </div>
              ) : (
                queue.map(item => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '8px 4px', borderBottom: '1px solid #0f1a30',
                    }}
                  >
                    {/* Thumbnail placeholder */}
                    <div style={{
                      width: 40, height: 40, borderRadius: 6, overflow: 'hidden',
                      background: '#0f1a30', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16, color: '#475569',
                    }}>
                      🖼
                    </div>

                    {/* File name */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.name}
                      </div>
                    </div>

                    {/* Status badge */}
                    {item.status === 'pending' && (
                      <span style={{ fontSize: 11, color: '#64748b', background: '#1e293b', padding: '2px 8px', borderRadius: 4 }}>
                        等待处理
                      </span>
                    )}
                    {item.status === 'processing' && (
                      <span style={{ fontSize: 11, color: '#60a5fa', background: '#1e3a5f', padding: '2px 8px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#60a5fa', display: 'inline-block' }} />
                        处理中
                      </span>
                    )}
                    {item.status === 'completed' && (
                      <span style={{ fontSize: 11, color: '#4ade80', background: '#14532d', padding: '2px 8px', borderRadius: 4 }}>
                        ✓ 完成
                      </span>
                    )}
                    {item.status === 'error' && (
                      <span style={{ fontSize: 11, color: '#f87171', background: '#451a1a', padding: '2px 8px', borderRadius: 4 }} title={item.error}>
                        ✗ 失败
                      </span>
                    )}

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      {item.status === 'error' && (
                        <button onClick={() => retryItem(item.id)}
                          style={{ background: 'none', border: 'none', color: '#fbbf24', cursor: 'pointer', fontSize: 13 }}>
                          重试
                        </button>
                      )}
                      <button onClick={() => removeItem(item.id)}
                        style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 15 }}>
                        ×
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
