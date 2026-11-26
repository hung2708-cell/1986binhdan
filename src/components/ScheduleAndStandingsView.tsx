import React, { useMemo, useState } from 'react';
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  GitBranch,
  Play,
  RefreshCw,
  Shuffle,
  Trophy,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  MATCH_STAGE_LABELS,
  MATCH_STATUS_LABELS,
  type Match,
  type Registration,
  type Tournament,
} from '../types/tournament';
import {
  computeGroupStandings,
  formatScoreCallout,
  isTeamDivision,
} from '../utils/pickleballEngine';

type ThemeMode = 'light' | 'dark';

interface ScheduleAndStandingsViewProps {
  tournament: Tournament;
  registrations: Registration[];
  matches: Match[];
  mode: 'schedule' | 'standings';
  isAdmin: boolean;
  themeMode?: ThemeMode;
  onGenerateSchedule: (division: string) => void;
  onOpenRefereeForMatch: (matchId: string) => void;
  onUpdateMatchSchedule: (matchId: string, courtNumber: number, scheduledTime: string) => void;
  onSyncKnockoutFromGroups: (division: string) => void;
}

export const ScheduleAndStandingsView: React.FC<ScheduleAndStandingsViewProps> = ({
  tournament,
  registrations,
  matches,
  mode,
  isAdmin,
  themeMode = 'light',
  onGenerateSchedule,
  onOpenRefereeForMatch,
  onUpdateMatchSchedule,
  onSyncKnockoutFromGroups,
}) => {
  const isDark = themeMode === 'dark';

  const [compFilter, setCompFilter] = useState<'all' | 'doubles' | 'team'>('all');
  const [selectedDivision, setSelectedDivision] = useState<string>(
    tournament.divisions[0] || '',
  );
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const filteredDivisions = useMemo(() => {
    return tournament.divisions.filter((div) => {
      const teamMode = isTeamDivision(div);
      if (compFilter === 'doubles') return !teamMode;
      if (compFilter === 'team') return teamMode;
      return true;
    });
  }, [tournament.divisions, compFilter]);

  const activeDivision = filteredDivisions.includes(selectedDivision)
    ? selectedDivision
    : filteredDivisions[0] || tournament.divisions[0] || '';

  const divRegistrations = useMemo(
    () => registrations.filter((r) => r.division === activeDivision),
    [registrations, activeDivision],
  );

  const divMatches = useMemo(
    () =>
      matches
        .filter((m) => m.division === activeDivision)
        .sort((a, b) => a.matchNumber - b.matchNumber),
    [matches, activeDivision],
  );

  const groupStandings = useMemo(
    () => computeGroupStandings(divRegistrations, divMatches, activeDivision),
    [divRegistrations, divMatches, activeDivision],
  );

  const groupNames = useMemo(() => Object.keys(groupStandings), [groupStandings]);

  const groupMatches = useMemo(
    () =>
      divMatches.filter(
        (m) =>
          m.stage === 'group' &&
          (selectedGroup === 'all' || (m.groupName || 'Bảng A') === selectedGroup),
      ),
    [divMatches, selectedGroup],
  );

  const knockoutMatches = useMemo(
    () => divMatches.filter((m) => m.stage !== 'group'),
    [divMatches],
  );

  const sf1 = knockoutMatches.find((m) => m.stage === 'semifinal' && m.bracketSlot === 'SF1');
  const sf2 = knockoutMatches.find((m) => m.stage === 'semifinal' && m.bracketSlot === 'SF2');
  const finalMatch = knockoutMatches.find((m) => m.stage === 'final');
  const thirdPlaceMatch = knockoutMatches.find((m) => m.stage === 'third_place');

  const cardSurface = isDark
    ? 'bg-slate-900 border-slate-800 text-slate-100'
    : 'bg-white border-slate-200 text-slate-900';

  const subSurface = isDark
    ? 'bg-slate-950/70 border-slate-800 text-slate-100'
    : 'bg-slate-50 border-slate-200 text-slate-900';

  const mutedText = isDark ? 'text-slate-400' : 'text-slate-600';

  const toggleGroupCollapse = (groupName: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupName]: !prev[groupName] }));
  };

  const baseBracketWidth = 780;
  const scaledBracketWidth = Math.round(baseBracketWidth * zoomScale);

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Thanh lọc nội dung & thao tác xếp lịch */}
      <section className={`border rounded-2xl p-3.5 sm:p-5 space-y-3.5 ${cardSurface}`}>
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <div
              className={`inline-flex rounded-xl p-1 border shrink-0 ${
                isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'
              }`}
            >
              {[
                { id: 'all', label: 'Tất cả' },
                { id: 'doubles', label: 'Đôi' },
                { id: 'team', label: 'Đồng đội' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCompFilter(tab.id as 'all' | 'doubles' | 'team')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                    compFilter === tab.id
                      ? 'bg-orange-600 text-white'
                      : isDark
                      ? 'text-slate-300 hover:text-white'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {filteredDivisions.map((div) => {
                const active = div === activeDivision;
                return (
                  <button
                    key={div}
                    type="button"
                    onClick={() => {
                      setSelectedDivision(div);
                      setSelectedGroup('all');
                    }}
                    className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-orange-600 text-white border-orange-600'
                        : isDark
                        ? 'bg-slate-950/60 text-slate-300 border-slate-800 hover:border-slate-700'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {div}
                  </button>
                );
              })}
            </div>
          </div>

          {isAdmin && activeDivision && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {tournament.format !== 'round_robin' && (
                <button
                  type="button"
                  onClick={() => onSyncKnockoutFromGroups(activeDivision)}
                  className={`min-h-[38px] px-3 py-2 rounded-xl text-xs font-bold border transition-colors inline-flex items-center gap-1.5 whitespace-nowrap ${
                    isDark
                      ? 'bg-slate-950 hover:bg-slate-800 text-amber-300 border-slate-700'
                      : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300'
                  }`}
                >
                  <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>Cập nhật nhánh Knockout</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => onGenerateSchedule(activeDivision)}
                className="min-h-[38px] px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Shuffle className="w-4 h-4 shrink-0" />
                <span>
                  Chia bảng & Xếp lịch ({divRegistrations.length} đội)
                </span>
              </button>
            </div>
          )}
        </div>

        {groupNames.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <button
              type="button"
              onClick={() => setSelectedGroup('all')}
              className={`px-3 py-1 rounded-lg text-xs font-bold border whitespace-nowrap ${
                selectedGroup === 'all'
                  ? 'bg-orange-600 text-white border-orange-600'
                  : isDark
                  ? 'bg-slate-950/60 text-slate-300 border-slate-800'
                  : 'bg-slate-50 text-slate-700 border-slate-200'
              }`}
            >
              Tất cả bảng
            </button>
            {groupNames.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setSelectedGroup(g)}
                className={`px-3 py-1 rounded-lg text-xs font-bold border whitespace-nowrap ${
                  selectedGroup === g
                    ? 'bg-orange-600 text-white border-orange-600'
                    : isDark
                    ? 'bg-slate-950/60 text-slate-300 border-slate-800'
                    : 'bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Nội dung Bảng xếp hạng */}
      {mode === 'standings' && (
        <section className="space-y-4">
          {groupNames.length === 0 ? (
            <div className={`border rounded-2xl p-8 text-center space-y-2 ${cardSurface}`}>
              <div className="font-display text-base font-bold">
                Chưa có bảng đấu cho nội dung {activeDivision || 'này'}
              </div>
              <p className={`text-xs max-w-md mx-auto ${mutedText}`}>
                Bấm nút <strong>Chia bảng & Xếp lịch</strong> ở thanh công cụ phía trên để hệ thống
                phân hạt giống vào các bảng và tạo lịch thi đấu vòng tròn.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {groupNames
                .filter((g) => selectedGroup === 'all' || g === selectedGroup)
                .map((gName) => {
                  const rows = groupStandings[gName] || [];
                  const isCollapsed = Boolean(collapsedGroups[gName]);
                  return (
                    <div key={gName} className={`border rounded-2xl overflow-hidden ${cardSurface}`}>
                      <div
                        className={`px-4 py-3 border-b flex items-center justify-between ${
                          isDark ? 'border-slate-800 bg-slate-950/50' : 'border-slate-200 bg-slate-50'
                        }`}
                      >
                        <div className="font-display text-sm font-extrabold uppercase tracking-wide">
                          {gName} ({rows.length} đội)
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleGroupCollapse(gName)}
                          className={`p-1 rounded-lg ${mutedText}`}
                        >
                          {isCollapsed ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronUp className="w-4 h-4" />
                          )}
                        </button>
                      </div>

                      {!isCollapsed && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr
                                className={`border-b ${
                                  isDark
                                    ? 'border-slate-800 text-slate-400 bg-slate-950/30'
                                    : 'border-slate-200 text-slate-500 bg-slate-50/60'
                                }`}
                              >
                                <th className="py-2.5 px-3">#</th>
                                <th className="py-2.5 px-3">Đội / VĐV</th>
                                <th className="py-2.5 px-2 text-center">Trận</th>
                                <th className="py-2.5 px-2 text-center">T-B</th>
                                <th className="py-2.5 px-2 text-right">Hiệu số</th>
                                <th className="py-2.5 px-3 text-right">Điểm</th>
                              </tr>
                            </thead>
                            <tbody
                              className={
                                isDark ? 'divide-y divide-slate-800' : 'divide-y divide-slate-100'
                              }
                            >
                              {rows.map((row, idx) => (
                                <tr
                                  key={row.teamId}
                                  className={
                                    idx < 2
                                      ? isDark
                                        ? 'bg-emerald-950/20'
                                        : 'bg-emerald-50/60'
                                      : ''
                                  }
                                >
                                  <td className="py-2.5 px-3 font-mono-num font-bold">{idx + 1}</td>
                                  <td className="py-2.5 px-3">
                                    <div className="font-bold">{row.teamName}</div>
                                    {row.club && (
                                      <div className={`text-[11px] ${mutedText}`}>{row.club}</div>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-2 text-center font-mono-num">
                                    {row.played}
                                  </td>
                                  <td className="py-2.5 px-2 text-center font-mono-num">
                                    {row.wins}-{row.losses}
                                  </td>
                                  <td
                                    className={`py-2.5 px-2 text-right font-mono-num font-semibold ${
                                      row.pointDiff >= 0 ? 'text-emerald-500' : 'text-rose-500'
                                    }`}
                                  >
                                    {row.pointDiff > 0 ? `+${row.pointDiff}` : row.pointDiff}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono-num font-extrabold text-orange-500">
                                    {row.rankPoints}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </section>
      )}

      {/* Nội dung Lịch thi đấu vòng bảng */}
      {mode === 'schedule' && (
        <section className={`border rounded-2xl p-3.5 sm:p-5 space-y-4 ${cardSurface}`}>
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-base sm:text-lg font-bold uppercase tracking-tight flex items-center gap-2">
                <Calendar className="w-4 h-4 text-orange-500 shrink-0" />
                <span>LỊCH THI ĐẤU VÒNG BẢNG · {activeDivision || 'NỘI DUNG'}</span>
              </h2>
              <p className={`text-xs ${mutedText}`}>
                Hiển thị {groupMatches.length} trận vòng bảng trên quy mô {tournament.courtsCount} sân
              </p>
            </div>
          </div>

          {groupMatches.length === 0 ? (
            <div className={`border rounded-xl p-6 text-center text-xs ${subSurface} ${mutedText}`}>
              Chưa có trận đấu vòng bảng nào được xếp lịch cho nội dung này.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {groupMatches.map((m) => (
                <div
                  key={m.id}
                  className={`border rounded-xl p-3.5 space-y-2.5 min-w-0 ${subSurface}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 font-mono-num">
                      <span className="font-bold text-orange-500">TRẬN #{m.matchNumber}</span>
                      <span>·</span>
                      <span className="font-semibold">{m.groupName || 'Bảng A'}</span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                        m.status === 'live'
                          ? 'bg-emerald-500/15 text-emerald-500'
                          : m.status === 'completed'
                          ? isDark
                            ? 'bg-slate-800 text-slate-300'
                            : 'bg-slate-200 text-slate-700'
                          : 'bg-orange-500/15 text-orange-500'
                      }`}
                    >
                      {MATCH_STATUS_LABELS[m.status]}
                    </span>
                  </div>

                  <div className="grid grid-cols-12 items-center gap-2 text-xs">
                    <div className="col-span-5 font-bold truncate">{m.teamAName}</div>
                    <div className="col-span-2 text-center font-mono-num font-extrabold text-sm">
                      {m.scoreA} - {m.scoreB}
                    </div>
                    <div className="col-span-5 font-bold text-right truncate">{m.teamBName}</div>
                  </div>

                  {m.status === 'live' && (
                    <div className="text-[11px] font-mono-num text-emerald-500 font-semibold">
                      Hô điểm: {formatScoreCallout(m)}
                    </div>
                  )}

                  <div
                    className={`pt-2 border-t flex flex-wrap items-center justify-between gap-2 text-xs ${
                      isDark ? 'border-slate-800' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <label className={mutedText}>Sân:</label>
                      <select
                        disabled={!isAdmin}
                        value={m.courtNumber}
                        onChange={(e) =>
                          onUpdateMatchSchedule(m.id, Number(e.target.value), m.scheduledTime || '')
                        }
                        className={`px-2 py-1 rounded-lg border text-xs font-mono-num ${
                          isDark
                            ? 'bg-slate-900 border-slate-700 text-white'
                            : 'bg-white border-slate-300 text-slate-900'
                        }`}
                      >
                        {Array.from({ length: tournament.courtsCount }, (_, idx) => idx + 1).map(
                          (court) => (
                            <option key={court} value={court}>
                              Sân {court}
                            </option>
                          ),
                        )}
                      </select>

                      <input
                        type="text"
                        disabled={!isAdmin}
                        value={m.scheduledTime || ''}
                        onChange={(e) =>
                          onUpdateMatchSchedule(m.id, m.courtNumber, e.target.value)
                        }
                        placeholder="Giờ đấu"
                        className={`w-24 px-2 py-1 rounded-lg border text-xs font-mono-num ${
                          isDark
                            ? 'bg-slate-900 border-slate-700 text-white'
                            : 'bg-white border-slate-300 text-slate-900'
                        }`}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => onOpenRefereeForMatch(m.id)}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-orange-600 text-white text-xs font-semibold inline-flex items-center gap-1 transition-colors whitespace-nowrap"
                    >
                      <Play className="w-3 h-3" />
                      <span>Vào sân</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Sơ đồ cây nhánh đấu Knockout */}
      {tournament.format !== 'round_robin' && (
        <section className={`border rounded-2xl p-3.5 sm:p-5 space-y-4 ${cardSurface}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base sm:text-lg font-bold uppercase tracking-tight flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-orange-500 shrink-0" />
                <span>SƠ ĐỒ CÂY NHÁNH ĐẤU · {activeDivision || 'NỘI DUNG'}</span>
              </h2>
              <p className={`text-xs ${mutedText}`}>
                Điều chỉnh tỉ lệ phóng to/thu nhỏ hoặc đồng bộ đội Nhất/Nhì bảng vào vòng loại trực tiếp
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setZoomScale((z) => Math.max(0.75, Number((z - 0.1).toFixed(2))))}
                className={`p-2 rounded-lg border ${
                  isDark
                    ? 'bg-slate-950 border-slate-700 text-slate-200 hover:bg-slate-800'
                    : 'bg-slate-50 border-slate-300 text-slate-800 hover:bg-slate-100'
                }`}
                title="Thu nhỏ"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="px-2 font-mono-num text-xs font-bold">
                {Math.round(zoomScale * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoomScale((z) => Math.min(1.25, Number((z + 0.1).toFixed(2))))}
                className={`p-2 rounded-lg border ${
                  isDark
                    ? 'bg-slate-950 border-slate-700 text-slate-200 hover:bg-slate-800'
                    : 'bg-slate-50 border-slate-300 text-slate-800 hover:bg-slate-100'
                }`}
                title="Phóng to"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              {isAdmin && activeDivision && (
                <button
                  type="button"
                  onClick={() => onSyncKnockoutFromGroups(activeDivision)}
                  className="min-h-[34px] px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                  <span>Đồng bộ nhánh</span>
                </button>
              )}
            </div>
          </div>

          <div
            className={`border rounded-2xl p-3 sm:p-4 overflow-x-auto ${
              isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div
              style={{
                width: `${scaledBracketWidth}px`,
                transform: `scale(${zoomScale})`,
                transformOrigin: 'top left',
              }}
              className="grid grid-cols-12 gap-3.5 items-center"
            >
              {/* Cột 1: Đội vào nhánh */}
              <div className="col-span-3 space-y-3">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-center text-orange-500">
                  Đội vào nhánh
                </div>
                {[
                  { tag: 'Nhánh 1A', label: sf1?.teamAName || 'Nhất Bảng A' },
                  { tag: 'Nhánh 2B', label: sf1?.teamBName || 'Nhì Bảng B' },
                  { tag: 'Nhánh 1B', label: sf2?.teamAName || 'Nhất Bảng B' },
                  { tag: 'Nhánh 2A', label: sf2?.teamBName || 'Nhì Bảng A' },
                ].map((slot) => (
                  <div
                    key={slot.tag}
                    className={`p-3 rounded-xl border ${
                      isDark
                        ? 'bg-slate-900 border-slate-800 text-slate-100'
                        : 'bg-white border-slate-200 text-slate-900'
                    }`}
                  >
                    <div className={`text-[10px] font-bold ${mutedText}`}>{slot.tag}</div>
                    <div className="text-xs font-bold truncate mt-0.5">{slot.label}</div>
                  </div>
                ))}
              </div>

              {/* Cột 2: Bán kết */}
              <div className="col-span-4 space-y-6">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-center text-orange-500">
                  {MATCH_STAGE_LABELS.semifinal}
                </div>
                {[
                  { title: 'Bán kết 1', match: sf1 },
                  { title: 'Bán kết 2', match: sf2 },
                ].map(({ title, match }) => (
                  <div
                    key={title}
                    className={`p-3 rounded-xl border space-y-2 ${
                      isDark
                        ? 'bg-slate-900 border-slate-800 text-slate-100'
                        : 'bg-white border-slate-200 text-slate-900'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <span>{title}</span>
                      {match && (
                        <button
                          type="button"
                          onClick={() => onOpenRefereeForMatch(match.id)}
                          className="text-orange-500 hover:underline"
                        >
                          Sân {match.courtNumber}
                        </button>
                      )}
                    </div>
                    <div
                      className={`px-2.5 py-1.5 rounded-lg border flex items-center justify-between text-xs ${
                        isDark
                          ? 'bg-slate-950 border-slate-800 text-slate-100'
                          : 'bg-slate-50 border-slate-200 text-slate-900'
                      }`}
                    >
                      <span className="truncate font-semibold">
                        {match?.teamAName || 'Chờ kết quả bảng'}
                      </span>
                      <span className="font-mono-num font-bold ml-2">{match?.scoreA ?? 0}</span>
                    </div>
                    <div
                      className={`px-2.5 py-1.5 rounded-lg border flex items-center justify-between text-xs ${
                        isDark
                          ? 'bg-slate-950 border-slate-800 text-slate-100'
                          : 'bg-slate-50 border-slate-200 text-slate-900'
                      }`}
                    >
                      <span className="truncate font-semibold">
                        {match?.teamBName || 'Chờ kết quả bảng'}
                      </span>
                      <span className="font-mono-num font-bold ml-2">{match?.scoreB ?? 0}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Cột 3: Chung kết & Tranh Hạng Ba */}
              <div className="col-span-3 space-y-4">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-center text-orange-500">
                  {MATCH_STAGE_LABELS.final}
                </div>
                <div className="p-3 rounded-xl border-2 border-orange-500 bg-orange-500/10 space-y-2">
                  <div className="text-xs font-extrabold text-orange-500 flex items-center justify-between">
                    <span>Chung kết</span>
                    {finalMatch && (
                      <button
                        type="button"
                        onClick={() => onOpenRefereeForMatch(finalMatch.id)}
                        className="text-[11px] underline"
                      >
                        Sân {finalMatch.courtNumber}
                      </button>
                    )}
                  </div>
                  <div
                    className={`px-2.5 py-1.5 rounded-lg border flex items-center justify-between text-xs ${
                      isDark
                        ? 'bg-slate-900 border-slate-800 text-white'
                        : 'bg-white border-slate-200 text-slate-900'
                    }`}
                  >
                    <span className="truncate font-semibold">
                      {finalMatch?.teamAName || 'Thắng Bán kết 1'}
                    </span>
                    <span className="font-mono-num font-bold ml-2">
                      {finalMatch?.scoreA ?? 0}
                    </span>
                  </div>
                  <div
                    className={`px-2.5 py-1.5 rounded-lg border flex items-center justify-between text-xs ${
                      isDark
                        ? 'bg-slate-900 border-slate-800 text-white'
                        : 'bg-white border-slate-200 text-slate-900'
                    }`}
                  >
                    <span className="truncate font-semibold">
                      {finalMatch?.teamBName || 'Thắng Bán kết 2'}
                    </span>
                    <span className="font-mono-num font-bold ml-2">
                      {finalMatch?.scoreB ?? 0}
                    </span>
                  </div>
                </div>

                <div
                  className={`p-3 rounded-xl border space-y-2 ${
                    isDark
                      ? 'bg-slate-900 border-amber-500/40 text-slate-100'
                      : 'bg-white border-amber-300 text-slate-900'
                  }`}
                >
                  <div className="text-xs font-bold text-amber-500">Tranh Hạng Ba</div>
                  <div
                    className={`px-2.5 py-1.5 rounded-lg border flex items-center justify-between text-xs ${
                      isDark
                        ? 'bg-slate-950 border-slate-800 text-slate-200'
                        : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  >
                    <span className="truncate">
                      {thirdPlaceMatch?.teamAName || 'Thua Bán kết 1'}
                    </span>
                    <span className="font-mono-num font-bold ml-2">
                      {thirdPlaceMatch?.scoreA ?? 0}
                    </span>
                  </div>
                  <div
                    className={`px-2.5 py-1.5 rounded-lg border flex items-center justify-between text-xs ${
                      isDark
                        ? 'bg-slate-950 border-slate-800 text-slate-200'
                        : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  >
                    <span className="truncate">
                      {thirdPlaceMatch?.teamBName || 'Thua Bán kết 2'}
                    </span>
                    <span className="font-mono-num font-bold ml-2">
                      {thirdPlaceMatch?.scoreB ?? 0}
                    </span>
                  </div>
                </div>
              </div>

              {/* Cột 4: Vinh danh */}
              <div className="col-span-2 space-y-4">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-center text-orange-500">
                  Vinh danh
                </div>
                <div className="p-3 rounded-xl border border-amber-500/50 bg-amber-500/10 text-center space-y-1">
                  <Trophy className="w-5 h-5 text-amber-500 mx-auto" />
                  <div className="text-[10px] font-extrabold uppercase text-amber-500">
                    Vô địch
                  </div>
                  <div className="text-xs font-bold truncate">
                    {finalMatch?.winnerSide === 'A'
                      ? finalMatch.teamAName
                      : finalMatch?.winnerSide === 'B'
                      ? finalMatch.teamBName
                      : 'Đội thắng Chung kết'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
