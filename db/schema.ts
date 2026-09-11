import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const members = sqliteTable("members", {
  email: text("email").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull().default("editor"),
  scope: text("scope").notNull().default(""),
  validUntil: text("valid_until"),
  active: integer("active").notNull().default(1),
  createdAt: text("created_at").notNull(),
});
export const catalog = sqliteTable(
  "catalog",
  {
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    code: text("code").notNull(),
    title: text("title").notNull(),
    level: text("level").notNull(),
    category: text("category").notNull(),
    department: text("department").notNull(),
    payload: text("payload").notNull(),
    detail: text("detail"),
    sourceUrl: text("source_url").notNull(),
    fetchedAt: text("fetched_at").notNull(),
    hash: text("hash").notNull(),
  },
  (t) => [
    index("catalog_search").on(t.kind, t.level),
    index("catalog_code").on(t.code),
  ],
);
export const mappings = sqliteTable(
  "mappings",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    courseId: text("course_id").notNull(),
    standardId: text("standard_id").notNull(),
    owner: text("owner").notNull(),
    status: text("status").notNull().default("DRAFT"),
    revision: integer("revision").notNull().default(1),
    payload: text("payload").notNull(),
    contentHash: text("content_hash").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    index("mapping_status").on(t.status),
    index("mapping_owner").on(t.owner),
  ],
);
export const revisions = sqliteTable(
  "revisions",
  {
    id: text("id").primaryKey(),
    mappingId: text("mapping_id").notNull(),
    revision: integer("revision").notNull(),
    payload: text("payload").notNull(),
    hash: text("hash").notNull(),
    actor: text("actor").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [uniqueIndex("revision_unique").on(t.mappingId, t.revision)],
);
export const reviews = sqliteTable(
  "reviews",
  {
    id: text("id").primaryKey(),
    mappingId: text("mapping_id").notNull(),
    revision: integer("revision").notNull(),
    reviewer: text("reviewer").notNull(),
    role: text("role").notNull(),
    verdict: text("verdict").notNull(),
    comment: text("comment").notNull(),
    contentHash: text("content_hash").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [uniqueIndex("review_once").on(t.mappingId, t.revision, t.reviewer)],
);
export const documents = sqliteTable("documents", {
  id: text("id").primaryKey(),
  owner: text("owner").notNull(),
  title: text("title").notNull(),
  kind: text("kind").notNull(),
  filename: text("filename").notNull(),
  mime: text("mime").notNull(),
  bytes: integer("bytes").notNull(),
  hash: text("hash").notNull(),
  storageKey: text("storage_key").notNull(),
  status: text("status").notNull().default("UPLOADED"),
  createdAt: text("created_at").notNull(),
});
export const applications = sqliteTable("applications", {
  id: text("id").primaryKey(),
  owner: text("owner").notNull(),
  title: text("title").notNull(),
  status: text("status").notNull().default("DRAFT"),
  revision: integer("revision").notNull().default(1),
  payload: text("payload").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
export const audit = sqliteTable("audit", {
  id: text("id").primaryKey(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  entityId: text("entity_id").notNull(),
  detail: text("detail").notNull(),
  createdAt: text("created_at").notNull(),
});
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
export const syncRuns = sqliteTable("sync_runs", {
  id: text("id").primaryKey(),
  actor: text("actor").notNull(),
  kind: text("kind").notNull(),
  count: integer("count").notNull(),
  status: text("status").notNull(),
  detail: text("detail").notNull(),
  createdAt: text("created_at").notNull(),
});

export const mappingAnalyses = sqliteTable(
  "mapping_analyses",
  {
    id: text("id").primaryKey(),
    mappingId: text("mapping_id").notNull(),
    revision: integer("revision").notNull(),
    inputHash: text("input_hash").notNull(),
    engine: text("engine").notNull(),
    actor: text("actor").notNull(),
    result: text("result").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("analysis_mapping").on(t.mappingId, t.createdAt)],
);

export const bulkRuns = sqliteTable("bulk_runs", {
  id: text("id").primaryKey(),
  createdAt: text("created_at").notNull(),
  manifest: text("manifest").notNull(),
});
export const bulkCourses = sqliteTable(
  "bulk_courses",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    courseId: text("course_id").notNull(),
    code: text("code").notNull(),
    title: text("title").notNull(),
    department: text("department").notNull(),
    category: text("category").notNull(),
    level: text("level").notNull(),
    status: text("status").notNull(),
    basis: text("basis").notNull(),
    score: integer("score"),
    standardTitle: text("standard_title").notNull(),
    pairCount: integer("pair_count").notNull(),
    resultPath: text("result_path").notNull(),
    resultHash: text("result_hash").notNull(),
  },
  (t) => [
    index("bulk_course_search").on(t.runId, t.status, t.level),
    index("bulk_course_score").on(t.runId, t.score),
  ],
);
