"use client";
import { useRef, useState } from "react";
import { Download, FileText, LoaderCircle } from "lucide-react";
import type { OfficialReportDetails, TransferReport } from "@/lib/report-data";
import type { ReportFormat } from "@/lib/report-export";

export function ReportDownload({
  buildReport,
  disabled = false,
}: {
  buildReport: () => TransferReport | Promise<TransferReport>;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState<ReportFormat | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [official, setOfficial] = useState<OfficialReportDetails>({});
  const inFlight = useRef(false);
  async function download(format: ReportFormat) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(format);
    setError("");
    setMessage("กำลังจัดทำเอกสาร กรุณารอสักครู่");
    try {
      // Snapshot the current filter/scope before loading the exporters.
      const details = { ...official };
      const report = { ...(await buildReport()), official: details };
      const { downloadReport } = await import("@/lib/report-export");
      await downloadReport(report, format);
      setMessage(
        `จัดทำ ${format === "pdf" ? "PDF" : "Word"} แล้ว กรุณาดูไฟล์ในรายการดาวน์โหลด`,
      );
    } catch (e) {
      setMessage("");
      setError(
        e instanceof Error
          ? e.message
          : "จัดทำเอกสารไม่สำเร็จ กรุณาลองอีกครั้ง",
      );
    } finally {
      setBusy(null);
      inFlight.current = false;
    }
  }
  return (
    <div className="report-download no-print">
      <details className="report-official-details">
        <summary>ข้อมูลประกอบเอกสารราชการ</summary>
        <p>
          กรอกเพื่อแสดงในรายงาน หากเว้นว่างจะมีช่องให้กรอกภายหลัง
          ข้อมูลนี้ใช้เฉพาะไฟล์ที่ดาวน์โหลด
        </p>
        <fieldset disabled={!!busy}>
          <legend className="sr-only">ข้อมูลผู้จัดทำรายงาน</legend>
          {(
            [
              ["organization", "สถานศึกษา / หน่วยงาน", 160],
              ["department", "งาน / ฝ่าย", 120],
              ["referenceNumber", "เลขที่หนังสืออ้างอิง (ถ้ามี)", 80],
              ["preparedBy", "ชื่อและนามสกุลผู้จัดทำ", 120],
              ["position", "ตำแหน่ง / สถานะผู้จัดทำ", 120],
            ] as const
          ).map(([key, label, maxLength]) => (
            <label key={key}>
              {label}
              <input
                value={official[key] || ""}
                maxLength={maxLength}
                onChange={(event) =>
                  setOfficial((current) => ({
                    ...current,
                    [key]: event.target.value,
                  }))
                }
              />
            </label>
          ))}
        </fieldset>
      </details>
      <div className="inline-actions">
        <button
          type="button"
          className="button secondary"
          disabled={disabled || !!busy}
          onClick={() => download("pdf")}
        >
          {busy === "pdf" ? <LoaderCircle size={17} /> : <Download size={17} />}{" "}
          ดาวน์โหลด PDF
        </button>
        <button
          type="button"
          className="button secondary"
          disabled={disabled || !!busy}
          onClick={() => download("docx")}
        >
          {busy === "docx" ? (
            <LoaderCircle size={17} />
          ) : (
            <FileText size={17} />
          )}{" "}
          ดาวน์โหลด Word
        </button>
      </div>
      {message && <small role="status">{message}</small>}
      {error && (
        <p className="certificate-gap" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
