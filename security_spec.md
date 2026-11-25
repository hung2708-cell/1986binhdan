# 1986 Pickleball — Firestore Security Specification (Phase 0)

## 1. Data Invariants
1. **Identity & Privilege Invariant**: Users may only register their own `/users/{uid}` profile with `role == 'player'`. Role escalation to `referee` or `admin` is strictly gated by `isAdmin()` via trusted `/admins/{uid}` and `/referees/{uid}` collections and verified admin email (`hung.2708@gmail.com` with `email_verified == true`).
2. **PII Isolation Invariant**: Email and phone numbers are never stored on public documents (`/users/{uid}`, `/tournaments`, `/registrations`, `/matches`). PII resides solely in `/users/{uid}/private/info`, readable and writable only by the owner or an admin.
3. **Master Gate Relational Invariant**: Every `registration` and `match` under `/tournaments/{tournamentId}/...` must reference an existing parent tournament (`tournamentExists(tournamentId)`) and match its `tournamentId` field.
4. **Payment State Machine Invariant**: Athletes can only create registrations with `paymentStatus == 'unpaid'` and transition them from `unpaid` / `pending_review` to `pending_review` (with `transferRef`). Only `isAdmin()` can mark `paymentStatus == 'paid'`.
5. **Terminal State Locking Invariant**: Once a match reaches `status == 'completed'`, referees can no longer alter scores or outcomes; only `isAdmin()` has an override hatch for officiating corrections.
6. **Temporal & Volumetric Integrity**: All `createdAt` / `updatedAt` timestamps must strictly equal `request.time`. All string fields enforce explicit `.size()` ceilings and all document IDs match `^[a-zA-Z0-9_\-]+$`.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Role Self-Escalation**: Non-admin creating `/users/{uid}` with `role: "admin"`.
2. **Profile Role Hijack**: Non-admin updating own `/users/{uid}` with `role: "referee"`.
3. **Unverified Admin Email Spoof**: Token with `email: "hung.2708@gmail.com"` and `email_verified: false`.
4. **Cross-User PII Read**: User B calling `get` on `/users/userA/private/info`.
5. **Shadow Ghost Field Injection**: Updating `/tournaments/{t}/registrations/{r}` with extra key `isVip: true`.
6. **Self-Approved Payment**: Player updating own registration `paymentStatus` directly from `unpaid` to `paid`.
7. **Orphaned Registration**: Creating a registration under a non-existent `/tournaments/fake-id/registrations/r1`.
8. **ID Poisoning**: Creating a document with a 200-char ID or special characters `../admin`.
9. **Completed Match Tampering**: Non-admin referee updating `scoreA` on a match whose existing `status == 'completed'`.
10. **Value Poisoning on Score**: Referee updating `scoreA` to `"11"` (string) or `999` (out of range).
11. **Client Timestamp Forgery**: Creating a tournament or notification with a backdated `createdAt != request.time`.
12. **Unauthorized Notification Broadcast**: Regular player creating a `court_call` notification in `/notifications`.
