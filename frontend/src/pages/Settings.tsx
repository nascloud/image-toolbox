import React, { useState, useEffect } from 'react';
import { useProgressContext } from '../hooks/useProgress';

export const Settings: React.FC = () => {
  const [aiOutputDir, setAiOutputDir] = useState('');
  const [dirSaved, setDirSaved] = useState(false);
  const [providers, setProviders] = useState<{[key: string]: {apiKey: string, baseURL: string, hasApiKey: boolean, reviewModel: string, reviewEndpoint: string}}>({
    seedream: {apiKey: '', baseURL: 'https://ark.cn-beijing.volces.com/api/v3', hasApiKey: false, reviewModel: '', reviewEndpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions'},
    openai: {apiKey: '', baseURL: 'https://open2api.kuvms.net', hasApiKey: false, reviewModel: 'gpt-6-sol', reviewEndpoint: 'https://open2api.kuvms.net/v1/responses'},
  });
  const [activeProvider, setActiveProvider] = useState('seedream');
  const [providerSaved, setProviderSaved] = useState<{[key: string]: boolean}>({});
  const [fetchingModels, setFetchingModels] = useState<{[key: string]: boolean}>({});
  const [fetchModelResult, setFetchModelResult] = useState<{[key: string]: string}>({});
  const [contextMenuInstalled, setContextMenuInstalled] = useState(false);
  const [contextMenuLoading, setContextMenuLoading] = useState(false);
  const [contextMenuError, setContextMenuError] = useState('');

  const { setIdleText } = useProgressContext();
  useEffect(() => {
    setIdleText('设置');
  }, [setIdleText]);

  useEffect(() => {
    (async () => {
      try {
        const active = await (window as any).go.main.App.GetActiveProvider();
        if (active) setActiveProvider(active);
      } catch { /* no-op */ }
      for (const name of ['seedream', 'openai']) {
        try {
          const cfg = await (window as any).go.main.App.GetProviderConfig(name);
          setProviders(prev => ({
            ...prev,
            [name]: {
              ...prev[name],
              apiKey: '',
              hasApiKey: !!cfg.hasApiKey,
              baseURL: cfg.baseURL || prev[name].baseURL,
              reviewModel: cfg.reviewModel || prev[name].reviewModel,
              reviewEndpoint: cfg.reviewEndpoint || prev[name].reviewEndpoint,
            }
          }));
        } catch { /* no-op */ }
      }
      try {
        const dir = await (window as any).go.main.App.GetAiOutputDir();
        if (dir) setAiOutputDir(dir);
      } catch { /* no-op */ }
      try {
        const cmInstalled = await (window as any).go.main.App.IsContextMenuInstalled();
        setContextMenuInstalled(!!cmInstalled);
      } catch { /* no-op */ }
    })();
  }, []);

  const handleSaveProvider = async (name: string) => {
    try {
      const apiKey = providers[name].apiKey.trim();
      const preserveExistingKey = apiKey === '' && providers[name].hasApiKey;
      await (window as any).go.main.App.SaveProviderConfig(name, apiKey, providers[name].baseURL, preserveExistingKey);
      await (window as any).go.main.App.SaveProviderReviewConfig(name, providers[name].reviewModel, providers[name].reviewEndpoint);
      setProviders(prev => ({
        ...prev,
        [name]: {...prev[name], apiKey: '', hasApiKey: preserveExistingKey || apiKey !== ''}
      }));
      setProviderSaved(prev => ({...prev, [name]: true}));
      setTimeout(() => setProviderSaved(prev => ({...prev, [name]: false})), 2000);
    } catch { /* no-op */ }
  };

  const handleSetActive = async (name: string) => {
    try {
      await (window as any).go.main.App.SetActiveProvider(name);
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

      {/* Default Provider */}
      <div className="card mb-8">
        <label className="card-label" style={{ marginBottom: 8, textTransform: 'none', letterSpacing: 0 }}>
          默认 AI Provider
        </label>
        <select
          className="input"
          value={activeProvider}
          onChange={e => { setActiveProvider(e.target.value); handleSetActive(e.target.value); }}
          style={{ width: '100%', padding: '8px 12px' }}
        >
          <option value="seedream">Seedream (Volcano Engine)</option>
          <option value="openai">OpenAI (Sub2API)</option>
        </select>
      </div>

      {/* Provider configs */}
      {['seedream', 'openai'].map(name => (
        <div className="card mb-8" key={name}>
          <label className="card-label" style={{ marginBottom: 8, textTransform: 'none', letterSpacing: 0 }}>
            {name === 'seedream' ? 'Seedream (Volcano Engine)' : 'OpenAI (Sub2API)'} 配置
          </label>
          <input
            type="password"
            placeholder={providers[name].hasApiKey ? '已保存，留空则保留当前 Key' : 'API Key'}
            value={providers[name].apiKey}
            onChange={e => setProviders(p => ({...p, [name]: {...p[name], apiKey: e.target.value}}))}
            className="input"
          />
          <div style={{ marginTop: 8 }} />
          <input
            type="text"
            placeholder="Base URL"
            value={providers[name].baseURL}
            onChange={e => setProviders(p => ({...p, [name]: {...p[name], baseURL: e.target.value}}))}
            className="input"
          />
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-border-subtle)' }}>
            <label className="text-sm" style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>评价 AI 重写（可选）</label>
            <input
              type="text"
              placeholder={name === 'seedream' ? '语言模型推理接入点 ID' : '文本模型 ID'}
              value={providers[name].reviewModel}
              onChange={e => setProviders(p => ({...p, [name]: {...p[name], reviewModel: e.target.value}}))}
              className="input"
            />
            <div style={{ marginTop: 8 }} />
            <input
              type="text"
              placeholder="完整 Responses 或 Chat Completions Endpoint"
              value={providers[name].reviewEndpoint}
              onChange={e => setProviders(p => ({...p, [name]: {...p[name], reviewEndpoint: e.target.value}}))}
              className="input"
            />
            <p className="text-xs text-muted mt-4">
              支持 OpenAI-compatible Responses 和 Chat Completions 接口；OpenAI 默认使用 Responses API 与 medium 推理强度。
            </p>
          </div>
          <p className="text-xs text-muted mt-4">
            API Key 仅保存在本地 ~/.imagetool/config.json，不会上传到任何第三方
          </p>
          <button onClick={() => handleSaveProvider(name)} className="btn btn-primary mt-6">
            {providerSaved[name] ? '已保存 ✓' : '保存'}
          </button>
          <button
            disabled={fetchingModels[name]}
            onClick={async () => {
              setFetchingModels(prev => ({...prev, [name]: true}));
              setFetchModelResult(prev => ({...prev, [name]: ''}));
              try {
                const models = await (window as any).go.main.App.FetchProviderModels(name);
                setFetchModelResult(prev => ({...prev, [name]: `✓ 已获取 ${models.length} 个模型`}));
              } catch (e: any) {
                setFetchModelResult(prev => ({...prev, [name]: `✗ ${e?.message || String(e)}`}));
              } finally {
                setFetchingModels(prev => ({...prev, [name]: false}));
              }
            }}
            className="btn btn-sm btn-ghost mt-6"
            style={{ marginLeft: 8 }}
          >
            {fetchingModels[name] ? '获取中...' : '获取模型'}
          </button>
          {fetchModelResult[name] && (
            <span className="text-xs" style={{ marginLeft: 8, color: fetchModelResult[name].startsWith('✓') ? 'var(--color-success, #38a169)' : 'var(--color-danger, #e53e3e)' }}>
              {fetchModelResult[name]}
            </span>
          )}
        </div>
      ))}

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

      {/* 右键菜单 */}
      <div className="card mb-8">
        <label className="card-label" style={{ marginBottom: 8, textTransform: 'none', letterSpacing: 0 }}>
          Windows 右键菜单
        </label>
        <p className="text-xs text-muted mb-4">
          在资源管理器中右键图片文件或文件夹时，显示 ImageToolbox 快捷处理菜单。
        </p>
        <div className="flex gap-3 items-center">
          <span className="text-sm text-secondary flex-1">
            {contextMenuInstalled ? '✅ 已安装' : '未安装'}
          </span>
          <button
            disabled={contextMenuLoading}
            className={`btn btn-sm ${contextMenuInstalled ? 'btn-ghost' : 'btn-primary'}`}
            onClick={async () => {
              setContextMenuLoading(true);
              setContextMenuError('');
              try {
                if (contextMenuInstalled) {
                  await (window as any).go.main.App.UninstallContextMenu();
                  setContextMenuInstalled(false);
                } else {
                  await (window as any).go.main.App.InstallContextMenu();
                  setContextMenuInstalled(true);
                }
              } catch (e: any) {
                setContextMenuError(e?.message || String(e));
              } finally {
                setContextMenuLoading(false);
              }
            }}
          >
            {contextMenuLoading ? '处理中...' : contextMenuInstalled ? '卸载右键菜单' : '安装右键菜单'}
          </button>
        </div>
        {contextMenuError && (
          <p className="text-xs mt-4" style={{ color: 'var(--color-danger, #e53e3e)' }}>
            操作失败：{contextMenuError}
          </p>
        )}
      </div>

    </div>
  );
};
