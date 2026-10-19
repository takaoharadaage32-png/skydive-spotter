// 入力・風データ・計算結果をつなぐ状態管理（spec.md 6.1・7.1）

import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchWindProfile } from '../api/openMeteo';
import { FALL_MODELS } from '../core/constants';
import { computeGroupExits, sortGroupsStandardOrder, type GroupExitResult } from '../core/groups';
import { getDeclination, magneticToTrue } from '../core/magnetic';
import { computeSpot, type SpotResult } from '../core/spot';
import { ktToMs } from '../core/units';
import { bearingDistanceToVector, vectorToWind } from '../core/vector';
import {
  checkForecastTimeMismatchWarning,
  checkLevelDiffWarning,
  checkLowGsWarning,
  type Warning,
} from '../core/warnings';
import { vectorAt } from '../core/windProfile';
import { loadSettings, saveSettings } from '../storage/settings';
import { loadWindProfile, saveWindProfile } from '../storage/windCache';
import {
  DEFAULT_DISPLAY_UNITS,
  defaultInputs,
  nextFullHourIso,
  type DisplayUnits,
  type Inputs,
  type WindState,
} from './types';

export function useSpotterState() {
  const stored = useMemo(() => loadSettings(), []);
  const [inputs, setInputsState] = useState<Inputs>(stored?.inputs ?? defaultInputs());
  const [displayUnits, setDisplayUnitsState] = useState<DisplayUnits>(
    stored?.displayUnits ?? DEFAULT_DISPLAY_UNITS,
  );
  const [wind, setWind] = useState<WindState>({ status: 'idle' });
  const [level, setLevel] = useState<1 | 2>(2);

  useEffect(() => {
    saveSettings(inputs, displayUnits);
  }, [inputs, displayUnits]);

  // 機上で電波が届かない場合に備え、起動時に端末保存済みの最新風データを復元する（spec.md 7章冒頭）
  useEffect(() => {
    let cancelled = false;
    void loadWindProfile().then((cached) => {
      if (cancelled || !cached) return;
      setWind((prev) => (prev.status === 'idle' ? { status: 'ready', ...cached, fromCache: true } : prev));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setInputs = useCallback((patch: Partial<Inputs> | ((prev: Inputs) => Partial<Inputs>)) => {
    setInputsState((prev) => ({ ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) }));
  }, []);

  const setDisplayUnits = useCallback((patch: Partial<DisplayUnits>) => {
    setDisplayUnitsState((prev) => ({ ...prev, ...patch }));
  }, []);

  const setGroups = useCallback(
    (updater: (prev: Inputs['groups']) => Inputs['groups']) => {
      setInputs((prev) => ({ groups: updater(prev.groups) }));
    },
    [setInputs],
  );

  const sortGroups = useCallback(() => {
    setGroups((groups) => sortGroupsStandardOrder(groups));
  }, [setGroups]);

  const fetchWind = useCallback(async () => {
    setWind({ status: 'loading' });
    try {
      let jumpTime = new Date(inputs.jumpTimeIso);
      if (Number.isNaN(jumpTime.getTime())) {
        // 日時欄が空・不正な値だと「最も近い時刻」の判定が壊れて先頭（0時）のデータを
        // 無言で返してしまうため、ここで検出して「今」に自己修復する（表示欄も直す）。
        const fallbackIso = nextFullHourIso();
        setInputs({ jumpTimeIso: fallbackIso });
        jumpTime = new Date(fallbackIso);
      }
      const profile = await fetchWindProfile({
        latitude: inputs.targetLat,
        longitude: inputs.targetLon,
        jumpTime,
        exitAltFt: inputs.exitAltFt,
        dzElevationM: inputs.dzElevationManual ? inputs.dzElevationM : undefined,
      });
      const fetchedAt = new Date();
      setWind({ status: 'ready', profile, fetchedAt, fromCache: false });
      void saveWindProfile(profile, fetchedAt);
      if (!inputs.dzElevationManual) {
        setInputs({ dzElevationM: profile.dzElevationM });
      }
    } catch (e) {
      setWind({ status: 'error', error: e instanceof Error ? e.message : String(e) });
    }
  }, [
    inputs.targetLat,
    inputs.targetLon,
    inputs.jumpTimeIso,
    inputs.exitAltFt,
    inputs.dzElevationManual,
    inputs.dzElevationM,
    setInputs,
  ]);

  const declinationDeg = useMemo(() => {
    try {
      if (!Number.isFinite(inputs.targetLat) || !Number.isFinite(inputs.targetLon)) return 0;
      return getDeclination(inputs.targetLat, inputs.targetLon, new Date(inputs.jumpTimeIso));
    } catch {
      return 0;
    }
  }, [inputs.targetLat, inputs.targetLon, inputs.jumpTimeIso]);

  const windTopFt = useMemo(() => {
    if (!wind.profile || wind.profile.layers.length === 0) return undefined;
    return Math.max(...wind.profile.layers.map((l) => l.altAglFt));
  }, [wind.profile]);

  const jumpRunIsAuto = inputs.jumpRunManualMagDeg === null;

  const jumpRunTrueBearingDeg = useMemo(() => {
    if (inputs.jumpRunManualMagDeg !== null) {
      return magneticToTrue(inputs.jumpRunManualMagDeg, declinationDeg);
    }
    if (wind.profile) {
      const windAtExit = vectorAt(wind.profile.layers, inputs.exitAltFt);
      return vectorToWind(windAtExit).dirDeg;
    }
    return 0;
  }, [inputs.jumpRunManualMagDeg, inputs.exitAltFt, declinationDeg, wind.profile]);

  const altitudesValid = inputs.openAltFt > 0 && inputs.exitAltFt > inputs.openAltFt;
  const canCompute =
    wind.status === 'ready' && windTopFt !== undefined && inputs.exitAltFt <= windTopFt && altitudesValid;

  const computeErrorMessage = useMemo(() => {
    if (wind.status !== 'ready') return '先に「風を取得」してください。';
    if (!altitudesValid) return 'オープン高度はExit高度より低くしてください。';
    if (windTopFt !== undefined && inputs.exitAltFt > windTopFt) {
      return `Exit高度 ${inputs.exitAltFt}ft が風データの範囲外です（最上点 ${windTopFt.toFixed(0)}ft）。再取得してください。`;
    }
    return undefined;
  }, [wind.status, altitudesValid, windTopFt, inputs.exitAltFt]);

  const spotResults = useMemo((): { level1?: SpotResult; level2?: SpotResult } => {
    if (!canCompute || !wind.profile) return {};
    const openPosition = inputs.openPositionManual
      ? bearingDistanceToVector(
          magneticToTrue(inputs.openPositionManual.bearingMagDeg, declinationDeg),
          inputs.openPositionManual.distanceM,
        )
      : undefined;
    const base = {
      layers: wind.profile.layers,
      fallModel: FALL_MODELS[inputs.fallModelKey],
      exitAltFt: inputs.exitAltFt,
      openAltFt: inputs.openAltFt,
      descentRateFtPerMin: inputs.descentRateFtPerMin,
      jumpRunTrueBearingDeg,
      tasMs: ktToMs(inputs.tasKt),
      openPosition,
    };
    return { level1: computeSpot(1, base), level2: computeSpot(2, base) };
  }, [
    canCompute,
    wind.profile,
    inputs.openPositionManual,
    inputs.fallModelKey,
    inputs.exitAltFt,
    inputs.openAltFt,
    inputs.descentRateFtPerMin,
    inputs.tasKt,
    jumpRunTrueBearingDeg,
    declinationDeg,
  ]);

  // 入力画面でのオープン位置の自動提案プレビュー（Level 2 基準）
  const openPositionAutoPreview = spotResults.level2?.openPosition;

  const selectedResult = level === 1 ? spotResults.level1 : spotResults.level2;

  // グループ間隔・Exitウィンドウ（spec 6.5）：選択中のLevelのExit地点・GSを使う
  const groupExits = useMemo((): GroupExitResult[] => {
    if (!selectedResult || inputs.groups.length === 0) return [];
    return computeGroupExits(inputs.groups, selectedResult.exitPosition, jumpRunTrueBearingDeg, selectedResult.groundSpeedMs);
  }, [selectedResult, inputs.groups, jumpRunTrueBearingDeg]);

  // 警告（spec 6.7）。Exit高度が範囲外の場合は computeErrorMessage 側で計算不可として扱う。
  const warnings = useMemo((): Warning[] => {
    const list: Warning[] = [];
    if (spotResults.level1 && spotResults.level2) {
      const w = checkLevelDiffWarning(spotResults.level1.exitPosition, spotResults.level2.exitPosition);
      if (w) list.push(w);
    }
    if (selectedResult) {
      const w = checkLowGsWarning(selectedResult.groundSpeedMs);
      if (w) list.push(w);
    }
    if (wind.profile) {
      const w = checkForecastTimeMismatchWarning(wind.profile.validTime, inputs.jumpTimeIso);
      if (w) list.push(w);
    }
    return list;
  }, [spotResults.level1, spotResults.level2, selectedResult, wind.profile, inputs.jumpTimeIso]);

  return {
    inputs,
    setInputs,
    displayUnits,
    setDisplayUnits,
    wind,
    fetchWind,
    declinationDeg,
    jumpRunTrueBearingDeg,
    jumpRunIsAuto,
    openPositionAutoPreview,
    level,
    setLevel,
    spotResults,
    computeErrorMessage,
    canCompute,
    setGroups,
    sortGroups,
    groupExits,
    warnings,
  };
}

export type SpotterState = ReturnType<typeof useSpotterState>;
