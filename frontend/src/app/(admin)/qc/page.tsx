"use client";

import { useState } from "react";
import { api } from "@/lib/api";

interface VerifyResult {
  valid: boolean;
  checksum_ok: boolean;
  batch_id?: string;
  batch_prefix?: string;
  campaign_id?: string;
  serial?: number;
  ref2?: string;
  status?: string;
  product_name?: string;
  roll_id?: string;
  roll_number?: number;
  roll_status?: string;
  roll_product_name?: string;
  message?: string;
}

export default function QCVerifyPage() {
  const [ref2, setRef2] = useState("");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ref2.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const data = await api.get<VerifyResult>(`/api/v1/qc/verify?ref2=${encodeURIComponent(ref2.trim())}`);
      setResult(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Verification failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setRef2("");
    setResult(null);
    setError("");
  };

  return (
    <div className="max-w-[480px] mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-[var(--md-radius-xl)] bg-[var(--md-primary-light)] mb-4">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-[var(--md-primary)]">
            <path d="M9.5 6.5v3h-3v-3h3M11 5H5v6h6V5zm-1.5 9.5v3h-3v-3h3M11 13H5v6h6v-6zm6.5-6.5v3h-3v-3h3M19 5h-6v6h6V5zm-6 8h1.5v1.5H13V13zm1.5 1.5H16V16h-1.5v-1.5zM16 13h1.5v1.5H16V13zm-3 3h1.5v1.5H13V16zm1.5 1.5H16V19h-1.5v-1.5zM16 16h1.5v1.5H16V16zm1.5-1.5H19V16h-1.5v-1.5zm0 3H19V19h-1.5v-1.5zM22 7h-2V4h-3V2h5v5zm0 15v-5h-2v3h-3v2h5zM2 22h5v-2H4v-3H2v5zM2 2v5h2V4h3V2H2z" />
          </svg>
        </div>
        <h1 className="text-[24px] font-normal text-[var(--md-on-surface)] tracking-[-0.5px]">
          QC Verify
        </h1>
        <p className="text-[14px] text-[var(--md-on-surface-variant)] mt-1">
          ตรวจสอบ ref2 บนสติกเกอร์
        </p>
      </div>

      {/* Input */}
      <div className="bg-[var(--md-surface)] rounded-[var(--md-radius-xl)] md-elevation-2 p-6 mb-6">
        <form onSubmit={handleVerify}>
          <label className="block text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-2 tracking-[0.4px] uppercase">
            Ref2 Code
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              value={ref2}
              onChange={(e) => setRef2(e.target.value)}
              placeholder="ใส่เลข ref2 13 หลัก"
              autoFocus
              className="
                flex-1 h-[56px] px-5 border border-[var(--md-outline)]
                rounded-[var(--md-radius-md)] text-[18px] font-mono text-[var(--md-on-surface)]
                bg-transparent outline-none text-center tracking-[2px]
                focus:border-[var(--md-primary)] focus:border-2
                transition-all duration-200
              "
            />
          </div>
          <div className="flex gap-3 mt-4">
            <button
              type="submit"
              disabled={loading || !ref2.trim()}
              className="
                flex-1 h-[48px] bg-[var(--md-primary)] text-white
                rounded-[var(--md-radius-xl)] text-[14px] font-medium
                tracking-[0.1px]
                hover:bg-[var(--md-primary-dark)]
                disabled:opacity-60 disabled:cursor-not-allowed
                active:scale-[0.98] transition-all duration-200
              "
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Verifying...
                </span>
              ) : "Verify"}
            </button>
            {(result || error) && (
              <button
                type="button"
                onClick={handleClear}
                className="h-[48px] px-5 text-[var(--md-on-surface-variant)] bg-[var(--md-surface-container)] rounded-[var(--md-radius-xl)] text-[14px] font-medium hover:bg-[var(--md-surface-container-high)] transition-all duration-200"
              >
                Clear
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-[var(--md-error-light)] rounded-[var(--md-radius-lg)] p-5 mb-6">
          <div className="flex items-center gap-3">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-[var(--md-error)] flex-shrink-0">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
            </svg>
            <div>
              <p className="text-[14px] font-medium text-[var(--md-error)]">Verification Failed</p>
              <p className="text-[13px] text-[var(--md-error)] mt-0.5 opacity-80">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className={`rounded-[var(--md-radius-lg)] p-5 ${result.valid ? "bg-[var(--md-success-light)]" : "bg-[var(--md-error-light)]"}`}>
          <div className="flex items-center gap-3 mb-4">
            {result.valid ? (
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10 text-[var(--md-success)]">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10 text-[var(--md-error)]">
                <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z" />
              </svg>
            )}
            <div>
              <p className={`text-[18px] font-medium ${result.valid ? "text-[var(--md-success)]" : "text-[var(--md-error)]"}`}>
                {result.valid ? "Valid" : "Invalid"}
              </p>
              <p className={`text-[13px] mt-0.5 opacity-80 ${result.valid ? "text-[var(--md-success)]" : "text-[var(--md-error)]"}`}>
                {result.checksum_ok ? "Checksum OK" : "Checksum Failed"}
              </p>
            </div>
          </div>

          {result.valid && result.batch_id && (
            <div className="bg-white/60 rounded-[var(--md-radius-md)] p-4 space-y-2">
              <div className="flex justify-between text-[13px]">
                <span className="text-[var(--md-on-surface-variant)]">Batch</span>
                <span className="font-mono font-medium text-[var(--md-on-surface)]">{result.batch_prefix}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-[var(--md-on-surface-variant)]">Serial</span>
                <span className="font-mono font-medium text-[var(--md-on-surface)]">{result.serial?.toLocaleString()}</span>
              </div>
              {result.product_name && (
                <div className="flex justify-between text-[13px]">
                  <span className="text-[var(--md-on-surface-variant)]">Campaign</span>
                  <span className="font-medium text-[var(--md-on-surface)]">{result.product_name}</span>
                </div>
              )}
              <div className="flex justify-between text-[13px]">
                <span className="text-[var(--md-on-surface-variant)]">Batch Status</span>
                <span className="font-medium text-[var(--md-on-surface)] capitalize">{result.status}</span>
              </div>
              {result.roll_number != null && (
                <>
                  <div className="h-px bg-black/10 my-1" />
                  <div className="flex justify-between text-[13px]">
                    <span className="text-[var(--md-on-surface-variant)]">Roll #</span>
                    <span className="font-mono font-medium text-[var(--md-on-surface)]">{result.batch_prefix} #{result.roll_number}</span>
                  </div>
                  {result.roll_product_name && (
                    <div className="flex justify-between text-[13px]">
                      <span className="text-[var(--md-on-surface-variant)]">สินค้า (Map)</span>
                      <span className="font-medium text-[var(--md-on-surface)]">{result.roll_product_name}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-[13px]">
                    <span className="text-[var(--md-on-surface-variant)]">Roll Status</span>
                    <span className="font-medium text-[var(--md-on-surface)] capitalize">{result.roll_status}</span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
