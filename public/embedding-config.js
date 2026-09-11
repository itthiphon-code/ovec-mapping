export const EMBEDDING = Object.freeze({
  engine: "document-first-embedding/1.0.0",
  model: "Xenova/multilingual-e5-small",
  revision: "761b726dd34fb83930e26aab4e9ac3899aa1fa78",
  runtime: "transformers.js/3.8.1",
  dimensions: 384,
  dtype: "q8",
  prefix: "query: ",
  pooling: "mean",
  normalize: true,
  chunkCodepoints: 320,
  maxTexts: 3000,
  aggregation: "codepoint-weighted-mean-then-l2",
});
