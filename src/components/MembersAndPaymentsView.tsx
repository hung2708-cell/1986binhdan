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

const DARK_PANEL_STYLE: React.CSSProperties = {
  backgroundColor: '#0b101b',
  color: '#f8fafc',
  borderColor: '#1e293b',
};

const DARK_SUBCARD_STYLE: React.CSSProperties = {
  backgroundColor: '#111827',
  color: '#f8fafc',
  borderColor: '#1f2937',
};

const DARK_INPUT_STYLE: React.CSSProperties = {
  backgroundColor: '#090d16',
  color: '#f8fafc',
  borderColor: '#334155',
};

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

  const [compType, setCompType] = useState<'doubles' | 'team'>('doubles');
  const [newDivisionName, setNewDivisionName] = useState('');

  const visibleDivisions = useMemo(() => {
    return tournament.divisions.filter((div) =>
      compType === 'team' ? isTeamDivision(div, 'team') : !isTeamDivision(div, 'doubles'),
    );
  }, [tournament.divisions, compType]);

  const [singleGender, setSingleGender] = useState<AthleteGender>('Nam');
  const [singleTier, setSingleTier] = useState<SkillTier>('Trình B');
  const [singleGroup, setSingleGroup] = useState<string>('Bảng A');
  const [singleAthleteName, setSingleAthleteName] = useState<string>('');
  const [rosterAthletes, setRosterAthletes] = useState<IndividualAthlete[]>([]);

  const [selectedDivision, setSelectedDivision] = useState<string>(
    visibleDivisions[0] || tournament.divisions[0] || 'Đôi Nam',
  );
  const [genderFilter, setGenderFilter] = useState<'Nam' | 'Nữ'>('Nam');
  const [skillTier, setSkillTier] = useState<SkillTier>('Trình B');
  const [player1Name, setPlayer1Name] = useState('');
  const [player2Name, setPlayer2Name] = useState('');
  const [clubName, setClubName] = useState('');
  const [squadInput, setSquadInput] = useState('');
  const [targetGroup, setTargetGroup] = useState('Bảng A');

  const [filterDivision, setFilterDivision] = useState<string>('ALL');
  const [filterGroup, setFilterGroup] = useState<string>('ALL');

  const activeDivision = useMemo(() => {
    if (visibleDivisions.includes(selectedDivision)) return selectedDivision;
    return visibleDivisions[0] || (compType === 'team' ? 'Đồng Đội - Team 1' : 'Đôi Nam');
  }, [visibleDivisions, selectedDivision, compType]);

  const activeIsTeam = isTeamDivision(activeDivision, compType);

  const handleSwitchCompType = (nextType: 'doubles' | 'team') => {
    setCompType(nextType);
    const matching = tournament.divisions.filter((div) =>
      nextType === 'team' ? isTeamDivision(div, 'team') : !isTeamDivision(div, 'doubles'),
    );
    setSelectedDivision(
      matching[0] || (nextType === 'team' ? 'Đồng Đội - Team 1' : 'Đôi Nam'),
    );
    setFilterDivision('ALL');
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

    const modeRegs = registrations.filter((r) =>
      compType === 'team' ? isTeamDivision(r.division, 'team') : !isTeamDivision(r.division, 'doubles'),
    );
    const divRegs = modeRegs.filter((r) => r.division === activeDivision);
    const targetRegs = divRegs.length > 0 ? divRegs : modeRegs;
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

  const modeFilteredRegistrations = useMemo(() => {
    return registrations.filter((r) =>
      compType === 'team' ? isTeamDivision(r.division, 'team') : !isTeamDivision(r.division, 'doubles'),
    );
  }, [registrations, compType]);

  const availableGroups = useMemo(() => {
    const set = new Set<string>(['Bảng A', 'Bảng B', 'Bảng C', 'Bảng D']);
    modeFilteredRegistrations.forEach((r) => {
      if (r.groupName) set.add(r.groupName);
    });
    rosterAthletes.forEach((a) => {
      if (a.groupName) set.add(a.groupName);
    });
    return Array.from(set);
  }, [modeFilteredRegistrations, rosterAthletes]);

  const filteredRegistrations = useMemo(() => {
    return modeFilteredRegistrations.filter((r) => {
      if (filterDivision !== 'ALL' && r.division !== filterDivision) return false;
      if (filterGroup !== 'ALL' && (r.groupName || 'Chưa xếp bảng') !== filterGroup) return false;
      return true;
    });
  }, [modeFilteredRegistrations, filterDivision, filterGroup]);

  const maleCount = rosterAthletes.filter((a) => a.gender === 'Nam').length;
  const femaleCount = rosterAthletes.filter((a) => a.gender === 'Nữ').length;

  return (
    <div className="space-y-6 text-slate-100">
      {/* Banner */}
      <section style={DARK_PANEL_STYLE} className="border rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-orange-400">
            <Users className="w-4 h-4" />
            <span>QUẢN LÝ VĐV, NỘI DUNG & SẮP XẾP BẢNG THI ĐẤU</span>
          </div>
          <h1 className="font-display text-xl sm:text-2xl font-extrabold text-white mt-0.5">
            {compType === 'team' ? 'Đồng đội (Ẩn Đôi)' : 'Đôi (Ẩn Đồng đội)'} — {tournament.name}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs font-mono-num">
          <div style={DARK_SUBCARD_STYLE} className="inline-flex items-center gap-1 border p-1 rounded-lg font-sans">
            <button
              type="button"
              onClick={() => handleSwitchCompType('doubles')}
              style={
                compType === 'doubles'
                  ? { backgroundColor: '#ea580c', color: '#ffffff' }
                  : { backgroundColor: 'transparent', color: '#cbd5e1' }
              }
              className="px-2.5 py-1 rounded-md text-xs font-bold transition-colors"
            >
              Đôi
            </button>
            <button
              type="button"
              onClick={() => handleSwitchCompType('team')}
              style={
                compType === 'team'
                  ? { backgroundColor: '#ea580c', color: '#ffffff' }
                  : { backgroundColor: 'transparent', color: '#cbd5e1' }
              }
              className="px-2.5 py-1 rounded-md text-xs font-bold transition-colors"
            >
              Đồng đội
            </button>
          </div>

          {isAdmin && (
            <button
              type="button"
              onClick={handleRandomizeThreeGroups}
              style={{ backgroundColor: '#ea580c', color: '#ffffff' }}
              className="min-h-[34px] px-3 py-1.5 rounded-lg font-sans font-bold inline-flex items-center gap-1.5 transition-colors"
            >
              <Shuffle className="w-3.5 h-3.5" />
              <span>Random 3 bảng (A/B/C)</span>
            </button>
          )}
          <span style={DARK_SUBCARD_STYLE} className="px-3 py-1.5 rounded-lg border text-sky-300 font-bold">
            Nam: {maleCount}
          </span>
          <span style={DARK_SUBCARD_STYLE} className="px-3 py-1.5 rounded-lg border text-pink-300 font-bold">
            Nữ: {femaleCount}
          </span>
          <span style={DARK_SUBCARD_STYLE} className="px-3 py-1.5 rounded-lg border text-slate-200 font-bold">
            Tổng đội: {modeFilteredRegistrations.length}
          </span>
          <span style={DARK_SUBCARD_STYLE} className="px-3 py-1.5 rounded-lg border text-emerald-400 font-bold">
            Check-in: {modeFilteredRegistrations.filter((r) => r.checkedIn).length}/{modeFilteredRegistrations.length}
          </span>
        </div>
      </section>

      {!isAdmin && (
        <section
          style={{ backgroundColor: '#1f1608', borderColor: '#854d0e', color: '#fef08a' }}
          className="border rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2.5 text-xs">
            <Lock className="w-4 h-4 text-amber-400 shrink-0" />
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
            style={{ backgroundColor: '#ea580c', color: '#ffffff' }}
            className="min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-bold"
          >
            Đăng nhập Admin
          </button>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-5 space-y-5">
          {/* STEP 1 */}
          <form
            onSubmit={handleCreateDivision}
            style={DARK_PANEL_STYLE}
            className="border rounded-2xl p-4 sm:p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-orange-500" />
                <h2 className="font-display text-sm sm:text-base font-bold uppercase text-white">
                  1. THÊM NỘI DUNG ({compType === 'team' ? 'ĐỒNG ĐỘI' : 'ĐÔI'})
                </h2>
              </div>
              {isAdmin && (
                <span
                  style={{ backgroundColor: '#064e3b', color: '#6ee7b7', borderColor: '#047857' }}
                  className="text-[11px] font-semibold border px-2 py-0.5 rounded-md inline-flex items-center gap-1"
                >
                  <ShieldCheck className="w-3.5 h-3.5" /> Admin
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleSwitchCompType('doubles')}
                style={
                  compType === 'doubles'
                    ? { backgroundColor: '#ea580c', color: '#ffffff' }
                    : DARK_SUBCARD_STYLE
                }
                className="min-h-[38px] rounded-xl border text-xs font-bold transition-colors"
              >
                Đôi (Ẩn Đồng đội)
              </button>
              <button
                type="button"
                onClick={() => handleSwitchCompType('team')}
                style={
                  compType === 'team'
                    ? { backgroundColor: '#ea580c', color: '#ffffff' }
                    : DARK_SUBCARD_STYLE
                }
                className="min-h-[38px] rounded-xl border text-xs font-bold transition-colors"
              >
                Đồng đội (Ẩn Đôi)
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newDivisionName}
                onChange={(e) => setNewDivisionName(e.target.value)}
                style={DARK_INPUT_STYLE}
                placeholder={
                  compType === 'team'
                    ? 'VD: Đồng Đội CLB 1986'
                    : 'VD: Đôi Nam Nữ 4.5'
                }
                className="flex-1 min-w-0 min-h-[38px] px-3 py-1.5 text-xs border rounded-lg"
              />
              <button
                type="submit"
                style={{ backgroundColor: '#ea580c', color: '#ffffff' }}
                className="min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 shrink-0 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Thêm
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {visibleDivisions.map((div) => (
                <button
                  key={div}
                  type="button"
                  onClick={() => setSelectedDivision(div)}
                  style={
                    activeDivision === div
                      ? { backgroundColor: '#431407', color: '#fdba74', borderColor: '#f97316' }
                      : DARK_SUBCARD_STYLE
                  }
                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors"
                >
                  {div}
                </button>
              ))}
            </div>
          </form>

          {/* STEP 2 */}
          <form
            onSubmit={handleSubmitRegistration}
            style={DARK_PANEL_STYLE}
            className="border rounded-2xl p-4 sm:p-5 space-y-4"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-orange-500" />
                <h2 className="font-display text-sm sm:text-base font-bold uppercase text-white">
                  2. NHẬP VĐV NAM / NỮ & RANDOM 3 BẢNG
                </h2>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  onClick={handleRandomizeThreeGroups}
                  style={{ backgroundColor: '#1e293b', color: '#fb923c', borderColor: '#334155' }}
                  className="px-2.5 py-1 rounded-lg border text-[11px] font-extrabold inline-flex items-center gap-1 shrink-0"
                >
                  <Shuffle className="w-3 h-3" />
                  Random 3 bảng
                </button>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Nội dung {compType === 'team' ? 'Đồng đội' : 'Đôi'} *
              </label>
              <select
                value={activeDivision}
                onChange={(e) => setSelectedDivision(e.target.value)}
                style={DARK_INPUT_STYLE}
                className="w-full min-h-[38px] px-3 py-1.5 text-xs font-semibold border rounded-lg"
              >
                {visibleDivisions.length > 0 ? (
                  visibleDivisions.map((div) => (
                    <option key={div} value={div}>
                      {div}
                    </option>
                  ))
                ) : (
                  <option value={activeDivision}>{activeDivision}</option>
                )}
              </select>
            </div>

            <div style={DARK_SUBCARD_STYLE} className="p-3.5 rounded-xl border space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-white">
                  Thêm từng VĐV riêng lẻ (Nam / Nữ)
                </span>
                <span className="text-[11px] text-slate-400">
                  Cách nhau dấu phẩy
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSingleGender('Nam');
                    setGenderFilter('Nam');
                  }}
                  style={
                    singleGender === 'Nam'
                      ? { backgroundColor: '#0284c7', color: '#ffffff' }
                      : DARK_INPUT_STYLE
                  }
                  className="min-h-[36px] rounded-xl border text-xs font-extrabold transition-colors"
                >
                  + VĐV Nam
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSingleGender('Nữ');
                    setGenderFilter('Nữ');
                  }}
                  style={
                    singleGender === 'Nữ'
                      ? { backgroundColor: '#db2777', color: '#ffffff' }
                      : DARK_INPUT_STYLE
                  }
                  className="min-h-[36px] rounded-xl border text-xs font-extrabold transition-colors"
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
                    style={
                      singleTier === tier
                        ? { backgroundColor: '#ea580c', color: '#ffffff' }
                        : DARK_INPUT_STYLE
                    }
                    className="min-h-[32px] rounded-lg border text-[11px] font-bold transition-colors"
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
                  style={DARK_INPUT_STYLE}
                  className="min-h-[32px] px-2 text-xs font-semibold border rounded-lg"
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
                  style={DARK_INPUT_STYLE}
                  placeholder={
                    singleGender === 'Nam'
                      ? 'Tên VĐV Nam (VD: Anh Dũng, Minh Khang)'
                      : 'Tên VĐV Nữ (VD: Thùy Dương, Mai)'
                  }
                  className="flex-1 min-w-0 min-h-[36px] px-3 py-1 text-xs border rounded-lg"
                />
                <button
                  type="button"
                  onClick={handleAddSingleAthletes}
                  style={{ backgroundColor: '#059669', color: '#ffffff' }}
                  className="min-h-[36px] px-3 py-1 rounded-lg text-xs font-bold shrink-0"
                >
                  Thêm {singleGender}
                </button>
              </div>

              {rosterAthletes.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-slate-400">
                      VĐV đã thêm ({rosterAthletes.length}):
                    </span>
                    <button
                      type="button"
                      onClick={handleRandomizeThreeGroups}
                      className="text-[11px] font-bold text-orange-400 hover:text-orange-300 inline-flex items-center gap-1"
                    >
                      <Shuffle className="w-3 h-3" /> Chia ngẫu nhiên 3 bảng
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                    {rosterAthletes.map((ath) => (
                      <div
                        key={ath.id}
                        style={DARK_INPUT_STYLE}
                        className="p-2 rounded-lg border text-white flex flex-wrap items-center justify-between gap-1.5 text-xs"
                      >
                        <div className="min-w-0">
                          <span
                            style={{
                              backgroundColor: ath.gender === 'Nam' ? '#0284c7' : '#db2777',
                              color: '#ffffff',
                            }}
                            className="inline-block px-1.5 py-0.5 rounded text-[10px] font-extrabold mr-1.5"
                          >
                            {ath.gender}
                          </span>
                          <span className="font-bold">{ath.name}</span>
                          <span className="text-[11px] font-bold text-orange-400 ml-1.5">
                            · {ath.groupName}
                          </span>
                          <span className="text-[11px] text-slate-400 ml-1">
                            ({ath.tier})
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleApplyAthleteToSlot(ath, 'p1')}
                            style={{ backgroundColor: '#1e293b', color: '#e2e8f0' }}
                            className="px-2 py-0.5 rounded text-[10px] font-bold"
                          >
                            VĐV 1
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApplyAthleteToSlot(ath, 'p2')}
                            style={{ backgroundColor: '#1e293b', color: '#e2e8f0' }}
                            className="px-2 py-0.5 rounded text-[10px] font-bold"
                          >
                            VĐV 2
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveSingleAthleteAsEntry(ath)}
                            style={{ backgroundColor: '#059669', color: '#ffffff' }}
                            className="px-2 py-0.5 rounded text-[10px] font-bold"
                          >
                            + Giải
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveRosterAthlete(ath.id)}
                            className="p-1 text-rose-400 hover:text-rose-300"
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

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Giới tính (Đội / Cặp) *
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['Nam', 'Nữ'] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGenderFilter(g)}
                    style={
                      genderFilter === g
                        ? { backgroundColor: '#ea580c', color: '#ffffff' }
                        : DARK_SUBCARD_STYLE
                    }
                    className="min-h-[36px] rounded-xl border text-xs font-bold transition-colors"
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Hạng trình *
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['Trình A', 'Trình B', 'Trình C'] as SkillTier[]).map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => setSkillTier(tier)}
                    style={
                      skillTier === tier
                        ? { backgroundColor: '#ea580c', color: '#ffffff' }
                        : DARK_SUBCARD_STYLE
                    }
                    className="min-h-[36px] rounded-xl border text-xs font-bold transition-colors"
                  >
                    {tier}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {activeIsTeam ? 'Tên Đội / Đội trưởng *' : 'VĐV 1 *'}
              </label>
              <input
                type="text"
                value={player1Name}
                onChange={(e) => setPlayer1Name(e.target.value)}
                style={DARK_INPUT_STYLE}
                placeholder={activeIsTeam ? 'VD: CLB Bính Dần · Duy' : 'VD: Nguyễn Văn A'}
                className="w-full min-h-[38px] px-3 py-1.5 text-xs border rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {activeIsTeam ? 'Đội phó / VĐV chủ lực 2' : 'VĐV 2'}
              </label>
              <input
                type="text"
                value={player2Name}
                onChange={(e) => setPlayer2Name(e.target.value)}
                style={DARK_INPUT_STYLE}
                placeholder={activeIsTeam ? 'VD: Trọng' : 'VD: Trần Thị B'}
                className="w-full min-h-[38px] px-3 py-1.5 text-xs border rounded-lg"
              />
            </div>

            {activeIsTeam && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Danh sách VĐV thành viên Đồng đội (cách nhau dấu phẩy)
                </label>
                <input
                  type="text"
                  value={squadInput}
                  onChange={(e) => setSquadInput(e.target.value)}
                  style={DARK_INPUT_STYLE}
                  placeholder="VD: Duy, Trọng, Hương, Minh, Lan"
                  className="w-full min-h-[38px] px-3 py-1.5 text-xs border rounded-lg"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  CLB / Đơn vị
                </label>
                <input
                  type="text"
                  value={clubName}
                  onChange={(e) => setClubName(e.target.value)}
                  style={DARK_INPUT_STYLE}
                  placeholder="VD: CLB Cao Bằng"
                  className="w-full min-h-[38px] px-3 py-1.5 text-xs border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Xếp vào Bảng
                </label>
                <input
                  type="text"
                  list="group-suggestions"
                  value={targetGroup}
                  onChange={(e) => setTargetGroup(e.target.value)}
                  style={DARK_INPUT_STYLE}
                  placeholder="VD: Bảng A"
                  className="w-full min-h-[38px] px-3 py-1.5 text-xs font-semibold border rounded-lg"
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
              style={{ backgroundColor: '#ea580c', color: '#ffffff' }}
              className="w-full min-h-[42px] px-4 py-2 rounded-xl text-xs font-extrabold inline-flex items-center justify-center gap-1.5 transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              <span>Thêm VĐV / Đội & Xếp Bảng</span>
            </button>
          </form>
        </div>

        {/* Right column: Step 3 Roster & Group Assignment */}
        <div style={DARK_PANEL_STYLE} className="lg:col-span-7 border rounded-2xl overflow-hidden">
          <div style={DARK_SUBCARD_STYLE} className="px-4 sm:px-5 py-3.5 border-b flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-orange-500" />
              <h2 className="font-display text-sm sm:text-base font-bold uppercase text-white">
                3. DANH SÁCH {compType === 'team' ? 'ĐỒNG ĐỘI' : 'ĐÔI'} & PHÂN BẢNG ({filteredRegistrations.length})
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {isAdmin && (
                <button
                  type="button"
                  onClick={handleRandomizeThreeGroups}
                  style={{ backgroundColor: '#ea580c', color: '#ffffff' }}
                  className="min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1"
                >
                  <Shuffle className="w-3.5 h-3.5" />
                  <span>Random 3 bảng</span>
                </button>
              )}

              <select
                value={filterDivision}
                onChange={(e) => setFilterDivision(e.target.value)}
                style={DARK_INPUT_STYLE}
                className="min-h-[34px] px-2.5 py-1 text-xs font-semibold border rounded-lg"
              >
                <option value="ALL">Tất cả nội dung ({compType === 'team' ? 'Đồng đội' : 'Đôi'})</option>
                {visibleDivisions.map((div) => (
                  <option key={div} value={div}>
                    {div}
                  </option>
                ))}
              </select>

              <select
                value={filterGroup}
                onChange={(e) => setFilterGroup(e.target.value)}
                style={DARK_INPUT_STYLE}
                className="min-h-[34px] px-2.5 py-1 text-xs font-semibold border rounded-lg"
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
            <div className="p-8 text-center text-xs text-slate-400">
              Chưa có VĐV hoặc đội nào trong danh sách lọc hiện tại.
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {filteredRegistrations.map((reg, index) => (
                <div
                  key={reg.id}
                  className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono-num text-xs font-bold text-slate-500">
                        #{index + 1}
                      </span>
                      <span className="text-sm font-bold text-white truncate">
                        {reg.teamName}
                      </span>
                      <span
                        style={{ backgroundColor: '#431407', color: '#fdba74', borderColor: '#9a3412' }}
                        className="px-2 py-0.5 rounded-md text-[10px] font-bold border"
                      >
                        {reg.division}
                      </span>
                      {reg.checkedIn && (
                        <span
                          style={{ backgroundColor: '#064e3b', color: '#6ee7b7', borderColor: '#047857' }}
                          className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-bold border"
                        >
                          <CheckCircle2 className="w-3 h-3" /> Đã check-in
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span>CLB / Trình: {reg.club || 'Tự do'}</span>
                      <span>·</span>
                      <span className="font-mono-num">Rating: {reg.combinedRating}</span>
                      {reg.squadRoster && reg.squadRoster.length > 0 && (
                        <>
                          <span>·</span>
                          <span className="text-slate-300 font-medium">
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
                      style={DARK_INPUT_STYLE}
                      className="min-h-[34px] px-2.5 py-1 text-xs font-bold border rounded-lg disabled:opacity-50"
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
                        style={
                          reg.checkedIn
                            ? { backgroundColor: '#059669', color: '#ffffff' }
                            : { backgroundColor: '#1e293b', color: '#e2e8f0' }
                        }
                        className="min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition-colors"
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
