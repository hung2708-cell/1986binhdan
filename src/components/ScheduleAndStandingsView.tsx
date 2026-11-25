import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  Filter,
  Gavel,
  MapPin,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react';
import {
  MATCH_STAGE_LABELS,
  MATCH_STATUS_LABELS,
  type Match,
  type Registration,
  type Tournament,
} from '../types/tournament';
import { computeGroupStandings, formatScoreCallout } from '../utils/pickleballEngine';
import { Bracket2DDiagram } from './Bracket2DDiagram';

interface ScheduleAndStandingsViewProps {
  tournament: Tournament;
  registrations: Registration[];
  matches: Match[];
  mode: 'schedule' | 'standings';
  isAdmin: boolean;
  onGenerateSchedule: (division: string) => void;
  onOpenRefereeForMatch: (matchId: string) => void;
  onUpdateMatchSchedule: (matchId: string, courtNumber: number, scheduledTime: string) => void;
  onSyncKnockoutFromGroups: (division: string) => void;
}

export type GenderFilterType = 'all' | 'male' | 'female' | 'mixed';

export const GENDER_FILTER_LABELS: Record<'male' | 'female' | 'mixed', string> = {
  male: 'Nam',
  female: 'Nữ',
  mixed: 'Đôi nam nữ',
};

export function getMatchGenderCategory(m: Match): 'male' | 'female' | 'mixed' {
  const sub = (m.teamSubCategory || '').toLowerCase();
  const div = (m.division || '').toLowerCase();

  // Check sub-category first (e.g., "Trận 1: Đôi Nữ", "Trận 3: Đôi Nam Nữ 1", "Đôi Nam")
  if (sub.includes('nam nữ') || sub.includes('nam-nữ') || sub.includes('mixed')) {
    return 'mixed';
  }
  if (sub.includes('nữ')) {
    return 'female';
  }
  if (sub.includes('nam')) {
    return 'male';
  }

  // Fallback to division name
  if (div.includes('nam nữ') || div.includes('nam-nữ') || div.includes('mixed')) {
    return 'mixed';
  }
  if (div.includes('nữ')) {
    return 'female';
  }
  return 'male';
}

export const ScheduleAndStandingsView: React.FC<ScheduleAndStandingsViewProps> = ({
  tournament,
  registrations,
  matches,
  mode,
  isAdmin,
  onGenerateSchedule,
  onOpenRefereeForMatch,
  onUpdateMatchSchedule,
  onSyncKnockoutFromGroups,
}) => {
  const [selectedDivisionState, setSelectedDivision] = useState<string>(
    tournament.divisions[0] || '',
  );
  const selectedDivision = tournament.divisions.includes(selectedDivisionState)
    ? selectedDivisionState
    : tournament.divisions[0] || '';
  const [stageFilter, setStageFilter] = useState<'all' | 'group' | 'knockout'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'live' | 'completed' | 'scheduled'>('all');
  const [genderFilter, setGenderFilter] = useState<GenderFilterType>('all');
  const [scheduleGroupFilter, setScheduleGroupFilter] = useState<string>('ALL');
  const [courtFilter, setCourtFilter] = useState<number>(0);
  const [chartGroupFilter, setChartGroupFilter] = useState<string>('ALL');
  const [chartMetricMode, setChartMetricMode] = useState<'matches' | 'points'>('matches');

  const divisionRegistrations = useMemo(
    () => (selectedDivision ? registrations.filter((r) => r.division === selectedDivision) : []),
    [registrations, selectedDivision],
  );

  const divisionMatches = useMemo(
    () =>
      (selectedDivision ? matches.filter((m) => m.division === selectedDivision) : matches)
        .slice()
        .sort((a, b) => a.matchNumber - b.matchNumber),
    [matches, selectedDivision],
  );

  // If user filters by a gender category that has 0 matches in the current single-gender division,
  // automatically search across all tournament matches so large-scale multi-division tournaments show all matching gender matches
  const schedulePoolMatches = useMemo(() => {
    if (genderFilter === 'all') return divisionMatches;
    const inDivision = divisionMatches.filter(
      (m) => getMatchGenderCategory(m) === genderFilter,
    );
    if (inDivision.length > 0) return divisionMatches;
    return [...matches].sort((a, b) => a.matchNumber - b.matchNumber);
  }, [divisionMatches, matches, genderFilter]);

  const statusCounts = useMemo(() => {
    const live = schedulePoolMatches.filter((m) => m.status === 'live').length;
    const completed = schedulePoolMatches.filter((m) => m.status === 'completed').length;
    const scheduled = schedulePoolMatches.filter((m) => m.status === 'scheduled').length;
    return {
      all: schedulePoolMatches.length,
      live,
      completed,
      scheduled,
    };
  }, [schedulePoolMatches]);

  const genderCounts = useMemo(() => {
    // Count available matches per gender (using divisionMatches or full tournament pool if division is homogeneous)
    const divMale = divisionMatches.filter((m) => getMatchGenderCategory(m) === 'male').length;
    const divFemale = divisionMatches.filter((m) => getMatchGenderCategory(m) === 'female').length;
    const divMixed = divisionMatches.filter((m) => getMatchGenderCategory(m) === 'mixed').length;

    const allMale = matches.filter((m) => getMatchGenderCategory(m) === 'male').length;
    const allFemale = matches.filter((m) => getMatchGenderCategory(m) === 'female').length;
    const allMixed = matches.filter((m) => getMatchGenderCategory(m) === 'mixed').length;

    return {
      all: divisionMatches.length,
      male: divMale > 0 ? divMale : allMale,
      female: divFemale > 0 ? divFemale : allFemale,
      mixed: divMixed > 0 ? divMixed : allMixed,
    };
  }, [divisionMatches, matches]);

  const standingsByGroup = useMemo(
    () => computeGroupStandings(registrations, matches, selectedDivision),
    [registrations, matches, selectedDivision],
  );

  const availableCourts = useMemo(() => {
    const maxCourt = Math.max(
      tournament.courtsCount || 1,
      ...schedulePoolMatches.map((m) => m.courtNumber || 0),
    );
    return Array.from({ length: maxCourt }, (_, i) => i + 1);
  }, [tournament.courtsCount, schedulePoolMatches]);

  const groupNames = useMemo(() => {
    const set = new Set<string>(Object.keys(standingsByGroup));
    divisionMatches.forEach((m) => {
      if (m.groupName) set.add(m.groupName);
    });
    return Array.from(set).sort();
  }, [standingsByGroup, divisionMatches]);

  const filteredMatches = useMemo(() => {
    return schedulePoolMatches.filter((m) => {
      if (genderFilter !== 'all' && getMatchGenderCategory(m) !== genderFilter) return false;
      if (statusFilter !== 'all' && m.status !== statusFilter) return false;
      if (stageFilter === 'group' && m.stage !== 'group') return false;
      if (stageFilter === 'knockout' && m.stage === 'group') return false;
      if (scheduleGroupFilter !== 'ALL') {
        if (scheduleGroupFilter.startsWith('STAGE:')) {
          const targetStage = scheduleGroupFilter.replace('STAGE:', '');
          if (m.stage !== targetStage) return false;
        } else if (m.groupName !== scheduleGroupFilter) {
          return false;
        }
      }
      if (courtFilter > 0 && m.courtNumber !== courtFilter) return false;
      return true;
    });
  }, [
    schedulePoolMatches,
    genderFilter,
    statusFilter,
    stageFilter,
    scheduleGroupFilter,
    courtFilter,
  ]);

  const chartData = useMemo(() => {
    const entries = Object.entries(standingsByGroup).filter(([groupName]) =>
      chartGroupFilter === 'ALL' ? true : groupName === chartGroupFilter,
    );

    return entries.flatMap(([groupName, rows]) =>
      rows.map((row) => {
        const shortName =
          row.teamName.length > 18 ? `${row.teamName.slice(0, 16)}…` : row.teamName;
        const winRate = row.played > 0 ? Math.round((row.wins / row.played) * 100) : 0;
        return {
          teamId: row.teamId,
          name: shortName,
          fullName: row.teamName,
          groupName,
          club: row.club || 'Tự do',
          Thắng: row.wins,
          Hòa: row.draws,
          Thua: row.losses,
          'Điểm BXH': row.rankPoints,
          'Điểm thắng': row.pointsFor,
          'Điểm thua': row.pointsAgainst,
          'HS Điểm': row.pointDiff,
          played: row.played,
          winRate,
        };
      }),
    );
  }, [standingsByGroup, chartGroupFilter]);

  const knockoutMatches = useMemo(
    () => divisionMatches.filter((m) => m.stage !== 'group'),
    [divisionMatches],
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Toolbar: Division Tabs + Action Buttons (Responsive auto-wrap) */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {tournament.divisions.length === 0 ? (
          <div className="text-xs text-slate-500">
            Chưa có nội dung thi đấu nào (Đôi hoặc Đồng đội). Tài khoản Admin có thể tạo nội dung ở mục Thành viên &amp; VietQR.
          </div>
        ) : (
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg overflow-x-auto">
            {tournament.divisions.map((div) => (
              <button
                key={div}
                type="button"
                onClick={() => {
                  setSelectedDivision(div);
                  setChartGroupFilter('ALL');
                  setScheduleGroupFilter('ALL');
                }}
                className={`min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  selectedDivision === div
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {div}
              </button>
            ))}
          </div>
        )}

        {isAdmin && selectedDivision && (
          <div className="grid grid-cols-1 sm:flex items-center gap-2">
            <button
              type="button"
              onClick={() => onSyncKnockoutFromGroups(selectedDivision)}
              className="min-h-[40px] px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center justify-center gap-1.5"
            >
              <Trophy className="w-3.5 h-3.5 text-orange-600 shrink-0" />
              <span>Cập nhật nhánh Knockout</span>
            </button>

            <button
              type="button"
              onClick={() => onGenerateSchedule(selectedDivision)}
              className="min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>Chia bảng & Xếp lịch ({divisionRegistrations.length} đội)</span>
            </button>
          </div>
        )}
      </div>

      {/* Real-Time Group Standings Section */}
      {mode === 'standings' && (
        <div className="space-y-5">
          {/* Recharts Win-Loss Performance Distribution Chart */}
          {groupNames.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                <div className="flex items-start gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center shrink-0 mt-0.5">
                    <BarChart3 className="w-4 h-4 text-orange-600" />
                  </div>
                  <div>
                    <h3 className="font-display text-base sm:text-lg font-bold tracking-tight text-slate-900 uppercase">
                      BIỂU ĐỒ PHÂN BỔ THẮNG - THUA & HIỆU SUẤT VÒNG BẢNG · {selectedDivision}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Trực quan hóa thành tích Thắng / Hòa / Thua và tương quan điểm số của từng đội theo thời gian thực
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Group Filter Pills */}
                  <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs">
                    <button
                      type="button"
                      onClick={() => setChartGroupFilter('ALL')}
                      className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                        chartGroupFilter === 'ALL'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Tất cả ({chartData.length})
                    </button>
                    {groupNames.map((gName) => (
                      <button
                        key={gName}
                        type="button"
                        onClick={() => setChartGroupFilter(gName)}
                        className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                          chartGroupFilter === gName
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {gName}
                      </button>
                    ))}
                  </div>

                  {/* Metric Mode Switcher */}
                  <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs">
                    <button
                      type="button"
                      onClick={() => setChartMetricMode('matches')}
                      className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                        chartMetricMode === 'matches'
                          ? 'bg-orange-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Thắng - Hòa - Thua
                    </button>
                    <button
                      type="button"
                      onClick={() => setChartMetricMode('points')}
                      className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                        chartMetricMode === 'points'
                          ? 'bg-orange-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Điểm Thắng / Điểm Thua
                    </button>
                  </div>
                </div>
              </div>

              <div className="h-72 sm:h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  {chartMetricMode === 'matches' ? (
                    <BarChart
                      data={chartData}
                      margin={{ top: 10, right: 16, left: -12, bottom: 24 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }}
                        interval={0}
                        angle={-15}
                        textAnchor="end"
                        height={48}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 11, fill: '#64748B' }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#FFFFFF',
                          borderColor: '#E2E8F0',
                          borderRadius: '10px',
                          fontSize: '12px',
                          boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
                        }}
                        formatter={(value, name) => [`${value} trận`, String(name)]}
                        labelFormatter={(label, payload) => {
                          const item = payload?.[0]?.payload;
                          if (!item) return String(label);
                          return `${item.fullName} (${item.groupName} · ${item.club}) — Tỉ lệ thắng: ${item.winRate}% · ${item['Điểm BXH']}đ`;
                        }}
                      />
                      <Legend
                        verticalAlign="top"
                        height={32}
                        iconType="circle"
                        wrapperStyle={{ fontSize: '12px', fontWeight: 600 }}
                      />
                      <Bar
                        dataKey="Thắng"
                        name="Trận Thắng (3đ)"
                        stackId="wl"
                        fill="#10B981"
                        radius={[0, 0, 0, 0]}
                        maxBarSize={44}
                      />
                      <Bar
                        dataKey="Hòa"
                        name="Trận Hòa (2đ)"
                        stackId="wl"
                        fill="#F59E0B"
                        radius={[0, 0, 0, 0]}
                        maxBarSize={44}
                      />
                      <Bar
                        dataKey="Thua"
                        name="Trận Thua (1đ)"
                        stackId="wl"
                        fill="#F43F5E"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={44}
                      />
                    </BarChart>
                  ) : (
                    <BarChart
                      data={chartData}
                      margin={{ top: 10, right: 16, left: -12, bottom: 24 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }}
                        interval={0}
                        angle={-15}
                        textAnchor="end"
                        height={48}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 11, fill: '#64748B' }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#FFFFFF',
                          borderColor: '#E2E8F0',
                          borderRadius: '10px',
                          fontSize: '12px',
                          boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
                        }}
                        formatter={(value, name) => [`${value} điểm`, String(name)]}
                        labelFormatter={(label, payload) => {
                          const item = payload?.[0]?.payload;
                          if (!item) return String(label);
                          const diff = item['HS Điểm'] > 0 ? `+${item['HS Điểm']}` : item['HS Điểm'];
                          return `${item.fullName} (${item.groupName}) — Hiệu số điểm: ${diff}`;
                        }}
                      />
                      <Legend
                        verticalAlign="top"
                        height={32}
                        iconType="circle"
                        wrapperStyle={{ fontSize: '12px', fontWeight: 600 }}
                      />
                      <Bar
                        dataKey="Điểm thắng"
                        name="Điểm Thắng Ghi Được"
                        fill="#EA580C"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={32}
                      />
                      <Bar
                        dataKey="Điểm thua"
                        name="Điểm Bị Mất"
                        fill="#94A3B8"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={32}
                      />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {Object.keys(standingsByGroup).length === 0 ? (
              <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6 text-center">
                <Users className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <h3 className="text-base font-semibold text-slate-900">
                  {selectedDivision
                    ? `Chưa có bảng đấu cho nội dung ${selectedDivision}`
                    : 'Chưa có nội dung thi đấu nào'}
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  {selectedDivision
                    ? 'Bấm nút Chia bảng & Xếp lịch ở thanh công cụ phía trên để hệ thống phân hạt giống vào các bảng và tạo lịch thi đấu vòng tròn.'
                    : 'Admin có thể tạo nội dung Đôi hoặc Đồng đội và thêm đội thi đấu ở mục Thành viên & VietQR trước khi chia bảng.'}
                </p>
              </div>
            ) : (
              Object.entries(standingsByGroup).map(([groupName, rows]) => {
                const groupChartRows = rows.map((r) => ({
                  name: r.teamName.length > 15 ? `${r.teamName.slice(0, 14)}…` : r.teamName,
                  fullName: r.teamName,
                  Thắng: r.wins,
                  Hòa: r.draws,
                  Thua: r.losses,
                  rankPoints: r.rankPoints,
                }));

                return (
                  <div
                    key={groupName}
                    className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between"
                  >
                    <div>
                      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                        <div>
                          <h3 className="font-display text-base sm:text-lg font-bold tracking-tight text-slate-900 uppercase">
                            {groupName} · {selectedDivision}
                          </h3>
                          <p className="text-[11px] text-slate-500">
                            Thắng 3đ · Hòa 2đ · Thua 1đ · Bỏ cuộc 0đ | Xét: Đối đầu (2 đội) / HS Hiệp → HS Điểm (≥3 đội)
                          </p>
                        </div>
                        <span className="text-[11px] font-semibold text-orange-600 shrink-0">
                          Top 2 vào Bán kết
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-50/50">
                              <th className="py-2.5 pl-3.5 pr-1">#</th>
                              <th className="py-2.5 px-2">Đội / CLB</th>
                              <th className="py-2.5 px-1.5 text-right">Trận</th>
                              <th className="py-2.5 px-1.5 text-right" title="Thắng - Hòa - Thua">
                                T-H-B
                              </th>
                              <th className="py-2.5 px-1.5 text-right" title="Hiệu số hiệp thắng - hiệp thua">
                                HS Hiệp
                              </th>
                              <th className="py-2.5 px-1.5 text-right" title="Hiệu số điểm thắng - điểm thua">
                                HS Điểm
                              </th>
                              <th className="py-2.5 pl-1.5 pr-3.5 text-right">Điểm</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                            {rows.map((row, idx) => (
                              <tr
                                key={row.teamId}
                                className={`transition-colors hover:bg-slate-50 ${
                                  row.qualified ? 'bg-orange-50/30' : ''
                                }`}
                              >
                                <td className="py-2.5 pl-3.5 pr-1 font-mono-num font-bold text-slate-800">
                                  {idx + 1}
                                </td>
                                <td className="py-2.5 px-2">
                                  <div className="font-semibold text-slate-900 line-clamp-1">
                                    {row.teamName}
                                  </div>
                                  <div className="text-[11px] text-slate-500 line-clamp-1">
                                    {row.club || 'Tự do'} {row.qualified ? '· Vé Knockout' : ''}
                                  </div>
                                </td>
                                <td className="py-2.5 px-1.5 text-right font-mono-num text-slate-700">
                                  {row.played}
                                </td>
                                <td className="py-2.5 px-1.5 text-right font-mono-num font-medium text-slate-900">
                                  {row.wins}-{row.draws}-{row.losses}
                                </td>
                                <td
                                  className={`py-2.5 px-1.5 text-right font-mono-num font-semibold ${
                                    row.gameDiff > 0
                                      ? 'text-emerald-600'
                                      : row.gameDiff < 0
                                      ? 'text-rose-600'
                                      : 'text-slate-600'
                                  }`}
                                >
                                  {row.gameDiff > 0 ? `+${row.gameDiff}` : row.gameDiff}
                                </td>
                                <td
                                  className={`py-2.5 px-1.5 text-right font-mono-num font-semibold ${
                                    row.pointDiff > 0
                                      ? 'text-emerald-600'
                                      : row.pointDiff < 0
                                      ? 'text-rose-600'
                                      : 'text-slate-600'
                                  }`}
                                >
                                  {row.pointDiff > 0 ? `+${row.pointDiff}` : row.pointDiff}
                                </td>
                                <td className="py-2.5 pl-1.5 pr-3.5 text-right font-mono-num font-bold text-orange-600">
                                  {row.rankPoints}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Per-group Horizontal Win-Loss Recharts Mini Distribution */}
                    <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/60">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          Phân bổ Thắng / Hòa / Thua ({groupName})
                        </span>
                        <div className="flex items-center gap-3 text-[11px] font-medium text-slate-600">
                          <span className="inline-flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            Thắng
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-amber-500" />
                            Hòa
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-rose-500" />
                            Thua
                          </span>
                        </div>
                      </div>
                      <div className="h-36 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={groupChartRows}
                            layout="vertical"
                            margin={{ top: 2, right: 12, left: 4, bottom: 2 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                            <XAxis
                              type="number"
                              allowDecimals={false}
                              tick={{ fontSize: 10, fill: '#64748B' }}
                            />
                            <YAxis
                              type="category"
                              dataKey="name"
                              width={110}
                              tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: '#FFFFFF',
                                borderColor: '#E2E8F0',
                                borderRadius: '8px',
                                fontSize: '11px',
                              }}
                              formatter={(value, name) => [`${value} trận`, String(name)]}
                            />
                            <Bar
                              dataKey="Thắng"
                              stackId="groupWl"
                              fill="#10B981"
                              barSize={14}
                            />
                            <Bar
                              dataKey="Hòa"
                              stackId="groupWl"
                              fill="#F59E0B"
                              barSize={14}
                            />
                            <Bar
                              dataKey="Thua"
                              stackId="groupWl"
                              fill="#F43F5E"
                              radius={[0, 4, 4, 0]}
                              barSize={14}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* 2D Tournament Bracket Tree from Group Stage to Grand Final */}
          <Bracket2DDiagram
            division={selectedDivision}
            standingsByGroup={standingsByGroup}
            knockoutMatches={knockoutMatches}
            isAdmin={isAdmin}
            onOpenRefereeForMatch={onOpenRefereeForMatch}
            onSyncKnockoutFromGroups={onSyncKnockoutFromGroups}
          />
        </div>
      )}

      {/* Full Schedule & Court Allocation + 2D Bracket Tree */}
      {mode === 'schedule' && (
        <div className="space-y-5">
          <Bracket2DDiagram
            division={selectedDivision}
            standingsByGroup={standingsByGroup}
            knockoutMatches={knockoutMatches}
            isAdmin={isAdmin}
            onOpenRefereeForMatch={onOpenRefereeForMatch}
            onSyncKnockoutFromGroups={onSyncKnockoutFromGroups}
          />

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200 space-y-3.5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-base sm:text-lg font-bold tracking-tight text-slate-900 uppercase">
                  {selectedDivision
                    ? `LỊCH THI ĐẤU & PHÂN BỔ SÂN · ${selectedDivision}`
                    : 'LỊCH THI ĐẤU & PHÂN BỔ SÂN'}
                </h3>
                <p className="text-xs text-slate-500">
                  Xem nhanh các trận đang diễn ra, đã hoàn thành và lọc theo từng sân hoặc nhóm bảng ({filteredMatches.length}/{divisionMatches.length} trận)
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Stage Quick Filter Tabs */}
                <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setStageFilter('all');
                      setScheduleGroupFilter('ALL');
                    }}
                    className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                      stageFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    Tất cả vòng
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStageFilter('group');
                      if (scheduleGroupFilter.startsWith('STAGE:')) {
                        setScheduleGroupFilter('ALL');
                      }
                    }}
                    className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                      stageFilter === 'group' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    Vòng bảng
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStageFilter('knockout');
                      if (
                        scheduleGroupFilter !== 'ALL' &&
                        !scheduleGroupFilter.startsWith('STAGE:')
                      ) {
                        setScheduleGroupFilter('ALL');
                      }
                    }}
                    className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                      stageFilter === 'knockout' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    Knockout
                  </button>
                </div>

                {/* Match Gender Category Dropdown Filter (Nam, Nữ, Đôi nam nữ) */}
                <select
                  aria-label="Lọc theo giới tính (Nam, Nữ, Đôi nam nữ)"
                  value={genderFilter}
                  onChange={(e) => setGenderFilter(e.target.value as GenderFilterType)}
                  className="min-h-[36px] px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200/70 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="all">Giới tính: Tất cả ({genderCounts.all} trận)</option>
                  <option value="male">Giới tính: Nam ({genderCounts.male} trận)</option>
                  <option value="female">Giới tính: Nữ ({genderCounts.female} trận)</option>
                  <option value="mixed">Giới tính: Đôi nam nữ ({genderCounts.mixed} trận)</option>
                </select>

                {/* Match Status Dropdown Filter */}
                <select
                  aria-label="Lọc theo trạng thái trận đấu"
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(
                      e.target.value as 'all' | 'live' | 'completed' | 'scheduled',
                    )
                  }
                  className="min-h-[36px] px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200/70 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="all">Tất cả trạng thái ({statusCounts.all} trận)</option>
                  <option value="scheduled">Chỉ trận chưa đấu ({statusCounts.scheduled} trận)</option>
                  <option value="live">Đang diễn ra ({statusCounts.live} trận)</option>
                  <option value="completed">Chỉ trận đã hoàn tất ({statusCounts.completed} trận)</option>
                </select>

                {/* Group / Bracket Stage Dropdown Filter */}
                <select
                  aria-label="Lọc theo nhóm bảng hoặc vòng đấu"
                  value={scheduleGroupFilter}
                  onChange={(e) => {
                    const val = e.target.value;
                    setScheduleGroupFilter(val);
                    if (val !== 'ALL') {
                      if (val.startsWith('STAGE:')) {
                        setStageFilter('knockout');
                      } else {
                        setStageFilter('group');
                      }
                    }
                  }}
                  className="min-h-[36px] px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200/70 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="ALL">Tất cả nhóm bảng ({groupNames.length} bảng)</option>
                  {groupNames.length > 0 && (
                    <optgroup label="Nhóm Bảng Vòng Bảng">
                      {groupNames.map((gName) => {
                        const count = divisionMatches.filter((m) => m.groupName === gName).length;
                        return (
                          <option key={gName} value={gName}>
                            {gName} ({count} trận)
                          </option>
                        );
                      })}
                    </optgroup>
                  )}
                  {knockoutMatches.length > 0 && (
                    <optgroup label="Vòng Loại Trực Tiếp (Knockout)">
                      {(['quarterfinal', 'semifinal', 'third_place', 'final'] as const).map(
                        (st) => {
                          const count = divisionMatches.filter((m) => m.stage === st).length;
                          if (count === 0) return null;
                          return (
                            <option key={st} value={`STAGE:${st}`}>
                              {MATCH_STAGE_LABELS[st]} ({count} trận)
                            </option>
                          );
                        },
                      )}
                    </optgroup>
                  )}
                </select>

                {/* Court Specific Dropdown Filter */}
                <select
                  aria-label="Lọc theo sân thi đấu"
                  value={courtFilter}
                  onChange={(e) => setCourtFilter(Number(e.target.value))}
                  className="min-h-[36px] px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200/70 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value={0}>Tất cả sân ({availableCourts.length} sân)</option>
                  {availableCourts.map((c) => {
                    const courtMatchCount = schedulePoolMatches.filter(
                      (m) => m.courtNumber === c,
                    ).length;
                    return (
                      <option key={c} value={c}>
                        Sân {c} ({courtMatchCount} trận)
                      </option>
                    );
                  })}
                </select>

                {/* Clear Active Filters Button */}
                {(genderFilter !== 'all' ||
                  statusFilter !== 'all' ||
                  stageFilter !== 'all' ||
                  scheduleGroupFilter !== 'ALL' ||
                  courtFilter > 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      setGenderFilter('all');
                      setStatusFilter('all');
                      setStageFilter('all');
                      setScheduleGroupFilter('ALL');
                      setCourtFilter(0);
                    }}
                    className="min-h-[36px] px-2.5 py-1 text-xs font-semibold text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg transition-colors"
                  >
                    Xóa lọc
                  </button>
                )}
              </div>
            </div>

            {/* Quick Interactive Filter Bar: Status Quick Buttons + Per-Court Buttons + Gender */}
            <div className="pt-3 border-t border-slate-200/80 space-y-2.5">
              {/* Row 1: Prominent Quick Status Filter Buttons (Chỉ trận chưa đấu / Đang đấu / Chỉ trận đã hoàn tất) */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mr-1 inline-flex items-center gap-1">
                  <Filter className="w-3 h-3 text-orange-600" />
                  Lọc nhanh:
                </span>

                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                    statusFilter === 'all'
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Tất cả ({statusCounts.all})
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setStatusFilter(statusFilter === 'scheduled' ? 'all' : 'scheduled')
                  }
                  className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold border transition-colors inline-flex items-center gap-1.5 ${
                    statusFilter === 'scheduled'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                      : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100/80'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>Chỉ trận chưa đấu ({statusCounts.scheduled})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter(statusFilter === 'live' ? 'all' : 'live')}
                  className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold border transition-colors inline-flex items-center gap-1.5 ${
                    statusFilter === 'live'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/80'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      statusFilter === 'live' ? 'bg-white' : 'bg-emerald-500 animate-pulse'
                    }`}
                  />
                  <span>Đang đấu ({statusCounts.live})</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setStatusFilter(statusFilter === 'completed' ? 'all' : 'completed')
                  }
                  className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold border transition-colors inline-flex items-center gap-1.5 ${
                    statusFilter === 'completed'
                      ? 'bg-slate-800 text-white border-slate-800 shadow-xs'
                      : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200/70'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Chỉ trận đã hoàn tất ({statusCounts.completed})</span>
                </button>
              </div>

              {/* Row 2: Per-Court Filter Buttons + Gender Filter Buttons */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
                {/* Per-Court Quick Filter Buttons */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mr-0.5 inline-flex items-center gap-1 shrink-0">
                    <MapPin className="w-3 h-3 text-orange-600" />
                    Theo sân:
                  </span>
                  <button
                    type="button"
                    onClick={() => setCourtFilter(0)}
                    className={`min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 ${
                      courtFilter === 0
                        ? 'bg-orange-600 text-white border-orange-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Tất cả sân
                  </button>
                  {availableCourts.map((c) => {
                    const courtMatches = schedulePoolMatches.filter((m) => m.courtNumber === c);
                    const hasLive = courtMatches.some((m) => m.status === 'live');
                    const completedOnCourt = courtMatches.filter(
                      (m) => m.status === 'completed',
                    ).length;
                    const isSelected = courtFilter === c;

                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCourtFilter(isSelected ? 0 : c)}
                        className={`min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-orange-600 text-white border-orange-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {hasLive && (
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isSelected ? 'bg-white' : 'bg-emerald-500'
                            }`}
                            title="Đang có trận đấu trực tiếp trên sân này"
                          />
                        )}
                        <span>Sân {c}</span>
                        <span
                          className={`font-mono-num text-[11px] ${
                            isSelected ? 'text-orange-100' : 'text-slate-400'
                          }`}
                        >
                          ({completedOnCourt}/{courtMatches.length})
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Gender Quick Filter Buttons (Tất cả / Nam / Nữ / Đôi nam nữ) */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mr-0.5">
                    Nội dung:
                  </span>
                  <button
                    type="button"
                    onClick={() => setGenderFilter('all')}
                    className={`min-h-[30px] px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                      genderFilter === 'all'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Tất cả ({genderCounts.all})
                  </button>

                  <button
                    type="button"
                    onClick={() => setGenderFilter(genderFilter === 'male' ? 'all' : 'male')}
                    className={`min-h-[30px] px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                      genderFilter === 'male'
                        ? 'bg-sky-600 text-white border-sky-600'
                        : 'bg-sky-50/70 text-sky-700 border-sky-200 hover:bg-sky-100/70'
                    }`}
                  >
                    Nam ({genderCounts.male})
                  </button>

                  <button
                    type="button"
                    onClick={() => setGenderFilter(genderFilter === 'female' ? 'all' : 'female')}
                    className={`min-h-[30px] px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                      genderFilter === 'female'
                        ? 'bg-rose-600 text-white border-rose-600'
                        : 'bg-rose-50/70 text-rose-700 border-rose-200 hover:bg-rose-100/70'
                    }`}
                  >
                    Nữ ({genderCounts.female})
                  </button>

                  <button
                    type="button"
                    onClick={() => setGenderFilter(genderFilter === 'mixed' ? 'all' : 'mixed')}
                    className={`min-h-[30px] px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                      genderFilter === 'mixed'
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-purple-50/70 text-purple-700 border-purple-200 hover:bg-purple-100/70'
                    }`}
                  >
                    Đôi nam nữ ({genderCounts.mixed})
                  </button>
                </div>
              </div>
            </div>
          </div>

          {filteredMatches.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <Calendar className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-sm text-slate-600">
                Không có trận đấu nào khớp bộ lọc hiện tại.
              </p>
              {(genderFilter !== 'all' ||
                statusFilter !== 'all' ||
                stageFilter !== 'all' ||
                scheduleGroupFilter !== 'ALL' ||
                courtFilter > 0) && (
                <button
                  type="button"
                  onClick={() => {
                    setGenderFilter('all');
                    setStatusFilter('all');
                    setStageFilter('all');
                    setScheduleGroupFilter('ALL');
                    setCourtFilter(0);
                  }}
                  className="px-3.5 py-1.5 text-xs font-semibold text-orange-600 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg transition-colors"
                >
                  Xem tất cả trận đấu
                </button>
              )}
            </div>
          ) : (
            <>
              {/* MOBILE CARDS VIEW (Automatically shown on smartphones < 768px) */}
              <div className="md:hidden divide-y divide-slate-200">
                {filteredMatches.map((m) => {
                  const genderCat = getMatchGenderCategory(m);
                  const genderBadgeClass =
                    genderCat === 'male'
                      ? 'bg-sky-50 text-sky-700 border-sky-200'
                      : genderCat === 'female'
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-purple-50 text-purple-700 border-purple-200';

                  return (
                  <div key={m.id} className="p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex flex-wrap items-center gap-1.5 text-slate-600">
                        <span className="font-mono-num font-bold text-slate-900">
                          Trận #{m.matchNumber}
                        </span>
                        <span>·</span>
                        <span>{m.groupName || MATCH_STAGE_LABELS[m.stage]}</span>
                        <span
                          className={`px-1.5 py-0.5 text-[10px] font-bold rounded border ${genderBadgeClass}`}
                        >
                          {GENDER_FILTER_LABELS[genderCat]}
                        </span>
                        {m.teamSubCategory && (
                          <>
                            <span>·</span>
                            <span className="text-orange-600 font-semibold">{m.teamSubCategory}</span>
                          </>
                        )}
                      </div>
                      <span
                        className={`font-semibold ${
                          m.status === 'live'
                            ? 'text-emerald-600'
                            : m.status === 'completed'
                            ? 'text-slate-500'
                            : 'text-amber-600'
                        }`}
                      >
                        {MATCH_STATUS_LABELS[m.status]}
                      </span>
                    </div>

                    <div className="grid grid-cols-12 items-center gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                      <div className="col-span-5 min-w-0">
                        <div className="text-sm font-bold text-slate-900 truncate">
                          {m.teamAName}
                        </div>
                        {(m.teamAPlayer1 || m.teamAPlayer2) && (
                          <div className="text-[11px] text-slate-500 truncate">
                            {m.teamAPlayer1} / {m.teamAPlayer2}
                          </div>
                        )}
                      </div>
                      <div className="col-span-2 text-center font-mono-num text-lg font-extrabold text-slate-900">
                        {m.scoreA}:{m.scoreB}
                      </div>
                      <div className="col-span-5 text-right min-w-0">
                        <div className="text-sm font-bold text-slate-900 truncate">
                          {m.teamBName}
                        </div>
                        {(m.teamBPlayer1 || m.teamBPlayer2) && (
                          <div className="text-[11px] text-slate-500 truncate">
                            {m.teamBPlayer1} / {m.teamBPlayer2}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      {isAdmin ? (
                        <div className="flex items-center gap-1.5">
                          <select
                            value={m.courtNumber}
                            onChange={(e) =>
                              onUpdateMatchSchedule(m.id, Number(e.target.value), m.scheduledTime)
                            }
                            className="min-h-[38px] px-2.5 py-1 text-xs font-semibold border border-slate-300 rounded-lg bg-white"
                          >
                            {Array.from({ length: tournament.courtsCount }, (_, i) => i + 1).map(
                              (c) => (
                                <option key={c} value={c}>
                                  Sân {c}
                                </option>
                              ),
                            )}
                          </select>
                          <input
                            type="time"
                            value={m.scheduledTime}
                            onChange={(e) =>
                              onUpdateMatchSchedule(m.id, m.courtNumber, e.target.value)
                            }
                            className="min-h-[38px] px-2.5 py-1 text-xs font-mono-num border border-slate-300 rounded-lg bg-white"
                          />
                        </div>
                      ) : (
                        <div className="text-xs text-slate-600">
                          Sân {m.courtNumber} · <span className="font-mono-num">{m.scheduledTime}</span>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => onOpenRefereeForMatch(m.id)}
                        className="min-h-[40px] px-3.5 py-2 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-xl inline-flex items-center gap-1.5"
                      >
                        <Gavel className="w-3.5 h-3.5" />
                        Chấm điểm
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>

              {/* DESKTOP TABLE VIEW (>= 768px) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-50">
                      <th className="py-3 pl-5 pr-2">Mã</th>
                      <th className="py-3 px-2">Vòng / Nội Dung & Giới Tính</th>
                      <th className="py-3 px-2">Sân & Giờ</th>
                      <th className="py-3 px-3">Đội A & VĐV</th>
                      <th className="py-3 px-2 text-center">Tỉ Số</th>
                      <th className="py-3 px-3">Đội B & VĐV</th>
                      <th className="py-3 px-2">Trạng Thái</th>
                      <th className="py-3 pl-2 pr-5 text-right">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredMatches.map((m) => {
                      const genderCat = getMatchGenderCategory(m);
                      const genderBadgeClass =
                        genderCat === 'male'
                          ? 'bg-sky-50 text-sky-700 border-sky-200'
                          : genderCat === 'female'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-purple-50 text-purple-700 border-purple-200';

                      return (
                      <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 pl-5 pr-2 font-mono-num font-bold text-slate-800">
                          #{m.matchNumber}
                        </td>
                        <td className="py-3 px-2 text-xs text-slate-600">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-800">
                              {m.groupName || MATCH_STAGE_LABELS[m.stage]}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 text-[10px] font-bold rounded border ${genderBadgeClass}`}
                            >
                              {GENDER_FILTER_LABELS[genderCat]}
                            </span>
                          </div>
                          <div>{m.teamSubCategory || MATCH_STAGE_LABELS[m.stage]}</div>
                        </td>
                        <td className="py-3 px-2">
                          {isAdmin ? (
                            <div className="flex items-center gap-1.5">
                              <select
                                value={m.courtNumber}
                                onChange={(e) =>
                                  onUpdateMatchSchedule(m.id, Number(e.target.value), m.scheduledTime)
                                }
                                className="px-2 py-1 text-xs font-medium border border-slate-200 rounded-md bg-white"
                              >
                                {Array.from({ length: tournament.courtsCount }, (_, i) => i + 1).map(
                                  (c) => (
                                    <option key={c} value={c}>
                                      Sân {c}
                                    </option>
                                  ),
                                )}
                              </select>
                              <input
                                type="time"
                                value={m.scheduledTime}
                                onChange={(e) =>
                                  onUpdateMatchSchedule(m.id, m.courtNumber, e.target.value)
                                }
                                className="px-2 py-1 text-xs font-mono-num border border-slate-200 rounded-md bg-white"
                              />
                            </div>
                          ) : (
                            <div className="text-xs text-slate-700">
                              <span className="font-semibold">Sân {m.courtNumber}</span> ·{' '}
                              <span className="font-mono-num">{m.scheduledTime}</span>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <div
                            className={
                              m.winnerSide === 'A' ? 'font-bold text-slate-900' : 'text-slate-700'
                            }
                          >
                            {m.teamAName}
                          </div>
                          {(m.teamAPlayer1 || m.teamAPlayer2) && (
                            <div className="text-xs text-slate-500">
                              {m.teamAPlayer1} · {m.teamAPlayer2}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-2 text-center">
                          <div className="font-mono-num font-bold text-slate-900">
                            {m.scoreA} - {m.scoreB}
                          </div>
                          {m.status === 'live' && (
                            <div className="font-mono-num text-[11px] text-orange-600 font-semibold">
                              Hô: {formatScoreCallout(m)}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <div
                            className={
                              m.winnerSide === 'B' ? 'font-bold text-slate-900' : 'text-slate-700'
                            }
                          >
                            {m.teamBName}
                          </div>
                          {(m.teamBPlayer1 || m.teamBPlayer2) && (
                            <div className="text-xs text-slate-500">
                              {m.teamBPlayer1} · {m.teamBPlayer2}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-2">
                          <span
                            className={`text-xs font-semibold ${
                              m.status === 'live'
                                ? 'text-emerald-600'
                                : m.status === 'completed'
                                ? 'text-slate-500'
                                : 'text-amber-600'
                            }`}
                          >
                            {MATCH_STATUS_LABELS[m.status]}
                          </span>
                        </td>
                        <td className="py-3 pl-2 pr-5 text-right">
                          <button
                            type="button"
                            onClick={() => onOpenRefereeForMatch(m.id)}
                            className="px-3 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-orange-600 hover:text-white rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
                          >
                            <Gavel className="w-3.5 h-3.5" />
                            Chấm điểm
                          </button>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
          </div>
        </div>
      )}
    </div>
  );
};
