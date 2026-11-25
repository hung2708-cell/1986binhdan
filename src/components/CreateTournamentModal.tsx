import React, { useState } from 'react';
import { BookOpen, PlusCircle, Trophy, Users, X } from 'lucide-react';
import {
  CHARTER_REGULATION_SUMMARY,
  VIETNAM_BANKS,
  type CompetitionType,
  type ScoringMode,
  type Tournament,
  type TournamentFormat,
} from '../types/tournament';

interface CreateTournamentModalProps {
  onClose: () => void;
  onCreate: (newTournament: Omit<Tournament, 'id' | 'createdAt' | 'updatedAt'>) => void;
}

export const CreateTournamentModal: React.FC<CreateTournamentModalProps> = ({
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState('Giải Pickleball 1986 Bính Dần Mở Rộng');
  const [location, setLocation] = useState('Cụm Sân Pickleball 1986 Arena, Hà Nội');
  const [startDate, setStartDate] = useState('2026-12-19');
  const [endDate, setEndDate] = useState('2026-12-20');
  const [competitionType, setCompetitionType] = useState<CompetitionType>('doubles');
  const [format, setFormat] = useState<TournamentFormat>('group_knockout');
  const [courtsCount, setCourtsCount] = useState(4);
  const [pointsToWin, setPointsToWin] = useState<11 | 15 | 21>(15);
  const [scoringMode, setScoringMode] = useState<ScoringMode>('side_out');
  const [entryFee, setEntryFee] = useState(600000);
  const [bankBin, setBankBin] = useState(VIETNAM_BANKS[0].bin);
  const [bankAccountNo, setBankAccountNo] = useState('198688889999');
  const [bankAccountName, setBankAccountName] = useState('CLB PICKLEBALL BINH DAN 1986');
  const [divisionsText, setDivisionsText] = useState('');
  const [description, setDescription] = useState(
    'Áp dụng Điều lệ thi đấu theo Quyết định số 494/QĐTDTTVN ngày 26/5/2025 của Cục TDTT Việt Nam: Chạm 15 điểm (8đ đổi sân, KO 14-14 cách biệt 2đ max 18đ); Thắng 3đ, Hòa 2đ, Thua 1đ, Bỏ cuộc 0đ.',
  );

  const handleSelectCompetitionType = (type: CompetitionType) => {
    setCompetitionType(type);
    setPointsToWin(15);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedBank = VIETNAM_BANKS.find((b) => b.bin === bankBin) || VIETNAM_BANKS[0];
    const divisions = divisionsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    onCreate({
      name: name.trim() || 'Giải Pickleball 1986',
      location: location.trim() || 'Sân Pickleball 1986',
      startDate,
      endDate,
      format,
      competitionType,
      status: 'open',
      courtsCount: Math.max(1, Math.min(24, Number(courtsCount) || 4)),
      pointsToWin,
      maxPointsCap: pointsToWin === 15 ? 18 : pointsToWin + 3,
      scoringMode,
      winByTwo: true,
      entryFee: Math.max(0, Number(entryFee) || 0),
      bankBin: selectedBank.bin,
      bankName: selectedBank.shortName,
      bankAccountNo: bankAccountNo.trim() || '198688889999',
      bankAccountName: bankAccountName.trim().toUpperCase() || 'CLB PICKLEBALL 1986',
      divisions,
      description: description.trim(),
      visibility: 'public',
      createdBy: 'u_admin_1986',
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full overflow-hidden shadow-xl">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Trophy className="w-5 h-5 text-orange-600" />
            <h3 className="font-display text-lg sm:text-xl font-bold tracking-tight text-slate-900 uppercase">
              KHỞI TẠO GIẢI ĐẤU THEO ĐIỀU LỆ 494/QĐTDTTVN
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/60"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 max-h-[84vh] overflow-y-auto">
          {/* SELECT COMPETITION MODE: NỘI DUNG ĐÔI OR NỘI DUNG ĐỒNG ĐỘI */}
          <div className="p-3.5 rounded-xl bg-orange-50/70 border border-orange-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-orange-800 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-orange-600" />
                Chọn Hình Thức Thi Đấu Theo Điều Lệ Giải
              </span>
              <span className="text-[11px] text-slate-600 font-medium">
                {CHARTER_REGULATION_SUMMARY.legalDecision}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleSelectCompetitionType('doubles')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  competitionType === 'doubles'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-white text-slate-800 border-slate-200 hover:border-orange-300'
                }`}
              >
                <div className="text-xs font-bold flex items-center justify-between">
                  <span>1. NỘI DUNG ĐÔI (Độc lập)</span>
                  {competitionType === 'doubles' && (
                    <span className="text-[10px] text-orange-400">● Đang chọn</span>
                  )}
                </div>
                <p
                  className={`text-[11px] mt-1 leading-relaxed ${
                    competitionType === 'doubles' ? 'text-slate-300' : 'text-slate-500'
                  }`}
                >
                  Thi đấu Đôi Nữ, Đôi Nam, Đôi Nam Nữ. Chạm 15 điểm (08đ đổi sân); Vòng loại trực tiếp 14-14 cách biệt 02đ (max 18đ).
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleSelectCompetitionType('team')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  competitionType === 'team'
                    ? 'bg-orange-600 text-white border-orange-600 shadow-xs'
                    : 'bg-white text-slate-800 border-slate-200 hover:border-orange-300'
                }`}
              >
                <div className="text-xs font-bold flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    2. NỘI DUNG ĐỒNG ĐỘI (4 Đôi + 1 Đơn)
                  </span>
                  {competitionType === 'team' && (
                    <span className="text-[10px] text-amber-200">● Đang chọn</span>
                  )}
                </div>
                <p
                  className={`text-[11px] mt-1 leading-relaxed ${
                    competitionType === 'team' ? 'text-orange-50' : 'text-slate-500'
                  }`}
                >
                  Trận 1: Đôi Nữ · Trận 2: Đôi Nam · Trận 3 & 4: Đôi Nam Nữ (Mỗi VĐV tối đa 02 trận). Hòa 2-2 ở KO đấu 01 trận Đơn 21đ.
                </p>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Tên giải đấu *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Địa điểm tổ chức & Cụm sân
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Ngày khai mạc
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3.5 py-2 text-sm font-mono-num border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Ngày bế mạc
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3.5 py-2 text-sm font-mono-num border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Thể thức thi đấu
              </label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as TournamentFormat)}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="group_knockout">Vòng bảng + Loại trực tiếp (Group & Knockout)</option>
                <option value="round_robin">Đấu vòng tròn tính điểm (Round Robin)</option>
                <option value="single_elimination">Đấu loại trực tiếp (Single Elimination)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Số sân thi đấu
                </label>
                <input
                  type="number"
                  min={1}
                  max={24}
                  value={courtsCount}
                  onChange={(e) => setCourtsCount(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono-num border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Điểm chạm thắng
                </label>
                <select
                  value={pointsToWin}
                  onChange={(e) => setPointsToWin(Number(e.target.value) as 11 | 15 | 21)}
                  className="w-full px-3 py-2 text-sm font-mono-num border border-slate-300 rounded-lg bg-white"
                >
                  <option value={15}>15 điểm (8đ đổi sân, KO max 18)</option>
                  <option value={11}>11 điểm (6đ đổi sân)</option>
                  <option value={21}>21 điểm (11đ đổi sân)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Luật tính điểm Pickleball
              </label>
              <select
                value={scoringMode}
                onChange={(e) => setScoringMode(e.target.value as ScoringMode)}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="side_out">Luật Side-Out (3 số: Giao - Nhận - 1/2)</option>
                <option value="rally">Ăn điểm trực tiếp (Rally Scoring — Trận đơn 21đ)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Lệ phí tham gia mỗi đội (VND)
              </label>
              <input
                type="number"
                step={50000}
                value={entryFee}
                onChange={(e) => setEntryFee(Number(e.target.value))}
                className="w-full px-3.5 py-2 text-sm font-mono-num border border-slate-300 rounded-lg"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Các nội dung thi đấu trong giải (tùy chọn — Admin có thể thêm sau)
              </label>
              <input
                type="text"
                value={divisionsText}
                onChange={(e) => setDivisionsText(e.target.value)}
                placeholder="VD: Đôi Nam 5.5, Đồng Đội CLB... (để trống nếu chưa tạo sẵn)"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            {/* VietQR Bank Configuration */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Ngân hàng nhận lệ phí VietQR
              </label>
              <select
                value={bankBin}
                onChange={(e) => setBankBin(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                {VIETNAM_BANKS.map((b) => (
                  <option key={b.bin} value={b.bin}>
                    {b.shortName} — {b.fullName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Số tài khoản nhận VietQR
              </label>
              <input
                type="text"
                value={bankAccountNo}
                onChange={(e) => setBankAccountNo(e.target.value)}
                className="w-full px-3.5 py-2 text-sm font-mono-num border border-slate-300 rounded-lg"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Tên chủ tài khoản thụ hưởng (Viết hoa không dấu)
              </label>
              <input
                type="text"
                value={bankAccountName}
                onChange={(e) => setBankAccountName(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg uppercase"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Điều lệ & Ghi chú giải đấu
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg flex items-center gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              Tạo giải đấu & Mở đăng ký
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
