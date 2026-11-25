import React, { useMemo, useState } from 'react';
import {
  Gavel,
  KeyRound,
  LogIn,
  LogOut,
  Plus,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import {
  BRAND_LOGO_URL,
  ROLE_LABELS,
  type StaffAccount,
  type StaffRole,
} from '../types/tournament';

export const DEFAULT_ADMIN_PASSWORD = '1986';
export const DEFAULT_REFEREE_PASSWORD = 'tt1234';

interface StaffAuthModalProps {
  accounts: StaffAccount[];
  currentAccount: StaffAccount | null;
  initialMode?: 'login' | 'manage';
  reasonMessage?: string | null;
  onClose: () => void;
  onLoginSuccess: (account: StaffAccount) => void;
  onLogout: () => void;
  onCreateAccount: (payload: Omit<StaffAccount, 'id'>) => void;
  onDeleteAccount: (accountId: string) => void;
}

function getDefaultPasswordForRole(role: StaffRole): string {
  return role === 'admin' ? DEFAULT_ADMIN_PASSWORD : DEFAULT_REFEREE_PASSWORD;
}

function getExpectedPassword(account: StaffAccount): string {
  if (account.password && account.password.trim().length > 0) {
    return account.password.trim();
  }
  return getDefaultPasswordForRole(account.role);
}

export const StaffAuthModal: React.FC<StaffAuthModalProps> = ({
  accounts,
  currentAccount,
  initialMode = 'login',
  reasonMessage,
  onClose,
  onLoginSuccess,
  onLogout,
  onCreateAccount,
  onDeleteAccount,
}) => {
  const [tab, setTab] = useState<'login' | 'manage'>(
    currentAccount?.role === 'admin' && initialMode === 'manage' ? 'manage' : 'login',
  );
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Create new account state (Admin mặc định 1986, Trọng tài mặc định tt1234)
  const [newUsername, setNewUsername] = useState('');
  const [newRole, setNewRole] = useState<StaffRole>('referee');
  const [newPassword, setNewPassword] = useState<string>(DEFAULT_REFEREE_PASSWORD);
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newCourts, setNewCourts] = useState('Sân 1, Sân 2');
  const [createSuccessMsg, setCreateSuccessMsg] = useState<string | null>(null);

  const staffAccounts = useMemo(
    () => accounts.filter((acc) => acc.role === 'admin' || acc.role === 'referee'),
    [accounts],
  );

  const handleRoleChange = (role: StaffRole) => {
    setNewRole(role);
    setNewPassword(getDefaultPasswordForRole(role));
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password.trim();

    const found = staffAccounts.find((a) => a.username.toLowerCase() === cleanUser);
    if (!found) {
      setErrorMsg('Tên đăng nhập hoặc mật khẩu không đúng.');
      return;
    }

    const expectedPass = getExpectedPassword(found);
    if (cleanPass !== expectedPass) {
      setErrorMsg('Tên đăng nhập hoặc mật khẩu không đúng.');
      return;
    }

    setErrorMsg(null);
    onLoginSuccess({
      ...found,
      password: expectedPass,
    });
    onClose();
  };

  const handleQuickLogin = (acc: StaffAccount) => {
    if (acc.role !== 'admin' && acc.role !== 'referee') {
      setErrorMsg('Chỉ tài khoản Admin hoặc Trọng tài mới được phép đăng nhập.');
      return;
    }
    const resolvedPass = getExpectedPassword(acc);
    setUsername(acc.username);
    setPassword(resolvedPass);
    setErrorMsg(null);
    onLoginSuccess({
      ...acc,
      password: resolvedPass,
    });
    onClose();
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentAccount?.role !== 'admin') {
      setErrorMsg('Chỉ tài khoản Ban Tổ Chức (Admin) mới được phép tạo thêm tài khoản.');
      return;
    }
    const cleanU = newUsername.trim().toLowerCase();
    const cleanD = newDisplayName.trim();
    const resolvedPass = newPassword.trim() || getDefaultPasswordForRole(newRole);

    if (!cleanU || !cleanD) {
      setErrorMsg('Vui lòng nhập đầy đủ Tên đăng nhập và Họ tên.');
      return;
    }
    if (staffAccounts.some((a) => a.username.toLowerCase() === cleanU)) {
      setErrorMsg(`Tên đăng nhập "${cleanU}" đã tồn tại.`);
      return;
    }

    onCreateAccount({
      username: cleanU,
      password: resolvedPass,
      displayName: cleanD,
      role: newRole,
      assignedCourts: newCourts.trim() || 'Tất cả các sân',
    });

    setNewUsername('');
    setNewDisplayName('');
    setNewPassword(getDefaultPasswordForRole(newRole));
    setErrorMsg(null);
    setCreateSuccessMsg(`Đã tạo tài khoản "${cleanU}" (${ROLE_LABELS[newRole]}).`);
    window.setTimeout(() => setCreateSuccessMsg(null), 3500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full overflow-hidden shadow-xl">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={BRAND_LOGO_URL}
              alt="1986 Pickleball"
              referrerPolicy="no-referrer"
              className="w-9 h-9 rounded-lg object-cover border border-orange-300"
            />
            <div>
              <h3 className="font-display text-lg font-bold tracking-tight text-slate-900 uppercase">
                ĐĂNG NHẬP ADMIN & TRỌNG TÀI 1986
              </h3>
              <p className="text-xs text-slate-500">
                Hệ thống chỉ cấp quyền đăng nhập cho Admin và Trọng tài
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/60"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switch Tabs */}
        <div className="px-5 pt-3 bg-white border-b border-slate-200 flex items-center gap-4 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setTab('login');
              setErrorMsg(null);
            }}
            className={`pb-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${
              tab === 'login'
                ? 'border-orange-600 text-orange-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            Đăng nhập / Đổi tài khoản
          </button>

          <button
            type="button"
            onClick={() => {
              setTab('manage');
              setErrorMsg(null);
            }}
            className={`pb-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${
              tab === 'manage'
                ? 'border-orange-600 text-orange-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            Quản lý tài khoản ({staffAccounts.length})
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {reasonMessage && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 font-medium">
              🔒 {reasonMessage}
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
              {errorMsg}
            </div>
          )}

          {createSuccessMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 font-medium">
              ✓ {createSuccessMsg}
            </div>
          )}

          {/* Current Logged-in Status Banner */}
          {currentAccount && (
            <div className="p-3.5 rounded-xl bg-slate-900 text-white flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] text-orange-400 font-bold uppercase">
                  Đang đăng nhập: {ROLE_LABELS[currentAccount.role]}
                </div>
                <div className="text-sm font-bold truncate">{currentAccount.displayName}</div>
                <div className="text-xs text-slate-400">
                  TK: <span className="font-mono-num text-white">{currentAccount.username}</span> ·{' '}
                  {currentAccount.assignedCourts}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onLogout();
                  onClose();
                }}
                className="min-h-[38px] px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
                Đăng xuất
              </button>
            </div>
          )}

          {tab === 'login' ? (
            <>
              <form onSubmit={handleLoginSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tên đăng nhập
                  </label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Nhập tên đăng nhập"
                    className="w-full min-h-[42px] px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mật khẩu
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Nhập mật khẩu"
                    className="w-full min-h-[42px] px-3.5 py-2 text-sm font-mono-num border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  Đăng nhập Hệ thống
                </button>
              </form>

              {/* Quick One-Tap Login Cards */}
              <div className="pt-3 border-t border-slate-200 space-y-2.5">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Tài khoản Admin & Trọng tài
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {staffAccounts.map((acc) => {
                    const isCurrent = currentAccount?.id === acc.id;
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => handleQuickLogin(acc)}
                        className={`w-full text-left p-3 rounded-xl border transition-colors flex items-center justify-between gap-3 ${
                          isCurrent
                            ? 'bg-orange-50 border-orange-500'
                            : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {acc.role === 'admin' ? (
                            <ShieldCheck className="w-5 h-5 text-orange-600 shrink-0" />
                          ) : (
                            <Gavel className="w-5 h-5 text-emerald-600 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-900 truncate">
                              {acc.displayName}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              TK: <span className="font-mono-num font-bold text-slate-800">{acc.username}</span> ·{' '}
                              {acc.assignedCourts}
                            </div>
                          </div>
                        </div>

                        <span
                          className={`text-[11px] font-bold px-2.5 py-1 rounded-lg shrink-0 ${
                            acc.role === 'admin'
                              ? 'bg-orange-600 text-white'
                              : 'bg-emerald-600 text-white'
                          }`}
                        >
                          {acc.role === 'admin' ? 'Admin' : 'Trọng tài'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            /* TAB 2: CREATE & MANAGE ACCOUNTS */
            <div className="space-y-4">
              {currentAccount?.role !== 'admin' ? (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2">
                  <div className="font-bold">Yêu cầu quyền Admin</div>
                  <p>
                    Vui lòng đăng nhập tài khoản <strong>Admin</strong> để tạo hoặc xóa tài khoản.
                  </p>
                  <button
                    type="button"
                    onClick={() => setTab('login')}
                    className="px-3 py-1.5 bg-orange-600 text-white font-bold rounded-lg"
                  >
                    Chuyển sang tab Đăng nhập
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={handleCreateSubmit}
                  className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3"
                >
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <Plus className="w-4 h-4 text-orange-600" />
                    Tạo tài khoản Admin hoặc Trọng tài
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Vai trò *
                      </label>
                      <select
                        value={newRole}
                        onChange={(e) => handleRoleChange(e.target.value as StaffRole)}
                        className="w-full min-h-[40px] px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="referee">Trọng tài</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Sân phụ trách
                      </label>
                      <input
                        type="text"
                        value={newCourts}
                        onChange={(e) => setNewCourts(e.target.value)}
                        placeholder="Nhập sân phụ trách"
                        className="w-full min-h-[40px] px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Họ và tên *
                      </label>
                      <input
                        type="text"
                        required
                        value={newDisplayName}
                        onChange={(e) => setNewDisplayName(e.target.value)}
                        placeholder="Nhập họ và tên"
                        className="w-full min-h-[40px] px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Tên đăng nhập *
                      </label>
                      <input
                        type="text"
                        required
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        placeholder="Nhập tên đăng nhập"
                        className="w-full min-h-[40px] px-3 py-1.5 text-xs font-mono-num border border-slate-300 rounded-lg bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Mật khẩu *
                      </label>
                      <input
                        type="password"
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Nhập mật khẩu"
                        className="w-full min-h-[40px] px-3 py-1.5 text-xs font-mono-num border border-slate-300 rounded-lg bg-white"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full min-h-[42px] py-2 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <UserPlus className="w-4 h-4" />
                    Lưu tài khoản
                  </button>
                </form>
              )}

              {/* Account Directory List */}
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Danh sách tài khoản ({staffAccounts.length})
                </div>
                <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
                  {staffAccounts.map((acc) => (
                    <div
                      key={acc.id}
                      className="p-3 bg-white flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 truncate">
                          {acc.displayName}
                        </div>
                        <div className="text-slate-500">
                          TK: <strong className="font-mono-num text-slate-800">{acc.username}</strong> ·{' '}
                          {ROLE_LABELS[acc.role]} ({acc.assignedCourts})
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleQuickLogin(acc)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold flex items-center gap-1"
                        >
                          <UserCheck className="w-3.5 h-3.5 text-orange-600" />
                          Dùng
                        </button>
                        {currentAccount?.role === 'admin' && staffAccounts.length > 1 && (
                          <button
                            type="button"
                            onClick={() => onDeleteAccount(acc.id)}
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50"
                            title="Xóa tài khoản"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
