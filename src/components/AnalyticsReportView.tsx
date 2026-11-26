import React, { useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Download,
  FileSpreadsheet,
  Printer,
} from 'lucide-react';
import { BRAND_LOGO_URL, type Match, type Registration, type Tournament } from '../types/tournament';
import { computeGroupStandings, isTeamDivision } from '../utils/pickleballEngine';

type ThemeMode = 'light' | 'dark';

interface AnalyticsReportViewProps {
  tournament: Tournament;
  registrations: Registration[];
  matches: Match[];
  themeMode?: ThemeMode;
}

function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number>>) {
  const escapeCell = (val: string | number) => {
    const str = String(val ?? '').replace(/"/g, '""');
    return `"${str}"`;
  };
  const csvContent =
    '\uFEFF' +
    [headers.map(escapeCell).join(','), ...rows.map((r) => r.map(escapeCell).join(','))].join(
      '\n',
    );
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const AnalyticsReportView: React.FC<AnalyticsReportViewProps> = ({
  tournament,
  registrations,
  matches,
  themeMode = 'light',
}) => {
  const isDark = themeMode === 'dark';

  const [compFilter, setCompFilter] = useState<'all' | 'doubles' | 'team'>('all');
  const [bucketGranularity, setBucketGranularity] = useState<'1h' | '30m'>('1h');

  const filteredMatches = useMemo(() => {
    return matches.filter((m) => {
      const teamMode = isTeamDivision(m.division, m.competitionType);
      if (compFilter === 'doubles') return !teamMode;
      if (compFilter === 'team') return teamMode;
      return true;
    });
  }, [matches, compFilter]);

  const filteredRegistrations = useMemo(() => {
    return registrations.filter((r) => {
      const teamMode = isTeamDivision(r.division);
      if (compFilter === 'doubles') return !teamMode;
      if (compFilter === 'team') return teamMode;
      return true;
    });
  }, [registrations, compFilter]);

  const completedMatchesCount = useMemo(
    () => filteredMatches.filter((m) => m.status === 'completed').length,
    [filteredMatches],
  );

  const liveMatchesCount = useMemo(
    () => filteredMatches.filter((m) => m.status === 'live').length,
    [filteredMatches],
  );

  const totalPointsScored = useMemo(
    () => filteredMatches.reduce((sum, m) => sum + (m.scoreA || 0) + (m.scoreB || 0), 0),
    [filteredMatches],
  );

  const totalFeesPaid = useMemo(
    () =>
      filteredRegistrations
        .filter((r) => r.paymentStatus === 'paid')
        .reduce((sum, r) => sum + (r.feeAmount || 0), 0),
    [filteredRegistrations],
  );

  const totalFeesExpected = useMemo(
    () => filteredRegistrations.reduce((sum, r) => sum + (r.feeAmount || 0), 0),
    [filteredRegistrations],
  );

  const timeBuckets = useMemo(() => {
    const labels =
      bucketGranularity === '1h'
        ? ['07:00', '08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00']
        : [
            '07:00',
            '07:30',
            '08:00',
            '08:30',
            '09:00',
            '09:30',
            '10:00',
            '10:30',
            '11:00',
            '14:00',
            '14:30',
            '15:00',
          ];

    return labels.map((label, idx) => {
      const count = filteredMatches.filter((m) => {
        if (m.scheduledTime) {
          return m.scheduledTime.startsWith(label.slice(0, 2));
        }
        return idx === 0 && filteredMatches.length > 0;
      }).length;
      return { label, count };
    });
  }, [filteredMatches, bucketGranularity]);

  const courtCapacityThreshold = tournament.courtsCount * 2;
  const activeBucketsCount = timeBuckets.filter((b) => b.count > 0).length;
  const peakBucket = timeBuckets.reduce(
    (max, item) => (item.count > max.count ? item : max),
    { label: '', count: 0 },
  );
  const avgDensity =
    activeBucketsCount > 0 ? (filteredMatches.length / activeBucketsCount).toFixed(1) : '0.0';
  const overloadedBucketsCount = timeBuckets.filter(
    (b) => b.count > courtCapacityThreshold,
  ).length;

  const cardSurface = isDark
    ? 'bg-slate-900 border-slate-800 text-slate-100'
    : 'bg-white border-slate-200 text-slate-900';

  const subSurface = isDark
    ? 'bg-slate-950/70 border-slate-800 text-slate-100'
    : 'bg-slate-50 border-slate-200 text-slate-900';

  const mutedText = isDark ? 'text-slate-400' : 'text-slate-600';

  const handleExportMatchesCsv = () => {
    downloadCsv(
      `ket-qua-tran-${tournament.id}.csv`,
      ['Trận #', 'Nội dung', 'Vòng', 'Bảng', 'Sân', 'Đội A', 'Tỉ số A', 'Tỉ số B', 'Đội B', 'Trạng thái'],
      filteredMatches.map((m) => [
        m.matchNumber,
        m.division,
        m.stage,
        m.groupName || '',
        m.courtNumber,
        m.teamAName,
        m.scoreA,
        m.scoreB,
        m.teamBName,
        m.status,
      ]),
    );
  };

  const handleExportStandingsCsv = () => {
    const rows: Array<Array<string | number>> = [];
    tournament.divisions.forEach((div) => {
      const groups = computeGroupStandings(registrations, matches, div);
      Object.entries(groups).forEach(([groupName, list]) => {
        list.forEach((r, idx) => {
          rows.push([
            div,
            groupName,
            idx + 1,
            r.teamName,
            r.club,
            r.played,
            r.wins,
            r.losses,
            r.pointDiff,
            r.rankPoints,
          ]);
        });
      });
    });

    downloadCsv(
      `bang-xep-hang-${tournament.id}.csv`,
      ['Nội dung', 'Bảng', 'Hạng', 'Đội', 'CLB', 'Trận', 'Thắng', 'Thua', 'Hiệu số', 'Điểm'],
      rows,
    );
  };

  const handleExportRegistrationsCsv = () => {
    downloadCsv(
      `vdv-le-phi-${tournament.id}.csv`,
      ['Nội dung', 'Bảng', 'Đội / VĐV', 'CLB', 'Trình', 'Check-in', 'Lệ phí', 'Trạng thái phí'],
      filteredRegistrations.map((r) => [
        r.division,
        r.groupName || '',
        r.teamName,
        r.club,
        r.combinedRating,
        r.checkedIn ? 'Đã check-in' : 'Chưa check-in',
        r.feeAmount,
        r.paymentStatus,
      ]),
    );
  };

  return (
    <div className="space-y-5">
      {/* Thanh công cụ báo cáo & xuất file */}
      <section className={`border rounded-2xl p-4 sm:p-5 space-y-4 ${cardSurface}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-lg sm:text-xl font-extrabold uppercase tracking-tight flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-orange-500" />
              <span>BÁO CÁO CHUYÊN SÂU & XUẤT DỮ LIỆU SAU GIẢI ĐẤU</span>
            </h1>
          </div>

          <div className="no-print flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="min-h-[38px] px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold inline-flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              <span>In Báo Cáo Tổng Kết (PDF A4)</span>
            </button>

            <button
              type="button"
              onClick={handleExportMatchesCsv}
              className={`min-h-[38px] px-3 py-2 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 ${
                isDark
                  ? 'bg-slate-950 hover:bg-slate-800 border-slate-700 text-slate-200'
                  : 'bg-slate-50 hover:bg-slate-100 border-slate-300 text-slate-800'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
              <span>Xuất CSV Kết Quả Trận</span>
            </button>

            <button
              type="button"
              onClick={handleExportStandingsCsv}
              className={`min-h-[38px] px-3 py-2 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 ${
                isDark
                  ? 'bg-slate-950 hover:bg-slate-800 border-slate-700 text-slate-200'
                  : 'bg-slate-50 hover:bg-slate-100 border-slate-300 text-slate-800'
              }`}
            >
              <Download className="w-4 h-4 text-orange-500" />
              <span>Xuất CSV Bảng Xếp Hạng</span>
            </button>

            <button
              type="button"
              onClick={handleExportRegistrationsCsv}
              className={`min-h-[38px] px-3 py-2 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 ${
                isDark
                  ? 'bg-slate-950 hover:bg-slate-800 border-slate-700 text-slate-200'
                  : 'bg-slate-50 hover:bg-slate-100 border-slate-300 text-slate-800'
              }`}
            >
              <Download className="w-4 h-4 text-sky-500" />
              <span>Xuất CSV Lệ Phí & VĐV</span>
            </button>
          </div>
        </div>

        <div
          className={`inline-flex rounded-xl p-1 border ${
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
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
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
      </section>

      {/* Khối thông tin giải & 4 chỉ số chính */}
      <section className={`border rounded-2xl p-4 sm:p-6 space-y-5 ${cardSurface}`}>
        <div
          className={`flex flex-wrap items-start justify-between gap-4 pb-4 border-b ${
            isDark ? 'border-slate-800' : 'border-slate-200'
          }`}
        >
          <div className="flex items-start gap-3.5">
            <img
              src={BRAND_LOGO_URL}
              alt="Logo giải"
              referrerPolicy="no-referrer"
              className="w-12 h-12 rounded-xl object-cover border border-orange-500 shrink-0"
            />
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-orange-500">
                HỆ THỐNG QUẢN LÝ & TRỌNG TÀI PICKLEBALL 1986 — BÁO CÁO TỔNG KẾT GIẢI
              </div>
              <h2 className="font-display text-lg sm:text-xl font-extrabold uppercase mt-0.5">
                {tournament.name}
              </h2>
              <p className={`text-xs mt-1 ${mutedText}`}>
                Địa điểm: {tournament.location} · Thời gian: {tournament.startDate} đến{' '}
                {tournament.endDate} · Thể thức: Vòng bảng + Loại trực tiếp
              </p>
            </div>
          </div>

          <div className={`text-xs font-mono-num sm:text-right ${mutedText}`}>
            <div>Mã giải: {tournament.id}</div>
            <div>
              Quy mô: {tournament.courtsCount} sân · Chạm {tournament.pointsToWin} điểm
            </div>
            <div>Ngày trích xuất: {new Date().toLocaleDateString('vi-VN')}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className={`border rounded-xl p-4 ${subSurface}`}>
            <div className={`text-xs font-semibold ${mutedText}`}>Tiến độ trận đấu</div>
            <div className="font-mono-num text-xl sm:text-2xl font-extrabold mt-1">
              {completedMatchesCount}/{filteredMatches.length} trận
            </div>
            <div className={`text-xs mt-1 ${mutedText}`}>
              Đang đấu trực tiếp: {liveMatchesCount} trận
            </div>
          </div>

          <div className={`border rounded-xl p-4 ${subSurface}`}>
            <div className={`text-xs font-semibold ${mutedText}`}>Tổng điểm ghi nhận</div>
            <div className="font-mono-num text-xl sm:text-2xl font-extrabold text-orange-500 mt-1">
              {totalPointsScored} điểm
            </div>
            <div className={`text-xs mt-1 ${mutedText}`}>Thời lượng TB: 18 phút / trận</div>
          </div>

          <div className={`border rounded-xl p-4 ${subSurface}`}>
            <div className={`text-xs font-semibold ${mutedText}`}>Vận động viên tham dự</div>
            <div className="font-mono-num text-xl sm:text-2xl font-extrabold mt-1">
              {filteredRegistrations.length * 2} VĐV ({filteredRegistrations.length} cặp)
            </div>
            <div className={`text-xs mt-1 ${mutedText}`}>
              {tournament.divisions.length} nội dung thi đấu
            </div>
          </div>

          <div className={`border rounded-xl p-4 ${subSurface}`}>
            <div className={`text-xs font-semibold ${mutedText}`}>Đối soát thu phí VietQR</div>
            <div className="font-mono-num text-xl sm:text-2xl font-extrabold text-emerald-500 mt-1">
              {totalFeesPaid.toLocaleString('vi-VN')} ₫
            </div>
            <div className={`text-xs mt-1 ${mutedText}`}>
              Trên tổng dự kiến {totalFeesExpected.toLocaleString('vi-VN')} ₫
            </div>
          </div>
        </div>

        {/* Biểu đồ mật độ trận đấu theo khung giờ */}
        <div className={`border rounded-2xl p-4 sm:p-5 space-y-4 ${subSurface}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-orange-500/15 text-orange-500 flex items-center justify-center shrink-0">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-display text-sm font-extrabold uppercase">
                  BIỂU ĐỒ MẬT ĐỘ TRẬN ĐẤU THEO KHUNG GIỜ TRONG NGÀY
                </h3>
                <p className={`text-xs ${mutedText}`}>
                  Theo dõi phân bổ tải lượng sân theo giờ để BTC điều phối sân thi đấu hợp lý
                </p>
              </div>
            </div>

            <div
              className={`inline-flex rounded-xl p-1 border ${
                isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
              }`}
            >
              <button
                type="button"
                onClick={() => setBucketGranularity('1h')}
                className={`px-3 py-1 rounded-lg text-xs font-bold ${
                  bucketGranularity === '1h'
                    ? isDark
                      ? 'bg-slate-800 text-white'
                      : 'bg-slate-100 text-slate-900'
                    : mutedText
                }`}
              >
                Theo giờ (1h)
              </button>
              <button
                type="button"
                onClick={() => setBucketGranularity('30m')}
                className={`px-3 py-1 rounded-lg text-xs font-bold ${
                  bucketGranularity === '30m'
                    ? isDark
                      ? 'bg-slate-800 text-white'
                      : 'bg-slate-100 text-slate-900'
                    : mutedText
                }`}
              >
                Theo ca (30 phút)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div
              className={`p-3 rounded-xl border ${
                isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              <div className={`text-[11px] ${mutedText}`}>Khung giờ cao điểm</div>
              <div className="text-sm font-extrabold mt-0.5">
                {peakBucket.count > 0 ? `${peakBucket.label} (${peakBucket.count} trận)` : 'Chưa có'}
              </div>
            </div>

            <div
              className={`p-3 rounded-xl border ${
                isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              <div className={`text-[11px] ${mutedText}`}>Khung giờ có lịch</div>
              <div className="font-mono-num text-sm font-extrabold mt-0.5">
                {activeBucketsCount} khung giờ
              </div>
            </div>

            <div
              className={`p-3 rounded-xl border ${
                isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              <div className={`text-[11px] ${mutedText}`}>Mật độ TB / khung giờ</div>
              <div className="font-mono-num text-sm font-extrabold text-orange-500 mt-0.5">
                {avgDensity} trận
              </div>
            </div>

            <div
              className={`p-3 rounded-xl border ${
                isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              <div className={`text-[11px] ${mutedText}`}>Khung vượt tải sân</div>
              <div className="font-mono-num text-sm font-extrabold text-emerald-500 mt-0.5">
                {overloadedBucketsCount} khung giờ
              </div>
            </div>
          </div>

          {/* Cột biểu đồ thích ứng nền sáng/tối */}
          <div
            className={`p-4 rounded-xl border space-y-3 ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-mono-num">
              <span className={mutedText}>Số trận / khung giờ</span>
              <span className="text-orange-500 font-semibold">
                Ngưỡng tải {tournament.courtsCount} sân ({courtCapacityThreshold} trận)
              </span>
            </div>

            <div className="grid grid-cols-6 sm:grid-cols-9 lg:grid-cols-12 gap-2 items-end h-36 pt-4 border-b border-dashed border-slate-400/30">
              {timeBuckets.map((b) => {
                const maxVal = Math.max(courtCapacityThreshold, peakBucket.count, 1);
                const heightPercent = Math.min(100, Math.round((b.count / maxVal) * 100));
                return (
                  <div key={b.label} className="flex flex-col items-center justify-end h-full gap-1">
                    <span className="font-mono-num text-[10px] font-bold">{b.count}</span>
                    <div className="w-full max-w-[28px] rounded-t-md bg-orange-500/80 transition-all" style={{ height: `${Math.max(8, heightPercent)}%` }} />
                    <span className={`font-mono-num text-[10px] ${mutedText}`}>{b.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
