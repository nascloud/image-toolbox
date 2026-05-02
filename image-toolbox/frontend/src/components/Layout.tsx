import React from 'react';

export interface TabDef {
  id: string;
  label: string;
  component: React.ReactNode;
}

interface LayoutProps {
  tabs: TabDef[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({ tabs, activeTab, onTabChange }) => {
  const activeContent = tabs.find(t => t.id === activeTab)?.component;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <nav style={{
        display: 'flex', gap: 0, background: '#1a1a2e',
        padding: '0 16px', borderBottom: '2px solid #16213e',
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              padding: '12px 24px', border: 'none',
              background: activeTab === tab.id ? '#0f3460' : 'transparent',
              color: activeTab === tab.id ? '#e94560' : '#888',
              cursor: 'pointer', fontSize: '15px',
              fontWeight: activeTab === tab.id ? 600 : 400,
              borderBottom: activeTab === tab.id ? '3px solid #e94560' : '3px solid transparent',
              transition: 'all 0.2s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      <main style={{ flex: 1, padding: '24px', overflow: 'auto' }}>
        {activeContent}
      </main>
    </div>
  );
};
