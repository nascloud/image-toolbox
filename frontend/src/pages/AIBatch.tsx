// AI Batch page — full-featured image generation client for Volcano Engine Seedream API
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { EventsOn } from '../../wailsjs/runtime/runtime';
import { FolderEntry } from '../components/GroupedFileList';
import { useProgressContext } from '../hooks/useProgress';

// ── Types ──
interface ImageItem {
  id: number;
  name: string;
  path: string;
  outputPath?: string;
  outputPaths?: string[];
  status: 'pending' | 'processing' | 'completed' | 'error' | 'cancelled';
  error?: string;
  results?: { url?: string; b64_json?: string; size?: string }[];
  thumbUrl?: string;
  thumbUrls?: string[];
  resultHoverUrls?: string[];
  sourceThumbUrl?: string;
  hoverThumbUrl?: string;
}

interface BatchImageResult {
  sourcePath?: string;
  outputPath?: string;
  outputPaths?: string[];
  success?: boolean;
  error?: string;
}

interface BatchProgressUpdate {
  batchId?: string;
  result?: BatchImageResult;
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

const IMAGE_EXTS = ['.jpg', '.jpeg', '.jfif', '.png', '.webp', '.bmp', '.gif', '.tiff'];

// ── Helpers ──
function toFileUrl(path: string): string {
  // Convert Windows filesystem path to file:// URL for WebView
  return 'file:///' + path.replace(/\\/g, '/');
}

function fileNameFromPath(path: string): string {
  return path.split('\\').pop() || path.split('/').pop() || path;
}

function outputPathsForItem(item: ImageItem | null | undefined): string[] {
  if (!item) return [];
  if (Array.isArray(item.outputPaths) && item.outputPaths.length > 0) {
    return item.outputPaths.filter(Boolean);
  }
  return item.outputPath ? [item.outputPath] : [];
}

function clampOutputIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return Math.max(0, Math.min(index, length - 1));
}

function normalizeDroppedPath(path: string): string {
  let normalized = path.trim();
  if (normalized.startsWith('file:///')) {
    normalized = decodeURIComponent(normalized.replace(/^file:\/\/\//, ''));
  }
  return normalized;
}

function isReadableLocalPath(path: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(path) || path.startsWith('\\\\');
}

function imagePaths(paths: string[]): string[] {
  return paths
    .map(normalizeDroppedPath)
    .filter(p => {
      if (!isReadableLocalPath(p)) return false;
      const ext = p.toLowerCase().slice(p.lastIndexOf('.'));
      return IMAGE_EXTS.includes(ext);
    });
}

function pointInElement(x: number, y: number, el: HTMLElement | null): boolean {
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  const candidates = [
    { x, y },
    { x: x / window.devicePixelRatio, y: y / window.devicePixelRatio },
  ];
  return candidates.some(p => p.x >= rect.left && p.x <= rect.right && p.y >= rect.top && p.y <= rect.bottom);
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

function loadModelList(): { id: string; name: string }[] {
  return defaultModels;
}

function getSizeOptions(model: string): string[] {
  if (model.includes('5-0')) return ['1K', '2K', '3K'];
  if (model.includes('3-0-t2i')) return ['2K', '3K'];
  return ['1K', '2K', '3K', '4K'];
}

function hoverPreviewStyle(pos: { x: number; y: number }): React.CSSProperties {
  const gap = 16;
  const padding = 12;
  const maxNatural = 640;
  const rightSpace = window.innerWidth - pos.x - gap - padding;
  const leftSpace = pos.x - gap - padding;
  const bottomSpace = window.innerHeight - pos.y - gap - padding;
  const topSpace = pos.y - gap - padding;
  const showRight = rightSpace >= leftSpace;
  const showBottom = bottomSpace >= topSpace;
  const maxWidth = Math.max(120, Math.min(maxNatural, showRight ? rightSpace : leftSpace));
  const maxHeight = Math.max(120, Math.min(maxNatural, showBottom ? bottomSpace : topSpace));

  return {
    left: showRight ? pos.x + gap : 'auto',
    right: showRight ? 'auto' : window.innerWidth - pos.x + gap,
    top: showBottom ? pos.y + gap : 'auto',
    bottom: showBottom ? 'auto' : window.innerHeight - pos.y + gap,
    maxWidth,
    maxHeight,
  };
}

const modelNameMap: Record<string, string> = {
  'doubao-seedream-5-0-260128': 'Seedream 5.0',
  'doubao-seedream-5-0-lite-260128': 'Seedream 5.0 Lite',
  'doubao-seedream-4-5-251128': 'Seedream 4.5',
  'doubao-seedream-4-0-250828': 'Seedream 4.0',
  'doubao-seedream-3-0-t2i-250415': 'Seedream 3.0',
};

function displayModelName(m: { id: string; name?: string }): string {
  return m.name || modelNameMap[m.id] || m.id;
}

const providerDefaultModel: Record<string, string> = {
  seedream: 'doubao-seedream-5-0-lite-260128',
  chatgpt2api: 'gpt-image-2',
};

// ── Component ──
export const AIBatch: React.FC = () => {

  // ── State ──
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState(providerDefaultModel.seedream);
  const [modelList, setModelList] = useState<{ id: string; name: string }[]>(loadModelList);
  const [size, setSize] = useState('2K');
  const [quality, setQuality] = useState('auto');
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
  const [concurrent, setConcurrent] = useState(5);
  const [aiOutputDir, setAiOutputDir] = useState('');
  const [downloadWidth, setDownloadWidth] = useState('1440');
  const [customWidth, setCustomWidth] = useState('');
  const [showCustomWidth, setShowCustomWidth] = useState(false);
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [refThumbUrls, setRefThumbUrls] = useState<Record<string, string>>({});
  const [queue, setQueue] = useState<ImageItem[]>([]);
  const [folders, setFolders] = useState<FolderEntry[]>([]);
  const [recursive, setRecursive] = useState(true);
  const [looseFilePaths, setLooseFilePaths] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [cancelRequested, setCancelRequested] = useState(false);
  const [presets, setPresets] = useState<PromptPreset[]>(loadPresets);
  const [showPromptForm, setShowPromptForm] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetText, setNewPresetText] = useState('');
  const [newPresetCategory, setNewPresetCategory] = useState('常用');
  const [deleteConfirmPreset, setDeleteConfirmPreset] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: ToastType } | null>(null);
  const [selectedPreview, setSelectedPreview] = useState<ImageItem | null>(null);
  const [selectedOutputPath, setSelectedOutputPath] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [compareMode, setCompareMode] = useState(false);
  const [leftZoom, setLeftZoom] = useState(1);
  const [rightZoom, setRightZoom] = useState(1);
  const [downloadProgress, setDownloadProgress] = useState<{ current: number; total: number; active: boolean }>({ current: 0, total: 0, active: false });
  const [provider, setProvider] = useState('seedream');
  const [availableModels, setAvailableModels] = useState<Array<{ id: string; capabilities: any }>>([]);
  const [n, setN] = useState(1);
  const savedProviderParams = useRef<Record<string, any>>({});
  const { updateProgress } = useProgressContext();
  const [hoverPreviewImg, setHoverPreviewImg] = useState<string | null>(null);
  const [hoverPreviewPos, setHoverPreviewPos] = useState({ x: 0, y: 0 });
  const [hoverPreviewVisible, setHoverPreviewVisible] = useState(false);
  const [queueDragOver, setQueueDragOver] = useState(false);
  const [referenceDragOver, setReferenceDragOver] = useState(false);
  // Preview modal: full-res base64 data URLs (loaded on demand)
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [compareSourceUrl, setCompareSourceUrl] = useState<string | null>(null);
  const [compareOutputUrl, setCompareOutputUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const refInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queueDropRef = useRef<HTMLDivElement>(null);
  const referenceDropRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(0);
  const cancelRef = useRef(false);
  const activeBatchIdRef = useRef<string | null>(null);
  const queueRef = useRef<ImageItem[]>([]);
  const previewLoadTokenRef = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();
  const previewIndexRef = useRef(previewIndex);
  previewIndexRef.current = previewIndex;
  const retryingItems = useRef(new Set<number>());
  const previewLoadSeq = useRef(0);
  const saveInProgressRef = useRef(false);
  const selectedPreviewRef = useRef(selectedPreview);
  selectedPreviewRef.current = selectedPreview;

  function getEffectiveWidth(): number {
    return downloadWidth === 'custom'
      ? (parseInt(customWidth) || 0)
      : downloadWidth === 'original' ? 0 : parseInt(downloadWidth);
  }

  // Build RunAIImageBatch request from current panel parameters for given source paths
  function buildBatchRequest(paths: string[], batchId: string) {
    const outputDir = aiOutputDir || (paths[0]?.substring(0, paths[0].lastIndexOf('\\')) ?? '');
    const downloadW = getEffectiveWidth();
    const maxGeneratedImages = Math.max(1, 15 - (1 + referenceImages.length));
    return {
      batchId,
      sourcePaths: paths,
      outputDir,
      provider,
      prompt,
      model,
      size,
      quality,
      seed: isGuidanceSupported && seed >= 0 ? seed : -1,
      outputFormat: isOutputFormatSupported ? outputFormat : 'jpeg',
      watermark,
      guidanceScale: isGuidanceSupported ? guidanceScale : 0,
      responseFormat,
      sequentialImageGeneration: isSequentialSupported ? sequentialMode : 'disabled',
      maxImages: Math.min(maxImages, maxGeneratedImages),
      optimizePromptMode: isFastPromptOptimizeSupported ? optimizePromptMode : 'standard',
      webSearch: isWebSearchSupported && webSearch,
      concurrent: Math.min(concurrent, paths.length),
      referenceImages,
      downloadWidth: isNaN(downloadW) ? 0 : downloadW,
      n: currentModelCaps.supportsN ? n : 1,
    };
  }

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  const outputPathsFromResult = useCallback((result: BatchImageResult): string[] => {
    if (Array.isArray(result.outputPaths) && result.outputPaths.length > 0) {
      return result.outputPaths;
    }
    return result.outputPath ? [result.outputPath] : [];
  }, []);

  const loadResultThumbnails = useCallback(async (sourcePath: string, outputPaths: string[]) => {
    if (outputPaths.length === 0) return;
    const existing = queueRef.current.find(i => i.path === sourcePath);
    const existingOutputPaths = existing?.outputPaths || (existing?.outputPath ? [existing.outputPath] : []);
    const thumbnailsAlreadyLoaded = existing
      && existingOutputPaths.length === outputPaths.length
      && existingOutputPaths.every((path, index) => path === outputPaths[index])
      && existing.thumbUrls?.length === outputPaths.length
      && existing.resultHoverUrls?.length === outputPaths.length
      && existing.thumbUrls.every(Boolean)
      && existing.resultHoverUrls.every(Boolean);
    if (thumbnailsAlreadyLoaded) return;

    const thumbUrls = await Promise.all(outputPaths.map(async (outPath: string) => {
      try {
        const dataUrl = await (window as any).go.main.App.ReadImageThumbnail(outPath, 80);
        return dataUrl && dataUrl.startsWith('data:') ? dataUrl : '';
      } catch {
        return '';
      }
    }));
    const resultHoverUrls = await Promise.all(outputPaths.map(async (outPath: string) => {
      try {
        const dataUrl = await (window as any).go.main.App.ReadImageThumbnail(outPath, 640);
        return dataUrl && dataUrl.startsWith('data:') ? dataUrl : '';
      } catch {
        return '';
      }
    }));

    setQueue(prev => prev.map(i => {
      if (i.path !== sourcePath) return i;
      return { ...i, thumbUrl: thumbUrls[0], thumbUrls, resultHoverUrls };
    }));
  }, []);

  const applyImageResultToQueue = useCallback((result: BatchImageResult, realtimeOnly: boolean) => {
    if (!result?.sourcePath) return;

    const outputPaths = outputPathsFromResult(result);
    setQueue(prev => prev.map(i => {
      if (i.path !== result.sourcePath) return i;
      if (realtimeOnly && i.status !== 'processing') return i;
      if (result.success && outputPaths.length > 0) {
        return { ...i, status: 'completed' as const, outputPath: outputPaths[0], outputPaths };
      }
      return {
        ...i,
        status: 'error' as const,
        error: result.success ? '未返回输出文件路径' : (result.error || '处理失败'),
      };
    }));
  }, [outputPathsFromResult]);

  const startBatchRun = useCallback(() => {
    const batchId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    activeBatchIdRef.current = batchId;
    return batchId;
  }, []);

  const finishBatchRun = useCallback((batchId: string) => {
    if (activeBatchIdRef.current === batchId) {
      activeBatchIdRef.current = null;
    }
  }, []);

  useEffect(() => {
    const off = EventsOn('batch-progress', (update: BatchProgressUpdate) => {
      if (!update?.batchId || update.batchId !== activeBatchIdRef.current) return;
      const result = update.result;
      if (!result?.sourcePath) return;
      const outputPaths = outputPathsFromResult(result);
      applyImageResultToQueue(result, true);
      if (result.success && outputPaths.length > 0) {
        void loadResultThumbnails(result.sourcePath, outputPaths);
      }
    });

    return () => {
      off();
    };
  }, [applyImageResultToQueue, loadResultThumbnails, outputPathsFromResult]);

  // Clean up toast timer on unmount
  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  // ── Model capability helpers ──
  const hasCapabilities = availableModels.length > 0;
  const currentModelCaps = useMemo(() => {
    const m = availableModels.find(m => m.id === model);
    return m?.capabilities ?? {};
  }, [availableModels, model]);

  const isSequentialSupported = hasCapabilities ? (currentModelCaps.supportsSequential ?? false) : (model.includes('5-0') || model.includes('4-5') || model.includes('4-0'));
  const isOutputFormatSupported = hasCapabilities ? (currentModelCaps.supportsOutputFormat ?? false) : model.includes('5-0');
  const isGuidanceSupported = hasCapabilities ? (currentModelCaps.supportsGuidanceScale ?? false) : model.includes('3-0-t2i');
  const isWebSearchSupported = hasCapabilities ? (currentModelCaps.supportsWebSearch ?? false) : model.includes('5-0');
  const isFastPromptOptimizeSupported = hasCapabilities ? (currentModelCaps.supportsFastPromptOptimize ?? false) : model.includes('4-0');
  const modelSizeOptions = useMemo((): string[] => {
    if (provider === 'chatgpt2api') {
      return ['auto', '1:1', '3:4', '4:3', '16:9', '9:16', '3:2', '2:3', '21:9'];
    }
    if (currentModelCaps.allowedSizes?.length) return currentModelCaps.allowedSizes;
    return getSizeOptions(model);
  }, [currentModelCaps, model, provider]);
  const displayModels = availableModels.length > 0 ? availableModels : modelList;

  // ── Computed-like ──
  const pendingCount = queue.filter(i => i.status === 'pending' || i.status === 'error').length;
  const completedCount = queue.filter(i => i.status === 'completed').length;

  useEffect(() => {
    if (!modelSizeOptions.includes(size)) {
      setSize(modelSizeOptions[0] || '2K');
    }
    if (!isOutputFormatSupported && outputFormat !== 'jpeg') {
      setOutputFormat('jpeg');
    }
    if (!isSequentialSupported && sequentialMode !== 'disabled') {
      setSequentialMode('disabled');
    }
    if (!isWebSearchSupported && webSearch) {
      setWebSearch(false);
    }
    if (!isFastPromptOptimizeSupported && optimizePromptMode === 'fast') {
      setOptimizePromptMode('standard');
    }
  }, [model, modelSizeOptions, size, isOutputFormatSupported, outputFormat, isSequentialSupported, sequentialMode, isWebSearchSupported, webSearch, isFastPromptOptimizeSupported, optimizePromptMode]);

  // Load active provider on mount
  useEffect(() => {
    (async () => {
      try {
        const active = await (window as any).go.main.App.GetActiveProvider();
        if (active && active !== provider) setProvider(active);
      } catch { /* no-op */ }
    })();
  }, []);

  // Fetch models when provider changes
  useEffect(() => {
    (async () => {
      if (!provider) return;
      try {
        const models = await (window as any).go.main.App.GetProviderModels(provider);
        setAvailableModels(models);
        if (models.length > 0 && !(models as any[]).find((m: any) => m.id === model)) {
          const fallback = providerDefaultModel[provider] || models[0].id;
          if ((models as any[]).find((m: any) => m.id === fallback)) {
            setModel(fallback);
          } else {
            setModel(models[0].id);
          }
        }
      } catch {
        setAvailableModels([]);
      }
    })();
  }, [provider]);

  // Provider switch handler — saves current params, restores saved params for new provider
  const handleProviderChange = (newProvider: string) => {
    const currentParams = { model, size, quality, seed, showCustomSeed, outputFormat, watermark, guidanceScale, sequentialMode, maxImages, optimizePromptMode, webSearch, n };
    savedProviderParams.current[provider] = currentParams;
    setProvider(newProvider);
    const restored = savedProviderParams.current[newProvider];
    if (restored) {
      setModel(restored.model);
      if (restored.size) setSize(restored.size);
      if (restored.quality) setQuality(restored.quality);
      setSeed(restored.seed);
      setShowCustomSeed(restored.showCustomSeed);
      setOutputFormat(restored.outputFormat);
      setWatermark(restored.watermark);
      setGuidanceScale(restored.guidanceScale);
      setSequentialMode(restored.sequentialMode);
      setMaxImages(restored.maxImages);
      setOptimizePromptMode(restored.optimizePromptMode);
      setWebSearch(restored.webSearch);
      setN(restored.n);
    }
  };

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



  // ── Queue Management ──
  const addFiles = useCallback((paths: string[]) => {
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
          // Load larger thumbnail (640px) for hover preview
          const hoverUrl = await (window as any).go.main.App.ReadImageThumbnail(item.path, 640);
          if (hoverUrl && hoverUrl.startsWith('data:')) {
            setQueue(q => q.map(i => i.id === item.id ? { ...i, hoverThumbUrl: hoverUrl } : i));
          }
        } catch {
          // no-op
        }
      });

      return [...prev, ...items];
    });
  }, []);

  const handleSelectFiles = async () => {
    try {
      const result = await (window as any).go.main.App.SelectFiles();
      if (result) {
        const sourceFiles = new Set(folders.flatMap(f => f.scannedFiles));
        const filtered = result.filter((p: string) => !sourceFiles.has(p) && !looseFilePaths.includes(p));
        setLooseFilePaths(prev => [...prev, ...filtered]);
        addFiles(result);
      }
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
          addFiles(scanned);
        }
      }
    } catch { /* no-op */ }
  };

  const handleRecursiveChange = async (v: boolean) => {
    setRecursive(v);
    const updated = await Promise.all(folders.map(f =>
      (window as any).go.main.App.ScanDirectory(f.path, v)
        .then((scanned: string[]) => {
          const oldPaths = new Set(f.scannedFiles);
          setQueue(q => q.filter(item => !oldPaths.has(item.path)));
          addFiles(scanned || []);
          return { path: f.path, scannedFiles: scanned || [] };
        })
    ));
    setFolders(updated);
  };

  const retryItem = async (id: number) => {
    if (processing) return;
    if (retryingItems.current.has(id)) return;

    const item = queue.find(i => i.id === id);
    if (!item) return;

    retryingItems.current.add(id);
    updateProgress({ completed: 0, total: 1, current: '正在重试...', running: true, done: false });

    // Reset item to processing immediately
    setQueue(prev => prev.map(i =>
      i.id === id ? { ...i, status: 'processing' as const, error: undefined,
        results: undefined, outputPath: undefined, outputPaths: undefined,
        thumbUrl: undefined, thumbUrls: undefined, resultHoverUrls: undefined } : i
    ));

    const batchId = startBatchRun();
    try {
      const result = await (window as any).go.main.App.RunAIImageBatch(
        buildBatchRequest([item.path], batchId)
      );

      if (!result || !result.results || result.results.length === 0) {
        setQueue(prev => prev.map(i =>
          i.id === id ? { ...i, status: 'error' as const, error: result?.error || '处理失败' } : i
        ));
        updateProgress({
          completed: 0,
          total: 1,
          current: '',
          running: false,
          done: true,
          error: result?.error || '处理失败',
        });
        finishBatchRun(batchId);
        setProcessing(false);
        return;
      }

      const r = result.results[0];
      setQueue(prev => prev.map(i => {
        if (i.id !== id) return i;
        const outputPaths = Array.isArray(r.outputPaths) && r.outputPaths.length > 0
          ? r.outputPaths
          : r.outputPath ? [r.outputPath] : [];
        if (r.success && outputPaths.length > 0) {
          return { ...i, status: 'completed' as const, outputPath: outputPaths[0], outputPaths };
        }
        return { ...i, status: 'error' as const, error: r.success ? '未返回输出文件路径' : (r.error || '处理失败') };
      }));

      // Load thumbnails on success
      if (r.success) {
        const outputPaths = Array.isArray(r.outputPaths) && r.outputPaths.length > 0
          ? r.outputPaths
          : r.outputPath ? [r.outputPath] : [];
        if (outputPaths.length > 0) {
          await loadResultThumbnails(item.path, outputPaths);
        }
      }

      if (!r.success) {
        updateProgress({ completed: 0, total: 1, current: '', running: false, done: true, error: r.error || '处理失败' });
      } else {
        updateProgress({ completed: 1, total: 1, current: '', running: false, done: true });
      }
    } catch (err: any) {
      setQueue(prev => prev.map(i =>
        i.id === id ? { ...i, status: 'error' as const, error: err.message } : i
      ));
      updateProgress({ completed: 0, total: 1, current: '', running: false, done: true, error: err.message });
    } finally {
      retryingItems.current.delete(id);
    }
    finishBatchRun(batchId);
    setProcessing(false);
  };

  const removeItem = (id: number) => {
    setQueue(prev => prev.filter(i => i.id !== id));
  };

  const clearQueue = () => {
    setQueue([]);
    nextId.current = 0;
  };

  // ── Reference Images ──
  const addReferenceImages = useCallback((paths: string[]) => {
    const filtered = imagePaths(paths);
    if (filtered.length === 0) return;
    setReferenceImages(prev => [...prev, ...filtered].slice(0, 12));
    filtered.forEach(async (imgPath) => {
      try {
        const dataUrl = await (window as any).go.main.App.ReadImageThumbnail(imgPath, 80);
        if (dataUrl && dataUrl.startsWith('data:')) {
          setRefThumbUrls(prev => ({ ...prev, [imgPath]: dataUrl }));
        }
      } catch { /* no-op */ }
    });
  }, []);

  const handleReferenceUpload = async () => {
    try {
      const result = await (window as any).go.main.App.SelectFiles();
      if (result) {
        addReferenceImages(result);
      }
    } catch { /* no-op */ }
  };

  const removeReference = (index: number) => setReferenceImages(prev => prev.filter((_, i) => i !== index));

  useEffect(() => {
    const off = EventsOn('app:file-drop', (x: number, y: number, paths: string[]) => {
      const filtered = imagePaths(paths);
      if (filtered.length === 0) {
        setQueueDragOver(false);
        setReferenceDragOver(false);
        return;
      }
      if (pointInElement(x, y, referenceDropRef.current)) {
        addReferenceImages(filtered);
      } else if (pointInElement(x, y, queueDropRef.current)) {
        addFiles(filtered);
      }
      setQueueDragOver(false);
      setReferenceDragOver(false);
    });

    return () => {
      off();
    };
  }, [addFiles, addReferenceImages]);

  const handleNativeDrop = useCallback((e: React.DragEvent, target: 'queue' | 'reference') => {
    e.preventDefault();
    e.stopPropagation();
    const paths = imagePaths(Array.from(e.dataTransfer.files).map(f => (f as any).path || f.name));
    if (target === 'reference') {
      addReferenceImages(paths);
      setReferenceDragOver(false);
    } else {
      addFiles(paths);
      setQueueDragOver(false);
    }
  }, [addFiles, addReferenceImages]);

  // ── Main Processing ──
  const handleRun = async () => {
    // Use a local snapshot of pending items
    const pendingItems = queue.filter(i => i.status === 'pending');
    if (pendingItems.length === 0 || !prompt) {
      showToast('请添加图片和提示词', 'warning');
      return;
    }
    if (processing || retryingItems.current.size > 0) return;

    setProcessing(true);
    updateProgress({
      completed: 0,
      total: pendingItems.length,
      current: '准备中...',
      running: true,
      done: false,
    });
    cancelRef.current = false;
    setCancelRequested(false);

    // Mark all pending items as processing in one shot
    setQueue(prev => prev.map(i =>
      i.status === 'pending' ? { ...i, status: 'processing' as const } : i
    ));

    const batchId = startBatchRun();
    try {
      if (cancelRef.current) { finishBatchRun(batchId); setProcessing(false); return; }

      const result = await (window as any).go.main.App.RunAIImageBatch(
        buildBatchRequest(pendingItems.map(i => i.path), batchId)
      );

      if (cancelRef.current || !result) {
        if (!result) showToast('处理失败：无返回结果', 'error');
        setQueue(prev => prev.map(i =>
          i.status === 'processing' ? { ...i, status: cancelRef.current ? 'cancelled' as const : 'error' as const, error: !result ? '无返回结果' : undefined } : i
        ));
        updateProgress({
          completed: 0,
          total: pendingItems.length,
          current: '',
          running: false,
          done: true,
          error: !result ? '无返回结果' : '已取消',
        });
      } else if (result.results && result.results.length > 0) {
        // Map batch results back to queue items by source path
        const resultByPath = new Map<string, any>();
        for (const r of result.results) {
          if (r.sourcePath) resultByPath.set(r.sourcePath, r);
        }

        let failedCount = 0;
    const successCount = pendingItems.filter(item => {
      const r = resultByPath.get(item.path);
      return r && r.success;
    }).length;
    updateProgress({
      completed: successCount,
      total: pendingItems.length,
      current: '',
      running: false,
      done: false,
    });
        setQueue(prev => prev.map(i => {
          const r = resultByPath.get(i.path);
          if (r) {
            const outputPaths = Array.isArray(r.outputPaths) && r.outputPaths.length > 0
              ? r.outputPaths
              : r.outputPath ? [r.outputPath] : [];
            if (r.success && outputPaths.length > 0) {
              return { ...i, status: 'completed' as const, outputPath: outputPaths[0], outputPaths };
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
          const outputPaths = Array.isArray(r?.outputPaths) && r.outputPaths.length > 0
            ? r.outputPaths
            : r?.outputPath ? [r.outputPath] : [];
          return r && r.success && outputPaths.length > 0;
        });
        await Promise.all(completed.map(async (item) => {
          const r = resultByPath.get(item.path);
          const outputPaths = Array.isArray(r?.outputPaths) && r.outputPaths.length > 0
            ? r.outputPaths
            : r?.outputPath ? [r.outputPath] : [];
          if (!r || outputPaths.length === 0) return;
          await loadResultThumbnails(item.path, outputPaths);
        }));

        const completedCount = pendingItems.filter(item => {
          const r = resultByPath.get(item.path);
          return r && r.success;
        }).length;
        updateProgress({
          completed: completedCount,
          total: pendingItems.length,
          current: '',
          running: false,
          done: true,
        });

        if (failedCount > 0) showToast(`${failedCount} 张处理失败`, 'error');
      } else {
        showToast(result.error || '处理失败', 'error');
        setQueue(prev => prev.map(i =>
          i.status === 'processing' ? { ...i, status: 'error' as const, error: result.error || '未返回处理结果' } : i
        ));
        updateProgress({
          completed: 0,
          total: pendingItems.length,
          current: '',
          running: false,
          done: true,
          error: result.error || '处理失败',
        });
      }
    } catch (err: any) {
      showToast(`处理出错: ${err.message}`, 'error');
      setQueue(prev => prev.map(i =>
        i.status === 'processing' ? { ...i, status: 'error' as const, error: err.message } : i
      ));
      updateProgress({
        completed: 0,
        total: pendingItems.length,
        current: '',
        running: false,
        done: true,
        error: err.message,
      });
    }

    finishBatchRun(batchId);
    setProcessing(false);
    setCancelRequested(false);
    cancelRef.current = false;
  };

  const retryAll = async () => {
    if (processing || retryingItems.current.size > 0) return;
    const toRetry = queue.filter(i => i.status === 'error' || i.status === 'completed');
    if (toRetry.length === 0) { showToast('没有需要重试的图片', 'warning'); return; }

    setProcessing(true);
    updateProgress({
      completed: 0,
      total: toRetry.length,
      current: '准备中...',
      running: true,
      done: false,
    });

    // Mark all toRetry items as processing
    setQueue(prev => prev.map(i =>
      (i.status === 'error' || i.status === 'completed')
        ? { ...i, status: 'processing' as const, error: undefined,
          results: undefined, outputPath: undefined, outputPaths: undefined,
          thumbUrl: undefined, thumbUrls: undefined, resultHoverUrls: undefined }
        : i
    ));

    const batchId = startBatchRun();
    try {
      const result = await (window as any).go.main.App.RunAIImageBatch(
        buildBatchRequest(toRetry.map(i => i.path), batchId)
      );

      if (!result || !result.results) {
        if (!result) showToast('处理失败：无返回结果', 'error');
        setQueue(prev => prev.map(i =>
          (i.status === 'processing')
            ? { ...i, status: 'error' as const, error: result?.error || '处理失败' }
            : i
        ));
        updateProgress({
          completed: 0,
          total: toRetry.length,
          current: '',
          running: false,
          done: true,
          error: result?.error || '处理失败',
        });
        finishBatchRun(batchId);
        setProcessing(false);
        return;
      }

      // Map results back to queue items by source path
      const resultByPath = new Map<string, any>();
      for (const r of result.results) {
        if (r.sourcePath) resultByPath.set(r.sourcePath, r);
      }

      const retryPaths = new Set(toRetry.map(item => item.path));
      const failedCount = toRetry.filter(item => {
        const r = resultByPath.get(item.path);
        const outputPaths = r ? outputPathsFromResult(r) : [];
        return !r || !r.success || outputPaths.length === 0;
      }).length;
      setQueue(prev => prev.map(i => {
        if (!retryPaths.has(i.path)) return i;
        const r = resultByPath.get(i.path);
        if (r) {
          const outputPaths = outputPathsFromResult(r);
          if (r.success && outputPaths.length > 0) {
            return { ...i, status: 'completed' as const, outputPath: outputPaths[0], outputPaths };
          }
          return { ...i, status: 'error' as const, error: r.error || '处理失败' };
        }
        return { ...i, status: 'error' as const, error: '未返回处理结果' };
      }));

      const successCount = result.results.filter((r: any) => r.success).length;
      updateProgress({
        completed: successCount,
        total: toRetry.length,
        current: '',
        running: false,
        done: false,
      });

      // Load thumbnails for all completed items
      const completedResults = result.results.filter((r: any) => r.success);
      await Promise.all(completedResults.map(async (r: any) => {
        const outputPaths = outputPathsFromResult(r);
        if (outputPaths.length === 0) return;
        await loadResultThumbnails(r.sourcePath, outputPaths);
      }));

      updateProgress({
        completed: successCount,
        total: toRetry.length,
        current: '',
        running: false,
        done: true,
      });

      if (failedCount > 0) showToast(`${failedCount} 张处理失败`, 'error');
    } catch (err: any) {
      showToast(`处理出错: ${err.message}`, 'error');
      setQueue(prev => prev.map(i =>
        (i.status === 'processing')
          ? { ...i, status: 'error' as const, error: err.message }
          : i
      ));
      updateProgress({
        completed: 0,
        total: toRetry.length,
        current: '',
        running: false,
        done: true,
        error: err.message,
      });
    }
    finishBatchRun(batchId);
    setProcessing(false);
  };

  // ── Preview ──
  const loadPreviewImages = useCallback(async (item: ImageItem, outputIndex: number, nextCompareMode: boolean) => {
    const loadToken = ++previewLoadTokenRef.current;
    const outputPaths = outputPathsForItem(item);
    const safeOutputIndex = clampOutputIndex(outputIndex, outputPaths.length);
    const outputPath = outputPaths[safeOutputIndex] || null;
    setSelectedOutputPath(outputPath);
    setPreviewIndex(safeOutputIndex);
    setPreviewZoom(1);
    setLeftZoom(1);
    setRightZoom(1);
    setPreviewDataUrl(null);
    setCompareSourceUrl(null);
    setCompareOutputUrl(null);
    setPreviewLoading(true);

    try {
      const sourcePromise = (window as any).go.main.App.ReadImageAsBase64(item.path);
      if (nextCompareMode && outputPath) {
        const [srcUrl, outUrl] = await Promise.all([
          sourcePromise,
          (window as any).go.main.App.ReadImageAsBase64(outputPath),
        ]);
        if (previewLoadTokenRef.current !== loadToken) return;
        if (srcUrl) {
          setCompareSourceUrl(srcUrl);
          setPreviewDataUrl(srcUrl);
        }
        if (outUrl) setCompareOutputUrl(outUrl);
      } else {
        const dataUrl = await sourcePromise;
        if (previewLoadTokenRef.current !== loadToken) return;
        if (dataUrl) setPreviewDataUrl(dataUrl);
      }
    } catch { /* no-op */ }

    if (previewLoadTokenRef.current === loadToken) {
      setPreviewLoading(false);
    }
  }, []);

  const openPreview = async (item: ImageItem, outputPath?: string) => {
    const outputPaths = outputPathsForItem(item);
    const outputIndex = outputPath ? Math.max(0, outputPaths.indexOf(outputPath)) : 0;
    const nextCompareMode = Boolean(outputPath || outputPaths.length > 0);
    setSelectedPreview(item);
    setCompareMode(nextCompareMode);
    await loadPreviewImages(item, outputIndex, nextCompareMode);
  };

  const movePreviewOutput = useCallback((delta: number) => {
    if (!selectedPreview) return;
    const outputPaths = outputPathsForItem(selectedPreview);
    if (outputPaths.length <= 1) return;
    const nextIndex = (previewIndex + delta + outputPaths.length) % outputPaths.length;
    void loadPreviewImages(selectedPreview, nextIndex, true);
  }, [loadPreviewImages, previewIndex, selectedPreview]);

  const movePreviewQueue = useCallback((delta: number) => {
    if (!selectedPreview) return;
    const navigable = queue.filter(item => outputPathsForItem(item).length > 0);
    if (navigable.length <= 1) return;
    const currentIndex = navigable.findIndex(item => item.id === selectedPreview.id);
    if (currentIndex < 0) return;
    const nextItem = navigable[(currentIndex + delta + navigable.length) % navigable.length];
    setSelectedPreview(nextItem);
    setCompareMode(true);
    void loadPreviewImages(nextItem, 0, true);
  }, [loadPreviewImages, queue, selectedPreview]);

  const closePreview = useCallback(() => {
    previewLoadTokenRef.current += 1;
    setSelectedPreview(null);
    setPreviewIndex(0);
    setPreviewZoom(1);
    setCompareMode(false);
    setSelectedOutputPath(null);
    setPreviewDataUrl(null);
    setCompareSourceUrl(null);
    setCompareOutputUrl(null);
  }, []);

  useEffect(() => {
    if (!selectedPreview) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closePreview();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        movePreviewOutput(-1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        movePreviewOutput(1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        movePreviewQueue(-1);
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        movePreviewQueue(1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closePreview, movePreviewOutput, movePreviewQueue, selectedPreview]);

  // Load compare mode images on demand
  const loadCompareImages = async (item: ImageItem) => {
    const outputPaths = outputPathsForItem(item);
    await loadPreviewImages(item, previewIndex, outputPaths.length > 0);
  };

  const loadPreviewSource = async () => {
    if (!selectedPreview) return;
    try {
      const dataUrl = await (window as any).go.main.App.ReadImageAsBase64(selectedPreview.path);
      if (dataUrl) setPreviewDataUrl(dataUrl);
    } catch { /* no-op */ }
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

      {/* Preview Modal — fullscreen overlay */}
      {selectedPreview && (() => {
        const outputPaths = outputPathsForItem(selectedPreview);
        const hasOutput = selectedPreview.status === 'completed' && outputPaths.length > 0 && selectedOutputPath;
        const outputName = selectedOutputPath ? fileNameFromPath(selectedOutputPath) : selectedPreview.name;
        const currentQueueIndex = queue.findIndex(item => item.id === selectedPreview.id);
        const canSwitchOutputs = outputPaths.length > 1;
        const canSwitchQueue = queue.filter(item => outputPathsForItem(item).length > 0).length > 1;
        const renderZoomControls = (
          value: number,
          onChange: React.Dispatch<React.SetStateAction<number>>,
          label: string,
        ) => (
          <div className="compare-zoom-controls" aria-label={`${label}缩放控制`}>
            <button type="button" onClick={() => onChange(z => Math.max(0.25, z - 0.25))} title={`${label}缩小`}>−</button>
            <span>{Math.round(value * 100)}%</span>
            <button type="button" onClick={() => onChange(z => Math.min(4, z + 0.25))} title={`${label}放大`}>+</button>
            <button type="button" onClick={() => onChange(1)} title={`${label}重置缩放`}>重置</button>
          </div>
        );
        return (
        <div className="modal-overlay compare-modal-overlay" onClick={closePreview}>
          <div className="compare-modal-shell" onClick={e => e.stopPropagation()}>
            <div className="compare-toolbar">
              <div className="compare-title-block">
                <span className="compare-kicker">
                  {hasOutput ? '原图 / AI 对比' : '源图预览'}
                  {currentQueueIndex >= 0 ? ` · 队列 ${currentQueueIndex + 1}/${queue.length}` : ''}
                </span>
                <strong className="compare-title">{selectedPreview.name}</strong>
                <span className="compare-subtitle">
                  {hasOutput ? `${outputName} · 结果 ${previewIndex + 1}/${outputPaths.length}` : outputName}
                </span>
              </div>
              <div className="compare-toolbar-actions">
                {hasOutput && (
                  <button onClick={() => {
                    const next = !compareMode;
                    setCompareMode(next);
                    if (next) {
                      void loadCompareImages(selectedPreview);
                    } else if (!previewDataUrl && selectedPreview) {
                      void loadPreviewSource();
                    }
                  }} className="btn btn-sm" style={{ background: compareMode ? 'var(--color-accent)' : 'var(--color-bg-elevated)' }}>
                    {compareMode ? '单图' : '对比'}
                  </button>
                )}
                <button onClick={closePreview} className="btn-icon" style={{ fontSize: 18 }} title="关闭">×</button>
              </div>
            </div>

            {hasOutput && (
              <>
                <button
                  className="compare-nav compare-nav-left"
                  onClick={() => movePreviewOutput(-1)}
                  disabled={!canSwitchOutputs}
                  title="上一张结果 (←)"
                >
                  ‹
                </button>
                <button
                  className="compare-nav compare-nav-right"
                  onClick={() => movePreviewOutput(1)}
                  disabled={!canSwitchOutputs}
                  title="下一张结果 (→)"
                >
                  ›
                </button>
                <button
                  className="compare-nav compare-nav-up"
                  onClick={() => movePreviewQueue(-1)}
                  disabled={!canSwitchQueue}
                  title="队列上一张 (↑)"
                >
                  ↑
                </button>
                <button
                  className="compare-nav compare-nav-down"
                  onClick={() => movePreviewQueue(1)}
                  disabled={!canSwitchQueue}
                  title="队列下一张 (↓)"
                >
                  ↓
                </button>
              </>
            )}

          {compareMode && hasOutput ? (
            <div className="compare-view">
              <div className="compare-pane">
                <div className="compare-pane-header">
                  <p className="compare-pane-label">原图</p>
                  {renderZoomControls(leftZoom, setLeftZoom, '原图')}
                </div>
                <div className={`compare-image-frame ${leftZoom > 1 ? 'is-zoomed' : ''}`}>
                  {compareSourceUrl ? (
                    <img
                      src={compareSourceUrl}
                      alt="original"
                      style={leftZoom === 1
                        ? undefined
                        : { width: `${leftZoom * 100}%`, maxWidth: 'none', maxHeight: 'none' }}
                    />
                  ) : (
                    <div className="compare-loading">加载中...</div>
                  )}
                </div>
              </div>
              <div className="compare-pane">
                <div className="compare-pane-header">
                  <p className="compare-pane-label">AI 结果</p>
                  {renderZoomControls(rightZoom, setRightZoom, 'AI 结果')}
                </div>
                <div className={`compare-image-frame ${rightZoom > 1 ? 'is-zoomed' : ''}`}>
                  {compareOutputUrl ? (
                    <img
                      src={compareOutputUrl}
                      alt="ai result"
                      style={rightZoom === 1
                        ? undefined
                        : { width: `${rightZoom * 100}%`, maxWidth: 'none', maxHeight: 'none' }}
                    />
                  ) : (
                    <div className="compare-loading">加载中...</div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="single-preview-frame">
              {previewLoading ? (
                <div className="compare-loading">加载中...</div>
              ) : previewDataUrl ? (
                <img src={previewDataUrl} style={previewZoom === 1
                  ? { maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', display: 'block' }
                  : { width: `${previewZoom * 100}%`, maxWidth: 'none', display: 'block' }
                } alt="preview" />
              ) : (
                <div className="compare-loading">无法加载图片</div>
              )}
            </div>
          )}
          </div>
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
              {/* --- Size --- */}
              <div className="param-row">
                <span className="param-label">尺寸</span>
                <select value={size} onChange={e => setSize(e.target.value)} className="select" style={{ width: 150, fontSize: 12, padding: '4px 8px' }}>
                  {modelSizeOptions.map(sz => <option key={sz} value={sz}>{sz}</option>)}
                </select>
              </div>

              {/* --- Quality (ChatGPT2API only) --- */}
              {provider === 'chatgpt2api' && (<div className="param-row">
                <span className="param-label">画质</span>
                <select value={quality} onChange={e => setQuality(e.target.value)} className="select" style={{ width: 150, fontSize: 12, padding: '4px 8px' }}>
                  <option value="auto">自动 (AI决定)</option>
                  <option value="low">低 (~1MP)</option>
                  <option value="medium">中 (~4MP)</option>
                  <option value="high">高 (~8MP)</option>
                </select>
              </div>)}

              {/* --- Seed --- */}
              {currentModelCaps.supportsSeed !== false && (<div className="param-row">
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
              </div>)}

              {/* --- Watermark --- */}
              {currentModelCaps.supportsWatermark !== false && (<div className="param-row">
                <span className="param-label">水印</span>
                <label className="checkbox-label" style={{ fontSize: 12 }}>
                  <input type="checkbox" checked={watermark} onChange={e => setWatermark(e.target.checked)} /> Seedream 水印
                </label>
              </div>)}

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
              {currentModelCaps.supportsFastPromptOptimize !== false && (<div className="param-row">
                <span className="param-label">提示词优化</span>
                <select value={optimizePromptMode} onChange={e => setOptimizePromptMode(e.target.value)} className="select" style={{ width: 150, fontSize: 12, padding: '4px 8px' }}>
                  <option value="standard">标准模式 (高质量)</option>
                  {isFastPromptOptimizeSupported && <option value="fast">快速模式 (低耗时)</option>}
                </select>
              </div>)}

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
                  <input type="range" min={1} max={50} value={concurrent} onChange={e => setConcurrent(Number(e.target.value))} style={{ width: 80 }} />
                  <span className="text-xs text-secondary" style={{ width: 24 }}>{concurrent}</span>
                </div>
              </div>

              {/* --- N (images per request) --- */}
              {currentModelCaps.supportsN && (<div className="param-row">
                <span className="param-label">每请求图片数 (n)</span>
                <div className="flex items-center gap-3">
                  <input type="number" min={1} max={currentModelCaps.nMax || 4} value={n}
                    onChange={e => setN(Math.max(1, Math.min(currentModelCaps.nMax || 4, Number(e.target.value))))}
                    className="input" style={{ width: 70, padding: '4px 8px', fontSize: 12 }} />
                  {pendingCount > 0 && n > 1 && (
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                      将生成 {pendingCount} × {n} = {pendingCount * n} 张图片
                    </span>
                  )}
                </div>
              </div>)}

              {/* --- Recursive --- */}
              <div className="param-row">
                <span className="param-label">目录扫描</span>
                <label className="checkbox-label" style={{ fontSize: 12 }}>
                  <input type="checkbox" checked={recursive} onChange={e => handleRecursiveChange(e.target.checked)} /> 递归子目录
                </label>
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
              <div
                ref={referenceDropRef}
                onClick={handleReferenceUpload}
                onDragOver={(e) => { e.preventDefault(); setReferenceDragOver(true); }}
                onDragLeave={() => setReferenceDragOver(false)}
                onDrop={(e) => handleNativeDrop(e, 'reference')}
                className="drop-zone"
                style={{
                  padding: '16px 0',
                  ['--wails-drop-target' as any]: 'drop',
                  borderColor: referenceDragOver ? 'var(--color-accent-hover)' : undefined,
                  background: referenceDragOver ? 'var(--color-accent-glow)' : undefined,
                }}
              >
                <div style={{ fontSize: 22, marginBottom: 2 }}>+</div>{referenceDragOver ? '释放以添加参考图' : '拖拽或点击上传参考图'}
              </div>
            ) : (
              <div
                ref={referenceDropRef}
                className="flex gap-3"
                onDragOver={(e) => { e.preventDefault(); setReferenceDragOver(true); }}
                onDragLeave={() => setReferenceDragOver(false)}
                onDrop={(e) => handleNativeDrop(e, 'reference')}
                style={{
                  overflowX: 'auto',
                  paddingBottom: 4,
                  ['--wails-drop-target' as any]: 'drop',
                  outline: referenceDragOver ? '2px dashed var(--color-accent)' : undefined,
                  outlineOffset: 4,
                  borderRadius: 8,
                }}
              >
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
                    onDragOver={(e) => { e.preventDefault(); setReferenceDragOver(true); }}
                    onDrop={(e) => handleNativeDrop(e, 'reference')}
                    style={{ width: 48, height: 48, borderRadius: 8, border: '2px dashed var(--color-accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: 18, flexShrink: 0, ['--wails-drop-target' as any]: 'drop' }}>+</div>
                )}
              </div>
            )}
          </div>


          {/* Batch Actions Bar */}
          <div className="flex items-center gap-3" style={{ flexShrink: 0, flexWrap: 'wrap' }}>

            {/* Model & Download Width */}
            <div className="flex items-center gap-4 ml-auto">
              {/* Provider */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted">服务商:</span>
                <select
                  value={provider}
                  onChange={e => handleProviderChange(e.target.value)}
                  className="select"
                  style={{ fontSize: 12, padding: '4px 8px', width: 120 }}
                >
                  <option value="seedream">Seedream</option>
                  <option value="chatgpt2api">ChatGPT2API</option>
                </select>
              </div>
              {/* Model */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted">模型:</span>
                <select value={model} onChange={e => setModel(e.target.value)} className="select" style={{ width: 160, fontSize: 12, padding: '4px 8px' }}>
                  {displayModels.map(m => <option key={m.id} value={m.id}>{displayModelName(m)}</option>)}
                </select>
              </div>

              {/* Download Width */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted">输出宽度:</span>
                <select value={downloadWidth} onChange={e => { setDownloadWidth(e.target.value); setShowCustomWidth(e.target.value === 'custom'); }}
                  className="select" style={{ fontSize: 12, padding: '4px 8px', width: 90 }}>
                  {downloadWidthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {showCustomWidth && (
                  <input type="number" value={customWidth} onChange={e => setCustomWidth(e.target.value)}
                    placeholder="px" className="input" style={{ width: 60, padding: '4px 8px', fontSize: 12 }} />
                )}
              </div>
            </div>

            <div style={{ flex: 1 }} />

            {processing ? (
              <button onClick={() => { updateProgress(null); activeBatchIdRef.current = null; cancelRef.current = true; setCancelRequested(true); try { (window as any).go.main.App.CancelBatch(); } catch { /* no-op */ } }} className="btn btn-danger" style={{ fontWeight: 600, padding: '8px 24px' }}>
                取消处理
              </button>
            ) : (
              <button onClick={handleRun} disabled={queue.length === 0 || !prompt || processing || retryingItems.current.size > 0}
                className="btn btn-primary" style={{ fontWeight: 600, padding: '8px 24px', opacity: (queue.length === 0 || !prompt || processing || retryingItems.current.size > 0) ? 0.4 : 1 }}>
                开始处理 {pendingCount > 0 ? `(${pendingCount}张)` : ''}
              </button>
            )}
          </div>

          {/* Hover Preview */}
          {hoverPreviewVisible && hoverPreviewImg && (() => {
            const style = hoverPreviewStyle(hoverPreviewPos);
            return (
              <div className="hover-preview" style={style}>
                <img src={hoverPreviewImg} alt="preview" style={{ maxWidth: style.maxWidth, maxHeight: style.maxHeight }} />
              </div>
            );
          })()}

          {/* Image Queue */}
          <div
            ref={queueDropRef}
            className="card"
            onDragOver={(e) => { e.preventDefault(); setQueueDragOver(true); }}
            onDragLeave={() => setQueueDragOver(false)}
            onDrop={(e) => handleNativeDrop(e, 'queue')}
            style={{
              ...s.card,
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              overflow: 'hidden',
              outline: queueDragOver ? '2px dashed var(--color-accent)' : undefined,
              outlineOffset: -4,
              ['--wails-drop-target' as any]: 'drop',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0 10px', fontSize: 12, color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border-subtle)', marginBottom: 8 }}>
              <span>图片队列</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {completedCount > 0 && (
                  <button
                    disabled={downloadProgress.active}
                    onClick={async () => {
                      if (saveInProgressRef.current) return;
                      const completed = queue.filter(i => i.status === 'completed');
                      if (completed.length === 0) return;

                      const totalBulkPaths = completed.reduce((s, i) => s + (i.outputPaths?.length || (i.outputPath ? 1 : 0)), 0);
                      saveInProgressRef.current = true;
                      setDownloadProgress({ current: 0, total: totalBulkPaths, active: true });
                      try {
                        if (aiOutputDir) {
                          const allPaths = completed.flatMap(i =>
                            i.outputPaths?.length ? i.outputPaths : i.outputPath ? [i.outputPath] : []);
                          if (!allPaths.length) return;
                          const count = await (window as any).go.main.App.SaveFilesToDir(allPaths, aiOutputDir, getEffectiveWidth());
                          showToast(`${count}/${allPaths.length} 已保存到 ${aiOutputDir}`, 'success');
                        } else {
                          const byDir = new Map<string, string[]>();
                          for (const i of completed) {
                            const dir = i.path.replace(/[^\\/]+$/, '') || '';
                            if (!dir) continue;
                            const paths = i.outputPaths?.length ? i.outputPaths : i.outputPath ? [i.outputPath] : [];
                            if (!paths.length) continue;
                            const existing = byDir.get(dir);
                            if (existing) existing.push(...paths); else byDir.set(dir, [...paths]);
                          }
                          if (byDir.size === 0) return;
                          const total = [...byDir.values()].reduce((s, p) => s + p.length, 0);
                          let saved = 0, failed = 0;
                          setDownloadProgress({ current: 0, total, active: true });
                          for (const [dir, paths] of byDir) {
                            try {
                              const count = await (window as any).go.main.App.SaveFilesToDir(paths, dir, getEffectiveWidth());
                              saved += count;
                              setDownloadProgress(p => ({ ...p, current: saved }));
                            } catch {
                              failed += paths.length;
                              setDownloadProgress(p => ({ ...p, current: saved }));
                            }
                          }
                          if (failed > 0) {
                            showToast(`${saved}/${total} 已保存到原图目录，${failed} 张失败`, 'warning');
                          } else {
                            showToast(`${saved}/${total} 已保存到原图目录`, 'success');
                          }
                        }
                      } catch (err: any) {
                        showToast(`保存失败: ${err.message}`, 'error');
                      } finally {
                        saveInProgressRef.current = false;
                        setDownloadProgress({ current: 0, total: 0, active: false });
                      }
                    }}
                    className="btn btn-sm"
                    style={{ border: '1px solid var(--color-accent)', color: 'var(--color-accent)', background: 'transparent', fontSize: 11, padding: '2px 10px' }}
                  >
                    {downloadProgress.active ? `保存中 ${downloadProgress.current}/${downloadProgress.total}` : '全部保存'}
                  </button>
                )}
                {queue.filter(i => i.status === 'error' || i.status === 'completed').length > 0 && (
                  <button
                    onClick={retryAll}
                    disabled={processing || retryingItems.current.size > 0}
                    className="btn btn-sm"
                    style={{ border: '1px solid var(--color-warning)', color: 'var(--color-warning)', background: 'transparent', fontSize: 11, padding: '2px 10px' }}
                  >
                    全部重试
                  </button>
                )}
                {queue.length > 0 && (
                  <button
                    onClick={clearQueue}
                    disabled={processing || retryingItems.current.size > 0 || saveInProgressRef.current}
                    className="btn btn-sm"
                    style={{ border: '1px solid var(--color-danger)', color: 'var(--color-danger)', background: 'transparent', fontSize: 11, padding: '2px 10px' }}
                  >
                    清空
                  </button>
                )}
                <span>{completedCount}/{queue.length} 完成</span>
              </div>
            </div>

            <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
              {queue.length === 0 ? (
                <div
                  onClick={handleSelectFiles}
                  onDragOver={(e) => { e.preventDefault(); setQueueDragOver(true); }}
                  onDragLeave={() => setQueueDragOver(false)}
                  onDrop={(e) => handleNativeDrop(e, 'queue')}
                  className="drop-zone"
                  style={{
                    padding: '40px 0',
                    ['--wails-drop-target' as any]: 'drop',
                    borderColor: queueDragOver ? 'var(--color-accent-hover)' : undefined,
                    background: queueDragOver ? 'var(--color-accent-glow)' : undefined,
                  }}
                >
                  <div className="empty-state-icon">+</div>
                  {queueDragOver ? '释放以添加图片到队列' : '拖拽或点击添加图片到队列'}<br />
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>支持 JPG/PNG/WebP/BMP/TIFF/GIF</span>
                </div>
              ) : (
                queue.map(item => (
                    <div key={item.id} className="queue-item">
                    <div className="queue-thumb"
                      style={selectedPreview?.id === item.id ? {
                        boxShadow: '0 0 0 2px rgba(79, 158, 255, 0.8), 0 0 12px rgba(79, 158, 255, 0.4)',
                        borderRadius: 6,
                      } : undefined}
                      onMouseMove={(e) => {
                        // Use higher-res (640px) thumbnail for hover preview
                        const hoverSrc = item.hoverThumbUrl || item.sourceThumbUrl || null;
                        setHoverPreviewImg(hoverSrc);
                        setHoverPreviewPos({ x: e.clientX, y: e.clientY });
                      }}
                      onMouseEnter={() => setHoverPreviewVisible(true)}
                      onMouseLeave={() => setHoverPreviewVisible(false)}
                      onClick={() => openPreview(item)}
                      title={item.path}>
                      {item.sourceThumbUrl ? (
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
                      <div className="queue-title" onClick={() => openPreview(item)} style={{ cursor: 'pointer' }}>
                        {item.name}
                      </div>
                      {item.error && <div className="queue-error text-xs text-danger mt-2" title={item.error}>{item.error}</div>}
                    </div>

                    {/* Spacer to push AI results toward middle-right */}
                    <div className="queue-item-spacer" />

                    {/* AI result thumbnails — inline on the same row */}
                    {item.status === 'completed' && item.outputPaths && item.outputPaths.length > 0 && (
                      <div className="queue-results">
                        {item.outputPaths.slice(0, 4).map((outPath, idx) => (
                          <button
                            key={outPath}
                            className="queue-result-thumb"
                            style={selectedPreview?.id === item.id && selectedOutputPath === outPath ? {
                              boxShadow: '0 0 0 2px rgba(79, 158, 255, 0.8), 0 0 12px rgba(79, 158, 255, 0.4)',
                            } : undefined}
                            onClick={() => openPreview(item, outPath)}
                            title={fileNameFromPath(outPath)}
                            onMouseMove={(e) => {
                              setHoverPreviewImg(item.resultHoverUrls?.[idx] || item.thumbUrls?.[idx] || null);
                              setHoverPreviewPos({ x: e.clientX, y: e.clientY });
                            }}
                            onMouseEnter={() => setHoverPreviewVisible(true)}
                            onMouseLeave={() => setHoverPreviewVisible(false)}
                          >
                            {item.thumbUrls?.[idx] ? (
                              <>
                                <img
                                  src={item.thumbUrls[idx]}
                                  alt={`AI result ${idx + 1}`}
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                                    if (fallback) fallback.style.display = 'inline';
                                  }}
                                />
                                <span style={{ display: 'none' }}>{idx + 1}</span>
                              </>
                            ) : (
                              <span>{idx + 1}</span>
                            )}
                          </button>
                        ))}
                        {item.outputPaths.length > 4 && (
                          <button
                            className="queue-result-more"
                            onClick={() => openPreview(item, item.outputPaths?.[4])}
                            title="查看更多 AI 结果"
                          >
                            +{item.outputPaths.length - 4}
                          </button>
                        )}
                      </div>
                    )}

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
                      {item.status === 'completed' && (item.outputPaths?.length || item.outputPath) && (
                        <button
                          disabled={downloadProgress.active}
                          onClick={async () => {
                            if (saveInProgressRef.current) return;
                            const outputPaths = item.outputPaths && item.outputPaths.length > 0 ? item.outputPaths : item.outputPath ? [item.outputPath] : [];
                            if (outputPaths.length === 0) return;
                            const destDir = aiOutputDir || item.path?.replace(/[^\\/]+$/, '') || '';
                            if (!destDir) return;
                            saveInProgressRef.current = true;
                            setDownloadProgress({ current: 0, total: outputPaths.length, active: true });
                            try {
                              const count = await (window as any).go.main.App.SaveFilesToDir(outputPaths, destDir, getEffectiveWidth());
                              showToast(`已保存 ${count}/${outputPaths.length} 张到 ${destDir}`, 'success');
                            } catch (err: any) {
                              showToast(`保存失败: ${err.message}`, 'error');
                            } finally {
                              saveInProgressRef.current = false;
                              setDownloadProgress({ current: 0, total: 0, active: false });
                            }
                          }} className="btn btn-sm" title="保存到输出目录">💾</button>
                      )}
                      {(item.status === 'error' || item.status === 'completed') && (
                        <button
                          onClick={() => retryItem(item.id)}
                          disabled={retryingItems.current.has(item.id)}
                          className="btn btn-sm btn-ghost"
                          style={{ border: '1px solid var(--color-warning)', color: 'var(--color-warning)', opacity: retryingItems.current.has(item.id) ? 0.4 : 1 }}
                        >
                          重试
                        </button>
                      )}
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
