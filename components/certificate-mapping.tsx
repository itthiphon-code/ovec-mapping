"use client";
import { useState } from "react";
import Link from "next/link";
import {
  Award,
  ArrowRight,
  ArrowLeft,
  Search,
  Printer,
  ShieldCheck,
  FileText,
} from "lucide-react";
import {
  PageTitle,
  useResource,
  Loading,
  ErrorBox,
  Empty,
  ExternalLink,
  Badge,
} from "./ui";
import {
  certificateResult,
  orderCertificateResults,
  type CertificateIndex,
  type CertificateFile,
  type CertificateLevel,
} from "@/lib/certificate-matcher";
import type { BulkDetail } from "@/lib/bulk-types";
const basisLabels: Record<string, string> = {
  DIRECT_CODE: "รหัส UoC ตรงกับเอกสารรายวิชา",
  DOCUMENT_TITLE: "ชื่อมาตรฐานอยู่ในเอกสารรายวิชา",
  EMBEDDING: "เสนอจากความหมายข้อความ",
};

export function CertificateSearch() {
  const [search, setSearch] = useState(""),
    [q, setQ] = useState(""),
    [page, setPage] = useState(1);
  const resource = useResource<{
    manifest: Omit<CertificateIndex, "items">;
    items: CertificateIndex["items"];
    total: number;
  }>(`certificates?${new URLSearchParams({ q, page: String(page) })}`);
  const data = resource.loading ? null : resource.data;
  return (
    <>
      <section className="certificate-hero panel">
        <div>
          <span className="eyebrow">YOUR CERTIFICATE → YOUR LEARNING PATH</span>
          <h1>
            ใบรับรองที่สอบผ่าน
            <br />
            <span>ใช้ขอเทียบวิชาอะไรได้บ้าง</span>
          </h1>
          <p>
            เลือกมาตรฐาน ระดับ และหน่วยสมรรถนะที่ระบุในใบรับรองของคุณ
            <br />
            ระบบค้นรายวิชาที่เกี่ยวข้องให้ พร้อมหลักฐานประกอบการพิจารณาเทียบโอน
          </p>
          <a className="button primary" href="#certificate-search">
            ค้นจากใบรับรองของฉัน <ArrowRight size={18} />
          </a>
        </div>
        <div className="certificate-visual" aria-hidden="true">
          <Award size={56} />
          <strong>ใบรับรองมาตรฐานวิชาชีพ</strong>
          <span>มาตรฐาน · ระดับ · UoC ที่สอบผ่าน</span>
          <div className="certificate-flow">
            <span>หลักฐาน</span>
            <ArrowRight size={18} />
            <span>รายวิชา</span>
          </div>
        </div>
      </section>
      <div className="application-journey">
        {[
          "เลือกใบรับรองที่สอบผ่าน",
          "ดูรายวิชาที่เกี่ยวข้อง",
          "ยื่นหลักฐานให้ผู้เชี่ยวชาญ",
        ].map((t, i) => (
          <div key={t}>
            <span>{i + 1}</span>
            <strong>{t}</strong>
          </div>
        ))}
      </div>
      <section className="panel certificate-search" id="certificate-search">
        <h2>1. มาตรฐานในใบรับรองของคุณ</h2>
        <p className="muted">
          ค้นชื่ออาชีพหรือสาขาตามใบรับรอง TPQI เช่น ไฟฟ้า งานเชื่อม
          หรือเทคโนโลยีสารสนเทศ
        </p>
        <form
          className="certificate-search-form no-print"
          onSubmit={(e) => {
            e.preventDefault();
            setQ(search);
            setPage(1);
          }}
        >
          <label className="sr-only" htmlFor="certificate-query">
            ชื่ออาชีพหรือสาขาในใบรับรอง
          </label>
          <input
            id="certificate-query"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="พิมพ์ชื่ออาชีพหรือสาขาในใบรับรอง…"
            maxLength={160}
          />
          <button className="button primary">
            <Search size={18} />
            ค้นหามาตรฐาน
          </button>
        </form>
        <ErrorBox message={resource.error} />
        {resource.loading ? (
          <Loading />
        ) : data ? (
          <>
            <p className="muted">
              พบ {data.total.toLocaleString()} มาตรฐาน · คัดกรองจาก{" "}
              {data.manifest.courses.toLocaleString()} รายวิชาไว้แล้ว
            </p>
            <div className="certificate-grid">
              {data.items.map((s) => (
                <Link
                  className="certificate-choice"
                  href={`/certificates/${s.id}`}
                  key={s.id}
                >
                  <Award size={24} />
                  <div>
                    <strong>{s.title}</strong>
                    <p>{s.category}</p>
                    <small>
                      {s.levels.join(" · ") || "ยังไม่มีระดับในเอกสาร"}
                    </small>
                  </div>
                  <ArrowRight size={18} />
                </Link>
              ))}
            </div>
            {!data.total && (
              <Empty
                title="ไม่พบชื่อมาตรฐานนี้"
                description="ลองค้นด้วยชื่ออาชีพหรือคำสั้น ๆ ตามใบรับรอง การไม่พบผลไม่ได้หมายความว่าเทียบโอนไม่ได้"
              />
            )}
            <div className="certificate-pagination no-print">
              <button
                className="button secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                ก่อนหน้า
              </button>
              <span>
                หน้า {page} / {Math.max(1, Math.ceil(data.total / 24))}
              </span>
              <button
                className="button secondary"
                disabled={page * 24 >= data.total}
                onClick={() => setPage((p) => p + 1)}
              >
                ถัดไป
              </button>
            </div>
          </>
        ) : null}
      </section>
      <div className="notice">
        <ShieldCheck size={22} />
        <span>
          ผลค้นหาเป็นรายวิชาที่เสนอให้พิจารณาเทียบโอน
          การตรวจใบรับรองและอนุมัติหน่วยกิตต้องดำเนินการโดยผู้เชี่ยวชาญและสถานศึกษา
        </span>
      </div>
    </>
  );
}
export function CertificateDetail({ id }: { id: string }) {
  const resource = useResource<CertificateFile>(`certificates/${id}`);
  const [levelKey, setLevelKey] = useState("");
  const data = resource.loading ? null : resource.data;
  const levelIndex = levelKey === "" ? -1 : Number(levelKey);
  return (
    <>
      <Link className="back-link no-print" href="/">
        <ArrowLeft size={17} /> เลือกมาตรฐานอื่น
      </Link>
      <PageTitle
        eyebrow="CERTIFICATE TO COURSE"
        title={data?.standard.title || "รายวิชาจากใบรับรอง"}
        description="ระบุขอบเขตที่สอบผ่านจริงตามใบรับรอง เพื่อค้นรายวิชาที่เสนอให้พิจารณาเทียบโอน"
      />
      <ErrorBox message={resource.error} />
      {resource.loading ? (
        <Loading />
      ) : data ? (
        <>
          <section className="panel certificate-search">
            <h2>2. ระดับในใบรับรอง</h2>
            <label>
              เลือกระดับที่สอบผ่าน
              <select
                value={levelKey}
                onChange={(e) => setLevelKey(e.target.value)}
              >
                <option value="">เลือกระดับตามใบรับรอง</option>
                {data.results.map((l, i) => (
                  <option key={i} value={i}>
                    {l.levelName}
                  </option>
                ))}
              </select>
            </label>
            <ExternalLink href={data.standard.sourceUrl}>
              เปิดแหล่งมาตรฐานต้นฉบับ
            </ExternalLink>
          </section>
          {levelIndex >= 0 && data.results[levelIndex] && (
            <CertificateScope
              key={`${id}:${levelIndex}`}
              file={data}
              level={data.results[levelIndex]}
              levelIndex={levelIndex}
            />
          )}
        </>
      ) : null}
    </>
  );
}
function CertificateScope({
  file,
  level,
  levelIndex,
}: {
  file: CertificateFile;
  level: CertificateLevel;
  levelIndex: number;
}) {
  const units = file.standard.levels[levelIndex].units;
  const [selected, setSelected] = useState<string[]>([]),
    [courseLevel, setCourseLevel] = useState(""),
    [q, setQ] = useState("");
  const allResults = level.courses
    .map((c) => certificateResult(c, level, selected))
    .sort(orderCertificateResults);
  const results = allResults.filter(
    (r) =>
      (!courseLevel || r.course.summary.level === courseLevel) &&
      `${r.course.summary.code} ${r.course.summary.nameTh} ${r.course.summary.deptName}`.includes(
        q.trim(),
      ),
  );
  return (
    <>
      <section className="panel certificate-search">
        <h2>3. หน่วยสมรรถนะที่สอบผ่าน</h2>
        <p>
          เลือกเฉพาะ UoC ที่ปรากฏในใบรับรองหรือเอกสารแนบ หากใบรับรองไม่ระบุหน่วย
          ให้ผู้เชี่ยวชาญตรวจขอบเขตก่อน
        </p>
        <div className="certificate-actions no-print">
          <button
            className="button secondary"
            onClick={() =>
              setSelected([...new Set(units.map((u) => u.uoc_code))])
            }
          >
            ใบรับรองครอบคลุมทุกหน่วยในระดับนี้
          </button>
          <button className="button ghost" onClick={() => setSelected([])}>
            ล้างการเลือก
          </button>
        </div>
        <div className="certificate-units">
          {units.map((u, i) => (
            <label key={`${u.uoc_code}:${i}`} className="certificate-unit">
              <input
                type="checkbox"
                checked={selected.includes(u.uoc_code)}
                onChange={(e) =>
                  setSelected((prev) =>
                    e.target.checked
                      ? [...prev, u.uoc_code]
                      : prev.filter((x) => x !== u.uoc_code),
                  )
                }
              />
              <span>
                <strong>{u.uoc_code}</strong> {u.uoc_desc}
                {!level.criteria.some((pc) => pc.unit === u.uoc_code) && (
                  <small>ยังไม่มีเกณฑ์ PC สำหรับคำนวณ</small>
                )}
              </span>
            </label>
          ))}
        </div>
        <p role="status">
          เลือก {selected.length} หน่วย · {file.standard.title} ·{" "}
          {level.levelName}
        </p>
      </section>
      {!selected.length ? (
        <Empty
          title="เลือกหน่วยที่สอบผ่าน เพื่อแสดงรายวิชา"
          description="ระบบจะใช้เฉพาะขอบเขตที่คุณเลือกเป็นหลักฐานในการจับคู่"
        />
      ) : (
        <>
          <section className="panel certificate-search">
            <div className="certificate-results-heading">
              <div>
                <span className="eyebrow">COURSES TO CONSIDER</span>
                <h2>รายวิชาที่เสนอให้พิจารณาเทียบโอน</h2>
              </div>
              <button
                className="button secondary no-print"
                onClick={() => window.print()}
              >
                <Printer size={18} />
                พิมพ์ผล
              </button>
            </div>
            <div className="notice warning">
              <ShieldCheck size={21} />
              <span>
                <strong>ยังไม่ใช่ผลอนุมัติเทียบโอน</strong> ·
                เปอร์เซ็นต์คือความคล้ายของข้อความจาก Embedding
                ไม่ใช่เปอร์เซ็นต์หน่วยกิตหรือโอกาสผ่าน
                ผู้เชี่ยวชาญยังต้องตรวจใบรับรอง ฉบับมาตรฐาน และการปฏิบัติงานจริง
              </span>
            </div>
            <div className="two-columns no-print">
              <label>
                ระดับรายวิชา
                <select
                  value={courseLevel}
                  onChange={(e) => setCourseLevel(e.target.value)}
                >
                  <option value="">ปวช. และ ปวส.</option>
                  <option>ปวช.</option>
                  <option>ปวส.</option>
                </select>
              </label>
              <label>
                ค้นในผลรายวิชา
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="รหัสวิชา ชื่อวิชา หรือสาขา"
                />
              </label>
            </div>
            <p className="muted">
              แสดง {results.length} จาก {level.courses.length}{" "}
              วิชาที่คัดไว้สำหรับระดับนี้ · จัดอ้างอิงเอกสารก่อนคะแนนความคล้าย
              <br />
              อาจมีรายวิชาอื่นที่เกี่ยวข้องนอกชุดนี้
              การไม่พบผลยังไม่ใช่ข้อสรุปว่าเทียบโอนไม่ได้
            </p>
            <p className="certificate-print-scope">
              มาตรฐาน: {file.standard.title} · {level.levelName}
              <br />
              UoC ที่ผู้ใช้ระบุว่าสอบผ่าน: {selected.join(", ")}
              <br />
              สถานะใบรับรอง: ยังไม่ได้ตรวจยืนยัน
            </p>
            {results.map((r) => (
              <CertificateCourseResult
                key={`${selected.join("|")}:${r.course.id}`}
                result={r}
                file={file}
                level={level}
                selected={selected}
              />
            ))}
            {!results.length && (
              <Empty
                title="ไม่มีรายวิชาในชุดผลนี้"
                description="อาจมีวิชาอื่นนอกชุดคัดกรอง หรือข้อมูลมาตรฐานยังไม่พอ ให้ผู้เชี่ยวชาญตรวจค้นเพิ่มเติมได้"
              />
            )}
            <details className="certificate-method">
              <summary>วิธีคำนวณและขอบเขตของผล</summary>
              <p>
                คัดกรองครบ 6,277 รายวิชาที่มีข้อมูลด้วย multilingual-e5-small
                แล้วเก็บ 20
                วิชาต่อระดับและทุกวิชาที่มีรหัสหรือชื่อมาตรฐานอ้างอิงตรง คำนวณ
                PC แยกตาม UoC
                และจัดอันดับใหม่ภายในชุดนี้เมื่อเปลี่ยนหน่วยที่เลือก
                จึงอาจมีวิชาอื่นที่เกี่ยวข้องนอกชุดผล
              </p>
              <p>
                ค่าเฉลี่ย cosine × 100 ของ PC
                ที่ใกล้กับผลลัพธ์การเรียนรู้และสมรรถนะรายวิชา โดยใช้เฉพาะ UoC
                ที่เลือกและให้น้ำหนักลำดับแก่รหัสอ้างอิงก่อน ข้อมูลต้นฉบับช่วง
                9–11 กันยายน 2569 คะแนนยังไม่ได้สอบเทียบกับคำตัดสินผู้เชี่ยวชาญ
              </p>
              <p>
                รอบคำนวณ: {file.runId} · ต้นฉบับ: {file.sourceRunId}
              </p>
            </details>
          </section>
        </>
      )}
    </>
  );
}
function CertificateCourseResult({
  result: r,
  file,
  level,
  selected,
}: {
  result: ReturnType<typeof certificateResult>;
  file: CertificateFile;
  level: CertificateLevel;
  selected: string[];
}) {
  const [open, setOpen] = useState(false);
  const source = useResource<BulkDetail>(
    open
      ? `certificates/${file.standard.id}/course?courseId=${encodeURIComponent(r.course.id)}`
      : null,
  );
  const note = `ผลค้นจากใบรับรอง: ${file.standard.title} / ${level.levelName}\nUoC ที่ผู้ยื่นระบุว่าสอบผ่าน: ${selected.join(", ")}\nสาขารายวิชา: ${r.course.summary.deptCode} ${r.course.summary.deptName}\nรอบคำนวณ: ${file.runId}\nยังไม่ได้ตรวจใบรับรองหรืออนุมัติเทียบโอน`;
  return (
    <article className="certificate-result">
      <div className="certificate-result-top">
        <div>
          <Badge>{basisLabels[r.basis]}</Badge>
          <h3>
            {r.course.summary.code} · {r.course.summary.nameTh}
          </h3>
          <p>
            {r.course.summary.level} · {r.course.summary.deptName} ·{" "}
            ทฤษฎี–ปฏิบัติ–หน่วยกิต: {r.course.summary.credit}
          </p>
        </div>
        <div className="certificate-score">
          <strong>{r.score === null ? "—" : `${r.score.toFixed(1)}%`}</strong>
          <span>ความคล้าย Embedding</span>
        </div>
      </div>
      {r.mismatch && (
        <p className="certificate-gap">
          ต้องตรวจเพิ่ม: ระดับหรือ UoC ที่รายวิชาอ้างอิงไม่ตรงกับระดับใบรับรอง
        </p>
      )}
      {!!r.missingUnits.length && (
        <p className="certificate-gap">
          หน่วยที่รายวิชาอ้างอิงแต่คุณยังไม่ได้เลือก:{" "}
          {r.missingUnits.join(", ")}
        </p>
      )}
      {r.score === null && (
        <p className="certificate-gap">
          หน่วยที่เลือกยังไม่มี PC เพียงพอสำหรับคำนวณ
        </p>
      )}
      <div className="certificate-actions no-print">
        <button
          className="button secondary"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <FileText size={17} />
          {open ? "ปิดหลักฐานรายข้อ" : "ดูหลักฐานและสิ่งที่ต้องตรวจ"}
        </button>
        <Link
          className="button ghost"
          href={`/applications?${new URLSearchParams({ course: r.course.summary.code, note: note.slice(0, 5000) })}`}
        >
          เตรียมคำร้องวิชานี้ <ArrowRight size={16} />
        </Link>
      </div>
      {open && (
        <div className="certificate-evidence">
          <p>
            <strong>ข้อที่ต้องให้ผู้เชี่ยวชาญตรวจ:</strong>{" "}
            ความแท้และขอบเขตใบรับรอง ฉบับหลักสูตร หลักฐานปฏิบัติ/ประเมิน
            และเกณฑ์ความปลอดภัย
            การจับคู่ด้านล่างยังไม่ยืนยันว่าผ่านผลลัพธ์รายวิชาแล้ว
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>ข้อกำหนดรายวิชา</th>
                  <th>PC ภายใน UoC ที่เลือก</th>
                  <th>ความคล้าย</th>
                </tr>
              </thead>
              <tbody>
                {r.matches.map((m) => (
                  <tr key={m.target.id}>
                    <td>
                      <strong>{m.target.kind}</strong>
                      <p>{m.target.text}</p>
                      <small>{m.target.locator}</small>
                    </td>
                    <td>
                      {m.criterion ? (
                        <>
                          <strong>
                            {m.criterion.unit} / {m.criterion.eoc}
                          </strong>
                          <p>{m.criterion.text}</p>
                          <small>{m.criterion.locator}</small>
                          {/ปฏิบัติ|ติดตั้ง|ทดสอบ|ซ่อม|บำรุง|ตรวจสอบ/.test(
                            m.target.text,
                          ) &&
                            /อธิบาย|ความรู้|เข้าใจ/.test(m.criterion.text) && (
                              <p className="certificate-gap">
                                PC นี้กล่าวถึงความรู้หรือการอธิบาย
                                ต้องตรวจหลักฐานปฏิบัติเพิ่มตามข้อกำหนดรายวิชา
                              </p>
                            )}
                          {/ปลอดภัย|อันตราย|ฉุกเฉิน/.test(
                            m.target.text + m.criterion.text,
                          ) && (
                            <p className="certificate-gap">
                              ต้องตรวจหลักฐานด้านความปลอดภัย
                            </p>
                          )}
                        </>
                      ) : (
                        "ยังไม่มี PC ในหน่วยที่เลือก"
                      )}
                    </td>
                    <td>{m.score === null ? "—" : `${m.score.toFixed(1)}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ErrorBox message={source.error} />
          {source.loading ? (
            <Loading />
          ) : source.data?.course ? (
            <details>
              <summary>เอกสารรายวิชาและแหล่งอ้างอิง</summary>
              <ExternalLink href={source.data.course.pdfUrl}>
                เปิด PDF รายวิชา หน้า {source.data.course.pdfPage}
              </ExternalLink>
              {[
                ["อ้างอิงมาตรฐาน", source.data.course.standardRef],
                ["ผลลัพธ์การเรียนรู้", source.data.course.learningOutcomes],
                ["สมรรถนะรายวิชา", source.data.course.competencies],
                ["จุดประสงค์รายวิชา", source.data.course.objectives],
                ["คำอธิบายรายวิชา", source.data.course.description],
              ].map(([title, text]) => (
                <div key={title}>
                  <h4>{title}</h4>
                  <p style={{ whiteSpace: "pre-line" }}>
                    {text || "ไม่ระบุในแหล่งข้อมูล"}
                  </p>
                </div>
              ))}
              {source.data.course.courseName !== r.course.summary.nameTh && (
                <p className="certificate-gap">
                  ชื่อในฉบับรายละเอียด: {source.data.course.courseName} ·
                  ต่างจากชื่อในดัชนี ต้องตรวจฉบับเอกสาร
                </p>
              )}
              <small>SHA-256 ผลต้นฉบับ: {r.course.sourceHash}</small>
            </details>
          ) : null}
        </div>
      )}
    </article>
  );
}
