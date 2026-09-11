# Embedding Matcher

รุ่น `document-first-embedding/1.0.0` ใช้โมเดล multilingual-e5-small จริง โดย Transformers.js 3.8.1, ONNX q8, 384 dimensions ตรึงโมเดล `Xenova/multilingual-e5-small` ที่ revision `761b726dd34fb83930e26aab4e9ac3899aa1fa78` ไม่มีการสร้างเวกเตอร์จำลองในระบบใช้งาน

## วิธีใช้

เปิดงานคู่รายวิชา–มาตรฐานที่บันทึกแล้ว → วิเคราะห์อัตโนมัติ → **เชื่อมอัตโนมัติด้วย Embedding** เครื่องผู้ใช้จะดาวน์โหลดโมเดลในครั้งแรก (น้ำหนักประมาณ 118 MB รวม tokenizer และ runtime จะมากกว่านี้) คำนวณใน Web Worker แล้วส่งเวกเตอร์ให้ระบบคำนวณคะแนนและบันทึกผล ระหว่างดาวน์โหลด/คำนวณมีสถานะและปุ่มยกเลิก หากโมเดลโหลดไม่ได้ ระบบแจ้งข้อผิดพลาด ไม่มีคะแนน Embedding ทดแทนที่มาจากกฎหรือคำร่วม

ข้อมูลรายวิชาไม่ถูกส่งไปบริการ inference ภายนอก การโหลดไฟล์โมเดลจาก Hugging Face ต้องเชื่อมต่ออินเทอร์เน็ต ไฟล์ runtime ให้บริการจากไซต์นี้ Cache API ใช้เก็บไฟล์โมเดลเฉพาะเครื่อง ไม่ใช้เก็บระเบียนงาน ผลวิเคราะห์เก็บใน D1 และหลักฐานคำนวณเก็บใน R2

## ขอบเขตและสูตร

1. ตรวจอ้างอิง TPQI จากเอกสารรายวิชา รหัสเต็มและระดับมาก่อนคะแนน; รหัสท้ายไม่ยืนยันตัวตน หากระดับขัดกันคำนวณแสดงได้แต่ไม่เชื่อมตาราง
2. ฝั่งรายวิชาใช้ข้อกำหนดที่ไม่ซ้ำกันในฉบับงาน ฝั่งมาตรฐานใช้ข้อความ UoC + EoC + PC ในระดับที่เลือก เก็บข้อความผลลัพธ์ สมรรถนะ จุดประสงค์ และคำอธิบายรายวิชาเพื่อแสดงคะแนนสนับสนุนแยกกัน
3. ใช้ `query: ` ทั้งสองฝั่ง ตามคำแนะนำ E5 สำหรับ symmetric semantic similarity; แบ่งข้อความครบถ้วนเป็นช่วงละ 320 Unicode codepoints ไม่ตัดข้อความท้าย โมเดลตรวจจำนวน tokens จริงและหยุดเมื่อเกิน 512
4. Mean pooling แล้ว L2 normalize แต่ละช่วง รวมเวกเตอร์ตามน้ำหนักจำนวน codepoints แต่ละช่วงแล้ว L2 normalize อีกครั้ง เป็นนโยบาย chunk aggregation ของแอป ยังไม่ได้สอบเทียบกับชุดข้อมูล TPQI ที่ผู้เชี่ยวชาญให้คำตอบ
5. cosine = dot(a,b)/(norm(a) norm(b)). แสดง `max(0, cosine) × 100` ปัดหนึ่งตำแหน่ง; เก็บ cosine ดิบด้วย รหัสอ้างอิงไม่ได้เพิ่มเข้าในคะแนน ตัวเลือกเรียงรหัสเต็มก่อน แล้ว cosine สูงสุดก่อน
6. ค่าเฉลี่ยคู่รายวิชา–มาตรฐาน คือค่าเฉลี่ยคะแนนอันดับหนึ่งของแต่ละข้อกำหนดที่ไม่ซ้ำ แสดงจำนวนข้อที่เป็นตัวหาร คู่ที่อ้างรหัสตรงอาจมีคะแนนต่ำกว่าคู่ที่ไม่มีอ้างอิงได้ ห้ามตีความเป็นร้อยละสมรรถนะผ่าน
7. E5 มีคะแนนกระจุกตัวใกล้ 0.7–1.0 แม้ข้อความต่างกัน คะแนนใช้จัดอันดับ ไม่มี threshold ความเทียบเท่าที่รับรอง และไม่ใช่ probability ในการทดสอบโมเดลจริงเฉพาะตัวอย่างภาษาไทย งานโซลาร์ใกล้กันได้ 93.28% ส่วนโซลาร์กับบริการอาหารได้ 80.33% จึงไม่ใช้เกณฑ์ 80% ตัดสินผ่าน

## การเชื่อมและการรับรอง

นำอันดับแรกลงแถวที่ยังว่างเท่านั้น ไม่เขียนทับเกณฑ์ รหัส หมายเหตุ ช่องว่างหลักฐาน หรือ safety flag ที่คนจัดทำไว้ คง `INSUFFICIENT_EVIDENCE`, `sourceVerified=false`, `scopeConfirmed=false` ทุกข้อยังต้องตรวจเอกสารจริง ผ่านผู้เชี่ยวชาญแยกบทบาท และอนุมัติตามกระบวนการเดิม ไม่มีการเผยแพร่หรืออนุมัติหน่วยกิตอัตโนมัติ

ผลแสดงตัวเลือกสามอันดับ ข้อความต้นฉบับ ตำแหน่งเอกสาร คะแนนรายหัวข้อ จุดที่ต้องตรวจ และรายงานพิมพ์ได้ ระบบนี้เทียบภายในคู่/ระดับที่ผู้จัดทำเลือก ยังไม่รัน exhaustive embedding ทุกคู่ในคลัง

## ความตรวจสอบย้อนกลับและขอบเขตความเชื่อถือ

GET `mappings/:id/embedding-input` สร้างข้อความมาตรฐานจาก immutable snapshot พร้อม revision/content hash/plan hash ผู้จัดทำรันโมเดลบนเครื่อง แล้ว POST `embedding-analyze` ส่งเวกเตอร์ Float32 little-endian base64 เท่านั้น เซิร์ฟเวอร์สร้างแผนซ้ำ ตรวจ hash จำนวน มิติ ค่าจำกัดและ norm แล้วคำนวณ cosine เอง การสร้างผลวิเคราะห์ ฉบับใหม่ ตารางร่าง และ audit เป็น D1 atomic batch มี optimistic concurrency ป้องกัน stale results

**เวกเตอร์มาจากเครื่องผู้ใช้** การตรวจรูปแบบไม่ได้พิสูจน์ว่าโมเดลทำ inference โดยไม่ถูกดัดแปลง ไม่มี model attestation ห้ามนำคะแนนอัตโนมัติไปใช้รับรองโดยข้ามผู้เชี่ยวชาญ หากต้องการความเชื่อถือระดับบริการส่วนกลาง ต้องเพิ่มบริการ inference ที่องค์กรควบคุม

R2 เก็บ canonical plan + vectors + source hash + revision; D1 เก็บรุ่นโมเดล ขั้นตอน preprocessing, plan hash, hash ของ archive, ผลและฉบับที่นำไปใช้ GET `mappings/:id/embedding-evidence?analysisId=...` ให้ผู้มีสิทธิ์อ่านงานดาวน์โหลดหลักฐานทำซ้ำ ไม่เปิด R2 ต่อสาธารณะ ข้อมูลการทดสอบใช้เฉพาะฐาน local และติด TEST ONLY

ขอบเขตสูงสุด 250 targets, 3,000 PC และ 3,000 ข้อความไม่ซ้ำ; เวกเตอร์ส่งไม่เกิน 8 MB, ผล D1 ไม่เกิน 1 MB หากเกินแจ้งให้แบ่งขอบเขต ไม่ลดข้อมูลเงียบ ๆ

## เอกสารปฐมภูมิ

- [E5 model card: prefixes, pooling, cosine distribution, limitations](https://huggingface.co/intfloat/multilingual-e5-small)
- [ONNX conversion used by Transformers.js](https://huggingface.co/Xenova/multilingual-e5-small)
- [Transformers.js 3.8.1 Next.js and Web Worker tutorial](https://huggingface.co/docs/transformers.js/v3.8.1/tutorials/next)
- [Multilingual E5 technical report](https://arxiv.org/abs/2402.05672)

## Validation record (2026-09-11)

- TypeScript, ESLint, 35 unit tests, production build passed.
- Existing HTTP suites: 43 workflow checks and 20 lexical-analysis checks passed.
- Actual-model integration: 18 additional HTTP checks passed, including revision/hash validation, permissions, vector shape validation, automatic draft linking, evidence download, reruns and mismatched levels.
- Browser WASM inference: two TEST ONLY targets linked automatically into revision 2; mean similarity 97.8%; per-target percentages and the summary table rendered; both rows retained INSUFFICIENT_EVIDENCE. Native ONNX gave 97.9% for the same fixture, so the actual submitted vectors are archived for reproducibility.
- Production dependency audit: zero findings. Development dependencies retain vinext/image-size and drizzle/esbuild advisories, plus sharp inherited by the Node Transformers.js package. Sharp is not included in the browser text runtime; this feature does not process image uploads with it.
