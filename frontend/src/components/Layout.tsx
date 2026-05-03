import React, { useRef, useEffect, useState } from 'react';

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
  const [animating, setAnimating] = useState(false);
  const [prevTab, setPrevTab] = useState(activeTab);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prevTab !== activeTab) {
      setAnimating(true);
      setPrevTab(activeTab);
      const timer = setTimeout(() => setAnimating(false), 250);
      return () => clearTimeout(timer);
    }
  }, [activeTab, prevTab]);

  return (
    <div className="app-layout">
      <nav className="tab-nav">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-btn${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      <main
        ref={contentRef}
        className="main-content"
        style={{
          animation: animating ? 'fadeIn 250ms ease' : undefined,
        }}
      >
        {activeContent}
      </main>
    </div>
  );
};
