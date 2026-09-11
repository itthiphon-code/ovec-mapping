"use client";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Layers3,
  GitCompareArrows,
  ShieldCheck,
  FileText,
  Search,
  Plus,
  Check,
  ChevronRight,
  ArrowLeft,
  CircleCheck,
  Sparkles,
  Clock3,
  FileCheck2,
} from "lucide-react";
import {
  useResource,
  PageTitle,
  Badge,
  Empty,
  ErrorBox,
  Loading,
  ExternalLink,
  date,
  number,
} from "./ui";
import type {
  User,
  Mapping,
  CatalogItem,
  CourseDetail,
  StandardDetail,
  SourceCourse,
  SourceStandard,
} from "@/lib/types";

type DashboardData = {
  states: { status: string; count: number }[];
  catalogue: { kind: string; count: number }[];
  sourceStats: {
    courses: { subjects: number; syncedAt: string };
    standards: { books: number; units: number; generatedAt: string };
  };
  organization: string;
  recent: Mapping[];
};
export function Dashboard({ user }: { user: User | null }) {
  const { data, error } = useResource<DashboardData>("dashboard");
  const published =
    data?.states
      .filter((s) => ["APPROVED", "PUBLISHED"].includes(s.status))
      .reduce((a, s) => a + s.count, 0) || 0;
  return (
    <>
      <div className="welcome-row">
        <span>
          <span className="status-dot" /> พื้นที่เชื่อมโยงมาตรฐานและการเรียนรู้
        </span>
        <span className="muted">
          {data?.organization || "ระบบเทียบเคียงสมรรถนะวิชาชีพ"}
        </span>
      </div>
      <section className="hero">
        <div className="hero-copy">
          <div className="hero-eyebrow">
            <Sparkles size={15} /> หลักฐานชัดเจน · เชื่อมโยงอย่างมั่นใจ
          </div>
          <h1>
            เชื่อมสมรรถนะ
            <br />
            สู่<span>โอกาสใหม่</span>ของการเรียนรู้
          </h1>
          <p>
            เทียบมาตรฐานคุณวุฒิวิชาชีพ TPQI กับรายวิชาอาชีวศึกษา
            <br className="desktop-break" /> ด้วยเอกสารต้นฉบับ
            และการรับรองจากผู้เชี่ยวชาญ
          </p>
          <div className="hero-actions">
            <Link className="button primary" href="/automatic">
              <Sparkles size={18} />
              เริ่มวิเคราะห์อัตโนมัติ
              <ArrowRight size={18} />
            </Link>
            <Link className="button white" href="/guide">
              รู้จักขั้นตอนการทำงาน
              <ArrowUpRight size={17} />
            </Link>
          </div>
          <div className="hero-proof">
            <span>
              <Check size={15} /> UoC / EoC / PC
            </span>
            <span>
              <Check size={15} /> อ้างอิงรายข้อ
            </span>
            <span>
              <Check size={15} /> ตรวจสอบย้อนกลับได้
            </span>
          </div>
        </div>
        <div className="hero-scene" aria-hidden="true">
          <div className="scene-orbit orbit-one" />
          <div className="scene-orbit orbit-two" />
          <div className="scene-floor" />
          <div className="floating-label label-top">
            <ShieldCheck size={19} />
            <div>
              Evidence first<small>เอกสารต้นฉบับมาก่อน</small>
            </div>
            <span className="tiny-check">
              <Check size={12} />
            </span>
          </div>
          <div className="book book-teal">
            <div className="book-cover">
              <Layers3 size={34} />
              <span>TPQI</span>
              <small>มาตรฐานคุณวุฒิวิชาชีพ</small>
              <div className="book-line" />
              <b>UoC · EoC · PC</b>
            </div>
          </div>
          <div className="book book-blue">
            <div className="book-cover">
              <BookOpen size={33} />
              <span>VEC</span>
              <small>รายวิชาอาชีวศึกษา</small>
              <div className="book-line" />
              <b>Learning outcomes</b>
            </div>
          </div>
          <div className="connection-cube">
            <GitCompareArrows size={35} />
          </div>
          <div className="floating-label label-bottom">
            <span className="round-icon mint">
              <CircleCheck size={22} />
            </span>
            <div>
              เชื่อมโยงด้วยหลักฐาน<small>ผู้เชี่ยวชาญเป็นผู้ยืนยัน</small>
            </div>
          </div>
          <div className="sphere sphere-one" />
          <div className="sphere sphere-two" />
        </div>
      </section>
      <ErrorBox message={error} />
      <div className="metric-grid">
        {[
          {
            label: "รายวิชาในแหล่งข้อมูล",
            value: data?.sourceStats?.courses.subjects,
            icon: BookOpen,
            color: "blue",
            detail: "ปวช. / ปวส. และข้อมูลที่ต้นทางรวบรวม",
          },
          {
            label: "มาตรฐาน TPQI",
            value: data?.sourceStats?.standards.books,
            icon: Layers3,
            color: "teal",
            detail: "อาชีพและระดับคุณวุฒิจากแหล่งข้อมูล",
          },
          {
            label: "หน่วยสมรรถนะ UoC",
            value: data?.sourceStats?.standards.units,
            icon: GitCompareArrows,
            color: "violet",
            detail: "รายการหน่วยสมรรถนะที่ต้นทางรายงาน",
          },
          {
            label: "ตารางที่รับรองในระบบ",
            value: published,
            icon: ShieldCheck,
            color: "amber",
            detail: "ผ่านขั้นตอนการรับรองโดยผู้เชี่ยวชาญ",
          },
        ].map((m) => (
          <div className="metric-card" key={m.label}>
            <div>
              <span>{m.label}</span>
              <strong>{data ? number(m.value) : "—"}</strong>
              <small>{m.detail}</small>
            </div>
            <span className={`metric-icon ${m.color}`}>
              <m.icon size={23} />
            </span>
          </div>
        ))}
      </div>
      <div className="dashboard-columns">
        <section className="panel start-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">YOUR NEXT STEP</span>
              <h2>เริ่มต้นได้ง่าย ๆ</h2>
            </div>
            <Link className="text-link" href="/guide">
              ดูขั้นตอนทั้งหมด
              <ArrowRight size={16} />
            </Link>
          </div>
          <div className="quick-actions">
            {[
              {
                path: "/courses",
                icon: BookOpen,
                title: "ค้นหารายวิชา",
                description: "ดูผลลัพธ์การเรียนรู้และมาตรฐานที่อ้างอิง",
                color: "blue",
              },
              {
                path: "/standards",
                icon: Layers3,
                title: "สำรวจมาตรฐาน TPQI",
                description: "เจาะลึก UoC, EoC และเกณฑ์การปฏิบัติงาน",
                color: "teal",
              },
              {
                path: "/documents",
                icon: FileText,
                title: "จัดการเอกสารอ้างอิง",
                description: "รวบรวมหลักฐานไว้ในพื้นที่เดียว",
                color: "violet",
              },
            ].map((x) => (
              <Link className="quick-action" href={x.path} key={x.path}>
                <span className={`metric-icon ${x.color}`}>
                  <x.icon size={23} />
                </span>
                <span>
                  <strong>{x.title}</strong>
                  <small>{x.description}</small>
                </span>
                <ChevronRight size={18} />
              </Link>
            ))}
          </div>
        </section>
        <section className="journey-card">
          <span className="eyebrow">DOCUMENT → EVIDENCE → REVIEW</span>
          <h2>
            ความน่าเชื่อถือ
            <br />
            ในทุกขั้นตอน
          </h2>
          <div className="journey-steps">
            {[
              "ตรวจเอกสารต้นฉบับ",
              "เชื่อมข้อกำหนดรายข้อ",
              "ให้ผู้เชี่ยวชาญรับรอง",
            ].map((t, i) => (
              <div key={t}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                <strong>{t}</strong>
                {i < 2 && <div className="journey-line" />}
              </div>
            ))}
          </div>
          <Link href="/mappings/new" className="text-link">
            เริ่มเทียบสมรรถนะ
            <ArrowRight size={16} />
          </Link>
        </section>
      </div>
      <section className="panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">MAPPING WORKSPACE</span>
            <h2>งานเทียบสมรรถนะล่าสุด</h2>
          </div>
          <Link href="/mappings" className="text-link">
            ดูงานทั้งหมด
            <ArrowRight size={16} />
          </Link>
        </div>
        {data?.recent.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>รายวิชา / งานเทียบ</th>
                  <th>สถานะ</th>
                  <th>ฉบับ</th>
                  <th>อัปเดต</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.recent.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <strong>{m.title}</strong>
                    </td>
                    <td>
                      <Badge status={m.status} />
                    </td>
                    <td>v{m.revision}</td>
                    <td>{date(m.updated_at)}</td>
                    <td>
                      <Link
                        href={`/mappings/${m.id}`}
                        className="icon-link"
                        aria-label={`เปิด ${m.title}`}
                      >
                        <ArrowUpRight size={18} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="first-work">
            <span className="round-icon mint">
              <GitCompareArrows size={29} />
            </span>
            <div>
              <h3>
                {user
                  ? "พร้อมสร้างตารางเทียบแรกของคุณ"
                  : "ทุกตารางที่รับรอง เริ่มจากหลักฐานที่ดี"}
              </h3>
              <p>
                เลือกรายวิชาและมาตรฐานที่อ้างอิง แล้วค่อย ๆ
                ตรวจความสอดคล้องทีละข้อ
              </p>
            </div>
            <Link href="/mappings/new" className="button secondary">
              สร้างตารางเทียบ
              <Plus size={17} />
            </Link>
          </div>
        )}
      </section>
      <div className="source-footnote">
        <Clock3 size={14} /> ตัวเลขแหล่งข้อมูลตาม snapshot{" "}
        {date(data?.sourceStats?.courses.syncedAt)} ·
        ผลงานรับรองนับเฉพาะในระบบนี้
      </div>
    </>
  );
}

type SearchResult = {
  items: CatalogItem[];
  total: number;
  page: number;
  hasMore: boolean;
  source: string;
  fetchedAt: string;
};
export function CatalogView({ kind }: { kind: "course" | "standard" }) {
  const params = useSearchParams(),
    router = useRouter();
  const q = params.get("q") || "",
    page = Number(params.get("page")) || 1,
    level = params.get("level") || "";
  const [draft, setDraft] = useState(q);
  const { data, error, loading } = useResource<SearchResult>(
    `catalog?kind=${kind}&q=${encodeURIComponent(q)}&page=${page}&level=${encodeURIComponent(level)}`,
  );
  const navigate = (query: string, p = 1, l = level) =>
    router.push(
      `/${kind === "course" ? "courses" : "standards"}?${new URLSearchParams({ q: query, page: String(p), level: l })}`,
    );
  return (
    <>
      <PageTitle
        eyebrow={
          kind === "course"
            ? "VOCATIONAL COURSES"
            : "PROFESSIONAL QUALIFICATIONS"
        }
        title={
          kind === "course" ? "รายวิชาอาชีวศึกษา" : "มาตรฐานคุณวุฒิวิชาชีพ"
        }
        description={
          kind === "course"
            ? "เริ่มจากหลักสูตร ค้นหารายวิชาและเปิดเอกสารที่ใช้อ้างอิง"
            : "สำรวจมาตรฐาน TPQI ตามอาชีพ ระดับ และหน่วยสมรรถนะ"
        }
      />
      <form
        className="search-toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          navigate(draft);
        }}
      >
        <div className="search-input">
          <Search size={20} />
          <input
            aria-label="ค้นหารหัสหรือชื่อ"
            placeholder={
              kind === "course"
                ? "ค้นหารหัสวิชา ชื่อวิชา หรือสาขาวิชา…"
                : "ค้นหาชื่ออาชีพหรือสาขาวิชาชีพ…"
            }
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        </div>
        {kind === "course" && (
          <select
            aria-label="ระดับการศึกษา"
            value={level}
            onChange={(e) => navigate(q, 1, e.target.value)}
          >
            <option value="">ทุกระดับการศึกษา</option>
            <option>ปวช.</option>
            <option>ปวส.</option>
          </select>
        )}
        <button className="button primary" type="submit">
          ค้นหา
          <ArrowRight size={17} />
        </button>
      </form>
      <div className="result-summary">
        <span>
          พบ <strong>{number(data?.total)}</strong> รายการ
          {q && <> สำหรับ “{q}”</>}
        </span>
        <span className="data-status">
          <span
            className={`status-dot ${data?.source === "snapshot" ? "amber" : ""}`}
          />
          {data?.source === "snapshot"
            ? "แสดงข้อมูลที่เก็บไว้ · ต้นทางไม่พร้อม"
            : "เชื่อมต่อแหล่งข้อมูลจริง"}
        </span>
      </div>
      <ErrorBox message={error} />
      {loading ? (
        <Loading />
      ) : data?.items.length ? (
        <div className="catalog-grid">
          {data.items.map((item) => (
            <CatalogCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <Empty
          title="ยังไม่พบรายการที่ค้นหา"
          description="ลองใช้รหัส ชื่ออาชีพ หรือคำค้นที่สั้นลง"
        />
      )}
      <div className="pagination">
        <button
          className="button secondary"
          disabled={page <= 1 || loading}
          onClick={() => navigate(q, page - 1)}
        >
          <ArrowLeft size={16} />
          ก่อนหน้า
        </button>
        <span>หน้า {page}</span>
        <button
          className="button secondary"
          disabled={!data?.hasMore || loading}
          onClick={() => navigate(q, page + 1)}
        >
          ถัดไป
          <ArrowRight size={16} />
        </button>
      </div>
    </>
  );
}
function CatalogCard({ item }: { item: CatalogItem }) {
  const course = item.kind === "course";
  const raw = JSON.parse(item.payload) as SourceCourse & SourceStandard;
  return (
    <Link
      href={`/${course ? "courses" : "standards"}/${encodeURIComponent(item.id)}`}
      className="catalog-card"
    >
      <div className="catalog-card-top">
        <span className={`metric-icon ${course ? "blue" : "teal"}`}>
          {course ? <BookOpen size={22} /> : <Layers3 size={22} />}
        </span>
        <span className="code-pill">{course ? item.code : "TPQI"}</span>
        <ArrowUpRight className="card-arrow" size={18} />
      </div>
      <h3>{item.title}</h3>
      <p>{item.department || item.category}</p>
      <div className="catalog-card-bottom">
        <Badge>{course ? item.level : `${raw.unitCount || 0} UoC`}</Badge>
        <span>
          {course ? `${raw.credit} · ท–ป–น` : `${raw.elementCount || 0} EoC`}
        </span>
      </div>
    </Link>
  );
}
export function CatalogDetail({ id }: { id: string }) {
  const { data, error, loading } = useResource<{
    item: CatalogItem;
    data: CourseDetail | StandardDetail;
    cached: boolean;
  }>(`catalog/${encodeURIComponent(id)}`);
  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} />;
  if (!data) return null;
  const course = data.item.kind === "course";
  const c = data.data as CourseDetail,
    s = data.data as StandardDetail;
  return (
    <>
      <Link className="back-link" href={course ? "/courses" : "/standards"}>
        <ArrowLeft size={16} />
        กลับไปรายการ{course ? "รายวิชา" : "มาตรฐาน"}
      </Link>
      <PageTitle
        eyebrow={course ? c.courseCode : "TPQI STANDARD"}
        title={data.item.title}
        description={`${data.item.level} · ${data.item.department}`}
        action={
          <Link
            className="button primary"
            href={`/mappings/new?${course ? "course" : "standard"}=${encodeURIComponent(id)}`}
          >
            <GitCompareArrows size={18} />
            นำไปสร้างตารางเทียบ
          </Link>
        }
      />
      <div className="notice info">
        <FileCheck2 size={22} />
        <span>
          ข้อมูลจากแหล่งมาตรฐาน ใช้เป็นจุดเริ่มต้นในการเทียบ ·
          ตรวจเอกสารต้นฉบับและฉบับที่ใช้บังคับก่อนรับรอง
        </span>
      </div>
      {course ? (
        <div className="detail-columns">
          <div className="stack">
            {[
              { title: "อ้างอิงมาตรฐาน", text: c.standardRef, accent: true },
              {
                title: "ผลลัพธ์การเรียนรู้ระดับรายวิชา",
                text: c.learningOutcomes,
              },
              { title: "สมรรถนะรายวิชา", text: c.competencies },
              { title: "จุดประสงค์รายวิชา", text: c.objectives },
              { title: "คำอธิบายรายวิชา", text: c.description },
            ].map((section) => (
              <section
                className={`panel text-section ${section.accent ? "reference-panel" : ""}`}
                key={section.title}
              >
                <h2>{section.title}</h2>
                <p>{section.text || "ต้นทางยังไม่ระบุข้อมูล"}</p>
              </section>
            ))}
          </div>
          <aside className="stack">
            <section className="panel">
              <span className="metric-icon blue">
                <FileText size={25} />
              </span>
              <h3>เอกสารหลักสูตรต้นฉบับ</h3>
              <p className="muted">
                {c.pdfPage ? `หน้าไฟล์ ${c.pdfPage}` : "ตรวจตำแหน่งในเอกสาร"}
              </p>
              <ExternalLink
                href={c.pdfUrl + (c.pdfPage ? `#page=${c.pdfPage}` : "")}
              >
                เปิด PDF ต้นฉบับ
              </ExternalLink>
              <hr />
              <dl>
                <dt>ระดับการศึกษา</dt>
                <dd>{c.level}</dd>
                <dt>ทฤษฎี–ปฏิบัติ–หน่วยกิต</dt>
                <dd>{c.credit}</dd>
                <dt>เก็บข้อมูลเมื่อ</dt>
                <dd>{date(data.item.fetched_at)}</dd>
              </dl>
            </section>
            <section className="tip-card">
              <ShieldCheck size={24} />
              <h3>อ้างอิงตรง ≠ ครอบคลุมครบ</h3>
              <p>ต้องตรวจข้อกำหนดรายข้อ แม้หลักสูตรระบุชื่อมาตรฐานไว้แล้ว</p>
            </section>
          </aside>
        </div>
      ) : (
        <>
          <section className="panel standard-intro">
            <div>
              <h2>{s.category}</h2>
              <p className="muted">
                ประกาศตามข้อมูลต้นทาง {date(s.publicDate)}
              </p>
            </div>
            <ExternalLink href={s.sourceUrl}>
              เปิดแหล่งมาตรฐาน TPQI
            </ExternalLink>
          </section>
          <div className="stack">
            {s.levels.map((level) => (
              <details
                className="panel standard-level"
                key={level.qualificationId}
                open={s.levels.length === 1}
              >
                <summary>
                  <span className="round-icon mint">
                    <Layers3 size={22} />
                  </span>
                  <strong>{level.levelName}</strong>
                  <Badge>{level.units.length} หน่วยสมรรถนะ</Badge>
                  <ChevronRight size={19} />
                </summary>
                <div className="unit-list">
                  {level.units.map((unit, i) => (
                    <div className="unit" key={`${unit.uoc_code}-${i}`}>
                      <h3>
                        <span className="code-pill">{unit.uoc_code}</span>
                        {unit.uoc_desc}
                      </h3>
                      {unit.elements.map((element, j) => (
                        <details
                          className="element"
                          key={`${element.eoc_code}-${j}`}
                        >
                          <summary>
                            <span className="mono">{element.eoc_code}</span>{" "}
                            {element.eoc_desc}
                          </summary>
                          <div className="criterion-list">
                            <h4>เกณฑ์การปฏิบัติงาน</h4>
                            <ol>
                              {element.pc_items.map((pc, k) => (
                                <li key={k}>{pc}</li>
                              ))}
                            </ol>
                            <h4>วิธีการประเมินตามต้นทาง</h4>
                            <p>
                              {element.assess_items.join(" · ") || "ไม่ระบุ"}
                            </p>
                          </div>
                        </details>
                      ))}
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </>
      )}
    </>
  );
}
export function Guide() {
  return (
    <>
      <PageTitle
        eyebrow="GETTING STARTED"
        title="เริ่มต้นอย่างมั่นใจ"
        description="จากเอกสารต้นฉบับ สู่ตารางเทียบที่ตรวจสอบย้อนกลับได้"
      />
      <section className="panel text-section">
        <h2>ใช้การเปรียบเทียบอัตโนมัติ</h2>
        <ol>
          <li>
            เข้าสู่ระบบด้วยบัญชีที่ได้รับสิทธิ์ แล้วเปิดเมนู{" "}
            <Link href="/automatic">วิเคราะห์อัตโนมัติ</Link>
          </li>
          <li>ค้นรายวิชา แล้วคลิกชื่อรายวิชาในผลค้นหา</li>
          <li>
            กด “ค้นจากอ้างอิงรายวิชา” และเลือกมาตรฐานกับระดับที่เอกสารระบุ
          </li>
          <li>
            กด “สร้างตารางและไปวิเคราะห์” แล้วกด “เชื่อมอัตโนมัติด้วย Embedding”
            เพื่อแสดงเปอร์เซ็นต์และเชื่อมตารางร่าง
          </li>
          <li>
            ตรวจคู่ที่ระบบเชื่อมและเปอร์เซ็นต์ เปรียบเทียบเอกสารต้นทาง
            แล้วส่งผู้เชี่ยวชาญเมื่อจัดทำหลักฐานครบ
          </li>
        </ol>
        <p>
          ถ้าปุ่มยังใช้ไม่ได้ ให้ดูข้อความใต้ส่วนค้นอัตโนมัติ
          ระบบจะแจ้งว่าต้องเข้าสู่ระบบ เลือกรายวิชา หรือขอสิทธิ์ผู้จัดทำก่อน
        </p>
      </section>
      <div className="guide-grid">
        {[
          {
            icon: BookOpen,
            title: "01 · เลือกรายวิชา",
            text: "ตรวจรหัส สาขา ระดับ และปีหลักสูตร อ่านผลลัพธ์ สมรรถนะ และมาตรฐานที่อ้างอิง",
            href: "/courses",
          },
          {
            icon: Layers3,
            title: "02 · ตรวจมาตรฐาน",
            text: "เลือกอาชีพและระดับ TPQI ให้ตรง ตรวจฉบับเอกสารและ UoC/EoC/เกณฑ์ที่เกี่ยวข้อง",
            href: "/standards",
          },
          {
            icon: GitCompareArrows,
            title: "03 · เชื่อมหลักฐานรายข้อ",
            text: "ระบุสิ่งที่ตรง ตำแหน่งหลักฐาน และช่องว่าง ข้อที่ยังไม่ทราบต้องอยู่ในตารางเสมอ",
            href: "/mappings/new",
          },
          {
            icon: ShieldCheck,
            title: "04 · ให้ผู้เชี่ยวชาญรับรอง",
            text: "ผู้ตรวจ TPQI และหลักสูตรลงความเห็น ก่อนผู้มีอำนาจอนุมัติฉบับที่คงที่",
            href: "/reviews",
          },
        ].map((step) => (
          <Link key={step.title} href={step.href} className="panel guide-card">
            <step.icon size={32} />
            <h2>{step.title}</h2>
            <p>{step.text}</p>
            <ArrowUpRight size={20} />
          </Link>
        ))}
      </div>
      <section className="panel text-section">
        <h2>ตารางเทียบกับการเทียบโอนต่างกันอย่างไร?</h2>
        <p>
          ตารางเทียบแสดงความสอดคล้องของข้อกำหนด
          ส่วนการเทียบโอนเป็นคำตัดสินรายบุคคล ซึ่งต้องตรวจคุณวุฒิ
          หลักฐานความสามารถ และนโยบายสถานศึกษาเพิ่มเติม
          ไม่มีการแปลงคะแนนความคล้ายเป็นหน่วยกิตอัตโนมัติ
        </p>
        <h3>เอกสารและการพิมพ์</h3>
        <p>
          เก็บเอกสาร PDF ในคลังส่วนตัว พร้อม checksum และผู้เพิ่มเอกสาร
          เปิดรายงานจากงานเทียบที่ต้องการ แล้วเลือกพิมพ์หรือบันทึกเป็น PDF
          ผ่านหน้าต่างพิมพ์ งานร่างแสดงสถานะยังไม่รับรองชัดเจน
        </p>
      </section>
    </>
  );
}
