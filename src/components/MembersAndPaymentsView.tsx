import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  FolderKanban,
  Lock,
  Plus,
  Search,
  ShieldAlert,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  ROLE_LABELS,
  type Registration,
  type StaffAccount,
  type Tournament,
} from '../types/tournament';
import { isTeamDivision } from '../utils/pickleballEngine';

type SkillTier = 'Trình A' | 'Trình B' | 'Trình C';
type GenderOption = 'Nam' | 'Nữ';

interface MembersAndPaymentsViewProps {
  tournament: Tournament;
  registrations: Registration[];
  currentAccount: StaffAccount | null;
  onRequestLogin: (reason: string) => void;
  onAddDivision: (divisionName: string, compType: 'doubles' | 'team') => void;
  onAddRegistration: (payload: {
    division: string;
    player1Name: string;
    player2Name: string;
    club: string;
    combinedRating: number;
    groupName?: string;
    squadRoster?: string[];
  }) => void;
  onAssignRegistrationGroup: (registrationId: string, groupName: string) => void;
  onToggleCheckIn: (registrationId: string) => void;
}

const DEFAULT_GROUP_OPTIONS = ['Bảng A', 'Bảng B', 'Bảng C', 'Bảng D'];

const TIER_RATING_MAP: Record<SkillTier, number> = {
  'Trình A': 6.0,
  'Trình B': 5.0,
  'Trình C': 4.0,
};

export const MembersAndPaymentsView: React.FC<MembersAndPaymentsViewProps> = ({
  tournament,
  registrations,
  currentAccount,
  onRequestLogin,
  onAddDivision,
  onAddRegistration,
  onAssignRegistrationGroup,
  onToggleCheckIn,
}) => {
  const isAdmin = currentAccount?.role === 'admin';
  const isStaff = Boolean(
    currentAccount && (currentAccount.role === 'admin' || currentAccount.role === 'referee'),
  );

  const [newDivisionName, setNewDivisionName] = useState('');
  const [newDivisionType, setNewDivisionType] = useState<'doubles' | 'team'>('team');

  const [selectedDivision, setSelectedDivision] = useState<string>(
    tournament.divisions[0] || 'Đôi Nam 5.5',
  );
  const [selectedGroup, setSelectedGroup] = useState<string>('Bảng A');
  const [customGroupInput, setCustomGroupInput] = useState<string>('');
  const [skillTier, setSkillTier] = useState<SkillTier>('Trình B');
  const [gender, setGender] = useState<GenderOption>('Nam');

  const [player1Name, setPlayer1Name] = useState('');
  const [player2Name, setPlayer2Name] = useState('');
  const [squadText, setSquadText] = useState('');
  const [club, setClub] = useState('CLB Bính Dần 1986');
  const [combinedRating, setCombinedRating] = useState<string>(
    String(TIER_RATING_MAP['Trình B']),
  );

  const [filterDivision, setFilterDivision] = useState<string>('ALL');
  const [filterGroup, setFilterGroup] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const activeDivisionIsTeam = isTeamDivision(selectedDivision);

  const availableGroups = useMemo(() => {
    const existing = registrations
      .map((r) => r.groupName)
      .filter((g): g is string => Boolean(g && g.trim()));
    return Array.from(new Set([...DEFAULT_GROUP_OPTIONS, ...existing]));
  }, [registrations]);

  const handleTierChange = (nextTier: SkillTier) => {
    setSkillTier(nextTier);
    setCombinedRating(String(TIER_RATING_MAP[nextTier]));
  };

  const handleCreateDivision = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      onRequestLogin(
        'Vui lòng đăng nhập tài khoản Ban Tổ Chức (Admin) để thêm nội dung Đôi hoặc Đồng đội.',
      );
      return;
    }
    if (!newDivisionName.trim()) return;
    onAddDivision(newDivisionName.trim(), newDivisionType);
    const normalized =
      newDivisionType === 'team' && !newDivisionName.toLowerCase().includes('đồng đội')
        ? `Đồng Đội - ${newDivisionName.trim()}`
        : newDivisionType === 'doubles' && !newDivisionName.toLowerCase().includes('đôi')
        ? `Đôi - ${newDivisionName.trim()}`
        : newDivisionName.trim();
    setSelectedDivision(normalized);
    setNewDivisionName('');
  };

  const handleCreateRegistration = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      onRequestLogin(
        'Chỉ tài khoản Ban Tổ Chức (Admin) mới có quyền thêm VĐV/đội và sắp xếp bảng thi đấu.',
      );
      return;
    }
    if (!player1Name.trim()) return;

    const targetGroup = customGroupInput.trim() || selectedGroup || 'Bảng A';
    const parsedSquad = squadText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const baseRoster = activeDivisionIsTeam
      ? Array.from(
          new Set([
            player1Name.trim(),
            ...(player2Name.trim() ? [player2Name.trim()] : []),
            ...parsedSquad,
          ]),
        )
      : [player1Name.trim(), ...(player2Name.trim() ? [player2Name.trim()] : [])];

    const metaRoster = [
      ...baseRoster,
      `[${gender} · ${skillTier}]`,
    ];

    onAddRegistration({
      division: selectedDivision,
      player1Name: player1Name.trim(),
      player2Name: player2Name.trim(),
      club: club.trim() || 'CLB Bính Dần 1986',
      combinedRating: parseFloat(combinedRating) || TIER_RATING_MAP[skillTier],
      groupName: targetGroup,
      squadRoster: metaRoster,
    });

    setPlayer1Name('');
    setPlayer2Name('');
    setSquadText('');
    setCustomGroupInput('');
  };

  const filteredRegistrations = useMemo(() => {
    return registrations.filter((r) => {
      if (filterDivision !== 'ALL' && r.division !== filterDivision) return false;
      if (filterGroup !== 'ALL' && (r.groupName || 'Chưa phân bảng') !== filterGroup) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const squadStr = (r.squadRoster || []).join(' ').toLowerCase();
        return (
          r.teamName.toLowerCase().includes(q) ||
          r.club.toLowerCase().includes(q) ||
          r.division.toLowerCase().includes(q) ||
          (r.groupName || '').toLowerCase().includes(q) ||
          squadStr.includes(q)
        );
      }
      return true;
    });
  }, [registrations, filterDivision, filterGroup, searchQuery]);

  const groupedSummary = useMemo(() => {
    const map: Record<string, Registration[]> = {};
    filteredRegistrations.forEach((reg) => {
      const gKey = reg.groupName || 'Chưa phân bảng';
      if (!map[gKey]) map[gKey] = [];
      map[gKey].push(reg);
    });
    return map;
  }, [filteredRegistrations]);

  const extractTierAndGender = (reg: Registration) => {
    const roster = reg.squadRoster || [];
    const foundTier = roster.find((x) =>
      ['Trình A', 'Trình B', 'Trình C'].some((t) => x.includes(t)),
    );
    const tierLabel =
      foundTier?.match(/Trình [ABC]/)?.[0] ||
      (reg.combinedRating >= 5.8
        ? 'Trình A'
        : reg.combinedRating <= 4.3
        ? 'Trình C'
        : 'Trình B');

    const foundGender = roster.find((x) => x.includes('Nam') || x.includes('Nữ'));
    const genderLabel = foundGender?.includes('Nữ')
      ? 'Nữ'
      : foundGender?.includes('Nam')
      ? 'Nam'
      : reg.division.toLowerCase().includes('nữ')
      ? 'Nữ'
      : 'Nam';

    return { tierLabel, genderLabel };
  };

  return (
    <div className="space-y-6">
      {/* Role / Permission Notice Banner */}
      {!isAdmin && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 text-xs text-amber-900">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">
                {currentAccount
                  ? `Bạn đang đăng nhập bằng tài khoản ${ROLE_LABELS[currentAccount.role]} (${currentAccount.displayName})`
                  : 'Bạn đang xem ở chế độ Khán giả (Chưa đăng nhập)'}
              </div>
              <p className="mt-0.5 text-amber-800">
                Chỉ tài khoản <strong>Ban Tổ Chức (Admin)</strong> mới được thêm nội dung, nhập VĐV/đội và sắp xếp bảng thi đấu.
                {currentAccount?.role === 'referee' && ' Trọng tài có thể thực hiện Check-in VĐV tại sân.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              onRequestLogin(
                'Vui lòng đăng nhập tài khoản Ban Tổ Chức (Admin) để nhập VĐV và sắp xếp bảng.',
              )
            }
            className="min-h-[38px] px-3.5 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold flex items-center gap-1.5 shrink-0"
          >
            <Lock className="w-3.5 h-3.5" />
            Đăng nhập Admin
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Add Division + Add Athlete/Team & Assign Group */}
        <div className="lg:col-span-5 space-y-5">
          {/* Step 1: Admin creates new division (Doubles or Team) */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold uppercase text-slate-900">
                1. THÊM NỘI DUNG THI ĐẤU (ĐÔI / ĐỒNG ĐỘI)
              </h3>
              {!isAdmin && <Lock className="w-4 h-4 text-slate-400" />}
            </div>
            <p className="text-xs text-slate-500">
              Chọn hình thức <strong>Đôi</strong> hoặc <strong>Đồng đội</strong> và nhập tên nội dung mới.
            </p>

            <form onSubmit={handleCreateDivision} className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setNewDivisionType('doubles')}
                  className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                    newDivisionType === 'doubles'
                      ? 'bg-orange-600 text-white border-orange-600'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  Nội dung Đôi
                </button>
                <button
                  type="button"
                  onClick={() => setNewDivisionType('team')}
                  className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                    newDivisionType === 'team'
                      ? 'bg-orange-600 text-white border-orange-600'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  Nội dung Đồng đội
                </button>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newDivisionName}
                  onChange={(e) => setNewDivisionName(e.target.value)}
                  placeholder={
                    newDivisionType === 'team'
                      ? 'VD: Đồng Đội CLB 1986'
                      : 'VD: Đôi Nam Nữ Hỗn Hợp'
                  }
                  className="flex-1 min-h-[40px] px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <button
                  type="submit"
                  className="min-h-[40px] px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-orange-600 text-white text-xs font-bold flex items-center gap-1 shrink-0 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Thêm
                </button>
              </div>
            </form>
          </div>

          {/* Step 2: Admin inputs Athletes/Teams & assigns Group + Tier + Gender */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg font-bold tracking-tight text-slate-900 uppercase">
                  2. NHẬP VĐV & SẮP XẾP BẢNG THI ĐẤU
                </h3>
                <p className="text-xs text-slate-500">
                  Thêm VĐV/đội, chọn giới tính, hạng trình (A/B/C) và xếp bảng
                </p>
              </div>
              {!isAdmin && <Lock className="w-4 h-4 text-slate-400" />}
            </div>

            <form onSubmit={handleCreateRegistration} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nội dung thi đấu *
                </label>
                <select
                  value={selectedDivision}
                  onChange={(e) => setSelectedDivision(e.target.value)}
                  className="w-full min-h-[40px] px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg bg-white"
                >
                  {tournament.divisions.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              {/* Giới tính Nam / Nữ */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Giới tính *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['Nam', 'Nữ'] as GenderOption[]).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGender(g)}
                      className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                        gender === g
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* Hạng trình A / B / C */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Hạng trình *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Trình A', 'Trình B', 'Trình C'] as SkillTier[]).map((tier) => (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => handleTierChange(tier)}
                      className={`min-h-[38px] px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                        skillTier === tier
                          ? 'bg-orange-600 text-white border-orange-600'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {tier}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {activeDivisionIsTeam ? 'Tên Đội / Đội trưởng *' : 'VĐV 1 *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={player1Name}
                    onChange={(e) => setPlayer1Name(e.target.value)}
                    placeholder={activeDivisionIsTeam ? 'VD: Team 1' : 'VD: Nguyễn Văn A'}
                    className="w-full min-h-[40px] px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {activeDivisionIsTeam ? 'Đội phó / VĐV chủ lực 2' : 'VĐV 2'}
                  </label>
                  <input
                    type="text"
                    value={player2Name}
                    onChange={(e) => setPlayer2Name(e.target.value)}
                    placeholder={activeDivisionIsTeam ? 'VD: Trọng' : 'VD: Trần Văn B'}
                    className="w-full min-h-[40px] px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              {activeDivisionIsTeam && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Danh sách VĐV thành viên Đồng đội (cách nhau dấu phẩy)
                  </label>
                  <input
                    type="text"
                    value={squadText}
                    onChange={(e) => setSquadText(e.target.value)}
                    placeholder="VD: Duy, Trọng, Hương, Minh, Lan"
                    className="w-full min-h-[40px] px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
              )}

              {/* Manual Group Assignment */}
              <div className="p-3 rounded-xl bg-orange-50/70 border border-orange-200/80 space-y-2">
                <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <FolderKanban className="w-3.5 h-3.5 text-orange-600" />
                  Xếp vào bảng thi đấu (tự sắp xếp)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <select
                    value={selectedGroup}
                    onChange={(e) => setSelectedGroup(e.target.value)}
                    className="w-full min-h-[38px] px-2.5 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg bg-white"
                  >
                    {availableGroups.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={customGroupInput}
                    onChange={(e) => setCustomGroupInput(e.target.value)}
                    placeholder="Hoặc nhập tên bảng mới (VD: Bảng E)"
                    className="w-full min-h-[38px] px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Câu lạc bộ
                  </label>
                  <input
                    type="text"
                    value={club}
                    onChange={(e) => setClub(e.target.value)}
                    className="w-full min-h-[40px] px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Điểm trình tổng
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={combinedRating}
                    onChange={(e) => setCombinedRating(e.target.value)}
                    className="w-full min-h-[40px] px-3 py-1.5 text-xs font-mono-num border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                Thêm VĐV & Xếp Bảng
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Group Board Overview + Athlete/Team Roster & Group Re-assignment */}
        <div className="lg:col-span-7 space-y-4">
          {/* Group Board Summary Cards */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-bold uppercase tracking-wider text-slate-800">
                SƠ ĐỒ CÁC BẢNG ĐÃ SẮP XẾP ({Object.keys(groupedSummary).length} BẢNG)
              </h3>
              <span className="text-xs text-slate-500">
                Có thể đổi bảng trực tiếp cho từng đội
              </span>
            </div>

            {Object.keys(groupedSummary).length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                Chưa có VĐV hoặc đội nào được xếp bảng.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.entries(groupedSummary).map(([groupName, items]) => (
                  <div
                    key={groupName}
                    className="border border-slate-200 rounded-xl p-3 bg-slate-50/60 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold uppercase text-orange-700 bg-orange-100 px-2 py-0.5 rounded-md">
                        {groupName}
                      </span>
                      <span className="text-[11px] font-mono-num font-semibold text-slate-600">
                        {items.length} đội/VĐV
                      </span>
                    </div>
                    <ul className="space-y-1 text-xs">
                      {items.map((item, idx) => {
                        const meta = extractTierAndGender(item);
                        return (
                          <li
                            key={item.id}
                            className="flex items-center justify-between gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200/80"
                          >
                            <span className="font-semibold text-slate-900 truncate">
                              {idx + 1}. {item.teamName}
                            </span>
                            <span className="text-[10px] text-slate-500 shrink-0">
                              {meta.genderLabel} · {meta.tierLabel}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Search & Filter Bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm VĐV, đội, trình A/B/C, nam/nữ, CLB hoặc bảng..."
                className="w-full min-h-[38px] pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg"
              />
            </div>

            <select
              value={filterGroup}
              onChange={(e) => setFilterGroup(e.target.value)}
              className="min-h-[38px] px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg bg-white"
            >
              <option value="ALL">Tất cả các bảng</option>
              {availableGroups.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>

            <select
              value={filterDivision}
              onChange={(e) => setFilterDivision(e.target.value)}
              className="min-h-[38px] px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg bg-white"
            >
              <option value="ALL">Tất cả nội dung</option>
              {tournament.divisions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Registrations Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-orange-600" />
                <h3 className="font-display text-base font-bold uppercase text-slate-900">
                  DANH SÁCH VĐV / ĐỘI ĐÃ NHẬP ({filteredRegistrations.length})
                </h3>
              </div>
            </div>

            <div className="divide-y divide-slate-200">
              {filteredRegistrations.map((reg) => {
                const isTeam = isTeamDivision(reg.division);
                const { tierLabel, genderLabel } = extractTierAndGender(reg);
                const rosterWithoutMeta = (reg.squadRoster || []).filter(
                  (item) => !item.startsWith('['),
                );

                return (
                  <div
                    key={reg.id}
                    className="p-4 hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-bold text-slate-900">{reg.teamName}</span>
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-orange-100 text-orange-700">
                          {reg.groupName || 'Chưa phân bảng'}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700">
                          {genderLabel}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-100 text-amber-800">
                          {tierLabel}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                          {reg.division}
                        </span>
                      </div>

                      <div className="text-xs text-slate-500">
                        CLB: <strong className="text-slate-700">{reg.club}</strong> · Trình:{' '}
                        <span className="font-mono-num font-semibold text-slate-700">
                          {reg.combinedRating.toFixed(1)}
                        </span>
                      </div>

                      {isTeam && rosterWithoutMeta.length > 0 && (
                        <div className="text-[11px] text-slate-600 bg-slate-50 border border-slate-200/80 rounded-lg px-2.5 py-1">
                          <strong>Đội hình ({rosterWithoutMeta.length} VĐV):</strong>{' '}
                          {rosterWithoutMeta.join(', ')}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                      {/* Admin can re-assign group anytime */}
                      <select
                        value={reg.groupName || 'Bảng A'}
                        onChange={(e) => onAssignRegistrationGroup(reg.id, e.target.value)}
                        className="min-h-[34px] px-2 py-1 text-xs font-semibold border border-slate-300 rounded-lg bg-white"
                      >
                        {availableGroups.map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => onToggleCheckIn(reg.id)}
                        className={`min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                          reg.checkedIn
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {reg.checkedIn ? 'Đã Check-in' : 'Check-in'}
                      </button>
                    </div>
                  </div>
                );
              })}

              {filteredRegistrations.length === 0 && (
                <div className="p-8 text-center text-xs text-slate-500">
                  Chưa có VĐV/đội nào khớp bộ lọc hiện tại.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
