"use client";
import { useState } from "react";
import Link from "next/link";
import {
  Search,
  Award,
  BookOpen,
  ArrowRight,
  FileCheck2,
  ArrowLeft,
  ShieldCheck,
} from "lucide-react";
import { useResource, ErrorBox, Loading, Empty, Badge } from "./ui";
import {
  LearnerSearchIntro,
  LearnerJourney,
  LearnerDocumentHint,
} from "./learner-portal";
import type { CertificateIndex } from "@/lib/certificate-matcher";
import type { BulkCourseRow, BulkDetail } from "@/lib/bulk-types";

export function LearnerSearch() {
  const [mode, setMode] = useState<"certificate" | "course">("certificate"),
    [input, setInput] = useState(""),
    [q, setQ] = useState(""),
    [page, setPage] = useState(1),
    [category, setCategory] = useState(""),
    [level, setLevel] = useState("");
  const certificates = useResource<{
    items: CertificateIndex["items"];
    total: number;
    categories: string[];
    manifest: Omit<CertificateIndex, "items">;
  }>(
    mode === "certificate"
      ? `certificates?${new URLSearchParams({ q, page: String(page), pageSize: "12", category })}`
      : null,
  );
  const courses = useResource<{ items: BulkCourseRow[]; total: number }>(
    mode === "course"
      ? `bulk?${new URLSearchParams({ q, page: String(page), level, searchIn: "course" })}`
      : null,
  );
  const resource = mode === "certificate" ? certificates : courses;
  const total = resource.loading ? 0 : resource.data?.total || 0,
    size = mode === "certificate" ? 12 : 25;
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  function switchMode(value: "certificate" | "course") {
    setMode(value);
    setInput("");
    setQ("");
    setPage(1);
    setSelectedCourse(null);
  }
  function search(value: string) {
    setInput(value);
    setQ(value);
    setPage(1);
    setSelectedCourse(null);
  }
  return (
    <>
      <LearnerSearchIntro />
      <section
        className="learner-search-panel panel"
        aria-labelledby="learner-search-title"
      >
        <div
          className="learner-search-tabs"
          role="tablist"
          aria-label="เลือกวิธีค้นหา"
          onKeyDown={(e) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key))
              return;
            e.preventDefault();
            const next =
              e.key === "Home"
                ? "certificate"
                : e.key === "End"
                  ? "course"
                  : mode === "certificate"
                    ? "course"
                    : "certificate";
            switchMode(next);
            e.currentTarget
              .querySelector<HTMLButtonElement>(`#${next}-tab`)
              ?.focus();
          }}
        >
          <button
            id="certificate-tab"
            role="tab"
            aria-selected={mode === "certificate"}
            aria-controls="learner-search-results"
            onClick={() => switchMode("certificate")}
          >
            <Award size={20} />
            <span>
              ฉันมีใบรับรองแล้ว<small>ค้นจากชื่ออาชีพหรือสาขา</small>
            </span>
          </button>
          <button
            id="course-tab"
            role="tab"
            aria-selected={mode === "course"}
            aria-controls="learner-search-results"
            onClick={() => switchMode("course")}
          >
            <BookOpen size={20} />
            <span>
              ฉันมีรายวิชาที่อยากเทียบ
              <small>ดูใบรับรองที่อาจใช้ประกอบได้</small>
            </span>
          </button>
        </div>
        <div className="learner-search-body">
          <h2 id="learner-search-title">
            {mode === "certificate"
              ? "ใบรับรองของคุณเป็นอาชีพหรือสาขาอะไร"
              : "ต้องการเทียบรายวิชาอะไร"}
          </h2>
          <p>
            {mode === "certificate"
              ? "ใช้ชื่ออาชีพตามใบรับรอง TPQI หรือค้นด้วยคำสั้น ๆ เช่น ไฟฟ้า เชื่อม หรืออาหาร"
              : "ค้นรหัสวิชา ชื่อวิชา หรือสาขาในหลักสูตร ปวช./ปวส. แล้วเปิดดูใบรับรองที่ระบบคัดไว้"}
          </p>
          <form
            className="learner-search-form"
            onSubmit={(e) => {
              e.preventDefault();
              search(input);
            }}
          >
            <div className="learner-search-input">
              <Search size={21} />
              <label className="sr-only" htmlFor="learner-query">
                {mode === "certificate"
                  ? "ชื่ออาชีพหรือสาขาในใบรับรอง"
                  : "รหัสหรือชื่อรายวิชา"}
              </label>
              <input
                id="learner-query"
                key={mode}
                value={input}
                maxLength={160}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  mode === "certificate"
                    ? "เช่น ไฟฟ้า อาหาร เทคโนโลยีสารสนเทศ"
                    : "เช่น 30104-2022 หรือ หม้อแปลงไฟฟ้า"
                }
              />
            </div>
            {mode === "certificate" ? (
              <label className="learner-filter">
                <span className="sr-only">สาขามาตรฐาน</span>
                <select
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">ทุกสาขาอาชีพ</option>
                  {certificates.data?.categories?.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="learner-filter">
                <span className="sr-only">ระดับรายวิชา</span>
                <select
                  value={level}
                  onChange={(e) => {
                    setLevel(e.target.value);
                    setPage(1);
                    setSelectedCourse(null);
                  }}
                >
                  <option value="">ทุกระดับหลักสูตร</option>
                  <option>ปวช.</option>
                  <option>ปวส.</option>
                </select>
              </label>
            )}
            <button className="button primary" type="submit">
              ค้นหา <ArrowRight size={18} />
            </button>
          </form>
          <div className="learner-search-examples">
            <span>ลองค้น</span>
            {(mode === "certificate"
              ? ["ไฟฟ้า", "อาหาร", "เชื่อม", "สารสนเทศ"]
              : ["หม้อแปลงไฟฟ้า", "การบัญชี", "งานเชื่อม"]
            ).map((word) => (
              <button key={word} onClick={() => search(word)}>
                {word}
              </button>
            ))}
            {(q || category || level) && (
              <button
                className="learner-clear"
                onClick={() => {
                  search("");
                  setCategory("");
                  setLevel("");
                }}
              >
                ล้างการค้นหา
              </button>
            )}
          </div>
        </div>
      </section>
      <div className="learner-search-note">
        <ShieldCheck size={18} />
        <span>
          ค้นหาได้ก่อนเตรียมเอกสาร ผลเป็นข้อเสนอให้พิจารณา
          ยังไม่ใช่การอนุมัติหน่วยกิต
        </span>
        <Link href="/help">
          เข้าใจผลค้นหา <ArrowRight size={14} />
        </Link>
      </div>
      <section
        id="learner-search-results"
        role="tabpanel"
        aria-labelledby={
          mode === "certificate" ? "certificate-tab" : "course-tab"
        }
        className="learner-results"
      >
        <div className="learner-section-heading">
          <div>
            <h2>
              {mode === "certificate"
                ? "ค้นหาใบรับรองที่เกี่ยวข้อง"
                : "รายวิชาที่ค้นพบ"}
            </h2>
            <p role="status">
              {resource.loading
                ? "กำลังค้นหา…"
                : `พบ ${total.toLocaleString()} ${mode === "certificate" ? "มาตรฐานอาชีพ" : "รายวิชา"}${q ? ` สำหรับ “${q}”` : "ในคลังข้อมูล"}`}
            </p>
          </div>
          <Link href="/prepare">
            <FileCheck2 size={17} />
            ต้องแนบเอกสารอะไร
          </Link>
        </div>
        <ErrorBox message={resource.error} />
        {resource.error && (
          <button className="button secondary" onClick={resource.reload}>
            ลองค้นหาอีกครั้ง
          </button>
        )}
        {resource.loading ? (
          <Loading />
        ) : !resource.error && !total ? (
          <Empty
            title="ยังไม่พบรายการที่ค้นหา"
            description="ลองคำสั้นลง ตรวจรหัสวิชา หรือล้างตัวกรอง หากยังไม่พบ ให้เจ้าหน้าที่ช่วยค้นเพิ่มเติมได้"
            action={
              <Link href="/help" className="button secondary">
                ดูวิธีขอคำแนะนำ
              </Link>
            }
          />
        ) : mode === "certificate" ? (
          <div className="learner-result-grid">
            {certificates.data?.items.map((s) => (
              <Link
                key={s.id}
                className="learner-result-card"
                href={`/certificates/${s.id}`}
              >
                <div className="learner-result-card-top">
                  <span className="learner-icon">
                    <Award size={23} />
                  </span>
                  <span className="learner-tag">มาตรฐาน TPQI</span>
                </div>
                <h3>{s.title}</h3>
                <p>{s.category}</p>
                <div className="learner-levels">
                  {s.levels.map((l, i) => (
                    <span key={`${l}:${i}`}>{l}</span>
                  ))}
                </div>
                <span className="learner-card-action">
                  เลือกระดับและดูรายวิชา <ArrowRight size={18} />
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <>
            {selectedCourse ? (
              <CourseCertificates
                key={selectedCourse}
                id={selectedCourse}
                onClose={() => setSelectedCourse(null)}
              />
            ) : (
              <div className="learner-result-grid">
                {courses.data?.items.map((c) => (
                  <article key={c.id} className="learner-result-card">
                    <div className="learner-result-card-top">
                      <span className="learner-icon blue">
                        <BookOpen size={23} />
                      </span>
                      <span className="learner-tag">{c.level}</span>
                    </div>
                    <small className="learner-course-code">{c.code}</small>
                    <h3>{c.title}</h3>
                    <p>{c.department}</p>
                    {c.pair_count ? (
                      <button
                        className="learner-card-action"
                        onClick={() => setSelectedCourse(c.course_id)}
                      >
                        ดูใบรับรองที่เกี่ยวข้อง <ArrowRight size={18} />
                      </button>
                    ) : (
                      <p className="learner-small-note">
                        {c.status === "OUT_OF_SCOPE"
                          ? "หลักสูตรระดับนี้ยังไม่อยู่ในขอบเขตคำนวณ"
                          : "ข้อมูลยังไม่พอสำหรับเสนอใบรับรอง ให้เจ้าหน้าที่ตรวจเพิ่มเติม"}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            )}
          </>
        )}
        {!resource.loading && total > size && !selectedCourse && (
          <div className="certificate-pagination no-print">
            <button
              className="button secondary"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              ก่อนหน้า
            </button>
            <span>
              หน้า {page} / {Math.ceil(total / size)}
            </span>
            <button
              className="button secondary"
              disabled={page * size >= total}
              onClick={() => setPage((p) => p + 1)}
            >
              ถัดไป
            </button>
          </div>
        )}
      </section>
      <LearnerDocumentHint />
      <LearnerJourney />
      <section className="learner-bottom-help">
        <div>
          <h2>ไม่แน่ใจว่าใบที่มีใช่หรือไม่</h2>
          <p>อ่านวิธีดูระดับ หน่วยที่สอบผ่าน และสิ่งที่ควรรู้ก่อนยื่นคำร้อง</p>
        </div>
        <Link className="button secondary" href="/help">
          ดูคำแนะนำสำหรับผู้เริ่มต้น <ArrowRight size={17} />
        </Link>
      </section>
    </>
  );
}

function CourseCertificates({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  const resource = useResource<{ detail: BulkDetail }>(
    `bulk/${encodeURIComponent(id)}`,
  );
  const data = resource.loading ? null : resource.data?.detail;
  return (
    <section className="panel learner-course-detail">
      <button className="button ghost" onClick={onClose}>
        <ArrowLeft size={16} />
        กลับรายการวิชา
      </button>
      <ErrorBox message={resource.error} />
      {resource.loading ? (
        <Loading />
      ) : data ? (
        <>
          <h2>
            {data.summary.code} · {data.summary.nameTh}
          </h2>
          <p>
            {data.summary.level} · {data.summary.deptName}
          </p>
          <p className="learner-small-note">
            ใบรับรองด้านล่างเป็น {data.pairs.length}{" "}
            ตัวเลือกที่คัดไว้สำหรับรายวิชานี้ อาจมีตัวเลือกอื่นนอกชุดผล
            รายการนี้ยังไม่ใช่ผลอนุมัติ หากยังไม่มีใบรับรอง
            ให้สถานศึกษาตรวจแนวทางก่อนตัดสินใจเข้าสอบ
          </p>
          <div className="learner-result-grid">
            {data.pairs.map((pair) => (
              <article key={pair.id} className="learner-result-card">
                <Badge>
                  {pair.basis === "DIRECT_CODE"
                    ? "พบรหัสตรงในเอกสารรายวิชา"
                    : pair.basis === "DOCUMENT_TITLE"
                      ? "พบชื่อในเอกสารรายวิชา"
                      : "เสนอจากความหมายข้อความ"}
                </Badge>
                <h3>{pair.title}</h3>
                <p>{pair.level}</p>
                {pair.mismatch && (
                  <p className="certificate-gap">
                    ระดับหรือหน่วยอ้างอิงไม่ตรง ต้องให้ผู้เชี่ยวชาญตรวจ
                  </p>
                )}
                <Link
                  className="learner-card-action"
                  href={`/certificates/${pair.standardId}`}
                >
                  ดูขอบเขตใบรับรอง <ArrowRight size={17} />
                </Link>
              </article>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
