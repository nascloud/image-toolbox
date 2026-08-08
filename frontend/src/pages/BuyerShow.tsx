import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EventsOn } from '../../wailsjs/runtime/runtime';
import { useProgressContext } from '../hooks/useProgress';
import './BuyerShow.css';

type BasisMode = '' | 'white_background' | 'existing_scene';
type SlotStatus = 'empty' | 'local' | 'processing' | 'completed' | 'error';
type ToastType = 'success' | 'warning' | 'error';

interface WhiteBackgroundAnalysis {
  isWhiteBackground: boolean;
  score: number;
}

interface ImageCandidate {
  path: string;
  fileName: string;
  whiteBackground: WhiteBackgroundAnalysis;
}

interface BuyerShowSlot {
  index: number;
  role: 'white' | 'buyer';
  sourcePath?: string;
  outputPath?: string;
  revision: number;
  status: SlotStatus;
  error?: string;
  thumbUrl?: string;
}

interface BuyerShowSet {
  id: string;
  name: string;
  folderPath: string;
  imageCount: number;
  reviewPath?: string;
  reviewText: string;
  slots: BuyerShowSlot[];
  unassignedImages: ImageCandidate[];
  basisMode: BasisMode;
  basisSlotIndex: number;
  basisSlotIndices: number[];
  warnings?: string[];
  product: { name: string; material: string; color: string; spec: string };
  reviewStatus?: 'idle' | 'processing' | 'error';
  reviewError?: string;
}

interface SlotResult {
  setId: string;
  slotIndex: number;
  sourcePath?: string;
  outputPath?: string;
  revision: number;
  success: boolean;
  error?: string;
}

interface BuyerShowProgressUpdate {
  batchId?: string;
  setId?: string;
  slotIndex?: number;
  completed: number;
  total: number;
  done: boolean;
  error?: string;
  result?: SlotResult;
}

const fallbackModels: Record<string, string[]> = {
  seedream: ['doubao-seedream-5-0-260128', 'doubao-seedream-5-0-lite-260128', 'doubao-seedream-4-5-251128'],
  openai: ['gpt-image-2'],
};

const providerDefaults: Record<string, string> = {
  seedream: 'doubao-seedream-5-0-260128',
  openai: 'gpt-image-2',
};

function createBatchID(): string {
  return `buyer-show-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function fileName(path?: string): string {
  return path?.split(/[\\/]/).pop() || '';
}

function modelLabel(id: string): string {
  const label = id.startsWith('doubao-') ? id.slice(7) : id;
  return label.length > 24 ? `${label.slice(0, 15)}...${label.slice(-6)}` : label;
}

interface BuyerShowProps {
  active?: boolean;
}

export const BuyerShow: React.FC<BuyerShowProps> = ({ active = true }) => {
  const [sets, setSets] = useState<BuyerShowSet[]>([]);
  const [provider, setProvider] = useState('seedream');
  const [model, setModel] = useState(providerDefaults.seedream);
  const [models, setModels] = useState<string[]>(fallbackModels.seedream);
  const [size, setSize] = useState('2K');
  const [quality, setQuality] = useState('auto');
  const [outputFormat, setOutputFormat] = useState('png');
  const [concurrent, setConcurrent] = useState(3);
  const [seed, setSeed] = useState(-1);
  const [watermark, setWatermark] = useState(false);
  const [outputDir, setOutputDir] = useState('');
  const [globalPrompt, setGlobalPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('text, watermark, logo, text overlays, fake CGI render, catalog studio lighting');
  const [importing, setImporting] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [total, setTotal] = useState(0);
  const [preview, setPreview] = useState<{ path: string; dataURL: string } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const activeBatchID = useRef<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();
  const { setIdleText, updateProgress } = useProgressContext();

  const showToast = useCallback((message: string, type: ToastType = 'error') => {
    setToast({ message, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }, []);

  useEffect(() => {
    if (active) setIdleText('AI 买家秀');
    return () => { if (toastTimer.current) clearTimeout(toastTimer.current); };
  }, [active, setIdleText]);

  useEffect(() => {
    (async () => {
      try {
        const active = await (window as any).go.main.App.GetActiveProvider();
        if (active) setProvider(active);
      } catch { /* optional configuration */ }
      try {
        const dir = await (window as any).go.main.App.GetAiOutputDir();
        if (dir) setOutputDir(dir);
      } catch { /* optional configuration */ }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const response = await (window as any).go.main.App.GetProviderModels(provider);
        const ids = Array.isArray(response) ? response
          .filter((item: any) => provider === 'seedream'
            ? item.id?.toLowerCase().includes('seedream')
            : item.id?.toLowerCase().startsWith('gpt-image-'))
          .map((item: any) => item.id)
          .filter(Boolean) : [];
        const next = ids.length ? ids : fallbackModels[provider];
        setModels(next);
        setModel(current => next.includes(current) ? current : (providerDefaults[provider] || next[0]));
      } catch {
        setModels(fallbackModels[provider]);
        setModel(providerDefaults[provider]);
      }
      setSize(provider === 'openai' ? 'auto' : '2K');
    })();
  }, [provider]);

  const loadSlotThumbnails = useCallback(async (incoming: BuyerShowSet[]): Promise<BuyerShowSet[]> => {
    return Promise.all(incoming.map(async rawSet => {
      const legacyBasisIndex = Number(rawSet.basisSlotIndex) || 0;
      const basisSlotIndices = Array.isArray(rawSet.basisSlotIndices) && rawSet.basisSlotIndices.length
        ? rawSet.basisSlotIndices.map(Number).filter(index => Number.isInteger(index))
        : legacyBasisIndex > 0 ? [legacyBasisIndex] : [];
      const set: BuyerShowSet = {
        ...rawSet,
        reviewText: rawSet.reviewText || '',
        slots: Array.isArray(rawSet.slots) ? rawSet.slots : [],
        unassignedImages: Array.isArray(rawSet.unassignedImages) ? rawSet.unassignedImages : [],
        basisSlotIndex: basisSlotIndices[0] || 0,
        basisSlotIndices,
        warnings: Array.isArray(rawSet.warnings) ? rawSet.warnings : [],
        product: rawSet.product || { name: rawSet.name, material: '', color: '', spec: '' },
      };
      const slots = await Promise.all(set.slots.map(async slot => {
        const path = slot.outputPath || slot.sourcePath;
        if (!path) return slot;
        try {
          const thumbUrl = await (window as any).go.main.App.ReadImageThumbnail(path, 220);
          return { ...slot, thumbUrl };
        } catch {
          return slot;
        }
      }));
      return { ...set, slots };
    }));
  }, []);

  const mergeSets = useCallback((incoming: BuyerShowSet[]) => {
    setSets(current => {
      const byPath = new Map(current.map(set => [set.folderPath.toLowerCase(), set]));
      incoming.forEach(set => {
        const key = set.folderPath.toLowerCase();
        if (!byPath.has(key)) byPath.set(key, set);
      });
      return Array.from(byPath.values());
    });
  }, []);

  const importFolder = async (mode: 'parent' | 'single') => {
    setImporting(true);
    try {
      const rootPath = await (window as any).go.main.App.SelectDirectory();
      if (!rootPath) return;
      const result = await (window as any).go.main.App.ScanBuyerShowImport({ rootPath, mode });
      const incoming = await loadSlotThumbnails((result?.sets || []).map((set: BuyerShowSet) => ({
        ...set,
        product: { name: set.name, material: '', color: '', spec: '' },
      })));
      mergeSets(incoming);
      if (result?.warnings?.length) showToast(result.warnings.slice(0, 3).join('；'), 'warning');
      else showToast(`已导入 ${incoming.length} 套，未调用 AI`, 'success');
    } catch (error: any) {
      showToast(error?.message || '导入失败');
    } finally {
      setImporting(false);
    }
  };

  const applySlotResult = useCallback((result: SlotResult) => {
    setSets(current => current.map(set => {
      if (set.id !== result.setId) return set;
      return {
        ...set,
        slots: set.slots.map(slot => slot.index === result.slotIndex ? {
          ...slot,
          outputPath: result.outputPath || slot.outputPath,
          revision: result.revision || slot.revision,
          status: result.success ? 'completed' : 'error',
          error: result.error,
          thumbUrl: result.success ? undefined : slot.thumbUrl,
        } : slot),
      };
    }));
    if (result.success && result.outputPath) {
      void (async () => {
        try {
          const thumbUrl = await (window as any).go.main.App.ReadImageThumbnail(result.outputPath, 220);
          setSets(current => current.map(set => set.id === result.setId ? {
            ...set,
            slots: set.slots.map(slot => slot.index === result.slotIndex ? { ...slot, thumbUrl } : slot),
          } : set));
        } catch { /* generated path remains available */ }
      })();
    }
  }, []);

  useEffect(() => {
    const off = EventsOn('buyer-show-progress', (update: BuyerShowProgressUpdate) => {
      if (!update?.batchId || update.batchId !== activeBatchID.current) return;
      setCompleted(update.completed || 0);
      setTotal(update.total || 0);
      if (update.result) applySlotResult(update.result);
    });
    return () => off();
  }, [applySlotResult]);

  const updateSet = (id: string, updater: (set: BuyerShowSet) => BuyerShowSet) => {
    setSets(current => current.map(set => set.id === id ? updater(set) : set));
  };

  const generationOptions = () => ({
    provider, model, size, quality, outputFormat, watermark, seed, concurrent,
    outputDir, globalPrompt, negativePrompt,
  });

  const generateSnapshot = (set: BuyerShowSet) => {
    const basisSlotIndices = set.basisMode === 'white_background'
      ? [1]
      : Array.from(new Set(set.basisSlotIndices || [])).filter(index => index >= 2 && index <= 6);
    return {
      setId: set.id,
      setName: set.name,
      folderPath: set.folderPath,
      reviewText: set.reviewText,
      product: set.product,
      basisMode: set.basisMode,
      basisSlotIndex: basisSlotIndices[0] || 0,
      basisSlotIndices,
      slots: set.slots.map(({ thumbUrl: _thumbUrl, ...slot }) => slot),
    };
  };

  const validateSets = (items: BuyerShowSet[]): string | null => {
    const unselected = items.filter(set => !set.basisMode);
    if (unselected.length) return `${unselected.length} 套尚未选择生成依据`;
    for (const set of items) {
      const indices = set.basisMode === 'white_background' ? [1] : set.basisSlotIndices;
      if (!indices.length) return `${set.name} 尚未选择已有场景参考图`;
      const invalidIndex = indices.find(index => set.basisMode === 'white_background' ? index !== 1 : index < 2 || index > 6);
      if (invalidIndex !== undefined) return `${set.name} 的生成依据图位无效`;
      const emptyIndex = indices.find(index => !set.slots[index - 1]?.sourcePath && !set.slots[index - 1]?.outputPath);
      if (emptyIndex !== undefined) return `${set.name} 的生成依据图位 ${emptyIndex} 为空`;
    }
    return null;
  };

  const runBatch = async () => {
    if (!sets.length || processing) return;
    const validation = validateSets(sets);
    if (validation) { showToast(validation, 'warning'); return; }
    const batchId = createBatchID();
    activeBatchID.current = batchId;
    setProcessing(true);
    setCompleted(0);
    setTotal(sets.length * 5);
    setSets(current => current.map(set => ({ ...set, slots: set.slots.map(slot => slot.index > 1 ? { ...slot, status: 'processing', error: undefined } : slot) })));
    updateProgress({ completed: 0, total: sets.length * 5, current: '正在生成买家秀…', running: true, done: false });
    try {
      const response = await (window as any).go.main.App.RunBuyerShowBatch({
        batchId,
        options: generationOptions(),
        sets: sets.map(generateSnapshot),
      });
      if (response?.error) {
        const message = response.error;
        setSets(current => current.map(set => ({
          ...set,
          slots: set.slots.map(slot => slot.index > 1 && slot.status === 'processing' ? {
            ...slot,
            status: slot.outputPath ? 'completed' : slot.sourcePath ? 'local' : 'error',
            error: slot.outputPath || slot.sourcePath ? undefined : message,
          } : slot),
        })));
        updateProgress({ completed: 0, total: sets.length * 5, current: '', running: false, done: true, error: message });
        showToast(message);
      } else {
        (response?.results || []).forEach((result: SlotResult) => applySlotResult(result));
        updateProgress({ completed: response?.success || 0, total: response?.total || sets.length * 5, current: '', running: false, done: true, error: response?.failed ? `${response.failed} 个图位失败` : undefined });
        if (response?.failed) showToast(`${response.success}/${response.total} 个图位完成`, 'warning');
        else showToast(`${response.success} 个图位已生成`, 'success');
      }
    } catch (error: any) {
      const message = error?.message || '批量生成失败';
      setSets(current => current.map(set => ({
        ...set,
        slots: set.slots.map(slot => slot.index > 1 && slot.status === 'processing' ? {
          ...slot,
          status: slot.outputPath ? 'completed' : slot.sourcePath ? 'local' : 'error',
          error: slot.outputPath || slot.sourcePath ? undefined : message,
        } : slot),
      })));
      updateProgress({ completed: 0, total: sets.length * 5, current: '', running: false, done: true, error: message });
      showToast(message);
    } finally {
      activeBatchID.current = null;
      setProcessing(false);
    }
  };

  const redrawSlot = async (set: BuyerShowSet, slotIndex: number) => {
    const validation = validateSets([set]);
    if (validation) { showToast(validation, 'warning'); return; }
    updateSet(set.id, current => ({ ...current, slots: current.slots.map(slot => slot.index === slotIndex ? { ...slot, status: 'processing', error: undefined } : slot) }));
    try {
      const result = await (window as any).go.main.App.RedrawBuyerShowImage({
        options: generationOptions(),
        set: generateSnapshot(set),
        targetSlotIndex: slotIndex,
        extraPrompt: '',
      });
      applySlotResult(result);
      showToast(`${set.name} 第 ${slotIndex} 图位已重绘`, 'success');
    } catch (error: any) {
      applySlotResult({ setId: set.id, slotIndex, revision: set.slots[slotIndex - 1]?.revision || 0, success: false, error: error?.message || '重绘失败' });
      showToast(error?.message || '重绘失败');
    }
  };

  const rewriteReview = async (set: BuyerShowSet) => {
    if (!set.reviewText.trim()) { showToast('请先填写评价文字', 'warning'); return; }
    updateSet(set.id, current => ({ ...current, reviewStatus: 'processing', reviewError: undefined }));
    try {
      const result = await (window as any).go.main.App.RewriteBuyerShowReview({ provider, reviewText: set.reviewText, tone: '自然真实的买家口吻', maxChars: 120 });
      updateSet(set.id, current => ({ ...current, reviewText: result.rewritten, reviewStatus: 'idle' }));
      showToast('评价已重写，可继续编辑', 'success');
    } catch (error: any) {
      updateSet(set.id, current => ({ ...current, reviewStatus: 'error', reviewError: error?.message || '重写失败' }));
      showToast(error?.message || '评价重写失败');
    }
  };

  const openPreview = async (path?: string) => {
    if (!path) return;
    try {
      const dataURL = await (window as any).go.main.App.ReadImageAsBase64(path);
      setPreview({ path, dataURL });
    } catch (error: any) {
      showToast(error?.message || '无法预览图片');
    }
  };

  const chooseOutputDir = async () => {
    try {
      const path = await (window as any).go.main.App.SelectOutputDir();
      if (path) setOutputDir(path);
    } catch (error: any) { showToast(error?.message || '无法选择输出目录'); }
  };

  const availableSceneIndices = (set: BuyerShowSet) => set.slots
    .slice(1)
    .filter(slot => Boolean(slot.sourcePath || slot.outputPath))
    .map(slot => slot.index);

  const applyBasisToAll = (mode: Exclude<BasisMode, ''>) => {
    if (!sets.length) { showToast('请先添加买家秀套装', 'warning'); return; }
    let skipped = 0;
    const nextSets = sets.map(set => {
      const indices = mode === 'white_background'
        ? (set.slots[0]?.sourcePath || set.slots[0]?.outputPath ? [1] : [])
        : availableSceneIndices(set);
      if (!indices.length) {
        skipped++;
        return { ...set, basisMode: '' as BasisMode, basisSlotIndex: 0, basisSlotIndices: [] };
      }
      return { ...set, basisMode: mode, basisSlotIndex: indices[0], basisSlotIndices: indices };
    });
    setSets(nextSets);
    if (skipped) showToast(`已批量设置，${skipped} 套没有可用依据图，请单独处理`, 'warning');
    else showToast(mode === 'white_background' ? '所有套装已基于白底图' : '所有套装已自动选择全部已有场景图', 'success');
  };

  const toggleSceneBasis = (set: BuyerShowSet, slotIndex: number) => {
    updateSet(set.id, current => {
      const selected = current.basisSlotIndices || [];
      const next = selected.includes(slotIndex)
        ? selected.filter(index => index !== slotIndex)
        : [...selected, slotIndex];
      return { ...current, basisMode: 'existing_scene', basisSlotIndex: next[0] || 0, basisSlotIndices: next };
    });
  };

  const unselectedCount = sets.filter(set => !set.basisMode || (set.basisMode === 'existing_scene' && !set.basisSlotIndices.length)).length;
  const emptyBuyerSlots = sets.reduce((count, set) => count + set.slots.slice(1).filter(slot => !slot.sourcePath && !slot.outputPath).length, 0);
  const progressPercent = total ? Math.round(completed / total * 100) : 0;
  const canRun = sets.length > 0 && unselectedCount === 0 && !processing;

  return (
    <div className="buyer-show-page buyer-show-v2">
      {toast && <div className={`toast toast-${toast.type}`} role="status">{toast.message}<button className="toast-close" onClick={() => setToast(null)}>×</button></div>}
      {preview && <div className="buyer-preview-overlay" onClick={() => setPreview(null)}><div className="buyer-preview" onClick={event => event.stopPropagation()}><div className="buyer-preview-header"><div><span>图片预览</span><strong>{fileName(preview.path)}</strong></div><button className="btn-icon" onClick={() => setPreview(null)}>×</button></div><div className="buyer-preview-frame"><img src={preview.dataURL} alt={fileName(preview.path)} /></div></div></div>}

      <aside className="buyer-v2-parameters">
        <div className="buyer-v2-heading"><div><span>01</span><div><strong>基本参数</strong><small>整批统一应用</small></div></div></div>
        <div className="buyer-v2-parameter-scroll">
          <label className="buyer-field"><span>AI 服务</span><select className="select" value={provider} onChange={event => setProvider(event.target.value)} disabled={processing}><option value="seedream">Seedream</option><option value="openai">OpenAI</option></select></label>
          <label className="buyer-field"><span>图片模型</span><select className="select" value={model} onChange={event => setModel(event.target.value)} disabled={processing} title={model}>{models.map(id => <option key={id} value={id} title={id}>{modelLabel(id)}</option>)}</select></label>
          <div className="buyer-inline-fields">
            <label className="buyer-field"><span>尺寸</span><select className="select" value={size} onChange={event => setSize(event.target.value)} disabled={processing}>{(provider === 'openai' ? ['auto', '1:1', '3:4', '4:3', '16:9', '9:16'] : ['1K', '2K', '3K']).map(value => <option key={value}>{value}</option>)}</select></label>
            <label className="buyer-field"><span>格式</span><select className="select" value={outputFormat} onChange={event => setOutputFormat(event.target.value)} disabled={processing}><option value="png">PNG</option><option value="jpeg">JPEG</option></select></label>
          </div>
          {provider === 'openai' && <label className="buyer-field"><span>画质</span><select className="select" value={quality} onChange={event => setQuality(event.target.value)} disabled={processing}><option value="auto">自动</option><option value="medium">中</option><option value="high">高</option></select></label>}
          <label className="buyer-field"><span>并发文件夹数</span><input className="input" type="number" min={1} max={10} value={concurrent} onChange={event => setConcurrent(Math.max(1, Math.min(10, Number(event.target.value) || 1)))} disabled={processing} /><small className="buyer-field-help">每套内部按图位 2→6 串行生成，成功结果自动加入后续参考图</small></label>
          <label className="buyer-field"><span>Seed</span><input className="input" type="number" value={seed} onChange={event => setSeed(Number(event.target.value))} disabled={processing} /></label>
          <label className="buyer-switch-row"><div><strong>图片水印</strong><small>仅支持该参数的模型生效</small></div><label className="buyer-switch"><input type="checkbox" checked={watermark} onChange={event => setWatermark(event.target.checked)} /><span /></label></label>
          <label className="buyer-field"><span>全局买家秀要求</span><textarea className="input" rows={5} value={globalPrompt} onChange={event => setGlobalPrompt(event.target.value)} placeholder="例如：统一偏暖自然光，保留品牌标识" /></label>
          <label className="buyer-field"><span>反向提示词</span><textarea className="input" rows={4} value={negativePrompt} onChange={event => setNegativePrompt(event.target.value)} /></label>
          <label className="buyer-field"><span>输出目录</span><button className="buyer-path-button" onClick={chooseOutputDir}><span>{outputDir || '各套装内 buyer-show-output'}</span><em>选择</em></button></label>
        </div>
        <div className="buyer-v2-run-panel">
          <div><strong>{sets.length} 套 · {sets.length * 5} 个目标图位</strong><small>{unselectedCount ? `${unselectedCount} 套未选依据` : `${emptyBuyerSlots} 个本地空位将由 AI 补齐/重绘`}</small></div>
          {processing ? <button className="btn btn-danger" onClick={() => (window as any).go.main.App.CancelBatch()}>停止生成</button> : <button className="btn btn-primary" onClick={runBatch} disabled={!canRun}>批量生成 2–6 图位</button>}
          <div className="buyer-v2-progress"><span style={{ width: `${progressPercent}%` }} /></div>
        </div>
      </aside>

      <main className="buyer-v2-workspace">
        <header className="buyer-v2-toolbar">
          <div><strong>买家秀套装</strong><small>导入只执行本地扫描、评价读取和白底识别，不自动调用 AI</small></div>
          <div className="buyer-v2-toolbar-actions">
            <button className="btn btn-ghost" disabled={importing || processing} onClick={() => importFolder('parent')}>＋ 添加大文件夹</button>
            <button className="btn btn-primary" disabled={importing || processing} onClick={() => importFolder('single')}>＋ 单独添加子文件夹</button>
          </div>
        </header>

        <div className="buyer-v2-summary">
          <span>{sets.length} 套</span><span>{unselectedCount} 套待选依据</span><span>{emptyBuyerSlots} 个买家秀空位</span>
          <div className="buyer-v2-batch-basis">
            <strong>批量设置依据</strong>
            <button disabled={processing || !sets.length} onClick={() => applyBasisToAll('white_background')}>全部基于白底图</button>
            <button disabled={processing || !sets.length} onClick={() => applyBasisToAll('existing_scene')}>全部已有场景图</button>
          </div>
        </div>

        <div className="buyer-v2-set-list">
          {sets.length === 0 ? (
            <div className="buyer-v2-empty"><div>6</div><strong>添加文件夹开始整理买家秀</strong><p>大文件夹的直接子文件夹会分别成为一套；也可以逐个添加完整套装文件夹。</p><div><button className="btn btn-ghost" onClick={() => importFolder('parent')}>添加大文件夹</button><button className="btn btn-primary" onClick={() => importFolder('single')}>添加单套文件夹</button></div></div>
          ) : sets.map(set => (
            <article className="buyer-v2-set-card" key={set.id}>
              <div className="buyer-v2-card-header">
                <div><strong>{set.name}</strong><small title={set.folderPath}>{set.folderPath}</small></div>
                <div className="buyer-v2-card-meta"><span>{set.imageCount} 张图片</span>{set.reviewPath && <span>已读取评价</span>}<button className="btn-icon" disabled={processing} onClick={() => setSets(current => current.filter(item => item.id !== set.id))}>×</button></div>
              </div>

              <div className="buyer-v2-slots">
                {set.slots.map(slot => {
                  const path = slot.outputPath || slot.sourcePath;
                  return <div className={`buyer-v2-slot role-${slot.role} status-${slot.status}`} key={slot.index}>
                    <div className="buyer-v2-slot-label"><span>{String(slot.index).padStart(2, '0')}</span><strong>{slot.index === 1 ? '白底图（可选）' : `买家秀 ${slot.index - 1}`}</strong></div>
                    <button className="buyer-v2-slot-image" onClick={() => openPreview(path)} disabled={!path}>
                      {slot.thumbUrl ? <img src={slot.thumbUrl} alt={`图位 ${slot.index}`} /> : slot.status === 'processing' ? <span className="buyer-spinner" /> : <span className="buyer-v2-plus">＋</span>}
                      {slot.outputPath && <em>AI v{slot.revision}</em>}
                    </button>
                    <small title={slot.error || fileName(path)}>{slot.error || fileName(path) || '空位'}</small>
                    {slot.index > 1 && <button className="buyer-v2-redraw" disabled={processing || slot.status === 'processing'} onClick={() => redrawSlot(set, slot.index)}>{slot.outputPath ? '重绘' : '生成此图'}</button>}
                  </div>;
                })}
              </div>

              <div className="buyer-v2-basis">
                <strong>生成依据（必须选择）</strong>
                <label className={set.basisMode === 'white_background' ? 'is-active' : ''}><input type="radio" name={`basis-${set.id}`} checked={set.basisMode === 'white_background'} onChange={() => updateSet(set.id, current => ({ ...current, basisMode: 'white_background', basisSlotIndex: 1, basisSlotIndices: [1] }))} disabled={!set.slots[0].sourcePath && !set.slots[0].outputPath} /> 基于白底图</label>
                <label className={set.basisMode === 'existing_scene' ? 'is-active' : ''}><input type="radio" name={`basis-${set.id}`} checked={set.basisMode === 'existing_scene'} onChange={() => updateSet(set.id, current => { const indices = current.basisSlotIndices.filter(index => index >= 2 && index <= 6); const available = availableSceneIndices(current); const next = indices.length ? indices : available; return { ...current, basisMode: 'existing_scene', basisSlotIndex: next[0] || 0, basisSlotIndices: next }; })} /> 基于已有场景</label>
                {set.basisMode === 'existing_scene' && <div className="buyer-v2-basis-scenes" role="group" aria-label="选择已有场景参考图">{set.slots.slice(1).map(slot => { const available = Boolean(slot.sourcePath || slot.outputPath); const checked = set.basisSlotIndices.includes(slot.index); return <label key={slot.index} className={checked ? 'is-active' : ''}><input type="checkbox" checked={checked} disabled={!available || processing} onChange={() => toggleSceneBasis(set, slot.index)} />图位 {slot.index}{!available ? '（空）' : ''}{checked && set.basisSlotIndices[0] === slot.index ? ' · 主锚点' : ''}</label>; })}</div>}
                {set.basisMode === 'existing_scene' && <small>可多选；第一张是主场景锚点，其余用于统一商品、空间和光线</small>}
                {set.slots[0].sourcePath && set.basisMode !== 'existing_scene' && <small>本地白底识别已给出建议，可手动选择其他依据</small>}
              </div>

              <div className="buyer-v2-review">
                <div className="buyer-v2-review-heading"><div><strong>评价文字</strong><small>{set.reviewPath ? `来源：${fileName(set.reviewPath)}` : '未发现文本，可手动填写'}</small></div><button className="btn btn-sm btn-ghost" disabled={set.reviewStatus === 'processing'} onClick={() => rewriteReview(set)}>{set.reviewStatus === 'processing' ? '重写中…' : 'AI 重写评价'}</button></div>
                <textarea className="input" value={set.reviewText} onChange={event => updateSet(set.id, current => ({ ...current, reviewText: event.target.value }))} placeholder="输入或编辑这套买家秀的评价文字" />
                {set.reviewError && <small className="buyer-v2-error">{set.reviewError}</small>}
              </div>

              {(set.warnings?.length || set.unassignedImages.length > 0) && <details className="buyer-v2-details"><summary>未分配图片与扫描提示（{set.unassignedImages.length} / {set.warnings?.length || 0}）</summary><div>{set.unassignedImages.map(image => <button key={image.path} onClick={() => openPreview(image.path)}>{image.fileName}{image.whiteBackground.isWhiteBackground ? ` · 白底 ${Math.round(image.whiteBackground.score * 100)}%` : ''}</button>)}{set.warnings?.map((warning, index) => <p key={index}>{warning}</p>)}</div></details>}
            </article>
          ))}
        </div>
      </main>
    </div>
  );
};
