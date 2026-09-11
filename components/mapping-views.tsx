"use client";
import {
  AutomaticAnalysis,
  StandardRecommendations,
} from "./automatic-analysis";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  Search,
  ArrowRight,
  ArrowLeft,
  GitCompareArrows,
  Save,
  Send,
  ShieldCheck,
  Printer,
  FileText,
  Layers3,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  AlertTriangle,
  Clock3,
  Check,
} from "lucide-react";
import {
  api,
  useResource,
  PageTitle,
  Badge,
  Loading,
  ErrorBox,
  Empty,
  ExternalLink,
  date,
} from "./ui";
import { coverage } from "@/lib/policy";
import {
  roleLabels,
  statusLabels,
  type User,
  type Mapping,
  type MappingPayload,
  type CatalogItem,
  type CourseDetail,
  type StandardDetail,
  type Review,
  type MappingRow,
  type RowStatus,
} from "@/lib/types";

export function MappingsView({
  user,
  review = false,
}: {
  user: User | null;
  review?: boolean;
}) {
  const { data, error, loading } = useResource<{ items: Mapping[] }>(
    "mappings",
  );
  const [filter, setFilter] = useState(review ? "IN_REVIEW" : "ALL"),
    [q, setQ] = useState("");
  const items = (data?.items || []).filter(
    (m) => (filter === "ALL" || m.status === filter) && m.title.includes(q),
  );
  return (
    <>
      <PageTitle
        eyebrow={review ? "EXPERT REVIEW" : "EVIDENCE-BASED MAPPING"}
        title={review ? "พื้นที่ผู้เชี่ยวชาญ" : "ตารางเทียบสมรรถนะ"}
        description={
          review
            ? "ตรวจความสอดคล้องจากหลักฐาน ลงความเห็น และรับรองฉบับที่ตรวจแล้ว"
            : "จัดการความเชื่อมโยงระหว่างมาตรฐาน TPQI กับข้อกำหนดรายวิชา"
        }
        action={
          !review && (
            <Link href="/mappings/new" className="button primary">
              <Plus size={18} />
              สร้างตารางเทียบ
            </Link>
          )
        }
      />
      {review && (
        <div className="notice info">
          <ShieldCheck size={21} />
          <span>
            ความเห็นของผู้เชี่ยวชาญแยกจากข้อเสนอของระบบ ·
            ผู้จัดทำรับรองงานของตนเองไม่ได้
          </span>
        </div>
      )}
      <div className="panel section-heading">
        <div>
          <h3>ผลจับคู่ที่คำนวณพร้อมไว้แล้ว</h3>
          <p className="muted">
            เปิดผลทั้งคลังได้ทันที
            ก่อนเลือกคู่ไปจัดทำหลักฐานและมอบหมายผู้เชี่ยวชาญ
          </p>
        </div>
        <Link className="button secondary" href="/automatic">
          เปิดผลทั้งคลัง <ArrowRight size={16} />
        </Link>
      </div>
      <div className="filter-row">
        <div className="tabs">
          {[
            { id: "ALL", label: "ทั้งหมด" },
            { id: "DRAFT", label: "ฉบับร่าง" },
            { id: "IN_REVIEW", label: "รอผู้เชี่ยวชาญ" },
            { id: "APPROVED", label: "รับรองแล้ว" },
            { id: "PUBLISHED", label: "เผยแพร่แล้ว" },
          ].map((t) => (
            <button
              key={t.id}
              className={filter === t.id ? "selected" : ""}
              onClick={() => setFilter(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="search-input compact">
          <Search size={18} />
          <input
            placeholder="ค้นหางานเทียบ…"
            aria-label="ค้นหางานเทียบ"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>
      <ErrorBox message={error} />
      {loading ? (
        <Loading />
      ) : items.length ? (
        <div className="mapping-grid">
          {items.map((m) => {
            const p = JSON.parse(m.payload) as MappingPayload;
            const cov = coverage(p.rows);
            return (
              <Link
                href={`/mappings/${m.id}`}
                key={m.id}
                className="panel mapping-card"
              >
                <div className="mapping-top">
                  <span className="metric-icon teal">
                    <GitCompareArrows size={22} />
                  </span>
                  <Badge status={m.status} />
                </div>
                <h3>{m.title}</h3>
                <p>
                  {p.standard.title} · {p.levelName}
                </p>
                <div className="coverage-label">
                  <span>ข้อที่ผู้จัดทำระบุว่าครบ</span>
                  <strong>
                    {cov.full}/{cov.total} ข้อ
                  </strong>
                </div>
                <div className="progress-track">
                  <span style={{ width: `${cov.percentage || 0}%` }} />
                </div>
                <div className="mapping-footer">
                  <span>
                    ฉบับ {m.revision} · {date(m.updated_at)}
                  </span>
                  <ArrowRight size={17} />
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <Empty
          title={review ? "ยังไม่มีงานในคิวนี้" : "เริ่มต้นตารางเทียบแรก"}
          description={
            review
              ? "งานจะแสดงเมื่อผู้จัดทำส่งตรวจและคุณได้รับมอบหมาย โดยไม่สร้างผลรับรองสมมติ"
              : "เลือกหลักสูตรและมาตรฐานที่ต้องการเทียบ แล้วรวบรวมหลักฐานทีละข้อ"
          }
          action={
            !review && (
              <Link href="/mappings/new" className="button primary">
                <Plus size={17} />
                สร้างตารางเทียบ
              </Link>
            )
          }
        />
      )}{" "}
      {!user && (
        <div className="notice info">
          <ShieldCheck size={19} />
          เข้าสู่ระบบเพื่อดูงานของคุณและงานที่ได้รับมอบหมาย
        </div>
      )}
    </>
  );
}

function CatalogPicker({
  kind,
  value,
  onChange,
}: {
  kind: "course" | "standard";
  value: string;
  onChange: (id: string) => void;
}) {
  const [draft, setDraft] = useState(""),
    [q, setQ] = useState(""),
    [searching, setSearching] = useState(false);
  const { data, loading, error } = useResource<{
    items: CatalogItem[];
    source: string;
  }>(
    `catalog?kind=${kind}&q=${encodeURIComponent(q)}&page=1${q ? "" : "&local=1"}`,
  );
  return (
    <section className="panel picker-panel">
      <div className="section-heading">
        <h2>
          <span
            className={`metric-icon ${kind === "course" ? "blue" : "teal"}`}
          >
            {kind === "course" ? <BookOpen size={21} /> : <Layers3 size={21} />}
          </span>
          {kind === "course" ? "เลือกรายวิชา" : "เลือกมาตรฐาน TPQI"}
        </h2>
        <Badge>{kind === "course" ? "01" : "02"}</Badge>
      </div>
      <form
        className="picker-search"
        onSubmit={(e) => {
          e.preventDefault();
          setQ(draft);
          setSearching(true);
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label={`ค้นหา${kind === "course" ? "รายวิชา" : "มาตรฐาน"}`}
          placeholder={
            kind === "course"
              ? "รหัสวิชา หรือชื่อรายวิชา"
              : "ชื่ออาชีพ หรือสาขาวิชาชีพ"
          }
        />
        <button className="icon-button" aria-label="ค้นหา" type="submit">
          <Search size={20} />
        </button>
      </form>
      <ErrorBox message={error} />
      {loading ? (
        <Loading />
      ) : (
        <div className="picker-results">
          {data?.items.map((item) => (
            <button
              className={`picker-item ${item.id === value ? "selected" : ""}`}
              key={item.id}
              onClick={() => onChange(item.id)}
            >
              <span className="selection-radio">
                {item.id === value && <Check size={12} />}
              </span>
              <span>
                <strong>
                  {kind === "course" && `${item.code} · `}
                  {item.title}
                </strong>
                <small>
                  {item.level} · {item.department || item.category}
                </small>
              </span>
            </button>
          ))}
          {!data?.items.length && (
            <p className="muted">ไม่พบรายการ ลองเปลี่ยนคำค้น</p>
          )}
        </div>
      )}
      <p className="field-hint">
        {searching
          ? "เลือกจากรายการที่ค้นพบ"
          : "รายการเริ่มต้นจากข้อมูลที่เก็บไว้ ค้นหาเพื่อดูเพิ่มเติมจากต้นทาง"}
      </p>
    </section>
  );
}
export function NewMapping({
  user,
  automatic = false,
}: {
  user: User | null;
  automatic?: boolean;
}) {
  const params = useSearchParams(),
    router = useRouter();
  const [courseId, setCourseId] = useState(params.get("course") || ""),
    [standardId, setStandardId] = useState(params.get("standard") || ""),
    [level, setLevel] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const course = useResource<{ data: CourseDetail }>(
    courseId ? `catalog/${encodeURIComponent(courseId)}` : null,
  );
  const standard = useResource<{ data: StandardDetail }>(
    standardId ? `catalog/${encodeURIComponent(standardId)}` : null,
  );
  const create = async () => {
    setError("");
    setBusy(true);
    try {
      const r = await api<{ id: string }>("mappings", {
        method: "POST",
        body: JSON.stringify({ courseId, standardId, levelName: level }),
      });
      router.push(`/mappings/${r.id}${automatic ? "?tab=automatic" : ""}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Link href="/mappings" className="back-link">
        <ArrowLeft size={16} />
        กลับไปงานเทียบ
      </Link>
      <PageTitle
        eyebrow="NEW MAPPING"
        title={
          automatic
            ? "เปรียบเทียบความสอดคล้องอัตโนมัติ"
            : "สร้างตารางเทียบสมรรถนะ"
        }
        description="เลือกรายวิชา → ค้นคู่จากเอกสาร → เลือกมาตรฐานและระดับ → วิเคราะห์รายข้อ"
      />
      <div className="stepper">
        <span className="current">
          <b>1</b>เลือกข้อมูล
        </span>
        <i />
        <span>
          <b>2</b>ตรวจหลักฐาน
        </span>
        <i />
        <span>
          <b>3</b>เทียบรายข้อ
        </span>
        <i />
        <span>
          <b>4</b>ส่งผู้เชี่ยวชาญ
        </span>
      </div>
      {!user && (
        <div className="notice info">
          คุณสำรวจข้อมูลได้ทันที · เข้าสู่ระบบก่อนบันทึกตารางเทียบ
        </div>
      )}
      <StandardRecommendations
        key={courseId}
        courseId={courseId}
        canRun={!!user && ["admin", "editor"].includes(user.role)}
        blockedReason={
          !user
            ? "เข้าสู่ระบบด้วยบัญชีที่ได้รับสิทธิ์ เพื่อค้นและบันทึกผลอัตโนมัติ"
            : !["admin", "editor"].includes(user.role)
              ? "บัญชีนี้ยังไม่มีสิทธิ์ผู้จัดทำตาราง กรุณาติดต่อผู้ดูแลระบบ"
              : undefined
        }
        signInHref={
          !user
            ? `/signin-with-chatgpt?return_to=${encodeURIComponent((automatic ? "/automatic" : "/mappings/new") + (courseId ? `?course=${encodeURIComponent(courseId)}` : ""))}`
            : undefined
        }
        onSelect={(id, level) => {
          setStandardId(id);
          setLevel(level);
        }}
      />
      <div className="two-columns">
        <CatalogPicker kind="course" value={courseId} onChange={setCourseId} />
        <CatalogPicker
          kind="standard"
          value={standardId}
          onChange={(id) => {
            setStandardId(id);
            setLevel("");
          }}
        />
      </div>
      <ErrorBox message={course.error || standard.error || error} />
      {course.data && (
        <section className="panel reference-panel">
          <h3>
            <FileText size={19} /> อ้างอิงมาตรฐานในรายวิชาที่เลือก
          </h3>
          <p className="pre-line">
            {course.data.data.standardRef || "รายวิชายังไม่ระบุอ้างอิงมาตรฐาน"}
          </p>
          <ExternalLink
            href={
              course.data.data.pdfUrl + `#page=${course.data.data.pdfPage || 1}`
            }
          >
            เปิดเอกสารรายวิชา
          </ExternalLink>
        </section>
      )}
      <div className="panel selection-summary">
        <div>
          <h3>ตรวจรายการที่เลือก</h3>
          <p>
            {course.data?.data.courseName || "ยังไม่ได้เลือกรายวิชา"}{" "}
            <ArrowRight size={16} />{" "}
            {standard.data?.data.title || "ยังไม่ได้เลือกมาตรฐาน"}
          </p>
        </div>
        <div className="inline-actions">
          <select
            aria-label="เลือกระดับคุณวุฒิ"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
          >
            <option value="">เลือกระดับคุณวุฒิ</option>
            {standard.data?.data.levels.map((l) => (
              <option key={l.qualificationId}>{l.levelName}</option>
            ))}
          </select>
          <button
            className="button primary"
            disabled={
              !user ||
              !["admin", "editor"].includes(user.role) ||
              !course.data ||
              !standard.data ||
              !level ||
              busy
            }
            onClick={create}
          >
            {busy
              ? "กำลังสร้าง…"
              : automatic
                ? "สร้างตารางและไปวิเคราะห์"
                : "สร้างฉบับร่าง"}
            <ArrowRight size={17} />
          </button>
        </div>
      </div>
    </>
  );
}

type MappingResponse = {
  mapping: Mapping;
  reviews: Review[];
  history: {
    revision: number;
    hash: string;
    actor: string;
    created_at: string;
  }[];
};
export function MappingEditor({ id, user }: { id: string; user: User | null }) {
  const params = useSearchParams();
  const resource = useResource<MappingResponse>(`mappings/${id}`),
    members = useResource<{ items: User[] }>(
      user && !["learner", "viewer"].includes(user.role) ? "members" : null,
    );
  const [payload, setPayload] = useState<MappingPayload | null>(null),
    [active, setActive] = useState(0),
    [tab, setTab] = useState(
      params.get("tab") === "automatic" ? "automatic" : "table",
    ),
    [dirty, setDirty] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [busy, setBusy] = useState(false),
    [comment, setComment] = useState("");
  const [loadedKey, setLoadedKey] = useState(""),
    [extraTarget, setExtraTarget] = useState("");
  if (resource.data) {
    const key = `${resource.data.mapping.id}:${resource.data.mapping.revision}:${resource.data.mapping.status}`;
    if (key !== loadedKey) {
      setLoadedKey(key);
      setPayload(JSON.parse(resource.data.mapping.payload));
      setDirty(false);
    }
  }
  useEffect(() => {
    if (!dirty) return;
    const leave = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", leave);
    return () => window.removeEventListener("beforeunload", leave);
  }, [dirty]);
  if (resource.loading && !payload) return <Loading />;
  if (resource.error) return <ErrorBox message={resource.error} />;
  if (!payload || !resource.data) return null;
  const m = resource.data.mapping;
  const editable =
    user?.email === m.owner &&
    ["DRAFT", "CHANGES_REQUESTED"].includes(m.status);
  const row = payload.rows[Math.min(active, payload.rows.length - 1)];
  const level = payload.standard.levels.find(
    (l) => l.levelName === payload.levelName,
  );
  const cov = coverage(payload.rows);
  const update = (patch: Partial<MappingPayload>) => {
    setPayload({ ...payload, ...patch });
    setDirty(true);
    setSuccess("");
  };
  const updateRow = (patch: Partial<MappingRow>) =>
    update({
      rows: payload.rows.map((r, i) => (i === active ? { ...r, ...patch } : r)),
    });
  const perform = async (
    action: string,
    extra: Record<string, unknown> = {},
  ) => {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await api(`mappings/${id}${action ? `/${action}` : ""}`, {
        method: action ? "POST" : "PATCH",
        body: JSON.stringify(
          action
            ? { revision: m.revision, ...extra }
            : {
                revision: m.revision,
                rows: payload.rows,
                referenceStatus: payload.referenceStatus,
                referenceNote: payload.referenceNote,
                scopeConfirmed: payload.scopeConfirmed,
                sourceVerified: payload.sourceVerified,
                reviewers: payload.reviewers,
                policyNote: payload.policyNote,
              },
        ),
      });
      setSuccess(action ? "ทำรายการสำเร็จ" : "บันทึกฉบับใหม่แล้ว");
      resource.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Link href="/mappings" className="back-link">
        <ArrowLeft size={16} />
        งานเทียบสมรรถนะ
      </Link>
      <PageTitle
        eyebrow={`MAPPING WORKSPACE · VERSION ${m.revision}`}
        title={m.title}
        description={`${payload.standard.title} · ${payload.levelName}`}
        action={
          <div className="inline-actions">
            <Link className="button secondary" href={`/reports?mapping=${id}`}>
              <Printer size={17} />
              พิมพ์
            </Link>
            {editable && (
              <button
                className="button primary"
                onClick={() => perform("")}
                disabled={busy || !dirty}
              >
                <Save size={17} />
                {busy ? "กำลังบันทึก…" : "บันทึกฉบับร่าง"}
              </button>
            )}
          </div>
        }
      />
      <div className="workspace-status">
        <Badge status={m.status} />
        <span>
          <Clock3 size={15} />
          อัปเดต {date(m.updated_at)}
        </span>
        {dirty && (
          <span className="unsaved-dot">มีการแก้ไขที่ยังไม่บันทึก</span>
        )}
        <span className="push-right">
          ข้อที่ระบุว่าครบ{" "}
          <strong>
            {cov.full}/{cov.total}
          </strong>{" "}
          · หลักฐานไม่พอ {cov.unknown}
        </span>
      </div>
      <ErrorBox message={error} />
      {success && (
        <div className="notice success" role="status">
          <CheckCircle2 size={18} />
          {success}
        </div>
      )}
      {payload.referenceStatus !== "VERIFIED" && (
        <div className="notice warning">
          <AlertTriangle size={21} />
          <span>
            <strong>ตรวจอ้างอิงมาตรฐานก่อนรับรอง</strong>
            <br />
            {payload.referenceNote}
          </span>
        </div>
      )}
      <div className="tabs workspace-tabs">
        {[
          { id: "table", label: "ตารางเทียบรายข้อ" },
          { id: "automatic", label: "วิเคราะห์อัตโนมัติ" },
          { id: "sources", label: "เอกสารและขอบเขต" },
          { id: "review", label: "ผู้เชี่ยวชาญและการรับรอง" },
          { id: "history", label: "ประวัติฉบับ" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={tab === t.id ? "selected" : ""}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "automatic" && (
        <AutomaticAnalysis
          key={id}
          id={id}
          revision={m.revision}
          hash={m.content_hash}
          rows={payload.rows}
          editable={!!editable}
          dirty={dirty}
          onApplied={resource.reload}
        />
      )}
      {tab === "table" && (
        <div className="mapping-workbench">
          <section className="panel target-list">
            <div className="section-heading">
              <h3>ข้อกำหนดรายวิชา</h3>
              <Badge>{payload.rows.length} ข้อ</Badge>
            </div>
            <p className="field-hint">
              เลือกความเชื่อมโยงที่ต้องการตรวจ · นับข้อกำหนดที่ไม่ซ้ำ
            </p>
            {payload.rows.map((r, i) => (
              <button
                key={r.id}
                className={`target-item ${i === active ? "selected" : ""}`}
                onClick={() => setActive(i)}
              >
                <span className="target-index">{r.id}</span>
                <span>
                  <small>{r.targetKind}</small>
                  <strong>{r.target}</strong>
                  <Badge status={r.status} />
                </span>
                <ChevronRight size={15} />
              </button>
            ))}
          </section>
          <section className="panel row-editor">
            <div className="section-heading">
              <h2>หลักฐานความสอดคล้อง</h2>
              <span className="code-pill">{row.id}</span>
            </div>
            <div className="target-quote">
              <BookOpen size={20} />
              <p>{row.target}</p>
            </div>
            <fieldset disabled={!editable || busy}>
              <label>
                เลือกเกณฑ์การปฏิบัติงาน TPQI ที่เกี่ยวข้อง
                <select
                  value={
                    row.criterion
                      ? `${row.uoc}|${row.eoc}|${row.criterion}`
                      : ""
                  }
                  onChange={(e) => {
                    const [uoc, eoc, ...pc] = e.target.value.split("|");
                    const criterion = pc.join("|");
                    updateRow({
                      uoc,
                      eoc,
                      criterion,
                      standardQuote: criterion,
                      standardLocator: `${payload.levelName} / UoC ${uoc} / EoC ${eoc}`,
                    });
                  }}
                >
                  <option value="">เลือก UoC / EoC / เกณฑ์การปฏิบัติงาน</option>
                  {level?.units.map((u) => (
                    <optgroup
                      key={u.uoc_code}
                      label={`${u.uoc_code} ${u.uoc_desc}`}
                    >
                      {u.elements.flatMap((e) =>
                        e.pc_items.map((pc, i) => (
                          <option
                            key={`${e.eoc_code}-${i}`}
                            value={`${u.uoc_code}|${e.eoc_code}|${pc}`}
                          >
                            {e.eoc_code} · {pc}
                          </option>
                        )),
                      )}
                    </optgroup>
                  ))}
                </select>
              </label>
              <div className="two-columns evidence-pair">
                <div className="evidence-card">
                  <span className="eyebrow">TPQI EVIDENCE</span>
                  <p>{row.standardQuote || "ยังไม่ได้เลือกหลักฐานมาตรฐาน"}</p>
                  <label>
                    ตำแหน่งในเอกสารมาตรฐาน
                    <input
                      value={row.standardLocator}
                      onChange={(e) =>
                        updateRow({ standardLocator: e.target.value })
                      }
                      placeholder="หน้าเล่ม / หัวข้อ / รหัส PC"
                    />
                  </label>
                </div>
                <div className="evidence-card">
                  <span className="eyebrow">COURSE EVIDENCE</span>
                  <p>{row.courseQuote}</p>
                  <label>
                    ตำแหน่งในเอกสารรายวิชา
                    <input
                      value={row.courseLocator}
                      onChange={(e) =>
                        updateRow({ courseLocator: e.target.value })
                      }
                      placeholder="หน้าไฟล์ / หน้าเล่ม / หัวข้อ"
                    />
                  </label>
                </div>
              </div>
              <div className="two-columns">
                <label>
                  ผลการเทียบ
                  <select
                    value={row.status}
                    onChange={(e) =>
                      updateRow({ status: e.target.value as RowStatus })
                    }
                  >
                    {[
                      "INSUFFICIENT_EVIDENCE",
                      "FULL",
                      "PARTIAL",
                      "NONE",
                      "CONFLICT",
                    ].map((s) => (
                      <option value={s} key={s}>
                        {statusLabels[s]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="checkbox-label critical-check">
                  <input
                    type="checkbox"
                    checked={row.critical}
                    onChange={(e) => updateRow({ critical: e.target.checked })}
                  />
                  เป็นข้อกำหนดสำคัญ / ความปลอดภัย
                </label>
              </div>
              <label>
                เหตุผลการเทียบ
                <textarea
                  rows={3}
                  placeholder="อธิบายงาน บริบท ระดับ และเงื่อนไขที่สอดคล้องหรือแตกต่าง"
                  value={row.reason}
                  onChange={(e) => updateRow({ reason: e.target.value })}
                />
              </label>
              <label>
                ช่องว่างและการเรียนรู้ / ประเมินเพิ่มเติม
                <textarea
                  rows={3}
                  placeholder="ระบุสิ่งที่ยังขาด ไม่ใช้คะแนนความคล้ายแทนข้อสรุป"
                  value={row.gap}
                  onChange={(e) => updateRow({ gap: e.target.value })}
                />
              </label>
            </fieldset>
            <div className="evidence-links">
              {editable && (
                <button
                  className="button secondary small"
                  onClick={() => {
                    update({
                      rows: [
                        ...payload.rows,
                        {
                          ...row,
                          id: `T${crypto.randomUUID().slice(0, 8)}`,
                          status: "INSUFFICIENT_EVIDENCE",
                          uoc: "",
                          eoc: "",
                          criterion: "",
                          standardQuote: "",
                          standardLocator: "",
                          reason: "",
                          gap: "",
                        },
                      ],
                    });
                    setActive(payload.rows.length);
                  }}
                >
                  <Plus size={15} />
                  เชื่อมเกณฑ์เพิ่มกับข้อกำหนดนี้
                </button>
              )}
              <ExternalLink href={row.standardUrl}>
                เปิดมาตรฐาน TPQI
              </ExternalLink>
              <ExternalLink
                href={row.courseUrl + `#page=${payload.course.pdfPage || 1}`}
              >
                เปิดรายวิชาต้นฉบับ
              </ExternalLink>
            </div>
            <div className="row-navigation">
              <button
                className="button secondary"
                disabled={active === 0}
                onClick={() => setActive(active - 1)}
              >
                <ArrowLeft size={16} />
                ข้อก่อนหน้า
              </button>
              <span>
                {active + 1} / {payload.rows.length}
              </span>
              <button
                className="button secondary"
                disabled={active === payload.rows.length - 1}
                onClick={() => setActive(active + 1)}
              >
                ข้อถัดไป
                <ArrowRight size={16} />
              </button>
            </div>
          </section>
        </div>
      )}
      {tab === "sources" && (
        <div className="two-columns">
          <section className="panel text-section">
            <h2>เอกสารต้นฉบับและขอบเขต</h2>
            <h3>อ้างอิงในหลักสูตร</h3>
            <p>{payload.course.standardRef || "ไม่ระบุ"}</p>
            <ExternalLink
              href={
                payload.course.pdfUrl + `#page=${payload.course.pdfPage || 1}`
              }
            >
              เปิดหลักสูตรต้นฉบับ
            </ExternalLink>
            <h3>มาตรฐานที่เลือก</h3>
            <p>
              {payload.standard.title} · {payload.levelName}
              <br />
              ฉบับตามต้นทาง {date(payload.standard.publicDate)}
            </p>
            <ExternalLink href={payload.standard.sourceUrl}>
              เปิดต้นทางมาตรฐาน
            </ExternalLink>
            <hr />
            <p className="muted">
              เอกสารและข้อมูลนี้ตรึงอยู่กับฉบับงาน
              ไม่เปลี่ยนตามการค้นหาครั้งใหม่
            </p>
          </section>
          <section className="panel">
            <h2>ยืนยันก่อนส่งตรวจ</h2>
            <fieldset disabled={!editable}>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={payload.sourceVerified}
                  onChange={(e) => update({ sourceVerified: e.target.checked })}
                />
                ตรวจเอกสารต้นฉบับทั้งสองฝั่งแล้ว
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={payload.scopeConfirmed}
                  onChange={(e) => update({ scopeConfirmed: e.target.checked })}
                />
                ตรวจแล้วว่าข้อกำหนดรายวิชาในตารางครบตามขอบเขต
              </label>
              <label>
                สถานะอ้างอิง
                <select
                  value={payload.referenceStatus}
                  onChange={(e) => update({ referenceStatus: e.target.value })}
                >
                  <option value="VERSION_UNRESOLVED">รอตรวจรหัสและฉบับ</option>
                  <option value="NO_REFERENCE">ไม่มีอ้างอิงโดยตรง</option>
                  <option value="LEVEL_MISMATCH">ระดับไม่ตรงกัน</option>
                  <option value="VERIFIED">ยืนยันรหัส ระดับ และฉบับแล้ว</option>
                </select>
              </label>
              <label>
                เหตุผลและเอกสารที่ใช้ยืนยัน
                <textarea
                  rows={5}
                  value={payload.referenceNote}
                  onChange={(e) => update({ referenceNote: e.target.value })}
                  placeholder="ระบุรหัสเต็ม ชื่ออาชีพ ระดับ ฉบับ และที่มาของการตรวจ"
                />
              </label>
              <label>
                ขอบเขตและข้อจำกัดการใช้ตาราง
                <textarea
                  rows={4}
                  value={payload.policyNote}
                  onChange={(e) => update({ policyNote: e.target.value })}
                />
              </label>
            </fieldset>
          </section>
        </div>
      )}
      {tab === "review" && (
        <div className="two-columns">
          <section className="panel">
            <h2>ผู้เชี่ยวชาญที่ได้รับมอบหมาย</h2>
            <p className="muted">
              ต้องมีผู้ตรวจ TPQI และผู้ตรวจหลักสูตรคนละคน
              มีขอบเขตและการแต่งตั้งที่ยังมีผล
            </p>
            <fieldset disabled={!editable}>
              {(members.data?.items || [])
                .filter(
                  (u) => u.role.startsWith("expert") && u.email !== m.owner,
                )
                .map((u) => (
                  <label className="reviewer-option" key={u.email}>
                    <input
                      type="checkbox"
                      checked={payload.reviewers.includes(u.email)}
                      onChange={(e) =>
                        update({
                          reviewers: e.target.checked
                            ? [...payload.reviewers, u.email]
                            : payload.reviewers.filter((x) => x !== u.email),
                        })
                      }
                    />
                    <span className="avatar">{u.name.slice(0, 1)}</span>
                    <span>
                      <strong>{u.name}</strong>
                      <small>
                        {roleLabels[u.role]} · {u.scope}
                      </small>
                      <small>ถึง {date(u.valid_until || undefined)}</small>
                    </span>
                  </label>
                ))}
            </fieldset>
            {!members.data?.items.some((u) => u.role.startsWith("expert")) && (
              <Empty
                title="ยังไม่มีผู้เชี่ยวชาญที่แต่งตั้ง"
                description="ผู้ดูแลเพิ่มบัญชี ขอบเขต และวันสิ้นสุดการแต่งตั้งได้ในหน้าจัดการระบบ"
              />
            )}
            {editable && (
              <button
                className="button primary"
                disabled={busy || dirty}
                onClick={() => perform("submit")}
              >
                <Send size={17} />
                ส่งผู้เชี่ยวชาญตรวจ
              </button>
            )}
            {dirty && <p className="field-hint">บันทึกฉบับร่างก่อนส่งตรวจ</p>}
          </section>
          <section className="panel">
            <h2>ความเห็นและการรับรอง</h2>
            {resource.data.reviews.length ? (
              resource.data.reviews.map((r) => (
                <div key={r.id} className="review-opinion">
                  <div>
                    <ShieldCheck size={19} />
                    <strong>{r.reviewer}</strong>
                    <Badge>
                      {r.verdict === "ACCEPT"
                        ? "รับรองความเห็น"
                        : r.verdict === "CHANGES"
                          ? "ส่งแก้"
                          : "ไม่รับรอง"}
                    </Badge>
                  </div>
                  <p>{r.comment}</p>
                  <small>
                    ฉบับ {r.revision} · {date(r.created_at)}
                  </small>
                </div>
              ))
            ) : (
              <p className="muted">ยังไม่มีความเห็นจากผู้เชี่ยวชาญ</p>
            )}
            {user &&
              payload.reviewers.includes(user.email) &&
              m.status === "IN_REVIEW" && (
                <div className="review-form">
                  <label>
                    ความเห็นต่อฉบับนี้
                    <textarea
                      rows={4}
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="อธิบายสิ่งที่ตรวจและข้อสรุปอย่างน้อย 15 ตัวอักษร"
                    />
                  </label>
                  <div className="inline-actions">
                    <button
                      className="button secondary"
                      disabled={busy || comment.length < 15}
                      onClick={() =>
                        perform("review", { verdict: "CHANGES", comment })
                      }
                    >
                      ส่งกลับแก้ไข
                    </button>
                    <button
                      className="button primary"
                      disabled={busy || comment.length < 15}
                      onClick={() =>
                        perform("review", { verdict: "ACCEPT", comment })
                      }
                    >
                      <Check size={17} />
                      รับรองความเห็น
                    </button>
                  </div>
                </div>
              )}
            {user?.role === "approver" && m.status === "IN_REVIEW" && (
              <button
                className="button primary"
                disabled={busy}
                onClick={() => perform("approve")}
              >
                <ShieldCheck size={18} />
                อนุมัติตารางฉบับนี้
              </button>
            )}
            {user?.role === "admin" && m.status === "APPROVED" && (
              <button
                className="button primary"
                disabled={busy}
                onClick={() => perform("publish")}
              >
                เผยแพร่ฉบับรับรอง
                <ArrowRight size={17} />
              </button>
            )}
            <div className="notice info">
              <ShieldCheck size={19} />
              <span>การรับรองตารางยังไม่ใช่การอนุมัติหน่วยกิตรายบุคคล</span>
            </div>
          </section>
        </div>
      )}
      {tab === "sources" && editable && (
        <section className="panel">
          <h2>เพิ่มข้อกำหนดจากข้อความรายวิชา</h2>
          <p className="muted">
            คัดข้อความจากผลลัพธ์ จุดประสงค์ สมรรถนะ หรือคำอธิบายรายวิชาด้านบน
            เพื่อระบุขอบเขตที่ต้องเทียบเพิ่มเติม
          </p>
          <label>
            ข้อความข้อกำหนด
            <textarea
              rows={3}
              value={extraTarget}
              onChange={(e) => setExtraTarget(e.target.value)}
              placeholder="วางข้อความจากรายวิชาต้นฉบับ"
            />
          </label>
          <button
            className="button secondary"
            disabled={busy || !extraTarget.trim()}
            onClick={() => {
              const target = extraTarget.trim();
              const texts = [
                payload.course.learningOutcomes,
                payload.course.objectives,
                payload.course.competencies,
                payload.course.description,
              ];
              if (!texts.some((t) => t?.includes(target))) {
                setError("ข้อความข้อกำหนดต้องอยู่ในรายวิชาต้นฉบับ");
                return;
              }
              update({
                rows: [
                  ...payload.rows,
                  {
                    ...payload.rows[0],
                    id: `T${crypto.randomUUID().slice(0, 8)}`,
                    target,
                    targetKind: "ข้อกำหนดเพิ่มเติมจากรายวิชา",
                    courseQuote: target,
                    status: "INSUFFICIENT_EVIDENCE",
                    uoc: "",
                    eoc: "",
                    criterion: "",
                    standardQuote: "",
                    standardLocator: "",
                    reason: "",
                    gap: "",
                    critical: false,
                  },
                ],
              });
              setExtraTarget("");
              setError("");
            }}
          >
            <Plus size={17} />
            เพิ่มเข้าตารางเทียบ
          </button>
        </section>
      )}
      {tab === "history" && (
        <section className="panel">
          <h2>ประวัติฉบับและลายนิ้วมือข้อมูล</h2>
          <div className="timeline">
            {resource.data.history.map((h) => (
              <div key={h.revision}>
                <span className="timeline-dot" />
                <strong>ฉบับ {h.revision}</strong>
                <p>
                  {h.actor} · {date(h.created_at)}
                </p>
                <code>{h.hash}</code>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
