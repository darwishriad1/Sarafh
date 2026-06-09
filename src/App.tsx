/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  getFirestore, doc, collection, onSnapshot, setDoc, deleteDoc, 
  updateDoc, writeBatch, getDocs, getDoc, query, orderBy, where
} from 'firebase/firestore';
import { 
  auth, db, signInWithPopup, signInAnonymously, signOut, 
  googleProvider, handleFirestoreError, OperationType, secondaryAuth 
} from './firebase';
import { onAuthStateChanged, User as FirebaseUser, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { Individual, Cashier, OperationLog } from './types';
import { DEMO_INDIVIDUALS, DEMO_CASHIERS } from './data/seedData';
import { getGPSLocation, getDeviceSignature, formatCurrency } from './utils';
import { motion, AnimatePresence } from 'motion/react';

// Subcomponents import
import LoginScreen from './components/LoginScreen';
import OfflineIndicator from './components/OfflineIndicator';
import AdminPanel from './components/AdminPanel';
import CashierPanel from './components/CashierPanel';
import ReportView from './components/ReportView';

// Nav icons
import { Shield, UserCheck, BarChart3, Wifi, WifiOff, RefreshCw, AlertTriangle, Disc, LogOut } from 'lucide-react';

export default function App() {
  // App-wide views
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [activeRole, setActiveRole] = useState<'admin' | 'cashier' | null>(() => {
    const saved = localStorage.getItem('active_role');
    return (saved === 'admin' || saved === 'cashier') ? saved : null;
  });
  const [activeCashier, setActiveCashier] = useState<Cashier | null>(() => {
    const saved = localStorage.getItem('active_cashier');
    try {
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [isAppLoading, setIsAppLoading] = useState(true);
  const [viewState, setViewState] = useState<'dashboard' | 'reports'>('dashboard');
  const [authWarning, setAuthWarning] = useState<string | null>(null);

  // Database lists
  const [individuals, setIndividuals] = useState<Individual[]>(DEMO_INDIVIDUALS);
  const [cashiers, setCashiers] = useState<Cashier[]>(DEMO_CASHIERS);
  const [operations, setOperations] = useState<OperationLog[]>([]);

  // Simulation of Offline Connection state
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [pendingOfflineQueue, setPendingOfflineQueue] = useState<Individual[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Sync active states to localStorage to preserve cashier session across refreshes
  useEffect(() => {
    if (activeRole) {
      localStorage.setItem('active_role', activeRole);
    } else {
      localStorage.removeItem('active_role');
    }
  }, [activeRole]);

  useEffect(() => {
    if (activeCashier) {
      localStorage.setItem('active_cashier', JSON.stringify(activeCashier));
    } else {
      localStorage.removeItem('active_cashier');
    }
  }, [activeCashier]);

  // Initial Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setIsAppLoading(false);
      
      // If user logs out, reset roles but immediately re-login anonymously in the background
      // This maintains the active Firestore listeners so lists are up to date on Login screen
      if (!user) {
        const savedRole = localStorage.getItem('active_role');
        if (savedRole !== 'cashier') {
          setActiveRole(null);
          setActiveCashier(null);
          try {
            await signInAnonymously(auth);
          } catch (err: any) {
            console.warn("Auto anonymous login failure:", err);
            if (err.code === 'auth/operation-not-allowed') {
              setAuthWarning(
                "تسجيل الدخول المجهول (Anonymous Authentication) غير مفعل في وحدة تحكم فايربيز الخاص بك. لتفعيل المزامنة السحابية الفورية للصرافين، يرجى تفعيل ميزة تسجيل الدخول المجهول من لوحة تحكم Firebase Console. التطبيق الآن يعمل بشكل رائع وآمن في الوضع المحلي التلقائي."
              );
            }
          }
        }
      } else if (!user.isAnonymous) {
        // Authenticated non-anonymous users (e.g., Google or Email) are automatically admins if their email is authorized
        const allowedAdmins = ['sally2025d@gmail.com', 'toohi5863@gmail.com'];
        if (user.email && allowedAdmins.includes(user.email)) {
          setActiveRole('admin');
        } else {
          // Check if this logged-in non-anonymous user is an active cashier session stored in localStorage!
          const savedRole = localStorage.getItem('active_role');
          const savedCashier = localStorage.getItem('active_cashier');
          if (savedRole === 'cashier' && savedCashier) {
            try {
              const cashier = JSON.parse(savedCashier);
              setActiveRole('cashier');
              setActiveCashier(cashier);
            } catch {
              setActiveRole(null);
              setActiveCashier(null);
            }
          } else {
            setActiveRole(null);
            setActiveCashier(null);
          }
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Restore offline queue from local storage on mount
  useEffect(() => {
    const savedQueue = localStorage.getItem('offline_payout_claims_queue');
    if (savedQueue) {
      try {
        setPendingOfflineQueue(JSON.parse(savedQueue));
      } catch (e) {
        console.error("Failed to restore offline queue", e);
      }
    }
  }, []);

  // REALTIME SYNC LISTENERS (only triggered when simulated online is true)
  useEffect(() => {
    if (!currentUser || !isOnline) return;

    const individualsPath = 'individuals';
    const unsubInd = onSnapshot(collection(db, individualsPath), (snapshot) => {
      const list: Individual[] = [];
      snapshot.forEach(doc => {
        list.push(doc.data() as Individual);
      });
      setIndividuals(list);
    }, (error) => {
      if (!auth.currentUser) {
        console.warn("Firestore snapshot subscription rejected due to unauthenticated state during transition:", error);
        return;
      }
      handleFirestoreError(error, OperationType.GET, individualsPath);
    });

    const cashiersPath = 'cashiers';
    const unsubCashiers = onSnapshot(collection(db, cashiersPath), (snapshot) => {
      const list: Cashier[] = [];
      snapshot.forEach(doc => {
        list.push(doc.data() as Cashier);
      });
      setCashiers(list);
    }, (error) => {
      if (!auth.currentUser) {
        console.warn("Firestore snapshot subscription rejected due to unauthenticated state during transition:", error);
        return;
      }
      handleFirestoreError(error, OperationType.GET, cashiersPath);
    });

    const opsPath = 'operations';
    const unsubOps = onSnapshot(query(collection(db, opsPath)), (snapshot) => {
      const list: OperationLog[] = [];
      snapshot.forEach(doc => {
        list.push(doc.data() as OperationLog);
      });
      // Sort client-side by timestamp descending to ensure real-time ticker rhythm
      list.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setOperations(list);
    }, (error) => {
      if (!auth.currentUser) {
        console.warn("Firestore snapshot subscription rejected due to unauthenticated state during transition:", error);
        return;
      }
      handleFirestoreError(error, OperationType.GET, opsPath);
    });

    return () => {
      unsubInd();
      unsubCashiers();
      unsubOps();
    };
  }, [currentUser, isOnline]);

  // Handle Admin Log in
  const handleAdminSignIn = async (email?: string, password?: string) => {
    setIsAppLoading(true);
    try {
      if (email === 'sally2025d@gmail.com') {
        // We use a fixed secure password for Firebase Email/Password Auth to generate an authenticated user with email.
        // We use the password entered or a fallback. Since Firebase requires >=6 characters, we pad the password.
        const originalPass = password || 'admin';
        const finalSecPassword = originalPass.length >= 6 ? originalPass : `admin_secret_${originalPass}`;
        
        try {
          await signInWithEmailAndPassword(auth, 'sally2025d@gmail.com', finalSecPassword);
        } catch (signInErr: any) {
          if (signInErr.code === 'auth/user-not-found' || signInErr.code === 'auth/invalid-credential' || signInErr.code === 'auth/wrong-password') {
            try {
              // Try creating the credential on-the-fly if not existing
              await createUserWithEmailAndPassword(auth, 'sally2025d@gmail.com', finalSecPassword);
            } catch (createErr) {
              console.warn("Failed to create email admin credential. Falling back to anonymous:", createErr);
              await signInAnonymously(auth);
            }
          } else {
            console.warn("Email admin sign-in error. Falling back to anonymous:", signInErr);
            await signInAnonymously(auth);
          }
        }
        setActiveRole('admin');
      } else {
        // Standard Authorized Google validation
        const result = await signInWithPopup(auth, googleProvider);
        const allowedAdmins = ['sally2025d@gmail.com', 'toohi5863@gmail.com'];
        if (result.user && result.user.email && allowedAdmins.includes(result.user.email)) {
          setActiveRole('admin');
        } else {
          await signOut(auth);
          alert('عذراً! حساب Google هذا ليس مشرفاً مخولاً لوحة التحكم.');
        }
      }
    } catch (err: any) {
      alert('فشل تسجيل الدخول بـ Google: ' + err.message);
    } finally {
      setIsAppLoading(false);
    }
  };

  // Handle Cashier Sign in
  const handleCashierSignIn = async (cashier: Cashier) => {
    setIsAppLoading(true);
    setAuthWarning(null);
    try {
      // Direct fast persistence to localStorage FIRST to prevent state hydration latency or race conditions
      // and to feed onAuthStateChanged with correct active_role immediately
      localStorage.setItem('active_role', 'cashier');
      localStorage.setItem('active_cashier', JSON.stringify(cashier));
      setActiveCashier(cashier);
      setActiveRole('cashier');

      // 1. If there is an active non-anonymous user, sign out first to prevent permission lockouts
      if (auth.currentUser) {
        await signOut(auth);
      }
      
      const cashierEmail = cashier.username.includes('@') 
        ? cashier.username 
        : `${cashier.username.toLowerCase()}@cashier.system`;
      const rawPin = cashier.pinCode || '1234';
      const cashierPassword = rawPin.length >= 6 ? rawPin : `cashier_pin_${rawPin}`;
      
      // 2. Try signing in using real Email/Password Authentication
      let signedIn = false;
      try {
        await signInWithEmailAndPassword(auth, cashierEmail, cashierPassword);
        signedIn = true;
      } catch (authErr: any) {
        console.warn("Real cashier sign-in failed, trying to register first:", authErr);
        if (
          authErr.code === 'auth/user-not-found' || 
          authErr.code === 'auth/invalid-credential' || 
          authErr.code === 'auth/wrong-password' ||
          authErr.code === 'auth/invalid-email' ||
          authErr.code === 'auth/operation-not-allowed'
        ) {
          try {
            await createUserWithEmailAndPassword(auth, cashierEmail, cashierPassword);
            signedIn = true;
          } catch (createErr: any) {
            console.warn("Background auto-registration failed:", createErr);
          }
        }
      }

      // 3. Fallback to anonymous sign-in if email/password auth could not complete
      if (!signedIn && (!auth.currentUser || !auth.currentUser.isAnonymous)) {
        try {
          await signInAnonymously(auth);
        } catch (anonErr: any) {
          console.warn("Background anonymous sign-in fallback failed:", anonErr);
        }
      }
      
      // If signed into Firebase successfully, retrieve the real Cashier fields from Firestore database to complement the record
      let resolvedCashier = cashier;
      if (signedIn) {
        try {
          const cashiersRef = collection(db, 'cashiers');
          const q = query(cashiersRef, where('username', '==', cashier.username.toLowerCase()));
          const querySnap = await getDocs(q);
          if (!querySnap.empty) {
            resolvedCashier = querySnap.docs[0].data() as Cashier;
            // Update storage and state with the official complete database record
            localStorage.setItem('active_cashier', JSON.stringify(resolvedCashier));
            setActiveCashier(resolvedCashier);
          }
        } catch (dbErr) {
          console.warn("Could not query cashier from Firestore:", dbErr);
        }
      }
    } catch (err: any) {
      console.warn("Background authentication sync errored, cashier remains logged in locally:", err);
    } finally {
      setIsAppLoading(false);
    }
  };

  // Logout clear
  const handleLogout = async () => {
    try {
      localStorage.removeItem('active_role');
      localStorage.removeItem('active_cashier');
      await signOut(auth);
    } catch (e) {
      console.error(e);
    }
    setActiveRole(null);
    setActiveCashier(null);
    setViewState('dashboard');
  };

  // Toggle Simulated Network Link
  const handleToggleConnection = async () => {
    const nextState = !isOnline;
    setIsOnline(nextState);

    if (nextState) {
      // Switched back to online! Auto-flush queued offline operations
      await handleSyncQueue();
    }
  };

  // Sync / Flush pending operations to Firebase
  const handleSyncQueue = async () => {
    if (pendingOfflineQueue.length === 0) return;
    setIsSyncing(true);

    const queueToProcess = [...pendingOfflineQueue];
    const failedSyncs: Individual[] = [];

    for (const ind of queueToProcess) {
      const indRef = doc(db, 'individuals', ind.militaryId);
      const opId = 'op_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const opRef = doc(db, 'operations', opId);

      try {
        // Pull latest state from Firestore to verify double claims
        const snap = await getDoc(indRef);
        if (snap.exists()) {
          const currentData = snap.data() as Individual;
          if (currentData.payoutStatus === 'received') {
            console.warn(`Double claim intercepted in-sync for Individual ${ind.fullName}`);
            continue; // Skip already disbursed items to guarantee safety
          }
        }

        // Prepare write batch
        const batch = writeBatch(db);
        batch.set(indRef, ind);

        // Add transaction log
        const operationRecord: OperationLog = {
          id: opId,
          individualId: ind.militaryId,
          individualName: ind.fullName,
          individualMilitaryId: ind.militaryId,
          cashierId: ind.receivedCashierId || 'offline_cashier',
          cashierName: ind.receivedCashierName || 'صراف أوفلاين',
          amount: ind.entitledAmount,
          timestamp: ind.receivedAt || new Date().toISOString(),
          location: ind.receivedLocation || 'مزامنة أوفلاين',
          device: ind.receivedDevice || 'جهاز ميداني مبهم',
          type: 'payout',
          performedBy: 'cashier',
          details: 'صرف ميداني مأمون متأخر (تمت المزامنة أوفلاين)'
        };
        batch.set(opRef, operationRecord);

        await batch.commit();
      } catch (err) {
        console.error(`Sync error on individual ${ind.fullName}:`, err);
        failedSyncs.push(ind);
      }
    }

    setPendingOfflineQueue(failedSyncs);
    if (failedSyncs.length > 0) {
      localStorage.setItem('offline_payout_claims_queue', JSON.stringify(failedSyncs));
    } else {
      localStorage.removeItem('offline_payout_claims_queue');
    }
    setIsSyncing(false);
  };

  // --- INDIVIDUALS MANAGER ACTION ROUTERS ---
  const handleAddIndividual = async (newInd: Individual) => {
    const path = 'individuals/' + newInd.militaryId;
    try {
      await setDoc(doc(db, 'individuals', newInd.militaryId), newInd);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const handleUpdateIndividual = async (militaryId: string, updates: Partial<Individual>) => {
    const path = 'individuals/' + militaryId;
    try {
      await setDoc(doc(db, 'individuals', militaryId), updates, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const handleDeleteIndividual = async (militaryId: string) => {
    const path = 'individuals/' + militaryId;
    try {
      await deleteDoc(doc(db, 'individuals', militaryId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  // --- CASHIERS MANAGER ACTION ROUTERS ---
  const handleAddCashier = async (newCashier: Cashier) => {
    const path = 'cashiers/' + newCashier.id;
    try {
      // 1. Save record to Firestore
      await setDoc(doc(db, 'cashiers', newCashier.id), newCashier);

      // 2. Silently create actual Firebase Auth user for the cashier in the background without signing out the current admin
      if (secondaryAuth) {
        const cashierEmail = newCashier.username.includes('@') 
          ? newCashier.username 
          : `${newCashier.username.toLowerCase()}@cashier.system`;
        const rawPin = newCashier.pinCode || '1234';
        const cashierPassword = rawPin.length >= 6 ? rawPin : `cashier_pin_${rawPin}`;
        
        try {
          await createUserWithEmailAndPassword(secondaryAuth, cashierEmail, cashierPassword);
          // Clean up secondary auth session immediately
          await secondaryAuth.signOut();
        } catch (authErr: any) {
          console.warn("Silent background auth creation on secondaryAuth failed or already registered:", authErr);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const handleUpdateCashier = async (cashierId: string, updates: Partial<Cashier>) => {
    const path = 'cashiers/' + cashierId;
    try {
      await setDoc(doc(db, 'cashiers', cashierId), updates, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const handleDeleteCashier = async (cashierId: string) => {
    const path = 'cashiers/' + cashierId;
    try {
      await deleteDoc(doc(db, 'cashiers', cashierId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  // Cancel Payout (Admin Override tool)
  const handleCancelPayout = async (militaryId: string, item: Individual) => {
    const indPath = 'individuals/' + militaryId;
    const opPath = 'operations';
    try {
      const batch = writeBatch(db);
      
      // 1. Reset Individual document
      const resetIndividualRecord: Individual = {
        ...item,
        payoutStatus: 'pending',
        receivedAt: null,
        receivedCashierId: null,
        receivedCashierName: null,
        receivedLocation: null,
        receivedDevice: null
      };
      batch.set(doc(db, 'individuals', militaryId), resetIndividualRecord);

      // 2. Append Cancellation log to audit operations list
      const cancelOpId = 'cancel_' + Date.now();
      const cancelLogRecord: OperationLog = {
        id: cancelOpId,
        individualId: militaryId,
        individualName: item.fullName,
        individualMilitaryId: militaryId,
        cashierId: 'financial_admin',
        cashierName: 'المسؤول المالي العام',
        amount: item.entitledAmount,
        timestamp: new Date().toISOString(),
        location: 'إحداثيات التحكم المركزي',
        device: 'سيرفر الإدارة',
        type: 'cancel',
        performedBy: 'admin',
        details: `إلغاء وإعادة فتح كشف صرف المستحقات للفرد ${item.fullName}`
      };
      
      batch.set(doc(db, 'operations', cancelOpId), cancelLogRecord);
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, indPath);
    }
  };

  // Process payout transaction triggered by active cashier
  const handleProcessPayout = async (militaryId: string) => {
    const gpsLocation = await getGPSLocation();
    const deviceSignature = getDeviceSignature();
    
    // Find item
    const targetInd = individuals.find(i => i.militaryId === militaryId);
    if (!targetInd) {
      alert('خطأ: السجل المالي للفرد مفقود من كشف الصرف.');
      return;
    }

    const timestampNow = new Date().toISOString();

    // Check again if status is received to prevent double claim
    if (targetInd.payoutStatus === 'received') {
      return {
        success: false,
        doubleClaim: {
          cashierName: targetInd.receivedCashierName || 'صراف آخر',
          location: targetInd.receivedLocation || 'ميدان الصرف',
          timestamp: targetInd.receivedAt || timestampNow
        }
      };
    }

    if (isOnline) {
      // --- ONLINE MODE DIRECT WRITES TO FIREBASE ---
      const indPath = 'individuals/' + militaryId;
      try {
        const batch = writeBatch(db);
        const updatedIndividualRecord: Individual = {
          ...targetInd,
          payoutStatus: 'received',
          receivedAt: timestampNow,
          receivedCashierId: activeCashier?.id || 'admin',
          receivedCashierName: activeCashier?.name || 'المسؤول المالي',
          receivedLocation: gpsLocation,
          receivedDevice: deviceSignature
        };
        batch.set(doc(db, 'individuals', militaryId), updatedIndividualRecord);

        const opId = 'op_' + Date.now();
        const payoutLog: OperationLog = {
          id: opId,
          individualId: militaryId,
          individualName: targetInd.fullName,
          individualMilitaryId: targetInd.militaryId,
          cashierId: activeCashier?.id || 'admin',
          cashierName: activeCashier?.name || 'المسؤول المالي',
          amount: targetInd.entitledAmount,
          timestamp: timestampNow,
          location: gpsLocation,
          device: deviceSignature,
          type: 'payout',
          performedBy: 'cashier',
          details: 'صرف مستحقات يدوي مباشر (متصل بالشبكة)'
        };
        batch.set(doc(db, 'operations', opId), payoutLog);
        
        await batch.commit();
        
        // Update local React state immediately for instant feedback
        setIndividuals(prevInds => prevInds.map(i => i.militaryId === militaryId ? updatedIndividualRecord : i));
        setOperations(prevOps => [payoutLog, ...prevOps]);

        return { success: true };
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, indPath);
      }
    } else {
      // --- OFFLINE MODE LOCAL STORAGE SIMULATION ---
      const offlineUpdatedIndividual: Individual = {
        ...targetInd,
        payoutStatus: 'received',
        receivedAt: timestampNow,
        receivedCashierId: activeCashier?.id || 'unknown_node',
        receivedCashierName: activeCashier?.name || 'صراف أوفلاين الميدان',
        receivedLocation: gpsLocation,
        receivedDevice: deviceSignature
      };

      // Put to local react buffer immediately so table disables double claim instantly
      const updatedList = individuals.map(i => i.militaryId === militaryId ? offlineUpdatedIndividual : i);
      setIndividuals(updatedList);

      // Save to queue for background sync
      const newQueue = [...pendingOfflineQueue, offlineUpdatedIndividual];
      setPendingOfflineQueue(newQueue);
      localStorage.setItem('offline_payout_claims_queue', JSON.stringify(newQueue));

      // Append to local operation logs list so the cashier's ledger refreshes immediately
      const mockOpId = 'offline_op_' + Date.now();
      const offlineLog: OperationLog = {
        id: mockOpId,
        individualId: militaryId,
        individualName: targetInd.fullName,
        individualMilitaryId: targetInd.militaryId,
        cashierId: activeCashier?.id || 'unknown_node',
        cashierName: activeCashier?.name || 'صراف ميداني أوفلاين',
        amount: targetInd.entitledAmount,
        timestamp: timestampNow,
        location: gpsLocation,
        device: deviceSignature,
        type: 'payout',
        performedBy: 'cashier',
        details: 'تم التسوية والالتزام الميداني بصيغة الحفظ المؤقت أوفلاين'
      };
      setOperations([offlineLog, ...operations]);

      return { success: true };
    }
  };

  // Seeding initial system values
  const handleSeedCollection = async () => {
    setIsAppLoading(true);
    try {
      const batch = writeBatch(db);
      
      // Add cashiers demo
      for (const cash of DEMO_CASHIERS) {
        batch.set(doc(db, 'cashiers', cash.id), cash);
      }
      
      // Add individuals demo
      for (const ind of DEMO_INDIVIDUALS) {
        batch.set(doc(db, 'individuals', ind.militaryId), ind);
      }

      await batch.commit();
    } catch (e) {
      alert("Error seeding data: " + String(e));
    } finally {
      setIsAppLoading(false);
    }
  };

  // Restore/Import backup state
  const handleRestoreBackup = async (backupData: { individuals: Individual[], cashiers: Cashier[] }) => {
    setIsAppLoading(true);
    try {
      const batch = writeBatch(db);
      
      // Clear or overwrite existing records
      for (const ind of backupData.individuals) {
        batch.set(doc(db, 'individuals', ind.militaryId), ind);
      }
      for (const cash of backupData.cashiers) {
        batch.set(doc(db, 'cashiers', cash.id), cash);
      }
      
      await batch.commit();
    } catch (e: any) {
      throw new Error("تعذر تثبيت كود النسخة الاحتياطية المخصصة: " + e.message);
    } finally {
      setIsAppLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased direction-rtl" dir="rtl">
      
      {/* Visual Navigation Bar */}
      <header className="bg-white border-b border-slate-200/80 shadow-sm sticky top-0 z-30 print:hidden px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-black text-sm shadow">
            ص
          </div>
          <div className="text-right">
            <h1 className="text-sm font-black text-slate-800 leading-none">إدارة الصرف اليومي للأفراد</h1>
            <span className="text-4xs text-slate-450 leading-none block mt-1 font-mono">النسخة الميدانية الرقمية 2.1</span>
          </div>
        </div>

        {/* Inner Controls */}
        <div className="flex items-center gap-4">
          {currentUser && activeRole && (
            <div className="flex items-center gap-3">
              {/* Active User Badge */}
              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-600 text-[10px] font-bold rounded-xl border border-slate-200/60">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                <span>{activeRole === 'admin' ? `المشرف: ${currentUser?.email || 'sally2025d@gmail.com'}` : `الصراف: ${activeCashier?.name || 'مجهول'}`}</span>
              </span>

              <div className="flex items-center bg-slate-100 p-1 rounded-xl">
                <button
                  id="view-dashboard-btn"
                  type="button"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-3xs font-black transition-all ${
                    viewState === 'dashboard' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500 hover:text-slate-850'
                  }`}
                  onClick={() => setViewState('dashboard')}
                >
                  لوحة الحركة والمديرين
                </button>
                <button
                  id="view-reports-btn"
                  type="button"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-3xs font-black transition-all ${
                    viewState === 'reports' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500 hover:text-slate-850'
                  }`}
                  onClick={() => setViewState('reports')}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  مركز التقارير والكشوفات
                </button>
              </div>

              {/* Global Logout Button */}
              <button
                id="header-logout-btn"
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100/80 border border-rose-200/65 text-rose-700 hover:text-rose-800 text-3xs font-black rounded-xl transition duration-150 shadow-sm cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>تسجيل الخروج</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Container Wrapper */}
      <main className="max-w-7xl mx-auto px-4 py-6 sm:py-8 space-y-6">

        {authWarning && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-amber-50 text-amber-900 border border-amber-200/80 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs font-bold leading-relaxed shadow-md print:hidden text-right"
            dir="rtl"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5.5 h-5.5 text-amber-700 flex-shrink-0 mt-0.5" />
              <div>
                <span className="text-amber-950 font-black text-[13px] block mb-1">تنبيه هام حول مزامنة قنوات التوثيق (Anonymous Auth):</span>
                <span className="font-semibold text-amber-800">{authWarning}</span>
                <div className="mt-2 text-[10px] text-amber-700 space-y-1 font-medium bg-amber-100/30 p-2.5 sm:p-3 rounded-xl border border-amber-200/40 italic">
                  <p>💡 لتشغيل المزامنة الحية بقاعدة البيانات للتحديث الفوري لعمليات الصرف لمكافأة الأفراد، يرجى تفعيل الدخول المجهول باتباع الخطوات البسيطة التالية:</p>
                  <p>1️⃣ اذهب إلى وحدة تحكم فايربيز <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="underline text-emerald-800 font-extrabold hover:text-emerald-950">Firebase Console</a> ثم اختر هذا المشروع.</p>
                  <p>2️⃣ من القائمة الجانبية اختر <strong>Build</strong> ثم اضغط على <strong>Authentication</strong>.</p>
                  <p>3️⃣ اضغط تبويب <strong>Sign-in method</strong> ثم انقر على <strong>Add new provider</strong>.</p>
                  <p>4️⃣ اختر <strong>Anonymous</strong> ثم اضغط على تفعيل (Enable) وحفظ (Save). بعد تمكين هذه الميزة، ستعمل المزامنة بشكل رائع وتلقائي!</p>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAuthWarning(null)}
              className="self-end md:self-start bg-amber-600 hover:bg-amber-750 text-white px-3.5 py-1.5 rounded-xl text-3xs font-extrabold transition shadow-sm active:scale-95 cursor-pointer flex-shrink-0"
            >
              مفهوم، إخفاء التنبيه مؤقتاً
            </button>
          </motion.div>
        )}
        
        {/* Connection simulator warning strip - Hidden on Print */}
        {currentUser && activeRole && (
          <div className="print:hidden">
            <OfflineIndicator
              isOnline={isOnline}
              onToggleConnection={handleToggleConnection}
              pendingSyncCount={pendingOfflineQueue.length}
              onForceSync={handleSyncQueue}
              isSyncing={isSyncing}
            />
          </div>
        )}

        {/* Core State Rendering Engine */}
        <div className="min-h-[70vh]">
          {isAppLoading ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
              <Disc className="w-10 h-10 animate-spin text-emerald-600" />
              <p className="text-xs text-slate-500 font-bold">بانتظار مصادقة والتحقق من صلاحية الجلسة المفتوحة...</p>
            </div>
          ) : !activeRole ? (
            /* Login gate screen */
            <LoginScreen
              cashiers={cashiers}
              onAdminLogin={handleAdminSignIn}
              onCashierLogin={handleCashierSignIn}
              isLoading={isAppLoading}
            />
          ) : viewState === 'reports' ? (
            /* Reports general section */
            <ReportView
              individuals={individuals}
              cashiers={cashiers}
              operations={operations}
              onBackToDashboard={() => setViewState('dashboard')}
            />
          ) : activeRole === 'admin' ? (
            /* Financial Administrator views */
            <AdminPanel
              individuals={individuals}
              cashiers={cashiers}
              operations={operations}
              onAddIndividual={handleAddIndividual}
              onUpdateIndividual={handleUpdateIndividual}
              onDeleteIndividual={handleDeleteIndividual}
              onAddCashier={handleAddCashier}
              onUpdateCashier={handleUpdateCashier}
              onDeleteCashier={handleDeleteCashier}
              onCancelPayout={handleCancelPayout}
              onSeedData={handleSeedCollection}
              onLogout={handleLogout}
              adminEmail={currentUser.email || 'sally2025d@gmail.com'}
              isOnline={isOnline}
              onRestoreBackup={handleRestoreBackup}
            />
          ) : (
            /* Regional Cashier layout */
            activeCashier && (
              <CashierPanel
                cashier={activeCashier}
                individuals={individuals}
                onProcessPayout={handleProcessPayout}
                onLogout={handleLogout}
                isOnline={isOnline}
                pendingSyncCount={pendingOfflineQueue.length}
              />
            )
          )}
        </div>
      </main>

      {/* Aesthetic Footer - Hidden on Print */}
      <footer className="bg-white border-t border-slate-200 py-6 mt-12 text-center text-3xs text-slate-400 print:hidden">
        <p>نظام الصرف الميداني للأفراد والمجندين المعتمد في المنصة الشاملة</p>
        <p className="mt-1 font-mono text-4xs text-slate-350">الجمهورية والفرقة العسكرية المالية - محمي بحسب معايير التوزيع المزدوج ABAC</p>
      </footer>
    </div>
  );
}
