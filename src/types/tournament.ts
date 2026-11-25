import { Timestamp } from 'firebase/firestore';

export type StaffRole = 'admin' | 'referee';
export type UserRole = StaffRole;
export type TournamentFormat = 'group_knockout' | 'round_robin' | 'single_elimination';
export type TournamentStatus = 'draft' | 'open' | 'ongoing' | 'completed';
export type ScoringMode = 'side_out' | 'rally';
export type CompetitionType = 'doubles' | 'team';
export type PaymentStatus = 'unpaid' | 'pending_review' | 'paid';
export type MatchStage = 'group' | 'quarterfinal' | 'semifinal' | 'third_place' | 'final';
export type MatchStatus = 'scheduled' | 'live' | 'completed';
export type NotificationType = 'match_result' | 'court_call' | 'payment_approved' | 'schedule_update';

export type TeamEventSubCategory =
  | 'Trận 1: Đôi Nữ'
  | 'Trận 2: Đôi Nam'
  | 'Trận 3: Đôi Nam Nữ 1'
  | 'Trận 4: Đôi Nam Nữ 2'
  | 'Trận 5 (Hòa 2-2 KO): Đơn Quyết Định 21đ';

export const TEAM_EVENT_SUBCATEGORIES: TeamEventSubCategory[] = [
  'Trận 1: Đôi Nữ',
  'Trận 2: Đôi Nam',
  'Trận 3: Đôi Nam Nữ 1',
  'Trận 4: Đôi Nam Nữ 2',
  'Trận 5 (Hòa 2-2 KO): Đơn Quyết Định 21đ',
];

export const DOUBLES_EVENT_CATEGORIES: string[] = [
  'Đôi Nữ',
  'Đôi Nam',
  'Đôi Nam Nữ',
];

export interface TeamLineupSlot {
  order: 1 | 2 | 3 | 4 | 5;
  label: TeamEventSubCategory;
  teamAPlayer1: string;
  teamAPlayer2: string;
  teamBPlayer1: string;
  teamBPlayer2: string;
  scoreA: number;
  scoreB: number;
  completed: boolean;
  winnerSide: '' | 'A' | 'B';
}

export interface AthleteOption {
  id: string;
  name: string;
  gender: 'Nam' | 'Nữ';
  rating: number;
  club: string;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  club: string;
  rating: number;
  role: UserRole;
  visibility: 'public';
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface StaffAccount {
  id: string;
  username: string;
  password: string;
  displayName: string;
  role: 'admin' | 'referee';
  assignedCourts: string;
  phone?: string;
}

export interface UserPrivateInfo {
  uid: string;
  email: string;
  phone: string;
  updatedAt?: Timestamp | null;
}

export interface Tournament {
  id: string;
  name: string;
  location: string;
  startDate: string;
  endDate: string;
  format: TournamentFormat;
  competitionType?: CompetitionType; // 'doubles' (Nội dung Đôi) | 'team' (Nội dung Đồng đội 4 trận đôi + 1 đơn)
  status: TournamentStatus;
  courtsCount: number;
  pointsToWin: 11 | 15 | 21;
  maxPointsCap?: number; // VD: 18 điểm ở vòng loại trực tiếp khi hòa 14-14 cách biệt 2 điểm
  scoringMode: ScoringMode;
  winByTwo: boolean;
  entryFee: number;
  bankBin: string;
  bankName: string;
  bankAccountNo: string;
  bankAccountName: string;
  divisions: string[];
  description: string;
  visibility: 'public';
  createdBy: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface Registration {
  id: string;
  tournamentId: string;
  ownerUid: string;
  division: string;
  teamName: string;
  player1Name: string;
  player2Name: string;
  squadRoster?: string[]; // Danh sách VĐV đội hình cho nội dung Đồng đội
  club: string;
  combinedRating: number;
  groupName: string;
  seed: number;
  checkedIn: boolean;
  feeAmount: number;
  paymentCode: string;
  paymentStatus: PaymentStatus;
  transferRef: string;
  visibility: 'public';
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface Match {
  id: string;
  tournamentId: string;
  division: string;
  competitionType?: CompetitionType; // 'doubles' | 'team'
  teamSubCategory?: string; // Nội dung Đôi hoặc Lượt trận Đồng đội (Trận 1: Đôi Nữ, Trận 2: Đôi Nam...)
  teamLineupSlots?: TeamLineupSlot[]; // Đăng ký cả 04 trận đôi & trận đơn quyết định cho nội dung Đồng đội
  activeSlotOrder?: 1 | 2 | 3 | 4 | 5; // Trận con đang thi đấu trong loạt trận Đồng đội
  teamGamesWonA?: number; // Số hiệp (trận con) Đội A thắng trong loạt trận Đồng đội
  teamGamesWonB?: number; // Số hiệp (trận con) Đội B thắng trong loạt trận Đồng đội
  forfeitSide?: '' | 'A' | 'B'; // Đội bỏ cuộc (0 điểm, xử thua 0-15 hoặc 0-4)
  maxPointsCap?: number; // Điểm tối đa (VD: 18 điểm ở vòng loại trực tiếp khi chạm 15 cách biệt 2)
  stage: MatchStage;
  roundOrder: number;
  matchNumber: number;
  groupName: string;
  bracketSlot: string;
  nextMatchId: string;
  nextMatchSide: '' | 'A' | 'B';
  teamAId: string;
  teamAName: string;
  teamAPlayer1?: string;
  teamAPlayer2?: string;
  teamBId: string;
  teamBName: string;
  teamBPlayer1?: string;
  teamBPlayer2?: string;
  courtSideA?: 'left' | 'right'; // Sân Trái hoặc Sân Phải của Đội A trên sơ đồ sân
  tossWinner?: '' | 'A' | 'B'; // Đội thắng bốc thăm
  tossNote?: string; // Kết quả bốc thăm (VD: Đội A chọn giao bóng, Sân Trái)
  courtNumber: number;
  scheduledTime: string;
  refereeUid: string;
  refereeName: string;
  status: MatchStatus;
  scoringMode: ScoringMode;
  pointsToWin: number;
  winByTwo: boolean;
  scoreA: number;
  scoreB: number;
  servingTeam: 'A' | 'B';
  serverNumber: 1 | 2;
  timeoutsA: number;
  timeoutsB: number;
  sideSwitched: boolean;
  winnerTeamId: string;
  winnerSide: '' | 'A' | 'B';
  startedAtMs: number;
  durationSeconds: number;
  scoreHistory: string[];
  visibility: 'public';
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface AppNotification {
  id: string;
  tournamentId: string;
  targetUid: string;
  type: NotificationType;
  title: string;
  message: string;
  matchId: string;
  createdBy: string;
  createdAt?: Timestamp | null;
}

export interface StandingRow {
  teamId: string;
  teamName: string;
  club: string;
  groupName: string;
  division: string;
  played: number;
  wins: number; // Thắng: 03 điểm
  draws: number; // Hòa (2-2 ở vòng bảng đồng đội): 02 điểm
  losses: number; // Thua: 01 điểm
  forfeits: number; // Bỏ cuộc: 0 điểm
  gamesWon: number; // Số hiệp thắng
  gamesLost: number; // Số hiệp thua
  gameDiff: number; // Hiệu số hiệp thắng - hiệp thua
  pointsFor: number; // Tổng điểm thắng
  pointsAgainst: number; // Tổng điểm thua
  pointDiff: number; // Hiệu số điểm thắng - điểm thua
  rankPoints: number; // Điểm xếp hạng (Thắng 3, Hòa 2, Thua 1, Bỏ cuộc 0)
  qualified: boolean;
}

export interface VietnamBank {
  bin: string;
  shortName: string;
  fullName: string;
}

export const VIETNAM_BANKS: VietnamBank[] = [
  { bin: '970436', shortName: 'Vietcombank', fullName: 'Ngân hàng TMCP Ngoại thương Việt Nam' },
  { bin: '970422', shortName: 'MB Bank', fullName: 'Ngân hàng TMCP Quân đội' },
  { bin: '970407', shortName: 'Techcombank', fullName: 'Ngân hàng TMCP Kỹ thương Việt Nam' },
  { bin: '970418', shortName: 'BIDV', fullName: 'Ngân hàng TMCP Đầu tư và Phát triển VN' },
  { bin: '970415', shortName: 'VietinBank', fullName: 'Ngân hàng TMCP Công thương Việt Nam' },
  { bin: '970416', shortName: 'ACB', fullName: 'Ngân hàng TMCP Á Châu' },
  { bin: '970432', shortName: 'VPBank', fullName: 'Ngân hàng TMCP Việt Nam Thịnh Vượng' },
  { bin: '970423', shortName: 'TPBank', fullName: 'Ngân hàng TMCP Tiên Phong' },
];

export const FORMAT_LABELS: Record<TournamentFormat, string> = {
  group_knockout: 'Vòng bảng + Loại trực tiếp',
  round_robin: 'Vòng tròn tính điểm',
  single_elimination: 'Loại trực tiếp',
};

export const COMPETITION_TYPE_LABELS: Record<CompetitionType, string> = {
  doubles: 'Nội dung Đôi (Đôi Nữ / Đôi Nam / Đôi Nam Nữ)',
  team: 'Nội dung Đồng đội (4 trận Đôi 15đ + 1 Đơn quyết định 21đ)',
};

export const TOURNAMENT_STATUS_LABELS: Record<TournamentStatus, string> = {
  draft: 'Bản nháp',
  open: 'Đang mở đăng ký',
  ongoing: 'Đang thi đấu',
  completed: 'Đã kết thúc',
};

export const MATCH_STAGE_LABELS: Record<MatchStage, string> = {
  group: 'Vòng bảng',
  quarterfinal: 'Tứ kết',
  semifinal: 'Bán kết',
  third_place: 'Tranh hạng 3',
  final: 'Chung kết',
};

export const MATCH_STATUS_LABELS: Record<MatchStatus, string> = {
  scheduled: 'Sắp đấu',
  live: 'Đang đấu',
  completed: 'Đã xong',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: 'Chưa đóng phí',
  pending_review: 'Chờ BTC duyệt',
  paid: 'Đã xác nhận',
};

eexport const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Ban Tổ Chức',
  referee: 'Trọng tài',
};


export const DEFAULT_DIVISIONS = [
  'Đồng Đội CLB 1986 (4 Đôi + 1 Đơn)',
  'Đôi Nam 5.5',
  'Đôi Nam Nữ 5.0',
  'Đôi Nữ 4.5',
];

export const CHARTER_REGULATION_SUMMARY = {
  legalDecision: 'Quyết định số 494/QĐTDTTVN ngày 26/5/2025 của Cục Thể dục Thể thao Việt Nam',
  teamMatchOrder: [
    'Trận 1: Đôi Nữ (Chạm 15 điểm, 08 điểm đổi sân)',
    'Trận 2: Đôi Nam (Chạm 15 điểm, 08 điểm đổi sân)',
    'Trận 3: Đôi Nam Nữ 1 (Chạm 15 điểm, 08 điểm đổi sân)',
    'Trận 4: Đôi Nam Nữ 2 (Chạm 15 điểm, 08 điểm đổi sân)',
    'Trận 5 (Vòng loại trực tiếp khi hòa 2-2): Đơn quyết định 21 điểm (Rally ăn điểm trực tiếp, luân phiên 04 điểm/cặp Nam-Nam & Nữ-Nữ, 11 điểm đổi sân)',
  ],
  maxMatchesPerAthlete: 2,
  groupStageRule: 'Vòng bảng: Thi đấu 04 trận đôi, mỗi trận chạm 15 điểm, 08 điểm đổi sân.',
  knockoutStageRule:
    'Vòng loại trực tiếp: Thi đấu 04 trận đôi chạm 15 điểm, 08 điểm đổi sân (14-14 thắng cách biệt 02 điểm, tối đa 18 điểm). Hòa 2-2 đấu 01 trận đơn quyết định 21 điểm.',
  rankingPointsRule:
    'Thắng: 03 điểm · Hòa: 02 điểm · Thua: 01 điểm · Bỏ cuộc: 0 điểm (Đôi bỏ cuộc xử thua 0-15; Đồng đội bỏ cuộc xử thua 0-4 tương ứng 0-15 mỗi trận).',
  tieBreakerRule:
    '2 đội bằng điểm: Xét đối đầu trực tiếp. Từ 3 đội trở lên bằng điểm: (1) Hiệu số hiệp thắng - hiệp thua → (2) Hiệu số điểm thắng - điểm thua → (3) Bốc thăm (nếu còn 2 đội bằng nhau ở bất kỳ bước nào sẽ xét đối đầu trực tiếp).',
};

export const BRAND_LOGO_URL = './assets/aistudio/logo_22f96794.jpg';
export const CHARTER_IMAGE_URL = './assets/aistudio/IMG_20261117_213832_1526f22b.jpg';

