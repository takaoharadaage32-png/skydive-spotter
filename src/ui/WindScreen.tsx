import { trueToMagnetic } from '../core/magnetic';
import { average, vectorToWind } from '../core/vector';
import { ktToMs, msToKt } from '../core/units';
import type { WindLayer } from '../core/windProfile';
import type { SpotterState } from './useSpotterState';

interface Props {
  state: SpotterState;
}

const MAX_BAR_KT = 50;

function WindRow({
  layer,
  declinationDeg,
  speedUnit,
  barClassName,
}: {
  layer: WindLayer;
  declinationDeg: number;
  speedUnit: 'kt' | 'ms';
  barClassName: string;
}) {
  const dirMag = Math.round(trueToMagnetic(layer.dirDeg, declinationDeg));
  const rotation = (dirMag + 180) % 360;
  const spdLabel = speedUnit === 'ms' ? `${ktToMs(layer.speedKt).toFixed(1)}` : `${Math.round(layer.speedKt)}`;
  const barPct = Math.min(100, Math.round((layer.speedKt / MAX_BAR_KT) * 100));

  return (
    <div className="wind-row">
      <span className="wind-row__alt">{layer.altAglFt.toLocaleString('ja-JP')}</span>
      <svg
        className="wind-row__arrow"
        width="22"
        height="22"
        viewBox="0 0 22 22"
        aria-hidden="true"
        style={{ transform: `rotate(${rotation}deg)` }}
      >
        <path d="M11 18V4M6 9L11 4L16 9" fill="none" stroke="#15191E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="wind-row__dir">{String(dirMag).padStart(3, '0')}°M</span>
      <span className="wind-row__spd">{spdLabel}</span>
      <div className="wind-row__bar-track">
        <div className={`wind-row__bar-fill ${barClassName}`} style={{ width: `${barPct}%` }} />
      </div>
    </div>
  );
}

export default function WindScreen({ state }: Props) {
  const { wind, inputs, declinationDeg, fetchWind } = state;
  const profile = wind.profile;

  const freefallLayers = profile
    ? profile.layers.filter((l) => l.altAglFt >= inputs.openAltFt && l.altAglFt <= inputs.exitAltFt).slice().reverse()
    : [];
  const canopyLayers = profile
    ? profile.layers.filter((l) => l.altAglFt <= inputs.openAltFt).slice().reverse()
    : [];

  const averageLabel = (layers: WindLayer[]): string => {
    if (layers.length === 0) return '—';
    const avg = vectorToWind(average(layers.map((l) => ({ u: l.u, v: l.v }))));
    const dirMag = Math.round(trueToMagnetic(avg.dirDeg, declinationDeg));
    return `${String(dirMag).padStart(3, '0')}°M ${Math.round(msToKt(avg.speed))} kt`;
  };
  const ffAvgLabel = averageLabel(freefallLayers);
  const cnAvgLabel = averageLabel(canopyLayers);

  return (
    <>
      <header className="app__header">
        <div className="app__eyebrow">SKYDIVE SPOTTER · WINDS ALOFT</div>
        <h1 className="app__title">上空の風</h1>
      </header>
      <main className="app__main">
        <section className="card wind-meta">
          <div className="wind-meta__item">
            <span>モデル</span>
            <span>{profile?.model ?? '—'}</span>
          </div>
          <div className="wind-meta__item">
            <span>予報時刻</span>
            <span className="mono">{profile ? new Date(profile.validTime).toLocaleString('ja-JP') : '—'}</span>
          </div>
          <div className="wind-meta__item">
            <span>取得</span>
            <span className="mono">{wind.fetchedAt ? wind.fetchedAt.toLocaleTimeString('ja-JP') : '—'}</span>
          </div>
        </section>

        {!profile ? (
          <div className="error-banner">まだ風データがありません。入力タブで「風を取得」してください。</div>
        ) : (
          <section className="card" style={{ padding: '4px 16px 10px' }}>
            <div className="wind-table-head">
              <span>高度 ft</span>
              <span />
              <span>風向</span>
              <span>{state.displayUnits.speed === 'ms' ? 'm/s' : 'kt'}</span>
              <span>風速</span>
            </div>

            <div className="wind-section-head">
              <span className="wind-section-head__title">フリーフォール区間</span>
              <span className="wind-section-head__avg">Level 1 平均 {ffAvgLabel}</span>
            </div>
            {freefallLayers.map((l) => (
              <WindRow key={l.altAglFt} layer={l} declinationDeg={declinationDeg} speedUnit={state.displayUnits.speed} barClassName="" />
            ))}

            <div className="wind-section-head">
              <span className="wind-section-head__title">キャノピー区間</span>
              <span className="wind-section-head__avg">Level 1 平均 {cnAvgLabel}</span>
            </div>
            {canopyLayers.map((l) => (
              <WindRow
                key={l.altAglFt}
                layer={l}
                declinationDeg={declinationDeg}
                speedUnit={state.displayUnits.speed}
                barClassName="wind-row__bar-fill--canopy"
              />
            ))}
          </section>
        )}

        <div className="button-pair">
          <button type="button" className="btn-outline" onClick={() => void fetchWind()} disabled={wind.status === 'loading'}>
            風を再取得
          </button>
        </div>
        <p className="legal-footer">
          矢印は風に流される向き。風向は吹いてくる方向（磁方位・偏角{' '}
          {declinationDeg >= 0 ? `${declinationDeg.toFixed(1)}°E` : `${Math.abs(declinationDeg).toFixed(1)}°W`}
          。予報の真方位から変換）。Weather data by Open-Meteo.com
        </p>
      </main>
    </>
  );
}
