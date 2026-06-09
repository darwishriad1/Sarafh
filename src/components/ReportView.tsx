/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { FileSpreadsheet, Printer, Users, CheckCircle, Clock, Wallet, BarChart3, TrendingUp, Calendar, ChevronLeft } from 'lucide-react';
import { Individual, Cashier, OperationLog } from '../types';
import { formatCurrency, formatDateTime, exportToCSV } from '../utils';

interface ReportViewProps {
  individuals: Individual[];
  cashiers: Cashier[];
  operations: OperationLog[];
  onBackToDashboard?: () => void;
}

export default function ReportView({ individuals, cashiers, operations, onBackToDashboard }: ReportViewProps) {
  const [reportType, setReportType] = useState<'daily' | 'monthly'>('daily');

  // --- GENERAL METRICS CALCULATIONS ---
  const totalBeneficiaries = individuals.length;
  const receivedCount = individuals.filter(i => i.payoutStatus === 'received').length;
  const remainingCount = totalBeneficiaries - receivedCount;
  
  const totalDistributedAmount = individuals
    .filter(i => i.payoutStatus === 'received')
    .reduce((sum, item) => sum + item.entitledAmount, 0);

  const totalEntitledAmount = individuals.reduce((sum, item) => sum + item.entitledAmount, 0);
  const remainingAmount = totalEntitledAmount - totalDistributedAmount;

  // Calculate stats per cashier
  const cashierStats = cashiers.map(cashier => {
    // Operations in this month (or day)
    const cashierOps = operations.filter(op => op.cashierId === cashier.id && op.type === 'payout');
    
    // Sum from individuals who received from this cashier
    const cashierPaidIndividuals = individuals.filter(
      i => i.payoutStatus === 'received' && i.receivedCashierId === cashier.id
    );
    
    const count = cashierPaidIndividuals.length;
    const amount = cashierPaidIndividuals.reduce((sum, item) => sum + item.entitledAmount, 0);

    return {
      id: cashier.id,
      name: cashier.name,
      point: cashier.payoutPoint || 'غير محدد',
      count,
      amount
    };
  });

  // Export Daily / Monthly Report to CSV
  const handleExportCSV = () => {
    if (reportType === 'daily') {
      const headers = ['الرقم العسكري', 'الاسم الكامل', 'الوحدة', 'المبلغ بالتفصيل', 'الحالة', 'اسم الصراف', 'تاريخ الصرف', 'الموقع'];
      const rows = individuals.map(i => [
        i.militaryId,
        i.fullName,
        i.unit,
        String(i.entitledAmount),
        i.payoutStatus === 'received' ? 'تم الاستلام' : 'لم يتم الاستلام',
        i.receivedCashierName || 'للمسؤول المالي',
        i.receivedAt ? formatDateTime(i.receivedAt) : '-',
        i.receivedLocation || '-'
      ]);
      exportToCSV(rows, headers, 'تقرير_الصرف_اليومي');
    } else {
      const headers = ['مُعرّف الصرّاف', 'اسم الصرّاف الرئيسي', 'مقر الصرف المحدد', 'عدد عمليات التوزيع الناجحة', 'إجمالي المبالغ الموزعة'];
      const rows = cashierStats.map(s => [
        s.id,
        s.name,
        s.point,
        String(s.count),
        String(s.amount)
      ]);
      exportToCSV(rows, headers, 'التقرير_الشهرى_للصرافين');
    }
  };

  const handlePrintPDF = () => {
    window.print();
  };

  return (
    <div id="reports-board" className="space-y-6">
      {/* Printable Header - hidden on screen, visible on print */}
      <div className="hidden print:block text-center space-y-3 mb-8 border-b pb-6 direction-rtl text-right">
        <div className="flex justify-between items-center">
          <div className="text-right text-xs text-slate-500">
            <p>الرقم: م/ص/ع/١٢</p>
            <p>التاريخ: {new Date().toLocaleDateString('ar-SA')}</p>
            <p>سجل السرية التامة</p>
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-850">قوات الأمن العام الميدانية</h2>
            <p className="text-sm text-slate-600">شعبة الإدارة المالية والإمداد</p>
          </div>
        </div>
        <h1 className="text-2xl font-black text-slate-900 mt-4 underline decoration-double">
          {reportType === 'daily' ? 'كشف الصرف اليومي العام للأفراد والمجندين' : 'التقرير الشهري الختامي لأداء الصرافين'}
        </h1>
        <p className="text-xs text-slate-500 font-mono">طبع بواسطة: منصة الصرف الميداني الرقمية</p>
      </div>

      {/* Control Actions Panel - Hidden on Print */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden text-right">
        <div>
          {onBackToDashboard && (
            <button
              id="back-from-reports"
              type="button"
              onClick={onBackToDashboard}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-emerald-700 transition"
            >
              <ChevronLeft className="w-4 h-4 ml-1" />
              العودة إلى لوحة تحكم الإدارة
            </button>
          )}
          <h2 className="text-xl font-bold text-slate-850 mt-1">مركز التحليل والتقارير الميدانية</h2>
          <p className="text-xs text-slate-500 mt-1">حساب موازي لإحصاء مبالغ التسليم والأداء الإجمالي</p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            id="export-excel-btn"
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100/80 rounded-xl text-xs font-bold transition-all"
          >
            <FileSpreadsheet className="w-4 h-4" />
            تصدير ملف Excel (CSV)
          </button>
          <button
            id="print-pdf-btn"
            type="button"
            onClick={handlePrintPDF}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white hover:bg-slate-900 rounded-xl text-xs font-bold transition-all shadow-sm"
          >
            <Printer className="w-4 h-4" />
            طباعة كتقرير PDF معتمد
          </button>
        </div>
      </div>

      {/* Report Switcher Tabs - Hidden on Print */}
      <div className="flex bg-slate-100 p-1 rounded-xl w-fit print:hidden">
        <button
          id="daily-tab-btn"
          type="button"
          className={`py-2 px-4 rounded-lg text-xs font-bold transition-all ${
            reportType === 'daily'
              ? 'bg-white text-emerald-800 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
          onClick={() => setReportType('daily')}
        >
          التقرير اليومي للمستلمين
        </button>
        <button
          id="monthly-tab-btn"
          type="button"
          className={`py-2 px-4 rounded-lg text-xs font-bold transition-all ${
            reportType === 'monthly'
              ? 'bg-white text-emerald-800 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
          onClick={() => setReportType('monthly')}
        >
          التقرير الختامي وأداء الصرافين
        </button>
      </div>

      {/* --- DATA SUMMARY CARDS --- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm text-right">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-semibold">إجمالي المستفيدين (الأفراد)</span>
            <Users className="w-5 h-5 text-slate-400" />
          </div>
          <p className="text-2xl font-black text-slate-800 mt-2 font-mono">{totalBeneficiaries}</p>
          <p className="text-xs text-slate-400 mt-0.5">الرقم الكلي للمدرجين في الكشوفات</p>
        </div>

        <div className="bg-white border border-emerald-200 p-4 rounded-2xl shadow-sm text-right">
          <div className="flex items-center justify-between">
            <span className="text-xs text-emerald-700 font-semibold">عدد الذين استلموا</span>
            <CheckCircle className="w-5 h-5 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-700 mt-2 font-mono">{receivedCount}</p>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
            <div 
              className="bg-emerald-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${totalBeneficiaries > 0 ? (receivedCount / totalBeneficiaries) * 100 : 0}%` }}
            />
          </div>
          <p className="text-3xs text-slate-400 mt-1">نسبة التسليم: {totalBeneficiaries > 0 ? Math.round((receivedCount / totalBeneficiaries) * 100) : 0}%</p>
        </div>

        <div className="bg-white border border-amber-200 p-4 rounded-2xl shadow-sm text-right">
          <div className="flex items-center justify-between">
            <span className="text-xs text-amber-700 font-semibold">عدد المتبقين</span>
            <Clock className="w-5 h-5 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-amber-700 mt-2 font-mono">{remainingCount}</p>
          <p className="text-xs text-slate-400 mt-0.5">أفراد معلقين بانتظار التوزيع</p>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm text-right">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-semibold">المبالغ المصروفة فعلياً</span>
            <Wallet className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-800 mt-2 font-mono">{formatCurrency(totalDistributedAmount)}</p>
          <p className="text-xs text-slate-400 mt-0.5">المبلغ المسلم نقداً حتى الآن</p>
        </div>
      </div>

      {/* --- REPORT TABLES & SECTOR SPECIFIC VISUALS --- */}
      {reportType === 'daily' ? (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden text-right">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-semibold bg-emerald-50 text-emerald-800 py-1 px-2.5 rounded-lg">التحديث لحظي</span>
            <h3 className="text-base font-bold text-slate-800">بيانات كشف الصرف المحدث</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
                <tr>
                  <th scope="col" className="px-6 py-3">الرقم العسكري</th>
                  <th scope="col" className="px-6 py-3">الاسم الكامل</th>
                  <th scope="col" className="px-6 py-3">الوحدة التعبوية</th>
                  <th scope="col" className="px-6 py-3">المبلغ المستحق</th>
                  <th scope="col" className="px-6 py-3">حالة الاستلام</th>
                  <th scope="col" className="px-6 py-3">المستلِم بواسطة</th>
                  <th scope="col" className="px-6 py-3">إحداثيات الميدان</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {individuals.map((ind) => (
                  <tr key={ind.militaryId} className="hover:bg-slate-50/50">
                    <td className="px-6 py-3.5 font-bold font-mono text-slate-700">{ind.militaryId}</td>
                    <td className="px-6 py-3.5 font-semibold text-slate-800">{ind.fullName}</td>
                    <td className="px-6 py-3.5 text-slate-500 text-xs">{ind.unit}</td>
                    <td className="px-6 py-3.5 font-bold text-slate-800 font-mono">{formatCurrency(ind.entitledAmount)}</td>
                    <td className="px-6 py-3.5">
                      <span className={`inline-flex items-center px-2 py-1 rounded-md text-3xs font-extrabold ${
                        ind.payoutStatus === 'received' 
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                          : 'bg-slate-50 text-slate-500 border border-slate-200/60'
                      }`}>
                        {ind.payoutStatus === 'received' ? 'تم الاستلام' : 'لم يتم الاستلام'}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 divide-y divide-slate-100">
                      {ind.payoutStatus === 'received' ? (
                        <div className="text-xs">
                          <p className="font-semibold text-slate-700">{ind.receivedCashierName || 'المسؤول المالي'}</p>
                          <p className="text-3xs text-slate-400 font-mono mt-0.5">{formatDateTime(ind.receivedAt)}</p>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 font-mono text-3xs text-slate-400">
                      {ind.receivedLocation ? ind.receivedLocation.replace(' (محاكي الميدان GPS)', '') : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* --- MONTHLY REPORT: PERFORMANCE PER CASHIER --- */
        <div className="space-y-6 text-right">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">معدلات ونسب إنجاز عمليات الصرف اليومية للصرافين</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
                  <tr>
                    <th scope="col" className="px-6 py-3">رقم الصراف</th>
                    <th scope="col" className="px-6 py-3">اسم الصراف المرخص</th>
                    <th scope="col" className="px-6 py-3">مقر نقطة الصرف</th>
                    <th scope="col" className="px-6 py-3">إجمالي الأفراد المستلمين</th>
                    <th scope="col" className="px-6 py-3">المجموع المالي المصروف</th>
                    <th scope="col" className="px-6 py-3 text-center">أداء نقطة التوزيع</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cashierStats.map((cashier) => (
                    <tr key={cashier.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4 font-mono font-bold text-slate-700">{cashier.id}</td>
                      <td className="px-6 py-4 font-bold text-slate-850">{cashier.name}</td>
                      <td className="px-6 py-4 text-slate-500 text-xs">{cashier.point}</td>
                      <td className="px-6 py-4 font-bold text-slate-800 font-mono">{cashier.count} فرد</td>
                      <td className="px-6 py-4 font-bold text-emerald-800 font-mono">{formatCurrency(cashier.amount)}</td>
                      <td className="px-6 py-4 w-52">
                        <div className="flex items-center gap-2 justify-end">
                          <span className="text-2xs font-semibold text-slate-500 font-mono">
                            {receivedCount > 0 ? Math.round((cashier.count / receivedCount) * 100) : 0}% من الكلي
                          </span>
                          <div className="w-24 bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div 
                              className="bg-emerald-600 h-full rounded-full"
                              style={{ width: `${receivedCount > 0 ? (cashier.count / receivedCount) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {/* Empty warning */}
                  {cashierStats.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-400">لا يوجد صرافين مضافين لحساب أرقام التوزيع</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick analysis summary - Dashboard styling */}
          <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-2 gap-6 print:hidden">
            <div>
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 justify-end">
                <span>توصية الكفاءة التشغيلية الميدانية</span>
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </h4>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                بناءً على وتيرة التسليم، يبلُغ معدل الصرف العام <span className="font-bold text-emerald-700">{totalBeneficiaries > 0 ? Math.round((receivedCount / totalBeneficiaries) * 100) : 0}%</span>. يُوصى بزيادة نطاق الصرف اللامركزي (الصرف العام) في المناطق الوعرة أو الحدودية لتسهيل تحصيل المتبقين بدون اضطرارهم للانتقال للمنافذ المخصصة المحددة فقط.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 justify-end">
                <span>الاحتياطي المتبقي بالموازنة</span>
                <Wallet className="w-4 h-4 text-amber-600" />
              </h4>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                تبلغ القيمة الإجمالية المراد تسليمها في هذه الوجبة <span className="font-semibold text-slate-700">{formatCurrency(totalEntitledAmount)}</span>. المنصرف الفعلي يمنح مؤشراً بقدرة استهلاك بلغت <span className="font-semibold text-slate-700">{formatCurrency(totalDistributedAmount)}</span> وبمتبقي خزينة حالي مقداره <span className="font-bold text-amber-700">{formatCurrency(remainingAmount)}</span>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Official Signatures Area - Visible ONLY on Print */}
      <div className="hidden print:grid grid-cols-3 gap-8 text-center pt-16 border-t mt-16 text-slate-800 direction-rtl">
        <div>
          <p className="font-bold text-sm">مقرر لجنة التحقق والصرف</p>
          <div className="h-14 border-b border-dashed border-slate-300 my-2"></div>
          <p className="text-xs text-slate-500">التوقيع والختم الإداري</p>
        </div>
        <div>
          <p className="font-bold text-sm">حسابات الصندوق والتدقيق</p>
          <div className="h-14 border-b border-dashed border-slate-300 my-2"></div>
          <p className="text-xs text-slate-500">التوقيع والختم الإداري</p>
        </div>
        <div>
          <p className="font-bold text-sm">المسؤول المالي العام</p>
          <div className="h-14 border-b border-dashed border-slate-300 my-2"></div>
          <p className="text-xs text-slate-500">صاحب الصلاحية للدفع الأخير</p>
        </div>
      </div>
    </div>
  );
}
