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
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Gavel,
  Home,
  ImagePlus,
  LogIn,
  MapPin,
  Moon,
  Pencil,
  Plus,
  Radio,
  RotateCcw,
  ShieldCheck,
  Sun,
  Trash2,
  Trophy,
  UserPlus,
  Users,
  X,
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
  | 'live'
  | 'schedule'
  | 'referee'
  | 'standings'
  | 'members'
  | 'reports';

type ThemeMode = 'light' | 'dark';

interface TournamentPost {
  id: string;
  tournamentId: string;
  title: string;
  badge: string;
  summary: string;
  detail: string;
  linkLabel?: string;
  linkUrl?: string;
  images: string[];
  createdAt: string;
}

interface LightboxPreview {
  title: string;
  subtitle: string;
  images: string[];
  imageIndex: number;
}

const STORAGE_KEY = 'pickleball_1986_state_v7';
const AUTH_SESSION_KEY = 'pickleball_1986_auth_user_v1';
const ACTIVE_TAB_KEY = 'pickleball_1986_active_tab_v1';
const THEME_STORAGE_KEY = 'pickleball_1986_theme_mode_v1';
const POSTS_STORAGE_KEY = 'pickleball_1986_tournament_posts_v1';
const SYNC_CHANNEL = 'pickleball_1986_realtime_channel';

const VALID_TABS: ActiveTab[] = [
  'overview',
  'live',
  'schedule',
  'referee',
  'standings',
  'members',
  'reports',
];

const STAFF_ONLY_TABS: ActiveTab[] = ['referee', 'members', 'reports'];

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

function normalizeExternalUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function loadSavedTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
    if (saved === 'dark' || saved === 'light') {
      return saved;
    }
  } catch {
    // ignore storage errors
  }
  return 'light';
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
      const validStaff = Array.isArray(parsed.staffAccounts)
        ? parsed.staffAccounts.filter((acc) => isStaffRole(acc?.role))
        : [];
      return {
        tournaments: Array.isArray(parsed.tournaments) ? parsed.tournaments : [],
        registrations: Array.isArray(parsed.registrations) ? parsed.registrations : [],
        matches: Array.isArray(parsed.matches) ? parsed.matches : [],
        notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
        users: Array.isArray(parsed.users) ? parsed.users : INITIAL_USERS,
        staffAccounts: validStaff.length > 0 ? validStaff : INITIAL_STAFF_ACCOUNTS,
      };
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

function loadSavedTournamentPosts(): TournamentPost[] {
  try {
    const raw = localStorage.getItem(POSTS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((p, idx) => ({
          id: String(p.id || `post_${idx}`),
          tournamentId: String(p.tournamentId || ''),
          title: String(p.title || 'Thông báo giải đấu'),
          badge: String(p.badge || 'Thông báo BTC'),
          summary: String(p.summary || ''),
          detail: String(p.detail || ''),
          linkLabel: p.linkLabel ? String(p.linkLabel) : undefined,
          linkUrl: p.linkUrl ? normalizeExternalUrl(String(p.linkUrl)) : undefined,
          images: Array.isArray(p.images) ? p.images.filter(Boolean) : [],
          createdAt: String(p.createdAt || ''),
        }));
      }
    }
  } catch {
    // ignore storage errors
  }
  return [];
}

function compressImageFileToDataUrl(
  file: File,
  maxWidth = 1280,
  quality = 0.8,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không thể đọc tệp ảnh'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Định dạng ảnh không hợp lệ'));
      img.onload = () => {
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result || ''));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

export default function App() {
  const [appState, setAppState] = useState<PersistedAppState>(() => loadInitialState());
  const [currentAccount, setCurrentAccount] = useState<StaffAccount | null>(() =>
    loadSavedAuthAccount(loadInitialState().staffAccounts),
  );
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => loadSavedTheme());
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'manage'>('login');
  const [authReasonMessage, setAuthReasonMessage] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<ActiveTab>(() => loadSavedActiveTab());
  const [expandedPostIds, setExpandedPostIds] = useState<Record<string, boolean>>({});

  const [selectedTournamentId, setSelectedTournamentId] = useState<string>(
    () => loadInitialState().tournaments[0]?.id || '',
  );
  const [selectedRefereeMatchId, setSelectedRefereeMatchId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showNotifDrawer, setShowNotifDrawer] = useState(false);
  const [readNotifIds, setReadNotifIds] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<{ title: string; subtitle: string } | null>(
    null,
  );

  // Modal xác nhận mật khẩu khi làm mới dữ liệu
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [resetPasswordInput, setResetPasswordInput] = useState('');
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(null);
  const [resetShakeKey, setResetShakeKey] = useState(0);

  // Admin đăng / sửa / xóa thông tin & hình ảnh giải đấu trên trang chủ
  const [posts, setPosts] = useState<TournamentPost[]>(() => loadSavedTournamentPosts());
  const [showPostForm, setShowPostForm] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [postTitle, setPostTitle] = useState('');
  const [postBadge, setPostBadge] = useState('Thông báo BTC');
  const [postSummary, setPostSummary] = useState('');
  const [postDetail, setPostDetail] = useState('');
  const [postLinkLabel, setPostLinkLabel] = useState('');
  const [postLinkUrl, setPostLinkUrl] = useState('');
  const [postUrlInput, setPostUrlInput] = useState('');
  const [postDraftImages, setPostDraftImages] = useState<string[]>([]);

  const [lightboxState, setLightboxState] = useState<LightboxPreview | null>(null);

  const isDark = themeMode === 'dark';
  const isStaff = Boolean(currentAccount && isStaffRole(currentAccount.role));
  const isAdmin = currentAccount?.role === 'admin';

  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, themeMode);
      if (themeMode === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch {
      // ignore storage errors
    }
  }, [themeMode]);

  const toggleThemeMode = () => {
    setThemeMode((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  useEffect(() => {
    if (!isStaff && STAFF_ONLY_TABS.includes(activeTab)) {
      setActiveTab('overview');
    }
  }, [isStaff, activeTab]);

  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_TAB_KEY, activeTab);
    } catch {
      // ignore storage errors
    }
  }, [activeTab]);

  const savePostsAndSync = (nextPosts: TournamentPost[]) => {
    setPosts(nextPosts);
    try {
      localStorage.setItem(POSTS_STORAGE_KEY, JSON.stringify(nextPosts));
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel(SYNC_CHANNEL);
        bc.postMessage({ type: 'posts_sync', posts: nextPosts });
        bc.close();
      }
    } catch (err) {
      console.warn('Posts storage warning:', err);
    }
  };

  const openLoginWithReason = (reason: string, mode: 'login' | 'manage' = 'login') => {
    setAuthReasonMessage(reason);
    setAuthModalMode(mode);
    setShowAuthModal(true);
  };

  const updateStateAndSync = (updater: (prev: PersistedAppState) => PersistedAppState) => {
    setAppState((prev) => {
      const next = updater(prev);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        if (typeof BroadcastChannel !== 'undefined') {
          const bc = new BroadcastChannel(SYNC_CHANNEL);
          bc.postMessage({ type: 'state_sync', state: next });
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
      if (event.data?.type === 'posts_sync' && Array.isArray(event.data.posts)) {
        setPosts(event.data.posts);
        return;
      }
      if (event.data?.state && Array.isArray(event.data.state.tournaments)) {
        setAppState(event.data.state as PersistedAppState);
      } else if (event.data && Array.isArray(event.data.tournaments)) {
        setAppState(event.data as PersistedAppState);
      }
    };
    return () => bc.close();
  }, []);

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

  const resetPostForm = () => {
    setEditingPostId(null);
    setPostTitle('');
    setPostBadge('Thông báo BTC');
    setPostSummary('');
    setPostDetail('');
    setPostLinkLabel('');
    setPostLinkUrl('');
    setPostUrlInput('');
    setPostDraftImages([]);
    setShowPostForm(false);
  };

  const handleStartAddPost = () => {
    if (!isAdmin) {
      openLoginWithReason(
        'Vui lòng đăng nhập tài khoản Ban Tổ Chức (Admin) để đăng thông tin và hình ảnh giải đấu.',
      );
      return;
    }
    setEditingPostId(null);
    setPostTitle('');
    setPostBadge('Thông báo BTC');
    setPostSummary('');
    setPostDetail('');
    setPostLinkLabel('');
    setPostLinkUrl('');
    setPostUrlInput('');
    setPostDraftImages([]);
    setShowPostForm(true);
  };

  const handleStartEditPost = (post: TournamentPost) => {
    if (!isAdmin) {
      openLoginWithReason('Vui lòng đăng nhập tài khoản Admin để sửa bài đăng giải đấu.');
      return;
    }
    setEditingPostId(post.id);
    setPostTitle(post.title);
    setPostBadge(post.badge);
    setPostSummary(post.summary);
    setPostDetail(post.detail);
    setPostLinkLabel(post.linkLabel || '');
    setPostLinkUrl(post.linkUrl || '');
    setPostUrlInput('');
    setPostDraftImages(post.images || []);
    setShowPostForm(true);
  };

  const handlePostFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    try {
      const compressed: string[] = [];
      for (const file of files) {
        const dataUrl = await compressImageFileToDataUrl(file);
        compressed.push(dataUrl);
      }
      setPostDraftImages((prev) => [...prev, ...compressed]);
      showToast(`Đã thêm ${compressed.length} ảnh`, 'Hình ảnh đã sẵn sàng cho bài đăng giải đấu.');
    } catch {
      showToast('Không thể đọc ảnh', 'Vui lòng chọn tệp ảnh khác hoặc dán đường dẫn URL ảnh.');
    } finally {
      e.target.value = '';
    }
  };

  const handleAddPostUrlImage = () => {
    const clean = postUrlInput.trim();
    if (!clean) return;
    setPostDraftImages((prev) => [...prev, clean]);
    setPostUrlInput('');
  };

  const handleRemovePostDraftImage = (idx: number) => {
    setPostDraftImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSavePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !currentAccount) {
      openLoginWithReason('Vui lòng đăng nhập tài khoản Admin để lưu thông tin giải đấu.');
      return;
    }

    const cleanTitle = postTitle.trim();
    if (!cleanTitle) {
      showToast('Thiếu tiêu đề', 'Vui lòng nhập tiêu đề thông tin giải đấu.');
      return;
    }

    const pendingUrl = postUrlInput.trim();
    const finalImages = pendingUrl ? [...postDraftImages, pendingUrl] : [...postDraftImages];
    const cleanLinkUrl = normalizeExternalUrl(postLinkUrl);
    const cleanLinkLabel = cleanLinkUrl
      ? postLinkLabel.trim() || 'Xem liên kết'
      : undefined;

    if (editingPostId) {
      const updated = posts.map((p) =>
        p.id === editingPostId
          ? {
              ...p,
              title: cleanTitle,
              badge: postBadge.trim() || 'Thông báo BTC',
              summary: postSummary.trim(),
              detail: postDetail.trim(),
              linkLabel: cleanLinkLabel,
              linkUrl: cleanLinkUrl || undefined,
              images: finalImages,
            }
          : p,
      );
      savePostsAndSync(updated);
      showToast('Đã cập nhật bài đăng', `"${cleanTitle}" đã được cập nhật.`);
    } else {
      const nowLabel = new Date().toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
      const newPost: TournamentPost = {
        id: `post_${Date.now().toString(36)}`,
        tournamentId: currentTournament?.id || '',
        title: cleanTitle,
        badge: postBadge.trim() || 'Thông báo BTC',
        summary: postSummary.trim(),
        detail: postDetail.trim(),
        linkLabel: cleanLinkLabel,
        linkUrl: cleanLinkUrl || undefined,
        images: finalImages,
        createdAt: nowLabel,
      };
      savePostsAndSync([newPost, ...posts]);
      showToast('Đã đăng thông tin giải đấu', `"${cleanTitle}" đã hiển thị trên trang chủ.`);
    }

    resetPostForm();
  };

  const handleDeletePost = (id: string) => {
    if (!isAdmin) {
      openLoginWithReason('Chỉ tài khoản Admin mới có quyền xóa bài đăng giải đấu.');
      return;
    }
    const target = posts.find((p) => p.id === id);
    savePostsAndSync(posts.filter((p) => p.id !== id));
    if (editingPostId === id) {
      resetPostForm();
    }
    if (target) {
      showToast('Đã xóa bài đăng', target.title);
    }
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
    if (STAFF_ONLY_TABS.includes(activeTab)) {
      setActiveTab('overview');
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
    if (appState.tournaments.length === 0) return null;
    return (
      appState.tournaments.find((t) => t.id === selectedTournamentId) ||
      appState.tournaments[0]
    );
  }, [appState.tournaments, selectedTournamentId]);

  useEffect(() => {
    if (!currentTournament && selectedTournamentId) {
      setSelectedTournamentId(appState.tournaments[0]?.id || '');
    }
  }, [currentTournament, selectedTournamentId, appState.tournaments]);

  const tournamentRegistrations = useMemo(
    () =>
      currentTournament
        ? appState.registrations.filter((r) => r.tournamentId === currentTournament.id)
        : [],
    [appState.registrations, currentTournament],
  );

  const tournamentMatches = useMemo(
    () =>
      currentTournament
        ? appState.matches
            .filter((m) => m.tournamentId === currentTournament.id)
            .sort((a, b) => a.matchNumber - b.matchNumber)
        : [],
    [appState.matches, currentTournament],
  );

  const tournamentNotifications = useMemo(
    () =>
      currentTournament
        ? appState.notifications.filter((n) => n.tournamentId === currentTournament.id)
        : [],
    [appState.notifications, currentTournament],
  );

  const unreadCount = useMemo(
    () => tournamentNotifications.filter((n) => !readNotifIds.includes(n.id)).length,
    [tournamentNotifications, readNotifIds],
  );

  const liveMatches = useMemo(
    () => tournamentMatches.filter((m) => m.status === 'live'),
    [tournamentMatches],
  );

  const standingsPreview = useMemo(
    () =>
      currentTournament
        ? computeGroupStandings(
            tournamentRegistrations,
            tournamentMatches,
            currentTournament.divisions[0],
          )
        : {},
    [tournamentRegistrations, tournamentMatches, currentTournament],
  );

  const pushNotification = (
    type: AppNotification['type'],
    title: string,
    message: string,
    matchId = '',
  ) => {
    if (!currentTournament) return;
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
    if (!currentTournament) return;
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
    if (!currentTournament) return;
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
    if (!currentTournament) return;
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
    if (!currentTournament) return;
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

  const handleRequestResetDemoData = () => {
    if (!isAdmin) {
      openLoginWithReason(
        'Chỉ tài khoản Ban Tổ Chức (Admin) mới có quyền làm mới dữ liệu giải đấu.',
      );
      return;
    }
    setResetPasswordInput('');
    setResetPasswordError(null);
    setResetShakeKey(0);
    setShowResetPasswordModal(true);
  };

  const handleConfirmResetDemoData = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !currentAccount) {
      setShowResetPasswordModal(false);
      openLoginWithReason(
        'Vui lòng đăng nhập tài khoản Ban Tổ Chức (Admin) để xác thực làm mới dữ liệu.',
      );
      return;
    }

    const entered = resetPasswordInput.trim();
    const matchedAdmin = appState.staffAccounts.find(
      (acc) => acc.role === 'admin' && acc.password === entered,
    );
    const matchesCurrentAccount = currentAccount.password === entered;

    if (!entered || (!matchesCurrentAccount && !matchedAdmin)) {
      setResetPasswordError('Mật khẩu không chính xác. Đã hủy thao tác làm mới dữ liệu.');
      setResetShakeKey((prev) => prev + 1);
      return;
    }

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
    setSelectedTournamentId('');
    setActiveTab('overview');
    setShowResetPasswordModal(false);
    setResetPasswordInput('');
    setResetPasswordError(null);
    setResetShakeKey(0);
    showToast('Đã làm mới dữ liệu', 'Danh sách giải đấu đang trống. Admin có thể tạo giải mới.');
  };

  const navItems: Array<{
    id: ActiveTab;
    label: string;
    shortLabel: string;
    icon: React.ReactNode;
    staffOnly?: boolean;
  }> = [
    {
      id: 'overview',
      label: 'Trang chủ',
      shortLabel: 'Trang chủ',
      icon: <Home className="w-4 h-4" />,
    },
    {
      id: 'live',
      label: 'Live',
      shortLabel: 'Live',
      icon: <Radio className="w-4 h-4" />,
    },
    {
      id: 'schedule',
      label: 'Lịch & Nhánh đấu',
      shortLabel: 'Lịch đấu',
      icon: <Calendar className="w-4 h-4" />,
    },
    {
      id: 'standings',
      label: 'Bảng xếp hạng',
      shortLabel: 'BXH',
      icon: <Trophy className="w-4 h-4" />,
    },
    {
      id: 'referee',
      label: 'Trọng tài (Sân)',
      shortLabel: 'Trọng tài',
      icon: <Gavel className="w-4 h-4" />,
      staffOnly: true,
    },
    {
      id: 'members',
      label: 'VĐV & Sắp bảng',
      shortLabel: 'VĐV/Bảng',
      icon: <Users className="w-4 h-4" />,
      staffOnly: true,
    },
    {
      id: 'reports',
      label: 'Báo cáo & Xuất file',
      shortLabel: 'Báo cáo',
      icon: <BarChart3 className="w-4 h-4" />,
      staffOnly: true,
    },
  ];

  const visibleNavItems = useMemo(
    () => navItems.filter((item) => !item.staffOnly || isStaff),
    [isStaff],
  );

  const visiblePosts = useMemo(() => {
    if (!currentTournament) return posts;
    const matched = posts.filter(
      (p) => !p.tournamentId || p.tournamentId === currentTournament.id,
    );
    return matched.length > 0 ? matched : posts;
  }, [posts, currentTournament]);

  const surfaceCard = isDark
    ? 'bg-slate-900 border-slate-800 text-slate-100'
    : 'bg-white border-slate-200 text-slate-900';

  const mutedText = isDark ? 'text-slate-400' : 'text-slate-600';

  const renderTournamentOverviewSection = () => {
    if (!currentTournament) {
      return (
        <section className={`border rounded-2xl p-6 text-center space-y-3 ${surfaceCard}`}>
          <p className={`text-sm ${mutedText}`}>Chưa có giải đấu nào đang hiển thị.</p>
          {isAdmin && (
            <button
              type="button"
              onClick={handleOpenCreateTournament}
              className="min-h-[40px] px-4 py-2 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-xl inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Tạo giải đấu mới
            </button>
          )}
        </section>
      );
    }

    return (
      <div className="space-y-5">
        <section
          className={`border rounded-2xl p-4 sm:p-6 lg:p-7 grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch ${surfaceCard}`}
        >
          <div className="lg:col-span-8 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className={`flex flex-wrap items-center gap-1.5 text-xs ${mutedText}`}>
                <span className="font-semibold text-orange-500 uppercase tracking-wider">
                  THÔNG TIN GIẢI ĐẤU · PICKLEBALL 1986
                </span>
                <span>·</span>
                <span>{FORMAT_LABELS[currentTournament.format]}</span>
                <span>·</span>
                <span>{TOURNAMENT_STATUS_LABELS[currentTournament.status]}</span>
              </div>

              <h1 className="font-display text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight">
                {currentTournament.name}
              </h1>

              <p className={`text-xs sm:text-sm max-w-2xl leading-relaxed ${mutedText}`}>
                {currentTournament.description}
              </p>

              <div className={`pt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs ${mutedText}`}>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                  {currentTournament.location}
                </span>
                <span>·</span>
                <span className="font-mono-num">
                  {currentTournament.startDate} → {currentTournament.endDate}
                </span>
                <span>·</span>
                <span className="font-mono-num font-semibold">
                  {currentTournament.courtsCount} sân
                </span>
              </div>

              {currentTournament.divisions.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-2">
                  {currentTournament.divisions.map((div) => (
                    <span
                      key={div}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${
                        isDark
                          ? 'bg-slate-800 text-orange-300 border-slate-700'
                          : 'bg-orange-50 text-orange-800 border-orange-200'
                      }`}
                    >
                      {div}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setActiveTab('live')}
                className="min-h-[42px] px-4 py-2 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Radio className="w-4 h-4" />
                Xem tỷ số trực tiếp (Live)
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('schedule')}
                className={`min-h-[42px] px-4 py-2 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 ${
                  isDark
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-100'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                }`}
              >
                <Calendar className="w-4 h-4 text-orange-500" />
                Lịch & Nhánh đấu
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('standings')}
                className={`min-h-[42px] px-4 py-2 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 ${
                  isDark
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-100'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                }`}
              >
                <Trophy className="w-4 h-4 text-orange-500" />
                Bảng xếp hạng
              </button>

              {isStaff && (
                <>
                  <button
                    type="button"
                    onClick={() => setActiveTab('referee')}
                    className={`min-h-[42px] px-4 py-2 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 ${
                      isDark
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-100'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                    }`}
                  >
                    <Gavel className="w-4 h-4 text-orange-500" />
                    Mở App Trọng Tài
                  </button>

                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('members')}
                      className={`min-h-[42px] px-4 py-2 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 ${
                        isDark
                          ? 'bg-slate-800 hover:bg-slate-700 text-slate-100'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                      }`}
                    >
                      <UserPlus className="w-4 h-4 text-orange-500" />
                      Nhập VĐV & Sắp Xếp Bảng
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          <div
            className={`lg:col-span-4 rounded-xl p-4 sm:p-5 flex flex-col items-center justify-between text-center border ${
              isDark
                ? 'bg-slate-950/70 text-white border-slate-800'
                : 'bg-slate-900 text-white border-slate-800'
            }`}
          >
            <img
              src={BRAND_LOGO_URL}
              alt="1986 Bính Dần Pickleball"
              referrerPolicy="no-referrer"
              className="w-18 h-18 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-orange-500 shadow-md"
            />
            <div className="my-2">
              <div className="font-display text-lg sm:text-xl font-extrabold tracking-wide text-orange-400">
                BÍNH DẦN 1986 PICKLEBALL
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Cổng thông tin điều hành · Lịch thi đấu · Tỷ số trực tiếp
              </p>
            </div>
            <div className="w-full pt-2 border-t border-slate-800 grid grid-cols-3 gap-2 font-mono-num text-xs">
              <div>
                <div className="text-slate-400">Đang đấu</div>
                <div className="text-sm font-bold text-emerald-400">
                  {liveMatches.length}/{currentTournament.courtsCount}
                </div>
              </div>
              <div>
                <div className="text-slate-400">Tổng đội</div>
                <div className="text-sm font-bold text-white">
                  {tournamentRegistrations.length}
                </div>
              </div>
              <div>
                <div className="text-slate-400">Tổng trận</div>
                <div className="text-sm font-bold text-orange-400">
                  {tournamentMatches.length}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Khối thông tin & hình ảnh giải đấu do Admin đăng / quản lý */}
        <section className={`border rounded-2xl p-4 sm:p-6 space-y-4 ${surfaceCard}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-base sm:text-lg font-bold uppercase tracking-tight">
                THÔNG BÁO & HÌNH ẢNH GIẢI ĐẤU ({visiblePosts.length})
              </h2>
              <p className={`text-xs ${mutedText}`}>
                Điều lệ, lịch họp kỹ thuật, sơ đồ sân và hình ảnh cập nhật từ Ban Tổ Chức.
              </p>
            </div>

            {isAdmin && (
              <button
                type="button"
                onClick={handleStartAddPost}
                className="min-h-[38px] px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Đăng thông tin / Hình ảnh
              </button>
            )}
          </div>

          {isAdmin && showPostForm && (
            <form
              onSubmit={handleSavePost}
              className={`p-4 sm:p-5 rounded-2xl border space-y-4 ${
                isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-bold">
                  {editingPostId
                    ? 'Chỉnh sửa thông tin & hình ảnh giải đấu'
                    : 'Đăng thông tin & hình ảnh giải đấu mới'}
                </div>
                <button
                  type="button"
                  onClick={resetPostForm}
                  className={`p-1.5 rounded-lg ${
                    isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold mb-1">Tiêu đề thông tin *</label>
                  <input
                    type="text"
                    value={postTitle}
                    onChange={(e) => setPostTitle(e.target.value)}
                    placeholder="VD: Điều lệ thi đấu, Sơ đồ sân, Hình ảnh khai mạc..."
                    className={`w-full min-h-[38px] px-3 py-1.5 text-xs border rounded-lg ${
                      isDark
                        ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500'
                        : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Nhãn phân loại</label>
                  <input
                    type="text"
                    value={postBadge}
                    onChange={(e) => setPostBadge(e.target.value)}
                    placeholder="VD: Điều lệ, Lịch họp, Ảnh sân..."
                    className={`w-full min-h-[38px] px-3 py-1.5 text-xs border rounded-lg ${
                      isDark
                        ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500'
                        : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Tóm tắt ngắn</label>
                  <textarea
                    rows={2}
                    value={postSummary}
                    onChange={(e) => setPostSummary(e.target.value)}
                    placeholder="Nội dung tóm tắt hiển thị trên thẻ..."
                    className={`w-full px-3 py-2 text-xs border rounded-lg ${
                      isDark
                        ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500'
                        : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Chi tiết đầy đủ (mở khi bấm Xem thêm)
                  </label>
                  <textarea
                    rows={2}
                    value={postDetail}
                    onChange={(e) => setPostDetail(e.target.value)}
                    placeholder="Quy định, giờ tập trung, lưu ý cho VĐV và trọng tài..."
                    className={`w-full px-3 py-2 text-xs border rounded-lg ${
                      isDark
                        ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500'
                        : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Nhãn liên kết đính kèm</label>
                  <input
                    type="text"
                    value={postLinkLabel}
                    onChange={(e) => setPostLinkLabel(e.target.value)}
                    placeholder="VD: Xem điều lệ / Bản đồ sân"
                    className={`w-full min-h-[38px] px-3 py-1.5 text-xs border rounded-lg ${
                      isDark
                        ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500'
                        : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Đường dẫn URL liên kết</label>
                  <input
                    type="text"
                    value={postLinkUrl}
                    onChange={(e) => setPostLinkUrl(e.target.value)}
                    placeholder="https://..."
                    className={`w-full min-h-[38px] px-3 py-1.5 text-xs border rounded-lg ${
                      isDark
                        ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500'
                        : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
                    }`}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold">
                  Hình ảnh giải đấu (tải nhiều ảnh từ máy hoặc dán URL ảnh)
                </label>
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                  <input
                    type="text"
                    value={postUrlInput}
                    onChange={(e) => setPostUrlInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddPostUrlImage();
                      }
                    }}
                    placeholder="Dán link URL ảnh rồi bấm + Ảnh"
                    className={`flex-1 min-w-0 min-h-[38px] px-3 py-1.5 text-xs border rounded-lg ${
                      isDark
                        ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500'
                        : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={handleAddPostUrlImage}
                    className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 ${
                      isDark
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                        : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                    }`}
                  >
                    + Ảnh
                  </button>
                  <label className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-orange-600 text-white text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5 shrink-0 transition-colors">
                    <ImagePlus className="w-3.5 h-3.5" />
                    Tải ảnh lên
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handlePostFilesChange}
                      className="hidden"
                    />
                  </label>
                </div>

                {postDraftImages.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {postDraftImages.map((src, idx) => (
                      <div
                        key={`${idx}_${src.slice(0, 20)}`}
                        className={`relative w-24 h-16 rounded-lg overflow-hidden border bg-slate-900 ${
                          isDark ? 'border-slate-700' : 'border-slate-300'
                        }`}
                      >
                        <img
                          src={src}
                          alt={`Ảnh giải đấu ${idx + 1}`}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemovePostDraftImage(idx)}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-slate-950/80 text-white text-[11px] flex items-center justify-center hover:bg-rose-600"
                          title="Xóa ảnh"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={resetPostForm}
                  className={`min-h-[38px] px-4 py-2 rounded-xl text-xs font-semibold ${
                    isDark
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                      : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                  }`}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="min-h-[38px] px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold"
                >
                  {editingPostId ? 'Lưu cập nhật' : 'Đăng bài'}
                </button>
              </div>
            </form>
          )}

          {visiblePosts.length === 0 ? (
            <div
              className={`p-6 rounded-xl border text-center text-xs ${
                isDark
                  ? 'bg-slate-950/50 border-slate-800 text-slate-400'
                  : 'bg-slate-50 border-slate-200 text-slate-500'
              }`}
            >
              Chưa có bài đăng thông tin hoặc hình ảnh nào cho giải đấu.
              {isAdmin ? ' Bấm "Đăng thông tin / Hình ảnh" để thêm mới.' : ''}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
              {visiblePosts.map((post) => {
                const isExpanded = Boolean(expandedPostIds[post.id]);
                const hasMore = Boolean(post.detail) || post.summary.length > 120;

                return (
                  <article
                    key={post.id}
                    className={`rounded-2xl border overflow-hidden flex flex-col justify-between ${
                      isDark
                        ? 'bg-slate-950/60 border-slate-800'
                        : 'bg-slate-50/60 border-slate-200'
                    }`}
                  >
                    <div>
                      {post.images.length > 0 && (
                        <div className="relative aspect-[16/10] bg-slate-900 overflow-hidden">
                          <button
                            type="button"
                            onClick={() =>
                              setLightboxState({
                                title: post.title,
                                subtitle: post.createdAt || currentTournament.name,
                                images: post.images,
                                imageIndex: 0,
                              })
                            }
                            className="block w-full h-full text-left"
                          >
                            <img
                              src={post.images[0]}
                              alt={post.title}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover hover:scale-[1.03] transition-transform duration-300"
                            />
                          </button>
                          {post.images.length > 1 && (
                            <span className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-950/80 text-white font-mono-num">
                              {post.images.length} ảnh
                            </span>
                          )}
                        </div>
                      )}

                      <div className="p-4 space-y-2">
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="px-2 py-0.5 rounded-md font-bold bg-orange-500/15 text-orange-500">
                            {post.badge}
                          </span>
                          {post.createdAt && (
                            <span className={`font-mono-num ${mutedText}`}>{post.createdAt}</span>
                          )}
                        </div>

                        <h3 className="font-display text-base font-bold leading-snug">
                          {post.title}
                        </h3>

                        {post.summary && (
                          <p
                            className={`text-xs leading-relaxed ${mutedText} ${
                              isExpanded ? '' : 'line-clamp-3'
                            }`}
                          >
                            {post.summary}
                          </p>
                        )}

                        {isExpanded && post.detail && (
                          <div
                            className={`p-2.5 rounded-xl border text-xs leading-relaxed ${
                              isDark
                                ? 'bg-slate-900 border-slate-800 text-slate-200'
                                : 'bg-white border-slate-200 text-slate-700'
                            }`}
                          >
                            {post.detail}
                          </div>
                        )}

                        {hasMore && (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedPostIds((prev) => ({
                                ...prev,
                                [post.id]: !prev[post.id],
                              }))
                            }
                            className="inline-flex items-center gap-1 text-xs font-bold text-orange-500 hover:text-orange-400"
                          >
                            <span>{isExpanded ? 'Thu gọn' : 'Xem thêm'}</span>
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    <div
                      className={`px-4 py-3 border-t flex items-center justify-between gap-2 ${
                        isDark
                          ? 'border-slate-800 bg-slate-900/70'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      {post.linkUrl ? (
                        <a
                          href={post.linkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-bold text-orange-500 hover:text-orange-400 inline-flex items-center gap-1 truncate"
                        >
                          <span className="truncate">{post.linkLabel || 'Xem liên kết'}</span>
                          <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                        </a>
                      ) : (
                        <span className={`text-[11px] ${mutedText}`}>Ban Tổ Chức</span>
                      )}

                      {isAdmin && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStartEditPost(post)}
                            className={`text-xs font-semibold inline-flex items-center gap-1 ${
                              isDark
                                ? 'text-slate-300 hover:text-orange-400'
                                : 'text-slate-700 hover:text-orange-600'
                            }`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Sửa
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePost(post.id)}
                            className="text-xs font-semibold text-rose-500 hover:text-rose-400 inline-flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Xóa
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    );
  };

  return (
    <div
      className={
        activeTab === 'referee' && isStaff
          ? 'h-[100dvh] flex flex-col bg-slate-950 text-white overflow-hidden pb-11 sm:pb-12 lg:pb-0'
          : isDark
          ? 'min-h-screen flex flex-col bg-slate-950 text-slate-100 pb-16 lg:pb-0'
          : 'min-h-screen flex flex-col bg-[#F8FAFC] text-[#0F172A] pb-16 lg:pb-0'
      }
    >
      {/* TOP BAR CONTRACT */}
      <header
        className={`no-print sticky top-0 z-30 backdrop-blur-xs border-b px-3 sm:px-6 shrink-0 flex items-center justify-between gap-2 sm:gap-8 ${
          isDark
            ? 'bg-slate-900/95 border-slate-800 text-slate-100'
            : 'bg-white/95 border-slate-200 text-slate-900'
        } ${
          activeTab === 'referee' && isStaff
            ? 'h-10 sm:h-12 hide-on-mobile-landscape'
            : 'h-12 sm:h-14'
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
          <span className="font-display text-lg sm:text-2xl font-extrabold tracking-tight group-hover:text-orange-500 transition-colors whitespace-nowrap">
            1986 PICKLEBALL
          </span>
        </a>

        <nav
          className={`hidden lg:flex items-center gap-5 xl:gap-6 text-sm font-medium ${
            isDark ? 'text-slate-300' : 'text-slate-600'
          }`}
        >
          {visibleNavItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                activeTab === item.id
                  ? isDark
                    ? 'border-orange-500 text-white font-semibold'
                    : 'border-orange-600 text-slate-900 font-semibold'
                  : isDark
                  ? 'border-transparent hover:text-white'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={toggleThemeMode}
            title={isDark ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang giao diện Tối'}
            className={`min-h-[34px] px-2.5 py-1.5 text-xs font-bold rounded-lg border transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              isDark
                ? 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200'
            }`}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            <span className="hidden sm:inline">{isDark ? 'Sáng' : 'Tối'}</span>
          </button>

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
              {isAdmin ? (
                <ShieldCheck className="w-4 h-4 shrink-0" />
              ) : (
                <Gavel className="w-4 h-4 shrink-0" />
              )}
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
              className="px-3.5 sm:px-4 py-1.5 sm:py-2 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
            >
              <LogIn className="w-4 h-4 shrink-0" />
              <span>Đăng nhập</span>
            </button>
          )}
        </div>
      </header>

      {/* Secondary Workspace Context Toolbar */}
      <div
        className={`no-print border-b px-2.5 sm:px-6 py-2 shrink-0 ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        } ${activeTab === 'referee' && isStaff ? 'hidden' : ''}`}
      >
        <div className="max-w-7xl mx-auto flex flex-wrap sm:flex-nowrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {appState.tournaments.length > 0 && currentTournament ? (
              <select
                value={currentTournament.id}
                onChange={(e) => setSelectedTournamentId(e.target.value)}
                className={`min-h-[36px] w-full sm:w-auto flex-1 sm:flex-initial px-2.5 sm:px-3 py-1.5 text-xs font-semibold border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 max-w-full sm:max-w-md truncate ${
                  isDark
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-700'
                    : 'bg-slate-100 hover:bg-slate-200/70 text-slate-900 border-slate-200'
                }`}
              >
                {appState.tournaments.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({TOURNAMENT_STATUS_LABELS[t.status]})
                  </option>
                ))}
              </select>
            ) : (
              <span className={`text-xs font-medium truncate ${mutedText}`}>
                Chưa có giải đấu nào đang diễn ra
              </span>
            )}
          </div>

          <div className="flex items-center justify-end gap-1.5 shrink-0">
            {isAdmin && (
              <button
                type="button"
                onClick={handleOpenCreateTournament}
                className="min-h-[34px] px-2.5 py-1 text-xs font-bold text-white bg-slate-900 hover:bg-orange-600 rounded-lg transition-colors flex items-center gap-1 whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tạo giải mới</span>
              </button>
            )}

            {currentTournament && (
              <button
                type="button"
                onClick={() => {
                  setShowNotifDrawer((s) => !s);
                  setReadNotifIds(tournamentNotifications.map((n) => n.id));
                }}
                className={`min-h-[34px] px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 whitespace-nowrap ${
                  isDark
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <Bell className="w-3.5 h-3.5 text-orange-500" />
                <span>{unreadCount > 0 ? `${unreadCount} mới` : tournamentNotifications.length}</span>
              </button>
            )}

            {isAdmin && (
              <button
                type="button"
                onClick={handleRequestResetDemoData}
                title="Làm mới dữ liệu giải đấu (yêu cầu mật khẩu)"
                className={`min-h-[34px] p-1.5 rounded-lg transition-colors ${
                  isDark
                    ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Real-Time Toast Banner */}
      {toastMessage && (
        <div
          className={`no-print fixed bottom-16 lg:bottom-5 right-3 left-3 sm:left-auto sm:right-5 z-50 sm:max-w-md border rounded-xl p-3.5 shadow-xl flex items-start gap-2.5 ${
            isDark
              ? 'bg-slate-900 text-white border-slate-700'
              : 'bg-slate-900 text-white border-slate-800'
          }`}
        >
          <CheckCircle2 className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-0.5 min-w-0">
            <div className="font-semibold text-white">{toastMessage.title}</div>
            <div className="text-slate-300">{toastMessage.subtitle}</div>
          </div>
        </div>
      )}

      {/* Notification Slide-Down Panel */}
      {showNotifDrawer && currentTournament && (
        <div
          className={`no-print border-b px-4 sm:px-6 py-4 ${
            isDark
              ? 'bg-slate-950 text-white border-slate-800'
              : 'bg-slate-900 text-white border-slate-800'
          }`}
        >
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
              <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-300">
                Hiện chưa có thông báo nào.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto">
                {tournamentNotifications.slice(0, 6).map((n) => (
                  <div
                    key={n.id}
                    className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs space-y-1"
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
          activeTab === 'referee' && isStaff
            ? 'flex-1 min-h-0 max-w-7xl w-full mx-auto px-1 sm:px-4 py-0.5 sm:py-1.5 flex flex-col overflow-hidden'
            : 'flex-1 max-w-7xl w-full mx-auto px-2.5 sm:px-6 py-3.5 sm:py-6 space-y-5'
        }
      >
        {!currentTournament ? (
          activeTab === 'overview' ? (
            renderTournamentOverviewSection()
          ) : (
            <section className={`border rounded-2xl p-6 text-center text-xs ${surfaceCard} ${mutedText}`}>
              Chưa có giải đấu nào được chọn.
            </section>
          )
        ) : (
          <>
            {/* TAB 1: TRANG CHỦ — CHỈ GIỚI THIỆU THÔNG TIN GIẢI ĐẤU */}
            {activeTab === 'overview' && renderTournamentOverviewSection()}

            {/* TAB 2: LIVE */}
            {activeTab === 'live' && (
              <div className="space-y-5">
                <section
                  className={`border rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 ${surfaceCard}`}
                >
                  <div>
                    <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-500">
                      <Radio className="w-4 h-4" />
                      <span>TRỰC TIẾP SÂN THI ĐẤU</span>
                    </div>
                    <h1 className="font-display text-xl sm:text-2xl font-extrabold mt-0.5">
                      Live Scoreboard — {currentTournament.name}
                    </h1>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono-num">
                    <span className="px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-500 font-bold border border-emerald-500/30">
                      Đang đấu: {liveMatches.length} / {currentTournament.courtsCount} sân
                    </span>
                  </div>
                </section>

                <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                  <div className={`lg:col-span-7 border rounded-xl overflow-hidden ${surfaceCard}`}>
                    <div
                      className={`px-4 sm:px-5 py-3.5 border-b flex items-center justify-between ${
                        isDark ? 'border-slate-800' : 'border-slate-200'
                      }`}
                    >
                      <div>
                        <h2 className="font-display text-base sm:text-lg font-bold tracking-tight uppercase">
                          CÁC TRẬN ĐANG THI ĐẤU TRỰC TIẾP
                        </h2>
                        <p className={`text-xs ${mutedText}`}>
                          Cặp VĐV đứng sân, điểm số và lượt giao bóng cập nhật tức thời
                        </p>
                      </div>
                      {isStaff && (
                        <button
                          type="button"
                          onClick={() => setActiveTab('referee')}
                          className="text-xs font-semibold text-orange-500 hover:text-orange-400 shrink-0"
                        >
                          App Trọng tài →
                        </button>
                      )}
                    </div>

                    <div className="p-4 sm:p-5 space-y-3.5">
                      {liveMatches.length === 0 ? (
                        <div
                          className={`p-6 text-center rounded-xl border space-y-2 ${
                            isDark
                              ? 'bg-slate-950/60 border-slate-800'
                              : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <p className={`text-sm ${mutedText}`}>
                            Hiện chưa có trận nào đang thi đấu trực tiếp trên sân.
                          </p>
                          <button
                            type="button"
                            onClick={() => setActiveTab('schedule')}
                            className="min-h-[36px] px-3.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-orange-600 transition-colors"
                          >
                            Xem lịch thi đấu
                          </button>
                        </div>
                      ) : (
                        liveMatches.map((m) => (
                          <div
                            key={m.id}
                            className={`border rounded-xl p-3.5 sm:p-4 space-y-2.5 ${
                              isDark
                                ? 'border-slate-800 bg-slate-950/60'
                                : 'border-slate-200 bg-slate-50/70'
                            }`}
                          >
                            <div className={`flex flex-wrap items-center justify-between gap-2 text-xs ${mutedText}`}>
                              <div>
                                <span className="font-mono-num font-bold text-orange-500">
                                  SÂN {m.courtNumber} · TRẬN #{m.matchNumber}
                                </span>
                                <span> · </span>
                                <span className="font-semibold">
                                  {m.teamSubCategory || m.division}
                                </span>
                              </div>
                              <span className="font-mono-num font-semibold text-emerald-500">
                                Hô điểm: {formatScoreCallout(m)}
                              </span>
                            </div>

                            <div className="grid grid-cols-12 items-center gap-2 py-1">
                              <div className="col-span-5 min-w-0">
                                <div className="text-sm font-bold truncate">{m.teamAName}</div>
                                {(m.teamAPlayer1 || m.teamAPlayer2) && (
                                  <div className={`text-[11px] truncate ${mutedText}`}>
                                    {m.teamAPlayer1} · {m.teamAPlayer2}
                                  </div>
                                )}
                                <div className="text-[10px] text-orange-500 font-semibold">
                                  {m.servingTeam === 'A'
                                    ? `● Đang giao bóng (Người ${m.serverNumber})`
                                    : 'Đỡ giao bóng'}
                                </div>
                              </div>

                              <div className="col-span-2 text-center font-mono-num text-xl sm:text-2xl font-extrabold">
                                {m.scoreA} : {m.scoreB}
                              </div>

                              <div className="col-span-5 text-right min-w-0">
                                <div className="text-sm font-bold truncate">{m.teamBName}</div>
                                {(m.teamBPlayer1 || m.teamBPlayer2) && (
                                  <div className={`text-[11px] truncate ${mutedText}`}>
                                    {m.teamBPlayer1} · {m.teamBPlayer2}
                                  </div>
                                )}
                                <div className="text-[10px] text-orange-500 font-semibold">
                                  {m.servingTeam === 'B'
                                    ? `● Đang giao bóng (Người ${m.serverNumber})`
                                    : 'Đỡ giao bóng'}
                                </div>
                              </div>
                            </div>

                            {isStaff && (
                              <div
                                className={`pt-2 border-t flex items-center justify-between text-xs ${
                                  isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200/80 text-slate-500'
                                }`}
                              >
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
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className={`lg:col-span-5 border rounded-xl overflow-hidden ${surfaceCard}`}>
                    <div
                      className={`px-4 sm:px-5 py-3.5 border-b flex items-center justify-between ${
                        isDark ? 'border-slate-800' : 'border-slate-200'
                      }`}
                    >
                      <div>
                        <h2 className="font-display text-base sm:text-lg font-bold tracking-tight uppercase">
                          BẢNG XẾP HẠNG THỜI GIAN THỰC
                        </h2>
                        <p className={`text-xs ${mutedText}`}>
                          {currentTournament.divisions[0]
                            ? `Nội dung ${currentTournament.divisions[0]}`
                            : 'Chưa có nội dung thi đấu'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('standings')}
                        className="text-xs font-semibold text-orange-500 hover:text-orange-400"
                      >
                        Chi tiết →
                      </button>
                    </div>

                    <div className={isDark ? 'divide-y divide-slate-800' : 'divide-y divide-slate-200'}>
                      {Object.keys(standingsPreview).length === 0 ? (
                        <div className="p-6 text-center space-y-2.5">
                          <p className={`text-xs ${mutedText}`}>
                            Chưa có dữ liệu bảng xếp hạng cho giải đấu này.
                          </p>
                        </div>
                      ) : (
                        Object.entries(standingsPreview).map(([gName, rows]) => (
                          <div key={gName} className="p-3.5 sm:p-4">
                            <div className={`text-xs font-bold uppercase tracking-wider mb-2 ${mutedText}`}>
                              {gName}
                            </div>
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className={`border-b ${isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                                  <th className="py-1.5 pr-2">#</th>
                                  <th className="py-1.5 px-2">Đội</th>
                                  <th className="py-1.5 px-2 text-right">T-B</th>
                                  <th className="py-1.5 px-2 text-right">Hiệu số</th>
                                  <th className="py-1.5 pl-2 text-right">Điểm</th>
                                </tr>
                              </thead>
                              <tbody className={isDark ? 'divide-y divide-slate-800/70' : 'divide-y divide-slate-100'}>
                                {rows.map((r, i) => (
                                  <tr key={r.teamId}>
                                    <td className="py-2 pr-2 font-mono-num font-bold">{i + 1}</td>
                                    <td className="py-2 px-2 font-semibold truncate max-w-[140px]">
                                      {r.teamName}
                                    </td>
                                    <td className="py-2 px-2 text-right font-mono-num">
                                      {r.wins}-{r.losses}
                                    </td>
                                    <td
                                      className={`py-2 px-2 text-right font-mono-num font-semibold ${
                                        r.pointDiff >= 0 ? 'text-emerald-500' : 'text-rose-500'
                                      }`}
                                    >
                                      {r.pointDiff > 0 ? `+${r.pointDiff}` : r.pointDiff}
                                    </td>
                                    <td className="py-2 pl-2 text-right font-mono-num font-bold text-orange-500">
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

            {activeTab === 'referee' && isStaff && (
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

            {activeTab === 'members' && isStaff && (
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

            {activeTab === 'reports' && isStaff && (
              <AnalyticsReportView
                tournament={currentTournament}
                registrations={tournamentRegistrations}
                matches={tournamentMatches}
              />
            )}
          </>
        )}
      </main>

      {/* Lightbox Modal for Tournament Photos */}
      {lightboxState && (
        <div
          onClick={() => setLightboxState(null)}
          className="no-print fixed inset-0 z-50 bg-slate-950/85 p-3 sm:p-6 flex items-center justify-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl border ${
              isDark
                ? 'bg-slate-900 text-white border-slate-800'
                : 'bg-white text-slate-900 border-slate-200'
            }`}
          >
            <div
              className={`px-4 py-3 flex items-center justify-between gap-2 border-b ${
                isDark
                  ? 'bg-slate-950 border-slate-800 text-white'
                  : 'bg-slate-50 border-slate-200 text-slate-900'
              }`}
            >
              <div className="min-w-0">
                <div className="text-sm font-bold truncate">
                  {lightboxState.title} ({lightboxState.imageIndex + 1}/
                  {lightboxState.images.length})
                </div>
                <div className={`text-xs truncate ${mutedText}`}>{lightboxState.subtitle}</div>
              </div>
              <button
                type="button"
                onClick={() => setLightboxState(null)}
                className={`p-1.5 rounded-lg shrink-0 ${
                  isDark
                    ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div
              className={`flex flex-col items-center justify-center max-h-[75vh] overflow-auto p-3 gap-3 ${
                isDark ? 'bg-slate-950' : 'bg-slate-100'
              }`}
            >
              <img
                src={lightboxState.images[lightboxState.imageIndex]}
                alt={lightboxState.title}
                referrerPolicy="no-referrer"
                className="max-h-[60vh] w-auto object-contain rounded-lg"
              />
              {lightboxState.images.length > 1 && (
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {lightboxState.images.map((thumb, idx) => (
                    <button
                      key={`${lightboxState.title}_thumb_${idx}`}
                      type="button"
                      onClick={() =>
                        setLightboxState({ ...lightboxState, imageIndex: idx })
                      }
                      className={`w-14 h-10 rounded-md overflow-hidden border-2 ${
                        lightboxState.imageIndex === idx
                          ? 'border-orange-500'
                          : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={thumb}
                        alt={`Ảnh ${idx + 1}`}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Password Confirmation Modal for Resetting Data */}
      {showResetPasswordModal && (
        <div
          onClick={() => setShowResetPasswordModal(false)}
          className="no-print fixed inset-0 z-50 bg-slate-950/75 p-4 flex items-center justify-center"
        >
          <form
            key={resetShakeKey}
            onSubmit={handleConfirmResetDemoData}
            onClick={(e) => e.stopPropagation()}
            className={`rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl border ${
              resetShakeKey > 0 ? 'popup-shake' : ''
            } ${surfaceCard}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs font-extrabold uppercase tracking-wider text-rose-500">
                  Xác nhận thao tác nhạy cảm
                </div>
                <h3 className="font-display text-lg font-bold mt-0.5">
                  Làm mới toàn bộ dữ liệu giải đấu?
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowResetPasswordModal(false)}
                className={`p-1 rounded-lg ${
                  isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-400 hover:bg-slate-100'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className={`text-xs leading-relaxed ${mutedText}`}>
              Thao tác này sẽ xóa dữ liệu giải đấu, danh sách VĐV/đội và lịch đấu hiện tại trên
              trình duyệt. Vui lòng nhập mật khẩu Admin để xác nhận.
            </p>

            <div>
              <label className="block text-xs font-semibold mb-1">Mật khẩu xác nhận *</label>
              <input
                type="password"
                autoFocus
                value={resetPasswordInput}
                onChange={(e) => {
                  setResetPasswordInput(e.target.value);
                  if (resetPasswordError) setResetPasswordError(null);
                }}
                placeholder="Nhập mật khẩu Admin..."
                className={`w-full min-h-[38px] px-3 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-2 ${
                  resetPasswordError
                    ? 'border-rose-500 focus:ring-rose-500'
                    : 'focus:ring-rose-500'
                } ${
                  isDark
                    ? 'bg-slate-950 border-slate-700 text-white placeholder:text-slate-500'
                    : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
                }`}
              />
              {resetPasswordError && (
                <p className="text-xs font-semibold text-rose-500 mt-1.5">{resetPasswordError}</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowResetPasswordModal(false)}
                className={`min-h-[38px] px-4 py-2 rounded-xl text-xs font-semibold ${
                  isDark
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                Hủy
              </button>
              <button
                type="submit"
                className="min-h-[38px] px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
              >
                Xác nhận làm mới
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Quiet Footer */}
      <footer
        className={`no-print border-t px-4 sm:px-6 py-4 text-xs ${
          isDark
            ? 'bg-slate-900 border-slate-800 text-slate-400'
            : 'bg-white border-slate-200 text-slate-500'
        } ${activeTab === 'referee' && isStaff ? 'hidden' : ''}`}
      >
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div>
            © 2026 <strong>1986 — Bính Dần Pickleball</strong> · Thông tin & điều hành giải đấu.
          </div>
          <div>
            {isStaff
              ? 'Nhập VĐV & Sắp bảng chủ động · Điều hành bàn trọng tài · Xuất PDF/CSV'
              : 'Thông tin giải đấu · Lịch thi đấu · Tỷ số trực tiếp'}
          </div>
        </div>
      </footer>

      {/* FIXED BOTTOM THUMB-ZONE TAB BAR FOR MOBILE PHONES */}
      <nav
        className={`no-print lg:hidden fixed bottom-0 left-0 right-0 z-40 backdrop-blur-md border-t flex items-center justify-around h-11 sm:h-12 px-1 compact-on-mobile-landscape ${
          isDark ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-slate-200'
        }`}
      >
        {visibleNavItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`min-h-[40px] sm:min-h-[44px] flex-1 min-w-0 flex flex-col items-center justify-center rounded-lg transition-colors ${
                isActive
                  ? 'text-orange-500 font-bold'
                  : isDark
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-500 hover:text-slate-900'
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
          themeMode={themeMode}
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
          themeMode={themeMode}
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateTournament}
        />
      )}
    </div>
  );
}
