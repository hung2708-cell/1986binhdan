/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Bell,
  Calendar,
  CheckCircle2,
  Gavel,
  LayoutDashboard,
  LogIn,
  MapPin,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trophy,
  UserPlus,
  Users,
} from 'lucide-react';
import { AnalyticsReportView } from './components/AnalyticsReportView';
import { CreateTournamentModal } from './components/CreateTournamentModal';
import { MembersAndPaymentsView } from './components/MembersAndPaymentsView';
import { RefereeConsoleView } from './components/RefereeConsoleView';
import { ScheduleAndStandingsView } from './components/ScheduleAndStandingsView';
import { StaffAuthModal } from './components/StaffAuthModal';
import {
  INITIAL_MATCHES,
  INITIAL_NOTIFICATIONS,
  INITIAL_REGISTRATIONS,
  INITIAL_STAFF_ACCOUNTS,
  INITIAL_TOURNAMENTS,
  INITIAL_USERS,
} from './data/seedData';
import {
  BRAND_LOGO_URL,
  FORMAT_LABELS,
  MATCH_STAGE_LABELS,
  ROLE_LABELS,
  TOURNAMENT_STATUS_LABELS,
  type AppNotification,
  type Match,
  type Registration,
  type StaffAccount,
  type Tournament,
  type UserProfile,
} from './types/tournament';
import {
  buildGroupAndKnockoutSchedule,
  computeGroupStandings,
  createDefaultTeamLineupSlots,
  formatScoreCallout,
  isTeamDivision,
} from './utils/pickleballEngine';
import { generatePaymentCode } from './utils/vietqr';

type ActiveTab =
  | 'overview'
  | 'schedule'
  | 'referee'
  | 'standings'
  | 'members'
  | 'reports';

const STORAGE_KEY = 'pickleball_1986_state_v6';
const AUTH_SESSION_KEY = 'pickleball_1986_auth_user_v1';
const ACTIVE_TAB_KEY = 'pickleball_1986_active_tab_v1';
const SYNC_CHANNEL = 'pickleball_1986_realtime_channel';

const VALID_TABS: ActiveTab[] = [
  'overview',
  'schedule',
  'referee',
  'standings',
  'members',
  'reports',
];

interface PersistedAppState {
  tournaments: Tournament[];
  registrations: Registration[];
  matches: Match[];
  notifications: AppNotification[];
  users: UserProfile[];
  staffAccounts: StaffAccount[];
}

function isStaffRole(role: unknown): role is 'admin' | 'referee' {
  return role === 'admin' || role === 'referee';
}

function loadSavedActiveTab(): ActiveTab {
  try {
    const saved = localStorage.getItem(ACTIVE_TAB_KEY) as ActiveTab | null;
    if (saved && VALID_TABS.includes(saved)) {
      return saved;
    }
  } catch {
    // ignore storage errors
  }
  return 'overview';
}

function loadInitialState(): PersistedAppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PersistedAppState;
      if (parsed.tournaments?.length > 0) {
        const validStaff = Array.isArray(parsed.staffAccounts)
          ? parsed.staffAccounts.filter((acc) => isStaffRole(acc?.role))
          : [];
        return {
          ...parsed,
          staffAccounts: validStaff.length > 0 ? validStaff : INITIAL_STAFF_ACCOUNTS,
        };
      }
    }
  } catch (err) {
    console.warn('Could not read saved state, using seed data:', err);
  }
  return {
    tournaments: INITIAL_TOURNAMENTS,
    registrations: INITIAL_REGISTRATIONS,
    matches: INITIAL_MATCHES,
    notifications: INITIAL_NOTIFICATIONS,
    users: INITIAL_USERS,
    staffAccounts: INITIAL_STAFF_ACCOUNTS,
  };
}

function loadSavedAuthAccount(accounts: StaffAccount[]): StaffAccount | null {
  try {
    const savedId = localStorage.getItem(AUTH_SESSION_KEY);
    if (!savedId) return null;
    const found = accounts.find((a) => a.id === savedId) || null;
    if (!found || !isStaffRole(found.role)) {
      return null;
    }
    return found;
  } catch {
    return null;
  }
}

export default function App() {
  const [appState, setAppState] = useState<PersistedAppState>(() => loadInitialState());
  const [currentAccount, setCurrentAccount] = useState<StaffAccount | null>(() =>
    loadSavedAuthAccount(loadInitialState().staffAccounts),
  );
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'manage'>('login');
  const [authReasonMessage, setAuthReasonMessage] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<ActiveTab>(() => loadSavedActiveTab());
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>(
    () => loadInitialState().tournaments[0]?.id || 't_1986_binh_dan_open',
  );
  const [selectedRefereeMatchId, setSelectedRefereeMatchId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showNotifDrawer, setShowNotifDrawer] = useState(false);
  const [readNotifIds, setReadNotifIds] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<{ title: string; subtitle: string } | null>(
    null,
  );

  const isAdmin = currentAccount?.role === 'admin';

  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_TAB_KEY, activeTab);
    } catch {
      // ignore storage errors
    }
  }, [activeTab]);

  const openLoginWithReason = (reason: string, mode: 'login' | 'manage' = 'login') => {
    setAuthReasonMessage(reason);
    setAuthModalMode(mode);
    setShowAuthModal(true);
  };

  // Save state to localStorage and broadcast across browser tabs for instant live scoreboard sync
  const updateStateAndSync = (updater: (prev: PersistedAppState) => PersistedAppState) => {
    setAppState((prev) => {
      const next = updater(prev);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        if (typeof BroadcastChannel !== 'undefined') {
          const bc = new BroadcastChannel(SYNC_CHANNEL);
          bc.postMessage(next);
          bc.close();
        }
      } catch (e) {
        console.warn('State persistence warning:', e);
      }
      return next;
    });
  };

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const bc = new BroadcastChannel(SYNC_CHANNEL);
    bc.onmessage = (event) => {
      if (event.data && event.data.tournaments) {
        setAppState(event.data as PersistedAppState);
      }
    };
    return () => bc.close();
  }, []);

  // Lock webpage zoom so zooming is ONLY possible inside the 2D Bracket Diagram
  useEffect(() => {
    const preventMultiTouchPageZoom = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    const preventSafariGestureZoom = (e: Event) => {
      e.preventDefault();
    };

    const preventCtrlWheelPageZoom = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    };

    document.addEventListener('touchmove', preventMultiTouchPageZoom, { passive: false });
    document.addEventListener('gesturestart', preventSafariGestureZoom, { passive: false });
    document.addEventListener('gesturechange', preventSafariGestureZoom, { passive: false });
    document.addEventListener('wheel', preventCtrlWheelPageZoom, { passive: false });

    return () => {
      document.removeEventListener('touchmove', preventMultiTouchPageZoom);
      document.removeEventListener('gesturestart', preventSafariGestureZoom);
      document.removeEventListener('gesturechange', preventSafariGestureZoom);
      document.removeEventListener('wheel', preventCtrlWheelPageZoom);
    };
  }, []);

  const showToast = (title: string, subtitle: string) => {
    setToastMessage({ title, subtitle });
    window.setTimeout(() => {
      setToastMessage((curr) => (curr?.title === title ? null : curr));
    }, 4200);
  };

  const handleLoginSuccess = (account: StaffAccount) => {
    if (!isStaffRole(account.role)) {
      showToast(
        'Từ chối đăng nhập',
        'Hệ thống chỉ cho phép tài khoản Ban Tổ Chức (Admin) hoặc Trọng tài đăng nhập.',
      );
      return;
    }
    setCurrentAccount(account);
    try {
      localStorage.setItem(AUTH_SESSION_KEY, account.id);
    } catch {
      // ignore storage errors
    }
    setShowAuthModal(false);
    setAuthReasonMessage(null);
    showToast(
      `Đăng nhập thành công: ${account.displayName}`,
      `Quyền hạn: ${ROLE_LABELS[account.role]} (${account.assignedCourts || 'Toàn hệ thống'})`,
    );
  };

  const handleLogout = () => {
    const prevName = currentAccount?.displayName;
    setCurrentAccount(null);
    try {
      localStorage.removeItem(AUTH_SESSION_KEY);
    } catch {
      // ignore
    }
    setShowAuthModal(false);
    setAuthReasonMessage(null);
    if (prevName) {
      showToast('Đã đăng xuất tài khoản', `Tạm biệt ${prevName}. Phiên làm việc đã kết thúc.`);
    }
  };

  const handleCreateStaffAccount = (payload: Omit<StaffAccount, 'id'>) => {
    if (!isAdmin || !currentAccount) {
      openLoginWithReason(
        'Chỉ tài khoản Ban Tổ Chức (Admin) mới được phép tạo tài khoản Admin hoặc Trọng tài.',
      );
      return;
    }
    if (!isStaffRole(payload.role)) {
      showToast('Vai trò không hợp lệ', 'Chỉ có thể tạo tài khoản Admin hoặc Trọng tài.');
      return;
    }
    const newAccount: StaffAccount = {
      ...payload,
      role: payload.role,
      id: `acc_${Date.now().toString(36)}`,
    };
    updateStateAndSync((prev) => ({
      ...prev,
      staffAccounts: [...prev.staffAccounts, newAccount],
    }));
    showToast(
      `Đã tạo tài khoản ${ROLE_LABELS[newAccount.role]}`,
      `${newAccount.displayName} (Tên ĐN: ${newAccount.username})`,
    );
  };

  const handleDeleteStaffAccount = (accountId: string) => {
    if (!isAdmin || !currentAccount) {
      openLoginWithReason('Chỉ tài khoản Ban Tổ Chức (Admin) mới được phép xóa tài khoản.');
      return;
    }
    if (currentAccount.id === accountId) {
      showToast(
        'Không thể tự xóa tài khoản',
        'Bạn không thể xóa tài khoản đang đăng nhập của chính mình.',
      );
      return;
    }
    const target = appState.staffAccounts.find((a) => a.id === accountId);
    updateStateAndSync((prev) => ({
      ...prev,
      staffAccounts: prev.staffAccounts.filter((a) => a.id !== accountId),
    }));
    if (target) {
      showToast('Đã xóa tài khoản', `Đã gỡ tài khoản ${target.displayName} (${target.username}).`);
    }
  };

  const currentTournament = useMemo(() => {
    return (
      appState.tournaments.find((t) => t.id === selectedTournamentId) ||
      appState.tournaments[0]
    );
  }, [appState.tournaments, selectedTournamentId]);

  const tournamentRegistrations = useMemo(
    () =>
      appState.registrations.filter(
        (r) => r.tournamentId === currentTournament?.id,
      ),
    [appState.registrations, currentTournament],
  );

  const tournamentMatches = useMemo(
    () =>
      appState.matches
        .filter((m) => m.tournamentId === currentTournament?.id)
        .sort((a, b) => a.matchNumber - b.matchNumber),
    [appState.matches, currentTournament],
  );

  const tournamentNotifications = useMemo(
    () =>
      appState.notifications.filter(
        (n) => n.tournamentId === currentTournament?.id,
      ),
    [appState.notifications, currentTournament],
  );

  const unreadCount = useMemo(
    () =>
      tournamentNotifications.filter((n) => !readNotifIds.includes(n.id)).length,
    [tournamentNotifications, readNotifIds],
  );

  const liveMatches = useMemo(
    () => tournamentMatches.filter((m) => m.status === 'live'),
    [tournamentMatches],
  );

  const standingsPreview = useMemo(
    () =>
      computeGroupStandings(
        tournamentRegistrations,
        tournamentMatches,
        currentTournament?.divisions[0],
      ),
    [tournamentRegistrations, tournamentMatches, currentTournament],
  );

  const pushNotification = (
    type: AppNotification['type'],
    title: string,
    message: string,
    matchId = '',
  ) => {
    const newNotif: AppNotification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      tournamentId: currentTournament.id,
      targetUid: 'all',
      type,
      title,
      message,
      matchId,
      createdBy: currentAccount?.id || 'u_admin_1986',
    };
    updateStateAndSync((prev) => ({
      ...prev,
      notifications: [newNotif, ...prev.notifications],
    }));
    showToast(title, message);
  };

  const handleOpenCreateTournament = () => {
    if (!isAdmin) {
      openLoginWithReason(
        'Vui lòng đăng nhập tài khoản Ban Tổ Chức (Admin) để khởi tạo giải đấu mới.',
      );
      return;
    }
    setShowCreateModal(true);
  };

  const handleCreateTournament = (
    payload: Omit<Tournament, 'id' | 'createdAt' | 'updatedAt'>,
  ) => {
    const newId = `t_1986_${Date.now().toString(36)}`;
    const created: Tournament = {
      ...payload,
      id: newId,
    };
    updateStateAndSync((prev) => ({
      ...prev,
      tournaments: [created, ...prev.tournaments],
    }));
    setSelectedTournamentId(newId);
    showToast(
      `Đã tạo giải: ${created.name}`,
      `Quy mô ${created.courtsCount} sân · Đã sẵn sàng nhập VĐV và xếp bảng`,
    );
  };

  const handleAddDivision = (divisionName: string, compType: 'doubles' | 'team') => {
    if (!isAdmin || !currentAccount) {
      openLoginWithReason(
        'Phải đăng nhập tài khoản Admin mới có thể thêm nội dung Đôi hoặc Đồng đội.',
      );
      return;
    }
    const cleanName = divisionName.trim();
    if (!cleanName) return;
    const normalized =
      compType === 'team' && !cleanName.toLowerCase().includes('đồng đội')
        ? `Đồng Đội - ${cleanName}`
        : compType === 'doubles' && !cleanName.toLowerCase().includes('đôi')
        ? `Đôi - ${cleanName}`
        : cleanName;

    updateStateAndSync((prev) => ({
      ...prev,
      tournaments: prev.tournaments.map((t) => {
        if (t.id !== currentTournament.id) return t;
        if (t.divisions.includes(normalized)) return t;
        return {
          ...t,
          divisions: [...t.divisions, normalized],
        };
      }),
    }));
    showToast(
      `Đã thêm nội dung: ${normalized}`,
      `Hình thức: ${compType === 'team' ? 'Đồng đội' : 'Đôi'} · Người tạo: ${currentAccount.displayName}`,
    );
  };

  const handleAddRegistration = (payload: {
    division: string;
    player1Name: string;
    player2Name: string;
    club: string;
    combinedRating: number;
    groupName?: string;
    squadRoster?: string[];
  }) => {
    if (!isAdmin || !currentAccount) {
      openLoginWithReason(
        'Phải đăng nhập tài khoản Admin mới có thể thêm VĐV/đội và sắp xếp bảng.',
      );
      return;
    }

    const teamName = payload.player2Name
      ? `${payload.player1Name} / ${payload.player2Name}`
      : payload.player1Name;
    const assignedGroup = (payload.groupName || 'Bảng A').trim() || 'Bảng A';
    const paymentCode = generatePaymentCode('1986');
    const newReg: Registration = {
      id: `reg_${Date.now().toString(36)}`,
      tournamentId: currentTournament.id,
      ownerUid: currentAccount.id,
      division: payload.division,
      teamName,
      player1Name: payload.player1Name,
      player2Name: payload.player2Name,
      squadRoster:
        payload.squadRoster || [payload.player1Name, payload.player2Name].filter(Boolean),
      club: payload.club,
      combinedRating: payload.combinedRating,
      groupName: assignedGroup,
      seed: tournamentRegistrations.length + 1,
      checkedIn: true,
      feeAmount: 0,
      paymentCode,
      paymentStatus: 'paid',
      transferRef: '',
      visibility: 'public',
    };

    updateStateAndSync((prev) => ({
      ...prev,
      registrations: [newReg, ...prev.registrations],
    }));
    showToast(
      `Đã thêm VĐV/Đội: ${teamName}`,
      `Xếp vào ${assignedGroup} · Nội dung: ${payload.division}`,
    );
  };

  const handleAssignRegistrationGroup = (registrationId: string, groupName: string) => {
    if (!isAdmin || !currentAccount) {
      openLoginWithReason(
        'Chỉ tài khoản Ban Tổ Chức (Admin) mới có quyền sắp xếp hoặc đổi bảng cho VĐV/đội.',
      );
      return;
    }
    const cleanGroup = groupName.trim() || 'Bảng A';
    updateStateAndSync((prev) => ({
      ...prev,
      registrations: prev.registrations.map((r) =>
        r.id === registrationId ? { ...r, groupName: cleanGroup } : r,
      ),
    }));
    showToast('Đã cập nhật bảng thi đấu', `Đã chuyển đội sang ${cleanGroup}.`);
  };

  const handleAddRosterAthlete = (registrationId: string, athleteLabel: string) => {
    if (!isAdmin || !currentAccount) {
      openLoginWithReason(
        'Chỉ tài khoản Admin mới có quyền thêm VĐV vào danh sách đội hình Đồng đội hoặc Đôi.',
      );
      return;
    }
    updateStateAndSync((prev) => ({
      ...prev,
      registrations: prev.registrations.map((r) => {
        if (r.id !== registrationId) return r;
        const current = r.squadRoster || [r.player1Name, r.player2Name].filter(Boolean);
        return {
          ...r,
          squadRoster: Array.from(new Set([...current, athleteLabel])),
        };
      }),
    }));
    showToast('Đã thêm VĐV vào đội hình', `Bổ sung ${athleteLabel} vào danh sách ra sân.`);
  };

  const handleToggleCheckIn = (registrationId: string) => {
    if (!currentAccount || !isStaffRole(currentAccount.role)) {
      openLoginWithReason(
        'Vui lòng đăng nhập tài khoản Trọng tài hoặc Ban Tổ Chức để điểm danh Check-in VĐV.',
      );
      return;
    }
    updateStateAndSync((prev) => ({
      ...prev,
      registrations: prev.registrations.map((r) =>
        r.id === registrationId ? { ...r, checkedIn: !r.checkedIn } : r,
      ),
    }));
  };

  const handleGenerateSchedule = (division: string) => {
    if (!isAdmin) {
      openLoginWithReason(
        'Chỉ tài khoản Ban Tổ Chức (Admin) mới có quyền xếp lịch thi đấu từ các bảng đã chia.',
      );
      return;
    }

    const divTeams = tournamentRegistrations.filter((r) => r.division === division);
    if (divTeams.length < 2) {
      showToast(
        'Chưa đủ đội để xếp lịch',
        `Nội dung ${division} cần tối thiểu 2 đội đã nhập và xếp bảng.`,
      );
      return;
    }

    const otherDivMatches = tournamentMatches.filter((m) => m.division !== division);
    const { groupAssignments, matches: generated } = buildGroupAndKnockoutSchedule({
      tournamentId: currentTournament.id,
      division,
      teams: divTeams,
      courtsCount: currentTournament.courtsCount,
      scoringMode: currentTournament.scoringMode,
      pointsToWin: currentTournament.pointsToWin,
      winByTwo: currentTournament.winByTwo,
      includeKnockout: currentTournament.format !== 'round_robin',
      startMatchNumber: otherDivMatches.length + 1,
    });

    const fullMatches: Match[] = generated.map((g, idx) => {
      const regA = divTeams.find((r) => r.id === g.teamAId);
      const regB = divTeams.find((r) => r.id === g.teamBId);
      const isTeam = isTeamDivision(division, g.competitionType);
      const defaultSlots = isTeam
        ? createDefaultTeamLineupSlots(regA?.squadRoster, regB?.squadRoster)
        : undefined;
      return {
        ...g,
        tournamentId: currentTournament.id,
        competitionType: isTeam ? 'team' : 'doubles',
        teamSubCategory: isTeam ? 'Trận 1: Đôi Nữ' : division,
        teamLineupSlots: defaultSlots,
        activeSlotOrder: 1,
        teamAPlayer1: defaultSlots ? defaultSlots[0].teamAPlayer1 : regA?.player1Name || '',
        teamAPlayer2: defaultSlots ? defaultSlots[0].teamAPlayer2 : regA?.player2Name || '',
        teamBPlayer1: defaultSlots ? defaultSlots[0].teamBPlayer1 : regB?.player1Name || '',
        teamBPlayer2: defaultSlots ? defaultSlots[0].teamBPlayer2 : regB?.player2Name || '',
        courtSideA: 'left',
        refereeUid: idx % 2 === 0 ? 'u_ref_01' : 'u_ref_02',
        refereeName: idx % 2 === 0 ? 'Trần Quốc Tuấn' : 'Lê Hoàng Nam',
        status: 'scheduled',
        scoreA: 0,
        scoreB: 0,
        servingTeam: 'A',
        serverNumber: 2,
        timeoutsA: 0,
        timeoutsB: 0,
        sideSwitched: false,
        winnerTeamId: '',
        winnerSide: '',
        startedAtMs: 0,
        durationSeconds: 0,
        scoreHistory: [],
        visibility: 'public',
      };
    });

    updateStateAndSync((prev) => ({
      ...prev,
      registrations: prev.registrations.map((reg) => {
        const assign = groupAssignments.find((a) => a.registrationId === reg.id);
        return assign
          ? { ...reg, groupName: reg.groupName || assign.groupName, seed: assign.seed }
          : reg;
      }),
      matches: [
        ...prev.matches.filter(
          (m) => !(m.tournamentId === currentTournament.id && m.division === division),
        ),
        ...fullMatches,
      ],
    }));

    pushNotification(
      'schedule_update',
      `Đã xếp lịch thi đấu ${division}`,
      `Hệ thống đã tạo ${fullMatches.length} trận đấu phân bổ trên ${currentTournament.courtsCount} sân.`,
    );
  };

  const handleSyncKnockoutFromGroups = (division: string) => {
    if (!isAdmin) {
      openLoginWithReason(
        'Chỉ tài khoản Ban Tổ Chức mới có quyền cập nhật đội Nhất/Nhì bảng vào nhánh Bán kết.',
      );
      return;
    }

    const standings = computeGroupStandings(
      tournamentRegistrations,
      tournamentMatches,
      division,
    );
    const groupA = standings['Bảng A'] || [];
    const groupB = standings['Bảng B'] || [];

    if (groupA.length < 2 && groupB.length < 2) {
      showToast('Chưa đủ dữ liệu vòng bảng', 'Vui lòng hoàn tất các trận vòng bảng trước.');
      return;
    }

    updateStateAndSync((prev) => ({
      ...prev,
      matches: prev.matches.map((m) => {
        if (m.tournamentId !== currentTournament.id || m.division !== division) {
          return m;
        }
        if (m.stage === 'semifinal' && m.bracketSlot === 'SF1') {
          const team1 = groupA[0];
          const team2 = groupB[1] || groupA[3];
          return {
            ...m,
            teamAId: team1?.teamId || m.teamAId,
            teamAName: team1 ? `Nhất A (${team1.teamName})` : m.teamAName,
            teamBId: team2?.teamId || m.teamBId,
            teamBName: team2 ? `Nhì B (${team2.teamName})` : m.teamBName,
          };
        }
        if (m.stage === 'semifinal' && m.bracketSlot === 'SF2') {
          const team1 = groupB[0] || groupA[1];
          const team2 = groupA[1] || groupA[2];
          return {
            ...m,
            teamAId: team1?.teamId || m.teamAId,
            teamAName: team1 ? `Nhất B (${team1.teamName})` : m.teamAName,
            teamBId: team2?.teamId || m.teamBId,
            teamBName: team2 ? `Nhì A (${team2.teamName})` : m.teamBName,
          };
        }
        return m;
      }),
    }));

    showToast(
      `Đã cập nhật nhánh Bán kết ${division}`,
      'Các đội Nhất/Nhì bảng đã được điền tự động vào lịch thi đấu Bán kết.',
    );
  };

  const handleUpdateMatch = (matchId: string, patch: Partial<Match>) => {
    updateStateAndSync((prev) => ({
      ...prev,
      matches: prev.matches.map((m) => (m.id === matchId ? { ...m, ...patch } : m)),
    }));
  };

  const handleCompleteMatch = (match: Match, winnerSide: '' | 'A' | 'B') => {
    const winnerTeamId =
      winnerSide === 'A' ? match.teamAId : winnerSide === 'B' ? match.teamBId : '';
    const winnerTeamName =
      winnerSide === 'A'
        ? match.teamAName
        : winnerSide === 'B'
        ? match.teamBName
        : 'Hòa 2-2';
    const loserTeamId =
      winnerSide === 'A' ? match.teamBId : winnerSide === 'B' ? match.teamAId : '';
    const loserTeamName =
      winnerSide === 'A' ? match.teamBName : winnerSide === 'B' ? match.teamAName : '';

    updateStateAndSync((prev) => ({
      ...prev,
      matches: prev.matches.map((m) => {
        if (m.id === match.id) {
          return {
            ...m,
            ...match,
            status: 'completed',
            winnerSide,
            winnerTeamId,
            durationSeconds: match.durationSeconds || 960,
          };
        }
        if (winnerSide && match.nextMatchId && m.id === match.nextMatchId) {
          if (match.nextMatchSide === 'A') {
            return { ...m, teamAId: winnerTeamId, teamAName: winnerTeamName };
          }
          if (match.nextMatchSide === 'B') {
            return { ...m, teamBId: winnerTeamId, teamBName: winnerTeamName };
          }
        }
        if (
          winnerSide &&
          match.stage === 'semifinal' &&
          m.tournamentId === match.tournamentId &&
          m.division === match.division &&
          m.stage === 'third_place'
        ) {
          if (match.bracketSlot === 'SF1') {
            return { ...m, teamAId: loserTeamId, teamAName: loserTeamName };
          }
          if (match.bracketSlot === 'SF2') {
            return { ...m, teamBId: loserTeamId, teamBName: loserTeamName };
          }
        }
        return m;
      }),
    }));

    pushNotification(
      'match_result',
      `Kết quả Trận #${match.matchNumber} (Sân ${match.courtNumber}): ${match.scoreA} - ${match.scoreB}`,
      winnerSide
        ? `${winnerTeamName} giành chiến thắng (+3đ) trước ${loserTeamName} tại ${
            match.groupName || MATCH_STAGE_LABELS[match.stage]
          }. Bảng xếp hạng đã được cập nhật.`
        : `Hai đội ${match.teamAName} và ${match.teamBName} hòa 2-2 (+2đ mỗi đội) tại ${match.groupName}.`,
      match.id,
    );
  };

  const handleAnnounceCourtCall = (match: Match) => {
    pushNotification(
      'court_call',
      `Mời VĐV vào Sân ${match.courtNumber} — Trận #${match.matchNumber}`,
      `${match.teamAName} gặp ${match.teamBName} (${match.teamSubCategory || match.division} · ${
        match.groupName || MATCH_STAGE_LABELS[match.stage]
      }). Trọng tài: ${currentAccount?.displayName || match.refereeName || 'BTC 1986'}.`,
      match.id,
    );
  };

  const handleAnnounceCourtAvailable = (finishedMatch: Match) => {
    const waitingMatches = tournamentMatches
      .filter((m) => m.id !== finishedMatch.id && m.status === 'scheduled')
      .sort((a, b) => {
        const aSameCourt = a.courtNumber === finishedMatch.courtNumber ? 0 : 1;
        const bSameCourt = b.courtNumber === finishedMatch.courtNumber ? 0 : 1;
        if (aSameCourt !== bSameCourt) return aSameCourt - bSameCourt;
        return a.matchNumber - b.matchNumber;
      });

    const nextMatch = waitingMatches[0];
    if (!nextMatch) {
      pushNotification(
        'court_call',
        `Sân ${finishedMatch.courtNumber} đã trống (Xong Trận #${finishedMatch.matchNumber})`,
        `Trận #${finishedMatch.matchNumber} (${finishedMatch.teamAName} vs ${finishedMatch.teamBName}) đã kết thúc và Sân ${finishedMatch.courtNumber} đã sẵn sàng. Hiện không còn trận nào trong danh sách chờ.`,
        finishedMatch.id,
      );
      return;
    }

    const waitingAthletes = [
      nextMatch.teamAPlayer1,
      nextMatch.teamAPlayer2,
      nextMatch.teamBPlayer1,
      nextMatch.teamBPlayer2,
    ]
      .filter(Boolean)
      .join(', ');

    const followUpList = waitingMatches
      .slice(1, 3)
      .map((m) => `#${m.matchNumber} (${m.teamAName} vs ${m.teamBName})`)
      .join(' · ');

    pushNotification(
      'court_call',
      `SÂN ${finishedMatch.courtNumber} ĐÃ TRỐNG — Mời VĐV chờ vào sân!`,
      `Trận #${finishedMatch.matchNumber} vừa kết thúc. Mời các VĐV chờ Trận #${nextMatch.matchNumber}: ${nextMatch.teamAName} vs ${nextMatch.teamBName}${
        waitingAthletes ? ` (${waitingAthletes})` : ''
      } vào Sân ${finishedMatch.courtNumber} chuẩn bị thi đấu.${
        followUpList ? ` Danh sách chờ tiếp: ${followUpList}.` : ''
      }`,
      nextMatch.id,
    );
  };

  const handleResetDemoData = () => {
    localStorage.removeItem(STORAGE_KEY);
    const fresh: PersistedAppState = {
      tournaments: INITIAL_TOURNAMENTS,
      registrations: INITIAL_REGISTRATIONS,
      matches: INITIAL_MATCHES,
      notifications: INITIAL_NOTIFICATIONS,
      users: INITIAL_USERS,
      staffAccounts: INITIAL_STAFF_ACCOUNTS,
    };
    setAppState(fresh);
    setSelectedTournamentId(fresh.tournaments[0].id);
    showToast(
      'Đã làm mới dữ liệu giải 1986',
      'Danh sách VĐV/đội đã được làm mới. Bạn có thể tự nhập VĐV và sắp xếp bảng thi đấu.',
    );
  };

  const navItems: Array<{
    id: ActiveTab;
    label: string;
    shortLabel: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'overview',
      label: 'Trang chủ & Live',
      shortLabel: 'Trang chủ',
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      id: 'schedule',
      label: 'Lịch & Nhánh đấu',
      shortLabel: 'Lịch đấu',
      icon: <Calendar className="w-4 h-4" />,
    },
    {
      id: 'referee',
      label: 'Trọng tài (Sân)',
      shortLabel: 'Trọng tài',
      icon: <Gavel className="w-4 h-4" />,
    },
    {
      id: 'standings',
      label: 'Bảng xếp hạng',
      shortLabel: 'BXH',
      icon: <Trophy className="w-4 h-4" />,
    },
    {
      id: 'members',
      label: 'VĐV & Sắp bảng',
      shortLabel: 'VĐV/Bảng',
      icon: <Users className="w-4 h-4" />,
    },
    {
      id: 'reports',
      label: 'Báo cáo & Xuất file',
      shortLabel: 'Báo cáo',
      icon: <BarChart3 className="w-4 h-4" />,
    },
  ];

  return (
    <div
      className={
        activeTab === 'referee'
          ? 'h-[100dvh] flex flex-col bg-slate-950 text-[#0F172A] overflow-hidden pb-11 sm:pb-12 lg:pb-0'
          : 'min-h-screen flex flex-col bg-[#F8FAFC] text-[#0F172A] pb-16 lg:pb-0'
      }
    >
      {/* TOP BAR CONTRACT */}
      <header
        className={`no-print sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-slate-200 px-3 sm:px-6 shrink-0 flex items-center justify-between gap-2 sm:gap-8 ${
          activeTab === 'referee' ? 'h-10 sm:h-12 hide-on-mobile-landscape' : 'h-12 sm:h-14'
        }`}
      >
        <a
          href="#overview"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('overview');
          }}
          className="flex items-center gap-2 sm:gap-2.5 shrink-0 group"
        >
          <img
            src={BRAND_LOGO_URL}
            alt="Logo 1986 Bính Dần Pickleball"
            referrerPolicy="no-referrer"
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg object-cover border border-orange-400 shadow-2xs shrink-0"
          />
          <span className="font-display text-lg sm:text-2xl font-extrabold tracking-tight text-slate-900 group-hover:text-orange-600 transition-colors whitespace-nowrap">
            1986 PICKLEBALL
          </span>
        </a>

        <nav className="hidden lg:flex items-center gap-5 xl:gap-6 text-sm font-medium text-slate-600">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                activeTab === item.id
                  ? 'border-orange-600 text-slate-900 font-semibold'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          {currentAccount ? (
            <button
              type="button"
              onClick={() => {
                setAuthReasonMessage(null);
                setAuthModalMode(isAdmin ? 'manage' : 'login');
                setShowAuthModal(true);
              }}
              className={`px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                isAdmin
                  ? 'bg-orange-600 hover:bg-orange-700 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              {isAdmin ? <ShieldCheck className="w-4 h-4 shrink-0" /> : <Gavel className="w-4 h-4 shrink-0" />}
              <span className="truncate max-w-[130px] sm:max-w-none">
                {isAdmin ? 'BTC' : 'TT'}: {currentAccount.displayName}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setAuthReasonMessage(null);
                setAuthModalMode('login');
                setShowAuthModal(true);
              }}
              className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
            >
              <LogIn className="w-4 h-4 shrink-0" />
              <span className="sm:hidden">Đăng nhập</span>
              <span className="hidden sm:inline">Đăng nhập Admin / Trọng tài</span>
            </button>
          )}
        </div>
      </header>

      {/* Secondary Workspace Context Toolbar */}
      <div
        className={`no-print bg-white border-b border-slate-200 px-2.5 sm:px-6 py-2 shrink-0 ${
          activeTab === 'referee' ? 'hidden' : ''
        }`}
      >
        <div className="max-w-7xl mx-auto flex flex-wrap sm:flex-nowrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <select
              value={currentTournament.id}
              onChange={(e) => setSelectedTournamentId(e.target.value)}
              className="min-h-[36px] w-full sm:w-auto flex-1 sm:flex-initial px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200/70 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 max-w-full sm:max-w-md truncate"
            >
              {appState.tournaments.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({TOURNAMENT_STATUS_LABELS[t.status]})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleOpenCreateTournament}
              className="min-h-[34px] px-2.5 py-1 text-xs font-bold text-white bg-slate-900 hover:bg-orange-600 rounded-lg transition-colors flex items-center gap-1 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tạo giải mới</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowNotifDrawer((s) => !s);
                setReadNotifIds(tournamentNotifications.map((n) => n.id));
              }}
              className="min-h-[34px] px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1 whitespace-nowrap"
            >
              <Bell className="w-3.5 h-3.5 text-orange-600" />
              <span>{unreadCount > 0 ? `${unreadCount} mới` : tournamentNotifications.length}</span>
            </button>

            <button
              type="button"
              onClick={handleResetDemoData}
              title="Khôi phục dữ liệu mẫu ban đầu"
              className="min-h-[34px] p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Real-Time Toast Banner */}
      {toastMessage && (
        <div className="no-print fixed bottom-16 lg:bottom-5 right-3 left-3 sm:left-auto sm:right-5 z-50 sm:max-w-md bg-slate-900 text-white border border-slate-700 rounded-xl p-3.5 shadow-xl flex items-start gap-2.5">
          <CheckCircle2 className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-0.5 min-w-0">
            <div className="font-semibold text-white">{toastMessage.title}</div>
            <div className="text-slate-300">{toastMessage.subtitle}</div>
          </div>
        </div>
      )}

      {/* Notification Slide-Down Panel */}
      {showNotifDrawer && (
        <div className="no-print bg-slate-900 text-white border-b border-slate-800 px-4 sm:px-6 py-4">
          <div className="max-w-7xl mx-auto space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm sm:text-base font-bold uppercase tracking-wide text-orange-400">
                THÔNG BÁO KẾT QUẢ & GỌI SÂN TRỰC TIẾP ({tournamentNotifications.length})
              </h3>
              <button
                type="button"
                onClick={() => setShowNotifDrawer(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Đóng ✕
              </button>
            </div>
            {tournamentNotifications.length === 0 ? (
              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-slate-300">
                Hiện chưa có thông báo nào. Thông báo gọi sân và báo sân trống sẽ hiển thị tại đây.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto">
                {tournamentNotifications.slice(0, 6).map((n) => (
                  <div
                    key={n.id}
                    className="p-3 rounded-xl bg-slate-800/90 border border-slate-700 text-xs space-y-1"
                  >
                    <div className="font-semibold text-white">{n.title}</div>
                    <p className="text-slate-300 leading-relaxed">{n.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MAIN WORKSPACE CONTENT */}
      <main
        className={
          activeTab === 'referee'
            ? 'flex-1 min-h-0 max-w-7xl w-full mx-auto px-1 sm:px-4 py-0.5 sm:py-1.5 flex flex-col overflow-hidden'
            : 'flex-1 max-w-7xl w-full mx-auto px-2.5 sm:px-6 py-3.5 sm:py-6 space-y-4'
        }
      >
        {activeTab === 'overview' && (
          <div className="space-y-5">
            <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
              <div className="lg:col-span-8 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                    <span className="font-semibold text-orange-600 uppercase tracking-wider">
                      HỆ THỐNG GIẢI ĐẤU & TRỌNG TÀI PICKLEBALL 1986
                    </span>
                    <span>·</span>
                    <span>{FORMAT_LABELS[currentTournament.format]}</span>
                    <span>·</span>
                    <span>{TOURNAMENT_STATUS_LABELS[currentTournament.status]}</span>
                  </div>

                  <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900">
                    {currentTournament.name}
                  </h1>

                  <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
                    {currentTournament.description}
                  </p>

                  <div className="pt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                      {currentTournament.location}
                    </span>
                    <span>·</span>
                    <span className="font-mono-num">
                      {currentTournament.startDate} → {currentTournament.endDate}
                    </span>
                    <span>·</span>
                    <span className="font-mono-num font-semibold text-slate-900">
                      {currentTournament.courtsCount} sân
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:flex flex-wrap items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab('referee')}
                    className="min-h-[44px] px-4 py-2.5 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    <Gavel className="w-4 h-4" />
                    Mở App Trọng Tài (Sân, Bốc thăm & Chọn VĐV)
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('members')}
                    className="min-h-[44px] px-4 py-2.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    <UserPlus className="w-4 h-4 text-orange-600" />
                    Nhập VĐV & Sắp Xếp Bảng Thi Đấu
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('reports')}
                    className="min-h-[44px] px-4 py-2.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    <BarChart3 className="w-4 h-4 text-emerald-600" />
                    Xuất Báo Cáo PDF & Excel
                  </button>
                </div>
              </div>

              <div className="lg:col-span-4 bg-slate-900 text-white rounded-xl p-4 sm:p-5 flex flex-col items-center justify-between text-center border border-slate-800">
                <img
                  src={BRAND_LOGO_URL}
                  alt="1986 Bính Dần Pickleball"
                  referrerPolicy="no-referrer"
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border-2 border-orange-500 shadow-md"
                />
                <div className="my-2.5">
                  <div className="font-display text-xl sm:text-2xl font-extrabold tracking-wide text-orange-400">
                    BÍNH DẦN 1986 PICKLEBALL
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    Nhập VĐV chủ động · Tự sắp xếp bảng thi đấu · Điều hành bàn trọng tài
                  </p>
                </div>
                <div className="w-full pt-2.5 border-t border-slate-800 grid grid-cols-3 gap-2 font-mono-num text-xs">
                  <div>
                    <div className="text-slate-400">Tổng đội</div>
                    <div className="text-base font-bold text-white">
                      {tournamentRegistrations.length}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400">Tổng trận</div>
                    <div className="text-base font-bold text-orange-400">
                      {tournamentMatches.length}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400">Tài khoản</div>
                    <div className="text-base font-bold text-emerald-400">
                      {appState.staffAccounts.filter((a) => isStaffRole(a.role)).length} TK
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4">
                <div className="text-xs text-slate-500">Sân đang thi đấu</div>
                <div className="mt-1 font-mono-num text-xl sm:text-2xl font-bold text-emerald-600">
                  {liveMatches.length} / {currentTournament.courtsCount} sân
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  Hoàn tất: {tournamentMatches.filter((m) => m.status === 'completed').length} trận
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4">
                <div className="text-xs text-slate-500">Đội đã Check-in</div>
                <div className="mt-1 font-mono-num text-xl sm:text-2xl font-bold text-slate-900">
                  {tournamentRegistrations.filter((r) => r.checkedIn).length}/
                  {tournamentRegistrations.length} đội
                </div>
                <div className="mt-1 text-[11px] text-slate-500 truncate">
                  {currentTournament.divisions.length} nội dung
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4">
                <div className="text-xs text-slate-500">Số bảng đã phân</div>
                <div className="mt-1 font-mono-num text-xl sm:text-2xl font-bold text-orange-600">
                  {
                    Array.from(
                      new Set(
                        tournamentRegistrations
                          .map((r) => r.groupName)
                          .filter(Boolean),
                      ),
                    ).length
                  }{' '}
                  bảng
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  Sắp xếp thủ công theo từng VĐV/đội
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4">
                <div className="text-xs text-slate-500">Điều lệ QĐ 494/QĐTDTTVN</div>
                <div className="mt-1 font-mono-num text-lg sm:text-xl font-bold text-slate-900">
                  Chạm {currentTournament.pointsToWin}đ (8đ đổi sân)
                </div>
                <div className="mt-1 text-[11px] text-slate-500 truncate">
                  Thắng 3đ · Hòa 2đ · Thua 1đ · KO max 18đ
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-base sm:text-lg font-bold tracking-tight text-slate-900 uppercase">
                      BẢNG ĐIỂM TRỰC TIẾP TẠI SÂN (LIVE SCOREBOARD)
                    </h2>
                    <p className="text-xs text-slate-500">
                      Hiển thị cặp VĐV đang đứng sân và lượt giao bóng trực tiếp
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('referee')}
                    className="text-xs font-semibold text-orange-600 hover:text-orange-700 shrink-0"
                  >
                    App Trọng tài →
                  </button>
                </div>

                <div className="p-4 sm:p-5 space-y-3.5">
                  {liveMatches.length === 0 ? (
                    <div className="p-6 text-center bg-slate-50 rounded-xl border border-slate-200">
                      <p className="text-sm text-slate-600">
                        Hiện chưa có trận nào đang đấu. Bấm vào App Trọng tài để bốc thăm và bắt đầu trận.
                      </p>
                    </div>
                  ) : (
                    liveMatches.map((m) => (
                      <div
                        key={m.id}
                        className="border border-slate-200 rounded-xl p-3.5 sm:p-4 bg-slate-50/70 space-y-2.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                          <div>
                            <span className="font-mono-num font-bold text-orange-600">
                              SÂN {m.courtNumber} · TRẬN #{m.matchNumber}
                            </span>
                            <span> · </span>
                            <span className="font-semibold text-slate-800">
                              {m.teamSubCategory || m.division}
                            </span>
                          </div>
                          <span className="font-mono-num font-semibold text-emerald-600">
                            Hô điểm: {formatScoreCallout(m)}
                          </span>
                        </div>

                        <div className="grid grid-cols-12 items-center gap-2 py-1">
                          <div className="col-span-5 min-w-0">
                            <div className="text-sm font-bold text-slate-900 truncate">
                              {m.teamAName}
                            </div>
                            {(m.teamAPlayer1 || m.teamAPlayer2) && (
                              <div className="text-[11px] text-slate-600 truncate">
                                {m.teamAPlayer1} · {m.teamAPlayer2}
                              </div>
                            )}
                            <div className="text-[10px] text-orange-600 font-semibold">
                              {m.servingTeam === 'A'
                                ? `● Đang giao bóng (Người ${m.serverNumber})`
                                : 'Đỡ giao bóng'}
                            </div>
                          </div>

                          <div className="col-span-2 text-center font-mono-num text-xl sm:text-2xl font-extrabold text-slate-900">
                            {m.scoreA} : {m.scoreB}
                          </div>

                          <div className="col-span-5 text-right min-w-0">
                            <div className="text-sm font-bold text-slate-900 truncate">
                              {m.teamBName}
                            </div>
                            {(m.teamBPlayer1 || m.teamBPlayer2) && (
                              <div className="text-[11px] text-slate-600 truncate">
                                {m.teamBPlayer1} · {m.teamBPlayer2}
                              </div>
                            )}
                            <div className="text-[10px] text-orange-600 font-semibold">
                              {m.servingTeam === 'B'
                                ? `● Đang giao bóng (Người ${m.serverNumber})`
                                : 'Đỡ giao bóng'}
                            </div>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500">
                          <span className="truncate">TT: {m.refereeName || 'BTC 1986'}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedRefereeMatchId(m.id);
                              setActiveTab('referee');
                            }}
                            className="min-h-[36px] px-3 py-1 font-semibold text-white bg-slate-900 hover:bg-orange-600 rounded-lg transition-colors shrink-0"
                          >
                            Mở sân trọng tài
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-base sm:text-lg font-bold tracking-tight text-slate-900 uppercase">
                      BẢNG XẾP HẠNG THỜI GIAN THỰC
                    </h2>
                    <p className="text-xs text-slate-500">
                      {currentTournament.divisions[0]
                        ? `Nội dung ${currentTournament.divisions[0]}`
                        : 'Chưa tạo nội dung thi đấu'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('standings')}
                    className="text-xs font-semibold text-orange-600 hover:text-orange-700"
                  >
                    Chi tiết →
                  </button>
                </div>

                <div className="divide-y divide-slate-200">
                  {Object.keys(standingsPreview).length === 0 ? (
                    <div className="p-6 text-center space-y-2.5">
                      <p className="text-xs text-slate-500">
                        Chưa có VĐV/đội nào trong giải đấu. Tài khoản Admin có thể vào mục VĐV & Sắp bảng để tự nhập VĐV và sắp xếp bảng thi đấu.
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveTab('members')}
                        className="px-3 py-1.5 text-xs font-semibold text-orange-600 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors"
                      >
                        Mở VĐV & Sắp bảng →
                      </button>
                    </div>
                  ) : (
                    Object.entries(standingsPreview).map(([gName, rows]) => (
                      <div key={gName} className="p-3.5 sm:p-4">
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                          {gName}
                        </div>
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-500">
                              <th className="py-1.5 pr-2">#</th>
                              <th className="py-1.5 px-2">Đội</th>
                              <th className="py-1.5 px-2 text-right">T-B</th>
                              <th className="py-1.5 px-2 text-right">Hiệu số</th>
                              <th className="py-1.5 pl-2 text-right">Điểm</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {rows.map((r, i) => (
                              <tr key={r.teamId}>
                                <td className="py-2 pr-2 font-mono-num font-bold text-slate-700">
                                  {i + 1}
                                </td>
                                <td className="py-2 px-2 font-semibold text-slate-900 truncate max-w-[140px]">
                                  {r.teamName}
                                </td>
                                <td className="py-2 px-2 text-right font-mono-num">
                                  {r.wins}-{r.losses}
                                </td>
                                <td
                                  className={`py-2 px-2 text-right font-mono-num font-semibold ${
                                    r.pointDiff >= 0 ? 'text-emerald-600' : 'text-rose-600'
                                  }`}
                                >
                                  {r.pointDiff > 0 ? `+${r.pointDiff}` : r.pointDiff}
                                </td>
                                <td className="py-2 pl-2 text-right font-mono-num font-bold text-orange-600">
                                  {r.rankPoints}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>

            <section className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-base sm:text-lg font-bold tracking-tight text-slate-900 uppercase">
                    DANH SÁCH GIẢI ĐẤU PICKLEBALL 1986 ĐANG & SẮP DIỄN RA
                  </h2>
                  <p className="text-xs text-slate-500">
                    Chọn giải đấu để xem lịch thi đấu, tự nhập VĐV/sắp bảng hoặc điều hành bàn trọng tài
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleOpenCreateTournament}
                  className="px-3 py-1.5 text-xs font-semibold text-orange-600 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors"
                >
                  + Thêm giải đấu mới (Cần TK BTC)
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {appState.tournaments.map((t) => {
                  const isCurrent = t.id === currentTournament.id;
                  const regCount = appState.registrations.filter(
                    (r) => r.tournamentId === t.id,
                  ).length;
                  const matchCount = appState.matches.filter(
                    (m) => m.tournamentId === t.id,
                  ).length;

                  return (
                    <div
                      key={t.id}
                      className={`rounded-xl p-4 border transition-colors flex flex-col justify-between gap-3 ${
                        isCurrent
                          ? 'border-orange-500 bg-orange-50/20'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span className="font-semibold text-orange-600">
                            {TOURNAMENT_STATUS_LABELS[t.status]}
                          </span>
                          <span className="font-mono-num">
                            {t.startDate} → {t.endDate}
                          </span>
                        </div>

                        <h3 className="font-display text-lg sm:text-xl font-bold text-slate-900">
                          {t.name}
                        </h3>

                        <p className="text-xs text-slate-600 line-clamp-2">{t.description}</p>

                        <div className="pt-1 text-xs text-slate-500">
                          {t.location} · {t.courtsCount} sân
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between">
                        <div className="text-xs text-slate-600 font-mono-num">
                          {regCount} đội · {matchCount} trận
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTournamentId(t.id);
                            setActiveTab('schedule');
                          }}
                          className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                            isCurrent
                              ? 'bg-orange-600 text-white'
                              : 'bg-slate-900 text-white hover:bg-orange-600'
                          }`}
                        >
                          {isCurrent ? 'Xem lịch & nhánh đấu' : 'Chọn giải này'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'schedule' && (
          <ScheduleAndStandingsView
            tournament={currentTournament}
            registrations={tournamentRegistrations}
            matches={tournamentMatches}
            mode="schedule"
            isAdmin={isAdmin}
            onGenerateSchedule={handleGenerateSchedule}
            onOpenRefereeForMatch={(matchId) => {
              setSelectedRefereeMatchId(matchId);
              setActiveTab('referee');
            }}
            onUpdateMatchSchedule={(matchId, courtNumber, scheduledTime) =>
              handleUpdateMatch(matchId, { courtNumber, scheduledTime })
            }
            onSyncKnockoutFromGroups={handleSyncKnockoutFromGroups}
          />
        )}

        {activeTab === 'standings' && (
          <ScheduleAndStandingsView
            tournament={currentTournament}
            registrations={tournamentRegistrations}
            matches={tournamentMatches}
            mode="standings"
            isAdmin={isAdmin}
            onGenerateSchedule={handleGenerateSchedule}
            onOpenRefereeForMatch={(matchId) => {
              setSelectedRefereeMatchId(matchId);
              setActiveTab('referee');
            }}
            onUpdateMatchSchedule={(matchId, courtNumber, scheduledTime) =>
              handleUpdateMatch(matchId, { courtNumber, scheduledTime })
            }
            onSyncKnockoutFromGroups={handleSyncKnockoutFromGroups}
          />
        )}

        {activeTab === 'referee' && (
          <RefereeConsoleView
            tournament={currentTournament}
            matches={tournamentMatches}
            registrations={tournamentRegistrations}
            selectedMatchId={selectedRefereeMatchId}
            currentAccount={currentAccount}
            onRequestLogin={(reason) => openLoginWithReason(reason)}
            onSelectMatch={(matchId) => setSelectedRefereeMatchId(matchId)}
            onUpdateMatch={handleUpdateMatch}
            onCompleteMatch={handleCompleteMatch}
            onAnnounceCourtCall={handleAnnounceCourtCall}
            onAnnounceCourtAvailable={handleAnnounceCourtAvailable}
            onAddRosterAthlete={handleAddRosterAthlete}
          />
        )}

        {activeTab === 'members' && (
          <MembersAndPaymentsView
            tournament={currentTournament}
            registrations={tournamentRegistrations}
            currentAccount={currentAccount}
            onRequestLogin={(reason) => openLoginWithReason(reason)}
            onAddDivision={handleAddDivision}
            onAddRegistration={handleAddRegistration}
            onAssignRegistrationGroup={handleAssignRegistrationGroup}
            onToggleCheckIn={handleToggleCheckIn}
          />
        )}

        {activeTab === 'reports' && (
          <AnalyticsReportView
            tournament={currentTournament}
            registrations={tournamentRegistrations}
            matches={tournamentMatches}
          />
        )}
      </main>

      {/* Quiet Footer */}
      <footer
        className={`no-print bg-white border-t border-slate-200 px-4 sm:px-6 py-4 text-xs text-slate-500 ${
          activeTab === 'referee' ? 'hidden' : ''
        }`}
      >
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div>
            © 2026 <strong className="text-slate-800">1986 — Bính Dần Pickleball</strong> · Quản lý giải đấu, tài khoản Trọng tài & Ban Tổ Chức.
          </div>
          <div>
            Tối ưu thao tác trên điện thoại · Nhập VĐV & Sắp bảng chủ động · Xuất PDF/CSV
          </div>
        </div>
      </footer>

      {/* FIXED BOTTOM THUMB-ZONE TAB BAR FOR MOBILE PHONES */}
      <nav className="no-print lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 grid grid-cols-6 items-center h-11 sm:h-12 px-1 compact-on-mobile-landscape">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`min-h-[40px] sm:min-h-[44px] flex flex-col items-center justify-center rounded-lg transition-colors ${
                isActive ? 'text-orange-600 font-bold' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {item.icon}
              <span className="text-[10px] tracking-tight mt-0.5 truncate max-w-full px-0.5">
                {item.shortLabel}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Modals */}
      {showAuthModal && (
        <StaffAuthModal
          accounts={appState.staffAccounts}
          currentAccount={currentAccount}
          initialMode={authModalMode}
          reasonMessage={authReasonMessage}
          onClose={() => {
            setShowAuthModal(false);
            setAuthReasonMessage(null);
          }}
          onLoginSuccess={handleLoginSuccess}
          onLogout={handleLogout}
          onCreateAccount={handleCreateStaffAccount}
          onDeleteAccount={handleDeleteStaffAccount}
        />
      )}

      {showCreateModal && (
        <CreateTournamentModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateTournament}
        />
      )}
    </div>
  );
}
