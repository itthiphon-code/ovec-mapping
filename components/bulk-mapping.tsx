"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Database,
  Search,
  Printer,
  ArrowRight,
  FileText,
  ShieldCheck,
  CheckCircle2,
  Download,
} from "lucide-react";
import {
  useResource,
  api,
  PageTitle,
  Loading,
  ErrorBox,
  Empty,
  Badge,
  ExternalLink,
} from "./ui";
import type { BulkManifest, BulkCourseRow, BulkDetail } from "@/lib/bulk-types";
import type { User } from "@/lib/types";
const labels: Record<string, string> = {
  PENDING_REVIEW: "คำนวณแล้ว · รอผู้เชี่ยวชาญ",
  LEVEL_MISMATCH: "ระดับอ้างอิงไม่ตรง",
  INSUFFICIENT_DATA: "รายละเอียดไม่พอ",
  OUT_OF_SCOPE: "ระดับอื่นนอกขอบเขต",
  DIRECT_CODE: "รหัสอ้างอิงเต็มตรง",
  DOCUMENT_TITLE: "ชื่ออยู่ในเอกสาร",
  EMBEDDING: "ความหมายข้อความ",
};
export function BulkBrowser() {
  const [search, setSearch] = useState(""),
    [q, setQ] = useState(""),
    [level, setLevel] = useState(""),
    [category, setCategory] = useState(""),
    [status, setStatus] = useState(""),
    [basis, setBasis] = useState(""),
    [min, setMin] = useState("0"),
    [sort, setSort] = useState("reference"),
    [page, setPage] = useState(1);
  const params = new URLSearchParams({
    q,
    level,
    category,
    status,
    basis,
    min,
    sort,
    page: String(page),
  });
  const resource = useResource<{
      manifest: BulkManifest | null;
      items: BulkCourseRow[];
      total: number;
      page: number;
      categories: string[];
    }>(`bulk?${params}`),
    data = resource.data,
    m = data?.manifest;
  return (
    <>
      <PageTitle
        eyebrow="CATALOG EMBEDDING MATCHER"
        title="ผลจับคู่ทั้งคลัง พร้อมใช้งาน"
        description="คำนวณและบันทึกไว้แล้ว เปิดดูเปอร์เซ็นต์และหลักฐานได้ทันที โดยไม่ต้องเริ่มวิเคราะห์ทีละรายวิชา"
        action={
          <Link className="button secondary" href="/automatic/new">
            สร้างคู่เพิ่มเติม <ArrowRight size={17} />
          </Link>
        }
      />
      <ErrorBox message={resource.error} />
      {!data && resource.loading ? (
        <Loading />
      ) : !m ? (
        <Empty
          title="กำลังเตรียมผลคำนวณทั้งคลัง"
          description="ผลชุดแรกยังไม่พร้อมในพื้นที่นี้"
        />
      ) : (
        <>
          <section className="bulk-ready panel">
            <div className="bulk-ready-icon">
              <Database size={28} />
            </div>
            <div>
              <span className="eyebrow">PRECOMPUTED · MULTILINGUAL E5</span>
              <h2>เปิดมา ก็มีผลเทียบให้เลย</h2>
              <p>
                ตรวจครบ {m.eligible.toLocaleString()} รายวิชา ปวช./ปวส. ·
                เทียบมาตรฐาน {m.standards.toLocaleString()} รายการ
              </p>
            </div>
            <Badge>
              <CheckCircle2 size={14} /> คำนวณเสร็จแล้ว
            </Badge>
          </section>
          <div className="bulk-stats">
            <div className="panel">
              <strong>{m.computed.toLocaleString()}</strong>
              <span>รายวิชาที่มีผลพร้อมดู</span>
            </div>
            <div className="panel">
              <strong>{m.pairs.toLocaleString()}</strong>
              <span>คู่มาตรฐานที่จัดอันดับไว้</span>
            </div>
            <div className="panel">
              <strong>{m.direct.toLocaleString()}</strong>
              <span>รายวิชาที่อันดับแรกมีรหัสเต็มตรง</span>
            </div>
            <div className="panel">
              <strong>{m.missing.toLocaleString()}</strong>
              <span>รายวิชาที่รายละเอียดไม่พอ</span>
            </div>
          </div>
          <div className="notice info">
            <ShieldCheck size={21} />
            <span>
              เปอร์เซ็นต์แสดงความใกล้เคียงข้อความ
              ผลทั้งหมดเป็นข้อเสนอที่รอผู้เชี่ยวชาญรับรอง
              การมีคะแนนสูงยังไม่หมายถึงผ่านเทียบโอน
            </span>
          </div>
          <section className="panel bulk-filter print-controls">
            <form
              className="bulk-search"
              onSubmit={(e) => {
                e.preventDefault();
                setQ(search);
                setPage(1);
              }}
            >
              <label htmlFor="bulk-search">ค้นในผลที่คำนวณแล้ว</label>
              <div>
                <input
                  id="bulk-search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="รหัสวิชา ชื่อวิชา สาขา หรือมาตรฐาน"
                />
                <button className="button primary">
                  <Search size={18} /> ค้นหา
                </button>
              </div>
            </form>
            <div className="bulk-filter-grid">
              <label>
                ระดับ
                <select
                  value={level}
                  onChange={(e) => {
                    setLevel(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">ทุกระดับ</option>
                  <option>ปวช.</option>
                  <option>ปวส.</option>
                  <option>อื่นๆ</option>
                </select>
              </label>
              <label>
                ประเภทวิชา
                <select
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">ทุกประเภท</option>
                  {data.categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label>
                สถานะ
                <select
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">ทุกสถานะ</option>
                  {[
                    "PENDING_REVIEW",
                    "LEVEL_MISMATCH",
                    "INSUFFICIENT_DATA",
                    "OUT_OF_SCOPE",
                  ].map((s) => (
                    <option value={s} key={s}>
                      {labels[s]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                หลักฐานการจับคู่
                <select
                  value={basis}
                  onChange={(e) => {
                    setBasis(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">ทุกวิธี</option>
                  {["DIRECT_CODE", "DOCUMENT_TITLE", "EMBEDDING"].map((s) => (
                    <option key={s} value={s}>
                      {labels[s]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                คะแนนตั้งแต่
                <select
                  value={min}
                  onChange={(e) => {
                    setMin(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="0">ทุกคะแนน</option>
                  {[70, 80, 85, 90, 95].map((s) => (
                    <option key={s} value={s}>
                      {s}%
                    </option>
                  ))}
                </select>
              </label>
              <label>
                เรียงผล
                <select
                  value={sort}
                  onChange={(e) => {
                    setSort(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="reference">อ้างอิงเอกสารก่อน</option>
                  <option value="score">เปอร์เซ็นต์มากไปน้อย</option>
                </select>
              </label>
            </div>
          </section>
          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>ตารางความสอดคล้อง</h2>
                <p className="muted">
                  พบ {data.total.toLocaleString()} รายวิชา ·
                  แสดงคู่ที่ระบบจัดอันดับแรก คลิกเพื่อดูทางเลือกและหลักฐานรายข้อ
                </p>
              </div>
              <div className="inline-actions print-controls">
                <a
                  className="button secondary small"
                  href={`/api/bulk?${params}&format=csv`}
                >
                  <Download size={16} /> CSV ทั้งผลที่กรอง
                </a>
                <button
                  className="button secondary small"
                  onClick={() => window.print()}
                >
                  <Printer size={16} /> พิมพ์หน้านี้
                </button>
              </div>
            </div>
            {resource.loading && <Loading />}
            <div className="table-scroll bulk-results">
              <table>
                <thead>
                  <tr>
                    <th>รายวิชา / สาขา</th>
                    <th>มาตรฐาน TPQI ที่เสนอ</th>
                    <th>Embedding</th>
                    <th>หลักฐาน / สถานะ</th>
                    <th>ผลรายข้อ</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <Link
                          className="bulk-course-link"
                          href={`/automatic/${encodeURIComponent(r.course_id)}`}
                        >
                          <span>
                            {r.code} · {r.level}
                          </span>
                          <strong>{r.title}</strong>
                        </Link>
                        <small>{r.department}</small>
                      </td>
                      <td>
                        {r.standard_title || "ยังไม่มีผลจับคู่"}
                        {r.pair_count > 1 && (
                          <small>มี {r.pair_count} คู่มาตรฐานให้ตรวจ</small>
                        )}
                      </td>
                      <td>
                        {r.score === null ? (
                          <span className="muted">ยังไม่คำนวณ</span>
                        ) : (
                          <div className="bulk-score">
                            <strong>
                              {(r.score / 10).toFixed(1)}
                              <small>%</small>
                            </strong>
                            <meter
                              aria-label={`ความใกล้เคียง ${(r.score / 10).toFixed(1)}%`}
                              min={0}
                              max={100}
                              value={r.score / 10}
                            />
                          </div>
                        )}
                      </td>
                      <td>
                        {r.basis && <Badge>{labels[r.basis]}</Badge>}
                        <p
                          className={
                            r.status === "LEVEL_MISMATCH"
                              ? "bulk-warning"
                              : "field-hint"
                          }
                        >
                          {labels[r.status]}
                        </p>
                      </td>
                      <td>
                        <Link
                          className="button secondary small"
                          href={`/automatic/${encodeURIComponent(r.course_id)}`}
                        >
                          เปิดผล <ArrowRight size={15} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!data.items.length && (
              <Empty
                title="ไม่พบผลตามตัวกรอง"
                description="ลองลดเงื่อนไขหรือใช้รหัสรายวิชาค้นหา"
              />
            )}
            <div className="bulk-pagination print-controls">
              <button
                className="button secondary small"
                disabled={page === 1 || resource.loading}
                onClick={() => setPage(page - 1)}
              >
                ก่อนหน้า
              </button>
              <span>
                หน้า {page} / {Math.max(1, Math.ceil(data.total / 25))}
              </span>
              <button
                className="button secondary small"
                disabled={page * 25 >= data.total || resource.loading}
                onClick={() => setPage(page + 1)}
              >
                ถัดไป
              </button>
            </div>
          </section>
          <section className="panel text-section">
            <h3>ขอบเขตข้อมูลรอบนี้</h3>
            <p>
              ข้อมูลรายการต้นทาง {m.courses.toLocaleString()} รายการ มี{" "}
              {m.excluded.toLocaleString()} รายการอยู่ในระดับอื่นนอกขอบเขต
              ปวช./ปวส. · ใช้ข้อความจาก snapshot วันที่{" "}
              {m.snapshotDates.join(", ")} และแสดงวันอ้างอิงในแต่ละรายวิชา
            </p>
            <p>
              คำนวณ {new Date(m.createdAt).toLocaleString("th-TH")} · โมเดล{" "}
              {m.model} · ยังไม่มีผลรับรองจากผู้เชี่ยวชาญในชุดคำนวณนี้
            </p>
            <div className="inline-actions">
              <ExternalLink href="https://dles.vec.go.th/subject/">
                รายการรายวิชาต้นทาง
              </ExternalLink>
              <ExternalLink href="https://dles.vec.go.th/standards">
                มาตรฐานต้นทาง
              </ExternalLink>
            </div>
          </section>
        </>
      )}
    </>
  );
}
export function BulkCourse({ id, user }: { id: string; user: User | null }) {
  const resource = useResource<{
      manifest: BulkManifest;
      row: BulkCourseRow;
      detail: BulkDetail;
    }>(`bulk/${encodeURIComponent(id)}`),
    [selected, setSelected] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    router = useRouter();
  const data = resource.data,
    detail = data?.detail,
    pair = detail?.pairs[selected];
  async function adopt() {
    if (!pair) return;
    setBusy(true);
    setError("");
    try {
      const r = await api<{ id: string }>(
        `bulk/${encodeURIComponent(id)}/adopt`,
        { method: "POST", body: JSON.stringify({ pairId: pair.id }) },
      );
      router.push("/mappings/" + r.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!data)
    return (
      <>
        <ErrorBox message={resource.error} />
        {resource.loading && <Loading />}
      </>
    );
  const d = data.detail,
    c = d.course,
    p = d.provenance;
  return (
    <>
      <Link className="back-link print-controls" href="/automatic">
        ← กลับผลทั้งคลัง
      </Link>
      <PageTitle
        eyebrow="PRECOMPUTED ALIGNMENT"
        title={`${d.summary.code} ${d.summary.nameTh}`}
        description={`${d.summary.level} · ${d.summary.deptName}`}
        action={
          <button
            className="button secondary print-controls"
            onClick={() => window.print()}
          >
            <Printer size={18} /> พิมพ์ผลเทียบ
          </button>
        }
      />
      <ErrorBox message={error} />
      <div className="notice info">
        <Database size={20} />
        <span>{d.note}</span>
      </div>
      {!!d.pairs.length && (
        <div
          className="bulk-pair-tabs print-controls"
          role="group"
          aria-label="เลือกผลมาตรฐานที่คำนวณไว้"
        >
          {d.pairs.map((x, i) => (
            <button
              key={x.id}
              className={`panel ${selected === i ? "selected" : ""}`}
              onClick={() => setSelected(i)}
            >
              <small>
                คู่ที่ {i + 1} · {x.level}
              </small>
              <strong>{x.title}</strong>
              <span>
                {x.score.toFixed(1)}% · {labels[x.basis]}
              </span>
            </button>
          ))}
        </div>
      )}
      {pair && (
        <article className="panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">{labels[pair.basis]}</span>
              <h2>{pair.title}</h2>
              <p>
                {pair.level} · เปรียบเทียบ {d.targets.length} ข้อกำหนดกับ{" "}
                {pair.criteria} เกณฑ์ปฏิบัติงาน
              </p>
            </div>
            <div className="bulk-detail-score">
              <strong>{pair.score.toFixed(1)}%</strong>
              <span>ค่าเฉลี่ยความใกล้เคียงข้อความ</span>
            </div>
          </div>
          <div className={`notice ${pair.mismatch ? "warning" : "info"}`}>
            <ShieldCheck size={19} />
            <span>{pair.referenceNote} · รอผู้เชี่ยวชาญรับรอง</span>
          </div>
          <div className="table-scroll">
            <table>
              <caption>
                ตารางเชื่อมโยงรายข้อจาก Embedding ที่คำนวณไว้แล้ว
              </caption>
              <thead>
                <tr>
                  <th>ข้อกำหนดรายวิชา</th>
                  <th>UoC / EoC / เกณฑ์ปฏิบัติงาน</th>
                  <th>ความใกล้เคียง</th>
                  <th>ประเด็นที่ต้องตรวจ</th>
                </tr>
              </thead>
              <tbody>
                {pair.matches.map((m) => {
                  const t = d.targets.find((t) => t.id === m.targetId)!;
                  return (
                    <tr key={m.targetId}>
                      <td>
                        <Badge>{t.kind}</Badge>
                        <p>{t.text}</p>
                        <small>{t.locator}</small>
                      </td>
                      <td>
                        <b>
                          {m.uoc} · {m.uocTitle}
                        </b>
                        <p>
                          {m.eoc} · {m.eocTitle}
                        </p>
                        <blockquote>{m.criterion}</blockquote>
                        <small>{m.locator}</small>
                      </td>
                      <td>
                        <strong>{m.similarity.toFixed(1)}%</strong>
                      </td>
                      <td>
                        <Badge>รอผู้เชี่ยวชาญตรวจ</Badge>
                        {m.critical && <p>ข้อกำหนดความปลอดภัย</p>}
                        {m.negation && <p>คำปฏิเสธ / ข้อยกเว้น</p>}
                        {m.theoryGap && <p>ต้องมีหลักฐานปฏิบัติจริง</p>}
                        <p>ตรวจบริบท เครื่องมือ คุณภาพ และวิธีประเมิน</p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="inline-actions print-controls">
            <ExternalLink href={pair.sourceUrl}>
              เปิดมาตรฐานต้นฉบับ
            </ExternalLink>
            {user && ["admin", "editor"].includes(user.role) && (
              <button
                className="button primary"
                disabled={busy || pair.mismatch}
                onClick={adopt}
              >
                <FileText size={18} />
                {busy ? "กำลังเปิดงาน…" : "นำผลนี้ไปจัดทำหลักฐานรับรอง"}
              </button>
            )}
          </div>
          <p className="field-hint">
            การเปิดงานรับรองใช้ผลที่คำนวณไว้แล้ว
            ไม่ต้องดาวน์โหลดโมเดลหรือวิเคราะห์ใหม่
          </p>
        </article>
      )}
      {c && (
        <section className="panel text-section">
          <h2>หลักฐานรายวิชาที่ใช้คำนวณ</h2>
          {c.courseName !== d.summary.nameTh && (
            <div className="notice warning">
              ชื่อใน snapshot: {c.courseName} · ชื่อในรายการล่าสุด:{" "}
              {d.summary.nameTh} กรุณาตรวจฉบับเอกสารก่อนรับรอง
            </div>
          )}
          <h3>อ้างอิงมาตรฐานในเอกสาร</h3>
          <p className="pre-line">{c.standardRef || "ยังไม่ระบุ"}</p>
          {[
            ["ผลลัพธ์การเรียนรู้", c.learningOutcomes],
            ["สมรรถนะรายวิชา", c.competencies],
            ["จุดประสงค์รายวิชา", c.objectives],
            ["คำอธิบายรายวิชา", c.description],
          ].map(([name, text]) => (
            <details key={name} className="supporting-evidence">
              <summary>{name}</summary>
              <p className="pre-line">{text || "ไม่มีข้อมูล"}</p>
            </details>
          ))}
          <ExternalLink href={c.pdfUrl}>
            PDF หลักสูตร · หน้าไฟล์ {c.pdfPage || "ยังไม่ระบุ"}
          </ExternalLink>
        </section>
      )}
      <section className="panel text-section bulk-provenance">
        <h3>ที่มาและวิธีคำนวณ</h3>
        <p>
          รุ่นโมเดล {data.manifest.model} · {data.manifest.modelRevision}
        </p>
        <p>
          รายละเอียดต้นทางเก็บเมื่อ {String(p.fetchedAt || "ยังไม่ระบุ")} ·{" "}
          {p.method === "live-dles"
            ? "อ่านจากต้นทางโดยตรง"
            : "ใช้ snapshot ของข้อมูลต้นทางที่เก็บไว้"}
        </p>
        {typeof p.requestUrl === "string" && (
          <ExternalLink href={p.requestUrl}>
            API ของ snapshot ที่ใช้
          </ExternalLink>
        )}
        <p>
          ค้นจากทุกระดับมาตรฐานด้วย Embedding โดยจัดอ้างอิงเอกสารก่อน เลือก 3
          มาตรฐานต่างกันมาคำนวณรายข้อ คะแนนคู่มาตรฐานคือค่าเฉลี่ย cosine
          ของคู่เกณฑ์ที่ได้อันดับหนึ่งของแต่ละข้อกำหนด
        </p>
        <p>
          เปอร์เซ็นต์นี้ไม่ใช่ความน่าจะเป็นว่าถูกต้อง ไม่ใช่ร้อยละสมรรถนะที่ผ่าน
          และไม่ใช้ตัดสินหน่วยกิตอัตโนมัติ
        </p>
        <p>
          SHA-256 รายวิชา: <code>{d.courseHash}</code>
        </p>
        <p>
          SHA-256 ผลคำนวณ: <code>{data.row.result_hash}</code>
        </p>
        <ExternalLink href="https://huggingface.co/intfloat/multilingual-e5-small">
          หลักการและข้อจำกัดของโมเดล E5
        </ExternalLink>
      </section>
    </>
  );
}
