// グループ間隔とExitウィンドウ（spec.md 6.5）
//
// 先頭グループを計算上のExit地点 P_exit に置き、後続グループは
// 間隔（必要距離 ÷ GS、秒単位で切り上げ）× GS ずつジャンプラン方向へ並べる。

import { ftToM } from './units';
import { add, scale, unitVectorForBearing, type Vec2 } from './vector';
import { SEPARATION } from './constants';

export type Discipline =
  | 'movement1'
  | 'belly'
  | 'freefly'
  | 'movement2'
  | 'aff'
  | 'tandem'
  | 'highPull'
  | 'wingsuit';

// SIM 4-7 の標準Exit順
export const DISCIPLINE_LABELS: Record<Discipline, string> = {
  movement1: 'ムーブメント1',
  belly: 'ベリー',
  freefly: 'フリーフライ',
  movement2: 'ムーブメント2',
  aff: 'AFF',
  tandem: 'タンデム',
  highPull: 'ハイプル',
  wingsuit: 'ウイングスーツ',
};

const DISCIPLINE_RANK: Record<Discipline, number> = {
  movement1: 0,
  belly: 1,
  freefly: 2,
  movement2: 3,
  aff: 4,
  tandem: 5,
  highPull: 6,
  wingsuit: 7,
};

export interface GroupInput {
  id: string;
  label: string;
  headcount: number;
  discipline: Discipline;
}

/** 種目・人数から表示用ラベルを作る（例：「ベリー 4人」） */
export function groupLabel(discipline: Discipline, headcount: number): string {
  return `${DISCIPLINE_LABELS[discipline]} ${headcount}人`;
}

/** SIM 4-7 の標準順：種目の順（固定）、同種目内は人数の多い順に並べる */
export function sortGroupsStandardOrder(groups: GroupInput[]): GroupInput[] {
  return [...groups].sort((a, b) => {
    const rankDiff = DISCIPLINE_RANK[a.discipline] - DISCIPLINE_RANK[b.discipline];
    if (rankDiff !== 0) return rankDiff;
    return b.headcount - a.headcount;
  });
}

/** グループに必要なセパレーション距離（ft）。ソロ1,000ft、小グループ1,500ft、大グループはそれ以上。 */
export function requiredSeparationFt(headcount: number): number {
  if (headcount <= 1) return SEPARATION.soloFt;
  if (headcount <= SEPARATION.smallGroupMaxSize) return SEPARATION.smallGroupFt;
  return (
    SEPARATION.smallGroupFt + (headcount - SEPARATION.smallGroupMaxSize) * SEPARATION.extraFtPerPersonAboveSmall
  );
}

export interface GroupExitResult {
  id: string;
  label: string;
  headcount: number;
  /** 直前のグループからの間隔（秒）。先頭グループは0 */
  intervalS: number;
  exitPosition: Vec2;
}

/**
 * 先頭グループをP_exitに置き、後続グループをジャンプラン方向へ間隔分だけ並べる。
 * groups は既に並べたい順（Exit順）であることを前提とする。
 */
export function computeGroupExits(
  groups: GroupInput[],
  leadExitPosition: Vec2,
  jumpRunTrueBearingDeg: number,
  groundSpeedMs: number,
): GroupExitResult[] {
  const rHat = unitVectorForBearing(jumpRunTrueBearingDeg);
  const safeGs = Math.max(groundSpeedMs, 1); // GSが0以下だと間隔が発散するための下限（6.7の警告で別途知らせる）
  let cumulativeM = 0;

  return groups.map((g, i) => {
    let intervalS = 0;
    if (i > 0) {
      const requiredM = ftToM(requiredSeparationFt(g.headcount));
      intervalS = Math.ceil(requiredM / safeGs);
      cumulativeM += intervalS * safeGs;
    }
    return {
      id: g.id,
      label: g.label,
      headcount: g.headcount,
      intervalS,
      exitPosition: add(leadExitPosition, scale(rHat, cumulativeM)),
    };
  });
}
