/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Wifi, WifiOff, CloudLightning, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface OfflineIndicatorProps {
  isOnline: boolean;
  onToggleConnection: () => void;
  pendingSyncCount: number;
  onForceSync: () => void;
  isSyncing: boolean;
}

export default function OfflineIndicator({
  isOnline,
  onToggleConnection,
  pendingSyncCount,
  onForceSync,
  isSyncing,
}: OfflineIndicatorProps) {
  return (
    <div id="connection-status-panel" className="bg-slate-55 border border-slate-200/80 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-right">
      <div className="flex items-center gap-3 w-full sm:w-auto">
        {/* Status Glowing Badge */}
        <div className="relative flex h-3.5 w-3.5 mr-1 select-none">
          {isOnline ? (
            <>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-600"></span>
            </>
          ) : (
            <>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-600"></span>
            </>
          )}
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span id="payout-connection-indicator" className={`text-sm font-bold ${isOnline ? 'text-emerald-700' : 'text-red-700'}`}>
              {isOnline ? 'حالة الشبكة: متصل بالإنترنت (البث المباشر)' : 'حالة الشبكة: غير متصل (المحاكاة الميدانية أوفلاين)'}
            </span>
            {isOnline ? <Wifi className="w-4 h-4 text-emerald-600" /> : <WifiOff className="w-4 h-4 text-red-600" />}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {isOnline 
              ? 'تتم مزامنة جميع عمليات الصرف فورياً ومباشرة مع خوادم Firebase لمنع الازدواجية.' 
              : 'تم تفعيل التخزين الميداني المؤقت. سيتم حفظ العمليات محلياً ومزامنتها تلقائياً عند عودة الشبكة.'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
        {/* Queue Metrics */}
        <AnimatePresence>
          {pendingSyncCount > 0 && (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-amber-50 border border-amber-200 text-amber-800 px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-semibold"
            >
              <CloudLightning className="w-4 h-4 animate-bounce text-amber-600" />
              <span>{pendingSyncCount} معلقة بالمخزن الميداني</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sync Manual Trigger */}
        {!isOnline && pendingSyncCount > 0 && (
          <button
            id="force-sync-btn"
            type="button"
            onClick={onForceSync}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white rounded-lg text-xs font-bold shadow-sm transition-all active:scale-[0.97]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            مزامنة يدوية ({pendingSyncCount})
          </button>
        )}

        {/* Toggle Simulated Switch */}
        <button
          id="toggle-network-btn"
          type="button"
          onClick={onToggleConnection}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all duration-200 ${
            isOnline 
              ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-300/80' 
              : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 font-semibold shadow-sm'
          }`}
        >
          {isOnline ? 'قطع الاتصال (محاكاة أوفلاين)' : 'إعادة الاتصال (تفعيل المزامنة)'}
        </button>
      </div>
    </div>
  );
}
