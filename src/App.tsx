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
  Route,
  ShieldCheck,
  Trash2,
  Trophy,
  UserPlus,
  Users,
  Utensils,
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

type HomepageGuideTab = 'places' | 'cuisine' | 'guide';

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
  guideDetail?: string;
  links: LandmarkLink[];
  images: string[];
}

interface CaoBangCuisineItem {
  id: string;
  name: string;
  mealTime: string;
  tag: string;
  image: string;
  description: string;
  detailedGuide: string;
  tip: string;
}

interface LightboxPreview {
  title: string;
  subtitle: string;
  images: string[];
  imageIndex: number;
  fallbackTitle: string;
  fallbackTag: string;
  fallbackAccent: string;
}

function createTravelPlaceholderSvg(
  title: string,
  tag: string,
  accentHex: string,
  subtitle = 'Công viên địa chất toàn cầu UNESCO · Cao Bằng',
): string {
  const safeTitle = title.replace(/[<>&"]/g, '');
  const safeTag = tag.replace(/[<>&"]/g, '');
  const safeSub = subtitle.replace(/[<>&"]/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#0f172a"/>
        <stop offset="55%" stop-color="#1e293b"/>
        <stop offset="100%" stop-color="${accentHex}"/>
      </linearGradient>
    </defs>
    <rect width="800" height="500" fill="url(#bg)"/>
    <circle cx="660" cy="120" r="95" fill="${accentHex}" opacity="0.22"/>
    <path d="M0 370 Q180 290 360 365 T800 340 L800 500 L0 500 Z" fill="#064e3b" opacity="0.55"/>
    <path d="M0 405 Q240 335 470 400 T800 385 L800 500 L0 500 Z" fill="#022c22" opacity="0.7"/>
    <rect x="36" y="36" width="270" height="34" rx="17" fill="#ffffff" fill-opacity="0.14"/>
    <text x="54" y="58" fill="#a7f3d0" font-family="system-ui, sans-serif" font-size="14" font-weight="700" letter-spacing="1">${safeTag}</text>
    <text x="36" y="424" fill="#ffffff" font-family="system-ui, sans-serif" font-size="31" font-weight="800">${safeTitle}</text>
    <text x="36" y="458" fill="#cbd5e1" font-family="system-ui, sans-serif" font-size="16">${safeSub}</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function resolveMediaSrc(
  src: string | undefined,
  fallbackTitle: string,
  fallbackTag: string,
  fallbackAccent: string,
): string {
  const trimmed = (src || '').trim();
  if (trimmed) return trimmed;
  return createTravelPlaceholderSvg(fallbackTitle, fallbackTag, fallbackAccent);
}

const CAO_BANG_CUISINE: CaoBangCuisineItem[] = [
  {
    id: 'banh_cuon_canh',
    name: 'Bánh cuốn canh Cao Bằng',
    mealTime: 'Ăn sáng · Chợ & phố trung tâm',
    tag: 'Đặc sản ăn sáng',
    image:
      'https://cdn.tgdd.vn/Files/2021/08/25/1377667/cach-lam-banh-cuon-cao-bang-nong-hoi-thom-ngon-chuan-vi-202108251508096488.jpg',
    description:
      'Bánh được tráng mỏng thủ công từ gạo nếp nương, nhân thịt băm mộc nhĩ, ăn cùng bát nước dùng ninh xương nóng hổi thay vì chấm nước mắm như miền xuôi.',
    detailedGuide:
      'Hướng dẫn thưởng thức: Khi bánh vừa tráng nóng bưng ra, thực khách thả bánh vào bát nước canh xương có sẵn giò lụa, thịt băm, hành lá; thêm vài lát măng ngâm ớt mắc mật để dậy vị chua cay hài hòa. Phục vụ phổ biến từ 6h00 – 9h30 sáng tại khu vực phường Hợp Giang, Thục Phán và các chợ phiên.',
    tip: 'Nên ăn ngay tại bàn khi bánh vừa ra lò để cảm nhận độ dẻo thơm và nước dùng nóng.',
  },
  {
    id: 'pho_chua',
    name: 'Phở chua Cao Bằng',
    mealTime: 'Ăn sáng / Xế trưa',
    tag: 'Chua ngọt thanh mát',
    image:
      'https://cdn.tgdd.vn/Files/2021/09/14/1382522/cach-lam-pho-chua-cao-bang-chuan-vi-ngon-kho-cuong-202109141634133804.jpg',
    description:
      'Sợi bánh phở mềm dai trộn đều với thịt vịt quay, ba chỉ rán giòn, khoai tàu thái sợi chiên vàng, lạc rang giã dập và nước sốt chua ngọt sánh mịn.',
    detailedGuide:
      'Hướng dẫn thưởng thức: Trước khi ăn cần trộn đều từ đáy bát để nước sốt chua ngọt quyện đều vào từng sợi phở, ăn kèm rau thơm, dưa chuột thái chỉ và một chén nước dùng nhỏ đi kèm. Rất hợp để đổi vị sau các buổi thi đấu thể thao hoặc tham quan buổi sáng.',
    tip: 'Có thể gọi thêm thịt vịt quay hoặc trứng vịt rán ăn kèm cho đầy đặn.',
  },
  {
    id: 'vit_quay_7_vi',
    name: 'Vịt quay 7 vị & Lạp sườn mắc mật',
    mealTime: 'Bữa trưa / Bữa tối · Quà biếu',
    tag: 'Hương vị núi rừng',
    image:
      'https://cdn.tgdd.vn/Files/2021/09/03/1379886/cach-lam-vit-quay-7-vi-cao-bang-da-gion-thit-mem-ngot-202109031109551593.jpg',
    description:
      'Vịt cỏ địa phương tẩm ướp 7 loại gia vị bí truyền cùng lá mắc mật, phết mật ong quay than hồng cho lớp da vàng óng giòn rụm, thịt bên trong mềm ngọt.',
    detailedGuide:
      'Hướng dẫn thưởng thức & mua quà: Vịt quay chặt miếng vừa ăn chấm nước sốt chiết từ bụng vịt. Lạp sườn hun khói mía hoặc củi quế có vị thơm đặc trưng của quả mắc mật, bảo quản ngăn đá mang về làm quà biếu bạn bè phương xa rất tiện lợi.',
    tip: 'Đặt trước tại các lò quay uy tín buổi chiều để lấy vịt mới ra lò nóng giòn.',
  },
  {
    id: 'hat_de_rau_da_hien',
    name: 'Hạt dẻ Trùng Khánh & Rau dạ hiến',
    mealTime: 'Theo mùa · Đặc sản vùng cao',
    tag: 'Thủ phủ Trùng Khánh',
    image:
      'https://cdn.tgdd.vn/Files/2021/10/12/1389903/hat-de-trung-khanh-cao-bang-co-gi-dac-biet-cach-che-bien-ngon-202110121545123209.jpg',
    description:
      'Hạt dẻ Trùng Khánh hạt to, vỏ nâu bóng, khi luộc hoặc rang chín có vị bùi béo và hương thơm đặc trưng hiếm nơi nào sánh bằng.',
    detailedGuide:
      'Hướng dẫn chọn mua & thưởng thức: Mùa hạt dẻ rộ nhất vào khoảng tháng 9 – tháng 11 dương lịch. Khi đi cung đường Thác Bản Giốc – Trùng Khánh, du khách có thể thưởng thức hạt dẻ rang nóng tại chỗ, chân giò hầm hạt dẻ và đĩa rau dạ hiến (rau bồ khai) xào tỏi xanh giòn.',
    tip: 'Nên chọn hạt dẻ tươi chắc mẩy, không bị sâu mọt và bảo quản nơi thoáng mát.',
  },
  {
    id: 'banh_ap_chao',
    name: 'Bánh áp chao Cao Bằng',
    mealTime: 'Ăn vặt chiều · Mùa thu đông',
    tag: 'Quà chiều ấm nóng',
    image:
      'https://cdn.tgdd.vn/Files/2021/10/29/1394009/banh-ap-chao-cao-bang-la-gi-cach-lam-banh-ap-chao-gion-ngon-202110291615274036.jpg',
    description:
      'Chiếc bánh làm từ bột gạo nếp pha gạo tẻ bọc nhân thịt vịt tẩm gia vị, thả chảo dầu sôi chiên vàng phồng, bên ngoài giòn tan bên trong mềm dẻo.',
    detailedGuide:
      'Hướng dẫn thưởng thức: Bánh áp chao ngon nhất vào những buổi chiều se lạnh từ tháng 10 đến tháng 3 năm sau. Bánh cắt miếng nhỏ, chấm nước mắm chua ngọt pha đu đủ xanh bào sợi và rau sống tươi.',
    tip: 'Thưởng thức vào tầm 15h00 – 18h00 tại các hàng quán vỉa hè khu trung tâm.',
  },
  {
    id: 'xoi_tram_banh_khao',
    name: 'Xôi trám đen & Bánh khảo',
    mealTime: 'Lễ Tết · Quà đặc sản',
    tag: 'Tinh hoa ẩm thực Tày',
    image:
      'https://cdn.tgdd.vn/Files/2021/09/22/1384512/cach-lam-xoi-tram-den-cao-bang-thom-deo-chuan-vi-202109221420129876.jpg',
    description:
      'Xôi nếp nương đồ cùng thịt quả trám đen tạo sắc tím hồng bắt mắt, vị dẻo thơm bùi ngậy; bánh khảo làm từ gạo nếp rang xay mịn nhân đường phên, lạc vừng.',
    detailedGuide:
      'Hướng dẫn thưởng thức & làm quà: Xôi trám thường ăn kèm muối vừng hoặc lạp sườn nướng. Bánh khảo đóng phong giấy truyền thống gọn nhẹ, để được nhiều ngày, rất hợp làm quà tặng bạn bè phương xa.',
    tip: 'Bánh khảo ăn kèm trà xanh nóng sẽ tôn lên vị ngọt thanh và hương nếp rang.',
  },
];

const CAO_BANG_TRAVEL_GUIDE = [
  {
    title: '1. Đường đi & phương tiện di chuyển',
    summary:
      'Từ Hà Nội lên Cao Bằng khoảng 280 km (5 – 6 giờ di chuyển), đường đẹp và thuận tiện cho cả ô tô cá nhân lẫn xe giường nằm.',
    points: [
      'Cung đường phổ biến: Cao tốc Hà Nội – Thái Nguyên – Chợ Mới, sau đó theo Quốc lộ 3 qua Bắc Kạn lên thành phố Cao Bằng (hoặc đi hướng cao tốc Hà Nội – Lạng Sơn rồi rẽ QL4A).',
      'Di chuyển nội tỉnh: Các điểm du lịch chia thành 3 tuyến chính (Tuyến Đông Bắc đi Bản Giốc – Ngườm Ngao; Tuyến phía Bắc đi Pác Bó; Tuyến phía Tây đi Phia Oắc – Phia Đén).',
      'Lưu ý lái xe: Đường đèo như Đèo Mã Phục, Đèo Khau Cốc Chà hay đường lên Phia Oắc có nhiều khúc cua tay áo, nên đi ban ngày và giữ tốc độ ổn định.',
    ],
  },
  {
    title: '2. Thời điểm đẹp & chuẩn bị hành lý',
    summary:
      'Mỗi mùa Cao Bằng mang một vẻ đẹp riêng: mùa nước thác đổ trắng xóa, mùa hoa tam giác mạch – dã quỳ hay mùa săn mây.',
    points: [
      'Tháng 8 – 10: Thác Bản Giốc đầy nước, trong xanh, ruộng bậc thang vào mùa lúa chín vàng rực rỡ.',
      'Tháng 11 – 12 & Mùa xuân (tháng 2 – 3): Trời se lạnh, có hoa dã quỳ, hoa tam giác mạch, hoa mận – hoa lê nở trắng bản làng.',
      'Trang phục gợi ý: Giày thể thao hoặc giày leo núi đế bám tốt (để đi bộ trong Động Ngườm Ngao, leo Núi Mắt Thần), áo khoác gió nhẹ vì nhiệt độ buổi tối vùng cao giảm nhanh.',
    ],
  },
  {
    title: '3. Gợi ý lịch trình 3 ngày 2 đêm chi tiết',
    summary:
      'Lịch trình cân đối giữa tham quan kỳ quan thiên nhiên, di tích lịch sử và trải nghiệm trọn vẹn ẩm thực địa phương.',
    points: [
      'Ngày 1 (Trung tâm & ẩm thực): Có mặt tại Cao Bằng, nhận phòng nghỉ ngơi. Chiều dạo phố đi bộ Kim Đồng, thưởng thức bánh áp chao, phở chua, vịt quay 7 vị.',
      'Ngày 2 (Cung Đông Bắc kỳ vĩ): Sáng vượt Đèo Mã Phục, khám phá Động Ngườm Ngao và Làng đá cổ Khuổi Ky. Trưa ăn đặc sản Trùng Khánh (hạt dẻ, rau dạ hiến). Chiều tham quan Thác Bản Giốc, Chùa Phật Tích Trúc Lâm và check-in Núi Mắt Thần / Hồ Thang Hen.',
      'Ngày 3 (Về nguồn Pác Bó): Tham quan Khu di tích Quốc gia đặc biệt Pác Bó (Suối Lê-nin, núi Các Mác, hang Cốc Bó). Trưa thưởng thức bánh cuốn canh, mua lạp sườn – bánh khảo làm quà trước khi về.',
    ],
  },
];

const DEFAULT_CAO_BANG_LANDMARKS: CaoBangLandmark[] = [
  {
    id: 'ban_gioc',
    name: 'Thác Bản Giốc',
    area: 'Đàm Thủy · Trùng Khánh · Cao Bằng',
    tag: 'Kỳ quan thác nước',
    summary:
      'Một trong những thác nước tự nhiên hùng vĩ bậc nhất Đông Nam Á, tầng tầng bọt trắng đổ xuống giữa núi non biên cương xanh mát.',
    guideDetail:
      'Cách trung tâm Cao Bằng khoảng 85 km. Bạn có thể đi bè tre tiến sát chân thác để cảm nhận làn hơi nước mát lạnh, sau đó ghé Chùa Phật Tích Trúc Lâm Bản Giốc ngay sườn núi bên cạnh để ngắm toàn cảnh thung lũng biên giới.',
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
    images: [
      'https://vcdn1-dulich.vnecdn.net/2022/04/18/thac-ban-gioc-cao-bang-1-1650270341.jpg?w=1200&h=0&q=100&dpr=1&fit=crop&s=0G2oF9w2r8cF7t2v6sQ0qQ',
      createTravelPlaceholderSvg('Thác Bản Giốc', 'KỲ QUAN THÁC NƯỚC', '#0d9488'),
    ],
  },
  {
    id: 'nguom_ngao',
    name: 'Động Ngườm Ngao',
    area: 'Đàm Thủy · Trùng Khánh · Cao Bằng',
    tag: 'Hang động thạch nhũ',
    summary:
      'Hang động đá vôi kỳ ảo dài hơn 2 km với hệ thống nhũ đá, măng đá lấp lánh nhiều hình thù độc đáo như đài sen ngược, cột chống trời.',
    guideDetail:
      'Nằm cách Thác Bản Giốc chỉ khoảng 3 km, rất thuận tiện kết hợp tham quan trong cùng một buổi. Nhiệt độ trong hang luôn mát mẻ quanh năm (18–25°C), lối đi có hệ thống đèn chiếu sáng nghệ thuật và cầu gỗ an toàn.',
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
    images: [
      'https://vcdn1-dulich.vnecdn.net/2022/04/18/dong-nguom-ngao-cao-bang-1-1650270512.jpg?w=1200&h=0&q=100&dpr=1&fit=crop&s=1qW8zR5t4yU6iO9p3lK2jA',
      createTravelPlaceholderSvg('Động Ngườm Ngao', 'HANG ĐỘNG THẠCH NHŨ', '#0e7490'),
    ],
  },
  {
    id: 'nui_mat_than',
    name: 'Núi Mắt Thần (Núi Thủng)',
    area: 'Quốc Toản · Quảng Hòa · Cao Bằng',
    tag: 'Thảo nguyên & cắm trại',
    summary:
      'Khối núi đá vôi có vòm thủng tròn khổng lồ xuyên qua lòng núi giữa thung lũng thảo nguyên xanh mướt, điểm dã ngoại và chụp ảnh nổi tiếng.',
    guideDetail:
      'Nằm trong quần thể hồ Thang Hen thuộc Công viên địa chất Non nước Cao Bằng. Mùa khô thung lũng biến thành bãi cỏ rộng mênh mông với đàn ngựa, đàn trâu thong dong; mùa mưa nước dâng tạo nên mặt hồ soi bóng vòm núi độc đáo.',
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
    images: [
      'https://vcdn1-dulich.vnecdn.net/2022/04/18/nui-mat-than-cao-bang-1-1650270650.jpg?w=1200&h=0&q=100&dpr=1&fit=crop&s=9xC7vB5n3mZ1aS8dF4gH6j',
      createTravelPlaceholderSvg('Núi Mắt Thần', 'THẢO NGUYÊN & CHECK-IN', '#059669'),
    ],
  },
  {
    id: 'pac_bo',
    name: 'Khu di tích Quốc gia đặc biệt Pác Bó',
    area: 'Trường Hà · Hà Quảng · Cao Bằng',
    tag: 'Cội nguồn lịch sử',
    summary:
      'Quần thể di tích gắn liền với dòng suối Lê-nin xanh ngọc bích, núi Các Mác hùng vĩ và hang Cốc Bó mang đậm dấu ấn lịch sử cách mạng.',
    guideDetail:
      'Cách trung tâm Cao Bằng khoảng 50 km về phía Bắc, đường đi thẳng và rất dễ di chuyển. Nước suối Lê-nin trong vắt nhìn rõ từng đàn cá suối bơi lội; du khách nên đi bộ dọc bờ suối để tận hưởng không khí trong lành và tìm hiểu lịch sử.',
    links: [
      {
        label: 'Bản đồ',
        url: 'https://www.google.com/maps/search/?api=1&query=Khu+di+tich+Pac+Bo+Cao+Bang',
      },
    ],
    images: [
      'https://vcdn1-dulich.vnecdn.net/2022/04/18/suoi-le-nin-pac-bo-cao-bang-1-1650270780.jpg?w=1200&h=0&q=100&dpr=1&fit=crop&s=4pL2kJ9hG7fD5sA3zX1cV8b',
      createTravelPlaceholderSvg('Khu di tích Pác Bó', 'CỘI NGUỒN LỊCH SỬ', '#15803d'),
    ],
  },
  {
    id: 'deo_ma_phuc',
    name: 'Đèo Mã Phục',
    area: 'Quốc lộ 3 · Quảng Hòa · Cao Bằng',
    tag: 'Cung đèo ngoạn mục',
    summary:
      'Con đèo nổi tiếng bậc nhất Cao Bằng với 7 tầng dốc uốn lượn mềm mại qua hai vách núi đá vôi dựng đứng như hai con ngựa phủ phục.',
    guideDetail:
      'Nằm trên trục đường từ trung tâm đi Trùng Khánh – Bản Giốc. Trên đỉnh đèo có điểm dừng chân ngắm cảnh, chụp ảnh toàn cảnh thung lũng bên dưới và thưởng thức các món ăn vặt nóng hổi của bà con bản địa.',
    links: [
      {
        label: 'Bản đồ',
        url: 'https://www.google.com/maps/search/?api=1&query=Deo+Ma+Phuc+Cao+Bang',
      },
    ],
    images: [
      'https://vcdn1-dulich.vnecdn.net/2022/04/18/deo-ma-phuc-cao-bang-1-1650270900.jpg?w=1200&h=0&q=100&dpr=1&fit=crop&s=7mN5bV3cX1zA9sD8fG6hJ4k',
      createTravelPlaceholderSvg('Đèo Mã Phục', 'CUNG ĐÈO NGOẠN MỤC', '#0284c7'),
    ],
  },
  {
    id: 'khuoi_ky',
    name: 'Làng đá cổ Khuổi Ky',
    area: 'Đàm Thủy · Trùng Khánh · Cao Bằng',
    tag: 'Bản sắc văn hóa Tày',
    summary:
      'Ngôi làng cổ hơn 400 năm tuổi với những ngôi nhà sàn xây hoàn toàn bằng đá hộc của đồng bào Tày, lưu giữ nét kiến trúc và đời sống bản địa.',
    guideDetail:
      'Nằm ngay giữa cung đường nối Động Ngườm Ngao và Thác Bản Giốc. Du khách có thể nghỉ homestay nhà sàn đá, nghe hát Then đàn Tính vào buổi tối và thưởng thức mâm cơm đặc sản vùng biên.',
    links: [
      {
        label: 'Bản đồ',
        url: 'https://www.google.com/maps/search/?api=1&query=Lang+da+Khuoi+Ky+Cao+Bang',
      },
    ],
    images: [
      'https://vcdn1-dulich.vnecdn.net/2022/04/18/lang-da-khuoi-ky-cao-bang-1-1650271020.jpg?w=1200&h=0&q=100&dpr=1&fit=crop&s=2wQ4eR6tY8uI0oP9lK7jH5g',
      createTravelPlaceholderSvg('Làng đá Khuổi Ky', 'BẢN SẮC VĂN HÓA TÀY', '#b45309'),
    ],
  },
  {
    id: 'phia_oac',
    name: 'Vườn quốc gia Phia Oắc – Phia Đén',
    area: 'Thành Công · Nguyên Bình · Cao Bằng',
    tag: 'Rừng rêu & săn mây',
    summary:
      'Được ví như "nóc nhà phía Tây" của Cao Bằng với độ cao gần 2.000 m, khí hậu mát mẻ quanh năm, rừng rêu cổ thụ và biển mây bồng bềnh.',
    guideDetail:
      'Cách trung tâm Cao Bằng khoảng 70 km về phía Tây. Rất lý tưởng cho những ai yêu thiên nhiên hoang sơ, săn mây sáng sớm, ngắm băng tuyết vào mùa đông giá rét hoặc dạo bước giữa rừng trúc và đồi chè cổ thụ.',
    links: [
      {
        label: 'Bản đồ',
        url: 'https://www.google.com/maps/search/?api=1&query=Phia+Oac+Cao+Bang',
      },
    ],
    images: [
      'https://vcdn1-dulich.vnecdn.net/2022/04/18/phia-oac-cao-bang-1-1650271150.jpg?w=1200&h=0&q=100&dpr=1&fit=crop&s=6tY8uI0oP9lK7jH5gF3dS1a',
      createTravelPlaceholderSvg('Phia Oắc – Phia Đén', 'RỪNG RÊU & SĂN MÂY', '#047857'),
    ],
  },
  {
    id: 'thang_hen',
    name: 'Hồ Thang Hen',
    area: 'Quốc Toản · Quảng Hòa · Cao Bằng',
    tag: 'Thắng cảnh cao nguyên',
    summary:
      'Quần thể 36 hồ nước ngọt tự nhiên thông nhau qua các hang ngầm dưới lòng núi, mặt nước xanh biếc soi bóng rừng thông và vách đá.',
    guideDetail:
      'Chỉ cách trung tâm Cao Bằng khoảng 30 km, đường vào dễ đi. Du khách có thể chèo thuyền dạo quanh mặt hồ yên ả, đi bộ xuyên rừng hoặc kết hợp tham quan Núi Mắt Thần ngay liền kề.',
    links: [
      {
        label: 'Bản đồ',
        url: 'https://www.google.com/maps/search/?api=1&query=Ho+Thang+Hen+Cao+Bang',
      },
    ],
    images: [
      'https://vcdn1-dulich.vnecdn.net/2022/04/18/ho-thang-hen-cao-bang-1-1650271280.jpg?w=1200&h=0&q=100&dpr=1&fit=crop&s=8uI0oP9lK7jH5gF3dS1aZ2x',
      createTravelPlaceholderSvg('Hồ Thang Hen', 'THẮNG CẢNH CAO NGUYÊN', '#0d9488'),
    ],
  },
];

const STORAGE_KEY = 'pickleball_1986_state_v7';
const AUTH_SESSION_KEY = 'pickleball_1986_auth_user_v1';
const ACTIVE_TAB_KEY = 'pickleball_1986_active_tab_v1';
const CAO_BANG_STORAGE_KEY = 'pickleball_1986_caobang_travel_v4';
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
            guideDetail: item.guideDetail ? String(item.guideDetail) : undefined,
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
  const [homepageGuideTab, setHomepageGuideTab] = useState<HomepageGuideTab>('places');
  const [showAllPlaces, setShowAllPlaces] = useState(false);
  const [showAllCuisine, setShowAllCuisine] = useState(false);
  const [expandedCardIds, setExpandedCardIds] = useState<Record<string, boolean>>({});
  const [expandedGuideBlocks, setExpandedGuideBlocks] = useState<Record<number, boolean>>({
    0: true,
  });

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
  const [spotGuideDetail, setSpotGuideDetail] = useState('');
  const [spotLinks, setSpotLinks] = useState<LandmarkLink[]>([]);
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [spotUrlInput, setSpotUrlInput] = useState('');
  const [spotDraftImages, setSpotDraftImages] = useState<string[]>([]);

  const [lightboxState, setLightboxState] = useState<LightboxPreview | null>(null);

  const isStaff = Boolean(currentAccount && isStaffRole(currentAccount.role));
  const isAdmin = currentAccount?.role === 'admin';

  const toggleCardExpand = (id: string) => {
    setExpandedCardIds((prev) => ({ ...prev, [id]: !prev[id] }));
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
    setSpotGuideDetail('');
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
    setHomepageGuideTab('places');
    setEditingLandmarkId(null);
    setSpotName('');
    setSpotArea('Cao Bằng');
    setSpotTag('Điểm đến nổi bật');
    setSpotSummary('');
    setSpotGuideDetail('');
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
    setHomepageGuideTab('places');
    setEditingLandmarkId(spot.id);
    setSpotName(spot.name);
    setSpotArea(spot.area);
    setSpotTag(spot.tag);
    setSpotSummary(spot.summary);
    setSpotGuideDetail(spot.guideDetail || '');
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
    const cleanGuide = spotGuideDetail.trim();

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
              guideDetail: cleanGuide || undefined,
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
        guideDetail: cleanGuide || undefined,
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
    if (lightboxState && lightboxState.title === target?.name) {
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

  const visibleLandmarks = showAllPlaces ? landmarks : landmarks.slice(0, 4);
  const visibleCuisine = showAllCuisine ? CAO_BANG_CUISINE : CAO_BANG_CUISINE.slice(0, 4);

  const renderCaoBangTravelSection = () => (
    <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
      {/* Travel Banner Header */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white px-5 py-6 sm:px-7 sm:py-7 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
            <Compass className="w-3.5 h-3.5" />
            <span>Quê hương Cao Bằng · Chào đón bạn bè phương xa</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight">
            Du lịch & Ẩm thực Cao Bằng — Non nước hữu tình
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Giới thiệu những điểm đến kỳ vĩ, món ăn đặc sản trứ danh và hướng dẫn chi tiết cho bạn bè, du khách và VĐV khi ghé thăm miền non nước Cao Bằng.
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
                Thêm địa danh / Ảnh
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
          <div className="flex items-center gap-1.5 text-xs text-emerald-200 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2">
            <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Cao Bằng · Việt Nam</span>
          </div>
        </div>
      </div>

      {/* Sub-navigation: Địa danh | Ẩm thực | Hướng dẫn chi tiết */}
      <div className="px-4 sm:px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setHomepageGuideTab('places')}
            className={`min-h-[36px] px-3.5 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-colors ${
              homepageGuideTab === 'places'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Địa danh du lịch ({landmarks.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setHomepageGuideTab('cuisine')}
            className={`min-h-[36px] px-3.5 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-colors ${
              homepageGuideTab === 'cuisine'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Utensils className="w-3.5 h-3.5" />
            <span>Ẩm thực & Đặc sản ({CAO_BANG_CUISINE.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setHomepageGuideTab('guide')}
            className={`min-h-[36px] px-3.5 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-colors ${
              homepageGuideTab === 'guide'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Route className="w-3.5 h-3.5" />
            <span>Hướng dẫn chi tiết</span>
          </button>
        </div>

        <div className="text-[11px] text-slate-500">
          Mùa thác đẹp: Tháng 8–10 · Mùa hoa & se lạnh: Tháng 11–12 & Mùa xuân
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
                ? 'Chỉnh sửa địa danh & hướng dẫn Cao Bằng'
                : 'Thêm địa danh / điểm tham quan Cao Bằng mới'}
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
                placeholder="VD: Trùng Khánh · Cao Bằng"
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Giới thiệu ngắn gọn
              </label>
              <textarea
                rows={3}
                value={spotSummary}
                onChange={(e) => setSpotSummary(e.target.value)}
                placeholder="Mô tả ngắn gọn điểm nổi bật của địa danh..."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Hướng dẫn chi tiết (mở khi bấm "Xem thêm")
              </label>
              <textarea
                rows={3}
                value={spotGuideDetail}
                onChange={(e) => setSpotGuideDetail(e.target.value)}
                placeholder="Khoảng cách di chuyển, cách tham quan, lưu ý giờ mở cửa hoặc kết hợp điểm lân cận..."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              />
            </div>
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
                      src={resolveMediaSrc(
                        src,
                        spotName || 'Cao Bằng',
                        spotTag.toUpperCase(),
                        '#059669',
                      )}
                      alt={`Ảnh địa danh ${idx + 1}`}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.src = createTravelPlaceholderSvg(
                          spotName || 'Cao Bằng',
                          spotTag.toUpperCase(),
                          '#059669',
                        );
                      }}
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

      {/* Sub-tab 1: Places Grid with Photos & "Xem thêm" */}
      {homepageGuideTab === 'places' &&
        (landmarks.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            Chưa có địa danh Cao Bằng nào được hiển thị.
          </div>
        ) : (
          <div className="p-4 sm:p-6 space-y-5 bg-slate-50/40">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
              {visibleLandmarks.map((spot) => {
                const coverImage = resolveMediaSrc(
                  spot.images[0],
                  spot.name,
                  spot.tag.toUpperCase(),
                  '#059669',
                );
                const isCardExpanded = Boolean(expandedCardIds[spot.id]);
                const hasMoreContent =
                  Boolean(spot.guideDetail) || spot.summary.length > 115;

                return (
                  <article
                    key={spot.id}
                    className="rounded-2xl bg-white border border-slate-200 hover:border-emerald-400 transition-colors overflow-hidden flex flex-col justify-between shadow-2xs"
                  >
                    <div>
                      <div className="relative aspect-[16/10] bg-slate-900 overflow-hidden">
                        <button
                          type="button"
                          onClick={() =>
                            setLightboxState({
                              title: spot.name,
                              subtitle: spot.area,
                              images: spot.images,
                              imageIndex: 0,
                              fallbackTitle: spot.name,
                              fallbackTag: spot.tag.toUpperCase(),
                              fallbackAccent: '#059669',
                            })
                          }
                          className="block w-full h-full text-left"
                        >
                          <img
                            src={coverImage}
                            alt={spot.name}
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              e.currentTarget.src = createTravelPlaceholderSvg(
                                spot.name,
                                spot.tag.toUpperCase(),
                                '#059669',
                              );
                            }}
                            className="w-full h-full object-cover hover:scale-[1.03] transition-transform duration-300"
                          />
                        </button>
                        <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-950/75 text-emerald-300 backdrop-blur-xs">
                          {spot.tag}
                        </span>
                        {spot.images.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setLightboxState({
                                title: spot.name,
                                subtitle: spot.area,
                                images: spot.images,
                                imageIndex: 0,
                                fallbackTitle: spot.name,
                                fallbackTag: spot.tag.toUpperCase(),
                                fallbackAccent: '#059669',
                              })
                            }
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
                          <p
                            className={`text-xs text-slate-600 leading-relaxed ${
                              isCardExpanded ? '' : 'line-clamp-3'
                            }`}
                          >
                            {spot.summary}
                          </p>
                        )}

                        {isCardExpanded && spot.guideDetail && (
                          <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80 text-xs text-slate-700 leading-relaxed">
                            <span className="font-bold text-emerald-900">Hướng dẫn: </span>
                            {spot.guideDetail}
                          </div>
                        )}

                        {hasMoreContent && (
                          <button
                            type="button"
                            onClick={() => toggleCardExpand(spot.id)}
                            className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 pt-0.5"
                          >
                            <span>{isCardExpanded ? 'Thu gọn' : 'Xem thêm hướng dẫn'}</span>
                            {isCardExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
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
                            onClick={() =>
                              setLightboxState({
                                title: spot.name,
                                subtitle: spot.area,
                                images: spot.images,
                                imageIndex: 0,
                                fallbackTitle: spot.name,
                                fallbackTag: spot.tag.toUpperCase(),
                                fallbackAccent: '#059669',
                              })
                            }
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

            {landmarks.length > 4 && (
              <div className="flex justify-center pt-1">
                <button
                  type="button"
                  onClick={() => setShowAllPlaces((prev) => !prev)}
                  className="min-h-[40px] px-5 py-2 rounded-xl bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-extrabold inline-flex items-center gap-1.5 shadow-2xs transition-colors"
                >
                  <span>
                    {showAllPlaces
                      ? 'Thu gọn danh sách địa danh'
                      : `Xem thêm ${landmarks.length - 4} địa danh Cao Bằng`}
                  </span>
                  {showAllPlaces ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
              </div>
            )}
          </div>
        ))}

      {/* Sub-tab 2: Cuisine & Specialties with Photos & "Xem thêm" */}
      {homepageGuideTab === 'cuisine' && (
        <div className="p-4 sm:p-6 space-y-5 bg-slate-50/40">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
            {visibleCuisine.map((item) => {
              const isExpanded = Boolean(expandedCardIds[item.id]);
              const foodSrc = resolveMediaSrc(
                item.image,
                item.name,
                item.tag.toUpperCase(),
                '#d97706',
              );

              return (
                <article
                  key={item.id}
                  className="rounded-2xl bg-white border border-slate-200 hover:border-amber-400 transition-colors overflow-hidden flex flex-col justify-between shadow-2xs"
                >
                  <div>
                    <div className="relative aspect-[16/10] bg-slate-900 overflow-hidden">
                      <button
                        type="button"
                        onClick={() =>
                          setLightboxState({
                            title: item.name,
                            subtitle: item.mealTime,
                            images: [foodSrc],
                            imageIndex: 0,
                            fallbackTitle: item.name,
                            fallbackTag: item.tag.toUpperCase(),
                            fallbackAccent: '#d97706',
                          })
                        }
                        className="block w-full h-full text-left"
                      >
                        <img
                          src={foodSrc}
                          alt={item.name}
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.currentTarget.src = createTravelPlaceholderSvg(
                              item.name,
                              item.tag.toUpperCase(),
                              '#d97706',
                              item.mealTime,
                            );
                          }}
                          className="w-full h-full object-cover hover:scale-[1.03] transition-transform duration-300"
                        />
                      </button>
                      <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-950/75 text-amber-300 backdrop-blur-xs">
                        {item.tag}
                      </span>
                    </div>

                    <div className="p-4 space-y-2">
                      <div className="text-[11px] font-medium text-amber-700">
                        {item.mealTime}
                      </div>

                      <h3 className="font-display text-base font-bold text-slate-900 leading-snug">
                        {item.name}
                      </h3>

                      <p
                        className={`text-xs text-slate-600 leading-relaxed ${
                          isExpanded ? '' : 'line-clamp-3'
                        }`}
                      >
                        {item.description}
                      </p>

                      {isExpanded && (
                        <div className="space-y-2 pt-1">
                          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed">
                            {item.detailedGuide}
                          </div>
                          <div className="p-2.5 rounded-xl bg-amber-50/90 border border-amber-200/80 text-xs text-amber-950">
                            <strong>Mẹo nhỏ:</strong> {item.tip}
                          </div>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => toggleCardExpand(item.id)}
                        className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 hover:text-amber-800 pt-0.5"
                      >
                        <span>{isExpanded ? 'Thu gọn' : 'Xem thêm cách thưởng thức'}</span>
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {CAO_BANG_CUISINE.length > 4 && (
            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={() => setShowAllCuisine((prev) => !prev)}
                className="min-h-[40px] px-5 py-2 rounded-xl bg-white hover:bg-amber-50 text-amber-900 border border-amber-300 text-xs font-extrabold inline-flex items-center gap-1.5 shadow-2xs transition-colors"
              >
                <span>
                  {showAllCuisine
                    ? 'Thu gọn danh sách món ngon'
                    : `Xem thêm ${CAO_BANG_CUISINE.length - 4} đặc sản Cao Bằng`}
                </span>
                {showAllCuisine ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Sub-tab 3: Detailed Guide with expandable sections */}
      {homepageGuideTab === 'guide' && (
        <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-3 gap-4 items-start bg-slate-50/40">
          {CAO_BANG_TRAVEL_GUIDE.map((block, bIdx) => {
            const isBlockExpanded = Boolean(expandedGuideBlocks[bIdx]);
            return (
              <div
                key={block.title}
                className="rounded-2xl bg-white border border-slate-200 p-4 sm:p-5 space-y-3"
              >
                <h3 className="font-display text-base font-bold text-slate-900">{block.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{block.summary}</p>

                {isBlockExpanded && (
                  <ul className="space-y-2 text-xs text-slate-700 leading-relaxed list-disc pl-4 pt-1 border-t border-slate-100">
                    {block.points.map((pt, idx) => (
                      <li key={idx}>{pt}</li>
                    ))}
                  </ul>
                )}

                <button
                  type="button"
                  onClick={() =>
                    setExpandedGuideBlocks((prev) => ({ ...prev, [bIdx]: !prev[bIdx] }))
                  }
                  className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800"
                >
                  <span>{isBlockExpanded ? 'Thu gọn chi tiết' : 'Xem thêm hướng dẫn'}</span>
                  {isBlockExpanded ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
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
            : 'flex-1 max-w-7xl w-full mx-auto px-2.5 sm:px-6 py-3.5 sm:py-6 space-y-5'
        }
      >
        {!currentTournament ? (
          activeTab === 'overview' ? (
            <div className="space-y-5">
              {renderCaoBangTravelSection()}
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
            </div>
          ) : (
            <section className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-xs text-slate-500">
              Chưa có giải đấu nào được chọn.
            </section>
          )
        ) : (
          <>
            {/* TAB 1: TRANG CHỦ — ƯU TIÊN DU LỊCH & ẨM THỰC CAO BẰNG */}
            {activeTab === 'overview' && (
              <div className="space-y-5">
                {renderCaoBangTravelSection()}

                {/* Khối thông tin giải đấu thể thao kết nối */}
                <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 lg:p-7 grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                  <div className="lg:col-span-8 flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                        <span className="font-semibold text-orange-600 uppercase tracking-wider">
                          SỰ KIỆN THỂ THAO TẠI CAO BẰNG · PICKLEBALL 1986
                        </span>
                        <span>·</span>
                        <span>{FORMAT_LABELS[currentTournament.format]}</span>
                        <span>·</span>
                        <span>{TOURNAMENT_STATUS_LABELS[currentTournament.status]}</span>
                      </div>

                      <h2 className="font-display text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900">
                        {currentTournament.name}
                      </h2>

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

                      <button
                        type="button"
                        onClick={() => setActiveTab('schedule')}
                        className="min-h-[42px] px-4 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center justify-center gap-2"
                      >
                        <Calendar className="w-4 h-4 text-orange-600" />
                        Lịch & Nhánh đấu
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
                            <button
                              type="button"
                              onClick={() => setActiveTab('members')}
                              className="min-h-[42px] px-4 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center justify-center gap-2"
                            >
                              <UserPlus className="w-4 h-4 text-orange-600" />
                              Nhập VĐV & Sắp Xếp Bảng
                            </button>
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
                      className="w-18 h-18 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-orange-500 shadow-md"
                    />
                    <div className="my-2">
                      <div className="font-display text-lg sm:text-xl font-extrabold tracking-wide text-orange-400">
                        BÍNH DẦN 1986 PICKLEBALL
                      </div>
                      <p className="text-xs text-slate-300 mt-1">
                        Giao lưu thể thao · Kết nối bạn bè phương xa về với Cao Bằng
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

      {/* Lightbox Modal for Landmark & Cuisine Photos */}
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
                  {lightboxState.title} ({lightboxState.imageIndex + 1}/
                  {lightboxState.images.length})
                </div>
                <div className="text-xs text-slate-300 truncate">{lightboxState.subtitle}</div>
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
                src={resolveMediaSrc(
                  lightboxState.images[lightboxState.imageIndex],
                  lightboxState.fallbackTitle,
                  lightboxState.fallbackTag,
                  lightboxState.fallbackAccent,
                )}
                alt={lightboxState.title}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.currentTarget.src = createTravelPlaceholderSvg(
                    lightboxState.fallbackTitle,
                    lightboxState.fallbackTag,
                    lightboxState.fallbackAccent,
                  );
                }}
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
                          ? 'border-emerald-400'
                          : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={resolveMediaSrc(
                          thumb,
                          lightboxState.fallbackTitle,
                          lightboxState.fallbackTag,
                          lightboxState.fallbackAccent,
                        )}
                        alt={`Ảnh ${idx + 1}`}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.currentTarget.src = createTravelPlaceholderSvg(
                            lightboxState.fallbackTitle,
                            lightboxState.fallbackTag,
                            lightboxState.fallbackAccent,
                          );
                        }}
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
            © 2026 <strong className="text-slate-800">1986 — Bính Dần Pickleball</strong> · Kết nối du lịch, ẩm thực & thể thao Cao Bằng.
          </div>
          <div>
            {isStaff
              ? 'Nhập VĐV & Sắp bảng chủ động · Điều hành bàn trọng tài · Xuất PDF/CSV'
              : 'Du lịch Cao Bằng · Lịch thi đấu · Tỷ số trực tiếp'}
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
