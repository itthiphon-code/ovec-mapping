"use client";
import { useEffect, useRef, useState } from "react";
import type { EmbeddingPlan } from "@/lib/embedding-matcher";
import {
  Sparkles,
  ShieldCheck,
  FileText,
  ArrowRight,
  Printer,
  Check,
  RefreshCw,
} from "lucide-react";
import {
  api,
  useResource,
  ErrorBox,
  Loading,
  Empty,
  Badge,
  ExternalLink,
  date,
} from "./ui";
import type { AnalysisRecord, AutoResult } from "@/lib/auto-mapping";
import type { MappingRow } from "@/lib/types";
import type { RecommendationResult } from "@/lib/recommendations";

export function StandardRecommendations({
  courseId,
  onSelect,
  canRun = true,
  blockedReason,
  signInHref,
}: {
  courseId: string;
  onSelect: (id: string, level: string) => void;
  canRun?: boolean;
  blockedReason?: string;
  signInHref?: string;
}) {
  const [data, setData] = useState<RecommendationResult | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function search() {
    setBusy(true);
    setError("");
    try {
      setData(
        await api<RecommendationResult>("recommendations", {
          method: "POST",
          body: JSON.stringify({ courseId }),
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel automatic-discovery">
      <div className="section-heading">
        <div>
          <h2>
            <Sparkles size={21} /> ค้นคู่มาตรฐานอัตโนมัติ
          </h2>
          <p className="muted">
            เริ่มจากอ้างอิงในเอกสารรายวิชา แล้วใช้คำร่วมช่วยค้นรายการเพิ่มเติม
          </p>
        </div>
        <button
          className="button primary"
          disabled={busy || !courseId || !canRun}
          onClick={search}
        >
          <Sparkles size={18} />
          {busy ? "กำลังตรวจแหล่งข้อมูล…" : "ค้นจากอ้างอิงรายวิชา"}
        </button>
      </div>
      {blockedReason && (
        <div className="notice info">
          <FileText size={20} />
          <span>{blockedReason}</span>
          {signInHref && (
            <a className="button secondary small" href={signInHref}>
              เข้าสู่ระบบ
            </a>
          )}
        </div>
      )}
      {!blockedReason && !courseId && (
        <p className="field-hint">
          ขั้นที่ 1: ค้นหาและคลิกเลือกรายวิชาจากรายการด้านล่าง
          แล้วปุ่มค้นอัตโนมัติจะพร้อมใช้
        </p>
      )}
      <ErrorBox message={error} />
      {busy && <Loading />}
      {data && (
        <>
          <div className="notice info">
            <FileText size={20} />
            <span>
              ตรวจรายละเอียด {data.detailsChecked} จาก {data.searched}{" "}
              รายการที่ค้นพบ · ยังไม่ใช่ผลรับรอง
            </span>
          </div>
          {data.sourceDegraded && (
            <div className="notice warning">
              ต้นทางบางส่วนไม่พร้อม จึงใช้ข้อมูลที่เก็บไว้ ผลค้นหาอาจไม่ครบ
            </div>
          )}
          {data.items.length > 0 &&
            data.items.every((item) =>
              item.levels.every((level) => level.mismatch),
            ) && (
              <div className="notice warning">
                พบชื่อมาตรฐานที่เกี่ยวข้อง
                แต่ระดับของรายการที่ค้นพบยังไม่ตรงกับเอกสารรายวิชา
                จึงปิดปุ่มเลือกระดับไว้ กรุณาค้นมาตรฐานฉบับที่ตรงระดับเพิ่มเติม
              </div>
            )}
          {data.detailsUnavailable > 0 && (
            <p className="field-hint">
              อ่านรายละเอียดไม่สำเร็จ {data.detailsUnavailable} รายการ
            </p>
          )}
          <p className="pre-line source-reference">
            {data.reference || "รายวิชายังไม่ระบุอ้างอิง TPQI"}
          </p>
          <ExternalLink href={data.courseUrl}>
            ตรวจเอกสารรายวิชา · {data.courseLocator}
          </ExternalLink>
          <div className="recommendation-list">
            {data.items.map((item) => (
              <article className="recommendation-item" key={item.id}>
                <div>
                  <Badge>
                    {item.basis === "DIRECT_CODE"
                      ? "รหัสเต็มตรง"
                      : item.basis === "DOCUMENT_TITLE"
                        ? "พบชื่อในเอกสาร"
                        : item.basis === "AMBIGUOUS_CODE"
                          ? "รหัสยังคลุมเครือ"
                          : "พบคำร่วม"}
                  </Badge>
                  <h3>{item.title}</h3>
                  <p>{item.reason}</p>
                  <ExternalLink href={item.sourceUrl}>
                    เปิดมาตรฐานต้นทาง
                  </ExternalLink>
                </div>
                <div className="recommendation-levels">
                  {item.levels.map((l) => (
                    <div key={l.name}>
                      <button
                        className="button secondary small"
                        disabled={l.mismatch}
                        onClick={() => onSelect(item.id, l.name)}
                      >
                        {l.name}
                        <ArrowRight size={15} />
                      </button>
                      <small>
                        {l.mismatch ? l.note : "เลือกเพื่อตรวจฉบับและขอบเขต"}
                      </small>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
          {!data.items.length && (
            <Empty
              title="ยังไม่พบคู่ที่มีหลักฐานพอเสนอ"
              description="ลองค้นมาตรฐานด้วยชื่ออาชีพหรือรหัสเพิ่มเติม การไม่พบผลยังไม่หมายความว่าไม่มีมาตรฐานที่สอดคล้อง"
            />
          )}
          <p className="field-hint">{data.scope}</p>
          <small>คำค้น: {data.queries.join(" · ")}</small>
        </>
      )}
    </section>
  );
}

export function AutomaticAnalysis({
  id,
  revision,
  hash,
  rows,
  editable,
  dirty,
  onApplied,
}: {
  id: string;
  revision: number;
  hash: string;
  rows: MappingRow[];
  editable: boolean;
  dirty: boolean;
  onApplied: () => void;
}) {
  const resource = useResource<{ items: AnalysisRecord[] }>(
    `mappings/${id}/analyses`,
  );
  const [selectedRun, setSelectedRun] = useState(""),
    [selections, setSelections] = useState<Record<string, string>>({}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [progress, setProgress] = useState("");
  const [canCancel, setCanCancel] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  useEffect(
    () => () => {
      cancelRef.current?.();
      workerRef.current?.terminate();
    },
    [],
  );
  const record =
    resource.data?.items.find((r) => r.id === selectedRun) ||
    resource.data?.items[0];
  const result = record ? (JSON.parse(record.result) as AutoResult) : null;
  const stale =
    !!record && (record.input_hash !== hash || record.revision !== revision);
  const appliedHere =
    !!result?.embedding?.appliedHash &&
    result.embedding.appliedHash === hash &&
    result.embedding.appliedRevision === revision;
  const selectable =
    editable && !dirty && !stale && !busy && !result?.reference.mismatch;
  const free = (rowId: string) =>
    rows.some(
      (r) =>
        r.id === rowId && !r.criterion && r.status === "INSUFFICIENT_EVIDENCE",
    );
  async function embedAndLink() {
    setBusy(true);
    setError("");
    setMessage("");
    setProgress("กำลังอ่านเอกสารฉบับที่บันทึก…");
    try {
      const input = await api<{
        revision: number;
        inputHash: string;
        planHash: string;
        plan: EmbeddingPlan;
      }>(`mappings/${id}/embedding-input`);
      if (input.revision !== revision || input.inputHash !== hash)
        throw new Error("ฉบับงานเปลี่ยนแล้ว กรุณาโหลดใหม่");
      const vectors = await new Promise<string[]>((resolve, reject) => {
        const worker = new Worker("/embedding-worker.js", { type: "module" });
        workerRef.current = worker;
        setCanCancel(true);
        let timer: ReturnType<typeof setTimeout>;
        const finish = (error?: Error, value?: string[]) => {
          clearTimeout(timer);
          worker.terminate();
          workerRef.current = null;
          setCanCancel(false);
          cancelRef.current = null;
          if (error) reject(error);
          else resolve(value!);
        };
        const heartbeat = () => {
          clearTimeout(timer);
          timer = setTimeout(
            () =>
              finish(
                new Error("โมเดลไม่ตอบสนอง กรุณาตรวจเครือข่ายแล้วลองใหม่"),
              ),
            180_000,
          );
        };
        cancelRef.current = () =>
          finish(new Error("ยกเลิกการคำนวณแล้ว ยังไม่มีการเชื่อมโยง"));
        worker.onerror = () =>
          finish(
            new Error(
              "โหลด Embedding Matcher ไม่สำเร็จ กรุณาใช้เบราว์เซอร์รุ่นล่าสุดและลองใหม่",
            ),
          );
        worker.onmessage = ({ data }) => {
          heartbeat();
          if (data.type === "progress") setProgress(data.message);
          if (data.type === "complete") finish(undefined, data.vectors);
          if (data.type === "error") finish(new Error(data.message));
        };
        heartbeat();
        worker.postMessage({
          engine: input.plan.config.engine,
          texts: input.plan.texts,
        });
      });
      setProgress("กำลังคำนวณเปอร์เซ็นต์และเชื่อมตารางร่าง…");
      const response = await api<{
        id: string;
        linked: number;
        mismatch: boolean;
      }>(`mappings/${id}/embedding-analyze`, {
        method: "POST",
        body: JSON.stringify({
          revision,
          inputHash: input.inputHash,
          planHash: input.planHash,
          vectors,
        }),
      });
      setSelectedRun(response.id);
      setSelections({});
      resource.reload();
      setMessage(
        response.mismatch
          ? "คำนวณเปอร์เซ็นต์แล้ว แต่ระดับอ้างอิงไม่ตรง จึงยังไม่เชื่อมตาราง"
          : `คำนวณเปอร์เซ็นต์แล้ว เชื่อม ${response.linked} ข้อลงตารางร่าง ทุกข้อรอผู้เชี่ยวชาญตรวจ${response.linked === 0 ? " · แถวที่มีงานเดิมจะคงไว้" : ""}`,
      );
      onApplied();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setProgress("");
    }
  }
  async function analyze() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await api<{ id: string }>(`mappings/${id}/analyze`, {
        method: "POST",
        body: JSON.stringify({ revision }),
      });
      setSelectedRun(response.id);
      setSelections({});
      resource.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function apply() {
    if (!record) return;
    setBusy(true);
    setError("");
    try {
      await api(`mappings/${id}/apply-analysis`, {
        method: "POST",
        body: JSON.stringify({
          revision,
          analysisId: record.id,
          selections: Object.entries(selections)
            .filter(([, candidateId]) => candidateId)
            .map(([rowId, candidateId]) => ({ rowId, candidateId })),
        }),
      });
      setSelections({});
      setMessage(
        "บันทึกหลักฐานที่เลือกเป็นฉบับร่างใหม่แล้ว ทุกข้อยังรอการตรวจวินิจฉัย",
      );
      onApplied();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="automatic-analysis">
      <div className="panel analysis-intro print-controls">
        <div className="section-heading">
          <div>
            <span className="eyebrow">DOCUMENT-FIRST COMPARISON</span>
            <h2>
              <Sparkles size={23} /> วิเคราะห์ความสอดคล้องอัตโนมัติ
            </h2>
            <p className="muted">
              เทียบข้อกำหนดรายวิชากับ UoC / EoC / เกณฑ์ในระดับที่เลือก
              พร้อมหลักฐานและจุดที่ต้องตรวจ
            </p>
          </div>
          {editable && (
            <div className="inline-actions">
              <button
                className="button primary"
                disabled={busy || dirty}
                onClick={embedAndLink}
              >
                <Sparkles size={18} className={busy ? "spin" : ""} />
                {busy ? "กำลังดำเนินการ…" : "เชื่อมอัตโนมัติด้วย Embedding"}
              </button>
              <button
                className="button secondary small"
                disabled={busy || dirty}
                onClick={analyze}
              >
                <RefreshCw size={16} /> วิเคราะห์ด้วยคำร่วม
              </button>
            </div>
          )}
        </div>
        <div className="notice info">
          <ShieldCheck size={21} />
          <span>
            Embedding Matcher เชื่อมคู่ที่ได้อันดับสูงสุดลงแถวว่าง
            พร้อมเปอร์เซ็นต์ความใกล้เคียงของข้อความ ตรวจรหัสอ้างอิงก่อนจัดอันดับ
            ทุกข้อรอผู้เชี่ยวชาญรับรอง
          </span>
        </div>
        <p className="field-hint">
          ครั้งแรกต้องดาวน์โหลดโมเดลหลายภาษา อาจใช้เวลาหลายนาที
          จากนั้นเครื่องนี้จะเก็บโมเดลไว้ใช้ซ้ำ ข้อความประมวลผลบนเครื่องของคุณ
        </p>
        {progress && (
          <div className="notice info" role="status" aria-live="polite">
            <RefreshCw size={18} className="spin" />
            <span>{progress}</span>
            {canCancel && (
              <button
                className="button secondary small"
                onClick={() => cancelRef.current?.()}
              >
                ยกเลิก
              </button>
            )}
          </div>
        )}
        {dirty && (
          <div className="notice warning">
            บันทึกฉบับร่างก่อนวิเคราะห์หรือใช้ข้อเสนอ
            เพื่อให้หลักฐานตรงกับฉบับงาน
          </div>
        )}
      </div>
      <ErrorBox message={error || resource.error} />
      {message && (
        <div role="status" className="notice success">
          <Check size={18} />
          {message}
        </div>
      )}
      {resource.loading && !record ? (
        <Loading />
      ) : !result ? (
        <Empty
          title="เริ่มวิเคราะห์คู่มาตรฐาน–รายวิชานี้"
          description="ระบบจะเก็บผลวิเคราะห์แยกจากตารางที่คุณจัดทำ พร้อมแสดงข้อที่ยังหาคู่ไม่ได้"
        />
      ) : (
        <>
          <div className="analysis-toolbar print-controls">
            <label>
              ผลวิเคราะห์ที่บันทึก
              <select
                value={record!.id}
                onChange={(e) => {
                  setSelectedRun(e.target.value);
                  setSelections({});
                  setMessage("");
                }}
              >
                {resource.data?.items.map((r) => (
                  <option key={r.id} value={r.id}>
                    ฉบับ {r.revision} · {date(r.created_at)}
                  </option>
                ))}
              </select>
            </label>
            {result.embedding && (
              <a
                className="button secondary"
                href={`/api/mappings/${id}/embedding-evidence?analysisId=${record!.id}`}
              >
                ดาวน์โหลดหลักฐานการคำนวณ
              </a>
            )}
            <button className="button secondary" onClick={() => window.print()}>
              <Printer size={17} />
              พิมพ์ผลวิเคราะห์
            </button>
          </div>
          <article className="panel analysis-report">
            <header>
              <span className="eyebrow">
                AUTOMATIC SUGGESTIONS · NOT CERTIFIED
              </span>
              <h2>ผลวิเคราะห์เบื้องต้น · ฉบับ {record!.revision}</h2>
              <h3>{result.courseTitle}</h3>
              <p>
                {result.standardTitle} · {result.levelName} ·{" "}
                {date(record!.created_at)}
              </p>
              <Badge>ข้อเสนออัตโนมัติ ยังไม่ผ่านการรับรอง</Badge>
            </header>
            {appliedHere && (
              <div className="notice success">
                เชื่อมข้อเสนอ {result.embedding!.linkedCount} ข้อแล้วในฉบับ{" "}
                {revision} · ยังไม่ผ่านการรับรอง
              </div>
            )}
            {stale && !appliedHere && (
              <div className="notice warning">
                ผลนี้อ้างอิงฉบับเก่า ดูย้อนหลังได้ แต่ใช้กับฉบับปัจจุบันไม่ได้
              </div>
            )}
            <div
              className={`notice ${result.reference.mismatch ? "warning" : "info"}`}
            >
              <FileText size={20} />
              <span>{result.reference.note}</span>
            </div>
            <div className="inline-actions">
              {result.comparedSections.map((s) => (
                <Badge key={s.kind}>
                  {s.kind}: {s.available ? "มีข้อมูล" : "ยังไม่มีข้อมูล"}
                </Badge>
              ))}
            </div>
            {result.embedding && (
              <div className="embedding-overview">
                <div>
                  <span className="eyebrow">EMBEDDING SIMILARITY</span>
                  <strong>
                    {result.embedding.meanSimilarity?.toFixed(1) ?? "—"}
                    <small>%</small>
                  </strong>
                  <span>
                    ความใกล้เคียงข้อความเฉลี่ยของคู่ที่ได้อันดับสูงสุด
                  </span>
                </div>
                <p>
                  คำนวณจาก {result.embedding.scoredTargets}{" "}
                  ข้อกำหนดในคู่รายวิชา–มาตรฐานนี้
                  <br />
                  เปอร์เซ็นต์นี้ใช้ช่วยจัดอันดับ
                  ยังไม่ใช่ร้อยละความครอบคลุมหรือผลเทียบโอนที่รับรอง
                </p>
              </div>
            )}
            <div className="analysis-counts">
              <div>
                <strong>
                  {result.summary.targetsWithCandidates} /{" "}
                  {result.summary.targets}
                </strong>
                <span>ข้อกำหนดรายวิชาที่พบคู่เสนอ</span>
              </div>
              <div>
                <strong>{result.summary.targetsWithoutCandidates}</strong>
                <span>ข้อกำหนดที่ยังไม่มีคู่เสนอ</span>
              </div>
              <div>
                <strong>
                  {result.summary.criteriaWithoutCandidates} /{" "}
                  {result.summary.criteria}
                </strong>
                <span>เกณฑ์ TPQI ที่ยังไม่มีคู่เสนอ</span>
              </div>
            </div>
            <p className="field-hint">
              จำนวนคู่เสนอแสดงความคืบหน้าการค้นหลักฐาน
              ไม่ใช่ร้อยละความครอบคลุมหรือจำนวนหน่วยกิต
            </p>
            {result.embedding && (
              <div className="table-scroll embedding-summary-table">
                <table>
                  <caption>
                    ตารางเชื่อมโยงที่ระบบเสนออันดับแรก · รอผู้เชี่ยวชาญตรวจ
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">ข้อกำหนดรายวิชา</th>
                      <th scope="col">UoC / EoC และเกณฑ์มาตรฐาน</th>
                      <th scope="col">ความใกล้เคียงข้อความ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row) => {
                      const candidate = row.candidates[0];
                      return (
                        <tr key={row.rowId}>
                          <td>
                            <b>{row.targetKind}</b>
                            <p>{row.target}</p>
                          </td>
                          <td>
                            {candidate ? (
                              <>
                                <b>
                                  {candidate.uoc} / {candidate.eoc}
                                </b>
                                <p>{candidate.criterion}</p>
                              </>
                            ) : (
                              "ยังไม่มีคู่เสนอ"
                            )}
                          </td>
                          <td>
                            <strong>
                              {candidate?.similarity?.toFixed(1) ?? "—"}%
                            </strong>
                            <p>
                              {candidate?.basis === "DIRECT_CODE"
                                ? "พบรหัสอ้างอิงเต็ม"
                                : "เสนอจาก Embedding"}
                            </p>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="analysis-rows">
              {result.rows.map((row) => (
                <section className="analysis-row" key={row.rowId}>
                  <div className="analysis-target">
                    <Badge>
                      {row.rowId} · {row.targetKind}
                    </Badge>
                    <h3>{row.target}</h3>
                    <blockquote>{row.courseQuote}</blockquote>
                    <ExternalLink href={row.courseUrl}>
                      {row.courseLocator || "เปิดเอกสารรายวิชา"}
                    </ExternalLink>
                  </div>
                  <div className="analysis-candidates">
                    {row.candidates.map((c) => (
                      <article
                        className={`analysis-candidate ${selections[row.rowId] === c.id ? "chosen" : ""}`}
                        key={c.id}
                      >
                        <div className="section-heading">
                          <Badge>
                            {c.basis === "DIRECT_CODE"
                              ? "พบรหัสอ้างอิงเต็ม"
                              : c.basis === "EMBEDDING"
                                ? "Embedding — รอตรวจ"
                                : "คำเฉพาะร่วม — รอตรวจ"}
                          </Badge>
                          {editable && (
                            <label className="candidate-select print-controls">
                              <input
                                type="checkbox"
                                checked={selections[row.rowId] === c.id}
                                disabled={!selectable || !free(row.rowId)}
                                onChange={(e) =>
                                  setSelections({
                                    ...selections,
                                    [row.rowId]: e.target.checked ? c.id : "",
                                  })
                                }
                              />
                              เลือกหลักฐานนี้
                            </label>
                          )}
                        </div>
                        {c.similarity !== undefined && (
                          <div className="similarity-meter">
                            <strong>{c.similarity.toFixed(1)}%</strong>
                            <span>ความใกล้เคียงข้อความ</span>
                            <meter
                              min="0"
                              max="100"
                              value={c.similarity}
                              aria-label={`ความใกล้เคียง ${c.similarity.toFixed(1)} เปอร์เซ็นต์`}
                            />
                          </div>
                        )}
                        <h4>
                          {c.uoc} / {c.eoc}
                        </h4>
                        <blockquote>{c.standardQuote}</blockquote>
                        <p>
                          <b>เหตุผลที่เสนอ:</b> {c.reason}
                        </p>
                        {!!c.courseSupport.length && (
                          <details className="supporting-evidence">
                            <summary>
                              ข้อความสนับสนุนจากหัวข้อรายวิชา (
                              {c.courseSupport.length})
                            </summary>
                            {c.courseSupport.map((s) => (
                              <section key={s.kind}>
                                <h4>{s.kind}</h4>
                                <blockquote>{s.quote}</blockquote>
                                <small>
                                  {s.locator} ·{" "}
                                  {s.similarity !== undefined
                                    ? `Embedding ${s.similarity.toFixed(1)}%`
                                    : `คำร่วม ${s.sharedTerms.join(", ")}`}
                                </small>
                              </section>
                            ))}
                          </details>
                        )}
                        <ul>
                          {c.gaps.map((g) => (
                            <li key={g}>{g}</li>
                          ))}
                        </ul>
                        <ExternalLink href={c.standardUrl}>
                          {c.standardLocator}
                        </ExternalLink>
                      </article>
                    ))}
                    {!row.candidates.length && (
                      <div className="notice warning">
                        {row.gaps.join(" · ")}
                      </div>
                    )}
                    {editable && !free(row.rowId) && (
                      <p className="field-hint">
                        แถวนี้มีงานที่จัดทำไว้แล้ว ระบบจะไม่เขียนทับ
                      </p>
                    )}
                  </div>
                </section>
              ))}
            </div>
            {result.unmatchedCriteria.length > 0 && (
              <details className="unmatched-criteria">
                <summary>
                  เกณฑ์มาตรฐานที่ยังไม่มีคู่เสนอ (
                  {result.unmatchedCriteria.length})
                </summary>
                <ul>
                  {result.unmatchedCriteria.map((c, i) => (
                    <li key={i}>
                      {c.uoc} / {c.eoc} · {c.criterion}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <footer className="analysis-footnote">
              <h3>ขอบเขตผลวิเคราะห์</h3>
              <ul>
                {result.limitations.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
              <p>วิธีวิเคราะห์ {record!.engine}</p>
              {result.embedding && (
                <>
                  <p>
                    โมเดล {result.embedding.config.model} · รุ่น{" "}
                    {result.embedding.config.revision} ·{" "}
                    {result.embedding.config.dtype}
                  </p>
                  <p>
                    SHA-256 หลักฐานการคำนวณ:{" "}
                    <code>{result.embedding.vectorHash}</code>
                  </p>
                  <p>
                    <a
                      href="https://huggingface.co/intfloat/multilingual-e5-small"
                      target="_blank"
                      rel="noreferrer"
                    >
                      เอกสารโมเดลและข้อจำกัดของคะแนน E5
                    </a>
                  </p>
                </>
              )}
              <p>
                ฉบับข้อมูล SHA-256: <code>{record!.input_hash}</code>
              </p>
            </footer>
          </article>
          {editable && (
            <div className="panel analysis-apply print-controls">
              <span>
                เลือกแล้ว{" "}
                <b>{Object.values(selections).filter(Boolean).length}</b> ข้อ ·
                บันทึกเป็นหลักฐานที่รอคนตรวจ
              </span>
              <button
                className="button primary"
                disabled={
                  !selectable || !Object.values(selections).some(Boolean)
                }
                onClick={apply}
              >
                <Check size={18} />
                ใช้ข้อเสนอที่เลือกในฉบับร่างใหม่
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
