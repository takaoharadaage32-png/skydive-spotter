import { useState } from 'react';
import InputScreen from './ui/InputScreen';
import ResultScreen from './ui/ResultScreen';
import WindScreen from './ui/WindScreen';
import TabNav, { type Tab } from './ui/TabNav';
import { useSpotterState } from './ui/useSpotterState';

function App() {
  const [tab, setTab] = useState<Tab>('input');
  const state = useSpotterState();

  return (
    <div className="app">
      {tab === 'input' && (
        <>
          <header className="app__header">
            <div className="app__eyebrow">SKYDIVE SPOTTER</div>
            <h1 className="app__title">ジャンプ設定</h1>
          </header>
          <main className="app__main">
            <InputScreen state={state} onGoToResult={() => setTab('result')} />
          </main>
        </>
      )}
      {tab === 'result' && <ResultScreen state={state} />}
      {tab === 'wind' && <WindScreen state={state} />}
      <TabNav active={tab} onChange={setTab} />
    </div>
  );
}

export default App;
