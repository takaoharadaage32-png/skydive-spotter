export type Tab = 'input' | 'result' | 'wind';

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'input', label: '入力' },
  { key: 'result', label: '結果' },
  { key: 'wind', label: '風' },
];

export default function TabNav({ active, onChange }: Props) {
  return (
    <nav className="tab-nav" aria-label="タブ">
      {TABS.map((t) => (
        <button
          key={t.key}
          type="button"
          className={t.key === active ? 'is-active' : ''}
          aria-current={t.key === active ? 'page' : undefined}
          onClick={() => onChange(t.key)}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}
