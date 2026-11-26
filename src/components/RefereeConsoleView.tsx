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
  Coins,
  Flag,
  Megaphone,
  Minus,
  Plus,
  RefreshCw,
  RotateCcw,
  Shuffle,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  MATCH_STAGE_LABELS,
  type Match,
  type Registration,
  type StaffAccount,
  type TeamLineupSlot,
  type Tournament,
} from '../types/tournament';
import { formatScoreCallout, isTeamDivision } from '../utils/pickleballEngine';

type ThemeMode = 'light' | 'dark';
type GenderType = 'male' | 'female' | 'unknown';
type SubEventKey = 'women_doubles' | 'men_doubles' | 'mixed_1' | 'mixed_2' | 'singles';

interface RosterCandidate {
  id: string;
  name: string;
  gender: GenderType;
}

interface MatchSubEventConfig {
  key: SubEventKey;
  order: number;
  label: string;
  isTiebreakerSingles?: boolean;
  sideARole1: 'male' | 'female' | 'any';
  sideARole2: 'male' | 'female' | 'any' | 'none';
  sideBRole1: 'male' | 'female' | 'any';
  sideBRole2: 'male' | 'female' | 'any' | 'none';
}

const GROUP_STAGE_SUBEVENTS: MatchSubEventConfig[] = [
  {
    key: 'women_doubles',
    order: 1,
    label: 'Đôi nữ',
    sideARole1: 'female',
    sideARole2: 'female',
    sideBRole1: 'female',
    sideBRole2: 'female',
  },
  {
    key: 'men_doubles',
    order: 2,
    label: 'Đôi nam',
    sideARole1: 'male',
    sideARole2: 'male',
    sideBRole1: 'male',
    sideBRole2: 'male',
  },
  {
    key: 'mixed_1',
    order: 3,
    label: 'Đôi nam nữ 1',
    sideARole1: 'male',
    sideARole2: 'female',
    sideBRole1: 'male',
    sideBRole2: 'female',
  },
  {
    key: 'mixed_2',
    order: 4,
    label: 'Đôi nam nữ 2',
    sideARole1: 'male',
    sideARole2: 'female',
    sideBRole1: 'male',
    sideBRole2: 'female',
  },
];

const TIEBREAKER_SINGLES_EVENT: MatchSubEventConfig = {
  key: 'singles',
  order: 5,
  label: 'Đánh đơn',
  isTiebreakerSingles: true,
  sideARole1: 'any',
  sideARole2: 'none',
  sideBRole1: 'any',
  sideBRole2: 'none',
};

const MAX_MATCHES_PER_PLAYER = 2;

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

function inferGender(rawName: string, explicitGender?: string): GenderType {
  if (explicitGender === 'female' || explicitGender === 'Nữ' || explicitGender === 'nu') {
    return 'female';
  }
  if (explicitGender === 'male' || explicitGender === 'Nam' || explicitGender === 'nam') {
    return 'male';
  }
  const lower = rawName.toLowerCase();
  if (lower.includes('(nữ)') || lower.includes('- nữ') || lower.includes('nu')) {
    return 'female';
  }
  if (lower.includes('(nam)') || lower.includes('- nam') || lower.includes('nam')) {
    return 'male';
  }
  return 'unknown';
}

function cleanAthleteName(rawName: string): string {
  return rawName
    .replace(/\((nam|nữ|nu|trình\s*[a-z0-9]+)\)/gi, '')
    .replace(/\s*-\s*(nam|nữ|nu)$/i, '')
    .trim();
}

function shortenPlayerName(rawName: string): string {
  const cleaned = cleanAthleteName(rawName);
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length <= 2) return cleaned;
  return parts.slice(-2).join(' ');
}

function hasReachedTargetScore(scoreA: number, scoreB: number, pointsToWin: number): boolean {
  const target = Math.max(1, pointsToWin || 15);
  return scoreA >= target || scoreB >= target;
}

function buildInitialSlots(match: Match, includeSingles: boolean): TeamLineupSlot[] {
  const configs = includeSingles
    ? [...GROUP_STAGE_SUBEVENTS, TIEBREAKER_SINGLES_EVENT]
    : GROUP_STAGE_SUBEVENTS;

  const existing = Array.isArray(match.teamLineupSlots) ? match.teamLineupSlots : [];

  return configs.map((cfg) => {
    const found = existing.find(
      (s) =>
        s.order === cfg.order ||
        s.label?.trim().toLowerCase() === cfg.label.trim().toLowerCase(),
    );
    if (found) {
      return {
        ...found,
        order: cfg.order,
        label: cfg.label,
        scoreA: found.scoreA ?? 0,
        scoreB: found.scoreB ?? 0,
        completed: Boolean(found.completed),
        winnerSide: found.winnerSide ?? '',
      };
    }
    return {
      order: cfg.order,
      label: cfg.label,
      teamAPlayer1: '',
      teamAPlayer2: '',
      teamBPlayer1: '',
      teamBPlayer2: '',
      scoreA: 0,
      scoreB: 0,
      completed: false,
      winnerSide: '',
    };
  });
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
  const shortName = shortenPlayerName(name || 'Chưa chọn');
  const pillStyle = isServing
    ? 'bg-amber-400 text-slate-950 ring-2 ring-white shadow-md'
    : isReceiver
    ? 'bg-cyan-300 text-slate-950 ring-2 ring-white/90 shadow-md'
    : 'bg-slate-950/80 text-white border border-white/25';

  return (
    <div
      title={name || 'Chưa chọn VĐV'}
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
        className={`inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[11px] font-bold truncate max-w-[70px] sm:max-w-[124px] landscape:max-w-[66px] ${pillStyle}`}
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

  // Modals: Tung đồng xu, Chọn VĐV nội dung, Danh sách trận nhỏ
  const [showCoinTossModal, setShowCoinTossModal] = useState(false);
  const [coinWinner, setCoinWinner] = useState<'A' | 'B'>('A');
  const [coinChoice, setCoinChoice] = useState<'ball' | 'side'>('ball');
  const [coinResultLabel, setCoinResultLabel] = useState<'SẤP' | 'NGỬA'>('NGỬA');

  const [showLineupModal, setShowLineupModal] = useState(false);
  const [showSubmatchModal, setShowSubmatchModal] = useState(false);

  const [draftA1, setDraftA1] = useState('');
  const [draftA2, setDraftA2] = useState('');
  const [draftB1, setDraftB1] = useState('');
  const [draftB2, setDraftB2] = useState('');
  const [newRosterNameA, setNewRosterNameA] = useState('');
  const [newRosterGenderA, setNewRosterGenderA] = useState<'male' | 'female'>('male');
  const [newRosterNameB, setNewRosterNameB] = useState('');
  const [newRosterGenderB, setNewRosterGenderB] = useState<'male' | 'female'>('male');

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

  const isTeamMatch = activeMatch
    ? isTeamDivision(activeMatch.division, activeMatch.competitionType) ||
      activeMatch.stage === 'group'
    : false;

  const hasGroupStageTie = useMemo(() => {
    if (!activeMatch) return false;
    const slots = buildInitialSlots(activeMatch, false);
    const completedGroupSlots = slots.slice(0, 4).filter((s) => s.completed);
    if (completedGroupSlots.length < 4) return false;
    const winsA = completedGroupSlots.filter((s) => s.winnerSide === 'A').length;
    const winsB = completedGroupSlots.filter((s) => s.winnerSide === 'B').length;
    return winsA === winsB;
  }, [activeMatch]);

  const lineupSlots = useMemo(
    () => (activeMatch ? buildInitialSlots(activeMatch, hasGroupStageTie) : []),
    [activeMatch, hasGroupStageTie],
  );

  const activeSlotOrder = activeMatch?.activeSlotOrder || 1;
  const currentSlot =
    lineupSlots.find((s) => s.order === activeSlotOrder) || lineupSlots[0] || null;

  const currentSubEventConfig: MatchSubEventConfig = useMemo(() => {
    const allConfigs = hasGroupStageTie
      ? [...GROUP_STAGE_SUBEVENTS, TIEBREAKER_SINGLES_EVENT]
      : GROUP_STAGE_SUBEVENTS;
    return (
      allConfigs.find((c) => c.order === activeSlotOrder) ||
      allConfigs.find((c) => c.label === (activeMatch?.teamSubCategory || currentSlot?.label)) ||
      GROUP_STAGE_SUBEVENTS[0]
    );
  }, [hasGroupStageTie, activeSlotOrder, activeMatch?.teamSubCategory, currentSlot?.label]);

  // Đồng bộ form chọn VĐV khi mở modal hoặc đổi slot
  useEffect(() => {
    if (!activeMatch) return;
    const slot = lineupSlots.find((s) => s.order === activeSlotOrder);
    setDraftA1(slot?.teamAPlayer1 || activeMatch.teamAPlayer1 || '');
    setDraftA2(
      currentSubEventConfig.sideARole2 === 'none'
        ? ''
        : slot?.teamAPlayer2 || activeMatch.teamAPlayer2 || '',
    );
    setDraftB1(slot?.teamBPlayer1 || activeMatch.teamBPlayer1 || '');
    setDraftB2(
      currentSubEventConfig.sideBRole2 === 'none'
        ? ''
        : slot?.teamBPlayer2 || activeMatch.teamBPlayer2 || '',
    );
  }, [
    activeMatch?.id,
    activeSlotOrder,
    lineupSlots,
    currentSubEventConfig.sideARole2,
    currentSubEventConfig.sideBRole2,
  ]);

  // Danh sách VĐV của Đội A và Đội B (kèm giới tính)
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

  const buildCandidates = (
    reg: Registration | undefined,
    fallbackPlayers: Array<string | undefined>,
    teamName: string,
  ): RosterCandidate[] => {
    const map = new Map<string, RosterCandidate>();
    const pushItem = (raw: string, explicitGender?: string) => {
      const trimmed = raw.trim();
      if (!trimmed) return;
      const key = cleanAthleteName(trimmed).toLowerCase();
      if (!key) return;
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          name: trimmed,
          gender: inferGender(trimmed, explicitGender),
        });
      }
    };

    if (reg?.squadRoster && Array.isArray(reg.squadRoster)) {
      reg.squadRoster.forEach((item) => pushItem(item));
    }
    if (reg?.player1Name) pushItem(reg.player1Name, reg.player1Gender);
    if (reg?.player2Name) pushItem(reg.player2Name, reg.player2Gender);

    fallbackPlayers.forEach((p) => {
      if (p) pushItem(p);
    });
    teamName
      .split('/')
      .map((s) => s.trim())
      .forEach((p) => {
        if (p) pushItem(p);
      });

    return Array.from(map.values());
  };

  const candidatesA = useMemo(
    () =>
      activeMatch
        ? buildCandidates(
            regTeamA,
            [activeMatch.teamAPlayer1, activeMatch.teamAPlayer2],
            activeMatch.teamAName,
          )
        : [],
    [regTeamA, activeMatch],
  );

  const candidatesB = useMemo(
    () =>
      activeMatch
        ? buildCandidates(
            regTeamB,
            [activeMatch.teamBPlayer1, activeMatch.teamBPlayer2],
            activeMatch.teamBName,
          )
        : [],
    [regTeamB, activeMatch],
  );

  // Đếm số trận/nội dung mỗi VĐV đã tham gia (tối đa 02 trận / VĐV)
  const matchCountByPlayer = useMemo(() => {
    const counts = new Map<string, number>();
    const addCount = (name?: string) => {
      if (!name) return;
      const key = cleanAthleteName(name).toLowerCase();
      if (!key) return;
      counts.set(key, (counts.get(key) || 0) + 1);
    };

    lineupSlots.forEach((slot) => {
      const hasAny =
        slot.completed ||
        Boolean(slot.teamAPlayer1) ||
        Boolean(slot.teamAPlayer2) ||
        Boolean(slot.teamBPlayer1) ||
        Boolean(slot.teamBPlayer2);
      if (!hasAny) return;
      addCount(slot.teamAPlayer1);
      addCount(slot.teamAPlayer2);
      addCount(slot.teamBPlayer1);
      addCount(slot.teamBPlayer2);
    });

    return counts;
  }, [lineupSlots]);

  // Tính số trận đã dùng trước khi tính slot đang chỉnh sửa (để sửa lại chính slot hiện tại vẫn chọn được)
  const priorMatchCountByPlayer = useMemo(() => {
    const counts = new Map<string, number>();
    const addCount = (name?: string) => {
      if (!name) return;
      const key = cleanAthleteName(name).toLowerCase();
      if (!key) return;
      counts.set(key, (counts.get(key) || 0) + 1);
    };

    lineupSlots.forEach((slot) => {
      if (slot.order === activeSlotOrder) return;
      const hasAny =
        slot.completed ||
        Boolean(slot.teamAPlayer1) ||
        Boolean(slot.teamAPlayer2) ||
        Boolean(slot.teamBPlayer1) ||
        Boolean(slot.teamBPlayer2);
      if (!hasAny) return;
      addCount(slot.teamAPlayer1);
      addCount(slot.teamAPlayer2);
      addCount(slot.teamBPlayer1);
      addCount(slot.teamBPlayer2);
    });

    return counts;
  }, [lineupSlots, activeSlotOrder]);

  // Lọc danh sách VĐV khả dụng cho từng slot:
  // 1. Lọc theo giới tính của nội dung (Nam / Nữ)
  // 2. Ẩn VĐV đã được chọn ở vị trí kia trong cùng nội dung
  // 3. Ẩn VĐV đã đủ tối đa 02 trận
  const getFilteredOptions = (
    pool: RosterCandidate[],
    role: 'male' | 'female' | 'any' | 'none',
    selectedOtherNames: string[],
    currentValue: string,
  ): RosterCandidate[] => {
    if (role === 'none') return [];
    const currentKey = cleanAthleteName(currentValue).toLowerCase();
    const otherKeys = new Set(
      selectedOtherNames
        .map((n) => cleanAthleteName(n).toLowerCase())
        .filter((k) => k && k !== currentKey),
    );

    return pool.filter((cand) => {
      // Nếu đã được chọn ở vị trí khác trong nội dung này -> ẩn đi
      if (otherKeys.has(cand.id)) return false;

      // Kiểm tra giới hạn tối đa 02 trận
      const priorUsed = priorMatchCountByPlayer.get(cand.id) || 0;
      const isCurrentChoice = cand.id === currentKey;
      if (!isCurrentChoice && priorUsed >= MAX_MATCHES_PER_PLAYER) {
        return false;
      }

      // Lọc theo giới tính (nếu VĐV có giới tính rõ ràng thì lọc khớp; nếu 'unknown' vẫn cho phép để trọng tài linh hoạt)
      if (role === 'male' && cand.gender === 'female') return false;
      if (role === 'female' && cand.gender === 'male') return false;

      return true;
    });
  };

  const optionsA1 = useMemo(
    () => getFilteredOptions(candidatesA, currentSubEventConfig.sideARole1, [draftA2], draftA1),
    [candidatesA, currentSubEventConfig.sideARole1, draftA2, draftA1, priorMatchCountByPlayer],
  );
  const optionsA2 = useMemo(
    () => getFilteredOptions(candidatesA, currentSubEventConfig.sideARole2, [draftA1], draftA2),
    [candidatesA, currentSubEventConfig.sideARole2, draftA1, draftA2, priorMatchCountByPlayer],
  );
  const optionsB1 = useMemo(
    () => getFilteredOptions(candidatesB, currentSubEventConfig.sideBRole1, [draftB2], draftB1),
    [candidatesB, currentSubEventConfig.sideBRole1, draftB2, draftB1, priorMatchCountByPlayer],
  );
  const optionsB2 = useMemo(
    () => getFilteredOptions(candidatesB, currentSubEventConfig.sideBRole2, [draftB1], draftB2),
    [candidatesB, currentSubEventConfig.sideBRole2, draftB1, draftB2, priorMatchCountByPlayer],
  );

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

  // Tay 1 ghi điểm -> đổi chỗ 2 VĐV trên sân của đội đang giao
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
          if (side === 'A' && nextA2) {
            const tmp = nextA1;
            nextA1 = nextA2;
            nextA2 = tmp;
          } else if (side === 'B' && nextB2) {
            const tmp = nextB1;
            nextB1 = nextB2;
            nextB2 = tmp;
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

        const updatedSlots = lineupSlots.map((slot) =>
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
        );

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
            slotOrder: activeSlotOrder,
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

  // Mất điểm -> đổi tay (Tay 1 sang Tay 2; Tay 2 sang đội đối phương)
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

  // Mở modal tung đồng xu
  const handleOpenCoinToss = () => {
    if (!activeMatch) return;
    requireStaffAction(
      'Vui lòng đăng nhập tài khoản Trọng tài hoặc Ban Tổ Chức để tung đồng xu bốc thăm.',
      () => {
        const winner: 'A' | 'B' = Math.random() < 0.5 ? 'A' : 'B';
        const coinFace: 'SẤP' | 'NGỬA' = Math.random() < 0.5 ? 'SẤP' : 'NGỬA';
        setCoinWinner(winner);
        setCoinResultLabel(coinFace);
        setCoinChoice('ball');
        setShowCoinTossModal(true);
      },
    );
  };

  const handleFlipCoinAgain = () => {
    const winner: 'A' | 'B' = Math.random() < 0.5 ? 'A' : 'B';
    const coinFace: 'SẤP' | 'NGỬA' = Math.random() < 0.5 ? 'SẤP' : 'NGỬA';
    setCoinWinner(winner);
    setCoinResultLabel(coinFace);
  };

  const handleApplyCoinToss = (chosenSideForOtherTeam?: 'left' | 'right') => {
    if (!activeMatch) return;
    const otherTeam: 'A' | 'B' = coinWinner === 'A' ? 'B' : 'A';
    const otherSide: 'left' | 'right' = chosenSideForOtherTeam || 'left';

    // Nếu đội thắng đồng xu chọn BÓNG -> chỉ phát bóng, đội kia chọn SÂN
    // Nếu đội thắng đồng xu chọn SÂN -> đội thắng chọn sân, đội kia phát bóng
    const servingTeam: 'A' | 'B' = coinChoice === 'ball' ? coinWinner : otherTeam;
    const courtSideA: 'left' | 'right' =
      coinChoice === 'ball'
        ? otherTeam === 'A'
          ? otherSide
          : otherSide === 'left'
          ? 'right'
          : 'left'
        : coinWinner === 'A'
        ? otherSide
        : otherSide === 'left'
        ? 'right'
        : 'left';

    onUpdateMatch(activeMatch.id, {
      status: activeMatch.status === 'scheduled' ? 'live' : activeMatch.status,
      startedAtMs: activeMatch.startedAtMs || Date.now(),
      scoreA: 0,
      scoreB: 0,
      servingTeam,
      serverNumber: 2,
      courtSideA,
    });

    const winnerName = coinWinner === 'A' ? activeMatch.teamAName : activeMatch.teamBName;
    const otherName = otherTeam === 'A' ? activeMatch.teamAName : activeMatch.teamBName;
    const servingName = servingTeam === 'A' ? activeMatch.teamAName : activeMatch.teamBName;

    setShowCoinTossModal(false);
    setNotice(
      `Đồng xu ${coinResultLabel}: ${winnerName} thắng chọn ${
        coinChoice === 'ball'
          ? `Bóng (${servingName} phát) · ${otherName} chọn sân ${otherSide === 'left' ? 'Trái' : 'Phải'}`
          : `Sân · ${servingName} phát bóng`
      }.`,
    );
  };

  const handleSelectTeamSlot = (slotOrder: number) => {
    if (!activeMatch) return;
    requireStaffAction(
      'Vui lòng đăng nhập tài khoản Trọng tài hoặc Ban Tổ Chức để chuyển nội dung thi đấu.',
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
          teamLineupSlots: lineupSlots,
        });
        setShowSubmatchModal(false);
      },
    );
  };

  const handleSaveLineup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMatch) return;
    requireStaffAction(
      'Vui lòng đăng nhập tài khoản Trọng tài hoặc Ban Tổ Chức để lưu VĐV thi đấu.',
      () => {
        const cleanA1 = draftA1.trim();
        const cleanA2 = currentSubEventConfig.sideARole2 === 'none' ? '' : draftA2.trim();
        const cleanB1 = draftB1.trim();
        const cleanB2 = currentSubEventConfig.sideBRole2 === 'none' ? '' : draftB2.trim();

        const updatedSlots = lineupSlots.map((slot) =>
          slot.order === activeSlotOrder
            ? {
                ...slot,
                label: currentSubEventConfig.label,
                teamAPlayer1: cleanA1,
                teamAPlayer2: cleanA2,
                teamBPlayer1: cleanB1,
                teamBPlayer2: cleanB2,
              }
            : slot,
        );

        onUpdateMatch(activeMatch.id, {
          teamSubCategory: currentSubEventConfig.label,
          teamAPlayer1: cleanA1,
          teamAPlayer2: cleanA2,
          teamBPlayer1: cleanB1,
          teamBPlayer2: cleanB2,
          teamLineupSlots: updatedSlots,
        });
        setShowLineupModal(false);
        setNotice(
          `Đã lưu VĐV ${currentSubEventConfig.label}: Đội A (${[cleanA1, cleanA2].filter(Boolean).join(' & ') || 'Chưa chọn'}) vs Đội B (${[cleanB1, cleanB2].filter(Boolean).join(' & ') || 'Chưa chọn'}).`,
        );
      },
    );
  };

  const handleQuickAddRoster = (side: 'A' | 'B') => {
    if (!activeMatch || !onAddRosterAthlete) return;
    const rawInput = (side === 'A' ? newRosterNameA : newRosterNameB).trim();
    if (!rawInput) return;
    const targetReg = side === 'A' ? regTeamA : regTeamB;
    if (!targetReg) return;

    const genderTag = (side === 'A' ? newRosterGenderA : newRosterGenderB) === 'female' ? '(Nữ)' : '(Nam)';
    const formattedLabel = `${cleanAthleteName(rawInput)} ${genderTag}`;

    requireAdminAction(
      'Chỉ tài khoản Ban Tổ Chức (Admin) mới được phép bổ sung VĐV mới vào danh sách đội.',
      () => {
        onAddRosterAthlete(targetReg.id, formattedLabel);
        if (side === 'A') {
          if (!draftA1) setDraftA1(formattedLabel);
          else if (!draftA2 && currentSubEventConfig.sideARole2 !== 'none') setDraftA2(formattedLabel);
          setNewRosterNameA('');
        } else {
          if (!draftB1) setDraftB1(formattedLabel);
          else if (!draftB2 && currentSubEventConfig.sideBRole2 !== 'none') setDraftB2(formattedLabel);
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

        const groupFour = nextSlots.slice(0, 4);
        const completedGroupFour = groupFour.filter((s) => s.completed);
        const winsA = completedGroupFour.filter((s) => s.winnerSide === 'A').length;
        const winsB = completedGroupFour.filter((s) => s.winnerSide === 'B').length;
        const isTiedAfterFour = completedGroupFour.length === 4 && winsA === winsB;

        const fullSlots = isTiedAfterFour
          ? buildInitialSlots({ ...activeMatch, teamLineupSlots: nextSlots }, true)
          : nextSlots;

        const nextUnfinished = fullSlots.find(
          (s) => !s.completed && s.order !== activeSlotOrder,
        );

        if (nextUnfinished) {
          onUpdateMatch(activeMatch.id, {
            status: 'live',
            teamLineupSlots: fullSlots,
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
            isTiedAfterFour
              ? `4 nội dung hòa ${winsA}-${winsB} · Mở thêm nội dung Đánh đơn quyết định!`
              : `Đã lưu ${currentSlot?.label || 'Nội dung'} (${activeMatch.scoreA}-${activeMatch.scoreB}). Chuyển sang ${nextUnfinished.label}.`,
          );
          if (isTiedAfterFour) {
            setShowLineupModal(true);
          }
          return;
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

  const isSinglesEvent =
    currentSubEventConfig.sideARole2 === 'none' || currentSubEventConfig.sideBRole2 === 'none';

  const leftPlayers = leftSideIsA
    ? isSinglesEvent
      ? [activeMatch.teamAPlayer1 || activeMatch.teamAName]
      : [activeMatch.teamAPlayer1, activeMatch.teamAPlayer2].filter(Boolean)
    : isSinglesEvent
    ? [activeMatch.teamBPlayer1 || activeMatch.teamBName]
    : [activeMatch.teamBPlayer1, activeMatch.teamBPlayer2].filter(Boolean);

  const rightPlayers = leftSideIsA
    ? isSinglesEvent
      ? [activeMatch.teamBPlayer1 || activeMatch.teamBName]
      : [activeMatch.teamBPlayer1, activeMatch.teamBPlayer2].filter(Boolean)
    : isSinglesEvent
    ? [activeMatch.teamAPlayer1 || activeMatch.teamAName]
    : [activeMatch.teamAPlayer1, activeMatch.teamAPlayer2].filter(Boolean);

  const pLeftTop = leftPlayers[0] || (leftSideIsA ? 'VĐV A1' : 'VĐV B1');
  const pLeftBottom = leftPlayers[1] || (isSinglesEvent ? '' : leftSideIsA ? 'VĐV A2' : 'VĐV B2');
  const pRightTop = rightPlayers[0] || (leftSideIsA ? 'VĐV B1' : 'VĐV A1');
  const pRightBottom = rightPlayers[1] || (isSinglesEvent ? '' : leftSideIsA ? 'VĐV B2' : 'VĐV A2');

  const servingSide = activeMatch.servingTeam;
  const serverNum = activeMatch.serverNumber || 2;
  const servingScore = servingSide === 'A' ? activeMatch.scoreA : activeMatch.scoreB;
  const isServingScoreOdd = servingScore % 2 !== 0;

  const leftIsServing =
    (leftSideIsA && servingSide === 'A') || (!leftSideIsA && servingSide === 'B');
  const rightIsServing = !leftIsServing;

  const leftTopServing = leftIsServing && (isSinglesEvent || isServingScoreOdd);
  const leftBottomServing = leftIsServing && !isSinglesEvent && !isServingScoreOdd;
  const rightTopServing = rightIsServing && (isSinglesEvent || !isServingScoreOdd);
  const rightBottomServing = rightIsServing && !isSinglesEvent && isServingScoreOdd;

  const leftTopReceiver = rightIsServing && (isSinglesEvent || rightBottomServing);
  const leftBottomReceiver = rightIsServing && !isSinglesEvent && rightTopServing;
  const rightTopReceiver = leftIsServing && (isSinglesEvent || leftBottomServing);
  const rightBottomReceiver = leftIsServing && !isSinglesEvent && leftTopServing;

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

  const otherTeamOfCoin: 'A' | 'B' = coinWinner === 'A' ? 'B' : 'A';
  const otherTeamNameOfCoin =
    otherTeamOfCoin === 'A' ? activeMatch.teamAName : activeMatch.teamBName;

  return (
    <div className="w-full max-w-full overflow-x-hidden overscroll-none space-y-1.5 sm:space-y-2.5 landscape:space-y-1 pb-12 sm:pb-0 landscape:pb-9">
      <section className="grid grid-cols-1 lg:grid-cols-12 landscape:grid-cols-12 gap-1.5 sm:gap-3 landscape:gap-1.5 items-start">
        {/* LEFT: SÂN + CHỌN NỘI DUNG + 4 NÚT + SÂN 3D */}
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

            {/* Chọn nội dung (Đôi nữ, Đôi nam, Đôi nam nữ 1, Đôi nam nữ 2 + Đánh đơn khi hòa) */}
            <div className="flex items-center gap-1.5 min-w-0">
              <button
                type="button"
                onClick={() => setShowSubmatchModal(true)}
                className={`flex-1 min-w-0 min-h-[30px] sm:min-h-[36px] landscape:min-h-[24px] px-2.5 py-1 rounded-xl border text-left flex items-center justify-between gap-2 transition-colors ${
                  isDark
                    ? 'bg-slate-950/80 hover:bg-slate-800 border-slate-700 text-slate-100'
                    : 'bg-slate-50 hover:bg-orange-50/60 border-slate-200 text-slate-900'
                }`}
              >
                <span className="inline-flex items-center gap-1.5 min-w-0 text-[10px] sm:text-xs font-bold">
                  <Users className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                  <span className="truncate">
                    {currentSubEventConfig.label} ({activeMatch.scoreA}-{activeMatch.scoreB})
                  </span>
                </span>
                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-orange-500 shrink-0">
                  <span>Đổi ND</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  requireStaffAction(
                    'Vui lòng đăng nhập tài khoản Trọng tài hoặc Ban Tổ Chức để chọn VĐV cho nội dung này.',
                    () => setShowLineupModal(true),
                  )
                }
                className="min-h-[30px] sm:min-h-[36px] landscape:min-h-[24px] px-2.5 py-1 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-[10px] sm:text-xs font-extrabold flex items-center gap-1 shrink-0 transition-colors"
              >
                <UserCheck className="w-3.5 h-3.5 shrink-0" />
                <span>Chọn VĐV</span>
              </button>
            </div>

            {/* 4 nút điều khiển sân */}
            <div className="grid grid-cols-4 gap-1 sm:gap-2">
              <button
                type="button"
                onClick={handleOpenCoinToss}
                className="min-h-[30px] sm:min-h-[36px] landscape:min-h-[24px] px-1 sm:px-2 py-1 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-[10px] sm:text-xs font-bold flex items-center justify-center gap-1 transition-colors min-w-0"
              >
                <Shuffle className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                <span className="truncate">Bốc thăm</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  requireStaffAction(
                    'Vui lòng đăng nhập tài khoản Trọng tài hoặc Ban Tổ Chức để chọn/đổi VĐV đứng sân.',
                    () => setShowLineupModal(true),
                  )
                }
                className={`min-h-[30px] sm:min-h-[36px] landscape:min-h-[24px] px-1 sm:px-2 py-1 rounded-xl text-[10px] sm:text-xs font-bold border flex items-center justify-center gap-1 transition-colors min-w-0 ${
                  showLineupModal
                    ? 'bg-orange-600 text-white border-orange-600'
                    : isDark
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-700'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200'
                }`}
              >
                <UserPlus className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0 text-orange-500" />
                <span className="truncate">Đội hình</span>
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
                    {!isSinglesEvent && (
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
                    )}
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
                    {!isSinglesEvent && (
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
                    )}
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
                {currentSubEventConfig.label} · {activeMatch.groupName || MATCH_STAGE_LABELS[activeMatch.stage]}
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

      {/* POPUP TUNG ĐỒNG XU: CHỌN BÓNG (CHỈ PHÁT BÓNG) HOẶC CHỌN SÂN */}
      {showCoinTossModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          onClick={() => setShowCoinTossModal(false)}
        >
          <div
            className={`w-full max-w-md rounded-2xl border p-4 space-y-3.5 shadow-2xl ${surfaceCard}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <Coins className="w-4 h-4 text-amber-500 shrink-0" />
                <h3 className="text-sm font-extrabold truncate">Bốc thăm tung đồng xu</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCoinTossModal(false)}
                className={`p-1 rounded-lg ${
                  isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-600'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div
              className={`p-3 rounded-xl border text-center space-y-2 ${
                isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-amber-50/70 border-amber-200'
              }`}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400 text-slate-950 font-black text-xs">
                <Coins className="w-3.5 h-3.5" />
                <span>MẶT ĐỒNG XU: {coinResultLabel}</span>
              </div>
              <p className="text-xs font-bold">
                Đội thắng đồng xu:{' '}
                <span className="text-orange-500">
                  {coinWinner === 'A' ? activeMatch.teamAName : activeMatch.teamBName}
                </span>
              </p>
              <button
                type="button"
                onClick={handleFlipCoinAgain}
                className="min-h-[28px] px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-bold inline-flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Tung lại đồng xu</span>
              </button>
            </div>

            <div className="space-y-2">
              <div className="text-[11px] font-bold">
                1. Đội thắng đồng xu lựa chọn:
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCoinChoice('ball')}
                  className={`min-h-[36px] px-3 py-1.5 rounded-xl border text-xs font-bold transition-colors ${
                    coinChoice === 'ball'
                      ? 'bg-orange-600 text-white border-orange-600'
                      : isDark
                      ? 'bg-slate-800 text-slate-200 border-slate-700'
                      : 'bg-slate-100 text-slate-800 border-slate-200'
                  }`}
                >
                  Chọn Bóng (Chỉ phát bóng)
                </button>
                <button
                  type="button"
                  onClick={() => setCoinChoice('side')}
                  className={`min-h-[36px] px-3 py-1.5 rounded-xl border text-xs font-bold transition-colors ${
                    coinChoice === 'side'
                      ? 'bg-sky-600 text-white border-sky-600'
                      : isDark
                      ? 'bg-slate-800 text-slate-200 border-slate-700'
                      : 'bg-slate-100 text-slate-800 border-slate-200'
                  }`}
                >
                  Chọn Sân (Đội kia phát)
                </button>
              </div>
            </div>

            {coinChoice === 'ball' ? (
              <div className="space-y-2">
                <div className="text-[11px] font-bold">
                  2. {otherTeamNameOfCoin} chỉ còn lựa chọn sân:
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleApplyCoinToss('left')}
                    className="min-h-[36px] px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                  >
                    Đứng Bên Trái
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyCoinToss('right')}
                    className="min-h-[36px] px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                  >
                    Đứng Bên Phải
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-[11px] font-bold">
                  2. Chọn sân cho đội thắng đồng xu (Đội {otherTeamNameOfCoin} sẽ phát bóng):
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleApplyCoinToss('left')}
                    className="min-h-[36px] px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                  >
                    Chọn Sân Trái
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyCoinToss('right')}
                    className="min-h-[36px] px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                  >
                    Chọn Sân Phải
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* POPUP CHỌN VĐV THEO NỘI DUNG (LỌC NAM/NỮ, ẨN ĐÃ CHỌN, TỐI ĐA 02 TRẬN/VĐV) */}
      {showLineupModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          onClick={() => setShowLineupModal(false)}
        >
          <form
            onSubmit={handleSaveLineup}
            className={`w-full max-w-2xl rounded-2xl border p-4 space-y-3 shadow-2xl max-h-[88dvh] overflow-y-auto ${surfaceCard}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2.5">
              <div className="min-w-0">
                <h3 className="text-sm font-extrabold">
                  Chọn VĐV thi đấu — {currentSubEventConfig.label}
                </h3>
                <p className={`text-[11px] truncate ${mutedText}`}>
                  Lọc theo nội dung · Ẩn VĐV đã chọn trong trận · Tối đa {MAX_MATCHES_PER_PLAYER} trận/VĐV
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowLineupModal(false)}
                className={`p-1 rounded-lg ${
                  isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-600'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* ĐỘI A */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-orange-500 truncate">
                  Đội A: {activeMatch.teamAName}
                </div>

                <div>
                  <label className="block text-[11px] font-semibold mb-1">
                    VĐV A1 ({currentSubEventConfig.sideARole1 === 'female' ? 'Nữ' : currentSubEventConfig.sideARole1 === 'male' ? 'Nam' : 'Tự do'})
                  </label>
                  <select
                    value={draftA1}
                    onChange={(e) => setDraftA1(e.target.value)}
                    className={`w-full min-h-[34px] px-2.5 py-1 text-xs border rounded-xl ${
                      isDark
                        ? 'bg-slate-950 border-slate-700 text-white'
                        : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="">-- Chọn VĐV A1 --</option>
                    {optionsA1.map((c) => {
                      const used = matchCountByPlayer.get(c.id) || 0;
                      return (
                        <option key={`a1_${c.id}`} value={c.name}>
                          {cleanAthleteName(c.name)} ({used}/{MAX_MATCHES_PER_PLAYER} trận)
                        </option>
                      );
                    })}
                  </select>
                </div>

                {currentSubEventConfig.sideARole2 !== 'none' && (
                  <div>
                    <label className="block text-[11px] font-semibold mb-1">
                      VĐV A2 ({currentSubEventConfig.sideARole2 === 'female' ? 'Nữ' : currentSubEventConfig.sideARole2 === 'male' ? 'Nam' : 'Tự do'})
                    </label>
                    <select
                      value={draftA2}
                      onChange={(e) => setDraftA2(e.target.value)}
                      className={`w-full min-h-[34px] px-2.5 py-1 text-xs border rounded-xl ${
                        isDark
                          ? 'bg-slate-950 border-slate-700 text-white'
                          : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="">-- Chọn VĐV A2 --</option>
                      {optionsA2.map((c) => {
                        const used = matchCountByPlayer.get(c.id) || 0;
                        return (
                          <option key={`a2_${c.id}`} value={c.name}>
                            {cleanAthleteName(c.name)} ({used}/{MAX_MATCHES_PER_PLAYER} trận)
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}

                {isAdmin && onAddRosterAthlete && (
                  <div className="flex items-center gap-1 pt-1">
                    <input
                      type="text"
                      value={newRosterNameA}
                      onChange={(e) => setNewRosterNameA(e.target.value)}
                      placeholder="Thêm VĐV Đội A..."
                      className={`flex-1 min-w-0 min-h-[30px] px-2 py-1 text-xs border rounded-lg ${
                        isDark
                          ? 'bg-slate-950 border-slate-700 text-white'
                          : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    />
                    <select
                      value={newRosterGenderA}
                      onChange={(e) => setNewRosterGenderA(e.target.value as 'male' | 'female')}
                      className={`min-h-[30px] px-1.5 py-1 text-xs border rounded-lg ${
                        isDark
                          ? 'bg-slate-950 border-slate-700 text-white'
                          : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="male">Nam</option>
                      <option value="female">Nữ</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => handleQuickAddRoster('A')}
                      className="min-h-[30px] px-2 py-1 rounded-lg bg-slate-800 hover:bg-orange-600 text-white text-xs font-bold shrink-0"
                    >
                      + VĐV
                    </button>
                  </div>
                )}
              </div>

              {/* ĐỘI B */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-sky-500 truncate">
                  Đội B: {activeMatch.teamBName}
                </div>

                <div>
                  <label className="block text-[11px] font-semibold mb-1">
                    VĐV B1 ({currentSubEventConfig.sideBRole1 === 'female' ? 'Nữ' : currentSubEventConfig.sideBRole1 === 'male' ? 'Nam' : 'Tự do'})
                  </label>
                  <select
                    value={draftB1}
                    onChange={(e) => setDraftB1(e.target.value)}
                    className={`w-full min-h-[34px] px-2.5 py-1 text-xs border rounded-xl ${
                      isDark
                        ? 'bg-slate-950 border-slate-700 text-white'
                        : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="">-- Chọn VĐV B1 --</option>
                    {optionsB1.map((c) => {
                      const used = matchCountByPlayer.get(c.id) || 0;
                      return (
                        <option key={`b1_${c.id}`} value={c.name}>
                          {cleanAthleteName(c.name)} ({used}/{MAX_MATCHES_PER_PLAYER} trận)
                        </option>
                      );
                    })}
                  </select>
                </div>

                {currentSubEventConfig.sideBRole2 !== 'none' && (
                  <div>
                    <label className="block text-[11px] font-semibold mb-1">
                      VĐV B2 ({currentSubEventConfig.sideBRole2 === 'female' ? 'Nữ' : currentSubEventConfig.sideBRole2 === 'male' ? 'Nam' : 'Tự do'})
                    </label>
                    <select
                      value={draftB2}
                      onChange={(e) => setDraftB2(e.target.value)}
                      className={`w-full min-h-[34px] px-2.5 py-1 text-xs border rounded-xl ${
                        isDark
                          ? 'bg-slate-950 border-slate-700 text-white'
                          : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="">-- Chọn VĐV B2 --</option>
                      {optionsB2.map((c) => {
                        const used = matchCountByPlayer.get(c.id) || 0;
                        return (
                          <option key={`b2_${c.id}`} value={c.name}>
                            {cleanAthleteName(c.name)} ({used}/{MAX_MATCHES_PER_PLAYER} trận)
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}

                {isAdmin && onAddRosterAthlete && (
                  <div className="flex items-center gap-1 pt-1">
                    <input
                      type="text"
                      value={newRosterNameB}
                      onChange={(e) => setNewRosterNameB(e.target.value)}
                      placeholder="Thêm VĐV Đội B..."
                      className={`flex-1 min-w-0 min-h-[30px] px-2 py-1 text-xs border rounded-lg ${
                        isDark
                          ? 'bg-slate-950 border-slate-700 text-white'
                          : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    />
                    <select
                      value={newRosterGenderB}
                      onChange={(e) => setNewRosterGenderB(e.target.value as 'male' | 'female')}
                      className={`min-h-[30px] px-1.5 py-1 text-xs border rounded-lg ${
                        isDark
                          ? 'bg-slate-950 border-slate-700 text-white'
                          : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="male">Nam</option>
                      <option value="female">Nữ</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => handleQuickAddRoster('B')}
                      className="min-h-[30px] px-2 py-1 rounded-lg bg-slate-800 hover:bg-orange-600 text-white text-xs font-bold shrink-0"
                    >
                      + VĐV
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowLineupModal(false)}
                className={`min-h-[32px] px-3 py-1 rounded-xl text-xs font-semibold ${
                  isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-700'
                }`}
              >
                Hủy
              </button>
              <button
                type="submit"
                className="min-h-[32px] px-4 py-1 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold"
              >
                Xác nhận VĐV ra sân
              </button>
            </div>
          </form>
        </div>
      )}

      {/* POPUP CHỌN NỘI DUNG (4 NỘI DUNG VÒNG BẢNG + ĐÁNH ĐƠN KHI HÒA) */}
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
                <h3 className="text-sm font-extrabold">
                  {hasGroupStageTie
                    ? 'Nội dung thi đấu (Đã mở Đánh đơn)'
                    : 'Vòng bảng · 4 nội dung'}
                </h3>
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
              {lineupSlots.map((slot) => {
                const isCurrent = slot.order === activeSlotOrder;
                const playersSummaryA = [slot.teamAPlayer1, slot.teamAPlayer2]
                  .filter(Boolean)
                  .map(shortenPlayerName)
                  .join(' / ');
                const playersSummaryB = [slot.teamBPlayer1, slot.teamBPlayer2]
                  .filter(Boolean)
                  .map(shortenPlayerName)
                  .join(' / ');

                return (
                  <button
                    key={slot.order}
                    type="button"
                    onClick={() => handleSelectTeamSlot(slot.order)}
                    className={`w-full min-h-[44px] px-3 py-2 rounded-xl border text-left flex items-center justify-between gap-2 text-xs font-bold transition-colors ${
                      isCurrent
                        ? 'bg-orange-600 text-white border-orange-600'
                        : isDark
                        ? 'bg-slate-950/60 hover:bg-slate-800 text-slate-200 border-slate-800'
                        : 'bg-slate-50 hover:bg-orange-50 text-slate-800 border-slate-200'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="truncate">{slot.label}</div>
                      <div
                        className={`text-[10px] font-normal truncate ${
                          isCurrent ? 'text-orange-100' : mutedText
                        }`}
                      >
                        {playersSummaryA || 'Chưa chọn'} vs {playersSummaryB || 'Chưa chọn'}
                      </div>
                    </div>
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
