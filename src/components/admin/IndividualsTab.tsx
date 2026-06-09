/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Users, Plus, Search, Trash2, Edit3, Check, X, FileSpreadsheet, 
  Upload, AlertTriangle, UserCheck, ShieldAlert, Laptop, ArrowUpRight, CheckCircle
} from 'lucide-react';
import { Individual, Cashier } from '../../types';
import { formatCurrency, formatDateTime } from '../../utils';

interface IndividualsTabProps {
  individuals: Individual[];
  cashiers: Cashier[];
  onAddIndividual: (ind: Individual) => Promise<void>;
  onUpdateIndividual: (id: string, updates: Partial<Individual>) => Promise<void>;
  onDeleteIndividual: (id: string) => Promise<void>;
  onCancelPayout?: (militaryId: string, item: Individual) => Promise<void>;
  dailyAmount: number;
  logSystemEvent: (details: string, type: 'payout' | 'cancel' | 'edit' | 'backup_restore' | 'alert') => Promise<void>;
}

export default function IndividualsTab({
  individuals,
  cashiers,
  onAddIndividual,
  onUpdateIndividual,
  onDeleteIndividual,
  onCancelPayout,
  dailyAmount,
  logSystemEvent
}: IndividualsTabProps) {

  // Local navigation sub-tabs
  const [subTab, setSubTab] = useState<'list' | 'import' | 'distribution'>('list');

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'received' | 'assigned' | 'unassigned'>('all');

  // Single Individual Creation Form state
  const [newIndName, setNewIndName] = useState('');
  const [newIndId, setNewIndId] = useState('');
  const [newIndUnit, setNewIndUnit] = useState('');
  const [newIndBatal, setNewIndBatal] = useState('');
  const [newIndComp, setNewIndComp] = useState('');
  const [newIndPlat, setNewIndPlat] = useState('');
  const [newIndAmount, setNewIndAmount] = useState(dailyAmount || 1000);

  // Bulk XLS CSV copy-paste importer state
  const [csvContentText, setCsvContentText] = useState('');
  const [parsedRowsCount, setParsedRowsCount] = useState(0);

  // Inline edit state
  const [editingIndId, setEditingIndId] = useState<string | null>(null);
  const [editIndName, setEditIndName] = useState('');
  const [editIndBatal, setEditIndBatal] = useState('');
  const [editIndComp, setEditIndComp] = useState('');
  const [editIndAmount, setEditIndAmount] = useState(0);
  const [editIndStatus, setEditIndStatus] = useState<'pending' | 'received'>('pending');

  // Distribution room state
  const [distType, setDistType] = useState<'special' | 'bulk'>('special');
  const [distCashierId, setDistCashierId] = useState('');
  const [distIndividualId, setDistIndividualId] = useState('');
  const [bulkField, setBulkField] = useState<'unit' | 'battalion' | 'company'>('unit');
  const [bulkValue, setBulkValue] = useState('');

  // FILTER LOGIC
  const filteredIndividuals = individuals.filter(ind => {
    // text query matches against Name or Military ID
    const matchText = 
      ind.fullName.toLowerCase().includes(searchQuery.toLowerCase().trim()) || 
      ind.militaryId.includes(searchQuery.trim());

    if (!matchText) return false;

    // status filters
    if (statusFilter === 'pending') return ind.payoutStatus === 'pending';
    if (statusFilter === 'received') return ind.payoutStatus === 'received';
    if (statusFilter === 'assigned') return ind.payoutStatus === 'pending' && !!ind.assignedCashierId;
    if (statusFilter === 'unassigned') return ind.payoutStatus === 'pending' && !ind.assignedCashierId;

    return true;
  });

  // ACTION: Submit single individual registry
  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIndName || !newIndId || !newIndUnit) {
      alert('الرجاء كتابة اسم الفرد الرباعي ورقم الهوية العسكري والوحدة التعبوية.');
      return;
    }
    if (individuals.some(i => i.militaryId === newIndId.trim())) {
      alert(`عذراً: الرقم العسكري [${newIndId}] مسجل مسبقاً لعنصر آخر بقواعد البيانات.`);
      return;
    }

    const record: Individual = {
      militaryId: newIndId.trim(),
      fullName: newIndName.trim(),
      unit: newIndUnit.trim(),
      battalion: newIndBatal.trim(),
      company: newIndComp.trim(),
      platoon: newIndPlat.trim(),
      entitledAmount: Number(newIndAmount),
      payoutStatus: 'pending',
      assignedCashierId: '',
      avatarUrl: ''
    };

    try {
      await onAddIndividual(record);
      await logSystemEvent(`إدراج الفرد يدوياً بالكشوفات: ${newIndName} (${newIndId})`, 'edit');
      setNewIndName('');
      setNewIndId('');
      alert('تم إدراج الفرد بنجاح كصفة "قيد الانتظار وصالح للصرف".');
    } catch (err: any) {
      alert('تعذر إدراج السجل: ' + err.message);
    }
  };

  // ACTION: Bulk CSV Parse and Seed Handler
  const handleParseCsvLog = () => {
    if (!csvContentText.trim()) return;
    const lines = csvContentText.split('\n').map(l => l.trim()).filter(Boolean);
    setParsedRowsCount(lines.length);
  };

  const handleApplyBulkImport = async () => {
    if (!csvContentText.trim()) {
      alert('الرجاء نسخ كشوف بياضات الإلمام ولصقها أولاً في الميدان الكبير.');
      return;
    }

    const lines = csvContentText.split('\n').map(l => l.trim()).filter(Boolean);
    let successfullyAdded = 0;
    let duplicatesSkipped = 0;

    for (const rawLine of lines) {
      // Split with comma, tab, or custom vertical bars
      const cols = rawLine.split(/[\t,|\s{2,}]/).map(c => c.trim()).filter(Boolean);
      if (cols.length < 2) continue;

      const idCandidate = cols[0];
      const nameCandidate = cols[1];
      const unitCandidate = cols[2] || 'كتيبة المشاة التعبوية';
      const amountCandidate = Number(cols[3]) || dailyAmount || 1000;

      // Ensure ID is fully numeric and non-duplicate
      if (!/^\d+$/.test(idCandidate)) continue;
      if (individuals.some(i => i.militaryId === idCandidate)) {
        duplicatesSkipped++;
        continue;
      }

      const rec: Individual = {
        militaryId: idCandidate,
        fullName: nameCandidate,
        unit: unitCandidate,
        battalion: cols[4] || '',
        company: cols[5] || '',
        platoon: cols[6] || '',
        entitledAmount: amountCandidate,
        payoutStatus: 'pending',
        assignedCashierId: '',
        avatarUrl: ''
      };

      await onAddIndividual(rec);
      successfullyAdded++;
    }

    await logSystemEvent(`استيراد شامل ومطابقة CSV وإدراج عدد ${successfullyAdded} فرد عسكري بالكشوف`, 'edit');
    alert(`اكتمال التوليف المالي الميداني!\nتم بنجاح إدراج: ${successfullyAdded} فرد.\nتم تجاوز القيود المتكررة: ${duplicatesSkipped} فرد لتجنب ازدواج القيد.`);
    setCsvContentText('');
    setParsedRowsCount(0);
    setSubTab('list');
  };

  // ACTION: Inline editing start/save
  const startEditingIndividual = (ind: Individual) => {
    setEditingIndId(ind.militaryId);
    setEditIndName(ind.fullName);
    setEditIndBatal(ind.battalion || '');
    setEditIndComp(ind.company || '');
    setEditIndAmount(ind.entitledAmount);
    setEditIndStatus(ind.payoutStatus);
  };

  const handleSaveIndividualEdit = async (mId: string) => {
    try {
      await onUpdateIndividual(mId, {
        fullName: editIndName,
        battalion: editIndBatal,
        company: editIndComp,
        entitledAmount: editIndAmount,
        payoutStatus: editIndStatus
      });
      await logSystemEvent(`تعديل بيانات واستحقاق الفرد: ${editIndName} (${mId})`, 'edit');
      setEditingIndId(null);
      alert('تم تعديل وحفظ بيانات الفرد بنجاح.');
    } catch (err: any) {
      alert('خطأ بتعديل مستند الفرد: ' + err.message);
    }
  };

  // ACTION: Fast military single assignment distribution
  const handleApplySpecialDistribution = async () => {
    if (!distCashierId || !distIndividualId) {
      alert('الرجاء اختيار الصراف الموجه له وتعيين الفرد العسكري.');
      return;
    }
    const targetCashier = cashiers.find(c => c.id === distCashierId);
    const targetIndividual = individuals.find(i => i.militaryId === distIndividualId);

    if (!targetCashier || !targetIndividual) return;

    try {
      await onUpdateIndividual(distIndividualId, {
        assignedCashierId: distCashierId
      });
      await logSystemEvent(`توجيه الفرد: ${targetIndividual.fullName} إلى الصراف الميداني: ${targetCashier.name}`, 'edit');
      setDistIndividualId('');
      alert(`تم التوجيه المالي المباشر للفرد لدى الصراف [${targetCashier.name}] بنجاح.`);
    } catch (err: any) {
      alert('فشل تعيين الفرد: ' + err.message);
    }
  };

  // ACTION: Bulk distribution of classified group to cashier
  const handleApplyBulkDistribution = async () => {
    if (!distCashierId || !bulkValue.trim()) {
      alert('الرجاء تحديد الصراف وكتابة القيمة المطلوبة للمجموعة التوزيعية الفئوية.');
      return;
    }
    const targetCashier = cashiers.find(c => c.id === distCashierId);
    if (!targetCashier) return;

    // Filter pending & unassigned individuals that match the bulk condition
    const matchingIndividuals = individuals.filter(i => {
      if (i.payoutStatus !== 'pending') return false;
      const targetVal = i[bulkField]?.trim() || '';
      return targetVal.toLowerCase() === bulkValue.trim().toLowerCase();
    });

    if (matchingIndividuals.length === 0) {
      alert('لم يتم العثور على أي عناصر بوضع "قيد الانتظار" يطابقون هذه الفئة.');
      return;
    }

    let assignedCounter = 0;
    for (const ind of matchingIndividuals) {
      await onUpdateIndividual(ind.militaryId, {
        assignedCashierId: distCashierId
      });
      assignedCounter++;
    }

    await logSystemEvent(`توزيع شامل بالمجموعة لعدد ${assignedCounter} فرد تابع لـ [${bulkValue}] إلى الصراف ${targetCashier.name}`, 'edit');
    alert(`تم بنجاح توزيع دفعة من [${assignedCounter}] فرد عسكري على منفذ الكاشير [${targetCashier.name}].`);
    setBulkValue('');
  };

  return (
    <div className="space-y-6">
      
      {/* 🧭 Master Subnavigation Area */}
      <div className="flex bg-slate-100 dark:bg-slate-900 border dark:border-slate-800 p-1 rounded-2xl max-w-lg mr-auto">
        <button
          type="button"
          onClick={() => setSubTab('list')}
          className={`flex-1 py-2 px-5 rounded-xl text-3xs font-extrabold transition cursor-pointer ${subTab === 'list' ? 'bg-white dark:bg-slate-950 text-emerald-800 dark:text-white shadow-xs' : 'text-slate-400 hover:text-slate-800'}`}
        >
          كشف السجلات والبحث
        </button>
        <button
          type="button"
          onClick={() => setSubTab('import')}
          className={`flex-1 py-2 px-5 rounded-xl text-3xs font-extrabold transition cursor-pointer ${subTab === 'import' ? 'bg-white dark:bg-slate-950 text-emerald-800 dark:text-white shadow-xs' : 'text-slate-400 hover:text-slate-800'}`}
        >
          أدوات الإدراج والاستيراد CSV
        </button>
        <button
          type="button"
          onClick={() => setSubTab('distribution')}
          className={`flex-1 py-2 px-5 rounded-xl text-3xs font-extrabold transition cursor-pointer ${subTab === 'distribution' ? 'bg-white dark:bg-slate-950 text-emerald-800 dark:text-white shadow-xs' : 'text-slate-400 hover:text-slate-800'}`}
        >
          غرفة توجيه الموظفين والمهام
        </button>
      </div>

      {/* ==================================== 1. SUB-TAB: LIST VIEW ==================================== */}
      {subTab === 'list' && (
        <div className="space-y-6">
          
          {/* Advanced Filtering & Interactive live search */}
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm text-right space-y-4">
            <h3 className="text-xs font-black text-slate-800 dark:text-white border-b pb-2">محرك البحث المتقدم وفرز المستحقين</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Dynamic Search */}
              <div className="md:col-span-2 relative">
                <label className="block text-[10px] font-bold text-slate-400 mb-1">ابحث باسم الفرد الرباعي أو بالرقم العسكري (بحث لايف):</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="اكتب الرقم العسكري أو جزء من اسم الفرد... النتائج تظهر هنا مباشرة"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full text-right py-2.5 pr-10 pl-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              {/* Status Select Filter */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">تصفية حسب الرتبة والموقف المالي:</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="w-full text-right py-2.5 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs cursor-pointer font-bold"
                >
                  <option value="all">الأفراد مستهدفي الصرف (الكل)</option>
                  <option value="pending">المعمدين المتبقين (قيد الانتظار)</option>
                  <option value="received">المستلمين الفعليين (تم تسليمهم)</option>
                  <option value="assigned">الأفراد الموزعين على صيارفة</option>
                  <option value="unassigned font-black">أفراد أحرار (لم يوزعوا بعد على صراف)</option>
                </select>
              </div>

            </div>
          </div>

          {/* Core Personnel Data Table List/Grid */}
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden text-right">
            <div className="p-5 border-b border-slate-100 dark:border-slate-900 flex justify-between items-center bg-slate-50/10">
              <div>
                <h3 className="text-sm font-black text-slate-800 dark:text-white">سجلات كشوفات القوة</h3>
                <p className="text-4xs text-slate-400 mt-0.5">يمكنك تنقيح السجل، والقيام بتعديلات لحظية لمبالغ ومراتب الصرف</p>
              </div>
              <span className="text-3xs font-black font-mono bg-sky-50 dark:bg-sky-950 text-sky-800 dark:text-sky-400 px-3 py-1 rounded-full">{filteredIndividuals.length} فرد عثر عليه</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 font-extrabold border-b border-slate-150">
                  <tr>
                    <th className="px-5 py-4">اللقب والهوية الميدانية للفرد</th>
                    <th className="px-5 py-4 text-center">تفاصيل الفرقة والوحدات التعبوية</th>
                    <th className="px-5 py-4 text-center">قيمة الاستحقاق المقررة</th>
                    <th className="px-5 py-4 text-center">حالة الصرف والامتياز</th>
                    <th className="px-5 py-4 text-center">محجوز لدى صراف عسكري</th>
                    <th className="px-5 py-4 text-center font-black">العمليات الإدارية</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-900 align-middle font-semibold">
                  {filteredIndividuals.map((ind) => {
                    const isEditing = editingIndId === ind.militaryId;
                    const assignedCashier = cashiers.find(c => c.id === ind.assignedCashierId);

                    return (
                      <tr key={ind.militaryId} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/30 transition">
                        
                        {/* Name and Military ID */}
                        <td className="px-5 py-4">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editIndName}
                              onChange={(e) => setEditIndName(e.target.value)}
                              className="py-1 px-2 border dark:border-slate-800 rounded-lg w-full bg-white dark:bg-slate-950 text-xs font-bold font-mono"
                            />
                          ) : (
                            <div className="space-y-1">
                              <h4 className="font-extrabold text-slate-850 dark:text-white">{ind.fullName}</h4>
                              <p className="text-[10px] text-slate-400 font-mono font-bold leading-none select-all">{ind.militaryId}</p>
                            </div>
                          )}
                        </td>

                        {/* Tactical division details */}
                        <td className="px-5 py-4 text-center text-slate-700 dark:text-slate-350">
                          <div className="space-y-0.5">
                            <span className="text-3xs bg-slate-100 dark:bg-slate-900 text-slate-650 px-2 py-0.5 rounded font-black max-w-full truncate inline-block">{ind.unit}</span>
                            {isEditing ? (
                              <div className="flex gap-1 justify-center mt-1">
                                <input
                                  type="text"
                                  placeholder="الكتيبة"
                                  value={editIndBatal}
                                  onChange={(e) => setEditIndBatal(e.target.value)}
                                  className="w-14 text-center border p-0.5 rounded text-3xs"
                                />
                                <input
                                  type="text"
                                  placeholder="السرية"
                                  value={editIndComp}
                                  onChange={(e) => setEditIndComp(e.target.value)}
                                  className="w-14 text-center border p-0.5 rounded text-3xs"
                                />
                              </div>
                            ) : (
                              (ind.battalion || ind.company) ? (
                                <p className="text-4xs text-slate-400 font-black">{ind.battalion || '-'} | {ind.company || '-'}</p>
                              ) : null
                            )}
                          </div>
                        </td>

                        {/* Entitled cash value */}
                        <td className="px-5 py-4 text-center font-mono font-bold text-slate-800 dark:text-white">
                          {isEditing ? (
                            <input
                              type="number"
                              value={editIndAmount}
                              onChange={(e) => setEditIndAmount(Number(e.target.value))}
                              className="w-20 text-center border p-1 rounded font-black"
                            />
                          ) : (
                            <span>{formatCurrency(ind.entitledAmount)}</span>
                          )}
                        </td>

                        {/* Payout status badge */}
                        <td className="px-5 py-4 text-center">
                          {isEditing ? (
                            <select
                              value={editIndStatus}
                              onChange={(e) => setEditIndStatus(e.target.value as any)}
                              className="border p-1 rounded text-3xs bg-white dark:bg-slate-950 font-bold"
                            >
                              <option value="pending">قيد الانتظار</option>
                              <option value="received">مستلم ومعلق</option>
                            </select>
                          ) : (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black border ${
                              ind.payoutStatus === 'received' 
                                ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-450 border-emerald-250' 
                                : 'bg-amber-50 dark:bg-amber-955/25 text-amber-805 dark:text-amber-400 border-amber-200'
                            }`}>
                              {ind.payoutStatus === 'received' ? 'مستلم ومجرّف' : 'قيد الانتظار'}
                            </span>
                          )}
                        </td>

                        {/* Assigned field Cashier */}
                        <td className="px-5 py-4 text-center font-bold">
                          {ind.payoutStatus === 'received' ? (
                            <div className="space-y-0.5 text-xs">
                              <p className="text-emerald-700 leading-none">{ind.receivedCashierName || 'المسؤول المالي'}</p>
                              <span className="text-[9px] text-slate-450 font-mono block leading-none">{formatDateTime(ind.receivedAt).slice(11, 19)}</span>
                            </div>
                          ) : assignedCashier ? (
                            <p className="text-indigo-800 dark:text-indigo-400 text-3xs bg-indigo-50 dark:bg-indigo-950/30 px-2 py-1 rounded-md inline-block">🎯 {assignedCashier.name}</p>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-700 text-4xs">غير مكلّف</span>
                          )}
                        </td>

                        {/* Interactive edit, delete, and payout cancel buttons */}
                        <td className="px-5 py-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {isEditing ? (
                              <>
                                <button type="button" onClick={() => handleSaveIndividualEdit(ind.militaryId)} className="p-1 px-2 border border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg">
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button type="button" onClick={() => setEditingIndId(null)} className="p-1 px-2 border border-rose-200 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              <>
                                {ind.payoutStatus === 'received' && onCancelPayout && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (window.confirm(`تحذير أمني عالي: هل تريد فعلاً إلغاء حالة الاستلام للفرد العسكري ${ind.fullName} وإعادته لوضعية "لم ينصرف"؟ سيتم قيد العملية في سجل المحاضر الأمنية.`)) {
                                        await onCancelPayout(ind.militaryId, ind);
                                        await logSystemEvent(`إلغاء عملية صرف وتجريف وإعادة المستند لوضع الانتظار للفرد: ${ind.fullName}`, 'cancel');
                                        alert('تم إلغاء حركة الصرف وإعادة العنصر لطابور الانتظار.');
                                      }
                                    }}
                                    className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-205 dark:bg-amber-955/20 dark:text-amber-450 text-[10px] font-black rounded-lg transition"
                                  >
                                    إرجاع قيد
                                  </button>
                                )}
                                
                                <button
                                  type="button"
                                  onClick={() => startEditingIndividual(ind)}
                                  className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 border dark:border-slate-800 rounded-lg"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (window.confirm(`هل أنت متأكد من حذف ${ind.fullName} من قواعد البيانات التعبوية؟`)) {
                                      await onDeleteIndividual(ind.militaryId);
                                      await logSystemEvent(`حذف مالي وإداري للفرد العسكري: ${ind.fullName}`, 'cancel');
                                      alert('تم حذف السجل بنجاح.');
                                    }
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>

                      </tr>
                    );
                  })}

                  {filteredIndividuals.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-14 text-slate-400 font-extrabold text-xs">لا توجد نتائج تطابق معايير ومصطلحات البحث الحالية.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

          </div>

        </div>
      )}

      {/* ==================================== 2. SUB-TAB: MANUAL & bulk CSV IMPORT ==================================== */}
      {subTab === 'import' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Form manual insert individual */}
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center gap-2 justify-end border-b pb-3 mb-5">
              <div className="text-right">
                <h3 className="text-sm font-black text-slate-800 dark:text-white">قيد وتسجيل فرد عسكري يدوياً</h3>
                <p className="text-4xs text-slate-400 mt-0.5">يقترح تسجيلهم قبل كشف الصرف أو لتصحيح غيابات الوحدات التكتيكية</p>
              </div>
              <Plus className="w-5 h-5 text-emerald-600" />
            </div>

            <form onSubmit={handleSingleSubmit} className="space-y-4 text-right leading-none">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1">الاسم الرباعي العسكري للفرد:</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: جندي أول/ ماجد عبدالله الحربي"
                    value={newIndName}
                    onChange={(e) => setNewIndName(e.target.value)}
                    className="w-full text-right py-2 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1">الرقم العسكري للهوية:</label>
                  <input
                    type="text"
                    required
                    maxLength={14}
                    placeholder="مثال: 1029410940"
                    value={newIndId}
                    onChange={(e) => setNewIndId(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-full text-left pl-3 pr-2 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1">الوحدة التعبوية التابع لها:</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: لواء المهام الخاصة"
                    value={newIndUnit}
                    onChange={(e) => setNewIndUnit(e.target.value)}
                    className="w-full text-right py-2 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1">الكتيبة:</label>
                  <input
                    type="text"
                    placeholder="مثال: الكتيبة الخامسة مدرعات"
                    value={newIndBatal}
                    onChange={(e) => setNewIndBatal(e.target.value)}
                    className="w-full text-right py-2 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1">السرية:</label>
                  <input
                    type="text"
                    placeholder="مثال: السرية الثانية صيانة"
                    value={newIndComp}
                    onChange={(e) => setNewIndComp(e.target.value)}
                    className="w-full text-right py-2 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1">رقم الفصيل (اختياري):</label>
                  <input
                    type="text"
                    placeholder="مثال: الفصيل الأول"
                    value={newIndPlat}
                    onChange={(e) => setNewIndPlat(e.target.value)}
                    className="w-full text-right py-2 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-black text-slate-500 mb-1">قيمة راتب الصرف (ريال سعودي SAR):</label>
                  <input
                    type="number"
                    value={newIndAmount}
                    onChange={(e) => setNewIndAmount(Number(e.target.value))}
                    className="w-full text-center py-2 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono font-black border-indigo-200 inline-block focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="py-2.5 px-6 bg-slate-900 hover:bg-black dark:bg-emerald-650 text-white font-black rounded-xl text-xs transition cursor-pointer"
                >
                  تعميد وإدارج الفرد فوراً
                </button>
              </div>
            </form>
          </div>

          {/* Excel / Copy Paste bulk spreadsheet Importer */}
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
            <div className="space-y-4 text-right">
              <div className="flex items-center gap-2 justify-end border-b pb-3 leading-none">
                <div className="text-right">
                  <h3 className="text-sm font-black text-slate-800 dark:text-white">الاستيراد الفوري اللصيق من ملفات Excel / CSV</h3>
                  <p className="text-4xs text-slate-400 mt-0.5">افتح ملف الإكسيل، انسخ الكشوفات السنوية المالية بمجنديك، والصقها هنا لايف!</p>
                </div>
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              </div>

              <p className="text-[10px] leading-relaxed text-slate-500 font-semibold bg-emerald-50/20 p-3 rounded-xl border border-emerald-50/50">
                ⚠️ **طريقة نسخ البيانات**: احرص أن يحتوي كل سطر على الأعمدة التالية على الترتيب:<br/>
                <span className="font-mono text-emerald-800 font-extrabold text-[10px]">الرقم_العسكري [مسافة/تباعد/فاصلة] الاسم_الرباعي [مسافة] الوحدة [مسافة] القيمة_المالية</span>
              </p>

              <div>
                <label className="block text-[10px] font-black text-slate-400 mb-1.5">الصق الكشوفات هنا من ملف الإكسل مباشرة:</label>
                <textarea
                  rows={6}
                  placeholder="1029410940  فارس عبدالله السبيعي  سرية الطيران  1200&#10;1053018285  خالد محمد الجهني  لواء النخبة  1000"
                  value={csvContentText}
                  onChange={(e) => setCsvContentText(e.target.value)}
                  className="w-full text-right p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-mono font-bold leading-relaxed focus:bg-white dark:focus:bg-slate-900"
                />
              </div>
            </div>

            <div className="flex items-center justify-between border-t pt-4 mt-4">
              <button
                type="button"
                onClick={handleParseCsvLog}
                className="py-2 px-5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 text-slate-700 dark:text-slate-350 font-black rounded-xl text-3xs cursor-pointer transition"
              >
                تحليل المطابقة التمهيدية ({parsedRowsCount} سطر)
              </button>
              
              <button
                type="button"
                onClick={handleApplyBulkImport}
                className="py-2.5 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow transition active:scale-[0.98]"
              >
                <Upload className="w-4 h-4" />
                استيراد واعتماد الكشوفات الكلية
              </button>
            </div>
          </div>

        </div>
      )}

      {/* ==================================== 3. SUB-TAB: TASK assignments DISTRIBUTION ==================================== */}
      {subTab === 'distribution' && (
        <div className="space-y-6">
          
          {/* Active loads card for balancing cashiers */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {cashiers.map(c => {
              const pendingLoads = individuals.filter(i => i.payoutStatus === 'pending' && i.assignedCashierId === c.id).length;
              return (
                <div key={c.id} className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-3xl shadow-sm text-right flex flex-col justify-between">
                  <div className="flex justify-between items-start leading-none gap-2">
                    <span className="text-[9px] bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 font-extrabold px-2 py-0.5 rounded-full">تفويض نشط</span>
                    <h4 className="text-xs font-black text-slate-800 dark:text-white leading-none">{c.name}</h4>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 font-bold">📍 نقطة الصندوق: {c.payoutPoint || 'ميدانية عامة'}</p>
                  
                  <div className="flex justify-between items-center text-[11px] font-bold mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-900">
                    <span className="text-slate-400">العساكر المجدولين لديه:</span>
                    <span className="text-indigo-805 dark:text-indigo-400 text-xs font-mono font-black">{pendingLoads} فرد قيد الصرف</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Distribution Center inputs */}
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm text-right space-y-5">
            <div className="flex items-center justify-between border-b pb-3 leading-none">
              <div className="text-right">
                <h3 className="text-sm font-black text-slate-800 dark:text-white">مركز الموازنة وتوجيه مهام الصرف</h3>
                <p className="text-4xs text-slate-400 mt-0.5">وجّه الأفراد المتبقين بصورة مفردة أو بالمجموعات التصنيفية لتفادي التكدس على منافذ معينة</p>
              </div>
              <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setDistType('special')}
                  className={`py-1.5 px-3.5 rounded-lg text-3xs font-black transition cursor-pointer ${distType === 'special' ? 'bg-white dark:bg-slate-950 text-emerald-800 dark:text-white shadow-xs' : 'text-slate-450 hover:text-slate-800'}`}
                >
                  تعيين وتوجيه فردي خاص
                </button>
                <button
                  type="button"
                  onClick={() => setDistType('bulk')}
                  className={`py-1.5 px-3.5 rounded-lg text-3xs font-black transition cursor-pointer ${distType === 'bulk' ? 'bg-white dark:bg-slate-950 text-emerald-800 dark:text-white shadow-xs' : 'text-slate-450 hover:text-slate-800'}`}
                >
                  توجيه شامل بالمجموعة الفئوية
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
              
              {/* Select cashier */}
              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-1.5">1️⃣ اختر الصراف הממוקד لتلقي المعاملات:</label>
                <select
                  value={distCashierId}
                  onChange={(e) => setDistCashierId(e.target.value)}
                  className="w-full text-right py-2.5 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs cursor-pointer focus:ring-2 focus:ring-emerald-500 font-bold"
                >
                  <option value="">اطلب الصراف...</option>
                  {cashiers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.payoutPoint})</option>)}
                </select>
              </div>

              {/* Distribute Area based on Type */}
              {distType === 'special' ? (
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5">2️⃣ اختر الاستحقاق المالي المعلق للفرد العسكري:</label>
                  <div className="flex gap-2">
                    <select
                      value={distIndividualId}
                      onChange={(e) => setDistIndividualId(e.target.value)}
                      className="flex-1 text-right py-2.5 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs cursor-pointer focus:ring-2 focus:ring-emerald-500 font-extrabold"
                    >
                      <option value="">ابحث عن فرد عينات الانتظار...</option>
                      {individuals.filter(i => i.payoutStatus === 'pending' && !i.assignedCashierId).map(i => (
                        <option key={i.militaryId} value={i.militaryId}>{i.fullName} ({i.militaryId}) - {i.unit}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleApplySpecialDistribution}
                      className="py-2.5 px-5 bg-slate-900 hover:bg-black dark:bg-emerald-650 dark:hover:bg-emerald-600 text-white font-black rounded-xl text-xs whitespace-nowrap cursor-pointer transition scale-[0.98] active:scale-95"
                    >
                      اعتماد تعيين وتفويض الصرف
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5">2️⃣ حدد التصنيف اللوحي واكتب الفئة المراد توجيهها بالكامل:</label>
                  <div className="flex gap-2 flex-col sm:flex-row">
                    <select
                      value={bulkField}
                      onChange={(e) => {
                        setBulkField(e.target.value as any);
                        setBulkValue('');
                      }}
                      className="py-2 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl text-xs cursor-pointer font-bold"
                    >
                      <option value="unit">الوحدة التعبوية</option>
                      <option value="battalion">الكتيبة</option>
                      <option value="company">السرية</option>
                    </select>
                    <input
                      type="text"
                      placeholder="اكتب القيمة المطابقة تماماً لكلمة التصنيف..."
                      value={bulkValue}
                      onChange={(e) => setBulkValue(e.target.value)}
                      className="flex-1 text-right py-2 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={handleApplyBulkDistribution}
                      className="py-2 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs cursor-pointer transition scale-[0.98] active:scale-95 whitespace-nowrap"
                    >
                      توجيه شامل للمجموعة التامّة
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>

        </div>
      )}

    </div>
  );
}
