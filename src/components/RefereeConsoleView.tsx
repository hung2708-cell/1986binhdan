import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Flag,
  Gavel,
  Megaphone,
  Plus,
  RotateCcw,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import {
  MATCH_STAGE_LABELS,
  MATCH_STATUS_LABELS,
  type Match,
  type Registration,
  type StaffAccount,
  type Tournament,
} from '../types/tournament';
import { formatScoreCallout, isTeamDivision } from '../utils/pickleballEngine';

type ThemeMode = 'light' | 'dark';

interface RefereeConsoleViewProps {
  tournament: Tournament;
  matches: Match[];
  registrations: Registration[];
  selectedMatchId: string | null;
  currentAccount: StaffAccount | null;
  themeMode?: ThemeMode;
  onRequestLogin: (reason: string) => void;
  onSelectMatch: (matchId: string) => void;
  onUpdateMatch: (matchId: string, patch: Partial<Match>) => void;
  onCompleteMatch: (match: Match, winnerSide: '' | 'A' | 'B') => void;
  onAnnounceCourtCall: (match: Match) => void;
  onAnnounceCourtAvailable: (finishedMatch: Match) => void;
  onAddRosterAthlete: (registrationId: string, athleteLabel: string) => void;
}

export const RefereeConsoleView: React.FC<RefereeConsoleViewProps> = ({
  tournament,
  matches,
  registrations,
  selectedMatchId,
  currentAccount,
  themeMode = 'light',
  onRequestLogin,
  onSelectMatch,
  onUpdateMatch,
  onCompleteMatch,
  onAnnounceCourtCall,
  onAnnounceCourtAvailable,
  onAddRosterAthlete,
}) => {
  const isDark = themeMode === 'dark';
  const isAdmin = currentAccount?.role === 'admin';

  const [newAthleteName, setNewAthleteName] = useState('');
  const [newAthleteGender, setNewAthleteGender] = useState<'Nam' | 'Nữ'>('Nam');
  const [newAthleteTier, setNewAthleteTier] = useState<'Trình A' | 'Trình B' | 'Trình C'>(
    'Trình B',
  );

  const activeMatch = useMemo(() => {
    if (matches.length === 0) return null;
    if (selectedMatchId) {
      const found = matches.find((m) => m.id === selectedMatchId);
      if (found) return found;
    }
    return matches.find((m) => m.status === 'live') || matches[0];
  }, [matches, selectedMatchId]);

  const matchedRegA = useMemo(
    () =>
      activeMatch
        ? registrations.find(
            (r) => r.id === activeMatch.teamAId || r.teamName === activeMatch.teamAName,
          )
        : undefined,
    [registrations, activeMatch],
  );

  const matchedRegB = useMemo(
    () =>
      activeMatch
        ? registrations.find(
            (r) => r.id === activeMatch.teamBId || r.teamName === activeMatch.teamBName,
          )
        : undefined,
    [registrations, activeMatch],
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

  if (!activeMatch) {
    return (
      <section className={`border rounded-2xl p-6 text-center space-y-2 ${cardSurface}`}>
        <div className="font-display text-base font-bold">
          Chưa có trận đấu nào trong giải này.
        </div>
        <p className={`text-xs ${mutedText}`}>
          Vui lòng vào mục <strong>Lịch & Nhánh đấu</strong> để sinh lịch tự động.
        </p>
      </section>
    );
  }

  const targetPoints = activeMatch.pointsToWin || tournament.pointsToWin || 15;
  const isTeam = isTeamDivision(activeMatch.division, activeMatch.competitionType);

  const handleScorePoint = (side: 'A' | 'B') => {
    const prevSnapshot = {
      scoreA: activeMatch.scoreA,
      scoreB: activeMatch.scoreB,
      servingTeam: activeMatch.servingTeam,
      serverNumber: activeMatch.serverNumber,
    };

    const nextScoreA = side === 'A' ? activeMatch.scoreA + 1 : activeMatch.scoreA;
    const nextScoreB = side === 'B' ? activeMatch.scoreB + 1 : activeMatch.scoreB;

    const nextHistory = [
      ...(activeMatch.scoreHistory || []),
      {
        atMs: Date.now(),
        side,
        scoreA: nextScoreA,
        scoreB: nextScoreB,
        servingTeam: activeMatch.servingTeam,
        serverNumber: activeMatch.serverNumber,
      },
    ];

    onUpdateMatch(activeMatch.id, {
      status: activeMatch.status === 'scheduled' ? 'live' : activeMatch.status,
      startedAtMs: activeMatch.startedAtMs || Date.now(),
      scoreA: nextScoreA,
      scoreB: nextScoreB,
      scoreHistory: nextHistory,
      servingTeam: side,
      serverNumber: activeMatch.servingTeam === side ? activeMatch.serverNumber : 1,
      ...{ _prev: prevSnapshot },
    } as Partial<Match>);
  };

  const handleUndoPoint = () => {
    const history = activeMatch.scoreHistory || [];
    if (history.length > 0) {
      const remaining = history.slice(0, -1);
      const last = remaining[remaining.length - 1];
      onUpdateMatch(activeMatch.id, {
        scoreA: last ? last.scoreA : 0,
        scoreB: last ? last.scoreB : 0,
        servingTeam: last ? last.servingTeam : 'A',
        serverNumber: last ? last.serverNumber : 2,
        scoreHistory: remaining,
      });
      return;
    }
    onUpdateMatch(activeMatch.id, {
      scoreA: Math.max(0, activeMatch.scoreA - 1),
    });
  };

  const handleRotateServer = () => {
    if (activeMatch.servingTeam === 'A') {
      if (activeMatch.serverNumber === 1) {
        onUpdateMatch(activeMatch.id, { serverNumber: 2 });
      } else {
        onUpdateMatch(activeMatch.id, { servingTeam: 'B', serverNumber: 1 });
      }
    } else if (activeMatch.serverNumber === 1) {
      onUpdateMatch(activeMatch.id, { serverNumber: 2 });
    } else {
      onUpdateMatch(activeMatch.id, { servingTeam: 'A', serverNumber: 1 });
    }
  };

  const handleQuickAddRoster = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      onRequestLogin('Chỉ tài khoản Admin mới có quyền thêm VĐV vào danh sách đội hình.');
      return;
    }
    if (!newAthleteName.trim()) return;
    const targetReg = matchedRegA || matchedRegB || registrations[0];
    if (!targetReg) return;
    const formatted = `${newAthleteName.trim()} (${newAthleteGender} · ${newAthleteTier})`;
    onAddRosterAthlete(targetReg.id, formatted);
    setNewAthleteName('');
  };

  return (
    <div className="space-y-4 pb-2">
      {/* Thanh chọn trận & điều phối sân */}
      <section className={`border rounded-2xl p-3.5 sm:p-4 space-y-3 ${cardSurface}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-orange-500">
            <Gavel className="w-4 h-4 shrink-0" />
            <span className="truncate">BÀN ĐIỀU HÀNH TRỌNG TÀI · {tournament.name}</span>
          </div>

          <span
            className={`px-2.5 py-1 rounded-lg text-xs font-bold border shrink-0 ${
              isDark
                ? 'bg-slate-950 border-slate-800 text-slate-300'
                : 'bg-slate-100 border-slate-200 text-slate-700'
            }`}
          >
            {currentAccount?.displayName || 'Trọng tài'}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2">
          <select
            value={activeMatch.id}
            onChange={(e) => onSelectMatch(e.target.value)}
            className={`min-h-[38px] flex-1 min-w-0 px-3 py-1.5 text-xs font-bold border rounded-xl ${inputSurface}`}
          >
            {matches.map((m) => (
              <option key={m.id} value={m.id}>
                Trận #{m.matchNumber} (Sân {m.courtNumber}) — {m.teamAName} vs {m.teamBName} [
                {MATCH_STATUS_LABELS[m.status]}]
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onAnnounceCourtCall(activeMatch)}
              className="flex-1 sm:flex-initial min-h-[38px] px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <Megaphone className="w-3.5 h-3.5 shrink-0" />
              <span>Gọi VĐV vào sân</span>
            </button>

            <button
              type="button"
              onClick={() => onAnnounceCourtAvailable(activeMatch)}
              className={`flex-1 sm:flex-initial min-h-[38px] px-3 py-1.5 rounded-xl border text-xs font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap ${
                isDark
                  ? 'bg-slate-950 hover:bg-slate-800 border-slate-700 text-emerald-400'
                  : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Báo sân trống</span>
            </button>
          </div>
        </div>
      </section>

      {/* Bảng điểm chính */}
      <section className={`border rounded-2xl p-4 sm:p-5 space-y-4 ${cardSurface}`}>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2 font-mono-num min-w-0">
            <span className="px-2.5 py-1 rounded-lg bg-orange-500/15 text-orange-500 font-extrabold shrink-0">
              SÂN {activeMatch.courtNumber} · TRẬN #{activeMatch.matchNumber}
            </span>
            <span className={`truncate ${mutedText}`}>
              {activeMatch.groupName || MATCH_STAGE_LABELS[activeMatch.stage]} ·{' '}
              {activeMatch.teamSubCategory || activeMatch.division}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 font-mono-num shrink-0">
            <span className="text-emerald-500 font-bold">
              Hô điểm: {formatScoreCallout(activeMatch)}
            </span>
            <span className={mutedText}>Chạm {targetPoints} điểm</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-11 gap-3 sm:gap-4 items-center">
          {/* Đội A */}
          <div className={`lg:col-span-5 border rounded-2xl p-3.5 sm:p-4 space-y-3 min-w-0 ${subSurface}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-orange-500">
                ĐỘI A ({activeMatch.courtSideA === 'left' ? 'BÊN TRÁI' : 'BÊN PHẢI'})
              </span>
              {activeMatch.servingTeam === 'A' && (
                <span className="px-2 py-0.5 rounded-md bg-orange-600 text-white text-[10px] font-bold whitespace-nowrap">
                  ● GIAO BÓNG (NGƯỜI {activeMatch.serverNumber})
                </span>
              )}
            </div>

            <div className="font-display text-lg sm:text-xl font-extrabold truncate">
              {activeMatch.teamAName}
            </div>
            {(activeMatch.teamAPlayer1 || activeMatch.teamAPlayer2) && (
              <div className={`text-xs truncate ${mutedText}`}>
                {activeMatch.teamAPlayer1} {activeMatch.teamAPlayer2 && `· ${activeMatch.teamAPlayer2}`}
              </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-2">
              <div className="font-mono-num text-4xl sm:text-5xl font-extrabold">
                {activeMatch.scoreA}
              </div>
              <button
                type="button"
                onClick={() => handleScorePoint('A')}
                className="min-h-[46px] px-4 sm:px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 active:scale-[0.98] text-white text-sm font-extrabold inline-flex items-center gap-1.5 shadow-sm transition-all whitespace-nowrap"
              >
                <Plus className="w-5 h-5 shrink-0" />
                <span>+1 ĐIỂM A</span>
              </button>
            </div>
          </div>

          {/* Tỉ số trung tâm */}
          <div className="lg:col-span-1 text-center font-mono-num text-xl sm:text-2xl font-extrabold py-0.5">
            {activeMatch.scoreA} : {activeMatch.scoreB}
          </div>

          {/* Đội B */}
          <div className={`lg:col-span-5 border rounded-2xl p-3.5 sm:p-4 space-y-3 min-w-0 ${subSurface}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-sky-500">
                ĐỘI B ({activeMatch.courtSideA === 'left' ? 'BÊN PHẢI' : 'BÊN TRÁI'})
              </span>
              {activeMatch.servingTeam === 'B' && (
                <span className="px-2 py-0.5 rounded-md bg-sky-600 text-white text-[10px] font-bold whitespace-nowrap">
                  ● GIAO BÓNG (NGƯỜI {activeMatch.serverNumber})
                </span>
              )}
            </div>

            <div className="font-display text-lg sm:text-xl font-extrabold truncate">
              {activeMatch.teamBName}
            </div>
            {(activeMatch.teamBPlayer1 || activeMatch.teamBPlayer2) && (
              <div className={`text-xs truncate ${mutedText}`}>
                {activeMatch.teamBPlayer1} {activeMatch.teamBPlayer2 && `· ${activeMatch.teamBPlayer2}`}
              </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-2">
              <div className="font-mono-num text-4xl sm:text-5xl font-extrabold">
                {activeMatch.scoreB}
              </div>
              <button
                type="button"
                onClick={() => handleScorePoint('B')}
                className="min-h-[46px] px-4 sm:px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 active:scale-[0.98] text-white text-sm font-extrabold inline-flex items-center gap-1.5 shadow-sm transition-all whitespace-nowrap"
              >
                <Plus className="w-5 h-5 shrink-0" />
                <span>+1 ĐIỂM B</span>
              </button>
            </div>
          </div>
        </div>

        {/* Thanh điều khiển phụ: Đổi lượt giao, Hoàn tác, Đổi sân, Kết thúc trận */}
        <div
          className={`pt-3 border-t flex flex-wrap items-center justify-between gap-2.5 ${
            isDark ? 'border-slate-800' : 'border-slate-200'
          }`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleRotateServer}
              className={`min-h-[38px] px-3 py-2 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap ${
                isDark
                  ? 'bg-slate-950 hover:bg-slate-800 border-slate-700 text-slate-200'
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-orange-500 shrink-0" />
              <span>Đổi lượt giao bóng</span>
            </button>

            <button
              type="button"
              onClick={handleUndoPoint}
              className={`min-h-[38px] px-3 py-2 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap ${
                isDark
                  ? 'bg-slate-950 hover:bg-slate-800 border-slate-700 text-slate-200'
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>Hoàn tác điểm</span>
            </button>

            <button
              type="button"
              onClick={() =>
                onUpdateMatch(activeMatch.id, {
                  courtSideA: activeMatch.courtSideA === 'left' ? 'right' : 'left',
                  sideSwitched: !activeMatch.sideSwitched,
                })
              }
              className={`min-h-[38px] px-3 py-2 rounded-xl border text-xs font-bold whitespace-nowrap ${
                isDark
                  ? 'bg-slate-950 hover:bg-slate-800 border-slate-700 text-slate-200'
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
              }`}
            >
              Đổi sân
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onCompleteMatch(activeMatch, 'A')}
              className="min-h-[38px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Flag className="w-3.5 h-3.5 shrink-0" />
              <span>Đội A thắng</span>
            </button>

            <button
              type="button"
              onClick={() => onCompleteMatch(activeMatch, 'B')}
              className="min-h-[38px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Flag className="w-3.5 h-3.5 shrink-0" />
              <span>Đội B thắng</span>
            </button>

            {isTeam && (
              <button
                type="button"
                onClick={() => onCompleteMatch(activeMatch, '')}
                className={`min-h-[38px] px-3 py-2 rounded-xl border text-xs font-bold whitespace-nowrap ${
                  isDark
                    ? 'bg-slate-950 hover:bg-slate-800 border-slate-700 text-slate-200'
                    : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                }`}
              >
                Hòa 2-2
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Bổ sung nhanh VĐV vào đội hình (chỉ Admin) */}
      {isAdmin && (
        <form onSubmit={handleQuickAddRoster} className={`border rounded-2xl p-4 space-y-3 ${cardSurface}`}>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-bold uppercase flex items-center gap-1.5">
              <UserPlus className="w-4 h-4 text-orange-500" />
              <span>BỔ SUNG NHANH VĐV VÀO ĐỘI HÌNH</span>
            </h2>
            <span className="text-[11px] font-bold text-emerald-500 inline-flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              Admin
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setNewAthleteGender('Nam')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
                newAthleteGender === 'Nam'
                  ? 'bg-sky-600 text-white border-sky-600'
                  : isDark
                  ? 'bg-slate-950 text-slate-300 border-slate-800'
                  : 'bg-slate-50 text-slate-700 border-slate-200'
              }`}
            >
              Nam
            </button>
            <button
              type="button"
              onClick={() => setNewAthleteGender('Nữ')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
                newAthleteGender === 'Nữ'
                  ? 'bg-rose-600 text-white border-rose-600'
                  : isDark
                  ? 'bg-slate-950 text-slate-300 border-slate-800'
                  : 'bg-slate-50 text-slate-700 border-slate-200'
              }`}
            >
              Nữ
            </button>

            {(['Trình A', 'Trình B', 'Trình C'] as const).map((tier) => (
              <button
                key={tier}
                type="button"
                onClick={() => setNewAthleteTier(tier)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border ${
                  newAthleteTier === tier
                    ? 'bg-orange-600 text-white border-orange-600'
                    : isDark
                    ? 'bg-slate-950 text-slate-300 border-slate-800'
                    : 'bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                {tier}
              </button>
            ))}

            <input
              type="text"
              value={newAthleteName}
              onChange={(e) => setNewAthleteName(e.target.value)}
              placeholder="Tên VĐV bổ sung..."
              className={`flex-1 min-w-[180px] min-h-[36px] px-3 py-1 text-xs border rounded-xl ${inputSurface}`}
            />

            <button
              type="submit"
              className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold"
            >
              Thêm VĐV
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
