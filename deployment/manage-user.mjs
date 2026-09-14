import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { AuthStore } from "./auth-store.mjs";

const root = process.env.MAPPING_DATA_DIR;
if (!root) throw new Error("MAPPING_DATA_DIR is required");
mkdirSync(root, { recursive: true, mode: 0o700 });
const store = new AuthStore(join(root, "auth.sqlite"));
const command = process.argv[2];
const email = (process.argv[3] || process.env.ADMIN_EMAIL || "itp@utc.ac.th").toLowerCase();
try {
  if (command === "bootstrap") {
    if (store.account(email)) console.log("Account already exists; no password changed.");
    else {
      const password = randomBytes(18).toString("base64url");
      await store.createUser(email, password);
      const path = join(root, "admin-initial-access.txt");
      writeFileSync(path, `OVEC Mapping\nURL: ${process.env.APP_ORIGIN}\nEmail: ${email}\nInitial password: ${password}\nChange this password at first sign-in.\n`, { mode: 0o600, flag: "wx" });
      console.log(`Created ${email}. Initial access details: ${path}`);
    }
  } else if (command === "create" || command === "reset") {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    const password = Buffer.concat(chunks).toString().trimEnd();
    if (command === "create") await store.createUser(email, password);
    else {
      if (!store.account(email)) throw new Error("Account does not exist");
      await store.changePassword(email, password);
      store.db.prepare("UPDATE accounts SET must_change=1 WHERE email=?").run(email);
    }
    console.log(`Account ${command} completed: ${email}`);
  } else throw new Error("Use bootstrap, create EMAIL, or reset EMAIL. create/reset read the password from stdin.");
} finally { store.close(); }
