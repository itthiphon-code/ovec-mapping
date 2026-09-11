/// <reference types="@cloudflare/workers-types" />
declare module "*.sql?raw" {
  const content: string;
  export default content;
}
declare module "cloudflare:workers" {
  export const env: Record<string, unknown>;
}
