import React, { useState } from 'react';
import { Layout, TabDef } from './components/Layout';
import { ConvertResize } from './pages/ConvertResize';
import { Slice } from './pages/Slice';
import { Watermark } from './pages/Watermark';
import { AIBatch } from './pages/AIBatch';
import { Settings } from './pages/Settings';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('convert-resize');

  const tabs: TabDef[] = [
    { id: 'convert-resize', label: '转换+缩放', component: <ConvertResize /> },
    { id: 'slice', label: '切片', component: <Slice /> },
    { id: 'watermark', label: '水印', component: <Watermark /> },
    { id: 'ai', label: 'AI 生成', component: <AIBatch /> },
    { id: 'settings', label: '⚙ 设置', component: <Settings /> },
  ];

  return (
    <Layout tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
  );
}

export default App;
