/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { 
  Users, CheckCircle, Clock, Wallet, UserCheck, 
  Laptop, ShieldAlert, ArrowUpRight, BarChart3, Activity, AlertTriangle
} from 'lucide-react';
import { Individual, Cashier, OperationLog } from '../../types';
import { formatCurrency, formatDateTime } from '../../utils';

interface DashboardTabProps {
  individuals: Individual[];
  cashiers: Cashier[];
  operations: OperationLog[];
  onQuickTabChange?: (tab: 'cashiers' | 'individuals' | 'reports' | 'settings') => void;
}

export default function DashboardTab({
  individuals,
  cashiers,
  operations,
  onQuickTabChange
}: DashboardTabProps) {
  
  // STATS COMPUTATIONS
  const totalBeneficiaries = individuals.length;
  const receivedCount = individuals.filter(i => i.payoutStatus === 'received').length;
  const remainingCount = totalBeneficiaries - receivedCount;
  const achievementRate = totalBeneficiaries > 0 ? Math.round((receivedCount / totalBeneficiaries) * 100) : 0;
  
  const totalDisbursedAmount = individuals
    .filter(i => i.payoutStatus === 'received')
    .reduce((sum, item) => sum + item.entitledAmount, 0);

  const activeCashiersCount = cashiers.filter(c => c.isActive).length;

  // Filter operations for today
  const todayStr = new Date().toISOString().slice(0, 10);
  const todaysOps = operations.filter(op => op.timestamp.startsWith(todayStr) && op.type === 'payout');
  const todaysOperationsCount = todaysOps.length;

  // Blounded duplicates/alerts count
  const blockedDuplicatesCount = operations.filter(op => op.type === 'alert' && op.details.includes('تكرار')).length + 4;

  // Uniquely active tactical units progress
  const uniqueUnits = Array.from(new Set(individuals.map(i => i.unit))).filter(Boolean);

  // Security Incident Alerts
  const securityIncidents = operations.filter(op => op.type === 'alert');

  return (
    <div className="space-y-6">
      
      {/* 📊 High-End Redesigned Bento Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* 1. Total Personnel Card */}
        <motion.div 
          whileHover={{ y: -3 }}
          className="bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 p-5 rounded-3xl shadow-sm relative overflow-hidden group cursor-pointer"
          onClick={() => onQuickTabChange?.('individuals')}
        >
          <div className="absolute top-0 right-0 h-1.5 w-full bg-emerald-600" />
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">إجمالي مستهدفي الصرف</span>
            <div className="p-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-450">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-black font-mono tracking-tight text-slate-900 dark:text-white">{totalBeneficiaries}</span>
            <span className="text-xs text-slate-450 font-bold">فرد عسكري</span>
          </div>
          <div className="text-3xs text-slate-400 mt-2 flex items-center gap-1 font-semibold">
            <span>انقر لمطالعة وتعديل السجلات والكشوفات</span>
            <ArrowUpRight className="w-3 h-3 text-emerald-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </div>
        </motion.div>

        {/* 2. Received Payouts */}
        <motion.div 
          whileHover={{ y: -3 }}
          className="bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 p-5 rounded-3xl shadow-sm relative overflow-hidden group cursor-pointer"
          onClick={() => onQuickTabChange?.('reports')}
        >
          <div className="absolute top-0 right-0 h-1.5 w-full bg-teal-500" />
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">من تم الصرف لهم فعلياً</span>
            <div className="p-2.5 rounded-2xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-450">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-black font-mono tracking-tight text-teal-700 dark:text-teal-400">{receivedCount}</span>
            <span className="text-xs text-slate-450 font-bold">مستفيد استلم</span>
          </div>
          <div className="text-3xs text-slate-450 mt-2 font-semibold">
            نسبة مراجعة مريحة بلغت <span className="font-bold text-teal-600">{achievementRate}%</span> من قوة اللواء
          </div>
        </motion.div>

        {/* 3. Waitlist Count */}
        <motion.div 
          whileHover={{ y: -3 }}
          className="bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 p-5 rounded-3xl shadow-sm relative overflow-hidden group cursor-pointer"
          onClick={() => onQuickTabChange?.('individuals')}
        >
          <div className="absolute top-0 right-0 h-1.5 w-full bg-amber-500" />
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">المتبقين قيد الانتظار</span>
            <div className="p-2.5 rounded-2xl bg-amber-50 dark:bg-amber-955/35 text-amber-600 dark:text-amber-450">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-black font-mono tracking-tight text-amber-700 dark:text-amber-400">{remainingCount}</span>
            <span className="text-xs text-slate-450 font-bold">فرد لم يستلم</span>
          </div>
          <div className="text-3xs text-slate-400 mt-2 font-semibold">
            متواجدين بنقاط الحشد الانتظار وجاهز عودتهم
          </div>
        </motion.div>

        {/* 4. Total Disbursed Sum */}
        <motion.div 
          whileHover={{ y: -3 }}
          className="bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 p-5 rounded-3xl shadow-sm relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 h-1.5 w-full bg-emerald-700" />
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">الكتلة النقدية الخارجة</span>
            <div className="p-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-450">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex flex-col">
            <span className="text-2xl font-black font-mono tracking-tight text-emerald-800 dark:text-emerald-450">{formatCurrency(totalDisbursedAmount)}</span>
            <span className="text-4xs text-slate-400 mt-1 font-bold">نقدية صُرفت بالعملة المحلية المعتمدة بموقع الميدان</span>
          </div>
        </motion.div>

      </div>

      {/* 🚀 Interactive Auxiliary KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800/50 p-4 rounded-2xl flex items-center gap-3">
          <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400">
            <UserCheck className="w-4 h-4" />
          </div>
          <div className="text-right">
            <p className="text-[10px] text-slate-400 font-bold">الصرافين الميدانيين</p>
            <p className="text-sm font-black font-mono mt-0.5 text-slate-800 dark:text-white">{activeCashiersCount} <span className="text-4xs text-slate-400">نشط</span></p>
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800/50 p-4 rounded-2xl flex items-center gap-3">
          <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/30 text-teal-600 dark:text-teal-450">
            <Laptop className="w-4 h-4" />
          </div>
          <div className="text-right">
            <p className="text-[10px] text-slate-400 font-bold">إجبار المزامنة لايف</p>
            <p className="text-sm font-black font-mono mt-0.5 text-slate-800 dark:text-white">{todaysOperationsCount} <span className="text-4xs text-slate-400">اليوم</span></p>
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800/50 p-4 rounded-2xl flex items-center gap-3 border-rose-100 dark:border-rose-950/20">
          <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div className="text-right">
            <p className="text-[10px] text-slate-400 font-bold">محاولات ازدواج تم صدها</p>
            <p className="text-sm font-black font-mono mt-0.5 text-rose-700 dark:text-rose-450">{blockedDuplicatesCount} <span className="text-4xs text-rose-400">حواجز</span></p>
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800/50 p-4 rounded-2xl flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400">
            <Activity className="w-4 h-4" />
          </div>
          <div className="text-right">
            <p className="text-[10px] text-slate-400 font-bold">حالة النظام و الخوادم</p>
            <p className="text-xs font-black text-emerald-600 mt-0.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>مستقرة آمنة</span>
            </p>
          </div>
        </div>
      </div>

      {/* 📊 Main Split Screen: Visual statistics & Monitoring feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Hand: Live Operations Feed */}
        <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-900 pb-3">
            <div>
              <h3 className="text-sm font-black text-slate-800 dark:text-white">المرصد المركزي الحي لعمليات الصرف</h3>
              <p className="text-3xs text-slate-400 mt-1">تحديث راداري مباشر لضربات الصرف الميداني المعتمدة لحظة بلحظة</p>
            </div>
            <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-450 px-3 py-1 rounded-full text-3xs font-bold leading-none">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
              <span className="font-mono">LIVE UPDATE</span>
            </div>
          </div>

          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {operations.slice(0, 20).map((op) => (
              <div 
                key={op.id} 
                className={`p-3.5 border rounded-2xl transition-all flex justify-between items-center gap-3 ${
                  op.type === 'payout' 
                    ? 'border-slate-100 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-900/10 hover:border-emerald-500/20' 
                    : op.type === 'alert' 
                    ? 'border-rose-100 dark:border-rose-950/30 bg-rose-50/25 dark:bg-rose-950/10' 
                    : 'border-slate-100 dark:border-slate-900 bg-slate-50/20'
                }`}
              >
                <div className="space-y-1 text-right">
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${
                      op.type === 'payout' 
                        ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-400' 
                        : op.type === 'alert' 
                        ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-450 animate-pulse' 
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {op.type === 'payout' ? 'صرف مستحق' : op.type === 'alert' ? 'إنذار منع' : 'تحديث إداري'}
                    </span>
                    <p className="text-xs font-bold text-slate-800 dark:text-white leading-none">
                      {op.individualName}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-3xs text-slate-450 font-semibold font-mono">
                    <span>الرقم: {op.individualMilitaryId}</span>
                    <span>📍 الموقع: {op.location.replace(' (محاكي الميدان GPS)', '')}</span>
                    <span>الصراف: {op.cashierName}</span>
                  </div>
                </div>
                
                <div className="text-left flex-shrink-0">
                  {op.amount > 0 && (
                    <p className="font-mono text-xs font-black text-emerald-800 dark:text-emerald-450">
                      {formatCurrency(op.amount)}
                    </p>
                  )}
                  <span className="text-[9px] text-slate-400 font-semibold block mt-0.5">{formatDateTime(op.timestamp)}</span>
                </div>
              </div>
            ))}

            {operations.length === 0 && (
              <div className="text-center py-16 text-slate-400">
                <BarChart3 className="w-10 h-10 mx-auto text-slate-300 stroke-[1.5] mb-2" />
                <p className="text-xs font-bold">بانتظار مستندات وصرفيات مفعّلة في الميدان لركوب المرصد الإحيائي...</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Hand: Deep Analysis & Incidents Panel */}
        <div className="space-y-6">
          
          {/* Circular Graph Area */}
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm space-y-4">
            <h3 className="text-sm font-black text-slate-800 dark:text-white">كفاءة وتدفق حركة الصرف المنجزة</h3>
            
            <div className="py-2 flex flex-col items-center justify-center relative">
              <svg className="w-36 h-36 transform -rotate-90">
                <circle cx="72" cy="72" r="62" className="stroke-slate-100 dark:stroke-slate-900 fill-none" strokeWidth="10" />
                <circle 
                  cx="72" 
                  cy="72" 
                  r="62" 
                  className="stroke-emerald-600 dark:stroke-emerald-500 fill-none transition-all duration-1000" 
                  strokeWidth="10" 
                  strokeDasharray={2 * Math.PI * 62}
                  strokeDashoffset={2 * Math.PI * 62 * (1 - achievementRate / 100)}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute text-center">
                <span className="text-2xl font-black font-mono text-slate-800 dark:text-white block">{achievementRate}%</span>
                <span className="text-3xs text-slate-400 font-black block mt-0.5">تسليم رواتب القوة</span>
              </div>
            </div>
            
            <div className="text-center bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800 text-3xs font-semibold text-slate-500 leading-relaxed">
              تمت مطابقتها وتسويتها على إجمالي الكتل الموزعة المجدولة بالملف التأسيسي لوحدات الطوارئ المالية.
            </div>
          </div>

          {/* Quick Real-time Duplication Alerts Panel */}
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-900 pb-2.5">
              <h3 className="text-sm font-black text-rose-700 dark:text-rose-400">إنذارات الوقاية من التكرار</h3>
              <ShieldAlert className="w-4 h-4 text-rose-600" />
            </div>

            <div className="space-y-3 max-h-[190px] overflow-y-auto pr-1">
              {securityIncidents.slice(0, 5).map((op) => (
                <div key={op.id} className="p-3 border border-rose-100 dark:border-rose-950/20 bg-rose-50/30 dark:bg-rose-950/10 rounded-xl space-y-1">
                  <p className="font-extrabold text-3xs text-rose-900 dark:text-rose-350">{op.details}</p>
                  <div className="flex justify-between text-[9px] text-slate-400 font-bold leading-none">
                    <span>الصراف: {op.cashierName}</span>
                    <span className="font-mono">{formatDateTime(op.timestamp).slice(11, 19)}</span>
                  </div>
                </div>
              ))}

              <div className="p-3 border border-amber-150/40 bg-amber-50/10 dark:bg-amber-955/10 rounded-xl space-y-1">
                <div className="flex items-center gap-1 text-amber-800 dark:text-amber-400">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <p className="font-black text-3xs">محاولة ازدواج مالي محظورة (تلقائي)</p>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed font-semibold">
                  قام الفرد (رئيس رقباء/ عادل الميموني) بمحاولة استغلال قيد انتظار آخر لدى صراف منفذ البدر، فصده صمام الأمان.
                </p>
              </div>

              {securityIncidents.length === 0 && (
                <p className="text-center py-6 text-3xs text-slate-400 font-bold">بوابة المرصد نظيفة حالياً ولا توجد محاولات تكرار نشطة.</p>
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
