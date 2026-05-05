// AI Batch page — full-featured image generation client for Volcano Engine Seedream API
import React, { useState, useRef, useEffect, useCallback } from 'react';

// ── Types ──
interface ImageItem {
  id: number;
  name: string;
  path: string;
  outputPath?: string;
  status: 'pending' | 'processing' | 'completed' | 'error' | 'cancelled';
  error?: string;
  results?: { url?: string; b64_json?: string; size?: string }[];
  thumbUrl?: string;
  sourceThumbUrl?: string;
  hoverThumbUrl?: string;
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

const sizeOptions = ['1K', '2K', '3K', '4K'];

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
function toFileUrl(path: string): string {
  // Convert Windows filesystem path to file:// URL for WebView
  return 'file:///' + path.replace(/\\/g, '/');
}

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
  const [model, setModel] = useState('doubao-seedream-5-0-lite-260128');
  const [modelList, setModelList] = useState<{ id: string; name: string }[]>(loadModelList);
  const [size, setSize] = useState('2K');
  const [seed, setSeed] = useState(-1);
  const [showCustomSeed, setShowCustomSeed] = useState(false);
  const [outputFormat, setOutputFormat] = useState('png');
  const [watermark, setWatermark] = useState(false);
  const [guidanceScale, setGuidanceScale] = useState(2.5);
  const [responseFormat, setResponseFormat] = useState('url');
  const [sequentialMode, setSequentialMode] = useState('auto');
  const [maxImages, setMaxImages] = useState(4);
  const [optimizePromptMode, setOptimizePromptMode] = useState('standard');
  const [webSearch, setWebSearch] = useState(false);
  const [concurrent, setConcurrent] = useState(20);
  const [aiOutputDir, setAiOutputDir] = useState('');
  const [downloadWidth, setDownloadWidth] = useState('1440');
  const [customWidth, setCustomWidth] = useState('');
  const [showCustomWidth, setShowCustomWidth] = useState(false);
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [refThumbUrls, setRefThumbUrls] = useState<Record<string, string>>({});
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
  const [hoverPreviewImg, setHoverPreviewImg] = useState<string | null>(null);
  const [hoverPreviewPos, setHoverPreviewPos] = useState({ x: 0, y: 0 });
  const [hoverPreviewVisible, setHoverPreviewVisible] = useState(false);
  // Preview modal: full-res base64 data URLs (loaded on demand)
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [compareSourceUrl, setCompareSourceUrl] = useState<string | null>(null);
  const [compareOutputUrl, setCompareOutputUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const refInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(0);
  const cancelRef = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  // Clean up toast timer on unmount
  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  // ── Model capability helpers ──
  const isSequentialSupported = model.includes('5-0') || model.includes('4-5') || model.includes('4-0');
  const isOutputFormatSupported = model.includes('5-0-lite') || model.includes('5-0-260128');
  const isGuidanceSupported = model.includes('3-0-t2i');
  const isWebSearchSupported = model.includes('5-0-lite') || model.includes('5-0-260128');

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

  // Load AI output directory
  useEffect(() => {
    (async () => {
      try {
        const dir = await (window as any).go.main.App.GetAiOutputDir();
        if (dir) setAiOutputDir(dir);
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
    // Deduplicate: skip paths already in the queue
    setQueue(prev => {
      const existingPaths = new Set(prev.map(i => i.path));
      const newPaths = paths.filter(p => !existingPaths.has(p));
      if (newPaths.length === 0) return prev;

      const items: ImageItem[] = newPaths.map((path: string) => ({
        id: nextId.current++,
        name: path.split('\\').pop() || path.split('/').pop() || path,
        path,
        status: 'pending' as const,
      }));

      // Asynchronously load source image thumbnails
      items.forEach(async (item) => {
        try {
          // Load small thumbnail (80px) for queue display
          const dataUrl = await (window as any).go.main.App.ReadImageThumbnail(item.path, 80);
          if (dataUrl && dataUrl.startsWith('data:')) {
            setQueue(q => q.map(i => i.id === item.id ? { ...i, sourceThumbUrl: dataUrl } : i));
          }
          // Load larger thumbnail (320px) for hover preview
          const hoverUrl = await (window as any).go.main.App.ReadImageThumbnail(item.path, 320);
          if (hoverUrl && hoverUrl.startsWith('data:')) {
            setQueue(q => q.map(i => i.id === item.id ? { ...i, hoverThumbUrl: hoverUrl } : i));
          }
        } catch {
          // no-op
        }
      });

      return [...prev, ...items];
    });
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
      if (result) {
        const updated = [...referenceImages, ...result].slice(0, 12);
        setReferenceImages(updated);
        // Load thumbnails for new reference images
        for (const imgPath of result) {
          if (refThumbUrls[imgPath]) continue;
          try {
            const dataUrl = await (window as any).go.main.App.ReadImageThumbnail(imgPath, 80);
            if (dataUrl && dataUrl.startsWith('data:')) {
              setRefThumbUrls(prev => ({ ...prev, [imgPath]: dataUrl }));
            }
          } catch { /* no-op */ }
        }
      }
    } catch { /* no-op */ }
  };

  const removeReference = (index: number) => setReferenceImages(prev => prev.filter((_, i) => i !== index));

  // ── Main Processing ──
  const handleRun = async () => {
    // Use a local snapshot of pending items
    const pendingItems = queue.filter(i => i.status === 'pending');
    if (pendingItems.length === 0 || !prompt) {
      showToast('请添加图片和提示词', 'warning');
      return;
    }
    if (processing) return; // re-entry guard

    setProcessing(true);
    cancelRef.current = false;
    setCancelRequested(false);

    // Mark all pending items as processing in one shot
    setQueue(prev => prev.map(i =>
      i.status === 'pending' ? { ...i, status: 'processing' as const } : i
    ));

    try {
      if (cancelRef.current) { setProcessing(false); return; }

      const outputDir = aiOutputDir || pendingItems[0].path.substring(0, pendingItems[0].path.lastIndexOf('\\'));
      const downloadW = downloadWidth === 'custom'
        ? (parseInt(customWidth) || 0)
        : downloadWidth === 'original' ? 0 : parseInt(downloadWidth);
      const result = await (window as any).go.main.App.RunAIImageBatch({
        sourcePaths: pendingItems.map(i => i.path),
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
        concurrent: Math.min(concurrent, pendingItems.length),
        referenceImages,
        downloadWidth: isNaN(downloadW) ? 0 : downloadW,
      });

      if (cancelRef.current || !result) {
        if (!result) showToast('处理失败：无返回结果', 'error');
        setQueue(prev => prev.map(i =>
          i.status === 'processing' ? { ...i, status: cancelRef.current ? 'cancelled' as const : 'error' as const, error: !result ? '无返回结果' : undefined } : i
        ));
      } else if (result.results && result.results.length > 0) {
        // Map batch results back to queue items by source path
        const resultByPath = new Map<string, any>();
        for (const r of result.results) {
          if (r.sourcePath) resultByPath.set(r.sourcePath, r);
        }

        let failedCount = 0;
        setQueue(prev => prev.map(i => {
          const r = resultByPath.get(i.path);
          if (r) {
            if (r.success && r.outputPath) {
              return { ...i, status: 'completed' as const, outputPath: r.outputPath };
            } else {
              failedCount++;
              return { ...i, status: 'error' as const, error: r.error || '处理失败' };
            }
          }
          return { ...i, status: 'error' as const, error: '未返回处理结果' };
        }));

        // Load thumbnails for all completed items in parallel
        const completed = pendingItems.filter(item => {
          const r = resultByPath.get(item.path);
          return r && r.success && r.outputPath;
        });
        await Promise.all(completed.map(async (item) => {
          const r = resultByPath.get(item.path);
          if (!r || !r.outputPath) return;
          try {
            const dataUrl = await (window as any).go.main.App.ReadImageThumbnail(r.outputPath, 80);
            if (dataUrl && dataUrl.startsWith('data:')) {
              setQueue(prev => prev.map(i => i.path === item.path ? { ...i, thumbUrl: dataUrl } : i));
            }
          } catch {
            // fallback: use file:// URL
            setQueue(prev => prev.map(i => i.path === item.path ? { ...i, thumbUrl: toFileUrl(r.outputPath) } : i));
          }
        }));

        if (failedCount > 0) showToast(`${failedCount} 张处理失败`, 'error');
      } else {
        showToast(result.error || '处理失败', 'error');
        setQueue(prev => prev.map(i =>
          i.status === 'processing' ? { ...i, status: 'error' as const, error: result.error || '未返回处理结果' } : i
        ));
      }
    } catch (err: any) {
      showToast(`处理出错: ${err.message}`, 'error');
      setQueue(prev => prev.map(i =>
        i.status === 'processing' ? { ...i, status: 'error' as const, error: err.message } : i
      ));
    }

    setProcessing(false);
    setCancelRequested(false);
    cancelRef.current = false;
  };

  const retryAll = () => {
    if (processing) return;
    setQueue(prev => prev.map(i =>
      i.status === 'error' ? { ...i, status: 'pending' as const, error: undefined, results: undefined } : i
    ));
  };

  // ── Preview ──
  const openPreview = async (item: ImageItem) => {
    setSelectedPreview(item);
    setPreviewIndex(0);
    setPreviewZoom(1);
    setCompareMode(false);
    setLeftZoom(1);
    setRightZoom(1);
    setPreviewDataUrl(null);
    setCompareSourceUrl(null);
    setCompareOutputUrl(null);
    setPreviewLoading(true);

    // Load full-res image via backend (WebView2 blocks file:// URLs)
    const hasOutput = item.status === 'completed' && item.outputPath;
    const targetPath = hasOutput ? item.outputPath! : item.path;
    try {
      const dataUrl = await (window as any).go.main.App.ReadImageAsBase64(targetPath);
      if (dataUrl) setPreviewDataUrl(dataUrl);
    } catch { /* no-op */ }
    setPreviewLoading(false);
  };

  // Load compare mode images on demand
  const loadCompareImages = async (item: ImageItem) => {
    if (!item.outputPath) return;
    setCompareSourceUrl(null);
    setCompareOutputUrl(null);
    try {
      const [srcUrl, outUrl] = await Promise.all([
        (window as any).go.main.App.ReadImageAsBase64(item.path),
        (window as any).go.main.App.ReadImageAsBase64(item.outputPath),
      ]);
      if (srcUrl) setCompareSourceUrl(srcUrl);
      if (outUrl) setCompareOutputUrl(outUrl);
    } catch { /* no-op */ }
  };

  const closePreview = () => {
    setSelectedPreview(null);
    setPreviewIndex(0);
    setPreviewZoom(1);
    setPreviewDataUrl(null);
    setCompareSourceUrl(null);
    setCompareOutputUrl(null);
  };

  // ── Styles ──
  // Inline styles kept only where CSS classes can't express the layout
  const s = {
    card: { background: 'var(--color-bg-elevated)', borderRadius: 12, padding: 16, border: '1px solid var(--color-border-subtle)' },
    input: { width: '100%' as const, padding: '10px 14px', background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-default)', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'inherit' },
    select: { padding: '8px 12px', background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-default)', borderRadius: 8, fontSize: 13, outline: 'none' },
    btn: { padding: '8px 18px', border: 'none', borderRadius: 8, cursor: 'pointer' as const, fontSize: 13, color: '#fff', background: 'var(--color-accent)' },
    btnSm: { padding: '4px 10px', border: 'none', borderRadius: 6, cursor: 'pointer' as const, fontSize: 11, color: '#fff', background: 'var(--color-accent)' },
    label: { fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 6, display: 'block' as const },
    row: { display: 'flex' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const },
    dangerBtn: { padding: '8px 18px', border: 'none', borderRadius: 8, cursor: 'pointer' as const, fontSize: 13, color: '#fff', background: 'var(--color-danger)' },
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 16, position: 'relative' }}>
      {/* Toast */}
      {toast && (
        <div className={`toast ${toast.type === 'error' ? 'toast-error' : toast.type === 'warning' ? 'toast-warning' : 'toast-success'}`}>
          {toast.msg}
          <button onClick={() => setToast(null)} className="toast-close">×</button>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal-content" style={{ width: 520 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h3 style={{ margin: 0, fontSize: 18 }}>设置</h3>
              <button onClick={() => setShowSettings(false)} className="btn-icon" style={{ fontSize: 20 }}>×</button>
            </div>

            {/* API Key */}
            <div style={{ marginBottom: 20 }}>
              <label className="card-label" style={{ marginBottom: 6, textTransform: 'none', letterSpacing: 0 }}>API Key</label>
              <input type="password" value={settingsApiKey}
                onChange={e => setSettingsApiKey(e.target.value)}
                placeholder="输入你的火山方舟 API Key"
                className="input" />
              <p className="text-xs text-muted" style={{ margin: '4px 0 0' }}>在火山方舟控制台获取 · 保存在本地 ~/.imagetool/config.json</p>
              <button onClick={async () => {
                try {
                  await (window as any).go.main.App.SaveApiKey(settingsApiKey);
                  showToast('API Key 已保存', 'success');
                } catch { showToast('保存失败', 'error'); }
              }} className="btn btn-sm mt-6">保存 API Key</button>
            </div>

            {/* Model List */}
            <div style={{ marginBottom: 20 }}>
              <div className="card-header">
                <label className="card-label" style={{ textTransform: 'none', letterSpacing: 0, marginBottom: 0 }}>模型列表</label>
                <button onClick={() => { setIsAddingModel(true); setNewModelId(''); setNewModelName(''); }}
                  className="btn btn-sm">+ 添加模型</button>
              </div>
              {isAddingModel && (
                <div className="flex gap-3 items-center mb-4">
                  <input placeholder="名称" value={newModelName} onChange={e => setNewModelName(e.target.value)}
                    className="input" style={{ width: 140, padding: '6px 10px', fontSize: 12 }} />
                  <input placeholder="ID" value={newModelId} onChange={e => setNewModelId(e.target.value)}
                    className="input" style={{ width: 160, padding: '6px 10px', fontSize: 12 }} />
                  <button onClick={handleAddModel} className="btn btn-sm">保存</button>
                  <button onClick={() => setIsAddingModel(false)} className="btn btn-sm" style={{ background: 'var(--color-bg-hover)' }}>取消</button>
                </div>
              )}
              <div style={{ maxHeight: 160, overflow: 'auto' }}>
                {modelList.map(m => (
                  <div key={m.id} className="queue-item">
                    {editingModel?.id === m.id ? (
                      <>
                        <input value={editingModel.name} onChange={e => setEditingModel({ ...editingModel, name: e.target.value })}
                          className="input" style={{ width: 120, padding: '4px 8px', fontSize: 12 }} />
                        <input value={editingModel.id} onChange={e => setEditingModel({ ...editingModel, id: e.target.value })}
                          className="input" style={{ width: 150, padding: '4px 8px', fontSize: 12 }} />
                        <button onClick={handleEditModelSave} className="btn btn-sm">保存</button>
                        <button onClick={() => setEditingModel(null)} className="btn btn-sm" style={{ background: 'var(--color-bg-hover)' }}>取消</button>
                      </>
                    ) : (
                      <>
                        <span className="text-sm" style={{ width: 120 }}>{m.name}</span>
                        <span className="text-xs text-muted" style={{ flex: 1 }}>{m.id}</span>
                        <button onClick={() => setEditingModel({ ...m })} className="btn btn-sm btn-ghost">编辑</button>
                        <button onClick={() => handleDeleteModel(m.id)} className="btn btn-sm" style={{ background: 'var(--color-danger)', color: '#fff' }}>删除</button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-4">
              <button onClick={() => setShowSettings(false)} className="btn btn-ghost">关闭</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete prompt confirmation */}
      {deleteConfirmPreset && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: 360, padding: 24 }}>
            <h4 style={{ margin: '0 0 12px', fontSize: 16 }}>确认删除</h4>
            <p className="text-md text-secondary" style={{ margin: '0 0 20px' }}>确定要删除提示词「{deleteConfirmPreset}」吗？</p>
            <div className="flex justify-end gap-4">
              <button onClick={() => setDeleteConfirmPreset(null)} className="btn btn-ghost">取消</button>
              <button onClick={() => handleDeletePreset(deleteConfirmPreset)} className="btn btn-danger">删除</button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {selectedPreview && (() => {
        const hasOutput = selectedPreview.status === 'completed' && selectedPreview.outputPath;
        return (
        <div className="modal-overlay" style={{ background: 'rgba(0,0,0,0.85)' }} onClick={closePreview}>
          {/* Controls */}
          <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 8, zIndex: 1 }} onClick={e => e.stopPropagation()}>
            {hasOutput && (
              <button onClick={() => {
                const next = !compareMode;
                setCompareMode(next);
                if (next && !compareSourceUrl) loadCompareImages(selectedPreview);
              }} className="btn btn-sm" style={{ background: compareMode ? 'var(--color-accent)' : 'var(--color-bg-elevated)' }}>
                {compareMode ? '单图' : '对比'}
              </button>
            )}
            <button onClick={closePreview} className="btn-icon" style={{ fontSize: 18 }}>×</button>
          </div>
          <div className="flex items-center gap-8" style={{ position: 'absolute', bottom: 40 }} onClick={e => e.stopPropagation()}>
            <span className="text-sm text-secondary">
              {hasOutput ? 'AI 结果' : '源图'} · {selectedPreview.name}
            </span>
            <button onClick={() => setPreviewZoom(z => Math.min(3, z + 0.25))} className="btn btn-sm btn-ghost">+放大</button>
            <button onClick={() => setPreviewZoom(z => Math.max(0.5, z - 0.25))} className="btn btn-sm btn-ghost">-缩小</button>
            <button onClick={() => setPreviewZoom(1)} className="btn btn-sm btn-ghost">重置</button>
            <span className="text-xs text-muted">{Math.round(previewZoom * 100)}%</span>
          </div>
          {compareMode && hasOutput ? (
            <div className="flex gap-10 items-center" onClick={e => e.stopPropagation()}>
              <div className="text-center">
                <p className="text-sm text-muted mb-4">原图</p>
                <div style={{ overflow: 'auto', maxWidth: '40vw', maxHeight: '70vh' }}>
                  {compareSourceUrl ? (
                    <img src={compareSourceUrl} style={{ transform: `scale(${leftZoom})`, transformOrigin: 'top left' }} alt="original" />
                  ) : (
                    <div style={{ padding: 40, color: 'var(--color-text-muted)' }}>加载中...</div>
                  )}
                </div>
                <div className="mt-2 flex gap-2 justify-center">
                  <button onClick={() => setLeftZoom(z => Math.min(3, z + 0.25))} className="btn btn-sm btn-ghost">+</button>
                  <button onClick={() => setLeftZoom(z => Math.max(0.5, z - 0.25))} className="btn btn-sm btn-ghost">-</button>
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted mb-4">AI 结果</p>
                <div style={{ overflow: 'auto', maxWidth: '40vw', maxHeight: '70vh' }}>
                  {compareOutputUrl ? (
                    <img src={compareOutputUrl} style={{ transform: `scale(${rightZoom})`, transformOrigin: 'top left' }} alt="ai result" />
                  ) : (
                    <div style={{ padding: 40, color: 'var(--color-text-muted)' }}>加载中...</div>
                  )}
                </div>
                <div className="mt-2 flex gap-2 justify-center">
                  <button onClick={() => setRightZoom(z => Math.min(3, z + 0.25))} className="btn btn-sm btn-ghost">+</button>
                  <button onClick={() => setRightZoom(z => Math.max(0.5, z - 0.25))} className="btn btn-sm btn-ghost">-</button>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ maxWidth: '80vw', maxHeight: '75vh', overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => e.stopPropagation()}>
              {previewLoading ? (
                <div style={{ padding: 40, color: 'var(--color-text-muted)', fontSize: 16 }}>加载中...</div>
              ) : previewDataUrl ? (
                <img src={previewDataUrl} style={{ transform: `scale(${previewZoom})`, transformOrigin: 'center center', maxWidth: '100%', maxHeight: '75vh' }} alt="preview" />
              ) : (
                <div style={{ padding: 40, color: 'var(--color-text-muted)', fontSize: 14 }}>无法加载图片</div>
              )}
            </div>
          )}
        </div>
        );
      })()}

      {/* ─── Main Two-Column Layout ─── */}
      <div style={{ display: 'flex', gap: 20, flex: 1, minHeight: 0 }}>

        {/* === LEFT COLUMN: Parameters === */}
        <div style={{ width: '35%', display: 'flex', flexDirection: 'column', gap: 14, overflow: 'auto' }}>

          {/* Prompt Card */}
          <div className="card" style={s.card}>
            <label className="card-label" style={{ textTransform: 'none', letterSpacing: 0, marginBottom: 6 }}>提示词 (Prompt)</label>
            <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
              rows={5} placeholder="输入图片生成提示词..."
              style={{ ...s.input, resize: 'vertical', minHeight: 80 }} />
          </div>

          {/* Quick Prompts Card */}
          <div className="card" style={s.card}>
            <div className="card-header" style={{ marginBottom: 8 }}>
              <label className="card-label" style={{ textTransform: 'none', letterSpacing: 0, marginBottom: 0 }}>快速提示词</label>
              <button onClick={() => setShowPromptForm(!showPromptForm)} className="btn btn-sm">+ 新建</button>
            </div>

            {showPromptForm && (
              <div style={{ marginBottom: 10, padding: 10, background: 'var(--color-bg-surface)', borderRadius: 8 }}>
                <input placeholder="名称" value={newPresetName} onChange={e => setNewPresetName(e.target.value)}
                  className="input" style={{ marginBottom: 6, padding: '6px 10px', fontSize: 12 }} />
                <textarea placeholder="提示词内容（留空使用当前提示词）" value={newPresetText}
                  onChange={e => setNewPresetText(e.target.value)} rows={2}
                  className="input" style={{ marginBottom: 6, padding: '6px 10px', fontSize: 12, fontFamily: 'inherit', resize: 'vertical' }} />
                <div className="flex gap-3">
                  <select value={newPresetCategory} onChange={e => setNewPresetCategory(e.target.value)}
                    className="select" style={{ fontSize: 12, padding: '4px 8px' }}>
                    {['常用', '人像', '风景', '风格', '其他'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button onClick={handleSavePreset} className="btn btn-sm">保存</button>
                  <button onClick={() => setShowPromptForm(false)} className="btn btn-sm btn-ghost">取消</button>
                </div>
              </div>
            )}

            {groupedPresets.length === 0 ? (
              <div className="text-xs text-center" style={{ color: 'var(--color-text-muted)', padding: 12 }}>暂无保存的提示词</div>
            ) : (
              groupedPresets.map(g => (
                <div key={g.category} style={{ marginBottom: 6 }}>
                  <div className="text-xs text-muted" style={{ marginBottom: 4 }}>{g.category}</div>
                  <div className="flex flex-wrap" style={{ gap: 4 }}>
                    {g.items.map(p => (
                      <div key={p.name} style={{ position: 'relative', display: 'inline-block' }}>
                        <button onClick={() => setPrompt(p.text)}
                          className="btn btn-sm btn-ghost" style={{ fontSize: 11, padding: '3px 10px', whiteSpace: 'nowrap' }}>
                          {p.name}
                        </button>
                        <button onClick={() => setDeleteConfirmPreset(p.name)}
                          className="btn-icon" style={{ position: 'absolute', top: -6, right: -6, width: 14, height: 14, borderRadius: '50%', background: 'var(--color-danger)', fontSize: 10, opacity: 0.7 }}>
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
          <div className="card" style={s.card}>
            <label className="card-label" style={{ textTransform: 'none', letterSpacing: 0, marginBottom: 6 }}>生成参数</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* --- Model --- */}
              <div className="param-row">
                <span className="param-label">模型</span>
                <div className="flex gap-2">
                  <select value={model} onChange={e => setModel(e.target.value)} className="select" style={{ width: 150, fontSize: 12, padding: '4px 8px' }}>
                    {modelList.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                  <button onClick={() => setShowSettings(true)} className="btn btn-sm btn-ghost" title="管理模型">⚙</button>
                </div>
              </div>

              {/* --- Size --- */}
              <div className="param-row">
                <span className="param-label">尺寸</span>
                <select value={size} onChange={e => setSize(e.target.value)} className="select" style={{ width: 150, fontSize: 12, padding: '4px 8px' }}>
                  {sizeOptions.map(sz => <option key={sz} value={sz}>{sz}</option>)}
                </select>
              </div>

              {/* --- Seed --- */}
              <div className="param-row">
                <span className="param-label">种子</span>
                <div className="flex items-center gap-3">
                  {!showCustomSeed ? (
                    <button onClick={() => setShowCustomSeed(true)}
                      className="btn btn-sm btn-ghost" style={{ color: seed === -1 ? 'var(--color-text-muted)' : 'var(--color-text-secondary)' }}>
                      {seed === -1 ? '随机' : seed}
                    </button>
                  ) : (
                    <>
                      <input type="number" value={seed} onChange={e => setSeed(Number(e.target.value))}
                        className="input" style={{ width: 70, padding: '4px 8px', fontSize: 12 }} min={-1} autoFocus />
                      <button onClick={() => setSeed(-1)} className="btn btn-sm">重置</button>
                    </>
                  )}
                </div>
              </div>

              {/* --- Watermark --- */}
              <div className="param-row">
                <span className="param-label">水印</span>
                <label className="checkbox-label" style={{ fontSize: 12 }}>
                  <input type="checkbox" checked={watermark} onChange={e => setWatermark(e.target.checked)} /> Seedream 水印
                </label>
              </div>

              {/* --- Response Format --- */}
              <div className="param-row">
                <span className="param-label">返回格式</span>
                <select value={responseFormat} onChange={e => setResponseFormat(e.target.value)} className="select" style={{ width: 150, fontSize: 12, padding: '4px 8px' }}>
                  <option value="url">URL (推荐)</option>
                  <option value="b64_json">Base64</option>
                </select>
              </div>

              {/* --- Sequential (组图) --- */}
              {isSequentialSupported && (<div className="param-row">
                <span className="param-label">生成模式</span>
                <select value={sequentialMode} onChange={e => setSequentialMode(e.target.value)} className="select" style={{ width: 150, fontSize: 12, padding: '4px 8px' }}>
                  <option value="disabled">关闭 (单图)</option>
                  <option value="auto">自动 (组图)</option>
                </select>
              </div>)}

              {/* --- Max Images --- */}
              {isSequentialSupported && sequentialMode === 'auto' && (
                <div className="param-row">
                  <span className="param-label">最大图片数</span>
                  <div className="flex items-center gap-3">
                    <input type="range" min={1} max={15} value={maxImages} onChange={e => setMaxImages(Number(e.target.value))} style={{ width: 80 }} />
                    <span className="text-xs" style={{ color: 'var(--color-text-secondary)', width: 24 }}>{maxImages}</span>
                  </div>
                </div>
              )}

              {/* --- Output Format --- */}
              {isOutputFormatSupported && (<div className="param-row">
                <span className="param-label">输出格式</span>
                <select value={outputFormat} onChange={e => setOutputFormat(e.target.value)} className="select" style={{ width: 150, fontSize: 12, padding: '4px 8px' }}>
                  <option value="jpeg">JPEG</option>
                  <option value="png">PNG</option>
                </select>
              </div>)}

              {/* --- Guidance Scale --- */}
              {isGuidanceSupported && (<div className="param-row">
                <span className="param-label">文本权重</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted">1</span>
                  <input type="range" min={10} max={100} value={guidanceScale * 10} onChange={e => setGuidanceScale(Number(e.target.value) / 10)} style={{ width: 80 }} step={5} />
                  <span className="text-xs text-muted">10</span>
                  <span className="text-xs text-secondary" style={{ width: 28 }}>{guidanceScale.toFixed(1)}</span>
                </div>
              </div>)}

              {/* --- Optimize Prompt --- */}
              <div className="param-row">
                <span className="param-label">提示词优化</span>
                <select value={optimizePromptMode} onChange={e => setOptimizePromptMode(e.target.value)} className="select" style={{ width: 150, fontSize: 12, padding: '4px 8px' }}>
                  <option value="standard">标准模式 (高质量)</option>
                  <option value="fast">快速模式 (低耗时)</option>
                </select>
              </div>

              {/* --- Web Search --- */}
              {isWebSearchSupported && (<div className="param-row">
                <span className="param-label">联网搜索</span>
                <label className="checkbox-label" style={{ fontSize: 12 }}>
                  <input type="checkbox" checked={webSearch} onChange={e => setWebSearch(e.target.checked)} /> 搜索互联网
                </label>
              </div>)}

              {/* --- Concurrent --- */}
              <div className="param-row">
                <span className="param-label">并发数</span>
                <div className="flex items-center gap-3">
                  <input type="range" min={1} max={20} value={concurrent} onChange={e => setConcurrent(Number(e.target.value))} style={{ width: 80 }} />
                  <span className="text-xs text-secondary" style={{ width: 24 }}>{concurrent}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* === RIGHT COLUMN: Workflow === */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0 }}>

          {/* Reference Images */}
          <div className="card" style={s.card}>
            <div className="card-header" style={{ marginBottom: 8 }}>
              <label className="card-label" style={{ textTransform: 'none', letterSpacing: 0, marginBottom: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                参考图 <span className="text-xs text-muted">({referenceImages.length}/12)</span>
              </label>
              <button onClick={handleReferenceUpload} className="btn btn-sm">+ 上传参考图</button>
            </div>
            {referenceImages.length === 0 ? (
              <div onClick={handleReferenceUpload} className="drop-zone" style={{ padding: '16px 0' }}>
                <div style={{ fontSize: 22, marginBottom: 2 }}>+</div>拖拽或点击上传参考图
              </div>
            ) : (
              <div className="flex gap-3" style={{ overflowX: 'auto', paddingBottom: 4 }}>
                {referenceImages.map((img, i) => (
                  <div key={i} style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 8, border: '1px solid var(--color-accent)', background: 'var(--color-bg-surface)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {refThumbUrls[img] ? (
                        <img src={refThumbUrls[img]} alt={`ref${i}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ fontSize: 9, color: 'var(--color-text-muted)' }}>{img.split('\\').pop()?.substring(0, 6) || `ref${i}`}</span>
                      )}
                    </div>
                    <button onClick={() => removeReference(i)}
                      className="btn-icon" style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: 'var(--color-danger)', fontSize: 11 }}>
                      ×
                    </button>
                  </div>
                ))}
                {referenceImages.length < 12 && (
                  <div onClick={handleReferenceUpload}
                    style={{ width: 48, height: 48, borderRadius: 8, border: '2px dashed var(--color-accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: 18, flexShrink: 0 }}>+</div>
                )}
              </div>
            )}
          </div>

          {/* Batch Actions Bar */}
          <div className="flex items-center gap-3" style={{ flexShrink: 0, flexWrap: 'wrap' }}>
            <button onClick={clearQueue} className="btn btn-sm btn-ghost">清空</button>
            <button onClick={handleSelectFolder} className="btn btn-sm btn-primary">+ 添加图片</button>

            {queue.length > 0 && (
              <span className="text-xs text-muted">{completedCount}/{queue.length} 完成</span>
            )}

            {queue.filter(i => i.status === 'error').length > 0 && (
              <button onClick={retryAll} className="btn btn-sm" style={{ border: '1px solid var(--color-warning)', color: 'var(--color-warning)', background: 'transparent' }}>全部重试</button>
            )}

            {completedCount > 0 && (
              <button onClick={async () => {
                const completed = queue.filter(i => i.status === 'completed' && i.outputPath);
                setDownloadProgress({ current: 0, total: completed.length, active: true });
                let count = 0;
                for (const item of completed) {
                  try {
                    const link = document.createElement('a');
                    link.href = toFileUrl(item.outputPath!);
                    link.download = item.name;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    count++;
                  } catch { /* skip */ }
                  setDownloadProgress(p => ({ ...p, current: count }));
                }
                setDownloadProgress(p => ({ ...p, active: false }));
                showToast('下载完成', 'success');
              }} className="btn btn-sm" style={{ background: '#065f46' }}>
                全部下载
              </button>
            )}

            {/* Download Width */}
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-muted">宽度:</span>
              <select value={downloadWidth} onChange={e => { setDownloadWidth(e.target.value); setShowCustomWidth(e.target.value === 'custom'); }}
                className="select" style={{ fontSize: 12, padding: '4px 8px', width: 100 }}>
                {downloadWidthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {showCustomWidth && (
                <input type="number" value={customWidth} onChange={e => setCustomWidth(e.target.value)}
                  placeholder="px" className="input" style={{ width: 70, padding: '4px 8px', fontSize: 12 }} />
              )}
            </div>

            <div style={{ flex: 1 }} />

            {processing ? (
              <button onClick={() => { cancelRef.current = true; setCancelRequested(true); try { (window as any).go.main.App.CancelBatch(); } catch { /* no-op */ } }} className="btn btn-danger" style={{ fontWeight: 600, padding: '8px 24px' }}>
                取消处理
              </button>
            ) : (
              <button onClick={handleRun} disabled={queue.length === 0 || !prompt || processing}
                className="btn btn-primary" style={{ fontWeight: 600, padding: '8px 24px', opacity: (queue.length === 0 || !prompt || processing) ? 0.4 : 1 }}>
                开始处理 {pendingCount > 0 ? `(${pendingCount}张)` : ''}
              </button>
            )}
          </div>

          {/* Download Progress */}
          {downloadProgress.active && (
            <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 100, background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-default)', borderRadius: 8, padding: '10px 20px', fontSize: 13, color: 'var(--color-text-secondary)' }}>
              下载中 {downloadProgress.current} / {downloadProgress.total}
            </div>
          )}

          {/* Hover Preview */}
          {hoverPreviewVisible && hoverPreviewImg && (
            <div className="hover-preview" style={{ left: hoverPreviewPos.x, top: hoverPreviewPos.y }}>
              <img src={hoverPreviewImg} alt="preview" />
            </div>
          )}

          {/* Image Queue */}
          <div className="card" style={{ ...s.card, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0 10px', fontSize: 12, color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border-subtle)', marginBottom: 8 }}>
              <span>图片队列</span>
              <span>{completedCount}/{queue.length} 完成</span>
            </div>

            <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
              {queue.length === 0 ? (
                <div onClick={handleSelectFolder} className="drop-zone" style={{ padding: '40px 0' }}>
                  <div className="empty-state-icon">+</div>
                  拖拽或点击添加图片到队列<br />
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>支持 JPG/PNG/WebP/BMP/TIFF/GIF</span>
                </div>
              ) : (
                queue.map(item => (
                  <div key={item.id} className="queue-item"
                    onMouseMove={(e) => {
                      // Use higher-res (320px) thumbnail for hover preview
                      const hoverSrc = item.status === 'completed' && item.thumbUrl
                        ? item.thumbUrl
                        : item.hoverThumbUrl || item.sourceThumbUrl || null;
                      setHoverPreviewImg(hoverSrc);
                      setHoverPreviewPos({ x: e.clientX + 15, y: e.clientY + 15 });
                    }}
                    onMouseEnter={() => setHoverPreviewVisible(true)}
                    onMouseLeave={() => setHoverPreviewVisible(false)}
                  >
                    <div className="queue-thumb"
                      onClick={() => openPreview(item)}
                      title={item.outputPath || item.name}>
                      {item.status === 'completed' && item.thumbUrl ? (
                        <img src={item.thumbUrl} alt="result" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : item.status === 'completed' && item.sourceThumbUrl ? (
                        <img src={item.sourceThumbUrl} alt="source" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.7 }} />
                      ) : item.sourceThumbUrl ? (
                        <img src={item.sourceThumbUrl} alt="source" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: item.status === 'processing' ? 0.5 : item.status === 'error' ? 0.4 : 1 }} />
                      ) : item.status === 'processing' ? (
                        <span className="icon-spin" style={{ fontSize: 14 }}>⏳</span>
                      ) : item.status === 'error' ? (
                        <span style={{ fontSize: 14 }}>❌</span>
                      ) : (
                        <span style={{ fontSize: 14, opacity: 0.4 }}>🖼</span>
                      )}
                    </div>
                    <div className="queue-name">
                      <div onClick={() => openPreview(item)} style={{ cursor: 'pointer' }}>
                        {item.name}
                      </div>
                      {item.error && <div className="text-xs text-danger mt-2">{item.error}</div>}
                    </div>

                    {/* Status badges */}
                    {item.status === 'pending' && <span className="badge badge-pending">等待处理</span>}
                    {item.status === 'processing' && <span className="badge badge-processing">处理中</span>}
                    {item.status === 'completed' && (
                      <button onClick={() => openPreview(item)} className="badge badge-completed" style={{ cursor: 'pointer', border: 'none' }}>
                        ✓ 完成
                      </button>
                    )}
                    {item.status === 'error' && <span className="badge badge-error">✗ 失败</span>}
                    {item.status === 'cancelled' && <span className="badge badge-cancelled">已取消</span>}

                    {/* Actions */}
                    <div className="flex gap-2 shrink-0">
                      {item.status === 'completed' && item.outputPath && (
                        <button onClick={async () => {
                          try {
                            const link = document.createElement('a');
                            link.href = toFileUrl(item.outputPath!);
                            link.download = item.name;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          } catch { /* no-op */ }
                        }} className="btn btn-sm" title="下载">⬇</button>
                      )}
                      {item.status === 'error' && <button onClick={() => retryItem(item.id)} className="btn btn-sm btn-ghost" style={{ border: '1px solid var(--color-warning)', color: 'var(--color-warning)' }}>重试</button>}
                      <button onClick={() => removeItem(item.id)} className="btn-icon">×</button>
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
