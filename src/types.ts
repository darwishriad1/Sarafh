/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Cashier {
  id: string;
  name: string;
  username: string;
  pinCode: string; // 4-digit code
  isActive: boolean;
  payoutPoint?: string;
  phone?: string;
  privileges?: string; // e.g. "كاملة" | "محدودة"
}

export interface Individual {
  militaryId: string; // unique, used as document ID
  fullName: string;
  unit: string;
  battalion?: string; // Battalion (الكتيبة)
  company?: string; // Company (السرية)
  platoon?: string; // Platoon (الفصيلة)
  avatarUrl?: string; // Optional avatar (الصورة الشخصية)
  entitledAmount: number;
  payoutStatus: 'pending' | 'received';
  lastReceivedDate?: string | null;
  assignedCashierId?: string | null; // For dedicated payout mode
  receivedAt?: string | null;
  receivedCashierId?: string | null;
  receivedCashierName?: string | null;
  receivedLocation?: string | null;
  receivedDevice?: string | null;
}

export interface OperationLog {
  id: string;
  individualId: string;
  individualName: string;
  individualMilitaryId: string;
  cashierId: string;
  cashierName: string;
  amount: number;
  timestamp: string;
  location: string;
  device: string;
  type: 'payout' | 'cancel' | 'edit' | 'backup_restore' | 'alert';
  performedBy: 'cashier' | 'admin';
  details: string;
}
