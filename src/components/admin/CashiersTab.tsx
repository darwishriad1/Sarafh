/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  UserPlus, Phone, Smartphone, Plus, UserCheck, 
  Trash2, ShieldCheck, Check, X, Shield, Users
} from 'lucide-react';
import { Individual, Cashier } from '../../types';
import { formatCurrency } from '../../utils';

interface CashiersTabProps {
  individuals: Individual[];
  cashiers: Cashier[];
  onAddCashier: (cashier: Cashier) => Promise<void>;
  onUpdateCashier: (id: string, updates: Partial<Cashier>) => Promise<void>;
  onDeleteCashier: (id: string) => Promise<void>;
  logSystemEvent: (details: string, type: 'payout' | 'cancel' | 'edit' | 'backup_restore' | 'alert') => Promise<void>;
}

export default function CashiersTab({
  individuals,
  cashiers,
  onAddCashier,
  onUpdateCashier,
  onDeleteCashier,
  logSystemEvent
}: CashiersTabProps) {
  
  // Registration forms state
  const [newCashierName, setNewCashierName] = useState('');
  const [newCashierPhone, setNewCashierPhone] = useState('');
  const [newCashierUsername, setNewCashierUsername] = useState('');
  const [newCashierPin, setNewCashierPin] = useState('');
  const [newCashierPoint, setNewCashierPoint] = useState('');
  const [newCashierPrivilege, setNewCashierPrivilege] = useState('شاملة');

  // Inline edit state
  const [editingCashierId, setEditingCashierId] = useState<string | null>(null);
  const [editCashierName, setEditCashierName] = useState('');
  const [editCashierPhone, setEditCashierPhone] = useState('');
  const [editCashierPin, setEditCashierPin] = useState('');
  const [editCashierPoint, setEditCashierPoint] = useState('');
  const [editCashierPriv, setEditCashierPriv] = useState('شاملة');

  // Register cashier action
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCashierName || !newCashierUsername || !newCashierPin) {
      alert('الرجاء تعبئة البيانات الأساسية: الاسم، اسم مستخدم، والرقم السري المالي PIN.');
      return;
    }
    
    // Check for duplicate username
    if (cashiers.some(c => c.username === newCashierUsername.toLowerCase().trim())) {
      alert('خطأ: اسم المستخدم هذا مسجل مسبقاً لصراف آخر!');
      return;
    }

    const newID = 'cash_' + Date.now();
    const record: Cashier = {
      id: newID,
      name: newCashierName,
      username: newCashierUsername.toLowerCase().trim(),
      pinCode: newCashierPin,
      isActive: true,
      payoutPoint: newCashierPoint || 'نقطة ميدانية عامة',
      phone: newCashierPhone,
      privileges: newCashierPrivilege
    };
    
    try {
      await onAddCashier(record);
      await logSystemEvent(`ترخيص وتأسيس صراف جديد بالحقيبة الرقمية: ${newCashierName}`, 'edit');
      setNewCashierName('');
      setNewCashierPhone('');
      setNewCashierUsername('');
      setNewCashierPin('');
      setNewCashierPoint('');
      alert('تم إدراج الصراف الميداني بنجاح مع تفعيل وتفويض حسابه فوراً.');
    } catch (err: any) {
      alert('تعذر تسجيل الصراف: ' + err.message);
    }
  };

  // Launch edit
  const startEditing = (c: Cashier) => {
    setEditingCashierId(c.id);
    setEditCashierName(c.name);
    setEditCashierPhone(c.phone || '');
    setEditCashierPin(c.pinCode);
    setEditCashierPoint(c.payoutPoint || '');
    setEditCashierPriv(c.privileges || 'شاملة');
  };

  // Save edit
  const saveEdit = async (cashierId: string) => {
    if (!editCashierName || !editCashierPin) {
      alert('الرجاء كتابة الاسم والرمز السري PIN للصراف.');
      return;
    }
    try {
      await onUpdateCashier(cashierId, {
        name: editCashierName,
        phone: editCashierPhone,
        pinCode: editCashierPin,
        payoutPoint: editCashierPoint,
        privileges: editCashierPriv
      });
      await logSystemEvent(`تعديل وحفظ بيانات الصراف المالي: ${editCashierName}`, 'edit');
      setEditingCashierId(null);
      alert('تم تحديث وحفظ بيانات الصراف بنجاح.');
    } catch (err: any) {
      alert('تعذر تحديث الصراف: ' + err.message);
    }
  };

  // Delete cashier
  const handleDeleteAction = async (id: string, name: string) => {
    if (window.confirm(`هل أنت متأكد نهائياً من إلغاء ترخيص وحذف حساب الصراف السحابي [${name}]؟ سيتم قطع اتصاله وقابليته للصرف تماماً.`)) {
      try {
        await onDeleteCashier(id);
        await logSystemEvent(`إلغاء لواء التفويض المالي وحذف حساب الصراف: ${name}`, 'cancel');
        alert('تم شطب ترخيص وحذف الصراف بالكامل من السجلات.');
      } catch (err: any) {
        alert('خطأ أثناء عملية الحذف الممنهج: ' + err.message);
      }
    }
  };

  return (
    <div className="space-y-6">
      
      {/* 🧾 Cashier Creation Form Panel */}
      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
        <div className="flex items-center gap-2 justify-end border-b border-slate-100 dark:border-slate-900 pb-3 mb-5">
          <div className="text-right">
            <h3 className="text-sm font-black text-slate-800 dark:text-white">إصدار تفويض وتأسيس صراف جديد</h3>
            <p className="text-4xs text-slate-400 mt-0.5">تسجيل صراف جديد، تهيئة رقم الدخول الخاص به وتوزيع نقطة استلام الحساب الميداني</p>
          </div>
          <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
            <UserPlus className="w-5 h-5" />
          </div>
        </div>

        <form onSubmit={handleAddSubmit} className="space-y-4 text-right">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Cashier Name */}
            <div>
              <label className="block text-[10px] font-black text-slate-500 mb-1">الاسم واللقب العسكري للصراف:</label>
              <input
                type="text"
                required
                placeholder="مثال: نقيب/ حمزة الجهني"
                value={newCashierName}
                onChange={(e) => setNewCashierName(e.target.value)}
                className="w-full text-right py-2 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 rounded-xl text-xs"
              />
            </div>

            {/* Mobile Phone */}
            <div>
              <label className="block text-[10px] font-black text-slate-500 mb-1">رقم هاتف الاتصال الجوال:</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="مثال: 055301822"
                  value={newCashierPhone}
                  onChange={(e) => setNewCashierPhone(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-full text-left pl-3 pr-2 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 rounded-xl text-xs font-mono"
                />
                <Phone className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            {/* Username */}
            <div>
              <label className="block text-[10px] font-black text-slate-500 mb-1">رمز معرف المستخدم اللاتيني (Username):</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="مثال: h_juhani"
                  value={newCashierUsername}
                  onChange={(e) => setNewCashierUsername(e.target.value.replace(/[^a-z0-9_]/g, ''))}
                  className="w-full text-left pl-3 pr-2 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 rounded-xl text-xs font-mono"
                />
                <Smartphone className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            {/* Password PIN */}
            <div>
              <label className="block text-[10px] font-black text-slate-500 mb-1">الرقم السري المالي للدخول PIN (4 أرقام):</label>
              <input
                type="password"
                required
                maxLength={4}
                placeholder="رقم سري مكون من 4 أعداد"
                value={newCashierPin}
                onChange={(e) => setNewCashierPin(e.target.value.replace(/[^0-9]/g, ''))}
                className="w-full text-center py-2 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 rounded-xl text-xs font-mono tracking-widest font-black"
              />
            </div>

            {/* Selling point location */}
            <div>
              <label className="block text-[10px] font-black text-slate-500 mb-1">موقع ونقطة النقدية الميدانية:</label>
              <input
                type="text"
                placeholder="مثال: غرفة الصرف بالفرقة الأولى"
                value={newCashierPoint}
                onChange={(e) => setNewCashierPoint(e.target.value)}
                className="w-full text-right py-2 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 rounded-xl text-xs"
              />
            </div>

            {/* Privilege Level */}
            <div>
              <label className="block text-[10px] font-black text-slate-500 mb-1">مستوى الصلاحيات بالمنصة:</label>
              <select
                value={newCashierPrivilege}
                onChange={(e) => setNewCashierPrivilege(e.target.value)}
                className="w-full text-right py-2 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 rounded-xl text-xs cursor-pointer font-bold text-slate-700 dark:text-slate-350"
              >
                <option value="شاملة">صلاحية شاملة (تسليم وصرف كامل للمستحقين)</option>
                <option value="محدودة">صلاحية مقيدة (صرف للأفراد الموجهين مسبقاً فقط)</option>
              </select>
            </div>

          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="py-2.5 px-6 bg-slate-900 hover:bg-black dark:bg-emerald-650 dark:hover:bg-emerald-600 text-white rounded-xl text-xs font-black flex items-center gap-1 transition shadow-md active:scale-[0.98] cursor-pointer"
            >
              <Plus className="w-4 h-4 text-emerald-450 dark:text-white" />
              تخميد وتوثيق تفعيل حساب الصراف
            </button>
          </div>
        </form>
      </div>

      {/* 👥 Cashiers Table Lists */}
      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-900 flex justify-between items-center bg-slate-550/10">
          <div className="text-right">
            <h3 className="text-sm font-black text-slate-800 dark:text-white">جدول كتاب وصيارفة الميدان المرخصين</h3>
            <p className="text-4xs text-slate-400 mt-0.5">قائمة بجميع المحاسبين الماليين العسكريين المخولين بحقيبة الصرف الإلكترونية</p>
          </div>
          <span className="text-3xs font-mono font-black bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 px-2.5 py-1 rounded-full">{cashiers.length} صراف مفوض</span>
        </div>
        
        <div className="overflow-x-auto text-right">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 font-black border-b border-slate-150 text-right">
              <tr>
                <th className="px-5 py-4">اسم وأحقية الصراف</th>
                <th className="px-5 py-4">معرّف الدخول وجواله</th>
                <th className="px-5 py-4 text-center">الرمز المالي PIN</th>
                <th className="px-5 py-4 text-center">مقر الصندوق ونقطة التمركز</th>
                <th className="px-5 py-4 text-center">الأداء والكتلة النقدية المصروفة</th>
                <th className="px-5 py-4 text-center">إدارة الصلاحيات والرقابة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-900 align-middle">
              {cashiers.map((c) => {
                const isEditing = editingCashierId === c.id;
                const paidOps = individuals.filter(i => i.payoutStatus === 'received' && i.receivedCashierId === c.id);
                const paidSum = paidOps.reduce((sum, item) => sum + item.entitledAmount, 0);

                return (
                  <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/35 transition">
                    
                    {/* Cashier name / privileges badge */}
                    <td className="px-5 py-4">
                      {isEditing ? (
                        <div className="space-y-1.5 max-w-xs">
                          <input
                            type="text"
                            value={editCashierName}
                            onChange={(e) => setEditCashierName(e.target.value)}
                            className="py-1 px-2 border dark:border-slate-800 rounded-lg w-full bg-white dark:bg-slate-950 text-xs font-bold text-right"
                          />
                          <select
                            value={editCashierPriv}
                            onChange={(e) => setEditCashierPriv(e.target.value)}
                            className="w-full py-1 px-2 border dark:border-slate-800 rounded bg-white dark:bg-slate-950 text-3xs"
                          >
                            <option value="شاملة">شاملة</option>
                            <option value="محدودة">محدودة</option>
                          </select>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2.5">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black ${
                            c.isActive ? 'bg-emerald-500/10 text-emerald-700' : 'bg-rose-500/10 text-rose-700'
                          }`}>
                            <Shield className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-extrabold text-slate-850 dark:text-slate-100 leading-none">{c.name}</p>
                            <span className={`inline-flex items-center text-[8px] font-black px-1.5 py-0.5 rounded-md mt-1 border ${
                              c.privileges === 'شاملة' 
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-800' 
                                : 'bg-slate-50 border-slate-200 text-slate-800'
                            }`}>
                              صلاحية {c.privileges || 'شاملة'}
                            </span>
                          </div>
                        </div>
                      )}
                    </td>

                    {/* username / contact */}
                    <td className="px-5 py-4">
                      <div className="space-y-1 font-mono font-bold leading-none">
                        <p className="text-slate-800 dark:text-slate-200 text-[11px]">{c.username}</p>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editCashierPhone}
                            onChange={(e) => setEditCashierPhone(e.target.value)}
                            className="p-1 border dark:border-slate-800 rounded w-full bg-white dark:bg-slate-950 text-xs"
                          />
                        ) : (
                          <p className="text-slate-450 dark:text-slate-500 text-4xs">{c.phone || 'بلا جوال'}</p>
                        )}
                      </div>
                    </td>

                    {/* PIN Code */}
                    <td className="px-5 py-4 text-center">
                      {isEditing ? (
                        <input
                          type="text"
                          maxLength={4}
                          value={editCashierPin}
                          onChange={(e) => setEditCashierPin(e.target.value.replace(/[^0-9]/g, ''))}
                          className="py-1 px-2 border dark:border-slate-800 rounded-lg w-16 bg-white dark:bg-slate-950 text-center font-black"
                        />
                      ) : (
                        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 rounded-lg px-2.5 py-1 text-center font-mono inline-block font-bold">
                          <span>{c.pinCode}</span>
                        </div>
                      )}
                    </td>

                    {/* Location selling point */}
                    <td className="px-5 py-4 text-center text-slate-705 font-bold">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editCashierPoint}
                          onChange={(e) => setEditCashierPoint(e.target.value)}
                          className="py-1 px-2 border dark:border-slate-800 rounded bg-white dark:bg-slate-950 text-xs text-right"
                        />
                      ) : (
                        <span>{c.payoutPoint || 'عام'}</span>
                      )}
                    </td>

                    {/* Disbursed totals */}
                    <td className="px-5 py-4 text-center">
                      <div className="space-y-1 leading-none font-mono font-bold text-[11px]">
                        <p className="text-emerald-700 dark:text-emerald-450 text-xs font-black">{formatCurrency(paidSum)}</p>
                        <p className="text-slate-400 text-4xs">تم صرف لـ {paidOps.length} فرد</p>
                      </div>
                    </td>

                    {/* Actions and Controls */}
                    <td className="px-5 py-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              onClick={() => saveEdit(c.id)}
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded-lg transition border border-emerald-500/10 cursor-pointer"
                              title="حفظ التعديلات"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingCashierId(null)}
                              className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition border border-rose-500/10 cursor-pointer"
                              title="إلغاء التعديل"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => startEditing(c)}
                              className="px-2.5 py-1.5 text-slate-500 hover:text-slate-850 dark:hover:text-white hover:bg-slate-55 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-lg text-4xs font-black cursor-pointer transition"
                            >
                              بيانات
                            </button>
                            
                            {/* Toggle active switch button */}
                            <button
                              type="button"
                              onClick={async () => {
                                await onUpdateCashier(c.id, { isActive: !c.isActive });
                                await logSystemEvent(`تعديل حالة تفويض الصراف ${c.name} إلى [${!c.isActive ? 'مفعل نشط' : 'معطل وموقوف'}]`, 'edit');
                              }}
                              className={`px-2.5 py-1.5 rounded-lg border text-4xs font-black cursor-pointer transition ${
                                c.isActive 
                                  ? 'bg-emerald-50 border-emerald-250 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400' 
                                  : 'bg-rose-50 border-rose-250 text-rose-800 hover:bg-rose-100 dark:bg-rose-950/20 dark:text-rose-450'
                              }`}
                            >
                              {c.isActive ? 'مفوّض نشط' : 'قيد الإيقاف'}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteAction(c.id, c.name)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg cursor-pointer transition"
                              title="حذف ترخيص الصراف"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>

                  </tr>
                );
              })}

              {cashiers.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400 font-bold text-xs">لا يوجد صرافين مسجلين في النظام للتفويض حالياً.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
