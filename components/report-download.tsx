"use client";
import { useRef, useState } from "react";
import { Download, FileText, LoaderCircle } from "lucide-react";
import type { TransferReport } from "@/lib/report-data";
import type { ReportFormat } from "@/lib/report-export";

export function ReportDownload({
  buildReport,
  disabled = false,
}: {
  buildReport: () => TransferReport;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState<ReportFormat | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  async function download(format: ReportFormat) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(format);
    setError("");
    setMessage("กำลังจัดทำเอกสาร กรุณารอสักครู่");
    try {
      // Snapshot the current filter/scope before loading the exporters.
      const report = buildReport();
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
