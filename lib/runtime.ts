import { env } from "cloudflare:workers";
import schemaSql from "../drizzle/0000_clammy_gamma_corps.sql?raw";
import analysisSchemaSql from "../drizzle/0001_perfect_angel.sql?raw";
import seed from "../data/catalog-seed.json";
import type {
  CatalogItem,
  SourceCourse,
  SourceStandard,
  User,
  Role,
} from "./types";

export const runtime = env as unknown as {
  DB: D1Database;
  DOCUMENTS: R2Bucket;
  ADMIN_EMAIL?: string;
  LOCAL_DEV_EMAIL?: string;
  LOCAL_TEST_KEY?: string;
};
let initialized: Promise<void> | undefined;
export const now = () => new Date().toISOString();
export const uid = () => crypto.randomUUID();
export async function sha(value: string | ArrayBuffer) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    typeof value === "string" ? new TextEncoder().encode(value) : value,
  );
  return [...new Uint8Array(bytes)]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
export async function all<T>(sql: string, ...args: (string | number | null)[]) {
  return (
    await runtime.DB.prepare(sql)
      .bind(...args)
      .all<T>()
  ).results;
}
export async function one<T>(sql: string, ...args: (string | number | null)[]) {
  return runtime.DB.prepare(sql)
    .bind(...args)
    .first<T>();
}
export const statement = (sql: string, ...args: (string | number | null)[]) =>
  runtime.DB.prepare(sql).bind(...args);
export function auditStatement(
  actor: string,
  action: string,
  entity: string,
  detail: unknown,
) {
  return statement(
    "INSERT INTO audit (id,actor,action,entity_id,detail,created_at) VALUES (?,?,?,?,?,?)",
    uid(),
    actor,
    action,
    entity,
    JSON.stringify(detail),
    now(),
  );
}
export async function normalized(
  kind: "course" | "standard",
  item: SourceCourse | SourceStandard,
): Promise<CatalogItem> {
  const c = item as SourceCourse,
    s = item as SourceStandard;
  const payload = JSON.stringify(item);
  return {
    id:
      kind === "course" ? `course:${c.deptCode}:${c.code}` : `standard:${s.id}`,
    kind,
    code: kind === "course" ? c.code : String(s.id),
    title: kind === "course" ? c.nameTh : s.title,
    level: kind === "course" ? c.level : (s.levelNames || []).join(", "),
    category: item.category || "",
    department: kind === "course" ? c.deptName : s.branch || "",
    payload,
    detail: null,
    source_url:
      kind === "course"
        ? c.pdfUrl || "https://dles.vec.go.th/subject/"
        : `https://dles.vec.go.th/api/standards/tpqi/${s.id}`,
    fetched_at: now(),
    hash: await sha(payload),
  };
}
export function catalogStatement(item: CatalogItem) {
  return statement(
    `INSERT INTO catalog (id,kind,code,title,level,category,department,payload,detail,source_url,fetched_at,hash) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,level=excluded.level,category=excluded.category,department=excluded.department,payload=excluded.payload,source_url=excluded.source_url,fetched_at=excluded.fetched_at,hash=excluded.hash`,
    item.id,
    item.kind,
    item.code,
    item.title,
    item.level,
    item.category,
    item.department,
    item.payload,
    item.detail,
    item.source_url,
    item.fetched_at,
    item.hash,
  );
}
async function initialize() {
  const statements = [schemaSql, analysisSchemaSql]
    .join("--> statement-breakpoint")
    .split("--> statement-breakpoint")
    .map((sql) => sql.trim())
    .filter(Boolean)
    .map((sql) =>
      sql
        .replace("CREATE TABLE ", "CREATE TABLE IF NOT EXISTS ")
        .replace("CREATE UNIQUE INDEX ", "CREATE UNIQUE INDEX IF NOT EXISTS ")
        .replace("CREATE INDEX ", "CREATE INDEX IF NOT EXISTS "),
    );
  await runtime.DB.batch(statements.map((sql) => runtime.DB.prepare(sql)));
  const seeded = await one<{ value: string }>(
    "SELECT value FROM settings WHERE key='seed-v1'",
  );
  if (!seeded) {
    const courses = await Promise.all(
      seed.courses.map((c) => normalized("course", c as SourceCourse)),
    );
    const standards = await Promise.all(
      seed.standards.map((s) => normalized("standard", s as SourceStandard)),
    );
    for (let i = 0; i < courses.length + standards.length; i += 40)
      await runtime.DB.batch(
        [...courses, ...standards].slice(i, i + 40).map(catalogStatement),
      );
    await runtime.DB.batch([
      statement(
        "INSERT OR IGNORE INTO settings(key,value) VALUES ('seed-v1',?)",
        seed.fetchedAt,
      ),
      statement(
        "INSERT OR IGNORE INTO settings(key,value) VALUES ('source-stats',?)",
        JSON.stringify(seed.stats),
      ),
      statement(
        "INSERT OR IGNORE INTO settings(key,value) VALUES ('organization',?)",
        "หน่วยงานอาชีวศึกษา",
      ),
      statement(
        "INSERT OR IGNORE INTO settings(key,value) VALUES ('policy',?)",
        JSON.stringify({
          status: "DRAFT",
          name: "นโยบายเทียบโอน — รอเอกสารที่มีผลใช้บังคับ",
        }),
      ),
    ]);
  }
  const admin = (runtime.ADMIN_EMAIL || "itp@utc.ac.th").toLowerCase();
  await statement(
    "INSERT OR IGNORE INTO members(email,name,role,scope,active,created_at) VALUES (?,?,'admin','',1,?)",
    admin,
    "ผู้ดูแลระบบ",
    now(),
  ).run();
}
export async function ready() {
  initialized ??= initialize().catch((error) => {
    initialized = undefined;
    throw error;
  });
  await initialized;
}
export async function getUser(request: Request): Promise<User | null> {
  let email = request.headers
    .get("oai-authenticated-user-email")
    ?.trim()
    .toLowerCase();
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(
    new URL(request.url).hostname,
  );
  if (
    process.env.NODE_ENV !== "production" &&
    local &&
    runtime.LOCAL_DEV_EMAIL
  ) {
    email = runtime.LOCAL_DEV_EMAIL.toLowerCase();
    if (
      runtime.LOCAL_TEST_KEY &&
      request.headers.get("x-test-key") === runtime.LOCAL_TEST_KEY
    )
      email = request.headers.get("x-test-email")?.toLowerCase() || email;
  }
  if (!email || !email.includes("@")) return null;
  const member = await one<User>("SELECT * FROM members WHERE email=?", email);
  if (member) return member.active ? member : null;
  // Authenticated visitors receive only their own learner workspace. Staff must be appointed.
  const name = email.split("@")[0];
  await statement(
    "INSERT OR IGNORE INTO members(email,name,role,scope,active,created_at) VALUES (?,?,'learner','',1,?)",
    email,
    name,
    now(),
  ).run();
  return {
    email,
    name,
    role: "learner",
    scope: "",
    valid_until: null,
    active: 1,
  };
}
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: string[],
  ) {
    super(message);
  }
}
export function requireUser(user: User | null, roles?: Role[]): User {
  if (!user) throw new HttpError(401, "กรุณาเข้าสู่ระบบก่อนทำรายการ");
  if (roles && !roles.includes(user.role))
    throw new HttpError(403, "บัญชีนี้ไม่มีสิทธิ์ดำเนินการ");
  return user;
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    throw new HttpError(403, "ไม่อนุญาตคำขอจากเว็บไซต์อื่น");
  if (request.headers.get("sec-fetch-site") === "cross-site")
    throw new HttpError(403, "ไม่อนุญาตคำขอข้ามเว็บไซต์");
}
