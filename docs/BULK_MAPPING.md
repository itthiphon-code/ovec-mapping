# Precomputed catalog mapping

`/automatic` now opens the stored full-catalog result. `/automatic/:dept:code` opens already computed target-level evidence; `/automatic/new` retains the previous optional manual-pair workflow. Opening results runs no inference and downloads no model.

## Source boundary

The source index was read from the supplied DLES search APIs on 2026-09-11: 6,900 course/department identities and 1,022 TPQI standard identities. Pagination was reconciled and duplicate identities rejected. The course endpoint enforces 60 requests/minute; fetching stopped on rate limiting, and the collector now schedules requests at least 1,100 ms apart and honors Retry-After.

A preserved public-source snapshot in the existing local OSCM catalog supplied details already retrieved from std.utc.ac.th on 2026-09-09. This is a cached mirror of DLES/TPQI curriculum data, not a new live read of every PDF. Only source_snapshot rows for public standard/subject resources were exported read-only; no accounts, reviews or student data were read or copied. Current live DLES responses take priority. Current course/department/level identity and standard external ID/title were reconciled with the cached records. Changed course titles remain visible as both snapshot and current titles, requiring version review. Remaining missing eligible details were retried directly within the rate limit.

The batch covers ปวช./ปวส. courses. Other levels are retained in the result list as OUT_OF_SCOPE. Eligible records without sufficient outcomes/competencies and description are retained as INSUFFICIENT_DATA with no score. Source snapshots retain fetch dates, upstream dates when available, request URLs, checksums and original quotations. Snapshot dates are shown on the site; source freshness is not implied by the computation date.

## Actual inference and matching

- Model: Xenova/multilingual-e5-small, revision 761b726dd34fb83930e26aab4e9ac3899aa1fa78, q8, Transformers.js 3.8.1, 384 dimensions, native ONNX offline inference.
- Both sides use query prefixes for symmetric similarity. Inputs are divided into complete 320-codepoint chunks; actual token counts are checked against 512. No oversized input is silently truncated. Chunk embeddings use mean pooling and L2 normalization; source vectors use length-weighted mean followed by L2 normalization.
- Standard criterion text includes UoC description, EoC description and the exact PC text. Qualification-level retrieval vectors are normalized means of their PC vectors. Course retrieval text includes title, learning outcomes, competencies, objectives and description; reference codes do not inflate the embedding score.
- Every eligible course is screened against every level with PC content. Full UoC references precede exact document-title references, then semantic candidates. Within each tier, compatible levels precede known mismatches; three distinct standards are retained. This is full-catalog retrieval followed by detailed shortlisted matching, not an exhaustive fine-grained cross-product of every PC with every course.
- For each shortlisted pair, every unique course requirement is compared with every PC in that selected level. Full referenced UoCs precede other units. Store the best PC for each target with original UoC/EoC/PC text, locator, cosine, displayed percentage and safety/negation/theory flags.
- Pair percentage is the mean of those best-target cosine values × 100, clipped below at zero and rounded to one decimal. It describes textual similarity of proposed pairs, never competency coverage, a probability of correctness or credit eligibility. E5 scores are often high even for different topics; there is no calibrated approval threshold.
- The displayed first pair is reordered by reference tier, compatibility and the detailed pair percentage among the three candidates. It need not be the global maximum fine-grained score across all standards.

## Persistence and approval boundary

D1 stores `bulk_runs` and indexed `bulk_courses` via generated schema and an immutable data migration. Scores, statuses, totals and list queries read the same run. Result and source JSON files are immutable deployment artifacts referenced by path and SHA-256 in D1; each detail load checks the hash before returning evidence. These artifacts contain public curriculum text only. Existing uploaded documents and per-mapping vector archives remain in R2.

No bulk result seeds expert verdicts, published mappings or credits. Adopting a compatible pair into a review workspace uses its stored evidence and creates an unverified DRAFT with INSUFFICIENT_EVIDENCE rows. Only an editor/admin can adopt; repeated adoption by the same author is idempotent. The independent expert and approver workflow remains mandatory.

## Reproduction and refresh

The collector and adapter write intermediate public-source JSON to ignored `tmp/bulk-cache`. `scripts/compute-bulk-mapping.ts` performs real inference, caches exact Float32 vectors by input SHA-256, computes alignment, writes deployment artifacts, and produces the data migration. Model and preprocessing versions plus the vector-cache hash are recorded in the run manifest. The intermediate vector cache is retained locally; it is not shipped to browsers. Reproduction requires the preserved source inputs or re-fetching the exact source snapshot.

For a new source refresh, create a fresh run ID and a new custom Drizzle migration; never overwrite a deployed snapshot. Regenerate schema migrations only when schema changes. Validate source counts, missing records, artifact hashes, quotes, percentages, review isolation and the production build before privately deploying the next snapshot. Fresh reads of all source details can take over two hours at the upstream rate limit; the website continues serving the previous completed run while a new one is computed offline.

## Primary references

- [DLES vocational curriculum search](https://dles.vec.go.th/subject/)
- [DLES standards catalog](https://dles.vec.go.th/standards)
- [E5 model card and score limitations](https://huggingface.co/intfloat/multilingual-e5-small)
- [Transformers.js model conversion](https://huggingface.co/Xenova/multilingual-e5-small)

## Completed run and validation

Run `bulk-20260911-e5-01` completed on 2026-09-11: 6,900 listed identities; 6,288 eligible ปวช./ปวส.; 6,277 computed; 11 missing sufficient detail; 612 outside scope. The 1,022-standard catalog contains 2,098 levels with PC content used for retrieval. Inference used 122,097 unique input chunks and 95,036 source PCs. Results contain 18,831 proposed standard/course pairs and 93,318 stored target-to-PC relationships. Ten courses have a full-code first-ranked reference; 179 have a first-ranked level mismatch and remain blocked from adoption.

All 93,318 stored criterion matches were checked against the correct source standard, level, UoC and EoC; all displayed percentages and pair means were recomputed from stored cosines. Artifact counts matched the manifest. Generated D1 statements are at most 34,080 bytes. Local HTTP checks cover list totals, pagination, search, score/status filters, missing-data null scores, artifact reads, permission gates, mismatch blocking, idempotent adoption, unverified draft status, blocked submission and filtered CSV export. Browser checks confirm the stored totals and table render without running inference.
