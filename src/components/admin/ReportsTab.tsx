/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  FileText, Download, Printer, Scroll, UserCheck, 
  Users, AlertTriangle, ShieldCheck, Clock, ShieldAlert, ClipboardList
} from 'lucide-react';
import { Individual, Cashier, OperationLog } from '../../types';
import { formatCurrency, formatDateTime, exportToCSV } from '../../utils';

interface ReportsTabProps {
  individuals: Individual[];
  cashiers: Cashier[];
  operations: OperationLog[];
  systemLogo: string;
  orgName: string;
  logSystemEvent: (details: string, type: 'payout' | 'cancel' | 'edit' | 'backup_restore' | 'alert') => Promise<void>;
}

type ReportType = 'daily' | 'unpaid' | 'cashiers' | 'events';

export default function ReportsTab({
  individuals,
  cashiers,
  operations,
  systemLogo,
  orgName,
  logSystemEvent
}: ReportsTabProps) {

  const [activeReport, setActiveReport] = useState<ReportType>('daily');

  // PRINT ACTION IN IFRAME WINDOW
  const handlePrintReport = async () => {
    try {
      await logSystemEvent(`طباعة وتصدير مستند ورقي رسمي: ${getReportTitle()}`, 'edit');
      window.print();
    } catch (e) {
      console.error(e);
    }
  };

  const getReportTitle = () => {
    if (activeReport === 'daily') return 'بيان حركة الصرف الميداني اليومي الشامل';
    if (activeReport === 'unpaid') return 'كشف المتخلفين والمتبقين في طوابير الانتظار';
    if (activeReport === 'cashiers') return 'تقرير مطابقة الكاشير ومعدل كفاءة الأرصدة الموزعة';
    return 'سجل الوقائع الأمنية وإدارة الجلسات الرقابي';
  };

  // EXPORT ACTION: Export active report to clean CSV
  const handleExportCSV = async () => {
    let headers: string[] = [];
    let rows: string[][] = [];
    let filename = '';

    if (activeReport === 'daily') {
      headers = ['الرقم العسكري', 'الاسم الكامل', 'الوحدة', 'قيمة الصرف', 'الحالة', 'تاريخ الصرف', 'الصراف المنفذ'];
      rows = individuals
        .filter(i => i.payoutStatus === 'received')
        .map(i => [
          i.militaryId,
          i.fullName,
          i.unit,
          String(i.entitledAmount),
          'تم الصرف',
          i.receivedAt ? new Date(i.receivedAt).toLocaleString('ar-SA') : '',
          i.receivedCashierName || ''
        ]);
      filename = 'بيان_الصرف_اليومي_الشامل';
    } else if (activeReport === 'unpaid') {
      headers = ['الرقم العسكري', 'الاسم الكامل', 'الوحدة', 'الكتيبة', 'المبلغ المقرر', 'تفويض الحركة'];
      rows = individuals
        .filter(i => i.payoutStatus === 'pending')
        .map(i => [
          i.militaryId,
          i.fullName,
          i.unit,
          i.battalion || '',
          String(i.entitledAmount),
          i.assignedCashierId ? 'موجه ميدانياً' : 'حر الانتظار'
        ]);
      filename = 'كشف_المتبقين_عن_الصرف';
    } else if (activeReport === 'cashiers') {
      headers = ['اسم الصراف', 'نقطة الصندوق', 'الحالة التراخيصية', 'العمليات المنجزة', 'إجمالي السيولة المخرجة'];
      rows = cashiers.map(c => {
        const paid = individuals.filter(i => i.payoutStatus === 'received' && i.receivedCashierId === c.id);
        const sum = paid.reduce((s, i) => s + i.entitledAmount, 0);
        return [
          c.name,
          c.payoutPoint || 'عام',
          c.isActive ? 'مفعل نشط' : 'موقوف',
          String(paid.length),
          String(sum)
        ];
      });
      filename = 'تقرير_كفاءة_الصيارفة';
    } else {
      headers = ['الفئة', 'تفاصيل الواقعة', 'التوقيت', 'الموقع الجغرافي', 'المسؤول'];
      rows = operations.map(op => [
        op.type === 'payout' ? 'عملية صرف' : op.type === 'alert' ? 'اختراق تكرار' : 'إجراء إداري',
        op.details,
        new Date(op.timestamp).toLocaleString('ar-SA'),
        op.location,
        op.cashierName
      ]);
      filename = 'سجل_الأحداث_الأمني';
    }

    try {
      exportToCSV(rows, headers, filename);
      await logSystemEvent(`تصدير ملف Excel لمستهدف الصرف: ${getReportTitle()}`, 'edit');
      alert('تم تكوين وتحميل ملف البيانات الإكسل بنجاح.');
    } catch (e: any) {
      alert('فشل تصدير الكشف: ' + e.message);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* 📁 Reports Selector Buttons */}
      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-3xl shadow-sm flex flex-wrap gap-2.5 print:hidden">
        <button
          type="button"
          onClick={() => setActiveReport('daily')}
          className={`flex items-center gap-1.5 py-2 px-4 rounded-xl text-3xs font-extrabold transition cursor-pointer ${activeReport === 'daily' ? 'bg-slate-900 text-white dark:bg-emerald-650' : 'bg-slate-50 dark:bg-slate-900 text-slate-500 hover:text-slate-800'}`}
        >
          <ClipboardList className="w-4 h-4" />
          بيان حركة الصرف المنجزة
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveReport('unpaid');
          }}
          className={`flex items-center gap-1.5 py-2 px-4 rounded-xl text-3xs font-extrabold transition cursor-pointer ${activeReport === 'unpaid' ? 'bg-slate-900 text-white dark:bg-emerald-650' : 'bg-slate-50 dark:bg-slate-900 text-slate-500 hover:text-slate-800'}`}
        >
          <Clock className="w-4 h-4" />
          كشف المتبقين (قيد الانتظار)
        </button>
        <button
          type="button"
          onClick={() => setActiveReport('cashiers')}
          className={`flex items-center gap-1.5 py-2 px-4 rounded-xl text-3xs font-extrabold transition cursor-pointer ${activeReport === 'cashiers' ? 'bg-slate-900 text-white dark:bg-emerald-650' : 'bg-slate-50 dark:bg-slate-900 text-slate-500 hover:text-slate-800'}`}
        >
          <UserCheck className="w-4 h-4" />
          تقرير كفاءة المنافذ والصيارفة
        </button>
        <button
          type="button"
          onClick={() => setActiveReport('events')}
          className={`flex items-center gap-1.5 py-2 px-4 rounded-xl text-3xs font-extrabold transition cursor-pointer ${activeReport === 'events' ? 'bg-slate-900 text-white dark:bg-emerald-650' : 'bg-slate-50 dark:bg-slate-900 text-slate-500 hover:text-slate-800'}`}
        >
          <Scroll className="w-4 h-4 text-rose-500" />
          سجل الأحداث الأمني والرقابة
        </button>
      </div>

      {/* 📜 The Certified printable layout Sheet container */}
      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-[32px] p-8 shadow-md relative text-right text-slate-800 dark:text-slate-100 max-w-5xl mx-auto space-y-6 print:border-0 print:shadow-none print:p-0">
        
        {/* State header certificate style */}
        <div className="flex flex-col sm:flex-row justify-between items-center border-b-2 border-slate-900/10 dark:border-slate-800/80 pb-5 leading-none">
          <div className="text-center sm:text-right space-y-1 sm:order-last">
            <h1 className="text-sm font-black tracking-wider text-slate-900 dark:text-white">{orgName || 'الإدارة المالية والقوة البشرية تعبوياً'}</h1>
            <h2 className="text-3xs font-black text-slate-500 tracking-wide">غرفة العمليات المركزية لمشروع الصرف الذكي</h2>
            <p className="text-[9px] text-slate-400 font-bold font-mono">طبعة كشوف محكمة ومؤمنة سحابياً</p>
          </div>

          <div className="py-2.5 sm:py-0 sm:order-none">
            <div className="w-11 h-11 bg-slate-900 dark:bg-emerald-750 text-white rounded-2xl flex items-center justify-center text-xl font-black shadow-inner">
              {systemLogo || '💸'}
            </div>
          </div>

          <div className="text-center sm:text-left text-3xs text-slate-450 font-bold font-mono sm:order-first leading-snug">
            <p>المستند: <span className="font-extrabold text-slate-700 dark:text-white">رقم {Math.floor(Math.random() * 85000 + 10000)}</span></p>
            <p className="mt-1">التاريخ: {new Date().toLocaleDateString('ar-SA')}</p>
            <p className="mt-0.5">التوقيت: {new Date().toLocaleTimeString('ar-SA')}</p>
          </div>
        </div>

        {/* Certificate Title */}
        <div className="text-center py-2 bg-slate-50 dark:bg-indigo-950/20 rounded-2xl border dark:border-slate-800/50">
          <h2 className="text-xs font-black text-slate-800 dark:text-indigo-300 tracking-tight">{getReportTitle()}</h2>
        </div>

        {/* ================================== 1. DAILY TRANSACTIONS REPORT ================================== */}
        {activeReport === 'daily' && (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-3xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-900 border-b border-slate-350 text-slate-650 font-black">
                    <th className="p-3">مستند عسكري</th>
                    <th className="p-3 text-center">الرقم العسكري</th>
                    <th className="p-3 text-center">الوحدة التعبوية</th>
                    <th className="p-3 text-center">المبلغ المستلم</th>
                    <th className="p-3 text-center">المنفذ والموقع الميداني للصرف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-900 font-bold">
                  {individuals.filter(i => i.payoutStatus === 'received').map((ind) => (
                    <tr key={ind.militaryId} className="hover:bg-slate-50/50">
                      <td className="p-3 font-extrabold">{ind.fullName}</td>
                      <td className="p-3 text-center font-mono">{ind.militaryId}</td>
                      <td className="p-3 text-center"><span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-900 rounded font-black">{ind.unit}</span></td>
                      <td className="p-3 text-center font-mono text-emerald-800 dark:text-emerald-450 font-black">{formatCurrency(ind.entitledAmount)}</td>
                      <td className="p-3 text-center text-slate-500">
                        <span>{ind.receivedCashierName || 'المسؤول المالي'} ({ind.receivedAt ? new Date(ind.receivedAt).toLocaleTimeString('ar-SA').slice(0, 8) : ''})</span>
                      </td>
                    </tr>
                  ))}

                  {individuals.filter(i => i.payoutStatus === 'received').length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-10 text-slate-400 font-black">لم يتم الانتهاء أو قيد أي صرفيات اليوم حتى الآن.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center text-3xs font-extrabold p-3.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-400 rounded-2xl border border-emerald-150">
              <span>إجمالي نقدية الصرفيات المعتمدة بهذا الكشف:</span>
              <span className="text-sm font-black font-mono">
                {formatCurrency(individuals.filter(i => i.payoutStatus === 'received').reduce((sum, item) => sum + item.entitledAmount, 0))}
              </span>
            </div>
          </div>
        )}

        {/* ================================== 2. UNCOLLECTED PENDING PAYOUTS ================================== */}
        {activeReport === 'unpaid' && (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-3xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-900 border-b border-slate-350 text-slate-650 font-black">
                    <th className="p-3 text-right">الفرد العسكري</th>
                    <th className="p-3 text-center">الرقم الميداني ID</th>
                    <th className="p-3 text-center">وحدة الحركة ومقرها</th>
                    <th className="p-3 text-center">الرواتب المترصدة لقيد الاستلام</th>
                    <th className="p-3 text-center">الحجوزات وصلاحيات الصناديق</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-900 font-bold">
                  {individuals.filter(i => i.payoutStatus === 'pending').map((ind) => {
                    const assignedCashier = cashiers.find(c => c.id === ind.assignedCashierId);
                    return (
                      <tr key={ind.militaryId} className="hover:bg-slate-50/50">
                        <td className="p-3 font-extrabold text-slate-800 dark:text-slate-100">{ind.fullName}</td>
                        <td className="p-3 text-center font-mono">{ind.militaryId}</td>
                        <td className="p-3 text-center"><span className="px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 rounded text-4xs font-black">{ind.unit} {ind.battalion ? `| ${ind.battalion}` : ''}</span></td>
                        <td className="p-3 text-center font-mono text-amber-705 font-black">{formatCurrency(ind.entitledAmount)}</td>
                        <td className="p-3 text-center">
                          {assignedCashier ? (
                            <span className="text-indigo-700 bg-indigo-50/50 px-2 py-0.5 rounded text-[10px] font-black">مربوط بـ {assignedCashier.name}</span>
                          ) : (
                            <span className="text-slate-400 text-4xs">انتظار عام مفتوح</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {individuals.filter(i => i.payoutStatus === 'pending').length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-10 text-slate-400 font-black">تم الانتهاء من صرف لجميع الأفراد المدرجين بالكشوف بنسبة 100%!</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center text-3xs font-extrabold p-3.5 bg-amber-50 dark:bg-amber-955/20 text-amber-800 dark:text-amber-400 rounded-2xl border border-amber-200">
              <span>إجمالي السيولة المعلقة المطلوب جلبها بالمواقع لتصفية هذا الكشف المتبقي:</span>
              <span className="text-sm font-black font-mono">
                {formatCurrency(individuals.filter(i => i.payoutStatus === 'pending').reduce((sum, item) => sum + item.entitledAmount, 0))}
              </span>
            </div>
          </div>
        )}

        {/* ================================== 3. CASHIERS LOAD RECONCILIATION ================================== */}
        {activeReport === 'cashiers' && (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-3xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-900 border-b border-slate-350 text-slate-650 font-black">
                    <th className="p-3 text-right">المسؤول المالي (الصراف الميداني)</th>
                    <th className="p-3 text-center">موقع منفذ التوزيع</th>
                    <th className="p-3 text-center">حالة ترخيص الجلسة</th>
                    <th className="p-3 text-center">الرواتب الموزعة والمنجزة (الأفراد)</th>
                    <th className="p-3 text-center">الكتل والسيولة النقدية المصروفة بالكلية</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-900 font-bold">
                  {cashiers.map((c) => {
                    const assignedPaid = individuals.filter(i => i.payoutStatus === 'received' && i.receivedCashierId === c.id);
                    const assignedPaidSum = assignedPaid.reduce((s, x) => s + x.entitledAmount, 0);

                    return (
                      <tr key={c.id} className="hover:bg-slate-50/50">
                        <td className="p-3 font-extrabold text-slate-800 dark:text-slate-100">{c.name}</td>
                        <td className="p-3 text-center text-slate-500 font-black">{c.payoutPoint || 'نقطة ميدانية عامة'}</td>
                        <td className="p-3 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black ${
                            c.isActive ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-450' : 'bg-rose-50 text-rose-850 dark:bg-rose-955/20'
                          }`}>
                            {c.isActive ? 'مفعل نشط' : 'موقوف إجرائياً'}
                          </span>
                        </td>
                        <td className="p-3 text-center font-mono">{assignedPaid.length} راتب مسلم</td>
                        <td className="p-3 text-center font-mono text-emerald-850 dark:text-emerald-400 font-black">{formatCurrency(assignedPaidSum)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================================== 4. SYSTEM EVENT LOG DETAILS ================================== */}
        {activeReport === 'events' && (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-3xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-900 border-b border-slate-350 text-slate-650 font-black">
                    <th className="p-3 text-right">الفئة والمحضر الرقابي</th>
                    <th className="p-3 text-right">التفاصيل الكاملة وحالة المطابقة</th>
                    <th className="p-3 text-center">التوقيت والتزامن السحابي</th>
                    <th className="p-3 text-center">إحداثيات رصد الحركة (Location Signature)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-900 font-bold leading-relaxed">
                  {operations.slice(0, 40).map((op) => (
                    <tr key={op.id} className="hover:bg-slate-50/50">
                      <td className="p-3 text-right font-extrabold whitespace-nowrap">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black ${
                          op.type === 'payout' 
                            ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/25 dark:text-emerald-400' 
                            : op.type === 'alert' 
                            ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/30 dark:text-rose-450 animate-pulse' 
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-900/50 dark:text-slate-400'
                        }`}>
                          {op.type === 'payout' ? 'حركة صرف' : op.type === 'alert' ? 'وقاية واختراق ثنائي' : 'تحديث إداري'}
                        </span>
                      </td>
                      <td className="p-3 text-right text-xs max-w-sm text-slate-750 dark:text-slate-350">{op.details}</td>
                      <td className="p-3 text-center font-mono whitespace-nowrap text-slate-505 dark:text-slate-405">{formatDateTime(op.timestamp)}</td>
                      <td className="p-3 text-center font-mono font-black text-slate-400 text-4xs max-w-xs truncate">{op.location}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Traditional signatures guidelines visual block block */}
        <div className="grid grid-cols-3 gap-8 border-t border-slate-900/10 dark:border-slate-800/80 pt-8 mt-12 text-center text-3xs font-extrabold text-slate-500">
          <div className="space-y-10">
            <p>✍️ كاتب ومعد المطابقة المالية ماليّاً</p>
            <div className="h-0.5 w-24 bg-slate-300 mx-auto" />
            <p className="text-4xs text-slate-400">الاسم والتوقيع: ..........................</p>
          </div>
          <div className="space-y-10 border-r border-l border-slate-150">
            <p>🔎 مراجع ودائرة التدقيق المستندى</p>
            <div className="h-0.5 w-24 bg-slate-300 mx-auto" />
            <p className="text-4xs text-slate-400">الاسم والتوقيع: ..........................</p>
          </div>
          <div className="space-y-10">
            <p>🛡️ المسؤول المالي ومدير الاعتماد</p>
            <div className="h-0.5 w-24 bg-slate-400 mx-auto" />
            <p className="text-4xs text-slate-400">الختم والتوقيع الرسمي للمديرية</p>
          </div>
        </div>

      </div>

      {/* Action controls panel - Export / Print buttons */}
      <div className="flex justify-end gap-3 max-w-5xl mx-auto print:hidden">
        <button
          type="button"
          onClick={handleExportCSV}
          className="py-2.5 px-6 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 text-slate-700 dark:text-slate-350 font-black rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-sm transition"
        >
          <Download className="w-4 h-4 text-emerald-600" />
          تحميل كملف إكسل Excel (CSV)
        </button>
        
        <button
          type="button"
          onClick={handlePrintReport}
          className="py-2.5 px-6 bg-slate-900 hover:bg-black dark:bg-emerald-650 dark:hover:bg-emerald-600 text-white font-black rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow transition active:scale-[0.98]"
        >
          <Printer className="w-4 h-4" />
          طباعة التقرير الفورية (PDF)
        </button>
      </div>

    </div>
  );
}
