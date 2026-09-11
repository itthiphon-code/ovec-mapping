import { pipeline, env } from "./embedding-runtime/transformers.min.js";
import { EMBEDDING } from "./embedding-config.js";
env.allowLocalModels = false;
env.useBrowserCache = true;
env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.proxy = false;
env.backends.onnx.wasm.wasmPaths = new URL(
  "./embedding-runtime/",
  import.meta.url,
).href;
let extractor;
self.onmessage = async ({ data }) => {
  try {
    if (
      data.engine !== EMBEDDING.engine ||
      !Array.isArray(data.texts) ||
      data.texts.length > EMBEDDING.maxTexts
    )
      throw new Error("ข้อมูลโมเดลไม่ตรง กรุณาโหลดหน้าใหม่");
    extractor ||= await pipeline("feature-extraction", EMBEDDING.model, {
      revision: EMBEDDING.revision,
      dtype: EMBEDDING.dtype,
      device: "wasm",
      progress_callback: (p) => {
        if (p.status === "progress")
          self.postMessage({
            type: "progress",
            message: `ดาวน์โหลดโมเดล ${p.file}: ${Math.round(p.progress)}%`,
          });
        if (p.status === "initiate")
          self.postMessage({
            type: "progress",
            message: `เตรียมโมเดล ${p.file}…`,
          });
      },
    });
    const vectors = [];
    for (let i = 0; i < data.texts.length; i++) {
      const text = data.texts[i];
      if (
        typeof text !== "string" ||
        Array.from(text).length > EMBEDDING.chunkCodepoints + 20
      )
        throw new Error("ข้อความเกินขอบเขตที่กำหนด");
      const tokenized = await extractor.tokenizer(text, { truncation: false });
      if (tokenized.input_ids.dims.at(-1) > 512)
        throw new Error(
          "ข้อความเกิน 512 tokens จึงหยุดเพื่อป้องกันข้อมูลถูกตัด",
        );
      const output = await extractor(text, {
        pooling: "mean",
        normalize: true,
        truncation: false,
      });
      if (output.data.length !== EMBEDDING.dimensions)
        throw new Error("มิติเวกเตอร์ไม่ตรงกับโมเดล");
      const bytes = new Uint8Array(EMBEDDING.dimensions * 4),
        view = new DataView(bytes.buffer);
      output.data.forEach((v, j) => view.setFloat32(j * 4, v, true));
      vectors.push(btoa(String.fromCharCode(...bytes)));
      self.postMessage({
        type: "progress",
        message: `เปรียบเทียบความหมาย ${i + 1} / ${data.texts.length} ข้อความ`,
        completed: i + 1,
        total: data.texts.length,
      });
    }
    self.postMessage({ type: "complete", vectors });
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error.message || "ประมวลผล Embedding ไม่สำเร็จ",
    });
  }
};
