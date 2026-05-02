import React, { useState } from 'react';
import { Layout, TabDef } from './components/Layout';
import { ConvertResize } from './pages/ConvertResize';
import { Slice } from './pages/Slice';
import { Watermark } from './pages/Watermark';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('convert-resize');

  const tabs: TabDef[] = [
    { id: 'convert-resize', label: '转换+缩放', component: <ConvertResize /> },
    { id: 'slice', label: '切片', component: <Slice /> },
    { id: 'watermark', label: '水印', component: <Watermark /> },
    { id: 'ai', label: 'AI 生成', component: <div style={{ padding: 40, color: '#666' }}>AI 生成功能（Phase 3）</div> },
  ];

  return (
    <Layout tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
  );
}

export default App;
