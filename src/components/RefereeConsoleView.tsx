import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  BellRing,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Dices,
  FlagOff,
  ListFilter,
  Minus,
  PauseCircle,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Timer,
  Trophy,
  UserCheck,
  UserPlus,
  Users,
  Volume2,
  X,
} from 'lucide-react';
import {
  CHARTER_IMAGE_URL,
  CHARTER_REGULATION_SUMMARY,
  DOUBLES_EVENT_CATEGORIES,
  MATCH_STAGE_LABELS,
  MATCH_STATUS_LABELS,
  TEAM_EVENT_SUBCATEGORIES,
  type CompetitionType,
  type Match,
  type Registration,
  type StaffAccount,
  type TeamLineupSlot,
  type Tournament,
} from '../types/tournament';
import {
  applyDirectPoint,
  applyRallyOutcome,
  checkWinCondition,
  createDefaultTeamLineupSlots,
  decodeHistoryEntry,
  detectScheduleConflicts,
  encodeHistoryEntry,
  findNextAvailableCourtSlot,
  formatScoreCallout,
  isTeamDivision,
  validateAthleteMaxTwoMatches,
  type ScheduleConflict,
} from '../utils/pickleballEngine';
import { PickleballCourt3D, type CourtAthlete3D } from './PickleballCourt3D';

interface RefereeConsoleViewProps {
  tournament: Tournament;
  matches: Match[];
  registrations: Registration[];
  selectedMatchId: string | null;
  currentAccount: StaffAccount | null;
  onRequestLogin: (reason: string) => void;
  onSelectMatch: (matchId: string) => void;
  onUpdateMatch: (matchId: string, patch: Partial<Match>) => void;
  onCompleteMatch: (match: Match, winnerSide: '' | 'A' | 'B') => void;
  onAnnounceCourtCall: (match: Match) => void;
  onAnnounceCourtAvailable?: (match: Match) => void;
  onAddRosterAthlete?: (registrationId: string, athleteLabel: string) => void;
}

interface ActiveTimeoutState {
  team: 'A' | 'B';
  timeoutNumber: number;
  remainingSeconds: number;
  totalSeconds: number;
  isPaused: boolean;
}

interface SubstitutionRecord {
  id: string;
  timeLabel: string;
  team: 'A' | 'B';
  outPlayer: string;
  inPlayer: string;
  reason: string;
}

function stripRatingSuffix(label: string): string {
  return label.replace(/\s*\(.*?\)\s*$/, '').trim();
}

function extractDefaultPlayers(teamName: string, p1?: string, p2?: string): [string, string] {
  if (p1 && p2) return [p1, p2];
  const cleaned = teamName.replace(/^.*?\((.*?)\).*$/, '$1');
  if (cleaned.includes('/')) {
    const parts = cleaned.split('/').map((s) => s.trim());
    return [p1 || parts[0] || 'VĐV 1', p2 || parts[1] || 'VĐV 2'];
  }
  return [p1 || `${teamName} 1`, p2 || `${teamName} 2`];
}

export const RefereeConsoleView: React.FC<RefereeConsoleViewProps> = ({
  tournament,
  matches,
  registrations,
  selectedMatchId,
  currentAccount,
  onRequestLogin,
  onSelectMatch,
  onUpdateMatch,
  onCompleteMatch,
  onAnnounceCourtCall,
  onAnnounceCourtAvailable,
  onAddRosterAthlete,
}) => {
  const canOfficiate = currentAccount !== null;
  const isAdmin = currentAccount?.role === 'admin';

  const activeMatch =
    matches.find((m) => m.id === selectedMatchId) ||
    matches.find((m) => m.status === 'live') ||
    matches.find((m) => m.status === 'scheduled') ||
    matches[0];

  const [elapsedSec, setElapsedSec] = useState<number>(activeMatch?.durationSeconds || 0);
  const [showMobileMatchPicker, setShowMobileMatchPicker] = useState(false);
  const [showCoinTossModal, setShowCoinTossModal] = useState(false);
  const [showLineupModal, setShowLineupModal] = useState(false);
  const [showCharterModal, setShowCharterModal] = useState(false);
  const [showForfeitModal, setShowForfeitModal] = useState(false);
  const [showScheduleConflictModal, setShowScheduleConflictModal] = useState(false);
  const [editingScheduleMatchId, setEditingScheduleMatchId] = useState<string>('');
  const [draftCourtNumber, setDraftCourtNumber] = useState<number>(1);
  const [draftScheduledTime, setDraftScheduledTime] = useState<string>('08:00');

  // Time-out Popup countdown state
  const [activeTimeoutModal, setActiveTimeoutModal] = useState<ActiveTimeoutState | null>(null);

  // Player Substitution Popup state
  const [showSubPlayerModal, setShowSubPlayerModal] = useState(false);
  const [subTeam, setSubTeam] = useState<'A' | 'B'>('A');
  const [subOutSlot, setSubOutSlot] = useState<1 | 2>(1);
  const [subInPlayer, setSubInPlayer] = useState<string>('');
  const [subCustomName, setSubCustomName] = useState<string>('');
  const [subReason, setSubReason] = useState<string>('Chiến thuật');
  const [subHistory, setSubHistory] = useState<SubstitutionRecord[]>([]);

  // Automatic Mobile Orientation & Responsive Viewport Detection
  const [viewport, setViewport] = useState<{
    width: number;
    height: number;
    isMediaLandscape: boolean;
  }>(() => {
    if (typeof window === 'undefined') {
      return { width: 390, height: 844, isMediaLandscape: false };
    }
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      isMediaLandscape: window.matchMedia('(orientation: landscape)').matches,
    };
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(orientation: landscape)');
    const syncViewport = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
        isMediaLandscape: mediaQuery.matches,
      });
    };
    syncViewport();
    window.addEventListener('resize', syncViewport);
    window.addEventListener('orientationchange', syncViewport);
    mediaQuery.addEventListener?.('change', syncViewport);
    return () => {
      window.removeEventListener('resize', syncViewport);
      window.removeEventListener('orientationchange', syncViewport);
      mediaQuery.removeEventListener?.('change', syncViewport);
    };
  }, []);

  // Automatically detect phone portrait vs landscape (never manual toggle)
  const isDeviceLandscape =
    (viewport.isMediaLandscape || viewport.width > viewport.height) &&
    viewport.height <= 640;
  const effectiveOrientation: 'portrait' | 'landscape' = isDeviceLandscape
    ? 'landscape'
    : 'portrait';

  const isCompactPhone = viewport.height <= 710 || viewport.width <= 385;
  const isTinyPhone = viewport.height <= 640 || viewport.width <= 360;
  const isLandscapeCompact = effectiveOrientation === 'landscape' && viewport.height <= 560;

  // Coin toss & draw animation state: Quay đồng xu / bốc thăm -> Rung lắc nhẹ & Lấp lánh các ô VĐV
  const [isSpinningCoin, setIsSpinningCoin] = useState(false);
  const [showCoinDrawSparkle, setShowCoinDrawSparkle] = useState(false);
  const [isDrawSparkling, setIsDrawSparkling] = useState(false);
  const [coinRotationDeg, setCoinRotationDeg] = useState(0);
  const drawSparkleTimerRef = useRef<number | null>(null);
  const coinSpinTimerRef = useRef<number | null>(null);
  const courtAvailableTimerRef = useRef<number | null>(null);
  const [courtAvailableNotifiedId, setCourtAvailableNotifiedId] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (drawSparkleTimerRef.current !== null) {
        window.clearTimeout(drawSparkleTimerRef.current);
      }
      if (coinSpinTimerRef.current !== null) {
        window.clearTimeout(coinSpinTimerRef.current);
      }
      if (courtAvailableTimerRef.current !== null) {
        window.clearTimeout(courtAvailableTimerRef.current);
      }
    };
  }, []);
  const [tossWinnerSide, setTossWinnerSide] = useState<'A' | 'B'>('A');
  const [tossChoiceMode, setTossChoiceMode] = useState<'ball' | 'court'>('ball');
  const [winnerChosenCourtSide, setWinnerChosenCourtSide] = useState<'left' | 'right'>('left');
  const [firstServerSide, setFirstServerSide] = useState<'A' | 'B'>('A');
  const [courtSideForA, setCourtSideForA] = useState<'left' | 'right'>('left');

  // Competition mode & Lineup editor state
  const [modalCompType, setModalCompType] = useState<CompetitionType>('team');
  const [doublesCategory, setDoublesCategory] = useState<string>(DOUBLES_EVENT_CATEGORIES[0]);
  const [playerA1, setPlayerA1] = useState<string>('');
  const [playerA2, setPlayerA2] = useState<string>('');
  const [playerB1, setPlayerB1] = useState<string>('');
  const [playerB2, setPlayerB2] = useState<string>('');
  const [teamSlotsDraft, setTeamSlotsDraft] = useState<TeamLineupSlot[]>([]);
  const [selectedSlotOrder, setSelectedSlotOrder] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [newAthleteA, setNewAthleteA] = useState('');
  const [newAthleteB, setNewAthleteB] = useState('');

  const teamAReg = useMemo(
    () => registrations.find((r) => r.id === activeMatch?.teamAId),
    [registrations, activeMatch?.teamAId],
  );
  const teamBReg = useMemo(
    () => registrations.find((r) => r.id === activeMatch?.teamBId),
    [registrations, activeMatch?.teamBId],
  );

  // Real-time schedule conflict detection across all non-completed matches
  const allScheduleConflicts = useMemo<ScheduleConflict[]>(
    () => detectScheduleConflicts(matches),
    [matches],
  );

  const conflictMatchIds = useMemo(() => {
    const ids = new Set<string>();
    allScheduleConflicts.forEach((c) => {
      ids.add(c.matchA.id);
      ids.add(c.matchB.id);
    });
    return ids;
  }, [allScheduleConflicts]);

  const activeMatchConflicts = useMemo(() => {
    if (!activeMatch) return [];
    return allScheduleConflicts.filter(
      (c) => c.matchA.id === activeMatch.id || c.matchB.id === activeMatch.id,
    );
  }, [allScheduleConflicts, activeMatch]);

  const editingScheduleMatch = useMemo(
    () => matches.find((m) => m.id === editingScheduleMatchId) || activeMatch,
    [matches, editingScheduleMatchId, activeMatch],
  );

  const draftScheduleConflicts = useMemo(() => {
    if (!editingScheduleMatch) return [];
    const simulated = matches.map((m) =>
      m.id === editingScheduleMatch.id
        ? { ...m, courtNumber: draftCourtNumber, scheduledTime: draftScheduledTime }
        : m,
    );
    return detectScheduleConflicts(simulated).filter(
      (c) =>
        c.matchA.id === editingScheduleMatch.id ||
        c.matchB.id === editingScheduleMatch.id,
    );
  }, [matches, editingScheduleMatch, draftCourtNumber, draftScheduledTime]);

  const rosterOptionsA = useMemo(() => {
    const base = (teamAReg?.squadRoster || []).map(stripRatingSuffix);
    const fallback = [
      teamAReg?.player1Name,
      teamAReg?.player2Name,
      activeMatch?.teamAPlayer1,
      activeMatch?.teamAPlayer2,
    ]
      .filter(Boolean)
      .map((s) => stripRatingSuffix(s as string));
    return Array.from(new Set([...base, ...fallback]));
  }, [teamAReg, activeMatch]);

  const rosterOptionsB = useMemo(() => {
    const base = (teamBReg?.squadRoster || []).map(stripRatingSuffix);
    const fallback = [
      teamBReg?.player1Name,
      teamBReg?.player2Name,
      activeMatch?.teamBPlayer1,
      activeMatch?.teamBPlayer2,
    ]
      .filter(Boolean)
      .map((s) => stripRatingSuffix(s as string));
    return Array.from(new Set([...base, ...fallback]));
  }, [teamBReg, activeMatch]);

  useEffect(() => {
    if (!activeMatch) return;
    const [defA1, defA2] = extractDefaultPlayers(
      activeMatch.teamAName,
      activeMatch.teamAPlayer1,
      activeMatch.teamAPlayer2,
    );
    const [defB1, defB2] = extractDefaultPlayers(
      activeMatch.teamBName,
      activeMatch.teamBPlayer1,
      activeMatch.teamBPlayer2,
    );
    setPlayerA1(defA1);
    setPlayerA2(defA2);
    setPlayerB1(defB1);
    setPlayerB2(defB2);

    const isTeam = isTeamDivision(activeMatch.division, activeMatch.competitionType);
    setModalCompType(isTeam ? 'team' : 'doubles');
    setDoublesCategory(
      DOUBLES_EVENT_CATEGORIES.includes(activeMatch.teamSubCategory || '')
        ? (activeMatch.teamSubCategory as string)
        : DOUBLES_EVENT_CATEGORIES[0],
    );

    const existingSlots =
      activeMatch.teamLineupSlots && activeMatch.teamLineupSlots.length >= 4
        ? activeMatch.teamLineupSlots
        : createDefaultTeamLineupSlots(rosterOptionsA, rosterOptionsB);
    setTeamSlotsDraft(existingSlots);
    setSelectedSlotOrder(activeMatch.activeSlotOrder || 1);

    setCourtSideForA(activeMatch.courtSideA || 'left');
    setFirstServerSide(activeMatch.servingTeam || 'A');
    setTossWinnerSide(activeMatch.tossWinner === 'B' ? 'B' : 'A');
  }, [activeMatch, rosterOptionsA, rosterOptionsB]);

  useEffect(() => {
    if (!activeMatch) return;
    if (activeMatch.status === 'live' && activeMatch.startedAtMs > 0) {
      const updateTimer = () => {
        const diff = Math.max(
          activeMatch.durationSeconds,
          Math.floor((Date.now() - activeMatch.startedAtMs) / 1000),
        );
        setElapsedSec(diff);
      };
      updateTimer();
      const timer = window.setInterval(updateTimer, 1000);
      return () => window.clearInterval(timer);
    } else {
      setElapsedSec(activeMatch.durationSeconds || 0);
    }
  }, [activeMatch]);

  // Countdown timer for Time-out Notification Popup (60 seconds standard timeout)
  useEffect(() => {
    if (!activeTimeoutModal || activeTimeoutModal.isPaused || activeTimeoutModal.remainingSeconds <= 0) {
      return;
    }
    const timer = window.setInterval(() => {
      setActiveTimeoutModal((prev) => {
        if (!prev || prev.isPaused || prev.remainingSeconds <= 0) return prev;
        return {
          ...prev,
          remainingSeconds: Math.max(0, prev.remainingSeconds - 1),
        };
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeTimeoutModal]);

  if (!activeMatch) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 text-center">
        <p className="text-sm text-slate-600">
          Chưa có trận đấu nào trong giải này. Vui lòng vào mục Lịch & Nhánh đấu để sinh lịch tự động.
        </p>
      </div>
    );
  }

  const requireRefereeLogin = (actionName: string): boolean => {
    if (!canOfficiate) {
      onRequestLogin(
        `Vui lòng đăng nhập ở góc phải màn hình (Trọng tài: tt1 / 1986 hoặc BTC: admin / 1986) để thực hiện: ${actionName}.`,
      );
      return false;
    }
    return true;
  };

  const isActiveTeamCompetition = isTeamDivision(
    activeMatch.division,
    activeMatch.competitionType,
  );
  const currentTeamSlots =
    activeMatch.teamLineupSlots && activeMatch.teamLineupSlots.length >= 4
      ? activeMatch.teamLineupSlots
      : teamSlotsDraft;
  const activeSlotOrder = activeMatch.activeSlotOrder || 1;
  const isSinglesDeciderSlot = isActiveTeamCompetition && activeSlotOrder === 5;

  const [dispA1, dispA2] = extractDefaultPlayers(
    activeMatch.teamAName,
    activeMatch.teamAPlayer1,
    activeMatch.teamAPlayer2,
  );
  const [dispB1, dispB2] = extractDefaultPlayers(
    activeMatch.teamBName,
    activeMatch.teamBPlayer1,
    activeMatch.teamBPlayer2,
  );

  // Even score -> player 1 is in Right/Even court, player 2 in Left/Odd court
  const isScoreAEven = activeMatch.scoreA % 2 === 0;
  const teamAEvenCourtPlayer = isScoreAEven ? dispA1 : dispA2;
  const teamAOddCourtPlayer = isScoreAEven ? dispA2 : dispA1;

  const isScoreBEven = activeMatch.scoreB % 2 === 0;
  const teamBEvenCourtPlayer = isScoreBEven ? dispB1 : dispB2;
  const teamBOddCourtPlayer = isScoreBEven ? dispB2 : dispB1;

  const isAOnLeft = (activeMatch.courtSideA || 'left') === 'left';
  const leftSideTeam: 'A' | 'B' = isAOnLeft ? 'A' : 'B';
  const rightSideTeam: 'A' | 'B' = isAOnLeft ? 'B' : 'A';

  // In Singles Decider (21 points, every pair plays 4 points), show active pair rotation hint
  const totalRallyPoints = activeMatch.scoreA + activeMatch.scoreB;
  const singlesRotationPairIndex = Math.floor(totalRallyPoints / 4) % 2; // 0: Nam gặp Nam, 1: Nữ gặp Nữ

  const maxCap =
    activeMatch.maxPointsCap ||
    (isSinglesDeciderSlot
      ? 21
      : activeMatch.stage !== 'group' && activeMatch.pointsToWin === 15
      ? 18
      : undefined);

  const eligibleWinner = checkWinCondition(
    activeMatch.scoreA,
    activeMatch.scoreB,
    activeMatch.pointsToWin,
    activeMatch.stage !== 'group' && !isSinglesDeciderSlot ? true : activeMatch.winByTwo,
    maxCap,
  );

  // Lock (+) buttons once a team has enough points to finish the match
  const isWinningScoreReached = Boolean(eligibleWinner) || activeMatch.status === 'completed';

  // Charter rule: 15 points -> 8 points switch side; 21 points -> 11 points switch side
  const switchThreshold = Math.ceil(activeMatch.pointsToWin / 2);
  const isAtSwitchPoint =
    activeMatch.scoreA === switchThreshold || activeMatch.scoreB === switchThreshold;

  const lineupValidation = useMemo(
    () => validateAthleteMaxTwoMatches(teamSlotsDraft),
    [teamSlotsDraft],
  );

  const teamGamesA =
    activeMatch.teamGamesWonA ??
    currentTeamSlots.filter((s) => s.completed && s.winnerSide === 'A').length;
  const teamGamesB =
    activeMatch.teamGamesWonB ??
    currentTeamSlots.filter((s) => s.completed && s.winnerSide === 'B').length;

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Switch active sub-match in Team Competition (Trận 1: Đôi Nữ -> Trận 2: Đôi Nam -> Trận 3: Đôi Nam Nữ 1 -> Trận 4: Đôi Nam Nữ 2 -> Trận 5: Đơn 21đ)
  const handleSelectTeamSubMatch = (order: 1 | 2 | 3 | 4 | 5) => {
    if (!requireRefereeLogin('Chuyển lượt trận Đồng đội')) return;
    const slots = currentTeamSlots.map((s) =>
      s.order === activeSlotOrder
        ? {
            ...s,
            scoreA: activeMatch.scoreA,
            scoreB: activeMatch.scoreB,
          }
        : s,
    );
    const targetSlot = slots.find((s) => s.order === order) || slots[0];
    const isOrder5 = order === 5;

    onUpdateMatch(activeMatch.id, {
      competitionType: 'team',
      activeSlotOrder: order,
      teamSubCategory: targetSlot.label,
      teamLineupSlots: slots,
      teamAPlayer1: targetSlot.teamAPlayer1,
      teamAPlayer2: targetSlot.teamAPlayer2,
      teamBPlayer1: targetSlot.teamBPlayer1,
      teamBPlayer2: targetSlot.teamBPlayer2,
      scoreA: targetSlot.scoreA || 0,
      scoreB: targetSlot.scoreB || 0,
      pointsToWin: isOrder5 ? 21 : 15,
      maxPointsCap: isOrder5 ? 21 : activeMatch.stage !== 'group' ? 18 : 15,
      scoringMode: isOrder5 ? 'rally' : activeMatch.scoringMode,
      sideSwitched: false,
    });
  };

  // Record finished sub-match in Team Event and advance to next sub-match
  const handleSaveTeamSubMatchResult = () => {
    if (!requireRefereeLogin('Lưu kết quả trận con Đồng đội')) return;
    const subWinner: '' | 'A' | 'B' =
      activeMatch.scoreA > activeMatch.scoreB
        ? 'A'
        : activeMatch.scoreB > activeMatch.scoreA
        ? 'B'
        : '';
    if (!subWinner) return;

    const updatedSlots = currentTeamSlots.map((s) =>
      s.order === activeSlotOrder
        ? {
            ...s,
            scoreA: activeMatch.scoreA,
            scoreB: activeMatch.scoreB,
            completed: true,
            winnerSide: subWinner,
          }
        : s,
    );

    const doublesDone = updatedSlots.filter((s) => s.order <= 4 && s.completed);
    const gamesA = updatedSlots.filter((s) => s.completed && s.winnerSide === 'A').length;
    const gamesB = updatedSlots.filter((s) => s.completed && s.winnerSide === 'B').length;

    // Determine next sub-match order (1..4, or 5 if knockout tied 2-2)
    let nextOrder: 1 | 2 | 3 | 4 | 5 = activeSlotOrder;
    if (activeSlotOrder < 4) {
      nextOrder = (activeSlotOrder + 1) as 1 | 2 | 3 | 4;
    } else if (
      activeSlotOrder === 4 &&
      activeMatch.stage !== 'group' &&
      gamesA === 2 &&
      gamesB === 2
    ) {
      nextOrder = 5;
    }

    const nextSlot = updatedSlots.find((s) => s.order === nextOrder) || updatedSlots[0];
    const shouldMoveToNext = nextOrder !== activeSlotOrder;

    onUpdateMatch(activeMatch.id, {
      competitionType: 'team',
      teamLineupSlots: updatedSlots,
      teamGamesWonA: gamesA,
      teamGamesWonB: gamesB,
      ...(shouldMoveToNext
        ? {
            activeSlotOrder: nextOrder,
            teamSubCategory: nextSlot.label,
            teamAPlayer1: nextSlot.teamAPlayer1,
            teamAPlayer2: nextSlot.teamAPlayer2,
            teamBPlayer1: nextSlot.teamBPlayer1,
            teamBPlayer2: nextSlot.teamBPlayer2,
            scoreA: nextSlot.scoreA || 0,
            scoreB: nextSlot.scoreB || 0,
            pointsToWin: nextOrder === 5 ? 21 : 15,
            maxPointsCap: nextOrder === 5 ? 21 : activeMatch.stage !== 'group' ? 18 : 15,
            scoringMode: nextOrder === 5 ? 'rally' : activeMatch.scoringMode,
            sideSwitched: false,
          }
        : {}),
    });

    // If all 4 doubles matches are done in Group Stage (or decider done in Knockout), can finalize
    if (
      (activeMatch.stage === 'group' && doublesDone.length === 4) ||
      (activeMatch.stage !== 'group' &&
        ((doublesDone.length === 4 && gamesA !== gamesB) ||
          (activeSlotOrder === 5 && gamesA !== gamesB)))
    ) {
      const matchWinner: '' | 'A' | 'B' =
        gamesA > gamesB ? 'A' : gamesB > gamesA ? 'B' : '';
      onCompleteMatch(
        {
          ...activeMatch,
          competitionType: 'team',
          teamLineupSlots: updatedSlots,
          teamGamesWonA: gamesA,
          teamGamesWonB: gamesB,
          scoreA: gamesA,
          scoreB: gamesB,
          durationSeconds: elapsedSec || 1200,
          refereeName: currentAccount?.displayName || activeMatch.refereeName,
        },
        matchWinner,
      );
    }
  };

  // Handle Forfeit (Bỏ cuộc: Đôi tính 15-0, Đồng đội tính 4-0 tương ứng 4x15-0, đội bỏ cuộc 0 điểm)
  const handleForfeitMatch = (forfeitingSide: 'A' | 'B') => {
    if (!requireRefereeLogin('Xử thua bỏ cuộc theo Điều lệ')) return;
    const winnerSide: 'A' | 'B' = forfeitingSide === 'A' ? 'B' : 'A';
    const isTeam = isActiveTeamCompetition;
    const forfeitSlots = isTeam
      ? currentTeamSlots.map((s) =>
          s.order <= 4
            ? {
                ...s,
                scoreA: winnerSide === 'A' ? 15 : 0,
                scoreB: winnerSide === 'B' ? 15 : 0,
                completed: true,
                winnerSide,
              }
            : s,
        )
      : undefined;

    const updatedMatch: Match = {
      ...activeMatch,
      status: 'completed',
      forfeitSide: forfeitingSide,
      winnerSide,
      winnerTeamId: winnerSide === 'A' ? activeMatch.teamAId : activeMatch.teamBId,
      scoreA: isTeam ? (winnerSide === 'A' ? 4 : 0) : winnerSide === 'A' ? 15 : 0,
      scoreB: isTeam ? (winnerSide === 'B' ? 4 : 0) : winnerSide === 'B' ? 15 : 0,
      teamGamesWonA: isTeam ? (winnerSide === 'A' ? 4 : 0) : undefined,
      teamGamesWonB: isTeam ? (winnerSide === 'B' ? 4 : 0) : undefined,
      teamLineupSlots: forfeitSlots,
      durationSeconds: elapsedSec || 60,
      refereeName: currentAccount?.displayName || activeMatch.refereeName,
    };

    onUpdateMatch(activeMatch.id, updatedMatch);
    onCompleteMatch(updatedMatch, winnerSide);
  };

  const handleStartMatch = () => {
    if (!requireRefereeLogin('Bắt đầu trận đấu')) return;
    onUpdateMatch(activeMatch.id, {
      status: 'live',
      startedAtMs: activeMatch.startedAtMs > 0 ? activeMatch.startedAtMs : Date.now(),
      servingTeam: activeMatch.servingTeam || 'A',
      serverNumber: 2,
      refereeName: currentAccount?.displayName || activeMatch.refereeName,
    });
    onAnnounceCourtCall(activeMatch);
  };

  const handleRallyWin = (winner: 'A' | 'B') => {
    if (!requireRefereeLogin('Chấm điểm trực tiếp')) return;
    // Block (+) when match is completed or enough winning points have been reached
    if (isWinningScoreReached) return;
    const next = applyRallyOutcome(activeMatch, winner);
    const updatedHistory = [next.historyEntry, ...(activeMatch.scoreHistory || [])].slice(0, 60);
    const shouldAutoFlipCourt = !activeMatch.sideSwitched && next.sideSwitched;
    const currentSideA = activeMatch.courtSideA || 'left';

    const updatedSlots = isActiveTeamCompetition
      ? currentTeamSlots.map((s) =>
          s.order === activeSlotOrder
            ? { ...s, scoreA: next.scoreA, scoreB: next.scoreB }
            : s,
        )
      : activeMatch.teamLineupSlots;

    onUpdateMatch(activeMatch.id, {
      status: 'live',
      startedAtMs: activeMatch.startedAtMs > 0 ? activeMatch.startedAtMs : Date.now(),
      scoreA: next.scoreA,
      scoreB: next.scoreB,
      servingTeam: next.servingTeam,
      serverNumber: next.serverNumber,
      sideSwitched: next.sideSwitched,
      courtSideA: shouldAutoFlipCourt
        ? currentSideA === 'left'
          ? 'right'
          : 'left'
        : currentSideA,
      durationSeconds: elapsedSec,
      scoreHistory: updatedHistory,
      teamLineupSlots: updatedSlots,
      refereeName: currentAccount?.displayName || activeMatch.refereeName,
    });
  };

  const handleDirectPoint = (team: 'A' | 'B') => {
    if (!requireRefereeLogin('Cộng điểm trực tiếp')) return;
    // Block (+) when match is completed or enough winning points have been reached
    if (isWinningScoreReached) return;
    const next = applyDirectPoint(activeMatch, team);
    const updatedHistory = [next.historyEntry, ...(activeMatch.scoreHistory || [])].slice(0, 60);

    const updatedSlots = isActiveTeamCompetition
      ? currentTeamSlots.map((s) =>
          s.order === activeSlotOrder
            ? { ...s, scoreA: next.scoreA, scoreB: next.scoreB }
            : s,
        )
      : activeMatch.teamLineupSlots;

    onUpdateMatch(activeMatch.id, {
      status: 'live',
      startedAtMs: activeMatch.startedAtMs > 0 ? activeMatch.startedAtMs : Date.now(),
      scoreA: next.scoreA,
      scoreB: next.scoreB,
      servingTeam: next.servingTeam,
      serverNumber: next.serverNumber,
      sideSwitched: next.sideSwitched,
      durationSeconds: elapsedSec,
      scoreHistory: updatedHistory,
      teamLineupSlots: updatedSlots,
      refereeName: currentAccount?.displayName || activeMatch.refereeName,
    });
  };

  // Minus (-) button handler: subtract 1 point from a team (or roll back latest point if accidentally pressed +)
  const handleDecrementPoint = (team: 'A' | 'B') => {
    if (!requireRefereeLogin(`Trừ 1 điểm Đội ${team} (Sửa bấm nhầm)`)) return;
    const currentTeamScore = team === 'A' ? activeMatch.scoreA : activeMatch.scoreB;
    if (currentTeamScore <= 0) return;

    // Check if the most recent history entry was a point increment for this team; if so, restore exact snapshot
    if (activeMatch.scoreHistory && activeMatch.scoreHistory.length > 0) {
      const [latest, ...rest] = activeMatch.scoreHistory;
      const decoded = decodeHistoryEntry(latest);
      if (
        decoded &&
        ((team === 'A' &&
          decoded.prev.scoreA === activeMatch.scoreA - 1 &&
          decoded.prev.scoreB === activeMatch.scoreB) ||
          (team === 'B' &&
            decoded.prev.scoreB === activeMatch.scoreB - 1 &&
            decoded.prev.scoreA === activeMatch.scoreA))
      ) {
        const updatedSlots = isActiveTeamCompetition
          ? currentTeamSlots.map((s) =>
              s.order === activeSlotOrder
                ? { ...s, scoreA: decoded.prev.scoreA, scoreB: decoded.prev.scoreB }
                : s,
            )
          : activeMatch.teamLineupSlots;

        onUpdateMatch(activeMatch.id, {
          status: 'live',
          winnerSide: '',
          winnerTeamId: '',
          forfeitSide: '',
          scoreA: decoded.prev.scoreA,
          scoreB: decoded.prev.scoreB,
          servingTeam: decoded.prev.servingTeam,
          serverNumber: decoded.prev.serverNumber,
          timeoutsA: decoded.prev.timeoutsA,
          timeoutsB: decoded.prev.timeoutsB,
          sideSwitched: decoded.prev.sideSwitched,
          scoreHistory: rest,
          teamLineupSlots: updatedSlots,
        });
        return;
      }
    }

    // Otherwise directly decrement 1 point from that team and record snapshot
    const prevSnapshot = {
      scoreA: activeMatch.scoreA,
      scoreB: activeMatch.scoreB,
      servingTeam: activeMatch.servingTeam,
      serverNumber: activeMatch.serverNumber,
      timeoutsA: activeMatch.timeoutsA,
      timeoutsB: activeMatch.timeoutsB,
      sideSwitched: activeMatch.sideSwitched,
    };
    const nextScoreA = team === 'A' ? Math.max(0, activeMatch.scoreA - 1) : activeMatch.scoreA;
    const nextScoreB = team === 'B' ? Math.max(0, activeMatch.scoreB - 1) : activeMatch.scoreB;
    const historyEntry = encodeHistoryEntry(
      `${team}-1 (${nextScoreA}-${nextScoreB})`,
      prevSnapshot,
    );
    const updatedHistory = [historyEntry, ...(activeMatch.scoreHistory || [])].slice(0, 60);

    const updatedSlots = isActiveTeamCompetition
      ? currentTeamSlots.map((s) =>
          s.order === activeSlotOrder
            ? { ...s, scoreA: nextScoreA, scoreB: nextScoreB }
            : s,
        )
      : activeMatch.teamLineupSlots;

    onUpdateMatch(activeMatch.id, {
      status: 'live',
      winnerSide: '',
      winnerTeamId: '',
      forfeitSide: '',
      scoreA: nextScoreA,
      scoreB: nextScoreB,
      scoreHistory: updatedHistory,
      teamLineupSlots: updatedSlots,
      refereeName: currentAccount?.displayName || activeMatch.refereeName,
    });
  };

  const handleUndo = () => {
    if (!requireRefereeLogin('Hoàn tác điểm')) return;
    if (!activeMatch.scoreHistory || activeMatch.scoreHistory.length === 0) return;
    const [latest, ...rest] = activeMatch.scoreHistory;
    const decoded = decodeHistoryEntry(latest);
    if (!decoded) return;

    const updatedSlots = isActiveTeamCompetition
      ? currentTeamSlots.map((s) =>
          s.order === activeSlotOrder
            ? { ...s, scoreA: decoded.prev.scoreA, scoreB: decoded.prev.scoreB }
            : s,
        )
      : activeMatch.teamLineupSlots;

    onUpdateMatch(activeMatch.id, {
      status: 'live',
      winnerSide: '',
      winnerTeamId: '',
      forfeitSide: '',
      scoreA: decoded.prev.scoreA,
      scoreB: decoded.prev.scoreB,
      servingTeam: decoded.prev.servingTeam,
      serverNumber: decoded.prev.serverNumber,
      timeoutsA: decoded.prev.timeoutsA,
      timeoutsB: decoded.prev.timeoutsB,
      sideSwitched: decoded.prev.sideSwitched,
      scoreHistory: rest,
      teamLineupSlots: updatedSlots,
    });
  };

  // Time-out handler: increments team timeout count AND opens the Time-out Countdown Popup
  const handleTimeout = (team: 'A' | 'B') => {
    if (!requireRefereeLogin('Gọi hội ý (Time-out)')) return;
    if (activeMatch.status === 'completed') return;

    const currentCount = team === 'A' ? activeMatch.timeoutsA : activeMatch.timeoutsB;
    if (currentCount >= 2) {
      // Still allow opening the popup to view or start a referee/medical timeout if already at 2/2
      setActiveTimeoutModal({
        team,
        timeoutNumber: 2,
        remainingSeconds: 60,
        totalSeconds: 60,
        isPaused: false,
      });
      return;
    }

    const nextCount = currentCount + 1;
    if (team === 'A') {
      onUpdateMatch(activeMatch.id, { timeoutsA: nextCount });
    } else {
      onUpdateMatch(activeMatch.id, { timeoutsB: nextCount });
    }

    setActiveTimeoutModal({
      team,
      timeoutNumber: nextCount,
      remainingSeconds: 60,
      totalSeconds: 60,
      isPaused: false,
    });
  };

  // Cancel current timeout and refund the timeout count
  const handleCancelAndRefundTimeout = () => {
    if (!activeTimeoutModal) return;
    const { team } = activeTimeoutModal;
    if (team === 'A' && activeMatch.timeoutsA > 0) {
      onUpdateMatch(activeMatch.id, { timeoutsA: Math.max(0, activeMatch.timeoutsA - 1) });
    } else if (team === 'B' && activeMatch.timeoutsB > 0) {
      onUpdateMatch(activeMatch.id, { timeoutsB: Math.max(0, activeMatch.timeoutsB - 1) });
    }
    setActiveTimeoutModal(null);
  };

  // Open Substitute Athlete Modal pre-configured for a specific team and player slot
  const handleOpenSubstituteModal = (team: 'A' | 'B' = 'A', slot: 1 | 2 = 1) => {
    if (!requireRefereeLogin('Thay VĐV trên sân')) return;
    setSubTeam(team);
    setSubOutSlot(slot);
    setSubCustomName('');
    setSubReason('Chiến thuật');

    const roster = team === 'A' ? rosterOptionsA : rosterOptionsB;
    const currentP1 = team === 'A' ? dispA1 : dispB1;
    const currentP2 = team === 'A' ? dispA2 : dispB2;
    const benchCandidates = roster.filter((name) => name !== currentP1 && name !== currentP2);
    setSubInPlayer(benchCandidates[0] || roster[0] || '');
    setShowSubPlayerModal(true);
  };

  // Confirm Athlete Substitution
  const handleConfirmSubstitution = (e: React.FormEvent) => {
    e.preventDefault();
    const chosenReplacement = stripRatingSuffix(subCustomName.trim() || subInPlayer.trim());
    if (!chosenReplacement) return;

    const outPlayerName =
      subTeam === 'A'
        ? subOutSlot === 1
          ? dispA1
          : dispA2
        : subOutSlot === 1
        ? dispB1
        : dispB2;

    if (subCustomName.trim() && isAdmin) {
      const targetReg = subTeam === 'A' ? teamAReg : teamBReg;
      if (targetReg && onAddRosterAthlete) {
        onAddRosterAthlete(targetReg.id, chosenReplacement);
      }
    }

    const nextA1 = subTeam === 'A' && subOutSlot === 1 ? chosenReplacement : dispA1;
    const nextA2 = subTeam === 'A' && subOutSlot === 2 ? chosenReplacement : dispA2;
    const nextB1 = subTeam === 'B' && subOutSlot === 1 ? chosenReplacement : dispB1;
    const nextB2 = subTeam === 'B' && subOutSlot === 2 ? chosenReplacement : dispB2;

    const updatedSlots = isActiveTeamCompetition
      ? currentTeamSlots.map((s) =>
          s.order === activeSlotOrder
            ? {
                ...s,
                teamAPlayer1: nextA1,
                teamAPlayer2: nextA2,
                teamBPlayer1: nextB1,
                teamBPlayer2: nextB2,
              }
            : s,
        )
      : activeMatch.teamLineupSlots;

    onUpdateMatch(activeMatch.id, {
      teamAPlayer1: nextA1,
      teamAPlayer2: nextA2,
      teamBPlayer1: nextB1,
      teamBPlayer2: nextB2,
      teamLineupSlots: updatedSlots,
      refereeName: currentAccount?.displayName || activeMatch.refereeName,
    });

    setSubHistory((prev) => [
      {
        id: `sub_${Date.now()}`,
        timeLabel: formatTimer(elapsedSec),
        team: subTeam,
        outPlayer: outPlayerName,
        inPlayer: chosenReplacement,
        reason: subReason,
      },
      ...prev,
    ]);

    setShowSubPlayerModal(false);
  };

  const handleToggleServer = () => {
    if (!requireRefereeLogin('Đổi giao bóng')) return;
    if (activeMatch.status === 'completed') return;
    if (activeMatch.serverNumber === 1) {
      onUpdateMatch(activeMatch.id, { serverNumber: 2 });
    } else {
      onUpdateMatch(activeMatch.id, {
        servingTeam: activeMatch.servingTeam === 'A' ? 'B' : 'A',
        serverNumber: 1,
      });
    }
  };

  const handleSwapCourtSides = () => {
    if (!requireRefereeLogin('Đổi bên sân Trái / Phải')) return;
    const nextSide = (activeMatch.courtSideA || 'left') === 'left' ? 'right' : 'left';
    onUpdateMatch(activeMatch.id, {
      courtSideA: nextSide,
      sideSwitched: true,
    });
  };

  const handleSwapTeamPlayers = (team: 'A' | 'B') => {
    if (!requireRefereeLogin('Đổi vị trí đứng 2 VĐV')) return;
    if (team === 'A') {
      onUpdateMatch(activeMatch.id, {
        teamAPlayer1: dispA2,
        teamAPlayer2: dispA1,
      });
    } else {
      onUpdateMatch(activeMatch.id, {
        teamBPlayer1: dispB2,
        teamBPlayer2: dispB1,
      });
    }
  };

  // Synchronize Coin Toss Choice (Chọn Bóng -> chỉ có Giao bóng; Chọn Sân -> Chọn Sân Trái hoặc Sân Phải)
  const syncCoinTossSelection = (
    winner: 'A' | 'B',
    mode: 'ball' | 'court',
    chosenSide: 'left' | 'right',
  ) => {
    setTossWinnerSide(winner);
    setTossChoiceMode(mode);
    setWinnerChosenCourtSide(chosenSide);

    if (mode === 'ball') {
      // Chọn bóng sẽ chỉ có giao bóng (Đội thắng bốc thăm giao bóng trước 0-0-2)
      setFirstServerSide(winner);
      // Phần sân giữ theo lựa chọn sân trái/phải
      setCourtSideForA(winner === 'A' ? chosenSide : chosenSide === 'left' ? 'right' : 'left');
    } else {
      // Chọn sân Trái hoặc Phải cho đội thắng bốc thăm; đội còn lại giao bóng trước
      const sideForA: 'left' | 'right' =
        winner === 'A' ? chosenSide : chosenSide === 'left' ? 'right' : 'left';
      setCourtSideForA(sideForA);
      setFirstServerSide(winner === 'A' ? 'B' : 'A');
    }
  };

  const triggerDrawSparkle = () => {
    if (drawSparkleTimerRef.current !== null) {
      window.clearTimeout(drawSparkleTimerRef.current);
    }
    setIsDrawSparkling(true);
    drawSparkleTimerRef.current = window.setTimeout(() => {
      setIsDrawSparkling(false);
      drawSparkleTimerRef.current = null;
    }, 2400);
  };

  const handleRunRandomCoinToss = () => {
    if (coinSpinTimerRef.current !== null) {
      window.clearTimeout(coinSpinTimerRef.current);
    }
    setIsSpinningCoin(true);
    setShowCoinDrawSparkle(false);
    setCoinRotationDeg((prev) => prev + 1440);
    coinSpinTimerRef.current = window.setTimeout(() => {
      const randomWinner: 'A' | 'B' = Math.random() < 0.5 ? 'A' : 'B';
      syncCoinTossSelection(randomWinner, tossChoiceMode, winnerChosenCourtSide);
      setIsSpinningCoin(false);
      setShowCoinDrawSparkle(true);
      coinSpinTimerRef.current = null;
    }, 780);
  };

  const handleRandomDrawAthleteBoxes = () => {
    if (!requireRefereeLogin('Bốc thăm xếp ô VĐV & sân đấu ngẫu nhiên')) return;
    if (coinSpinTimerRef.current !== null) {
      window.clearTimeout(coinSpinTimerRef.current);
    }
    setIsSpinningCoin(true);
    setShowCoinDrawSparkle(false);
    setCoinRotationDeg((prev) => prev + 1440);
    coinSpinTimerRef.current = window.setTimeout(() => {
      const randomWinner: 'A' | 'B' = Math.random() < 0.5 ? 'A' : 'B';
      const randomCourtSide: 'left' | 'right' = Math.random() < 0.5 ? 'left' : 'right';
      const swapPairA = Math.random() < 0.5;
      const swapPairB = Math.random() < 0.5;

      if (swapPairA || swapPairB) {
        onUpdateMatch(activeMatch.id, {
          teamAPlayer1: swapPairA ? dispA2 : dispA1,
          teamAPlayer2: swapPairA ? dispA1 : dispA2,
          teamBPlayer1: swapPairB ? dispB2 : dispB1,
          teamBPlayer2: swapPairB ? dispB1 : dispB2,
        });
      }

      syncCoinTossSelection(randomWinner, tossChoiceMode, randomCourtSide);
      setIsSpinningCoin(false);
      setShowCoinDrawSparkle(true);
      triggerDrawSparkle();
      coinSpinTimerRef.current = null;
    }, 780);
  };

  const handleApplyCoinToss = () => {
    const winnerName = tossWinnerSide === 'A' ? activeMatch.teamAName : activeMatch.teamBName;
    const serverName = firstServerSide === 'A' ? activeMatch.teamAName : activeMatch.teamBName;
    const choiceLabel =
      tossChoiceMode === 'ball'
        ? 'Chọn Bóng (Giao bóng trước 0-0-2)'
        : `Chọn ${winnerChosenCourtSide === 'left' ? 'Sân Trái' : 'Sân Phải'}`;
    const sideLabel =
      courtSideForA === 'left'
        ? `${activeMatch.teamAName} Sân Trái · ${activeMatch.teamBName} Sân Phải`
        : `${activeMatch.teamBName} Sân Trái · ${activeMatch.teamAName} Sân Phải`;
    const note = `${winnerName} thắng đồng xu (${choiceLabel}) · ${serverName} giao bóng (0-0-2) · ${sideLabel}`;

    onUpdateMatch(activeMatch.id, {
      tossWinner: tossWinnerSide,
      tossNote: note,
      servingTeam: firstServerSide,
      serverNumber: 2,
      courtSideA: courtSideForA,
      refereeName: currentAccount?.displayName || activeMatch.refereeName,
    });
    setShowCoinTossModal(false);
    triggerDrawSparkle();
  };

  const handleSaveCompetitionLineup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      onRequestLogin(
        'Phải đăng nhập tài khoản Admin (admin / 1986) mới có thể thêm hoặc chọn nội dung Đồng đội / Đôi.',
      );
      return;
    }
    if (modalCompType === 'doubles') {
      const cleanA1 = stripRatingSuffix(playerA1) || dispA1;
      const cleanA2 = stripRatingSuffix(playerA2) || dispA2;
      const cleanB1 = stripRatingSuffix(playerB1) || dispB1;
      const cleanB2 = stripRatingSuffix(playerB2) || dispB2;

      onUpdateMatch(activeMatch.id, {
        competitionType: 'doubles',
        teamSubCategory: doublesCategory,
        teamAPlayer1: cleanA1,
        teamAPlayer2: cleanA2,
        teamBPlayer1: cleanB1,
        teamBPlayer2: cleanB2,
        pointsToWin: 15,
        maxPointsCap: activeMatch.stage !== 'group' ? 18 : 15,
        winByTwo: activeMatch.stage !== 'group',
        refereeName: currentAccount?.displayName || activeMatch.refereeName,
      });
    } else {
      const activeSlot =
        teamSlotsDraft.find((s) => s.order === selectedSlotOrder) || teamSlotsDraft[0];
      const isOrder5 = selectedSlotOrder === 5;
      onUpdateMatch(activeMatch.id, {
        competitionType: 'team',
        activeSlotOrder: selectedSlotOrder,
        teamSubCategory: activeSlot.label,
        teamLineupSlots: teamSlotsDraft,
        teamAPlayer1: activeSlot.teamAPlayer1,
        teamAPlayer2: activeSlot.teamAPlayer2,
        teamBPlayer1: activeSlot.teamBPlayer1,
        teamBPlayer2: activeSlot.teamBPlayer2,
        pointsToWin: isOrder5 ? 21 : 15,
        maxPointsCap: isOrder5 ? 21 : activeMatch.stage !== 'group' ? 18 : 15,
        scoringMode: isOrder5 ? 'rally' : activeMatch.scoringMode,
        winByTwo: activeMatch.stage !== 'group' && !isOrder5,
        refereeName: currentAccount?.displayName || activeMatch.refereeName,
      });
    }
    setShowLineupModal(false);
  };

  // Helper renderer for a clean, uncluttered Team Scoring Card
  const renderTeamScoringPad = (team: 'A' | 'B', compactLandscape = false) => {
    const isTeamA = team === 'A';
    const teamName = isTeamA ? activeMatch.teamAName : activeMatch.teamBName;
    const score = isTeamA ? activeMatch.scoreA : activeMatch.scoreB;
    const timeouts = isTeamA ? activeMatch.timeoutsA : activeMatch.timeoutsB;
    const p1 = isTeamA ? dispA1 : dispB1;
    const p2 = isTeamA ? dispA2 : dispB2;
    const isServing = activeMatch.servingTeam === team;
    const isOnLeftCourt = (isTeamA && isAOnLeft) || (!isTeamA && !isAOnLeft);
    const courtSideText = isOnLeftCourt ? 'TRÁI' : 'PHẢI';
    const isThisTeamWinner = eligibleWinner === team || activeMatch.winnerSide === team;

    const dense = isCompactPhone || compactLandscape || isLandscapeCompact;

    const primaryActionText = isWinningScoreReached
      ? 'Đủ điểm'
      : activeMatch.scoringMode === 'side_out' && !isServing
      ? 'Thắng pha'
      : '+1 Điểm';

    return (
      <div
        className={`relative overflow-hidden rounded-xl border transition-colors flex flex-col justify-between ${
          dense ? 'p-1.5 sm:p-2.5' : 'p-2 sm:p-3'
        } ${isSpinningCoin ? 'animate-draw-shake' : ''} ${
          isDrawSparkling ? 'animate-draw-sparkle-box border-yellow-400' : ''
        } ${
          isThisTeamWinner
            ? 'bg-emerald-950/80 border-emerald-500/80'
            : isServing
            ? 'bg-slate-800/90 border-orange-500/80'
            : 'bg-slate-800/45 border-slate-700/60'
        }`}
      >
        {isDrawSparkling && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
            <div className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-amber-300/25 to-transparent animate-draw-shimmer" />
            <Sparkles className="w-3.5 h-3.5 text-yellow-300 absolute top-1.5 right-1.5 animate-sparkle-star" />
          </div>
        )}
        <div>
          <div className="flex items-center justify-between gap-1 text-[9.5px] sm:text-xs">
            <span className="font-semibold uppercase tracking-wider text-slate-400 truncate">
              ĐỘI {team} · {courtSideText}
            </span>
            <span
              className={`font-mono-num shrink-0 px-1.5 py-0.5 rounded text-[8.5px] sm:text-[10px] font-bold whitespace-nowrap ${
                isThisTeamWinner
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : isServing
                  ? 'bg-orange-500/20 text-orange-300'
                  : 'text-slate-500'
              }`}
            >
              {isThisTeamWinner
                ? '★ THẮNG'
                : isServing
                ? `● GIAO #${activeMatch.serverNumber}`
                : 'ĐỠ BÓNG'}
            </span>
          </div>

          <div className={`${dense ? 'mt-0.5' : 'mt-1'} flex items-center justify-between gap-1.5`}>
            <div className="min-w-0 flex-1">
              <h3
                className={`font-display font-bold text-white truncate leading-tight ${
                  dense ? 'text-xs sm:text-base' : 'text-sm sm:text-lg'
                }`}
              >
                {teamName}
              </h3>
              <div
                className={`text-[9.5px] sm:text-xs truncate flex items-center gap-1 ${
                  isDrawSparkling ? 'text-amber-200 font-semibold' : 'text-slate-400'
                }`}
              >
                {isDrawSparkling && <Sparkles className="w-3 h-3 text-yellow-300 shrink-0 animate-sparkle-star" />}
                <span className="truncate">
                  {isSinglesDeciderSlot
                    ? singlesRotationPairIndex === 0
                      ? `Đơn Nam: ${p1}`
                      : `Đơn Nữ: ${p2}`
                    : `${p1} · ${p2}`}
                </span>
              </div>
            </div>

            <div
              className={`font-mono-num font-extrabold text-white shrink-0 leading-none ${
                dense ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-4xl'
              }`}
            >
              {score}
            </div>
          </div>
        </div>

        <div className={`${dense ? 'mt-1 space-y-1' : 'mt-1.5 space-y-1.5'}`}>
          {/* Primary (+) Rally / Point button + Minus (-) button side-by-side */}
          <div className="flex items-stretch gap-1">
            <button
              type="button"
              disabled={score <= 0}
              onClick={() => handleDecrementPoint(team)}
              title={`Trừ 1 điểm Đội ${team}`}
              className={`${
                dense ? 'min-h-[34px] sm:min-h-[40px] px-2' : 'min-h-[40px] sm:min-h-[46px] px-2.5 sm:px-3'
              } rounded-lg bg-slate-700/80 hover:bg-rose-700 active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed text-slate-200 hover:text-white font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-0.5 shrink-0`}
            >
              <Minus className="w-3 h-3 stroke-[2.5]" />
              <span>1</span>
            </button>

            <button
              type="button"
              disabled={isWinningScoreReached}
              onClick={() => handleRallyWin(team)}
              className={`flex-1 ${
                dense ? 'min-h-[34px] sm:min-h-[40px]' : 'min-h-[40px] sm:min-h-[46px]'
              } px-2 sm:px-3 py-1 rounded-lg active:scale-[0.98] disabled:bg-slate-700 disabled:text-slate-400 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-1 text-center whitespace-nowrap ${
                isServing || activeMatch.scoringMode === 'rally'
                  ? 'bg-orange-600 hover:bg-orange-500 shadow-sm'
                  : 'bg-sky-600 hover:bg-sky-500 shadow-sm'
              }`}
            >
              {!isWinningScoreReached && <Plus className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />}
              <span className="truncate">{primaryActionText}</span>
            </button>
          </div>

          {/* Secondary Utility Row: Show Direct Point only in Side-Out mode; always show clean Time-out */}
          <div className={activeMatch.scoringMode === 'side_out' ? 'grid grid-cols-2 gap-1' : 'grid grid-cols-1'}>
            {activeMatch.scoringMode === 'side_out' && (
              <button
                type="button"
                disabled={isWinningScoreReached}
                onClick={() => handleDirectPoint(team)}
                className={`${
                  dense ? 'min-h-[26px] sm:min-h-[32px]' : 'min-h-[30px] sm:min-h-[34px]'
                } px-1.5 py-0.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 disabled:opacity-35 disabled:cursor-not-allowed text-[10px] sm:text-[11px] font-medium text-slate-300 flex items-center justify-center gap-0.5 whitespace-nowrap`}
              >
                <Plus className="w-3 h-3 shrink-0 text-emerald-400" />
                <span>Điểm TT</span>
              </button>
            )}

            <button
              type="button"
              disabled={activeMatch.status === 'completed'}
              onClick={() => handleTimeout(team)}
              className={`${
                dense ? 'min-h-[26px] sm:min-h-[32px]' : 'min-h-[30px] sm:min-h-[34px]'
              } px-1.5 py-0.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 disabled:opacity-35 text-[10px] sm:text-[11px] font-medium text-amber-300 flex items-center justify-center gap-1 whitespace-nowrap`}
            >
              <PauseCircle className="w-3 h-3 shrink-0 text-amber-400" />
              <span>Hội ý ({2 - timeouts})</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Helper renderer for Authentic 3D Overhead Pickleball Court Diagram with Smooth Animated Athlete Transitions
  const renderCourtMap = (compactHeight = false) => {
    const leftTeamCode: 'A' | 'B' = isAOnLeft ? 'A' : 'B';
    const rightTeamCode: 'A' | 'B' = isAOnLeft ? 'B' : 'A';
    const leftTeamName = isAOnLeft ? activeMatch.teamAName : activeMatch.teamBName;
    const rightTeamName = isAOnLeft ? activeMatch.teamBName : activeMatch.teamAName;

    // Quadrant serving & receiving state (4 standard Pickleball quadrants)
    const isLeftTopServing =
      (isAOnLeft && activeMatch.servingTeam === 'A' && !isScoreAEven) ||
      (!isAOnLeft && activeMatch.servingTeam === 'B' && !isScoreBEven);
    const isLeftBottomServing =
      (isAOnLeft && activeMatch.servingTeam === 'A' && isScoreAEven) ||
      (!isAOnLeft && activeMatch.servingTeam === 'B' && isScoreBEven);
    const isRightTopServing =
      (isAOnLeft && activeMatch.servingTeam === 'B' && isScoreBEven) ||
      (!isAOnLeft && activeMatch.servingTeam === 'A' && isScoreAEven);
    const isRightBottomServing =
      (isAOnLeft && activeMatch.servingTeam === 'B' && !isScoreBEven) ||
      (!isAOnLeft && activeMatch.servingTeam === 'A' && !isScoreAEven);

    const isRightBottomReceiving = isLeftTopServing;
    const isRightTopReceiving = isLeftBottomServing;
    const isLeftBottomReceiving = isRightTopServing;
    const isLeftTopReceiving = isRightBottomServing;

    // Build persistent athlete objects keyed by athlete identity so 3D positions damp/glide smoothly on move
    const getTeamAthletes = (team: 'A' | 'B'): CourtAthlete3D[] => {
      const isTeamA = team === 'A';
      const p1 = isTeamA ? dispA1 : dispB1;
      const p2 = isTeamA ? dispA2 : dispB2;
      const isOnLeft = isTeamA ? isAOnLeft : !isAOnLeft;
      const isScoreEven = isTeamA ? isScoreAEven : isScoreBEven;

      // In Pickleball: Even score -> P1 stands in Even court (Right facing net), P2 stands in Odd court (Left facing net).
      // On Left half (facing right): Even = Bottom, Odd = Top.
      // On Right half (facing left): Even = Top, Odd = Bottom.
      const p1InBottom = isOnLeft ? isScoreEven : !isScoreEven;
      const p2InBottom = !p1InBottom;

      const makeRole = (inBottom: boolean) => {
        if (isOnLeft) {
          const isServing = inBottom ? isLeftBottomServing : isLeftTopServing;
          const isReceiving = inBottom ? isLeftBottomReceiving : isLeftTopReceiving;
          const boxLabel = inBottom ? 'Ô Chẵn' : 'Ô Lẻ';
          return { isServing, isReceiving, boxLabel };
        }
        const isServing = inBottom ? isRightBottomServing : isRightTopServing;
        const isReceiving = inBottom ? isRightBottomReceiving : isRightTopReceiving;
        const boxLabel = inBottom ? 'Ô Lẻ' : 'Ô Chẵn';
        return { isServing, isReceiving, boxLabel };
      };

      const role1 = makeRole(p1InBottom);
      const role2 = makeRole(p2InBottom);

      const distinctNames = p1 !== p2;
      return [
        {
          key: distinctNames ? `${team}-${p1}` : `${team}-slot-1`,
          team,
          slot: 1,
          name: p1,
          isOnLeft,
          inBottom: p1InBottom,
          ...role1,
        },
        {
          key: distinctNames ? `${team}-${p2}` : `${team}-slot-2`,
          team,
          slot: 2,
          name: p2,
          isOnLeft,
          inBottom: p2InBottom,
          ...role2,
        },
      ];
    };

    const courtAthletes: CourtAthlete3D[] = [...getTeamAthletes('A'), ...getTeamAthletes('B')];

    return (
      <div className="relative rounded-xl p-1 sm:p-1.5 bg-emerald-950/75 border border-emerald-800/60 flex-1 min-h-0 flex flex-col justify-between gap-1">
        {/* Clean 1-Line Court Side Header with Inline Swap Controls */}
        <div className="px-1.5 sm:px-2 py-0.5 rounded-lg bg-slate-950/70 flex items-center justify-between gap-1 text-[10px] sm:text-[11px] shrink-0">
          <div className="flex items-center gap-1 font-semibold text-emerald-300 min-w-0">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
            <span className="truncate max-w-[105px] sm:max-w-[180px]">
              {leftTeamName}
            </span>
            <button
              type="button"
              onClick={() => handleSwapTeamPlayers(leftTeamCode)}
              className="px-1.5 py-0.5 rounded bg-slate-800/90 hover:bg-slate-700 text-slate-300 font-medium text-[9px] shrink-0"
              title={`Đổi chỗ 2 VĐV Đội ${leftTeamCode}`}
            >
              ⇄ Đổi chỗ
            </button>
          </div>

          <span className="hidden md:inline text-[10px] font-semibold text-slate-400 uppercase tracking-widest shrink-0">
            SÂN 3D · 20×44FT
          </span>

          <div className="flex items-center gap-1 font-semibold text-sky-300 min-w-0 justify-end">
            <button
              type="button"
              onClick={() => handleSwapTeamPlayers(rightTeamCode)}
              className="px-1.5 py-0.5 rounded bg-slate-800/90 hover:bg-slate-700 text-slate-300 font-medium text-[9px] shrink-0"
              title={`Đổi chỗ 2 VĐV Đội ${rightTeamCode}`}
            >
              ⇄ Đổi chỗ
            </button>
            <span className="truncate max-w-[105px] sm:max-w-[180px] text-right">
              {rightTeamName}
            </span>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
          </div>
        </div>

        {/* TRUE WEBGL REACT-THREE-FIBER 3D OVERHEAD PICKLEBALL COURT (Auto-scales to any mobile height) */}
        <div
          className={`relative flex-1 min-h-0 w-full ${
            compactHeight ? 'min-h-[100px]' : 'min-h-[108px] sm:min-h-[190px]'
          }`}
        >
          <PickleballCourt3D
            athletes={courtAthletes}
            serverNumber={activeMatch.serverNumber}
            scoreA={activeMatch.scoreA}
            scoreB={activeMatch.scoreB}
            servingTeam={activeMatch.servingTeam}
            isAOnLeft={isAOnLeft}
            isLeftTopServing={isLeftTopServing}
            isLeftBottomServing={isLeftBottomServing}
            isRightTopServing={isRightTopServing}
            isRightBottomServing={isRightBottomServing}
            isLeftTopReceiving={isLeftTopReceiving}
            isLeftBottomReceiving={isLeftBottomReceiving}
            isRightTopReceiving={isRightTopReceiving}
            isRightBottomReceiving={isRightBottomReceiving}
            isDrawShaking={isSpinningCoin}
            isDrawSparkling={isDrawSparkling}
            onSelectAthlete={handleOpenSubstituteModal}
          />
        </div>
      </div>
    );
  };

  const waitingQueueMatches = useMemo(() => {
    if (!activeMatch) return [];
    return matches
      .filter((m) => m.id !== activeMatch.id && m.status === 'scheduled')
      .sort((a, b) => {
        const aSameCourt = a.courtNumber === activeMatch.courtNumber ? 0 : 1;
        const bSameCourt = b.courtNumber === activeMatch.courtNumber ? 0 : 1;
        if (aSameCourt !== bSameCourt) return aSameCourt - bSameCourt;
        return a.matchNumber - b.matchNumber;
      });
  }, [matches, activeMatch]);

  const handleReportCourtAvailable = () => {
    if (!activeMatch) return;
    if (!requireRefereeLogin('Báo sân trống cho VĐV danh sách chờ')) return;
    if (onAnnounceCourtAvailable) {
      onAnnounceCourtAvailable(activeMatch);
    } else {
      onAnnounceCourtCall(activeMatch);
    }
    setCourtAvailableNotifiedId(activeMatch.id);
    if (courtAvailableTimerRef.current !== null) {
      window.clearTimeout(courtAvailableTimerRef.current);
    }
    courtAvailableTimerRef.current = window.setTimeout(() => {
      setCourtAvailableNotifiedId(null);
      courtAvailableTimerRef.current = null;
    }, 3500);
  };

  const isCourtAvailableNotified = courtAvailableNotifiedId === activeMatch.id;

  const openScheduleEditor = (targetMatch?: Match) => {
    const target = targetMatch || activeMatch;
    if (!target) return;
    setEditingScheduleMatchId(target.id);
    setDraftCourtNumber(target.courtNumber);
    setDraftScheduledTime(target.scheduledTime || '08:00');
    setShowScheduleConflictModal(true);
  };

  const handleSaveScheduleAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireRefereeLogin('Điều chỉnh Sân & Giờ thi đấu')) return;
    if (!editingScheduleMatch) return;
    onUpdateMatch(editingScheduleMatch.id, {
      courtNumber: Math.max(1, draftCourtNumber),
      scheduledTime: draftScheduledTime.trim() || editingScheduleMatch.scheduledTime,
    });
    setShowScheduleConflictModal(false);
  };

  const handleAutoResolveConflict = (targetMatch: Match) => {
    if (!requireRefereeLogin('Tự động đổi sang sân/giờ trống')) return;
    const suggestion = findNextAvailableCourtSlot(
      targetMatch,
      matches,
      tournament.courtsCount,
    );
    onUpdateMatch(targetMatch.id, {
      courtNumber: suggestion.courtNumber,
      scheduledTime: suggestion.scheduledTime,
    });
    if (editingScheduleMatch?.id === targetMatch.id) {
      setDraftCourtNumber(suggestion.courtNumber);
      setDraftScheduledTime(suggestion.scheduledTime);
    }
  };

  return (
    <div className="h-full min-h-0 overflow-hidden flex flex-col justify-between gap-1 sm:gap-1.5 text-white">
      {/* CLEAN TOP BAR: MATCH PICKER + 5 BALANCED ACTIONS (AUTO PORTRAIT / LANDSCAPE) */}
      <div
        className={`relative shrink-0 bg-slate-900 border-slate-800 text-white border rounded-xl p-1 sm:p-2 flex shadow-xs ${
          effectiveOrientation === 'landscape'
            ? 'flex-row items-center justify-between gap-1.5'
            : 'flex-col gap-1'
        }`}
      >
        {/* Match Picker + Match Clock */}
        <div className="flex items-center justify-between gap-1 min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setShowMobileMatchPicker((v) => !v)}
            className={`min-h-[30px] sm:min-h-[34px] flex-1 min-w-0 px-2 py-0.5 rounded-lg text-white text-[11px] sm:text-xs font-bold flex items-center justify-between gap-1 ${
              activeMatchConflicts.length > 0
                ? 'bg-rose-950/90 border border-rose-500/70 hover:bg-rose-900/90'
                : 'bg-slate-800/90 hover:bg-slate-700'
            }`}
          >
            <span className="truncate flex items-center gap-1 min-w-0">
              {activeMatchConflicts.length > 0 && (
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              )}
              <span className="truncate">
                Sân {activeMatch.courtNumber} ({activeMatch.scheduledTime}) · #{activeMatch.matchNumber}:{' '}
                {activeMatch.teamAName} vs {activeMatch.teamBName}
              </span>
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-orange-400 shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => openScheduleEditor(activeMatch)}
            title="Kiểm tra xung đột lịch & Đổi sân / giờ"
            className={`flex items-center gap-1 px-2 min-h-[30px] sm:min-h-[34px] rounded-lg font-mono-num text-[10px] sm:text-xs font-bold shrink-0 transition-colors ${
              allScheduleConflicts.length > 0
                ? 'bg-rose-600 hover:bg-rose-500 text-white'
                : 'bg-slate-800/70 hover:bg-slate-700 text-emerald-400'
            }`}
          >
            {allScheduleConflicts.length > 0 ? (
              <AlertTriangle className="w-3 h-3 shrink-0" />
            ) : (
              <Clock className="w-3 h-3 shrink-0" />
            )}
            <span>{formatTimer(elapsedSec)}</span>
          </button>
        </div>

        {/* 5 Balanced Utility Buttons (Zero clipping on mobile) */}
        <div
          className={
            effectiveOrientation === 'landscape'
              ? 'flex items-center gap-1 shrink-0'
              : 'grid grid-cols-5 gap-1'
          }
        >
          <button
            type="button"
            onClick={() => {
              if (!requireRefereeLogin('Bốc thăm quay đồng xu chọn bóng / sân')) return;
              setShowCoinTossModal(true);
              handleRunRandomCoinToss();
            }}
            className="min-h-[28px] sm:min-h-[32px] px-1 sm:px-2 py-0.5 rounded-lg bg-orange-600/20 hover:bg-orange-600/30 text-orange-300 text-[9.5px] sm:text-[11px] font-semibold flex items-center justify-center gap-1 whitespace-nowrap"
          >
            <Dices className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-orange-400 shrink-0" />
            <span className="truncate">Bốc thăm</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenSubstituteModal('A', 1)}
            className="min-h-[28px] sm:min-h-[32px] px-1 sm:px-2 py-0.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-sky-300 text-[9.5px] sm:text-[11px] font-semibold flex items-center justify-center gap-1 whitespace-nowrap"
          >
            <UserPlus className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-sky-400 shrink-0" />
            <span className="truncate">Thay VĐV</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (!isAdmin) {
                onRequestLogin(
                  'Phải đăng nhập tài khoản Admin (admin / 1986) mới có thể thêm hoặc chọn nội dung Đồng đội / Đôi.',
                );
                return;
              }
              setShowLineupModal(true);
            }}
            className="min-h-[28px] sm:min-h-[32px] px-1 sm:px-2 py-0.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-[9.5px] sm:text-[11px] font-semibold flex items-center justify-center gap-1 whitespace-nowrap"
          >
            <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-orange-400 shrink-0" />
            <span className="truncate">Đội hình</span>
          </button>

          <button
            type="button"
            onClick={handleReportCourtAvailable}
            title={
              waitingQueueMatches[0]
                ? `Báo Sân ${activeMatch.courtNumber} trống & mời Trận #${waitingQueueMatches[0].matchNumber} (${waitingQueueMatches[0].teamAName} vs ${waitingQueueMatches[0].teamBName})`
                : `Báo Sân ${activeMatch.courtNumber} đã trống`
            }
            className={`min-h-[28px] sm:min-h-[32px] px-1 sm:px-2 py-0.5 rounded-lg text-[9.5px] sm:text-[11px] font-semibold flex items-center justify-center gap-1 whitespace-nowrap transition-colors ${
              isCourtAvailableNotified
                ? 'bg-emerald-600 text-white'
                : activeMatch.status === 'completed' || isWinningScoreReached
                ? 'bg-emerald-600/25 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/40'
                : 'bg-slate-800/90 hover:bg-slate-700 text-emerald-300'
            }`}
          >
            <BellRing className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
            <span className="truncate sm:hidden">
              {isCourtAvailableNotified ? 'Đã báo' : 'Sân trống'}
            </span>
            <span className="hidden sm:inline truncate">
              {isCourtAvailableNotified ? 'Đã báo trống' : 'Báo Sân Trống'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowCharterModal(true)}
            className="min-h-[28px] sm:min-h-[32px] px-1 sm:px-2 py-0.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-300 text-[9.5px] sm:text-[11px] font-medium flex items-center justify-center gap-1 whitespace-nowrap"
          >
            <BookOpen className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400 shrink-0" />
            <span className="truncate">Điều lệ</span>
          </button>
        </div>

        {/* Floating Match Picker Overlay (Does not push 1-screen layout down) */}
                {showMobileMatchPicker && (
          <div className="absolute top-full left-0 right-0 mt-1 z-40 bg-slate-950 border border-slate-700 rounded-xl overflow-hidden shadow-2xl text-white">
            <div className="px-3 sm:px-4 py-2 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                  <ListFilter className="w-4 h-4 text-orange-500" />
                  Chọn Trận ({matches.length})
                </span>
                <div className="inline-flex items-center gap-1 bg-slate-950 border border-slate-800 p-0.5 rounded-lg text-[11px]">
                  <button
                    type="button"
                    onClick={() =>
                      onSelectMatch(
                        matches.find(
                          (x) =>
                            x.competitionType !== 'team' &&
                            !/đồng\s*đội|\bteam\b/i.test(x.division || ''),
                        )?.id || activeMatch.id,
                      )
                    }
                    className={`px-2 py-0.5 rounded font-bold ${
                      !isActiveTeamCompetition
                        ? 'bg-orange-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Đôi
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onSelectMatch(
                        matches.find(
                          (x) =>
                            x.competitionType === 'team' ||
                            /đồng\s*đội|\bteam\b/i.test(x.division || ''),
                        )?.id || activeMatch.id,
                      )
                    }
                    className={`px-2 py-0.5 rounded font-bold ${
                      isActiveTeamCompetition
                        ? 'bg-orange-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Đồng đội
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMobileMatchPicker(false)}
                className="text-xs font-semibold text-slate-400 hover:text-white px-2 py-1"
              >
                Đóng ✕
              </button>
            </div>
            <div className="divide-y divide-slate-800 max-h-64 overflow-y-auto grid grid-cols-1 md:grid-cols-2">
              {matches
                .filter((m) => {
                  const mIsTeam =
                    m.competitionType === 'team' ||
                    /đồng\s*đội|\bteam\b/i.test(m.division || '');
                  return isActiveTeamCompetition ? mIsTeam : !mIsTeam;
                })
                .map((m) => {
                  const isSelected = m.id === activeMatch.id;
                  const hasConflict = conflictMatchIds.has(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        onSelectMatch(m.id);
                        setShowMobileMatchPicker(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 transition-colors flex items-center justify-between gap-3 ${
                        hasConflict
                          ? 'bg-rose-950/60 hover:bg-rose-900/60 text-white'
                          : isSelected
                          ? 'bg-slate-800 text-white border-l-2 border-orange-500'
                          : 'hover:bg-slate-900 text-slate-300'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                          <span className="font-mono-num font-bold text-white">
                            Sân {m.courtNumber} · {m.scheduledTime} · #{m.matchNumber}
                          </span>
                          <span>·</span>
                          <span className="truncate">{m.teamSubCategory || m.division}</span>
                        </div>
                        <div className="mt-0.5 text-xs sm:text-sm font-semibold text-white truncate">
                          {m.teamAName} vs {m.teamBName}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono-num text-sm font-bold text-orange-400">
                          {m.scoreA} : {m.scoreB}
                        </div>
                        <div
                          className={`text-[11px] font-semibold ${
                            m.status === 'live'
                              ? 'text-emerald-400'
                              : m.status === 'completed'
                              ? 'text-slate-400'
                              : 'text-amber-400'
                          }`}
                        >
                          {MATCH_STATUS_LABELS[m.status]}
                        </div>
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>
        )}
      </div>

      {/* REAL-TIME SCHEDULE CONFLICT WARNING STRIP (Auto-appears only when court/time overlap exists) */}
      {allScheduleConflicts.length > 0 && (
        <div
          className={`shrink-0 rounded-xl border px-2.5 py-1 flex items-center justify-between gap-2 text-[10px] sm:text-xs ${
            activeMatchConflicts.length > 0
              ? 'bg-rose-950/95 border-rose-500/70 text-rose-100'
              : 'bg-amber-950/90 border-amber-500/60 text-amber-100'
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <AlertTriangle
              className={`w-3.5 h-3.5 shrink-0 ${
                activeMatchConflicts.length > 0 ? 'text-rose-400' : 'text-amber-400'
              }`}
            />
            <span className="truncate font-semibold">
              {activeMatchConflicts.length > 0
                ? activeMatchConflicts[0].message
                : `Cảnh báo xung đột lịch: Có ${allScheduleConflicts.length} cặp trận trùng sân hoặc trùng giờ.`}
            </span>
          </div>
          <button
            type="button"
            onClick={() =>
              openScheduleEditor(
                activeMatchConflicts[0]
                  ? activeMatch
                  : allScheduleConflicts[0].matchB,
              )
            }
            className={`px-2 py-0.5 rounded-md font-bold text-[10px] sm:text-[11px] whitespace-nowrap shrink-0 transition-colors ${
              activeMatchConflicts.length > 0
                ? 'bg-rose-600 hover:bg-rose-500 text-white'
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
            }`}
          >
            Xem &amp; Đổi lịch ({allScheduleConflicts.length})
          </button>
        </div>
      )}

      {/* MAIN COURTSIDE REFEREE COCKPIT (Fits 100% inside single viewport without scrolling) */}
      <div className="bg-slate-900 text-white rounded-xl sm:rounded-2xl border border-slate-800 overflow-hidden shadow-lg flex-1 min-h-0 flex flex-col justify-between">
        {/* IF TEAM COMPETITION: COMPACT 4 DOUBLES + 1 SINGLES DECIDER BAR */}
        {isActiveTeamCompetition && (
          <div className="px-2.5 sm:px-4 py-1 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-1 overflow-x-auto">
              {currentTeamSlots.map((slot) => {
                if (slot.order === 5 && activeMatch.stage === 'group') return null;
                const isCurrent = slot.order === activeSlotOrder;
                return (
                  <button
                    key={slot.order}
                    type="button"
                    onClick={() => handleSelectTeamSubMatch(slot.order)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap transition-colors flex items-center gap-1 ${
                      isCurrent
                        ? 'bg-orange-600 text-white'
                        : slot.completed
                        ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-700/60'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <span>{slot.label}</span>
                    {(slot.completed || slot.scoreA > 0 || slot.scoreB > 0) && (
                      <span className="font-mono-num text-[9px] opacity-90">
                        ({slot.scoreA}-{slot.scoreB})
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1.5 text-[11px] shrink-0">
              <span className="font-mono-num font-extrabold text-emerald-400">
                {teamGamesA}-{teamGamesB}
              </span>
              <button
                type="button"
                onClick={handleSaveTeamSubMatchResult}
                className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold whitespace-nowrap"
              >
                Chốt #{activeSlotOrder} →
              </button>
            </div>
          </div>
        )}

        {/* Clean Single-Row Score Callout, Rule Mode & Side Switch Bar */}
        <div className="px-2 sm:px-4 py-1 bg-slate-950/85 border-b border-slate-800/80 flex items-center justify-between gap-1.5 flex-nowrap shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[10px] sm:text-xs text-slate-400 shrink-0">Hô:</span>
            <span className="font-mono-num text-xs sm:text-base font-extrabold text-orange-400 tracking-wider shrink-0">
              {formatScoreCallout(activeMatch)}
            </span>
            <span className="text-[10px] text-slate-500 font-mono-num whitespace-nowrap shrink-0">
              · {activeMatch.pointsToWin}đ
            </span>
            {isAtSwitchPoint && (
              <span className="text-[10px] font-bold text-amber-300 flex items-center gap-0.5 shrink-0 animate-pulse">
                <ShieldAlert className="w-3 h-3" />
                Đổi sân!
              </span>
            )}
            {isSinglesDeciderSlot && (
              <span className="hidden sm:inline text-[10px] font-bold text-emerald-300">
                · {singlesRotationPairIndex === 0 ? 'Nam-Nam' : 'Nữ-Nữ'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <div className="flex items-center bg-slate-800/90 rounded-md p-0.5 text-[9.5px] sm:text-[10px]">
              <button
                type="button"
                onClick={() => {
                  if (!requireRefereeLogin('Đổi luật tính điểm')) return;
                  onUpdateMatch(activeMatch.id, { scoringMode: 'side_out' });
                }}
                className={`px-1.5 py-0.5 rounded font-semibold transition-colors whitespace-nowrap ${
                  activeMatch.scoringMode === 'side_out'
                    ? 'bg-orange-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Side-Out
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!requireRefereeLogin('Đổi luật tính điểm')) return;
                  onUpdateMatch(activeMatch.id, { scoringMode: 'rally' });
                }}
                className={`px-1.5 py-0.5 rounded font-semibold transition-colors whitespace-nowrap ${
                  activeMatch.scoringMode === 'rally'
                    ? 'bg-orange-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Rally
              </button>
            </div>

            <button
              type="button"
              onClick={handleSwapCourtSides}
              className="px-2 py-0.5 text-[9.5px] sm:text-[10px] font-semibold bg-slate-800/90 hover:bg-slate-700 text-slate-200 rounded-md flex items-center gap-1 transition-colors whitespace-nowrap"
            >
              <ArrowLeftRight className="w-3 h-3 text-orange-400" />
              <span>Đổi sân</span>
            </button>
          </div>
        </div>

        {/* WINNING SCORE REACHED LOCK BANNER (Ultra-compact 1-line) */}
        {Boolean(eligibleWinner) && activeMatch.status !== 'completed' && (
          <div className="px-2 sm:px-4 py-0.5 sm:py-1 bg-emerald-950/90 border-b border-emerald-700/70 flex items-center justify-between gap-2 text-[10px] sm:text-[11px] shrink-0">
            <div className="flex items-center gap-1 text-emerald-200 font-semibold truncate">
              <Trophy className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-yellow-400 shrink-0" />
              <span className="truncate">
                Đội{' '}
                <strong className="text-white">
                  {eligibleWinner === 'A' ? activeMatch.teamAName : activeMatch.teamBName}
                </strong>{' '}
                đủ điểm ({activeMatch.scoreA}-{activeMatch.scoreB}) · Đã khóa (+)
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleDecrementPoint(eligibleWinner as 'A' | 'B')}
              className="px-1.5 sm:px-2 py-0.5 rounded bg-rose-700 hover:bg-rose-600 text-white text-[9.5px] sm:text-[10px] font-bold flex items-center gap-0.5 shrink-0 whitespace-nowrap"
            >
              <Minus className="w-3 h-3 stroke-[3]" />
              <span>-1 Đội {eligibleWinner}</span>
            </button>
          </div>
        )}

        {/* ORIENTATION-AWARE BODY: LANDSCAPE (3-Col Gamepad with wide center 3D Court) vs PORTRAIT (3D Court + 2-Col Thumb Pads) */}
        {effectiveOrientation === 'landscape' ? (
          <div className="flex-1 min-h-0 p-1 sm:p-2 grid grid-cols-[minmax(140px,24%)_1fr_minmax(140px,24%)] gap-1.5 sm:gap-2 items-stretch">
            <div className="flex flex-col justify-center min-w-0">
              {renderTeamScoringPad(leftSideTeam, true)}
            </div>

            <div className="flex flex-col min-h-0 min-w-0">
              {renderCourtMap(true)}
            </div>

            <div className="flex flex-col justify-center min-w-0">
              {renderTeamScoringPad(rightSideTeam, true)}
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 p-1 sm:p-2 flex flex-col justify-between gap-1 sm:gap-2">
            {/* 3D Overhead Pickleball Court auto-scales to fill flexible center space */}
            {renderCourtMap(false)}

            {/* 2-Column Thumb-Zone Team Scoring Pads */}
            <div className="grid grid-cols-2 gap-1 sm:gap-3 shrink-0">
              {renderTeamScoringPad('A', false)}
              {renderTeamScoringPad('B', false)}
            </div>
          </div>
        )}

        {/* Bottom Referee Utility Controls (Balanced responsive grid — zero right-edge clipping) */}
        <div className="px-1.5 sm:px-3 py-1 sm:py-1.5 bg-slate-950/95 border-t border-slate-800/80 shrink-0">
          {activeMatch.status !== 'completed' ? (
            <div
              className={`grid gap-1 ${
                activeMatch.status === 'scheduled' ? 'grid-cols-6' : 'grid-cols-5'
              }`}
            >
              {activeMatch.status === 'scheduled' && (
                <button
                  type="button"
                  onClick={handleStartMatch}
                  className="min-h-[30px] sm:min-h-[34px] px-1 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[9.5px] sm:text-[11px] font-bold flex items-center justify-center gap-1 whitespace-nowrap"
                >
                  <Play className="w-3 h-3 shrink-0" />
                  <span className="truncate">Bắt đầu</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleToggleServer}
                className="min-h-[30px] sm:min-h-[34px] px-1 py-0.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-[9.5px] sm:text-[11px] font-medium flex items-center justify-center gap-1 whitespace-nowrap"
              >
                <ArrowLeftRight className="w-3 h-3 text-orange-400 shrink-0" />
                <span className="truncate">Đổi giao</span>
              </button>

              <button
                type="button"
                disabled={!activeMatch.scoreHistory || activeMatch.scoreHistory.length === 0}
                onClick={handleUndo}
                className="min-h-[30px] sm:min-h-[34px] px-1 py-0.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 disabled:opacity-35 text-slate-200 text-[9.5px] sm:text-[11px] font-medium flex items-center justify-center gap-1 whitespace-nowrap"
              >
                <RotateCcw className="w-3 h-3 text-amber-400 shrink-0" />
                <span className="truncate">
                  {activeMatch.scoreHistory?.length ? `Hoàn (${activeMatch.scoreHistory.length})` : 'Hoàn tác'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!requireRefereeLogin('Phát thông báo gọi sân')) return;
                  onAnnounceCourtCall(activeMatch);
                }}
                className="min-h-[30px] sm:min-h-[34px] px-1 py-0.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-[9.5px] sm:text-[11px] font-medium flex items-center justify-center gap-1 whitespace-nowrap"
              >
                <Volume2 className="w-3 h-3 text-orange-400 shrink-0" />
                <span className="truncate">Gọi sân</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!requireRefereeLogin('Xử thua bỏ cuộc theo Điều lệ')) return;
                  setShowForfeitModal(true);
                }}
                className="min-h-[30px] sm:min-h-[34px] px-1 py-0.5 rounded-lg bg-rose-950/75 hover:bg-rose-900 text-rose-200 text-[9.5px] sm:text-[11px] font-medium flex items-center justify-center gap-1 whitespace-nowrap"
              >
                <FlagOff className="w-3 h-3 shrink-0" />
                <span className="truncate">Bỏ cuộc</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!requireRefereeLogin('Chốt kết quả trận đấu')) return;
                  if (
                    isActiveTeamCompetition &&
                    activeMatch.stage === 'group' &&
                    teamGamesA === 2 &&
                    teamGamesB === 2
                  ) {
                    onCompleteMatch(
                      {
                        ...activeMatch,
                        scoreA: 2,
                        scoreB: 2,
                        teamGamesWonA: 2,
                        teamGamesWonB: 2,
                        durationSeconds: elapsedSec || 1200,
                        refereeName: currentAccount?.displayName || activeMatch.refereeName,
                      },
                      '',
                    );
                    return;
                  }
                  const winner: 'A' | 'B' =
                    eligibleWinner || (activeMatch.scoreA >= activeMatch.scoreB ? 'A' : 'B');
                  onCompleteMatch(
                    {
                      ...activeMatch,
                      durationSeconds: elapsedSec || 900,
                      refereeName: currentAccount?.displayName || activeMatch.refereeName,
                    },
                    winner,
                  );
                }}
                className={`min-h-[30px] sm:min-h-[34px] px-1 py-0.5 rounded-lg text-[9.5px] sm:text-[11px] font-bold flex items-center justify-center gap-1 transition-colors whitespace-nowrap ${
                  eligibleWinner
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-100'
                }`}
              >
                <CheckCircle2 className="w-3 h-3 shrink-0" />
                <span className="truncate">
                  {isActiveTeamCompetition &&
                  activeMatch.stage === 'group' &&
                  teamGamesA === 2 &&
                  teamGamesB === 2
                    ? 'Hòa 2-2'
                    : eligibleWinner
                    ? `Chốt ${eligibleWinner}`
                    : 'Lưu điểm'}
                </span>
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-[10.5px] sm:text-xs font-semibold text-emerald-400 flex items-center gap-1 truncate min-w-0">
                <Trophy className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">
                  {activeMatch.winnerSide === ''
                    ? 'Hòa 2-2'
                    : `Thắng: ${
                        activeMatch.winnerSide === 'A'
                          ? activeMatch.teamAName
                          : activeMatch.teamBName
                      }`}
                </span>
              </span>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleReportCourtAvailable}
                  className={`min-h-[30px] sm:min-h-[34px] px-2.5 sm:px-3 py-1 rounded-lg text-[10.5px] sm:text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                    isCourtAvailableNotified
                      ? 'bg-emerald-700 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                  }`}
                >
                  <BellRing className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {isCourtAvailableNotified
                      ? '✓ Đã báo VĐV chờ'
                      : waitingQueueMatches.length > 0
                      ? `Báo Sân Trống (${waitingQueueMatches.length} chờ)`
                      : 'Báo Sân Trống'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (!requireRefereeLogin('Mở khóa sửa điểm')) return;
                    onUpdateMatch(activeMatch.id, {
                      status: 'live',
                      winnerSide: '',
                      winnerTeamId: '',
                      forfeitSide: '',
                    });
                  }}
                  className="min-h-[30px] sm:min-h-[34px] px-2 sm:px-2.5 py-1 text-[10.5px] sm:text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg whitespace-nowrap shrink-0"
                >
                  Sửa điểm
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL 0: XỬ THUA BỎ CUỘC (ĐỘI A HOẶC ĐỘI B) */}
      {showForfeitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-3 sm:p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full overflow-hidden shadow-2xl text-slate-900">
            <div className="px-4 py-3 bg-rose-50 border-b border-rose-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FlagOff className="w-4 h-4 text-rose-600" />
                <h3 className="font-display text-base font-bold text-rose-950 uppercase">
                  Xác nhận Xử thua Bỏ cuộc
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowForfeitModal(false)}
                className="p-1 rounded-lg text-rose-600 hover:bg-rose-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs">
              <p className="text-slate-600 leading-relaxed">
                Theo Điều lệ, đội bỏ cuộc nhận <strong>0 điểm</strong> và đối thủ được xử thắng{' '}
                <strong>{isActiveTeamCompetition ? '4-0' : '15-0'}</strong>. Chọn đội bỏ cuộc:
              </p>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    handleForfeitMatch('A');
                    setShowForfeitModal(false);
                  }}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold flex items-center justify-between"
                >
                  <span className="truncate">Đội A bỏ cuộc: {activeMatch.teamAName}</span>
                  <span className="text-[10px] opacity-90 shrink-0 ml-2">→ Đội B thắng</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleForfeitMatch('B');
                    setShowForfeitModal(false);
                  }}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold flex items-center justify-between"
                >
                  <span className="truncate">Đội B bỏ cuộc: {activeMatch.teamBName}</span>
                  <span className="text-[10px] opacity-90 shrink-0 ml-2">→ Đội A thắng</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowForfeitModal(false)}
                className="w-full min-h-[38px] py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: BỐC THĂM TRỌNG TÀI (QUAY ĐỒNG XU -> LỰA CHỌN BÓNG [CHỈ CÓ GIAO BÓNG] HOẶC SÂN [TRÁI / PHẢI]) */}
      {showCoinTossModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full max-h-[92dvh] overflow-y-auto my-auto shadow-xl text-slate-900">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Dices className="w-5 h-5 text-orange-600" />
                <h3 className="font-display text-base sm:text-lg font-bold text-slate-900 uppercase">
                  BỐC THĂM QUAY ĐỒNG XU — SÂN {activeMatch.courtNumber}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCoinTossModal(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200/60"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4">
              {/* 3D/2D Spinning Coin Display */}
              <div className="p-4 rounded-2xl bg-slate-900 text-white text-center space-y-3 border border-slate-800">
                <div className="text-xs text-slate-400">
                  Bấm vào đồng xu hoặc nút bên dưới để quay đồng xu ngẫu nhiên
                </div>

                <div className="flex justify-center py-1">
                  <button
                    type="button"
                    onClick={handleRunRandomCoinToss}
                    disabled={isSpinningCoin}
                    style={{
                      transform: `rotateY(${coinRotationDeg}deg)`,
                      transition: 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
                    }}
                    className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-300 via-yellow-500 to-orange-600 p-1.5 shadow-lg border-4 border-amber-200 flex flex-col items-center justify-center cursor-pointer active:scale-95"
                  >
                    <div className="w-full h-full rounded-full border-2 border-dashed border-amber-950/40 flex flex-col items-center justify-center text-slate-950">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider">
                        1986 COIN
                      </span>
                      <span className="font-display text-xl font-black leading-none mt-0.5">
                        {isSpinningCoin ? '...' : `ĐỘI ${tossWinnerSide}`}
                      </span>
                    </div>
                  </button>
                </div>

                <div className="font-display text-base sm:text-lg font-extrabold text-orange-400">
                  {isSpinningCoin
                    ? 'ĐANG QUAY ĐỒNG XU...'
                    : `THẮNG ĐỒNG XU: ĐỘI ${tossWinnerSide} (${
                        tossWinnerSide === 'A' ? activeMatch.teamAName : activeMatch.teamBName
                      })`}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleRunRandomCoinToss}
                    disabled={isSpinningCoin}
                    className="min-h-[40px] py-2 px-3 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Dices className="w-4 h-4 shrink-0" />
                    <span>{isSpinningCoin ? 'Đang quay...' : 'Quay Đồng Xu'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleRandomDrawAthleteBoxes}
                    disabled={isSpinningCoin}
                    className="min-h-[40px] py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Sparkles className="w-4 h-4 shrink-0" />
                    <span>{isSpinningCoin ? 'Đang bốc...' : 'Bốc Xếp Ô VĐV'}</span>
                  </button>
                </div>
              </div>

              <div className="space-y-3.5 text-xs">
                {/* 1. Đội thắng đồng xu & Các ô VĐV hiệu ứng rung lắc + ánh sáng lấp lánh */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">
                    1. Đội thắng bốc thăm & Danh sách Ô VĐV (Rung lắc & Lấp lánh khi bốc thăm)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['A', 'B'] as const).map((side) => {
                      const isWinner = tossWinnerSide === side;
                      const teamLabel = side === 'A' ? activeMatch.teamAName : activeMatch.teamBName;
                      const p1Name = side === 'A' ? dispA1 : dispB1;
                      const p2Name = side === 'A' ? dispA2 : dispB2;
                      const showSparkle = !isSpinningCoin && showCoinDrawSparkle && isWinner;

                      return (
                        <button
                          key={side}
                          type="button"
                          onClick={() =>
                            syncCoinTossSelection(side, tossChoiceMode, winnerChosenCourtSide)
                          }
                          className={`relative overflow-hidden p-2.5 rounded-xl font-bold border text-left transition-all ${
                            isSpinningCoin ? 'animate-draw-shake' : ''
                          } ${
                            showSparkle
                              ? 'animate-draw-sparkle-box bg-amber-50 border-amber-500 text-orange-950'
                              : isWinner
                              ? 'bg-orange-50 border-orange-500 text-orange-900'
                              : 'border-slate-200 bg-slate-50/70 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {showSparkle && (
                            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
                              <div className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-amber-300/45 to-transparent animate-draw-shimmer" />
                              <Sparkles className="w-3.5 h-3.5 text-amber-500 absolute top-1.5 right-1.5 animate-sparkle-star" />
                            </div>
                          )}

                          <div className="relative flex items-center justify-between gap-1">
                            <span className="truncate">
                              Đội {side}: {teamLabel}
                            </span>
                            {showSparkle && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-extrabold shrink-0">
                                ★ CHỌN
                              </span>
                            )}
                          </div>

                          {/* Các Ô VĐV (Rung lắc nhẹ khi quay & lấp lánh ánh sáng khi có kết quả) */}
                          <div className="relative mt-2 grid grid-cols-1 gap-1">
                            {[
                              { slotNum: 1, name: p1Name, box: 'Ô Chẵn' },
                              { slotNum: 2, name: p2Name, box: 'Ô Lẻ' },
                            ].map((athleteBox) => (
                              <div
                                key={`${side}-${athleteBox.slotNum}`}
                                className={`relative overflow-hidden px-2 py-1 rounded-lg border text-[10px] flex items-center justify-between gap-1 transition-all ${
                                  isSpinningCoin
                                    ? 'animate-draw-shake border-amber-400 bg-amber-50/80 text-slate-900'
                                    : showSparkle
                                    ? 'border-amber-400 bg-white text-slate-900 shadow-xs'
                                    : 'border-slate-200 bg-white text-slate-700'
                                }`}
                              >
                                {showSparkle && (
                                  <div className="pointer-events-none absolute inset-y-0 w-2/3 bg-gradient-to-r from-transparent via-yellow-300/45 to-transparent animate-draw-shimmer" />
                                )}
                                <span className="relative flex items-center gap-1 truncate font-bold">
                                  <span
                                    className={`inline-flex w-4 h-4 rounded-full items-center justify-center text-[8px] font-black shrink-0 ${
                                      side === 'A'
                                        ? 'bg-emerald-500 text-slate-950'
                                        : 'bg-orange-500 text-white'
                                    }`}
                                  >
                                    {side}
                                    {athleteBox.slotNum}
                                  </span>
                                  <span className="truncate">{athleteBox.name}</span>
                                </span>
                                <span className="relative text-[9px] font-semibold text-slate-500 shrink-0 flex items-center gap-0.5">
                                  {showSparkle && (
                                    <Sparkles className="w-2.5 h-2.5 text-amber-500 animate-sparkle-star" />
                                  )}
                                  {athleteBox.box}
                                </span>
                              </div>
                            ))}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Lựa chọn Bóng hoặc Sân */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">
                    2. Đội thắng bốc thăm lựa chọn: BÓNG hoặc SÂN
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        syncCoinTossSelection(tossWinnerSide, 'ball', winnerChosenCourtSide)
                      }
                      className={`min-h-[44px] px-3 py-2.5 rounded-xl font-bold border transition-all flex items-center justify-center gap-2 ${
                        tossChoiceMode === 'ball'
                          ? 'bg-slate-900 border-slate-900 text-white shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span>🎾 Chọn Bóng</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        syncCoinTossSelection(tossWinnerSide, 'court', winnerChosenCourtSide)
                      }
                      className={`min-h-[44px] px-3 py-2.5 rounded-xl font-bold border transition-all flex items-center justify-center gap-2 ${
                        tossChoiceMode === 'court'
                          ? 'bg-slate-900 border-slate-900 text-white shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span>🏟️ Chọn Sân</span>
                    </button>
                  </div>
                </div>

                {/* 3. Sub-options depending on Chọn Bóng (chỉ có giao bóng) vs Chọn Sân (Sân Trái / Sân Phải) */}
                {tossChoiceMode === 'ball' ? (
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2.5">
                    <div className="font-bold text-emerald-900">
                      Quyền Chọn Bóng (Chỉ có Giao bóng):
                    </div>
                    <div className="w-full min-h-[42px] px-3.5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold flex items-center justify-between shadow-xs">
                      <span>
                        🎾 Đội {tossWinnerSide} (
                        {tossWinnerSide === 'A' ? activeMatch.teamAName : activeMatch.teamBName})
                        — GIAO BÓNG TRƯỚC (0 - 0 - 2)
                      </span>
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    </div>

                    <div className="pt-1">
                      <label className="block text-[11px] font-semibold text-emerald-900 mb-1.5">
                        Chọn phần sân (Đội còn lại chọn Sân Trái hoặc Sân Phải):
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setCourtSideForA('left')}
                          className={`min-h-[38px] px-2.5 py-1.5 rounded-lg font-bold border text-[11px] ${
                            courtSideForA === 'left'
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-white text-slate-700 border-emerald-300'
                          }`}
                        >
                          Sân Trái: Đội A · Sân Phải: Đội B
                        </button>
                        <button
                          type="button"
                          onClick={() => setCourtSideForA('right')}
                          className={`min-h-[38px] px-2.5 py-1.5 rounded-lg font-bold border text-[11px] ${
                            courtSideForA === 'right'
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-white text-slate-700 border-emerald-300'
                          }`}
                        >
                          Sân Trái: Đội B · Sân Phải: Đội A
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200 space-y-2.5">
                    <div className="font-bold text-sky-900">
                      Đội {tossWinnerSide} (
                      {tossWinnerSide === 'A' ? activeMatch.teamAName : activeMatch.teamBName}) chọn
                      Sân Trái hoặc Sân Phải:
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => syncCoinTossSelection(tossWinnerSide, 'court', 'left')}
                        className={`min-h-[44px] px-3 py-2 rounded-xl font-bold border transition-all ${
                          winnerChosenCourtSide === 'left'
                            ? 'bg-sky-700 border-sky-700 text-white shadow-xs'
                            : 'bg-white border-sky-200 text-slate-700 hover:bg-sky-100/50'
                        }`}
                      >
                        ⬅️ Chọn Sân Trái
                      </button>
                      <button
                        type="button"
                        onClick={() => syncCoinTossSelection(tossWinnerSide, 'court', 'right')}
                        className={`min-h-[44px] px-3 py-2 rounded-xl font-bold border transition-all ${
                          winnerChosenCourtSide === 'right'
                            ? 'bg-sky-700 border-sky-700 text-white shadow-xs'
                            : 'bg-white border-sky-200 text-slate-700 hover:bg-sky-100/50'
                        }`}
                      >
                        Chọn Sân Phải ➡️
                      </button>
                    </div>
                    <div className="text-[11px] text-sky-800 font-medium">
                      • Đội còn lại (
                      {firstServerSide === 'A' ? activeMatch.teamAName : activeMatch.teamBName}) sẽ{' '}
                      <strong>Giao bóng trước (0 - 0 - 2)</strong>.
                    </div>
                  </div>
                )}

                {/* Result Summary Box */}
                <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 text-[11px] text-slate-700 space-y-1">
                  <div className="font-bold text-slate-900">Tóm tắt kết quả bốc thăm:</div>
                  <div>
                    • Giao bóng trước (0-0-2):{' '}
                    <strong className="text-orange-700">
                      Đội {firstServerSide} (
                      {firstServerSide === 'A' ? activeMatch.teamAName : activeMatch.teamBName})
                    </strong>
                  </div>
                  <div>
                    • Vị trí sân 3D:{' '}
                    <strong className="text-slate-900">
                      Sân Trái:{' '}
                      {courtSideForA === 'left' ? activeMatch.teamAName : activeMatch.teamBName}
                    </strong>{' '}
                    ·{' '}
                    <strong className="text-slate-900">
                      Sân Phải:{' '}
                      {courtSideForA === 'left' ? activeMatch.teamBName : activeMatch.teamAName}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCoinTossModal(false)}
                  className="min-h-[40px] px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={handleApplyCoinToss}
                  className="min-h-[40px] px-4 py-2 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-lg"
                >
                  Xác nhận & Áp dụng vào Sân 3D
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1B: POPUP THÔNG BÁO THỜI GIAN TIME-OUT (ĐẾM NGƯỢC 60 GIÂY) */}
      {activeTimeoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl text-slate-900">
            <div className="px-5 py-3.5 bg-amber-500 text-slate-950 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Timer className="w-5 h-5 text-slate-950" />
                <h3 className="font-display text-base sm:text-lg font-extrabold uppercase">
                  THÔNG BÁO THỜI GIAN TIME-OUT — SÂN {activeMatch.courtNumber}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveTimeoutModal(null)}
                className="p-1 rounded-lg text-slate-900 hover:bg-amber-600/30"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-center">
              {/* Switch team in popup if needed */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => handleTimeout('A')}
                  className={`py-2 px-3 rounded-xl font-bold border transition-colors ${
                    activeTimeoutModal.team === 'A'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  Time-out Đội A ({activeMatch.timeoutsA}/2)
                </button>
                <button
                  type="button"
                  onClick={() => handleTimeout('B')}
                  className={`py-2 px-3 rounded-xl font-bold border transition-colors ${
                    activeTimeoutModal.team === 'B'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  Time-out Đội B ({activeMatch.timeoutsB}/2)
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  ĐỘI XIN HỘI Ý: ĐỘI {activeTimeoutModal.team} —{' '}
                  {activeTimeoutModal.team === 'A' ? activeMatch.teamAName : activeMatch.teamBName}
                </div>
                <div className="text-xs text-slate-300">
                  Lượt hội ý thứ <strong>{activeTimeoutModal.timeoutNumber} / 2</strong> trong hiệp
                  · Điểm hiện tại: <strong>{formatScoreCallout(activeMatch)}</strong>
                </div>

                {/* Big 60s Countdown Clock */}
                <div
                  className={`font-mono-num text-5xl sm:text-6xl font-black py-2 ${
                    activeTimeoutModal.remainingSeconds === 0
                      ? 'text-rose-400 animate-pulse'
                      : activeTimeoutModal.remainingSeconds <= 15
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {formatTimer(activeTimeoutModal.remainingSeconds)}
                </div>

                {/* Progress Bar */}
                <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      activeTimeoutModal.remainingSeconds <= 15 ? 'bg-rose-500' : 'bg-emerald-500'
                    }`}
                    style={{
                      width: `${Math.min(
                        100,
                        (activeTimeoutModal.remainingSeconds /
                          Math.max(1, activeTimeoutModal.totalSeconds)) *
                          100,
                      )}%`,
                    }}
                  />
                </div>

                <div className="text-[11px] text-slate-400 pt-1">
                  {activeTimeoutModal.remainingSeconds === 0
                    ? '🔔 ĐÃ HẾT THỜI GIAN TIME-OUT! MỜI 2 ĐỘI TRỞ LẠI SÂN THI ĐẤU.'
                    : activeTimeoutModal.isPaused
                    ? '⏸ Đồng hồ Time-out đang tạm dừng'
                    : '⏱ Đang đếm ngược thời gian hội ý tiêu chuẩn (60 giây)'}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() =>
                    setActiveTimeoutModal((prev) =>
                      prev ? { ...prev, isPaused: !prev.isPaused } : prev,
                    )
                  }
                  className="min-h-[40px] px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold"
                >
                  {activeTimeoutModal.isPaused ? '▶ Tiếp tục' : '⏸ Tạm dừng'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setActiveTimeoutModal((prev) =>
                      prev
                        ? {
                            ...prev,
                            remainingSeconds: prev.remainingSeconds + 15,
                            totalSeconds: Math.max(prev.totalSeconds, prev.remainingSeconds + 15),
                          }
                        : prev,
                    )
                  }
                  className="min-h-[40px] px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold"
                >
                  +15 Giây
                </button>
                <button
                  type="button"
                  onClick={handleCancelAndRefundTimeout}
                  className="min-h-[40px] px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold"
                >
                  Hủy & Hoàn lượt
                </button>
              </div>

              <button
                type="button"
                onClick={() => setActiveTimeoutModal(null)}
                className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold shadow-md"
              >
                Kết thúc Time-out & Tiếp tục trận đấu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1C: POPUP THAY VĐV & LỰA CHỌN VĐV VÀO SÂN */}
      {showSubPlayerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl text-slate-900">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-sky-600" />
                <div>
                  <h3 className="font-display text-base sm:text-lg font-bold text-slate-900 uppercase">
                    THAY VẬN ĐỘNG VIÊN TRÊN SÂN — SÂN {activeMatch.courtNumber}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Chọn VĐV rời sân và lựa chọn VĐV dự bị vào thay
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSubPlayerModal(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200/60"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmSubstitution} className="p-4 sm:p-5 space-y-4 text-xs">
              {/* 1. Chọn Đội cần thay VĐV */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  1. Chọn Đội thực hiện thay VĐV
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSubTeam('A');
                      const bench = rosterOptionsA.filter((n) => n !== dispA1 && n !== dispA2);
                      setSubInPlayer(bench[0] || rosterOptionsA[0] || '');
                    }}
                    className={`min-h-[42px] px-3 py-2 rounded-xl font-bold border text-left truncate ${
                      subTeam === 'A'
                        ? 'bg-orange-50 border-orange-500 text-orange-900'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Đội A: {activeMatch.teamAName}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSubTeam('B');
                      const bench = rosterOptionsB.filter((n) => n !== dispB1 && n !== dispB2);
                      setSubInPlayer(bench[0] || rosterOptionsB[0] || '');
                    }}
                    className={`min-h-[42px] px-3 py-2 rounded-xl font-bold border text-left truncate ${
                      subTeam === 'B'
                        ? 'bg-orange-50 border-orange-500 text-orange-900'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Đội B: {activeMatch.teamBName}
                  </button>
                </div>
              </div>

              {/* 2. Chọn VĐV đang trên sân cần thay ra */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  2. Chọn VĐV đang thi đấu trên sân (Thay ra)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSubOutSlot(1)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      subOutSlot === 1
                        ? 'bg-rose-50 border-rose-500 text-rose-900 ring-1 ring-rose-500'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className="text-[10px] font-bold uppercase text-rose-600">
                      Vị trí VĐV 1 (Thay ra)
                    </div>
                    <div className="font-bold text-sm mt-0.5 truncate">
                      {subTeam === 'A' ? dispA1 : dispB1}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSubOutSlot(2)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      subOutSlot === 2
                        ? 'bg-rose-50 border-rose-500 text-rose-900 ring-1 ring-rose-500'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className="text-[10px] font-bold uppercase text-rose-600">
                      Vị trí VĐV 2 (Thay ra)
                    </div>
                    <div className="font-bold text-sm mt-0.5 truncate">
                      {subTeam === 'A' ? dispA2 : dispB2}
                    </div>
                  </button>
                </div>
              </div>

              {/* 3. Lựa chọn VĐV dự bị vào sân */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  3. Lựa chọn VĐV vào sân thay thế
                </label>
                <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto p-1">
                  {(subTeam === 'A' ? rosterOptionsA : rosterOptionsB).map((candidate) => {
                    const currentP1 = subTeam === 'A' ? dispA1 : dispB1;
                    const currentP2 = subTeam === 'A' ? dispA2 : dispB2;
                    const isAlreadyOnCourt = candidate === currentP1 || candidate === currentP2;
                    const isSelected = subInPlayer === candidate && !subCustomName.trim();

                    return (
                      <button
                        key={candidate}
                        type="button"
                        onClick={() => {
                          setSubInPlayer(candidate);
                          setSubCustomName('');
                        }}
                        className={`px-3 py-2 rounded-xl border text-left transition-all flex items-center justify-between gap-1 ${
                          isSelected
                            ? 'bg-emerald-600 border-emerald-600 text-white font-bold'
                            : isAlreadyOnCourt
                            ? 'bg-slate-100 border-slate-200 text-slate-400'
                            : 'bg-white border-slate-200 text-slate-800 hover:bg-emerald-50/50 font-semibold'
                        }`}
                      >
                        <span className="truncate">{candidate}</span>
                        {isAlreadyOnCourt && (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-slate-200 text-slate-600 shrink-0">
                            Trên sân
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-2">
                  <input
                    type="text"
                    value={subCustomName}
                    onChange={(e) => setSubCustomName(e.target.value)}
                    placeholder="Hoặc nhập tên VĐV dự bị mới vào sân..."
                    className="w-full min-h-[38px] px-3 py-1.5 text-xs border border-slate-300 rounded-xl bg-white"
                  />
                </div>
              </div>

              {/* 4. Lý do thay VĐV */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">4. Lý do thay VĐV</label>
                <div className="grid grid-cols-3 gap-2">
                  {['Chiến thuật', 'Chấn thương / Y tế', 'Đổi cặp đấu'].map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setSubReason(reason)}
                      className={`py-2 px-2.5 rounded-lg font-semibold border text-[11px] ${
                        subReason === reason
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
              </div>

              {/* Recent substitutions log */}
              {subHistory.length > 0 && (
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1 max-h-24 overflow-y-auto">
                  <div className="text-[10px] font-bold uppercase text-slate-500">
                    Lịch sử thay VĐV trong trận:
                  </div>
                  {subHistory.map((item) => (
                    <div key={item.id} className="text-[11px] text-slate-700">
                      • [{item.timeLabel}] Đội {item.team}: <strong>{item.inPlayer}</strong> vào thay{' '}
                      <span className="line-through text-slate-400">{item.outPlayer}</span> (
                      {item.reason})
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSubPlayerModal(false)}
                  className="min-h-[40px] px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="min-h-[40px] px-5 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-lg flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Xác nhận Thay VĐV</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CHỌN NỘI DUNG ĐÔI HOẶC NỘI DUNG ĐỒNG ĐỘI (4 TRẬN ĐÔI + 1 TRẬN ĐƠN THEO ĐIỀU LỆ) */}
      {showLineupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-2.5 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full overflow-hidden shadow-xl text-slate-900">
            <div className="px-4 sm:px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-orange-600" />
                <div>
                  <h3 className="font-display text-base sm:text-lg font-bold text-slate-900 uppercase">
                    CHỌN NỘI DUNG ĐÔI HOẶC ĐỒNG ĐỘI & ĐĂNG KÝ VĐV RA SÂN
                  </h3>
                  <p className="text-xs text-slate-500">
                    Theo Điều lệ Quyết định số 494/QĐTDTTVN · Sân {activeMatch.courtNumber} · Trận #
                    {activeMatch.matchNumber}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowLineupModal(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200/60"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleSaveCompetitionLineup}
              className="p-3.5 sm:p-5 space-y-4 max-h-[84vh] overflow-y-auto"
            >
              {/* STEP 1: CHOOSE DOUBLES VS TEAM COMPETITION */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setModalCompType('doubles')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    modalCompType === 'doubles'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className="text-xs font-bold flex items-center justify-between">
                    <span>1. NỘI DUNG ĐÔI (Đôi Nữ / Đôi Nam / Đôi Nam Nữ)</span>
                    {modalCompType === 'doubles' && (
                      <span className="text-[10px] text-orange-400">● Đang chọn</span>
                    )}
                  </div>
                  <p
                    className={`text-[11px] mt-1 ${
                      modalCompType === 'doubles' ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    Chạm 15 điểm, 08 điểm đổi sân (Vòng loại trực tiếp 14-14 thắng cách biệt 02đ, max 18đ).
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setModalCompType('team')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    modalCompType === 'team'
                      ? 'bg-orange-600 text-white border-orange-600'
                      : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className="text-xs font-bold flex items-center justify-between">
                    <span>2. NỘI DUNG ĐỒNG ĐỘI (04 Trận Đôi + 01 Trận Đơn 21đ)</span>
                    {modalCompType === 'team' && (
                      <span className="text-[10px] text-amber-200">● Đang chọn</span>
                    )}
                  </div>
                  <p
                    className={`text-[11px] mt-1 ${
                      modalCompType === 'team' ? 'text-orange-50' : 'text-slate-500'
                    }`}
                  >
                    Trận 1: Đôi Nữ · Trận 2: Đôi Nam · Trận 3 & 4: Đôi Nam Nữ (Mỗi VĐV tối đa 02 trận).
                  </p>
                </button>
              </div>

              {modalCompType === 'doubles' ? (
                /* DOUBLES MODE LINEUP SELECTOR */
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                      Chọn Nội dung Đôi thi đấu
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {DOUBLES_EVENT_CATEGORIES.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setDoublesCategory(cat)}
                          className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                            doublesCategory === cat
                              ? 'bg-orange-600 text-white border-orange-600'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Team A Doubles */}
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                      <div className="text-xs font-bold text-slate-900 uppercase">
                        ĐỘI A: {activeMatch.teamAName}
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          VĐV 1 (Ô Chẵn/Phải khi 0 điểm)
                        </label>
                        <select
                          value={playerA1}
                          onChange={(e) => setPlayerA1(e.target.value)}
                          className="w-full min-h-[38px] px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg bg-white"
                        >
                          {rosterOptionsA.map((opt) => (
                            <option key={`da1-${opt}`} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          VĐV 2 (Ô Lẻ/Trái khi 0 điểm)
                        </label>
                        <select
                          value={playerA2}
                          onChange={(e) => setPlayerA2(e.target.value)}
                          className="w-full min-h-[38px] px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg bg-white"
                        >
                          {rosterOptionsA.map((opt) => (
                            <option key={`da2-${opt}`} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Team B Doubles */}
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                      <div className="text-xs font-bold text-slate-900 uppercase">
                        ĐỘI B: {activeMatch.teamBName}
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          VĐV 1 (Ô Chẵn/Phải khi 0 điểm)
                        </label>
                        <select
                          value={playerB1}
                          onChange={(e) => setPlayerB1(e.target.value)}
                          className="w-full min-h-[38px] px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg bg-white"
                        >
                          {rosterOptionsB.map((opt) => (
                            <option key={`db1-${opt}`} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          VĐV 2 (Ô Lẻ/Trái khi 0 điểm)
                        </label>
                        <select
                          value={playerB2}
                          onChange={(e) => setPlayerB2(e.target.value)}
                          className="w-full min-h-[38px] px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg bg-white"
                        >
                          {rosterOptionsB.map((opt) => (
                            <option key={`db2-${opt}`} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* TEAM COMPETITION MODE: ALL 4 DOUBLES + 1 SINGLES DECIDER PER CHARTER */
                <div className="space-y-3.5">
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-slate-800 space-y-1">
                    <div className="font-bold text-amber-900">
                      Quy định Điều lệ Đồng đội (HLV / Đội trưởng đăng ký trước trận):
                    </div>
                    <p className="text-[11px] text-slate-700 leading-relaxed">
                      • <strong>Trận 1: Đôi Nữ</strong> · <strong>Trận 2: Đôi Nam</strong> ·{' '}
                      <strong>Trận 3: Đôi Nam Nữ 1</strong> · <strong>Trận 4: Đôi Nam Nữ 2</strong>{' '}
                      (Chạm 15 điểm, 08 điểm đổi sân; Mỗi VĐV được đăng ký tối đa không quá 02 trận).
                      <br />• <strong>Vòng loại trực tiếp khi hòa 2-2</strong>: Thi đấu{' '}
                      <strong>01 trận Đơn quyết định 21 điểm</strong> (ăn điểm trực tiếp Rally, cặp Nam gặp Nam, Nữ gặp Nữ luân phiên mỗi cặp 04 điểm, 11 điểm đổi sân).
                    </p>
                  </div>

                  {/* Validation Alert if any athlete exceeds 2 matches */}
                  {lineupValidation.violations.length > 0 && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-xs text-rose-800 space-y-1">
                      <div className="font-bold flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        Cảnh báo vượt quá số trận tối đa của 1 VĐV (Điều lệ tối đa 02 trận):
                      </div>
                      {lineupValidation.violations.map((v) => (
                        <div key={v} className="text-[11px]">
                          • {v}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Select which match out of 1..5 to put onto the court right now */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      Chọn Lượt trận đưa ra sân chấm điểm ngay:
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {teamSlotsDraft.map((slot) => (
                        <button
                          key={slot.order}
                          type="button"
                          onClick={() => setSelectedSlotOrder(slot.order)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                            selectedSlotOrder === slot.order
                              ? 'bg-orange-600 text-white border-orange-600'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {slot.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 4 Doubles + 1 Singles Registration Table */}
                  <div className="space-y-2.5">
                    {teamSlotsDraft.map((slot) => {
                      const isOrder5 = slot.order === 5;
                      return (
                        <div
                          key={slot.order}
                          className={`p-3 rounded-xl border ${
                            selectedSlotOrder === slot.order
                              ? 'border-orange-500 bg-orange-50/30'
                              : 'border-slate-200 bg-slate-50'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <span className="text-xs font-bold text-slate-900">
                              {slot.label}{' '}
                              <span className="font-normal text-slate-500">
                                {isOrder5
                                  ? '(21 điểm Rally · Luân phiên 4 điểm Nam-Nam / Nữ-Nữ · 11đ đổi sân)'
                                  : '(Chạm 15 điểm · 08đ đổi sân)'}
                              </span>
                            </span>
                            {selectedSlotOrder === slot.order && (
                              <span className="text-[11px] font-bold text-orange-600">
                                ● Trận đang chọn ra sân
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                            {/* Team A Pair for this Slot */}
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[11px] text-slate-500 mb-0.5">
                                  {isOrder5 ? 'Đội A - Đơn Nam (4đ đầu)' : `Đội A - VĐV 1`}
                                </label>
                                <select
                                  value={slot.teamAPlayer1}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setTeamSlotsDraft((prev) =>
                                      prev.map((s) =>
                                        s.order === slot.order ? { ...s, teamAPlayer1: val } : s,
                                      ),
                                    );
                                  }}
                                  className="w-full px-2 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg bg-white"
                                >
                                  {rosterOptionsA.map((opt) => (
                                    <option key={`s${slot.order}-a1-${opt}`} value={opt}>
                                      {opt} ({lineupValidation.countsA[opt] || 0}/2 trận)
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-[11px] text-slate-500 mb-0.5">
                                  {isOrder5 ? 'Đội A - Đơn Nữ (4đ tiếp)' : `Đội A - VĐV 2`}
                                </label>
                                <select
                                  value={slot.teamAPlayer2}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setTeamSlotsDraft((prev) =>
                                      prev.map((s) =>
                                        s.order === slot.order ? { ...s, teamAPlayer2: val } : s,
                                      ),
                                    );
                                  }}
                                  className="w-full px-2 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg bg-white"
                                >
                                  {rosterOptionsA.map((opt) => (
                                    <option key={`s${slot.order}-a2-${opt}`} value={opt}>
                                      {opt} ({lineupValidation.countsA[opt] || 0}/2 trận)
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            {/* Team B Pair for this Slot */}
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[11px] text-slate-500 mb-0.5">
                                  {isOrder5 ? 'Đội B - Đơn Nam (4đ đầu)' : `Đội B - VĐV 1`}
                                </label>
                                <select
                                  value={slot.teamBPlayer1}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setTeamSlotsDraft((prev) =>
                                      prev.map((s) =>
                                        s.order === slot.order ? { ...s, teamBPlayer1: val } : s,
                                      ),
                                    );
                                  }}
                                  className="w-full px-2 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg bg-white"
                                >
                                  {rosterOptionsB.map((opt) => (
                                    <option key={`s${slot.order}-b1-${opt}`} value={opt}>
                                      {opt} ({lineupValidation.countsB[opt] || 0}/2 trận)
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-[11px] text-slate-500 mb-0.5">
                                  {isOrder5 ? 'Đội B - Đơn Nữ (4đ tiếp)' : `Đội B - VĐV 2`}
                                </label>
                                <select
                                  value={slot.teamBPlayer2}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setTeamSlotsDraft((prev) =>
                                      prev.map((s) =>
                                        s.order === slot.order ? { ...s, teamBPlayer2: val } : s,
                                      ),
                                    );
                                  }}
                                  className="w-full px-2 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg bg-white"
                                >
                                  {rosterOptionsB.map((opt) => (
                                    <option key={`s${slot.order}-b2-${opt}`} value={opt}>
                                      {opt} ({lineupValidation.countsB[opt] || 0}/2 trận)
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Quick Add Substitute Athlete Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={newAthleteA}
                    onChange={(e) => setNewAthleteA(e.target.value)}
                    placeholder="Thêm nhanh VĐV Đội A..."
                    className="flex-1 px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!newAthleteA.trim()) return;
                      const name = newAthleteA.trim();
                      if (teamAReg && onAddRosterAthlete) {
                        onAddRosterAthlete(teamAReg.id, name);
                      }
                      setPlayerA2(name);
                      setNewAthleteA('');
                    }}
                    className="px-2.5 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg flex items-center gap-1 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Thêm A
                  </button>
                </div>

                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={newAthleteB}
                    onChange={(e) => setNewAthleteB(e.target.value)}
                    placeholder="Thêm nhanh VĐV Đội B..."
                    className="flex-1 px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!newAthleteB.trim()) return;
                      const name = newAthleteB.trim();
                      if (teamBReg && onAddRosterAthlete) {
                        onAddRosterAthlete(teamBReg.id, name);
                      }
                      setPlayerB2(name);
                      setNewAthleteB('');
                    }}
                    className="px-2.5 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg flex items-center gap-1 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Thêm B
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowLineupModal(false)}
                  className="min-h-[40px] px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="min-h-[40px] px-5 py-2 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-lg"
                >
                  Áp dụng Nội dung & Đội hình ra sân
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: XEM ĐIỀU LỆ THI ĐẤU CHÍNH THỨC (QUYẾT ĐỊNH 494/QĐTDTTVN) */}
      {showCharterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full overflow-hidden shadow-xl text-slate-900">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-orange-600" />
                <div>
                  <h3 className="font-display text-base sm:text-lg font-bold text-slate-900 uppercase">
                    ĐIỀU LỆ THI ĐẤU & CÁCH TÍNH ĐIỂM (QĐ 494/QĐTDTTVN)
                  </h3>
                  <p className="text-xs text-slate-500">
                    {CHARTER_REGULATION_SUMMARY.legalDecision}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCharterModal(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200/60"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-12 gap-4 max-h-[82vh] overflow-y-auto">
              <div className="md:col-span-6 space-y-3 text-xs text-slate-700">
                <div className="p-3 rounded-xl bg-orange-50 border border-orange-200 space-y-1.5">
                  <div className="font-bold text-orange-900 uppercase">
                    1. Thể thức Nội dung Đôi & Đồng đội
                  </div>
                  {CHARTER_REGULATION_SUMMARY.teamMatchOrder.map((line) => (
                    <div key={line}>+ {line}</div>
                  ))}
                  <div className="font-semibold text-slate-900 pt-1">
                    ({CHARTER_REGULATION_SUMMARY.maxMatchesPerAthlete} trận tối đa / mỗi VĐV trong 04 trận đôi)
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="font-bold text-slate-900 uppercase">
                    2. Điểm chạm thắng & Đổi sân
                  </div>
                  <p>• {CHARTER_REGULATION_SUMMARY.groupStageRule}</p>
                  <p>• {CHARTER_REGULATION_SUMMARY.knockoutStageRule}</p>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1.5">
                  <div className="font-bold text-emerald-900 uppercase">
                    3. Cách tính điểm & Xét chỉ số phụ
                  </div>
                  <p>• {CHARTER_REGULATION_SUMMARY.rankingPointsRule}</p>
                  <p>• {CHARTER_REGULATION_SUMMARY.tieBreakerRule}</p>
                </div>
              </div>

              <div className="md:col-span-6">
                <img
                  src={CHARTER_IMAGE_URL}
                  alt="Điều lệ giải Pickleball 1986"
                  className="w-full rounded-xl border border-slate-200 shadow-xs object-contain"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: KIỂM TRA XUNG ĐỘT LỊCH THỜI GIAN THỰC & ĐIỀU CHỈNH SÂN / GIỜ */}
      {showScheduleConflictModal && editingScheduleMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full max-h-[90dvh] overflow-hidden shadow-2xl text-slate-900 flex flex-col">
            <div className="px-4 sm:px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <AlertTriangle
                  className={`w-5 h-5 shrink-0 ${
                    allScheduleConflicts.length > 0 ? 'text-rose-600' : 'text-emerald-600'
                  }`}
                />
                <div className="min-w-0">
                  <h3 className="font-display text-base sm:text-lg font-bold text-slate-900 uppercase truncate">
                    Kiểm tra Xung đột Sân &amp; Thời gian
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Phát hiện thời gian thực các cặp trận trùng sân, sát giờ (&lt;20 phút) hoặc trùng đội
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowScheduleConflictModal(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200/60 shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto text-xs">
              {/* Active Real-Time Conflict List */}
              {allScheduleConflicts.length === 0 ? (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <div className="font-bold">Lịch thi đấu hiện tại an toàn</div>
                    <div className="text-[11px] text-emerald-700 mt-0.5">
                      Không phát hiện trận nào bị trùng sân, đang đấu song song cùng sân hay trùng giờ của cùng một đội.
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="font-bold text-rose-700 flex items-center justify-between">
                    <span>
                      Đang phát hiện {allScheduleConflicts.length} xung đột lịch cần xử lý:
                    </span>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {allScheduleConflicts.map((cf) => (
                      <div
                        key={cf.id}
                        className={`p-3 rounded-xl border space-y-2 ${
                          cf.severity === 'critical'
                            ? 'bg-rose-50 border-rose-200 text-rose-950'
                            : 'bg-amber-50 border-amber-200 text-amber-950'
                        }`}
                      >
                        <div className="font-semibold leading-relaxed">{cf.message}</div>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                          <span className="font-mono-num text-slate-600">
                            #{cf.matchA.matchNumber} ({cf.matchA.teamAName} vs {cf.matchA.teamBName}) ↔ #
                            {cf.matchB.matchNumber} ({cf.matchB.teamAName} vs {cf.matchB.teamBName})
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openScheduleEditor(cf.matchB)}
                              className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 font-semibold"
                            >
                              Sửa #{cf.matchB.matchNumber}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAutoResolveConflict(cf.matchB)}
                              className="px-2.5 py-1 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-bold"
                            >
                              Tự dời #{cf.matchB.matchNumber} sang ô trống
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Live Court & Time Editor with Real-time Conflict Preview */}
              <form
                onSubmit={handleSaveScheduleAdjustment}
                className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-slate-900">
                    Điều chỉnh Sân &amp; Giờ cho Trận đấu
                  </span>
                  <select
                    value={editingScheduleMatch.id}
                    onChange={(e) => {
                      const next = matches.find((m) => m.id === e.target.value);
                      if (next) {
                        setEditingScheduleMatchId(next.id);
                        setDraftCourtNumber(next.courtNumber);
                        setDraftScheduledTime(next.scheduledTime || '08:00');
                      }
                    }}
                    className="max-w-xs px-2.5 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg bg-white"
                  >
                    {matches.map((m) => (
                      <option key={`sched-${m.id}`} value={m.id}>
                        #{m.matchNumber} · Sân {m.courtNumber} ({m.scheduledTime}) · {m.teamAName} vs{' '}
                        {m.teamBName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Chọn Sân thi đấu
                    </label>
                    <select
                      value={draftCourtNumber}
                      onChange={(e) => setDraftCourtNumber(Number(e.target.value))}
                      className="w-full min-h-[40px] px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg bg-white font-mono-num"
                    >
                      {Array.from(
                        { length: Math.max(1, tournament.courtsCount || 4) },
                        (_, idx) => idx + 1,
                      ).map((courtNum) => (
                        <option key={`court-opt-${courtNum}`} value={courtNum}>
                          Sân {courtNum}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Khung giờ dự kiến (HH:MM)
                    </label>
                    <input
                      type="time"
                      value={draftScheduledTime}
                      onChange={(e) => setDraftScheduledTime(e.target.value)}
                      className="w-full min-h-[40px] px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg bg-white font-mono-num"
                    />
                  </div>
                </div>

                {/* Real-time preview status for the edited match */}
                {draftScheduleConflicts.length > 0 ? (
                  <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>Cảnh báo thời gian thực: Lựa chọn này bị trùng lịch!</span>
                    </div>
                    {draftScheduleConflicts.map((cf) => (
                      <div key={`draft-${cf.id}`} className="text-[11px]">
                        • {cf.message}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-1.5 font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      Sân {draftCourtNumber} lúc {draftScheduledTime} không có xung đột lịch.
                    </span>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const nextFree = findNextAvailableCourtSlot(
                        editingScheduleMatch,
                        matches,
                        tournament.courtsCount,
                      );
                      setDraftCourtNumber(nextFree.courtNumber);
                      setDraftScheduledTime(nextFree.scheduledTime);
                    }}
                    className="min-h-[38px] px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold"
                  >
                    Gợi ý Sân/Giờ trống
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowScheduleConflictModal(false)}
                      className="min-h-[38px] px-3.5 py-1.5 rounded-lg text-slate-600 hover:bg-slate-200/70 font-semibold"
                    >
                      Đóng
                    </button>
                    <button
                      type="submit"
                      className="min-h-[38px] px-4 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-bold"
                    >
                      Lưu Sân &amp; Giờ
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
