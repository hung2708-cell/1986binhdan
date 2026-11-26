import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Award,
  Download,
  FileSpreadsheet,
  Printer,
  Trophy,
} from 'lucide-react';
import {
  BRAND_LOGO_URL,
  FORMAT_LABELS,
  MATCH_STAGE_LABELS,
  PAYMENT_STATUS_LABELS,
  type Match,
  type Registration,
  type Tournament,
} from '../types/tournament';
import {
  exportMatchesCsv,
  exportRegistrationsAndFeesCsv,
  exportStandingsCsv,
} from '../utils/exportReports';
import { computeGroupStandings, isTeamDivision } from '../utils/pickleballEngine';
import { formatVND } from '../utils/vietqr';
import { MatchDensityD3Chart } from './MatchDensityD3Chart';

interface AnalyticsReportViewProps {
  tournament: Tournament;
  registrations: Registration[];
  matches: Match[];
}

export const AnalyticsReportView: React.FC<AnalyticsReportViewProps> = ({
  tournament,
  registrations,
  matches,
}) => {
  const [contentMode, setContentMode] = useState<'all' | 'doubles' | 'team'>('all');

  const filteredMatches = useMemo(() => {
    if (contentMode === 'all') return matches;
    return matches.filter((m) =>
      contentMode === 'team'
        ? m.competitionType === 'team' || isTeamDivision(m.division || '')
        : m.competitionType !== 'team' && !isTeamDivision(m.division || ''),
    );
  }, [matches, contentMode]);

  const filteredRegistrations = useMemo(() => {
    if (contentMode === 'all') return registrations;
    return registrations.filter((r) =>
      contentMode === 'team' ? isTeamDivision(r.division, 'team') : !isTeamDivision(r.division, 'doubles'),
    );
  }, [registrations, contentMode]);

  const standingsByGroup = useMemo(
    () => computeGroupStandings(filteredRegistrations, filteredMatches),
    [filteredRegistrations, filteredMatches],
  );

  const stats = useMemo(() => {
    const completed = filteredMatches.filter((m) => m.status === 'completed');
    const live = filteredMatches.filter((m) => m.status === 'live');
    const totalPoints = completed.reduce((acc, m) => acc + m.scoreA + m.scoreB, 0);
    const avgDurationMin =
      completed.length > 0
        ? Math.round(
            completed.reduce((acc, m) => acc + (m.durationSeconds || 900), 0) /
              completed.length /
              60,
          )
        : 18;

    const paidAmount = filteredRegistrations
      .filter((r) => r.paymentStatus === 'paid')
      .reduce((acc, r) => acc + r.feeAmount, 0);
    const expectedAmount = filteredRegistrations.reduce((acc, r) => acc + r.feeAmount, 0);

    const courtData = Array.from({ length: tournament.courtsCount }, (_, idx) => {
      const courtNo = idx + 1;
      const courtMatches = filteredMatches.filter((m) => m.courtNumber === courtNo);
      const courtCompleted = courtMatches.filter((m) => m.status === 'completed').length;
      const courtPoints = courtMatches.reduce((acc, m) => acc + m.scoreA + m.scoreB, 0);
      return {
        name: `Sân ${courtNo}`,
        soTran: courtMatches.length,
        hoanTat: courtCompleted,
        tongDiem: courtPoints,
      };
    });

    const allRows = Object.values(standingsByGroup).flat();
    const topTeams = [...allRows]
      .sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (b.pointDiff !== a.pointDiff) return b.pointDiff - a.pointDiff;
        return b.pointsFor - a.pointsFor;
      })
      .slice(0, 6);

    return {
      completedCount: completed.length,
      liveCount: live.length,
      totalMatches: filteredMatches.length,
      totalPoints,
      avgDurationMin,
      paidAmount,
      expectedAmount,
      courtData,
      topTeams,
    };
  }, [filteredMatches, filteredRegistrations, standingsByGroup, tournament.courtsCount]);

  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <div className="space-y-6 text-slate-100">
      {/* Export Control Bar */}
      <div className="no-print bg-slate-950 border border-slate-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <h2 className="font-display text-xl font-bold tracking-tight text-white uppercase">
            BÁO CÁO CHUYÊN SÂU & XUẤT DỮ LIỆU SAU GIẢI ĐẤU
          </h2>
          <div className="inline-flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => setContentMode('all')}
              className={`px-2.5 py-1 rounded-md font-bold transition-colors ${
                contentMode === 'all' ? 'bg-slate-800 text-white border border-orange-500' : 'text-slate-400 hover:text-white'
              }`}
            >
              Tất cả
            </button>
            <button
              type="button"
              onClick={() => setContentMode('doubles')}
              className={`px-2.5 py-1 rounded-md font-bold transition-colors ${
                contentMode === 'doubles' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Đôi
            </button>
            <button
              type="button"
              onClick={() => setContentMode('team')}
              className={`px-2.5 py-1 rounded-md font-bold transition-colors ${
                contentMode === 'team' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Đồng đội
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handlePrintPdf}
            className="px-4 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-500 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Printer className="w-4 h-4" />
            In Báo Cáo Tổng Kết (PDF A4)
          </button>

          <button
            type="button"
            onClick={() => exportMatchesCsv(tournament, filteredMatches)}
            className="px-3.5 py-2 text-xs font-semibold text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            Xuất CSV Kết Quả Trận
          </button>

          <button
            type="button"
            onClick={() => exportStandingsCsv(tournament, standingsByGroup)}
            className="px-3.5 py-2 text-xs font-semibold text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-orange-400" />
            Xuất CSV Bảng Xếp Hạng
          </button>

          <button
            type="button"
            onClick={() => exportRegistrationsAndFeesCsv(tournament, filteredRegistrations)}
            className="px-3.5 py-2 text-xs font-semibold text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-slate-300" />
            Xuất CSV Lệ Phí & VĐV
          </button>
        </div>
      </div>

      {/* Printable Official Report Sheet */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-800">
          <div className="flex items-center gap-4">
            <img
              src={BRAND_LOGO_URL}
              alt="1986 Bính Dần Pickleball"
              referrerPolicy="no-referrer"
              className="w-16 h-16 rounded-xl object-cover border border-orange-500/50"
            />
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-orange-400">
                HỆ THỐNG QUẢN LÝ & TRỌNG TÀI PICKLEBALL 1986 — BÁO CÁO TỔNG KẾT GIẢI
              </div>
              <h1 className="font-display text-2xl font-extrabold tracking-tight text-white mt-0.5">
                {tournament.name}
              </h1>
              <div className="text-xs text-slate-400 mt-1">
                Địa điểm: {tournament.location} · Thời gian: {tournament.startDate} đến {tournament.endDate} · Thể thức: {FORMAT_LABELS[tournament.format]}
              </div>
            </div>
          </div>

          <div className="text-right font-mono-num text-xs text-slate-400">
            <div>Mã giải: {tournament.id}</div>
            <div>Quy mô: {tournament.courtsCount} sân · Chạm {tournament.pointsToWin} điểm</div>
            <div>Ngày trích xuất: {new Date().toLocaleDateString('vi-VN')}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 print-break-inside-avoid">
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-xs text-slate-400">Tiến độ trận đấu</div>
            <div className="mt-1 font-mono-num text-2xl font-bold text-white">
              {stats.completedCount}/{stats.totalMatches} trận
            </div>
            <div className="mt-0.5 text-xs text-slate-400">
              Đang đấu trực tiếp: {stats.liveCount} trận
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-xs text-slate-400">Tổng điểm ghi nhận</div>
            <div className="mt-1 font-mono-num text-2xl font-bold text-orange-400">
              {stats.totalPoints} điểm
            </div>
            <div className="mt-0.5 text-xs text-slate-400">
              Thời lượng TB: {stats.avgDurationMin} phút / trận
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-xs text-slate-400">Vận động viên tham dự</div>
            <div className="mt-1 font-mono-num text-2xl font-bold text-white">
              {filteredRegistrations.length * 2} VĐV ({filteredRegistrations.length} cặp)
            </div>
            <div className="mt-0.5 text-xs text-slate-400">
              {tournament.divisions.length} nội dung thi đấu
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-xs text-slate-400">Đối soát thu phí VietQR</div>
            <div className="mt-1 font-mono-num text-2xl font-bold text-emerald-400">
              {formatVND(stats.paidAmount)}
            </div>
            <div className="mt-0.5 text-xs text-slate-400">
              Trên tổng dự kiến {formatVND(stats.expectedAmount)}
            </div>
          </div>
        </div>

        <MatchDensityD3Chart matches={filteredMatches} courtsCount={tournament.courtsCount} />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 print-break-inside-avoid">
          <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h3 className="font-display text-base font-bold text-white uppercase mb-1">
              THỐNG KÊ TẢI TRỌNG SÂN & ĐIỂM SỐ THEO SÂN
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Số lượng trận được phân bổ và tổng điểm ghi nhận trên từng sân đấu
            </p>
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.courtData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#CBD5E1' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#94A3B8' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      borderColor: '#334155',
                      color: '#F8FAFC',
                    }}
                  />
                  <Bar dataKey="soTran" name="Tổng số trận" fill="#EA580C" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="hoanTat" name="Đã hoàn tất" fill="#16A34A" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-display text-base font-bold text-white uppercase">
                  BẢNG VÀNG HIỆU SUẤT CẶP VĐV XUẤT SẮC NHẤT
                </h3>
                <p className="text-xs text-slate-400">
                  Xếp hạng theo thành tích trận thắng và hiệu số điểm
                </p>
              </div>
              <Award className="w-5 h-5 text-orange-400" />
            </div>

            <div className="divide-y divide-slate-800 text-sm">
              {stats.topTeams.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Chưa có đội hoặc dữ liệu xếp hạng trong giải đấu này.
                </div>
              ) : (
                stats.topTeams.map((team, idx) => (
                  <div
                    key={team.teamId}
                    className="py-2.5 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono-num text-sm font-bold text-orange-400 w-5">
                        #{idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="font-semibold text-white truncate">
                          {team.teamName}
                        </div>
                        <div className="text-xs text-slate-400 truncate">
                          {team.club} · {team.division} ({team.groupName})
                        </div>
                      </div>
                    </div>

                    <div className="text-right font-mono-num shrink-0">
                      <div className="text-xs font-bold text-white">
                        {team.wins}T - {team.losses}B ({team.rankPoints} đ)
                      </div>
                      <div className="text-xs text-emerald-400">
                        Hiệu số: {team.pointDiff > 0 ? `+${team.pointDiff}` : team.pointDiff} ({team.pointsFor}:{team.pointsAgainst})
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="print-break-inside-avoid">
          <h3 className="font-display text-base font-bold text-white uppercase mb-3 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-orange-400" />
            BIÊN BẢN TỔNG HỢP KẾT QUẢ CÁC TRẬN ĐẤU
          </h3>
          <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-900">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950 font-semibold uppercase text-slate-400">
                  <th className="py-2.5 pl-4 pr-2">Trận</th>
                  <th className="py-2.5 px-2">Nội Dung / Vòng</th>
                  <th className="py-2.5 px-2">Sân & Giờ</th>
                  <th className="py-2.5 px-2">Cặp Đấu A</th>
                  <th className="py-2.5 px-2 text-center">Kết Quả</th>
                  <th className="py-2.5 px-2">Cặp Đấu B</th>
                  <th className="py-2.5 pl-2 pr-4">Trọng Tài</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredMatches.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 px-4 text-center text-xs text-slate-400">
                      Chưa có trận đấu nào được tạo.
                    </td>
                  </tr>
                ) : (
                  filteredMatches.map((m) => (
                    <tr key={m.id}>
                      <td className="py-2 pl-4 pr-2 font-mono-num font-bold text-slate-200">
                        #{m.matchNumber}
                      </td>
                      <td className="py-2 px-2 text-slate-400">
                        {m.division} · {m.groupName || MATCH_STAGE_LABELS[m.stage]}
                      </td>
                      <td className="py-2 px-2 font-mono-num text-slate-400">
                        Sân {m.courtNumber} ({m.scheduledTime})
                      </td>
                      <td className={`py-2 px-2 ${m.winnerSide === 'A' ? 'font-bold text-white' : 'text-slate-300'}`}>
                        {m.teamAName}
                      </td>
                      <td className="py-2 px-2 text-center font-mono-num font-bold text-white">
                        {m.scoreA} - {m.scoreB}
                      </td>
                      <td className={`py-2 px-2 ${m.winnerSide === 'B' ? 'font-bold text-white' : 'text-slate-300'}`}>
                        {m.teamBName}
                      </td>
                      <td className="py-2 pl-2 pr-4 text-slate-400">
                        {m.refereeName || 'BTC 1986'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="print-break-inside-avoid">
          <h3 className="font-display text-base font-bold text-white uppercase mb-3">
            BẢNG ĐỐI SOÁT THU PHÍ THAM GIA GIẢI (VIETQR)
          </h3>
          <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-900">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950 font-semibold uppercase text-slate-400">
                  <th className="py-2.5 pl-4 pr-2">Mã QR</th>
                  <th className="py-2.5 px-2">Đội / Cặp VĐV</th>
                  <th className="py-2.5 px-2">Câu Lạc Bộ</th>
                  <th className="py-2.5 px-2">Nội Dung</th>
                  <th className="py-2.5 px-2 text-right">Số Tiền</th>
                  <th className="py-2.5 px-2">Trạng Thái</th>
                  <th className="py-2.5 pl-2 pr-4">Mã Giao Dịch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredRegistrations.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 px-4 text-center text-xs text-slate-400">
                      Chưa có đội hoặc VĐV nào đăng ký.
                    </td>
                  </tr>
                ) : (
                  filteredRegistrations.map((r) => (
                    <tr key={r.id}>
                      <td className="py-2 pl-4 pr-2 font-mono-num font-bold text-slate-200">
                        {r.paymentCode}
                      </td>
                      <td className="py-2 px-2 font-semibold text-white">{r.teamName}</td>
                      <td className="py-2 px-2 text-slate-400">{r.club}</td>
                      <td className="py-2 px-2 text-slate-400">{r.division}</td>
                      <td className="py-2 px-2 text-right font-mono-num font-semibold text-white">
                        {formatVND(r.feeAmount)}
                      </td>
                      <td className="py-2 px-2 text-slate-300">
                        {PAYMENT_STATUS_LABELS[r.paymentStatus]}
                      </td>
                      <td className="py-2 pl-2 pr-4 font-mono-num text-slate-500">
                        {r.transferRef || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
