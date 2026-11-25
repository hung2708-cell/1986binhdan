import React, { useState } from 'react';
import { Plus, Trophy, X } from 'lucide-react';
import type {
  ScoringMode,
  Tournament,
  TournamentFormat,
  TournamentStatus,
} from '../types/tournament';

interface CreateTournamentModalProps {
  onClose: () => void;
  onCreate: (tournament: Omit<Tournament, 'id' | 'createdAt' | 'updatedAt'>) => void;
}

export const CreateTournamentModal: React.FC<CreateTournamentModalProps> = ({
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('Cụm Sân Pickleball 1986');
  const [startDate, setStartDate] = useState('2026-12-05');
  const [endDate, setEndDate] = useState('2026-12-06');
  const [format, setFormat] = useState<TournamentFormat>('group_knockout');
  const [status, setStatus] = useState<TournamentStatus>('open');
  const [courtsCount, setCourtsCount] = useState(4);
  const [pointsToWin, setPointsToWin] = useState<11 | 15 | 21>(15);
  const [scoringMode, setScoringMode] = useState<ScoringMode>('side_out');
  const [divisionsText, setDivisionsText] = useState('');
  const [description, setDescription] = useState(
    'Điều lệ 494/QĐTDTTVN của Cục TDTT Việt Nam: Chạm 15 điểm (08đ đổi sân; KO 14–14 cách biệt 2đ max 18đ); Thắng 3đ, Hòa 2đ, Thua 1đ, Bỏ cuộc 0đ.',
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const divisions = divisionsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const hasTeamDivision = divisions.some((d) => d.toLowerCase().includes('đồng đội'));

    onCreate({
      name: name.trim(),
      location: location.trim() || 'Cụm Sân Pickleball 1986',
      startDate,
      endDate,
      format,
      competitionType: hasTeamDivision ? 'team' : 'doubles',
      status,
      courtsCount: Math.max(1, Number(courtsCount) || 4),
      pointsToWin,
      maxPointsCap: pointsToWin === 15 ? 18 : pointsToWin + 3,
      scoringMode,
      winByTwo: true,
      entryFee: 0,
      bankBin: '',
      bankName: '',
      bankAccountNo: '',
      bankAccountName: '',
      divisions,
      description: description.trim(),
      visibility: 'public',
      createdBy: 'u_admin_1986',
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl my-auto">
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Trophy className="w-5 h-5 text-orange-400" />
            <div>
              <h3 className="font-display text-lg font-bold tracking-tight uppercase">
                KHỞI TẠO GIẢI ĐẤU THEO ĐIỀU LỆ 494/QĐTDTTVN
              </h3>
              <p className="text-xs text-slate-300">
                Áp dụng quy định chuyên môn Pickleball của Cục TDTT Việt Nam
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[82vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tên giải đấu *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Giải Pickleball 1986 Mở Rộng"
                className="w-full min-h-[42px] px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Địa điểm / Cụm sân *
              </label>
              <input
                type="text"
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full min-h-[42px] px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ngày khai mạc
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full min-h-[42px] px-3.5 py-2 text-sm font-mono-num border border-slate-300 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ngày bế mạc
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full min-h-[42px] px-3.5 py-2 text-sm font-mono-num border border-slate-300 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Thể thức thi đấu
              </label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as TournamentFormat)}
                className="w-full min-h-[42px] px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white"
              >
                <option value="group_knockout">Vòng bảng + Loại trực tiếp</option>
                <option value="round_robin">Vòng tròn tính điểm</option>
                <option value="knockout">Loại trực tiếp</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Trạng thái giải đấu
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TournamentStatus)}
                className="w-full min-h-[42px] px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white"
              >
                <option value="open">Đang mở đăng ký</option>
                <option value="ongoing">Đang thi đấu</option>
                <option value="completed">Đã kết thúc</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Số lượng sân thi đấu
              </label>
              <input
                type="number"
                min={1}
                max={24}
                value={courtsCount}
                onChange={(e) => setCourtsCount(Number(e.target.value))}
                className="w-full min-h-[42px] px-3.5 py-2 text-sm font-mono-num border border-slate-300 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mốc điểm kết thúc séc
              </label>
              <select
                value={pointsToWin}
                onChange={(e) => setPointsToWin(Number(e.target.value) as 11 | 15 | 21)}
                className="w-full min-h-[42px] px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white"
              >
                <option value={15}>15 điểm (8đ đổi sân — Chuẩn 494)</option>
                <option value={11}>11 điểm (6đ đổi sân)</option>
                <option value={21}>21 điểm (11đ đổi sân)</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Luật tính điểm Pickleball
              </label>
              <select
                value={scoringMode}
                onChange={(e) => setScoringMode(e.target.value as ScoringMode)}
                className="w-full min-h-[42px] px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white"
              >
                <option value="side_out">Luật Side-Out (3 số: Giao - Nhận - 1/2)</option>
                <option value="rally">Tính điểm trực tiếp (Rally Scoring)</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Các nội dung thi đấu trong giải (tùy chọn — Admin có thể thêm sau)
              </label>
              <input
                type="text"
                value={divisionsText}
                onChange={(e) => setDivisionsText(e.target.value)}
                placeholder="VD: Đôi Nam 5.5, Đồng Đội CLB... (để trống nếu muốn tự thêm từng nội dung)"
                className="w-full min-h-[42px] px-3.5 py-2 text-sm border border-slate-300 rounded-xl"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Điều lệ & Ghi chú giải đấu
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[42px] px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="min-h-[42px] px-5 py-2 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-xl flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Tạo giải đấu & Mở đăng ký
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
