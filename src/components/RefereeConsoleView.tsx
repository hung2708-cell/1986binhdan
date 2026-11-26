import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Coins,
  Flag,
  Gavel,
  Megaphone,
  PauseCircle,
  Play,
  Plus,
  RotateCcw,
  ShieldCheck,
  Timer,
  UserCheck,
  UserPlus,
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
  onRequestLogin: (reason: string) => void;
  onSelectMatch: (matchId: string) => void;
  onUpdateMatch: (matchId: string, patch: Partial<Match>) => void;
  onCompleteMatch: (match: Match, winnerSide: '' | 'A' | 'B') => void;
  onAnnounceCourtCall: (match: Match) => void;
  onAnnounceCourtAvailable: (finishedMatch: Match) => void;
  onAddRosterAthlete: (registrationId: string, athleteLabel: string) => void;
}

const TIMEOUT_DURATION_SEC = 60;

export const RefereeConsoleView: React.FC<RefereeConsoleViewProps> = ({
  tournament,
  matches,
  registrations,
  selectedMatchId,
  currentAccount,
  themeMode = 'light',
  onRequestLogin,
  onSelectMatch,
  onUpdateMatch,
  onCompleteMatch,
  onAnnounceCourtCall,
  onAnnounceCourtAvailable,
  onAddRosterAthlete,
}) => {
  const isDark = themeMode === 'dark';
  const isAdmin = currentAccount?.role === 'admin';

  // Form bổ sung nhanh VĐV (Admin)
  const [newAthleteName, setNewAthleteName] = useState('');
  const [newAthleteGender, setNewAthleteGender] = useState<'Nam' | 'Nữ'>('Nam');
  const [newAthleteTier, setNewAthleteTier] = useState<'Trình A' | 'Trình B' | 'Trình C'>(
    'Trình B',
  );

  // Đồng hồ Time out
  const [timeoutState, setTimeoutState] = useState<{
    team: 'A' | 'B';
    remainingSec: number;
    running: boolean;
  } | null>(null);

  // Popup Thay VĐV
  const [showSubstituteModal, setShowSubstituteModal] = useState(false);
  const [subSide, setSubSide] = useState<'A' | 'B'>('A');
  const [subSlot, setSubSlot] = useState<1 | 2>(1);
  const [subNameInput, setSubNameInput] = useState('');

  // Popup Bốc thăm (đồng xu quay + chọn bóng chỉ giao bóng + chọn sân trái/phải)
  const [showCoinTossModal, setShowCoinTossModal] = useState(false);
  const [isFlippingCoin, setIsFlippingCoin] = useState(false);
  const [coinResultTeam, setCoinResultTeam] = useState<'A' | 'B'>('A');
  const [tossServeTeam, setTossServeTeam] = useState<'A' | 'B'>('A');
  const [tossCourtSideA, setTossCourtSideA] = useState<'left' | 'right'>('left');

  useEffect(() => {
    if (!timeoutState || !timeoutState.running) return;
    if (timeoutState.remainingSec <= 0) {
      setTimeoutState((prev) => (prev ? { ...prev, running: false } : null));
      return;
    }
    const timer = window.setInterval(() => {
      setTimeoutState((prev) => {
        if (!prev) return null;
        if (prev.remainingSec <= 1) {
          return { ...prev, remainingSec: 0, running: false };
        }
        return { ...prev, remainingSec: prev.remainingSec - 1 };
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [timeoutState]);

  const activeMatch = useMemo(() => {
    if (matches.length === 0) return null;
    if (selectedMatchId) {
      const found = matches.find((m) => m.id === selectedMatchId);
      if (found) return found;
    }
    return matches.find((m) => m.status === 'live') || matches[0];
  }, [matches, selectedMatchId]);

  const matchedRegA = useMemo(
    () =>
      activeMatch
        ? registrations.find(
            (r) => r.id === activeMatch.teamAId || r.teamName === activeMatch.teamAName,
          )
        : undefined,
    [registrations, activeMatch],
  );

  const matchedRegB = useMemo(
    () =>
      activeMatch
        ? registrations.find(
            (r) => r.id === activeMatch.teamBId || r.teamName === activeMatch.teamBName,
          )
        : undefined,
    [registrations, activeMatch],
  );

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
    ? 'bg-slate-950/70 border-slate-800 text-slate-100'
    : 'bg-slate-50 border-slate-200 text-slate-900';

  const inputSurface = isDark
    ? 'bg-slate-950 border-slate-700 text-white placeholder:text-slate-500'
    : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400';

  const mutedText = isDark ? 'text-slate-400' : 'text-slate-600';

  if (!activeMatch) {
    return (
      <section className={`border rounded-2xl p-6 text-center space-y-2 ${cardSurface}`}>
        <div className="font-display text-base font-bold">
          Chưa có trận đấu nào trong giải này.
        </div>
        <p className={`text-xs ${mutedText}`}>
          Vui lòng vào mục <strong>Lịch & Nhánh đấu</strong> để sinh lịch tự động.
        </p>
      </section>
    );
  }

  const targetPoints = activeMatch.pointsToWin || tournament.pointsToWin || 15;
  const isTeam = isTeamDivision(activeMatch.division, activeMatch.competitionType);

  const teamAPlayers: [string, string] = [
    activeMatch.teamAPlayer1 || 'VĐV A1',
    activeMatch.teamAPlayer2 || 'VĐV A2',
  ];
  const teamBPlayers: [string, string] = [
    activeMatch.teamBPlayer1 || 'VĐV B1',
    activeMatch.teamBPlayer2 || 'VĐV B2',
  ];

  // Xác định đội nào đang ở phía Sân Trái và Sân Phải
  const leftTeamKey: 'A' | 'B' = activeMatch.courtSideA === 'left' ? 'A' : 'B';
  const rightTeamKey: 'A' | 'B' = leftTeamKey === 'A' ? 'B' : 'A';

  const leftTeamLabel = leftTeamKey === 'A' ? activeMatch.teamAName : activeMatch.teamBName;
  const rightTeamLabel = rightTeamKey === 'A' ? activeMatch.teamAName : activeMatch.teamBName;
  const leftPlayers = leftTeamKey === 'A' ? teamAPlayers : teamBPlayers;
  const rightPlayers = rightTeamKey === 'A' ? teamAPlayers : teamBPlayers;

  const handleScorePoint = (side: 'A' | 'B') => {
    const nextScoreA = side === 'A' ? activeMatch.scoreA + 1 : activeMatch.scoreA;
    const nextScoreB = side === 'B' ? activeMatch.scoreB + 1 : activeMatch.scoreB;

    const nextHistory = [
      ...(activeMatch.scoreHistory || []),
      {
        atMs: Date.now(),
        side,
        scoreA: nextScoreA,
        scoreB: nextScoreB,
        servingTeam: activeMatch.servingTeam,
        serverNumber: activeMatch.serverNumber,
      },
    ];

    onUpdateMatch(activeMatch.id, {
      status: activeMatch.status === 'scheduled' ? 'live' : activeMatch.status,
      startedAtMs: activeMatch.startedAtMs || Date.now(),
      scoreA: nextScoreA,
      scoreB: nextScoreB,
      scoreHistory: nextHistory,
      servingTeam: side,
      serverNumber: activeMatch.servingTeam === side ? activeMatch.serverNumber : 1,
    });
  };

  const handleUndoPoint = () => {
    const history = activeMatch.scoreHistory || [];
    if (history.length > 0) {
      const remaining = history.slice(0, -1);
      const last = remaining[remaining.length - 1];
      onUpdateMatch(activeMatch.id, {
        scoreA: last ? last.scoreA : 0,
        scoreB: last ? last.scoreB : 0,
        servingTeam: last ? last.servingTeam : 'A',
        serverNumber: last ? last.serverNumber : 2,
        scoreHistory: remaining,
      });
      return;
    }
    onUpdateMatch(activeMatch.id, {
      scoreA: Math.max(0, activeMatch.scoreA - 1),
    });
  };

  const handleRotateServer = () => {
    if (activeMatch.servingTeam === 'A') {
      if (activeMatch.serverNumber === 1) {
        onUpdateMatch(activeMatch.id, { serverNumber: 2 });
      } else {
        onUpdateMatch(activeMatch.id, { servingTeam: 'B', serverNumber: 1 });
      }
    } else if (activeMatch.serverNumber === 1) {
      onUpdateMatch(activeMatch.id, { serverNumber: 2 });
    } else {
      onUpdateMatch(activeMatch.id, { servingTeam: 'A', serverNumber: 1 });
    }
  };

  // Time out
  const handleStartTimeout = (team: 'A' | 'B') => {
    const nextCountA =
      team === 'A' ? (activeMatch.timeoutsA || 0) + 1 : activeMatch.timeoutsA || 0;
    const nextCountB =
      team === 'B' ? (activeMatch.timeoutsB || 0) + 1 : activeMatch.timeoutsB || 0;

    onUpdateMatch(activeMatch.id, {
      timeoutsA: nextCountA,
      timeoutsB: nextCountB,
    });
    setTimeoutState({
      team,
      remainingSec: TIMEOUT_DURATION_SEC,
      running: true,
    });
  };

  // Mở popup Thay VĐV
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

  // Mở popup Bốc thăm
  const handleOpenCoinToss = () => {
    setCoinResultTeam(activeMatch.servingTeam || 'A');
    setTossServeTeam(activeMatch.servingTeam || 'A');
    setTossCourtSideA(activeMatch.courtSideA || 'left');
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

  const handleQuickAddRoster = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      onRequestLogin('Chỉ tài khoản Admin mới có quyền thêm VĐV vào danh sách đội hình.');
      return;
    }
    if (!newAthleteName.trim()) return;
    const targetReg = matchedRegA || matchedRegB || registrations[0];
    if (!targetReg) return;
    const formatted = `${newAthleteName.trim()} (${newAthleteGender} · ${newAthleteTier})`;
    onAddRosterAthlete(targetReg.id, formatted);
    setNewAthleteName('');
  };

  const formatCountdown = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4 pb-2">
      {/* Đồng hồ Time out đang chạy */}
      {timeoutState && (
        <div
          className={`border rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 ${
            isDark
              ? 'bg-amber-950/40 border-amber-700/60 text-amber-100'
              : 'bg-amber-50 border-amber-300 text-amber-950'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Timer className="w-5 h-5 text-amber-500 shrink-0" />
            <div className="text-xs sm:text-sm font-bold">
              TIME OUT · {timeoutState.team === 'A' ? activeMatch.teamAName : activeMatch.teamBName}
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="font-mono-num text-lg sm:text-xl font-extrabold text-amber-500">
              {formatCountdown(timeoutState.remainingSec)}
            </span>
            <button
              type="button"
              onClick={() =>
                setTimeoutState((prev) => (prev ? { ...prev, running: !prev.running } : null))
              }
              className={`min-h-[34px] px-3 py-1 rounded-lg border text-xs font-bold inline-flex items-center gap-1 ${
                isDark
                  ? 'bg-slate-900 border-slate-700 text-slate-100'
                  : 'bg-white border-slate-300 text-slate-800'
              }`}
            >
              {timeoutState.running ? (
                <>
                  <PauseCircle className="w-3.5 h-3.5" />
                  <span>Tạm dừng</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>Tiếp tục</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => setTimeoutState(null)}
              className="min-h-[34px] px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold"
            >
              Kết thúc
            </button>
          </div>
        </div>
      )}

      {/* Thanh chọn trận & điều phối sân */}
      <section className={`border rounded-2xl p-3.5 sm:p-4 space-y-3 ${cardSurface}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-orange-500">
            <Gavel className="w-4 h-4 shrink-0" />
            <span className="truncate">BÀN ĐIỀU HÀNH TRỌNG TÀI · {tournament.name}</span>
          </div>

          <span
            className={`px-2.5 py-1 rounded-lg text-xs font-bold border shrink-0 ${
              isDark
                ? 'bg-slate-950 border-slate-800 text-slate-300'
                : 'bg-slate-100 border-slate-200 text-slate-700'
            }`}
          >
            {currentAccount?.displayName || 'Trọng tài'}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2">
          <select
            value={activeMatch.id}
            onChange={(e) => onSelectMatch(e.target.value)}
            className={`min-h-[38px] flex-1 min-w-0 px-3 py-1.5 text-xs font-bold border rounded-xl ${inputSurface}`}
          >
            {matches.map((m) => (
              <option key={m.id} value={m.id}>
                Trận #{m.matchNumber} (Sân {m.courtNumber}) — {m.teamAName} vs {m.teamBName} [
                {MATCH_STATUS_LABELS[m.status]}]
              </option>
            ))}
          </select>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleOpenCoinToss}
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Coins className="w-3.5 h-3.5 shrink-0" />
              <span>Bốc thăm</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenSubstitute('A', 1)}
              className={`min-h-[38px] px-3 py-1.5 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap ${
                isDark
                  ? 'bg-slate-950 hover:bg-slate-800 border-slate-700 text-slate-100'
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5 text-orange-500 shrink-0" />
              <span>Thay VĐV</span>
            </button>

            <button
              type="button"
              onClick={() => onAnnounceCourtCall(activeMatch)}
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Megaphone className="w-3.5 h-3.5 shrink-0" />
              <span>Gọi VĐV vào sân</span>
            </button>

            <button
              type="button"
              onClick={() => onAnnounceCourtAvailable(activeMatch)}
              className={`min-h-[38px] px-3 py-1.5 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap ${
                isDark
                  ? 'bg-slate-950 hover:bg-slate-800 border-slate-700 text-emerald-400'
                  : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Báo sân trống</span>
            </button>
          </div>
        </div>
      </section>

      {/* SÂN 3D TRỰC QUAN CÓ 4 CHẤM VĐV 2 BÊN */}
      <section className={`border rounded-2xl p-4 sm:p-5 space-y-3 ${cardSurface}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-sm sm:text-base font-extrabold uppercase tracking-tight">
              SÂN 3D · SÂN {activeMatch.courtNumber} (4 VỊ TRÍ VĐV)
            </h2>
            <p className={`text-xs ${mutedText}`}>
              Chấm sáng là người đang giao bóng · Bấm vào chấm VĐV để thay người nhanh
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono-num">
            <span className="px-2.5 py-1 rounded-lg bg-orange-500/15 text-orange-500 font-bold">
              Trái: {leftTeamLabel}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-sky-500/15 text-sky-500 font-bold">
              Phải: {rightTeamLabel}
            </span>
          </div>
        </div>

        <div
          className={`rounded-2xl border p-4 sm:p-6 overflow-x-auto ${
            isDark
              ? 'bg-slate-950 border-slate-800'
              : 'bg-slate-100 border-slate-200'
          }`}
        >
          <div className="min-w-[540px] mx-auto max-w-4xl [perspective:900px]">
            <div
              style={{ transform: 'rotateX(16deg)' }}
              className="relative rounded-2xl border-4 border-white shadow-xl bg-emerald-700 dark:bg-emerald-800 overflow-hidden"
            >
              {/* Đường biên & đường Kitchen */}
              <div className="grid grid-cols-12 h-52 sm:h-60 relative">
                {/* Nửa sân trái */}
                <div className="col-span-5 border-r-2 border-white/80 relative flex flex-col justify-between p-3 sm:p-4">
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-white/90 truncate">
                    {leftTeamLabel} (Sân Trái)
                  </div>

                  {/* 2 chấm VĐV bên trái */}
                  <div className="flex flex-col justify-between flex-1 py-3">
                    {([0, 1] as const).map((idx) => {
                      const playerName = leftPlayers[idx];
                      const slotNum: 1 | 2 = idx === 0 ? 1 : 2;
                      const isServing =
                        activeMatch.servingTeam === leftTeamKey &&
                        activeMatch.serverNumber === slotNum;
                      return (
                        <button
                          key={`left_${idx}`}
                          type="button"
                          onClick={() => handleOpenSubstitute(leftTeamKey, slotNum)}
                          className="group flex items-center gap-2.5 text-left w-fit"
                          title="Bấm để thay VĐV"
                        >
                          <span
                            className={`w-5 h-5 rounded-full border-2 border-white shadow-md transition-transform group-hover:scale-110 flex items-center justify-center ${
                              isServing
                                ? 'bg-amber-400 ring-4 ring-amber-300/60'
                                : leftTeamKey === 'A'
                                ? 'bg-orange-500'
                                : 'bg-sky-500'
                            }`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-950" />
                          </span>
                          <span className="px-2.5 py-1 rounded-lg bg-slate-950/75 text-white text-xs font-bold backdrop-blur-2xs">
                            {playerName}
                            {isServing ? ' · Giao bóng' : ''}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Khu vực Non-Volley Zone (Kitchen) giữa sân */}
                <div className="col-span-2 bg-emerald-800/70 border-x-2 border-dashed border-white/80 relative flex items-center justify-center">
                  {/* Lưới trung tâm */}
                  <div className="w-1.5 h-full bg-white/95 shadow-md" />
                  <span className="absolute top-2 px-1.5 py-0.5 rounded bg-slate-950/70 text-[10px] font-bold text-white uppercase">
                    Lưới
                  </span>
                </div>

                {/* Nửa sân phải */}
                <div className="col-span-5 border-l-2 border-white/80 relative flex flex-col justify-between p-3 sm:p-4 items-end">
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-white/90 truncate">
                    {rightTeamLabel} (Sân Phải)
                  </div>

                  {/* 2 chấm VĐV bên phải */}
                  <div className="flex flex-col justify-between flex-1 py-3 items-end">
                    {([0, 1] as const).map((idx) => {
                      const playerName = rightPlayers[idx];
                      const slotNum: 1 | 2 = idx === 0 ? 1 : 2;
                      const isServing =
                        activeMatch.servingTeam === rightTeamKey &&
                        activeMatch.serverNumber === slotNum;
                      return (
                        <button
                          key={`right_${idx}`}
                          type="button"
                          onClick={() => handleOpenSubstitute(rightTeamKey, slotNum)}
                          className="group flex flex-row-reverse items-center gap-2.5 text-right w-fit"
                          title="Bấm để thay VĐV"
                        >
                          <span
                            className={`w-5 h-5 rounded-full border-2 border-white shadow-md transition-transform group-hover:scale-110 flex items-center justify-center ${
                              isServing
                                ? 'bg-amber-400 ring-4 ring-amber-300/60'
                                : rightTeamKey === 'A'
                                ? 'bg-orange-500'
                                : 'bg-sky-500'
                            }`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-950" />
                          </span>
                          <span className="px-2.5 py-1 rounded-lg bg-slate-950/75 text-white text-xs font-bold backdrop-blur-2xs">
                            {playerName}
                            {isServing ? ' · Giao bóng' : ''}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bảng điểm chính + Time out */}
      <section className={`border rounded-2xl p-4 sm:p-5 space-y-4 ${cardSurface}`}>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2 font-mono-num min-w-0">
            <span className="px-2.5 py-1 rounded-lg bg-orange-500/15 text-orange-500 font-extrabold shrink-0">
              SÂN {activeMatch.courtNumber} · TRẬN #{activeMatch.matchNumber}
            </span>
            <span className={`truncate ${mutedText}`}>
              {activeMatch.groupName || MATCH_STAGE_LABELS[activeMatch.stage]} ·{' '}
              {activeMatch.teamSubCategory || activeMatch.division}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 font-mono-num shrink-0">
            <span className="text-emerald-500 font-bold">
              Hô điểm: {formatScoreCallout(activeMatch)}
            </span>
            <span className={mutedText}>Chạm {targetPoints} điểm</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-11 gap-3 sm:gap-4 items-center">
          {/* Đội A */}
          <div className={`lg:col-span-5 border rounded-2xl p-3.5 sm:p-4 space-y-3 min-w-0 ${subSurface}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-orange-500">
                ĐỘI A ({activeMatch.courtSideA === 'left' ? 'SÂN TRÁI' : 'SÂN PHẢI'})
              </span>
              <div className="flex items-center gap-1.5">
                {activeMatch.servingTeam === 'A' && (
                  <span className="px-2 py-0.5 rounded-md bg-orange-600 text-white text-[10px] font-bold whitespace-nowrap">
                    ● GIAO BÓNG (NGƯỜI {activeMatch.serverNumber})
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => handleStartTimeout('A')}
                  className={`px-2 py-0.5 rounded-md border text-[11px] font-bold inline-flex items-center gap-1 ${
                    isDark
                      ? 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-amber-300'
                      : 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-800'
                  }`}
                >
                  <Timer className="w-3 h-3" />
                  <span>Time out ({activeMatch.timeoutsA || 0})</span>
                </button>
              </div>
            </div>

            <div className="font-display text-lg sm:text-xl font-extrabold truncate">
              {activeMatch.teamAName}
            </div>
            {(activeMatch.teamAPlayer1 || activeMatch.teamAPlayer2) && (
              <div className={`text-xs truncate ${mutedText}`}>
                {activeMatch.teamAPlayer1}{' '}
                {activeMatch.teamAPlayer2 && `· ${activeMatch.teamAPlayer2}`}
              </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-2">
              <div className="font-mono-num text-4xl sm:text-5xl font-extrabold">
                {activeMatch.scoreA}
              </div>
              <button
                type="button"
                onClick={() => handleScorePoint('A')}
                className="min-h-[46px] px-4 sm:px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 active:scale-[0.98] text-white text-sm font-extrabold inline-flex items-center gap-1.5 shadow-sm transition-all whitespace-nowrap"
              >
                <Plus className="w-5 h-5 shrink-0" />
                <span>+1 ĐIỂM A</span>
              </button>
            </div>
          </div>

          {/* Tỉ số trung tâm */}
          <div className="lg:col-span-1 text-center font-mono-num text-xl sm:text-2xl font-extrabold py-0.5">
            {activeMatch.scoreA} : {activeMatch.scoreB}
          </div>

          {/* Đội B */}
          <div className={`lg:col-span-5 border rounded-2xl p-3.5 sm:p-4 space-y-3 min-w-0 ${subSurface}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-sky-500">
                ĐỘI B ({activeMatch.courtSideA === 'left' ? 'SÂN PHẢI' : 'SÂN TRÁI'})
              </span>
              <div className="flex items-center gap-1.5">
                {activeMatch.servingTeam === 'B' && (
                  <span className="px-2 py-0.5 rounded-md bg-sky-600 text-white text-[10px] font-bold whitespace-nowrap">
                    ● GIAO BÓNG (NGƯỜI {activeMatch.serverNumber})
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => handleStartTimeout('B')}
                  className={`px-2 py-0.5 rounded-md border text-[11px] font-bold inline-flex items-center gap-1 ${
                    isDark
                      ? 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-amber-300'
                      : 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-800'
                  }`}
                >
                  <Timer className="w-3 h-3" />
                  <span>Time out ({activeMatch.timeoutsB || 0})</span>
                </button>
              </div>
            </div>

            <div className="font-display text-lg sm:text-xl font-extrabold truncate">
              {activeMatch.teamBName}
            </div>
            {(activeMatch.teamBPlayer1 || activeMatch.teamBPlayer2) && (
              <div className={`text-xs truncate ${mutedText}`}>
                {activeMatch.teamBPlayer1}{' '}
                {activeMatch.teamBPlayer2 && `· ${activeMatch.teamBPlayer2}`}
              </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-2">
              <div className="font-mono-num text-4xl sm:text-5xl font-extrabold">
                {activeMatch.scoreB}
              </div>
              <button
                type="button"
                onClick={() => handleScorePoint('B')}
                className="min-h-[46px] px-4 sm:px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 active:scale-[0.98] text-white text-sm font-extrabold inline-flex items-center gap-1.5 shadow-sm transition-all whitespace-nowrap"
              >
                <Plus className="w-5 h-5 shrink-0" />
                <span>+1 ĐIỂM B</span>
              </button>
            </div>
          </div>
        </div>

        {/* Thanh điều khiển phụ */}
        <div
          className={`pt-3 border-t flex flex-wrap items-center justify-between gap-2.5 ${
            isDark ? 'border-slate-800' : 'border-slate-200'
          }`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleRotateServer}
              className={`min-h-[38px] px-3 py-2 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap ${
                isDark
                  ? 'bg-slate-950 hover:bg-slate-800 border-slate-700 text-slate-200'
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-orange-500 shrink-0" />
              <span>Đổi lượt giao bóng</span>
            </button>

            <button
              type="button"
              onClick={handleUndoPoint}
              className={`min-h-[38px] px-3 py-2 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap ${
                isDark
                  ? 'bg-slate-950 hover:bg-slate-800 border-slate-700 text-slate-200'
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>Hoàn tác điểm</span>
            </button>

            <button
              type="button"
              onClick={() =>
                onUpdateMatch(activeMatch.id, {
                  courtSideA: activeMatch.courtSideA === 'left' ? 'right' : 'left',
                  sideSwitched: !activeMatch.sideSwitched,
                })
              }
              className={`min-h-[38px] px-3 py-2 rounded-xl border text-xs font-bold whitespace-nowrap ${
                isDark
                  ? 'bg-slate-950 hover:bg-slate-800 border-slate-700 text-slate-200'
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
              }`}
            >
              Đổi sân
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onCompleteMatch(activeMatch, 'A')}
              className="min-h-[38px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Flag className="w-3.5 h-3.5 shrink-0" />
              <span>Đội A thắng</span>
            </button>

            <button
              type="button"
              onClick={() => onCompleteMatch(activeMatch, 'B')}
              className="min-h-[38px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Flag className="w-3.5 h-3.5 shrink-0" />
              <span>Đội B thắng</span>
            </button>

            {isTeam && (
              <button
                type="button"
                onClick={() => onCompleteMatch(activeMatch, '')}
                className={`min-h-[38px] px-3 py-2 rounded-xl border text-xs font-bold whitespace-nowrap ${
                  isDark
                    ? 'bg-slate-950 hover:bg-slate-800 border-slate-700 text-slate-200'
                    : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                }`}
              >
                Hòa 2-2
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Bổ sung nhanh VĐV vào đội hình (chỉ Admin) */}
      {isAdmin && (
        <form onSubmit={handleQuickAddRoster} className={`border rounded-2xl p-4 space-y-3 ${cardSurface}`}>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-bold uppercase flex items-center gap-1.5">
              <UserPlus className="w-4 h-4 text-orange-500" />
              <span>BỔ SUNG NHANH VĐV VÀO ĐỘI HÌNH</span>
            </h2>
            <span className="text-[11px] font-bold text-emerald-500 inline-flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              Admin
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setNewAthleteGender('Nam')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
                newAthleteGender === 'Nam'
                  ? 'bg-sky-600 text-white border-sky-600'
                  : isDark
                  ? 'bg-slate-950 text-slate-300 border-slate-800'
                  : 'bg-slate-50 text-slate-700 border-slate-200'
              }`}
            >
              Nam
            </button>
            <button
              type="button"
              onClick={() => setNewAthleteGender('Nữ')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
                newAthleteGender === 'Nữ'
                  ? 'bg-rose-600 text-white border-rose-600'
                  : isDark
                  ? 'bg-slate-950 text-slate-300 border-slate-800'
                  : 'bg-slate-50 text-slate-700 border-slate-200'
              }`}
            >
              Nữ
            </button>

            {(['Trình A', 'Trình B', 'Trình C'] as const).map((tier) => (
              <button
                key={tier}
                type="button"
                onClick={() => setNewAthleteTier(tier)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border ${
                  newAthleteTier === tier
                    ? 'bg-orange-600 text-white border-orange-600'
                    : isDark
                    ? 'bg-slate-950 text-slate-300 border-slate-800'
                    : 'bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                {tier}
              </button>
            ))}

            <input
              type="text"
              value={newAthleteName}
              onChange={(e) => setNewAthleteName(e.target.value)}
              placeholder="Tên VĐV bổ sung..."
              className={`flex-1 min-w-[180px] min-h-[36px] px-3 py-1 text-xs border rounded-xl ${inputSurface}`}
            />

            <button
              type="submit"
              className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold"
            >
              Thêm VĐV
            </button>
          </div>
        </form>
      )}

      {/* POPUP THAY VĐV (ĐÚNG GIAO DIỆN HỆ THỐNG) */}
      {showSubstituteModal && (
        <div
          onClick={() => setShowSubstituteModal(false)}
          className="fixed inset-0 z-50 bg-slate-950/70 p-4 flex items-center justify-center"
        >
          <form
            onSubmit={handleConfirmSubstitute}
            onClick={(e) => e.stopPropagation()}
            className={`border rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl ${cardSurface}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-orange-500">
                  ĐIỀU CHỈNH ĐỘI HÌNH SÂN {activeMatch.courtNumber}
                </div>
                <h3 className="font-display text-lg font-bold mt-0.5">Thay VĐV trên sân</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSubstituteModal(false)}
                className={`p-1.5 rounded-lg ${mutedText}`}
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
                  subSide === 'A'
                    ? 'bg-orange-600 text-white border-orange-600'
                    : subSurface
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
                  subSide === 'B'
                    ? 'bg-sky-600 text-white border-sky-600'
                    : subSurface
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
                  subSlot === 1
                    ? 'bg-orange-600 text-white border-orange-600'
                    : subSurface
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
                  subSlot === 2
                    ? 'bg-orange-600 text-white border-orange-600'
                    : subSurface
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

            <div className="flex items-center justify-end gap-2 pt-1">
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

      {/* POPUP BỐC THĂM: ĐỒNG XU QUAY + CHỌN BÓNG (CHỈ GIAO BÓNG) + CHỌN SÂN (TRÁI / PHẢI) */}
      {showCoinTossModal && (
        <div
          onClick={() => setShowCoinTossModal(false)}
          className="fixed inset-0 z-50 bg-slate-950/70 p-4 flex items-center justify-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`border rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl ${cardSurface}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-orange-500">
                  BỐC THĂM TRẬN #{activeMatch.matchNumber} · SÂN {activeMatch.courtNumber}
                </div>
                <h3 className="font-display text-lg font-bold mt-0.5">
                  Tung đồng xu · Chọn bóng & Sân
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCoinTossModal(false)}
                className={`p-1.5 rounded-lg ${mutedText}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Đồng xu quay */}
            <div className={`border rounded-2xl p-4 flex flex-col items-center gap-3 ${subSurface}`}>
              <div
                style={{
                  transform: isFlippingCoin
                    ? 'rotateY(1080deg) scale(1.06)'
                    : 'rotateY(0deg) scale(1)',
                  transition: 'transform 0.9s cubic-bezier(0.22, 1, 0.36, 1)',
                  transformStyle: 'preserve-3d',
                }}
                className={`w-24 h-24 rounded-full border-4 flex flex-col items-center justify-center text-center shadow-lg ${
                  coinResultTeam === 'A'
                    ? 'bg-amber-400 border-amber-200 text-slate-950'
                    : 'bg-amber-500 border-amber-200 text-slate-950'
                }`}
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

            {/* 1. Chọn bóng: chỉ thiết lập lượt giao bóng */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold">
                Chọn bóng (chỉ giao bóng):
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTossServeTeam('A')}
                  className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-extrabold border truncate ${
                    tossServeTeam === 'A'
                      ? 'bg-orange-600 text-white border-orange-600'
                      : subSurface
                  }`}
                >
                  Đội A giao bóng
                </button>
                <button
                  type="button"
                  onClick={() => setTossServeTeam('B')}
                  className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-extrabold border truncate ${
                    tossServeTeam === 'B'
                      ? 'bg-sky-600 text-white border-sky-600'
                      : subSurface
                  }`}
                >
                  Đội B giao bóng
                </button>
              </div>
            </div>

            {/* 2. Chọn sân: chọn sân trái / phải cho Đội A (Đội B ở phía còn lại) */}
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

            <div className="flex items-center justify-end gap-2 pt-1">
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
