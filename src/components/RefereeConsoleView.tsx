import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Coins,
  Flag,
  Gavel,
  Lock,
  Megaphone,
  Minus,
  PauseCircle,
  Play,
  Plus,
  RotateCcw,
  Timer,
  UserCheck,
  X,
} from 'lucide-react';
import {
  MATCH_STAGE_LABELS,
  MATCH_STATUS_LABELS,
  type Match,
  type Registration,
  type StaffAccount,
  type Tournament,
} from '../types/tournament';
import { formatScoreCallout, isTeamDivision } from '../utils/pickleballEngine';

type ThemeMode = 'light' | 'dark';

interface RefereeConsoleViewProps {
  tournament: Tournament;
  matches: Match[];
  registrations: Registration[];
  selectedMatchId: string | null;
  currentAccount: StaffAccount | null;
  themeMode?: ThemeMode;
  activeTab?: string;
  onCreateTournament?: () => void;
  onRequestLogin: (reason: string) => void;
  onSelectMatch: (matchId: string) => void;
  onUpdateMatch: (matchId: string, patch: Partial<Match>) => void;
  onCompleteMatch: (match: Match, winnerSide: '' | 'A' | 'B') => void;
  onAnnounceCourtCall: (match: Match) => void;
  onAnnounceCourtAvailable: (finishedMatch: Match) => void;
  onAddRosterAthlete?: (registrationId: string, athleteLabel: string) => void;
}

const TIMEOUT_DURATION_SEC = 60;

function compactCourtNameLabel(raw?: string): string {
  if (!raw) return 'VĐV';
  const beforeParen = raw.split('(')[0].trim();
  if (!beforeParen) return raw;
  const parts = beforeParen.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return parts.slice(-2).join(' ');
  }
  return beforeParen;
}

function getServeAndReceiveCoords(params: {
  servingTeam: 'A' | 'B';
  serverScore: number;
  courtSideA: 'left' | 'right';
}): {
  serveSide: 'left' | 'right';
  serveRow: 0 | 1;
  receiveSide: 'left' | 'right';
  receiveRow: 0 | 1;
} {
  const { servingTeam, serverScore, courtSideA } = params;
  const serveSide: 'left' | 'right' =
    servingTeam === 'A'
      ? courtSideA === 'left'
        ? 'left'
        : 'right'
      : courtSideA === 'left'
      ? 'right'
      : 'left';

  const isEven = serverScore % 2 === 0;
  const rightHandRow: 0 | 1 = serveSide === 'left' ? 1 : 0;
  const serveRow: 0 | 1 = isEven ? rightHandRow : rightHandRow === 0 ? 1 : 0;

  const receiveSide: 'left' | 'right' = serveSide === 'left' ? 'right' : 'left';
  const receiveRow: 0 | 1 = serveRow === 0 ? 1 : 0;

  return { serveSide, serveRow, receiveSide, receiveRow };
}

function shortenSegment(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  trimStart = 44,
  trimEnd = 48,
): { sx: number; sy: number; ex: number; ey: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;

  const maxTrim = len * 0.34;
  const sTrim = Math.min(trimStart, maxTrim);
  const eTrim = Math.min(trimEnd, maxTrim);

  return {
    sx: x1 + ux * sTrim,
    sy: y1 + uy * sTrim,
    ex: x2 - ux * eTrim,
    ey: y2 - uy * eTrim,
  };
}

function extractAssignedCourtNumber(account: StaffAccount | null): number | null {
  if (!account) return null;
  const rec = account as unknown as Record<string, unknown>;
  const rawCourt = rec.courtNumber ?? rec.assignedCourt ?? rec.court;
  if (typeof rawCourt === 'number' && Number.isFinite(rawCourt) && rawCourt > 0) {
    return rawCourt;
  }
  if (typeof rawCourt === 'string') {
    const numMatch = rawCourt.match(/\d+/);
    if (numMatch) return Number(numMatch[0]);
  }
  const text = `${account.displayName || ''} ${account.role || ''}`;
  const sânMatch = text.match(/sân\s*(\d+)/i);
  if (sânMatch) return Number(sânMatch[1]);
  return null;
}

export const RefereeConsoleView: React.FC<RefereeConsoleViewProps> = ({
  tournament,
  matches,
  registrations,
  selectedMatchId,
  currentAccount,
  themeMode = 'light',
  activeTab = 'referee',
  onCreateTournament,
  onSelectMatch,
  onUpdateMatch,
  onCompleteMatch,
  onAnnounceCourtCall,
  onAnnounceCourtAvailable,
}) => {
  const isDark = themeMode === 'dark';
  const showCreateTournamentBtn = activeTab === 'admin' && typeof onCreateTournament === 'function';
  const assignedCourt = useMemo(() => extractAssignedCourtNumber(currentAccount), [currentAccount]);

  const [timeoutModal, setTimeoutModal] = useState<{
    team: 'A' | 'B';
    remainingSec: number;
    running: boolean;
  } | null>(null);

  const [showSubstituteModal, setShowSubstituteModal] = useState(false);
  const [subSide, setSubSide] = useState<'A' | 'B'>('A');
  const [subSlot, setSubSlot] = useState<1 | 2>(1);
  const [subNameInput, setSubNameInput] = useState('');

  const [showCoinTossModal, setShowCoinTossModal] = useState(false);
  const [isFlippingCoin, setIsFlippingCoin] = useState(false);
  const [coinResultTeam, setCoinResultTeam] = useState<'A' | 'B'>('A');
  const [tossServeTeam, setTossServeTeam] = useState<'A' | 'B'>('A');
  const [tossCourtSideA, setTossCourtSideA] = useState<'left' | 'right'>('left');

  useEffect(() => {
    if (!timeoutModal || !timeoutModal.running) return;
    if (timeoutModal.remainingSec <= 0) {
      setTimeoutModal((prev) => (prev ? { ...prev, running: false } : null));
      return;
    }
    const timer = window.setInterval(() => {
      setTimeoutModal((prev) => {
        if (!prev) return null;
        if (prev.remainingSec <= 1) {
          return { ...prev, remainingSec: 0, running: false };
        }
        return { ...prev, remainingSec: prev.remainingSec - 1 };
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [timeoutModal]);

  // Trọng tài sân nào chỉ hiển thị đúng trận đấu của sân đó
  const courtOnlyMatches = useMemo(() => {
    if (!assignedCourt) return matches;
    return matches.filter((m) => m.courtNumber === assignedCourt);
  }, [matches, assignedCourt]);

  const activeMatch = useMemo(() => {
    if (courtOnlyMatches.length === 0) return null;
    if (selectedMatchId) {
      const found = courtOnlyMatches.find((m) => m.id === selectedMatchId);
      if (found) return found;
    }
    return courtOnlyMatches.find((m) => m.status === 'live') || courtOnlyMatches[0];
  }, [courtOnlyMatches, selectedMatchId]);

  const availablePlayersPool = useMemo(() => {
    const names = new Set<string>();
    registrations.forEach((r) => {
      if (r.player1Name) names.add(r.player1Name);
      if (r.player2Name) names.add(r.player2Name);
      (r.squadRoster || []).forEach((n) => n && names.add(n));
    });
    return Array.from(names);
  }, [registrations]);

  const cardSurface = isDark
    ? 'bg-slate-900 border-slate-800 text-slate-100'
    : 'bg-white border-slate-200 text-slate-900';

  const subSurface = isDark
    ? 'bg-slate-950/75 border-slate-800 text-slate-100'
    : 'bg-slate-50 border-slate-200 text-slate-900';

  const inputSurface = isDark
    ? 'bg-slate-950 border-slate-700 text-white placeholder:text-slate-500'
    : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400';

  const mutedText = isDark ? 'text-slate-400' : 'text-slate-600';

  const popupBackdrop =
    'fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-[2px] p-4 flex items-center justify-center';
  const popupCard = `border rounded-2xl max-w-md w-full p-4 sm:p-5 space-y-4 shadow-2xl ${cardSurface}`;

  if (!activeMatch) {
    return (
      <section className={`border rounded-2xl p-4 text-center space-y-1.5 ${cardSurface}`}>
        <div className="font-display text-sm sm:text-base font-bold">
          {assignedCourt
            ? `Sân ${assignedCourt} hiện chưa có trận đấu nào.`
            : 'Chưa có trận đấu nào trong giải này.'}
        </div>
        <p className={`text-xs ${mutedText}`}>
          {assignedCourt
            ? `Trọng tài Sân ${assignedCourt} chỉ hiển thị các trận thuộc Sân ${assignedCourt}.`
            : 'Vui lòng kiểm tra lịch thi đấu tại mục Lịch & Nhánh đấu.'}
        </p>
      </section>
    );
  }

  const targetPoints = activeMatch.pointsToWin || tournament.pointsToWin || 15;
  const isTeam = isTeamDivision(activeMatch.division, activeMatch.competitionType);
  const isDoublesMatch =
    isTeam ||
    activeMatch.division?.toLowerCase().includes('đôi') ||
    Boolean(activeMatch.teamAPlayer2 && activeMatch.teamBPlayer2);

  const courtSideA: 'left' | 'right' = activeMatch.courtSideA === 'right' ? 'right' : 'left';

  const teamAPlayers: [string, string] = [
    activeMatch.teamAPlayer1 || 'VĐV A1',
    activeMatch.teamAPlayer2 || 'VĐV A2',
  ];
  const teamBPlayers: [string, string] = [
    activeMatch.teamBPlayer1 || 'VĐV B1',
    activeMatch.teamBPlayer2 || 'VĐV B2',
  ];

  const leftTeamKey: 'A' | 'B' = courtSideA === 'left' ? 'A' : 'B';
  const rightTeamKey: 'A' | 'B' = leftTeamKey === 'A' ? 'B' : 'A';

  const leftTeamLabel = leftTeamKey === 'A' ? activeMatch.teamAName : activeMatch.teamBName;
  const rightTeamLabel = rightTeamKey === 'A' ? activeMatch.teamAName : activeMatch.teamBName;
  const leftPlayers = leftTeamKey === 'A' ? teamAPlayers : teamBPlayers;
  const rightPlayers = rightTeamKey === 'A' ? teamAPlayers : teamBPlayers;

  const servingTeam: 'A' | 'B' = activeMatch.servingTeam === 'B' ? 'B' : 'A';
  const currentServerNum: 1 | 2 = activeMatch.serverNumber === 2 ? 2 : 1;
  const serverScore = servingTeam === 'A' ? activeMatch.scoreA : activeMatch.scoreB;

  const reachedEndScore =
    activeMatch.scoreA >= targetPoints || activeMatch.scoreB >= targetPoints;

  const canAddA = servingTeam === 'A' && !reachedEndScore && activeMatch.scoreA < targetPoints;
  const canSubA = servingTeam === 'A' && activeMatch.scoreA > 0;

  const canAddB = servingTeam === 'B' && !reachedEndScore && activeMatch.scoreB < targetPoints;
  const canSubB = servingTeam === 'B' && activeMatch.scoreB > 0;

  const { serveSide, serveRow, receiveSide, receiveRow } = getServeAndReceiveCoords({
    servingTeam,
    serverScore,
    courtSideA,
  });

  const rawServeX = serveSide === 'left' ? 86 : 354;
  const rawServeY = serveRow === 0 ? 56 : 146;
  const rawReceiveX = receiveSide === 'left' ? 86 : 354;
  const rawReceiveY = receiveRow === 0 ? 56 : 146;

  const { sx, sy, ex, ey } = shortenSegment(
    rawServeX,
    rawServeY,
    rawReceiveX,
    rawReceiveY,
    46,
    50,
  );

  const handleAdjustScore = (side: 'A' | 'B', delta: 1 | -1) => {
    if (servingTeam !== side) return;

    if (delta === 1) {
      if (reachedEndScore) return;
      const currentVal = side === 'A' ? activeMatch.scoreA : activeMatch.scoreB;
      if (currentVal >= targetPoints) return;

      const nextScoreA = side === 'A' ? activeMatch.scoreA + 1 : activeMatch.scoreA;
      const nextScoreB = side === 'B' ? activeMatch.scoreB + 1 : activeMatch.scoreB;

      const shouldSwapA = side === 'A' && isDoublesMatch;
      const shouldSwapB = side === 'B' && isDoublesMatch;

      onUpdateMatch(activeMatch.id, {
        status: activeMatch.status === 'scheduled' ? 'live' : activeMatch.status,
        startedAtMs: activeMatch.startedAtMs || Date.now(),
        scoreA: nextScoreA,
        scoreB: nextScoreB,
        servingTeam: side,
        serverNumber: currentServerNum,
        teamAPlayer1: shouldSwapA ? activeMatch.teamAPlayer2 : activeMatch.teamAPlayer1,
        teamAPlayer2: shouldSwapA ? activeMatch.teamAPlayer1 : activeMatch.teamAPlayer2,
        teamBPlayer1: shouldSwapB ? activeMatch.teamBPlayer2 : activeMatch.teamBPlayer1,
        teamBPlayer2: shouldSwapB ? activeMatch.teamBPlayer1 : activeMatch.teamBPlayer2,
      });
      return;
    }

    const nextScoreA = side === 'A' ? Math.max(0, activeMatch.scoreA - 1) : activeMatch.scoreA;
    const nextScoreB = side === 'B' ? Math.max(0, activeMatch.scoreB - 1) : activeMatch.scoreB;

    const shouldSwapBackA = side === 'A' && isDoublesMatch && activeMatch.scoreA > 0;
    const shouldSwapBackB = side === 'B' && isDoublesMatch && activeMatch.scoreB > 0;

    onUpdateMatch(activeMatch.id, {
      scoreA: nextScoreA,
      scoreB: nextScoreB,
      teamAPlayer1: shouldSwapBackA ? activeMatch.teamAPlayer2 : activeMatch.teamAPlayer1,
      teamAPlayer2: shouldSwapBackA ? activeMatch.teamAPlayer1 : activeMatch.teamAPlayer2,
      teamBPlayer1: shouldSwapBackB ? activeMatch.teamBPlayer2 : activeMatch.teamBPlayer1,
      teamBPlayer2: shouldSwapBackB ? activeMatch.teamBPlayer1 : activeMatch.teamBPlayer2,
    });
  };

  const handleFaultRotateServe = () => {
    const otherTeam: 'A' | 'B' = servingTeam === 'A' ? 'B' : 'A';
    const isOpeningDoublesStart =
      isDoublesMatch &&
      activeMatch.scoreA === 0 &&
      activeMatch.scoreB === 0 &&
      currentServerNum === 2;

    if (isDoublesMatch && !isOpeningDoublesStart && currentServerNum === 1) {
      onUpdateMatch(activeMatch.id, {
        servingTeam,
        serverNumber: 2,
      });
      return;
    }

    onUpdateMatch(activeMatch.id, {
      servingTeam: otherTeam,
      serverNumber: 1,
    });
  };

  const handleSwitchCourtSides = () => {
    onUpdateMatch(activeMatch.id, {
      courtSideA: courtSideA === 'left' ? 'right' : 'left',
      sideSwitched: !activeMatch.sideSwitched,
    });
  };

  const handleStartTimeout = (team: 'A' | 'B') => {
    const nextCountA =
      team === 'A' ? (activeMatch.timeoutsA || 0) + 1 : activeMatch.timeoutsA || 0;
    const nextCountB =
      team === 'B' ? (activeMatch.timeoutsB || 0) + 1 : activeMatch.timeoutsB || 0;

    onUpdateMatch(activeMatch.id, {
      timeoutsA: nextCountA,
      timeoutsB: nextCountB,
    });
    setTimeoutModal({
      team,
      remainingSec: TIMEOUT_DURATION_SEC,
      running: true,
    });
  };

  const handleOpenSubstitute = (side: 'A' | 'B', slot: 1 | 2) => {
    setSubSide(side);
    setSubSlot(slot);
    const currentVal =
      side === 'A'
        ? slot === 1
          ? activeMatch.teamAPlayer1
          : activeMatch.teamAPlayer2
        : slot === 1
        ? activeMatch.teamBPlayer1
        : activeMatch.teamBPlayer2;
    setSubNameInput(currentVal || '');
    setShowSubstituteModal(true);
  };

  const handleConfirmSubstitute = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = subNameInput.trim();
    if (!clean) return;

    if (subSide === 'A') {
      onUpdateMatch(activeMatch.id, {
        teamAPlayer1: subSlot === 1 ? clean : activeMatch.teamAPlayer1,
        teamAPlayer2: subSlot === 2 ? clean : activeMatch.teamAPlayer2,
      });
    } else {
      onUpdateMatch(activeMatch.id, {
        teamBPlayer1: subSlot === 1 ? clean : activeMatch.teamBPlayer1,
        teamBPlayer2: subSlot === 2 ? clean : activeMatch.teamBPlayer2,
      });
    }
    setShowSubstituteModal(false);
  };

  const handleOpenCoinToss = () => {
    setCoinResultTeam(servingTeam);
    setTossServeTeam(servingTeam);
    setTossCourtSideA(courtSideA);
    setIsFlippingCoin(false);
    setShowCoinTossModal(true);
  };

  const handleFlipCoin = () => {
    if (isFlippingCoin) return;
    setIsFlippingCoin(true);
    const picked: 'A' | 'B' = Math.random() < 0.5 ? 'A' : 'B';
    window.setTimeout(() => {
      setCoinResultTeam(picked);
      setTossServeTeam(picked);
      setIsFlippingCoin(false);
    }, 900);
  };

  const handleApplyCoinToss = () => {
    onUpdateMatch(activeMatch.id, {
      servingTeam: tossServeTeam,
      serverNumber: 1,
      courtSideA: tossCourtSideA,
      sideSwitched: tossCourtSideA !== 'left',
    });
    setShowCoinTossModal(false);
  };

  const formatCountdown = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const render3DPlayerNode = (
    side: 'left' | 'right',
    row: 0 | 1,
    teamKey: 'A' | 'B',
    slotNum: 1 | 2,
    fullLabel: string,
  ) => {
    const isServingSpot = serveSide === side && serveRow === row;
    const isReceivingSpot = receiveSide === side && receiveRow === row;
    const shortLabel = compactCourtNameLabel(fullLabel);
    const reverse = side === 'right';

    const jerseyFill = isServingSpot
      ? '#facc15'
      : isReceivingSpot
      ? '#38bdf8'
      : teamKey === 'A'
      ? '#f97316'
      : '#0ea5e9';

    const tagClass = isServingSpot
      ? 'bg-amber-300 text-slate-950 font-black animate-pulse'
      : isReceivingSpot
      ? 'bg-cyan-300 text-slate-950 font-black animate-pulse'
      : 'bg-slate-950/85 text-white font-bold';

    return (
      <button
        type="button"
        onClick={() => handleOpenSubstitute(teamKey, slotNum)}
        className={`group flex items-center gap-1 max-w-full relative z-30 ${
          reverse ? 'flex-row-reverse text-right' : 'flex-row text-left'
        }`}
        title={`${fullLabel} — Chạm để thay VĐV`}
      >
        <span className="relative flex items-center justify-center shrink-0 w-4 h-4 sm:w-6 sm:h-6">
          {(isServingSpot || isReceivingSpot) && (
            <span
              className={`absolute inset-0 rounded-full animate-ping opacity-70 ${
                isServingSpot ? 'bg-amber-300' : 'bg-cyan-300'
              }`}
            />
          )}
          <svg viewBox="0 0 32 32" className="w-4 h-4 sm:w-6 sm:h-6 drop-shadow-md">
            <ellipse cx="16" cy="28.5" rx="8" ry="2.5" fill="rgba(0,0,0,0.42)" />
            <path
              d="M9 26.5 C9.5 20.5, 12.5 18, 16 18 C19.5 18, 22.5 20.5, 23 26.5 Z"
              fill={jerseyFill}
              stroke="#ffffff"
              strokeWidth="1.5"
            />
            <circle
              cx="16"
              cy="11.5"
              r="5.5"
              fill="#fde68a"
              stroke="#ffffff"
              strokeWidth="1.5"
            />
            <circle cx="14.2" cy="9.6" r="1.6" fill="#ffffff" opacity="0.8" />
          </svg>
        </span>

        <span
          className={`px-1 py-0.5 rounded text-[8px] sm:text-[11px] leading-none whitespace-nowrap shadow-sm ${tagClass}`}
        >
          {shortLabel}
          {isServingSpot ? ' · PHÁT' : isReceivingSpot ? ' · ĐỠ' : ''}
        </span>
      </button>
    );
  };

  return (
    <div className="flex flex-col [@media(orientation:landscape)_and_(max-height:520px)]:grid [@media(orientation:landscape)_and_(max-height:520px)]:grid-cols-12 lg:grid lg:grid-cols-12 justify-start gap-1.5 sm:gap-2.5 [@media(orientation:landscape)_and_(max-height:520px)]:gap-1.5">
      {/* CỘT TRÁI (điện thoại ngang & màn hình lớn) / KHỐI TRÊN (điện thoại dọc) */}
      <div className="[@media(orientation:landscape)_and_(max-height:520px)]:col-span-6 lg:col-span-6 flex flex-col justify-start gap-1.5 sm:gap-2.5 [@media(orientation:landscape)_and_(max-height:520px)]:gap-1 min-w-0">
        {/* 1. Thanh chọn trận của đúng sân & điều phối */}
        <section
          className={`border rounded-xl sm:rounded-2xl p-2 sm:p-3 [@media(orientation:landscape)_and_(max-height:520px)]:p-1.5 space-y-1.5 [@media(orientation:landscape)_and_(max-height:520px)]:space-y-1 ${cardSurface}`}
        >
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1 text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-orange-500 min-w-0">
              <Gavel className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                SÂN {activeMatch.courtNumber} · {tournament.name}
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {showCreateTournamentBtn && (
                <button
                  type="button"
                  onClick={onCreateTournament}
                  className="min-h-[26px] px-2 py-0.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-[10px] font-bold inline-flex items-center gap-1 whitespace-nowrap"
                >
                  <Plus className="w-3 h-3" />
                  <span>Tạo giải mới</span>
                </button>
              )}
              <span
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border truncate max-w-[140px] ${
                  isDark
                    ? 'bg-slate-950 border-slate-800 text-slate-300'
                    : 'bg-slate-100 border-slate-200 text-slate-700'
                }`}
              >
                {currentAccount?.displayName || `Trọng tài Sân ${activeMatch.courtNumber}`}
              </span>
            </div>
          </div>

          <select
            value={activeMatch.id}
            onChange={(e) => onSelectMatch(e.target.value)}
            className={`w-full min-h-[32px] sm:min-h-[36px] [@media(orientation:landscape)_and_(max-height:520px)]:min-h-[28px] px-2.5 py-1 text-[11px] sm:text-xs font-bold border rounded-xl ${inputSurface}`}
          >
            {courtOnlyMatches.map((m) => (
              <option key={m.id} value={m.id}>
                Trận #{m.matchNumber} (Sân {m.courtNumber}) — {m.teamAName} vs {m.teamBName} [
                {MATCH_STATUS_LABELS[m.status]}]
              </option>
            ))}
          </select>

          <div className="grid grid-cols-4 gap-1 [@media(orientation:landscape)_and_(max-height:520px)]:gap-1 sm:gap-1.5">
            <button
              type="button"
              onClick={handleOpenCoinToss}
              className="min-h-[32px] sm:min-h-[36px] [@media(orientation:landscape)_and_(max-height:520px)]:min-h-[28px] px-1 py-1 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-[10px] sm:text-xs font-bold inline-flex items-center justify-center gap-1 whitespace-nowrap"
            >
              <Coins className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span>Bốc thăm</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenSubstitute('A', 1)}
              className={`min-h-[32px] sm:min-h-[36px] [@media(orientation:landscape)_and_(max-height:520px)]:min-h-[28px] px-1 py-1 rounded-xl border text-[10px] sm:text-xs font-bold inline-flex items-center justify-center gap-1 whitespace-nowrap ${
                isDark
                  ? 'bg-slate-950 hover:bg-slate-800 border-slate-700 text-slate-100'
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
              }`}
            >
              <UserCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-orange-500 shrink-0" />
              <span>Thay VĐV</span>
            </button>

            <button
              type="button"
              onClick={() => onAnnounceCourtCall(activeMatch)}
              className="min-h-[32px] sm:min-h-[36px] [@media(orientation:landscape)_and_(max-height:520px)]:min-h-[28px] px-1 py-1 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-[10px] sm:text-xs font-bold inline-flex items-center justify-center gap-1 whitespace-nowrap"
            >
              <Megaphone className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span>Gọi sân</span>
            </button>

            <button
              type="button"
              onClick={() => onAnnounceCourtAvailable(activeMatch)}
              className={`min-h-[32px] sm:min-h-[36px] [@media(orientation:landscape)_and_(max-height:520px)]:min-h-[28px] px-1 py-1 rounded-xl border text-[10px] sm:text-xs font-bold inline-flex items-center justify-center gap-1 whitespace-nowrap ${
                isDark
                  ? 'bg-slate-950 hover:bg-slate-800 border-slate-700 text-emerald-400'
                  : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700'
              }`}
            >
              <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span>Sân trống</span>
            </button>
          </div>
        </section>

        {/* 2. Sân Pickleball 3D & VĐV 3D */}
        <section
          className={`border rounded-xl sm:rounded-2xl p-2 sm:p-3 [@media(orientation:landscape)_and_(max-height:520px)]:p-1.5 space-y-1 [@media(orientation:landscape)_and_(max-height:520px)]:space-y-0.5 ${cardSurface}`}
        >
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1 min-w-0">
              <h2 className="font-display text-[10px] sm:text-sm font-extrabold uppercase tracking-tight truncate">
                SÂN 3D #{activeMatch.courtNumber} · {serverScore % 2 === 0 ? 'CHẴN' : 'LẺ'} · N
                {currentServerNum}
              </h2>
              <span className="inline-flex items-center gap-1 text-[8px] sm:text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-amber-300 text-slate-950 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-ping" />
                <span>Phát</span>
              </span>
              <span className="inline-flex items-center gap-1 text-[8px] sm:text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-cyan-300 text-slate-950 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-ping" />
                <span>Đỡ</span>
              </span>
            </div>

            <div className="flex items-center gap-1 text-[9px] sm:text-[10px] font-mono-num shrink-0">
              <span className="px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-500 font-bold truncate max-w-[76px] sm:max-w-[150px]">
                T: {compactCourtNameLabel(leftTeamLabel)}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-500 font-bold truncate max-w-[76px] sm:max-w-[150px]">
                P: {compactCourtNameLabel(rightTeamLabel)}
              </span>
            </div>
          </div>

          <div
            className={`rounded-xl border p-1 sm:p-1.5 ${
              isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'
            }`}
          >
            <div className="w-full max-w-2xl mx-auto" style={{ perspective: '760px' }}>
              <div
                style={{
                  transform: 'rotateX(14deg)',
                  transformStyle: 'preserve-3d',
                }}
                className="relative w-full max-h-[17svh] [@media(orientation:landscape)_and_(max-height:520px)]:max-h-[38svh] sm:max-h-[26svh] aspect-[22/10] mx-auto rounded-xl border-2 border-white shadow-[0_10px_22px_rgba(6,78,59,0.45)] bg-gradient-to-b from-emerald-600 via-emerald-700 to-emerald-800 overflow-hidden select-none"
              >
                <div className="absolute inset-x-0 bottom-0 h-1.5 bg-emerald-950/60 pointer-events-none" />

                <div className="w-full h-full flex relative z-10">
                  <div className="w-[34.09%] h-full border-r-2 border-white flex flex-col relative">
                    <div className="flex-1 border-b border-white/85 flex items-center justify-center p-0.5">
                      {render3DPlayerNode('left', 0, leftTeamKey, 1, leftPlayers[0])}
                    </div>
                    <div className="flex-1 border-t border-white/85 flex items-center justify-center p-0.5">
                      {render3DPlayerNode('left', 1, leftTeamKey, 2, leftPlayers[1])}
                    </div>
                  </div>

                  <div className="w-[15.91%] h-full bg-emerald-900/45 border-r border-white/70 flex items-center justify-center">
                    <span className="text-[7px] sm:text-[9px] font-bold uppercase tracking-widest text-white/65 -rotate-90 whitespace-nowrap">
                      NVZ 7FT
                    </span>
                  </div>

                  <div className="w-[15.91%] h-full bg-emerald-900/45 border-l border-white/70 flex items-center justify-center">
                    <span className="text-[7px] sm:text-[9px] font-bold uppercase tracking-widest text-white/65 rotate-90 whitespace-nowrap">
                      NVZ 7FT
                    </span>
                  </div>

                  <div className="w-[34.09%] h-full border-l-2 border-white flex flex-col relative">
                    <div className="flex-1 border-b border-white/85 flex items-center justify-center p-0.5">
                      {render3DPlayerNode('right', 0, rightTeamKey, 1, rightPlayers[0])}
                    </div>
                    <div className="flex-1 border-t border-white/85 flex items-center justify-center p-0.5">
                      {render3DPlayerNode('right', 1, rightTeamKey, 2, rightPlayers[1])}
                    </div>
                  </div>

                  <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-1.5 bg-gradient-to-r from-white/75 via-white to-white/75 shadow-[0_0_8px_rgba(0,0,0,0.45)] pointer-events-none flex flex-col items-center justify-between py-0.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-white -mt-0.5" />
                    <span className="px-1 py-0.5 rounded bg-slate-950/85 text-[7px] sm:text-[9px] font-extrabold text-white uppercase leading-none">
                      Lưới 3D
                    </span>
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-white -mb-0.5" />
                  </div>
                </div>

                <svg
                  viewBox="0 0 440 200"
                  className="absolute inset-0 w-full h-full pointer-events-none z-20"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <marker
                      id="serveArrow3DHead"
                      markerWidth="7"
                      markerHeight="7"
                      refX="5.5"
                      refY="3.5"
                      orient="auto"
                    >
                      <path d="M 0 0 L 7 3.5 L 0 7 z" fill="#fde047" />
                    </marker>
                  </defs>
                  <line
                    x1={sx}
                    y1={sy}
                    x2={ex}
                    y2={ey}
                    stroke="#fde047"
                    strokeWidth="3"
                    strokeDasharray="6 4"
                    markerEnd="url(#serveArrow3DHead)"
                  />
                </svg>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* CỘT PHẢI (điện thoại ngang & màn hình lớn) / KHỐI DƯỚI (điện thoại dọc): Bảng điểm to dễ bấm */}
      <div className="[@media(orientation:landscape)_and_(max-height:520px)]:col-span-6 lg:col-span-6 flex flex-col justify-start min-w-0">
        <section
          className={`border rounded-xl sm:rounded-2xl p-2 sm:p-3 [@media(orientation:landscape)_and_(max-height:520px)]:p-1.5 space-y-2 [@media(orientation:landscape)_and_(max-height:520px)]:space-y-1 ${cardSurface}`}
        >
          <div className="flex items-center justify-between gap-1 text-[10px] sm:text-xs font-mono-num">
            <div className="flex items-center gap-1 min-w-0">
              <span className="px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-500 font-extrabold shrink-0">
                #{activeMatch.matchNumber} · S{activeMatch.courtNumber}
              </span>
              <span className={`truncate ${mutedText}`}>
                {activeMatch.groupName || MATCH_STAGE_LABELS[activeMatch.stage]}
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                {formatScoreCallout(activeMatch)}
              </span>
              <span className={mutedText}>/{targetPoints}đ</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
            {/* Đội A */}
            <div
              className={`border rounded-xl p-2 sm:p-2.5 [@media(orientation:landscape)_and_(max-height:520px)]:p-1.5 space-y-1.5 [@media(orientation:landscape)_and_(max-height:520px)]:space-y-1 min-w-0 ${
                servingTeam === 'A' ? 'ring-2 ring-orange-500/70' : 'opacity-85'
              } ${subSurface}`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider text-orange-500 truncate">
                  ĐỘI A · {courtSideA === 'left' ? 'TRÁI' : 'PHẢI'}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  {servingTeam === 'A' ? (
                    <span className="px-1.5 py-0.5 rounded bg-orange-600 text-white text-[9px] font-bold leading-none">
                      PHÁT N{currentServerNum}
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded bg-slate-500/20 text-slate-500 text-[9px] font-bold leading-none inline-flex items-center gap-0.5">
                      <Lock className="w-2.5 h-2.5" />
                      <span>ĐỠ</span>
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleStartTimeout('A')}
                    className={`min-h-[22px] sm:min-h-[24px] px-1.5 py-0.5 rounded border text-[9px] sm:text-[10px] font-bold inline-flex items-center gap-0.5 ${
                      isDark
                        ? 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-amber-300'
                        : 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-900'
                    }`}
                  >
                    <Timer className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
                    <span>TO ({activeMatch.timeoutsA || 0})</span>
                  </button>
                </div>
              </div>

              <div
                className="font-display text-[11px] sm:text-sm font-extrabold leading-tight truncate"
                title={activeMatch.teamAName}
              >
                {activeMatch.teamAName}
              </div>

              <div className="flex items-center justify-between gap-1.5 pt-0.5">
                <div className="font-mono-num text-xl sm:text-3xl font-black leading-none">
                  {activeMatch.scoreA}
                </div>
                <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={!canSubA}
                    onClick={() => handleAdjustScore('A', -1)}
                    className="min-h-[40px] sm:min-h-[46px] [@media(orientation:landscape)_and_(max-height:520px)]:min-h-[34px] w-9 sm:w-11 [@media(orientation:landscape)_and_(max-height:520px)]:w-8 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35 disabled:cursor-not-allowed text-slate-800 dark:text-slate-100 inline-flex items-center justify-center"
                    title="Trừ 1 điểm Đội A"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={!canAddA}
                    onClick={() => handleAdjustScore('A', 1)}
                    className="min-h-[40px] sm:min-h-[46px] [@media(orientation:landscape)_and_(max-height:520px)]:min-h-[34px] px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 active:scale-[0.98] disabled:opacity-35 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-black inline-flex items-center gap-1 whitespace-nowrap shadow-sm"
                  >
                    <Plus className="w-4 h-4 shrink-0" />
                    <span>+1 A</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Đội B */}
            <div
              className={`border rounded-xl p-2 sm:p-2.5 [@media(orientation:landscape)_and_(max-height:520px)]:p-1.5 space-y-1.5 [@media(orientation:landscape)_and_(max-height:520px)]:space-y-1 min-w-0 ${
                servingTeam === 'B' ? 'ring-2 ring-sky-500/70' : 'opacity-85'
              } ${subSurface}`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider text-sky-500 truncate">
                  ĐỘI B · {courtSideA === 'left' ? 'PHẢI' : 'TRÁI'}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  {servingTeam === 'B' ? (
                    <span className="px-1.5 py-0.5 rounded bg-sky-600 text-white text-[9px] font-bold leading-none">
                      PHÁT N{currentServerNum}
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded bg-slate-500/20 text-slate-500 text-[9px] font-bold leading-none inline-flex items-center gap-0.5">
                      <Lock className="w-2.5 h-2.5" />
                      <span>ĐỠ</span>
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleStartTimeout('B')}
                    className={`min-h-[22px] sm:min-h-[24px] px-1.5 py-0.5 rounded border text-[9px] sm:text-[10px] font-bold inline-flex items-center gap-0.5 ${
                      isDark
                        ? 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-amber-300'
                        : 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-900'
                    }`}
                  >
                    <Timer className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
                    <span>TO ({activeMatch.timeoutsB || 0})</span>
                  </button>
                </div>
              </div>

              <div
                className="font-display text-[11px] sm:text-sm font-extrabold leading-tight truncate"
                title={activeMatch.teamBName}
              >
                {activeMatch.teamBName}
              </div>

              <div className="flex items-center justify-between gap-1.5 pt-0.5">
                <div className="font-mono-num text-xl sm:text-3xl font-black leading-none">
                  {activeMatch.scoreB}
                </div>
                <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={!canSubB}
                    onClick={() => handleAdjustScore('B', -1)}
                    className="min-h-[40px] sm:min-h-[46px] [@media(orientation:landscape)_and_(max-height:520px)]:min-h-[34px] w-9 sm:w-11 [@media(orientation:landscape)_and_(max-height:520px)]:w-8 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35 disabled:cursor-not-allowed text-slate-800 dark:text-slate-100 inline-flex items-center justify-center"
                    title="Trừ 1 điểm Đội B"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={!canAddB}
                    onClick={() => handleAdjustScore('B', 1)}
                    className="min-h-[40px] sm:min-h-[46px] [@media(orientation:landscape)_and_(max-height:520px)]:min-h-[34px] px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 active:scale-[0.98] disabled:opacity-35 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-black inline-flex items-center gap-1 whitespace-nowrap shadow-sm"
                  >
                    <Plus className="w-4 h-4 shrink-0" />
                    <span>+1 B</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Hàng 1: Đổi giao / Đổi sân */}
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={handleFaultRotateServe}
              className={`min-h-[32px] sm:min-h-[36px] [@media(orientation:landscape)_and_(max-height:520px)]:min-h-[28px] px-2 py-1 rounded-xl border text-[11px] sm:text-xs font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap ${
                isDark
                  ? 'bg-slate-950 hover:bg-slate-800 border-slate-700 text-slate-200'
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-orange-500 shrink-0" />
              <span>Đổi giao</span>
            </button>

            <button
              type="button"
              onClick={handleSwitchCourtSides}
              className={`min-h-[32px] sm:min-h-[36px] [@media(orientation:landscape)_and_(max-height:520px)]:min-h-[28px] px-2 py-1 rounded-xl border text-[11px] sm:text-xs font-bold inline-flex items-center justify-center whitespace-nowrap ${
                isDark
                  ? 'bg-slate-950 hover:bg-slate-800 border-slate-700 text-slate-200'
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
              }`}
            >
              Đổi sân
            </button>
          </div>

          {/* Hàng 2: Đội A thắng / Đội B thắng / Hòa 2-2 */}
          <div className={`grid ${isTeam ? 'grid-cols-3' : 'grid-cols-2'} gap-1.5`}>
            <button
              type="button"
              onClick={() => onCompleteMatch(activeMatch, 'A')}
              className="min-h-[32px] sm:min-h-[36px] [@media(orientation:landscape)_and_(max-height:520px)]:min-h-[28px] px-2 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] sm:text-xs font-bold inline-flex items-center justify-center gap-1 whitespace-nowrap"
            >
              <Flag className="w-3.5 h-3.5 shrink-0" />
              <span>Đội A thắng</span>
            </button>

            <button
              type="button"
              onClick={() => onCompleteMatch(activeMatch, 'B')}
              className="min-h-[32px] sm:min-h-[36px] [@media(orientation:landscape)_and_(max-height:520px)]:min-h-[28px] px-2 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] sm:text-xs font-bold inline-flex items-center justify-center gap-1 whitespace-nowrap"
            >
              <Flag className="w-3.5 h-3.5 shrink-0" />
              <span>Đội B thắng</span>
            </button>

            {isTeam && (
              <button
                type="button"
                onClick={() => onCompleteMatch(activeMatch, '')}
                className={`min-h-[32px] sm:min-h-[36px] [@media(orientation:landscape)_and_(max-height:520px)]:min-h-[28px] px-2 py-1 rounded-xl border text-[11px] sm:text-xs font-bold inline-flex items-center justify-center whitespace-nowrap ${
                  isDark
                    ? 'bg-slate-950 hover:bg-slate-800 border-slate-700 text-slate-200'
                    : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                }`}
              >
                Hòa 2-2
              </button>
            )}
          </div>
        </section>
      </div>

      {/* POPUP TIME OUT */}
      {timeoutModal && (
        <div onClick={() => setTimeoutModal(null)} className={popupBackdrop}>
          <div onClick={(e) => e.stopPropagation()} className={popupCard}>
            <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
              <div>
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-amber-500">
                  HỘI Ý KỸ THUẬT · SÂN {activeMatch.courtNumber}
                </div>
                <h3 className="font-display text-base sm:text-lg font-bold mt-0.5">
                  Time out —{' '}
                  {timeoutModal.team === 'A' ? activeMatch.teamAName : activeMatch.teamBName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setTimeoutModal(null)}
                className={`p-1.5 rounded-xl border ${subSurface} ${mutedText}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className={`border rounded-2xl p-4 text-center space-y-1.5 ${subSurface}`}>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-500">
                <Timer className="w-4 h-4" />
                <span>Thời gian hội ý còn lại</span>
              </div>
              <div
                className={`font-mono-num text-5xl font-extrabold tracking-tight ${
                  timeoutModal.remainingSec <= 10 ? 'text-rose-500' : 'text-amber-500'
                }`}
              >
                {formatCountdown(timeoutModal.remainingSec)}
              </div>
              <div className={`text-xs ${mutedText}`}>
                Tỉ số hiện tại: <strong>{activeMatch.scoreA}</strong> -{' '}
                <strong>{activeMatch.scoreB}</strong>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() =>
                  setTimeoutModal((prev) => (prev ? { ...prev, running: !prev.running } : null))
                }
                className={`min-h-[38px] px-2.5 py-2 rounded-xl border text-xs font-bold inline-flex items-center justify-center gap-1.5 ${subSurface}`}
              >
                {timeoutModal.running ? (
                  <>
                    <PauseCircle className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>Tạm dừng</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Tiếp tục</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() =>
                  setTimeoutModal((prev) =>
                    prev ? { ...prev, remainingSec: TIMEOUT_DURATION_SEC, running: true } : null,
                  )
                }
                className={`min-h-[38px] px-2.5 py-2 rounded-xl border text-xs font-bold inline-flex items-center justify-center gap-1.5 ${subSurface}`}
              >
                <RotateCcw className="w-4 h-4 shrink-0" />
                <span>Đặt lại 60s</span>
              </button>

              <button
                type="button"
                onClick={() => setTimeoutModal(null)}
                className="min-h-[38px] px-3 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-extrabold inline-flex items-center justify-center"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP THAY VĐV */}
      {showSubstituteModal && (
        <div onClick={() => setShowSubstituteModal(false)} className={popupBackdrop}>
          <form onSubmit={handleConfirmSubstitute} onClick={(e) => e.stopPropagation()} className={popupCard}>
            <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
              <div>
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-orange-500">
                  ĐIỀU CHỈNH ĐỘI HÌNH SÂN {activeMatch.courtNumber}
                </div>
                <h3 className="font-display text-base sm:text-lg font-bold mt-0.5">Thay VĐV trên sân</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSubstituteModal(false)}
                className={`p-1.5 rounded-xl border ${subSurface} ${mutedText}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setSubSide('A');
                  setSubNameInput(
                    subSlot === 1 ? activeMatch.teamAPlayer1 || '' : activeMatch.teamAPlayer2 || '',
                  );
                }}
                className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-extrabold border truncate ${
                  subSide === 'A' ? 'bg-orange-600 text-white border-orange-600' : subSurface
                }`}
              >
                Đội A: {activeMatch.teamAName}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSubSide('B');
                  setSubNameInput(
                    subSlot === 1 ? activeMatch.teamBPlayer1 || '' : activeMatch.teamBPlayer2 || '',
                  );
                }}
                className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-extrabold border truncate ${
                  subSide === 'B' ? 'bg-sky-600 text-white border-sky-600' : subSurface
                }`}
              >
                Đội B: {activeMatch.teamBName}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setSubSlot(1);
                  setSubNameInput(
                    subSide === 'A'
                      ? activeMatch.teamAPlayer1 || ''
                      : activeMatch.teamBPlayer1 || '',
                  );
                }}
                className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-bold border ${
                  subSlot === 1 ? 'bg-orange-600 text-white border-orange-600' : subSurface
                }`}
              >
                VĐV vị trí 1
              </button>
              <button
                type="button"
                onClick={() => {
                  setSubSlot(2);
                  setSubNameInput(
                    subSide === 'A'
                      ? activeMatch.teamAPlayer2 || ''
                      : activeMatch.teamBPlayer2 || '',
                  );
                }}
                className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-bold border ${
                  subSlot === 2 ? 'bg-orange-600 text-white border-orange-600' : subSurface
                }`}
              >
                VĐV vị trí 2
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Tên VĐV vào sân *</label>
              <input
                type="text"
                autoFocus
                value={subNameInput}
                onChange={(e) => setSubNameInput(e.target.value)}
                placeholder="Nhập tên VĐV thay thế..."
                className={`w-full min-h-[38px] px-3 py-1.5 text-xs border rounded-xl ${inputSurface}`}
              />
            </div>

            {availablePlayersPool.length > 0 && (
              <div className="space-y-1.5">
                <div className={`text-[11px] font-semibold ${mutedText}`}>
                  Chọn nhanh từ danh sách VĐV:
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                  {availablePlayersPool.map((pName) => (
                    <button
                      key={pName}
                      type="button"
                      onClick={() => setSubNameInput(pName)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${subSurface} hover:border-orange-500`}
                    >
                      {pName}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowSubstituteModal(false)}
                className={`min-h-[38px] px-4 py-2 rounded-xl text-xs font-bold border ${subSurface}`}
              >
                Hủy
              </button>
              <button
                type="submit"
                className="min-h-[38px] px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold"
              >
                Xác nhận thay VĐV
              </button>
            </div>
          </form>
        </div>
      )}

      {/* POPUP BỐC THĂM */}
      {showCoinTossModal && (
        <div onClick={() => setShowCoinTossModal(false)} className={popupBackdrop}>
          <div onClick={(e) => e.stopPropagation()} className={popupCard}>
            <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
              <div>
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-orange-500">
                  BỐC THĂM TRẬN #{activeMatch.matchNumber} · SÂN {activeMatch.courtNumber}
                </div>
                <h3 className="font-display text-base sm:text-lg font-bold mt-0.5">
                  Tung đồng xu · Chọn bóng & Sân
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCoinTossModal(false)}
                className={`p-1.5 rounded-xl border ${subSurface} ${mutedText}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className={`border rounded-2xl p-4 flex flex-col items-center gap-3 ${subSurface}`}>
              <div
                style={{
                  transform: isFlippingCoin
                    ? 'rotateY(1080deg) scale(1.06)'
                    : 'rotateY(0deg) scale(1)',
                  transition: 'transform 0.9s cubic-bezier(0.22, 1, 0.36, 1)',
                  transformStyle: 'preserve-3d',
                }}
                className="w-24 h-24 rounded-full border-4 bg-amber-400 border-amber-200 text-slate-950 flex flex-col items-center justify-center text-center shadow-lg"
              >
                <span className="text-[10px] font-extrabold uppercase">MẶT XU</span>
                <span className="font-display text-lg font-black leading-tight">
                  {coinResultTeam === 'A' ? 'ĐỘI A' : 'ĐỘI B'}
                </span>
              </div>

              <div className="text-xs font-bold text-center">
                {isFlippingCoin
                  ? 'Đang tung đồng xu...'
                  : `Kết quả xu: ${
                      coinResultTeam === 'A' ? activeMatch.teamAName : activeMatch.teamBName
                    }`}
              </div>

              <button
                type="button"
                disabled={isFlippingCoin}
                onClick={handleFlipCoin}
                className="min-h-[36px] px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-xs font-extrabold inline-flex items-center gap-1.5"
              >
                <Coins className="w-4 h-4" />
                <span>{isFlippingCoin ? 'Đang quay...' : 'Quay đồng xu'}</span>
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold">Chọn bóng (chỉ giao bóng):</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTossServeTeam('A')}
                  className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-extrabold border truncate ${
                    tossServeTeam === 'A' ? 'bg-orange-600 text-white border-orange-600' : subSurface
                  }`}
                >
                  Đội A giao bóng
                </button>
                <button
                  type="button"
                  onClick={() => setTossServeTeam('B')}
                  className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-extrabold border truncate ${
                    tossServeTeam === 'B' ? 'bg-sky-600 text-white border-sky-600' : subSurface
                  }`}
                >
                  Đội B giao bóng
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold">
                Chọn sân cho {activeMatch.teamAName}:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTossCourtSideA('left')}
                  className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-extrabold border ${
                    tossCourtSideA === 'left'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : subSurface
                  }`}
                >
                  Sân Trái
                </button>
                <button
                  type="button"
                  onClick={() => setTossCourtSideA('right')}
                  className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-extrabold border ${
                    tossCourtSideA === 'right'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : subSurface
                  }`}
                >
                  Sân Phải
                </button>
              </div>
              <div className={`text-[11px] ${mutedText}`}>
                {activeMatch.teamBName} sẽ đứng ở{' '}
                <strong>{tossCourtSideA === 'left' ? 'Sân Phải' : 'Sân Trái'}</strong>.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowCoinTossModal(false)}
                className={`min-h-[38px] px-4 py-2 rounded-xl text-xs font-bold border ${subSurface}`}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleApplyCoinToss}
                className="min-h-[38px] px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold"
              >
                Áp dụng bốc thăm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
