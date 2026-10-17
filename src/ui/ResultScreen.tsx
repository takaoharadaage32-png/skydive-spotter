import { FALL_MODELS } from '../core/constants';
import { trueToMagnetic } from '../core/magnetic';
import { magnitude, sub, vectorToBearingDistance } from '../core/vector';
import { formatAltitude, formatBearingMag, formatDistance, formatSpeed } from './format';
import MapView from './MapView';
import type { SpotterState } from './useSpotterState';

interface Props {
  state: SpotterState;
}

export default function ResultScreen({ state }: Props) {
  const { inputs, displayUnits, declinationDeg, level, setLevel, spotResults, computeErrorMessage, wind, groupExits, warnings } =
    state;

  const selected = level === 1 ? spotResults.level1 : spotResults.level2;
  const other = level === 1 ? spotResults.level2 : spotResults.level1;
  const otherLevel = level === 1 ? 2 : 1;
  const levelDiffWarning = warnings.find((w) => w.key === 'levelDiff');
  const otherWarnings = warnings.filter((w) => w.key !== 'levelDiff');

  const handleCopyPilotText = (text: string) => {
    void navigator.clipboard?.writeText(text).catch(() => {});
  };

  return (
    <>
      <header className="app__header result-header">
        <div>
          <div className="app__eyebrow">
            SKYDIVE SPOTTER · {formatAltitude(inputs.exitAltFt, displayUnits.altitude)} →{' '}
            {formatAltitude(inputs.openAltFt, displayUnits.altitude)} · {FALL_MODELS[inputs.fallModelKey].name}
          </div>
          <h1 className="app__title">スポット</h1>
        </div>
        <div role="group" aria-label="計算方式" className="segmented">
          <button className={level === 1 ? 'is-active' : ''} onClick={() => setLevel(1)}>
            Level 1
          </button>
          <button className={level === 2 ? 'is-active' : ''} onClick={() => setLevel(2)}>
            Level 2
          </button>
        </div>
      </header>

      <main className="app__main">
        {selected && !computeErrorMessage ? (
          <MapView
            targetLat={inputs.targetLat}
            targetLon={inputs.targetLon}
            openPosition={selected.openPosition}
            exitLevel1={spotResults.level1?.exitPosition}
            exitLevel2={spotResults.level2?.exitPosition}
            selectedLevel={level}
            jumpRunTrueBearingDeg={state.jumpRunTrueBearingDeg}
            windLayers={wind.profile?.layers}
            declinationDeg={declinationDeg}
            groupExits={groupExits}
          />
        ) : (
          <div className="map-placeholder">地図を表示するには先に入力タブで風を取得してください。</div>
        )}

        {!selected || computeErrorMessage ? (
          <div className="error-banner">{computeErrorMessage ?? '計算できません。入力を確認してください。'}</div>
        ) : (
          <>
            {otherWarnings.map((w) => (
              <div key={w.key} className="warning-banner">
                <span>{w.message}</span>
              </div>
            ))}

            <section className="card">
              {(() => {
                const { bearingDeg, distanceM } = vectorToBearingDistance(selected.exitPosition);
                const bearingMag = trueToMagnetic(bearingDeg, declinationDeg);
                return (
                  <div className="stat-main">
                    <span className="stat-main__label">Exit地点（Level {level}）ターゲットから</span>
                    <div className="stat-main__values">
                      <span className="big">{formatBearingMag(bearingMag)}</span>
                      <span className="big">{formatDistance(distanceM, displayUnits.distance)}</span>
                    </div>
                  </div>
                );
              })()}

              {other && (
                <div className={levelDiffWarning ? 'warning-banner' : 'info-banner'}>
                  <span>
                    Level {otherLevel} は{' '}
                    {formatDistance(vectorToBearingDistance(other.exitPosition).distanceM, displayUnits.distance)}
                    。差 {formatDistance(magnitude(sub(selected.exitPosition, other.exitPosition)), displayUnits.distance)}
                    {levelDiffWarning && '（風のシアが大きい日です。Level 2を優先してください）'}
                  </span>
                </div>
              )}

              <div className="stat-grid">
                <div className="stat-tile">
                  <span className="stat-tile__label">フリーフォールドリフト</span>
                  <span className="stat-tile__value">
                    {formatBearingMag(trueToMagnetic(vectorToBearingDistance(selected.freefallDrift).bearingDeg, declinationDeg))}{' '}
                    {formatDistance(vectorToBearingDistance(selected.freefallDrift).distanceM, displayUnits.distance)}
                  </span>
                </div>
                <div className="stat-tile">
                  <span className="stat-tile__label">キャノピードリフト</span>
                  <span className="stat-tile__value">
                    {formatBearingMag(trueToMagnetic(vectorToBearingDistance(selected.canopyDrift).bearingDeg, declinationDeg))}{' '}
                    {formatDistance(vectorToBearingDistance(selected.canopyDrift).distanceM, displayUnits.distance)}
                  </span>
                </div>
                <div className="stat-tile">
                  <span className="stat-tile__label">対地速度（GS）</span>
                  <span className="stat-tile__value">{formatSpeed(selected.groundSpeedMs, displayUnits.speed)}</span>
                </div>
                <div className="stat-tile">
                  <span className="stat-tile__label">Forward throw</span>
                  <span className="stat-tile__value">{formatDistance(magnitude(selected.forwardThrow), displayUnits.distance)}</span>
                </div>
              </div>
            </section>

            {(() => {
              const jumpRunMag = Math.round(trueToMagnetic(state.jumpRunTrueBearingDeg, declinationDeg));
              const lead = groupExits[0];
              const last = groupExits[groupExits.length - 1];
              const greenVec = vectorToBearingDistance(lead?.exitPosition ?? selected.exitPosition);
              const greenMag = Math.round(trueToMagnetic(greenVec.bearingDeg, declinationDeg));
              const greenDist = formatDistance(greenVec.distanceM, displayUnits.distance);
              const hasMultipleGroups = groupExits.length > 1;
              let pilotText = `ジャンプラン ${jumpRunMag}°M\nグリーン：ターゲットから ${greenMag}°M ${greenDist}`;
              let lastLine: string | null = null;
              if (hasMultipleGroups && last) {
                const lastVec = vectorToBearingDistance(last.exitPosition);
                const lastMag = Math.round(trueToMagnetic(lastVec.bearingDeg, declinationDeg));
                const lastDist = formatDistance(lastVec.distanceM, displayUnits.distance);
                lastLine = `${lastMag}°M ${lastDist}`;
                pilotText += `\n最終Exit：${lastLine}`;
              }
              return (
                <section className="pilot-card">
                  <div className="pilot-card__head">
                    <span className="pilot-card__label">パイロットへ</span>
                    <button
                      type="button"
                      className="pilot-card__copy-btn"
                      aria-label="パイロット向けの文をコピー"
                      onClick={() => handleCopyPilotText(pilotText)}
                    >
                      コピー
                    </button>
                  </div>
                  <div className="pilot-card__body">
                    ジャンプラン <span className="mono">{jumpRunMag}°M</span>
                    <br />
                    グリーン：ターゲットから <span className="mono">{greenMag}°M {greenDist}</span>
                    {lastLine && (
                      <>
                        <br />
                        最終Exit：<span className="mono">{lastLine}</span>
                      </>
                    )}
                  </div>
                </section>
              );
            })()}

            {groupExits.length > 0 && (
              <section className="card">
                <div className="card__title-row" style={{ paddingBottom: 6 }}>
                  <h2 className="card__title">Exit順と間隔</h2>
                  <span className="helper-text">{formatSpeed(selected.groundSpeedMs, displayUnits.speed)} で計算</span>
                </div>
                {groupExits.map((g, i) => {
                  const { distanceM } = vectorToBearingDistance(g.exitPosition);
                  return (
                    <div
                      key={g.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '28px minmax(0, 1fr) 64px 72px',
                        gap: 8,
                        alignItems: 'center',
                        minHeight: 44,
                        borderTop: '1px solid var(--border-light)',
                      }}
                    >
                      <span
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          background: i === 0 ? '#15803d' : '#15191e',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        {i + 1}
                      </span>
                      <span style={{ fontSize: 14 }}>{g.label}</span>
                      <span className="mono" style={{ fontSize: 14, fontWeight: 600, color: i === 0 ? '#15803d' : undefined }}>
                        {i === 0 ? 'GREEN' : `+${g.intervalS} s`}
                      </span>
                      <span className="mono" style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'right' }}>
                        {formatDistance(distanceM, displayUnits.distance)}
                      </span>
                    </div>
                  );
                })}
              </section>
            )}
          </>
        )}

        <p className="legal-footer">
          方位はすべて磁方位（偏角 {declinationDeg >= 0 ? `${declinationDeg.toFixed(1)}°E` : `${Math.abs(declinationDeg).toFixed(1)}°W`}）。
          計算は予報に基づく推定です。最終判断は機上の目視（SPACE）とDZのルールに従ってください。
          Weather data by Open-Meteo.com ／ 地図：出典 国土地理院（地理院タイル）に計算結果を加筆
        </p>
      </main>
    </>
  );
}
