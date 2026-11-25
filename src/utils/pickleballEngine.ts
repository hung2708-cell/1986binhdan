import {
  TEAM_EVENT_SUBCATEGORIES,
  type Match,
  type Registration,
  type ScoringMode,
  type StandingRow,
  type TeamLineupSlot,
} from '../types/tournament';

export interface ScoreSnapshot {
  scoreA: number;
  scoreB: number;
  servingTeam: 'A' | 'B';
  serverNumber: 1 | 2;
  timeoutsA: number;
  timeoutsB: number;
  sideSwitched: boolean;
}

export interface ScoreActionResult {
  scoreA: number;
  scoreB: number;
  servingTeam: 'A' | 'B';
  serverNumber: 1 | 2;
  sideSwitched: boolean;
  historyEntry: string;
  isGamePoint: boolean;
  winnerSide: '' | 'A' | 'B';
}

export function isTeamDivision(divisionName: string, competitionType?: 'doubles' | 'team'): boolean {
  if (competitionType === 'team') return true;
  if (competitionType === 'doubles') return false;
  return divisionName.toLowerCase().includes('đồng đội');
}

export function formatScoreCallout(
  match: Pick<Match, 'scoreA' | 'scoreB' | 'servingTeam' | 'serverNumber' | 'scoringMode'>,
): string {
  if (match.scoringMode === 'rally') {
    return `${match.scoreA} - ${match.scoreB}`;
  }
  const serverScore = match.servingTeam === 'A' ? match.scoreA : match.scoreB;
  const receiverScore = match.servingTeam === 'A' ? match.scoreB : match.scoreA;
  return `${serverScore} - ${receiverScore} - ${match.serverNumber}`;
}

/**
 * Checks win condition according to Charter 494/QĐTDTTVN:
 * - Group stage: First to 15 points (8 points switch sides).
 * - Knockout stage: First to 15 points (8 points switch sides); if 14-14, win by 2 points, max 18 points.
 * - Knockout 2-2 Singles Decider: 21 points rally scoring (11 points switch sides).
 */
export function checkWinCondition(
  scoreA: number,
  scoreB: number,
  pointsToWin: number,
  winByTwo: boolean,
  maxPointsCap?: number,
): '' | 'A' | 'B' {
  const cap = maxPointsCap && maxPointsCap >= pointsToWin ? maxPointsCap : undefined;
  if (cap) {
    if (scoreA >= cap && scoreA > scoreB) return 'A';
    if (scoreB >= cap && scoreB > scoreA) return 'B';
  }
  const diff = Math.abs(scoreA - scoreB);
  const minDiff = winByTwo ? 2 : 1;
  if (scoreA >= pointsToWin && scoreA > scoreB && diff >= minDiff) return 'A';
  if (scoreB >= pointsToWin && scoreB > scoreA && diff >= minDiff) return 'B';
  return '';
}

export function createDefaultTeamLineupSlots(
  teamAPlayers: string[] = [],
  teamBPlayers: string[] = [],
): TeamLineupSlot[] {
  const a1 = teamAPlayers[0] || 'VĐV Nữ A1';
  const a2 = teamAPlayers[1] || 'VĐV Nữ A2';
  const a3 = teamAPlayers[2] || 'VĐV Nam A1';
  const a4 = teamAPlayers[3] || 'VĐV Nam A2';

  const b1 = teamBPlayers[0] || 'VĐV Nữ B1';
  const b2 = teamBPlayers[1] || 'VĐV Nữ B2';
  const b3 = teamBPlayers[2] || 'VĐV Nam B1';
  const b4 = teamBPlayers[3] || 'VĐV Nam B2';

  return [
    {
      order: 1,
      label: TEAM_EVENT_SUBCATEGORIES[0], // Trận 1: Đôi Nữ
      teamAPlayer1: a1,
      teamAPlayer2: a2,
      teamBPlayer1: b1,
      teamBPlayer2: b2,
      scoreA: 0,
      scoreB: 0,
      completed: false,
      winnerSide: '',
    },
    {
      order: 2,
      label: TEAM_EVENT_SUBCATEGORIES[1], // Trận 2: Đôi Nam
      teamAPlayer1: a3,
      teamAPlayer2: a4,
      teamBPlayer1: b3,
      teamBPlayer2: b4,
      scoreA: 0,
      scoreB: 0,
      completed: false,
      winnerSide: '',
    },
    {
      order: 3,
      label: TEAM_EVENT_SUBCATEGORIES[2], // Trận 3: Đôi Nam Nữ 1
      teamAPlayer1: a3,
      teamAPlayer2: a1,
      teamBPlayer1: b3,
      teamBPlayer2: b1,
      scoreA: 0,
      scoreB: 0,
      completed: false,
      winnerSide: '',
    },
    {
      order: 4,
      label: TEAM_EVENT_SUBCATEGORIES[3], // Trận 4: Đôi Nam Nữ 2
      teamAPlayer1: a4,
      teamAPlayer2: a2,
      teamBPlayer1: b4,
      teamBPlayer2: b2,
      scoreA: 0,
      scoreB: 0,
      completed: false,
      winnerSide: '',
    },
    {
      order: 5,
      label: TEAM_EVENT_SUBCATEGORIES[4], // Trận 5: Đơn Quyết Định 21đ (Khi hòa 2-2 ở Knockout)
      teamAPlayer1: a3,
      teamAPlayer2: a1,
      teamBPlayer1: b3,
      teamBPlayer2: b1,
      scoreA: 0,
      scoreB: 0,
      completed: false,
      winnerSide: '',
    },
  ];
}

/**
 * Validates the Charter rule: "(Mỗi VĐV được đăng ký tối đa không quá 02 trận)" across the 4 doubles matches.
 */
export function validateAthleteMaxTwoMatches(slots: TeamLineupSlot[]): {
  countsA: Record<string, number>;
  countsB: Record<string, number>;
  violations: string[];
} {
  const countsA: Record<string, number> = {};
  const countsB: Record<string, number> = {};
  const doublesSlots = slots.filter((s) => s.order <= 4);

  for (const s of doublesSlots) {
    [s.teamAPlayer1, s.teamAPlayer2].filter(Boolean).forEach((name) => {
      countsA[name] = (countsA[name] || 0) + 1;
    });
    [s.teamBPlayer1, s.teamBPlayer2].filter(Boolean).forEach((name) => {
      countsB[name] = (countsB[name] || 0) + 1;
    });
  }

  const violations: string[] = [];
  Object.entries(countsA).forEach(([name, count]) => {
    if (count > 2) {
      violations.push(`Đội A: VĐV "${name}" đang đăng ký ${count} trận (Điều lệ tối đa 02 trận).`);
    }
  });
  Object.entries(countsB).forEach(([name, count]) => {
    if (count > 2) {
      violations.push(`Đội B: VĐV "${name}" đang đăng ký ${count} trận (Điều lệ tối đa 02 trận).`);
    }
  });

  return { countsA, countsB, violations };
}

export function encodeHistoryEntry(action: string, prev: ScoreSnapshot): string {
  return `${action}|${prev.scoreA}:${prev.scoreB}:${prev.servingTeam}:${prev.serverNumber}:${prev.timeoutsA}:${prev.timeoutsB}:${prev.sideSwitched ? 1 : 0}`;
}

export function decodeHistoryEntry(entry: string): { action: string; prev: ScoreSnapshot } | null {
  const [action, raw] = entry.split('|');
  if (!action || !raw) return null;
  const parts = raw.split(':');
  if (parts.length < 7) return null;
  return {
    action,
    prev: {
      scoreA: Number(parts[0]) || 0,
      scoreB: Number(parts[1]) || 0,
      servingTeam: parts[2] === 'B' ? 'B' : 'A',
      serverNumber: parts[3] === '2' ? 2 : 1,
      timeoutsA: Number(parts[4]) || 0,
      timeoutsB: Number(parts[5]) || 0,
      sideSwitched: parts[6] === '1',
    },
  };
}

/**
 * Computes next state when a side wins a rally or scores directly.
 */
export function applyRallyOutcome(
  match: Match,
  rallyWinner: 'A' | 'B',
): ScoreActionResult {
  const prev: ScoreSnapshot = {
    scoreA: match.scoreA,
    scoreB: match.scoreB,
    servingTeam: match.servingTeam,
    serverNumber: match.serverNumber,
    timeoutsA: match.timeoutsA,
    timeoutsB: match.timeoutsB,
    sideSwitched: match.sideSwitched,
  };

  let scoreA = match.scoreA;
  let scoreB = match.scoreB;
  let servingTeam: 'A' | 'B' = match.servingTeam;
  let serverNumber: 1 | 2 = match.serverNumber;
  let actionLabel = '';

  if (match.scoringMode === 'rally') {
    if (rallyWinner === 'A') {
      scoreA += 1;
      servingTeam = 'A';
      actionLabel = `A+1 (${scoreA}-${scoreB})`;
    } else {
      scoreB += 1;
      servingTeam = 'B';
      actionLabel = `B+1 (${scoreA}-${scoreB})`;
    }
    serverNumber = 1;
  } else {
    // Traditional Pickleball Side-Out Scoring
    if (rallyWinner === match.servingTeam) {
      if (rallyWinner === 'A') {
        scoreA += 1;
        actionLabel = `A+1 (${scoreA}-${scoreB}-${serverNumber})`;
      } else {
        scoreB += 1;
        actionLabel = `B+1 (${scoreB}-${scoreA}-${serverNumber})`;
      }
    } else {
      if (match.serverNumber === 1) {
        serverNumber = 2;
        actionLabel = `Chuyển Giao 2 (${servingTeam})`;
      } else {
        servingTeam = match.servingTeam === 'A' ? 'B' : 'A';
        serverNumber = 1;
        actionLabel = `Đổi giao bóng → Đội ${servingTeam}`;
      }
    }
  }

  // Charter rule: 15 points -> 8 points switch side; 21 points -> 11 points switch side
  const switchPoint = Math.ceil(match.pointsToWin / 2);
  const shouldSwitchNow =
    !match.sideSwitched && (scoreA === switchPoint || scoreB === switchPoint);

  const maxCap =
    match.maxPointsCap || (match.stage !== 'group' && match.pointsToWin === 15 ? 18 : undefined);

  const winnerSide = checkWinCondition(
    scoreA,
    scoreB,
    match.pointsToWin,
    match.stage !== 'group' ? true : match.winByTwo,
    maxCap,
  );
  const isGamePoint =
    !winnerSide &&
    ((scoreA >= match.pointsToWin - 1 && scoreA >= scoreB) ||
      (scoreB >= match.pointsToWin - 1 && scoreB >= scoreA));

  return {
    scoreA,
    scoreB,
    servingTeam,
    serverNumber,
    sideSwitched: match.sideSwitched || shouldSwitchNow,
    historyEntry: encodeHistoryEntry(actionLabel, prev),
    isGamePoint,
    winnerSide,
  };
}

export function applyDirectPoint(match: Match, team: 'A' | 'B'): ScoreActionResult {
  const prev: ScoreSnapshot = {
    scoreA: match.scoreA,
    scoreB: match.scoreB,
    servingTeam: match.servingTeam,
    serverNumber: match.serverNumber,
    timeoutsA: match.timeoutsA,
    timeoutsB: match.timeoutsB,
    sideSwitched: match.sideSwitched,
  };

  const scoreA = team === 'A' ? Math.min(50, match.scoreA + 1) : match.scoreA;
  const scoreB = team === 'B' ? Math.min(50, match.scoreB + 1) : match.scoreB;
  const switchPoint = Math.ceil(match.pointsToWin / 2);
  const sideSwitched =
    match.sideSwitched || scoreA === switchPoint || scoreB === switchPoint;
  const maxCap =
    match.maxPointsCap || (match.stage !== 'group' && match.pointsToWin === 15 ? 18 : undefined);
  const winnerSide = checkWinCondition(
    scoreA,
    scoreB,
    match.pointsToWin,
    match.stage !== 'group' ? true : match.winByTwo,
    maxCap,
  );
  const isGamePoint =
    !winnerSide &&
    ((scoreA >= match.pointsToWin - 1 && scoreA >= scoreB) ||
      (scoreB >= match.pointsToWin - 1 && scoreB >= scoreA));

  return {
    scoreA,
    scoreB,
    servingTeam: team,
    serverNumber: match.serverNumber,
    sideSwitched,
    historyEntry: encodeHistoryEntry(`${team}+1 (${scoreA}-${scoreB})`, prev),
    isGamePoint,
    winnerSide,
  };
}

/**
 * Computes real-time group standings strictly following Charter Section 2 (Cách tính điểm):
 * - Thắng trận: 03 điểm
 * - Hòa trận: 02 điểm (2-2 sau 4 trận đôi ở vòng bảng đồng đội)
 * - Thua trận: 01 điểm
 * - Bỏ cuộc: 0 điểm (Đôi bỏ cuộc tính 15-0; Đồng đội bỏ cuộc tính 4-0 tương ứng các tỷ số 15-0)
 * - Xếp hạng khi bằng điểm:
 *   + 02 đội bằng điểm: Đội nào thắng trong trận đối đầu trực tiếp xếp trên.
 *   + Từ 03 đội trở lên bằng điểm (chỉ tính kết quả trực tiếp giữa các đội bằng điểm):
 *     1. Hiệu số hiệp thắng - hiệp thua
 *     2. Hiệu số điểm thắng - điểm thua
 *     3. Nếu ở bất kỳ chỉ số phụ nào chỉ còn lại 2 đội bằng nhau thì xét đối đầu trực tiếp giữa 2 đội đó.
 */
export function computeGroupStandings(
  registrations: Registration[],
  matches: Match[],
  division?: string,
): Record<string, StandingRow[]> {
  const filteredRegs = registrations.filter(
    (r) => (!division || r.division === division) && r.groupName,
  );
  const groupMap: Record<string, Record<string, StandingRow>> = {};

  for (const reg of filteredRegs) {
    if (!groupMap[reg.groupName]) {
      groupMap[reg.groupName] = {};
    }
    groupMap[reg.groupName][reg.id] = {
      teamId: reg.id,
      teamName: reg.teamName,
      club: reg.club,
      groupName: reg.groupName,
      division: reg.division,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      forfeits: 0,
      gamesWon: 0,
      gamesLost: 0,
      gameDiff: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      pointDiff: 0,
      rankPoints: 0,
      qualified: false,
    };
  }

  const groupMatches = matches.filter(
    (m) =>
      m.stage === 'group' &&
      m.status === 'completed' &&
      (!division || m.division === division),
  );

  // Track head-to-head winner between any two teams
  const h2h = new Map<string, string>();

  const recordMatchStats = (
    m: Match,
    rowA: StandingRow,
    rowB: StandingRow,
    updateH2H = true,
  ) => {
    const isTeamMatch = isTeamDivision(m.division, m.competitionType);
    const completedSlots = (m.teamLineupSlots || []).filter((s) => s.completed && s.order <= 4);

    rowA.played += 1;
    rowB.played += 1;

    if (m.forfeitSide === 'A') {
      // Đội A bỏ cuộc: A được 0 điểm, B thắng 15-0 (hoặc 4-0 tương ứng 4x15-0)
      rowA.forfeits += 1;
      rowA.losses += 1;
      rowB.wins += 1;
      rowB.rankPoints += 3; // Thắng 03 điểm, bỏ cuộc 0 điểm
      const forfeitGames = isTeamMatch ? 4 : 1;
      const forfeitPts = isTeamMatch ? 60 : 15;
      rowB.gamesWon += forfeitGames;
      rowA.gamesLost += forfeitGames;
      rowB.pointsFor += forfeitPts;
      rowA.pointsAgainst += forfeitPts;
      if (updateH2H) {
        h2h.set(`${m.teamAId}__${m.teamBId}`, m.teamBId);
        h2h.set(`${m.teamBId}__${m.teamAId}`, m.teamBId);
      }
    } else if (m.forfeitSide === 'B') {
      // Đội B bỏ cuộc: B được 0 điểm, A thắng 15-0 (hoặc 4-0 tương ứng 4x15-0)
      rowB.forfeits += 1;
      rowB.losses += 1;
      rowA.wins += 1;
      rowA.rankPoints += 3;
      const forfeitGames = isTeamMatch ? 4 : 1;
      const forfeitPts = isTeamMatch ? 60 : 15;
      rowA.gamesWon += forfeitGames;
      rowB.gamesLost += forfeitGames;
      rowA.pointsFor += forfeitPts;
      rowB.pointsAgainst += forfeitPts;
      if (updateH2H) {
        h2h.set(`${m.teamAId}__${m.teamBId}`, m.teamAId);
        h2h.set(`${m.teamBId}__${m.teamAId}`, m.teamAId);
      }
    } else if (isTeamMatch && completedSlots.length > 0) {
      let gA = 0;
      let gB = 0;
      let pA = 0;
      let pB = 0;
      for (const s of completedSlots) {
        pA += s.scoreA;
        pB += s.scoreB;
        if (s.winnerSide === 'A' || s.scoreA > s.scoreB) gA += 1;
        else if (s.winnerSide === 'B' || s.scoreB > s.scoreA) gB += 1;
      }
      rowA.gamesWon += gA;
      rowA.gamesLost += gB;
      rowB.gamesWon += gB;
      rowB.gamesLost += gA;
      rowA.pointsFor += pA;
      rowA.pointsAgainst += pB;
      rowB.pointsFor += pB;
      rowB.pointsAgainst += pA;

      if (gA > gB) {
        rowA.wins += 1;
        rowA.rankPoints += 3;
        rowB.losses += 1;
        rowB.rankPoints += 1;
        if (updateH2H) {
          h2h.set(`${m.teamAId}__${m.teamBId}`, m.teamAId);
          h2h.set(`${m.teamBId}__${m.teamAId}`, m.teamAId);
        }
      } else if (gB > gA) {
        rowB.wins += 1;
        rowB.rankPoints += 3;
        rowA.losses += 1;
        rowA.rankPoints += 1;
        if (updateH2H) {
          h2h.set(`${m.teamAId}__${m.teamBId}`, m.teamBId);
          h2h.set(`${m.teamBId}__${m.teamAId}`, m.teamBId);
        }
      } else {
        // Hòa 2-2 ở vòng bảng đồng đội: mỗi đội được 02 điểm
        rowA.draws += 1;
        rowB.draws += 1;
        rowA.rankPoints += 2;
        rowB.rankPoints += 2;
      }
    } else {
      // Standard Doubles match or single-score team match
      const gA =
        m.teamGamesWonA !== undefined
          ? m.teamGamesWonA
          : m.winnerSide === 'A' || m.scoreA > m.scoreB
          ? 1
          : 0;
      const gB =
        m.teamGamesWonB !== undefined
          ? m.teamGamesWonB
          : m.winnerSide === 'B' || m.scoreB > m.scoreA
          ? 1
          : 0;

      rowA.gamesWon += gA;
      rowA.gamesLost += gB;
      rowB.gamesWon += gB;
      rowB.gamesLost += gA;

      rowA.pointsFor += m.scoreA;
      rowA.pointsAgainst += m.scoreB;
      rowB.pointsFor += m.scoreB;
      rowB.pointsAgainst += m.scoreA;

      if (m.winnerSide === 'A' || (m.winnerSide === '' && m.scoreA > m.scoreB)) {
        rowA.wins += 1;
        rowA.rankPoints += 3; // Thắng 03 điểm
        rowB.losses += 1;
        rowB.rankPoints += 1; // Thua 01 điểm
        if (updateH2H) {
          h2h.set(`${m.teamAId}__${m.teamBId}`, m.teamAId);
          h2h.set(`${m.teamBId}__${m.teamAId}`, m.teamAId);
        }
      } else if (m.winnerSide === 'B' || (m.winnerSide === '' && m.scoreB > m.scoreA)) {
        rowB.wins += 1;
        rowB.rankPoints += 3; // Thắng 03 điểm
        rowA.losses += 1;
        rowA.rankPoints += 1; // Thua 01 điểm
        if (updateH2H) {
          h2h.set(`${m.teamAId}__${m.teamBId}`, m.teamBId);
          h2h.set(`${m.teamBId}__${m.teamAId}`, m.teamBId);
        }
      } else {
        // Hòa: 02 điểm
        rowA.draws += 1;
        rowB.draws += 1;
        rowA.rankPoints += 2;
        rowB.rankPoints += 2;
      }
    }

    rowA.gameDiff = rowA.gamesWon - rowA.gamesLost;
    rowB.gameDiff = rowB.gamesWon - rowB.gamesLost;
    rowA.pointDiff = rowA.pointsFor - rowA.pointsAgainst;
    rowB.pointDiff = rowB.pointsFor - rowB.pointsAgainst;
  };

  for (const m of groupMatches) {
    const groupRows = groupMap[m.groupName];
    if (!groupRows) continue;
    const rowA = groupRows[m.teamAId];
    const rowB = groupRows[m.teamBId];
    if (!rowA || !rowB) continue;
    recordMatchStats(m, rowA, rowB, true);
  }

  const compareTwoByH2H = (a: StandingRow, b: StandingRow): number => {
    const winner = h2h.get(`${a.teamId}__${b.teamId}`);
    if (winner === a.teamId) return -1;
    if (winner === b.teamId) return 1;
    if (b.gameDiff !== a.gameDiff) return b.gameDiff - a.gameDiff;
    if (b.pointDiff !== a.pointDiff) return b.pointDiff - a.pointDiff;
    if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
    return a.teamName.localeCompare(b.teamName, 'vi');
  };

  const sortedByGroup: Record<string, StandingRow[]> = {};
  const groupKeys = Object.keys(groupMap).sort();

  for (const gKey of groupKeys) {
    const allRows = Object.values(groupMap[gKey]);
    // Group teams by rankPoints to apply exact 2-team vs 3+-team tie-breaker from the Charter
    const pointsBuckets = new Map<number, StandingRow[]>();
    allRows.forEach((r) => {
      const list = pointsBuckets.get(r.rankPoints) || [];
      list.push(r);
      pointsBuckets.set(r.rankPoints, list);
    });

    const sortedPoints = Array.from(pointsBuckets.keys()).sort((a, b) => b - a);
    const finalGroupOrder: StandingRow[] = [];

    for (const pts of sortedPoints) {
      const bucket = pointsBuckets.get(pts) || [];
      if (bucket.length === 1) {
        finalGroupOrder.push(bucket[0]);
      } else if (bucket.length === 2) {
        // Trường hợp 02 đội bằng điểm: Đội nào thắng trong trận đối đầu trực tiếp xếp hạng trên
        bucket.sort(compareTwoByH2H);
        finalGroupOrder.push(...bucket);
      } else {
        // Trường hợp từ 03 đội trở lên bằng điểm: Chỉ tính kết quả trực tiếp giữa các đội bằng điểm
        const tiedIds = new Set(bucket.map((r) => r.teamId));
        const miniStats: Record<string, { gameDiff: number; pointDiff: number }> = {};
        bucket.forEach((r) => {
          miniStats[r.teamId] = { gameDiff: 0, pointDiff: 0 };
        });

        for (const m of groupMatches) {
          if (m.groupName === gKey && tiedIds.has(m.teamAId) && tiedIds.has(m.teamBId)) {
            const tempA: StandingRow = { ...bucket[0], played: 0, wins: 0, draws: 0, losses: 0, forfeits: 0, gamesWon: 0, gamesLost: 0, gameDiff: 0, pointsFor: 0, pointsAgainst: 0, pointDiff: 0, rankPoints: 0 };
            const tempB: StandingRow = { ...tempA };
            recordMatchStats(m, tempA, tempB, false);
            miniStats[m.teamAId].gameDiff += tempA.gameDiff;
            miniStats[m.teamBId].gameDiff += tempB.gameDiff;
            miniStats[m.teamAId].pointDiff += tempA.pointDiff;
            miniStats[m.teamBId].pointDiff += tempB.pointDiff;
          }
        }

        bucket.sort((a, b) => {
          const mA = miniStats[a.teamId];
          const mB = miniStats[b.teamId];
          // 1. Hiệu số hiệp thắng - hiệp thua giữa các đội bằng điểm
          if (mB.gameDiff !== mA.gameDiff) return mB.gameDiff - mA.gameDiff;
          // 2. Hiệu số điểm thắng - điểm thua giữa các đội bằng điểm
          if (mB.pointDiff !== mA.pointDiff) return mB.pointDiff - mA.pointDiff;
          // Nếu chỉ còn 2 đội bằng nhau sau chỉ số phụ -> Xét đối đầu trực tiếp
          return compareTwoByH2H(a, b);
        });
        finalGroupOrder.push(...bucket);
      }
    }

    finalGroupOrder.forEach((row, idx) => {
      row.qualified = idx < 2;
    });
    sortedByGroup[gKey] = finalGroupOrder;
  }

  return sortedByGroup;
}

export interface GeneratedMatchDraft {
  id: string;
  division: string;
  competitionType: 'doubles' | 'team';
  stage: Match['stage'];
  roundOrder: number;
  matchNumber: number;
  groupName: string;
  bracketSlot: string;
  nextMatchId: string;
  nextMatchSide: '' | 'A' | 'B';
  teamAId: string;
  teamAName: string;
  teamBId: string;
  teamBName: string;
  courtNumber: number;
  scheduledTime: string;
  scoringMode: ScoringMode;
  pointsToWin: number;
  maxPointsCap?: number;
  winByTwo: boolean;
}

function addMinutesToTime(baseHour: number, baseMin: number, addMins: number): string {
  const total = baseHour * 60 + baseMin + addMins;
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * Snake-seeds teams by combinedRating into balanced groups,
 * generates Round-Robin group fixtures (touch 15, switch at 8),
 * and links Knockout Semifinals + Final + 3rd place (touch 15, switch at 8, win by 2 at 14-14, max 18).
 */
export function buildGroupAndKnockoutSchedule(params: {
  tournamentId: string;
  division: string;
  competitionType?: 'doubles' | 'team';
  teams: Registration[];
  courtsCount: number;
  scoringMode: ScoringMode;
  pointsToWin: number;
  winByTwo: boolean;
  includeKnockout: boolean;
  startMatchNumber?: number;
}): {
  groupAssignments: Array<{ registrationId: string; groupName: string; seed: number }>;
  matches: GeneratedMatchDraft[];
} {
  const {
    division,
    competitionType,
    teams,
    courtsCount,
    scoringMode,
    pointsToWin,
    includeKnockout,
    startMatchNumber = 1,
  } = params;

  const resolvedCompType: 'doubles' | 'team' = isTeamDivision(division, competitionType)
    ? 'team'
    : 'doubles';

  const sorted = [...teams].sort((a, b) => b.combinedRating - a.combinedRating);
  const numGroups = sorted.length >= 12 ? 4 : sorted.length >= 6 ? 2 : 1;
  const groupLetters = ['A', 'B', 'C', 'D'].slice(0, numGroups);
  const groups: Record<string, Registration[]> = {};
  groupLetters.forEach((l) => {
    groups[`Bảng ${l}`] = [];
  });

  const groupAssignments: Array<{ registrationId: string; groupName: string; seed: number }> = [];

  sorted.forEach((team, idx) => {
    const round = Math.floor(idx / numGroups);
    const pos = idx % numGroups;
    const gIdx = round % 2 === 0 ? pos : numGroups - 1 - pos;
    const groupName = `Bảng ${groupLetters[gIdx]}`;
    groups[groupName].push(team);
    groupAssignments.push({
      registrationId: team.id,
      groupName,
      seed: idx + 1,
    });
  });

  const slug =
    division
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 12)
      .toLowerCase() || 'div';
  const ts = Date.now().toString(36).slice(-4);

  const matches: GeneratedMatchDraft[] = [];
  let matchNo = startMatchNumber;
  let slotIndex = 0;

  const groupFixtures: Array<Array<[Registration, Registration, string]>> = [];
  for (const gName of Object.keys(groups)) {
    const gTeams = groups[gName];
    const pairs: Array<[Registration, Registration, string]> = [];
    for (let i = 0; i < gTeams.length; i++) {
      for (let j = i + 1; j < gTeams.length; j++) {
        pairs.push([gTeams[i], gTeams[j], gName]);
      }
    }
    groupFixtures.push(pairs);
  }

  // Charter rule: Vòng bảng chạm 15 điểm, 08 điểm đổi sân
  const maxPairs = Math.max(0, ...groupFixtures.map((p) => p.length));
  for (let pIdx = 0; pIdx < maxPairs; pIdx++) {
    for (const gPairs of groupFixtures) {
      const pair = gPairs[pIdx];
      if (!pair) continue;
      const [teamA, teamB, gName] = pair;
      const courtNumber = (slotIndex % Math.max(1, courtsCount)) + 1;
      const wave = Math.floor(slotIndex / Math.max(1, courtsCount));
      const scheduledTime = addMinutesToTime(8, 0, wave * 25);
      matches.push({
        id: `m_${slug}_${ts}_g${matchNo}`,
        division,
        competitionType: resolvedCompType,
        stage: 'group',
        roundOrder: 1,
        matchNumber: matchNo,
        groupName: gName,
        bracketSlot: '',
        nextMatchId: '',
        nextMatchSide: '',
        teamAId: teamA.id,
        teamAName: teamA.teamName,
        teamBId: teamB.id,
        teamBName: teamB.teamName,
        courtNumber,
        scheduledTime,
        scoringMode,
        pointsToWin,
        maxPointsCap: pointsToWin,
        winByTwo: false,
      });
      matchNo += 1;
      slotIndex += 1;
    }
  }

  // Charter rule: Vòng loại trực tiếp chạm 15 điểm, 08 điểm đổi sân (14-14 thắng cách biệt 02 điểm, max 18 điểm)
  if (includeKnockout && sorted.length >= 4) {
    const finalId = `m_${slug}_${ts}_f1`;
    const thirdId = `m_${slug}_${ts}_3rd`;
    const sf1Id = `m_${slug}_${ts}_sf1`;
    const sf2Id = `m_${slug}_${ts}_sf2`;
    const koCap = pointsToWin === 15 ? 18 : pointsToWin + 3;

    const baseWave = Math.floor(slotIndex / Math.max(1, courtsCount)) + 1;
    let koWave = baseWave;

    if (numGroups === 4) {
      const qfSlots = [
        { slot: 'QF1', labelA: 'Nhất Bảng A', labelB: 'Nhì Bảng B', nextId: sf1Id, nextSide: 'A' as const },
        { slot: 'QF2', labelA: 'Nhất Bảng C', labelB: 'Nhì Bảng D', nextId: sf1Id, nextSide: 'B' as const },
        { slot: 'QF3', labelA: 'Nhất Bảng B', labelB: 'Nhì Bảng A', nextId: sf2Id, nextSide: 'A' as const },
        { slot: 'QF4', labelA: 'Nhất Bảng D', labelB: 'Nhì Bảng C', nextId: sf2Id, nextSide: 'B' as const },
      ];
      qfSlots.forEach((qf, idx) => {
        matches.push({
          id: `m_${slug}_${ts}_qf${idx + 1}`,
          division,
          competitionType: resolvedCompType,
          stage: 'quarterfinal',
          roundOrder: 2,
          matchNumber: matchNo++,
          groupName: 'Tứ kết',
          bracketSlot: qf.slot,
          nextMatchId: qf.nextId,
          nextMatchSide: qf.nextSide,
          teamAId: '',
          teamAName: qf.labelA,
          teamBId: '',
          teamBName: qf.labelB,
          courtNumber: (idx % Math.max(1, courtsCount)) + 1,
          scheduledTime: addMinutesToTime(8, 0, koWave * 25),
          scoringMode,
          pointsToWin,
          maxPointsCap: koCap,
          winByTwo: true,
        });
      });
      koWave += 1;
    }

    const sf1TeamA = numGroups === 4 ? 'Thắng Tứ kết 1' : numGroups === 2 ? 'Nhất Bảng A' : 'Hạng 1 Bảng A';
    const sf1TeamB = numGroups === 4 ? 'Thắng Tứ kết 2' : numGroups === 2 ? 'Nhì Bảng B' : 'Hạng 4 Bảng A';
    const sf2TeamA = numGroups === 4 ? 'Thắng Tứ kết 3' : numGroups === 2 ? 'Nhất Bảng B' : 'Hạng 2 Bảng A';
    const sf2TeamB = numGroups === 4 ? 'Thắng Tứ kết 4' : numGroups === 2 ? 'Nhì Bảng A' : 'Hạng 3 Bảng A';

    matches.push({
      id: sf1Id,
      division,
      competitionType: resolvedCompType,
      stage: 'semifinal',
      roundOrder: 3,
      matchNumber: matchNo++,
      groupName: 'Bán kết',
      bracketSlot: 'SF1',
      nextMatchId: finalId,
      nextMatchSide: 'A',
      teamAId: '',
      teamAName: sf1TeamA,
      teamBId: '',
      teamBName: sf1TeamB,
      courtNumber: 1,
      scheduledTime: addMinutesToTime(8, 0, koWave * 25),
      scoringMode,
      pointsToWin,
      maxPointsCap: koCap,
      winByTwo: true,
    });

    matches.push({
      id: sf2Id,
      division,
      competitionType: resolvedCompType,
      stage: 'semifinal',
      roundOrder: 3,
      matchNumber: matchNo++,
      groupName: 'Bán kết',
      bracketSlot: 'SF2',
      nextMatchId: finalId,
      nextMatchSide: 'B',
      teamAId: '',
      teamAName: sf2TeamA,
      teamBId: '',
      teamBName: sf2TeamB,
      courtNumber: Math.min(2, Math.max(1, courtsCount)),
      scheduledTime: addMinutesToTime(8, 0, koWave * 25),
      scoringMode,
      pointsToWin,
      maxPointsCap: koCap,
      winByTwo: true,
    });

    koWave += 1;

    matches.push({
      id: thirdId,
      division,
      competitionType: resolvedCompType,
      stage: 'third_place',
      roundOrder: 4,
      matchNumber: matchNo++,
      groupName: 'Tranh hạng 3',
      bracketSlot: '3RD',
      nextMatchId: '',
      nextMatchSide: '',
      teamAId: '',
      teamAName: 'Thua Bán kết 1',
      teamBId: '',
      teamBName: 'Thua Bán kết 2',
      courtNumber: Math.min(2, Math.max(1, courtsCount)),
      scheduledTime: addMinutesToTime(8, 0, koWave * 25),
      scoringMode,
      pointsToWin,
      maxPointsCap: koCap,
      winByTwo: true,
    });

    matches.push({
      id: finalId,
      division,
      competitionType: resolvedCompType,
      stage: 'final',
      roundOrder: 5,
      matchNumber: matchNo++,
      groupName: 'Chung kết',
      bracketSlot: 'F1',
      nextMatchId: '',
      nextMatchSide: '',
      teamAId: '',
      teamAName: 'Thắng Bán kết 1',
      teamBId: '',
      teamBName: 'Thắng Bán kết 2',
      courtNumber: 1,
      scheduledTime: addMinutesToTime(8, 0, (koWave + 1) * 25),
      scoringMode,
      pointsToWin,
      maxPointsCap: koCap,
      winByTwo: true,
    });
  }

  return { groupAssignments, matches };
}

export type ScheduleConflictType = 'same_court_live' | 'same_court_time' | 'same_team_time';

export interface ScheduleConflict {
  id: string;
  type: ScheduleConflictType;
  severity: 'critical' | 'warning';
  matchA: Match;
  matchB: Match;
  courtNumber?: number;
  timeLabel: string;
  message: string;
}

export function parseScheduledMinutes(timeStr: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((timeStr || '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (Number.isNaN(h) || Number.isNaN(min) || h < 0 || h > 23 || min < 0 || min > 59) {
    return null;
  }
  return h * 60 + min;
}

function formatMinutesAsTime(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function getRealTeamKeys(match: Match): Array<{ key: string; label: string }> {
  const res: Array<{ key: string; label: string }> = [];
  if (match.teamAId) {
    res.push({ key: `id:${match.teamAId}`, label: match.teamAName });
  } else if (
    match.teamAName &&
    !/^(Nhất|Nhì|Hạng|Thắng|Thua)\s/i.test(match.teamAName.trim())
  ) {
    res.push({ key: `name:${match.teamAName.trim().toLowerCase()}`, label: match.teamAName });
  }
  if (match.teamBId) {
    res.push({ key: `id:${match.teamBId}`, label: match.teamBName });
  } else if (
    match.teamBName &&
    !/^(Nhất|Nhì|Hạng|Thắng|Thua)\s/i.test(match.teamBName.trim())
  ) {
    res.push({ key: `name:${match.teamBName.trim().toLowerCase()}`, label: match.teamBName });
  }
  return res;
}

/**
 * Real-time schedule conflict detector:
 * - Two active matches running simultaneously (live) on the same court
 * - Two non-completed matches assigned to the same court at the same or overlapping (< 20 min) time
 * - Same team/pair scheduled on overlapping times across matches
 */
export function detectScheduleConflicts(
  matches: Match[],
  minGapMinutes = 20,
): ScheduleConflict[] {
  const active = matches.filter((m) => m.status !== 'completed');
  const conflicts: ScheduleConflict[] = [];

  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const m1 = active[i];
      const m2 = active[j];

      const sameCourt = m1.courtNumber > 0 && m1.courtNumber === m2.courtNumber;
      const t1 = parseScheduledMinutes(m1.scheduledTime);
      const t2 = parseScheduledMinutes(m2.scheduledTime);
      const exactSameTime = Boolean(
        m1.scheduledTime &&
          m2.scheduledTime &&
          m1.scheduledTime.trim() === m2.scheduledTime.trim(),
      );
      const timeDiff = t1 !== null && t2 !== null ? Math.abs(t1 - t2) : null;
      const isTimeOverlapping =
        exactSameTime || (timeDiff !== null && timeDiff < minGapMinutes);

      if (sameCourt && m1.status === 'live' && m2.status === 'live') {
        conflicts.push({
          id: `conflict_live_${m1.id}_${m2.id}`,
          type: 'same_court_live',
          severity: 'critical',
          matchA: m1,
          matchB: m2,
          courtNumber: m1.courtNumber,
          timeLabel: m1.scheduledTime || m2.scheduledTime || 'Đang đấu',
          message: `Sân ${m1.courtNumber} đang có 2 trận cùng trạng thái Đang đấu (#${m1.matchNumber} và #${m2.matchNumber}).`,
        });
        continue;
      }

      if (sameCourt && isTimeOverlapping) {
        conflicts.push({
          id: `conflict_court_${m1.id}_${m2.id}`,
          type: 'same_court_time',
          severity: exactSameTime ? 'critical' : 'warning',
          matchA: m1,
          matchB: m2,
          courtNumber: m1.courtNumber,
          timeLabel: exactSameTime
            ? m1.scheduledTime
            : `${m1.scheduledTime} / ${m2.scheduledTime}`,
          message: exactSameTime
            ? `Trùng Sân ${m1.courtNumber} lúc ${m1.scheduledTime} giữa Trận #${m1.matchNumber} và Trận #${m2.matchNumber}.`
            : `Trận #${m1.matchNumber} (${m1.scheduledTime}) và Trận #${m2.matchNumber} (${m2.scheduledTime}) xếp sát giờ nhau trên Sân ${m1.courtNumber} (cách ${timeDiff} phút).`,
        });
      }

      if (isTimeOverlapping) {
        const teams1 = getRealTeamKeys(m1);
        const teams2 = getRealTeamKeys(m2);
        const shared = teams1.find((a) => teams2.some((b) => b.key === a.key));
        if (shared) {
          conflicts.push({
            id: `conflict_team_${m1.id}_${m2.id}`,
            type: 'same_team_time',
            severity: 'critical',
            matchA: m1,
            matchB: m2,
            timeLabel: exactSameTime
              ? m1.scheduledTime
              : `${m1.scheduledTime} / ${m2.scheduledTime}`,
            message: `Trùng thời gian (${
              exactSameTime ? m1.scheduledTime : `${m1.scheduledTime} & ${m2.scheduledTime}`
            }) của đội "${shared.label}" giữa Trận #${m1.matchNumber} (Sân ${m1.courtNumber}) và Trận #${m2.matchNumber} (Sân ${m2.courtNumber}).`,
          });
        }
      }
    }
  }

  return conflicts;
}

export function findNextAvailableCourtSlot(
  targetMatch: Match,
  allMatches: Match[],
  courtsCount: number,
  stepMinutes = 25,
): { courtNumber: number; scheduledTime: string } {
  const safeCourts = Math.max(1, courtsCount || 1);
  const startMins = parseScheduledMinutes(targetMatch.scheduledTime) ?? 8 * 60;
  const others = allMatches.filter((m) => m.id !== targetMatch.id);

  for (let wave = 0; wave < 24; wave++) {
    const candidateTime = formatMinutesAsTime(startMins + wave * stepMinutes);
    for (let c = 1; c <= safeCourts; c++) {
      const simulated: Match = {
        ...targetMatch,
        courtNumber: c,
        scheduledTime: candidateTime,
        status: targetMatch.status === 'live' ? 'scheduled' : targetMatch.status,
      };
      const conflicts = detectScheduleConflicts([...others, simulated]).filter(
        (cf) => cf.matchA.id === targetMatch.id || cf.matchB.id === targetMatch.id,
      );
      if (conflicts.length === 0) {
        return { courtNumber: c, scheduledTime: candidateTime };
      }
    }
  }

  return {
    courtNumber: (targetMatch.courtNumber % safeCourts) + 1,
    scheduledTime: formatMinutesAsTime(startMins + stepMinutes),
  };
}

