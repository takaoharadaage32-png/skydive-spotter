import { FALL_MODELS } from '../core/constants';
import { DISCIPLINE_LABELS, groupLabel, type Discipline } from '../core/groups';
import { trueToMagnetic } from '../core/magnetic';
import { vectorToBearingDistance } from '../core/vector';
import { ftToM, mToFt } from '../core/units';
import type { SpotterState } from './useSpotterState';
import { newGroupId, type FallModelKey } from './types';

const FALL_MODEL_LABELS: { key: FallModelKey; short: string }[] = [
  { key: 'belly', short: 'ベリー' },
  { key: 'freefly', short: 'FF' },
  { key: 'studentAff', short: 'AFF' },
  { key: 'tandem', short: 'タンデム' },
];

const DISCIPLINE_OPTIONS: Discipline[] = [
  'movement1',
  'belly',
  'freefly',
  'movement2',
  'aff',
  'tandem',
  'highPull',
  'wingsuit',
];

interface Props {
  state: SpotterState;
  onGoToResult: () => void;
}

export default function InputScreen({ state, onGoToResult }: Props) {
  const { inputs, setInputs, displayUnits, setDisplayUnits, wind, fetchWind, declinationDeg, setGroups, sortGroups } =
    state;

  const altUnit = displayUnits.altitude;
  const toDisplayAlt = (ft: number) => (altUnit === 'm' ? Math.round(ftToM(ft)) : Math.round(ft));
  const fromDisplayAlt = (v: number) => (altUnit === 'm' ? mToFt(v) : v);

  const autoOpenMag =
    state.openPositionAutoPreview !== undefined
      ? {
          bearingMagDeg: trueToMagnetic(
            vectorToBearingDistance(state.openPositionAutoPreview).bearingDeg,
            declinationDeg,
          ),
          distanceM: vectorToBearingDistance(state.openPositionAutoPreview).distanceM,
        }
      : null;

  const autoJumpRunMagDeg = trueToMagnetic(state.jumpRunTrueBearingDeg, declinationDeg);

  return (
    <>
      <section className="card">
        <div className="card__title-row">
          <h2 className="card__title">ドロップゾーン</h2>
        </div>
        <div className="field-grid">
          <label className="field">
            ターゲット緯度
            <input
              type="number"
              step="0.0001"
              value={inputs.targetLat}
              onChange={(e) => {
                const v = e.target.valueAsNumber;
                if (!Number.isNaN(v)) setInputs({ targetLat: v });
              }}
            />
          </label>
          <label className="field">
            ターゲット経度
            <input
              type="number"
              step="0.0001"
              value={inputs.targetLon}
              onChange={(e) => {
                const v = e.target.valueAsNumber;
                if (!Number.isNaN(v)) setInputs({ targetLon: v });
              }}
            />
          </label>
        </div>
        <label className="field">
          DZ標高 (m MSL){inputs.dzElevationManual ? '（手動）' : '（open-meteoから自動）'}
          <input
            type="number"
            value={Math.round(inputs.dzElevationM)}
            onChange={(e) => {
              const v = e.target.valueAsNumber;
              if (!Number.isNaN(v)) setInputs({ dzElevationM: v, dzElevationManual: true });
            }}
          />
        </label>
      </section>

      <section className="card">
        <h2 className="card__title">高度と位置</h2>
        <div className="field-grid">
          <label className="field">
            Exit高度 ({altUnit === 'm' ? 'm' : 'ft'} AGL)
            <input
              className="field--big"
              type="number"
              value={toDisplayAlt(inputs.exitAltFt)}
              onChange={(e) => {
                const v = e.target.valueAsNumber;
                if (!Number.isNaN(v)) setInputs({ exitAltFt: fromDisplayAlt(v) });
              }}
            />
          </label>
          <label className="field">
            オープン高度 ({altUnit === 'm' ? 'm' : 'ft'} AGL)
            <input
              className="field--big"
              type="number"
              value={toDisplayAlt(inputs.openAltFt)}
              onChange={(e) => {
                const v = e.target.valueAsNumber;
                if (!Number.isNaN(v)) setInputs({ openAltFt: fromDisplayAlt(v) });
              }}
            />
          </label>
        </div>
        {(inputs.exitAltFt < 3000 || inputs.exitAltFt > 18000) && (
          <span className="warning-text">Exit高度は 3,000〜18,000 ft の範囲を想定しています。</span>
        )}
        {inputs.openAltFt >= inputs.exitAltFt && (
          <span className="warning-text">オープン高度はExit高度より低くしてください。</span>
        )}

        <div>
          <div className="row-label">
            <span>オープン位置（ターゲットから・磁方位）</span>
            <span className="row-label__badge">{inputs.openPositionManual ? '手動' : '自動提案'}</span>
          </div>
          <div className="value-row">
            {inputs.openPositionManual ? (
              <>
                <input
                  type="number"
                  value={Math.round(inputs.openPositionManual.bearingMagDeg)}
                  onChange={(e) => {
                    const v = e.target.valueAsNumber;
                    if (!Number.isNaN(v) && inputs.openPositionManual) {
                      setInputs({ openPositionManual: { ...inputs.openPositionManual, bearingMagDeg: v } });
                    }
                  }}
                />
                <span className="value-row__mono">°M</span>
                <input
                  type="number"
                  value={Math.round(inputs.openPositionManual.distanceM)}
                  onChange={(e) => {
                    const v = e.target.valueAsNumber;
                    if (!Number.isNaN(v) && inputs.openPositionManual) {
                      setInputs({ openPositionManual: { ...inputs.openPositionManual, distanceM: v } });
                    }
                  }}
                />
                <span className="value-row__mono">m</span>
                <button
                  type="button"
                  className="value-row__note"
                  onClick={() => setInputs({ openPositionManual: null })}
                >
                  自動に戻す
                </button>
              </>
            ) : (
              <>
                <span className="value-row__mono">
                  {autoOpenMag ? `${Math.round(autoOpenMag.bearingMagDeg)}°M` : '—'}
                </span>
                <span className="value-row__mono">{autoOpenMag ? `${Math.round(autoOpenMag.distanceM)} m` : '—'}</span>
                <button
                  type="button"
                  className="value-row__note"
                  onClick={() =>
                    setInputs({
                      openPositionManual: autoOpenMag ?? { bearingMagDeg: 0, distanceM: 0 },
                    })
                  }
                >
                  キャノピードリフトの逆方向・手動で編集
                </button>
              </>
            )}
          </div>
        </div>

        <div>
          <div className="row-label">
            <span>ジャンプラン方向（磁方位・偏角 {declinationDeg >= 0 ? `${declinationDeg.toFixed(1)}°E` : `${Math.abs(declinationDeg).toFixed(1)}°W`}）</span>
            <span className="row-label__badge">{state.jumpRunIsAuto ? '自動提案' : '手動'}</span>
          </div>
          <div className="value-row">
            {state.jumpRunIsAuto ? (
              <>
                <span className="value-row__mono">{Math.round(autoJumpRunMagDeg)}°M</span>
                <button
                  type="button"
                  className="value-row__note"
                  onClick={() => setInputs({ jumpRunManualMagDeg: Math.round(autoJumpRunMagDeg) })}
                >
                  Exit高度の風に正対・手動で編集
                </button>
              </>
            ) : (
              <>
                <input
                  type="number"
                  value={Math.round(inputs.jumpRunManualMagDeg ?? 0)}
                  onChange={(e) => {
                    const v = e.target.valueAsNumber;
                    if (!Number.isNaN(v)) setInputs({ jumpRunManualMagDeg: v });
                  }}
                />
                <span className="value-row__mono">°M</span>
                <button type="button" className="value-row__note" onClick={() => setInputs({ jumpRunManualMagDeg: null })}>
                  自動に戻す
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="card">
        <h2 className="card__title">種目と機体</h2>
        <div role="group" aria-label="種目" className="choice-grid">
          {FALL_MODEL_LABELS.map(({ key, short }) => (
            <button
              key={key}
              type="button"
              className={inputs.fallModelKey === key ? 'is-active' : ''}
              onClick={() => setInputs({ fallModelKey: key })}
            >
              {short}
            </button>
          ))}
        </div>
        <div className="field-grid">
          <label className="field">
            キャノピー降下率 (ft/分)
            <input
              type="number"
              value={inputs.descentRateFtPerMin}
              onChange={(e) => {
                const v = e.target.valueAsNumber;
                if (!Number.isNaN(v)) setInputs({ descentRateFtPerMin: v });
              }}
            />
          </label>
          <label className="field">
            ジャンプラン対気速度 (kt)
            <input
              type="number"
              value={inputs.tasKt}
              onChange={(e) => {
                const v = e.target.valueAsNumber;
                if (!Number.isNaN(v)) setInputs({ tasKt: v });
              }}
            />
          </label>
        </div>
        <span className="helper-text">{FALL_MODELS[inputs.fallModelKey].name} を使用</span>
      </section>

      <section className="card">
        <div className="card__title-row">
          <h2 className="card__title">グループ構成</h2>
          <button type="button" className="pill-button" onClick={sortGroups}>
            標準順に並べ替え
          </button>
        </div>
        {inputs.groups.map((g, i) => (
          <div
            key={g.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '28px minmax(0,1fr) 72px 88px auto',
              gap: 8,
              alignItems: 'center',
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
            <select
              value={g.discipline}
              onChange={(e) =>
                setGroups((groups) =>
                  groups.map((x) =>
                    x.id === g.id
                      ? { ...x, discipline: e.target.value as Discipline, label: groupLabel(e.target.value as Discipline, x.headcount) }
                      : x,
                  ),
                )
              }
              style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '6px 4px', fontSize: 13 }}
            >
              {DISCIPLINE_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {DISCIPLINE_LABELS[d]}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              value={g.headcount}
              onChange={(e) => {
                const v = e.target.valueAsNumber;
                if (!Number.isNaN(v) && v >= 1) {
                  setGroups((groups) =>
                    groups.map((x) => (x.id === g.id ? { ...x, headcount: v, label: groupLabel(x.discipline, v) } : x)),
                  );
                }
              }}
              style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '6px 4px', fontSize: 13, width: '100%' }}
            />
            <div style={{ display: 'flex', gap: 2 }}>
              <button
                type="button"
                aria-label="上へ"
                disabled={i === 0}
                onClick={() =>
                  setGroups((groups) => {
                    const next = [...groups];
                    [next[i - 1], next[i]] = [next[i], next[i - 1]];
                    return next;
                  })
                }
                style={{ border: 'none', background: 'none', opacity: i === 0 ? 0.3 : 1 }}
              >
                ↑
              </button>
              <button
                type="button"
                aria-label="下へ"
                disabled={i === inputs.groups.length - 1}
                onClick={() =>
                  setGroups((groups) => {
                    const next = [...groups];
                    [next[i], next[i + 1]] = [next[i + 1], next[i]];
                    return next;
                  })
                }
                style={{ border: 'none', background: 'none', opacity: i === inputs.groups.length - 1 ? 0.3 : 1 }}
              >
                ↓
              </button>
            </div>
            <button
              type="button"
              aria-label="削除"
              disabled={inputs.groups.length <= 1}
              onClick={() => setGroups((groups) => groups.filter((x) => x.id !== g.id))}
              style={{ border: 'none', background: 'none', color: '#b91c1c', opacity: inputs.groups.length <= 1 ? 0.3 : 1 }}
            >
              ×
            </button>
            {g.discipline === 'tandem' && (
              <span className="helper-text" style={{ gridColumn: '2 / -1' }}>
                タンデムは人数に関わらずソロ（1,000ft）扱いで間隔を計算します
              </span>
            )}
          </div>
        ))}
        <button
          type="button"
          className="pill-button"
          onClick={() =>
            setGroups((groups) => [
              ...groups,
              { id: newGroupId(), label: groupLabel('belly', 4), headcount: 4, discipline: 'belly' },
            ])
          }
        >
          + グループを追加
        </button>
        <span className="helper-text">Exit順は上から。先頭グループ＝グリーンライト点</span>
      </section>

      <section className="card">
        <h2 className="card__title">表示単位</h2>
        <div className="unit-grid">
          <span>高度</span>
          <div role="group" aria-label="高度の単位" className="segmented segmented--grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            <button className={altUnit === 'ft' ? 'is-active' : ''} onClick={() => setDisplayUnits({ altitude: 'ft' })}>ft</button>
            <button className={altUnit === 'm' ? 'is-active' : ''} onClick={() => setDisplayUnits({ altitude: 'm' })}>m</button>
          </div>
          <span>距離</span>
          <div role="group" aria-label="距離の単位" className="segmented segmented--grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            <button className={displayUnits.distance === 'm' ? 'is-active' : ''} onClick={() => setDisplayUnits({ distance: 'm' })}>m</button>
            <button className={displayUnits.distance === 'mile' ? 'is-active' : ''} onClick={() => setDisplayUnits({ distance: 'mile' })}>マイル</button>
          </div>
          <span>風速</span>
          <div role="group" aria-label="風速の単位" className="segmented segmented--grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            <button className={displayUnits.speed === 'kt' ? 'is-active' : ''} onClick={() => setDisplayUnits({ speed: 'kt' })}>kt</button>
            <button className={displayUnits.speed === 'ms' ? 'is-active' : ''} onClick={() => setDisplayUnits({ speed: 'ms' })}>m/s</button>
          </div>
        </div>
        <span className="helper-text">方位は磁方位で表示（偏角はWMMで自動計算）</span>
      </section>

      <section className="card">
        <div className="card__title-row">
          <h2 className="card__title">上空の風</h2>
          <label className="helper-text">
            ジャンプ予定時刻{' '}
            <input
              type="datetime-local"
              value={inputs.jumpTimeIso}
              onChange={(e) => setInputs({ jumpTimeIso: e.target.value })}
              style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '4px 6px' }}
            />
          </label>
        </div>
        <div className="status-row">
          <span
            className={`status-dot ${
              wind.status === 'ready' && !wind.fromCache
                ? 'status-dot--ok'
                : wind.status === 'error'
                  ? 'status-dot--error'
                  : 'status-dot--idle'
            }`}
            aria-hidden="true"
          />
          <span>
            {wind.status === 'idle' && '未取得'}
            {wind.status === 'loading' && '取得中…'}
            {wind.status === 'ready' &&
              wind.fetchedAt &&
              (wind.fromCache
                ? `端末保存データ（オフライン）· ${wind.fetchedAt.toLocaleString('ja-JP')} 取得`
                : `open-meteo · ${wind.fetchedAt.toLocaleTimeString('ja-JP')} 取得`)}
            {wind.status === 'error' && `取得失敗：${wind.error}`}
          </span>
        </div>
        <button type="button" className="btn-outline" onClick={() => void fetchWind()} disabled={wind.status === 'loading'}>
          {wind.status === 'ready' ? '風を再取得' : '風を取得'}
        </button>
      </section>

      <div className="cta-area">
        <button type="button" className="btn-primary" onClick={onGoToResult}>
          計算する
        </button>
      </div>
    </>
  );
}
