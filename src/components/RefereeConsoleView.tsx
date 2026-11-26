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

  // Popup Time out
  const [timeoutModal, setTimeoutModal] = useState<{
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

  // Mở Popup Time out
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
    <div className="space-y-3.5 sm:space-y-4 pb-2">
      {/* Thanh chọn trận & điều phối sân */}
      <section className={`border rounded-2xl p-3 sm:p-4 space-y-2.5 sm:space-y-3 ${cardSurface}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[11px] sm:text-xs font-extrabold uppercase tracking-wider text-orange-500 min-w-0">
            <Gavel className="w-4 h-4 shrink-0" />
            <span className="truncate">BÀN ĐIỀU HÀNH TRỌNG TÀI · {tournament.name}</span>
          </div>

          <span
            className={`px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-bold border shrink-0 ${
              isDark
                ? 'bg-slate-950 border-slate-800 text-slate-300'
                : 'bg-slate-100 border-slate-200 text-slate-700'
            }`}
          >
            {currentAccount?.displayName || 'Trọng tài'}
          </span>
        </div>

        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2">
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

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={handleOpenCoinToss}
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <Coins className="w-3.5 h-3.5 shrink-0" />
              <span>Bốc thăm</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenSubstitute('A', 1)}
              className={`min-h-[38px] px-3 py-1.5 rounded-xl border text-xs font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap ${
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
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <Megaphone className="w-3.5 h-3.5 shrink-0" />
              <span>Gọi VĐV vào sân</span>
            </button>

            <button
              type="button"
              onClick={() => onAnnounceCourtAvailable(activeMatch)}
              className={`min-h-[38px] px-3 py-1.5 rounded-xl border text-xs font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap ${
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

      {/* SÂN PICKLEBALL 3D ĐÚNG TỶ LỆ CHUẨN 44ft x 20ft (22:10) — TỰ CO GIÃN */}
      <section className={`border rounded-2xl p-3 sm:p-5 space-y-2.5 sm:space-y-3 ${cardSurface}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-xs sm:text-base font-extrabold uppercase tracking-tight">
              SÂN 3D CHUẨN TỶ LỆ (44FT × 20FT) · SÂN {activeMatch.courtNumber}
            </h2>
            <p className={`text-[11px] sm:text-xs ${mutedText}`}>
              Chấm sáng là VĐV đang giao bóng · Chạm vào chấm VĐV để thay người nhanh
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-[11px] sm:text-xs font-mono-num">
            <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg bg-orange-500/15 text-orange-500 font-bold truncate max-w-[145px] sm:max-w-[200px]">
              Trái: {leftTeamLabel}
            </span>
            <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg bg-sky-500/15 text-sky-500 font-bold truncate max-w-[145px] sm:max-w-[200px]">
              Phải: {rightTeamLabel}
            </span>
          </div>
        </div>

        {/* Khung sân co giãn hoàn toàn theo chiều rộng điện thoại / Tab / Desktop */}
        <div
          className={`rounded-2xl border p-2.5 sm:p-5 ${
            isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'
          }`}
        >
          <div className="w-full max-w-4xl mx-auto [perspective:950px]">
            {/* Tỷ lệ chuẩn sân Pickleball: 44ft dài / 20ft rộng = aspect-[22/10] */}
            <div
              style={{ transform: 'rotateX(12deg)' }}
              className="relative w-full aspect-[22/10] rounded-xl sm:rounded-2xl border-[3px] sm:border-4 border-white shadow-xl bg-emerald-700 overflow-hidden select-none"
            >
              {/* Chia chiều dài 44ft: 15ft (34.09%) + 7ft (15.91%) + 7ft (15.91%) + 15ft (34.09%) */}
              <div className="w-full h-full flex relative">
                {/* 1. Khu vực giao bóng Trái (15ft = 34.09%) */}
                <div className="w-[34.09%] h-full border-r-2 border-white flex flex-col relative">
                  {/* Ô trên (Left-Even / Odd) */}
                  <div className="flex-1 border-b border-white/85 flex items-center justify-center p-1 sm:p-2 relative">
                    <button
                      type="button"
                      onClick={() => handleOpenSubstitute(leftTeamKey, 1)}
                      className="group flex flex-col sm:flex-row items-center gap-1 sm:gap-2 max-w-full"
                      title="Chạm để thay VĐV"
                    >
                      <span
                        className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 border-white shadow-md shrink-0 transition-transform group-hover:scale-110 flex items-center justify-center ${
                          activeMatch.servingTeam === leftTeamKey &&
                          activeMatch.serverNumber === 1
                            ? 'bg-amber-400 ring-4 ring-amber-300/70'
                            : leftTeamKey === 'A'
                            ? 'bg-orange-500'
                            : 'bg-sky-500'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-950" />
                      </span>
                      <span className="px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-md bg-slate-950/75 text-white text-[10px] sm:text-xs font-bold truncate max-w-[92px] sm:max-w-[140px]">
                        {leftPlayers[0]}
                      </span>
                    </button>
                  </div>

                  {/* Ô dưới */}
                  <div className="flex-1 border-t border-white/85 flex items-center justify-center p-1 sm:p-2 relative">
                    <button
                      type="button"
                      onClick={() => handleOpenSubstitute(leftTeamKey, 2)}
                      className="group flex flex-col sm:flex-row items-center gap-1 sm:gap-2 max-w-full"
                      title="Chạm để thay VĐV"
                    >
                      <span
                        className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 border-white shadow-md shrink-0 transition-transform group-hover:scale-110 flex items-center justify-center ${
                          activeMatch.servingTeam === leftTeamKey &&
                          activeMatch.serverNumber === 2
                            ? 'bg-amber-400 ring-4 ring-amber-300/70'
                            : leftTeamKey === 'A'
                            ? 'bg-orange-500'
                            : 'bg-sky-500'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-950" />
                      </span>
                      <span className="px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-md bg-slate-950/75 text-white text-[10px] sm:text-xs font-bold truncate max-w-[92px] sm:max-w-[140px]">
                        {leftPlayers[1]}
                      </span>
                    </button>
                  </div>
                </div>

                {/* 2. Kitchen Trái (7ft = 15.91%) */}
                <div className="w-[15.91%] h-full bg-emerald-800/75 border-r border-white/70 flex items-center justify-center">
                  <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-white/55 -rotate-90 whitespace-nowrap">
                    NVZ 7FT
                  </span>
                </div>

                {/* 3. Kitchen Phải (7ft = 15.91%) */}
                <div className="w-[15.91%] h-full bg-emerald-800/75 border-l border-white/70 flex items-center justify-center">
                  <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-white/55 rotate-90 whitespace-nowrap">
                    NVZ 7FT
                  </span>
                </div>

                {/* 4. Khu vực giao bóng Phải (15ft = 34.09%) */}
                <div className="w-[34.09%] h-full border-l-2 border-white flex flex-col relative">
                  {/* Ô trên */}
                  <div className="flex-1 border-b border-white/85 flex items-center justify-center p-1 sm:p-2 relative">
                    <button
                      type="button"
                      onClick={() => handleOpenSubstitute(rightTeamKey, 1)}
                      className="group flex flex-col sm:flex-row-reverse items-center gap-1 sm:gap-2 max-w-full"
                      title="Chạm để thay VĐV"
                    >
                      <span
                        className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 border-white shadow-md shrink-0 transition-transform group-hover:scale-110 flex items-center justify-center ${
                          activeMatch.servingTeam === rightTeamKey &&
                          activeMatch.serverNumber === 1
                            ? 'bg-amber-400 ring-4 ring-amber-300/70'
                            : rightTeamKey === 'A'
                            ? 'bg-orange-500'
                            : 'bg-sky-500'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-950" />
                      </span>
                      <span className="px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-md bg-slate-950/75 text-white text-[10px] sm:text-xs font-bold truncate max-w-[92px] sm:max-w-[140px]">
                        {rightPlayers[0]}
                      </span>
                    </button>
                  </div>

                  {/* Ô dưới */}
                  <div className="flex-1 border-t border-white/85 flex items-center justify-center p-1 sm:p-2 relative">
                    <button
                      type="button"
                      onClick={() => handleOpenSubstitute(rightTeamKey, 2)}
                      className="group flex flex-col sm:flex-row-reverse items-center gap-1 sm:gap-2 max-w-full"
                      title="Chạm để thay VĐV"
                    >
                      <span
                        className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 border-white shadow-md shrink-0 transition-transform group-hover:scale-110 flex items-center justify-center ${
                          activeMatch.servingTeam === rightTeamKey &&
                          activeMatch.serverNumber === 2
                            ? 'bg-amber-400 ring-4 ring-amber-300/70'
                            : rightTeamKey === 'A'
                            ? 'bg-orange-500'
                            : 'bg-sky-500'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-950" />
                      </span>
                      <span className="px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-md bg-slate-950/75 text-white text-[10px] sm:text-xs font-bold truncate max-w-[92px] sm:max-w-[140px]">
                        {rightPlayers[1]}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Lưới trung tâm chính xác tại mốc 50% (22ft) */}
                <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-1 sm:w-1.5 bg-white shadow-md pointer-events-none flex items-start justify-center">
                  <span className="mt-1 px-1.5 py-0.5 rounded bg-slate-950/80 text-[9px] sm:text-[10px] font-extrabold text-white uppercase">
                    Lưới
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bảng điểm chính + Time out */}
      <section className={`border rounded-2xl p-3.5 sm:p-5 space-y-3.5 sm:space-y-4 ${cardSurface}`}>
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

        <div className="grid grid-cols-1 md:grid-cols-11 gap-3 sm:gap-4 items-center">
          {/* Đội A */}
          <div
            className={`md:col-span-5 border rounded-2xl p-3 sm:p-4 space-y-2.5 sm:space-y-3 min-w-0 ${subSurface}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-orange-500">
                ĐỘI A ({activeMatch.courtSideA === 'left' ? 'SÂN TRÁI' : 'SÂN PHẢI'})
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {activeMatch.servingTeam === 'A' && (
                  <span className="px-2 py-0.5 rounded-md bg-orange-600 text-white text-[10px] font-bold whitespace-nowrap">
                    ● GIAO (N{activeMatch.serverNumber})
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => handleStartTimeout('A')}
                  className={`min-h-[30px] px-2.5 py-1 rounded-lg border text-[11px] font-bold inline-flex items-center gap-1 transition-colors ${
                    isDark
                      ? 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-amber-300'
                      : 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-800'
                  }`}
                >
                  <Timer className="w-3.5 h-3.5 shrink-0" />
                  <span>Time out ({activeMatch.timeoutsA || 0})</span>
                </button>
              </div>
            </div>

            <div className="font-display text-base sm:text-xl font-extrabold truncate">
              {activeMatch.teamAName}
            </div>
            {(activeMatch.teamAPlayer1 || activeMatch.teamAPlayer2) && (
              <div className={`text-xs truncate ${mutedText}`}>
                {activeMatch.teamAPlayer1}{' '}
                {activeMatch.teamAPlayer2 && `· ${activeMatch.teamAPlayer2}`}
              </div>
            )}

            <div className="flex items-center justify-between gap-2 pt-1.5">
              <div className="font-mono-num text-4xl sm:text-5xl font-extrabold">
                {activeMatch.scoreA}
              </div>
              <button
                type="button"
                onClick={() => handleScorePoint('A')}
                className="min-h-[46px] px-4 sm:px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 active:scale-[0.98] text-white text-xs sm:text-sm font-extrabold inline-flex items-center gap-1.5 shadow-sm transition-all whitespace-nowrap"
              >
                <Plus className="w-5 h-5 shrink-0" />
                <span>+1 ĐIỂM A</span>
              </button>
            </div>
          </div>

          {/* Tỉ số trung tâm */}
          <div className="md:col-span-1 text-center font-mono-num text-xl sm:text-2xl font-extrabold py-0.5">
            {activeMatch.scoreA} : {activeMatch.scoreB}
          </div>

          {/* Đội B */}
          <div
            className={`md:col-span-5 border rounded-2xl p-3 sm:p-4 space-y-2.5 sm:space-y-3 min-w-0 ${subSurface}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-sky-500">
                ĐỘI B ({activeMatch.courtSideA === 'left' ? 'SÂN PHẢI' : 'SÂN TRÁI'})
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {activeMatch.servingTeam === 'B' && (
                  <span className="px-2 py-0.5 rounded-md bg-sky-600 text-white text-[10px] font-bold whitespace-nowrap">
                    ● GIAO (N{activeMatch.serverNumber})
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => handleStartTimeout('B')}
                  className={`min-h-[30px] px-2.5 py-1 rounded-lg border text-[11px] font-bold inline-flex items-center gap-1 transition-colors ${
                    isDark
                      ? 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-amber-300'
                      : 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-800'
                  }`}
                >
                  <Timer className="w-3.5 h-3.5 shrink-0" />
                  <span>Time out ({activeMatch.timeoutsB || 0})</span>
                </button>
              </div>
            </div>

            <div className="font-display text-base sm:text-xl font-extrabold truncate">
              {activeMatch.teamBName}
            </div>
            {(activeMatch.teamBPlayer1 || activeMatch.teamBPlayer2) && (
              <div className={`text-xs truncate ${mutedText}`}>
                {activeMatch.teamBPlayer1}{' '}
                {activeMatch.teamBPlayer2 && `· ${activeMatch.teamBPlayer2}`}
              </div>
            )}

            <div className="flex items-center justify-between gap-2 pt-1.5">
              <div className="font-mono-num text-4xl sm:text-5xl font-extrabold">
                {activeMatch.scoreB}
              </div>
              <button
                type="button"
                onClick={() => handleScorePoint('B')}
                className="min-h-[46px] px-4 sm:px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 active:scale-[0.98] text-white text-xs sm:text-sm font-extrabold inline-flex items-center gap-1.5 shadow-sm transition-all whitespace-nowrap"
              >
                <Plus className="w-5 h-5 shrink-0" />
                <span>+1 ĐIỂM B</span>
              </button>
            </div>
          </div>
        </div>

        {/* Thanh điều khiển phụ */}
        <div
          className={`pt-3 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
            isDark ? 'border-slate-800' : 'border-slate-200'
          }`}
        >
          <div className="grid grid-cols-3 sm:flex sm:flex-wrap items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={handleRotateServer}
              className={`min-h-[38px] px-2.5 sm:px-3 py-2 rounded-xl border text-xs font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap ${
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
              onClick={handleUndoPoint}
              className={`min-h-[38px] px-2.5 sm:px-3 py-2 rounded-xl border text-xs font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap ${
                isDark
                  ? 'bg-slate-950 hover:bg-slate-800 border-slate-700 text-slate-200'
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>Hoàn tác</span>
            </button>

            <button
              type="button"
              onClick={() =>
                onUpdateMatch(activeMatch.id, {
                  courtSideA: activeMatch.courtSideA === 'left' ? 'right' : 'left',
                  sideSwitched: !activeMatch.sideSwitched,
                })
              }
              className={`min-h-[38px] px-2.5 sm:px-3 py-2 rounded-xl border text-xs font-bold inline-flex items-center justify-center whitespace-nowrap ${
                isDark
                  ? 'bg-slate-950 hover:bg-slate-800 border-slate-700 text-slate-200'
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
              }`}
            >
              Đổi sân
            </button>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => onCompleteMatch(activeMatch, 'A')}
              className="min-h-[38px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <Flag className="w-3.5 h-3.5 shrink-0" />
              <span>Đội A thắng</span>
            </button>

            <button
              type="button"
              onClick={() => onCompleteMatch(activeMatch, 'B')}
              className="min-h-[38px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <Flag className="w-3.5 h-3.5 shrink-0" />
              <span>Đội B thắng</span>
            </button>

            {isTeam && (
              <button
                type="button"
                onClick={() => onCompleteMatch(activeMatch, '')}
                className={`col-span-2 sm:col-span-1 min-h-[38px] px-3 py-2 rounded-xl border text-xs font-bold inline-flex items-center justify-center whitespace-nowrap ${
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
              className={`flex-1 min-w-[160px] min-h-[36px] px-3 py-1 text-xs border rounded-xl ${inputSurface}`}
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

      {/* POPUP TIME OUT (ĐÚNG GIAO DIỆN HỆ THỐNG) */}
      {timeoutModal && (
        <div
          onClick={() => setTimeoutModal(null)}
          className="fixed inset-0 z-50 bg-slate-950/75 p-4 flex items-center justify-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`border rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl ${cardSurface}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-amber-500">
                  HỘI Ý KỸ THUẬT · SÂN {activeMatch.courtNumber}
                </div>
                <h3 className="font-display text-lg font-bold mt-0.5">
                  Time out —{' '}
                  {timeoutModal.team === 'A' ? activeMatch.teamAName : activeMatch.teamBName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setTimeoutModal(null)}
                className={`p-1.5 rounded-lg ${mutedText}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className={`border rounded-2xl p-6 text-center space-y-2 ${subSurface}`}>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-500">
                <Timer className="w-4 h-4" />
                <span>Thời gian hội ý còn lại</span>
              </div>
              <div
                className={`font-mono-num text-5xl sm:text-6xl font-extrabold tracking-tight ${
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
                className={`min-h-[40px] px-3 py-2 rounded-xl border text-xs font-bold inline-flex items-center justify-center gap-1.5 ${subSurface}`}
              >
                {timeoutModal.running ? (
                  <>
                    <PauseCircle className="w-4 h-4 text-amber-500" />
                    <span>Tạm dừng</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 text-emerald-500" />
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
                className={`min-h-[40px] px-3 py-2 rounded-xl border text-xs font-bold inline-flex items-center justify-center gap-1.5 ${subSurface}`}
              >
                <RotateCcw className="w-4 h-4" />
                <span>Đặt lại 60s</span>
              </button>

              <button
                type="button"
                onClick={() => setTimeoutModal(null)}
                className="min-h-[40px] px-3 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-extrabold inline-flex items-center justify-center"
              >
                Kết thúc
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP THAY VĐV (ĐÚNG GIAO DIỆN HỆ THỐNG) */}
      {showSubstituteModal && (
        <div
          onClick={() => setShowSubstituteModal(false)}
          className="fixed inset-0 z-50 bg-slate-950/75 p-4 flex items-center justify-center"
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
          className="fixed inset-0 z-50 bg-slate-950/75 p-4 flex items-center justify-center"
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

            {/* 1. Chọn bóng: chỉ thiết lập lượt giao bóng */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold">Chọn bóng (chỉ giao bóng):</label>
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
