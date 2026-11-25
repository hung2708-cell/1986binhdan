/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardCheck,
  FolderPlus,
  Layers,
  Lock,
  Plus,
  ShieldCheck,
  Shuffle,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import type {
  Registration,
  StaffAccount,
  Tournament,
} from '../types/tournament';
import { isTeamDivision } from '../utils/pickleballEngine';

type AthleteGender = 'Nam' | 'Nữ';
type SkillTier = 'Trình A' | 'Trình B' | 'Trình C';

interface IndividualAthlete {
  id: string;
  name: string;
  gender: AthleteGender;
  tier: SkillTier;
  groupName: string;
  division: string;
}

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

const TIER_RATING_MAP: Record<SkillTier, number> = {
  'Trình A': 6.5,
  'Trình B': 5.5,
  'Trình C': 4.5,
};

const THREE_GROUPS = ['Bảng A', 'Bảng B', 'Bảng C'] as const;

const SAMPLE_ATHLETES: Array<{ name: string; gender: AthleteGender; tier: SkillTier }> = [
  { name: 'Lâm Anh Hùng', gender: 'Nam', tier: 'Trình B' },
  { name: 'Đàm Thị Thùy Dương', gender: 'Nữ', tier: 'Trình B' },
  { name: 'Trần Quốc Tuấn', gender: 'Nam', tier: 'Trình A' },
  { name: 'Lê Hoàng Nam', gender: 'Nam', tier: 'Trình A' },
  { name: 'Nguyễn Minh Duy', gender: 'Nam', tier: 'Trình B' },
  { name: 'Hoàng Văn Trọng', gender: 'Nam', tier: 'Trình B' },
  { name: 'Phạm Thu Hương', gender: 'Nữ', tier: 'Trình B' },
  { name: 'Vũ Khánh Linh', gender: 'Nữ', tier: 'Trình C' },
  { name: 'Bùi Đức Minh', gender: 'Nam', tier: 'Trình C' },
  { name: 'Đỗ Phương Thảo', gender: 'Nữ', tier: 'Trình B' },
  { name: 'Ngô Quang Hải', gender: 'Nam', tier: 'Trình A' },
  { name: 'Lý Mai Anh', gender: 'Nữ', tier: 'Trình C' },
];

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

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
  const isStaff = isAdmin || currentAccount?.role === 'referee';

  // Step 1: Add Division (Doubles or Team)
  const [compType, setCompType] = useState<'doubles' | 'team'>('team');
  const [newDivisionName, setNewDivisionName] = useState('');

  // Quick add individual male/female athletes
  const [singleGender, setSingleGender] = useState<AthleteGender>('Nam');
  const [singleTier, setSingleTier] = useState<SkillTier>('Trình B');
  const [singleGroup, setSingleGroup] = useState<string>('Bảng A');
  const [singleAthleteName, setSingleAthleteName] = useState<string>('');
  const [rosterAthletes, setRosterAthletes] = useState<IndividualAthlete[]>([]);

  // Step 2: Add Team / Pair & Assign Group
  const [selectedDivision, setSelectedDivision] = useState<string>(
    tournament.divisions[0] || 'Đồng Đội - Team 1',
  );
  const [genderFilter, setGenderFilter] = useState<'Nam' | 'Nữ'>('Nam');
  const [skillTier, setSkillTier] = useState<SkillTier>('Trình B');
  const [player1Name, setPlayer1Name] = useState('');
  const [player2Name, setPlayer2Name] = useState('');
  const [clubName, setClubName] = useState('');
  const [squadInput, setSquadInput] = useState('');
  const [targetGroup, setTargetGroup] = useState('Bảng A');

  // Filter for Step 3 list
  const [filterDivision, setFilterDivision] = useState<string>('ALL');
  const [filterGroup, setFilterGroup] = useState<string>('ALL');

  const activeDivision = useMemo(() => {
    if (tournament.divisions.includes(selectedDivision)) return selectedDivision;
    return tournament.divisions[0] || 'Đồng Đội - Team 1';
  }, [tournament.divisions, selectedDivision]);

  const activeIsTeam = isTeamDivision(activeDivision, compType);

  const handleCreateDivision = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      onRequestLogin(
        'Vui lòng đăng nhập tài khoản Ban Tổ Chức (Admin) để thêm nội dung Đôi hoặc Đồng đội.',
      );
      return;
    }
    if (!newDivisionName.trim()) return;
    const createdLabel =
      compType === 'team' && !newDivisionName.toLowerCase().includes('đồng đội')
        ? `Đồng Đội - ${newDivisionName.trim()}`
        : compType === 'doubles' && !newDivisionName.toLowerCase().includes('đôi')
        ? `Đôi - ${newDivisionName.trim()}`
        : newDivisionName.trim();

    onAddDivision(newDivisionName.trim(), compType);
    setSelectedDivision(createdLabel);
    setNewDivisionName('');
  };

  const handleAddSingleAthletes = () => {
    if (!isAdmin) {
      onRequestLogin(
        'Vui lòng đăng nhập tài khoản Ban Tổ Chức (Admin) để thêm từng VĐV Nam / Nữ.',
      );
      return;
    }

    const names = singleAthleteName
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    if (names.length === 0) return;

    const assignedGroup = (singleGroup || targetGroup || 'Bảng A').trim() || 'Bảng A';
    const created: IndividualAthlete[] = names.map((name, idx) => ({
      id: `ath_${Date.now().toString(36)}_${idx}_${Math.random().toString(36).slice(2, 5)}`,
      name,
      gender: singleGender,
      tier: singleTier,
      groupName: assignedGroup,
      division: activeDivision,
    }));

    setRosterAthletes((prev) => [...created, ...prev]);

    if (!player1Name.trim()) {
      setPlayer1Name(names[0]);
      if (names[1] && !player2Name.trim()) {
        setPlayer2Name(names[1]);
      }
    } else if (!player2Name.trim() && names.length === 1) {
      setPlayer2Name(names[0]);
    }

    const existingSquad = squadInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const mergedSquad = Array.from(new Set([...existingSquad, ...names]));
    setSquadInput(mergedSquad.join(', '));

    setSingleAthleteName('');
  };

  const handleRandomizeThreeGroups = () => {
    if (!isAdmin) {
      onRequestLogin(
        'Vui lòng đăng nhập tài khoản Ban Tổ Chức (Admin) để random chia 3 bảng.',
      );
      return;
    }

    // 1. Random lại Bảng A / B / C cho danh sách VĐV lẻ hiện có (nếu chưa có thì lấy danh sách mẫu)
    const sourceAthletes: IndividualAthlete[] =
      rosterAthletes.length > 0
        ? rosterAthletes
        : SAMPLE_ATHLETES.map((item, idx) => ({
            id: `sample_${Date.now().toString(36)}_${idx}`,
            name: item.name,
            gender: item.gender,
            tier: item.tier,
            groupName: THREE_GROUPS[idx % 3],
            division: activeDivision,
          }));

    const shuffledAthletes = shuffleArray(sourceAthletes).map((ath, idx) => ({
      ...ath,
      groupName: THREE_GROUPS[idx % 3],
      division: activeDivision,
    }));
    setRosterAthletes(shuffledAthletes);

    // 2. Random chia đều vào Bảng A / B / C cho các đăng ký hiện có của nội dung đang chọn (hoặc toàn giải)
    const divRegs = registrations.filter((r) => r.division === activeDivision);
    const targetRegs = divRegs.length > 0 ? divRegs : registrations;
    if (targetRegs.length > 0) {
      const shuffledRegs = shuffleArray(targetRegs);
      shuffledRegs.forEach((reg, idx) => {
        onAssignRegistrationGroup(reg.id, THREE_GROUPS[idx % 3]);
      });
    }
  };

  const handleApplyAthleteToSlot = (athlete: IndividualAthlete, slot: 'p1' | 'p2' | 'squad') => {
    if (!isAdmin) {
      onRequestLogin('Vui lòng đăng nhập tài khoản Admin để gán VĐV.');
      return;
    }
    setGenderFilter(athlete.gender);
    setSkillTier(athlete.tier);
    setTargetGroup(athlete.groupName);

    if (slot === 'p1') {
      setPlayer1Name(athlete.name);
    } else if (slot === 'p2') {
      setPlayer2Name(athlete.name);
    } else {
      const current = squadInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (!current.includes(athlete.name)) {
        setSquadInput([...current, athlete.name].join(', '));
      }
    }
  };

  const handleSaveSingleAthleteAsEntry = (athlete: IndividualAthlete) => {
    if (!isAdmin) {
      onRequestLogin('Vui lòng đăng nhập tài khoản Admin để lưu VĐV vào giải.');
      return;
    }
    onAddRegistration({
      division: athlete.division || activeDivision,
      player1Name: `${athlete.name} (${athlete.gender})`,
      player2Name: '',
      club: clubName.trim() || `${athlete.gender} · ${athlete.tier}`,
      combinedRating: TIER_RATING_MAP[athlete.tier],
      groupName: athlete.groupName || targetGroup || 'Bảng A',
      squadRoster: [athlete.name],
    });
  };

  const handleRemoveRosterAthlete = (id: string) => {
    setRosterAthletes((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSubmitRegistration = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      onRequestLogin(
        'Vui lòng đăng nhập tài khoản Ban Tổ Chức (Admin) để thêm VĐV/đội và sắp xếp bảng.',
      );
      return;
    }
    if (!player1Name.trim()) return;

    const parsedSquad = squadInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const rosterFromSlots = [player1Name.trim(), player2Name.trim()].filter(Boolean);
    const finalSquad = Array.from(new Set([...rosterFromSlots, ...parsedSquad]));

    const resolvedClub = clubName.trim() || `${genderFilter} · ${skillTier}`;

    onAddRegistration({
      division: activeDivision,
      player1Name: player1Name.trim(),
      player2Name: player2Name.trim(),
      club: resolvedClub,
      combinedRating: TIER_RATING_MAP[skillTier],
      groupName: targetGroup.trim() || 'Bảng A',
      squadRoster: finalSquad,
    });

    setPlayer1Name('');
    setPlayer2Name('');
    setSquadInput('');
  };

  const availableGroups = useMemo(() => {
    const set = new Set<string>(['Bảng A', 'Bảng B', 'Bảng C', 'Bảng D']);
    registrations.forEach((r) => {
      if (r.groupName) set.add(r.groupName);
    });
    rosterAthletes.forEach((a) => {
      if (a.groupName) set.add(a.groupName);
    });
    return Array.from(set);
  }, [registrations, rosterAthletes]);

  const filteredRegistrations = useMemo(() => {
    return registrations.filter((r) => {
      if (filterDivision !== 'ALL' && r.division !== filterDivision) return false;
      if (filterGroup !== 'ALL' && (r.groupName || 'Chưa xếp bảng') !== filterGroup) return false;
      return true;
    });
  }, [registrations, filterDivision, filterGroup]);

  const maleCount = rosterAthletes.filter((a) => a.gender === 'Nam').length;
  const femaleCount = rosterAthletes.filter((a) => a.gender === 'Nữ').length;

  return (
    <div className="space-y-6">
      {/* Banner */}
      <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-orange-600">
            <Users className="w-4 h-4" />
            <span>QUẢN LÝ VĐV, NỘI DUNG & SẮP XẾP BẢNG THI ĐẤU</span>
          </div>
          <h1 className="font-display text-xl sm:text-2xl font-extrabold text-slate-900 mt-0.5">
            Thêm từng VĐV Nam/Nữ, Đội & Chia 3 Bảng — {tournament.name}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs font-mono-num">
          {isAdmin && (
            <button
              type="button"
              onClick={handleRandomizeThreeGroups}
              className="min-h-[34px] px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-orange-600 text-white font-sans font-bold inline-flex items-center gap-1.5 transition-colors"
            >
              <Shuffle className="w-3.5 h-3.5" />
              <span>Random 3 bảng (A/B/C)</span>
            </button>
          )}
          <span className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-800 font-bold border border-blue-200">
            Nam: {maleCount}
          </span>
          <span className="px-3 py-1.5 rounded-lg bg-pink-50 text-pink-800 font-bold border border-pink-200">
            Nữ: {femaleCount}
          </span>
          <span className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-800 font-bold">
            Tổng đội: {registrations.length}
          </span>
          <span className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
            Check-in: {registrations.filter((r) => r.checkedIn).length}/{registrations.length}
          </span>
        </div>
      </section>

      {!isAdmin && (
        <section className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs text-amber-950">
            <Lock className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              <strong>Chế độ xem / Trọng tài:</strong> Chỉ tài khoản{' '}
              <strong>Ban Tổ Chức (Admin)</strong> mới có quyền thêm từng VĐV Nam/Nữ, tạo nội dung
              mới, nhập đội và random chia 3 bảng.
            </span>
          </div>
          <button
            type="button"
            onClick={() =>
              onRequestLogin(
                'Vui lòng đăng nhập tài khoản Ban Tổ Chức (Admin) để quản lý VĐV và sắp xếp bảng.',
              )
            }
            className="min-h-[36px] px-3.5 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold"
          >
            Đăng nhập Admin
          </button>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left column: Step 1 + Step 2 */}
        <div className="lg:col-span-5 space-y-5">
          {/* STEP 1: Add Division */}
          <form
            onSubmit={handleCreateDivision}
            className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-orange-600" />
                <h2 className="font-display text-sm sm:text-base font-bold uppercase text-slate-900">
                  1. THÊM NỘI DUNG THI ĐẤU (ĐÔI / ĐỒNG ĐỘI)
                </h2>
              </div>
              {isAdmin && (
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Admin
                </span>
              )}
            </div>

            <p className="text-xs text-slate-500">
              Chọn hình thức Đôi hoặc Đồng đội và nhập tên nội dung mới.
            </p>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCompType('doubles')}
                className={`min-h-[38px] rounded-xl text-xs font-bold transition-colors ${
                  compType === 'doubles'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Nội dung Đôi
              </button>
              <button
                type="button"
                onClick={() => setCompType('team')}
                className={`min-h-[38px] rounded-xl text-xs font-bold transition-colors ${
                  compType === 'team'
                    ? 'bg-orange-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Nội dung Đồng đội
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newDivisionName}
                onChange={(e) => setNewDivisionName(e.target.value)}
                placeholder={
                  compType === 'team'
                    ? 'VD: Đồng Đội CLB 1986'
                    : 'VD: Đôi Nam Nữ 4.5'
                }
                className="flex-1 min-w-0 min-h-[38px] px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
              />
              <button
                type="submit"
                className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-orange-600 text-white text-xs font-bold inline-flex items-center gap-1 shrink-0 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Thêm
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {tournament.divisions.map((div) => (
                <button
                  key={div}
                  type="button"
                  onClick={() => setSelectedDivision(div)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                    activeDivision === div
                      ? 'bg-orange-50 text-orange-800 border-orange-300'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {div}
                </button>
              ))}
            </div>
          </form>

          {/* STEP 2: Add Individual Male/Female Athletes + Random 3 Groups */}
          <form
            onSubmit={handleSubmitRegistration}
            className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-orange-600" />
                <h2 className="font-display text-sm sm:text-base font-bold uppercase text-slate-900">
                  2. NHẬP TỪNG VĐV NAM / NỮ & RANDOM 3 BẢNG
                </h2>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  onClick={handleRandomizeThreeGroups}
                  className="px-2.5 py-1 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-800 border border-orange-200 text-[11px] font-extrabold inline-flex items-center gap-1 shrink-0"
                >
                  <Shuffle className="w-3 h-3" />
                  Random 3 bảng
                </button>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nội dung thi đấu *
              </label>
              <select
                value={activeDivision}
                onChange={(e) => setSelectedDivision(e.target.value)}
                className="w-full min-h-[38px] px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg bg-white"
              >
                {tournament.divisions.map((div) => (
                  <option key={div} value={div}>
                    {div}
                  </option>
                ))}
              </select>
            </div>

            {/* Khối thêm từng VĐV Nam hoặc Nữ riêng lẻ */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-slate-900">
                  Thêm từng VĐV riêng lẻ (Nam / Nữ)
                </span>
                <span className="text-[11px] text-slate-500">
                  1 tên hoặc nhiều tên cách dấu phẩy
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSingleGender('Nam');
                    setGenderFilter('Nam');
                  }}
                  className={`min-h-[36px] rounded-xl text-xs font-extrabold transition-colors ${
                    singleGender === 'Nam'
                      ? 'bg-slate-900 text-white'
                      : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  + VĐV Nam
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSingleGender('Nữ');
                    setGenderFilter('Nữ');
                  }}
                  className={`min-h-[36px] rounded-xl text-xs font-extrabold transition-colors ${
                    singleGender === 'Nữ'
                      ? 'bg-pink-600 text-white'
                      : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  + VĐV Nữ
                </button>
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                {(['Trình A', 'Trình B', 'Trình C'] as SkillTier[]).map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => {
                      setSingleTier(tier);
                      setSkillTier(tier);
                    }}
                    className={`min-h-[32px] rounded-lg text-[11px] font-bold transition-colors ${
                      singleTier === tier
                        ? 'bg-orange-600 text-white'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {tier}
                  </button>
                ))}
                <select
                  value={singleGroup}
                  onChange={(e) => {
                    setSingleGroup(e.target.value);
                    setTargetGroup(e.target.value);
                  }}
                  className="min-h-[32px] px-2 text-xs font-semibold border border-slate-300 rounded-lg bg-white"
                >
                  {THREE_GROUPS.map((grp) => (
                    <option key={grp} value={grp}>
                      {grp}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={singleAthleteName}
                  onChange={(e) => setSingleAthleteName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSingleAthletes();
                    }
                  }}
                  placeholder={
                    singleGender === 'Nam'
                      ? 'Tên VĐV Nam (VD: Anh Dũng, Minh Khang)'
                      : 'Tên VĐV Nữ (VD: Thùy Dương, Mai)'
                  }
                  className="flex-1 min-w-0 min-h-[36px] px-3 py-1 text-xs border border-slate-300 rounded-lg bg-white"
                />
                <button
                  type="button"
                  onClick={handleAddSingleAthletes}
                  className="min-h-[36px] px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shrink-0"
                >
                  Thêm {singleGender}
                </button>
              </div>

              {rosterAthletes.length > 0 && (
                <div className="space-y-2 pt-1 border-t border-slate-200/80">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-slate-600">
                      Danh sách VĐV đã thêm ({rosterAthletes.length}):
                    </span>
                    <button
                      type="button"
                      onClick={handleRandomizeThreeGroups}
                      className="text-[11px] font-bold text-orange-700 hover:text-orange-800 inline-flex items-center gap-1"
                    >
                      <Shuffle className="w-3 h-3" /> Chia ngẫu nhiên 3 bảng
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                    {rosterAthletes.map((ath) => (
                      <div
                        key={ath.id}
                        className={`p-2 rounded-lg border flex flex-wrap items-center justify-between gap-1.5 text-xs ${
                          ath.gender === 'Nam'
                            ? 'bg-blue-50/80 border-blue-200 text-slate-900'
                            : 'bg-pink-50/80 border-pink-200 text-slate-900'
                        }`}
                      >
                        <div className="min-w-0">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-extrabold mr-1.5 ${
                              ath.gender === 'Nam'
                                ? 'bg-blue-600 text-white'
                                : 'bg-pink-600 text-white'
                            }`}
                          >
                            {ath.gender}
                          </span>
                          <span className="font-bold">{ath.name}</span>
                          <span className="text-[11px] font-bold text-orange-800 ml-1.5">
                            · {ath.groupName}
                          </span>
                          <span className="text-[11px] text-slate-600 ml-1">
                            ({ath.tier})
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleApplyAthleteToSlot(ath, 'p1')}
                            className="px-2 py-0.5 rounded bg-white hover:bg-slate-100 border border-slate-300 text-[10px] font-bold text-slate-800"
                            title="Gán làm VĐV 1 / Đội trưởng"
                          >
                            VĐV 1
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApplyAthleteToSlot(ath, 'p2')}
                            className="px-2 py-0.5 rounded bg-white hover:bg-slate-100 border border-slate-300 text-[10px] font-bold text-slate-800"
                            title="Gán làm VĐV 2 / Đội phó"
                          >
                            VĐV 2
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveSingleAthleteAsEntry(ath)}
                            className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold"
                            title="Lưu thành 1 mục thi đấu riêng"
                          >
                            + Giải
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveRosterAthlete(ath.id)}
                            className="p-1 text-rose-600 hover:text-rose-800"
                            title="Xóa VĐV"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Giới tính đội / cặp */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Giới tính (Đội / Cặp) *
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['Nam', 'Nữ'] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGenderFilter(g)}
                    className={`min-h-[36px] rounded-xl text-xs font-bold transition-colors ${
                      genderFilter === g
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* Hạng trình */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Hạng trình *
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['Trình A', 'Trình B', 'Trình C'] as SkillTier[]).map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => setSkillTier(tier)}
                    className={`min-h-[36px] rounded-xl text-xs font-bold transition-colors ${
                      skillTier === tier
                        ? 'bg-orange-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {tier}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {activeIsTeam ? 'Tên Đội / Đội trưởng *' : 'VĐV 1 *'}
              </label>
              <input
                type="text"
                value={player1Name}
                onChange={(e) => setPlayer1Name(e.target.value)}
                placeholder={activeIsTeam ? 'VD: CLB Bính Dần · Duy' : 'VD: Nguyễn Văn A'}
                className="w-full min-h-[38px] px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {activeIsTeam ? 'Đội phó / VĐV chủ lực 2' : 'VĐV 2'}
              </label>
              <input
                type="text"
                value={player2Name}
                onChange={(e) => setPlayer2Name(e.target.value)}
                placeholder={activeIsTeam ? 'VD: Trọng' : 'VD: Trần Thị B'}
                className="w-full min-h-[38px] px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
              />
            </div>

            {activeIsTeam && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Danh sách VĐV thành viên Đồng đội (cách nhau dấu phẩy)
                </label>
                <input
                  type="text"
                  value={squadInput}
                  onChange={(e) => setSquadInput(e.target.value)}
                  placeholder="VD: Duy, Trọng, Hương, Minh, Lan"
                  className="w-full min-h-[38px] px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  CLB / Đơn vị
                </label>
                <input
                  type="text"
                  value={clubName}
                  onChange={(e) => setClubName(e.target.value)}
                  placeholder="VD: CLB Cao Bằng"
                  className="w-full min-h-[38px] px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Xếp vào Bảng
                </label>
                <input
                  type="text"
                  list="group-suggestions"
                  value={targetGroup}
                  onChange={(e) => setTargetGroup(e.target.value)}
                  placeholder="VD: Bảng A"
                  className="w-full min-h-[38px] px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg bg-white"
                />
                <datalist id="group-suggestions">
                  {availableGroups.map((grp) => (
                    <option key={grp} value={grp} />
                  ))}
                </datalist>
              </div>
            </div>

            <button
              type="submit"
              className="w-full min-h-[42px] px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              <span>Thêm VĐV / Đội & Xếp Bảng</span>
            </button>
          </form>
        </div>

        {/* Right column: Step 3 Roster & Group Assignment */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-orange-600" />
              <h2 className="font-display text-sm sm:text-base font-bold uppercase text-slate-900">
                3. DANH SÁCH VĐV / ĐỘI & PHÂN BẢNG THI ĐẤU ({filteredRegistrations.length})
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {isAdmin && (
                <button
                  type="button"
                  onClick={handleRandomizeThreeGroups}
                  className="min-h-[34px] px-2.5 py-1 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold inline-flex items-center gap-1"
                >
                  <Shuffle className="w-3.5 h-3.5" />
                  <span>Random 3 bảng</span>
                </button>
              )}

              <select
                value={filterDivision}
                onChange={(e) => setFilterDivision(e.target.value)}
                className="min-h-[34px] px-2.5 py-1 text-xs font-semibold border border-slate-300 rounded-lg bg-slate-50"
              >
                <option value="ALL">Tất cả nội dung</option>
                {tournament.divisions.map((div) => (
                  <option key={div} value={div}>
                    {div}
                  </option>
                ))}
              </select>

              <select
                value={filterGroup}
                onChange={(e) => setFilterGroup(e.target.value)}
                className="min-h-[34px] px-2.5 py-1 text-xs font-semibold border border-slate-300 rounded-lg bg-slate-50"
              >
                <option value="ALL">Tất cả bảng</option>
                {availableGroups.map((grp) => (
                  <option key={grp} value={grp}>
                    {grp}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filteredRegistrations.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              Chưa có VĐV hoặc đội nào trong danh sách lọc hiện tại.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredRegistrations.map((reg, index) => (
                <div
                  key={reg.id}
                  className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono-num text-xs font-bold text-slate-400">
                        #{index + 1}
                      </span>
                      <span className="text-sm font-bold text-slate-900 truncate">
                        {reg.teamName}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-orange-50 text-orange-800 border border-orange-200">
                        {reg.division}
                      </span>
                      {reg.checkedIn && (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> Đã check-in
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span>CLB / Trình: {reg.club || 'Tự do'}</span>
                      <span>·</span>
                      <span className="font-mono-num">Rating: {reg.combinedRating}</span>
                      {reg.squadRoster && reg.squadRoster.length > 0 && (
                        <>
                          <span>·</span>
                          <span className="text-slate-700 font-medium">
                            Thành viên: {reg.squadRoster.join(', ')}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={reg.groupName || 'Bảng A'}
                      disabled={!isAdmin}
                      onChange={(e) => onAssignRegistrationGroup(reg.id, e.target.value)}
                      className="min-h-[34px] px-2.5 py-1 text-xs font-bold border border-slate-300 rounded-lg bg-white disabled:bg-slate-100"
                    >
                      {availableGroups.map((grp) => (
                        <option key={grp} value={grp}>
                          {grp}
                        </option>
                      ))}
                    </select>

                    {isStaff && (
                      <button
                        type="button"
                        onClick={() => onToggleCheckIn(reg.id)}
                        className={`min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition-colors ${
                          reg.checkedIn
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                        title="Điểm danh Check-in"
                      >
                        <ClipboardCheck className="w-3.5 h-3.5" />
                        <span>{reg.checkedIn ? 'Check-in' : 'Điểm danh'}</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
