"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

interface QrScannerProps {
  onScan: (decodedText: string) => void;
  onError?: (error: string) => void;
}

export default function QrScanner({ onScan, onError }: QrScannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [ready, setReady] = useState(false);
  const [permError, setPermError] = useState("");
  const processedRef = useRef(false);

  useEffect(() => {
    const scannerId = "qr-reader-" + Date.now();
    if (!containerRef.current) return;
    containerRef.current.id = scannerId;

    const scanner = new Html5Qrcode(scannerId);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1 },
        (decodedText) => {
          if (processedRef.current) return;
          processedRef.current = true;
          scanner.stop().catch(() => {});
          onScan(decodedText);
        },
        () => {}
      )
      .then(() => setReady(true))
      .catch((err) => {
        const msg = typeof err === "string" ? err : err?.message || "ไม่สามารถเข้าถึงกล้องได้";
        setPermError(msg);
        onError?.(msg);
      });

    return () => {
      scanner.stop().catch(() => {});
    };
  }, []);

  return (
    <div className="relative">
      {permError ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10 text-red-400 mx-auto mb-2">
            <path d="M18 10.48V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-4.48l4 3.98v-11l-4 3.98zm-2-.79V18H4V6h12v3.69z" />
          </svg>
          <p className="text-sm text-red-600 font-medium">ไม่สามารถเปิดกล้องได้</p>
          <p className="text-xs text-red-500 mt-1">{permError}</p>
          <p className="text-xs text-gray-500 mt-2">กรุณาอนุญาตให้เข้าถึงกล้อง หรือใช้ &quot;กรอกรหัส&quot; แทน</p>
        </div>
      ) : (
        <>
          <div
            ref={containerRef}
            className="rounded-xl overflow-hidden bg-black"
            style={{ minHeight: 280 }}
          />
          {!ready && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-xl">
              <div className="text-center">
                <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-white text-sm">กำลังเปิดกล้อง...</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
