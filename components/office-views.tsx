"use client";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Upload,
  FileText,
  Download,
  FolderOpen,
  Plus,
  ShieldCheck,
  Users,
  Save,
  RefreshCw,
  Printer,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  ArrowLeft,
} from "lucide-react";
import {
  api,
  useResource,
  PageTitle,
  Badge,
  Empty,
  Loading,
  ErrorBox,
  Modal,
  date,
  number,
} from "./ui";
import {
  roleLabels,
  type Role,
  type User,
  type DocumentRecord,
  type Application,
  type Mapping,
  type MappingPayload,
  type Review,
} from "@/lib/types";
import { ReportDownload } from "./report-download";
import { createMappingReport, type MappingReportMode } from "@/lib/report-data";
import { coverage } from "@/lib/policy";

export function DocumentsView({
  user,
  personal = false,
}: {
  user: User | null;
  personal?: boolean;
}) {
  const searchParams = useSearchParams();
  const resource = useResource<{ items: DocumentRecord[] }>(
    user ? `documents${personal ? "?mine=1" : ""}` : null,
  );
  const [open, setOpen] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [filter, setFilter] = useState("ALL");
  const upload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("documents", {
        method: "POST",
        body: new FormData(e.currentTarget),
      });
      setOpen(false);
      resource.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const items = (resource.data?.items || []).filter(
    (d) => filter === "ALL" || d.kind === filter,
  );
  if (!user)
    return (
      <Empty
        title="เข้าสู่ระบบเพื่อเก็บเอกสารของคุณ"
        description="คุณสามารถค้นหาใบรับรองและอ่านคำแนะนำได้ก่อนเพิ่มไฟล์"
        action={
          <a
            href={`/signin-with-chatgpt?return_to=${encodeURIComponent("/documents")}`}
            className="button primary"
          >
            เข้าสู่ระบบ
          </a>
        }
      />
    );
  return (
    <>
      <PageTitle
        eyebrow="DOCUMENT LIBRARY"
        title={personal ? "เอกสารของฉัน" : "หลักฐานที่ดี เริ่มจากเอกสารที่ครบ"}
        description={
          personal
            ? "เพิ่มใบรับรองและหลักฐานประกอบ แล้วเลือกไฟล์เหล่านี้เมื่อยื่นคำร้อง รองรับ PDF ไม่เกิน 15 MB ต่อไฟล์"
            : "รวบรวมเอกสารอ้างอิงและคุณวุฒิ พร้อมบันทึกที่มาและตรวจสอบไฟล์ย้อนหลัง"
        }
        action={
          <button className="button primary" onClick={() => setOpen(true)}>
            <Upload size={18} />
            เพิ่มเอกสาร
          </button>
        }
      />
      {personal && (
        <div className="learner-actions">
          <Link className="button secondary" href="/prepare">
            ควรเตรียมเอกสารอะไร
          </Link>
          <Link className="button secondary" href="/applications">
            ไปคำร้องของฉัน <ArrowRight size={16} />
          </Link>
        </div>
      )}
      <div className="document-banner">
        <span className="document-stack" aria-hidden="true">
          <FileText size={46} />
        </span>
        <div>
          <h2>ทุกไฟล์มีที่มา ทุกหลักฐานตามกลับได้</h2>
          <p>
            จัดเก็บ PDF ต้นฉบับ พร้อมผู้เพิ่มเอกสาร วันเวลา และลายนิ้วมือไฟล์
          </p>
        </div>
        <div className="document-total">
          <strong>{number(resource.data?.items.length)}</strong>
          <span>เอกสารในพื้นที่ของคุณ</span>
        </div>
      </div>
      <div className="tabs">
        {[
          { v: "ALL", t: "ทั้งหมด" },
          { v: "STANDARD", t: "มาตรฐาน TPQI" },
          { v: "CURRICULUM", t: "หลักสูตร" },
          { v: "CREDENTIAL", t: "คุณวุฒิ" },
          { v: "EVIDENCE", t: "หลักฐานเพิ่มเติม" },
          { v: "POLICY", t: "นโยบาย" },
        ].map((x) => (
          <button
            className={filter === x.v ? "selected" : ""}
            onClick={() => setFilter(x.v)}
            key={x.v}
          >
            {x.t}
          </button>
        ))}
      </div>
      <ErrorBox message={resource.error} />
      {resource.loading ? (
        <Loading />
      ) : items.length ? (
        <section className="panel table-panel">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>เอกสาร</th>
                  <th>ขนาด</th>
                  <th>สถานะ</th>
                  <th>เพิ่มเมื่อ</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <div className="document-name">
                        <span className="file-icon">
                          <FileText size={23} />
                        </span>
                        <span>
                          <strong>{d.title}</strong>
                          <small>
                            {d.filename} · SHA-256 {d.hash.slice(0, 12)}…
                          </small>
                        </span>
                      </div>
                    </td>
                    <td>{(d.bytes / 1024 / 1024).toFixed(2)} MB</td>
                    <td>
                      <Badge status={d.status} />
                    </td>
                    <td>{date(d.created_at)}</td>
                    <td>
                      <a
                        href={`/api/documents/${d.id}`}
                        className="icon-link"
                        aria-label={`ดาวน์โหลด ${d.title}`}
                      >
                        <Download size={19} />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <Empty
          title={
            user
              ? "จัดเอกสารให้พร้อมก่อนเริ่มเทียบ"
              : "เข้าสู่ระบบเพื่อเปิดคลังเอกสารของคุณ"
          }
          description="เอกสารเป็นพื้นที่ส่วนตัว ไม่เผยแพร่อัตโนมัติเมื่ออัปโหลด"
          action={
            <button className="button secondary" onClick={() => setOpen(true)}>
              <Plus size={17} />
              เพิ่มเอกสารแรก
            </button>
          }
        />
      )}
      <div className="notice info">
        <ShieldCheck size={20} />
        <span>
          ไฟล์ที่เพิ่มมีสถานะรอตรวจ
          การอัปโหลดไม่ใช่การยืนยันความแท้ของเอกสารหรือคุณวุฒิ
        </span>
      </div>
      {open && (
        <Modal title="เพิ่มเอกสารต้นฉบับ" onClose={() => setOpen(false)}>
          <form onSubmit={upload}>
            <ErrorBox message={error} />
            <label>
              ชื่อเอกสาร
              <input
                name="title"
                required
                maxLength={200}
                placeholder={
                  personal
                    ? "เช่น ใบรับรองคุณวุฒิ ช่างทดสอบหม้อแปลงไฟฟ้า"
                    : "เช่น หลักสูตร ปวช. สาขาช่างไฟฟ้า"
                }
              />
            </label>
            <label>
              ประเภทเอกสาร
              <select
                name="kind"
                defaultValue={
                  personal || searchParams.get("kind") === "CREDENTIAL"
                    ? "CREDENTIAL"
                    : "STANDARD"
                }
              >
                {!personal && <option value="STANDARD">มาตรฐาน TPQI</option>}
                {!personal && (
                  <option value="CURRICULUM">หลักสูตรรายวิชา</option>
                )}
                <option value="CREDENTIAL">คุณวุฒิวิชาชีพ</option>
                <option value="EVIDENCE">หลักฐานเพิ่มเติม</option>
                {!personal && <option value="POLICY">ระเบียบและนโยบาย</option>}
              </select>
            </label>
            <label className="upload-zone">
              <Upload size={30} />
              <strong>เลือกไฟล์ PDF ต้นฉบับ</strong>
              <span>ขนาดไม่เกิน 15 MB</span>
              <input
                type="file"
                name="file"
                accept="application/pdf"
                required
              />
            </label>
            <button className="button primary full-width" disabled={busy}>
              {busy ? "กำลังเก็บเอกสาร…" : "บันทึกเอกสาร"}
              <Upload size={17} />
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}

export function ApplicationsView({
  user,
  personal = false,
}: {
  user: User | null;
  personal?: boolean;
}) {
  const searchParams = useSearchParams();
  const suggestedCourse = (searchParams.get("course") || "").slice(0, 40);
  const suggestedNote = (searchParams.get("note") || "").slice(0, 5000);
  const resource = useResource<{ items: Application[] }>(
      user ? `applications${personal ? "?mine=1" : ""}` : null,
    ),
    docs = useResource<{ items: DocumentRecord[] }>(
      user ? "documents?mine=1" : null,
    );
  const [open, setOpen] = useState(!!suggestedCourse),
    [selected, setSelected] = useState<Application | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const values = {
      ...Object.fromEntries(form),
      additionalDocumentIds: form.getAll("additionalDocumentIds"),
    };
    try {
      await api("applications", {
        method: "POST",
        body: JSON.stringify(values),
      });
      setOpen(false);
      resource.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const update = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await api(`applications/${selected.id}`, {
        method: "POST",
        body: JSON.stringify({
          ...Object.fromEntries(new FormData(e.currentTarget)),
          revision: selected.revision,
        }),
      });
      setSelected(null);
      resource.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (!user)
    return (
      <Empty
        title="เข้าสู่ระบบเพื่อยื่นและติดตามคำร้อง"
        description="เมื่อพบรายวิชาที่สนใจ ให้เตรียมใบรับรองและเอกสารประกอบก่อนส่งให้เจ้าหน้าที่"
        action={
          <a
            className="button primary"
            href={`/signin-with-chatgpt?return_to=${encodeURIComponent(`/applications?${searchParams.toString()}`)}`}
          >
            เข้าสู่ระบบ
          </a>
        }
      />
    );
  return (
    <>
      <PageTitle
        eyebrow="CREDIT TRANSFER REQUESTS"
        title={personal ? "คำร้องของฉัน" : "คำร้องเทียบโอนคุณวุฒิ"}
        description="ติดตามการตรวจหลักฐานและการประเมินรายบุคคลอย่างเป็นขั้นตอน"
        action={
          <button
            className="button primary"
            onClick={() => {
              setOpen(true);
              setError("");
            }}
          >
            <Plus size={18} />
            ยื่นคำร้องใหม่
          </button>
        }
      />
      {personal && (
        <div className="learner-inline-help">
          <FileText size={25} />
          <div>
            <strong>ก่อนส่งคำร้องครั้งแรก</strong>
            <p>
              เพิ่มใบรับรองในเอกสารของฉัน
              แล้วเลือกไฟล์หลักและเอกสารประกอบในแบบคำร้อง
            </p>
          </div>
          <Link className="button secondary small" href="/prepare">
            เช็กเอกสารที่ควรแนบ
          </Link>
          <Link className="button secondary small" href="/documents">
            เพิ่มเอกสาร
          </Link>
        </div>
      )}
      <div className="application-journey">
        {[
          "ยื่นคำร้อง",
          "ตรวจหลักฐาน",
          "ประเมินเพิ่มเติม",
          "พิจารณาตามนโยบาย",
        ].map((t, i) => (
          <div key={t}>
            <span>{i + 1}</span>
            <strong>{t}</strong>
            {i < 3 && <ArrowRight size={16} />}
          </div>
        ))}
      </div>
      <div className="notice warning">
        <ShieldCheck size={21} />
        <span>
          การเทียบโอนต้องใช้หลักฐานผู้เรียนและนโยบายที่มีผลใช้บังคับ
          ระบบรับคำร้องและเตรียมการประเมินได้
          แต่ยังไม่เปิดออกคำตัดสินหน่วยกิตจนกว่าจะรับรองนโยบายสถานศึกษา
        </span>
      </div>
      <ErrorBox message={resource.error} />
      {resource.loading ? (
        <Loading />
      ) : resource.data?.items.length ? (
        <section className="panel table-panel">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>คำร้อง</th>
                  <th>สถานะ</th>
                  <th>วันที่ยื่น</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {resource.data.items.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <strong>{a.title}</strong>
                      <small className="table-subtitle">
                        เลขคำร้อง {a.id.slice(0, 8).toUpperCase()}
                      </small>
                    </td>
                    <td>
                      <Badge status={a.status} />
                    </td>
                    <td>{date(a.created_at)}</td>
                    <td>
                      <button
                        className="button secondary small"
                        onClick={() => {
                          setSelected(a);
                          setError("");
                        }}
                      >
                        ดูรายละเอียด
                        <ArrowRight size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <Empty
          title="ยังไม่มีคำร้องเทียบโอน"
          description="เริ่มจากเพิ่มหลักฐานคุณวุฒิในคลังเอกสาร แล้วเลือกยื่นคำร้องใหม่"
          action={
            <Link href="/documents" className="button secondary">
              <FolderOpen size={17} />
              เตรียมเอกสารคุณวุฒิ
            </Link>
          }
        />
      )}{" "}
      {open && (
        <Modal title="ยื่นคำร้องเทียบโอน" onClose={() => setOpen(false)}>
          <form onSubmit={submit}>
            <ErrorBox message={error} />
            <label>
              ชื่อ–นามสกุลผู้ยื่น
              <input name="name" required maxLength={200} />
            </label>
            <div className="two-columns">
              <label>
                เลขคุณวุฒิ / ใบรับรอง
                <input name="credentialNumber" required maxLength={200} />
              </label>
              <label>
                หน่วยงานที่ออกคุณวุฒิ
                <input
                  name="issuer"
                  required
                  defaultValue="สถาบันคุณวุฒิวิชาชีพ"
                />
              </label>
            </div>
            <label>
              รหัสรายวิชาที่ขอเทียบโอน
              <input
                name="courseCode"
                defaultValue={suggestedCourse}
                required
                placeholder="เช่น 20100-1001"
                maxLength={40}
              />
            </label>
            <label>
              แนบเอกสารคุณวุฒิ
              <select name="documentId" required>
                <option value="">เลือกจากคลังเอกสารของคุณ</option>
                {docs.data?.items
                  .filter(
                    (d) => d.owner === user?.email && d.kind === "CREDENTIAL",
                  )
                  .map((d) => (
                    <option value={d.id} key={d.id}>
                      {d.title}
                    </option>
                  ))}
              </select>
            </label>
            <div className="learner-actions">
              <a
                className="button secondary small"
                href="/documents?kind=CREDENTIAL"
                target="_blank"
                rel="noreferrer"
              >
                เพิ่มไฟล์ในแท็บใหม่
              </a>
              <button
                type="button"
                className="button secondary small"
                onClick={docs.reload}
              >
                โหลดรายการเอกสารใหม่
              </button>
            </div>
            <ErrorBox message={docs.error} />
            <label>
              รายละเอียดเพิ่มเติม
              <textarea
                name="note"
                rows={3}
                maxLength={5000}
                defaultValue={suggestedNote}
              />
            </label>
            <fieldset className="learner-attachments">
              <legend>เอกสารประกอบเพิ่มเติม (ไม่เกิน 10 ไฟล์)</legend>
              <p>
                เช่น รายการหน่วยที่สอบผ่าน ผลการประเมิน หรือหลักฐานผลงาน
                เลือกเฉพาะที่เกี่ยวข้อง และไม่เลือกซ้ำกับไฟล์ใบรับรองหลัก
              </p>
              {docs.data?.items
                .filter((d) => d.owner === user.email)
                .map((d) => (
                  <label key={d.id}>
                    <input
                      type="checkbox"
                      name="additionalDocumentIds"
                      value={d.id}
                    />
                    <span>{d.title}</span>
                  </label>
                ))}
              {!docs.data?.items.length && (
                <p>
                  ยังไม่มีเอกสารในคลัง{" "}
                  <Link href="/documents">เพิ่มเอกสารของฉัน</Link>
                </p>
              )}
            </fieldset>
            <button className="button primary full-width" disabled={busy}>
              {busy ? "กำลังส่ง…" : "ยื่นคำร้อง"}
              <ArrowRight size={17} />
            </button>
          </form>
        </Modal>
      )}
      {selected && (
        <Modal title={selected.title} onClose={() => setSelected(null)}>
          <div className="stack">
            <Badge status={selected.status} />
            <dl className="application-details">
              {Object.entries(JSON.parse(selected.payload))
                .filter(([k]) =>
                  [
                    "name",
                    "credentialNumber",
                    "issuer",
                    "courseCode",
                    "note",
                    "staffNote",
                  ].includes(k),
                )
                .map(([k, v]) => (
                  <div key={k}>
                    <dt>
                      {
                        {
                          name: "ผู้ยื่น",
                          credentialNumber: "เลขคุณวุฒิ",
                          issuer: "หน่วยงานที่ออก",
                          courseCode: "รายวิชา",
                          note: "รายละเอียด",
                          staffNote: "ข้อความจากเจ้าหน้าที่",
                        }[k]
                      }
                    </dt>
                    <dd>{String(v) || "—"}</dd>
                  </div>
                ))}
            </dl>
            <a
              className="button secondary"
              href={`/api/documents/${JSON.parse(selected.payload).documentId}`}
            >
              <Download size={17} />
              เปิดหลักฐานคุณวุฒิ
            </a>
            {(JSON.parse(selected.payload).additionalDocumentIds || []).map(
              (docId: string, i: number) => (
                <a
                  key={docId}
                  href={`/api/documents/${encodeURIComponent(docId)}`}
                  className="button secondary"
                >
                  <FileText size={16} />
                  เปิดเอกสารประกอบ {i + 1}
                </a>
              ),
            )}
            {!personal &&
              user &&
              ["admin", "registrar"].includes(user.role) && (
                <form onSubmit={update}>
                  <ErrorBox message={error} />
                  <label>
                    ปรับขั้นตอน
                    <select name="status">
                      <option value="EVIDENCE_CHECK">ตรวจหลักฐาน</option>
                      <option value="NEEDS_INFORMATION">
                        ขอข้อมูลเพิ่มเติม
                      </option>
                      <option value="ASSESSMENT">รอประเมินเพิ่มเติม</option>
                    </select>
                  </label>
                  <label>
                    ข้อความแจ้งผู้ยื่น
                    <textarea name="note" required minLength={10} rows={3} />
                  </label>
                  <button className="button primary" disabled={busy}>
                    <Save size={17} />
                    บันทึกขั้นตอน
                  </button>
                </form>
              )}
          </div>
        </Modal>
      )}
    </>
  );
}

type AdminData = {
  settings: { key: string; value: string }[];
  audit: {
    id: string;
    actor: string;
    action: string;
    entity_id: string;
    detail: string;
    created_at: string;
  }[];
  sync: {
    id: string;
    kind: string;
    count: number;
    status: string;
    created_at: string;
  }[];
};
export function SettingsView({ user }: { user: User | null }) {
  const resource = useResource<AdminData>(
      user?.role === "admin" ? "admin" : null,
    ),
    members = useResource<{ items: User[] }>(
      user?.role === "admin" ? "members" : null,
    );
  const [tab, setTab] = useState("members"),
    [open, setOpen] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [busy, setBusy] = useState(false),
    [syncKind, setSyncKind] = useState("course"),
    [syncPage, setSyncPage] = useState(1);
  if (!user || user.role !== "admin")
    return (
      <>
        <PageTitle
          eyebrow="ADMINISTRATION"
          title="จัดการระบบ"
          description="เฉพาะผู้ดูแลระบบที่ได้รับสิทธิ์"
        />
        <Empty
          title="เข้าสู่ระบบด้วยบัญชีผู้ดูแล"
          description="บัญชีผู้ดูแลเริ่มต้นคือ itp@utc.ac.th"
        />
      </>
    );
  const saveMember = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("members", {
        method: "POST",
        body: JSON.stringify({
          ...Object.fromEntries(new FormData(e.currentTarget)),
          active: new FormData(e.currentTarget).get("active") === "true",
        }),
      });
      setOpen(false);
      members.reload();
      resource.reload();
      setSuccess("บันทึกสิทธิ์สมาชิกแล้ว");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const saveSettings = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("admin", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(new FormData(e.currentTarget))),
      });
      resource.reload();
      setSuccess("บันทึกชื่อหน่วยงานแล้ว");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const sync = async () => {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const result = await api<{
        items: unknown[];
        hasMore: boolean;
        source: string;
      }>("sync", {
        method: "POST",
        body: JSON.stringify({ kind: syncKind, page: syncPage }),
      });
      if (result.source !== "live")
        throw new Error(
          "ต้นทางไม่พร้อม ใช้ข้อมูลเดิมและบันทึกงานที่ไม่สำเร็จแล้ว",
        );
      setSuccess(
        `นำเข้าหน้า ${syncPage} จำนวน ${result.items.length} รายการแล้ว${result.hasMore ? " · มีหน้าถัดไป" : " · ถึงหน้าสุดท้าย"}`,
      );
      if (result.hasMore) setSyncPage((p) => p + 1);
      resource.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageTitle
        eyebrow="ADMINISTRATION"
        title="จัดการระบบอย่างเป็นระเบียบ"
        description="ผู้ใช้และสิทธิ์ แหล่งข้อมูล และประวัติที่ตรวจสอบย้อนกลับได้"
      />
      <div className="tabs">
        {[
          { id: "members", title: "ผู้ใช้และผู้เชี่ยวชาญ" },
          { id: "sources", title: "แหล่งข้อมูล" },
          { id: "organization", title: "หน่วยงานและนโยบาย" },
          { id: "audit", title: "ประวัติการทำรายการ" },
        ].map((x) => (
          <button
            key={x.id}
            className={tab === x.id ? "selected" : ""}
            onClick={() => setTab(x.id)}
          >
            {x.title}
          </button>
        ))}
      </div>
      <ErrorBox
        message={resource.error || members.error || (!open ? error : "")}
      />
      {success && (
        <div className="notice success">
          <CheckCircle2 size={18} />
          {success}
        </div>
      )}
      {tab === "members" && (
        <section className="panel">
          <div className="section-heading">
            <h2>สมาชิกและการแต่งตั้ง</h2>
            <button
              className="button primary"
              onClick={() => {
                setOpen(true);
                setError("");
              }}
            >
              <Plus size={17} />
              เพิ่ม / ปรับสิทธิ์
            </button>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>สมาชิก</th>
                  <th>บทบาท</th>
                  <th>ขอบเขต</th>
                  <th>สิ้นสุดการแต่งตั้ง</th>
                </tr>
              </thead>
              <tbody>
                {members.data?.items.map((u) => (
                  <tr key={u.email}>
                    <td>
                      <div className="member-name">
                        <span className="avatar">{u.name.slice(0, 1)}</span>
                        <span>
                          <strong>{u.name}</strong>
                          <small>{u.email}</small>
                        </span>
                      </div>
                    </td>
                    <td>
                      <Badge>
                        {u.active ? roleLabels[u.role] : "ระงับสิทธิ์"}
                      </Badge>
                    </td>
                    <td>{u.scope || "—"}</td>
                    <td>{date(u.valid_until || undefined)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="notice info">
            <Users size={20} />
            <span>
              เพิ่มสมาชิกด้วยอีเมลที่ใช้เข้าสู่ระบบ
              การกำหนดสิทธิ์ไม่ส่งอีเมลเชิญอัตโนมัติ
              ผู้ดูแลไม่มีสิทธิ์รับรองทางวิชาการโดยปริยาย
            </span>
          </div>
        </section>
      )}
      {tab === "sources" && (
        <div className="stack">
          <div className="two-columns">
            <section className="panel">
              <span className="metric-icon teal">
                <RefreshCw size={24} />
              </span>
              <h2>นำเข้าข้อมูลจากต้นทาง</h2>
              <p className="muted">
                นำเข้าทีละหน้า บันทึกแบบไม่ซ้ำ และแสดงสถานะจริงของแต่ละรอบ
              </p>
              <label>
                ชุดข้อมูล
                <select
                  value={syncKind}
                  onChange={(e) => {
                    setSyncKind(e.target.value);
                    setSyncPage(1);
                  }}
                >
                  <option value="course">รายวิชาอาชีวศึกษา</option>
                  <option value="standard">มาตรฐาน TPQI</option>
                </select>
              </label>
              <label>
                หน้าที่นำเข้า
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={syncPage}
                  onChange={(e) => setSyncPage(Number(e.target.value))}
                />
              </label>
              <button className="button primary" onClick={sync} disabled={busy}>
                <RefreshCw size={17} className={busy ? "spin" : ""} />
                {busy ? "กำลังนำเข้า…" : "นำเข้าหน้านี้"}
              </button>
            </section>
            <section className="panel text-section">
              <h2>แหล่งข้อมูลหลัก</h2>
              <h3>มาตรฐานคุณวุฒิวิชาชีพ</h3>
              <a
                href="https://dles.vec.go.th/standards"
                target="_blank"
                rel="noreferrer"
              >
                dles.vec.go.th/standards
              </a>
              <h3>หลักสูตรและรายวิชาอาชีวศึกษา</h3>
              <a
                href="https://dles.vec.go.th/subject/"
                target="_blank"
                rel="noreferrer"
              >
                dles.vec.go.th/subject/
              </a>
              <hr />
              <p>
                การค้นรายวิชาและมาตรฐานอ่านจากต้นทางพร้อมเก็บรายการที่ค้นพบ
                หากต้นทางขัดข้อง ระบบแสดงข้อมูลที่เก็บไว้พร้อมป้ายสถานะ
              </p>
            </section>
          </div>
          <section className="panel">
            <h2>ประวัติการนำเข้า</h2>
            {resource.data?.sync.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>ข้อมูล</th>
                      <th>จำนวน</th>
                      <th>ผล</th>
                      <th>วันที่</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resource.data.sync.map((s) => (
                      <tr key={s.id}>
                        <td>{s.kind === "course" ? "รายวิชา" : "มาตรฐาน"}</td>
                        <td>{s.count}</td>
                        <td>
                          <Badge>
                            {s.status === "SUCCEEDED" ? "สำเร็จ" : "ไม่สำเร็จ"}
                          </Badge>
                        </td>
                        <td>{date(s.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted">ยังไม่มีรอบนำเข้าด้วยผู้ดูแล</p>
            )}
          </section>
        </div>
      )}
      {tab === "organization" && (
        <div className="two-columns">
          <section className="panel">
            <h2>ชื่อหน่วยงานบนระบบ</h2>
            <form onSubmit={saveSettings}>
              <label>
                สถานศึกษา / หน่วยงาน
                <input
                  name="organization"
                  required
                  defaultValue={
                    resource.data?.settings.find(
                      (s) => s.key === "organization",
                    )?.value || ""
                  }
                />
              </label>
              <button className="button primary" disabled={busy}>
                <Save size={17} />
                บันทึก
              </button>
            </form>
          </section>
          <section className="panel text-section">
            <h2>นโยบายเทียบโอน</h2>
            <Badge status="DRAFT" />
            <p>
              รอเอกสารระเบียบที่ใช้บังคับ คำสั่งแต่งตั้งผู้มีอำนาจ
              และเงื่อนไขหน่วยกิต ระบบจึงยังไม่ออกคำตัดสินเทียบโอนจริง
            </p>
            <Link href="/documents" className="button secondary">
              <Upload size={17} />
              เตรียมเอกสารนโยบาย
            </Link>
          </section>
        </div>
      )}
      {tab === "audit" && (
        <section className="panel">
          <h2>ประวัติการทำรายการล่าสุด</h2>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>การดำเนินการ</th>
                  <th>ผู้ทำรายการ</th>
                  <th>ฉบับ / รายการ</th>
                  <th>วันที่</th>
                </tr>
              </thead>
              <tbody>
                {resource.data?.audit.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <code>{a.action}</code>
                    </td>
                    <td>{a.actor}</td>
                    <td>
                      <details>
                        <summary>{a.entity_id.slice(0, 18)}…</summary>
                        <pre>{a.detail}</pre>
                      </details>
                    </td>
                    <td>{date(a.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {open && (
        <Modal title="เพิ่มสมาชิกหรือปรับสิทธิ์" onClose={() => setOpen(false)}>
          <form onSubmit={saveMember}>
            <ErrorBox message={error} />
            <label>
              อีเมลสำหรับเข้าสู่ระบบ
              <input name="email" type="email" required />
            </label>
            <label>
              ชื่อที่แสดง
              <input name="name" required minLength={2} />
            </label>
            <label>
              บทบาท
              <select name="role">
                {Object.entries(roleLabels).map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              สถานะบัญชี
              <select name="active">
                <option value="true">ใช้งาน</option>
                <option value="false">ระงับสิทธิ์</option>
              </select>
            </label>
            <label>
              ขอบเขตความเชี่ยวชาญ / เลขคำสั่งแต่งตั้ง
              <input
                name="scope"
                placeholder="สาขาวิชาชีพและเลขคำสั่ง"
                maxLength={300}
              />
            </label>
            <label>
              วันสิ้นสุดการแต่งตั้ง
              <input name="validUntil" type="date" />
            </label>
            <button className="button primary full-width" disabled={busy}>
              <ShieldCheck size={17} />
              {busy ? "กำลังบันทึก…" : "บันทึกสิทธิ์สมาชิก"}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}

export function ReportsView() {
  const params = useSearchParams(),
    id = params.get("mapping"),
    [mode, setMode] = useState<MappingReportMode>("matrix");
  const list = useResource<{ items: Mapping[] }>(id ? null : "mappings"),
    detail = useResource<{ mapping: Mapping; reviews: Review[] }>(
      id ? `mappings/${id}` : null,
    );
  const csv = () => {
    if (!detail.data) return;
    const p = JSON.parse(detail.data.mapping.payload) as MappingPayload;
    const fields = [
      [
        "ข้อกำหนด",
        "UoC",
        "EoC",
        "เกณฑ์การปฏิบัติงาน",
        "สถานะ",
        "เหตุผล",
        "ช่องว่าง",
        "หลักฐานมาตรฐาน",
        "หลักฐานรายวิชา",
        "ฉบับ",
      ],
      ...p.rows.map((r) => [
        r.target,
        r.uoc,
        r.eoc,
        r.criterion,
        r.status,
        r.reason,
        r.gap,
        r.standardLocator,
        r.courseLocator,
        String(detail.data!.mapping.revision),
      ]),
    ];
    const safe = (v: string) =>
      `"${(/^[=+@\-\t\r]/.test(v) ? "'" : "") + v.replaceAll('"', '""')}"`;
    const blob = new Blob(
      ["\ufeff" + fields.map((row) => row.map(safe).join(",")).join("\r\n")],
      { type: "text/csv;charset=utf-8;" },
    );
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `mapping-${id}-v${detail.data.mapping.revision}.csv`;
    link.click();
    URL.revokeObjectURL(href);
  };
  if (id && detail.data) {
    const m = detail.data.mapping,
      p = JSON.parse(m.payload) as MappingPayload,
      cov = coverage(p.rows),
      approved = ["APPROVED", "PUBLISHED"].includes(m.status);
    return (
      <>
        <div className="print-controls">
          <Link href="/reports" className="back-link">
            <ArrowLeft size={16} />
            รายงานทั้งหมด
          </Link>
          <PageTitle
            eyebrow="REPORT PREVIEW"
            title="รายงานที่ตรวจสอบย้อนกลับได้"
            description="ดาวน์โหลด PDF หรือ Word ตามประเภทรายงานที่เลือก · Word เป็นสำเนาแก้ไขได้"
            action={
              <div className="inline-actions">
                <ReportDownload
                  buildReport={() =>
                    createMappingReport(m, detail.data!.reviews, mode)
                  }
                />
                <button className="button secondary" onClick={csv}>
                  <Download size={17} />
                  ส่งออก CSV
                </button>
                <button
                  className="button primary"
                  onClick={() => window.print()}
                >
                  <Printer size={17} />
                  พิมพ์ / บันทึก PDF
                </button>
              </div>
            }
          />
          <div className="tabs">
            {[
              { id: "matrix", title: "ตารางเทียบฉบับเต็ม" },
              { id: "summary", title: "สรุปการเทียบ" },
              { id: "evidence", title: "บัญชีหลักฐาน" },
              { id: "reviews", title: "ความเห็นผู้เชี่ยวชาญ" },
            ].map((t) => (
              <button
                key={t.id}
                className={mode === t.id ? "selected" : ""}
                onClick={() => setMode(t.id as MappingReportMode)}
              >
                {t.title}
              </button>
            ))}
          </div>
        </div>
        <article
          className={`report-paper ${mode === "matrix" ? "landscape" : ""}`}
        >
          <header className="report-header">
            <div className="report-brand">
              OVEC Mapping<small>TPQI × อาชีวศึกษา</small>
            </div>
            <div>
              <h1>
                {
                  {
                    matrix: "ตารางเทียบสมรรถนะรายวิชา",
                    summary: "สรุปผลการเทียบเคียงสมรรถนะ",
                    evidence: "บัญชีหลักฐานอ้างอิง",
                    reviews: "บันทึกความเห็นผู้เชี่ยวชาญ",
                  }[mode]
                }
              </h1>
              <p>
                เลขรายงาน {m.id.slice(0, 8).toUpperCase()} · ฉบับ {m.revision}
              </p>
            </div>
          </header>
          <div className={`report-watermark ${approved ? "approved" : ""}`}>
            {approved
              ? "ตารางผ่านการรับรองตามขอบเขตที่ระบุ"
              : "ฉบับร่าง — ยังไม่ผ่านการรับรอง"}
          </div>
          <section className="report-meta">
            <p>
              <b>รายวิชา:</b> {m.title}
            </p>
            <p>
              <b>มาตรฐาน:</b> {p.standard.title} · {p.levelName}
            </p>
            <p>
              <b>อ้างอิงหลักสูตร:</b> {p.course.standardRef}
            </p>
            <p>
              <b>สถานะ:</b> <Badge status={m.status} /> · <b>อัปเดต:</b>{" "}
              {date(m.updated_at)}
            </p>
          </section>
          {mode === "matrix" && (
            <table className="report-table">
              <thead>
                <tr>
                  <th>ข้อกำหนดรายวิชา</th>
                  <th>UoC / EoC / เกณฑ์</th>
                  <th>ผลการเทียบ</th>
                  <th>เหตุผลและช่องว่าง</th>
                  <th>หลักฐานอ้างอิง</th>
                </tr>
              </thead>
              <tbody>
                {p.rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <b>
                        {r.id} · {r.targetKind}
                      </b>
                      <br />
                      {r.target}
                    </td>
                    <td>
                      {r.uoc || "—"} / {r.eoc || "—"}
                      <br />
                      {r.criterion}
                    </td>
                    <td>{statusLabelsForReport(r.status)}</td>
                    <td>
                      {r.reason || "ยังไม่มีข้อวินิจฉัย"}
                      {r.gap && (
                        <>
                          <br />
                          <b>สิ่งที่ขาด:</b> {r.gap}
                        </>
                      )}
                    </td>
                    <td>
                      TPQI: {r.standardLocator || "ยังไม่ระบุ"}
                      <br />
                      รายวิชา: {r.courseLocator}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {mode === "summary" && (
            <div className="report-summary">
              <h2>ความครอบคลุมตามขอบเขตในตาราง</h2>
              <p>
                ข้อที่ระบุว่าครบ {cov.full} จาก {cov.total} ข้อ · บางส่วน{" "}
                {cov.partial} · หลักฐานไม่พอ {cov.unknown}
              </p>
              <p>สถานะอ้างอิง: {p.referenceNote}</p>
              <h3>ขอบเขตและข้อจำกัด</h3>
              <p>{p.policyNote || "ยังไม่ได้ระบุข้อจำกัดการใช้ตาราง"}</p>
              <h3>รายการที่ยังต้องดำเนินการ</h3>
              <ol>
                {p.rows
                  .filter((r) => r.status !== "FULL")
                  .map((r) => (
                    <li key={r.id}>
                      {r.target} — {r.gap || statusLabelsForReport(r.status)}
                    </li>
                  ))}
              </ol>
            </div>
          )}
          {mode === "evidence" && (
            <div>
              {p.rows.map((r) => (
                <section className="report-evidence" key={r.id}>
                  <h3>
                    {r.id} · {r.targetKind}
                  </h3>
                  <p>
                    <b>มาตรฐาน:</b> {r.standardQuote || "ยังไม่มีหลักฐาน"}
                  </p>
                  <p>
                    {r.standardLocator} · {r.standardUrl}
                  </p>
                  <p>
                    <b>รายวิชา:</b> {r.courseQuote}
                  </p>
                  <p>
                    {r.courseLocator} · {r.courseUrl}
                  </p>
                </section>
              ))}
            </div>
          )}
          {mode === "reviews" && (
            <div>
              {detail.data.reviews.length ? (
                detail.data.reviews.map((r) => (
                  <section className="report-evidence" key={r.id}>
                    <h3>
                      {r.reviewer} · {roleLabels[r.role as Role]}
                    </h3>
                    <p>{r.comment}</p>
                    <p>
                      ความเห็น: {r.verdict} · ฉบับ {r.revision} · วันที่{" "}
                      {date(r.created_at)}
                    </p>
                    <code>{r.content_hash}</code>
                  </section>
                ))
              ) : (
                <p>ยังไม่มีความเห็นผู้เชี่ยวชาญในระบบ</p>
              )}
            </div>
          )}
          <footer className="report-footer">
            <p>
              เอกสารนี้แสดงการเทียบเคียงข้อกำหนด
              ไม่ใช่คำตัดสินเทียบโอนหน่วยกิตหรือใบรับรองคุณวุฒิของบุคคล
            </p>
            <p>
              SHA-256 ฉบับข้อมูล: <code>{m.content_hash}</code>
            </p>
            <p>ตรวจสถานะปัจจุบัน: /mappings/{m.id}</p>
          </footer>
        </article>
      </>
    );
  }
  return (
    <>
      <PageTitle
        eyebrow="REPORTS & EXPORTS"
        title="รายงานและการพิมพ์"
        description="เลือกฉบับงานเพื่อพิมพ์ตาราง สรุป หลักฐาน และความเห็นผู้เชี่ยวชาญ"
      />
      <div className="report-type-grid">
        {[
          {
            icon: GitCompareIcon,
            title: "ตารางเทียบ",
            desc: "UoC / EoC / เกณฑ์ ↔ ข้อกำหนดวิชา",
          },
          {
            icon: FileText,
            title: "สรุปและหลักฐาน",
            desc: "ความครอบคลุม ช่องว่าง และที่มา",
          },
          {
            icon: ShieldCheck,
            title: "ความเห็นผู้เชี่ยวชาญ",
            desc: "ผู้ตรวจ มติ และฉบับที่รับรอง",
          },
        ].map((r) => (
          <div className="panel" key={r.title}>
            <span className="metric-icon teal">
              <r.icon size={25} />
            </span>
            <h3>{r.title}</h3>
            <p className="muted">{r.desc}</p>
          </div>
        ))}
      </div>
      <ErrorBox message={list.error || detail.error} />
      {list.loading || detail.loading ? (
        <Loading />
      ) : list.data?.items.length ? (
        <section className="panel">
          <h2>เลือกงานที่ต้องการออกรายงาน</h2>
          {list.data.items.map((m) => (
            <Link
              href={`/reports?mapping=${m.id}`}
              key={m.id}
              className="report-choice"
            >
              <span className="file-icon">
                <FileText size={22} />
              </span>
              <span>
                <strong>{m.title}</strong>
                <small>
                  ฉบับ {m.revision} · {date(m.updated_at)}
                </small>
              </span>
              <Badge status={m.status} />
              <Printer size={19} />
            </Link>
          ))}
        </section>
      ) : (
        <Empty
          title="ยังไม่มีตารางสำหรับออกรายงาน"
          description="เมื่อบันทึกงานเทียบแล้ว สามารถพิมพ์ฉบับร่างได้ทันที พร้อมสถานะที่ชัดเจน"
          action={
            <Link href="/mappings/new" className="button primary">
              สร้างตารางเทียบ
              <ArrowRight size={17} />
            </Link>
          }
        />
      )}
    </>
  );
}
function GitCompareIcon({ size }: { size: number }) {
  return <ClipboardList size={size} />;
}
function statusLabelsForReport(status: string) {
  return (
    (
      {
        FULL: "ครอบคลุมครบ",
        PARTIAL: "บางส่วน",
        NONE: "ไม่ครอบคลุม",
        CONFLICT: "ข้อมูลขัดกัน",
        INSUFFICIENT_EVIDENCE: "หลักฐานไม่พอ",
      } as Record<string, string>
    )[status] || status
  );
}
