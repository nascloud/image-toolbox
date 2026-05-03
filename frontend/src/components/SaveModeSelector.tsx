import React from 'react';

export interface SaveModeConfig {
  mode: 'custom' | 'overwrite' | 'prefix' | 'subdir';
  prefixName: string;
  subdirName: string;
  outputDir: string;
}

interface SaveModeSelectorProps {
  config: SaveModeConfig;
  onChange: (config: SaveModeConfig) => void;
  onSelectOutputDir: () => void;
  onOpenOutputDir?: () => void;
}

const MODE_OPTIONS: { value: SaveModeConfig['mode']; label: string }[] = [
  { value: 'custom', label: '输出到指定目录' },
  { value: 'overwrite', label: '覆盖源文件' },
  { value: 'prefix', label: '添加前缀' },
  { value: 'subdir', label: '保存到子目录' },
];

export const SaveModeSelector: React.FC<SaveModeSelectorProps> = ({
  config, onChange, onSelectOutputDir, onOpenOutputDir,
}) => {
  const update = (partial: Partial<SaveModeConfig>) => {
    onChange({ ...config, ...partial });
  };

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-label">保存方式</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {MODE_OPTIONS.map(opt => (
          <label key={opt.value} className="form-row" style={{ cursor: 'pointer', alignItems: 'center' }}>
            <input
              type="radio"
              name="saveMode"
              checked={config.mode === opt.value}
              onChange={() => update({ mode: opt.value })}
              style={{ accentColor: 'var(--color-accent)', marginRight: 8 }}
            />
            <span className="form-label" style={{ minWidth: 0, flexShrink: 0, fontSize: 13 }}>{opt.label}</span>

            {opt.value === 'custom' && config.mode === 'custom' && (
              <>
                <span className="text-xs text-muted" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginLeft: 8 }}>
                  {config.outputDir || '未设置'}
                </span>
                <button onClick={(e) => { e.preventDefault(); onSelectOutputDir(); }} className="btn btn-sm btn-ghost" style={{ flexShrink: 0 }}>
                  选择目录
                </button>
                {config.outputDir && onOpenOutputDir && (
                  <button onClick={(e) => { e.preventDefault(); onOpenOutputDir(); }} className="btn btn-sm" style={{ flexShrink: 0 }}>
                    📂
                  </button>
                )}
              </>
            )}

            {opt.value === 'prefix' && config.mode === 'prefix' && (
              <input
                type="text"
                value={config.prefixName}
                onChange={e => update({ prefixName: e.target.value })}
                className="input"
                style={{ width: 120, padding: '4px 8px', fontSize: 12, marginLeft: 8 }}
                placeholder="前缀名"
                onClick={e => e.stopPropagation()}
              />
            )}

            {opt.value === 'subdir' && config.mode === 'subdir' && (
              <input
                type="text"
                value={config.subdirName}
                onChange={e => update({ subdirName: e.target.value })}
                className="input"
                style={{ width: 120, padding: '4px 8px', fontSize: 12, marginLeft: 8 }}
                placeholder="目录名"
                onClick={e => e.stopPropagation()}
              />
            )}
          </label>
        ))}
      </div>
    </div>
  );
};
