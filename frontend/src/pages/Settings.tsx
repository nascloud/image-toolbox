import React, { useState, useEffect } from 'react';

export const Settings: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [aiOutputDir, setAiOutputDir] = useState('');
  const [apiSaved, setApiSaved] = useState(false);
  const [dirSaved, setDirSaved] = useState(false);

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
    </div>
  );
};
