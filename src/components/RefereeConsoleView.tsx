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
  User,
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

  return [
    {
      order: 1,
      label: TEAM_EVENT_SUBCATEGORIES[0] || 'Trận 1: Đôi Nữ',
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
      label: TEAM_EVENT_SUBCATEGORIES[1] || 'Trận 2: Đôi Nam',
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
      order: 3,
      label: TEAM_EVENT_SUBCATEGORIES[2] || 'Trận 3: Đôi Nam Nữ 1',
      teamAPlayer1: a1,
      teamAPlayer2: a2,
      teamBPlayer1: b1,
      teamBPlayer2: b2,
      scoreA: 0,
      scoreB: 0,
      completed: false,
      winnerSide: '',
    },
  ];
}

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
  const isStaff = Boolean(currentAccount);
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

  // Người đỡ chéo sân tương ứng với người phát
  const rightTopReceiving = leftIsServing && leftBottomServing;
  const rightBottomReceiving = leftIsServing && leftTopServing;
  const leftTopReceiving = rightIsServing && rightBottomServing;
  const leftBottomReceiving = rightIsServing && rightTopServing;

  const serverDisplayName =
    servingSide === 'A'
      ? activeMatch.teamAPlayer1 || activeMatch.teamAName
      : activeMatch.teamBPlayer1 || activeMatch.teamBName;
  const receiverDisplayName =
    servingSide === 'A'
      ? activeMatch.teamBPlayer1 || activeMatch.teamBName
      : activeMatch.teamAPlayer1 || activeMatch.teamAName;

  // Mũi tên ngắn gọn nằm gọn giữa phần sân phát và phần sân đỡ, không đè lên tên VĐV
  const shortArrow = leftIsServing
    ? {
        x1: 215,
        y1: leftTopServing ? 74 : 166,
        x2: 385,
        y2: leftTopServing ? 166 : 74,
      }
    : {
        x1: 385,
        y1: rightTopServing ? 74 : 166,
        x2: 215,
        y2: rightTopServing ? 166 : 74,
      };

  const renderPlayerChip = (
    name: string,
    isServing: boolean,
    isReceiving: boolean,
    alignRight = false,
  ) => (
    <span
      style={{ fontSize: 'clamp(9.5px, 2.2vw, 11.5px)' }}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold leading-tight truncate max-w-full transition-all ${
        alignRight ? 'flex-row-reverse' : 'flex-row'
      } ${
        isServing
          ? 'bg-amber-400 text-slate-950 ring-2 ring-white animate-pulse shadow-md'
          : isReceiving
          ? 'bg-cyan-400 text-slate-950 ring-1 ring-cyan-100 animate-pulse shadow-sm'
          : 'bg-slate-950/75 text-white'
      }`}
    >
      <User className="w-3 h-3 shrink-0" />
      <span className="truncate">{name}</span>
      {isServing && <span className="text-[9px] font-black shrink-0">PHÁT</span>}
      {isReceiving && <span className="text-[9px] font-black shrink-0">ĐỠ</span>}
    </span>
  );

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Court Switcher & Staff Status */}
      <section className={`border rounded-2xl p-3 sm:p-4 space-y-2.5 ${surfaceCard}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 max-w-full">
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

        {/* Team Sub-Match Selector */}
        {isTeamMatch && lineupSlots.length > 0 && (
          <div
            className={`pt-2 border-t flex flex-wrap items-center justify-between gap-2 ${
              isDark ? 'border-slate-800' : 'border-slate-200'
            }`}
          >
            <div className="flex items-center gap-1.5 text-xs font-bold text-orange-500">
              <Users className="w-3.5 h-3.5 shrink-0" />
              <span>ĐỒNG ĐỘI — TRẬN NHỎ:</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {lineupSlots.map((slot) => {
                const isCurr = slot.order === activeSlotOrder;
                return (
                  <button
                    key={slot.order}
                    type="button"
                    onClick={() => handleSelectTeamSlot(slot.order)}
                    className={`min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                      isCurr
                        ? 'bg-orange-600 text-white'
                        : slot.completed
                        ? isDark
                          ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/50'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : isDark
                        ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <span>{slot.label}</span>
                    <span className="font-mono-num">
                      ({slot.scoreA}-{slot.scoreB})
                    </span>
                    {slot.completed && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Main Console Layout */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4 items-start">
        {/* LEFT: COURT LABEL + MATCH DROPDOWN + 4 ACTIONS + 3D COURT */}
        <div className="lg:col-span-6 space-y-3.5">
          <div className={`border rounded-2xl p-3 sm:p-4 space-y-3 ${surfaceCard}`}>
            {/* Chỉ hiển thị Sân đang chọn (bỏ trùng tên giải / địa điểm) */}
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-lg bg-orange-500/15 text-orange-500 font-extrabold uppercase">
                SÂN {activeMatch.courtNumber}
              </span>
              <span className={`text-[11px] font-semibold ${mutedText}`}>
                Chọn trận đấu:
              </span>
            </div>

            {/* Dropdown sổ xuống các trận tiếp theo */}
            <div className="relative">
              <select
                value={activeMatch.id}
                onChange={(e) => onSelectMatch(e.target.value)}
                aria-label="Chọn trận đấu"
                className={`w-full appearance-none min-h-[40px] pl-3 pr-9 py-2 text-xs sm:text-sm font-bold border rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                  isDark
                    ? 'bg-slate-950 border-slate-700 text-white'
                    : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              >
                {courtMatches.map((m) => (
                  <option key={m.id} value={m.id}>
                    Trận #{m.matchNumber} — {m.teamAName} vs {m.teamBName} (
                    {m.status === 'live' ? 'Đang đấu' : m.status === 'completed' ? 'Xong' : 'Sắp đấu'})
                  </option>
                ))}
                {matches
                  .filter((m) => m.courtNumber !== activeMatch.courtNumber)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      Sân {m.courtNumber} · Trận #{m.matchNumber} — {m.teamAName} vs {m.teamBName}
                    </option>
                  ))}
              </select>
              <ChevronDown
                className={`pointer-events-none w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 ${mutedText}`}
              />
            </div>

            {/* 4 Core Court Buttons: 2x2 on Portrait Mobile, 4-Col Row on Tablet/Desktop/Landscape */}
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

          {/* 3D PICKLEBALL COURT: SINGLE COLOR, BLINKING SERVE/RECEIVE WITH USER ICON, SHORT ARROW */}
          <div className={`border rounded-2xl p-3 sm:p-4 space-y-2 ${surfaceCard}`}>
            <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-mono-num font-extrabold uppercase">
                  SÂN 3D #{activeMatch.courtNumber} · {isOddScore ? 'LẺ' : 'CHẴN'} · N{serverNum}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 text-[10px] font-extrabold animate-pulse">
                  Phát
                </span>
                <span className="px-1.5 py-0.5 rounded bg-cyan-400 text-slate-950 text-[10px] font-extrabold animate-pulse">
                  Đỡ
                </span>
              </div>

              <div className="flex items-center gap-1.5 font-semibold">
                <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-500 truncate max-w-[100px]">
                  T: {serverDisplayName}
                </span>
                <span className="px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-500 truncate max-w-[100px]">
                  P: {receiverDisplayName}
                </span>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-950 p-2 sm:p-2.5 border border-slate-800">
              {/* Sân 1 màu đồng nhất (#15803d) có độ sâu 3D */}
              <div className="relative w-full max-h-[30vh] sm:max-h-[225px] aspect-[22/10] mx-auto rounded-xl bg-[#15803d] border-2 border-white/95 shadow-[0_7px_0_#064e3b,0_12px_20px_rgba(0,0,0,0.5)] overflow-hidden select-none">
                <div className="w-full h-full grid grid-cols-12 relative z-10">
                  {/* LEFT SERVICE COURTS */}
                  <div className="col-span-3 grid grid-rows-2 border-r-2 border-white/95">
                    <div className="px-1.5 py-1 border-b border-white/90 flex items-center">
                      {renderPlayerChip(pLeftTop, leftTopServing, leftTopReceiving, false)}
                    </div>
                    <div className="px-1.5 py-1 flex items-center">
                      {renderPlayerChip(pLeftBottom, leftBottomServing, leftBottomReceiving, false)}
                    </div>
                  </div>

                  {/* LEFT NVZ */}
                  <div className="col-span-2 border-r-2 border-white/95 flex items-center justify-center">
                    <span className="text-[9px] sm:text-[10px] font-extrabold tracking-widest text-white/80 -rotate-90 whitespace-nowrap">
                      NVZ 7FT
                    </span>
                  </div>

                  {/* CENTER 3D NET */}
                  <div className="col-span-2 relative flex items-center justify-center">
                    <div className="w-2 h-full bg-black/20" />
                    <div className="absolute inset-y-0 w-[3px] bg-white" />
                    <span className="absolute top-1 w-2 h-2 rounded-full bg-white border border-slate-900" />
                    <span className="absolute bottom-1 w-2 h-2 rounded-full bg-white border border-slate-900" />
                    <span className="relative z-20 px-1.5 py-0.5 rounded bg-slate-950/90 text-white text-[8px] sm:text-[9px] font-extrabold border border-white/30 whitespace-nowrap">
                      LƯỚI
                    </span>
                  </div>

                  {/* RIGHT NVZ */}
                  <div className="col-span-2 border-l-2 border-white/95 flex items-center justify-center">
                    <span className="text-[9px] sm:text-[10px] font-extrabold tracking-widest text-white/80 rotate-90 whitespace-nowrap">
                      NVZ 7FT
                    </span>
                  </div>

                  {/* RIGHT SERVICE COURTS */}
                  <div className="col-span-3 grid grid-rows-2 border-l-2 border-white/95">
                    <div className="px-1.5 py-1 border-b border-white/90 flex items-center justify-end">
                      {renderPlayerChip(pRightTop, rightTopServing, rightTopReceiving, true)}
                    </div>
                    <div className="px-1.5 py-1 flex items-center justify-end">
                      {renderPlayerChip(
                        pRightBottom,
                        rightBottomServing,
                        rightBottomReceiving,
                        true,
                      )}
                    </div>
                  </div>
                </div>

                {/* Mũi tên ngắn gọn từ Phát sang Đỡ, nằm giữa khu vực sân */}
                <svg
                  viewBox="0 0 600 240"
                  className="pointer-events-none absolute inset-0 w-full h-full z-20"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <marker
                      id="shortServeArrow"
                      markerWidth="7"
                      markerHeight="7"
                      refX="5"
                      refY="3.5"
                      orient="auto"
                    >
                      <polygon points="0 0, 7 3.5, 0 7" fill="#FACC15" />
                    </marker>
                  </defs>
                  <line
                    x1={shortArrow.x1}
                    y1={shortArrow.y1}
                    x2={shortArrow.x2}
                    y2={shortArrow.y2}
                    stroke="#020617"
                    strokeWidth="4.5"
                    strokeOpacity="0.4"
                  />
                  <line
                    x1={shortArrow.x1}
                    y1={shortArrow.y1}
                    x2={shortArrow.x2}
                    y2={shortArrow.y2}
                    stroke="#FACC15"
                    strokeWidth="2.75"
                    strokeDasharray="6 4"
                    markerEnd="url(#shortServeArrow)"
                  />
                </svg>
              </div>

              <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-slate-300 px-1">
                <span className="truncate font-bold text-amber-300">{leftTeamName}</span>
                <span className="text-slate-400 shrink-0">Phát → Đỡ</span>
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
