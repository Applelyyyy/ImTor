import { expect, it, vi } from "vitest";
import worker from "../../infra/r2-media/worker.mjs";
const key = `/demo/rd-1234567890abcdef/products/${"a".repeat(64)}.webp`;
it("serves only narrowly shaped public demo derivatives as WebP", async () => {
  const get=vi.fn().mockResolvedValue({body:new Uint8Array([1]),size:1,httpEtag:'"demo"'});
  const response=await worker.fetch(new Request('https://media.imtor.applely.dev'+key),{IMTOR_IMAGES:{get}});
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toBe('image/webp');
  expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  expect(get).toHaveBeenCalledWith(key.slice(1));
});
it("keeps private demo source/manifests and encoded paths inaccessible", async()=>{
 const get=vi.fn();
 for(const path of ['/demo/rd-1234567890abcdef/manifest.json','/demo/rd-1234567890abcdef/raw/source.png','/demo/rd-1234567890abcdef/products/private.webp',key.replace('/products/','/%2e%2e/'),key.replace('.webp','.svg')]){
  expect((await worker.fetch(new Request('https://media.imtor.applely.dev'+path),{IMTOR_IMAGES:{get}})).status).toBe(404);
 }
 expect(get).not.toHaveBeenCalled();
});
