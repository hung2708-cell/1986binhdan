function loadSavedAuthAccount(accounts: StaffAccount[]): StaffAccount | null {
  try {
    const savedId = localStorage.getItem(AUTH_SESSION_KEY);
    if (!savedId) return null;
    const found = accounts.find((a) => a.id === savedId) || null;
    if (!found || (found.role !== 'admin' && found.role !== 'referee')) {
      return null;
    }
    return found;
  } catch {
    return null;
  }
}
