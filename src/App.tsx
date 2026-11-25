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
  ExternalLink,
  Gavel,
  Home,
  ImagePlus,
  LogIn,
  MapPin,
  Pencil,
  Plus,
  Radio,
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
  | 'live'
  | 'schedule'
  | 'referee'
  | 'standings'
  | 'members'
  | 'reports';

interface LandmarkLink {
  label: string;
  url: string;
}

interface CaoBangLandmark {
  id: string;
  name: string;
  area: string;
  tag: string;
  summary: string;
  links: LandmarkLink[];
  images: string[];
}

function createTravelPlaceholderSvg(title: string, tag: string, accentHex: string): string {
  const safeTitle = title.replace(/[<>&"]/g, '');
  const safeTag = tag.replace(/[<>&"]/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#0f172a"/>
        <stop offset="55%" stop-color="#1e293b"/>
        <stop offset="100%" stop-color="${accentHex}"/>
      </linearGradient>
    </defs>
    <rect width="800" height="500" fill="url(#bg)"/>
    <path d="M0 370 Q180 290 360 365 T800 340 L800 500 L0 500 Z" fill="#064e3b" opacity="0.55"/>
    <path d="M0 405 Q240 335 470 400 T800 385 L800 500 L0 500 Z" fill="#022c22" opacity="0.7"/>
    <rect x="36" y="36" width="240" height="34" rx="17" fill="#ffffff" fill-opacity="0.14"/>
    <text x="54" y="58" fill="#a7f3d0" font-family="system-ui, sans-serif" font-size="14" font-weight="700" letter-spacing="1">${safeTag}</text>
    <text x="36" y="428" fill="#ffffff" font-family="system-ui, sans-serif" font-size="32" font-weight="800">${safeTitle}</text>
    <text x="36" y="460" fill="#cbd5e1" font-family="system-ui, sans-serif" font-size="16">Công viên địa chất toàn cầu UNESCO · Cao Bằng</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const DEFAULT_CAO_BANG_LANDMARKS: CaoBangLandmark[] = [
  {
    id: 'ban_gioc',
    name: 'Thác Bản Giốc',
    area: 'Đàm Thủy · Cao Bằng',
    tag: 'Kỳ quan thác nước',
    summary:
      'Một trong những thác nước tự nhiên hùng vĩ bậc nhất Đông Nam Á, tầng tầng bọt trắng đổ xuống giữa núi non biên cương xanh mát.',
    links: [
      {
        label: 'Bản đồ',
        url: 'https://www.google.com/maps/search/?api=1&query=Thac+Ban+Gioc+Cao+Bang',
      },
      {
        label: 'Cẩm nang',
        url: 'https://ecotour.com.vn/dia-diem-du-lich-cao-bang-2',
      },
    ],
    images: [createTravelPlaceholderSvg('Thác Bản Giốc', 'KỲ QUAN THÁC NƯỚC', '#0d9488')],
  },
  {
    id: 'nguom_ngao',
    name: 'Động Ngườm Ngao',
    area: 'Đàm Thủy · Cao Bằng',
    tag: 'Hang động thạch nhũ',
    summary:
      'Hang động đá vôi kỳ ảo dài khoảng 2 km với hệ thống nhũ đá, măng đá lấp lánh nhiều hình thù độc đáo.',
    links: [
      {
        label: 'Bản đồ',
        url: 'https://www.google.com/maps/search/?api=1&query=Dong+Nguom+Ngao+Cao+Bang',
      },
      {
        label: 'Khám phá',
        url: 'https://www.dulichvtv.com/check-in-cao-bang/',
      },
    ],
    images: [createTravelPlaceholderSvg('Động Ngườm Ngao', 'HANG ĐỘNG THẠCH NHŨ', '#0e7490')],
  },
  {
    id: 'nui_mat_than',
    name: 'Núi Mắt Thần (Núi Thủng)',
    area: 'Quảng Hòa · Cao Bằng',
    tag: 'Thảo nguyên & check-in',
    summary:
      'Khối núi đá vôi có vòm thủng khổng lồ xuyên qua lòng núi giữa thung lũng xanh mát, điểm dã ngoại và chụp ảnh nổi tiếng.',
    links: [
      {
        label: 'Bản đồ',
        url: 'https://www.google.com/maps/search/?api=1&query=Nui+Mat+Than+Cao+Bang',
      },
      {
        label: 'Check-in',
        url: 'https://www.dulichvtv.com/check-in-cao-bang/',
      },
    ],
    images: [createTravelPlaceholderSvg('Núi Mắt Thần', 'THẢO NGUYÊN & CHECK-IN', '#059669')],
  },
  {
    id: 'deo_ma_phuc',
    name: 'Đèo Mã Phục',
    area: 'Quốc lộ 3 · Cao Bằng',
    tag: 'Cung đèo ngoạn mục',
    summary:
      'Cung đèo uốn lượn qua nhiều tầng dốc giữa hai dãy núi đá vôi sừng sững, mở ra tầm nhìn đẹp bao quát vùng núi Cao Bằng.',
    links: [
      {
        label: 'Bản đồ',
        url: 'https://www.google.com/maps/search/?api=1&query=Deo+Ma+Phuc+Cao+Bang',
      },
    ],
    images: [createTravelPlaceholderSvg('Đèo Mã Phục', 'CUNG ĐÈO NGOẠN MỤC', '#0284c7')],
  },
  {
    id: 'khuoi_ky',
    name: 'Làng đá cổ Khuổi Ky',
    area: 'Đàm Thủy · Cao Bằng',
    tag: 'Bản sắc văn hóa Tày',
    summary:
      'Ngôi làng cổ trăm năm với những ngôi nhà sàn đá đặc trưng của người Tày, lưu giữ nét kiến trúc và đời sống bản địa.',
    links: [
      {
        label: 'Bản đồ',
        url: 'https://www.google.com/maps/search/?api=1&query=Lang+da+Khuoi+Ky+Cao+Bang',
      },
    ],
    images: [createTravelPlaceholderSvg('Làng đá Khuổi Ky', 'BẢN SẮC VĂN HÓA TÀY', '#b45309')],
  },
  {
    id: 'phia_oac',
    name: 'Phia Oắc – Phia Đén',
    area: 'Nguyên Bình · Cao Bằng',
    tag: 'Rừng rêu & săn mây',
    summary:
      'Vùng núi cao mát mẻ quanh năm với rừng nguyên sinh, thảm rêu xanh và khung cảnh săn mây ấn tượng phía Tây Cao Bằng.',
    links: [
      {
        label: 'Bản đồ',
        url: 'https://www.google.com/maps/search/?api=1&query=Phia+Oac+Cao+Bang',
      },
    ],
    images: [createTravelPlaceholderSvg('Phia Oắc – Phia Đén', 'RỪNG RÊU & SĂN MÂY', '#047857')],
  },
  {
    id: 'thang_hen',
    name: 'Hồ Thang Hen',
    area: 'Trà Lĩnh / Quảng Hòa · Cao Bằng',
    tag: 'Thắng cảnh cao nguyên',
    summary:
      'Quần thể hồ nước tự nhiên giữa rừng núi xanh thẳm, mặt nước phẳng lặng thơ mộng quanh năm.',
    links: [
      {
        label: 'Bản đồ',
        url: 'https://www.google.com/maps/search/?api=1&query=Ho+Thang+Hen+Cao+Bang',
      },
    ],
    images: [createTravelPlaceholderSvg('Hồ Thang Hen', 'THẮNG CẢNH CAO NGUYÊN', '#0d9488')],
  },
  {
    id: 'pac_bo',
    name: 'Khu di tích Quốc gia đặc biệt Pác Bó',
    area: 'Trường Hà · Cao Bằng',
    tag: 'Cội nguồn lịch sử',
    summary:
      'Quần thể di tích gắn liền với suối Lê-nin trong xanh và núi Các Mác, mang đậm dấu ấn lịch sử cách mạng.',
    links: [
      {
        label: 'Bản đồ',
        url: 'https://www.google.com/maps/search/?api=1&query=Khu+di+tich+Pac+Bo+Cao+Bang',
      },
    ],
    images: [createTravelPlaceholderSvg('Khu di tích Pác Bó', 'CỘI NGUỒN LỊCH SỬ', '#15803d')],
  },
];

const STORAGE_KEY = 'pickleball_1986_state_v7';
const AUTH_SESSION_KEY = 'pickleball_1986_auth_user_v1';
const ACTIVE_TAB_KEY = 'pickleball_1986_active_tab_v1';
const CAO_BANG_STORAGE_KEY = 'pickleball_1986_caobang_travel_v2';
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

function loadSavedCaoBangLandmarks(): CaoBangLandmark[] {
  try {
    const raw = localStorage.getItem(CAO_BANG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item, idx) => {
          const name = String(item.name || 'Địa danh Cao Bằng');
          const tag = String(item.tag || 'Điểm đến nổi bật');
          const imgs = Array.isArray(item.images)
            ? item.images.filter(Boolean)
            : item.imageUrl
            ? [String(item.imageUrl)]
            : [];
          const normalizedLinks: LandmarkLink[] = Array.isArray(item.links)
            ? item.links
                .map((l: { label?: string; url?: string }) => ({
                  label: String(l?.label || 'Xem liên kết').trim() || 'Xem liên kết',
                  url: normalizeExternalUrl(String(l?.url || '')),
                }))
                .filter((l: LandmarkLink) => Boolean(l.url))
            : item.linkUrl
            ? [
                {
                  label: String(item.linkLabel || 'Xem chi tiết').trim() || 'Xem chi tiết',
                  url: normalizeExternalUrl(String(item.linkUrl)),
                },
              ].filter((l) => Boolean(l.url))
            : [];

          return {
            id: String(item.id || `spot_${idx}`),
            name,
            area: String(item.area || 'Cao Bằng'),
            tag,
            summary: String(item.summary || ''),
            links: normalizedLinks,
            images:
              imgs.length > 0
                ? imgs
                : [createTravelPlaceholderSvg(name, tag.toUpperCase(), '#059669')],
          };
        });
      }
    }
    return DEFAULT_CAO_BANG_LANDMARKS;
  } catch {
    return DEFAULT_CAO_BANG_LANDMARKS;
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

  // Homepage-only Cao Bang travel showcase state (Admin adds/edits/deletes)
  const [landmarks, setLandmarks] = useState<CaoBangLandmark[]>(() =>
    loadSavedCaoBangLandmarks(),
  );
  const [editingLandmarkId, setEditingLandmarkId] = useState<string | null>(null);
  const [showLandmarkForm, setShowLandmarkForm] = useState(false);
  const [spotName, setSpotName] = useState('');
  const [spotArea, setSpotArea] = useState('');
  const [spotTag, setSpotTag] = useState('Điểm đến nổi bật');
  const [spotSummary, setSpotSummary] = useState('');
  const [spotLinks, setSpotLinks] = useState<LandmarkLink[]>([]);
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [spotUrlInput, setSpotUrlInput] = useState('');
  const [spotDraftImages, setSpotDraftImages] = useState<string[]>([]);

  const [lightboxState, setLightboxState] = useState<{
    landmark: CaoBangLandmark;
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

  const saveLandmarksAndSync = (nextSpots: CaoBangLandmark[]) => {
    setLandmarks(nextSpots);
    try {
      localStorage.setItem(CAO_BANG_STORAGE_KEY, JSON.stringify(nextSpots));
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel(SYNC_CHANNEL);
        bc.postMessage({ type: 'caobang_sync', landmarks: nextSpots });
        bc.close();
      }
    } catch (err) {
      console.warn('Cao Bang storage warning:', err);
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
      if (event.data?.type === 'caobang_sync' && Array.isArray(event.data.landmarks)) {
        setLandmarks(event.data.landmarks);
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

  const resetLandmarkForm = () => {
    setEditingLandmarkId(null);
    setSpotName('');
    setSpotArea('');
    setSpotTag('Điểm đến nổi bật');
    setSpotSummary('');
    setSpotLinks([]);
    setNewLinkLabel('');
    setNewLinkUrl('');
    setSpotUrlInput('');
    setSpotDraftImages([]);
    setShowLandmarkForm(false);
  };

  const handleStartAddLandmark = () => {
    if (!isAdmin) {
      openLoginWithReason('Vui lòng đăng nhập tài khoản Admin để thêm địa danh Cao Bằng.');
      return;
    }
    setEditingLandmarkId(null);
    setSpotName('');
    setSpotArea('Cao Bằng');
    setSpotTag('Điểm đến nổi bật');
    setSpotSummary('');
    setSpotLinks([]);
    setNewLinkLabel('Bản đồ');
    setNewLinkUrl('');
    setSpotUrlInput('');
    setSpotDraftImages([]);
    setShowLandmarkForm(true);
  };

  const handleStartEditLandmark = (spot: CaoBangLandmark) => {
    if (!isAdmin) {
      openLoginWithReason('Vui lòng đăng nhập tài khoản Admin để chỉnh sửa nội dung Cao Bằng.');
      return;
    }
    setEditingLandmarkId(spot.id);
    setSpotName(spot.name);
    setSpotArea(spot.area);
    setSpotTag(spot.tag);
    setSpotSummary(spot.summary);
    setSpotLinks(spot.links || []);
    setNewLinkLabel('');
    setNewLinkUrl('');
    setSpotUrlInput('');
    setSpotDraftImages(spot.images || []);
    setShowLandmarkForm(true);
  };

  const handleAddLinkToForm = () => {
    const cleanUrl = normalizeExternalUrl(newLinkUrl);
    if (!cleanUrl) return;
    const cleanLabel = newLinkLabel.trim() || `Liên kết ${spotLinks.length + 1}`;
    setSpotLinks((prev) => [...prev, { label: cleanLabel, url: cleanUrl }]);
    setNewLinkLabel('');
    setNewLinkUrl('');
  };

  const handleRemoveLinkFromForm = (idx: number) => {
    setSpotLinks((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSpotFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    try {
      const compressed: string[] = [];
      for (const file of files) {
        const dataUrl = await compressImageFileToDataUrl(file);
        compressed.push(dataUrl);
      }
      setSpotDraftImages((prev) => [...prev, ...compressed]);
      showToast(`Đã thêm ${compressed.length} ảnh`, 'Ảnh đã sẵn sàng trong bài quảng bá Cao Bằng.');
    } catch {
      showToast('Không thể đọc ảnh', 'Vui lòng chọn ảnh khác hoặc dán đường dẫn URL ảnh.');
    } finally {
      e.target.value = '';
    }
  };

  const handleAddSpotUrlImage = () => {
    const clean = spotUrlInput.trim();
    if (!clean) return;
    setSpotDraftImages((prev) => [...prev, clean]);
    setSpotUrlInput('');
  };

  const handleRemoveSpotDraftImage = (idx: number) => {
    setSpotDraftImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSaveLandmark = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !currentAccount) {
      openLoginWithReason('Vui lòng đăng nhập tài khoản Admin để lưu nội dung Cao Bằng.');
      return;
    }

    const cleanName = spotName.trim();
    const cleanArea = spotArea.trim() || 'Cao Bằng';
    const cleanTag = spotTag.trim() || 'Điểm đến nổi bật';
    const cleanSummary = spotSummary.trim();

    if (!cleanName) {
      showToast('Thiếu tên địa danh', 'Vui lòng nhập tên địa danh hoặc nội dung quảng bá.');
      return;
    }

    const pendingLink = newLinkUrl.trim()
      ? [
          {
            label: newLinkLabel.trim() || `Liên kết ${spotLinks.length + 1}`,
            url: normalizeExternalUrl(newLinkUrl),
          },
        ]
      : [];

    const finalLinks = [...spotLinks, ...pendingLink]
      .map((l) => ({
        label: l.label.trim() || 'Xem liên kết',
        url: normalizeExternalUrl(l.url),
      }))
      .filter((l) => Boolean(l.url));

    const pendingUrl = spotUrlInput.trim();
    const combinedImages = pendingUrl ? [...spotDraftImages, pendingUrl] : [...spotDraftImages];
    const finalImages =
      combinedImages.length > 0
        ? combinedImages
        : [createTravelPlaceholderSvg(cleanName, cleanTag.toUpperCase(), '#059669')];

    if (editingLandmarkId) {
      const updated = landmarks.map((item) =>
        item.id === editingLandmarkId
          ? {
              ...item,
              name: cleanName,
              area: cleanArea,
              tag: cleanTag,
              summary: cleanSummary,
              links: finalLinks,
              images: finalImages,
            }
          : item,
      );
      saveLandmarksAndSync(updated);
      showToast('Đã cập nhật địa danh', `"${cleanName}" đã được lưu thay đổi.`);
    } else {
      const newSpot: CaoBangLandmark = {
        id: `spot_${Date.now().toString(36)}`,
        name: cleanName,
        area: cleanArea,
        tag: cleanTag,
        summary: cleanSummary,
        links: finalLinks,
        images: finalImages,
      };
      saveLandmarksAndSync([newSpot, ...landmarks]);
      showToast('Đã thêm địa danh Cao Bằng', `"${cleanName}" đã hiển thị ở mục du lịch.`);
    }

    resetLandmarkForm();
  };

  const handleDeleteLandmark = (id: string) => {
    if (!isAdmin) {
      openLoginWithReason('Chỉ tài khoản Admin mới có quyền xóa địa danh.');
      return;
    }
    const target = landmarks.find((item) => item.id === id);
    saveLandmarksAndSync(landmarks.filter((item) => item.id !== id));
    if (editingLandmarkId === id) {
      resetLandmarkForm();
    }
    if (lightboxState?.landmark.id === id) {
      setLightboxState(null);
    }
    if (target) {
      showToast('Đã xóa địa danh', target.name);
    }
  };

  const handleRestoreDefaultLandmarks = () => {
    if (!isAdmin) {
      openLoginWithReason('Chỉ tài khoản Admin mới có thể khôi phục danh sách địa danh mặc định.');
      return;
    }
    saveLandmarksAndSync(DEFAULT_CAO_BANG_LANDMARKS);
    resetLandmarkForm();
    showToast('Đã khôi phục địa danh mặc định', 'Danh sách các điểm đến nổi bật Cao Bằng đã sẵn sàng.');
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

  const renderCaoBangTravelSection = () => (
    <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      {/* Travel Banner Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950 text-white px-5 py-5 sm:px-6 sm:py-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
            <Compass className="w-3.5 h-3.5" />
            <span>Cẩm nang du lịch · Quê hương Cao Bằng</span>
          </div>
          <h2 className="font-display text-xl sm:text-2xl font-extrabold tracking-tight">
            Khám phá non nước Cao Bằng — Điểm hẹn du lịch & thể thao
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Gợi ý các địa danh nổi tiếng, cảnh đẹp và điểm tham quan đáng trải nghiệm tại Cao Bằng dành cho VĐV, cổ động viên và du khách.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {isAdmin && (
            <>
              <button
                type="button"
                onClick={handleStartAddLandmark}
                className="min-h-[38px] px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Thêm địa danh / Link
              </button>
              <button
                type="button"
                onClick={handleRestoreDefaultLandmarks}
                title="Khôi phục danh sách mặc định"
                className="min-h-[38px] px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold inline-flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Mặc định
              </button>
            </>
          )}
          <div className="flex items-center gap-1.5 text-xs text-emerald-200 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
            <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Cao Bằng · Việt Nam</span>
          </div>
        </div>
      </div>

      {/* Admin Add / Edit Form */}
      {isAdmin && showLandmarkForm && (
        <form
          onSubmit={handleSaveLandmark}
          className="m-4 sm:m-6 p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-bold text-slate-900">
              {editingLandmarkId
                ? 'Chỉnh sửa địa danh & nội dung quảng bá Cao Bằng'
                : 'Thêm địa danh / nội dung quảng bá Cao Bằng mới'}
            </div>
            <button
              type="button"
              onClick={resetLandmarkForm}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/70"
              title="Đóng biểu mẫu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tên địa danh / Tiêu đề *
              </label>
              <input
                type="text"
                value={spotName}
                onChange={(e) => setSpotName(e.target.value)}
                placeholder="VD: Đèo Mã Phục, Núi Mắt Thần..."
                className="w-full min-h-[38px] px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Khu vực / Địa chỉ
              </label>
              <input
                type="text"
                value={spotArea}
                onChange={(e) => setSpotArea(e.target.value)}
                placeholder="VD: Quảng Uyên · Cao Bằng"
                className="w-full min-h-[38px] px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Thẻ chủ đề (Badge)
              </label>
              <input
                type="text"
                value={spotTag}
                onChange={(e) => setSpotTag(e.target.value)}
                placeholder="VD: Thắng cảnh, Check-in, Ẩm thực..."
                className="w-full min-h-[38px] px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
              />
            </div>
          </div>

          {/* Multi-link manager */}
          <div className="space-y-2 p-3.5 rounded-xl bg-white border border-slate-200">
            <label className="block text-xs font-semibold text-slate-700">
              Liên kết trên thẻ (Bản đồ, bài viết, video...)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <input
                type="text"
                value={newLinkLabel}
                onChange={(e) => setNewLinkLabel(e.target.value)}
                placeholder="Nhãn nút (VD: Bản đồ, Cẩm nang)"
                className="sm:col-span-4 min-h-[38px] px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
              />
              <input
                type="text"
                value={newLinkUrl}
                onChange={(e) => setNewLinkUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddLinkToForm();
                  }
                }}
                placeholder="Dán đường dẫn URL (VD: https://maps.google.com/...)"
                className="sm:col-span-6 min-h-[38px] px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
              />
              <button
                type="button"
                onClick={handleAddLinkToForm}
                className="sm:col-span-2 min-h-[38px] px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shrink-0"
              >
                + Thêm link
              </button>
            </div>

            {spotLinks.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {spotLinks.map((lnk, idx) => (
                  <span
                    key={`${idx}_${lnk.url}`}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-900 border border-emerald-200 text-xs font-semibold"
                  >
                    <span>{lnk.label}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveLinkFromForm(idx)}
                      className="text-rose-600 hover:text-rose-800 font-bold"
                      title="Xóa liên kết này"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Giới thiệu / Mô tả địa danh
            </label>
            <textarea
              rows={3}
              value={spotSummary}
              onChange={(e) => setSpotSummary(e.target.value)}
              placeholder="Mô tả cảnh đẹp, trải nghiệm nổi bật hoặc lưu ý tham quan tại Cao Bằng..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              Hình ảnh địa danh (chọn nhiều ảnh từ máy hoặc dán link URL ảnh)
            </label>
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
              <input
                type="text"
                value={spotUrlInput}
                onChange={(e) => setSpotUrlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSpotUrlImage();
                  }
                }}
                placeholder="Dán link URL ảnh rồi bấm + Ảnh"
                className="flex-1 min-w-0 min-h-[38px] px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
              />
              <button
                type="button"
                onClick={handleAddSpotUrlImage}
                className="min-h-[38px] px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold shrink-0"
              >
                + Ảnh
              </button>
              <label className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-emerald-600 text-white text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5 shrink-0 transition-colors">
                <ImagePlus className="w-3.5 h-3.5" />
                Tải ảnh lên
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleSpotFilesChange}
                  className="hidden"
                />
              </label>
            </div>

            {spotDraftImages.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {spotDraftImages.map((src, idx) => (
                  <div
                    key={`${idx}_${src.slice(0, 20)}`}
                    className="relative w-24 h-16 rounded-lg overflow-hidden border border-slate-300 bg-white"
                  >
                    <img
                      src={src}
                      alt={`Ảnh địa danh ${idx + 1}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveSpotDraftImage(idx)}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-slate-950/80 text-white text-[11px] flex items-center justify-center hover:bg-rose-600"
                      title="Xóa ảnh này"
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
              onClick={resetLandmarkForm}
              className="min-h-[38px] px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="min-h-[38px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
            >
              {editingLandmarkId ? 'Lưu chỉnh sửa' : 'Đăng địa danh'}
            </button>
          </div>
        </form>
      )}

      {/* Travel Cards Grid */}
      {landmarks.length === 0 ? (
        <div className="p-6 text-center text-xs text-slate-500">
          Chưa có địa danh Cao Bằng nào được hiển thị.
        </div>
      ) : (
        <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50/40">
          {landmarks.map((spot) => {
            const coverImage = spot.images[0];
            return (
              <article
                key={spot.id}
                className="rounded-2xl bg-white border border-slate-200 hover:border-emerald-400 transition-colors overflow-hidden flex flex-col justify-between shadow-2xs"
              >
                <div>
                  <div className="relative aspect-[16/10] bg-slate-900 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setLightboxState({ landmark: spot, imageIndex: 0 })}
                      className="block w-full h-full text-left"
                    >
                      <img
                        src={coverImage}
                        alt={spot.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover hover:scale-[1.03] transition-transform duration-300"
                      />
                    </button>
                    <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-950/75 text-emerald-300 backdrop-blur-xs">
                      {spot.tag}
                    </span>
                    {spot.images.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setLightboxState({ landmark: spot, imageIndex: 0 })}
                        className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-950/80 text-white font-mono-num"
                      >
                        {spot.images.length} ảnh
                      </button>
                    )}
                  </div>

                  <div className="p-4 space-y-2">
                    <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{spot.area}</span>
                    </div>

                    <h3 className="font-display text-base font-bold text-slate-900 leading-snug">
                      {spot.name}
                    </h3>

                    {spot.summary && (
                      <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                        {spot.summary}
                      </p>
                    )}
                  </div>
                </div>

                <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                    {spot.links && spot.links.length > 0 ? (
                      spot.links.map((lnk, idx) => (
                        <a
                          key={`${spot.id}_lnk_${idx}`}
                          href={lnk.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold inline-flex items-center gap-1 transition-colors"
                        >
                          <span>{lnk.label}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      ))
                    ) : (
                      <button
                        type="button"
                        onClick={() => setLightboxState({ landmark: spot, imageIndex: 0 })}
                        className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                      >
                        Xem ảnh
                      </button>
                    )}
                  </div>

                  {isAdmin && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleStartEditLandmark(spot)}
                        className="text-xs font-semibold text-slate-700 hover:text-emerald-700 inline-flex items-center gap-1"
                        title="Chỉnh sửa địa danh"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Sửa
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteLandmark(spot.id)}
                        className="text-xs font-semibold text-rose-600 hover:text-rose-700 inline-flex items-center gap-1"
                        title="Xóa địa danh"
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
              {renderCaoBangTravelSection()}
            </div>
          ) : (
            <section className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-xs text-slate-500">
              Chưa có giải đấu nào được chọn.
            </section>
          )
        ) : (
          <>
            {/* TAB 1: TRANG CHỦ */}
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

                    <div className="grid grid-cols-1 sm:flex flex-wrap items-center gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setActiveTab('live')}
                        className="min-h-[42px] px-4 py-2 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-xl transition-colors flex items-center justify-center gap-2"
                      >
                        <Radio className="w-4 h-4" />
                        Xem tỷ số trực tiếp (Live)
                      </button>

                      {isStaff && (
                        <>
                          <button
                            type="button"
                            onClick={() => setActiveTab('referee')}
                            className="min-h-[42px] px-4 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center justify-center gap-2"
                          >
                            <Gavel className="w-4 h-4 text-orange-600" />
                            Mở App Trọng Tài
                          </button>

                          {isAdmin && (
                            <>
                              <button
                                type="button"
                                onClick={() => setActiveTab('members')}
                                className="min-h-[42px] px-4 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center justify-center gap-2"
                              >
                                <UserPlus className="w-4 h-4 text-orange-600" />
                                Nhập VĐV & Sắp Xếp Bảng
                              </button>

                              <button
                                type="button"
                                onClick={() => setActiveTab('reports')}
                                className="min-h-[42px] px-4 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center justify-center gap-2"
                              >
                                <BarChart3 className="w-4 h-4 text-emerald-600" />
                                Xuất Báo Cáo PDF & Excel
                              </button>
                            </>
                          )}
                        </>
                      )}
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

                <section className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="font-display text-base sm:text-lg font-bold tracking-tight text-slate-900 uppercase">
                        DANH SÁCH GIẢI ĐẤU PICKLEBALL 1986
                      </h2>
                      <p className="text-xs text-slate-500">
                        Chọn giải đấu để xem lịch thi đấu hoặc chuyển sang tab Live
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

                {renderCaoBangTravelSection()}
              </div>
            )}

            {/* TAB 2: LIVE */}
            {activeTab === 'live' && (
              <div className="space-y-5">
                <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-600">
                      <Radio className="w-4 h-4" />
                      <span>TRỰC TIẾP SÂN THI ĐẤU</span>
                    </div>
                    <h1 className="font-display text-xl sm:text-2xl font-extrabold text-slate-900 mt-0.5">
                      Live Scoreboard — {currentTournament.name}
                    </h1>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono-num">
                    <span className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                      Đang đấu: {liveMatches.length} / {currentTournament.courtsCount} sân
                    </span>
                  </div>
                </section>

                <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                  <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
                      <div>
                        <h2 className="font-display text-base sm:text-lg font-bold tracking-tight text-slate-900 uppercase">
                          CÁC TRẬN ĐANG THI ĐẤU TRỰC TIẾP
                        </h2>
                        <p className="text-xs text-slate-500">
                          Cặp VĐV đứng sân, điểm số và lượt giao bóng cập nhật tức thời
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
                        <div className="p-6 text-center bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                          <p className="text-sm text-slate-600">
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

      {/* Lightbox Modal for Landmark Photos */}
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
                  {lightboxState.landmark.name} ({lightboxState.imageIndex + 1}/
                  {lightboxState.landmark.images.length})
                </div>
                <div className="text-xs text-slate-300 truncate">
                  {lightboxState.landmark.area}
                </div>
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
                src={lightboxState.landmark.images[lightboxState.imageIndex]}
                alt={lightboxState.landmark.name}
                referrerPolicy="no-referrer"
                className="max-h-[60vh] w-auto object-contain rounded-lg"
              />
              {lightboxState.landmark.images.length > 1 && (
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {lightboxState.landmark.images.map((thumb, idx) => (
                    <button
                      key={`${lightboxState.landmark.id}_thumb_${idx}`}
                      type="button"
                      onClick={() =>
                        setLightboxState({ ...lightboxState, imageIndex: idx })
                      }
                      className={`w-14 h-10 rounded-md overflow-hidden border-2 ${
                        lightboxState.imageIndex === idx
                          ? 'border-emerald-400'
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
        className={`no-print lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 flex items-center justify-around h-11 sm:h-12 px-1 compact-on-mobile-landscape`}
      >
        {visibleNavItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`min-h-[40px] sm:min-h-[44px] flex-1 min-w-0 flex flex-col items-center justify-center rounded-lg transition-colors ${
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
