/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Individual, Cashier } from '../types';

export const DEMO_INDIVIDUALS: Individual[] = [
  {
    militaryId: "120401",
    fullName: "فيصل بن مساعد الحربي",
    unit: "كتيبة المشاة السادسة",
    battalion: "الكتيبة الأولى مشاة",
    company: "السرية الأولى",
    entitledAmount: 2500,
    payoutStatus: "pending",
    assignedCashierId: "cashier_1"
  },
  {
    militaryId: "120402",
    fullName: "سعد بن عبدالله الشهراني",
    unit: "اللواء الملكي المدرع",
    battalion: "الكتيبة الثانية مدرعة",
    company: "السرية الثالثة",
    entitledAmount: 3000,
    payoutStatus: "pending",
    assignedCashierId: "cashier_1"
  },
  {
    militaryId: "120403",
    fullName: "ماجد بن عبدالعزيز الهذلي",
    unit: "كتيبة الدعم الفني والإشارة",
    battalion: "كتيبة الدعم المدرعة",
    company: "سرية القيادة والاتصال",
    entitledAmount: 2800,
    payoutStatus: "pending",
    assignedCashierId: "cashier_2"
  },
  {
    militaryId: "120404",
    fullName: "عبدالرحمن بن خالد المطيري",
    unit: "سلاح المدفعية الملكي",
    battalion: "كتيبة المدفعية الميدانية",
    company: "السرية الرابعة",
    entitledAmount: 3500,
    payoutStatus: "pending",
    assignedCashierId: "cashier_2"
  },
  {
    militaryId: "120405",
    fullName: "نايف بن محمد الدوسري",
    unit: "كتيبة الدفاع الجوي الأولى",
    battalion: "كتيبة المدفعية الصاروخية",
    company: "السرية الثانية",
    entitledAmount: 2200,
    payoutStatus: "pending",
    assignedCashierId: null // General payout officer
  },
  {
    militaryId: "120406",
    fullName: "سليمان بن علي العنزي",
    unit: "كتيبة المشاة السادسة",
    battalion: "الكتيبة الأولى مشاة",
    company: "السرية الثانية",
    entitledAmount: 2500,
    payoutStatus: "pending",
    assignedCashierId: null
  },
  {
    militaryId: "120407",
    fullName: "بندر بن وليد القحطاني",
    unit: "اللواء الملكي المدرع",
    battalion: "الكتيبة الثانية مدرعة",
    company: "السرية الأولى",
    entitledAmount: 3000,
    payoutStatus: "pending",
    assignedCashierId: "cashier_1"
  },
  {
    militaryId: "120408",
    fullName: "أحمد بن ياسين الغامدي",
    unit: "كتيبة الدعم الفني والإشارة",
    battalion: "كتيبة الدعم المدرعة",
    company: "السرية الثانية",
    entitledAmount: 4000,
    payoutStatus: "pending",
    assignedCashierId: "cashier_2"
  },
  {
    militaryId: "120409",
    fullName: "مشاري بن هزاع العتيبي",
    unit: "سلاح المدفعية الملكي",
    battalion: "كتيبة المدفعية الميدانية",
    company: "السرية الأولى",
    entitledAmount: 2700,
    payoutStatus: "pending",
    assignedCashierId: null
  },
  {
    militaryId: "120410",
    fullName: "سلطان بن فهد الشمري",
    unit: "كتيبة الدفاع الجوي الأولى",
    battalion: "كتيبة المدفعية الصاروخية",
    company: "السرية الثالثة",
    entitledAmount: 3200,
    payoutStatus: "pending",
    assignedCashierId: null
  },
  {
    militaryId: "120411",
    fullName: "فواز بن عادل البقمي",
    unit: "اللواء الملكي المدرع",
    battalion: "الكتيبة الثانية مدرعة",
    company: "السرية الثانية",
    entitledAmount: 2500,
    payoutStatus: "pending",
    assignedCashierId: "cashier_1"
  },
  {
    militaryId: "120412",
    fullName: "خالد بن سعيد السهلي",
    unit: "كتيبة المشاة السادسة",
    battalion: "الكتيبة الأولى مشاة",
    company: "السرية الثالثة",
    entitledAmount: 3100,
    payoutStatus: "pending",
    assignedCashierId: "cashier_2"
  }
];

export const DEMO_CASHIERS: Cashier[] = [
  {
    id: "cashier_1",
    name: "ملازم أول/ فهد العتيبي",
    username: "fahad",
    pinCode: "1234",
    isActive: true,
    payoutPoint: "مقر الرويس العسكري"
  },
  {
    id: "cashier_2",
    name: "رقيب أول/ صالح العسيري",
    username: "saleh",
    pinCode: "5678",
    isActive: true,
    payoutPoint: "ميدان التدريب الشرقي"
  }
];
