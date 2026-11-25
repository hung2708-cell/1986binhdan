/**
 * EMVCo / NAPAS247 VietQR Payload Generator (100% client-side, zero external image dependency)
 */

function formatTLV(id: string, value: string): string {
  const length = value.length.toString().padStart(2, '0');
  return `${id}${length}${value}`;
}

function crc16CCITT(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function removeVietnameseAccents(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9\s\-_]/g, '')
    .trim();
}

export interface VietQRParams {
  bankBin: string;
  accountNo: string;
  amount: number;
  addInfo: string;
}

export function buildVietQRPayload({
  bankBin,
  accountNo,
  amount,
  addInfo,
}: VietQRParams): string {
  const cleanBin = (bankBin || '970436').replace(/\D/g, '').slice(0, 6);
  const cleanAccount = (accountNo || '198688889999').replace(/[^a-zA-Z0-9]/g, '').slice(0, 19);
  const cleanInfo = removeVietnameseAccents(addInfo).slice(0, 50);

  // Field 38: Merchant Account Information (NAPAS VietQR)
  const guid = formatTLV('00', 'A000000727');
  const beneficiary = formatTLV('00', cleanBin) + formatTLV('01', cleanAccount);
  const beneficiaryTLV = formatTLV('01', beneficiary);
  const serviceCode = formatTLV('02', 'QRIBFTTA'); // Transfer to Account
  const merchantAccountInfo = formatTLV('38', guid + beneficiaryTLV + serviceCode);

  const parts: string[] = [
    formatTLV('00', '01'), // Payload Format Indicator
    formatTLV('01', amount > 0 ? '12' : '11'), // Dynamic if amount specified
    merchantAccountInfo,
    formatTLV('53', '704'), // Currency VND
  ];

  if (amount > 0) {
    parts.push(formatTLV('54', Math.round(amount).toString()));
  }

  parts.push(formatTLV('58', 'VN'));

  if (cleanInfo) {
    const additionalData = formatTLV('08', cleanInfo);
    parts.push(formatTLV('62', additionalData));
  }

  const payloadWithoutCRC = `${parts.join('')}6304`;
  const checksum = crc16CCITT(payloadWithoutCRC);
  return `${payloadWithoutCRC}${checksum}`;
}

export function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export function generatePaymentCode(prefix = '1986'): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${prefix}${suffix}`;
}
