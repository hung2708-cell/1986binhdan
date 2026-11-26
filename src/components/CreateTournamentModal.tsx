/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Plus, Sparkles, X } from 'lucide-react';
import {
  BRAND_LOGO_URL,
  type ScoringMode,
  type Tournament,
  type TournamentFormat,
} from '../types/tournament';

type ThemeMode = 'light' | 'dark';

interface CreateTournamentModalProps {
  themeMode?: ThemeMode;
  onClose: () => void;
  onCreate: (tournament: Omit<Tournament, 'id' | 'createdAt' | 'updatedAt'>) => void;
}

const THEME_STORAGE_KEY = 'pickleball_1986_theme_mode_v1';

function detectIsDark(themeMode?: ThemeMode): boolean {
  if (themeMode === 'dark') return true;
  if (themeMode === 'light') return false;
  try {
    if (document.documentElement.classList.contains('dark')) return true;
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'dark') return true;
  } catch {
    // ignore storage errors
  }
  return false;
}

export const CreateTournamentModal: React.FC<CreateTournamentModalProps> = ({
  themeMode,
  onClose,
  onCreate,
}) => {
  const isDark = detectIsDark(themeMode);

  const [name, setName] = useState('GIẢI PICKLEBALL BÍNH DẦN 1986 MỞ RỘNG');
  const [location, setLocation] = useState('Cụm Sân Pickleball 1986, TP. Cao Bằng');
  const [startDate, setStartDate] = useState('2026-11-28');
  const [endDate, setEndDate] = useState('2026-11-29');
  const [courtsCount, setCourtsCount] = useState(4);
  const [format, setFormat] = useState<TournamentFormat>('group_knockout');
  const [scoringMode, setScoringMode] = useState<ScoringMode>('rally_15');
  const [pointsToWin, setPointsToWin] = useState(15);
  const [winByTwo, setWinByTwo] = useState(true);
  const [divisionsText, setDivisionsText] = useState(
    'Đồng Đội - Team 1, Đôi Nam 4.5, Đôi Nam Nữ 4.5',
  );
  const [description, setDescription] = useState(
    'Giải giao lưu Pickleball cộng đồng 1986 Bính Dần — thi đấu công bằng, chuyên nghiệp, cập nhật tỷ số và bảng xếp hạng trực tiếp.',
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const divisions = divisionsText
      .split(',')
      .map((d) => d.trim())
      .filter(Boolean);

    onCreate({
      name: name.trim() || 'Giải Pickleball 1986',
      seasonYear: 2026,
      location: location.trim() || 'Cụm Sân Pickleball 1986',
      startDate,
      endDate,
      status: 'ongoing',
      format,
      scoringMode,
      pointsToWin: Number(pointsToWin) || 15,
      winByTwo,
      courtsCount: Math.max(1, Math.min(20, Number(courtsCount) || 4)),
      divisions: divisions.length > 0 ? divisions : ['Đồng Đội - Team 1', 'Đôi Nam 4.5'],
      bannerUrl: BRAND_LOGO_URL,
      description: description.trim(),
    });
    onClose();
  };

  const inputClass = `w-full min-h-[38px] px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${
    isDark
      ? 'bg-slate-950 border-slate-700 text-white placeholder:text-slate-500'
      : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
  }`;

  const labelClass = `block text-xs font-semibold mb-1 ${
    isDark ? 'text-slate-300' : 'text-slate-700'
  }`;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-2xs p-3 sm:p-4 flex items-center justify-center overflow-y-auto"
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className={`rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl border my-auto transition-colors ${
          isDark
            ? 'bg-slate-900 border-slate-800 text-slate-100'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        <div
          className={`px-5 py-4 border-b flex items-center justify-between ${
            isDark
              ? 'bg-slate-950/70 border-slate-800'
              : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-orange-500" />
            <h2 className="font-display text-lg font-extrabold uppercase tracking-tight">
              KHỞI TẠO GIẢI ĐẤU PICKLEBALL MỚI
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${
              isDark
                ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                : 'text-slate-400 hover:text-slate-700 hover:bg-slate-200/70'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[78vh] overflow-y-auto">
          <div>
            <label className={labelClass}>Tên giải đấu *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Địa điểm thi đấu</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Số lượng sân thi đấu</label>
              <input
                type="number"
                min={1}
                max={20}
                value={courtsCount}
                onChange={(e) => setCourtsCount(Number(e.target.value))}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Ngày khai mạc</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Ngày bế mạc</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Thể thức giải</label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as TournamentFormat)}
                className={inputClass}
              >
                <option value="group_knockout">Chia bảng + Loại trực tiếp</option>
                <option value="round_robin">Vòng tròn tính điểm</option>
                <option value="knockout">Loại trực tiếp</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Luật tính điểm</label>
              <select
                value={scoringMode}
                onChange={(e) => setScoringMode(e.target.value as ScoringMode)}
                className={inputClass}
              >
                <option value="rally_15">Rally 15 điểm</option>
                <option value="traditional_11">Truyền thống 11 điểm</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Mốc điểm thắng set</label>
              <input
                type="number"
                min={11}
                max={21}
                value={pointsToWin}
                onChange={(e) => setPointsToWin(Number(e.target.value))}
                className={inputClass}
              />
            </div>
            <div className="flex items-end pb-1">
              <label
                className={`inline-flex items-center gap-2 text-xs font-semibold cursor-pointer ${
                  isDark ? 'text-slate-200' : 'text-slate-700'
                }`}
              >
                <input
                  type="checkbox"
                  checked={winByTwo}
                  onChange={(e) => setWinByTwo(e.target.checked)}
                  className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                />
                <span>Cách biệt 2 điểm (Win by 2)</span>
              </label>
            </div>
          </div>

          <div>
            <label className={labelClass}>
              Các nội dung / hạng mục thi đấu (cách nhau dấu phẩy)
            </label>
            <input
              type="text"
              value={divisionsText}
              onChange={(e) => setDivisionsText(e.target.value)}
              placeholder="VD: Đồng Đội - Team 1, Đôi Nam 4.5, Đôi Nam Nữ 4.5"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Giới thiệu ngắn về giải đấu</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                isDark
                  ? 'bg-slate-950 border-slate-700 text-white placeholder:text-slate-500'
                  : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
              }`}
            />
          </div>
        </div>

        <div
          className={`px-5 py-3.5 border-t flex items-center justify-end gap-2.5 ${
            isDark
              ? 'bg-slate-950/70 border-slate-800'
              : 'bg-slate-50 border-slate-200'
          }`}
        >
          <button
            type="button"
            onClick={onClose}
            className={`min-h-[38px] px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
              isDark
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
            }`}
          >
            Hủy
          </button>
          <button
            type="submit"
            className="min-h-[38px] px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo giải đấu</span>
          </button>
        </div>
      </form>
    </div>
  );
};
