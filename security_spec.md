# Security Specification for Individual Payout Management System

This specification outlines the data invariants and access controls governing the payout distribution application. Crucially, the system restricts state changes and blocks double-distribution vulnerabilities.

## 1. Core Data Invariants

1. **Unique Military IDs**: `individuals` are uniquely keyed by their `militaryId` (Arabic: الرقم العسكري). Every military document ID is identical to the target individual's `militaryId`.
2. **Strict Double Payout Prevention**: Once an individual is marked as `"received"` (تم الاستلام), the document is locked against nested cashier edits. Only the verified Admin is allowed to reset the payout status back to `"pending"` or cancel the operation.
3. **No Self-Registration or Role Spoofing**: Cashiers cannot self-register, edit other cashiers, or elevate their privileges to administrators.
4. **GPS Integrity**: Payout transactions must include coordinates when recorded online.
5. **Timestamp Immutability**: `createdAt` and `receivedAt` fields must always be verified using server-measured timestamps (`request.time`) to avoid clock-tampering on client devices.

---

## 2. The "Dirty Dozen" Malicious Payloads

Here are twelve hostile scenarios and payload payloads designed to test rules and verify they are rejected with `PERMISSION_DENIED`:

### Payload 1: Cashier attempts to bypass authentication
* **Goal**: Write to `/individuals/M998` without an active auth session (`request.auth == null`).
* **Expected Result**: `PERMISSION_DENIED`

### Payload 2: Cashier attempts to change another Cashier's PIN
* **Goal**: Modify other cashiers' configurations or deactivate them.
* **Payload**: `update` on `/cashiers/cashier_a` with a modified `pinCode` field by `cashier_b`.
* **Expected Result**: `PERMISSION_DENIED`

### Payload 3: Double Payout Attack (State Shortcutting)
* **Goal**: Overwrite an already received individual's payout status back to `"pending"`.
* **Payload**: `update` on `/individuals/M881` where `existing().payoutStatus == "received"` to make it `"pending"` by a non-admin.
* **Expected Result**: `PERMISSION_DENIED`

### Payload 4: Fake GPS Spoof (Field Injection)
* **Goal**: Record a payout without location fields or with oversized location parameters (exceeding 128 characters).
* **Payload**: `update` with `receivedLocation: "x".repeat(200)`
* **Expected Result**: `PERMISSION_DENIED`

### Payload 5: Cashier role escalation
* **Goal**: Cashier attempts to add their email to the authorized admin list in Firestore.
* **Payload**: Write to `/admins/attacker_uid` with role `'admin'`.
* **Expected Result**: `PERMISSION_DENIED`

### Payload 6: Altering Historic Operations Logs
* **Goal**: A malicious cashier tries to erase or alter their previous payouts from the log to obscure double spending.
* **Payload**: `update` or `delete` on `/operations/payout_rec_102`.
* **Expected Result**: `PERMISSION_DENIED`

### Payload 7: Bypassing Verified Email Checks for Admin Actions
* **Goal**: Attempt to execute an admin action (e.g., reset an individual's status) using a spoofed login where `email_verified == false`.
* **Expected Result**: `PERMISSION_DENIED`

### Payload 8: Bulk Scraping (Blanket Reads on PII)
* **Goal**: Unauthenticated or normal clients trying to fetch all individual profile metrics at once without target filters.
* **Payload**: Unrestricted `list` queries of `/individuals` without verified session.
* **Expected Result**: `PERMISSION_DENIED`

### Payload 9: Client Time Hijacking
* **Goal**: Deliver a payout but set `receivedAt` to a historical or future date to disrupt daily/monthly reports.
* **Payload**: `update` where `receivedAt` is set to `"2025-01-01T00:00:00Z"` instead of `request.time`.
* **Expected Result**: `PERMISSION_DENIED`

### Payload 10: Injecting Shadow Fields into Operations Log
* **Goal**: Add an unrequested system status field inside the operation log to bypass standard filters.
* **Payload**: `create` on `/operations/op_new` containing `ghostField: "privilege_escalation"`.
* **Expected Result**: `PERMISSION_DENIED` (due to `.keys().size()` checks)

### Payload 11: Attempting to Disburse to an Individual with Invalid Military ID Format
* **Goal**: Feed junk characters as document path parameters to cause resource saturation or memory leaks.
* **Payload**: `create`/`update` on `/individuals/MILITARY%%%$$$###999---JUNK`
* **Expected Result**: `PERMISSION_DENIED`

### Payload 12: Bypassing Dedicated Allocation (Dedicated Payout Breach)
* **Goal**: Cashier `cashier_A` attempts to disburse funds to an individual specifically assigned to `cashier_B`.
* **Payload**: `update` where `assignedCashierId == "cashier_B"` by `cashier_A` under "dedicated" mode.
* **Expected Result**: `PERMISSION_DENIED`

---

## 3. Test Runner Definition

The rules file `firestore.rules` enforces these blocks. Tests are run through mock security queries simulating the Firestore emulator behavior. Any write that breaks these invariants will trigger `PERMISSION_DENIED`.
