/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Home, Search, Users, BarChart3, Settings, CheckCircle, AlertOctagon, 
  MapPin, Clock, Smartphone, User, DollarSign, LogOut, Check, Wifi, WifiOff, 
  RefreshCw, Printer, Receipt, ShieldCheck, Fingerprint, PenTool, Send, 
  AlertTriangle, Trash2, HelpCircle, Calculator, BookOpen, Landmark, Coins, 
  Scale, ChevronDown, ChevronUp, Zap, FileSpreadsheet, Sparkles, Bell
} from 'lucide-react';
import { Individual, Cashier, OperationLog } from '../types';
import { formatCurrency, formatDateTime, playBankChime, getGPSLocation, getDeviceSignature } from '../utils';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';

interface CashierPanelProps {
  cashier: Cashier;
  individuals: Individual[];
  onProcessPayout: (militaryId: string) => Promise<{ success: boolean; doubleClaim?: { cashierName: string; location: string; timestamp: string } } | undefined>;
  onLogout: () => void;
  isOnline: boolean;
  pendingSyncCount: number;
}

interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  text: string;
}

export default function CashierPanel({
  cashier,
  individuals,
  onProcessPayout,
  onLogout,
  isOnline,
  pendingSyncCount
}: CashierPanelProps) {
  // Navigation: Bottom bar navigation tab state
  const [activeTab, setActiveTab] = useState<'home' | 'search' | 'recipients' | 'reports' | 'settings'>('home');
  const [isFullScreen, setIsFullScreen] = useState(true); // Default to full screen for a immersive experience
  
  // Live ticking clock state for the field cashier
  const [liveTime, setLiveTime] = useState('');
  const [liveDate, setLiveDate] = useState('');
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setLiveTime(now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
      setLiveDate(now.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Search parameters & state
  const [searchQuery, setSearchQuery] = useState('');
  const [payoutType, setPayoutType] = useState<'dedicated' | 'general'>('dedicated'); // Dedicated to this cashier vs search all
  
  // Strategic Quick filters for extreme Field Usability
  const [selectedUnitFilter, setSelectedUnitFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'pending' | 'received'>('pending'); // Default to pending to show only soldiers who need checkout!
  const [selectedIndividual, setSelectedIndividual] = useState<Individual | null>(null);
  
  // Interactive lists states (Recipients/Non-recipients)
  const [recipientsSubTab, setRecipientsSubTab] = useState<'received' | 'pending'>('received');
  const [recipientsSearch, setRecipientsSearch] = useState('');

  // Transaction verification simulation modal and rapid modes
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isRapidMode, setIsRapidMode] = useState(false);
  
  // Checklist verification sub-step state (Standard Mode Step 1)
  const [verificationChecklist, setVerificationChecklist] = useState({
    idCardMatched: false,
    facialVerified: false,
    unitDoubleChecked: false
  });

  const [verificationStep, setVerificationStep] = useState<'checklist' | 'biometric' | 'signature'>('checklist');
  const [fingerprintProgress, setFingerprintProgress] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);
  const [txIsProcessing, setTxIsProcessing] = useState(false);
  const [txSuccessMessage, setTxSuccessMessage] = useState<string | null>(null);

  // Anti-duplication state
  const [showDoubleClaimModal, setShowDoubleClaimModal] = useState(false);
  const [doubleClaimDetail, setDoubleClaimDetail] = useState<{
    individualName: string;
    cashierName: string;
    location: string;
    timestamp: string;
  } | null>(null);

  // Reports state and category filters
  const [filterUnit, setFilterUnit] = useState<string>('all');
  const [filterBattalion, setFilterBattalion] = useState<string>('all');
  const [filterCompany, setFilterCompany] = useState<string>('all');
  const [reportSubTab, setReportSubTab] = useState<'daily' | 'all' | 'remaining'>('daily');

  // Standalone Operating Procedures SOP Search state
  const [sopSearch, setSopSearch] = useState('');
  const [expandedSopId, setExpandedSopId] = useState<string | null>(null);

  // Dynamic self-managed Toast notification state
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Refs for intervals & signature drawing
  const scanIntervalRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawing = useRef(false);

  // Emit a dynamic warning/success notification toast
  const triggerToast = (type: ToastMessage['type'], text: string) => {
    const id = 'toast_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    setToasts(prev => [...prev, { id, type, text }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  // Helper sound synthesizers for simulated fingerprint scanners/warnings
  const playBeep = (freq: number, type: OscillatorType, dur: number) => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + dur);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch (e) {
      console.warn("Audio feedback skipped:", e);
    }
  };

  // 1. HOME SCREEN METRICS CALCULATIONS
  // Scope of cashier individuals
  const myAssignedIndividuals = individuals.filter(i => i.assignedCashierId === cashier.id);
  const scopeIndividuals = payoutType === 'general' ? individuals : myAssignedIndividuals;

  const statsTotal = scopeIndividuals.length;
  const statsReceived = scopeIndividuals.filter(i => i.payoutStatus === 'received').length;
  const statsPending = statsTotal - statsReceived;
  const statsCompletionRate = statsTotal > 0 ? Math.round((statsReceived / statsTotal) * 100) : 0;
  const statsTotalPaidAmount = scopeIndividuals
    .filter(i => i.payoutStatus === 'received')
    .reduce((sum, item) => sum + item.entitledAmount, 0);

  // Overall latest executed payments in the database
  const latestPayments = individuals
    .filter(i => i.payoutStatus === 'received')
    .sort((a, b) => new Date(b.receivedAt || 0).getTime() - new Date(a.receivedAt || 0).getTime())
    .slice(0, 6);

  // Monitor total individuals remaining count to trigger "all completed notification"
  const prevRemainingRef = useRef<number | null>(null);
  useEffect(() => {
    const totalAssignedCount = myAssignedIndividuals.length;
    const pendingAssignedCount = myAssignedIndividuals.filter(i => i.payoutStatus === 'pending').length;
    
    if (totalAssignedCount > 0 && prevRemainingRef.current !== null && pendingAssignedCount === 0 && prevRemainingRef.current > 0) {
      triggerToast('info', `🎉 تهانينا! لقد تم تسليم كافة المستحقات المالية بنسبة 100% لجميع الأفراد المكلفين بك (${totalAssignedCount} فرد).`);
      playBankChime('success');
    }
    prevRemainingRef.current = pendingAssignedCount;
  }, [individuals]);

  // 2. LIVE SEARCH FILTERING WITH ENHANCED STRATEGIC FIELD SHORTCUTS
  const filteredSearchList = individuals.filter(ind => {
    // Allocation filter (dedicated assignments vs general search)
    if (payoutType === 'dedicated' && ind.assignedCashierId !== cashier.id) return false;
    
    // Unit Grouping filter
    if (selectedUnitFilter !== 'all' && ind.unit !== selectedUnitFilter) return false;
    
    // Status filter
    if (selectedStatusFilter !== 'all' && ind.payoutStatus !== selectedStatusFilter) return false;
    
    // Live text search matching fullname or militaryId
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return ind.fullName.includes(query) || ind.militaryId.includes(query);
  });

  // Action: Select individual and trigger anti-duplication if received
  const handleSelectIndividual = (ind: Individual) => {
    setSelectedIndividual(ind);
    setTxSuccessMessage(null);
    setFingerprintProgress(0);
    setVerificationStep('checklist');
    setHasSigned(false);
    
    // Reset standard verification checklist for direct field control
    setVerificationChecklist({
      idCardMatched: false,
      facialVerified: false,
      unitDoubleChecked: false
    });

    if (ind.payoutStatus === 'received') {
      // Trigger duplicate warning details
      setDoubleClaimDetail({
        individualName: ind.fullName,
        cashierName: ind.receivedCashierName || 'صراف آخر باللجنة',
        location: ind.receivedLocation ? ind.receivedLocation.replace(' (محاكي الميدان GPS)', '') : 'مقر اللجنة الثاني',
        timestamp: ind.receivedAt || new Date().toISOString()
      });
      setShowDoubleClaimModal(true);
      triggerToast('warning', `⚠️ تم صرف المستحقات مسبقاً للفرد ${ind.fullName}`);
      playBankChime('alert');
    } else {
      // Direct pop-up modal for quick checkout & verification upon click
      setShowConfirmModal(true);
      triggerToast('info', `📝 جاري التحقق من هوية الفرد وصرف السند: ${ind.fullName}`);
    }
  };

  // Fingerprint Scanner Actions
  const startScanningMock = () => {
    if (fingerprintProgress >= 100) return;
    setIsScanning(true);
    playBeep(260, 'sine', 0.1);
    
    scanIntervalRef.current = setInterval(() => {
      setFingerprintProgress(prev => {
        if (prev >= 100) {
          clearInterval(scanIntervalRef.current);
          setIsScanning(false);
          playBeep(880, 'sine', 0.25);
          setVerificationStep('signature');
          return 100;
        }
        if (Math.random() > 0.4) {
          playBeep(prev * 3 + 300, 'triangle', 0.05);
        }
        return prev + 10;
      });
    }, 120);
  };

  const stopScanningMock = () => {
    setIsScanning(false);
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    if (fingerprintProgress < 100) {
      setFingerprintProgress(0);
    }
  };

  // E-Signature Drawing Handlers
  const handleStartDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1e293b'; // slate-800
    
    const rect = canvas.getBoundingClientRect();
    const x = ('clientX' in e) ? e.clientX - rect.left : e.touches[0].clientX - rect.left;
    const y = ('clientY' in e) ? e.clientY - rect.top : e.touches[0].clientY - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    isDrawing.current = true;
    setHasSigned(true);
  };

  const handleDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = ('clientX' in e) ? e.clientX - rect.left : e.touches[0].clientX - rect.left;
    const y = ('clientY' in e) ? e.clientY - rect.top : e.touches[0].clientY - rect.top;
    
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handleClearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSigned(false);
  };

  const generateAutoSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#2563eb'; // blue-600
      ctx.beginPath();
      ctx.moveTo(50, 70);
      ctx.bezierCurveTo(90, 20, 130, 120, 180, 50);
      ctx.bezierCurveTo(210, 30, 240, 80, 280, 60);
      ctx.stroke();
    }
    setHasSigned(true);
    playBeep(650, 'sine', 0.1);
  };

  // CORE TRIGGER PAYOUT ACTION
  const executePayoutAction = async (ind: Individual) => {
    setTxIsProcessing(true);
    setTxSuccessMessage(null);

    // Double check state right before executing to prevent split-second duplicate fraud
    if (ind.payoutStatus === 'received') {
      setDoubleClaimDetail({
        individualName: ind.fullName,
        cashierName: ind.receivedCashierName || 'صراف آخر',
        location: ind.receivedLocation || 'اللجنة الميدانية الثانية',
        timestamp: ind.receivedAt || new Date().toISOString()
      });
      setTxIsProcessing(false);
      setShowConfirmModal(false);
      setShowDoubleClaimModal(true);
      triggerToast('error', '⚠️ تم صرف هذا السند مسبقاً من نظام صراف آخر!');
      playBankChime('alert');
      return;
    }

    try {
      const result = await onProcessPayout(ind.militaryId);
      if (result && !result.success && result.doubleClaim) {
        // Double payout intercepted server-side or concurrently
        setDoubleClaimDetail({
          individualName: ind.fullName,
          cashierName: result.doubleClaim.cashierName,
          location: result.doubleClaim.location,
          timestamp: result.doubleClaim.timestamp
        });
        setShowConfirmModal(false);
        setShowDoubleClaimModal(true);
        triggerToast('error', '⚠️ تم حظر محاولة الصرف لمنع الازدواج المالي!');
        playBankChime('alert');
      } else {
        // Success behavior
        setTxSuccessMessage(`تم تفعيل الصرف النقدي وتسجيل المعاملة بنجاح!`);
        triggerToast('success', `✅ نجاح الصرف: تم صرف مستحقات ${ind.fullName} بقيمة ${formatCurrency(ind.entitledAmount)} ر.س.`);
        playBankChime('success');
        
        // Update local object view
        setSelectedIndividual(prev => prev ? {
          ...prev,
          payoutStatus: 'received',
          receivedAt: new Date().toISOString(),
          receivedCashierId: cashier.id,
          receivedCashierName: cashier.name,
          receivedLocation: cashier.payoutPoint || 'مقر اللجنة المالية'
        } : null);
      }
    } catch (err: any) {
      triggerToast('error', 'فشل صرف السند: ' + err.message);
      playBankChime('cancel');
    } finally {
      setTxIsProcessing(false);
    }
  };

  // 3. EXPORT EXCEL & PDF UTILITIES
  const handlePrintReports = () => {
    window.print();
  };

  const handleExportExcelCSV = () => {
    // Generate headers & dataset matching filtered remaining or operations report
    let headers: string[] = [];
    let rows: string[][] = [];
    let filename = '';

    if (reportSubTab === 'daily') {
      headers = ['الرقم العسكري', 'الاسم الكامل', 'الوحدة', 'المبلغ المستحق', 'الكتيبة', 'السرية', 'الوظيفة المخصصة'];
      rows = individuals.filter(i => i.payoutStatus === 'received').map(i => [
        i.militaryId, i.fullName, i.unit, String(i.entitledAmount), i.battalion || '-', i.company || '-', i.receivedCashierName || '-'
      ]);
      filename = 'سجلات_المستلمين_اليومية';
    } else if (reportSubTab === 'remaining') {
      headers = ['الرقم العسكري', 'الاسم الكامل', 'الوحدة', 'المبلغ بالتفصيل', 'الكتيبة', 'السرية', 'حالة الاستلام'];
      rows = individuals.filter(i => i.payoutStatus === 'pending').map(i => [
        i.militaryId, i.fullName, i.unit, String(i.entitledAmount), i.battalion || '-', i.company || '-', 'قيد الانتظار'
      ]);
      filename = 'جدول_الأفراد_المتبقين_أفلاين';
    } else {
      headers = ['الرقم العسكري', 'اسم الفرد المستحق', 'الوحدة العسكرية', 'مبلغ الصرف المقبوض', 'بواسطة الصرّاف', 'تاريخ ووقت المعاملة'];
      rows = individuals.filter(i => i.payoutStatus === 'received').map(i => [
        i.militaryId, i.fullName, i.unit, String(i.entitledAmount), i.receivedCashierName || '-', i.receivedAt ? formatDateTime(i.receivedAt) : '-'
      ]);
      filename = 'كشف_عمليات_الصرف_المعتمدة';
    }

    try {
      const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
        + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      triggerToast('success', '📥 تم تصدير ملف الاكسل الرياضي للتقارير بنجاح!');
    } catch (e: any) {
      triggerToast('error', 'تعذر تحميل الملف: ' + e.message);
    }
  };

  // Generate lists of structures for reporting filters
  const uniqueUnits = Array.from(new Set(individuals.map(i => i.unit)));
  const uniqueBattalions = Array.from(new Set(individuals.map(i => i.battalion || 'الكتيبة الأولى مشاة')));
  const uniqueCompanies = Array.from(new Set(individuals.map(i => i.company || 'السرية الأولى')));

  // Filter remaining individuals for non-recipients reports block
  const remainingReportList = individuals.filter(ind => {
    if (ind.payoutStatus !== 'pending') return false;
    if (filterUnit !== 'all' && ind.unit !== filterUnit) return false;
    if (filterBattalion !== 'all' && (ind.battalion || 'الكتيبة الأولى مشاة') !== filterBattalion) return false;
    if (filterCompany !== 'all' && (ind.company || 'السرية الأولى') !== filterCompany) return false;
    return true;
  });

  // Unique Unit distributions for SVG statistics charts
  const unitStatsData = uniqueUnits.map(unitName => {
    const totalInUnit = individuals.filter(i => i.unit === unitName).length;
    const paidInUnit = individuals.filter(i => i.unit === unitName && i.payoutStatus === 'received').length;
    const rate = totalInUnit > 0 ? Math.round((paidInUnit / totalInUnit) * 100) : 0;
    return { name: unitName, total: totalInUnit, paid: paidInUnit, rate };
  });

  return (
    <div className="relative text-right max-w-7xl mx-auto space-y-6" dir="rtl">
      {/* 🔔 FLOATING TOAST NOTIFICATION CORNER */}
      <div className="fixed top-20 left-4 z-[9999] w-80 space-y-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: -50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -50, scale: 0.9 }}
              className={`p-3.5 rounded-2xl shadow-xl border flex items-start gap-2.5 text-3xs font-extrabold text-right pointer-events-auto leading-relaxed ${
                toast.type === 'success' ? 'bg-emerald-55 border-emerald-200 text-emerald-850' :
                toast.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-850' :
                toast.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-900' :
                'bg-slate-900 border-slate-950 text-white'
              }`}
            >
              <Bell className="w-4.5 h-4.5 shrink-0" />
              <p>{toast.text}</p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>





      {/* 📲 CONSOLIDATED CLIENT TABS INTERFACE CHASSIS */}
      <div className={`min-h-[60vh] pb-16 ${isFullScreen ? 'pt-2 px-1' : ''}`}>
        
        {/* TAB 1: 🏠 الصفحة الرئيسية (Home Screen) */}
        {activeTab === 'home' && (
          <div className="space-y-6">
            
            {/* 🇸🇦 LIVE CLOCK (ساعة حية للميدان مبسطة) */}
            <div className="bg-white border border-slate-200 p-4.5 rounded-3xl flex items-center justify-between shadow-3xs">
              <span className="text-3xs text-slate-450 font-black">{liveDate || 'جاري تحميل الوقت...'}</span>
              <div className="flex items-center gap-2 text-slate-850">
                <Clock className="w-4.5 h-4.5 text-emerald-600" />
                <span className="text-sm font-mono font-black tracking-wider">{liveTime || '--:--:-- --'}</span>
              </div>
            </div>

            {/* ⚡ INSTANT ACCESS HUBS - USER CONVENIENCE AT ITS VERY BEST */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                type="button"
                onClick={() => setActiveTab('search')}
                className="bg-white hover:bg-emerald-50/20 border border-slate-200 hover:border-emerald-400/50 p-5 rounded-3xl shadow-xs text-right transition-all transform hover:-translate-y-0.5 group cursor-pointer flex items-center justify-between gap-4 text-right"
              >
                <div className="space-y-1">
                  <h3 className="text-xs font-black text-slate-800 group-hover:text-emerald-800">صرف المستحقات والتحقق 🔍</h3>
                  <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">ابحث عن جندي، دقق الهوية الشخصية، وباشر بصمة الإبهام وصرف السند يدوياً.</p>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-105 duration-200">
                  <Search className="w-5.5 h-5.5" />
                </div>
              </button>

              <button
                type="button"
                onClick={() => { setActiveTab('recipients'); setRecipientsSubTab('pending'); }}
                className="bg-white hover:bg-amber-50/20 border border-slate-200 hover:border-amber-400/50 p-5 rounded-3xl shadow-xs text-right transition-all transform hover:-translate-y-0.5 group cursor-pointer flex items-center justify-between gap-4 text-right"
              >
                <div className="space-y-1">
                  <h3 className="text-xs font-black text-slate-800 group-hover:text-amber-800 flex items-center gap-1.5 justify-start">قائمة السندات المتبقية ⏳</h3>
                  <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">تابع الأفراد المتبقين، وفرز السرايا، وحولهم لشاشات التصفية النقدية.</p>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 group-hover:scale-105 duration-200">
                  <Users className="w-5.5 h-5.5" />
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className="bg-white hover:bg-emerald-50/10 border border-slate-200 hover:border-emerald-400/30 p-5 rounded-3xl shadow-xs text-right transition-all transform hover:-translate-y-0.5 group cursor-pointer flex items-center justify-between gap-4 text-right"
              >
                <div className="space-y-1">
                  <h3 className="text-xs font-black text-slate-800 group-hover:text-emerald-850">جرد وتصفية الخزانة 🪙</h3>
                  <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">طابق كميات ورق الكاش المتبقية بداخل درج خزنتك لمنع الفروق المالية اليومية.</p>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 group-hover:scale-105 duration-200">
                  <Coins className="w-5.5 h-5.5" />
                </div>
              </button>
            </div>
            
            {/* 📈 COMPREHENSIVE STATISTICAL BENTO SHEETS (بطاقات إحصائية) */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-white border border-slate-200 p-4 rounded-3xl shadow-sm text-right flex flex-col justify-between">
                <span className="text-4xs text-slate-450 block font-black border-b pb-1.5 mb-2">إجمالي المكلف بهم 📋</span>
                <p className="text-2xl font-black text-slate-850 font-mono mt-1">{statsTotal} <span className="text-4xs text-slate-400 font-sans">فردًا</span></p>
                <span className="text-4xs text-slate-400 mt-2 block">إجمالي أفراد النطاق الحالي</span>
              </div>

              <div className="bg-white border border-emerald-100 p-4 rounded-3xl shadow-sm text-right flex flex-col justify-between">
                <span className="text-4xs text-emerald-800 block font-black border-b pb-1.5 mb-2">الذين استلموا وعمدوا ✔</span>
                <p className="text-2xl font-black text-emerald-700 font-mono mt-1">{statsReceived} <span className="text-4xs text-slate-400 font-sans">أفراد</span></p>
                <span className="text-4xs text-slate-400 mt-2 block">سندات مكتملة بالمرآة الميدانية</span>
              </div>

              <div className="bg-white border border-rose-100 p-4 rounded-3xl shadow-sm text-right flex flex-col justify-between">
                <span className="text-4xs text-rose-800 block font-black border-b pb-1.5 mb-2 font-black">عدد المتبقين للصرف ⏳</span>
                <p className="text-2xl font-black text-rose-700 font-mono mt-1">{statsPending} <span className="text-4xs text-slate-400 font-sans">صرف معلق</span></p>
                <span className="text-4xs text-slate-450 mt-2 block text-rose-500 font-bold">بانتظار التحقق الشخصي المباشر</span>
              </div>

              <div className="bg-white border border-slate-200 p-4 rounded-3xl shadow-sm text-right flex flex-col justify-between">
                <span className="text-4xs text-slate-450 block font-black border-b pb-1.5 mb-2">نسبة الإنجاز المالي 📊</span>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-2xl font-black text-slate-800 font-mono">{statsCompletionRate}%</p>
                  {/* Dynamic circular mini visual */}
                  <svg className="w-8 h-8 transform -rotate-90">
                    <circle cx="16" cy="16" r="12" fill="transparent" stroke="#e2e8f0" strokeWidth="3" />
                    <circle cx="16" cy="16" r="12" fill="transparent" stroke="#10b981" strokeWidth="3" 
                      strokeDasharray={`${statsCompletionRate * 0.75} 100`} />
                  </svg>
                </div>
                <span className="text-4xs text-slate-400 mt-2 block">الكفاءة اللحظية لأعمال الصندوق</span>
              </div>

              <div className="col-span-2 lg:col-span-1 bg-gradient-to-tr from-emerald-50 to-emerald-100/50 border border-emerald-200/60 p-4 rounded-3xl shadow-sm text-right flex flex-col justify-between">
                <span className="text-4xs text-emerald-900 block font-black border-b border-emerald-100 pb-1.5 mb-2">إجمالي المبالغ المصروفة 💰</span>
                <p className="text-xl font-black text-emerald-800 font-mono mt-1">{formatCurrency(statsTotalPaidAmount)} <span className="text-[10px] font-sans">ر.س</span></p>
                <span className="text-4xs text-slate-450 mt-2 block">إبرام تصفية مبالغ السيولة المعتمدة</span>
              </div>
            </div>

            {/* Simulated Queue Warning */}
            {pendingSyncCount > 0 && (
              <div className="bg-amber-50 border border-amber-200 p-4.5 rounded-2xl flex items-center justify-between gap-3 text-3xs text-amber-900 font-bold">
                <div className="flex items-center gap-2.5">
                  <RefreshCw className="w-5 h-5 text-amber-600 animate-spin" />
                  <p>تحضير طوارئ الشبكة: تم التقاط عدد ({pendingSyncCount}) عمليات صرف ميدانية تمت بدون تغطية إنترنت نشطة. سيقوم الصندوق بدفعهم أوتوماتيكياً فور الإتصال الحقيقي!</p>
                </div>
              </div>
            )}

            {/* 🕒 BOTTOM AREA: LATEST DISBURSEMENTS (آخر عمليات الصرف المنفذة) */}
            <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-5 space-y-4">
              <div className="border-b pb-3 flex items-center justify-between">
                <span className="text-[10px] bg-slate-100 text-slate-600 font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider font-mono">
                  تسجيل حي تراكمي
                </span>
                <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <span>آخر عمليات الصرف المنفذة يدوياً باللجنة</span>
                  <Clock className="w-4.5 h-4.5 text-slate-600" />
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {latestPayments.map(ind => (
                  <div key={ind.militaryId + '-latest'} className="bg-slate-50 border border-slate-150 p-4 rounded-2xl flex items-center justify-between text-right hover:border-slate-350 transition-all">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 leading-tight mb-1">{ind.fullName}</h4>
                      <p className="text-4xs font-bold text-slate-450 font-mono">الرقم العسكري: {ind.militaryId}</p>
                      <span className="text-5xs text-slate-400 font-mono block mt-0.5">{ind.receivedAt ? formatDateTime(ind.receivedAt) : '-'}</span>
                    </div>
                    <div className="text-left font-mono">
                      <span className="text-xs font-extrabold text-emerald-800 block">{formatCurrency(ind.entitledAmount)}</span>
                      <span className="text-5xs bg-emerald-100/50 text-emerald-800 border border-emerald-200/50 px-1.5 py-0.5 rounded font-sans font-black mt-0.5 inline-block text-[8px]">
                        سند معمد
                      </span>
                    </div>
                  </div>
                ))}
                {latestPayments.length === 0 && (
                  <div className="col-span-full text-center py-10 text-slate-450 text-3xs font-semibold">
                    لا تتوفر أي معالجة لسندات صرف في نظام نوبتك الحالية حتى الآن.
                  </div>
                )}
              </div>
            </div>

            {/* Quick allocation scope switcher */}
            <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl w-fit">
              <button
                type="button"
                onClick={() => setPayoutType('dedicated')}
                className={`py-1 px-3 text-3xs font-black rounded-lg transition-all ${payoutType === 'dedicated' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500'}`}
              >
                الأفراد المعمدين לי (المخصص المباشر)
              </button>
              <button
                type="button"
                onClick={() => setPayoutType('general')}
                className={`py-1 px-3 text-3xs font-black rounded-lg transition-all ${payoutType === 'general' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500'}`}
              >
                البحث السريع الشامل لكافة كشوف الوحدات
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: 🔍 شاشة البحث السريع (Quick Search Screen) */}
        {activeTab === 'search' && (
          <div className="space-y-4">
            
            {/* Dual allocation toggles + Instant input field */}
            <div className="bg-white border border-slate-200 p-4 rounded-3xl shadow-sm space-y-4">
              <span className="text-[10px] text-slate-400 block font-bold text-right">أدخل كود الفرد أو الاسم وباشر الصرف (النتائج تتطابق فوراً في كل نقرة):</span>
              <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                  <input
                    id="cashier-search-field"
                    type="text"
                    placeholder="ابحث بواسطة: الرقم العسكري، الاسم الرباعي المعمد..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full text-right pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 rounded-2xl text-xs font-semibold text-slate-800 focus:outline-none"
                  />
                  <Search className="w-5 h-5 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 w-6 h-6 hover:bg-slate-200/60 rounded-full flex items-center justify-center font-bold text-slate-400 hover:text-slate-600 transition"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="flex gap-1.5 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => { setPayoutType('dedicated'); setSelectedIndividual(null); }}
                    className={`py-1.5 px-3 rounded-lg text-4xs font-black transition cursor-pointer ${payoutType === 'dedicated' ? 'bg-emerald-600 text-white shadow' : 'text-slate-600'}`}
                  >
                    مخصص لي ({myAssignedIndividuals.length} فرد)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPayoutType('general'); setSelectedIndividual(null); }}
                    className={`py-1.5 px-3 rounded-lg text-4xs font-black transition cursor-pointer ${payoutType === 'general' ? 'bg-emerald-600 text-white shadow' : 'text-slate-600'}`}
                  >
                    كل كشوف اللجنة ({individuals.length} فرد)
                  </button>
                </div>
              </div>

              {/* Advanced Field Shortcuts: Unit & Payout state filters (تصفية متطورة وسريعة للميدان) */}
              <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-slate-100 text-3xs font-black text-right">
                <div className="flex items-center gap-2">
                  <span className="text-slate-450">الوحدة العسكرية:</span>
                  <select
                    value={selectedUnitFilter}
                    onChange={(e) => { setSelectedUnitFilter(e.target.value); setSelectedIndividual(null); }}
                    className="py-1 px-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-250 rounded-lg text-4xs font-black text-slate-705 cursor-pointer focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="all">كافة الوحدات 📋</option>
                    {uniqueUnits.map(unit => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-slate-450">حالة التصفية:</span>
                  <div className="flex bg-slate-150/50 p-0.5 rounded-lg border border-slate-200">
                    <button
                      type="button"
                      onClick={() => { setSelectedStatusFilter('pending'); setSelectedIndividual(null); }}
                      className={`px-3 py-1 rounded text-4xs font-black transition-all cursor-pointer ${selectedStatusFilter === 'pending' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-550'}`}
                    >
                      ⏳ لم يستلم ({individuals.filter(i => (payoutType === 'dedicated' ? i.assignedCashierId === cashier.id : true) && (selectedUnitFilter === 'all' ? true : i.unit === selectedUnitFilter) && i.payoutStatus === 'pending').length} فردًا)
                    </button>
                    <button
                      type="button"
                      onClick={() => { setSelectedStatusFilter('received'); setSelectedIndividual(null); }}
                      className={`px-3 py-1 rounded text-4xs font-black transition-all cursor-pointer ${selectedStatusFilter === 'received' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-550'}`}
                    >
                      ✔ المستلمين اليوم ({individuals.filter(i => (payoutType === 'dedicated' ? i.assignedCashierId === cashier.id : true) && (selectedUnitFilter === 'all' ? true : i.unit === selectedUnitFilter) && i.payoutStatus === 'received').length} فردًا)
                    </button>
                    <button
                      type="button"
                      onClick={() => { setSelectedStatusFilter('all'); setSelectedIndividual(null); }}
                      className={`px-3 py-1 rounded text-4xs font-black transition-all cursor-pointer ${selectedStatusFilter === 'all' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-550'}`}
                    >
                      الجميع الكل
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Left and Right splits: Results List Left / Active Individual Card Right */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              
              {/* Results Scroller */}
              <div className="lg:col-span-1 bg-white border border-slate-200 p-4 rounded-3xl shadow-sm max-h-[500px] overflow-y-auto space-y-2">
                <span className="text-4xs text-slate-400 block font-bold border-b pb-1.5 text-right">كشف الأفراد المطابقين ({filteredSearchList.length} فردًا):</span>
                {filteredSearchList.map(ind => (
                  <div
                    key={ind.militaryId}
                    onClick={() => handleSelectIndividual(ind)}
                    className={`p-3.5 border rounded-2xl cursor-pointer text-right transition-all group relative overflow-hidden ${
                      selectedIndividual?.militaryId === ind.militaryId ? 'bg-emerald-50/40 border-emerald-500 shadow-sm' :
                      ind.payoutStatus === 'received' ? 'border-slate-100 bg-slate-50 opacity-60' :
                      'border-slate-150 hover:border-slate-350 hover:bg-slate-50/30'
                    }`}
                  >
                    {/* Active strip highlight */}
                    {selectedIndividual?.militaryId === ind.militaryId && (
                      <div className="absolute right-0 top-0 bottom-0 w-1 bg-emerald-500" />
                    )}

                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[8.5px] font-black px-2 py-0.5 rounded-lg ${ind.payoutStatus === 'received' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                        {ind.payoutStatus === 'received' ? 'مستلِم ✔' : 'انتظار ⏳'}
                      </span>
                      <h4 className="text-3xs font-black text-slate-800 group-hover:text-emerald-800 transition-colors">{ind.fullName}</h4>
                    </div>
                    <div className="flex items-center justify-between text-4xs text-slate-450 font-mono mt-2">
                      <span className="font-sans font-extrabold text-emerald-800">{formatCurrency(ind.entitledAmount)} ر.س</span>
                      <span>عسكري: {ind.militaryId}</span>
                    </div>
                    <div className="flex items-center justify-between text-[9px] text-slate-400 font-bold border-t border-slate-100/65 mt-2 pt-1.5 font-sans">
                      <span>وحدة: {ind.unit}</span>
                      <span className="text-[9px] text-emerald-600 font-black group-hover:translate-x-1 transition-transform">تصفية السند ⬅</span>
                    </div>
                  </div>
                ))}
                {filteredSearchList.length === 0 && (
                  <div className="text-center py-20 text-slate-400 text-3xs font-bold leading-relaxed">
                    لا تتوفر أي سجلات مالية مطابقة لفئات البحث الحالية. جرب تغيير فلاتر التصفية أو توسيع نطاق البحث.
                  </div>
                )}
              </div>

              {/* 🥋 Active Individual Payout Action Sheet (بطاقة بيانات الفرد) */}
              <div className="lg:col-span-2">
                {selectedIndividual ? (
                  <div className={`p-5 rounded-3xl border transition-all shadow-md flex flex-col justify-between h-full min-h-[450px] relative overflow-hidden ${
                    selectedIndividual.payoutStatus === 'received' ? 'bg-rose-50/50 border-rose-200 shadow-inner' : 'bg-white border-slate-200'
                  }`}>
                    {/* Header profile info including optional avatar picture */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b pb-3 border-dashed border-slate-200">
                        <div>
                          <span className="text-4xs text-slate-400 font-bold block mb-0.5 text-right">بطاقة الملف المالي المعزز:</span>
                          <h3 id="recipient-fullName" className="text-xs font-black text-slate-900 leading-snug">{selectedIndividual.fullName}</h3>
                        </div>
                        {/* Optional profile picture (صورة اختيارية) with beautiful military insignia fallback */}
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-slate-200 to-slate-100 border border-slate-300 flex items-center justify-center text-slate-500 shadow-inner">
                          <User className="w-6 h-6 text-slate-400" />
                        </div>
                      </div>

                      {/* Six Core Required fields: Quad name, military ID, unit, battalion, company, amount, status */}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 bg-slate-50 border border-slate-200/60 p-4 rounded-2xl text-3xs text-right leading-loose">
                        <div>
                          <span className="text-slate-400 font-bold block mb-0.5">الرقم العسكري الرسمي:</span>
                          <span id="recipient-militaryId" className="font-mono text-slate-800 text-xs font-black">{selectedIndividual.militaryId}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold block mb-0.5">الوحدة الميدانية:</span>
                          <span className="text-slate-800 text-2xs font-extrabold">{selectedIndividual.unit}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold block mb-0.5">الكتيبة والمجموعة:</span>
                          <span className="text-slate-800 text-2xs font-black">{selectedIndividual.battalion || 'الكتيبة الأولى مشاة'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold block mb-0.5">السرية وفصيلة القيادة:</span>
                          <span className="text-slate-800 text-2xs font-black">{selectedIndividual.company || 'السرية الثانية'}</span>
                        </div>
                        <div className="border-t md:border-t-0 md:border-r pt-2 md:pt-0 md:pr-3.5 col-span-2 md:col-span-1">
                          <span className="text-emerald-800 font-extrabold block mb-0.5">مبلغ الصرف المستحق:</span>
                          <span id="recipient-amount" className="font-mono text-emerald-700 text-xs font-black block">{formatCurrency(selectedIndividual.entitledAmount)} ر.س</span>
                        </div>
                      </div>

                      {/* 🔴 RECEIVED STATE BANNER (حالة الاستلام: تم الصرف مسبقا باللون الأحمر) */}
                      {selectedIndividual.payoutStatus === 'received' ? (
                        <div className="bg-red-55 border-r-4 border-rose-500 text-slate-850 p-4.5 rounded-2xl space-y-2.5">
                          <h4 className="text-3xs font-black text-rose-800 flex items-center gap-1.5 justify-start">
                            <AlertOctagon className="w-5 h-5 text-rose-600 shrink-0" />
                            <span>تم صرف المستحقات مسبقاً للفرد</span>
                          </h4>
                          <p className="text-4xs text-slate-650 leading-relaxed font-bold">
                            عذراً! تم سحب واستلام مبالغ السلفة المسجلة مسبقاً بهذا الملف ولا يسمح النظام العام للصرف بإصدار السند مجدداً.
                          </p>

                          <div className="bg-white/80 border border-slate-100 rounded-xl p-3 grid grid-cols-2 gap-2 text-4xs font-bold text-slate-550 font-mono text-right">
                            <p>اسم الصراف الصادر: <strong className="text-slate-800 font-sans">{selectedIndividual.receivedCashierName || 'المسؤول المالي العام'}</strong></p>
                            <p>تاريخ وتوقيت العملية: <strong className="text-slate-800 font-sans">{selectedIndividual.receivedAt ? formatDateTime(selectedIndividual.receivedAt) : '-'}</strong></p>
                          </div>
                        </div>
                      ) : (
                        /* 🟢 PENDING STATE GREEN OPTION (حالة الاستلام: لم يستلم باللون الأخضر) */
                        <div className="bg-emerald-50/50 border-r-4 border-emerald-500 text-slate-800 p-4.5 rounded-2xl space-y-1.5 leading-relaxed text-4xs font-semibold">
                          <h4 className="text-3xs font-black text-emerald-800 flex items-center gap-1">
                            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                            <span>لم يستلم بعد وقابل للصرف حالياً</span>
                          </h4>
                          <p>
                            الملف ذو الذمة المالية المعلقة ومطابق لمجموع السيولة بالصندوق، قم بالتحقق من هويتهم وبصماتهم العسكرية يدوياً واضغط لإتمام الصرف فوريا.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Bottom Action Footer bar for payouts */}
                    <div className="mt-4 space-y-3.5 border-t pt-4">
                      {/* Rapid Payout Mode switcher switch */}
                      <button
                        type="button"
                        onClick={() => setIsRapidMode(!isRapidMode)}
                        className="w-full flex items-center justify-between bg-slate-50 hover:bg-slate-100 p-2.5 rounded-xl border border-dashed border-slate-200 transition text-right cursor-pointer"
                      >
                        <span className={`w-8 h-4.5 rounded-full transition-colors relative flex items-center px-0.5 ${isRapidMode ? 'bg-amber-500' : 'bg-slate-300'}`}>
                          <span className={`w-3.5 h-3.5 bg-white rounded-full shadow transition-transform ${isRapidMode ? '-translate-x-3.5' : 'translate-x-0'}`} />
                        </span>
                        <span className="text-[10px] font-black text-slate-700 flex items-center gap-1 justify-end">
                          <span>الصرف السريع الفوري الميداني (تجاوز شروط التواقيع الرقمية)</span>
                          <Zap className={`w-3.5 h-3.5 text-amber-500 ${isRapidMode ? 'animate-bounce' : ''}`} />
                        </span>
                      </button>

                      {selectedIndividual.payoutStatus !== 'received' ? (
                        isRapidMode ? (
                          /* RAPID MODE DIRECT PAYOUT BUTTON */
                          <button
                            id="confirm-payout-btn"
                            type="button"
                            disabled={txIsProcessing}
                            onClick={() => executePayoutAction(selectedIndividual)}
                            className="w-full py-4 px-4 font-black text-slate-950 bg-amber-400 hover:bg-amber-500 active:scale-[0.98] rounded-2.5xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer border border-amber-500/20"
                          >
                            {txIsProcessing ? (
                              <RefreshCw className="w-5 h-5 animate-spin" />
                            ) : (
                              <>
                                <Zap className="w-5 h-5 text-slate-950 animate-pulse" />
                                <span>صرف فوري عاجل بنقرة واحدة وتجاوز التوقيع ⚡</span>
                              </>
                            )}
                          </button>
                        ) : (
                          /* STANDARD VERIFICATION VERIFY MODE BUTTON */
                          <button
                            id="confirm-payout-btn"
                            type="button"
                            onClick={() => {
                              setVerificationStep('checklist');
                              setFingerprintProgress(0);
                              setShowConfirmModal(true);
                            }}
                            className="w-full py-4 px-4 font-black text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] rounded-2.5xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <CheckCircle className="w-5 h-5" />
                            <span>تأكيد صرف المستحقات المالية الآن (مسار البصمة)</span>
                          </button>
                        )
                      ) : (
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            onClick={() => window.print()}
                            className="w-full py-3 px-4 font-black text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition shadow flex items-center justify-center gap-1.5 cursor-pointer text-3xs"
                          >
                            <Printer className="w-4 h-4 text-emerald-400" />
                            إعادة طباعة سند الصرف المكتمل
                          </button>
                          <button
                            disabled={true}
                            className="w-full py-3 px-4 font-bold text-slate-450 bg-slate-100 border border-slate-200 rounded-xl cursor-not-allowed text-4xs flex items-center justify-center gap-1"
                          >
                            القبض مغلق بقفل الذمة المالية المكتملة
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center min-h-[450px] flex flex-col items-center justify-center space-y-4">
                    <div className="w-16 h-16 bg-slate-50 border border-slate-150 rounded-full flex items-center justify-center text-slate-400">
                      <User className="w-8 h-8" />
                    </div>
                    <h3 className="text-sm font-black text-slate-700">بانتظار مطابقة والتحقق من هوية الفرد العسكرية</h3>
                    <p className="text-3xs text-slate-500 max-w-sm mx-auto leading-relaxed font-semibold">
                      يرجى اختيار اسم الجندي المعمد من اللائحة اليمنى لقيد المعاينة وكشف مبالغ التحصيل الميداني لهم.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: 📋 شاشة المستلمين والغير مستلمين (Recipients / Non-Recipients) */}
        {activeTab === 'recipients' && (
          <div className="space-y-4 bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
            
            {/* Header switcher tabs in card */}
            <div className="border-b pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <input
                  type="text"
                  placeholder="بحث في الكشف المكتمل أو المتبقي..."
                  value={recipientsSearch}
                  onChange={(e) => setRecipientsSearch(e.target.value)}
                  className="w-full text-right pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-3xs font-semibold focus:outline-none"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
              </div>

              <div className="flex bg-slate-100 p-1 rounded-xl self-end sm:self-auto font-sans">
                <button
                  type="button"
                  onClick={() => setRecipientsSubTab('received')}
                  className={`py-1.5 px-4 rounded-lg text-3xs font-black transition ${recipientsSubTab === 'received' ? 'bg-slate-800 text-white shadow' : 'text-slate-600'}`}
                >
                  📋 شاشة المستلمين ({individuals.filter(i => i.payoutStatus === 'received').length} فرد)
                </button>
                <button
                  type="button"
                  onClick={() => setRecipientsSubTab('pending')}
                  className={`py-1.5 px-4 rounded-lg text-3xs font-black transition ${recipientsSubTab === 'pending' ? 'bg-slate-800 text-white shadow' : 'text-slate-600'}`}
                >
                  ⏳ شاشة غير المستلمين ({individuals.filter(i => i.payoutStatus === 'pending').length} فرد)
                </button>
              </div>
            </div>

            {/* List Table with values */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="bg-slate-50 text-slate-500 uppercase text-xs border-b">
                  <tr>
                    <th className="px-4 py-3 font-black text-3xs">الرقم العسكري</th>
                    <th className="px-4 py-3 font-black text-3xs">الاسم الرباعي</th>
                    <th className="px-4 py-3 font-black text-3xs">المجموعة / الفصيلة</th>
                    <th className="px-4 py-3 font-black text-3xs">الكتيبة / السرية</th>
                    <th className="px-4 py-3 font-black text-3xs">قيمة الصرف</th>
                    {recipientsSubTab === 'received' && <th className="px-4 py-3 font-black text-3xs">وقت الصرف الدقيق</th>}
                    {recipientsSubTab === 'pending' && <th className="px-4 py-3 font-black text-3xs">الإجراء المعروض</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {individuals
                    .filter(i => i.payoutStatus === recipientsSubTab)
                    .filter(i => i.fullName.includes(recipientsSearch) || i.militaryId.includes(recipientsSearch))
                    .map(ind => (
                      <tr key={ind.militaryId} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3.5 font-bold font-mono text-slate-700">{ind.militaryId}</td>
                        <td className="px-4 py-3.5 font-semibold text-slate-850">{ind.fullName}</td>
                        <td className="px-4 py-3.5 text-slate-500 text-xs">{ind.unit}</td>
                        <td className="px-4 py-3.5 text-slate-450 text-3xs">{ind.battalion || 'الأولى'} / {ind.company || 'الأولى'}</td>
                        <td className="px-4 py-3.5 font-bold text-slate-800 font-mono">{formatCurrency(ind.entitledAmount)}</td>
                        {recipientsSubTab === 'received' && (
                          <td className="px-4 py-3.5 font-mono text-3xs text-slate-500">
                            {ind.receivedAt ? formatDateTime(ind.receivedAt) : '-'}
                          </td>
                        )}
                        {recipientsSubTab === 'pending' && (
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => {
                                handleSelectIndividual(ind);
                                setActiveTab('search');
                              }}
                              className="px-2.5 py-1 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-250/50 text-[10px] font-black rounded-lg transition"
                            >
                              توجه لتأكيد الصرف
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  {individuals.filter(i => i.payoutStatus === recipientsSubTab).length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-slate-400 font-bold text-3xs">
                        لا تتوفر في الكشف الحالي أي سجلات تطابق البحث.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: 📊 شاشة التقارير والإحصائيات (Reports & Visual graphs View) */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            
            {/* Control panel of exports printable reports */}
            <div className="bg-white border border-slate-200 p-5 rounded-3xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-xs font-black text-slate-800">بيانات التصدير والملخصات الختامية</h3>
                <p className="text-5xs text-slate-500 leading-snug mt-1 font-semibold">استخرج كشوف البيانات بصيغة اكسل محاسبية أو اطبع الفئة في قائمة PDF المعتمدة للوزارة.</p>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleExportExcelCSV}
                  className="px-4 py-2.5 bg-emerald-50 text-emerald-850 hover:bg-emerald-100 border border-emerald-250 rounded-xl text-3xs font-black transition flex items-center gap-2 cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  تصدير ملف Excel (CSV) 📥
                </button>
                <button
                  type="button"
                  onClick={handlePrintReports}
                  className="px-4 py-2.5 bg-slate-900 text-white hover:bg-slate-850 rounded-xl text-3xs font-black transition flex items-center gap-2 cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-slate-400" />
                  طباعة التقرير PDF معتمد 📑
                </button>
              </div>
            </div>

            {/* Sub segments selection */}
            <div className="flex bg-slate-100/80 p-1 rounded-xl w-fit">
              <button
                type="button"
                onClick={() => setReportSubTab('daily')}
                className={`py-1.5 px-4 rounded-lg text-3xs font-black transition ${reportSubTab === 'daily' ? 'bg-white text-emerald-800 shadow-sm font-black' : 'text-slate-500'}`}
              >
                التقرير اليومي للمستلمين 📄
              </button>
              <button
                type="button"
                onClick={() => setReportSubTab('all')}
                className={`py-1.5 px-4 rounded-lg text-3xs font-black transition ${reportSubTab === 'all' ? 'bg-white text-emerald-800 shadow-sm font-black' : 'text-slate-500'}`}
              >
                سجل العمليات المنفذة باللجنة 📑
              </button>
              <button
                type="button"
                onClick={() => setReportSubTab('remaining')}
                className={`py-1.5 px-4 rounded-lg text-3xs font-black transition ${reportSubTab === 'remaining' ? 'bg-white text-emerald-800 shadow-sm font-black' : 'text-slate-500'}`}
              >
                بيانات غير المستلمين (حسب التنظيم) ⏳
              </button>
            </div>

            {/* SECTIONS CONTENTS */}
            {reportSubTab === 'daily' && (
              <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
                <div className="border-b pb-2 flex justify-between items-center">
                  <span className="text-4xs text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded">كشف رسمي</span>
                  <h4 className="text-xs font-black text-slate-800">بيان الأفراد الذين أتموا الصرف اليومي</h4>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-right">
                    <thead className="bg-slate-100 text-slate-500 text-xs">
                      <tr>
                        <th className="px-4 py-2 font-black text-3xs">الرقم العسكري</th>
                        <th className="px-4 py-2 font-black text-3xs">الاسم الكامل</th>
                        <th className="px-4 py-2 font-black text-3xs">الوحدة / الكتيبية</th>
                        <th className="px-4 py-2 font-black text-3xs">السعر المقبوض</th>
                        <th className="px-4 py-2 font-black text-3xs">اسم الصراف المعتمد</th>
                        <th className="px-4 py-2 font-black text-3xs">توقيت الصرف</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {individuals.filter(i => i.payoutStatus === 'received').map(ind => (
                        <tr key={ind.militaryId} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3 font-mono font-bold text-slate-800">{ind.militaryId}</td>
                          <td className="px-4 py-3 font-semibold text-slate-850">{ind.fullName}</td>
                          <td className="px-4 py-3 text-slate-500 text-xs">{ind.unit} ({ind.battalion})</td>
                          <td className="px-4 py-3 font-bold text-slate-800">{formatCurrency(ind.entitledAmount)}</td>
                          <td className="px-4 py-3 text-slate-600 font-bold">{ind.receivedCashierName || '-'}</td>
                          <td className="px-4 py-3 font-mono text-3xs text-slate-450">{ind.receivedAt ? formatDateTime(ind.receivedAt) : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {reportSubTab === 'all' && (
              <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
                <div className="border-b pb-2">
                  <h4 className="text-xs font-black text-slate-850">كشف عمليات الصرف المباشر المنفذة بالتسجيل</h4>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-right">
                    <thead className="bg-slate-100 text-slate-500 text-xs">
                      <tr>
                        <th className="px-4 py-2 font-black text-3xs">اسم الفرد</th>
                        <th className="px-4 py-2 font-black text-3xs">العسكري</th>
                        <th className="px-4 py-2 font-black text-3xs">مبلغ السند</th>
                        <th className="px-4 py-2 font-black text-3xs">وقت المعاملة</th>
                        <th className="px-4 py-2 font-black text-3xs">القناة والبيانات المرجعية</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {individuals.filter(i => i.payoutStatus === 'received').map(ind => (
                        <tr key={ind.militaryId + '-op'} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3 font-semibold text-slate-800">{ind.fullName}</td>
                          <td className="px-4 py-3 font-mono text-slate-600 font-bold">{ind.militaryId}</td>
                          <td className="px-4 py-3 font-bold text-emerald-800 font-mono">{formatCurrency(ind.entitledAmount)}</td>
                          <td className="px-4 py-3 font-mono text-3xs text-slate-500">{ind.receivedAt ? formatDateTime(ind.receivedAt) : '-'}</td>
                          <td className="px-4 py-3 text-4xs text-slate-450">{ind.receivedLocation ? ind.receivedLocation.replace(' (محاكي الميدان GPS)', '') : 'ميدان الصرف الرئيسي'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {reportSubTab === 'remaining' && (
              <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
                {/* Advanced Filters block for remaining individuals */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-2xl border">
                  <div>
                    <label className="text-5xs font-black text-slate-550 block mb-1">تصفية حسب الوحدة:</label>
                    <select
                      value={filterUnit}
                      onChange={(e) => setFilterUnit(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl text-4xs font-bold"
                    >
                      <option value="all">كافة الوحدات 📋</option>
                      {uniqueUnits.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-5xs font-black text-slate-550 block mb-1">تصفية حسب الكتيبة:</label>
                    <select
                      value={filterBattalion}
                      onChange={(e) => setFilterBattalion(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl text-4xs font-bold"
                    >
                      <option value="all">كافة الكتائب 📋</option>
                      {uniqueBattalions.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-5xs font-black text-slate-550 block mb-1">تصفية حسب السرية:</label>
                    <select
                      value={filterCompany}
                      onChange={(e) => setFilterCompany(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl text-4xs font-bold"
                    >
                      <option value="all">كافة السرايا 📋</option>
                      {uniqueCompanies.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-right">
                    <thead className="bg-slate-100 text-slate-500 text-xs">
                      <tr>
                        <th className="px-4 py-2 font-black text-3xs">الرقم العسكري</th>
                        <th className="px-4 py-2 font-black text-3xs">الاسم الكامل</th>
                        <th className="px-4 py-2 font-black text-3xs">الوحدة</th>
                        <th className="px-4 py-2 font-black text-3xs font-black">الكتيبة / السرية</th>
                        <th className="px-4 py-2 font-black text-3xs">المبلغ المستحق</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {remainingReportList.map(ind => (
                        <tr key={ind.militaryId} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3 font-mono font-bold text-slate-700">{ind.militaryId}</td>
                          <td className="px-4 py-3 font-semibold text-slate-850">{ind.fullName}</td>
                          <td className="px-4 py-3 text-slate-500 text-xs">{ind.unit}</td>
                          <td className="px-4 py-3 text-slate-450 text-4xs">{ind.battalion || 'الأولى'} / {ind.company || 'الأولى'}</td>
                          <td className="px-4 py-3 font-bold text-slate-800">{formatCurrency(ind.entitledAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 📊 INTERACTIVE HANDCRAFTED REPORT GRAPHS (الرسومات البيانية والإحصائيات) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              
              {/* Radial Completion & Remaining Gauge */}
              <div className="bg-white border border-slate-200 p-5 rounded-3xl shadow-sm text-center space-y-4">
                <h4 className="text-xs font-black text-slate-850 border-b pb-2">سير الإنجاز ونسب الصرف المائي في اللجنة</h4>
                <div className="flex flex-col items-center justify-center py-4">
                  <div className="relative w-40 h-40">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="80" cy="80" r="70" fill="transparent" stroke="#f1f5f9" strokeWidth="12" />
                      <circle cx="80" cy="80" r="70" fill="transparent" stroke="#10b981" strokeWidth="12" 
                        strokeDasharray={`${2 * Math.PI * 70 * (statsCompletionRate / 100)} 440`} />
                    </svg>
                    <div className="absolute inset-x-0 inset-y-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-black text-slate-800 font-mono">{statsCompletionRate}%</span>
                      <span className="text-[10px] text-slate-400 font-bold mt-1">نسبة التسليم الكلي</span>
                    </div>
                  </div>
                </div>
                <div className="flex justify-around items-center text-4xs text-slate-600 font-black">
                  <p className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> استلموا: {statsReceived} فردًا</p>
                  <p className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-slate-300"></span> متبقين: {statsPending} أفراد</p>
                </div>
              </div>

              {/* Responsive Unit Distribution metric graph */}
              <div className="bg-white border border-slate-200 p-5 rounded-3xl shadow-sm space-y-4">
                <h4 className="text-xs font-black text-slate-850 border-b pb-2">توزيع الأفراد المصروف لهم حسب الوحدات</h4>
                <div className="space-y-3.5 pt-2">
                  {unitStatsData.map(stat => (
                    <div key={stat.name} className="space-y-1.5 text-right">
                      <div className="flex justify-between items-center text-4xs font-bold">
                        <span className="font-mono text-slate-700">{stat.paid} / {stat.total} فردًا ({stat.rate}%)</span>
                        <span className="text-slate-800 font-black">{stat.name}</span>
                      </div>
                      <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                        <div 
                          className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                          style={{ width: `${stat.rate}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        )}

        {/* TAB 5: ⚙️ الإعدادات وخزينة الصراف (Settings) */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            
            {/* Logout and Credentials block */}
            <div className="bg-slate-900 text-slate-100 p-5 rounded-3xl shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="text-right">
                <span className="text-[10px] text-emerald-400 font-black">جلسة الصراف الحالية مؤمنة</span>
                <p className="text-xs font-black mt-0.5">هل ترغب في تبديل الحساب أو إغلاق هذه الوردية الأمنية؟</p>
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="px-5 py-3.5 bg-rose-600 hover:bg-rose-700 text-white text-3xs font-black rounded-xl transition shadow active:scale-95 cursor-pointer flex items-center gap-2"
              >
                <LogOut className="w-4.5 h-4.5" />
                إنهاء الوردية وتسجيل الخروج الآمن
              </button>
            </div>
          </div>
        )}

      </div>

      {/* 🧾 STANDARD STEP-BY-STEP VERIFICATION TRANSIT MODAL */}
      <AnimatePresence>
        {showConfirmModal && selectedIndividual && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs"
              onClick={() => { if (!txIsProcessing && !txSuccessMessage) setShowConfirmModal(false); }}
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="bg-white rounded-3xl max-w-md w-full shadow-2xl border p-5 space-y-4 relative z-10 text-right overflow-hidden"
            >
              <div className="absolute top-0 right-0 left-0 h-1.5 bg-emerald-600" />
              
              <div className="border-b pb-2 flex justify-between items-center">
                <span className="text-5xs bg-emerald-50 text-emerald-800 font-extrabold px-2 py-0.5 rounded">لوحة الصرف الفوري المباشر</span>
                <h3 className="text-sm font-black text-slate-900">سند تصفية وصرف مستحقات مالي</h3>
              </div>

              {!txSuccessMessage ? (
                <div className="space-y-4">
                  <p className="text-3xs text-slate-500 font-bold leading-relaxed text-right">
                    يرجى مراجعة تفاصيل ومستحقات الفرد الماثل أمام الصراف وتأكيد هويته قبل إتمام تصفية السند النقدي:
                  </p>

                  <div className="bg-slate-50 p-4 border rounded-2xl text-[10px] space-y-2.5 font-bold text-slate-700">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
                      <span className="text-slate-950 font-sans font-black">{selectedIndividual.fullName}</span>
                      <span className="text-slate-450">اسم المستفيد المستلم:</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
                      <span className="text-slate-950 font-mono font-bold">{selectedIndividual.militaryId}</span>
                      <span className="text-slate-455">الرقم العسكري:</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
                      <span className="text-slate-950 font-sans font-bold">{selectedIndividual.unit}</span>
                      <span className="text-slate-455">اللواء / الوحدة العسكرية:</span>
                    </div>
                    <div className="flex justify-between items-center pt-1">
                      <span className="text-emerald-800 text-base font-black font-mono">
                        {formatCurrency(selectedIndividual.entitledAmount)} ر.س
                      </span>
                      <span className="text-slate-800">المستحقات المعتمدة نقداً:</span>
                    </div>
                  </div>

                  <div className="bg-emerald-50 text-emerald-800 text-[9.5px] p-3 rounded-xl border border-emerald-100 font-bold leading-relaxed">
                    📜 بيان التصفية: بصرف هذا السند، يلتزم الصراف المعمد بتسليم المستحقات المالية عيناً بالبد لصاحب القيد لمنع التكرار أو الازدواج المالي.
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowConfirmModal(false)}
                      className="flex-1 py-3 text-3xs font-black bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-500 cursor-pointer transition active:scale-95"
                    >
                      إلغاء المعاملة
                    </button>
                    <button
                      id="modal-confirm-payout-btn"
                      type="button"
                      disabled={txIsProcessing}
                      onClick={() => executePayoutAction(selectedIndividual)}
                      className="flex-1 py-3 text-3xs font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow cursor-pointer transition active:scale-95 flex items-center justify-center gap-1.5"
                    >
                      {txIsProcessing ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        "✔ تأكيد وصرف السند"
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                /* Interactive Banking Receipt details mockup */
                <div className="space-y-4">
                  <div className="text-center pb-3 border-b border-dashed border-slate-200 space-y-1">
                    <Receipt className="w-10 h-10 text-emerald-500 mx-auto animate-bounce" />
                    <h4 className="text-xs font-black text-slate-800">قسيمة دفع وصرف نقدي معتمدة</h4>
                    <span className="text-5xs bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-full inline-block font-extrabold border">● إيداع وسند مالي مكتمل</span>
                  </div>

                  <div className="bg-slate-50 p-4 border rounded-2xl text-[10px] space-y-1.5 font-bold font-mono">
                    <div className="flex justify-between border-b pb-1">
                      <span className="text-slate-800 font-bold">SAR-PAY-{selectedIndividual.militaryId}</span>
                      <span className="text-slate-450 font-sans">الرقم المرجعي المحمي للقسيمة:</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-800 font-sans">{selectedIndividual.fullName}</span>
                      <span className="text-slate-455 font-sans">الجندي المستفيد المقيد:</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-805 font-mono">{selectedIndividual.militaryId}</span>
                      <span className="text-slate-455 font-sans">الرقم العسكري:</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-800 font-sans">{cashier.name}</span>
                      <span className="text-slate-455 font-sans">الصراف المسؤول المعمد:</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t items-center text-xs">
                      <span className="text-emerald-800 font-black">{formatCurrency(selectedIndividual.entitledAmount)} ر.س</span>
                      <span className="text-slate-800 font-sans">مبلغ الصرف الصافي:</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={() => window.print()} className="py-2.5 text-3xs font-bold bg-emerald-55 text-emerald-800 hover:bg-emerald-100 border rounded-lg transition flex items-center justify-center gap-1">
                      <Printer className="w-3.5 h-3.5" />
                      طباعة السند الورقي
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedIndividual(null);
                        setTxSuccessMessage(null);
                        setShowConfirmModal(false);
                      }}
                      className="py-2.5 text-3xs font-black text-white bg-slate-900 hover:bg-slate-850 rounded-lg"
                    >
                      إتمام وإنهاء المعاملة
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ⚠️ ALREADY RECEIVED / CONCURRENCY DOUBLE CLAIM CONTEST WARNING MODAL */}
      <AnimatePresence>
        {showDoubleClaimModal && doubleClaimDetail && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/75 backdrop-blur-xs"
              onClick={() => setShowDoubleClaimModal(false)}
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="bg-white rounded-3xl max-w-sm w-full shadow-2xl border-2 border-amber-300 p-5 space-y-4 relative z-10 text-right overflow-hidden"
            >
              <div className="absolute top-0 right-0 left-0 h-1.5 bg-amber-500 animate-pulse" />

              <div className="text-center space-y-1.5 pb-2 border-b">
                <AlertOctagon className="w-10 h-10 text-amber-500 mx-auto animate-bounce" />
                <h3 className="text-xs font-black text-slate-800">حظر: تم صرف المستحقات مسبقاً!</h3>
                <span className="text-5xs bg-amber-100 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-full inline-block font-extrabold">قيد مالي مغلق</span>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl space-y-1.5 text-4xs font-bold leading-normal text-slate-600">
                <p>صاحب القيد: <strong className="text-slate-950 font-sans">{doubleClaimDetail.individualName}</strong></p>
                <p>اسم الصراف المصرف: <strong className="text-slate-900 font-sans">{doubleClaimDetail.cashierName}</strong></p>
                <p>الموقع المسجل للميدان: <strong className="text-slate-900 font-sans">{doubleClaimDetail.location}</strong></p>
                <p>تاريخ الصرف الدقيق: <strong className="text-slate-900 font-mono">{formatDateTime(doubleClaimDetail.timestamp)}</strong></p>
              </div>

              <p className="text-[9.5px] text-amber-950 font-bold bg-amber-100/50 p-2.5 rounded-lg border border-amber-200 leading-relaxed text-right">
                ⚠️ يمنع الصرف المزدوج المكرر: يمنع معالج الصرف من تحرير أي قيمة نقدية موازية لنفس القيد لتجنب المحاسبة والمسؤولية القانونية.
              </p>

              <button
                type="button"
                onClick={() => setShowDoubleClaimModal(false)}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-3xs font-black active:scale-95 transition"
              >
                مفهوم، إغلاق الإشعار المالي
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 📱 PERSISTENT BOTTOM MENU NAVIGATION CHASSIS (القائمة السفلية) */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 py-2.5 px-4 z-40 print:hidden shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
        <div className="max-w-md mx-auto flex items-center justify-around">
          {[
            { id: 'home', label: 'الرئيسية 🏠', icon: Home },
            { id: 'search', label: 'البحث 🔍', icon: Search },
            { id: 'recipients', label: 'المستلمين 📋', icon: Users },
            { id: 'reports', label: 'التقارير 📊', icon: BarChart3 },
            { id: 'settings', label: 'الإعدادات ⚙️', icon: Settings },
          ].map(tab => {
            const SelectedIcon = tab.icon;
            const isTabActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id as any);
                  setSearchQuery('');
                  setRecipientsSearch('');
                  setIsFullScreen(true);
                }}
                className={`flex flex-col items-center gap-1 justify-center relative cursor-pointer px-3 py-1 rounded-xl transition ${
                  isTabActive ? 'text-emerald-700 bg-emerald-50/75 animate-none' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <SelectedIcon className={`w-5 h-5 ${isTabActive ? 'scale-110 text-emerald-600' : ''}`} />
                <span className="text-[10px] font-black">{tab.label.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>
      </div>

    </div>
  );
}
