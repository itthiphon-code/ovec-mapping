import { createServer, request as proxyRequest } from "node:http";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { startProdServer } from "vinext/server/prod-server";
import { AuthStore, LoginLimiter, normalizeEmail } from "./auth-store.mjs";
import { env } from "./node-bindings.mjs";
import { migrateDatabase } from "./migrate.mjs";

const escape = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export function safeReturn(value) {
  try {
    const url = new URL(value || "/", "https://mapping.local");
    if (url.origin !== "https://mapping.local" || /^(\/auth\/|\/signin-with-chatgpt|\/signout-with-chatgpt)/.test(url.pathname)) return "/";
    return url.pathname + url.search + url.hash;
  } catch { return "/"; }
}
export function cleanProxyHeaders(headers, user, origin) {
  const cleaned = { ...headers };
  for (const key of Object.keys(cleaned)) {
    if (/^(oai-|x-test-|x-forwarded-|forwarded$)/i.test(key)) delete cleaned[key];
  }
  cleaned.host = origin.host;
  cleaned["x-forwarded-host"] = origin.host;
  cleaned["x-forwarded-proto"] = origin.protocol.slice(0, -1);
  if (user && !user.must_change) cleaned["oai-authenticated-user-email"] = user.email;
  return cleaned;
}
function htmlPage(title, content) {
  return `<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)} | OVEC Mapping</title><style>
  *{box-sizing:border-box}body{margin:0;background:#f2f8ff;color:#082e59;font:16px/1.7 system-ui,sans-serif;display:grid;min-height:100vh;place-items:center;padding:24px}.card{background:white;width:100%;max-width:460px;border:1px solid #d2e4f7;border-radius:20px;padding:32px;box-shadow:0 12px 40px #03295b16}img{width:64px;height:64px}h1{font-size:25px;margin:12px 0}p{color:#4e6684}label{display:block;margin-top:16px}input{width:100%;padding:12px;border:1px solid #adc8e6;border-radius:8px;font:inherit}button{background:#075eae;color:white;border:0;border-radius:9px;padding:13px;width:100%;font:inherit;cursor:pointer;margin-top:24px}a{color:#075eae}nav{margin-top:22px}input:focus-visible,button:focus-visible,a:focus-visible{outline:3px solid #34b9ff;outline-offset:3px}.error{background:#fff0f0;color:#9a2222;padding:12px;border-radius:8px}</style>
  <main class="card"><img src="/images/ovec-official-seal.png" alt="ตราสำนักงานคณะกรรมการการอาชีวศึกษา"><h1>${escape(title)}</h1>${content}<nav><a href="/">กลับหน้าค้นหาใบรับรอง</a></nav></main></html>`;
}
async function formData(req) {
  const chunks = []; let length = 0;
  for await (const chunk of req) {
    length += chunk.length;
    if (length > 8192) throw new Error("ข้อมูลยาวเกินกำหนด");
    chunks.push(chunk);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString());
}

export async function startMappingServer({ port = Number(process.env.PORT || 3000), host = process.env.HOST || "0.0.0.0" } = {}) {
  if (!process.env.MAPPING_DATA_DIR || !process.env.APP_ORIGIN) throw new Error("MAPPING_DATA_DIR and APP_ORIGIN are required");
  const origin = new URL(process.env.APP_ORIGIN);
  mkdirSync(process.env.MAPPING_DATA_DIR, { recursive: true, mode: 0o700 });
  migrateDatabase(process.env.MAPPING_DATA_DIR);
  const auth = new AuthStore(join(process.env.MAPPING_DATA_DIR, "auth.sqlite"));
  const limiter = new LoginLimiter();
  const internal = await startProdServer({ port: 0, host: "127.0.0.1" });
  const cookieName = origin.protocol === "https:" ? "__Host-mapping_session" : "mapping_session";
  const cookie = (token, maxAge = 28800) => `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${origin.protocol === "https:" ? "; Secure" : ""}`;
  const server = createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    const url = new URL(req.url || "/", origin);
    const token = String(req.headers.cookie || "").split(";").map((v) => v.trim()).find((v) => v.startsWith(cookieName + "="))?.slice(cookieName.length + 1);
    const user = auth.session(token);
    const redirect = (location, sessionCookie) => {
      res.writeHead(303, { Location: location, "Cache-Control": "no-store", ...(sessionCookie ? { "Set-Cookie": sessionCookie } : {}) }); res.end();
    };
    const page = (title, content, status = 200) => {
      res.writeHead(status, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'" });
      res.end(htmlPage(title, content + (user ? '<nav><a href="/auth/password">เปลี่ยนรหัสผ่าน</a> · <a href="/auth/logout">ออกจากระบบ</a></nav>' : "")));
    };
    try {
      if (url.pathname === "/signin-with-chatgpt") return redirect(`/auth/login?return_to=${encodeURIComponent(safeReturn(url.searchParams.get("return_to")))}`);
      if (url.pathname === "/signout-with-chatgpt") return redirect("/auth/logout");
      if (url.pathname.startsWith("/auth/")) {
        if (!["GET", "POST"].includes(req.method)) { res.writeHead(405); return res.end(); }
        if (req.method === "POST" && (req.headers.origin !== origin.origin || req.headers["sec-fetch-site"] === "cross-site")) {
          return page("ไม่อนุญาตคำขอนี้", "<p>กรุณาเปิดแบบฟอร์มจากเว็บไซต์นี้โดยตรง</p>", 403);
        }
        if (url.pathname === "/auth/login") {
          const target = safeReturn(url.searchParams.get("return_to"));
          if (req.method === "GET" && user) return redirect(user.must_change ? "/auth/password" : target);
          let error = "";
          if (req.method === "POST") {
            const form = await formData(req);
            const email = normalizeEmail(form.get("email"));
            const ip = String(req.headers["x-real-ip"] || req.socket.remoteAddress);
            if (!limiter.take(`ip:${ip}`) || !limiter.take(`email:${email}`)) return page("กรุณารอสักครู่", "<p>เข้าสู่ระบบไม่สำเร็จหลายครั้ง กรุณาลองใหม่ใน 15 นาที</p>", 429);
            limiter.inFlight++;
            let account;
            try { account = await auth.authenticate(email, form.get("password")); }
            finally { limiter.inFlight--; }
            if (account) return redirect(account.must_change ? "/auth/password" : safeReturn(form.get("return_to")), cookie(auth.issue(account.email)));
            error = "<p class=error role=alert>อีเมลหรือรหัสผ่านไม่ถูกต้อง</p>";
          }
          return page("เข้าสู่ระบบ OVEC Mapping", `<p>ใช้บัญชีที่ผู้ดูแลระบบสร้างให้ เพื่อจัดเก็บเอกสารและติดตามคำร้อง</p>${error}<form method="post" action="/auth/login"><input type="hidden" name="return_to" value="${escape(target)}"><label for="email">อีเมล</label><input id="email" name="email" type="email" autocomplete="username" maxlength="254" required><label for="password">รหัสผ่าน</label><input id="password" name="password" type="password" autocomplete="current-password" maxlength="128" required><button>เข้าสู่ระบบ</button></form>`, error ? 401 : 200);
        }
        if (url.pathname === "/auth/logout") {
          if (req.method === "POST") { auth.revoke(token); return redirect("/", cookie("", 0)); }
          return page("ออกจากระบบ", '<form method="post"><button>ยืนยันออกจากระบบ</button></form>');
        }
        if (url.pathname === "/auth/password") {
          if (!user) return redirect("/auth/login");
          let error = "";
          if (req.method === "POST") {
            const form = await formData(req);
            if (!limiter.take(`password:${user.email}`)) return page("กรุณารอสักครู่", "<p>กรุณาลองใหม่ใน 15 นาที</p>", 429);
            if (!await auth.authenticate(user.email, form.get("current"))) error = "รหัสผ่านปัจจุบันไม่ถูกต้อง";
            else if (form.get("password") !== form.get("confirm")) error = "รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน";
            else if (form.get("password") === form.get("current")) error = "กรุณาตั้งรหัสผ่านใหม่ที่ต่างจากเดิม";
            else {
              try { await auth.changePassword(user.email, form.get("password")); }
              catch (err) { error = err.message; }
              if (!error) return redirect("/", cookie(auth.issue(user.email)));
            }
          }
          const member = await env.DB.prepare("SELECT role,active FROM members WHERE email=?").bind(user.email).first();
          return page("เปลี่ยนรหัสผ่าน", `<p>${user.must_change ? "กรุณาเปลี่ยนรหัสผ่านเริ่มต้นก่อนเข้าใช้งาน" : "ตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณ"}</p>${error ? `<p class="error" role="alert">${escape(error)}</p>` : ""}<form method="post"><label for="current">รหัสผ่านปัจจุบัน</label><input id="current" name="current" type="password" autocomplete="current-password" maxlength="128" required><label for="password">รหัสผ่านใหม่ (อย่างน้อย 12 ตัวอักษร)</label><input id="password" name="password" type="password" autocomplete="new-password" minlength="12" maxlength="128" required><label for="confirm">ยืนยันรหัสผ่านใหม่</label><input id="confirm" name="confirm" type="password" autocomplete="new-password" minlength="12" maxlength="128" required><button>บันทึกรหัสผ่านใหม่</button></form>${member?.active && member.role === "admin" && !user.must_change ? '<nav><a href="/auth/accounts">จัดการบัญชีผู้ใช้งาน</a></nav>' : ""}`, error ? 400 : 200);
        }
        if (url.pathname === "/auth/accounts") {
          if (!user || user.must_change) return redirect("/auth/login");
          const member = await env.DB.prepare("SELECT role,active FROM members WHERE email=?").bind(user.email).first();
          if (!member?.active || member.role !== "admin") return page("ไม่มีสิทธิ์เข้าถึง", "<p>เฉพาะผู้ดูแลระบบเท่านั้น</p>", 403);
          let message = "";
          if (req.method === "POST") {
            const form = await formData(req);
            const email = normalizeEmail(form.get("email"));
            if (auth.account(email)) message = '<p class="error" role="alert">มีบัญชีนี้อยู่แล้ว</p>';
            else {
              const password = randomBytes(18).toString("base64url");
              try {
                await auth.createUser(email, password);
                message = `<p>สร้างบัญชี ${escape(email)} แล้ว โปรดส่งข้อมูลนี้ให้เจ้าของบัญชีผ่านช่องทางส่วนตัว รหัสผ่านจะแสดงครั้งนี้ครั้งเดียว และต้องเปลี่ยนเมื่อเข้าใช้งานครั้งแรก</p><label for="initial">รหัสผ่านเริ่มต้น</label><input id="initial" readonly value="${escape(password)}" autocomplete="off">`;
              } catch { message = '<p class="error" role="alert">สร้างบัญชีไม่สำเร็จ กรุณาตรวจสอบอีเมล</p>'; }
            }
          }
          return page("จัดการบัญชีผู้ใช้งาน", `<p>สร้างบัญชีให้ผู้เรียนหรือเจ้าหน้าที่ การกำหนดบทบาทเจ้าหน้าที่ทำในหน้าจัดการระบบ</p>${message}<form method="post"><label for="email">อีเมลเจ้าของบัญชี</label><input id="email" name="email" type="email" maxlength="254" required><button>สร้างบัญชีและรหัสผ่านเริ่มต้น</button></form><nav><a href="/settings">กำหนดบทบาทเจ้าหน้าที่</a></nav>`);
        }
        return page("ไม่พบหน้านี้", "<p>ตรวจสอบที่อยู่เว็บไซต์อีกครั้ง</p>", 404);
      }
      if (user?.must_change && url.pathname.startsWith("/api/") && req.method !== "GET") {
        res.writeHead(403, { "Content-Type": "application/json" }); return res.end(JSON.stringify({ error: "กรุณาเปลี่ยนรหัสผ่านเริ่มต้นก่อนทำรายการ" }));
      }
      const upstream = proxyRequest({ hostname: "127.0.0.1", port: internal.port, path: req.url, method: req.method,
        headers: cleanProxyHeaders(req.headers, user, origin), timeout: 60000 }, (response) => {
        res.writeHead(response.statusCode || 502, response.headers); response.pipe(res);
      });
      upstream.on("timeout", () => upstream.destroy());
      upstream.on("error", () => { if (!res.headersSent) res.writeHead(502); res.end("Service unavailable"); });
      req.on("aborted", () => upstream.destroy());
      req.pipe(upstream);
    } catch (error) {
      console.error("Request failed:", error.code || error.name);
      if (!res.headersSent) page("ไม่สามารถทำรายการได้", "<p>กรุณาลองใหม่อีกครั้ง</p>", 500);
      else res.end();
    }
  });
  server.requestTimeout = 65000;
  server.headersTimeout = 15000;
  await new Promise((resolve) => server.listen(port, host, resolve));
  return { server, auth, internal };
}

if (process.argv[1]?.endsWith("/server.mjs")) {
  const service = await startMappingServer();
  console.log("OVEC Mapping gateway is ready");
  const stop = () => { service.server.close(() => service.internal.server.close(() => { service.auth.close(); process.exit(0); })); setTimeout(() => process.exit(1), 10000).unref(); };
  process.on("SIGTERM", stop); process.on("SIGINT", stop);
}
