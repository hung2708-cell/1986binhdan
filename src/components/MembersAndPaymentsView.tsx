import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  FolderPlus,
  Plus,
  ShieldCheck,
  Shuffle,
  UserPlus,
  Users,
} from 'lucide-react';
import type { Registration, StaffAccount, Tournament } from '../types/tournament';
import { isTeamDivision } from '../utils/pickleballEngine';

type ThemeMode = 'light' | 'dark';

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

  const [compMode, setCompMode] = useState<'doubles' | 'team'>('doubles');
  const [newDivisionName, setNewDivisionName] = useState('');

  const availableDivisions = useMemo(() => {
    const matched = tournament.divisions.filter((d) =>
      compMode === 'team' ? isTeamDivision(d) : !isTeamDivision(d),
    );
    return matched.length > 0 ? matched : tournament.divisions;
  }, [tournament.divisions, compMode]);

  const [selectedDivision, setSelectedDivision] = useState<string>(
    availableDivisions[0] || tournament.divisions[0] || '',
  );
  const [genderTag, setGenderTag] = useState<'Nam' | 'Nữ'>('Nam');
  const [skillTier, setSkillTier] = useState<'Trình A' | 'Trình B' | 'Trình C'>('Trình B');
  const [targetGroup, setTargetGroup] = useState<string>('Bảng A');
  const [athleteNamesInput, setAthleteNamesInput] = useState('');
  const [clubName, setClubName] = useState('CLB Bính Dần 1986');
  const [ratingInput, setRatingInput] = useState('4.5');

  const [filterDivision, setFilterDivision] = useState<string>('all');
  const [filterGroup, setFilterGroup] = useState<string>('all');

  const activeDivisionForForm = availableDivisions.includes(selectedDivision)
    ? selectedDivision
    : availableDivisions[0] || '';

  const filteredRegistrations = useMemo(() => {
    return registrations.filter((r) => {
      const matchDiv = filterDivision === 'all' || r.division === filterDivision;
      const matchGrp = filterGroup === 'all' || (r.groupName || 'Bảng A') === filterGroup;
      return matchDiv && matchGrp;
    });
  }, [registrations, filterDivision, filterGroup]);

  const maleCount = useMemo(
    () =>
      registrations.filter((r) =>
        `${r.teamName} ${r.club}`.toLowerCase().includes('nam'),
      ).length,
    [registrations],
  );

  const femaleCount = useMemo(
    () =>
      registrations.filter((r) =>
        `${r.teamName} ${r.club}`.toLowerCase().includes('nữ'),
      ).length,
    [registrations],
  );

  const checkedInCount = useMemo(
    () => registrations.filter((r) => r.checkedIn).length,
    [registrations],
  );

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

  const handleCreateDivision = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      onRequestLogin('Vui lòng đăng nhập tài khoản Admin để thêm nội dung thi đấu.');
      return;
    }
    if (!newDivisionName.trim()) return;
    onAddDivision(newDivisionName.trim(), compMode);
    setSelectedDivision(newDivisionName.trim());
    setNewDivisionName('');
  };

  const handleSubmitAthletes = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      onRequestLogin('Vui lòng đăng nhập tài khoản Admin để thêm VĐV/đội và chia bảng.');
      return;
    }
    if (!activeDivisionForForm) return;

    const names = athleteNamesInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (names.length === 0) return;

    const p1 = names[0];
    const p2 = names.slice(1).join(' / ');
    const ratingVal = Number(ratingInput) || 4.5;

    onAddRegistration({
      division: activeDivisionForForm,
      player1Name: p1,
      player2Name: p2,
      club: clubName.trim() || `${genderTag} · ${skillTier}`,
      combinedRating: ratingVal,
      groupName: targetGroup,
      squadRoster: names,
    });

    setAthleteNamesInput('');
  };

  const handleRandomThreeGroups = () => {
    if (!isAdmin) {
      onRequestLogin('Vui lòng đăng nhập tài khoản Admin để chia ngẫu nhiên 3 bảng A/B/C.');
      return;
    }
    const groups = ['Bảng A', 'Bảng B', 'Bảng C'];
    filteredRegistrations.forEach((reg, idx) => {
      const assigned = groups[idx % groups.length];
      onAssignRegistrationGroup(reg.id, assigned);
    });
  };

  return (
    <div className="space-y-5">
      {/* Header tổng quan */}
      <section className={`border rounded-2xl p-4 sm:p-5 space-y-4 ${cardSurface}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-extrabold uppercase tracking-wider text-orange-500 flex items-center gap-1.5">
              <Users className="w-4 h-4" />
              <span>QUẢN LÝ VĐV, NỘI DUNG & SẮP XẾP BẢNG THI ĐẤU</span>
            </div>
            <h1 className="font-display text-xl sm:text-2xl font-extrabold mt-0.5">
              {compMode === 'doubles' ? 'Đôi (Ẩn Đồng đội)' : 'Đồng đội (Ẩn Đôi)'} — {tournament.name}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-mono-num">
            <span className="px-2.5 py-1 rounded-lg bg-sky-500/15 text-sky-500 font-bold border border-sky-500/30">
              Nam: {maleCount}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-rose-500/15 text-rose-500 font-bold border border-rose-500/30">
              Nữ: {femaleCount}
            </span>
            <span
              className={`px-2.5 py-1 rounded-lg font-bold border ${
                isDark
                  ? 'bg-slate-800 text-slate-200 border-slate-700'
                  : 'bg-slate-100 text-slate-800 border-slate-200'
              }`}
            >
              Tổng đội: {registrations.length}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-500 font-bold border border-emerald-500/30">
              Check-in: {checkedInCount}/{registrations.length}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className={`inline-flex rounded-xl p-1 border ${
              isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'
            }`}
          >
            <button
              type="button"
              onClick={() => setCompMode('doubles')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                compMode === 'doubles'
                  ? 'bg-orange-600 text-white'
                  : isDark
                  ? 'text-slate-300 hover:text-white'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              Đôi
            </button>
            <button
              type="button"
              onClick={() => setCompMode('team')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                compMode === 'team'
                  ? 'bg-orange-600 text-white'
                  : isDark
                  ? 'text-slate-300 hover:text-white'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              Đồng đội
            </button>
          </div>

          <button
            type="button"
            onClick={handleRandomThreeGroups}
            className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
          >
            <Shuffle className="w-3.5 h-3.5" />
            <span>Random 3 bảng (A/B/C)</span>
          </button>
        </div>
      </section>

      {/* Grid 2 cột: Form thêm nội dung + Nhập VĐV bên trái, Danh sách đội & phân bảng bên phải */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-5 space-y-5">
          {/* 1. Thêm nội dung */}
          <form onSubmit={handleCreateDivision} className={`border rounded-2xl p-4 sm:p-5 space-y-3.5 ${cardSurface}`}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-sm sm:text-base font-bold uppercase flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-orange-500" />
                <span>1. THÊM NỘI DUNG ({compMode === 'team' ? 'ĐỒNG ĐỘI' : 'ĐÔI'})</span>
              </h2>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-500 text-[11px] font-bold inline-flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Admin
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCompMode('doubles')}
                className={`py-2 px-3 rounded-xl text-xs font-bold border ${
                  compMode === 'doubles'
                    ? 'bg-orange-600 text-white border-orange-600'
                    : isDark
                    ? 'bg-slate-950/70 text-slate-300 border-slate-800'
                    : 'bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                Đôi (Ẩn Đồng đội)
              </button>
              <button
                type="button"
                onClick={() => setCompMode('team')}
                className={`py-2 px-3 rounded-xl text-xs font-bold border ${
                  compMode === 'team'
                    ? 'bg-orange-600 text-white border-orange-600'
                    : isDark
                    ? 'bg-slate-950/70 text-slate-300 border-slate-800'
                    : 'bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                Đồng đội (Ẩn Đôi)
              </button>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newDivisionName}
                onChange={(e) => setNewDivisionName(e.target.value)}
                placeholder="VD: Đôi Nam Nữ 4.5"
                className={`flex-1 min-w-0 min-h-[38px] px-3 py-1.5 text-xs border rounded-xl ${inputSurface}`}
              />
              <button
                type="submit"
                className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold inline-flex items-center gap-1 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm</span>
              </button>
            </div>

            {tournament.divisions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {tournament.divisions.map((div) => (
                  <button
                    key={div}
                    type="button"
                    onClick={() => setSelectedDivision(div)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${
                      activeDivisionForForm === div
                        ? 'bg-orange-600 text-white border-orange-600'
                        : isDark
                        ? 'bg-slate-950/60 text-slate-300 border-slate-800'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    {div}
                  </button>
                ))}
              </div>
            )}
          </form>

          {/* 2. Nhập VĐV & chia bảng */}
          <form onSubmit={handleSubmitAthletes} className={`border rounded-2xl p-4 sm:p-5 space-y-3.5 ${cardSurface}`}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-sm sm:text-base font-bold uppercase flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-orange-500" />
                <span>2. NHẬP VĐV NAM / NỮ & PHÂN BẢNG</span>
              </h2>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Nội dung thi đấu *</label>
              <select
                value={activeDivisionForForm}
                onChange={(e) => setSelectedDivision(e.target.value)}
                className={`w-full min-h-[38px] px-3 py-1.5 text-xs border rounded-xl ${inputSurface}`}
              >
                {tournament.divisions.map((div) => (
                  <option key={div} value={div}>
                    {div}
                  </option>
                ))}
              </select>
            </div>

            <div className={`p-3 rounded-xl border space-y-2.5 ${subSurface}`}>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold">Thêm VĐV (cách nhau dấu phẩy)</span>
                <span className={mutedText}>Nam / Nữ & Trình</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setGenderTag('Nam')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border ${
                    genderTag === 'Nam'
                      ? 'bg-sky-600 text-white border-sky-600'
                      : isDark
                      ? 'bg-slate-900 text-slate-300 border-slate-800'
                      : 'bg-white text-slate-700 border-slate-200'
                  }`}
                >
                  + VĐV Nam
                </button>
                <button
                  type="button"
                  onClick={() => setGenderTag('Nữ')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border ${
                    genderTag === 'Nữ'
                      ? 'bg-rose-600 text-white border-rose-600'
                      : isDark
                      ? 'bg-slate-900 text-slate-300 border-slate-800'
                      : 'bg-white text-slate-700 border-slate-200'
                  }`}
                >
                  + VĐV Nữ
                </button>
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                {(['Trình A', 'Trình B', 'Trình C'] as const).map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => setSkillTier(tier)}
                    className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border ${
                      skillTier === tier
                        ? 'bg-orange-600 text-white border-orange-600'
                        : isDark
                        ? 'bg-slate-900 text-slate-300 border-slate-800'
                        : 'bg-white text-slate-700 border-slate-200'
                    }`}
                  >
                    {tier}
                  </button>
                ))}

                <select
                  value={targetGroup}
                  onChange={(e) => setTargetGroup(e.target.value)}
                  className={`px-2 py-1.5 rounded-lg border text-xs font-bold ${inputSurface}`}
                >
                  <option value="Bảng A">Bảng A</option>
                  <option value="Bảng B">Bảng B</option>
                  <option value="Bảng C">Bảng C</option>
                  <option value="Bảng D">Bảng D</option>
                </select>
              </div>

              <input
                type="text"
                value={athleteNamesInput}
                onChange={(e) => setAthleteNamesInput(e.target.value)}
                placeholder="VD: Nguyễn Văn A, Trần Thị B"
                className={`w-full min-h-[38px] px-3 py-1.5 text-xs border rounded-xl ${inputSurface}`}
              />

              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  value={clubName}
                  onChange={(e) => setClubName(e.target.value)}
                  placeholder="CLB / Đơn vị"
                  className={`col-span-2 min-h-[36px] px-3 py-1 text-xs border rounded-xl ${inputSurface}`}
                />
                <input
                  type="number"
                  step="0.1"
                  value={ratingInput}
                  onChange={(e) => setRatingInput(e.target.value)}
                  placeholder="Trình"
                  className={`min-h-[36px] px-2.5 py-1 text-xs font-mono-num border rounded-xl ${inputSurface}`}
                />
              </div>

              <button
                type="submit"
                className="w-full min-h-[38px] px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition-colors"
              >
                Lưu VĐV / Đội vào {targetGroup}
              </button>
            </div>
          </form>
        </div>

        {/* 3. Danh sách đội & phân bảng */}
        <div className={`lg:col-span-7 border rounded-2xl p-4 sm:p-5 space-y-4 ${cardSurface}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-sm sm:text-base font-bold uppercase">
              3. DANH SÁCH ĐỘI & PHÂN BẢNG ({filteredRegistrations.length})
            </h2>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleRandomThreeGroups}
                className="min-h-[34px] px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold inline-flex items-center gap-1"
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
                <option value="Bảng A">Bảng A</option>
                <option value="Bảng B">Bảng B</option>
                <option value="Bảng C">Bảng C</option>
                <option value="Bảng D">Bảng D</option>
              </select>
            </div>
          </div>

          {filteredRegistrations.length === 0 ? (
            <div className={`border rounded-xl p-8 text-center text-xs ${subSurface} ${mutedText}`}>
              Chưa có VĐV hoặc đội nào trong danh sách lọc hiện tại.
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredRegistrations.map((reg) => (
                <div
                  key={reg.id}
                  className={`border rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 ${subSurface}`}
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="font-bold text-sm truncate">{reg.teamName}</div>
                    <div className={`text-xs ${mutedText}`}>
                      {reg.division} · {reg.club || 'Tự do'} · Trình {reg.combinedRating}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={reg.groupName || 'Bảng A'}
                      onChange={(e) => onAssignRegistrationGroup(reg.id, e.target.value)}
                      className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold ${inputSurface}`}
                    >
                      <option value="Bảng A">Bảng A</option>
                      <option value="Bảng B">Bảng B</option>
                      <option value="Bảng C">Bảng C</option>
                      <option value="Bảng D">Bảng D</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => onToggleCheckIn(reg.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border inline-flex items-center gap-1 transition-colors ${
                        reg.checkedIn
                          ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
                          : isDark
                          ? 'bg-slate-900 text-slate-400 border-slate-700'
                          : 'bg-white text-slate-600 border-slate-300'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{reg.checkedIn ? 'Đã check-in' : 'Check-in'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
