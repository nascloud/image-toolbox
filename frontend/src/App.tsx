import React, { useEffect, useState } from 'react';
import { Layout, TabDef } from './components/Layout';
import { ConvertResize } from './pages/ConvertResize';
import { Slice } from './pages/Slice';
import { Watermark } from './pages/Watermark';
import { AIBatch } from './pages/AIBatch';
import { Settings } from './pages/Settings';
import { ProgressProvider } from './hooks/useProgress';
import { OnFileDrop, OnFileDropOff, EventsOn } from '../wailsjs/runtime/runtime';
import { IntentProvider, useIntentContext } from './hooks/useIntent';
import './App.css';

function MainApp() {
  const [activeTab, setActiveTab] = useState('convert-resize');
  const { setPending } = useIntentContext();

  useEffect(() => {
    OnFileDrop(() => undefined, false);
    return () => {
      OnFileDropOff();
    };
  }, []);

  useEffect(() => {
    const handleIntent = (intent: any) => {
      console.log('Processing launch intent:', intent);
      if (intent) {
        setPending(intent);
        if (intent.page === 'convert') {
          setActiveTab('convert-resize');
        } else if (intent.page === 'slice') {
          setActiveTab('slice');
        } else if (intent.page === 'watermark') {
          setActiveTab('watermark');
        } else if (intent.page === 'aibatch') {
          setActiveTab('ai');
        }
      }
    };

    const off = EventsOn('app:launch-intent', (intent: any) => {
      handleIntent(intent);
    });

    (async () => {
      try {
        const intent = await (window as any).go.main.App.GetPendingIntent();
        if (intent) {
          handleIntent(intent);
        }
      } catch (e) {
        console.error('Failed to get pending intent:', e);
      }
    })();

    return () => {
      off();
    };
  }, [setPending]);

  const tabs: TabDef[] = [
    { id: 'convert-resize', label: '转换', component: <ConvertResize /> },
    { id: 'slice', label: '切片', component: <Slice /> },
    { id: 'watermark', label: '水印', component: <Watermark /> },
    { id: 'ai', label: 'AI 生成', component: <AIBatch /> },
    { id: 'settings', label: '⚙ 设置', component: <Settings /> },
  ];

  return (
    <Layout tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
  );
}

function App() {
  return (
    <ProgressProvider>
      <IntentProvider>
        <MainApp />
      </IntentProvider>
    </ProgressProvider>
  );
}

export default App;
