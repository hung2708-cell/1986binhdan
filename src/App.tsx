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
  Compass,
  FileText,
  Gavel,
  ImagePlus,
  LayoutDashboard,
  LogIn,
  MapPin,
  Plus,
  RotateCcw,
  ShieldCheck,
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
  | 'schedule'
  | 'referee'
  | 'standings'
  | 'members'
  | 'reports';

type FeedPostKind = 'image' | 'info';

interface HomeGalleryItem {
  id: string;
  kind: FeedPostKind;
  title: string;
  caption: string;
  images: string[];
  createdAt: string;
  createdBy: string;
}

interface CaoBangLandmark {
  id: string;
  name: string;
  area: string;
  tag: string;
  summary: string;
}

const CAO_BANG_LANDMARKS: CaoBangLandmark[] = [
  {
    id: 'ban_gioc',
    name: 'Thác Bản Giốc',
    area: 'Đàm Thủy · Cao Bằng',
    tag: 'Kỳ quan thác nước',
    summary:
      'Một trong những thác nước tự nhiên hùng vĩ bậc nhất Đông Nam Á, tầng tầng bọt trắng đổ xuống giữa núi non biên cương xanh mát.',
  },
  {
    id: 'quay_son',
    name: 'Sông Quây Sơn',
    area: 'Trùng Khánh · Cao Bằng',
    tag: 'Dòng sông ngọc bích',
    summary:
      'Dòng sông trong xanh uốn lượn qua những cánh đồng và thung lũng đá vôi, tạo nên khung cảnh yên bình đặc trưng vùng biên.',
  },
  {
    id: 'thang_hen',
    name: 'Hồ Thang Hen',
    area: 'Trà Lĩnh · Cao Bằng',
    tag: 'Thắng cảnh cao nguyên',
    summary:
      'Quần thể hồ nước tự nhiên nằm giữa rừng núi xanh thẳm, mặt nước phẳng lặng đổi sắc theo mùa quanh năm.',
  },
  {
    id: 'pac_bo',
    name: 'Khu di tích Quốc gia đặc biệt Pác Bó',
    area: 'Trường Hà · Cao Bằng',
    tag: 'Cội nguồn lịch sử',
    summary:
      'Nơi gắn liền với suối Lê-nin trong vắt và núi Các Mác sừng sững, lưu giữ dấu ấn lịch sử hào hùng của dân tộc.',
  },
];

const STORAGE_KEY = 'pickleball_1986_state_v7';
const AUTH_SESSION_KEY = 'pickleball_1986_auth_user_v1';
const ACTIVE_TAB_KEY = 'pickleball_1986_active_tab_v1';
const GALLERY_STORAGE_KEY = 'pickleball_1986_home_gallery_v2';
const LEGACY_GALLERY_KEY = 'pickleball_1986_home_gallery_v1';
const SYNC_CHANNEL = 'pickleball_1986_realtime_channel';

const VALID_TABS: ActiveTab[] = [
  'overview',
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

function loadSavedGallery(): HomeGalleryItem[] {
  try {
    const raw = localStorage.getItem(GALLERY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => ({
          id: String(item.id || ''),
          kind: item.kind === 'info' ? 'info' : 'image',
          title: String(item.title || 'Thông tin từ Ban Tổ Chức'),
          caption: String(item.caption || ''),
          images: Array.isArray(item.images)
            ? item.images.filter(Boolean)
            : item.imageUrl
            ? [String(item.imageUrl)]
            : [],
          createdAt: String(item.createdAt || new Date().toLocaleDateString('vi-VN')),
          createdBy: String(item.createdBy || 'Ban Tổ Chức'),
        }));
      }
    }

    const legacyRaw = localStorage.getItem(LEGACY_GALLERY_KEY);
    if (legacyRaw) {
      const legacyParsed = JSON.parse(legacyRaw);
      if (Array.isArray(legacyParsed)) {
        return legacyParsed.map((item) => ({
          id: String(item.id || ''),
          kind: 'image' as const,
          title: String(item.title || 'Hình ảnh từ Ban Tổ Chức'),
          caption: String(item.caption || ''),
          images: item.imageUrl ? [String(item.imageUrl)] : [],
          createdAt: String(item.createdAt || new Date().toLocaleDateString('vi-VN')),
          createdBy: String(item.createdBy || 'Ban Tổ Chức'),
        }));
      }
    }
    return [];
  } catch {
    return [];
  }
}

function compressImageFileToDataUrl(file: File, maxWidth = 1280, quality = 0.8): Promise<string> {
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
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'manage'>('login');
  const [authReasonMessage, setAuthReasonMessage] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<ActiveTab>(() => loadSavedActiveTab());
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

  // Homepage-only multi-image & info posts state (Admin adds, audience views)
  const [galleryItems, setGalleryItems] = useState<HomeGalleryItem[]>(() => loadSavedGallery());
  const [postKind, setPostKind] = useState<FeedPostKind>('image');
  const [galleryTitle, setGalleryTitle] = useState('');
  const [galleryCaption, setGalleryCaption] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [draftImages, setDraftImages] = useState<string[]>([]);
  const [lightboxState, setLightboxState] = useState<{
    item: HomeGalleryItem;
    imageIndex: number;
  } | null>(null);

  const isStaff = Boolean(currentAccount && isStaffRole(currentAccount.role));
  const isAdmin = currentAccount?.role === 'admin';

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

  const saveGalleryAndSync = (nextGallery: HomeGalleryItem[]) => {
    setGalleryItems(nextGallery);
    try {
      localStorage.setItem(GALLERY_STORAGE_KEY, JSON.stringify(nextGallery));
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel(SYNC_CHANNEL);
        bc.postMessage({ type: 'gallery_sync', gallery: nextGallery });
        bc.close();
      }
    } catch (err) {
      console.warn('Gallery storage warning:', err);
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
      if (event.data?.type === 'gallery_sync' && Array.isArray(event.data.gallery)) {
        setGalleryItems(event.data.gallery);
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

  const handleGalleryFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    try {
      const compressedList: string[] = [];
      for (const file of files) {
        const dataUrl = await compressImageFileToDataUrl(file);
        compressedList.push(dataUrl);
      }
      setDraftImages((prev) => [...prev, ...compressedList]);
      if (!galleryTitle.trim() && files[0]) {
        const cleanName = files[0].name.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ');
        setGalleryTitle(cleanName);
      }
      showToast(
        `Đã thêm ${compressedList.length} ảnh`,
        'Bấm "Đưa lên trang chủ" để xuất bản cho khán giả.',
      );
    } catch {
      showToast('Không thể tải ảnh', 'Vui lòng thử chọn ảnh khác hoặc dán đường dẫn URL ảnh.');
    } finally {
      e.target.value = '';
    }
  };

  const handleAddDraftUrlImage = () => {
    const cleanUrl = urlInput.trim();
    if (!cleanUrl) return;
    setDraftImages((prev) => [...prev, cleanUrl]);
    setUrlInput('');
  };

  const handleRemoveDraftImage = (idx: number) => {
    setDraftImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAddGalleryItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !currentAccount) {
      openLoginWithReason('Vui lòng đăng nhập tài khoản Admin để đăng nội dung lên trang chủ.');
      return;
    }

    const pendingUrl = urlInput.trim();
    const finalImages = pendingUrl ? [...draftImages, pendingUrl] : [...draftImages];
    const cleanTitle = galleryTitle.trim();
    const cleanCaption = galleryCaption.trim();

    if (postKind === 'image' && finalImages.length === 0 && !cleanTitle && !cleanCaption) {
      showToast('Thiếu nội dung', 'Vui lòng chọn ít nhất 1 hình ảnh hoặc nhập nội dung.');
      return;
    }

    if (postKind === 'info' && !cleanTitle && !cleanCaption && finalImages.length === 0) {
      showToast('Thiếu thông tin', 'Vui lòng nhập tiêu đề hoặc nội dung thông tin.');
      return;
    }

    const newItem: HomeGalleryItem = {
      id: `post_${Date.now().toString(36)}`,
      kind: postKind,
      title:
        cleanTitle ||
        (postKind === 'info' ? 'Thông tin từ Ban Tổ Chức' : 'Hình ảnh sự kiện'),
      caption: cleanCaption,
      images: finalImages,
      createdAt: new Date().toLocaleDateString('vi-VN'),
      createdBy: currentAccount.displayName,
    };

    saveGalleryAndSync([newItem, ...galleryItems]);
    setGalleryTitle('');
    setGalleryCaption('');
    setUrlInput('');
    setDraftImages([]);
    showToast(
      postKind === 'info' ? 'Đã đăng thông tin lên trang chủ' : 'Đã đăng hình ảnh lên trang chủ',
      `"${newItem.title}" đã hiển thị trên trang chủ.`,
    );
  };

  const handleDeleteGalleryItem = (id: string) => {
    if (!isAdmin) {
      openLoginWithReason('Chỉ tài khoản Admin mới có thể xóa nội dung trên trang chủ.');
      return;
    }
    const target = galleryItems.find((item) => item.id === id);
    saveGalleryAndSync(galleryItems.filter((item) => item.id !== id));
    if (lightboxState?.item.id === id) {
      setLightboxState(null);
    }
    if (target) {
      showToast('Đã gỡ mục khỏi trang chủ', target.title);
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
    setSelectedTournamentId('');
    setActiveTab('overview');
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

  const renderHomeFeedAndCaoBangSection = () => (
    <div className="space-y-5">
      {/* SportConnect-style Feed & Media Showcase (Homepage only) */}
      <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-orange-600">
              BẢNG TIN & HÌNH ẢNH SỰ KIỆN
            </div>
            <h2 className="font-display text-lg sm:text-xl font-extrabold tracking-tight text-slate-900">
              Cập nhật & Hình ảnh nổi bật
            </h2>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 font-mono-num">
            {galleryItems.length} mục
          </span>
        </div>

        {isAdmin && (
          <form
            onSubmit={handleAddGalleryItem}
            className="p-4 rounded-xl bg-slate-50/90 border border-slate-200 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <ImagePlus className="w-4 h-4 text-orange-600" />
                Đăng nhiều hình ảnh hoặc thông tin mới
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPostKind('image')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors ${
                    postKind === 'image'
                      ? 'bg-orange-600 text-white border-orange-600'
                      : 'bg-white text-slate-700 border-slate-300'
                  }`}
                >
                  Nhiều hình ảnh
                </button>
                <button
                  type="button"
                  onClick={() => setPostKind('info')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors ${
                    postKind === 'info'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-300'
                  }`}
                >
                  Thông tin / Bản tin
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tiêu đề
                </label>
                <input
                  type="text"
                  value={galleryTitle}
                  onChange={(e) => setGalleryTitle(e.target.value)}
                  placeholder={
                    postKind === 'info'
                      ? 'VD: Lịch tập trung & thông báo từ Ban Tổ Chức'
                      : 'VD: Khoảnh khắc thi đấu & không gian cụm sân'
                  }
                  className="w-full min-h-[38px] px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Chọn nhiều ảnh từ máy hoặc thêm link URL ảnh
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddDraftUrlImage();
                      }
                    }}
                    placeholder="Dán link URL ảnh rồi bấm + Link"
                    className="flex-1 min-w-0 min-h-[38px] px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddDraftUrlImage}
                    className="min-h-[38px] px-2.5 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold shrink-0"
                  >
                    + Link
                  </button>
                  <label className="min-h-[38px] px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-orange-600 text-white text-xs font-semibold cursor-pointer flex items-center shrink-0 transition-colors">
                    Chọn nhiều ảnh
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleGalleryFilesChange}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nội dung thông tin / Chú thích
                </label>
                <textarea
                  rows={3}
                  value={galleryCaption}
                  onChange={(e) => setGalleryCaption(e.target.value)}
                  placeholder="Nhập thông tin chi tiết, thông báo hoặc ghi chú hiển thị cho khán giả..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                />
              </div>
            </div>

            {draftImages.length > 0 && (
              <div className="pt-1 space-y-2">
                <div className="text-xs font-semibold text-slate-700">
                  Ảnh đã chọn ({draftImages.length} ảnh):
                </div>
                <div className="flex flex-wrap gap-2">
                  {draftImages.map((src, idx) => (
                    <div
                      key={`${idx}_${src.slice(0, 24)}`}
                      className="relative w-20 h-16 rounded-lg overflow-hidden border border-slate-300 bg-white"
                    >
                      <img
                        src={src}
                        alt={`Ảnh xem trước ${idx + 1}`}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveDraftImage(idx)}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-slate-950/80 text-white text-[11px] flex items-center justify-center hover:bg-rose-600"
                        title="Xóa ảnh này"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                className="min-h-[38px] px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Đưa lên trang chủ
              </button>
            </div>
          </form>
        )}

        {galleryItems.length === 0 ? (
          <div className="p-6 text-center rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
            Chưa có hình ảnh hoặc thông tin nào được đăng.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {galleryItems.map((item) => (
              <article
                key={item.id}
                className="rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors overflow-hidden flex flex-col justify-between"
              >
                <div>
                  {item.images.length > 0 && (
                    <div
                      className={`grid gap-0.5 bg-slate-100 ${
                        item.images.length === 1
                          ? 'grid-cols-1'
                          : item.images.length === 2
                          ? 'grid-cols-2'
                          : 'grid-cols-3'
                      }`}
                    >
                      {item.images.map((imgSrc, imgIdx) => (
                        <button
                          key={`${item.id}_img_${imgIdx}`}
                          type="button"
                          onClick={() => setLightboxState({ item, imageIndex: imgIdx })}
                          className={`block w-full overflow-hidden text-left ${
                            item.images.length === 1 ? 'aspect-video' : 'aspect-square'
                          }`}
                        >
                          <img
                            src={imgSrc}
                            alt={`${item.title} ${imgIdx + 1}`}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover hover:scale-[1.03] transition-transform"
                          />
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="p-4 space-y-1.5">
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-orange-50 text-orange-700">
                      {item.kind === 'info' ? (
                        <>
                          <FileText className="w-3 h-3" />
                          <span>Thông tin</span>
                        </>
                      ) : (
                        <>
                          <ImagePlus className="w-3 h-3" />
                          <span>
                            {item.images.length > 1
                              ? `${item.images.length} hình ảnh`
                              : 'Hình ảnh'}
                          </span>
                        </>
                      )}
                    </div>

                    <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                      {item.title}
                    </h3>

                    {item.caption && (
                      <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                        {item.caption}
                      </p>
                    )}
                  </div>
                </div>

                <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="font-mono-num">{item.createdAt}</span>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => handleDeleteGalleryItem(item.id)}
                      className="text-rose-600 hover:text-rose-700 font-semibold inline-flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Xóa
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Cao Bang Destination Spotlight (Homepage only) */}
      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950 text-white px-5 py-5 sm:px-6 sm:py-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
              <Compass className="w-3.5 h-3.5" />
              <span>Khám phá điểm đến · Non nước Cao Bằng</span>
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-extrabold tracking-tight">
              Quê hương Cao Bằng — Non xanh nước biếc, đậm đà bản sắc
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Vùng đất miền núi phía Bắc nổi tiếng với Công viên địa chất toàn cầu UNESCO, những dòng thác hùng vĩ, hồ nước cao nguyên thơ mộng và các địa danh lịch sử giàu giá trị.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-emerald-200 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 shrink-0 self-start md:self-center">
            <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Cao Bằng · Việt Nam</span>
          </div>
        </div>

        <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50/40">
          {CAO_BANG_LANDMARKS.map((spot) => (
            <div
              key={spot.id}
              className="rounded-xl bg-white border border-slate-200 hover:border-emerald-400/80 transition-colors p-4 flex flex-col justify-between gap-3"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700">
                    {spot.tag}
                  </span>
                </div>
                <h3 className="font-display text-base font-bold text-slate-900">
                  {spot.name}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {spot.summary}
                </p>
              </div>
              <div className="pt-2.5 border-t border-slate-100 flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate">{spot.area}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );

  return (
    <div
      className={
        activeTab === 'referee' && isStaff
          ? 'h-[100dvh] flex flex-col bg-slate-950 text-[#0F172A] overflow-hidden pb-11 sm:pb-12 lg:pb-0'
          : 'min-h-screen flex flex-col bg-[#F8FAFC] text-[#0F172A] pb-16 lg:pb-0'
      }
    >
      {/* TOP BAR CONTRACT */}
      <header
        className={`no-print sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-slate-200 px-3 sm:px-6 shrink-0 flex items-center justify-between gap-2 sm:gap-8 ${
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
          <span className="font-display text-lg sm:text-2xl font-extrabold tracking-tight text-slate-900 group-hover:text-orange-600 transition-colors whitespace-nowrap">
            1986 PICKLEBALL
          </span>
        </a>

        <nav className="hidden lg:flex items-center gap-5 xl:gap-6 text-sm font-medium text-slate-600">
          {visibleNavItems.map((item) => (
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
          activeTab === 'referee' && isStaff ? 'hidden' : ''
        }`}
      >
        <div className="max-w-7xl mx-auto flex flex-wrap sm:flex-nowrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {appState.tournaments.length > 0 && currentTournament ? (
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
            ) : (
              <span className="text-xs font-medium text-slate-500 truncate">
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
                className="min-h-[34px] px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1 whitespace-nowrap"
              >
                <Bell className="w-3.5 h-3.5 text-orange-600" />
                <span>{unreadCount > 0 ? `${unreadCount} mới` : tournamentNotifications.length}</span>
              </button>
            )}

            {isAdmin && (
              <button
                type="button"
                onClick={handleResetDemoData}
                title="Làm mới dữ liệu giải đấu"
                className="min-h-[34px] p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
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
      {showNotifDrawer && currentTournament && (
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
                Hiện chưa có thông báo nào.
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
          activeTab === 'referee' && isStaff
            ? 'flex-1 min-h-0 max-w-7xl w-full mx-auto px-1 sm:px-4 py-0.5 sm:py-1.5 flex flex-col overflow-hidden'
            : 'flex-1 max-w-7xl w-full mx-auto px-2.5 sm:px-6 py-3.5 sm:py-6 space-y-4'
        }
      >
        {!currentTournament ? (
          activeTab === 'overview' ? (
            <div className="space-y-5">
              {isAdmin && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleOpenCreateTournament}
                    className="min-h-[40px] px-4 py-2 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-xl inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    Tạo giải đấu mới
                  </button>
                </div>
              )}
              {renderHomeFeedAndCaoBangSection()}
            </div>
          ) : (
            <section className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-xs text-slate-500">
              Chưa có giải đấu nào được chọn.
            </section>
          )
        ) : (
          <>
            {activeTab === 'overview' && (
              <div className="space-y-5">
                <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                  <div className="lg:col-span-8 flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                        <span className="font-semibold text-orange-600 uppercase tracking-wider">
                          HỆ THỐNG GIẢI ĐẤU PICKLEBALL 1986
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

                    {isStaff && (
                      <div className="grid grid-cols-1 sm:flex flex-wrap items-center gap-2.5 pt-1">
                        <button
                          type="button"
                          onClick={() => setActiveTab('referee')}
                          className="min-h-[44px] px-4 py-2.5 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                          <Gavel className="w-4 h-4" />
                          Mở App Trọng Tài (Sân, Bốc thăm & Chọn VĐV)
                        </button>

                        {isAdmin && (
                          <>
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
                          </>
                        )}
                      </div>
                    )}
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
                        {isStaff
                          ? 'Nhập VĐV chủ động · Tự sắp xếp bảng thi đấu · Điều hành bàn trọng tài'
                          : 'Theo dõi lịch thi đấu, tỷ số trực tiếp và bảng xếp hạng giải đấu'}
                      </p>
                    </div>
                    <div className="w-full pt-2.5 border-t border-slate-800 grid grid-cols-2 gap-2 font-mono-num text-xs">
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
                      {isStaff ? 'Sắp xếp thủ công theo từng VĐV/đội' : 'Cập nhật theo giải đấu'}
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
                      {isStaff && (
                        <button
                          type="button"
                          onClick={() => setActiveTab('referee')}
                          className="text-xs font-semibold text-orange-600 hover:text-orange-700 shrink-0"
                        >
                          App Trọng tài →
                        </button>
                      )}
                    </div>

                    <div className="p-4 sm:p-5 space-y-3.5">
                      {liveMatches.length === 0 ? (
                        <div className="p-6 text-center bg-slate-50 rounded-xl border border-slate-200">
                          <p className="text-sm text-slate-600">
                            Hiện chưa có trận nào đang thi đấu.
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

                            {isStaff && (
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
                            )}
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
                            : 'Chưa có nội dung thi đấu'}
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
                            Chưa có dữ liệu bảng xếp hạng cho giải đấu này.
                          </p>
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
                        DANH SÁCH GIẢI ĐẤU PICKLEBALL 1986
                      </h2>
                      <p className="text-xs text-slate-500">
                        Chọn giải đấu để xem lịch thi đấu và bảng xếp hạng
                      </p>
                    </div>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={handleOpenCreateTournament}
                        className="px-3 py-1.5 text-xs font-semibold text-orange-600 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors"
                      >
                        + Thêm giải đấu mới
                      </button>
                    )}
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

                {renderHomeFeedAndCaoBangSection()}
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

      {/* Lightbox Modal for Multi-Image Preview */}
      {lightboxState && (
        <div
          onClick={() => setLightboxState(null)}
          className="no-print fixed inset-0 z-50 bg-slate-950/85 p-3 sm:p-6 flex items-center justify-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl"
          >
            <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-bold truncate">
                  {lightboxState.item.title} ({lightboxState.imageIndex + 1}/
                  {lightboxState.item.images.length})
                </div>
                {lightboxState.item.caption && (
                  <div className="text-xs text-slate-300 truncate">{lightboxState.item.caption}</div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setLightboxState(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-slate-950 flex flex-col items-center justify-center max-h-[75vh] overflow-auto p-3 gap-3">
              <img
                src={lightboxState.item.images[lightboxState.imageIndex]}
                alt={lightboxState.item.title}
                referrerPolicy="no-referrer"
                className="max-h-[60vh] w-auto object-contain rounded-lg"
              />
              {lightboxState.item.images.length > 1 && (
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {lightboxState.item.images.map((thumb, idx) => (
                    <button
                      key={`${lightboxState.item.id}_thumb_${idx}`}
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

      {/* Quiet Footer */}
      <footer
        className={`no-print bg-white border-t border-slate-200 px-4 sm:px-6 py-4 text-xs text-slate-500 ${
          activeTab === 'referee' && isStaff ? 'hidden' : ''
        }`}
      >
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div>
            © 2026 <strong className="text-slate-800">1986 — Bính Dần Pickleball</strong> · Hệ thống giải đấu Pickleball 1986.
          </div>
          <div>
            {isStaff
              ? 'Nhập VĐV & Sắp bảng chủ động · Điều hành bàn trọng tài · Xuất PDF/CSV'
              : 'Lịch thi đấu · Tỷ số trực tiếp · Bảng xếp hạng'}
          </div>
        </div>
      </footer>

      {/* FIXED BOTTOM THUMB-ZONE TAB BAR FOR MOBILE PHONES */}
      <nav
        className={`no-print lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 grid items-center h-11 sm:h-12 px-1 compact-on-mobile-landscape ${
          visibleNavItems.length <= 3 ? 'grid-cols-3' : 'grid-cols-6'
        }`}
      >
        {visibleNavItems.map((item) => {
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
