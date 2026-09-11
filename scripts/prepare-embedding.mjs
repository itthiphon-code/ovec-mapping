import { copyFile, mkdir, rm } from "node:fs/promises";
const source = new URL(
  "../node_modules/@huggingface/transformers/dist/",
  import.meta.url,
);
const target = new URL("../public/embedding-runtime/", import.meta.url);
await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
for (const file of [
  "transformers.min.js",
  "ort-wasm-simd-threaded.jsep.mjs",
  "ort-wasm-simd-threaded.jsep.wasm",
]) {
  await copyFile(new URL(file, source), new URL(file, target));
}
await copyFile(
  new URL("../node_modules/@huggingface/transformers/LICENSE", import.meta.url),
  new URL("TRANSFORMERS-LICENSE.txt", target),
);

await copyFile(
  new URL(
    "../node_modules/onnxruntime-web/dist/ort.bundle.min.mjs",
    import.meta.url,
  ),
  new URL("ort.bundle.min.mjs", target),
);
await copyFile(
  new URL("../docs/licenses/ONNX-LICENSE.txt", import.meta.url),
  new URL("ONNX-LICENSE.txt", target),
);
console.log("Prepared pinned browser embedding runtime");
