"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Compass,
  Menu,
  X,
  ArrowRight,
  FileCheck2,
  ClipboardList,
  ShieldCheck,
  Search,
  Upload,
  Printer,
  BookOpen,
  CircleHelp,
  ArrowUpRight,
  Check,
} from "lucide-react";
import type { User } from "@/lib/types";

const learnerNav = [
  { path: "/", title: "ค้นหาใบรับรอง" },
  { path: "/prepare", title: "เตรียมเอกสาร" },
  { path: "/applications", title: "คำร้องของฉัน" },
  { path: "/help", title: "คู่มือและคำถาม" },
];
export function LearnerPortal({
  user,
  children,
}: {
  user: User | null;
  children: ReactNode;
}) {
  const pathname = usePathname(),
    [menu, setMenu] = useState(false);
  const staff = user && !["learner", "viewer"].includes(user.role);
  return (
    <div className="learner-portal">
      <a href="#main-content" className="skip-link">
        ข้ามไปเนื้อหาหลัก
      </a>
      {pathname === "/" && (
        <div className="ovec-masthead no-print">
          <Image
            src="/images/ovec-mapping-header.png"
            alt="OVEC Mapping เชื่อมโยงมาตรฐานอาชีพสู่รายวิชา เชื่อมหน่วยสมรรถนะ ผลลัพธ์การเรียนรู้ สมรรถนะรายวิชา และเกณฑ์การปฏิบัติงาน"
            width={1672}
            height={941}
            priority
            unoptimized
          />
        </div>
      )}
      <header className="learner-header no-print">
        <div className="learner-header-inner">
          <Link href="/" className="brand">
            <span className="brand-icon">
              <Compass size={26} />
            </span>
            <span>
              OVEC Mapping<small>พื้นที่สำหรับผู้เรียนและบุคคลทั่วไป</small>
            </span>
          </Link>
          <button
            className="icon-button learner-menu"
            aria-label={menu ? "ปิดเมนู" : "เปิดเมนู"}
            aria-expanded={menu}
            aria-controls="learner-navigation"
            onClick={() => setMenu((v) => !v)}
          >
            {menu ? <X /> : <Menu />}
          </button>
          <nav
            id="learner-navigation"
            className={menu ? "is-open" : ""}
            aria-label="เมนูสำหรับผู้เรียน"
          >
            {learnerNav.map((n) => {
              const active =
                n.path === "/"
                  ? pathname === "/" || pathname.startsWith("/certificates")
                  : pathname.startsWith(n.path);
              return (
                <Link
                  key={n.path}
                  href={n.path}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setMenu(false)}
                >
                  {n.title}
                </Link>
              );
            })}
          </nav>
          <div className="learner-account">
            {user ? (
              <Link href="/documents" className="button secondary small">
                <Upload size={16} />
                เอกสารของฉัน
              </Link>
            ) : (
              <a
                className="button primary small"
                href={`/signin-with-chatgpt?return_to=${encodeURIComponent(pathname)}`}
              >
                เข้าสู่ระบบ
              </a>
            )}
          </div>
        </div>
      </header>
      <main className="learner-main" id="main-content">
        {children}
      </main>
      <footer className="learner-footer">
        <div>
          <strong>OVEC Mapping</strong>
          <p>เชื่อมใบรับรองที่คุณมี กับโอกาสในการเรียนรู้</p>
        </div>
        <div className="learner-footer-links">
          <Link href="/prepare">รายการเอกสาร</Link>
          <Link href="/help">ขอคำแนะนำ</Link>
          {staff && (
            <Link href="/dashboard">
              พื้นที่เจ้าหน้าที่ <ArrowUpRight size={14} />
            </Link>
          )}
        </div>
        <p className="learner-footer-note">
          <ShieldCheck size={16} />
          ผลค้นหาใช้เตรียมคำร้อง
          ผู้เชี่ยวชาญและสถานศึกษาเป็นผู้พิจารณารับรองการเทียบโอน
        </p>
      </footer>
    </div>
  );
}

export const preparationItems = [
  {
    id: "certificate",
    group: "ใช้ยื่นในระบบ",
    title: "ใบประกาศนียบัตรหรือหนังสือรับรองคุณวุฒิ",
    text: "เห็นชื่อผู้ได้รับ เลขใบรับรอง ชื่ออาชีพ ระดับ หน่วยงานผู้ออก และวันที่ชัดเจน เลือกประเภทเอกสาร “คุณวุฒิวิชาชีพ”",
    tip: "ใช้เป็นไฟล์หลักในคำร้อง",
  },
  {
    id: "scope",
    group: "ควรเตรียมประกอบ",
    title: "รายการหน่วยสมรรถนะที่สอบผ่าน",
    text: "หน้าแนบท้ายใบรับรอง หนังสือแจ้งผล หรือเอกสารที่ระบุหน่วยสมรรถนะ (UoC) เพื่อให้ตรวจได้ว่าสอบผ่านงานใดบ้าง",
    tip: "ถ้ารวมอยู่ในใบรับรองแล้ว ไม่ต้องแนบซ้ำ",
  },
  {
    id: "course",
    group: "ควรเตรียมประกอบ",
    title: "ข้อมูลรายวิชาและหลักสูตรที่ต้องการเทียบ",
    text: "จดรหัสวิชา สาขา ระดับ ปวช./ปวส. และปีหลักสูตร หากมีผลการเรียนหรือเอกสารรายวิชา ให้เตรียมประกอบการตรวจ",
    tip: "ชื่อวิชาใกล้กันอาจเป็นคนละหลักสูตร",
  },
  {
    id: "practice",
    group: "เมื่อเจ้าหน้าที่ร้องขอ",
    title: "หลักฐานการปฏิบัติงานหรือผลงาน",
    text: "เช่น รายงานผลประเมิน หนังสือรับรองงาน หรือแฟ้มผลงานที่เกี่ยวข้องกับวิชานั้น เจ้าหน้าที่จะแจ้งว่าต้องใช้รายการใด",
    tip: "ใช้พิจารณาส่วนที่ใบรับรองยังอธิบายไม่ครบ",
  },
  {
    id: "identity",
    group: "เมื่อเจ้าหน้าที่ร้องขอ",
    title: "หลักฐานยืนยันตัวบุคคลหรือการเปลี่ยนชื่อ",
    text: "เตรียมเฉพาะที่สถานศึกษาระบุ หากชื่อในใบรับรองต่างจากผู้ยื่น ให้สอบถามวิธีชี้แจงก่อนแนบเอกสารส่วนบุคคล",
    tip: "ไม่จำเป็นต้องอัปโหลดบัตรประชาชนเพื่อค้นหา",
  },
];

export function PreparationPage() {
  const [checked, setChecked] = useState<string[]>([]);
  return (
    <>
      <div className="learner-page-intro">
        <span className="eyebrow">เตรียมพร้อมก่อนยื่นคำร้อง</span>
        <h1>เอกสารครบ เริ่มต้นได้มั่นใจ</h1>
        <p>
          เช็กรายการที่มี
          แล้วแนบเฉพาะเอกสารที่เกี่ยวข้องกับใบรับรองและรายวิชาของคุณ
        </p>
      </div>
      <div className="learner-two-column">
        <section className="panel learner-checklist">
          <div className="learner-section-heading">
            <div>
              <h2>รายการเตรียมเอกสาร</h2>
              <p>ติ๊กไว้เพื่อช่วยเตรียมตัวในหน้านี้</p>
            </div>
            <span className="learner-progress" role="status">
              {checked.length}/{preparationItems.length} รายการ
            </span>
          </div>
          <p className="learner-small-note">
            รายการแนะนำสำหรับเตรียมคำร้อง ไม่ใช่ข้อกำหนดเดียวกันทุกสถานศึกษา
            การติ๊กไม่ใช่การส่งหรือยืนยันเอกสาร และจะเริ่มใหม่เมื่อออกจากหน้านี้
          </p>
          {preparationItems.map((item) => (
            <label
              key={item.id}
              className={`learner-check-item ${checked.includes(item.id) ? "checked" : ""}`}
            >
              <input
                type="checkbox"
                checked={checked.includes(item.id)}
                onChange={(e) =>
                  setChecked((v) =>
                    e.target.checked
                      ? [...v, item.id]
                      : v.filter((x) => x !== item.id),
                  )
                }
              />
              <span>
                <span
                  className={`learner-tag ${item.group === "ใช้ยื่นในระบบ" ? "teal" : ""}`}
                >
                  {item.group}
                </span>
                <strong>{item.title}</strong>
                <span>{item.text}</span>
                <small>{item.tip}</small>
              </span>
            </label>
          ))}
          <div className="learner-actions no-print">
            <button className="button secondary" onClick={() => window.print()}>
              <Printer size={17} />
              พิมพ์รายการนี้
            </button>
            <button className="button ghost" onClick={() => setChecked([])}>
              ล้างเครื่องหมาย
            </button>
          </div>
        </section>
        <aside className="learner-side-stack">
          <section className="panel learner-tip-card">
            <span className="learner-icon">
              <Upload size={24} />
            </span>
            <h2>จัดไฟล์อย่างไร</h2>
            <ul>
              <li>ไฟล์ PDF ขนาดไม่เกิน 15 MB ต่อไฟล์</li>
              <li>ทุกหน้าชัดเจน ครบถ้วน และอ่านเลขใบรับรองได้</li>
              <li>ตั้งชื่อให้จำง่าย เช่น ใบรับรอง_ชื่ออาชีพ.pdf</li>
              <li>
                เลือกใบรับรองหลัก 1 ไฟล์ และเอกสารประกอบได้สูงสุด 10
                ไฟล์ต่อคำร้อง
              </li>
            </ul>
            <Link
              href="/documents?kind=CREDENTIAL"
              className="button primary full-width"
            >
              เพิ่มใบรับรองของฉัน <ArrowRight size={17} />
            </Link>
          </section>
          <section className="panel learner-tip-card">
            <h3>ยังหาเอกสารไม่ครบ</h3>
            <p>
              เริ่มค้นรายวิชาได้ก่อน หากไม่ทราบ UoC
              ให้ขอรายการหน่วยที่สอบผ่านจากผู้ออกใบรับรอง
              หรือให้เจ้าหน้าที่ช่วยตรวจขอบเขต
            </p>
            <Link href="/help" className="text-link">
              ดูวิธีขอคำแนะนำ <ArrowRight size={15} />
            </Link>
          </section>
        </aside>
      </div>
      <LearnerJourney />
    </>
  );
}

export function LearnerJourney() {
  return (
    <section className="learner-journey">
      <div className="learner-section-heading">
        <div>
          <span className="eyebrow">จากใบรับรอง สู่คำร้องเทียบโอน</span>
          <h2>ต่อจากนี้ทำอย่างไร</h2>
        </div>
        <Link href="/help">
          อ่านคู่มือ <ArrowRight size={16} />
        </Link>
      </div>
      <div className="learner-steps">
        {[
          {
            icon: Search,
            title: "ค้นและเลือกรายวิชา",
            text: "ดูใบรับรอง ระดับ และหน่วยที่สอบผ่านให้ตรงกับหลักฐาน",
            href: "/",
            cta: "เริ่มค้นหา",
          },
          {
            icon: FileCheck2,
            title: "เตรียมและแนบเอกสาร",
            text: "เพิ่มใบรับรองและหลักฐานที่เกี่ยวข้องไว้ในเอกสารของฉัน",
            href: "/prepare",
            cta: "เช็กเอกสาร",
          },
          {
            icon: ClipboardList,
            title: "ยื่นคำร้องและติดตาม",
            text: "ตรวจข้อมูลก่อนส่ง เจ้าหน้าที่อาจขอหลักฐานหรือประเมินเพิ่มเติม",
            href: "/applications",
            cta: "ดูคำร้องของฉัน",
          },
        ].map((s, i) => (
          <article key={s.title}>
            <span className="learner-step-number">0{i + 1}</span>
            <s.icon size={25} />
            <h3>{s.title}</h3>
            <p>{s.text}</p>
            <Link href={s.href}>
              {s.cta} <ArrowRight size={15} />
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}

export function LearnerDocumentHint() {
  return (
    <aside className="learner-inline-help no-print">
      <FileCheck2 size={25} />
      <div>
        <strong>เจอรายวิชาที่สนใจแล้ว เตรียมอะไรต่อ</strong>
        <p>
          ใบรับรองที่สอบผ่านและหน้าแนบระบุหน่วยสมรรถนะ พร้อมข้อมูลรายวิชา
          ส่วนหลักฐานผลงานให้แนบตามที่เกี่ยวข้องหรือเจ้าหน้าที่ร้องขอ
        </p>
      </div>
      <Link className="button secondary small" href="/prepare">
        เช็กรายการเอกสาร <ArrowRight size={16} />
      </Link>
    </aside>
  );
}

const faqs = [
  [
    "ต้องมีใบรับรองก่อนจึงจะค้นได้หรือไม่",
    "ค้นเพื่อศึกษาข้อมูลได้ แต่การยื่นคำร้องต้องใช้ใบรับรองที่เป็นของผู้ยื่นจริง หากกำลังตัดสินใจเข้าสอบ ควรให้สถานศึกษาตรวจรายวิชาและเกณฑ์ที่ใช้ก่อนเสียค่าใช้จ่าย ผลค้นหาไม่รับประกันผลเทียบโอน",
  ],
  [
    "UoC คืออะไร หาได้จากที่ไหน",
    "UoC คือหน่วยสมรรถนะ หรือชุดงานที่ได้รับการประเมิน ลองดูรหัสและรายการในใบรับรองหรือเอกสารแนบท้าย ถ้ายังไม่พบ ให้สอบถามผู้ออกใบรับรอง ไม่ควรเลือกทุกหน่วยแทนโดยคาดเดา",
  ],
  [
    "พบรายวิชาที่เกี่ยวข้อง หมายถึงเทียบผ่านเลยหรือไม่",
    "ยังไม่ใช่ผลอนุมัติ รายวิชาที่แสดงเป็นข้อเสนอประกอบการพิจารณา ผู้เชี่ยวชาญต้องตรวจขอบเขต เอกสารต้นฉบับ หลักฐานปฏิบัติ และเกณฑ์ของสถานศึกษาก่อน",
  ],
  [
    "ใบอบรมหรือใบเข้าร่วมกิจกรรมใช้แทนได้หรือไม่",
    "ระบบค้นชุดมาตรฐานคุณวุฒิวิชาชีพ TPQI เป็นหลัก หากมีใบอบรมหรือใบจากหน่วยงานอื่น ให้สถานศึกษาตรวจประเภทและขอบเขตเอกสารก่อนใช้ ไม่ควรเลือกเป็นคุณวุฒิ TPQI โดยอาศัยชื่อที่คล้ายกัน",
  ],
  [
    "ค้นไม่พบใบรับรองหรือรายวิชา ต้องทำอย่างไร",
    "ลองใช้คำสั้น ๆ รหัสวิชา หรือเลือกสาขาให้กว้างขึ้น ผลละเอียดเป็นชุดที่ระบบคัดไว้ จึงอาจมีรายการอื่นที่เกี่ยวข้อง ให้เจ้าหน้าที่ช่วยค้นเพิ่มเติม การไม่พบผลไม่ใช่การปฏิเสธเทียบโอน",
  ],
  [
    "ใบรับรองมีวันหมดอายุ หรือชื่อไม่ตรงกัน",
    "ตรวจวันที่และชื่อในเอกสาร แล้วสอบถามผู้ออกใบรับรองหรือฝ่ายทะเบียนว่าต้องดำเนินการอย่างไร ระบบนี้ยังไม่ได้ตรวจสถานะใบรับรองกับผู้ออกโดยอัตโนมัติ",
  ],
  [
    "ใช้เวลากี่วัน มีค่าใช้จ่ายเท่าไร",
    "ขึ้นอยู่กับสถานศึกษา รายวิชา ความครบถ้วนของหลักฐาน และการประเมินเพิ่มเติม ระบบนี้ยังไม่ได้ประกาศระยะเวลาหรือค่าธรรมเนียม ให้สอบถามฝ่ายทะเบียนของสถานศึกษาที่รับคำร้อง",
  ],
];
export function LearnerHelpPage() {
  return (
    <>
      <div className="learner-page-intro">
        <span className="eyebrow">คำแนะนำสำหรับผู้ใช้งานทั่วไป</span>
        <h1>
          เริ่มจากสิ่งที่คุณมี
          <br />
          เราช่วยให้เห็นขั้นตอนถัดไป
        </h1>
        <p>เข้าใจใบรับรอง อ่านผลค้นหา และเตรียมคำร้องได้ทีละขั้น</p>
      </div>
      <LearnerJourney />
      <div className="learner-two-column">
        <section className="panel learner-faq">
          <h2>คำถามที่พบบ่อย</h2>
          {faqs.map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </section>
        <aside className="learner-side-stack">
          <section className="panel learner-tip-card">
            <CircleHelp size={28} />
            <h2>อยากให้เจ้าหน้าที่ช่วยดู</h2>
            <p>
              ติดต่อฝ่ายทะเบียนหรืองานเทียบโอนของสถานศึกษาที่คุณจะยื่นคำร้อง
              พร้อมข้อมูลต่อไปนี้
            </p>
            <ul>
              <li>ชื่อใบรับรอง อาชีพ ระดับ และผู้ออก</li>
              <li>รหัสวิชา สาขา และปีหลักสูตร</li>
              <li>ข้อสงสัยหรือหน่วยที่ยังไม่ทราบ</li>
            </ul>
            <p className="learner-small-note">
              ยังไม่มีช่องทางติดต่อฝ่ายทะเบียนเฉพาะสถานศึกษาที่ตั้งค่าไว้ในระบบ
            </p>
          </section>
          <section className="panel learner-tip-card">
            <BookOpen size={25} />
            <h3>ดูข้อมูลจากเจ้าของมาตรฐาน</h3>
            <p>
              TPQI มีบริการข้อมูลมาตรฐานและตรวจสอบสถานะการรับรองผ่าน TPQI-Net
            </p>
            <a
              className="text-link"
              href="https://www.tpqi.go.th/e-service/tpqi-net/"
              target="_blank"
              rel="noreferrer"
            >
              บริการ TPQI-Net <ArrowUpRight size={15} />
            </a>
            <a
              className="text-link"
              href="https://dles.vec.go.th/subject/"
              target="_blank"
              rel="noreferrer"
            >
              ค้นรายวิชาอาชีวศึกษา <ArrowUpRight size={15} />
            </a>
            <small>
              รายการเอกสารใน OVEC Mapping เป็นคำแนะนำเตรียมคำร้อง
              ให้ยืนยันข้อกำหนดกับสถานศึกษาอีกครั้ง
            </small>
          </section>
        </aside>
      </div>
    </>
  );
}

export function LearnerSearchIntro() {
  return (
    <section className="learner-hero learner-hero-with-banner">
      <div>
        <span className="learner-kicker">
          <span />
          ใบรับรองของคุณ อาจต่อยอดการเรียนได้
        </span>
        <h1>
          ค้นหารายวิชาที่เทียบได้จาก<span>ใบรับรองของคุณ</span>
        </h1>
        <p>
          ค้นความเชื่อมโยงของใบรับรอง TPQI กับรายวิชา ปวช. และ ปวส.
          <br className="desktop-break" />
          พร้อมแนวทางเตรียมเอกสาร ก่อนยื่นให้สถานศึกษาพิจารณา
        </p>
        <div className="learner-hero-facts">
          <span>
            <Check size={16} />
            อ้างอิงมาตรฐานจริง
          </span>
          <span>
            <Check size={16} />
            ดูหลักฐานประกอบได้
          </span>
          <span>
            <Check size={16} />
            ผู้เชี่ยวชาญตรวจรับรอง
          </span>
        </div>
      </div>
      <div className="learner-banner-actions no-print">
        <a className="button primary" href="#certificate-search">
          <Search size={18} /> เริ่มค้นหารายวิชา
        </a>
        <a
          className="text-link"
          href="/images/ovec-mapping-header.png"
          target="_blank"
          rel="noreferrer"
        >
          เปิดภาพหัวเว็บขนาดเต็ม <ArrowUpRight size={15} />
        </a>
      </div>
    </section>
  );
}
