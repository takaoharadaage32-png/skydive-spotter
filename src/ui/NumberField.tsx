// 数値入力欄（素の <input type="number"> の代わりに使う）
//
// 素の制御された <input type="number"> は、入力欄を空にした瞬間（valueAsNumberがNaNになる）に
// 呼び出し側が状態更新をスキップすると、Reactがその場で元の値を書き戻してしまい、
// 「Backspaceで消しても最後の1文字が消せない」という挙動になる。
// これを避けるため、入力中の文字列はこのコンポーネント内のローカル状態として持ち、
// 数値として確定できたときだけ呼び出し側（アプリの状態）に伝える。

import { useEffect, useRef, useState, type CSSProperties } from 'react';

interface Props {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  step?: number | string;
  className?: string;
  style?: CSSProperties;
}

export default function NumberField({ value, onChange, min, step, className, style }: Props) {
  const [text, setText] = useState(String(value));
  const isFocused = useRef(false);

  // 外部要因（単位切替・自動計算など）での値変化は、編集中でなければ表示に反映する
  useEffect(() => {
    if (!isFocused.current) {
      setText(String(value));
    }
  }, [value]);

  return (
    <input
      type="number"
      className={className}
      style={style}
      min={min}
      step={step}
      value={text}
      onFocus={() => {
        isFocused.current = true;
      }}
      onBlur={() => {
        isFocused.current = false;
        setText(String(value)); // 確定できなかった入力（空欄や範囲外）は最後の有効値に戻す
      }}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        if (raw.trim() === '') return;
        const parsed = Number(raw);
        if (!Number.isNaN(parsed) && (min === undefined || parsed >= min)) {
          onChange(parsed);
        }
      }}
    />
  );
}
