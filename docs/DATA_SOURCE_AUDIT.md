# ผลตรวจแหล่งข้อมูลจริง

ตรวจวันที่ 11 กันยายน 2569 (2026-09-11) · snapshot `evidence/20260911T070049538821Z/`

## 1. ขอบเขตการตรวจ

เปิดเว็บไซต์ที่ผู้ใช้ให้ อ่าน JavaScript สาธารณะเพื่อหารูปแบบ request และเรียกเฉพาะ GET ข้อมูลมาตรฐาน/รายวิชา เก็บตัวอย่าง 10 JSON และ PDF หลักสูตร 1 ไฟล์พร้อม SHA-256 ไม่เรียก API ยืนยันผล แก้ไข หรือนำเข้าข้อมูล และไม่ได้สำรวจครบทุกมาตรฐาน/รายวิชา

ใช้ `dles.vec.go.th` ตามที่ระบุในการออกแบบครั้งนี้ ไม่สมมติว่า API ของระบบหรือโดเมนที่เคยตรวจในงานก่อนหน้ามี schema เดียวกัน

## 2. API ที่ตรวจแล้วว่าอ่านได้

| URL / เส้นทาง | รูปแบบที่พบ | ข้อสังเกต |
|---|---|---|
| [มาตรฐาน TPQI](https://dles.vec.go.th/standards/tpqi) | หน้าค้นเฉพาะ TPQI | `/standards` รวมหลายเจ้าของมาตรฐาน ต้องเลือก TPQI |
| [สถิติ TPQI](https://dles.vec.go.th/api/standards/tpqi/stats) | books, withContent, levels, units, elements, generatedAt | ยอดที่ API รายงาน ไม่ใช่ยอดที่นับตรวจครบทุกหน้า |
| [ค้นมาตรฐาน](https://dles.vec.go.th/api/standards/tpqi/search?limit=2&page=1) | results, total, page, limit, totalPages | ทดสอบหน้า 1 ได้ ID 22/23 และหน้า 2 ได้ 24/25 |
| [รายละเอียดตัวอย่าง](https://dles.vec.go.th/api/standards/tpqi/22) | levels[].units[].elements[] | มีรหัสและข้อความ UoC/EoC, pc_items, assess_items |
| [วันอัปเดต](https://dles.vec.go.th/api/standards/meta) | tpqi/dsd, lastCheckedAt, lastUpdatedAt | แยกวันที่ตรวจจากวันที่ข้อมูลเปลี่ยน |
| [สถานะรายวิชา](https://dles.vec.go.th/subject/api/std2018-status) | subjects, subjects2567, curriculumSubjects, syncedAt | มียอดหลายขอบเขต ไม่ควรใช้แทนกัน |
| [ค้นรายวิชา](https://dles.vec.go.th/subject/api/search?limit=2&offset=0) | subjects, departments, totalSubjects, hasMore | ใช้ offset; ทดสอบ 0 กับ 2 แล้วได้วิชาคนละรายการ |
| [รายละเอียดรายวิชา](https://dles.vec.go.th/subject/api/subject-detail?code=20100-1001&dept=20101) | courseCode, standardRef, learningOutcomes, competencies, description, pdfUrl, pdfPage | ต้องส่งทั้ง code และ dept |
| [รายการอ้างอิงที่ระบบเดิมแยกให้](https://dles.vec.go.th/subject/api/link/course?code=20100-1001&dept=20101) | course, refs[], library, levelExact, match | มีผล fuzzy และ threshold ของระบบเดิม; นำเข้าฐานะข้อเสนอเท่านั้น |

เส้นทาง `/api/standards/tpqi` เปล่าตอบ 404 แต่เส้นทาง `/stats`, `/search` และ `/:id` ใช้งานได้ในการตรวจนี้ การตอบ 404 ที่ฐาน path ไม่ได้แปลว่าไม่มี API

API เหล่านี้ค้นพบจากหน้าที่ใช้งานจริง ยังไม่ได้ยืนยันสัญญา API/SLA/สิทธิ์นำไปให้บริการซ้ำ/เพดาน request กับเจ้าของระบบ จึงต้องมี adapter และ contract test; ไม่อ้างว่าเป็น public API contract ที่รับประกันคงที่

## 3. จำนวนที่ API รายงาน ณ snapshot

| รายการ | ค่า |
|---|---:|
| TPQI books | 1,022 |
| รายการมีเนื้อหา withContent | 1,006 |
| levels | 2,140 |
| units | 11,163 |
| elements | 32,855 |
| subject-status: subjects | 6,900 |
| subject-status: subjects2567 | 6,733 |
| subject-status: curriculumSubjects | 14,870 |

TPQI `generatedAt` เป็น 2026-08-31T18:06:18.769Z และรายวิชา `syncedAt` เป็น 2026-08-31T19:00:11.737Z การดึงวันที่ 11 กันยายนไม่ได้แปลว่าข้อมูลปรับปรุงวันเดียวกัน

ยังไม่ทราบนิยามตัวตน/การนับซ้ำของทุกยอด รายวิชารหัสเดียวอาจอยู่หลายสาขา จึงห้ามอ้างจำนวนนี้เป็นจำนวนวิชาไม่ซ้ำโดยไม่มีการ reconcile ข้อมูลทั้งหมด

## 4. กรณีจริงที่เป็นข้อกำหนดป้องกันความผิดพลาด

รายวิชา `20100-1001` เขียนแบบเทคนิคเบื้องต้น ในสาขา `20101` มี [PDF หลักสูตรต้นฉบับ](https://bsq.vec.go.th/wp-content/uploads/sites/13/2026/03/20101v8.pdf#page=57) ตรวจด้วยการอ่านข้อความและภาพหน้ากระดาษแล้ว:

- PDF มี 156 หน้า; รายวิชาอยู่ **หน้าไฟล์ 57 / หน้าเล่ม 46**
- หัวข้ออ้างอิงระบุ `CIP-NPEC-103B` และอาชีพช่างเขียนแบบเครื่องกล ระดับ 3
- ในหน้าเดียวกันมีอ้างอิงกรมพัฒนาฝีมือแรงงานด้วย ต้องแยกตามเจ้าของมาตรฐาน
- มีผลลัพธ์ จุดประสงค์ สมรรถนะรายวิชา และคำอธิบายรายวิชาจริง

API `link/course` เก็บข้อความอ้างอิงระดับ 3 แต่รายการ `refs[0].library` ที่เสนอเป็น `match: "fuzzy"`, ชื่อช่างเขียนแบบงานเครื่องกล, `levelNo: 4`, `levelExact: false` และรายการระดับที่มีเป็น 4/5/6 ตัว parser ยังให้ `codes: ["103B"]` ขณะที่ข้อความดิบมีรหัสเต็ม

**ข้อสรุปที่ตรวจได้:** API ตัวอย่างนี้เสนอรายการชื่อใกล้เคียงแต่ระดับไม่ตรงกับอ้างอิง ไม่ได้พิสูจน์ว่ามาตรฐานที่อ้างถึงไม่มีอยู่ และไม่ได้พิสูจน์ว่าผล mapping ทั้งเว็บไซต์ผิด ระบบใหม่ต้องรักษารหัสเต็มและสถานะ `LEVEL_MISMATCH` / `VERSION_UNRESOLVED` ให้ผู้เชี่ยวชาญตามเอกสารต่อ ห้ามใช้รายการ fuzzy นี้เป็นหลักฐานเทียบเท่าที่รับรองแล้ว

ค่า `threshold: 60` ใน response เป็นค่าของระบบต้นทาง ไม่ใช่เกณฑ์เทียบโอนที่ยืนยันว่ามีฐานทางวิชาการหรือข้อบังคับ จึงไม่สืบทอดเป็นเกณฑ์อนุมัติ

## 5. ข้อจำกัดของโครงสร้างข้อมูล

ตัวอย่างมาตรฐาน 22 มี `uoc_code`, `uoc_desc`, `uoc_cert`, `eoc_code`, `eoc_desc`, `pc_items[]`, `assess_items[]` ภายใต้ระดับ `qualificationId` และมี `sourceUrl` ไป TPQI แต่ไม่พบชุด evidence guide/required knowledge/range แบบครบทุกหัวข้อในหน่วยตัวอย่าง จึงต้องรองรับการแนบเอกสาร TPQI เพิ่ม ไม่ตีความฟิลด์ที่ไม่มีว่า “มาตรฐานไม่กำหนด”

`pc_items` เป็นข้อความในอาร์เรย์ ไม่มีรหัส PC ทางการในตัวอย่างนี้ จึงสร้าง local stable ID โดยผูก snapshot/UoC/EoC/ตำแหน่งและ hash ได้ แต่ต้องแสดงว่าเป็นรหัสภายใน ห้ามสร้างเลข PC ทางการขึ้นเอง

ฝั่ง `subject-detail` ให้ `competencies` เป็นข้อความหลายบรรทัด แต่ `link/course.course.competencies` เป็นอาร์เรย์ แยก raw payload กับ normalized representation และไม่ถือจำนวนบรรทัดเป็นข้อกำหนดเสมอ `assessmentName` เช่นระบบเกรด ไม่ใช่ rubric หรือหลักฐานทดสอบภาคปฏิบัติ

`credit: "1-3-2"` ต้องเก็บข้อความดิบ ก่อน normalize เป็นทฤษฎี-ปฏิบัติ-หน่วยกิตให้ยืนยันความหมายตามคำอธิบายหลักสูตร ไม่ตีความเป็นชั่วโมงรวมทั้งภาคเรียน

API ไม่ได้ให้ citation ตำแหน่งทุก PC โดยอัตโนมัติ; การมี sourceUrl เพียงระดับอาชีพยังไม่เพียงพอสำหรับรับรองแถวรายข้อ

## 6. แผนนำเข้าจริง

1. ดึง metadata และ catalogue ทีละหน้า/offset ด้วยขนาด batch ที่เจ้าของบริการยอมรับ ตั้ง timeout และ retry เมื่อ 429/5xx โดยเคารพ Retry-After
2. ตรวจ page fingerprint, ID ซ้ำ, hasMore, totalPages และเงื่อนไขหยุด ป้องกันต้นทางคืนหน้าเดิมไม่สิ้นสุด
3. ดึงรายละเอียดแต่ละรายการที่เปลี่ยน เก็บ response ดิบก่อน normalize พร้อม schema version
4. ตามลิงก์เอกสารเจ้าของมาตรฐาน เก็บ checksum/mime/final URL/วันดึง และฉบับ/วันมีผลซึ่งต้องตรวจแยกจากวันดึง
5. Extract/OCR เก็บ PDF page index, page number ที่พิมพ์, heading, bounding box, quote และผู้ตรวจข้อความ
6. ทำ staging ตรวจ count และ orphan รวมถึงความสัมพันธ์หลายสาขา ก่อนเลื่อนเป็น snapshot ใช้งาน
7. นำเข้าซ้ำต้องไม่สร้างตัวตนซ้ำ ข้อมูลหายจากต้นทางให้ mark missing/withdrawn หลังตรวจ ไม่ hard-delete หลักฐานที่เคยใช้
8. Snapshot เปลี่ยนเปิด impact review; ผลที่รับรองแล้วไม่ถูกเขียนทับด้วยการ sync

## 7. หลักฐานและการทำซ้ำ

`manifest.json` เก็บ status, URL, final URL, retrieved_at, content_type, bytes และ sha256 ของทุกไฟล์ ใช้ `python3 scripts/verify_evidence.py` ตรวจแบบออฟไลน์

การทดสอบสองหน้าพิสูจน์เพียงว่า pagination ขยับได้ในตัวอย่าง ไม่ยืนยันการซิงก์ครบทั้งหมดหรือไม่มี record ตกหล่น การเปิดใช้งานต้อง reconcile ทุกหน้า ทุกขอบเขต และสุ่มตรวจ PDF เพิ่มตามสาขา

แหล่งหลักประกอบการออกแบบเพิ่มเติม: [TPQI ตัวอย่างหน่วยสมรรถนะพร้อม PC และ Evidence Guide](https://tpqinet-api.tpqi.go.th/qualifications/unitinfo/14828), [Cedefop validation](https://www.cedefop.europa.eu/en/tools/validation-non-formal-informal-learning) ยังไม่ได้ตรวจยืนยันระเบียบเทียบโอนที่ใช้บังคับครบชุด จึงต้องทำส่วน policy governance ก่อนใช้ออกคำตัดสินจริง
