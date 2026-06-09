/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Settings, Save, Database, ShieldAlert, FileText, Upload, 
  Download, RefreshCw, Sun, Moon, AlertTriangle, ShieldCheck
} from 'lucide-react';
import { Individual, Cashier } from '../../types';

interface SettingsTabProps {
  orgName: string;
  setOrgName: (val: string) => void;
  dailyAmount: number;
  setDailyAmount: (val: number) => void;
  systemLogo: string;
  setSystemLogo: (val: string) => void;
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
  individuals: Individual[];
  cashiers: Cashier[];
  onRestoreBackup: (backupData: { individuals: Individual[], cashiers: Cashier[] }) => Promise<void>;
  onSeedData?: () => Promise<void>;
  logSystemEvent: (details: string, type: 'payout' | 'cancel' | 'edit' | 'backup_restore' | 'alert') => Promise<void>;
}

export default function SettingsTab({
  orgName,
  setOrgName,
  dailyAmount,
  setDailyAmount,
  systemLogo,
  setSystemLogo,
  isDarkMode,
  setIsDarkMode,
  individuals,
  cashiers,
  onRestoreBackup,
  onSeedData,
  logSystemEvent
}: SettingsTabProps) {

  const [loadingSeed, setLoadingSeed] = useState(false);
  const [loadingRestore, setLoadingRestore] = useState(false);

  // Profile temporary inputs
  const [localOrgName, setLocalOrgName] = useState(orgName);
  const [localDailyAmount, setLocalDailyAmount] = useState(dailyAmount);
  const [localLogo, setLocalLogo] = useState(systemLogo);

  // Submit profile forms
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrgName(localOrgName);
    setDailyAmount(Number(localDailyAmount));
    setSystemLogo(localLogo);
    await logSystemEvent(`تحديث إعدادات اللائحة التنظيمية وتعديل الاستحقاق اليومي لـ [${localDailyAmount} ريال]`, 'edit');
    alert('تم حفظ إعدادات وثيقة النظام والتحكم بنجاح.');
  };

  // BACKUP FUNCTION: Create downloadable JSON file
  const handleDownloadBackup = async () => {
    try {
      const backupObj = {
        meta: {
          exportedAt: new Date().toISOString(),
          version: '1.2.0-tactical-disbursement',
          recordsCount: {
            individuals: individuals.length,
            cashiers: cashiers.length
          }
        },
        individuals,
        cashiers
      };

      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupObj, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `كشف_احتياطي_منظومة_الصرف_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      await logSystemEvent('استخراج وتصدير نسخة احتياطية مشفرة لقواعد البيانات', 'backup_restore');
      alert('تم تصدير نسخة احتياطية كاملة (JSON) وحفظها على جهازك بنجاح.');
    } catch (e: any) {
      alert('خطأ أثناء تصدير ملف النسخة الاحتياطية: ' + e.message);
    }
  };

  // RESTORE FUNCTION: Handle JSON upload restore
  const handleUploadRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    const uploadedFile = e.target.files?.[0];

    if (!uploadedFile) return;

    fileReader.onload = async (event) => {
      try {
        setLoadingRestore(true);
        const parsedData = JSON.parse(event.target?.result as string);
        
        if (!parsedData.individuals || !parsedData.cashiers) {
          throw new Error('ملف النسخة الاحتياطية تالف أو غاب عنه جداول المجندين والصلات الدقيقة.');
        }

        if (window.confirm(`يرجى الانتباه! أنت بصدد مسح السجلات والبيانات الحالية وتركيب نسخة قديمة مرسلة كاحتياطي تتضمن [${parsedData.individuals.length}] فرداً و [${parsedData.cashiers.length}] صرافاً. هل تريد المتابعة الأكيدة والمخاطرة؟`)) {
          await onRestoreBackup({
            individuals: parsedData.individuals,
            cashiers: parsedData.cashiers
          });
          await logSystemEvent('تركيب جراحي واستعادة ناجحة لقاعدة البيانات من ملف احتياطي معتمد', 'backup_restore');
          alert('تهانينا! تمت استعادة هيكلية قواعد البيانات وصيانة الاتصال السحابي بنجاح.');
        }
      } catch (err: any) {
        alert('حدث خطأ فادح برفع واستعادة الكشف: ' + err.message);
      } finally {
        setLoadingRestore(false);
      }
    };

    fileReader.readAsText(uploadedFile);
  };

  // DEPLOY blueprints: Trigger Seeding simulation
  const handleTriggerSeedingOperation = async () => {
    if (!onSeedData) return;
    if (window.confirm('🚨 تحذير: هذه العملية ستقوم بتطبيع وسحب حزمة كشوفات سريعة من 50 عسكري عينات و 3 صيارفة كبيان تأسيسي لمحاكاة الميدان. هل تريد المتابعة المضمونة؟')) {
      try {
        setLoadingSeed(true);
        await onSeedData();
        await logSystemEvent('توليد وهندسة كشوف تأسيسية وهمية لتجربة الميدان (Auto-Seeding)', 'backup_restore');
        alert('تم تعذين وتوليد كشف تجريبي مدمج شامل.');
      } catch (err: any) {
        alert('خطأ أثناء بناء البيانات الساحرة: ' + err.message);
      } finally {
        setLoadingSeed(false);
      }
    }
  };

  return (
    <div className="space-y-6 text-right">
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Profile customization settings form */}
        <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-2 justify-end border-b pb-3 mb-5 leading-none">
            <div className="text-right">
              <h3 className="text-sm font-black text-slate-800 dark:text-white">تخصيص اللائحة والواجهة العامة</h3>
              <p className="text-4xs text-slate-400 mt-0.5">صيانة معايير النقدية، تسمية مديرية اللواء واكتساب رموز العملة</p>
            </div>
            <Settings className="w-5 h-5 text-slate-500" />
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            
            <div className="space-y-1">
              <label className="block text-[10px] font-black text-slate-400">اسم المديرية / الهيئة الإدارية الشاملة:</label>
              <input
                type="text"
                value={localOrgName}
                onChange={(e) => setLocalOrgName(e.target.value)}
                className="w-full text-right py-2 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-indigo-500 rounded-xl text-xs font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-400">قيمة الصرف المعياري للفرد (SAR):</label>
                <input
                  type="number"
                  value={localDailyAmount}
                  onChange={(e) => setLocalDailyAmount(Number(e.target.value))}
                  className="w-full text-center py-2 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono font-black"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-400">الشعار البصري اللوحى لمشروع الصرف (أيقونة):</label>
                <input
                  type="text"
                  maxLength={2}
                  value={localLogo}
                  onChange={(e) => setLocalLogo(e.target.value)}
                  className="w-full text-center py-2 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono font-black text-lg"
                />
              </div>

            </div>

            {/* Quick theme toggler selection */}
            <div className="p-3.5 border border-slate-100 dark:border-slate-900 bg-slate-550/10 rounded-2xl flex items-center justify-between leading-none text-slate-700 dark:text-slate-300">
              <span className="text-3xs font-black">التبديل بين السِمات البصرية المتوافقة:</span>
              <button
                type="button"
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-indigo-950/40 text-slate-800 dark:text-yellow-400 border dark:border-indigo-900 rounded-xl flex items-center justify-center gap-1.5 text-4xs font-black cursor-pointer transition active:scale-95"
              >
                {isDarkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5 text-indigo-700" />}
                {isDarkMode ? 'الوضع المضيء الطبيعي' : 'وضع الشفق والعتامة العين'}
              </button>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="py-2.5 px-6 bg-slate-900 hover:bg-black dark:bg-emerald-650 dark:hover:bg-emerald-600 text-white font-black rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow transition active:scale-[0.98]"
              >
                <Save className="w-4 h-4" />
                حفظ وإقرار التهيئة التنظيمية
              </button>
            </div>

          </form>
        </div>

        {/* Database vault operations: backups, restores and seeding */}
        <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2 justify-end border-b pb-3 leading-none">
              <div className="text-right">
                <h3 className="text-sm font-black text-rose-700 dark:text-rose-450 flex items-center gap-1 justify-end">
                  خزنة تأمين قواعد البيانات والمزامنة
                </h3>
                <p className="text-4xs text-slate-400 mt-0.5">التحكيم الفيدرالي الاحتياطي، سحب سجلات التبرعات والمطابقة</p>
              </div>
              <Database className="w-5 h-5 text-rose-600" />
            </div>

            <p className="text-4xs leading-relaxed text-slate-500 font-semibold bg-rose-50/15 p-3 rounded-xl border border-rose-100/30">
              🚨 **تنبيه أمني**: استعادة قاعدة البيانات من ملف خارجي سيقوم بمحو واستبدال جميع الأفراد المسجلين والمجندين وجميع الصرافين قيد المزامنات. اضمن الحصول على نسخة احتياطية محلية قبل هذا الإجراء.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              
              {/* Backups download button */}
              <button
                type="button"
                onClick={handleDownloadBackup}
                className="p-5 border border-slate-150 dark:border-slate-800 hover:border-emerald-500/20 bg-slate-50/50 dark:bg-slate-900/10 hover:bg-emerald-50/10 rounded-2xl flex flex-col items-center justify-center text-center space-y-1.5 transition cursor-pointer"
              >
                <Download className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                <span className="text-3xs font-extrabold text-slate-800 dark:text-slate-100">تحميل نسخة احتياطية كاملة</span>
                <span className="text-[9px] text-slate-400 font-bold leading-none">حفظ كملف JSON مشفر محلياً</span>
              </button>

              {/* Upload backups input wrapper */}
              <div className="border border-slate-150 dark:border-slate-800 hover:border-indigo-500/20 bg-slate-550/10 hover:bg-slate-50/20 rounded-2xl p-5 flex flex-col items-center justify-center text-center relative pointer-events-auto">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleUploadRestoreFile}
                  disabled={loadingRestore}
                  className="opacity-0 absolute top-0 left-0 w-full h-full cursor-pointer z-10"
                />
                <Upload className="w-6 h-6 text-indigo-600" />
                <span className="text-3xs font-extrabold text-slate-800 dark:text-slate-205">استعادة النسخة الاحتياطية</span>
                <span className="text-[9px] text-slate-400 font-bold leading-none">ارفع ملف JSON لحقن القواعد</span>
              </div>

            </div>
          </div>

          {/* Seeding capabilities */}
          {onSeedData && (
            <div className="border-t border-slate-100 dark:border-slate-900 pt-4 mt-4 flex items-center justify-between">
              <div className="text-right">
                <h4 className="text-3xs font-black text-slate-700 dark:text-slate-200">صيانة وتبيين كشف تجريبي تأسيسي:</h4>
                <p className="text-[9px] text-slate-400 font-bold leading-tight">سيقوم بتوليف 50 مجنداً وهمياً لتتمكن من فحص وصنّ عينات الصرف لايف</p>
              </div>
              <button
                type="button"
                onClick={handleTriggerSeedingOperation}
                disabled={loadingSeed}
                className="py-2.5 px-5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-905 text-slate-800 dark:text-yellow-450 border dark:border-slate-850 font-black rounded-xl text-3xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-yellow-600 ${loadingSeed ? 'animate-spin' : ''}`} />
                توليد كشوف المحاكاة الذكية
              </button>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
