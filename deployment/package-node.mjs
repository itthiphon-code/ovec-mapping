import { cp, mkdir, access } from "node:fs/promises";
import { resolve } from "node:path";

const target = process.argv[2];
if (!target || !resolve(target).startsWith("/tmp/ovec-mapping-release-")) throw new Error("Pass a new /tmp/ovec-mapping-release-* directory");
await access("dist/standalone/dist/server/index.js");
await mkdir(target, { recursive: false });
await cp("dist/standalone", target, { recursive: true });
await mkdir(resolve(target, "deployment"));
for (const file of ["server.mjs", "auth-store.mjs", "node-bindings.mjs", "manage-user.mjs", "migrate.mjs"])
  await cp(`deployment/${file}`, resolve(target, "deployment", file));
await cp("drizzle", resolve(target, "drizzle"), { recursive: true });
await cp("deployment/Dockerfile", resolve(target, "Dockerfile"));
await cp("deployment/dockerignore", resolve(target, ".dockerignore"));
console.log(target);
