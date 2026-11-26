/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Award,
  CheckCircle2,
  Clock,
  Flag,
  Gavel,
  Megaphone,
  Minus,
  Plus,
  RefreshCw,
  RotateCcw,
  Shuffle,
  UserPlus,
  Users,
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
  activeTab?: string;
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
      label: slot.label || TEAM_EVENT_SUBCATEGORIES[index] || `Trận ${index + 1}`,
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
  const badgeBg = isServing
    ? 'bg-amber-400 text-slate-950 ring-2 ring-white shadow-md'
    : isReceiver
    ? 'bg-cyan-300 text-slate-950 ring-1 ring-white/90 shadow-sm'
    : 'bg-slate-950/80 text-white border border-white/25';

  return (
    <div
      title={name}
      className={`inline-flex items-center gap-1.5 max-w-full ${
        align === 'right' ? 'flex-row-reverse text-right' : 'flex-row text-left'
      }`}
    >
      {/* Icon người 3D đơn giản */}
      <svg
        viewBox="0 0 28 32"
        className="w-5 h-6 sm:w-6 sm:h-7 shrink-0 drop-shadow-[0_3px_3px_rgba(0,0,0,0.65)]"
        aria-hidden="true"
      >
        <ellipse cx="14" cy="29.5" rx="9" ry="2.2" fill="rgba(0,0,0,0.42)" />
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
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold truncate max-w-[115px] sm:max-w-[140px] ${badgeBg}`}
      >
        <span className="truncate">{shortName}</span>
        {isServing && (
          <span className="px-1 rounded bg-slate-950 text-amber-300 text-[8px] font-black shrink-0">
            PHÁT
          </span>
        )}
        {isReceiver && !isServing && (
          <span className="px-1 rounded bg-slate-950 text-cyan-300 text-[8px] font-black shrink-0">
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
  const isStaff = Boolean(currentAccount && (currentAccount.role === 'admin' || currentAccount.role === 'referee'));
  const isAdmin = currentAccount?.role === 'admin';

  const courtNumbers = useMemo(
    () => Array.from({ length: Math.max(1, tournament.courtsCount) }, (_, i) => i + 1),
    [tournament.courtsCount],
  );

  const [selectedCourt, setSelectedCourt] = useState<number>(1);
  const [notice, setNotice] = useState<string | null>(null);
  const [showLineupEditor, setShowLineupEditor] = useState(false);

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

  const adjustScore = (side: 'A' | 'B', delta: number) => {
    if (!activeMatch) return;
    requireStaffAction(
      'Vui lòng đăng nhập tài khoản Trọng tài hoặc Ban Tổ Chức để ghi và cập nhật điểm trên sân.',
      () => {
        const nextA = side === 'A' ? Math.max(0, activeMatch.scoreA + delta) : activeMatch.scoreA;
        const nextB = side === 'B' ? Math.max(0, activeMatch.scoreB + delta) : activeMatch.scoreB;

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
                slot.order === activeSlotOrder ? { ...slot, scoreA: nextA, scoreB: nextB } : slot,
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

        onUpdateMatch(activeMatch.id, {
          status: activeMatch.status === 'scheduled' ? 'live' : activeMatch.status,
          startedAtMs: activeMatch.startedAtMs || Date.now(),
          scoreA: nextA,
          scoreB: nextB,
          servingTeam: nextServingTeam,
          serverNumber: nextServerNumber,
          teamLineupSlots: updatedSlots,
          scoreHistory: nextHistory,
        });
      },
    );
  };

  const handleToggleServe = () => {
    if (!activeMatch) return;
    requireStaffAction(
      'Vui lòng đăng nhập tài khoản Trọng tài hoặc Ban Tổ Chức để đổi lượt giao bóng.',
      () => {
        const currentServer = activeMatch.serverNumber || 2;
        if (activeMatch.scoringMode === 'rally') {
          onUpdateMatch(activeMatch.id, {
            servingTeam: activeMatch.servingTeam === 'A' ? 'B' : 'A',
            serverNumber: 1,
          });
          return;
        }

        if (currentServer === 1) {
          onUpdateMatch(activeMatch.id, { serverNumber: 2 });
        } else {
          onUpdateMatch(activeMatch.id, {
            servingTeam: activeMatch.servingTeam === 'A' ? 'B' : 'A',
            serverNumber: 2,
          });
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
        const sideLabel = coinForSideA === 'left' ? 'Bên Trái (L)' : 'Bên Phải (R)';

        onUpdateMatch(activeMatch.id, {
          status: activeMatch.status === 'scheduled' ? 'live' : activeMatch.status,
          startedAtMs: activeMatch.startedAtMs || Date.now(),
          servingTeam: coinForServe,
          serverNumber: 2,
          courtSideA: coinForSideA,
        });

        setNotice(
          `Bốc thăm xong: ${starterLabel} giao trước (Người 2) · ${activeMatch.teamAName} đứng ${sideLabel}.`,
        );
      },
    );
  };

  const handleSelectTeamSlot = (slotOrder: number) => {
    if (!activeMatch || !isTeamMatch) return;
    requireStaffAction(
      'Vui lòng đăng nhập tài khoản Trọng tài hoặc Ban Tổ Chức để chuyển trận đồng đội.',
      () => {
        const targetSlot = lineupSlots.find((s) => s.order === slotOrder);
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
      <div className={`border rounded-2xl p-6 text-center space-y-3 ${surfaceCard}`}>
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
  const isOddScore = (activeMatch.scoreA + activeMatch.scoreB) % 2 !== 0;

  const leftIsServing =
    (leftSideIsA && servingSide === 'A') || (!leftSideIsA && servingSide === 'B');
  const rightIsServing = !leftIsServing;

  const leftTopServing = leftIsServing && (serverNum === 1 ? !isOddScore : isOddScore);
  const leftBottomServing = leftIsServing && !leftTopServing;
  const rightTopServing = rightIsServing && (serverNum === 1 ? isOddScore : !isOddScore);
  const rightBottomServing = rightIsServing && !rightTopServing;

  // Người đỡ giao bóng đứng chéo ô với người phát bóng
  const leftTopReceiver = rightIsServing && rightBottomServing;
  const leftBottomReceiver = rightIsServing && rightTopServing;
  const rightTopReceiver = leftIsServing && leftBottomServing;
  const rightBottomReceiver = leftIsServing && leftTopServing;

  const serverDisplayName = shortenPlayerName(
    servingSide === 'A'
      ? activeMatch.teamAPlayer1 || activeMatch.teamAName
      : activeMatch.teamBPlayer1 || activeMatch.teamBName,
  );
  const receiverDisplayName = shortenPlayerName(
    servingSide === 'A'
      ? activeMatch.teamBPlayer1 || activeMatch.teamBName
      : activeMatch.teamAPlayer1 || activeMatch.teamAName,
  );

  // Tọa độ đường giao chéo chuẩn theo phối cảnh sân 3D (viewBox 640x280)
  const arrowLine = leftIsServing
    ? {
        x1: 112,
        y1: leftTopServing ? 92 : 212,
        x2: 528,
        y2: leftTopServing ? 212 : 92,
      }
    : {
        x1: 528,
        y1: rightTopServing ? 92 : 212,
        x2: 112,
        y2: rightTopServing ? 212 : 92,
      };

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Court Switcher & Staff Badge */}
      <section className={`border rounded-2xl p-3 sm:p-4 ${surfaceCard}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-full">
            {courtNumbers.map((cNum) => {
              const isSelected = cNum === selectedCourt;
              const courtLive = matches.some((m) => m.courtNumber === cNum && m.status === 'live');
              return (
                <button
                  key={cNum}
                  type="button"
                  onClick={() => {
                    setSelectedCourt(cNum);
                    const firstOnCourt = matches.find((m) => m.courtNumber === cNum);
                    if (firstOnCourt) onSelectMatch(firstOnCourt.id);
                  }}
                  className={`min-h-[34px] px-3 py-1 rounded-xl text-xs font-bold transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
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
                      className={`w-2 h-2 rounded-full ${
                        isSelected ? 'bg-white' : 'bg-emerald-500'
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 text-xs shrink-0">
            {isStaff && currentAccount ? (
              <span
                className={`px-2.5 py-1 rounded-lg font-semibold border ${
                  isDark
                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}
              >
                {isAdmin ? 'BTC' : 'Trọng tài'}: {currentAccount.displayName}
              </span>
            ) : (
              <button
                type="button"
                onClick={() =>
                  onRequestLogin?.(
                    'Đăng nhập tài khoản Trọng tài hoặc Ban Tổ Chức để điều khiển tỷ số và gọi sân.',
                  )
                }
                className="min-h-[34px] px-3 py-1 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs"
              >
                Đăng nhập điều hành
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Main Console Layout */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4 items-start">
        {/* LEFT: MATCH PICKER + SELECT TRẬN NHỎ ĐỒNG ĐỘI + 4 ACTIONS + 3D COURT */}
        <div className="lg:col-span-6 space-y-3.5">
          <div className={`border rounded-2xl p-3 sm:p-4 space-y-3 ${surfaceCard}`}>
            <div className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-orange-500">
                <Gavel className="w-3.5 h-3.5 shrink-0" />
                <span>SÂN {activeMatch.courtNumber}</span>
              </div>
              <span className={`font-mono-num text-[11px] ${mutedText}`}>
                {activeMatch.groupName || MATCH_STAGE_LABELS[activeMatch.stage]}
              </span>
            </div>

            <select
              value={activeMatch.id}
              onChange={(e) => onSelectMatch(e.target.value)}
              aria-label="Chọn trận đấu trên sân"
              className={`w-full min-h-[38px] px-3 py-2 text-xs sm:text-sm font-bold border rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                isDark
                  ? 'bg-slate-950 border-slate-700 text-white'
                  : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            >
              {matches.map((m) => (
                <option key={m.id} value={m.id}>
                  Trận #{m.matchNumber} (Sân {m.courtNumber}) — {m.teamAName} vs {m.teamBName}
                </option>
              ))}
            </select>

            {/* Select trận nhỏ cho nội dung Đồng đội ngay trên bảng trọng tài */}
            {isTeamMatch && lineupSlots.length > 0 && (
              <div className="space-y-1">
                <label
                  htmlFor="team-submatch-select"
                  className="flex items-center gap-1.5 text-[11px] font-bold text-orange-500"
                >
                  <Users className="w-3.5 h-3.5 shrink-0" />
                  <span>Chọn trận nhỏ (Đồng đội)</span>
                </label>
                <select
                  id="team-submatch-select"
                  value={activeSlotOrder}
                  onChange={(e) => handleSelectTeamSlot(Number(e.target.value))}
                  className={`w-full min-h-[38px] px-3 py-2 text-xs font-bold border rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                    isDark
                      ? 'bg-slate-950 border-slate-700 text-amber-300'
                      : 'bg-orange-50/50 border-orange-300 text-slate-900'
                  }`}
                >
                  {lineupSlots.map((slot) => (
                    <option key={slot.order} value={slot.order}>
                      {slot.label} · ({slot.scoreA}-{slot.scoreB}){slot.completed ? ' ✓' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* 4 Core Court Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={handleDrawStartingServeAndSide}
                className="min-h-[40px] sm:min-h-[38px] px-2.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Shuffle className="w-3.5 h-3.5 shrink-0" />
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
                className={`min-h-[40px] sm:min-h-[38px] px-2.5 py-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-colors ${
                  showLineupEditor
                    ? 'bg-orange-600 text-white border-orange-600'
                    : isDark
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-700'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5 shrink-0 text-orange-500" />
                <span className="truncate">Thay VĐV</span>
              </button>

              <button
                type="button"
                onClick={handleTriggerCourtCall}
                className="min-h-[40px] sm:min-h-[38px] px-2.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Megaphone className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Gọi sân</span>
              </button>

              <button
                type="button"
                onClick={handleTriggerCourtAvailable}
                className={`min-h-[40px] sm:min-h-[38px] px-2.5 py-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-colors ${
                  isDark
                    ? 'bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border-emerald-700/70'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Sân trống</span>
              </button>
            </div>

            {notice && (
              <div
                className={`p-2.5 rounded-xl text-xs font-medium border flex items-start justify-between gap-2 ${
                  isDark
                    ? 'bg-orange-950/40 border-orange-800/60 text-orange-200'
                    : 'bg-orange-50 border-orange-200 text-orange-900'
                }`}
              >
                <span>{notice}</span>
                <button
                  type="button"
                  onClick={() => setNotice(null)}
                  className="text-[11px] font-bold opacity-70 hover:opacity-100 shrink-0"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Lineup Editor */}
            {showLineupEditor && (
              <form
                onSubmit={handleSaveLineup}
                className={`p-3 rounded-xl border space-y-3 ${
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <div className="text-[11px] font-bold text-orange-500">
                      Đội A: {activeMatch.teamAName}
                    </div>
                    <select
                      value={editA1}
                      onChange={(e) => setEditA1(e.target.value)}
                      className={`w-full min-h-[36px] px-2.5 py-1.5 text-xs border rounded-lg ${
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
                      className={`w-full min-h-[36px] px-2.5 py-1.5 text-xs border rounded-lg ${
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
                          className={`flex-1 min-w-0 min-h-[32px] px-2.5 py-1 text-xs border rounded-lg ${
                            isDark
                              ? 'bg-slate-900 border-slate-700 text-white'
                              : 'bg-white border-slate-300 text-slate-900'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => handleQuickAddRoster('A')}
                          className="min-h-[32px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-orange-600 text-white text-xs font-bold shrink-0"
                        >
                          + VĐV
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="text-[11px] font-bold text-sky-500">
                      Đội B: {activeMatch.teamBName}
                    </div>
                    <select
                      value={editB1}
                      onChange={(e) => setEditB1(e.target.value)}
                      className={`w-full min-h-[36px] px-2.5 py-1.5 text-xs border rounded-lg ${
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
                      className={`w-full min-h-[36px] px-2.5 py-1.5 text-xs border rounded-lg ${
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
                          className={`flex-1 min-w-0 min-h-[32px] px-2.5 py-1 text-xs border rounded-lg ${
                            isDark
                              ? 'bg-slate-900 border-slate-700 text-white'
                              : 'bg-white border-slate-300 text-slate-900'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => handleQuickAddRoster('B')}
                          className="min-h-[32px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-orange-600 text-white text-xs font-bold shrink-0"
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
                    className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold ${
                      isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="min-h-[34px] px-3.5 py-1 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold"
                  >
                    Lưu VĐV đứng sân
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* SÂN THI ĐẤU 3D + ICON NGƯỜI 3D ĐƠN GIẢN */}
          <div className={`border rounded-2xl p-3 sm:p-4 space-y-2.5 ${surfaceCard}`}>
            <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-mono-num font-extrabold uppercase">
                  SÂN 3D #{activeMatch.courtNumber} · {isOddScore ? 'LẺ' : 'CHẴN'} · N{serverNum}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 text-[10px] font-extrabold">
                  Phát
                </span>
                <span className="px-1.5 py-0.5 rounded bg-cyan-300 text-slate-950 text-[10px] font-extrabold">
                  Đỡ
                </span>
              </div>

              <div className="flex items-center gap-1.5 font-semibold">
                <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-500 truncate max-w-[115px]">
                  P: {serverDisplayName}
                </span>
                <span className="px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-500 truncate max-w-[115px]">
                  Đ: {receiverDisplayName}
                </span>
              </div>
            </div>

            {/* Khung sân phối cảnh 3D */}
            <div
              className="rounded-2xl bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 p-2 sm:p-3 border border-slate-800 overflow-hidden"
              style={{ perspective: '900px' }}
            >
              <div
                style={{ transform: 'rotateX(16deg)', transformOrigin: 'center center' }}
                className="relative w-full max-h-[34vh] sm:max-h-[245px] aspect-[20/9] mx-auto rounded-xl bg-gradient-to-b from-[#16a34a] via-[#15803d] to-[#14532d] border-2 border-white shadow-[0_10px_0_#052e16,0_18px_28px_rgba(0,0,0,0.65)] overflow-hidden select-none"
              >
                {/* Vạch sân chuẩn Pickleball (2 nửa sân trái - phải, 2 ô giao mỗi bên, khu NVZ 7ft ở giữa, lưới dọc chính giữa) */}
                <svg
                  viewBox="0 0 640 280"
                  className="pointer-events-none absolute inset-0 w-full h-full z-10"
                  preserveAspectRatio="none"
                >
                  {/* Đường biên ngoài sân */}
                  <rect
                    x="14"
                    y="14"
                    width="612"
                    height="252"
                    rx="4"
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="3.5"
                  />

                  {/* Khu vực bếp / NVZ 7ft hai bên lưới */}
                  <rect
                    x="228"
                    y="14"
                    width="92"
                    height="252"
                    fill="rgba(6, 78, 59, 0.36)"
                    stroke="#FFFFFF"
                    strokeWidth="3"
                  />
                  <rect
                    x="320"
                    y="14"
                    width="92"
                    height="252"
                    fill="rgba(6, 78, 59, 0.36)"
                    stroke="#FFFFFF"
                    strokeWidth="3"
                  />

                  {/* Đường chia ô giao bóng trái & phải (chỉ chạy từ đường biên cuối sân tới đường NVZ) */}
                  <line
                    x1="14"
                    y1="140"
                    x2="228"
                    y2="140"
                    stroke="#FFFFFF"
                    strokeWidth="2.8"
                  />
                  <line
                    x1="412"
                    y1="140"
                    x2="626"
                    y2="140"
                    stroke="#FFFFFF"
                    strokeWidth="2.8"
                  />

                  {/* Bóng lưới đổ xuống mặt sân */}
                  <rect x="314" y="10" width="12" height="260" fill="rgba(2, 6, 23, 0.32)" />

                  {/* Đường lưới chính giữa */}
                  <line
                    x1="320"
                    y1="6"
                    x2="320"
                    y2="274"
                    stroke="#FFFFFF"
                    strokeWidth="4.5"
                  />

                  {/* Cột lưới 3D hai đầu */}
                  <circle cx="320" cy="14" r="5" fill="#F8FAFC" stroke="#0F172A" strokeWidth="2" />
                  <circle cx="320" cy="266" r="5" fill="#F8FAFC" stroke="#0F172A" strokeWidth="2" />

                  {/* Nhãn NVZ */}
                  <text
                    x="274"
                    y="144"
                    textAnchor="middle"
                    fill="rgba(255,255,255,0.78)"
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
                    fill="rgba(255,255,255,0.78)"
                    fontSize="11"
                    fontWeight="800"
                    letterSpacing="2"
                  >
                    NVZ
                  </text>

                  {/* Mũi tên quỹ đạo giao bóng chéo sân */}
                  <defs>
                    <marker
                      id="serveArrow3D"
                      markerWidth="8"
                      markerHeight="8"
                      refX="6"
                      refY="4"
                      orient="auto"
                    >
                      <polygon points="0 0, 8 4, 0 8" fill="#FACC15" />
                    </marker>
                  </defs>
                  <line
                    x1={arrowLine.x1}
                    y1={arrowLine.y1}
                    x2={arrowLine.x2}
                    y2={arrowLine.y2}
                    stroke="#020617"
                    strokeWidth="5"
                    strokeOpacity="0.45"
                  />
                  <line
                    x1={arrowLine.x1}
                    y1={arrowLine.y1}
                    x2={arrowLine.x2}
                    y2={arrowLine.y2}
                    stroke="#FACC15"
                    strokeWidth="3"
                    strokeDasharray="7 5"
                    markerEnd="url(#serveArrow3D)"
                  />
                </svg>

                {/* Lớp đặt Icon Người 3D theo vị trí 4 ô trên sân */}
                <div className="relative z-20 w-full h-full grid grid-cols-12">
                  {/* Nửa sân trái */}
                  <div className="col-span-4 grid grid-rows-2 py-2 px-2">
                    <div
                      className={`flex items-center justify-start rounded-lg px-1 ${
                        leftTopServing ? 'bg-amber-400/20' : ''
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
                      className={`flex items-center justify-start rounded-lg px-1 ${
                        leftBottomServing ? 'bg-amber-400/20' : ''
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

                  {/* Khu giữa (NVZ + Lưới) */}
                  <div className="col-span-4 flex items-center justify-center">
                    <span className="px-2 py-0.5 rounded bg-slate-950/85 text-white text-[9px] sm:text-[10px] font-extrabold tracking-wider border border-white/30">
                      LƯỚI
                    </span>
                  </div>

                  {/* Nửa sân phải */}
                  <div className="col-span-4 grid grid-rows-2 py-2 px-2">
                    <div
                      className={`flex items-center justify-end rounded-lg px-1 ${
                        rightTopServing ? 'bg-amber-400/20' : ''
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
                      className={`flex items-center justify-end rounded-lg px-1 ${
                        rightBottomServing ? 'bg-amber-400/20' : ''
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

              {/* Chú thích 2 đội */}
              <div className="mt-2.5 flex items-center justify-between gap-2 text-[10px] text-slate-300 px-1">
                <span className="truncate font-bold text-amber-300">{leftTeamName}</span>
                <span className="text-slate-400 shrink-0">Giao chéo sân</span>
                <span className="truncate font-bold text-cyan-300 text-right">{rightTeamName}</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: LIVE SCOREBOARD & MATCH CONTROLS */}
        <div className={`lg:col-span-6 border rounded-2xl p-3 sm:p-4 space-y-3 ${surfaceCard}`}>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 font-mono-num font-bold">
              <span className="px-2 py-0.5 rounded-md bg-orange-500/15 text-orange-500">
                #{activeMatch.matchNumber} · S{activeMatch.courtNumber}
              </span>
              <span className={mutedText}>
                {activeMatch.groupName || MATCH_STAGE_LABELS[activeMatch.stage]}
              </span>
            </div>

            <div className="font-mono-num font-extrabold text-emerald-500">
              {formatScoreCallout(activeMatch)} / {activeMatch.pointsToWin}đ
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* LEFT TEAM CARD */}
            <div
              className={`rounded-xl border p-3 space-y-2.5 transition-colors ${
                leftIsServing
                  ? isDark
                    ? 'border-sky-500 bg-sky-950/20'
                    : 'border-sky-500 bg-sky-50/40'
                  : isDark
                  ? 'border-slate-800 bg-slate-950/50'
                  : 'border-slate-200 bg-slate-50/60'
              }`}
            >
              <div className="flex items-center justify-between gap-1 text-[11px] font-bold">
                <span className="text-orange-500 uppercase">{leftTeamLabel}</span>
                <div className="flex items-center gap-1">
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] ${
                      leftIsServing
                        ? 'bg-sky-600 text-white'
                        : isDark
                        ? 'bg-slate-800 text-slate-400'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {leftIsServing ? `PHÁT N${serverNum}` : 'ĐỠ'}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleToggleTimeout(leftSideIsA ? 'A' : 'B')}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-mono-num border ${
                      isDark
                        ? 'bg-amber-950/50 text-amber-300 border-amber-800/60'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}
                  >
                    TO ({leftSideIsA ? activeMatch.timeoutsA : activeMatch.timeoutsB})
                  </button>
                </div>
              </div>

              <div className="text-xs sm:text-sm font-bold truncate" title={leftTeamName}>
                {leftTeamName}
              </div>

              <div className="flex items-center justify-between gap-2 pt-0.5">
                <span className="font-mono-num text-3xl sm:text-4xl font-extrabold leading-none">
                  {leftSideIsA ? activeMatch.scoreA : activeMatch.scoreB}
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => adjustScore(leftSideIsA ? 'A' : 'B', -1)}
                    aria-label="Giảm điểm đội trái"
                    className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center font-bold transition-colors ${
                      isDark
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                        : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                    }`}
                  >
                    <Minus className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => adjustScore(leftSideIsA ? 'A' : 'B', 1)}
                    className="min-w-[62px] sm:min-w-[68px] h-10 sm:h-11 px-3 rounded-xl bg-orange-600 hover:bg-orange-700 active:scale-[0.98] text-white font-mono-num text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1 shadow-xs transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+1{leftSideIsA ? 'A' : 'B'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* RIGHT TEAM CARD */}
            <div
              className={`rounded-xl border p-3 space-y-2.5 transition-colors ${
                rightIsServing
                  ? isDark
                    ? 'border-sky-500 bg-sky-950/20'
                    : 'border-sky-500 bg-sky-50/40'
                  : isDark
                  ? 'border-slate-800 bg-slate-950/50'
                  : 'border-slate-200 bg-slate-50/60'
              }`}
            >
              <div className="flex items-center justify-between gap-1 text-[11px] font-bold">
                <span className="text-sky-500 uppercase">{rightTeamLabel}</span>
                <div className="flex items-center gap-1">
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] ${
                      rightIsServing
                        ? 'bg-sky-600 text-white'
                        : isDark
                        ? 'bg-slate-800 text-slate-400'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {rightIsServing ? `PHÁT N${serverNum}` : 'ĐỠ'}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleToggleTimeout(leftSideIsA ? 'B' : 'A')}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-mono-num border ${
                      isDark
                        ? 'bg-amber-950/50 text-amber-300 border-amber-800/60'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}
                  >
                    TO ({leftSideIsA ? activeMatch.timeoutsB : activeMatch.timeoutsA})
                  </button>
                </div>
              </div>

              <div className="text-xs sm:text-sm font-bold truncate" title={rightTeamName}>
                {rightTeamName}
              </div>

              <div className="flex items-center justify-between gap-2 pt-0.5">
                <span className="font-mono-num text-3xl sm:text-4xl font-extrabold leading-none">
                  {leftSideIsA ? activeMatch.scoreB : activeMatch.scoreA}
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => adjustScore(leftSideIsA ? 'B' : 'A', -1)}
                    aria-label="Giảm điểm đội phải"
                    className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center font-bold transition-colors ${
                      isDark
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                        : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                    }`}
                  >
                    <Minus className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => adjustScore(leftSideIsA ? 'B' : 'A', 1)}
                    className="min-w-[62px] sm:min-w-[68px] h-10 sm:h-11 px-3 rounded-xl bg-sky-600 hover:bg-sky-700 active:scale-[0.98] text-white font-mono-num text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1 shadow-xs transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+1{leftSideIsA ? 'B' : 'A'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleToggleServe}
              className={`min-h-[38px] px-3 py-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-colors ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-700'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-orange-500 shrink-0" />
              <span>Đổi giao</span>
            </button>

            <button
              type="button"
              onClick={handleSwitchCourtEnds}
              className={`min-h-[38px] px-3 py-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-colors ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-700'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200'
              }`}
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-sky-500 shrink-0" />
              <span>Đổi sân</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleFinishMatch('A')}
              className="min-h-[38px] px-2.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Flag className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Đội A thắng</span>
            </button>

            <button
              type="button"
              onClick={() => handleFinishMatch('B')}
              className="min-h-[38px] px-2.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Flag className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Đội B thắng</span>
            </button>

            <button
              type="button"
              onClick={() => handleFinishMatch('')}
              className={`col-span-2 sm:col-span-1 min-h-[38px] px-2.5 py-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-colors ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
              }`}
            >
              <Award className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>Hòa 2–2</span>
            </button>
          </div>

          <div className="pt-1 flex flex-wrap items-center justify-between gap-2 text-xs">
            <button
              type="button"
              onClick={() =>
                requireStaffAction(
                  'Vui lòng đăng nhập tài khoản Trọng tài hoặc Ban Tổ Chức để đặt lại điểm trận đấu.',
                  () =>
                    onUpdateMatch(activeMatch.id, {
                      scoreA: 0,
                      scoreB: 0,
                      servingTeam: 'A',
                      serverNumber: 2,
                      timeoutsA: 0,
                      timeoutsB: 0,
                      scoreHistory: [],
                    }),
                )
              }
              className={`min-h-[34px] px-3 py-1 rounded-lg font-semibold border inline-flex items-center gap-1.5 ${
                isDark
                  ? 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700'
                  : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Đặt lại điểm 0–0</span>
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
              className={`min-h-[34px] px-3 py-1 rounded-lg font-semibold border inline-flex items-center gap-1.5 ${
                activeMatch.status === 'live'
                  ? 'bg-amber-500/15 text-amber-500 border-amber-500/30'
                  : isDark
                  ? 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700'
                  : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{activeMatch.status === 'live' ? 'Đang Live' : 'Bắt đầu Live'}</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
