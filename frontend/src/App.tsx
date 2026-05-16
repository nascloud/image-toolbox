import React, { useEffect, useState } from 'react';
import { Layout, TabDef } from './components/Layout';
import { ConvertResize } from './pages/ConvertResize';
import { Slice } from './pages/Slice';
import { Watermark } from './pages/Watermark';
import { AIBatch } from './pages/AIBatch';
import { Settings } from './pages/Settings';
import { ProgressProvider } from './hooks/useProgress';
import { OnFileDrop, OnFileDropOff } from '../wailsjs/runtime/runtime';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('convert-resize');

  useEffect(() => {
    OnFileDrop(() => undefined, false);
    return () => {
      OnFileDropOff();
    };
  }, []);

  const tabs: TabDef[] = [
    { id: 'convert-resize', label: '转换', component: <ConvertResize /> },
    { id: 'slice', label: '切片', component: <Slice /> },
    { id: 'watermark', label: '水印', component: <Watermark /> },
    { id: 'ai', label: 'AI 生成', component: <AIBatch /> },
    { id: 'settings', label: '⚙ 设置', component: <Settings /> },
  ];

  return (
    <ProgressProvider>
      <Layout tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
    </ProgressProvider>
  );
}

export default App;
