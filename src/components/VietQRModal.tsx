import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Check, Copy, CreditCard, ShieldCheck, X } from 'lucide-react';
import {
  BRAND_LOGO_URL,
  PAYMENT_STATUS_LABELS,
  type Registration,
  type Tournament,
} from '../types/tournament';
import { buildVietQRPayload, formatVND } from '../utils/vietqr';

interface VietQRModalProps {
  tournament: Tournament;
  registration: Registration;
  isAdmin: boolean;
  onClose: () => void;
  onConfirmTransfer: (registrationId: string, transferRef: string) => void;
  onApprovePayment: (registrationId: string) => void;
}

export const VietQRModal: React.FC<VietQRModalProps> = ({
  tournament,
  registration,
  isAdmin,
  onClose,
  onConfirmTransfer,
  onApprovePayment,
}) => {
  const [transferRef, setTransferRef] = useState(
    registration.transferRef || `NAPAS.${registration.paymentCode}`,
  );
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const transferMemo = `${registration.paymentCode} ${registration.teamName}`;
  const qrPayload = buildVietQRPayload({
    bankBin: tournament.bankBin,
    accountNo: tournament.bankAccountNo,
    amount: registration.feeAmount,
    addInfo: transferMemo,
  });

  const handleCopy = (label: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full overflow-hidden shadow-xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <img
              src={BRAND_LOGO_URL}
              alt="1986 Pickleball"
              referrerPolicy="no-referrer"
              className="w-9 h-9 rounded-lg object-cover border border-orange-200"
            />
            <div>
              <h3 className="font-display text-lg font-bold tracking-tight text-slate-900">
                THANH TOÁN LỆ PHÍ GIẢI ĐẤU VIETQR
              </h3>
              <p className="text-xs text-slate-500">
                Mã hồ sơ: <span className="font-mono-num font-semibold text-slate-800">{registration.paymentCode}</span> · {registration.division}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 transition-colors"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* QR & Bank Card */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="sm:col-span-5 flex flex-col items-center justify-center bg-white p-3 rounded-xl border border-slate-200">
              <QRCodeSVG
                value={qrPayload}
                size={152}
                level="M"
                includeMargin={false}
              />
              <span className="mt-2 text-[11px] font-medium text-slate-500">
                Chuẩn NAPAS247 VietQR
              </span>
            </div>

            <div className="sm:col-span-7 space-y-2.5 text-sm">
              <div>
                <div className="text-xs text-slate-500">Ngân hàng thụ hưởng</div>
                <div className="font-semibold text-slate-900">
                  {tournament.bankName} (BIN {tournament.bankBin})
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500">Chủ tài khoản</div>
                <div className="font-semibold text-slate-900 uppercase">
                  {tournament.bankAccountName}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/80">
                <div>
                  <div className="text-xs text-slate-500">Số tài khoản</div>
                  <div className="font-mono-num font-bold text-slate-900">
                    {tournament.bankAccountNo}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy('acc', tournament.bankAccountNo)}
                  className="px-2.5 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg hover:bg-slate-100 flex items-center gap-1 text-slate-700"
                >
                  {copiedField === 'acc' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedField === 'acc' ? 'Đã chép' : 'Sao chép'}
                </button>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/80">
                <div>
                  <div className="text-xs text-slate-500">Số tiền lệ phí</div>
                  <div className="font-mono-num text-base font-bold text-orange-600">
                    {formatVND(registration.feeAmount)}
                  </div>
                </div>
                <span className="text-xs font-medium text-slate-600">
                  {PAYMENT_STATUS_LABELS[registration.paymentStatus]}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/80">
                <div className="min-w-0">
                  <div className="text-xs text-slate-500">Nội dung chuyển khoản</div>
                  <div className="font-mono-num font-semibold text-slate-900 truncate">
                    {registration.paymentCode}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy('memo', registration.paymentCode)}
                  className="px-2.5 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg hover:bg-slate-100 flex items-center gap-1 text-slate-700 shrink-0"
                >
                  {copiedField === 'memo' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedField === 'memo' ? 'Đã chép' : 'Chép mã'}
                </button>
              </div>
            </div>
          </div>

          {/* Team summary & transfer confirmation */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>Đội đăng ký: <strong className="text-slate-900">{registration.teamName}</strong></span>
              <span>CLB: <strong className="text-slate-900">{registration.club || 'Tự do'}</strong></span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Mã tham chiếu giao dịch ngân hàng (tùy chọn để đối soát nhanh)
              </label>
              <input
                type="text"
                value={transferRef}
                onChange={(e) => setTransferRef(e.target.value)}
                disabled={registration.paymentStatus === 'paid'}
                placeholder="VD: VCB.98127319 hoặc giờ chuyển khoản"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:bg-slate-100 font-mono-num"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Đóng
            </button>

            {registration.paymentStatus !== 'paid' && (
              <button
                type="button"
                onClick={() => {
                  onConfirmTransfer(registration.id, transferRef.trim() || `QR.${registration.paymentCode}`);
                  onClose();
                }}
                className="px-4 py-2 text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors flex items-center gap-2"
              >
                <CreditCard className="w-4 h-4" />
                Xác nhận tôi đã chuyển khoản
              </button>
            )}

            {isAdmin && registration.paymentStatus !== 'paid' && (
              <button
                type="button"
                onClick={() => {
                  onApprovePayment(registration.id);
                  onClose();
                }}
                className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                BTC Duyệt đã thu phí
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
