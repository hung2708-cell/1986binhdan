/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  Gavel,
  KeyRound,
  LogIn,
  LogOut,
  Plus,
  ShieldCheck,
  Trash2,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import {
  BRAND_LOGO_URL,
  ROLE_LABELS,
  type StaffAccount,
} from '../types/tournament';

type ThemeMode = 'light' | 'dark';

interface StaffAuthModalProps {
  accounts: StaffAccount[];
  currentAccount: StaffAccount | null;
  themeMode?: ThemeMode;
  initialMode?: 'login' | 'manage';
  reasonMessage?: string | null;
  onClose: () => void;
  onLoginSuccess: (account: StaffAccount) => void;
  onLogout: () => void;
  onCreateAccount: (payload: Omit<StaffAccount, 'id'>) => void;
  onDeleteAccount: (accountId: string) => void;
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

export const StaffAuthModal: React.FC<StaffAuthModalProps> = ({
  accounts,
  currentAccount,
  themeMode,
  initialMode = 'login',
  reasonMessage,
  onClose,
  onLoginSuccess,
  onLogout,
  onCreateAccount,
  onDeleteAccount,
}) => {
  const isDark = detectIsDark(themeMode);
  const isAdmin = currentAccount?.role === 'admin';

  const [activeTab, setActiveTab] = useState<'login' | 'manage'>(
    initialMode === 'manage' && isAdmin ? 'manage' : 'login',
  );

  // Login form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Create new staff account form state (Admin only)
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'referee'>('referee');
  const [newAssignedCourts, setNewAssignedCourts] = useState('Sân 1 - Sân 2');
  const [createFeedback, setCreateFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (initialMode === 'manage' && isAdmin) {
      setActiveTab('manage');
    } else {
      setActiveTab('login');
    }
  }, [initialMode, isAdmin]);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password;

    if (!cleanUser || !cleanPass) {
      setErrorMsg('Vui lòng nhập đầy đủ Tên đăng nhập và Mật khẩu.');
      return;
    }

    const found = accounts.find(
      (acc) =>
        acc.username.trim().toLowerCase() === cleanUser && acc.password === cleanPass,
    );

    if (!found) {
      setErrorMsg(
        'Tên đăng nhập hoặc mật khẩu không đúng. Vui lòng kiểm tra lại thông tin tài khoản.',
      );
      return;
    }

    if (found.role !== 'admin' && found.role !== 'referee') {
      setErrorMsg(
        'Tài khoản này không có quyền đăng nhập vào khu vực điều hành Ban Tổ Chức / Trọng tài.',
      );
      return;
    }

    setErrorMsg(null);
    onLoginSuccess(found);
  };

  const handleCreateAccountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setCreateFeedback('Chỉ tài khoản Admin mới có quyền tạo tài khoản mới.');
      return;
    }
    const u = newUsername.trim().toLowerCase();
    const p = newPassword.trim();
    const name = newDisplayName.trim();

    if (!u || !p || !name) {
      setCreateFeedback('Vui lòng nhập đủ Tên hiển thị, Tên đăng nhập và Mật khẩu.');
      return;
    }

    const exists = accounts.some((a) => a.username.trim().toLowerCase() === u);
    if (exists) {
      setCreateFeedback(`Tên đăng nhập "${u}" đã tồn tại. Vui lòng chọn tên khác.`);
      return;
    }

    onCreateAccount({
      username: u,
      password: p,
      displayName: name,
      role: newRole,
      assignedCourts:
        newAssignedCourts.trim() ||
        (newRole === 'admin' ? 'Toàn hệ thống' : 'Tất cả các sân'),
    });

    setNewUsername('');
    setNewPassword('');
    setNewDisplayName('');
    setCreateFeedback(`Đã tạo tài khoản ${ROLE_LABELS[newRole]} "${name}" (${u}).`);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-2xs p-3 sm:p-4 flex items-center justify-center overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border my-auto transition-colors ${
          isDark
            ? 'bg-slate-900 border-slate-800 text-slate-100'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div
          className={`px-4 sm:px-5 py-4 border-b flex items-center justify-between gap-3 ${
            isDark
              ? 'bg-slate-950/70 border-slate-800'
              : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={BRAND_LOGO_URL}
              alt="1986 Bính Dần Pickleball"
              referrerPolicy="no-referrer"
              className="w-10 h-10 rounded-xl object-cover border border-orange-500 shrink-0"
            />
            <div className="min-w-0">
              <h2 className="font-display text-base sm:text-lg font-extrabold uppercase tracking-tight truncate">
                ĐĂNG NHẬP ADMIN & TRỌNG TÀI 1986
              </h2>
              <p
                className={`text-xs truncate ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                Nhập tên đăng nhập và mật khẩu để truy cập hệ thống
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`min-h-[36px] min-w-[36px] rounded-lg flex items-center justify-center transition-colors ${
              isDark
                ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                : 'text-slate-400 hover:text-slate-800 hover:bg-slate-200/70'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher when logged in as Admin */}
        {isAdmin && (
          <div
            className={`px-4 sm:px-5 pt-3 border-b flex items-center gap-4 text-xs font-bold ${
              isDark ? 'border-slate-800' : 'border-slate-200'
            }`}
          >
            <button
              type="button"
              onClick={() => setActiveTab('login')}
              className={`pb-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'login'
                  ? 'border-orange-500 text-orange-500'
                  : isDark
                  ? 'border-transparent text-slate-400 hover:text-white'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Phiên đăng nhập</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('manage')}
              className={`pb-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'manage'
                  ? 'border-orange-500 text-orange-500'
                  : isDark
                  ? 'border-transparent text-slate-400 hover:text-white'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <UserCog className="w-3.5 h-3.5" />
              <span>Quản lý tài khoản ({accounts.length})</span>
            </button>
          </div>
        )}

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-4">
          {reasonMessage && (
            <div
              className={`p-3 rounded-xl border text-xs leading-relaxed ${
                isDark
                  ? 'bg-amber-950/50 border-amber-800/70 text-amber-200'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}
            >
              {reasonMessage}
            </div>
          )}

          {activeTab === 'login' ? (
            <>
              {currentAccount && (
                <div
                  className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                    isDark
                      ? 'bg-emerald-950/40 border-emerald-800/60'
                      : 'bg-emerald-50 border-emerald-200'
                  }`}
                >
                  <div className="min-w-0">
                    <div
                      className={`text-xs font-bold flex items-center gap-1.5 ${
                        isDark ? 'text-emerald-300' : 'text-emerald-900'
                      }`}
                    >
                      {currentAccount.role === 'admin' ? (
                        <ShieldCheck className="w-4 h-4 text-orange-500 shrink-0" />
                      ) : (
                        <Gavel className="w-4 h-4 text-emerald-500 shrink-0" />
                      )}
                      <span className="truncate">
                        Đang đăng nhập: {currentAccount.displayName} (
                        {ROLE_LABELS[currentAccount.role]})
                      </span>
                    </div>
                    <div
                      className={`text-[11px] mt-0.5 ${
                        isDark ? 'text-emerald-200/80' : 'text-emerald-700'
                      }`}
                    >
                      Tài khoản: {currentAccount.username} · Phạm vi:{' '}
                      {currentAccount.assignedCourts || 'Toàn hệ thống'}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={onLogout}
                    className={`min-h-[36px] px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors ${
                      isDark
                        ? 'bg-slate-900 hover:bg-rose-950/60 text-rose-300 border-rose-800/70'
                        : 'bg-white hover:bg-rose-50 text-rose-600 border-rose-200'
                    }`}
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Đăng xuất</span>
                  </button>
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="space-y-3.5">
                <div>
                  <label
                    className={`block text-xs font-semibold mb-1 ${
                      isDark ? 'text-slate-300' : 'text-slate-700'
                    }`}
                  >
                    Tên đăng nhập
                  </label>
                  <input
                    type="text"
                    autoFocus
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Nhập tên đăng nhập"
                    className={`w-full min-h-[42px] px-3.5 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                      isDark
                        ? 'bg-slate-950 border-slate-700 text-white placeholder:text-slate-500'
                        : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
                    }`}
                  />
                </div>

                <div>
                  <label
                    className={`block text-xs font-semibold mb-1 ${
                      isDark ? 'text-slate-300' : 'text-slate-700'
                    }`}
                  >
                    Mật khẩu
                  </label>
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Nhập mật khẩu"
                    className={`w-full min-h-[42px] px-3.5 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                      isDark
                        ? 'bg-slate-950 border-slate-700 text-white placeholder:text-slate-500'
                        : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
                    }`}
                  />
                </div>

                {errorMsg && (
                  <div
                    className={`p-3 rounded-xl border text-xs font-medium ${
                      isDark
                        ? 'bg-rose-950/60 border-rose-800 text-rose-200'
                        : 'bg-rose-50 border-rose-200 text-rose-700'
                    }`}
                  >
                    {errorMsg}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Đăng nhập Hệ thống</span>
                </button>
              </form>
            </>
          ) : (
            <div className="space-y-4">
              <form
                onSubmit={handleCreateAccountSubmit}
                className={`p-3.5 rounded-xl border space-y-3 ${
                  isDark
                    ? 'bg-slate-950/70 border-slate-800'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div
                  className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                    isDark ? 'text-slate-200' : 'text-slate-800'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5 text-orange-500" />
                  <span>Cấp tài khoản Admin hoặc Trọng tài mới</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label
                      className={`block text-[11px] font-semibold mb-1 ${
                        isDark ? 'text-slate-300' : 'text-slate-600'
                      }`}
                    >
                      Vai trò *
                    </label>
                    <select
                      value={newRole}
                      onChange={(e) => {
                        const r = e.target.value as 'admin' | 'referee';
                        setNewRole(r);
                        setNewAssignedCourts(
                          r === 'admin' ? 'Toàn hệ thống' : 'Sân 1 - Sân 2',
                        );
                      }}
                      className={`w-full min-h-[36px] px-2.5 py-1.5 text-xs font-semibold border rounded-lg ${
                        isDark
                          ? 'bg-slate-900 border-slate-700 text-white'
                          : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="referee">Trọng tài sân</option>
                      <option value="admin">Ban Tổ Chức (Admin)</option>
                    </select>
                  </div>

                  <div>
                    <label
                      className={`block text-[11px] font-semibold mb-1 ${
                        isDark ? 'text-slate-300' : 'text-slate-600'
                      }`}
                    >
                      Họ tên hiển thị *
                    </label>
                    <input
                      type="text"
                      value={newDisplayName}
                      onChange={(e) => setNewDisplayName(e.target.value)}
                      placeholder="VD: Trọng tài Nguyễn Văn A"
                      className={`w-full min-h-[36px] px-2.5 py-1.5 text-xs border rounded-lg ${
                        isDark
                          ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500'
                          : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
                      }`}
                    />
                  </div>

                  <div>
                    <label
                      className={`block text-[11px] font-semibold mb-1 ${
                        isDark ? 'text-slate-300' : 'text-slate-600'
                      }`}
                    >
                      Tên đăng nhập *
                    </label>
                    <input
                      type="text"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      placeholder="VD: trongtai3"
                      className={`w-full min-h-[36px] px-2.5 py-1.5 text-xs border rounded-lg ${
                        isDark
                          ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500'
                          : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
                      }`}
                    />
                  </div>

                  <div>
                    <label
                      className={`block text-[11px] font-semibold mb-1 ${
                        isDark ? 'text-slate-300' : 'text-slate-600'
                      }`}
                    >
                      Mật khẩu *
                    </label>
                    <input
                      type="text"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Đặt mật khẩu"
                      className={`w-full min-h-[36px] px-2.5 py-1.5 text-xs border rounded-lg ${
                        isDark
                          ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500'
                          : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label
                    className={`block text-[11px] font-semibold mb-1 ${
                      isDark ? 'text-slate-300' : 'text-slate-600'
                    }`}
                  >
                    Sân / Khu vực phụ trách
                  </label>
                  <input
                    type="text"
                    value={newAssignedCourts}
                    onChange={(e) => setNewAssignedCourts(e.target.value)}
                    placeholder="VD: Sân 3 - Sân 4 hoặc Toàn hệ thống"
                    className={`w-full min-h-[36px] px-2.5 py-1.5 text-xs border rounded-lg ${
                      isDark
                        ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500'
                        : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
                    }`}
                  />
                </div>

                {createFeedback && (
                  <div
                    className={`text-xs font-medium ${
                      isDark ? 'text-emerald-300' : 'text-emerald-700'
                    }`}
                  >
                    {createFeedback}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full min-h-[38px] px-3 py-2 rounded-lg bg-slate-900 hover:bg-orange-600 text-white text-xs font-bold transition-colors"
                >
                  + Tạo tài khoản
                </button>
              </form>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                <div
                  className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                    isDark ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Danh sách tài khoản hệ thống ({accounts.length})</span>
                </div>

                {accounts.map((acc) => {
                  const isSelf = currentAccount?.id === acc.id;
                  return (
                    <div
                      key={acc.id}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-2 text-xs ${
                        isDark
                          ? 'bg-slate-950/50 border-slate-800'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-bold flex items-center gap-1.5 flex-wrap">
                          <span>{acc.displayName}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              acc.role === 'admin'
                                ? 'bg-orange-500/15 text-orange-400'
                                : 'bg-emerald-500/15 text-emerald-400'
                            }`}
                          >
                            {ROLE_LABELS[acc.role]}
                          </span>
                        </div>
                        <div
                          className={`text-[11px] font-mono-num mt-0.5 ${
                            isDark ? 'text-slate-400' : 'text-slate-500'
                          }`}
                        >
                          TK: <strong>{acc.username}</strong> · MK:{' '}
                          <strong>{acc.password}</strong>
                        </div>
                        <div
                          className={`text-[11px] ${
                            isDark ? 'text-slate-500' : 'text-slate-400'
                          }`}
                        >
                          Phụ trách: {acc.assignedCourts || 'Toàn hệ thống'}
                        </div>
                      </div>

                      {!isSelf && (
                        <button
                          type="button"
                          onClick={() => onDeleteAccount(acc.id)}
                          title="Xóa tài khoản"
                          className={`min-h-[34px] min-w-[34px] rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                            isDark
                              ? 'text-rose-400 hover:bg-rose-950/60'
                              : 'text-rose-600 hover:bg-rose-50'
                          }`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
