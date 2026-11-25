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

export const INITIAL_TOURNAMENTS: Tournament[] = [];

export const INITIAL_REGISTRATIONS: Registration[] = [];

export const INITIAL_MATCHES: Match[] = [];

export const INITIAL_NOTIFICATIONS: AppNotification[] = [];
