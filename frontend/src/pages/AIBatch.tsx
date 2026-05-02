// AI Batch page — full-featured image generation client for Volcano Engine Seedream API
import React, { useState, useRef, useEffect, useCallback } from 'react';

// ── Types ──
interface ImageItem {
  id: number;
  name: string;
  path: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  error?: string;
  results?: { url?: string; b64_json?: string; size?: string }[];
}

interface PromptPreset {
  name: string;
  text: string;
  category: string;
}

type ToastType = 'error' | 'success' | 'warning';

const defaultModels = [
  { id: 'doubao-seedream-5-0-260128', name: 'Seedream 5.0' },
  { id: 'doubao-seedream-5-0-lite-260128', name: 'Seedream 5.0 Lite' },
  { id: 'doubao-seedream-4-5-251128', name: 'Seedream 4.5' },
  { id: 'doubao-seedream-4-0-250828', name: 'Seedream 4.0' },
  { id: 'doubao-seedream-3-0-t2i-250415', name: 'Seedream 3.0' },
];

const sizeOptions = [
  '1024x1024', '2048x2048', '2304x1728', '1728x2304',
  '2848x1600', '1600x2848', '2496x1664', '1664x2496',
  '3136x1344', '3072x3072', '3456x2592', '2592x3456',
  '4096x2304', '2304x4096', '2496x3744', '3744x2496',
  '4704x2016', '4096x4096',
];

const defaultPromptPresets: PromptPreset[] = [
  { name: '默认人像', text: 'A beautiful portrait photo, high quality, detailed', category: '人像' },
  { name: '风景', text: 'A stunning landscape photo, golden hour lighting, 8k', category: '风景' },
  { name: '动漫风格', text: 'Anime style illustration, vibrant colors, detailed', category: '风格' },
];

const downloadWidthOptions = [
  { value: '1440', label: '1440px' },
  { value: '800', label: '800px' },
  { value: '750', label: '750px' },
  { value: '790', label: '790px' },
  { value: 'original', label: '原始尺寸' },
  { value: 'custom', label: '自定义...' },
];

// ── Helpers ──
function savePresets(presets: PromptPreset[]) {
  try { localStorage.setItem('prompt_presets', JSON.stringify(presets)); } catch { /* no-op */ }
}

function loadPresets(): PromptPreset[] {
  try {
    const raw = localStorage.getItem('prompt_presets');
    if (raw) return JSON.parse(raw);
  } catch { /* no-op */ }
  return defaultPromptPresets;
}

function saveModelList(models: { id: string; name: string }[]) {
  try { localStorage.setItem('model_list', JSON.stringify(models)); } catch { /* no-op */ }
}

function loadModelList(): { id: string; name: string }[] {
  try {
    const raw = localStorage.getItem('model_list');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* no-op */ }
  return defaultModels;
}

// ── Component ──
export const AIBatch: React.FC = () => {
  // ── State ──
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState(defaultModels[0].id);
  const [modelList, setModelList] = useState<{ id: string; name: string }[]>(loadModelList);
  const [size, setSize] = useState('2048x2048');
  const [seed, setSeed] = useState(-1);
  const [showCustomSeed, setShowCustomSeed] = useState(false);
  const [outputFormat, setOutputFormat] = useState('jpeg');
  const [watermark, setWatermark] = useState(true);
  const [guidanceScale, setGuidanceScale] = useState(2.5);
  const [responseFormat, setResponseFormat] = useState('url');
  const [sequentialMode, setSequentialMode] = useState('disabled');
  const [maxImages, setMaxImages] = useState(4);
  const [optimizePromptMode, setOptimizePromptMode] = useState('standard');
  const [webSearch, setWebSearch] = useState(false);
  const [concurrent, setConcurrent] = useState(2);
  const [downloadWidth, setDownloadWidth] = useState('1440');
  const [customWidth, setCustomWidth] = useState('');
  const [showCustomWidth, setShowCustomWidth] = useState(false);
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [queue, setQueue] = useState<ImageItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [cancelRequested, setCancelRequested] = useState(false);
  const [presets, setPresets] = useState<PromptPreset[]>(loadPresets);
  const [showPromptForm, setShowPromptForm] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetText, setNewPresetText] = useState('');
  const [newPresetCategory, setNewPresetCategory] = useState('常用');
  const [deleteConfirmPreset, setDeleteConfirmPreset] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsApiKey, setSettingsApiKey] = useState('');
  const [editingModel, setEditingModel] = useState<{ id: string; name: string } | null>(null);
  const [isAddingModel, setIsAddingModel] = useState(false);
  const [newModelId, setNewModelId] = useState('');
  const [newModelName, setNewModelName] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: ToastType } | null>(null);
  const [selectedPreview, setSelectedPreview] = useState<ImageItem | null>(null);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [compareMode, setCompareMode] = useState(false);
  const [leftZoom, setLeftZoom] = useState(1);
  const [rightZoom, setRightZoom] = useState(1);
  const [downloadProgress, setDownloadProgress] = useState<{ current: number; total: number; active: boolean }>({ current: 0, total: 0, active: false });
  const refInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  // ── Computed-like ──
  const pendingCount = queue.filter(i => i.status === 'pending' || i.status === 'error').length;
  const completedCount = queue.filter(i => i.status === 'completed').length;

  // Load API key
  useEffect(() => {
    (async () => {
      try {
        const key = await (window as any).go.main.App.GetApiKey();
        if (key) setSettingsApiKey(key);
      } catch { /* no-op */ }
    })();
  }, []);

  // ── Toast ──
  const showToast = useCallback((msg: string, type: ToastType = 'error') => {
    setToast({ msg, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }, []);

  // ── Prompt Presets ──
  const categories = [...new Set(presets.map(p => p.category))];
  const groupedPresets = categories.map(cat => ({
    category: cat,
    items: presets.filter(p => p.category === cat),
  }));

  const handleSavePreset = () => {
    if (!newPresetName.trim()) return;
    const p: PromptPreset = {
      name: newPresetName.trim(),
      text: newPresetText || prompt,
      category: newPresetCategory,
    };
    const updated = [...presets, p];
    setPresets(updated);
    savePresets(updated);
    setNewPresetName('');
    setNewPresetText('');
    setShowPromptForm(false);
    showToast('提示词已保存', 'success');
  };

  const handleDeletePreset = (name: string) => {
    const updated = presets.filter(p => p.name !== name);
    setPresets(updated);
    savePresets(updated);
    setDeleteConfirmPreset(null);
  };

  // ── Model List Management ──
  const handleAddModel = () => {
    if (!newModelId.trim() || !newModelName.trim()) return;
    if (modelList.find(m => m.id === newModelId.trim())) {
      showToast('模型 ID 已存在', 'warning');
      return;
    }
    const updated = [...modelList, { id: newModelId.trim(), name: newModelName.trim() }];
    setModelList(updated);
    saveModelList(updated);
    setNewModelId('');
    setNewModelName('');
    setIsAddingModel(false);
  };

  const handleEditModelSave = () => {
    if (!editingModel) return;
    const updated = modelList.map(m => m.id === editingModel.id ? editingModel : m);
    setModelList(updated);
    saveModelList(updated);
    setEditingModel(null);
  };

  const handleDeleteModel = (id: string) => {
    if (modelList.length <= 1) { showToast('至少保留一个模型', 'warning'); return; }
    const updated = modelList.filter(m => m.id !== id);
    setModelList(updated);
    saveModelList(updated);
    if (model === id) setModel(updated[0].id);
  };

  // ── Queue Management ──
  const addFiles = (paths: string[]) => {
    const items: ImageItem[] = paths.map((path: string) => ({
      id: nextId.current++,
      name: path.split('\\').pop() || path.split('/').pop() || path,
      path,
      status: 'pending' as const,
    }));
    setQueue(prev => [...prev, ...items]);
  };

  const handleSelectFolder = async () => {
    try {
      const dir = await (window as any).go.main.App.SelectDirectory();
      if (dir) {
        const scanned = await (window as any).go.main.App.ScanDirectory(dir, false);
        if (scanned) addFiles(scanned);
      }
    } catch { /* no-op */ }
  };

  const retryItem = (id: number) => {
    setQueue(prev => prev.map(i => i.id === id ? { ...i, status: 'pending' as const, error: undefined, results: undefined } : i));
  };

  const removeItem = (id: number) => {
    setQueue(prev => prev.filter(i => i.id !== id));
  };

  const clearQueue = () => { setQueue([]); };

  // ── Reference Images ──
  const handleReferenceUpload = async () => {
    try {
      const result = await (window as any).go.main.App.SelectFiles();
      if (result) setReferenceImages(prev => [...prev, ...result].slice(0, 12));
    } catch { /* no-op */ }
  };

  const removeReference = (index: number) => setReferenceImages(prev => prev.filter((_, i) => i !== index));

  // ── Main Processing ──
  const handleRun = async () => {
    const pending = queue.filter(i => i.status === 'pending');
    if (pending.length === 0 || !prompt) { showToast('请添加图片和提示词', 'warning'); return; }

    setProcessing(true);
    setCancelRequested(false);

    const concurrency = Math.min(concurrent, pending.length);
    let currentIdx = 0;
    const errors: string[] = [];

    const worker = async () => {
      while (currentIdx < pending.length && !cancelRequested) {
        const idx = currentIdx++;
        const item = pending[idx];

        setQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: 'processing' as const } : i));

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
            guidanceScale,
            responseFormat,
            sequentialImageGeneration: sequentialMode,
            maxImages,
            optimizePromptMode,
            webSearch,
            concurrent: 1,
            downloadWidth: downloadWidth === 'custom' ? parseInt(customWidth) || 0 : downloadWidth === 'original' ? 0 : parseInt(downloadWidth),
          });

          if (result && result.success && result.success > 0) {
            setQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: 'completed' as const } : i));
          } else {
            const errMsg = result?.results?.[0]?.error || result?.error || '处理失败';
            errors.push(`${item.name}: ${errMsg}`);
            setQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: 'error' as const, error: errMsg } : i));
          }
        } catch (err: any) {
          errors.push(`${item.name}: ${err.message}`);
          setQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: 'error' as const, error: err.message } : i));
        }
      }
    };

    const workers = Array.from({ length: concurrency }, () => worker());
    await Promise.all(workers);

    setProcessing(false);
    if (errors.length > 0) showToast(`${errors.length} 张处理失败`, 'error');
  };

  const retryAll = () => {
    if (processing) return;
    setQueue(prev => prev.map(i =>
      i.status === 'error' ? { ...i, status: 'pending' as const, error: undefined, results: undefined } : i
    ));
  };

  // ── Preview ──
  const openPreview = (item: ImageItem) => {
    setSelectedPreview(item);
    setPreviewIndex(0);
    setPreviewZoom(1);
    setCompareMode(false);
  };

  const closePreview = () => {
    setSelectedPreview(null);
    setPreviewIndex(0);
    setPreviewZoom(1);
  };

  // ── Styles ──
  const s = {
    card: { background: '#16213e', borderRadius: 12, padding: 16, border: '1px solid #1a2744' },
    input: { width: '100%' as const, padding: '10px 14px', background: '#0f1a30', color: '#e0e0e0', border: '1px solid #1e3a5f', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'inherit' },
    select: { padding: '8px 12px', background: '#0f1a30', color: '#e0e0e0', border: '1px solid #1e3a5f', borderRadius: 8, fontSize: 13, outline: 'none' },
    btn: { padding: '8px 18px', border: 'none', borderRadius: 8, cursor: 'pointer' as const, fontSize: 13, color: '#fff', background: '#1e3a5f' },
    btnSm: { padding: '4px 10px', border: 'none', borderRadius: 6, cursor: 'pointer' as const, fontSize: 11, color: '#fff', background: '#1e3a5f' },
    label: { fontSize: 13, color: '#94a3b8', marginBottom: 6, display: 'block' as const },
    row: { display: 'flex' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const },
    dangerBtn: { padding: '8px 18px', border: 'none', borderRadius: 8, cursor: 'pointer' as const, fontSize: 13, color: '#fff', background: '#dc2626' },
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 16, position: 'relative' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 9999,
          padding: '12px 24px', borderRadius: 10, fontSize: 14, color: '#fff', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          background: toast.type === 'error' ? '#dc2626' : toast.type === 'warning' ? '#d97706' : '#16a34a',
          animation: 'slideDown 0.3s',
        }}>
          {toast.msg}
          <button onClick={() => setToast(null)} style={{ background: 'none', border: 'none', color: '#fff', marginLeft: 16, cursor: 'pointer', fontSize: 16 }}>×</button>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowSettings(false)}>
          <div style={{ background: '#16213e', borderRadius: 16, padding: 28, width: 520, maxHeight: '90vh', overflow: 'auto', border: '1px solid #1a2744' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h3 style={{ margin: 0, fontSize: 18, color: '#fff' }}>设置</h3>
              <button onClick={() => setShowSettings(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>

            {/* API Key */}
            <div style={{ marginBottom: 20 }}>
              <label style={s.label}>API Key</label>
              <input type="password" value={settingsApiKey}
                onChange={e => setSettingsApiKey(e.target.value)}
                placeholder="输入你的火山方舟 API Key"
                style={{ ...s.input, marginBottom: 6 }} />
              <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>在火山方舟控制台获取 · 保存在本地 ~/.imagetool/config.json</p>
              <button onClick={async () => {
                try {
                  await (window as any).go.main.App.SaveApiKey(settingsApiKey);
                  showToast('API Key 已保存', 'success');
                } catch { showToast('保存失败', 'error'); }
              }} style={{ ...s.btn, marginTop: 8 }}>保存 API Key</button>
            </div>

            {/* Model List */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={s.label}>模型列表</label>
                <button onClick={() => { setIsAddingModel(true); setNewModelId(''); setNewModelName(''); }}
                  style={s.btnSm}>+ 添加模型</button>
              </div>
              {isAddingModel && (
                <div style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center' }}>
                  <input placeholder="名称" value={newModelName} onChange={e => setNewModelName(e.target.value)}
                    style={{ ...s.input, width: 140, padding: '6px 10px', fontSize: 12 }} />
                  <input placeholder="ID" value={newModelId} onChange={e => setNewModelId(e.target.value)}
                    style={{ ...s.input, width: 160, padding: '6px 10px', fontSize: 12 }} />
                  <button onClick={handleAddModel} style={s.btnSm}>保存</button>
                  <button onClick={() => setIsAddingModel(false)} style={{ ...s.btnSm, background: '#475569' }}>取消</button>
                </div>
              )}
              <div style={{ maxHeight: 160, overflow: 'auto' }}>
                {modelList.map(m => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #0f1a30' }}>
                    {editingModel?.id === m.id ? (
                      <>
                        <input value={editingModel.name} onChange={e => setEditingModel({ ...editingModel, name: e.target.value })}
                          style={{ ...s.input, width: 120, padding: '4px 8px', fontSize: 12 }} />
                        <input value={editingModel.id} onChange={e => setEditingModel({ ...editingModel, id: e.target.value })}
                          style={{ ...s.input, width: 150, padding: '4px 8px', fontSize: 12 }} />
                        <button onClick={handleEditModelSave} style={s.btnSm}>保存</button>
                        <button onClick={() => setEditingModel(null)} style={{ ...s.btnSm, background: '#475569' }}>取消</button>
                      </>
                    ) : (
                      <>
                        <span style={{ fontSize: 13, color: '#cbd5e1', width: 120 }}>{m.name}</span>
                        <span style={{ fontSize: 11, color: '#64748b', flex: 1 }}>{m.id}</span>
                        <button onClick={() => setEditingModel({ ...m })} style={{ ...s.btnSm, background: '#0f1a30', border: '1px solid #1e3a5f' }}>编辑</button>
                        <button onClick={() => handleDeleteModel(m.id)} style={{ ...s.btnSm, background: '#7f1d1d' }}>删除</button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setShowSettings(false)} style={{ ...s.btn, background: '#475569' }}>关闭</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete prompt confirmation */}
      {deleteConfirmPreset && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#16213e', borderRadius: 12, padding: 24, width: 360, border: '1px solid #1a2744' }}>
            <h4 style={{ margin: '0 0 12px', color: '#fff', fontSize: 16 }}>确认删除</h4>
            <p style={{ fontSize: 14, color: '#94a3b8', margin: '0 0 20px' }}>确定要删除提示词「{deleteConfirmPreset}」吗？</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setDeleteConfirmPreset(null)} style={{ ...s.btn, background: '#475569' }}>取消</button>
              <button onClick={() => handleDeletePreset(deleteConfirmPreset)} style={s.dangerBtn}>删除</button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {selectedPreview && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9500, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }} onClick={closePreview}>
          {/* Controls */}
          <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 8, zIndex: 1 }}>
            <button onClick={() => setCompareMode(!compareMode)} style={{ ...s.btnSm, background: compareMode ? '#e94560' : '#1e3a5f' }}>
              {compareMode ? '单图' : '对比'}
            </button>
            <button onClick={closePreview} style={{ ...s.btnSm, background: '#475569', fontSize: 14 }}>×</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, position: 'absolute', bottom: 40 }}>
            {selectedPreview.results && previewIndex > 0 && (
              <button onClick={() => { setPreviewIndex(i => i - 1); setPreviewZoom(1); }} style={s.btn}>◀ 上一张</button>
            )}
            <span style={{ color: '#94a3b8', fontSize: 13 }}>
              {previewIndex + 1} / {selectedPreview.results?.length || 1}
            </span>
            {selectedPreview.results && previewIndex < selectedPreview.results.length - 1 && (
              <button onClick={() => { setPreviewIndex(i => i + 1); setPreviewZoom(1); }} style={s.btn}>下一张 ▶</button>
            )}
            <button onClick={() => setPreviewZoom(z => Math.min(3, z + 0.25))} style={s.btnSm}>+放大</button>
            <button onClick={() => setPreviewZoom(z => Math.max(0.5, z - 0.25))} style={s.btnSm}>-缩小</button>
            <button onClick={() => setPreviewZoom(1)} style={s.btnSm}>重置</button>
            <span style={{ color: '#64748b', fontSize: 12 }}>{Math.round(previewZoom * 100)}%</span>
          </div>
          {compareMode && selectedPreview.results?.[previewIndex] ? (
            <div style={{ display: 'flex', gap: 20, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ color: '#94a3b8', fontSize: 12, marginBottom: 8 }}>原图</p>
                <div style={{ overflow: 'auto', maxWidth: '40vw', maxHeight: '70vh' }}>
                  <img src={selectedPreview.path} style={{ transform: `scale(${leftZoom})`, transformOrigin: 'top left' }} alt="original" />
                </div>
                <div style={{ marginTop: 4 }}>
                  <button onClick={() => setLeftZoom(z => Math.min(3, z + 0.25))} style={s.btnSm}>+</button>
                  <button onClick={() => setLeftZoom(z => Math.max(0.5, z - 0.25))} style={{ ...s.btnSm, marginLeft: 4 }}>-</button>
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ color: '#94a3b8', fontSize: 12, marginBottom: 8 }}>AI 结果</p>
                <div style={{ overflow: 'auto', maxWidth: '40vw', maxHeight: '70vh' }}>
                  <div style={{ width: 200, height: 200, background: '#0f1a30', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 13 }}>
                    结果图片 (URL 需联网加载)
                  </div>
                </div>
                <div style={{ marginTop: 4 }}>
                  <button onClick={() => setRightZoom(z => Math.min(3, z + 0.25))} style={s.btnSm}>+</button>
                  <button onClick={() => setRightZoom(z => Math.max(0.5, z - 0.25))} style={{ ...s.btnSm, marginLeft: 4 }}>-</button>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ maxWidth: '80vw', maxHeight: '75vh', overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => e.stopPropagation()}>
              <div style={{
                width: 300, height: 300, background: '#0f1a30', borderRadius: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 14,
              }}>
                AI 结果图片<br/>需联网加载
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Main Two-Column Layout ─── */}
      <div style={{ display: 'flex', gap: 20, flex: 1, minHeight: 0 }}>

        {/* === LEFT COLUMN: Parameters === */}
        <div style={{ width: '35%', display: 'flex', flexDirection: 'column', gap: 14, overflow: 'auto' }}>

          {/* Prompt Card */}
          <div style={s.card}>
            <label style={s.label}>提示词 (Prompt)</label>
            <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
              rows={5} placeholder="输入图片生成提示词..."
              style={{ ...s.input, resize: 'vertical', minHeight: 80, fontFamily: 'inherit' }} />
          </div>

          {/* Quick Prompts Card */}
          <div style={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label style={{ ...s.label, marginBottom: 0 }}>快速提示词</label>
              <button onClick={() => setShowPromptForm(!showPromptForm)} style={s.btnSm}>+ 新建</button>
            </div>

            {showPromptForm && (
              <div style={{ marginBottom: 10, padding: 10, background: '#0f1a30', borderRadius: 8 }}>
                <input placeholder="名称" value={newPresetName} onChange={e => setNewPresetName(e.target.value)}
                  style={{ ...s.input, marginBottom: 6, padding: '6px 10px', fontSize: 12 }} />
                <textarea placeholder="提示词内容（留空使用当前提示词）" value={newPresetText}
                  onChange={e => setNewPresetText(e.target.value)} rows={2}
                  style={{ ...s.input, marginBottom: 6, padding: '6px 10px', fontSize: 12, fontFamily: 'inherit' }} />
                <div style={{ display: 'flex', gap: 6 }}>
                  <select value={newPresetCategory} onChange={e => setNewPresetCategory(e.target.value)}
                    style={{ ...s.select, fontSize: 12, padding: '4px 8px' }}>
                    {['常用', '人像', '风景', '风格', '其他'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button onClick={handleSavePreset} style={s.btnSm}>保存</button>
                  <button onClick={() => setShowPromptForm(false)} style={{ ...s.btnSm, background: '#475569' }}>取消</button>
                </div>
              </div>
            )}

            {groupedPresets.length === 0 ? (
              <div style={{ fontSize: 12, color: '#475569', textAlign: 'center', padding: 12 }}>暂无保存的提示词</div>
            ) : (
              groupedPresets.map(g => (
                <div key={g.category} style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{g.category}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {g.items.map(p => (
                      <div key={p.name} style={{ position: 'relative', display: 'inline-block' }}>
                        <button onClick={() => setPrompt(p.text)}
                          style={{ ...s.btnSm, background: '#0f1a30', border: '1px solid #1e3a5f', fontSize: 11, padding: '3px 10px', whiteSpace: 'nowrap' }}>
                          {p.name}
                        </button>
                        <button onClick={() => setDeleteConfirmPreset(p.name)}
                          style={{ position: 'absolute', top: -5, right: -5, width: 14, height: 14, borderRadius: '50%', border: 'none', background: '#ef4444', color: '#fff', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.7 }}>
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Parameters Card */}
          <div style={s.card}>
            <label style={s.label}>生成参数</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* --- Model --- */}
              <div style={s.row}>
                <span style={{ fontSize: 13, color: '#94a3b8' }}>模型</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <select value={model} onChange={e => setModel(e.target.value)} style={{ ...s.select, width: 150 }}>
                    {modelList.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                  <button onClick={() => setShowSettings(true)} style={{ ...s.btnSm, background: '#0f1a30', border: '1px solid #1e3a5f', fontSize: 11, padding: '4px 6px' }} title="管理模型">⚙</button>
                </div>
              </div>

              {/* --- Size --- */}
              <div style={s.row}>
                <span style={{ fontSize: 13, color: '#94a3b8' }}>尺寸</span>
                <select value={size} onChange={e => setSize(e.target.value)} style={{ ...s.select, width: 150 }}>
                  {sizeOptions.map(sz => <option key={sz} value={sz}>{sz}</option>)}
                </select>
              </div>

              {/* --- Seed --- */}
              <div style={s.row}>
                <span style={{ fontSize: 13, color: '#94a3b8' }}>种子</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {!showCustomSeed ? (
                    <button onClick={() => setShowCustomSeed(true)}
                      style={{ ...s.btnSm, background: '#0f1a30', border: '1px solid #1e3a5f', color: seed === -1 ? '#64748b' : '#cbd5e1' }}>
                      {seed === -1 ? '随机' : seed}
                    </button>
                  ) : (
                    <>
                      <input type="number" value={seed} onChange={e => setSeed(Number(e.target.value))}
                        style={{ ...s.input, width: 70, padding: '4px 8px', fontSize: 12 }} min={-1} autoFocus />
                      <button onClick={() => setSeed(-1)} style={s.btnSm}>重置</button>
                    </>
                  )}
                </div>
              </div>

              {/* --- Watermark --- */}
              <div style={s.row}>
                <span style={{ fontSize: 13, color: '#94a3b8' }}>水印</span>
                <label style={{ fontSize: 13, color: '#cbd5e1', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="checkbox" checked={watermark} onChange={e => setWatermark(e.target.checked)} style={{ accentColor: '#e94560' }} /> Seedream 水印
                </label>
              </div>

              {/* --- Response Format --- */}
              <div style={s.row}>
                <span style={{ fontSize: 13, color: '#94a3b8' }}>返回格式</span>
                <select value={responseFormat} onChange={e => setResponseFormat(e.target.value)} style={{ ...s.select, width: 150 }}>
                  <option value="url">URL (推荐)</option>
                  <option value="b64_json">Base64</option>
                </select>
              </div>

              {/* --- Sequential (组图) --- */}
              <div style={s.row}>
                <span style={{ fontSize: 13, color: '#94a3b8' }}>生成模式</span>
                <select value={sequentialMode} onChange={e => setSequentialMode(e.target.value)} style={{ ...s.select, width: 150 }}>
                  <option value="disabled">关闭 (单图)</option>
                  <option value="auto">自动 (组图)</option>
                </select>
              </div>

              {/* --- Max Images --- */}
              {sequentialMode === 'auto' && (
                <div style={s.row}>
                  <span style={{ fontSize: 13, color: '#94a3b8' }}>最大图片数</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="range" min={1} max={15} value={maxImages} onChange={e => setMaxImages(Number(e.target.value))} style={{ width: 80, accentColor: '#e94560' }} />
                    <span style={{ fontSize: 12, color: '#cbd5e1', width: 24 }}>{maxImages}</span>
                  </div>
                </div>
              )}

              {/* --- Output Format --- */}
              <div style={s.row}>
                <span style={{ fontSize: 13, color: '#94a3b8' }}>输出格式</span>
                <select value={outputFormat} onChange={e => setOutputFormat(e.target.value)} style={{ ...s.select, width: 150 }}>
                  <option value="jpeg">JPEG</option>
                  <option value="png">PNG</option>
                </select>
              </div>

              {/* --- Guidance Scale --- */}
              <div style={s.row}>
                <span style={{ fontSize: 13, color: '#94a3b8' }}>文本权重</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: '#64748b' }}>1</span>
                  <input type="range" min={10} max={100} value={guidanceScale * 10} onChange={e => setGuidanceScale(Number(e.target.value) / 10)} style={{ width: 80, accentColor: '#e94560' }} step={5} />
                  <span style={{ fontSize: 11, color: '#64748b' }}>10</span>
                  <span style={{ fontSize: 12, color: '#cbd5e1', width: 28 }}>{guidanceScale.toFixed(1)}</span>
                </div>
              </div>

              {/* --- Optimize Prompt --- */}
              <div style={s.row}>
                <span style={{ fontSize: 13, color: '#94a3b8' }}>提示词优化</span>
                <select value={optimizePromptMode} onChange={e => setOptimizePromptMode(e.target.value)} style={{ ...s.select, width: 150 }}>
                  <option value="standard">标准模式 (高质量)</option>
                  <option value="fast">快速模式 (低耗时)</option>
                </select>
              </div>

              {/* --- Web Search --- */}
              <div style={s.row}>
                <span style={{ fontSize: 13, color: '#94a3b8' }}>联网搜索</span>
                <label style={{ fontSize: 13, color: '#cbd5e1', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="checkbox" checked={webSearch} onChange={e => setWebSearch(e.target.checked)} style={{ accentColor: '#e94560' }} /> 搜索互联网
                </label>
              </div>

              {/* --- Concurrent --- */}
              <div style={s.row}>
                <span style={{ fontSize: 13, color: '#94a3b8' }}>并发数</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="range" min={1} max={20} value={concurrent} onChange={e => setConcurrent(Number(e.target.value))} style={{ width: 80, accentColor: '#e94560' }} />
                  <span style={{ fontSize: 12, color: '#cbd5e1', width: 24 }}>{concurrent}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* === RIGHT COLUMN: Workflow === */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0 }}>

          {/* Reference Images */}
          <div style={s.card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <label style={{ ...s.label, marginBottom: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                参考图 <span style={{ fontSize: 11, color: '#64748b' }}>({referenceImages.length}/12)</span>
              </label>
              <button onClick={handleReferenceUpload} style={s.btnSm}>+ 上传参考图</button>
            </div>
            {referenceImages.length === 0 ? (
              <div onClick={handleReferenceUpload}
                style={{ border: '2px dashed #1e3a5f', borderRadius: 10, padding: '16px 0', textAlign: 'center', cursor: 'pointer', color: '#64748b', fontSize: 13 }}>
                <div style={{ fontSize: 22, marginBottom: 2 }}>+</div>拖拽或点击上传参考图
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                {referenceImages.map((img, i) => (
                  <div key={i} style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 8, border: '1px solid #1e3a5f', background: '#0f1a30', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#64748b' }}>
                      {img.split('\\').pop()?.substring(0, 10) || `ref${i}`}
                    </div>
                    <button onClick={() => removeReference(i)}
                      style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                  </div>
                ))}
                {referenceImages.length < 12 && (
                  <div onClick={handleReferenceUpload}
                    style={{ width: 48, height: 48, borderRadius: 8, border: '2px dashed #1e3a5f', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: 18, flexShrink: 0 }}>+</div>
                )}
              </div>
            )}
          </div>

          {/* Batch Actions Bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
            <button onClick={clearQueue} style={{ ...s.btn, background: 'transparent', border: '1px solid #1e3a5f', color: '#94a3b8' }}>清空</button>
            <button onClick={handleSelectFolder} style={s.btn}>+ 添加图片</button>

            {queue.length > 0 && (
              <span style={{ fontSize: 12, color: '#64748b' }}>{completedCount}/{queue.length} 完成</span>
            )}

            {queue.filter(i => i.status === 'error').length > 0 && (
              <button onClick={retryAll} style={{ ...s.btn, background: '#1a1a2e', border: '1px solid #eab308', color: '#eab308', fontSize: 12, padding: '4px 12px' }}>全部重试</button>
            )}

            {completedCount > 0 && (
              <button onClick={async () => {
                const completed = queue.filter(i => i.status === 'completed');
                setDownloadProgress({ current: 0, total: completed.length, active: true });
                for (let i = 0; i < completed.length; i++) {
                  setDownloadProgress(p => ({ ...p, current: i + 1 }));
                }
                setDownloadProgress(p => ({ ...p, active: false }));
                showToast('下载完成', 'success');
              }} style={{ ...s.btn, background: '#065f46', fontSize: 12, padding: '4px 12px' }}>
                全部下载
              </button>
            )}

            {/* Download Width */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
              <span style={{ fontSize: 11, color: '#64748b' }}>宽度:</span>
              <select value={downloadWidth} onChange={e => { setDownloadWidth(e.target.value); setShowCustomWidth(e.target.value === 'custom'); }}
                style={{ ...s.select, fontSize: 12, padding: '4px 8px', width: 100 }}>
                {downloadWidthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {showCustomWidth && (
                <input type="number" value={customWidth} onChange={e => setCustomWidth(e.target.value)}
                  placeholder="px" style={{ ...s.input, width: 70, padding: '4px 8px', fontSize: 12 }} />
              )}
            </div>

            <div style={{ flex: 1 }} />

            {processing ? (
              <button onClick={() => setCancelRequested(true)}
                style={{ padding: '10px 24px', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, color: '#fff', background: '#dc2626', fontWeight: 600 }}>
                取消处理
              </button>
            ) : (
              <button onClick={handleRun} disabled={queue.length === 0 || !prompt}
                style={{ padding: '10px 24px', border: 'none', borderRadius: 8, cursor: queue.length === 0 || !prompt ? 'not-allowed' : 'pointer', fontSize: 14, color: '#fff', background: queue.length === 0 || !prompt ? '#475569' : '#e94560', fontWeight: 600 }}>
                开始处理 {pendingCount > 0 ? `(${pendingCount}张)` : ''}
              </button>
            )}
          </div>

          {/* Download Progress */}
          {downloadProgress.active && (
            <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 100, background: '#16213e', border: '1px solid #1a2744', borderRadius: 8, padding: '10px 20px', fontSize: 13, color: '#94a3b8' }}>
              下载中 {downloadProgress.current} / {downloadProgress.total}
            </div>
          )}

          {/* Image Queue */}
          <div style={{ ...s.card, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0 10px', fontSize: 12, color: '#64748b', borderBottom: '1px solid #1a2744', marginBottom: 8 }}>
              <span>图片队列</span>
              <span>{completedCount}/{queue.length} 完成</span>
            </div>

            <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
              {queue.length === 0 ? (
                <div onClick={handleSelectFolder}
                  style={{ border: '2px dashed #1e3a5f', borderRadius: 10, padding: '40px 0', textAlign: 'center', cursor: 'pointer', color: '#64748b', fontSize: 13 }}>
                  <div style={{ fontSize: 28, marginBottom: 4 }}>+</div>
                  拖拽或点击添加图片到队列<br />
                  <span style={{ fontSize: 11, color: '#475569' }}>支持 JPG/PNG/WebP/BMP/TIFF/GIF</span>
                </div>
              ) : (
                queue.map(item => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', borderBottom: '1px solid #0f1a30' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 6, background: '#0f1a30', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#475569' }}>
                      {item.status === 'completed' ? '✅' : item.status === 'error' ? '❌' : '🖼'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}
                        onClick={() => item.status === 'completed' && openPreview(item)}>
                        {item.name}
                      </div>
                      {item.error && <div style={{ fontSize: 11, color: '#f87171', marginTop: 2 }}>{item.error}</div>}
                    </div>

                    {/* Status */}
                    {item.status === 'pending' && <span style={{ fontSize: 11, color: '#64748b', background: '#1e293b', padding: '2px 8px', borderRadius: 4, flexShrink: 0 }}>等待处理</span>}
                    {item.status === 'processing' && (
                      <span style={{ fontSize: 11, color: '#60a5fa', background: '#1e3a5f', padding: '2px 8px', borderRadius: 4, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#60a5fa', display: 'inline-block' }} /> 处理中
                      </span>
                    )}
                    {item.status === 'completed' && (
                      <button onClick={() => openPreview(item)} style={{ fontSize: 11, color: '#4ade80', background: '#14532d', padding: '2px 8px', borderRadius: 4, border: 'none', cursor: 'pointer', flexShrink: 0 }}>
                        ✓ 完成 {item.results ? `(${item.results.length}张)` : ''}
                      </button>
                    )}
                    {item.status === 'error' && <span style={{ fontSize: 11, color: '#f87171', background: '#451a1a', padding: '2px 8px', borderRadius: 4, flexShrink: 0 }}>✗ 失败</span>}

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      {item.status === 'error' && <button onClick={() => retryItem(item.id)} style={{ ...s.btnSm, background: '#1a1a2e', border: '1px solid #eab308', color: '#eab308' }}>重试</button>}
                      <button onClick={() => removeItem(item.id)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 15 }}>×</button>
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
