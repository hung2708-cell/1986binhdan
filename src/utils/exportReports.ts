import {
  MATCH_STAGE_LABELS,
  MATCH_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  type Match,
  type Registration,
  type StandingRow,
  type Tournament,
} from '../types/tournament';

function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number | boolean>>) {
  const bom = '\uFEFF'; // UTF-8 BOM for proper Vietnamese rendering in Microsoft Excel
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((r) => r.map(escapeCsvCell).join(',')),
  ];
  const blob = new Blob([bom + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function safeSlug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'giai-1986';
}

export function exportMatchesCsv(tournament: Tournament, matches: Match[]) {
  const headers = [
    'Mã Trận',
    'Nội Dung',
    'Vòng Đấu',
    'Bảng / Nhánh',
    'Sân',
    'Giờ Thi Đấu',
    'Đội A',
    'Điểm A',
    'Điểm B',
    'Đội B',
    'Đội Thắng',
    'Trạng Thái',
    'Trọng Tài',
    'Thời Lượng (phút)',
  ];

  const sorted = [...matches].sort((a, b) => a.matchNumber - b.matchNumber);
  const rows = sorted.map((m) => [
    `#${m.matchNumber}`,
    m.division,
    MATCH_STAGE_LABELS[m.stage],
    m.groupName || m.bracketSlot,
    m.courtNumber > 0 ? `Sân ${m.courtNumber}` : 'Chưa gán',
    m.scheduledTime,
    m.teamAName,
    m.scoreA,
    m.scoreB,
    m.teamBName,
    m.winnerSide === 'A' ? m.teamAName : m.winnerSide === 'B' ? m.teamBName : '-',
    MATCH_STATUS_LABELS[m.status],
    m.refereeName || '-',
    m.durationSeconds > 0 ? Math.round((m.durationSeconds / 60) * 10) / 10 : 0,
  ]);

  downloadCsv(`1986-${safeSlug(tournament.name)}-ket-qua-tran-dau.csv`, headers, rows);
}

export function exportStandingsCsv(
  tournament: Tournament,
  standingsByGroup: Record<string, StandingRow[]>,
) {
  const headers = [
    'Nội Dung',
    'Bảng',
    'Hạng',
    'Đội / VĐV',
    'Câu Lạc Bộ',
    'Số Trận',
    'Thắng',
    'Thua',
    'Điểm Ghi',
    'Điểm Mất',
    'Hiệu Số',
    'Điểm Xếp Hạng',
    'Vào Vòng Trong',
  ];

  const rows: Array<Array<string | number>> = [];
  Object.entries(standingsByGroup).forEach(([groupName, groupRows]) => {
    groupRows.forEach((r, idx) => {
      rows.push([
        r.division,
        groupName,
        idx + 1,
        r.teamName,
        r.club || '-',
        r.played,
        r.wins,
        r.losses,
        r.pointsFor,
        r.pointsAgainst,
        r.pointDiff,
        r.rankPoints,
        r.qualified ? 'Đủ điều kiện' : 'Loại',
      ]);
    });
  });

  downloadCsv(`1986-${safeSlug(tournament.name)}-bang-xep-hang.csv`, headers, rows);
}

export function exportRegistrationsAndFeesCsv(
  tournament: Tournament,
  registrations: Registration[],
) {
  const headers = [
    'Mã Thanh Toán',
    'Nội Dung',
    'Tên Đội',
    'VĐV 1',
    'VĐV 2',
    'CLB',
    'Điểm Trình',
    'Bảng Đấu',
    'Check-in',
    'Lệ Phí (VND)',
    'Trạng Thái Lệ Phí',
    'Mã Giao Dịch',
  ];

  const rows = registrations.map((r) => [
    r.paymentCode,
    r.division,
    r.teamName,
    r.player1Name,
    r.player2Name || '-',
    r.club || '-',
    r.combinedRating,
    r.groupName || 'Chưa chia',
    r.checkedIn ? 'Đã Check-in' : 'Chưa',
    r.feeAmount,
    PAYMENT_STATUS_LABELS[r.paymentStatus],
    r.transferRef || '-',
  ]);

  downloadCsv(`1986-${safeSlug(tournament.name)}-vdv-va-le-phi.csv`, headers, rows);
}
