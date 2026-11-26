import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  FolderPlus,
  Layers,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Shuffle,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  type Registration,
  type StaffAccount,
  type Tournament,
} from '../types/tournament';
import { isTeamDivision } from '../utils/pickleballEngine';

type ThemeMode = 'light' | 'dark';
type CompCategory = 'team' | 'doubles';
type SkillTier = 'Trình A' | 'Trình B' | 'Trình C';
type AthleteGender = 'Nam' | 'Nữ';

interface MembersAndPaymentsViewProps {
  tournament: Tournament;
  registrations: Registration[];
  currentAccount: StaffAccount | null;
  themeMode?: ThemeMode;
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

const GROUP_OPTIONS = ['Bảng A', 'Bảng B', 'Bảng C', 'Bảng D'];
const TIER_OPTIONS: SkillTier[] = ['Trình A', 'Trình B', 'Trình C'];

export const MembersAndPaymentsView: React.FC<MembersAndPaymentsViewProps> = ({
  tournament,
  registrations,
  currentAccount,
  themeMode = 'light',
  onRequestLogin,
  onAddDivision,
  onAddRegistration,
  onAssignRegistrationGroup,
  onToggleCheckIn,
}) => {
  const isDark = themeMode === 'dark';
  const isAdmin = currentAccount?.role === 'admin';

  // Mặc định không chọn nội dung để không hiển thị nội dung bên trong cho đến khi người dùng chọn
  const [selectedCategory, setSelectedCategory] = useState<CompCategory>('team');
  const [selectedDivision, setSelectedDivision] = useState<string>('');

  // Form thêm nội dung mới
  const [newDivisionName, setNewDivisionName] = useState<string>('');

  // Form nhập VĐV (chỉ Nam/Nữ và Trình A, B, C — không điểm trình)
  const [athleteGender, setAthleteGender] = useState<AthleteGender>('Nam');
  const [athleteTier, setAthleteTier] = useState<SkillTier>('Trình B');
  const [selectedGroup, setSelectedGroup] = useState<string>('Bảng A');
  const [athletesInput, setAthletesInput] = useState<string>('');
  const [clubName, setClubName] = useState<string>('CLB Bính Dần 1986');

  // Bộ lọc danh sách bên phải
  const [filterDivision, setFilterDivision] = useState<string>('all');
  const [filterGroup, setFilterGroup] = useState<string>('all');

  const divisionsInCategory = useMemo(() => {
    return tournament.divisions.filter((div) => {
      const team = isTeamDivision(div);
      return selectedCategory === 'team' ? team : !team;
    });
  }, [tournament.divisions, selectedCategory]);

  // Nếu người dùng đổi loại Đồng đội / Đôi mà nội dung đang chọn không thuộc loại đó thì reset về rỗng
  useEffect(() => {
    if (selectedDivision && !divisionsInCategory.includes(selectedDivision)) {
      setSelectedDivision('');
    }
  }, [divisionsInCategory, selectedDivision]);

  const stats = useMemo(() => {
    let maleCount = 0;
    let femaleCount = 0;
    let checkedInCount = 0;

    registrations.forEach((reg) => {
      if (reg.checkedIn) checkedInCount += 1;
      const rosterText = [
        ...(reg.squadRoster || []),
        reg.player1Name,
        reg.player2Name,
        reg.teamName,
      ]
        .filter(Boolean)
        .join(' ');

      const maleMatches = rosterText.match(/\(\s*Nam\b/gi);
      const femaleMatches = rosterText.match(/\(\s*Nữ\b/gi);
      if (maleMatches || femaleMatches) {
        maleCount += maleMatches ? maleMatches.length : 0;
        femaleCount += femaleMatches ? femaleMatches.length : 0;
      } else {
        maleCount += 1;
      }
    });

    return {
      maleCount,
      femaleCount,
      totalTeams: registrations.length,
      checkedInCount,
    };
  }, [registrations]);

  const filteredRegistrations = useMemo(() => {
    return registrations.filter((reg) => {
      if (filterDivision !== 'all' && reg.division !== filterDivision) return false;
      if (filterGroup !== 'all' && (reg.groupName || 'Bảng A') !== filterGroup) return false;
      return true;
    });
  }, [registrations, filterDivision, filterGroup]);

  const cardSurface = isDark
    ? 'bg-slate-900 border-slate-800 text-slate-100'
    : 'bg-white border-slate-200 text-slate-900';

  const subSurface = isDark
    ? 'bg-slate-950/70 border-slate-800 text-slate-100'
    : 'bg-slate-50 border-slate-200 text-slate-900';

  const inputSurface = isDark
    ? 'bg-slate-950 border-slate-700 text-white placeholder:text-slate-500'
    : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400';

  const mutedText = isDark ? 'text-slate-400' : 'text-slate-600';

  const handleSelectCategory = (category: CompCategory) => {
    setSelectedCategory(category);
    setSelectedDivision('');
  };

  const handleSelectDivisionChip = (divisionName: string) => {
    setSelectedDivision((prev) => (prev === divisionName ? '' : divisionName));
  };

  const handleCreateDivision = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      onRequestLogin('Chỉ tài khoản Admin mới có quyền thêm nội dung thi đấu.');
      return;
    }
    const clean = newDivisionName.trim();
    if (!clean) return;
    onAddDivision(clean, selectedCategory);
    setSelectedDivision(clean);
    setNewDivisionName('');
  };

  const handleAddAthletesSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      onRequestLogin('Chỉ tài khoản Admin mới có quyền thêm VĐV và phân bảng.');
      return;
    }
    if (!selectedDivision) return;

    const rawNames = athletesInput
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    if (rawNames.length === 0) return;

    const formattedNames = rawNames.map((name) => `${name} (${athleteGender} · ${athleteTier})`);

    if (selectedCategory === 'team') {
      onAddRegistration({
        division: selectedDivision,
        player1Name: formattedNames[0],
        player2Name: formattedNames[1] || '',
        squadRoster: formattedNames,
        club: clubName.trim() || 'CLB Bính Dần 1986',
        combinedRating: 0,
        groupName: selectedGroup,
      });
    } else {
      for (let i = 0; i < formattedNames.length; i += 2) {
        const p1 = formattedNames[i];
        const p2 = formattedNames[i + 1] || '';
        onAddRegistration({
          division: selectedDivision,
          player1Name: p1,
          player2Name: p2,
          squadRoster: [p1, p2].filter(Boolean),
          club: clubName.trim() || 'CLB Bính Dần 1986',
          combinedRating: 0,
          groupName: selectedGroup,
        });
      }
    }

    setAthletesInput('');
  };

  const handleRandomGroups = (targetList: Registration[]) => {
    if (!isAdmin) {
      onRequestLogin('Chỉ tài khoản Admin mới có quyền chia bảng ngẫu nhiên.');
      return;
    }
    if (targetList.length === 0) return;

    const poolNames = ['Bảng A', 'Bảng B', 'Bảng C'];
    const shuffled = [...targetList].sort(() => Math.random() - 0.5);
    shuffled.forEach((reg, idx) => {
      const nextGroup = poolNames[idx % poolNames.length];
      onAssignRegistrationGroup(reg.id, nextGroup);
    });
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header tổng quan */}
      <section className={`border rounded-2xl p-4 sm:p-5 space-y-3.5 ${cardSurface}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-orange-500">
              <Users className="w-3.5 h-3.5 shrink-0" />
              <span>QUẢN LÝ VĐV, NỘI DUNG & SẮP XẾP BẢNG THI ĐẤU</span>
            </div>
            <h1 className="font-display text-lg sm:text-2xl font-extrabold tracking-tight">
              {selectedCategory === 'team' ? 'Đồng đội' : 'Đôi'} — {tournament.name}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 font-mono-num text-xs">
            <span className="px-3 py-1.5 rounded-lg bg-sky-500/15 text-sky-400 border border-sky-500/30 font-bold">
              Nam: {stats.maleCount}
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-rose-500/15 text-rose-400 border border-rose-500/30 font-bold">
              Nữ: {stats.femaleCount}
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 border border-slate-700 font-bold">
              Tổng đội: {stats.totalTeams}
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold">
              Check-in: {stats.checkedInCount}/{stats.totalTeams}
            </span>
          </div>
        </div>

        {/* Lựa chọn loại nội dung thi đấu: Đồng đội | Đôi */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div
            className={`inline-flex rounded-xl p-1 border ${
              isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'
            }`}
          >
            <button
              type="button"
              onClick={() => handleSelectCategory('team')}
              className={`min-h-[36px] px-4 py-1.5 rounded-lg text-xs font-extrabold transition-colors ${
                selectedCategory === 'team'
                  ? 'bg-orange-600 text-white'
                  : isDark
                  ? 'text-slate-300 hover:text-white'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              Đồng đội
            </button>
            <button
              type="button"
              onClick={() => handleSelectCategory('doubles')}
              className={`min-h-[36px] px-4 py-1.5 rounded-lg text-xs font-extrabold transition-colors ${
                selectedCategory === 'doubles'
                  ? 'bg-orange-600 text-white'
                  : isDark
                  ? 'text-slate-300 hover:text-white'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              Đôi
            </button>
          </div>

          <button
            type="button"
            onClick={() => handleRandomGroups(registrations)}
            className="min-h-[38px] px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
          >
            <Shuffle className="w-4 h-4" />
            <span>Random 3 bảng (A/B/C)</span>
          </button>
        </div>

        {!isAdmin && (
          <div
            className={`p-3 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-2 ${
              isDark
                ? 'bg-amber-950/30 border-amber-800/60 text-amber-200'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
              <span>
                Tài khoản hiện tại chỉ hỗ trợ Check-in VĐV. Đăng nhập <strong>Admin</strong> để thêm
                nội dung, nhập VĐV và sắp bảng.
              </span>
            </span>
            <button
              type="button"
              onClick={() =>
                onRequestLogin('Vui lòng đăng nhập tài khoản Admin để quản lý VĐV và sắp bảng.')
              }
              className="px-3 py-1 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-bold"
            >
              Đăng nhập Admin
            </button>
          </div>
        )}
      </section>

      {/* Lưới chính: Cột trái chọn/thêm nội dung & nhập VĐV | Cột phải danh sách & phân bảng */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-5 space-y-4">
          {/* 1. Thêm & chọn nội dung thi đấu */}
          <section className={`border rounded-2xl p-4 sm:p-5 space-y-3.5 ${cardSurface}`}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-sm sm:text-base font-extrabold uppercase tracking-tight flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-orange-500 shrink-0" />
                <span>1. NỘI DUNG ({selectedCategory === 'team' ? 'ĐỒNG ĐỘI' : 'ĐÔI'})</span>
              </h2>
              {isAdmin && (
                <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 inline-flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Admin
                </span>
              )}
            </div>

            <form onSubmit={handleCreateDivision} className="flex items-center gap-2">
              <input
                type="text"
                value={newDivisionName}
                onChange={(e) => setNewDivisionName(e.target.value)}
                placeholder={
                  selectedCategory === 'team'
                    ? 'VD: Đồng đội Mở rộng'
                    : 'VD: Đôi Nam Nữ · Đôi Nam'
                }
                className={`flex-1 min-w-0 min-h-[38px] px-3 py-1.5 text-xs border rounded-xl ${inputSurface}`}
              />
              <button
                type="submit"
                className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold inline-flex items-center gap-1 shrink-0 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm</span>
              </button>
            </form>

            {/* Danh sách nội dung để chọn: chưa chọn thì không hiển thị nội dung bên trong */}
            <div className="space-y-1.5">
              <div className={`text-[11px] font-semibold ${mutedText}`}>
                Chọn nội dung để hiển thị khu vực nhập VĐV bên trong:
              </div>
              {divisionsInCategory.length === 0 ? (
                <div className={`p-3 rounded-xl border text-xs ${subSurface} ${mutedText}`}>
                  Chưa có nội dung {selectedCategory === 'team' ? 'Đồng đội' : 'Đôi'}. Nhập tên ở
                  trên rồi bấm <strong>+ Thêm</strong>.
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {divisionsInCategory.map((div) => {
                    const isSelected = selectedDivision === div;
                    return (
                      <button
                        key={div}
                        type="button"
                        onClick={() => handleSelectDivisionChip(div)}
                        className={`min-h-[34px] px-3 py-1 rounded-xl text-xs font-bold border transition-colors ${
                          isSelected
                            ? 'bg-orange-600 text-white border-orange-600'
                            : isDark
                            ? 'bg-slate-950/70 text-slate-300 border-slate-800 hover:border-slate-700'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {div}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* 2. Khu vực nhập VĐV: chỉ hiển thị nội dung bên trong khi đã chọn một nội dung cụ thể */}
          {selectedDivision && (
            <section className={`border rounded-2xl p-4 sm:p-5 space-y-3.5 ${cardSurface}`}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-sm sm:text-base font-extrabold uppercase tracking-tight flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-orange-500 shrink-0" />
                  <span>2. NHẬP VĐV — {selectedDivision}</span>
                </h2>
                <button
                  type="button"
                  onClick={() => setSelectedDivision('')}
                  className={`text-xs font-semibold ${mutedText} hover:text-orange-500`}
                >
                  Ẩn nội dung
                </button>
              </div>

              <form onSubmit={handleAddAthletesSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Nội dung thi đấu *</label>
                  <select
                    value={selectedDivision}
                    onChange={(e) => setSelectedDivision(e.target.value)}
                    className={`w-full min-h-[38px] px-3 py-1.5 text-xs font-bold border rounded-xl ${inputSurface}`}
                  >
                    <option value="">-- Chưa chọn nội dung --</option>
                    {divisionsInCategory.map((div) => (
                      <option key={div} value={div}>
                        {div}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Chọn giới tính Nam / Nữ */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAthleteGender('Nam')}
                    className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-extrabold border transition-colors ${
                      athleteGender === 'Nam'
                        ? 'bg-sky-600 text-white border-sky-600'
                        : isDark
                        ? 'bg-slate-950 text-slate-300 border-slate-800'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    + VĐV Nam
                  </button>
                  <button
                    type="button"
                    onClick={() => setAthleteGender('Nữ')}
                    className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-extrabold border transition-colors ${
                      athleteGender === 'Nữ'
                        ? 'bg-rose-600 text-white border-rose-600'
                        : isDark
                        ? 'bg-slate-950 text-slate-300 border-slate-800'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    + VĐV Nữ
                  </button>
                </div>

                {/* Chỉ chọn Trình A, B, C và Bảng — không điểm trình */}
                <div className="grid grid-cols-4 gap-1.5">
                  {TIER_OPTIONS.map((tier) => (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => setAthleteTier(tier)}
                      className={`min-h-[36px] px-2 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                        athleteTier === tier
                          ? 'bg-orange-600 text-white border-orange-600'
                          : isDark
                          ? 'bg-slate-950 text-slate-300 border-slate-800'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      {tier}
                    </button>
                  ))}

                  <select
                    value={selectedGroup}
                    onChange={(e) => setSelectedGroup(e.target.value)}
                    className={`min-h-[36px] px-2 py-1 text-xs font-bold border rounded-xl ${inputSurface}`}
                  >
                    {GROUP_OPTIONS.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Danh sách VĐV (cách nhau dấu phẩy)
                  </label>
                  <input
                    type="text"
                    value={athletesInput}
                    onChange={(e) => setAthletesInput(e.target.value)}
                    placeholder="VD: Nguyễn Văn A, Trần Thị B"
                    className={`w-full min-h-[38px] px-3 py-1.5 text-xs border rounded-xl ${inputSurface}`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">CLB / Đơn vị</label>
                  <input
                    type="text"
                    value={clubName}
                    onChange={(e) => setClubName(e.target.value)}
                    placeholder="CLB Bính Dần 1986"
                    className={`w-full min-h-[38px] px-3 py-1.5 text-xs border rounded-xl ${inputSurface}`}
                  />
                </div>

                <button
                  type="submit"
                  className="w-full min-h-[40px] px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-extrabold transition-colors"
                >
                  Lưu VĐV vào {selectedGroup}
                </button>
              </form>
            </section>
          )}
        </div>

        {/* 3. Danh sách đội & phân bảng */}
        <section className={`lg:col-span-7 border rounded-2xl p-4 sm:p-5 space-y-4 ${cardSurface}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-sm sm:text-base font-extrabold uppercase tracking-tight flex items-center gap-2">
              <Layers className="w-4 h-4 text-orange-500 shrink-0" />
              <span>3. DANH SÁCH ĐỘI & PHÂN BẢNG ({filteredRegistrations.length})</span>
            </h2>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleRandomGroups(filteredRegistrations)}
                className="min-h-[34px] px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold inline-flex items-center gap-1.5"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>Random 3 bảng</span>
              </button>

              <select
                value={filterDivision}
                onChange={(e) => setFilterDivision(e.target.value)}
                className={`min-h-[34px] px-2.5 py-1 text-xs font-semibold border rounded-xl ${inputSurface}`}
              >
                <option value="all">Tất cả nội dung</option>
                {tournament.divisions.map((div) => (
                  <option key={div} value={div}>
                    {div}
                  </option>
                ))}
              </select>

              <select
                value={filterGroup}
                onChange={(e) => setFilterGroup(e.target.value)}
                className={`min-h-[34px] px-2.5 py-1 text-xs font-semibold border rounded-xl ${inputSurface}`}
              >
                <option value="all">Tất cả bảng</option>
                {GROUP_OPTIONS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filteredRegistrations.length === 0 ? (
            <div className={`border rounded-xl p-8 text-center text-xs ${subSurface} ${mutedText}`}>
              Chưa có VĐV hoặc đội nào trong danh sách lọc hiện tại.
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredRegistrations.map((reg, index) => {
                const roster =
                  reg.squadRoster && reg.squadRoster.length > 0
                    ? reg.squadRoster
                    : [reg.player1Name, reg.player2Name].filter(Boolean);

                return (
                  <div
                    key={reg.id}
                    className={`border rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${subSurface}`}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                        <span className="font-mono-num font-bold text-orange-500">
                          #{index + 1}
                        </span>
                        <span className="px-2 py-0.5 rounded-md font-bold bg-orange-500/15 text-orange-400">
                          {reg.division}
                        </span>
                        {reg.club && <span className={mutedText}>· {reg.club}</span>}
                      </div>

                      <div className="text-sm font-bold truncate">{reg.teamName}</div>

                      {roster.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {roster.map((member, mIdx) => (
                            <span
                              key={`${reg.id}_m_${mIdx}`}
                              className={`px-2 py-0.5 rounded-md text-[11px] border ${
                                isDark
                                  ? 'bg-slate-900 border-slate-800 text-slate-300'
                                  : 'bg-white border-slate-200 text-slate-700'
                              }`}
                            >
                              {member}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <select
                        disabled={!isAdmin}
                        value={reg.groupName || 'Bảng A'}
                        onChange={(e) => onAssignRegistrationGroup(reg.id, e.target.value)}
                        className={`min-h-[34px] px-2.5 py-1 text-xs font-bold border rounded-xl ${inputSurface}`}
                      >
                        {GROUP_OPTIONS.map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => onToggleCheckIn(reg.id)}
                        className={`min-h-[34px] px-3 py-1 rounded-xl text-xs font-bold inline-flex items-center gap-1 border transition-colors ${
                          reg.checkedIn
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : isDark
                            ? 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{reg.checkedIn ? 'Đã Check-in' : 'Check-in'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
