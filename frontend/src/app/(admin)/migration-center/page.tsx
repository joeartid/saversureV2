"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

type ModuleKey = "customer" | "product" | "rewards" | "scan_history" | "redeem_history";

interface SourceConfig {
  label: string;
  host: string;
  port: number;
  database: string;
  user: string;
  sslmode: string;
  has_password: boolean;
}

interface JobOptions {
  chunk_size: number;
}

interface MigrationJob {
  id: string;
  mode: "dry_run" | "execute";
  status: string;
  selected_modules: string[];
  current_module?: string | null;
  current_step?: string | null;
  total_items: number;
  processed_items: number;
  success_count: number;
  failed_count: number;
  warning_count: number;
  percent: number;
  last_error?: string | null;
  created_at: string;
  started_at?: string | null;
  finished_at?: string | null;
  report?: Record<string, unknown>;
  options: JobOptions;
  requested_by_name?: string | null;
}

interface MigrationModule {
  id: string;
  module_name: string;
  status: string;
  current_step?: string | null;
  estimated_count: number;
  processed_count: number;
  success_count: number;
  failed_count: number;
  warning_count: number;
  percent: number;
  warnings: string[];
  summary: Record<string, unknown>;
}

interface MigrationError {
  id: string;
  module_name: string;
  source_entity_type?: string | null;
  source_id?: string | null;
  message: string;
  created_at: string;
}

interface JobDetailResponse {
  job: MigrationJob;
  modules: MigrationModule[];
  errors: MigrationError[];
}

const moduleOptions: Array<{ key: ModuleKey; label: string; hint: string }> = [
  { key: "customer", label: "Customer", hint: "ย้ายลูกค้า, ที่อยู่ และยอดคงเหลือปัจจุบัน" },
  { key: "product", label: "Product", hint: "ย้ายสินค้าแบบ idempotent โดยไม่ลบข้อมูลเดิม" },
  { key: "rewards", label: "Rewards", hint: "ย้าย reward master, inventory และ coupon pool ที่ยังใช้ได้" },
  { key: "scan_history", label: "Scan History", hint: "ย้ายประวัติการสแกนแบบ historical snapshot" },
  { key: "redeem_history", label: "Redeem History", hint: "ย้ายประวัติการแลกแบบ snapshot เพื่อให้ลูกค้าเห็นย้อนหลังได้ต่อเนื่อง" },
];

const dependencyMap: Record<ModuleKey, ModuleKey[]> = {
  customer: [],
  product: [],
  rewards: [],
  scan_history: ["customer"],
  redeem_history: ["customer", "rewards"],
};

function formatDate(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("th-TH");
}

function statusTone(status: string): string {
  switch (status) {
    case "completed":
      return "bg-[#e8f5e9] text-[#2e7d32]";
    case "running":
      return "bg-[#e3f2fd] text-[#1565c0]";
    case "failed":
      return "bg-[#ffebee] text-[#c62828]";
    case "cancelled":
      return "bg-[#f5f5f5] text-[#616161]";
    default:
      return "bg-[#fff8e1] text-[#ef6c00]";
  }
}

export default function MigrationCenterPage() {
  const [sourceConfig, setSourceConfig] = useState<SourceConfig | null>(null);
  const [jobs, setJobs] = useState<MigrationJob[]>([]);
  const [detail, setDetail] = useState<JobDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedModules, setSelectedModules] = useState<ModuleKey[]>(["customer"]);
  const [mode, setMode] = useState<"dry_run" | "execute">("dry_run");
  const [chunkSize, setChunkSize] = useState(1000);
  const [selectedJobID, setSelectedJobID] = useState<string | null>(null);
  const [error, setError] = useState("");

  const resolvedModules = useMemo(() => {
    const set = new Set<ModuleKey>();
    selectedModules.forEach((moduleKey) => {
      dependencyMap[moduleKey].forEach((dependency) => set.add(dependency));
      set.add(moduleKey);
    });
    return moduleOptions.filter((item) => set.has(item.key)).map((item) => item.key);
  }, [selectedModules]);

  const activeJobID = detail?.job.status === "running" || detail?.job.status === "queued"
    ? detail.job.id
    : selectedJobID;

  const fetchJobs = async (keepDetail = true) => {
    try {
      const [config, list] = await Promise.all([
        api.get<SourceConfig>("/api/v1/migration-jobs/config/source"),
        api.get<{ data: MigrationJob[]; total: number }>("/api/v1/migration-jobs?limit=20&offset=0"),
      ]);
      setSourceConfig(config);
      setJobs(list.data || []);
      const nextSelectedID = keepDetail
        ? selectedJobID || list.data?.[0]?.id || null
        : list.data?.[0]?.id || null;
      if (nextSelectedID && nextSelectedID !== selectedJobID) {
        setSelectedJobID(nextSelectedID);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดข้อมูล migration center ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const fetchDetail = async (jobID: string) => {
    try {
      const response = await api.get<JobDetailResponse>(`/api/v1/migration-jobs/${jobID}`);
      setDetail(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดรายละเอียด job ไม่สำเร็จ");
    }
  };

  useEffect(() => {
    fetchJobs(false);
  }, []);

  useEffect(() => {
    if (!selectedJobID) return;
    fetchDetail(selectedJobID);
  }, [selectedJobID]);

  useEffect(() => {
    if (!activeJobID) return;
    const activeStatus = detail?.job.status;
    if (activeStatus !== "running" && activeStatus !== "queued") return;
    const timer = window.setInterval(() => {
      fetchJobs();
      fetchDetail(activeJobID);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [activeJobID, detail?.job.status]);

  const toggleModule = (moduleKey: ModuleKey) => {
    setSelectedModules((prev) => (
      prev.includes(moduleKey)
        ? prev.filter((item) => item !== moduleKey)
        : [...prev, moduleKey]
    ));
  };

  const handleCreateJob = async () => {
    if (resolvedModules.length === 0) {
      alert("กรุณาเลือกอย่างน้อย 1 module");
      return;
    }
    if (mode === "execute") {
      const confirmed = confirm("คุณกำลังจะรัน migration จริง ระบบจะแก้ข้อมูลใน V2 ต่อเมื่อ source และ mapping พร้อมแล้ว ต้องการดำเนินการต่อหรือไม่?");
      if (!confirmed) return;
    }
    setSubmitting(true);
    try {
      const created = await api.post<MigrationJob>("/api/v1/migration-jobs", {
        modules: resolvedModules,
        mode,
        chunk_size: chunkSize,
      });
      setSelectedJobID(created.id);
      setDetail(null);
      await fetchJobs();
      await fetchDetail(created.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "สร้าง migration job ไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!detail?.job.id) return;
    await api.post(`/api/v1/migration-jobs/${detail.job.id}/cancel`, {});
    await fetchJobs();
    await fetchDetail(detail.job.id);
  };

  const handleRetry = async () => {
    if (!detail?.job.id) return;
    const created = await api.post<MigrationJob>(`/api/v1/migration-jobs/${detail.job.id}/retry`, {});
    setSelectedJobID(created.id);
    await fetchJobs();
    await fetchDetail(created.id);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-3 border-[var(--md-primary)] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-normal text-[var(--md-on-surface)] tracking-[-0.5px]">Migration Center</h1>
          <p className="text-[14px] text-[var(--md-on-surface-variant)] mt-1">
            จัดการ migration จาก Saversure V1 ไป V2 แบบเลือกโดเมน, dry run ก่อน, และติดตาม progress ได้จากหน้าเดียว
          </p>
        </div>
        <button
          onClick={() => {
            fetchJobs();
            if (selectedJobID) fetchDetail(selectedJobID);
          }}
          className="h-[40px] px-5 border border-[var(--md-outline-variant)] text-[var(--md-on-surface)] rounded-[var(--md-radius-xl)] text-[14px] font-medium hover:bg-[var(--md-surface-dim)] transition-all"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-[var(--md-radius-lg)] bg-[#ffebee] px-4 py-3 text-[13px] text-[#c62828]">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-6">
        <div className="space-y-6">
          <section className="bg-[var(--md-surface)] rounded-[var(--md-radius-xl)] md-elevation-1 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-[18px] font-medium text-[var(--md-on-surface)]">Source Connection</h2>
                <p className="text-[13px] text-[var(--md-on-surface-variant)] mt-1">แสดงค่า V1 connection แบบ read-only โดย secret ยังอยู่ใน env เท่านั้น</p>
              </div>
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-[12px] font-medium ${sourceConfig?.has_password ? "bg-[#e8f5e9] text-[#2e7d32]" : "bg-[#fff8e1] text-[#ef6c00]"}`}>
                {sourceConfig?.has_password ? "Secret พร้อม" : "ยังไม่พบ password"}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                ["Source", sourceConfig?.label || "-"],
                ["Host", sourceConfig?.host || "-"],
                ["Port", String(sourceConfig?.port || "-")],
                ["Database", sourceConfig?.database || "-"],
                ["User", sourceConfig?.user || "-"],
                ["SSL Mode", sourceConfig?.sslmode || "-"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-[var(--md-radius-md)] border border-[var(--md-outline-variant)] px-4 py-3 bg-[var(--md-surface-container)]">
                  <p className="text-[11px] uppercase tracking-[0.4px] text-[var(--md-on-surface-variant)]">{label}</p>
                  <p className="text-[14px] font-medium text-[var(--md-on-surface)] mt-1">{value}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-[var(--md-surface)] rounded-[var(--md-radius-xl)] md-elevation-1 p-6">
            <h2 className="text-[18px] font-medium text-[var(--md-on-surface)]">Create Migration Job</h2>
            <p className="text-[13px] text-[var(--md-on-surface-variant)] mt-1">Dry Run เป็นค่าเริ่มต้น เพื่อเช็ค source, mapping, blockers และ estimated rows ก่อน execute จริง</p>

            <div className="mt-5 grid grid-cols-1 gap-3">
              {moduleOptions.map((item) => {
                const selected = selectedModules.includes(item.key);
                const autoIncluded = !selected && resolvedModules.includes(item.key);
                return (
                  <label
                    key={item.key}
                    className={`flex items-start gap-3 rounded-[var(--md-radius-lg)] border px-4 py-3 transition-all ${selected || autoIncluded ? "border-[var(--md-primary)] bg-[var(--md-primary-light)]" : "border-[var(--md-outline-variant)] hover:border-[var(--md-primary)]"}`}
                  >
                    <input
                      type="checkbox"
                      checked={selected || autoIncluded}
                      disabled={autoIncluded}
                      onChange={() => toggleModule(item.key)}
                      className="mt-1 h-4 w-4"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-[14px] font-medium text-[var(--md-on-surface)]">{item.label}</p>
                        {autoIncluded && (
                          <span className="rounded-full bg-[var(--md-surface)] px-2 py-0.5 text-[11px] text-[var(--md-primary)]">
                            dependency
                          </span>
                        )}
                      </div>
                      <p className="text-[12px] text-[var(--md-on-surface-variant)] mt-1">{item.hint}</p>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
              <div className="rounded-[var(--md-radius-lg)] border border-[var(--md-outline-variant)] px-4 py-3">
                <p className="text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-2">Execution Mode</p>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 text-[13px] text-[var(--md-on-surface)]">
                    <input type="radio" checked={mode === "dry_run"} onChange={() => setMode("dry_run")} />
                    Dry Run
                  </label>
                  <label className="flex items-center gap-2 text-[13px] text-[var(--md-on-surface)]">
                    <input type="radio" checked={mode === "execute"} onChange={() => setMode("execute")} />
                    Execute
                  </label>
                </div>
              </div>

              <div className="rounded-[var(--md-radius-lg)] border border-[var(--md-outline-variant)] px-4 py-3">
                <p className="text-[12px] font-medium text-[var(--md-on-surface-variant)] mb-2">Chunk Size</p>
                <input
                  type="number"
                  min={100}
                  max={5000}
                  step={100}
                  value={chunkSize}
                  onChange={(e) => setChunkSize(Number(e.target.value || 1000))}
                  className="w-full h-[40px] rounded-[var(--md-radius-sm)] border border-[var(--md-outline)] px-3 text-[14px] bg-transparent outline-none focus:border-[var(--md-primary)]"
                />
              </div>
            </div>

            <div className="rounded-[var(--md-radius-lg)] bg-[var(--md-surface-container)] px-4 py-3 mt-4">
              <p className="text-[12px] uppercase tracking-[0.4px] text-[var(--md-on-surface-variant)]">Resolved order</p>
              <p className="text-[14px] text-[var(--md-on-surface)] mt-1">
                {resolvedModules.length > 0 ? resolvedModules.join(" -> ") : "-"}
              </p>
              <p className="text-[12px] text-[var(--md-on-surface-variant)] mt-2">
                `redeem_history` จะดึง `customer` และ `rewards` มาด้วยอัตโนมัติ ส่วน `scan_history` ต้องมี `customer`
              </p>
            </div>

            <div className="flex items-center justify-between gap-4 mt-5">
              <p className={`text-[13px] ${mode === "execute" ? "text-[#c62828]" : "text-[var(--md-on-surface-variant)]"}`}>
                {mode === "execute"
                  ? "โหมด Execute จะสร้างหรืออัปเดตข้อมูลใน V2 จริง"
                  : "โหมด Dry Run จะ validate source และสรุป estimated rows โดยไม่เขียนข้อมูล"}
              </p>
              <button
                onClick={handleCreateJob}
                disabled={submitting || resolvedModules.length === 0}
                className="h-[42px] px-5 rounded-[var(--md-radius-xl)] bg-[var(--md-primary)] text-white text-[14px] font-medium hover:bg-[var(--md-primary-dark)] disabled:opacity-50 transition-all"
              >
                {submitting ? "กำลังสร้าง job..." : mode === "dry_run" ? "Run Dry Run" : "Run Migration"}
              </button>
            </div>
          </section>

          <section className="bg-[var(--md-surface)] rounded-[var(--md-radius-xl)] md-elevation-1 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-[18px] font-medium text-[var(--md-on-surface)]">Job History</h2>
                <p className="text-[13px] text-[var(--md-on-surface-variant)] mt-1">งานล่าสุด 20 รายการ</p>
              </div>
            </div>
            <div className="space-y-3">
              {jobs.map((job) => (
                <button
                  key={job.id}
                  onClick={() => setSelectedJobID(job.id)}
                  className={`w-full text-left rounded-[var(--md-radius-lg)] border px-4 py-3 transition-all ${selectedJobID === job.id ? "border-[var(--md-primary)] bg-[var(--md-primary-light)]" : "border-[var(--md-outline-variant)] hover:border-[var(--md-primary)]"}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[14px] font-medium text-[var(--md-on-surface)]">
                        {job.selected_modules.join(", ")}
                      </p>
                      <p className="text-[12px] text-[var(--md-on-surface-variant)] mt-1">
                        {job.mode} · chunk {job.options?.chunk_size || "-"} · {formatDate(job.created_at)}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-[12px] font-medium ${statusTone(job.status)}`}>
                      {job.status}
                    </span>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-[var(--md-surface-container)] overflow-hidden">
                    <div className="h-full rounded-full bg-[var(--md-primary)]" style={{ width: `${Math.max(job.percent || 0, 2)}%` }} />
                  </div>
                </button>
              ))}
              {jobs.length === 0 && (
                <div className="rounded-[var(--md-radius-lg)] border border-dashed border-[var(--md-outline-variant)] px-4 py-6 text-[13px] text-[var(--md-on-surface-variant)] text-center">
                  ยังไม่มี migration job
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="bg-[var(--md-surface)] rounded-[var(--md-radius-xl)] md-elevation-1 p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[18px] font-medium text-[var(--md-on-surface)]">Job Detail</h2>
                <p className="text-[13px] text-[var(--md-on-surface-variant)] mt-1">
                  {detail?.job.id ? `Job ID: ${detail.job.id}` : "เลือก job จากรายการด้านซ้าย"}
                </p>
              </div>
              {detail?.job && (
                <div className="flex gap-2">
                  {(detail.job.status === "running" || detail.job.status === "queued") && (
                    <button
                      onClick={handleCancel}
                      className="h-[36px] px-4 rounded-[var(--md-radius-xl)] border border-[#c62828] text-[#c62828] text-[13px] font-medium hover:bg-[#ffebee] transition-all"
                    >
                      Cancel
                    </button>
                  )}
                  {(detail.job.status === "failed" || detail.job.status === "cancelled") && (
                    <button
                      onClick={handleRetry}
                      className="h-[36px] px-4 rounded-[var(--md-radius-xl)] bg-[var(--md-primary)] text-white text-[13px] font-medium hover:bg-[var(--md-primary-dark)] transition-all"
                    >
                      Retry
                    </button>
                  )}
                </div>
              )}
            </div>

            {detail?.job ? (
              <>
                <div className="grid grid-cols-2 gap-3 mt-4">
                  {[
                    ["Mode", detail.job.mode],
                    ["Status", detail.job.status],
                    ["Requested By", detail.job.requested_by_name || "-"],
                    ["Current Module", detail.job.current_module || "-"],
                    ["Current Step", detail.job.current_step || "-"],
                    ["Started At", formatDate(detail.job.started_at)],
                    ["Finished At", formatDate(detail.job.finished_at)],
                    ["Progress", `${(detail.job.percent || 0).toFixed(1)}%`],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-[var(--md-radius-md)] bg-[var(--md-surface-container)] px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.4px] text-[var(--md-on-surface-variant)]">{label}</p>
                      <p className="text-[14px] text-[var(--md-on-surface)] mt-1">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 h-3 rounded-full bg-[var(--md-surface-container)] overflow-hidden">
                  <div className="h-full rounded-full bg-[var(--md-primary)] transition-all" style={{ width: `${Math.max(detail.job.percent || 0, 2)}%` }} />
                </div>

                <div className="grid grid-cols-3 gap-3 mt-4">
                  {[
                    ["Processed", detail.job.processed_items],
                    ["Success", detail.job.success_count],
                    ["Failed", detail.job.failed_count],
                    ["Warnings", detail.job.warning_count],
                    ["Estimated", detail.job.total_items],
                    ["Selected", detail.job.selected_modules.length],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-[var(--md-radius-md)] border border-[var(--md-outline-variant)] px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.4px] text-[var(--md-on-surface-variant)]">{label}</p>
                      <p className="text-[18px] font-medium text-[var(--md-on-surface)] mt-1">{String(value)}</p>
                    </div>
                  ))}
                </div>

                {detail.job.last_error && (
                  <div className="mt-4 rounded-[var(--md-radius-lg)] bg-[#ffebee] px-4 py-3 text-[13px] text-[#c62828]">
                    {detail.job.last_error}
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-[var(--md-radius-lg)] border border-dashed border-[var(--md-outline-variant)] px-4 py-8 text-[13px] text-[var(--md-on-surface-variant)] text-center mt-4">
                เลือก job เพื่อดู progress, errors และ summary
              </div>
            )}
          </section>

          {detail?.modules && (
            <section className="bg-[var(--md-surface)] rounded-[var(--md-radius-xl)] md-elevation-1 p-6">
              <h2 className="text-[18px] font-medium text-[var(--md-on-surface)]">Modules</h2>
              <div className="space-y-4 mt-4">
                {detail.modules.map((moduleItem) => (
                  <div key={moduleItem.id} className="rounded-[var(--md-radius-lg)] border border-[var(--md-outline-variant)] px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[14px] font-medium text-[var(--md-on-surface)]">{moduleItem.module_name}</p>
                        <p className="text-[12px] text-[var(--md-on-surface-variant)] mt-1">{moduleItem.current_step || "-"}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-[12px] font-medium ${statusTone(moduleItem.status)}`}>
                        {moduleItem.status}
                      </span>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-[var(--md-surface-container)] overflow-hidden">
                      <div className="h-full rounded-full bg-[var(--md-primary)]" style={{ width: `${Math.max(moduleItem.percent || 0, 2)}%` }} />
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div className="text-[12px] text-[var(--md-on-surface-variant)]">
                        processed {moduleItem.processed_count} / {moduleItem.estimated_count}
                      </div>
                      <div className="text-[12px] text-[var(--md-on-surface-variant)] text-right">
                        success {moduleItem.success_count} · failed {moduleItem.failed_count} · warning {moduleItem.warning_count}
                      </div>
                    </div>
                    {moduleItem.warnings?.length > 0 && (
                      <div className="mt-3 rounded-[var(--md-radius-md)] bg-[#fff8e1] px-3 py-2">
                        {moduleItem.warnings.slice(0, 5).map((warning) => (
                          <p key={warning} className="text-[12px] text-[#ef6c00]">{warning}</p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {detail?.errors && detail.errors.length > 0 && (
            <section className="bg-[var(--md-surface)] rounded-[var(--md-radius-xl)] md-elevation-1 p-6">
              <h2 className="text-[18px] font-medium text-[var(--md-on-surface)]">Recent Errors</h2>
              <div className="space-y-3 mt-4">
                {detail.errors.map((item) => (
                  <div key={item.id} className="rounded-[var(--md-radius-lg)] bg-[#ffebee] px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[13px] font-medium text-[#c62828]">
                        {item.module_name}
                        {item.source_entity_type ? ` · ${item.source_entity_type}` : ""}
                        {item.source_id ? ` · ${item.source_id}` : ""}
                      </p>
                      <p className="text-[11px] text-[#c62828]">{formatDate(item.created_at)}</p>
                    </div>
                    <p className="text-[12px] text-[#c62828] mt-1">{item.message}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
