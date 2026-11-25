import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Lock,
  Plus,
  QrCode,
  Search,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import {
  PAYMENT_STATUS_LABELS,
  type PaymentStatus,
  type Registration,
  type StaffAccount,
  type Tournament,
} from '../types/tournament';
import { isTeamDivision } from '../utils/pickleballEngine';
import { formatVND } from '../utils/vietqr';

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
    squadRoster?: string[];
  }) => void;
  onToggleCheckIn: (registrationId: string) => void;
  onOpenVietQR: (registration: Registration) => void;
  onApprovePayment: (registrationId: string) => void;
}

export const MembersAndPaymentsView: React.FC<MembersAndPaymentsViewProps> = ({
  tournament,
  registrations,
  currentAccount,
  onRequestLogin,
  onAddDivision,
  onAddRegistration,
  onToggleCheckIn,
  onOpenVietQR,
  onApprovePayment,
}) => {
  const isStaff = currentAccount !== null;
  const isAdmin = currentAccount?.role === 'admin';

  const [division, setDivision] = useState<string>(tournament.divisions[0] || '');
  const [newDivType, setNewDivType] = useState<'doubles' | 'team'>('doubles');
  const [newDivName, setNewDivName] = useState('');
  const [player1Name, setPlayer1Name] = useState('');
  const [player2Name, setPlayer2Name] = useState('');
  const [squadText, setSquadText] = useState('');
  const [club, setClub] = useState('CLB Bính Dần 1986');
  const [combinedRating, setCombinedRating] = useState<string>('5.2');
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'all' | PaymentStatus>('all');
  const [formError, setFormError] = useState<string | null>(null);

  const effectiveDivision = tournament.divisions.includes(division)
    ? division
    : tournament.divisions[0] || '';
  const isSelectedTeamEvent = effectiveDivision ? isTeamDivision(effectiveDivision) : false;

  const filteredRegistrations = useMemo(() => {
    return registrations.filter((r) => {
      if (paymentFilter !== 'all' && r.paymentStatus !== paymentFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchText = `${r.teamName} ${r.player1Name} ${r.player2Name} ${r.club} ${r.paymentCode} ${r.division}`.toLowerCase();
        if (!matchText.includes(q)) return false;
      }
      return true;
    });
  }, [registrations, paymentFilter, searchQuery]);

  const paymentSummary = useMemo(() => {
    const totalExpected = registrations.reduce((acc, r) => acc + r.feeAmount, 0);
    const paidRegs = registrations.filter((r) => r.paymentStatus === 'paid');
    const pendingRegs = registrations.filter((r) => r.paymentStatus === 'pending_review');
    const totalCollected = paidRegs.reduce((acc, r) => acc + r.feeAmount, 0);
    return {
      totalExpected,
      totalCollected,
      paidCount: paidRegs.length,
      pendingCount: pendingRegs.length,
      unpaidCount: registrations.length - paidRegs.length - pendingRegs.length,
    };
  }, [registrations]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      onRequestLogin(
        'Phải đăng nhập tài khoản Admin (admin / 1986) mới có thể thêm đội và lựa chọn nội dung Đồng đội hoặc Đôi.',
      );
      return;
    }
    if (!effectiveDivision) {
      setFormError('Vui lòng tạo ít nhất 01 nội dung thi đấu (Đôi hoặc Đồng đội) trước khi thêm đội.');
      return;
    }
    if (!player1Name.trim()) {
      setFormError('Vui lòng nhập họ tên Vận động viên 1 hoặc Tên Đội / Đội trưởng.');
      return;
    }
    const ratingNum = Number(combinedRating) || 5.0;
    const extraAthletes = squadText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const fullRoster = Array.from(
      new Set([player1Name.trim(), player2Name.trim(), ...extraAthletes].filter(Boolean)),
    );

    onAddRegistration({
      division: effectiveDivision,
      player1Name: player1Name.trim(),
      player2Name: player2Name.trim(),
      club: club.trim() || 'Tự do',
      combinedRating: Math.min(12, Math.max(2.0, ratingNum)),
      squadRoster: fullRoster,
    });
    setPlayer1Name('');
    setPlayer2Name('');
    setSquadText('');
    setFormError(null);
  };

  const handleCreateDivisionClick = () => {
    if (!isAdmin) {
      onRequestLogin(
        'Phải đăng nhập tài khoản Admin (admin / 1986) mới có thể thêm nội dung Đôi hoặc Đồng đội.',
      );
      return;
    }
    const trimmed = newDivName.trim();
    if (!trimmed) {
      setFormError('Vui lòng nhập tên nội dung mới (VD: Đôi Nam 5.5 hoặc Đồng Đội CLB).');
      return;
    }
    const expectedName =
      newDivType === 'team' && !trimmed.toLowerCase().includes('đồng đội')
        ? `Đồng Đội - ${trimmed}`
        : newDivType === 'doubles' && !trimmed.toLowerCase().includes('đôi')
        ? `Đôi - ${trimmed}`
        : trimmed;
    onAddDivision(trimmed, newDivType);
    setDivision(expectedName);
    setNewDivName('');
    setFormError(null);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Financial & Member Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4">
          <div className="text-xs text-slate-500">Tổng đội đăng ký</div>
          <div className="mt-1 font-mono-num text-xl sm:text-2xl font-bold text-slate-900">
            {registrations.length} đội
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            Đã check-in: {registrations.filter((r) => r.checkedIn).length} đội
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4">
          <div className="text-xs text-slate-500">Đã thu phí VietQR</div>
          <div className="mt-1 font-mono-num text-xl sm:text-2xl font-bold text-emerald-600">
            {formatVND(paymentSummary.totalCollected)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            {paymentSummary.paidCount}/{registrations.length} đội hoàn tất
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4">
          <div className="text-xs text-slate-500">Chờ BTC duyệt QR</div>
          <div className="mt-1 font-mono-num text-xl sm:text-2xl font-bold text-amber-600">
            {paymentSummary.pendingCount} hồ sơ
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            Chưa đóng: {paymentSummary.unpaidCount} đội
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4">
          <div className="text-xs text-slate-500">Tài khoản VietQR</div>
          <div className="mt-1 font-mono-num text-sm sm:text-base font-bold text-slate-900 truncate">
            {tournament.bankName} · {tournament.bankAccountNo}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 truncate">
            Phí: <span className="font-mono-num font-semibold">{formatVND(tournament.entryFee)}</span>/đội
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Form: Add Doubles or Team Squad Registration */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-3.5">
          <div>
            <h3 className="font-display text-lg font-bold tracking-tight text-slate-900 uppercase">
              THÊM VĐV NỘI DUNG ĐÔI / ĐỒNG ĐỘI
            </h3>
            <p className="text-xs text-slate-500">
              Chọn nội dung Đôi hoặc Đồng đội (4 trận Đôi + 1 Đơn theo Điều lệ)
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {!isAdmin && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
                <div className="flex items-start gap-2 text-xs text-amber-900">
                  <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">Yêu cầu tài khoản Admin (BTC)</div>
                    <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                      {currentAccount
                        ? `Tài khoản hiện tại (${currentAccount.displayName}) không có quyền Admin. Phải đăng nhập tài khoản Admin (admin / 1986) mới có thể thêm đội và lựa chọn Đồng đội hoặc Đôi.`
                        : 'Phải đăng nhập tài khoản Admin (admin / 1986) mới có thể thêm đội và lựa chọn nội dung Đồng đội hoặc Đôi.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onRequestLogin(
                      'Phải đăng nhập tài khoản Admin (admin / 1986) mới có thể thêm đội và lựa chọn nội dung Đồng đội hoặc Đôi.',
                    )
                  }
                  className="w-full min-h-[36px] px-3 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-orange-600 rounded-lg transition-colors inline-flex items-center justify-center gap-1.5"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Đăng nhập tài khoản Admin
                </button>
              </div>
            )}

            {formError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
                {formError}
              </div>
            )}

            {isAdmin && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="text-xs font-bold text-slate-800">
                  Thêm mới nội dung thi đấu (Đôi / Đồng đội)
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setNewDivType('doubles')}
                    className={`min-h-[34px] px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors ${
                      newDivType === 'doubles'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Nội dung Đôi
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewDivType('team')}
                    className={`min-h-[34px] px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors ${
                      newDivType === 'team'
                        ? 'bg-orange-600 text-white border-orange-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Nội dung Đồng đội
                  </button>
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={newDivName}
                    onChange={(e) => setNewDivName(e.target.value)}
                    placeholder={
                      newDivType === 'team'
                        ? 'VD: Đồng Đội CLB 1986'
                        : 'VD: Đôi Nam 5.5'
                    }
                    className="flex-1 min-h-[36px] px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                  />
                  <button
                    type="button"
                    onClick={handleCreateDivisionClick}
                    className="min-h-[36px] px-3 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-orange-600 rounded-lg inline-flex items-center gap-1 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Thêm
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Chọn Nội dung thi đấu (Đôi hoặc Đồng đội)
              </label>
              <select
                value={effectiveDivision}
                disabled={!isAdmin || tournament.divisions.length === 0}
                onChange={(e) => setDivision(e.target.value)}
                className={`w-full min-h-[42px] px-3 py-2 text-sm border border-slate-300 rounded-lg ${
                  !isAdmin || tournament.divisions.length === 0
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-white'
                }`}
              >
                {tournament.divisions.length === 0 ? (
                  <option value="">Chưa có nội dung (Chưa tạo sẵn)</option>
                ) : (
                  tournament.divisions.map((div) => (
                    <option key={div} value={div}>
                      {div}
                    </option>
                  ))
                )}
              </select>
              <div className="mt-1 text-[11px] text-slate-500">
                {!effectiveDivision
                  ? 'Hiện chưa có nội dung Đôi hay Đồng đội nào được tạo sẵn. Admin hãy tạo nội dung ở phía trên.'
                  : isSelectedTeamEvent
                  ? 'Nội dung Đồng đội: Đấu 04 trận đôi (Đôi Nữ, Đôi Nam, 2 Đôi Nam Nữ) chạm 15đ, mỗi VĐV tối đa 02 trận.'
                  : 'Nội dung Đôi độc lập: Đấu chạm 15 điểm (8 điểm đổi sân).'}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {isSelectedTeamEvent ? 'Tên Đội / Đội trưởng (Nam/Nữ) *' : 'VĐV 1 *'}
              </label>
              <input
                type="text"
                disabled={!isAdmin}
                value={player1Name}
                onChange={(e) => setPlayer1Name(e.target.value)}
                placeholder={isSelectedTeamEvent ? 'VD: Nguyễn Văn Hưng (Nam)' : 'VD: Nguyễn Văn Hưng'}
                className={`w-full min-h-[42px] px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                  !isAdmin ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {isSelectedTeamEvent ? 'Đội phó / VĐV chủ lực 2' : 'VĐV 2 (Đánh cặp đôi)'}
              </label>
              <input
                type="text"
                disabled={!isAdmin}
                value={player2Name}
                onChange={(e) => setPlayer2Name(e.target.value)}
                placeholder="VD: Trần Minh Đức"
                className={`w-full min-h-[42px] px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                  !isAdmin ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Danh sách VĐV thành viên Đồng đội (cách nhau dấu phẩy)
              </label>
              <input
                type="text"
                disabled={!isAdmin}
                value={squadText}
                onChange={(e) => setSquadText(e.target.value)}
                placeholder="VD: Lê Thu Hà (Nữ), Phạm Hương Giang (Nữ), Hoàng Hải (Nam)..."
                className={`w-full min-h-[42px] px-3 py-2 text-xs border border-slate-300 rounded-lg ${
                  !isAdmin ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white'
                }`}
              />
              <span className="block mt-1 text-[11px] text-slate-500">
                Dùng để HLV/Đội trưởng đăng ký 04 cặp Đôi (Đôi Nữ, Đôi Nam, 2 Đôi Nam Nữ) & thứ tự Đơn với Trọng tài.
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Câu lạc bộ
                </label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={club}
                  onChange={(e) => setClub(e.target.value)}
                  placeholder="CLB Bính Dần 1986"
                  className={`w-full min-h-[42px] px-3 py-2 text-sm border border-slate-300 rounded-lg ${
                    !isAdmin ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Điểm trình tổng
                </label>
                <input
                  type="number"
                  step="0.05"
                  min="2.0"
                  max="12.0"
                  disabled={!isAdmin}
                  value={combinedRating}
                  onChange={(e) => setCombinedRating(e.target.value)}
                  className={`w-full min-h-[42px] px-3 py-2 text-sm font-mono-num border border-slate-300 rounded-lg ${
                    !isAdmin ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white'
                  }`}
                />
              </div>
            </div>

            <button
              type="submit"
              className={`w-full min-h-[44px] py-2.5 px-4 text-sm font-semibold text-white rounded-xl transition-colors flex items-center justify-center gap-2 ${
                isAdmin
                  ? 'bg-orange-600 hover:bg-orange-700'
                  : 'bg-slate-800 hover:bg-slate-900'
              }`}
            >
              {isAdmin ? <UserPlus className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              {isAdmin ? 'Thêm VĐV & Tạo mã VietQR' : 'Đăng nhập Admin để thêm Đôi / Đồng đội'}
            </button>
          </form>
        </div>

        {/* Right Roster: Mobile Cards on Phones + Table on Desktop */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm tên VĐV, CLB, mã thanh toán 1986..."
                className="w-full min-h-[38px] pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs overflow-x-auto">
              <button
                type="button"
                onClick={() => setPaymentFilter('all')}
                className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap ${
                  paymentFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                Tất cả ({registrations.length})
              </button>
              <button
                type="button"
                onClick={() => setPaymentFilter('pending_review')}
                className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap ${
                  paymentFilter === 'pending_review'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                Chờ duyệt ({paymentSummary.pendingCount})
              </button>
              <button
                type="button"
                onClick={() => setPaymentFilter('paid')}
                className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap ${
                  paymentFilter === 'paid' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                Đã thu ({paymentSummary.paidCount})
              </button>
              <button
                type="button"
                onClick={() => setPaymentFilter('unpaid')}
                className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap ${
                  paymentFilter === 'unpaid' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                Chưa đóng ({paymentSummary.unpaidCount})
              </button>
            </div>
          </div>

          {/* Mobile Cards for Smartphones */}
          <div className="md:hidden divide-y divide-slate-200">
            {filteredRegistrations.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                {registrations.length === 0
                  ? 'Chưa có đội nào trong giải. Tài khoản Admin có thể thêm đội và chọn nội dung Đôi hoặc Đồng đội ở biểu mẫu phía trên.'
                  : 'Không tìm thấy đội phù hợp với từ khóa hoặc bộ lọc.'}
              </div>
            ) : (
              filteredRegistrations.map((reg) => (
              <div key={reg.id} className="p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold text-slate-900">{reg.teamName}</div>
                    <div className="text-xs text-slate-500">
                      {reg.club} · {reg.division} ({reg.groupName || 'Chưa chia bảng'})
                    </div>
                  </div>
                  <span className="font-mono-num text-xs font-bold text-slate-700">
                    #{reg.paymentCode}
                  </span>
                </div>

                {reg.squadRoster && reg.squadRoster.length > 0 && (
                  <div className="text-[11px] text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200/70">
                    <strong>Đội hình VĐV ({reg.squadRoster.length}):</strong>{' '}
                    {reg.squadRoster.join(', ')}
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <div>
                    <span className="font-mono-num text-xs font-bold text-slate-900">
                      {formatVND(reg.feeAmount)}
                    </span>{' '}
                    ·{' '}
                    <span
                      className={`text-xs font-semibold ${
                        reg.paymentStatus === 'paid'
                          ? 'text-emerald-600'
                          : reg.paymentStatus === 'pending_review'
                          ? 'text-amber-600'
                          : 'text-rose-600'
                      }`}
                    >
                      {PAYMENT_STATUS_LABELS[reg.paymentStatus]}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        if (!isStaff) {
                          onRequestLogin('Vui lòng đăng nhập ở góc phải màn hình để điểm danh Check-in VĐV.');
                          return;
                        }
                        onToggleCheckIn(reg.id);
                      }}
                      className={`min-h-[38px] px-2.5 py-1.5 rounded-lg text-xs font-semibold border ${
                        reg.checkedIn
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      {reg.checkedIn ? 'Đã Check-in' : 'Check-in'}
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenVietQR(reg)}
                      className="min-h-[38px] px-3 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 rounded-lg inline-flex items-center gap-1"
                    >
                      <QrCode className="w-3.5 h-3.5 text-orange-600" />
                      VietQR
                    </button>

                    {isAdmin && reg.paymentStatus !== 'paid' && (
                      <button
                        type="button"
                        onClick={() => onApprovePayment(reg.id)}
                        className="min-h-[38px] px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg"
                      >
                        Duyệt
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
            )}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-50">
                  <th className="py-3 pl-5 pr-2">Mã QR</th>
                  <th className="py-3 px-2">Đội & Danh sách VĐV Đồng đội</th>
                  <th className="py-3 px-2">Nội Dung / Bảng</th>
                  <th className="py-3 px-2 text-right">Trình</th>
                  <th className="py-3 px-2 text-center">Check-in</th>
                  <th className="py-3 px-2">Lệ Phí VietQR</th>
                  <th className="py-3 pl-2 pr-5 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredRegistrations.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 px-5 text-center text-xs text-slate-500">
                      {registrations.length === 0
                        ? 'Chưa có đội nào trong giải. Tài khoản Admin có thể thêm đội và chọn nội dung Đôi hoặc Đồng đội ở cột bên trái.'
                        : 'Không tìm thấy đội phù hợp với từ khóa hoặc bộ lọc.'}
                    </td>
                  </tr>
                ) : (
                  filteredRegistrations.map((reg) => (
                  <tr key={reg.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 pl-5 pr-2 font-mono-num text-xs font-bold text-slate-800">
                      {reg.paymentCode}
                    </td>
                    <td className="py-3 px-2 max-w-xs">
                      <div className="font-semibold text-slate-900">{reg.teamName}</div>
                      <div className="text-xs text-slate-500">{reg.club}</div>
                      {reg.squadRoster && reg.squadRoster.length > 0 && (
                        <div className="text-[11px] text-slate-500 truncate mt-0.5">
                          Đội hình ({reg.squadRoster.length} VĐV): {reg.squadRoster.join(', ')}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-2 text-xs text-slate-600">
                      <div className="font-medium text-slate-800">{reg.division}</div>
                      <div>{reg.groupName || 'Chưa chia bảng'}</div>
                    </td>
                    <td className="py-3 px-2 text-right font-mono-num font-semibold text-slate-800">
                      {reg.combinedRating.toFixed(2)}
                    </td>
                    <td className="py-3 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          if (!isStaff) {
                            onRequestLogin('Vui lòng đăng nhập ở góc phải màn hình để điểm danh Check-in VĐV.');
                            return;
                          }
                          onToggleCheckIn(reg.id);
                        }}
                        className={`text-xs font-medium inline-flex items-center gap-1 ${
                          reg.checkedIn ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-700'
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {reg.checkedIn ? 'Có mặt' : 'Điểm danh'}
                      </button>
                    </td>
                    <td className="py-3 px-2">
                      <div className="font-mono-num text-xs font-semibold text-slate-900">
                        {formatVND(reg.feeAmount)}
                      </div>
                      <div
                        className={`text-[11px] font-semibold ${
                          reg.paymentStatus === 'paid'
                            ? 'text-emerald-600'
                            : reg.paymentStatus === 'pending_review'
                            ? 'text-amber-600'
                            : 'text-rose-600'
                        }`}
                      >
                        {PAYMENT_STATUS_LABELS[reg.paymentStatus]}
                      </div>
                    </td>
                    <td className="py-3 pl-2 pr-5 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onOpenVietQR(reg)}
                          className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1 whitespace-nowrap"
                        >
                          <QrCode className="w-3.5 h-3.5 text-orange-600" />
                          Mã VietQR
                        </button>

                        {isAdmin && reg.paymentStatus !== 'paid' && (
                          <button
                            type="button"
                            onClick={() => onApprovePayment(reg.id)}
                            className="px-2.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg inline-flex items-center gap-1 whitespace-nowrap"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Duyệt
                          </button>
                        )}
                      </div>
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
