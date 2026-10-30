import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
const source=readFileSync('src/components/global-search.tsx','utf8');
const style=readFileSync('src/components/global-search.module.css','utf8');
const css=readFileSync('src/app/globals.css','utf8');
describe('minimal global search',()=>{
 it('submits with the search keyboard without a visible submit button or instruction paragraph',()=>{
  expect(source).not.toContain('type="submit"');
  expect(source).not.toContain('พิมพ์คำค้น แล้วกด Enter หรือปุ่มค้นหา');
  expect(source).not.toContain('ลองเปลี่ยนชื่อสินค้า ร้าน หรือตลาด');
  expect(source).toContain('type="search" enterKeyHint="search"');
  expect(source).toContain('<p role="status" className="sr-only">');
  expect(source).toContain('onSubmit={async event=>');
  expect(source).toContain('pending.current?.abort()');
 });
 it('replaces orange focus rings without hiding keyboard focus',()=>{
  expect(css).not.toContain('outline: 3px solid #f6a95a');
  expect(css).toContain('outline: 2px solid var(--primary);');
  expect(style).toContain('.form input:focus-visible');
  expect(style).toContain('box-shadow: inset 0 0 0 1px var(--primary)');
 });
});
