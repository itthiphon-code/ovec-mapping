"use client";
import { useState } from "react";
import { BulkBrowser, BulkCourse } from "./bulk-mapping";
import { CertificateSearch, CertificateDetail } from "./certificate-mapping";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  Layers3,
  GitCompareArrows,
  BadgeCheck,
  FolderOpen,
  ClipboardList,
  ChartNoAxesCombined,
  Settings2,
  Compass,
  ArrowUpRight,
  Menu,
  X,
  ShieldCheck,
  CircleHelp,
  ChevronRight,
  LogIn,
  Sparkles,
  Award,
} from "lucide-react";
import { useResource, ErrorBox } from "./ui";
import { Dashboard, CatalogView, CatalogDetail, Guide } from "./catalog-views";
import { MappingsView, NewMapping, MappingEditor } from "./mapping-views";
import {
  DocumentsView,
  ApplicationsView,
  SettingsView,
  ReportsView,
} from "./office-views";
import { roleLabels, type User } from "@/lib/types";

const nav = [
  { path: "/", label: "ใบรับรองเทียบวิชาอะไร", icon: Award },
  { path: "/dashboard", label: "ภาพรวมงานรับรอง", icon: LayoutDashboard },
  { path: "/automatic", label: "ผลจับคู่ทั้งคลัง", icon: Sparkles },
  { path: "/courses", label: "รายวิชาอาชีวศึกษา", icon: BookOpen },
  { path: "/standards", label: "มาตรฐาน TPQI", icon: Layers3 },
  { path: "/mappings", label: "ตารางเทียบสมรรถนะ", icon: GitCompareArrows },
  { path: "/reviews", label: "งานผู้เชี่ยวชาญ", icon: BadgeCheck },
  { path: "/documents", label: "คลังเอกสาร", icon: FolderOpen },
  { path: "/applications", label: "คำร้องเทียบโอน", icon: ClipboardList },
  { path: "/reports", label: "รายงานและการพิมพ์", icon: ChartNoAxesCombined },
];
export default function CompassApp() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const me = useResource<{ user: User | null; local: boolean }>("me");
  const user = me.data?.user || null;
  const parts = pathname.split("/").filter(Boolean);
  const current =
    (parts[0] === "certificates" ? "ใบรับรองเทียบวิชาอะไร" : null) ||
    nav.find((n) => n.path === `/${parts[0] || ""}`)?.label ||
    (parts[0] === "settings" ? "จัดการระบบ" : "คู่มือการใช้งาน");
  let view;
  if (!parts.length) view = <CertificateSearch />;
  else if (parts[0] === "certificates")
    view = parts[1] ? (
      <CertificateDetail key={parts[1]} id={decodeURIComponent(parts[1])} />
    ) : (
      <CertificateSearch />
    );
  else if (parts[0] === "dashboard") view = <Dashboard user={user} />;
  else if (parts[0] === "automatic")
    view =
      parts[1] === "new" ? (
        <NewMapping key="automatic" user={user} automatic />
      ) : parts[1] ? (
        <BulkCourse
          key={parts[1]}
          id={decodeURIComponent(parts[1])}
          user={user}
        />
      ) : (
        <BulkBrowser />
      );
  else if (parts[0] === "courses" || parts[0] === "standards")
    view = parts[1] ? (
      <CatalogDetail id={decodeURIComponent(parts.slice(1).join("/"))} />
    ) : (
      <CatalogView kind={parts[0] === "courses" ? "course" : "standard"} />
    );
  else if (parts[0] === "mappings")
    view =
      parts[1] === "new" ? (
        <NewMapping user={user} />
      ) : parts[1] ? (
        <MappingEditor id={parts[1]} user={user} />
      ) : (
        <MappingsView user={user} />
      );
  else if (parts[0] === "reviews") view = <MappingsView user={user} review />;
  else if (parts[0] === "documents") view = <DocumentsView user={user} />;
  else if (parts[0] === "applications") view = <ApplicationsView user={user} />;
  else if (parts[0] === "reports") view = <ReportsView />;
  else if (parts[0] === "settings") view = <SettingsView user={user} />;
  else view = <Guide />;
  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        ข้ามไปเนื้อหาหลัก
      </a>
      {open && (
        <button
          className="sidebar-backdrop"
          aria-label="ปิดเมนู"
          onClick={() => setOpen(false)}
        />
      )}
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <Link href="/" className="brand">
          <span className="brand-icon">
            <Compass size={29} strokeWidth={1.6} />
          </span>
          <span>
            COMPASS<small>Competency Mapping</small>
          </span>
        </Link>
        <div className="workspace-label">
          <span className="workspace-dot" /> TPQI × อาชีวศึกษา{" "}
          <span className="version-pill">ทดลองใช้</span>
        </div>
        <span className="nav-caption">พื้นที่ทำงาน</span>
        <nav aria-label="เมนูหลัก">
          {nav.map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              href={path}
              onClick={() => setOpen(false)}
              className={`nav-item ${(path === "/" ? pathname === "/" : pathname.startsWith(path)) ? "active" : ""}`}
              aria-current={
                (path === "/" ? pathname === "/" : pathname.startsWith(path))
                  ? "page"
                  : undefined
              }
            >
              <Icon size={20} />
              <span>{label}</span>
              {path === "/" && <span className="active-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Link className="nav-item" href="/guide">
            <CircleHelp size={20} />
            คู่มือการใช้งาน
          </Link>
          {user?.role === "admin" && (
            <Link
              className={`nav-item ${pathname === "/settings" ? "active" : ""}`}
              href="/settings"
            >
              <Settings2 size={20} />
              จัดการระบบ
            </Link>
          )}
          <div className="trust-card">
            <ShieldCheck size={25} />
            <strong>เริ่มจากหลักฐานที่เชื่อถือได้</strong>
            <p>
              ทุกข้อสรุปมีที่มา
              <br />
              ทุกการรับรองมีผู้เชี่ยวชาญ
            </p>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              aria-label="เปิดเมนูหลัก"
              onClick={() => setOpen(!open)}
            >
              {open ? <X /> : <Menu />}
            </button>
            <span className="breadcrumb-home">พื้นที่ทำงาน</span>
            <ChevronRight size={15} />
            <strong>{current}</strong>
          </div>
          <div className="topbar-right">
            <a
              className="source-link"
              href="https://dles.vec.go.th/standards"
              target="_blank"
              rel="noreferrer"
            >
              แหล่งข้อมูลมาตรฐาน <ArrowUpRight size={14} />
            </a>
            <span className="topbar-divider" />
            {user ? (
              <div className="user-chip">
                <span className="avatar">{user.name.slice(0, 1)}</span>
                <span>
                  <strong>{user.name}</strong>
                  <small>
                    {roleLabels[user.role]}
                    {me.data?.local ? " · เครื่องนี้" : ""}
                  </small>
                </span>
              </div>
            ) : (
              <a
                className="button small primary"
                href={`/signin-with-chatgpt?return_to=${encodeURIComponent(pathname)}`}
              >
                <LogIn size={16} />
                เข้าสู่ระบบ
              </a>
            )}
          </div>
        </header>
        <main id="main-content" className="main-content">
          {me.error && (
            <>
              <ErrorBox message={`ตรวจสิทธิ์การใช้งานไม่สำเร็จ: ${me.error}`} />
              <button className="button secondary" onClick={me.reload}>
                ตรวจสิทธิ์อีกครั้ง
              </button>
            </>
          )}
          {view}
        </main>
        <footer className="app-footer">
          <span>COMPASS · เชื่อมมาตรฐาน สู่การเรียนรู้</span>
          <span>
            <ShieldCheck size={14} /> อ้างอิงเอกสาร · ตรวจสอบย้อนกลับ ·
            ผู้เชี่ยวชาญรับรอง
          </span>
        </footer>
      </div>
    </div>
  );
}
