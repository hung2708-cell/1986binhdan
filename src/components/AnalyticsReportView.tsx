import React, { useMemo } from 'react';
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
import { computeGroupStandings } from '../utils/pickleballEngine';
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
  const standingsByGroup = useMemo(
    () => computeGroupStandings(registrations, matches),
    [registrations, matches],
  );

  const stats = useMemo(() => {
    const completed = matches.filter((m) => m.status === 'completed');
    const live = matches.filter((m) => m.status === 'live');
    const totalPoints = completed.reduce((acc, m) => acc + m.scoreA + m.scoreB, 0);
    const avgDurationMin =
      completed.length > 0
        ? Math.round(
            completed.reduce((acc, m) => acc + (m.durationSeconds || 900), 0) /
              completed.length /
              60,
          )
        : 18;

    const paidAmount = registrations
      .filter((r) => r.paymentStatus === 'paid')
      .reduce((acc, r) => acc + r.feeAmount, 0);
    const expectedAmount = registrations.reduce((acc, r) => acc + r.feeAmount, 0);

    // Court utilization breakdown
    const courtData = Array.from({ length: tournament.courtsCount }, (_, idx) => {
      const courtNo = idx + 1;
      const courtMatches = matches.filter((m) => m.courtNumber === courtNo);
      const courtCompleted = courtMatches.filter((m) => m.status === 'completed').length;
      const courtPoints = courtMatches.reduce((acc, m) => acc + m.scoreA + m.scoreB, 0);
      return {
        name: `Sân ${courtNo}`,
        soTran: courtMatches.length,
        hoanTat: courtCompleted,
        tongDiem: courtPoints,
      };
    });

    // Top scoring teams across all standings
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
      totalMatches: matches.length,
      totalPoints,
      avgDurationMin,
      paidAmount,
      expectedAmount,
      courtData,
      topTeams,
    };
  }, [matches, registrations, standingsByGroup, tournament.courtsCount]);

  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Export Control Bar (Hidden when printing PDF) */}
      <div className="no-print bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight text-slate-900 uppercase">
            BÁO CÁO CHUYÊN SÂU & XUẤT DỮ LIỆU SAU GIẢI ĐẤU
          </h2>
          <p className="text-xs text-slate-500">
            Hỗ trợ xuất báo cáo chuẩn in A4 PDF kèm biểu trưng 1986 Bính Dần và bộ 3 file CSV/Excel tiếng Việt
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handlePrintPdf}
            className="px-4 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Printer className="w-4 h-4" />
            In Báo Cáo Tổng Kết (PDF A4)
          </button>

          <button
            type="button"
            onClick={() => exportMatchesCsv(tournament, matches)}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            Xuất CSV Kết Quả Trận
          </button>

          <button
            type="button"
            onClick={() => exportStandingsCsv(tournament, standingsByGroup)}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-orange-600" />
            Xuất CSV Bảng Xếp Hạng
          </button>

          <button
            type="button"
            onClick={() => exportRegistrationsAndFeesCsv(tournament, registrations)}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-slate-700" />
            Xuất CSV Lệ Phí & VĐV
          </button>
        </div>
      </div>

      {/* Printable Official Report Sheet */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
        {/* Official Report Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-200">
          <div className="flex items-center gap-4">
            <img
              src={BRAND_LOGO_URL}
              alt="1986 Bính Dần Pickleball"
              referrerPolicy="no-referrer"
              className="w-16 h-16 rounded-xl object-cover border border-orange-200"
            />
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-orange-600">
                HỆ THỐNG QUẢN LÝ & TRỌNG TÀI PICKLEBALL 1986 — BÁO CÁO TỔNG KẾT GIẢI
              </div>
              <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900 mt-0.5">
                {tournament.name}
              </h1>
              <div className="text-xs text-slate-600 mt-1">
                Địa điểm: {tournament.location} · Thời gian: {tournament.startDate} đến {tournament.endDate} · Thể thức: {FORMAT_LABELS[tournament.format]}
              </div>
            </div>
          </div>

          <div className="text-right font-mono-num text-xs text-slate-500">
            <div>Mã giải: {tournament.id}</div>
            <div>Quy mô: {tournament.courtsCount} sân · Chạm {tournament.pointsToWin} điểm</div>
            <div>Ngày trích xuất: {new Date().toLocaleDateString('vi-VN')}</div>
          </div>
        </div>

        {/* 4 Key Tournament KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 print-break-inside-avoid">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-xs text-slate-500">Tiến độ trận đấu</div>
            <div className="mt-1 font-mono-num text-2xl font-bold text-slate-900">
              {stats.completedCount}/{stats.totalMatches} trận
            </div>
            <div className="mt-0.5 text-xs text-slate-500">
              Đang đấu trực tiếp: {stats.liveCount} trận
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-xs text-slate-500">Tổng điểm ghi nhận</div>
            <div className="mt-1 font-mono-num text-2xl font-bold text-orange-600">
              {stats.totalPoints} điểm
            </div>
            <div className="mt-0.5 text-xs text-slate-500">
              Thời lượng TB: {stats.avgDurationMin} phút / trận
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-xs text-slate-500">Vận động viên tham dự</div>
            <div className="mt-1 font-mono-num text-2xl font-bold text-slate-900">
              {registrations.length * 2} VĐV ({registrations.length} cặp)
            </div>
            <div className="mt-0.5 text-xs text-slate-500">
              {tournament.divisions.length} nội dung thi đấu
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-xs text-slate-500">Đối soát thu phí VietQR</div>
            <div className="mt-1 font-mono-num text-2xl font-bold text-emerald-600">
              {formatVND(stats.paidAmount)}
            </div>
            <div className="mt-0.5 text-xs text-slate-500">
              Trên tổng dự kiến {formatVND(stats.expectedAmount)}
            </div>
          </div>
        </div>

        {/* D3 Time-of-Day Match Density & Court Load Chart */}
        <MatchDensityD3Chart matches={matches} courtsCount={tournament.courtsCount} />

        {/* Analytics Charts & Top Performers */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 print-break-inside-avoid">
          {/* Court Utilization Chart */}
          <div className="lg:col-span-6 border border-slate-200 rounded-xl p-4">
            <h3 className="font-display text-base font-bold text-slate-900 uppercase mb-1">
              THỐNG KÊ TẢI TRỌNG SÂN & ĐIỂM SỐ THEO SÂN
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Số lượng trận được phân bổ và tổng điểm ghi nhận trên từng sân đấu
            </p>
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.courtData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#475569' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#475569' }} />
                  <Tooltip />
                  <Bar dataKey="soTran" name="Tổng số trận" fill="#EA580C" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="hoanTat" name="Đã hoàn tất" fill="#16A34A" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Leaderboard Honors */}
          <div className="lg:col-span-6 border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-display text-base font-bold text-slate-900 uppercase">
                  BẢNG VÀNG HIỆU SUẤT CẶP VĐV XUẤT SẮC NHẤT
                </h3>
                <p className="text-xs text-slate-500">
                  Xếp hạng theo thành tích trận thắng và hiệu số điểm
                </p>
              </div>
              <Award className="w-5 h-5 text-orange-600" />
            </div>

            <div className="divide-y divide-slate-100 text-sm">
              {stats.topTeams.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  Chưa có đội hoặc dữ liệu xếp hạng trong giải đấu này.
                </div>
              ) : (
                stats.topTeams.map((team, idx) => (
                  <div
                    key={team.teamId}
                    className="py-2.5 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono-num text-sm font-bold text-orange-600 w-5">
                        #{idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 truncate">
                          {team.teamName}
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                          {team.club} · {team.division} ({team.groupName})
                        </div>
                      </div>
                    </div>

                    <div className="text-right font-mono-num shrink-0">
                      <div className="text-xs font-bold text-slate-900">
                        {team.wins}T - {team.losses}B ({team.rankPoints} đ)
                      </div>
                      <div className="text-xs text-emerald-600">
                        Hiệu số: {team.pointDiff > 0 ? `+${team.pointDiff}` : team.pointDiff} ({team.pointsFor}:{team.pointsAgainst})
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Full Match Results Table for Official Archiving */}
        <div className="print-break-inside-avoid">
          <h3 className="font-display text-base font-bold text-slate-900 uppercase mb-3 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-orange-600" />
            BIÊN BẢN TỔNG HỢP KẾT QUẢ CÁC TRẬN ĐẤU
          </h3>
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 font-semibold uppercase text-slate-500">
                  <th className="py-2.5 pl-4 pr-2">Trận</th>
                  <th className="py-2.5 px-2">Nội Dung / Vòng</th>
                  <th className="py-2.5 px-2">Sân & Giờ</th>
                  <th className="py-2.5 px-2">Cặp Đấu A</th>
                  <th className="py-2.5 px-2 text-center">Kết Quả</th>
                  <th className="py-2.5 px-2">Cặp Đấu B</th>
                  <th className="py-2.5 pl-2 pr-4">Trọng Tài</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {matches.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 px-4 text-center text-xs text-slate-500">
                      Chưa có trận đấu nào được tạo.
                    </td>
                  </tr>
                ) : (
                  matches.map((m) => (
                    <tr key={m.id}>
                      <td className="py-2 pl-4 pr-2 font-mono-num font-bold text-slate-800">
                        #{m.matchNumber}
                      </td>
                      <td className="py-2 px-2 text-slate-600">
                        {m.division} · {m.groupName || MATCH_STAGE_LABELS[m.stage]}
                      </td>
                      <td className="py-2 px-2 font-mono-num text-slate-600">
                        Sân {m.courtNumber} ({m.scheduledTime})
                      </td>
                      <td className={`py-2 px-2 ${m.winnerSide === 'A' ? 'font-bold text-slate-900' : 'text-slate-700'}`}>
                        {m.teamAName}
                      </td>
                      <td className="py-2 px-2 text-center font-mono-num font-bold text-slate-900">
                        {m.scoreA} - {m.scoreB}
                      </td>
                      <td className={`py-2 px-2 ${m.winnerSide === 'B' ? 'font-bold text-slate-900' : 'text-slate-700'}`}>
                        {m.teamBName}
                      </td>
                      <td className="py-2 pl-2 pr-4 text-slate-600">
                        {m.refereeName || 'BTC 1986'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Fee Reconciliation Summary Table */}
        <div className="print-break-inside-avoid">
          <h3 className="font-display text-base font-bold text-slate-900 uppercase mb-3">
            BẢNG ĐỐI SOÁT THU PHÍ THAM GIA GIẢI (VIETQR)
          </h3>
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 font-semibold uppercase text-slate-500">
                  <th className="py-2.5 pl-4 pr-2">Mã QR</th>
                  <th className="py-2.5 px-2">Đội / Cặp VĐV</th>
                  <th className="py-2.5 px-2">Câu Lạc Bộ</th>
                  <th className="py-2.5 px-2">Nội Dung</th>
                  <th className="py-2.5 px-2 text-right">Số Tiền</th>
                  <th className="py-2.5 px-2">Trạng Thái</th>
                  <th className="py-2.5 pl-2 pr-4">Mã Giao Dịch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {registrations.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 px-4 text-center text-xs text-slate-500">
                      Chưa có đội hoặc VĐV nào đăng ký.
                    </td>
                  </tr>
                ) : (
                  registrations.map((r) => (
                    <tr key={r.id}>
                      <td className="py-2 pl-4 pr-2 font-mono-num font-bold text-slate-800">
                        {r.paymentCode}
                      </td>
                      <td className="py-2 px-2 font-semibold text-slate-900">{r.teamName}</td>
                      <td className="py-2 px-2 text-slate-600">{r.club}</td>
                      <td className="py-2 px-2 text-slate-600">{r.division}</td>
                      <td className="py-2 px-2 text-right font-mono-num font-semibold text-slate-900">
                        {formatVND(r.feeAmount)}
                      </td>
                      <td className="py-2 px-2 text-slate-700">
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
