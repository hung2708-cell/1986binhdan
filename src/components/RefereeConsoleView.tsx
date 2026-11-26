/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Award,
  CheckCircle2,
  ChevronDown,
  Clock,
  Flag,
  Megaphone,
  Minus,
  Plus,
  RefreshCw,
  RotateCcw,
  Shuffle,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  MATCH_STAGE_LABELS,
  TEAM_EVENT_SUBCATEGORIES,
  type Match,
  type Registration,
  type StaffAccount,
  type TeamLineupSlot,
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
  onRequestLogin?: (reason: string) => void;
  onSelectMatch: (matchId: string) => void;
  onUpdateMatch: (matchId: string, patch: Partial<Match>) => void;
  onCompleteMatch: (match: Match, winnerSide: '' | 'A' | 'B') => void;
  onAnnounceCourtCall: (match: Match) => void;
  onAnnounceCourtAvailable?: (finishedMatch: Match) => void;
  onAddRosterAthlete?: (registrationId: string, athleteLabel: string) => void;
}

function getNormalizedLineupSlots(match: Match): TeamLineupSlot[] {
  if (Array.isArray(match.teamLineupSlots) && match.teamLineupSlots.length > 0) {
    return match.teamLineupSlots.map((slot, index) => ({
      ...slot,
      order: slot.order ?? index + 1,
      label: slot.label || TEAM_EVENT_SUBCATEGORIES[index] || `Trận nhỏ ${index + 1}`,
      scoreA: slot.scoreA ?? 0,
      scoreB: slot.scoreB ?? 0,
      completed: Boolean(slot.completed),
      winnerSide: slot.winnerSide ?? '',
    }));
  }

  const aParts = (match.teamAName || '')
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean);
  const bParts = (match.teamBName || '')
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean);

  const a1 = match.teamAPlayer1 || aParts[0] || 'VĐV A1';
  const a2 = match.teamAPlayer2 || aParts[1] || 'VĐV A2';
  const b1 = match.teamBPlayer1 || bParts[0] || 'VĐV B1';
  const b2 = match.teamBPlayer2 || bParts[1] || 'VĐV B2';

  return TEAM_EVENT_SUBCATEGORIES.map((label, index) => ({
    order: index + 1,
    label,
    teamAPlayer1: a1,
    teamAPlayer2: a2,
    teamBPlayer1: b1,
    teamBPlayer2: b2,
    scoreA: 0,
    scoreB: 0,
    completed: false,
    winnerSide: '',
  }));
}

function shortenPlayerName(rawName: string): string {
  const cleaned = rawName.replace(/\([^)]*\)/g, '').trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length <= 2) return cleaned;
  return parts.slice(-2).join(' ');
}

function hasReachedTargetScore(scoreA: number, scoreB: number, pointsToWin: number): boolean {
  const target = Math.max(1, pointsToWin || 15);
  return scoreA >= target || scoreB >= target;
}

interface Player3DTokenProps {
  name: string;
  isServing: boolean;
  isReceiver: boolean;
  align: 'left' | 'right';
}

const Player3DToken: React.FC<Player3DTokenProps> = ({
  name,
  isServing,
  isReceiver,
  align,
}) => {
  const shortName = shortenPlayerName(name);
  const pillStyle = isServing
    ? 'bg-amber-400 text-slate-950 ring-2 ring-white shadow-md'
    : isReceiver
    ? 'bg-cyan-300 text-slate-950 ring-2 ring-white/90 shadow-md'
    : 'bg-slate-950/80 text-white border border-white/25';

  return (
    <div
      title={name}
      className={`inline-flex items-center gap-1 max-w-full ${
        align === 'right' ? 'flex-row-reverse text-right' : 'flex-row text-left'
      }`}
    >
      <svg
        viewBox="0 0 28 32"
        className="w-3.5 h-3.5 sm:w-5 sm:h-6 shrink-0 drop-shadow-[0_3px_2px_rgba(0,0,0,0.75)]"
        aria-hidden="true"
      >
        <ellipse cx="14" cy="29.5" rx="9.5" ry="2.2" fill="rgba(2,6,23,0.5)" />
        <circle
          cx="14"
          cy="8.5"
          r="5"
          fill={isServing ? '#FACC15' : isReceiver ? '#67E8F9' : '#F8FAFC'}
          stroke="#0F172A"
          strokeWidth="1.6"
        />
        <path
          d="M5.5 25.5C5.5 19.8 9.2 16.5 14 16.5C18.8 16.5 22.5 19.8 22.5 25.5V27.5H5.5V25.5Z"
          fill={isServing ? '#F59E0B' : isReceiver ? '#06B6D4' : '#E2E8F0'}
          stroke="#0F172A"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>

      <span
        className={`inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[11px] font-bold truncate max-w-[70px] sm:max-w-[124px] landscape:max-w-[68px] ${pillStyle}`}
      >
        <span className="truncate">{shortName}</span>
        {isServing && (
          <span className="px-1 rounded bg-slate-950 text-amber-300 text-[7px] sm:text-[8px] font-black shrink-0">
            PHÁT
          </span>
        )}
        {isReceiver && !isServing && (
          <span className="px-1 rounded bg-slate-950 text-cyan-300 text-[7px] sm:text-[8px] font-black shrink-0">
            ĐỠ
          </span>
        )}
      </span>
    </div>
  );
};

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
  const isStaff = Boolean(
    currentAccount && (currentAccount.role === 'admin' || currentAccount.role === 'referee'),
  );
  const isAdmin = currentAccount?.role === 'admin';

  const courtNumbers = useMemo(
    () => Array.from({ length: Math.max(1, tournament.courtsCount) }, (_, i) => i + 1),
    [tournament.courtsCount],
  );

  const [selectedCourt, setSelectedCourt] = useState<number>(1);
  const [notice, setNotice] = useState<string | null>(null);
  const [showLineupEditor, setShowLineupEditor] = useState(false);
  const [showSubmatchModal, setShowSubmatchModal] = useState(false);

  const [editA1, setEditA1] = useState('');
  const [editA2, setEditA2] = useState('');
  const [editB1, setEditB1] = useState('');
  const [editB2, setEditB2] = useState('');
  const [newRosterNameA, setNewRosterNameA] = useState('');
  const [newRosterNameB, setNewRosterNameB] = useState('');

  const courtMatches = useMemo(
    () =>
      matches
        .filter((m) => m.courtNumber === selectedCourt)
        .sort((a, b) => {
          const rank = (s: Match['status']) => (s === 'live' ? 0 : s === 'scheduled' ? 1 : 2);
          return rank(a.status) !== rank(b.status)
            ? rank(a.status) - rank(b.status)
            : a.matchNumber - b.matchNumber;
        }),
    [matches, selectedCourt],
  );

  const activeMatch = useMemo(() => {
    if (selectedMatchId) {
      const explicit = matches.find((m) => m.id === selectedMatchId);
      if (explicit) return explicit;
    }
    return (
      courtMatches.find((m) => m.status === 'live') ||
      courtMatches.find((m) => m.status === 'scheduled') ||
      courtMatches[0] ||
      matches.find((m) => m.status === 'live') ||
      matches[0] ||
      null
    );
  }, [selectedMatchId, matches, courtMatches]);

  useEffect(() => {
    if (activeMatch && activeMatch.courtNumber !== selectedCourt) {
      setSelectedCourt(activeMatch.courtNumber);
    }
  }, [activeMatch?.id, activeMatch?.courtNumber, selectedCourt]);

  useEffect(() => {
    if (!activeMatch) return;
    setEditA1(activeMatch.teamAPlayer1 || '');
    setEditA2(activeMatch.teamAPlayer2 || '');
    setEditB1(activeMatch.teamBPlayer1 || '');
    setEditB2(activeMatch.teamBPlayer2 || '');
    setNotice(null);
  }, [
    activeMatch?.id,
    activeMatch?.teamAPlayer1,
    activeMatch?.teamAPlayer2,
    activeMatch?.teamBPlayer1,
    activeMatch?.teamBPlayer2,
  ]);

  const requireStaffAction = (reason: string, action: () => void) => {
    if (!isStaff) {
      onRequestLogin?.(reason);
      return;
    }
    action();
  };

  const requireAdminAction = (reason: string, action: () => void) => {
    if (!isAdmin) {
      onRequestLogin?.(reason);
      return;
    }
    action();
  };

  const isTeamMatch = activeMatch
    ? isTeamDivision(activeMatch.division, activeMatch.competitionType)
    : false;

  const lineupSlots = useMemo(
    () => (activeMatch && isTeamMatch ? getNormalizedLineupSlots(activeMatch) : []),
    [activeMatch, isTeamMatch],
  );

  const activeSlotOrder = activeMatch?.activeSlotOrder || 1;
  const currentSlot =
    lineupSlots.find((s) => s.order === activeSlotOrder) || lineupSlots[0] || null;

  const doublesSubmatches = useMemo(
    () =>
      isTeamMatch
        ? lineupSlots
        : TEAM_EVENT_SUBCATEGORIES.map((label, idx) => ({
            order: idx + 1,
            label,
            teamAPlayer1: activeMatch?.teamAPlayer1 || 'VĐV A1',
            teamAPlayer2: activeMatch?.teamAPlayer2 || 'VĐV A2',
            teamBPlayer1: activeMatch?.teamBPlayer1 || 'VĐV B1',
            teamBPlayer2: activeMatch?.teamBPlayer2 || 'VĐV B2',
            scoreA: idx === 0 && activeMatch ? activeMatch.scoreA : 0,
            scoreB: idx === 0 && activeMatch ? activeMatch.scoreB : 0,
            completed: false,
            winnerSide: '' as const,
          })),
    [isTeamMatch, lineupSlots, activeMatch],
  );

  const activeSubmatch =
    doublesSubmatches.find((s) => s.order === activeSlotOrder) || doublesSubmatches[0];

  const regTeamA = useMemo(
    () =>
      activeMatch
        ? registrations.find(
            (r) => r.id === activeMatch.teamAId || r.teamName === activeMatch.teamAName,
          )
        : undefined,
    [registrations, activeMatch],
  );

  const regTeamB = useMemo(
    () =>
      activeMatch
        ? registrations.find(
            (r) => r.id === activeMatch.teamBId || r.teamName === activeMatch.teamBName,
          )
        : undefined,
    [registrations, activeMatch],
  );

  const availablePoolA = useMemo(() => {
    const fromRoster = regTeamA?.squadRoster || [];
    const fromPlayers = [
      activeMatch?.teamAPlayer1,
      activeMatch?.teamAPlayer2,
      ...(activeMatch?.teamAName || '').split('/').map((s) => s.trim()),
    ].filter(Boolean) as string[];
    const fromAllRegs = registrations
      .filter((r) => r.tournamentId === tournament.id)
      .flatMap((r) => r.squadRoster || [r.player1Name, r.player2Name].filter(Boolean));
    return Array.from(new Set([...fromRoster, ...fromPlayers, ...fromAllRegs]));
  }, [regTeamA, activeMatch, registrations, tournament.id]);

  const availablePoolB = useMemo(() => {
    const fromRoster = regTeamB?.squadRoster || [];
    const fromPlayers = [
      activeMatch?.teamBPlayer1,
      activeMatch?.teamBPlayer2,
      ...(activeMatch?.teamBName || '').split('/').map((s) => s.trim()),
    ].filter(Boolean) as string[];
    const fromAllRegs = registrations
      .filter((r) => r.tournamentId === tournament.id)
      .flatMap((r) => r.squadRoster || [r.player1Name, r.player2Name].filter(Boolean));
    return Array.from(new Set([...fromRoster, ...fromPlayers, ...fromAllRegs]));
  }, [regTeamB, activeMatch, registrations, tournament.id]);

  const isMatchFinished = activeMatch
    ? activeMatch.status === 'completed' ||
      Boolean(activeMatch.winnerSide) ||
      hasReachedTargetScore(activeMatch.scoreA, activeMatch.scoreB, activeMatch.pointsToWin)
    : false;

  const canScoreSide = (side: 'A' | 'B'): boolean => {
    if (!activeMatch || isMatchFinished) return false;
    if (activeMatch.status === 'live' && activeMatch.scoringMode !== 'rally') {
      return activeMatch.servingTeam === side;
    }
    return true;
  };

  // Khi Tay 1 (serverNumber === 1) ghi điểm (+1) -> đổi chỗ 2 VĐV của đội đang giao trên sân
  const adjustScore = (side: 'A' | 'B', delta: number) => {
    if (!activeMatch) return;
    requireStaffAction(
      'Vui lòng đăng nhập tài khoản Trọng tài hoặc Ban Tổ Chức để ghi và cập nhật điểm trên sân.',
      () => {
        if (delta > 0) {
          if (isMatchFinished) {
            setNotice(`Trận đã chạm mốc ${activeMatch.pointsToWin} điểm, không thể cộng thêm.`);
            return;
          }
          if (!canScoreSide(side)) {
            setNotice('Bên đang ĐỠ không thể trực tiếp ghi điểm. Hãy bấm "Đổi giao".');
            return;
          }
        }

        const nextA = side === 'A' ? Math.max(0, activeMatch.scoreA + delta) : activeMatch.scoreA;
        const nextB = side === 'B' ? Math.max(0, activeMatch.scoreB + delta) : activeMatch.scoreB;

        const currentServer = activeMatch.serverNumber || 2;
        const isScoringTeamServing = activeMatch.servingTeam === side;
        const shouldSwapServingTeamPlayers =
          delta > 0 &&
          activeMatch.status === 'live' &&
          isScoringTeamServing &&
          currentServer === 1;

        let nextA1 = activeMatch.teamAPlayer1 || '';
        let nextA2 = activeMatch.teamAPlayer2 || '';
        let nextB1 = activeMatch.teamBPlayer1 || '';
        let nextB2 = activeMatch.teamBPlayer2 || '';

        if (shouldSwapServingTeamPlayers) {
          if (side === 'A') {
            const temp = nextA1;
            nextA1 = nextA2;
            nextA2 = temp;
          } else {
            const temp = nextB1;
            nextB1 = nextB2;
            nextB2 = temp;
          }
        }

        const shouldAutoSwitchServe =
          delta > 0 &&
          activeMatch.status === 'live' &&
          activeMatch.servingTeam !== side &&
          activeMatch.scoringMode === 'rally';

        const nextServingTeam = shouldAutoSwitchServe ? side : activeMatch.servingTeam;
        const nextServerNumber: 1 | 2 = shouldAutoSwitchServe
          ? 1
          : activeMatch.serverNumber === 1
          ? 1
          : 2;

        const updatedSlots =
          isTeamMatch && lineupSlots.length > 0
            ? lineupSlots.map((slot) =>
                slot.order === activeSlotOrder
                  ? {
                      ...slot,
                      teamAPlayer1: nextA1,
                      teamAPlayer2: nextA2,
                      teamBPlayer1: nextB1,
                      teamBPlayer2: nextB2,
                      scoreA: nextA,
                      scoreB: nextB,
                    }
                  : slot,
              )
            : undefined;

        const nextHistory = [
          ...(activeMatch.scoreHistory || []),
          {
            timestamp: new Date().toLocaleTimeString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }),
            side,
            delta,
            scoreAfter: `${nextA}-${nextB}`,
            slotOrder: isTeamMatch ? activeSlotOrder : undefined,
          },
        ];

        const hitTarget = hasReachedTargetScore(nextA, nextB, activeMatch.pointsToWin);

        onUpdateMatch(activeMatch.id, {
          status: activeMatch.status === 'scheduled' ? 'live' : activeMatch.status,
          startedAtMs: activeMatch.startedAtMs || Date.now(),
          teamAPlayer1: nextA1,
          teamAPlayer2: nextA2,
          teamBPlayer1: nextB1,
          teamBPlayer2: nextB2,
          scoreA: nextA,
          scoreB: nextB,
          servingTeam: nextServingTeam,
          serverNumber: nextServerNumber,
          teamLineupSlots: updatedSlots,
          scoreHistory: nextHistory,
        });

        if (delta > 0 && hitTarget) {
          setNotice(`Đã chạm mốc ${activeMatch.pointsToWin} điểm. Hãy xác nhận đội thắng hoặc đặt lại.`);
        } else if (shouldSwapServingTeamPlayers) {
          setNotice(`Tay 1 ghi điểm (${nextA}-${nextB}) · Đổi chỗ 2 VĐV đội ${side}.`);
        }
      },
    );
  };

  // Mất điểm / Đổi giao:
  // - Nếu đang Tay 1 (serverNumber === 1) mất điểm -> chuyển sang Tay 2 (serverNumber: 2) của cùng đội.
  // - Nếu đang Tay 2 (serverNumber === 2) mất điểm -> đổi tay sang đội đối phương (Tay 1, hoặc Tay 2 nếu 0-0).
  const handleToggleServe = () => {
    if (!activeMatch) return;
    requireStaffAction(
      'Vui lòng đăng nhập tài khoản Trọng tài hoặc Ban Tổ Chức để đổi lượt giao bóng.',
      () => {
        if (activeMatch.scoringMode === 'rally') {
          onUpdateMatch(activeMatch.id, {
            servingTeam: activeMatch.servingTeam === 'A' ? 'B' : 'A',
            serverNumber: 1,
          });
          return;
        }

        const currentServer = activeMatch.serverNumber || 2;
        if (currentServer === 1) {
          onUpdateMatch(activeMatch.id, { serverNumber: 2 });
          setNotice(`Mất điểm ở Tay 1 · Chuyển sang Tay 2 của đội ${activeMatch.servingTeam}.`);
        } else {
          const nextTeam: 'A' | 'B' = activeMatch.servingTeam === 'A' ? 'B' : 'A';
          const isOpeningZeroZero = activeMatch.scoreA === 0 && activeMatch.scoreB === 0;
          const nextServer: 1 | 2 = isOpeningZeroZero ? 2 : 1;
          onUpdateMatch(activeMatch.id, {
            servingTeam: nextTeam,
            serverNumber: nextServer,
          });
          setNotice(`Mất điểm ở Tay 2 · Đổi tay giao sang đội ${nextTeam} (Tay ${nextServer}).`);
        }
      },
    );
  };

  const handleSwitchCourtEnds = () => {
    if (!activeMatch) return;
    requireStaffAction(
      'Vui lòng đăng nhập tài khoản Trọng tài hoặc Ban Tổ Chức để đổi sân.',
      () => {
        const nextSideA = activeMatch.courtSideA === 'left' ? 'right' : 'left';
        onUpdateMatch(activeMatch.id, {
          courtSideA: nextSideA,
          sideSwitched: !activeMatch.sideSwitched,
        });
      },
    );
  };

  const handleToggleTimeout = (side: 'A' | 'B') => {
    if (!activeMatch) return;
    requireStaffAction(
      'Vui lòng đăng nhập tài khoản Trọng tài hoặc Ban Tổ Chức để bấm Timeout hội ý.',
      () => {
        if (side === 'A') {
          onUpdateMatch(activeMatch.id, {
            timeoutsA: activeMatch.timeoutsA >= 2 ? 0 : activeMatch.timeoutsA + 1,
          });
        } else {
          onUpdateMatch(activeMatch.id, {
            timeoutsB: activeMatch.timeoutsB >= 2 ? 0 : activeMatch.timeoutsB + 1,
          });
        }
      },
    );
  };

  const handleDrawStartingServeAndSide = () => {
    if (!activeMatch) return;
    requireStaffAction(
      'Vui lòng đăng nhập tài khoản Trọng tài hoặc Ban Tổ Chức để bốc thăm giao bóng và chọn sân.',
      () => {
        const coinForServe: 'A' | 'B' = Math.random() < 0.5 ? 'A' : 'B';
        const coinForSideA: 'left' | 'right' = Math.random() < 0.5 ? 'left' : 'right';
        const starterLabel = coinForServe === 'A' ? activeMatch.teamAName : activeMatch.teamBName;
        const sideLabel = coinForSideA === 'left' ? 'Bên Trái' : 'Bên Phải';

        onUpdateMatch(activeMatch.id, {
          status: activeMatch.status === 'scheduled' ? 'live' : activeMatch.status,
          startedAtMs: activeMatch.startedAtMs || Date.now(),
          scoreA: 0,
          scoreB: 0,
          servingTeam: coinForServe,
          serverNumber: 2,
          courtSideA: coinForSideA,
        });

        setNotice(`0-0-2: ${starterLabel} phát · Đội A đứng ${sideLabel}.`);
      },
    );
  };

  const handleSelectTeamSlot = (slotOrder: number) => {
    if (!activeMatch) return;
    requireStaffAction(
      'Vui lòng đăng nhập tài khoản Trọng tài hoặc Ban Tổ Chức để chuyển trận nhỏ đồng đội.',
      () => {
        const targetSlot = doublesSubmatches.find((s) => s.order === slotOrder);
        if (!targetSlot) return;

        onUpdateMatch(activeMatch.id, {
          status: activeMatch.status === 'scheduled' ? 'live' : activeMatch.status,
          startedAtMs: activeMatch.startedAtMs || Date.now(),
          activeSlotOrder: slotOrder,
          teamSubCategory: targetSlot.label,
          teamAPlayer1: targetSlot.teamAPlayer1,
          teamAPlayer2: targetSlot.teamAPlayer2,
          teamBPlayer1: targetSlot.teamBPlayer1,
          teamBPlayer2: targetSlot.teamBPlayer2,
          scoreA: targetSlot.scoreA,
          scoreB: targetSlot.scoreB,
          servingTeam: 'A',
          serverNumber: 2,
        });
        setShowSubmatchModal(false);
      },
    );
  };

  const handleSaveLineup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMatch) return;
    requireStaffAction(
      'Vui lòng đăng nhập tài khoản Trọng tài hoặc Ban Tổ Chức để cập nhật danh sách VĐV đứng sân.',
      () => {
        const cleanA1 = editA1.trim();
        const cleanA2 = editA2.trim();
        const cleanB1 = editB1.trim();
        const cleanB2 = editB2.trim();

        const updatedSlots =
          isTeamMatch && lineupSlots.length > 0
            ? lineupSlots.map((slot) =>
                slot.order === activeSlotOrder
                  ? {
                      ...slot,
                      teamAPlayer1: cleanA1,
                      teamAPlayer2: cleanA2,
                      teamBPlayer1: cleanB1,
                      teamBPlayer2: cleanB2,
                    }
                  : slot,
              )
            : undefined;

        onUpdateMatch(activeMatch.id, {
          teamAPlayer1: cleanA1,
          teamAPlayer2: cleanA2,
          teamBPlayer1: cleanB1,
          teamBPlayer2: cleanB2,
          teamLineupSlots: updatedSlots,
        });
        setShowLineupEditor(false);
        setNotice(
          `Đã cập nhật VĐV đứng sân: Đội A (${[cleanA1, cleanA2].filter(Boolean).join(' & ') || 'Chưa chọn'}) vs Đội B (${[cleanB1, cleanB2].filter(Boolean).join(' & ') || 'Chưa chọn'}).`,
        );
      },
    );
  };

  const handleQuickAddRoster = (side: 'A' | 'B') => {
    if (!activeMatch || !onAddRosterAthlete) return;
    const rawName = (side === 'A' ? newRosterNameA : newRosterNameB).trim();
    if (!rawName) return;
    const targetReg = side === 'A' ? regTeamA : regTeamB;
    if (!targetReg) return;

    requireAdminAction(
      'Chỉ tài khoản Ban Tổ Chức (Admin) mới được phép bổ sung VĐV mới vào danh sách đội.',
      () => {
        onAddRosterAthlete(targetReg.id, rawName);
        if (side === 'A') {
          if (!editA1) setEditA1(rawName);
          else if (!editA2) setEditA2(rawName);
          setNewRosterNameA('');
        } else {
          if (!editB1) setEditB1(rawName);
          else if (!editB2) setEditB2(rawName);
          setNewRosterNameB('');
        }
      },
    );
  };

  const handleTriggerCourtCall = () => {
    if (!activeMatch) return;
    requireStaffAction(
      'Vui lòng đăng nhập tài khoản Trọng tài hoặc Ban Tổ Chức để phát thông báo gọi VĐV vào sân.',
      () => {
        onAnnounceCourtCall(activeMatch);
        setNotice(
          `Đã phát thông báo gọi VĐV vào Sân ${activeMatch.courtNumber} cho Trận #${activeMatch.matchNumber}.`,
        );
      },
    );
  };

  const handleTriggerCourtAvailable = () => {
    if (!activeMatch) return;
    requireStaffAction(
      'Vui lòng đăng nhập tài khoản Trọng tài hoặc Ban Tổ Chức để báo sân trống và gọi VĐV trận tiếp theo.',
      () => {
        if (onAnnounceCourtAvailable) {
          onAnnounceCourtAvailable(activeMatch);
        } else {
          onAnnounceCourtCall(activeMatch);
        }
        setNotice(
          `Đã báo Sân ${activeMatch.courtNumber} trống và gửi thông báo mời VĐV trận tiếp theo vào sân.`,
        );
      },
    );
  };

  const handleFinishMatch = (winnerSide: '' | 'A' | 'B') => {
    if (!activeMatch) return;
    requireStaffAction(
      'Vui lòng đăng nhập tài khoản Trọng tài hoặc Ban Tổ Chức để xác nhận kết quả trận đấu.',
      () => {
        if (isTeamMatch && lineupSlots.length > 0) {
          const nextSlots = lineupSlots.map((slot) =>
            slot.order === activeSlotOrder
              ? {
                  ...slot,
                  scoreA: activeMatch.scoreA,
                  scoreB: activeMatch.scoreB,
                  completed: true,
                  winnerSide,
                }
              : slot,
          );
          const nextUnfinished = nextSlots.find(
            (s) => !s.completed && s.order !== activeSlotOrder,
          );
          if (nextUnfinished) {
            onUpdateMatch(activeMatch.id, {
              status: 'live',
              teamLineupSlots: nextSlots,
              activeSlotOrder: nextUnfinished.order,
              teamSubCategory: nextUnfinished.label,
              teamAPlayer1: nextUnfinished.teamAPlayer1,
              teamAPlayer2: nextUnfinished.teamAPlayer2,
              teamBPlayer1: nextUnfinished.teamBPlayer1,
              teamBPlayer2: nextUnfinished.teamBPlayer2,
              scoreA: nextUnfinished.scoreA,
              scoreB: nextUnfinished.scoreB,
              servingTeam: 'A',
              serverNumber: 2,
            });
            setNotice(
              `Đã lưu ${currentSlot?.label || 'Trận nhỏ'} (${activeMatch.scoreA}-${activeMatch.scoreB}). Chuyển sang ${nextUnfinished.label}.`,
            );
            return;
          }
        }
        onCompleteMatch(activeMatch, winnerSide);
      },
    );
  };

  const surfaceCard = isDark
    ? 'bg-slate-900 border-slate-800 text-slate-100'
    : 'bg-white border-slate-200 text-slate-900';

  const mutedText = isDark ? 'text-slate-400' : 'text-slate-500';

  if (matches.length === 0 || !activeMatch) {
    return (
      <div className={`border rounded-2xl p-5 text-center space-y-2 ${surfaceCard}`}>
        <p className={`text-sm ${mutedText}`}>Chưa có trận đấu nào được xếp lịch cho giải đấu này.</p>
      </div>
    );
  }

  const leftSideIsA = activeMatch.courtSideA !== 'right';
  const leftTeamLabel = leftSideIsA ? 'ĐỘI A · TRÁI' : 'ĐỘI B · TRÁI';
  const rightTeamLabel = leftSideIsA ? 'ĐỘI B · PHẢI' : 'ĐỘI A · PHẢI';

  const leftTeamName = leftSideIsA ? activeMatch.teamAName : activeMatch.teamBName;
  const rightTeamName = leftSideIsA ? activeMatch.teamBName : activeMatch.teamAName;

  const leftPlayers = leftSideIsA
    ? [activeMatch.teamAPlayer1, activeMatch.teamAPlayer2].filter(Boolean)
    : [activeMatch.teamBPlayer1, activeMatch.teamBPlayer2].filter(Boolean);
  const rightPlayers = leftSideIsA
    ? [activeMatch.teamBPlayer1, activeMatch.teamBPlayer2].filter(Boolean)
    : [activeMatch.teamAPlayer1, activeMatch.teamAPlayer2].filter(Boolean);

  const pLeftTop = leftPlayers[0] || (leftSideIsA ? 'VĐV A1' : 'VĐV B1');
  const pLeftBottom = leftPlayers[1] || (leftSideIsA ? 'VĐV A2' : 'VĐV B2');
  const pRightTop = rightPlayers[0] || (leftSideIsA ? 'VĐV B1' : 'VĐV A1');
  const pRightBottom = rightPlayers[1] || (leftSideIsA ? 'VĐV B2' : 'VĐV A2');

  const servingSide = activeMatch.servingTeam;
  const serverNum = activeMatch.serverNumber || 2;
  const servingScore = servingSide === 'A' ? activeMatch.scoreA : activeMatch.scoreB;
  const isServingScoreOdd = servingScore % 2 !== 0;

  const leftIsServing =
    (leftSideIsA && servingSide === 'A') || (!leftSideIsA && servingSide === 'B');
  const rightIsServing = !leftIsServing;

  const leftTopServing = leftIsServing && isServingScoreOdd;
  const leftBottomServing = leftIsServing && !isServingScoreOdd;
  const rightTopServing = rightIsServing && !isServingScoreOdd;
  const rightBottomServing = rightIsServing && isServingScoreOdd;

  const leftTopReceiver = rightIsServing && rightBottomServing;
  const leftBottomReceiver = rightIsServing && rightTopServing;
  const rightTopReceiver = leftIsServing && leftBottomServing;
  const rightBottomReceiver = leftIsServing && leftTopServing;

  const serverFullName = leftTopServing
    ? pLeftTop
    : leftBottomServing
    ? pLeftBottom
    : rightTopServing
    ? pRightTop
    : pRightBottom;

  const receiverFullName = leftTopReceiver
    ? pLeftTop
    : leftBottomReceiver
    ? pLeftBottom
    : rightTopReceiver
    ? pRightTop
    : pRightBottom;

  const serverDisplayName = shortenPlayerName(serverFullName);
  const receiverDisplayName = shortenPlayerName(receiverFullName);

  const arrowLine = leftIsServing
    ? leftTopServing
      ? { x1: 215, y1: 108, x2: 425, y2: 172 }
      : { x1: 215, y1: 172, x2: 425, y2: 108 }
    : rightTopServing
    ? { x1: 425, y1: 108, x2: 215, y2: 172 }
    : { x1: 425, y1: 172, x2: 215, y2: 108 };

  const leftCanPlus = canScoreSide(leftSideIsA ? 'A' : 'B');
  const rightCanPlus = canScoreSide(leftSideIsA ? 'B' : 'A');

  return (
    <div className="w-full max-w-full overflow-x-hidden overscroll-none space-y-1.5 sm:space-y-2.5 landscape:space-y-1 pb-12 sm:pb-0 landscape:pb-9">
      <section className="grid grid-cols-1 lg:grid-cols-12 landscape:grid-cols-12 gap-1.5 sm:gap-3 landscape:gap-1.5 items-start">
        {/* LEFT: SÂN + POPUP TRẬN NHỎ + 4 NÚT + SÂN 3D */}
        <div className="lg:col-span-6 landscape:col-span-6 min-w-0 space-y-1.5 sm:space-y-2.5 landscape:space-y-1">
          <div
            className={`border rounded-2xl p-2 sm:p-3 landscape:p-1.5 space-y-1.5 sm:space-y-2 landscape:space-y-1 ${surfaceCard}`}
          >
            {/* Thanh chọn sân */}
            <div className="flex items-center justify-between gap-1.5 min-w-0">
              <div className="flex items-center gap-1 overflow-x-auto max-w-full">
                {courtNumbers.map((cNum) => {
                  const isSelected = cNum === activeMatch.courtNumber;
                  const courtLive = matches.some(
                    (m) => m.courtNumber === cNum && m.status === 'live',
                  );
                  return (
                    <button
                      key={cNum}
                      type="button"
                      onClick={() => {
                        setSelectedCourt(cNum);
                        const firstOnCourt =
                          matches.find((m) => m.courtNumber === cNum && m.status === 'live') ||
                          matches.find((m) => m.courtNumber === cNum);
                        if (firstOnCourt) onSelectMatch(firstOnCourt.id);
                      }}
                      className={`min-h-[26px] sm:min-h-[30px] landscape:min-h-[22px] px-2 sm:px-2.5 py-0.5 rounded-xl text-[10px] sm:text-xs font-bold transition-colors whitespace-nowrap shrink-0 flex items-center gap-1 ${
                        isSelected
                          ? 'bg-orange-600 text-white'
                          : isDark
                          ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <span>Sân {cNum}</span>
                      {courtLive && (
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isSelected ? 'bg-white' : 'bg-emerald-500'
                          }`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-1 text-[10px] sm:text-xs shrink-0">
                <span className={`font-mono-num ${mutedText}`}>
                  {activeMatch.groupName || MATCH_STAGE_LABELS[activeMatch.stage]}
                </span>
                {!isStaff && (
                  <button
                    type="button"
                    onClick={() =>
                      onRequestLogin?.(
                        'Đăng nhập tài khoản Trọng tài hoặc Ban Tổ Chức để điều khiển tỷ số và gọi sân.',
                      )
                    }
                    className="min-h-[22px] px-2 py-0.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-bold text-[10px]"
                  >
                    Đăng nhập
                  </button>
                )}
              </div>
            </div>

            {/* Nút mở Popup chọn các trận nhỏ đồng đội */}
            <button
              type="button"
              onClick={() => setShowSubmatchModal(true)}
              className={`w-full min-w-0 min-h-[30px] sm:min-h-[36px] landscape:min-h-[24px] px-2.5 py-1 rounded-xl border text-left flex items-center justify-between gap-2 transition-colors ${
                isDark
                  ? 'bg-slate-950/80 hover:bg-slate-800 border-slate-700 text-slate-100'
                  : 'bg-slate-50 hover:bg-orange-50/60 border-slate-200 text-slate-900'
              }`}
            >
              <span className="inline-flex items-center gap-1.5 min-w-0 text-[10px] sm:text-xs font-bold">
                <Users className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                <span className="truncate">
                  {activeSubmatch?.label || 'Trận nhỏ'} ({activeMatch.scoreA}-{activeMatch.scoreB})
                </span>
              </span>
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-orange-500 shrink-0">
                <span>Đổi trận</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </span>
            </button>

            {/* 4 nút điều khiển sân */}
            <div className="grid grid-cols-4 gap-1 sm:gap-2">
              <button
                type="button"
                onClick={handleDrawStartingServeAndSide}
                className="min-h-[30px] sm:min-h-[36px] landscape:min-h-[24px] px-1 sm:px-2 py-1 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-[10px] sm:text-xs font-bold flex items-center justify-center gap-1 transition-colors min-w-0"
              >
                <Shuffle className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                <span className="truncate">Bốc thăm</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  requireStaffAction(
                    'Vui lòng đăng nhập tài khoản Trọng tài hoặc Ban Tổ Chức để đổi/thay VĐV đứng sân.',
                    () => setShowLineupEditor((prev) => !prev),
                  )
                }
                className={`min-h-[30px] sm:min-h-[36px] landscape:min-h-[24px] px-1 sm:px-2 py-1 rounded-xl text-[10px] sm:text-xs font-bold border flex items-center justify-center gap-1 transition-colors min-w-0 ${
                  showLineupEditor
                    ? 'bg-orange-600 text-white border-orange-600'
                    : isDark
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-700'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200'
                }`}
              >
                <UserPlus className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0 text-orange-500" />
                <span className="truncate">Thay VĐV</span>
              </button>

              <button
                type="button"
                onClick={handleTriggerCourtCall}
                className="min-h-[30px] sm:min-h-[36px] landscape:min-h-[24px] px-1 sm:px-2 py-1 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-[10px] sm:text-xs font-bold flex items-center justify-center gap-1 transition-colors min-w-0"
              >
                <Megaphone className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                <span className="truncate">Gọi sân</span>
              </button>

              <button
                type="button"
                onClick={handleTriggerCourtAvailable}
                className={`min-h-[30px] sm:min-h-[36px] landscape:min-h-[24px] px-1 sm:px-2 py-1 rounded-xl text-[10px] sm:text-xs font-bold border flex items-center justify-center gap-1 transition-colors min-w-0 ${
                  isDark
                    ? 'bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border-emerald-700/70'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                }`}
              >
                <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                <span className="truncate">Sân trống</span>
              </button>
            </div>

            {notice && (
              <div
                className={`p-1 sm:p-1.5 rounded-xl text-[10px] sm:text-xs font-medium border flex items-center justify-between gap-2 ${
                  isDark
                    ? 'bg-orange-950/40 border-orange-800/60 text-orange-200'
                    : 'bg-orange-50 border-orange-200 text-orange-900'
                }`}
              >
                <span className="truncate">{notice}</span>
                <button
                  type="button"
                  onClick={() => setNotice(null)}
                  className="text-[10px] font-bold opacity-70 hover:opacity-100 shrink-0"
                >
                  ✕
                </button>
              </div>
            )}

            {showLineupEditor && (
              <form
                onSubmit={handleSaveLineup}
                className={`p-2 rounded-xl border space-y-2 ${
                  isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold">
                    Thay đổi VĐV ra sân ({activeMatch.teamSubCategory || activeMatch.division})
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowLineupEditor(false)}
                    className={`text-xs ${mutedText} hover:text-orange-500`}
                  >
                    Đóng
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-bold text-orange-500">
                      Đội A: {activeMatch.teamAName}
                    </div>
                    <select
                      value={editA1}
                      onChange={(e) => setEditA1(e.target.value)}
                      className={`w-full min-h-[30px] px-2 py-1 text-xs border rounded-lg ${
                        isDark
                          ? 'bg-slate-900 border-slate-700 text-white'
                          : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="">-- Chọn VĐV A1 --</option>
                      {availablePoolA.map((name) => (
                        <option key={`a1_${name}`} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={editA2}
                      onChange={(e) => setEditA2(e.target.value)}
                      className={`w-full min-h-[30px] px-2 py-1 text-xs border rounded-lg ${
                        isDark
                          ? 'bg-slate-900 border-slate-700 text-white'
                          : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="">-- Chọn VĐV A2 --</option>
                      {availablePoolA.map((name) => (
                        <option key={`a2_${name}`} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                    {isAdmin && onAddRosterAthlete && (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={newRosterNameA}
                          onChange={(e) => setNewRosterNameA(e.target.value)}
                          placeholder="Thêm VĐV vào Đội A..."
                          className={`flex-1 min-w-0 min-h-[28px] px-2 py-1 text-xs border rounded-lg ${
                            isDark
                              ? 'bg-slate-900 border-slate-700 text-white'
                              : 'bg-white border-slate-300 text-slate-900'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => handleQuickAddRoster('A')}
                          className="min-h-[28px] px-2 py-1 rounded-lg bg-slate-800 hover:bg-orange-600 text-white text-xs font-bold shrink-0"
                        >
                          + VĐV
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-[11px] font-bold text-sky-500">
                      Đội B: {activeMatch.teamBName}
                    </div>
                    <select
                      value={editB1}
                      onChange={(e) => setEditB1(e.target.value)}
                      className={`w-full min-h-[30px] px-2 py-1 text-xs border rounded-lg ${
                        isDark
                          ? 'bg-slate-900 border-slate-700 text-white'
                          : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="">-- Chọn VĐV B1 --</option>
                      {availablePoolB.map((name) => (
                        <option key={`b1_${name}`} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={editB2}
                      onChange={(e) => setEditB2(e.target.value)}
                      className={`w-full min-h-[30px] px-2 py-1 text-xs border rounded-lg ${
                        isDark
                          ? 'bg-slate-900 border-slate-700 text-white'
                          : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="">-- Chọn VĐV B2 --</option>
                      {availablePoolB.map((name) => (
                        <option key={`b2_${name}`} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                    {isAdmin && onAddRosterAthlete && (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={newRosterNameB}
                          onChange={(e) => setNewRosterNameB(e.target.value)}
                          placeholder="Thêm VĐV vào Đội B..."
                          className={`flex-1 min-w-0 min-h-[28px] px-2 py-1 text-xs border rounded-lg ${
                            isDark
                              ? 'bg-slate-900 border-slate-700 text-white'
                              : 'bg-white border-slate-300 text-slate-900'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => handleQuickAddRoster('B')}
                          className="min-h-[28px] px-2 py-1 rounded-lg bg-slate-800 hover:bg-orange-600 text-white text-xs font-bold shrink-0"
                        >
                          + VĐV
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowLineupEditor(false)}
                    className={`min-h-[28px] px-3 py-1 rounded-lg text-xs font-semibold ${
                      isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="min-h-[28px] px-3 py-1 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold"
                  >
                    Lưu VĐV đứng sân
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* SÂN THI ĐẤU 3D */}
          <div
            className={`border rounded-2xl p-1.5 sm:p-3 landscape:p-1 space-y-1 sm:space-y-1.5 ${surfaceCard}`}
          >
            <div className="flex items-center justify-between gap-1 text-[9px] sm:text-[11px] min-w-0">
              <div className="flex items-center gap-1 min-w-0">
                <span className="font-mono-num font-extrabold uppercase truncate">
                  S#{activeMatch.courtNumber} · {isServingScoreOdd ? 'LẺ (TRÁI)' : 'CHẴN (PHẢI)'}{' '}
                  ({servingScore}đ) · TAY {serverNum}
                </span>
                <span className="px-1 py-0.5 rounded bg-amber-400 text-slate-950 text-[8px] font-extrabold shrink-0">
                  Phát
                </span>
                <span className="px-1 py-0.5 rounded bg-cyan-300 text-slate-950 text-[8px] font-extrabold shrink-0">
                  Đỡ
                </span>
              </div>

              <div className="flex items-center gap-1 font-semibold shrink-0">
                <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500 truncate max-w-[68px] sm:max-w-[115px] landscape:max-w-[65px]">
                  P: {serverDisplayName}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-500 truncate max-w-[68px] sm:max-w-[115px] landscape:max-w-[65px]">
                  Đ: {receiverDisplayName}
                </span>
              </div>
            </div>

            <div
              className="rounded-xl bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 p-1 sm:p-2.5 landscape:p-0.5 border border-slate-800 overflow-hidden"
              style={{ perspective: '760px' }}
            >
              <div
                style={{ transform: 'rotateX(15deg) scale(0.99)', transformOrigin: 'center center' }}
                className="relative w-full max-h-[16vh] sm:max-h-[220px] landscape:max-h-[22vh] aspect-[20/9] mx-auto rounded-xl bg-gradient-to-b from-[#22c55e] via-[#16a34a] to-[#15803d] border-[2px] sm:border-[3px] border-white shadow-[0_8px_0_#052e16,0_14px_24px_rgba(0,0,0,0.75)] overflow-hidden select-none"
              >
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      'radial-gradient(circle at 50% 35%, rgba(255,255,255,0.18), rgba(2,6,23,0.28) 85%)',
                  }}
                />

                <svg
                  viewBox="0 0 640 280"
                  className="pointer-events-none absolute inset-0 w-full h-full z-10"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <pattern id="netMesh3D" width="8" height="8" patternUnits="userSpaceOnUse">
                      <path
                        d="M 8 0 L 0 0 0 8"
                        fill="none"
                        stroke="rgba(255,255,255,0.45)"
                        strokeWidth="1"
                      />
                    </pattern>
                    <marker
                      id="shortServeArrow3D"
                      markerWidth="7"
                      markerHeight="7"
                      refX="5.5"
                      refY="3.5"
                      orient="auto"
                    >
                      <polygon points="0 0, 7 3.5, 0 7" fill="#FDE047" />
                    </marker>
                  </defs>

                  <rect
                    x="16"
                    y="16"
                    width="608"
                    height="248"
                    rx="5"
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="3.5"
                  />
                  <rect
                    x="228"
                    y="16"
                    width="92"
                    height="248"
                    fill="rgba(4, 120, 87, 0.34)"
                    stroke="#FFFFFF"
                    strokeWidth="3"
                  />
                  <rect
                    x="320"
                    y="16"
                    width="92"
                    height="248"
                    fill="rgba(4, 120, 87, 0.34)"
                    stroke="#FFFFFF"
                    strokeWidth="3"
                  />
                  <line x1="16" y1="140" x2="228" y2="140" stroke="#FFFFFF" strokeWidth="2.8" />
                  <line x1="412" y1="140" x2="624" y2="140" stroke="#FFFFFF" strokeWidth="2.8" />

                  <polygon
                    points="316,12 336,16 336,268 316,268"
                    fill="rgba(2, 6, 23, 0.34)"
                  />
                  <rect
                    x="315"
                    y="8"
                    width="10"
                    height="264"
                    fill="url(#netMesh3D)"
                    stroke="#FFFFFF"
                    strokeWidth="2"
                  />
                  <line x1="320" y1="8" x2="320" y2="272" stroke="#FFFFFF" strokeWidth="3.5" />
                  <circle cx="320" cy="14" r="5.5" fill="#F8FAFC" stroke="#0F172A" strokeWidth="2" />
                  <circle cx="320" cy="266" r="5.5" fill="#F8FAFC" stroke="#0F172A" strokeWidth="2" />

                  <text
                    x="274"
                    y="144"
                    textAnchor="middle"
                    fill="rgba(255,255,255,0.82)"
                    fontSize="11"
                    fontWeight="800"
                    letterSpacing="2"
                  >
                    NVZ
                  </text>
                  <text
                    x="366"
                    y="144"
                    textAnchor="middle"
                    fill="rgba(255,255,255,0.82)"
                    fontSize="11"
                    fontWeight="800"
                    letterSpacing="2"
                  >
                    NVZ
                  </text>

                  <line
                    x1={arrowLine.x1}
                    y1={arrowLine.y1}
                    x2={arrowLine.x2}
                    y2={arrowLine.y2}
                    stroke="#020617"
                    strokeWidth="4.5"
                    strokeOpacity="0.45"
                  />
                  <line
                    x1={arrowLine.x1}
                    y1={arrowLine.y1}
                    x2={arrowLine.x2}
                    y2={arrowLine.y2}
                    stroke="#FDE047"
                    strokeWidth="3"
                    strokeDasharray="6 4"
                    markerEnd="url(#shortServeArrow3D)"
                  />
                </svg>

                <div className="relative z-20 w-full h-full grid grid-cols-12">
                  <div className="col-span-4 grid grid-rows-2 py-0.5 px-1 sm:py-2 sm:px-2">
                    <div
                      className={`flex items-center justify-start rounded-lg px-0.5 ${
                        leftTopServing ? 'bg-amber-400/20' : leftTopReceiver ? 'bg-cyan-300/15' : ''
                      }`}
                    >
                      <Player3DToken
                        name={pLeftTop}
                        isServing={leftTopServing}
                        isReceiver={leftTopReceiver}
                        align="left"
                      />
                    </div>
                    <div
                      className={`flex items-center justify-start rounded-lg px-0.5 ${
                        leftBottomServing
                          ? 'bg-amber-400/20'
                          : leftBottomReceiver
                          ? 'bg-cyan-300/15'
                          : ''
                      }`}
                    >
                      <Player3DToken
                        name={pLeftBottom}
                        isServing={leftBottomServing}
                        isReceiver={leftBottomReceiver}
                        align="left"
                      />
                    </div>
                  </div>

                  <div className="col-span-4 flex items-center justify-center">
                    <span className="px-1.5 py-0.5 rounded bg-slate-950/85 text-white text-[8px] sm:text-[10px] font-extrabold tracking-wider border border-white/30 shadow-sm">
                      LƯỚI
                    </span>
                  </div>

                  <div className="col-span-4 grid grid-rows-2 py-0.5 px-1 sm:py-2 sm:px-2">
                    <div
                      className={`flex items-center justify-end rounded-lg px-0.5 ${
                        rightTopServing
                          ? 'bg-amber-400/20'
                          : rightTopReceiver
                          ? 'bg-cyan-300/15'
                          : ''
                      }`}
                    >
                      <Player3DToken
                        name={pRightTop}
                        isServing={rightTopServing}
                        isReceiver={rightTopReceiver}
                        align="right"
                      />
                    </div>
                    <div
                      className={`flex items-center justify-end rounded-lg px-0.5 ${
                        rightBottomServing
                          ? 'bg-amber-400/20'
                          : rightBottomReceiver
                          ? 'bg-cyan-300/15'
                          : ''
                      }`}
                    >
                      <Player3DToken
                        name={pRightBottom}
                        isServing={rightBottomServing}
                        isReceiver={rightBottomReceiver}
                        align="right"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-0.5 flex items-center justify-between gap-2 text-[9px] sm:text-[10px] text-slate-300 px-1 min-w-0">
                <span className="truncate font-bold text-amber-300">{leftTeamName}</span>
                <span className="text-slate-400 shrink-0">Giao chéo</span>
                <span className="truncate font-bold text-cyan-300 text-right">{rightTeamName}</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: LIVE SCOREBOARD & MATCH CONTROLS */}
        <div
          className={`lg:col-span-6 landscape:col-span-6 min-w-0 border rounded-2xl p-2 sm:p-3 landscape:p-1.5 space-y-1.5 sm:space-y-2.5 landscape:space-y-1 ${surfaceCard}`}
        >
          <div className="flex items-center justify-between gap-2 text-[10px] sm:text-xs min-w-0">
            <div className="flex items-center gap-1.5 font-mono-num font-bold min-w-0">
              <span className="px-1.5 py-0.5 rounded-md bg-orange-500/15 text-orange-500 shrink-0">
                #{activeMatch.matchNumber} · S{activeMatch.courtNumber}
              </span>
              <span className={`truncate ${mutedText}`}>
                {activeMatch.teamSubCategory ||
                  activeMatch.groupName ||
                  MATCH_STAGE_LABELS[activeMatch.stage]}
              </span>
            </div>

            <div className="font-mono-num font-extrabold text-emerald-500 shrink-0">
              {formatScoreCallout(activeMatch)} / {activeMatch.pointsToWin}đ
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
            {/* BÊN TRÁI */}
            <div
              className={`rounded-xl border p-1.5 sm:p-3 landscape:p-1 space-y-1 sm:space-y-2 min-w-0 transition-colors ${
                leftIsServing
                  ? isDark
                    ? 'border-sky-500 bg-sky-950/20'
                    : 'border-sky-500 bg-sky-50/40'
                  : isDark
                  ? 'border-slate-800 bg-slate-950/50'
                  : 'border-slate-200 bg-slate-50/60'
              }`}
            >
              <div className="flex items-center justify-between gap-1 text-[9px] sm:text-[11px] font-bold min-w-0">
                <span className="text-orange-500 uppercase truncate">{leftTeamLabel}</span>
                <div className="flex items-center gap-1 shrink-0">
                  <span
                    className={`px-1 py-0.5 rounded-md text-[9px] sm:text-[10px] ${
                      leftIsServing
                        ? 'bg-sky-600 text-white'
                        : isDark
                        ? 'bg-slate-800 text-slate-400'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {leftIsServing ? `TAY ${serverNum}` : 'ĐỠ'}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleToggleTimeout(leftSideIsA ? 'A' : 'B')}
                    className={`px-1 py-0.5 rounded-md text-[9px] sm:text-[10px] font-mono-num border ${
                      isDark
                        ? 'bg-amber-950/50 text-amber-300 border-amber-800/60'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}
                  >
                    TO({leftSideIsA ? activeMatch.timeoutsA : activeMatch.timeoutsB})
                  </button>
                </div>
              </div>

              <div className="text-[10px] sm:text-sm font-bold truncate" title={leftTeamName}>
                {leftTeamName}
              </div>

              <div className="flex items-center justify-between gap-1">
                <span className="font-mono-num text-lg sm:text-3xl landscape:text-lg font-extrabold leading-none">
                  {leftSideIsA ? activeMatch.scoreA : activeMatch.scoreB}
                </span>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => adjustScore(leftSideIsA ? 'A' : 'B', -1)}
                    aria-label="Giảm điểm đội trái"
                    className={`w-7 h-7 sm:w-10 sm:h-10 landscape:w-6 landscape:h-6 rounded-xl flex items-center justify-center font-bold transition-colors ${
                      isDark
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                        : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                    }`}
                  >
                    <Minus className="w-3 h-3 sm:w-4 sm:h-4" />
                  </button>

                  <button
                    type="button"
                    disabled={!leftCanPlus}
                    onClick={() => adjustScore(leftSideIsA ? 'A' : 'B', 1)}
                    className={`min-w-[42px] sm:min-w-[66px] h-7 sm:h-10 landscape:h-6 px-1.5 sm:px-2.5 rounded-xl font-mono-num text-[10px] sm:text-sm font-extrabold flex items-center justify-center gap-0.5 transition-all ${
                      leftCanPlus
                        ? 'bg-orange-600 hover:bg-orange-700 active:scale-[0.98] text-white shadow-xs'
                        : 'bg-slate-300/70 dark:bg-slate-800/70 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                    }`}
                  >
                    <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span>+1{leftSideIsA ? 'A' : 'B'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* BÊN PHẢI */}
            <div
              className={`rounded-xl border p-1.5 sm:p-3 landscape:p-1 space-y-1 sm:space-y-2 min-w-0 transition-colors ${
                rightIsServing
                  ? isDark
                    ? 'border-sky-500 bg-sky-950/20'
                    : 'border-sky-500 bg-sky-50/40'
                  : isDark
                  ? 'border-slate-800 bg-slate-950/50'
                  : 'border-slate-200 bg-slate-50/60'
              }`}
            >
              <div className="flex items-center justify-between gap-1 text-[9px] sm:text-[11px] font-bold min-w-0">
                <span className="text-sky-500 uppercase truncate">{rightTeamLabel}</span>
                <div className="flex items-center gap-1 shrink-0">
                  <span
                    className={`px-1 py-0.5 rounded-md text-[9px] sm:text-[10px] ${
                      rightIsServing
                        ? 'bg-sky-600 text-white'
                        : isDark
                        ? 'bg-slate-800 text-slate-400'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {rightIsServing ? `TAY ${serverNum}` : 'ĐỠ'}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleToggleTimeout(leftSideIsA ? 'B' : 'A')}
                    className={`px-1 py-0.5 rounded-md text-[9px] sm:text-[10px] font-mono-num border ${
                      isDark
                        ? 'bg-amber-950/50 text-amber-300 border-amber-800/60'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}
                  >
                    TO({leftSideIsA ? activeMatch.timeoutsB : activeMatch.timeoutsA})
                  </button>
                </div>
              </div>

              <div className="text-[10px] sm:text-sm font-bold truncate" title={rightTeamName}>
                {rightTeamName}
              </div>

              <div className="flex items-center justify-between gap-1">
                <span className="font-mono-num text-lg sm:text-3xl landscape:text-lg font-extrabold leading-none">
                  {leftSideIsA ? activeMatch.scoreB : activeMatch.scoreA}
                </span>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => adjustScore(leftSideIsA ? 'B' : 'A', -1)}
                    aria-label="Giảm điểm đội phải"
                    className={`w-7 h-7 sm:w-10 sm:h-10 landscape:w-6 landscape:h-6 rounded-xl flex items-center justify-center font-bold transition-colors ${
                      isDark
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                        : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                    }`}
                  >
                    <Minus className="w-3 h-3 sm:w-4 sm:h-4" />
                  </button>

                  <button
                    type="button"
                    disabled={!rightCanPlus}
                    onClick={() => adjustScore(leftSideIsA ? 'B' : 'A', 1)}
                    className={`min-w-[42px] sm:min-w-[66px] h-7 sm:h-10 landscape:h-6 px-1.5 sm:px-2.5 rounded-xl font-mono-num text-[10px] sm:text-sm font-extrabold flex items-center justify-center gap-0.5 transition-all ${
                      rightCanPlus
                        ? 'bg-sky-600 hover:bg-sky-700 active:scale-[0.98] text-white shadow-xs'
                        : 'bg-slate-300/70 dark:bg-slate-800/70 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                    }`}
                  >
                    <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span>+1{leftSideIsA ? 'B' : 'A'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1 sm:gap-2">
            <button
              type="button"
              onClick={handleToggleServe}
              className={`min-h-[28px] sm:min-h-[36px] landscape:min-h-[24px] px-2 py-1 rounded-xl text-[10px] sm:text-xs font-bold border flex items-center justify-center gap-1 transition-colors ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-700'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200'
              }`}
            >
              <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-orange-500 shrink-0" />
              <span>Đổi giao</span>
            </button>

            <button
              type="button"
              onClick={handleSwitchCourtEnds}
              className={`min-h-[28px] sm:min-h-[36px] landscape:min-h-[24px] px-2 py-1 rounded-xl text-[10px] sm:text-xs font-bold border flex items-center justify-center gap-1 transition-colors ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-700'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200'
              }`}
            >
              <ArrowLeftRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-sky-500 shrink-0" />
              <span>Đổi sân</span>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => handleFinishMatch('A')}
              className="min-h-[28px] sm:min-h-[36px] landscape:min-h-[24px] px-1.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] sm:text-xs font-bold flex items-center justify-center gap-1 transition-colors min-w-0"
            >
              <Flag className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span className="truncate">Đội A thắng</span>
            </button>

            <button
              type="button"
              onClick={() => handleFinishMatch('B')}
              className="min-h-[28px] sm:min-h-[36px] landscape:min-h-[24px] px-1.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] sm:text-xs font-bold flex items-center justify-center gap-1 transition-colors min-w-0"
            >
              <Flag className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span className="truncate">Đội B thắng</span>
            </button>

            <button
              type="button"
              onClick={() => handleFinishMatch('')}
              className={`min-h-[28px] sm:min-h-[36px] landscape:min-h-[24px] px-1.5 py-1 rounded-xl text-[10px] sm:text-xs font-bold border flex items-center justify-center gap-1 transition-colors min-w-0 ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
              }`}
            >
              <Award className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-500 shrink-0" />
              <span className="truncate">Hòa 2–2</span>
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 text-[10px] sm:text-xs">
            <button
              type="button"
              onClick={() =>
                requireStaffAction(
                  'Vui lòng đăng nhập tài khoản Trọng tài hoặc Ban Tổ Chức để đặt lại điểm trận đấu.',
                  () => {
                    onUpdateMatch(activeMatch.id, {
                      status: 'live',
                      winnerSide: '',
                      scoreA: 0,
                      scoreB: 0,
                      servingTeam: 'A',
                      serverNumber: 2,
                      timeoutsA: 0,
                      timeoutsB: 0,
                      scoreHistory: [],
                    });
                    setNotice(null);
                  },
                )
              }
              className={`min-h-[24px] sm:min-h-[30px] px-2 py-0.5 rounded-lg font-semibold border inline-flex items-center gap-1 ${
                isDark
                  ? 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700'
                  : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'
              }`}
            >
              <RotateCcw className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>Đặt lại 0–0</span>
            </button>

            <button
              type="button"
              onClick={() =>
                requireStaffAction(
                  'Vui lòng đăng nhập tài khoản Trọng tài hoặc Ban Tổ Chức để chuyển trạng thái trận đấu.',
                  () =>
                    onUpdateMatch(activeMatch.id, {
                      status: activeMatch.status === 'live' ? 'scheduled' : 'live',
                      startedAtMs: activeMatch.startedAtMs || Date.now(),
                    }),
                )
              }
              className={`min-h-[24px] sm:min-h-[30px] px-2 py-0.5 rounded-lg font-semibold border inline-flex items-center gap-1 ${
                activeMatch.status === 'live'
                  ? 'bg-amber-500/15 text-amber-500 border-amber-500/30'
                  : isDark
                  ? 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700'
                  : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'
              }`}
            >
              <RefreshCw className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>{activeMatch.status === 'live' ? 'Đang Live' : 'Bắt đầu Live'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* POPUP CHỌN TRẬN NHỎ ĐỒNG ĐỘI */}
      {showSubmatchModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          onClick={() => setShowSubmatchModal(false)}
        >
          <div
            className={`w-full max-w-md rounded-2xl border p-4 space-y-3 shadow-2xl ${surfaceCard}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2.5">
              <div className="min-w-0">
                <h3 className="text-sm font-extrabold">Chọn trận nhỏ đồng đội</h3>
                <p className={`text-[11px] truncate ${mutedText}`}>
                  {activeMatch.teamAName} vs {activeMatch.teamBName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSubmatchModal(false)}
                aria-label="Đóng popup"
                className={`p-1.5 rounded-lg ${
                  isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-600'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
              {doublesSubmatches.map((slot) => {
                const isCurrent = slot.order === activeSlotOrder;
                return (
                  <button
                    key={slot.order}
                    type="button"
                    onClick={() => handleSelectTeamSlot(slot.order)}
                    className={`w-full min-h-[40px] px-3 py-2 rounded-xl border text-left flex items-center justify-between gap-2 text-xs font-bold transition-colors ${
                      isCurrent
                        ? 'bg-orange-600 text-white border-orange-600'
                        : isDark
                        ? 'bg-slate-950/60 hover:bg-slate-800 text-slate-200 border-slate-800'
                        : 'bg-slate-50 hover:bg-orange-50 text-slate-800 border-slate-200'
                    }`}
                  >
                    <span className="truncate">{slot.label}</span>
                    <span
                      className={`font-mono-num text-[11px] px-2 py-0.5 rounded-md shrink-0 ${
                        isCurrent
                          ? 'bg-white/20 text-white'
                          : isDark
                          ? 'bg-slate-800 text-slate-300'
                          : 'bg-white text-slate-700 border border-slate-200'
                      }`}
                    >
                      {slot.scoreA}–{slot.scoreB}
                      {slot.completed ? ' ✓' : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
