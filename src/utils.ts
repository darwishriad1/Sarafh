/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Gets GPS Coordinates of Cashier with tactical fallback if browser permission is blocked
 */
export function getGPSLocation(): Promise<string> {
  return new Promise((resolve) => {
    if (typeof navigator !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve(`${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}`);
        },
        () => {
          // Tactical military command coordinates around Central Region (Riyadh, Saudi Arabia)
          const lat = (24.71361 + (Math.random() - 0.5) * 0.02).toFixed(5);
          const lng = (46.67528 + (Math.random() - 0.5) * 0.02).toFixed(5);
          resolve(`${lat}, ${lng} (محاكي الميدان GPS)`);
        },
        { timeout: 3000 }
      );
    } else {
      resolve("24.71361, 46.67528 (إحداثي افتراضي)");
    }
  });
}

/**
 * Detects device signature for administrative audit logs
 */
export function getDeviceSignature(): string {
  if (typeof window === 'undefined') return 'unknown';
  const ua = window.navigator.userAgent;
  let device = "ميداني غامض";
  if (/android/i.test(ua)) {
    device = "جهاز Android ميداني";
  } else if (/iPad|iPhone|iPod/.test(ua)) {
    device = "جهاز iOS متنقل";
  } else if (/Macintosh/.test(ua)) {
    device = "حاسب محمول macOS";
  } else if (/Windows/.test(ua)) {
    device = "محطة عمل Windows";
  } else if (/Linux/.test(ua)) {
    device = "جهاز عمل Linux";
  }
  return device;
}

/**
 * Exports data grid to UTF-8 Arabic compliant CSV for Microsoft Excel
 */
export function exportToCSV(data: string[][], headers: string[], filename: string) {
  // UTF-8 BOM indicator (\uFEFF) forces Excel to interpret Arabic characters correctly
  const csvContent = "\uFEFF" + [
    headers.join(","),
    ...data.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Formats currency to Arabic Saudi Riyal format
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(amount);
}

/**
 * Formats time to readable Arabic date-time
 */
export function formatDateTime(isoString: string | null | undefined): string {
  if (!isoString) return 'غير محدد';
  try {
    const d = new Date(isoString);
    return d.toLocaleString('ar-SA', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  } catch {
    return String(isoString);
  }
}

/**
 * Generates an elegant high-fidelity sound chime using Web Audio API
 * replicates professional bank notification clicks or alerts
 */
export function playBankChime(type: 'success' | 'alert' | 'cancel' | 'ping') {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    if (ctx.state === 'suspended') {
      // In browsers, we cannot resume the context without user gesture.
      // But since it is triggered by clicks/actions inside the app, it works perfectly.
      ctx.resume();
    }

    if (type === 'success') {
      // Dual bank deposit success bell (favorable C Major)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc1.frequency.setValueAtTime(659.25, ctx.currentTime + 0.12); // E5
      
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1046.50, ctx.currentTime); // C6
      osc2.frequency.setValueAtTime(1318.51, ctx.currentTime + 0.12); // E6
      
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);
      
      osc1.start();
      osc2.start();
      osc1.stop(ctx.currentTime + 0.5);
      osc2.stop(ctx.currentTime + 0.5);
    } else if (type === 'ping') {
      // Gentle bank notification alert ping (high G bell)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1567.98, ctx.currentTime); // G6
      
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } else if (type === 'cancel') {
      // Clean administrative error sliding tone (descending warning)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(329.63, ctx.currentTime); // E4
      osc.frequency.setValueAtTime(220.00, ctx.currentTime + 0.15); // A3
      
      gain.gain.setValueAtTime(0.07, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } else if (type === 'alert') {
      // Dual danger warning tone
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch (e) {
    console.warn("Web Audio API not supported or suspended by browser sandbox rules:", e);
  }
}

