import React, { useState, useEffect } from 'react';

const defaultModels = [
  { id: 'doubao-seedream-5-0-260128', name: 'Seedream 5.0' },
  { id: 'doubao-seedream-5-0-lite-260128', name: 'Seedream 5.0 Lite' },
  { id: 'doubao-seedream-4-5-251128', name: 'Seedream 4.5' },
  { id: 'doubao-seedream-4-0-250828', name: 'Seedream 4.0' },
  { id: 'doubao-seedream-3-0-t2i-250415', name: 'Seedream 3.0' },
];

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
}export const Settings: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [aiOutputDir, setAiOutputDir] = useState('');
  const [apiSaved, setApiSaved] = useState(false);
  const [dirSaved, setDirSaved] = useState(false);
  const [modelList, setModelList] = useState<{ id: string; name: string }[]>(loadModelList);
  const [editingModel, setEditingModel] = useState<{ id: string; name: string } | null>(null);
  const [isAddingModel, setIsAddingModel] = useState(false);
  const [newModelId, setNewModelId] = useState('');
  const [newModelName, setNewModelName] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [key, dir] = await Promise.all([
          (window as any).go.main.App.GetApiKey(),
          (window as any).go.main.App.GetAiOutputDir(),
        ]);
        if (key) setApiKey(key);
        if (dir) setAiOutputDir(dir);
      } catch { /* no-op */ }
    })();
  }, []);

  const handleSaveApiKey = async () => {
    try {
      await (window as any).go.main.App.SaveApiKey(apiKey);
      setApiSaved(true);
      setTimeout(() => setApiSaved(false), 2000);
    } catch { /* no-op */ }
  };

  const handleSelectOutputDir = async () => {
    try {
      const dir = await (window as any).go.main.App.SelectOutputDir();
      if (dir) setAiOutputDir(dir);
    } catch { /* no-op */ }
  };

  const handleSaveOutputDir = async () => {
    try {
      await (window as any).go.main.App.SaveAiOutputDir(aiOutputDir);
      setDirSaved(true);
      setTimeout(() => setDirSaved(false), 2000);
    } catch { /* no-op */ }
  };

  const handleAddModel = () => {
    if (!newModelId.trim() || !newModelName.trim()) return;
    if (modelList.find(m => m.id === newModelId.trim())) {
      alert('模型 ID 已存在');
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
    if (modelList.length <= 1) { alert('至少保留一个模型'); return; }
    const updated = modelList.filter(m => m.id !== id);
    setModelList(updated);
    saveModelList(updated);
  };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <h2 className="page-title">设置</h2>

      {/* API Key */}
      <div className="card mb-8">
        <label className="card-label" style={{ marginBottom: 8, textTransform: 'none', letterSpacing: 0 }}>
          Volcano Engine API Key
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          placeholder="输入你的火山方舟 API Key"
          className="input"
        />
        <p className="text-xs text-muted mt-4">
          API Key 仅保存在本地 ~/.imagetool/config.json，不会上传到任何第三方
        </p>
        <button onClick={handleSaveApiKey} className="btn btn-primary mt-6">
          {apiSaved ? '已保存 ✓' : '保存'}
        </button>
      </div>

      {/* AI 输出目录 */}
      <div className="card">
        <label className="card-label" style={{ marginBottom: 8, textTransform: 'none', letterSpacing: 0 }}>
          AI 生成输出目录
        </label>
        <p className="text-xs text-muted mb-4">
          设置 AI 图片生成的默认输出文件夹。不设置则使用原图所在目录。
        </p>
        <div className="flex gap-3 items-center">
          <span className="text-sm text-secondary flex-1" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {aiOutputDir || '未设置（使用原图目录）'}
          </span>
          <button onClick={handleSelectOutputDir} className="btn btn-sm btn-ghost">选择目录</button>
          <button onClick={handleSaveOutputDir} className="btn btn-sm btn-primary">
            {dirSaved ? '已保存 ✓' : '保存'}
          </button>
        </div>
      </div>

      {/* Model List */}
      <div className="card mb-8">
        <div className="flex justify-between items-center mb-4">
          <label className="card-label" style={{ textTransform: 'none', letterSpacing: 0, marginBottom: 0 }}>
            模型列表
          </label>
          <button onClick={() => { setIsAddingModel(true); setNewModelId(''); setNewModelName(''); }}
            className="btn btn-sm">+ 添加模型</button>
        </div>
        
        {isAddingModel && (
          <div className="flex gap-3 items-center mb-4 p-4" style={{ background: 'var(--color-bg-surface)', borderRadius: 8 }}>
            <input placeholder="名称" value={newModelName} onChange={e => setNewModelName(e.target.value)}
              className="input" style={{ width: 160, padding: '6px 10px', fontSize: 13 }} />
            <input placeholder="ID" value={newModelId} onChange={e => setNewModelId(e.target.value)}
              className="input" style={{ flex: 1, padding: '6px 10px', fontSize: 13 }} />
            <button onClick={handleAddModel} className="btn btn-sm btn-primary">保存</button>
            <button onClick={() => setIsAddingModel(false)} className="btn btn-sm btn-ghost">取消</button>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {modelList.map(m => (
            <div key={m.id} className="flex items-center gap-3 p-3" style={{ background: 'var(--color-bg-surface)', borderRadius: 8, border: '1px solid var(--color-border-subtle)' }}>
              {editingModel?.id === m.id ? (
                <>
                  <input value={editingModel.name} onChange={e => setEditingModel({ ...editingModel, name: e.target.value })}
                    className="input" style={{ width: 160, padding: '4px 8px', fontSize: 13 }} />
                  <input value={editingModel.id} onChange={e => setEditingModel({ ...editingModel, id: e.target.value })}
                    className="input" style={{ flex: 1, padding: '4px 8px', fontSize: 13 }} />
                  <button onClick={handleEditModelSave} className="btn btn-sm btn-primary">保存</button>
                  <button onClick={() => setEditingModel(null)} className="btn btn-sm btn-ghost">取消</button>
                </>
              ) : (
                <>
                  <span className="text-sm font-medium" style={{ width: 160 }}>{m.name}</span>
                  <span className="text-xs text-muted" style={{ flex: 1 }}>{m.id}</span>
                  <button onClick={() => setEditingModel({ ...m })} className="btn btn-sm btn-ghost">编辑</button>
                  <button onClick={() => handleDeleteModel(m.id)} className="btn btn-sm" style={{ color: 'var(--color-danger)' }}>删除</button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
