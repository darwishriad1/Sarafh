/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, UserCheck, ShieldAlert, LogOut, FileText, Settings, 
  Home, Activity, ShieldCheck, Moon, Sun, Bell, ChevronLeft, ChevronRight
} from 'lucide-react';
import { Individual, Cashier, OperationLog } from '../types';
import { playBankChime } from '../utils';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

// Import our modular subcomponents
import DashboardTab from './admin/DashboardTab';
import CashiersTab from './admin/CashiersTab';
import IndividualsTab from './admin/IndividualsTab';
import ReportsTab from './admin/ReportsTab';
import SettingsTab from './admin/SettingsTab';

interface AdminPanelProps {
  individuals: Individual[];
  cashiers: Cashier[];
  operations: OperationLog[];
  onAddIndividual: (ind: Individual) => Promise<void>;
  onUpdateIndividual: (id: string, updates: Partial<Individual>) => Promise<void>;
  onDeleteIndividual: (id: string) => Promise<void>;
  onAddCashier: (cashier: Cashier) => Promise<void>;
  onUpdateCashier: (id: string, updates: Partial<Cashier>) => Promise<void>;
  onDeleteCashier: (id: string) => Promise<void>;
  onCancelPayout: (militaryId: string, item: Individual) => Promise<void>;
  onSeedData: () => Promise<void>;
  onLogout: () => void;
  adminEmail: string;
  isOnline: boolean;
  onRestoreBackup: (backupData: { individuals: Individual[], cashiers: Cashier[] }) => Promise<void>;
}

export default function AdminPanel({
  individuals,
  cashiers,
  operations,
  onAddIndividual,
  onUpdateIndividual,
  onDeleteIndividual,
  onAddCashier,
  onUpdateCashier,
  onDeleteCashier,
  onCancelPayout,
  onSeedData,
  onLogout,
  adminEmail,
  isOnline,
  onRestoreBackup
}: AdminPanelProps) {
  
  // Navigation tabs of redesigned simplified structure (5 unified hubs)
  const [viewState, setViewState] = useState<'lobby' | 'dashboard' | 'cashiers' | 'individuals' | 'reports' | 'settings'>('lobby');
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Mappers to sync with high immersion fullscreen module
  const activeTab = viewState;
  const setActiveTab = setViewState;

  // --- LOCAL PERSISTED CONFIGURATION ---
  const [orgName, setOrgName] = useState(() => 
    localStorage.getItem('admin_org_name') || 'قوات الطوارئ والميدان المالية'
  );
  const [dailyAmount, setDailyAmount] = useState<number>(() => {
    const saved = localStorage.getItem('admin_daily_amount');
    return saved ? Number(saved) : 1000;
  });
  const [systemLogo, setSystemLogo] = useState(() => 
    localStorage.getItem('admin_system_logo') || '👑'
  );
  const [isDarkMode, setIsDarkMode] = useState(() => 
    localStorage.getItem('admin_dark_mode') === 'true'
  );

  useEffect(() => {
    localStorage.setItem('admin_org_name', orgName);
    localStorage.setItem('admin_daily_amount', String(dailyAmount));
    localStorage.setItem('admin_system_logo', systemLogo);
    localStorage.setItem('admin_dark_mode', String(isDarkMode));

    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [orgName, dailyAmount, systemLogo, isDarkMode]);

  // Real-time toast alert state
  const prevOperationsCountRef = useRef<number | null>(null);
  const [liveBankToast, setLiveBankToast] = useState<{
    id: string;
    beneficiary: string;
    militaryId: string;
    amount: number;
    cashierName: string;
    isEmergency?: boolean;
    alertDetails?: string;
  } | null>(null);

  useEffect(() => {
    if (prevOperationsCountRef.current === null) {
      prevOperationsCountRef.current = operations.length;
      return;
    }

    if (operations.length > prevOperationsCountRef.current) {
      const newestOp = operations[0];
      if (newestOp) {
        if (newestOp.type === 'payout') {
          playBankChime('success');
          setLiveBankToast({
            id: newestOp.id,
            beneficiary: newestOp.individualName,
            militaryId: newestOp.individualMilitaryId,
            amount: newestOp.amount,
            cashierName: newestOp.cashierName
          });
        } else if (newestOp.type === 'cancel') {
          playBankChime('cancel');
        } else if (newestOp.type === 'alert') {
          playBankChime('alert');
          setLiveBankToast({
            id: newestOp.id,
            beneficiary: "نداء منع ازدواج الصرفية",
            militaryId: newestOp.individualMilitaryId,
            amount: 0,
            cashierName: newestOp.cashierName,
            isEmergency: true,
            alertDetails: newestOp.details
          });
        }
        
        const timer = setTimeout(() => {
          setLiveBankToast(null);
        }, 6000);
        return () => clearTimeout(timer);
      }
    }
    prevOperationsCountRef.current = operations.length;
  }, [operations]);

  // General audit log helper writing directly to Firestore
  const logSystemEvent = async (details: string, type: 'payout' | 'cancel' | 'edit' | 'backup_restore' | 'alert') => {
    try {
      const opId = 'op_sys_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
      const logRecord: OperationLog = {
        id: opId,
        individualId: 'admin_panel',
        individualName: 'نظام الكنترول',
        individualMilitaryId: 'SYSTEM',
        cashierId: 'financial_admin',
        cashierName: 'المسؤول المالي',
        amount: 0,
        timestamp: new Date().toISOString(),
        location: 'غرفة العمليات الإدارية',
        device: 'لوحة التحكم السحابية',
        type,
        performedBy: 'admin',
        details
      };
      await setDoc(doc(db, 'operations', opId), logRecord);
    } catch (e) {
      console.warn("Failed to log system audit event:", e);
    }
  };

  return (
    <div className={`min-h-screen bg-slate-100 dark:bg-slate-900 transition-colors duration-300 text-right flex flex-col font-sans selection:bg-emerald-500 selection:text-white`}>
      
      {/* 🖥️ REAL-TIME IMMERSIVE FULLSCREEN COVERAGE */}
      <AnimatePresence>
        {isFullScreen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.99 }}
            className="fixed inset-0 z-[100] bg-slate-50 dark:bg-slate-900 overflow-y-auto flex flex-col w-screen h-screen pb-16"
          >
            {/* Immersive Floating Nav Bar with Arabic text */}
            <div className="fixed top-4 left-4 right-4 z-50 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md rounded-2.5xl border border-slate-200 dark:border-slate-800 shadow-xl px-4 py-3 flex items-center justify-between gap-4 animate-in slide-in-from-top-3 duration-300">
              
              {/* Brand and Logo */}
              <div className="flex items-center gap-3 text-right">
                <div className="w-9 h-9 bg-slate-900 dark:bg-emerald-650 text-white text-base font-extrabold rounded-xl flex items-center justify-center shadow-inner">
                  {systemLogo}
                </div>
                <div>
                  <h1 className="text-[10px] text-slate-400 dark:text-slate-550 font-extrabold leading-none">المنظومة الرقمية: ملء الشاشة ⛶</h1>
                  <p className="text-xs font-black text-slate-900 dark:text-white mt-1 leading-none flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>{
                      activeTab === 'dashboard' ? 'المرصد الميداني العام' :
                      activeTab === 'cashiers' ? 'التفويض المالي للصيارفة' :
                      activeTab === 'individuals' ? 'كشوف وتسوية الأفراد' :
                      activeTab === 'reports' ? 'مركز التقارير والتدقيق' :
                      'بوابات التهيئة والأمان'
                    }</span>
                  </p>
                </div>
              </div>

              {/* Quick Hub Selector (Arabic tab selectors switcher inside fullscreen mode) */}
              <div className="hidden md:flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl border border-slate-200/50 dark:border-slate-850">
                {[
                  { id: 'dashboard', label: 'المرصد', icon: Home },
                  { id: 'cashiers', label: 'التفويض', icon: UserCheck },
                  { id: 'individuals', label: 'الأفراد', icon: Users },
                  { id: 'reports', label: 'التقارير', icon: FileText },
                  { id: 'settings', label: 'الأمان والإعدادات', icon: Settings },
                ].map((switcher) => {
                  const SwitchIcon = switcher.icon;
                  const isSwitcherActive = activeTab === switcher.id;
                  return (
                    <button
                      key={switcher.id}
                      type="button"
                      onClick={() => setActiveTab(switcher.id as any)}
                      className={`px-3 py-1.5 rounded-xl text-3xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                        isSwitcherActive
                          ? 'bg-slate-900 text-white dark:bg-emerald-650 shadow'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                      }`}
                    >
                      <SwitchIcon className="w-3.5 h-3.5" />
                      <span>{switcher.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Actions & Exit Trigger */}
              <div className="flex items-center gap-2">
                {/* Hardware Fullscreen Toggle */}
                <button
                  type="button"
                  onClick={() => {
                    if (!document.fullscreenElement) {
                      document.documentElement.requestFullscreen().catch((err) => {
                        console.warn(err);
                      });
                    } else {
                      document.exitFullscreen();
                    }
                  }}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-800 dark:text-yellow-400 rounded-xl flex items-center justify-center gap-1.5 text-4xs font-black cursor-pointer transition active:scale-95 border dark:border-slate-850"
                  title="تفعيل ملء الشاشة الكامل بالمستعرض"
                >
                  <Activity className="w-3.5 h-3.5 text-emerald-500 animate-pulse animate-duration-1000" />
                  <span className="hidden sm:inline">مستوى الشاشة الكاملة ⛶</span>
                </button>

                {/* Return button */}
                <button
                  type="button"
                  onClick={() => setIsFullScreen(false)}
                  className="px-4.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-750 dark:bg-rose-950/30 dark:hover:bg-rose-900/40 dark:text-rose-400 border border-rose-200/50 dark:border-rose-900/30 rounded-xl flex items-center justify-center gap-1.5 text-3xs font-black cursor-pointer transition active:scale-95"
                >
                  الخروج من الشاشة الكاملة 🗗
                </button>
              </div>

            </div>

            {/* Scrolled View Content frame */}
            <div className="flex-1 w-full p-4 sm:p-6 md:p-8 pt-24 overflow-y-auto">
              <div className="max-w-7xl mx-auto">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.22 }}
                  >
                    {activeTab === 'dashboard' && (
                      <DashboardTab 
                        individuals={individuals}
                        cashiers={cashiers}
                        operations={operations}
                        onQuickTabChange={(t) => { setActiveTab(t); setIsFullScreen(true); }}
                      />
                    )}

                    {activeTab === 'cashiers' && (
                      <CashiersTab 
                        individuals={individuals}
                        cashiers={cashiers}
                        onAddCashier={onAddCashier}
                        onUpdateCashier={onUpdateCashier}
                        onDeleteCashier={onDeleteCashier}
                        logSystemEvent={logSystemEvent}
                      />
                    )}

                    {activeTab === 'individuals' && (
                      <IndividualsTab 
                        individuals={individuals}
                        cashiers={cashiers}
                        onAddIndividual={onAddIndividual}
                        onUpdateIndividual={onUpdateIndividual}
                        onDeleteIndividual={onDeleteIndividual}
                        onCancelPayout={onCancelPayout}
                        dailyAmount={dailyAmount}
                        logSystemEvent={logSystemEvent}
                      />
                    )}

                    {activeTab === 'reports' && (
                      <ReportsTab 
                        individuals={individuals}
                        cashiers={cashiers}
                        operations={operations}
                        systemLogo={systemLogo}
                        orgName={orgName}
                        logSystemEvent={logSystemEvent}
                      />
                    )}

                    {activeTab === 'settings' && (
                      <SettingsTab 
                        orgName={orgName}
                        setOrgName={setOrgName}
                        dailyAmount={dailyAmount}
                        setDailyAmount={setDailyAmount}
                        systemLogo={systemLogo}
                        setSystemLogo={setSystemLogo}
                        isDarkMode={isDarkMode}
                        setIsDarkMode={setIsDarkMode}
                        individuals={individuals}
                        cashiers={cashiers}
                        onRestoreBackup={onRestoreBackup}
                        onSeedData={onSeedData}
                        logSystemEvent={logSystemEvent}
                      />
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🔴 LIVE TOAST NOTIFICATION WIDGET */}
      <AnimatePresence>
        {liveBankToast && (
          <motion.div
            initial={{ opacity: 0, y: -40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className={`fixed top-5 left-5 z-50 p-4 rounded-3xl border shadow-xl flex items-start gap-3.5 max-w-sm ${
              liveBankToast.isEmergency 
                ? 'bg-rose-50 border-rose-200 text-rose-900 dark:bg-rose-955/90 dark:text-rose-100' 
                : 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-955/90 dark:text-emerald-100'
            }`}
          >
            <div className={`p-2.5 rounded-2.5xl flex-shrink-0 ${liveBankToast.isEmergency ? 'bg-rose-100 text-rose-700 animate-bounce' : 'bg-emerald-100 text-emerald-700'}`}>
              <Bell className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-black tracking-widest block leading-none">إرسال لاسلكي عاجل</span>
              <h4 className="text-xs font-black leading-tight mt-1">{liveBankToast.beneficiary}</h4>
              <p className="text-3xs text-slate-500 leading-snug">
                {liveBankToast.isEmergency 
                  ? liveBankToast.alertDetails 
                  : `قام الصراف الميداني [${liveBankToast.cashierName}] بصرف مستحقات الراتب بقيمة [${liveBankToast.amount} ريال]`
                }
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🚀 HIGH-END HORIZONTAL SUPER HEADER */}
      <header className="bg-white dark:bg-slate-950 border-b border-slate-200/80 dark:border-slate-850 px-6 py-4 flex items-center justify-between shadow-xs sticky top-0 z-40">
        
        {/* Right side Logo + Organization title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-900 dark:bg-emerald-755 text-white text-xl font-extrabold rounded-2xl flex items-center justify-center shadow-inner">
            {systemLogo}
          </div>
          <div className="text-right">
            <h1 className="text-xs font-black text-slate-900 dark:text-white leading-none">منظومة الصرف الذكي للميدان</h1>
            <p className="text-[10px] text-slate-400 font-bold mt-1.5">{orgName}</p>
          </div>
        </div>

        {/* Left side parameters - online pill, email control & Logout */}
        <div className="flex items-center gap-4 text-xs font-bold font-mono text-slate-650 dark:text-slate-300">
          
          {/* Channel synchronization status pill */}
          <div className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 text-[10px] ${
            isOnline 
              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-450 border border-emerald-500/10' 
              : 'bg-amber-50 text-amber-800 dark:bg-amber-955/20 dark:text-amber-400 border border-amber-500/10'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <span>{isOnline ? 'مزامنة دبل لارسلاكية نشطة' : 'وضع غير متصل - يعمل معلقاً'}</span>
          </div>

          <div className="hidden sm:block text-left text-3xs font-extrabold font-mono text-slate-450">
            <span>اللقب: المراجع المالي الدولي</span>
            <span className="block mt-0.5 text-slate-600 dark:text-slate-300">{adminEmail}</span>
          </div>

          {/* Logout button */}
          <button
            type="button"
            onClick={() => {
              if (window.confirm('هل تود الخروج الآمن من نظام المسؤول المالي؟')) {
                onLogout();
              }
            }}
            className="p-2 bg-slate-50 hover:bg-rose-50 text-slate-500 hover:text-rose-600 dark:bg-slate-900 dark:hover:bg-rose-950/20 rounded-xl cursor-pointer transition"
            title="تسجيل الخروج الآمن"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>

      </header>

      {/* 📂 SPLIT SCREEN: VISUAL NAVIGATION SIDEBAR + CORE HUBS RENDER PANEL */}
      <div className="flex-1 flex flex-col md:flex-row">
        
        {/* 1. SIDEBAR SIDE-NAV PANEL */}
        <aside className="w-full md:w-64 bg-white dark:bg-slate-950 border-l border-slate-200/80 dark:border-slate-850 p-4 flex flex-col justify-between">
          
          <div className="space-y-1.5">
            <span className="text-[9px] font-black text-slate-400 dark:text-slate-550 block mb-2 tracking-widest truncate">منصات التحكم والتحكيم الميداني</span>
            
            {/* Tab items */}
            {[
              { id: 'dashboard', label: 'المرصد الميداني العام', sub: 'المراقبة والوقائع الحيّة', icon: Home },
              { id: 'cashiers', label: 'التفويض المالي للصيارفة', sub: 'إصدار التراخيص والحقائب', icon: UserCheck },
              { id: 'individuals', label: 'كشوف وتسوية الأفراد', sub: 'محركات البحث وتوزيع المهام', icon: Users },
              { id: 'reports', label: 'مركز التقارير والتدقيق', sub: 'طباعة كفاءة الصرف لليوم', icon: FileText },
              { id: 'settings', label: 'بوابات التهيئة والأمان', sub: 'اللوائح وصيانة القواعد والنسخ', icon: Settings },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id as any);
                    setIsFullScreen(true);
                  }}
                  className={`w-full text-right p-3 rounded-2xl flex items-start gap-3 transition-all cursor-pointer group ${
                    isActive 
                      ? 'bg-slate-900 text-white dark:bg-emerald-650 shadow' 
                      : 'hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-650 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <div className={`p-1.5 rounded-xl flex-shrink-0 ${isActive ? 'bg-white/10 text-white' : 'bg-slate-50 dark:bg-slate-900 text-slate-450 group-hover:bg-slate-100 group-hover:text-slate-800 transition'}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="leading-tight">
                    <span className="text-3xs font-extrabold block">{tab.label}</span>
                    <span className={`text-[9px] block mt-0.5 font-bold ${isActive ? 'text-white/70' : 'text-slate-400'}`}>{tab.sub}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Secure Audit Badge (Safety seal at the footer of sidebar) */}
          <div className="hidden md:block pt-4 border-t border-slate-100 dark:border-slate-900 mt-6 text-center text-[10px] text-slate-400 font-extrabold leading-snug space-y-1.5">
            <div className="flex items-center justify-center gap-1 text-emerald-700 dark:text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
              <span>مؤمن بالتشفير العسكري</span>
            </div>
            <p className="font-mono text-4xs">SSL END-TO-END SECURITIES</p>
          </div>

        </aside>

        {/* 2. CORE MASTER RENDER PANEL (ACTIVE VIEWS WITH ENTRY SLIDE ANIMATIONS) */}
        <main className="flex-1 p-6 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.22 }}
              className="max-w-7xl mx-auto"
            >
              {activeTab === 'dashboard' && (
                <DashboardTab 
                  individuals={individuals}
                  cashiers={cashiers}
                  operations={operations}
                  onQuickTabChange={(t) => setActiveTab(t)}
                />
              )}

              {activeTab === 'cashiers' && (
                <CashiersTab 
                  individuals={individuals}
                  cashiers={cashiers}
                  onAddCashier={onAddCashier}
                  onUpdateCashier={onUpdateCashier}
                  onDeleteCashier={onDeleteCashier}
                  logSystemEvent={logSystemEvent}
                />
              )}

              {activeTab === 'individuals' && (
                <IndividualsTab 
                  individuals={individuals}
                  cashiers={cashiers}
                  onAddIndividual={onAddIndividual}
                  onUpdateIndividual={onUpdateIndividual}
                  onDeleteIndividual={onDeleteIndividual}
                  onCancelPayout={onCancelPayout}
                  dailyAmount={dailyAmount}
                  logSystemEvent={logSystemEvent}
                />
              )}

              {activeTab === 'reports' && (
                <ReportsTab 
                  individuals={individuals}
                  cashiers={cashiers}
                  operations={operations}
                  systemLogo={systemLogo}
                  orgName={orgName}
                  logSystemEvent={logSystemEvent}
                />
              )}

              {activeTab === 'settings' && (
                <SettingsTab 
                  orgName={orgName}
                  setOrgName={setOrgName}
                  dailyAmount={dailyAmount}
                  setDailyAmount={setDailyAmount}
                  systemLogo={systemLogo}
                  setSystemLogo={setSystemLogo}
                  isDarkMode={isDarkMode}
                  setIsDarkMode={setIsDarkMode}
                  individuals={individuals}
                  cashiers={cashiers}
                  onRestoreBackup={onRestoreBackup}
                  onSeedData={onSeedData}
                  logSystemEvent={logSystemEvent}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>

      </div>

    </div>
  );
}
