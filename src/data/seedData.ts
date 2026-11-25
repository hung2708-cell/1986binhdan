import type {
  AppNotification,
  Match,
  Registration,
  StaffAccount,
  Tournament,
  UserProfile,
} from '../types/tournament';

export const INITIAL_STAFF_ACCOUNTS: StaffAccount[] = [
  {
    id: 'acc_admin_01',
    username: 'admin',
    password: '1986',
    displayName: 'Đào Kim Trọng (Trưởng BTC 1986)',
    role: 'admin',
    assignedCourts: 'Toàn bộ cụm sân',
    phone: '0904 198 686',
  },
  {
    id: 'acc_ref_01',
    username: 'tt1',
    password: 'tt1234',
    displayName: 'Trần Quốc Tuấn (Trọng tài Sân 1 & 3)',
    role: 'referee',
    assignedCourts: 'Sân 1, Sân 3',
    phone: '0988 111 986',
  },
  {
    id: 'acc_ref_02',
    username: 'tt2',
    password: 'tt1234',
    displayName: 'Lê Hoàng Nam (Trọng tài Sân 2 & 4)',
    role: 'referee',
    assignedCourts: 'Sân 2, Sân 4',
    phone: '0977 222 986',
  },
  {
    id: 'acc_ref_03',
    username: 'tt3',
    password: 'tt1234',
    displayName: 'Phạm Văn Khoa (Trọng tài Điều hành)',
    role: 'referee',
    assignedCourts: 'Tất cả các sân',
    phone: '0966 333 986',
  },
];

export const INITIAL_USERS: UserProfile[] = [
  {
    uid: 'u_admin_1986',
    displayName: 'Đào Kim Trọng (Trưởng BTC 1986)',
    photoURL: './assets/aistudio/logo_22f96794.jpg',
    club: 'CLB Bính Dần 1986',
    rating: 5.5,
    role: 'admin',
    visibility: 'public',
  },
  {
    uid: 'u_ref_01',
    displayName: 'Trần Quốc Tuấn (Trọng tài Sân 1 & 3)',
    photoURL: '',
    club: 'Hội Trọng Tài Pickleball 1986',
    rating: 5.0,
    role: 'referee',
    visibility: 'public',
  },
  {
    uid: 'u_ref_02',
    displayName: 'Lê Hoàng Nam (Trọng tài Sân 2 & 4)',
    photoURL: '',
    club: 'Hội Trọng Tài Pickleball 1986',
    rating: 4.8,
    role: 'referee',
    visibility: 'public',
  },
];

export const INITIAL_TOURNAMENTS: Tournament[] = [
  {
    id: 't_1986_binh_dan_open',
    name: 'Giải Pickleball 1986 Bính Dần Open',
    location: 'Cụm Sân Pickleball 1986 Arena',
    startDate: '2026-11-28',
    endDate: '2026-11-29',
    format: 'group_knockout',
    competitionType: 'doubles',
    status: 'ongoing',
    courtsCount: 4,
    pointsToWin: 15,
    maxPointsCap: 18,
    scoringMode: 'side_out',
    winByTwo: true,
    entryFee: 0,
    bankBin: '',
    bankName: '',
    bankAccountNo: '',
    bankAccountName: '',
    divisions: [],
    description:
      'Áp dụng Điều lệ thi đấu theo Quyết định số 494/QĐTDTTVN ngày 26/5/2025 của Cục TDTT Việt Nam: Chạm 15 điểm (08đ đổi sân; Vòng loại trực tiếp 14-14 thắng cách biệt 02đ, max 18đ). Tài khoản Admin thêm nội dung Đôi hoặc Đồng đội tùy nhu cầu giải.',
    visibility: 'public',
    createdBy: 'u_admin_1986',
  },
  {
    id: 't_1986_masters_cup',
    name: '1986 Tiger Super Cup',
    location: 'Cụm Sân Pickleball Bính Dần 1986',
    startDate: '2026-12-12',
    endDate: '2026-12-13',
    format: 'group_knockout',
    competitionType: 'doubles',
    status: 'open',
    courtsCount: 6,
    pointsToWin: 15,
    maxPointsCap: 18,
    scoringMode: 'side_out',
    winByTwo: true,
    entryFee: 0,
    bankBin: '',
    bankName: '',
    bankAccountNo: '',
    bankAccountName: '',
    divisions: [],
    description:
      'Giải đấu mở rộng dành cho các CLB Pickleball 1986 theo Điều lệ Quyết định 494/QĐTDTTVN: Thắng 03đ, Hòa 02đ, Thua 01đ, Bỏ cuộc 0đ.',
    visibility: 'public',
    createdBy: 'u_admin_1986',
  },
];

export const INITIAL_REGISTRATIONS: Registration[] = [];

export const INITIAL_MATCHES: Match[] = [];

export const INITIAL_NOTIFICATIONS: AppNotification[] = [];
