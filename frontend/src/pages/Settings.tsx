import React, { useState, useEffect } from 'react';

export const Settings: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const key = await (window as any).go.main.App.GetApiKey();
        if (key) setApiKey(key);
      } catch { /* no-op */ }
    })();
  }, []);

  const handleSave = async () => {
    try {
      await (window as any).go.main.App.SaveApiKey(apiKey);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* no-op */ }
  };

  const btnStyle: React.CSSProperties = {
    padding: '10px 32px', background: '#e94560', color: '#fff',
    border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14,
  };
  const inputStyle: React.CSSProperties = {
    padding: '10px 14px', background: '#1a1a2e', color: '#fff',
    border: '1px solid #333', borderRadius: 6, fontSize: 14, width: '100%',
    boxSizing: 'border-box',
  };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 24px', fontSize: 22, fontWeight: 600 }}>设置</h2>

      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 14, display: 'block', marginBottom: 8 }}>
          Volcano Engine API Key
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          placeholder="输入你的火山方舟 API Key"
          style={inputStyle}
        />
        <p style={{ fontSize: 12, color: '#888', marginTop: 6 }}>
          API Key 仅保存在本地 ~/.imagetool/config.json，不会上传到任何第三方
        </p>
      </div>

      <button onClick={handleSave} style={btnStyle}>
        {saved ? '已保存 ✓' : '保存'}
      </button>
    </div>
  );
};
