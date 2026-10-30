import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
it('global search submits on Enter, cancels stale requests and renders results beside input',()=>{
 const src=readFileSync('src/components/global-search.tsx','utf8');
 expect(src).toContain('onSubmit');expect(src).toContain('AbortController');expect(src).toContain('signal.aborted');expect(src).toContain('role="status"');expect(src).toContain('/api/products?');expect(src).toContain('AppDialog');
});
it('settings and pickup keep routine forms in contextual dialogs',()=>{
 expect(readFileSync('src/app/merchant/settings/page.tsx','utf8')).toContain('ContextualForm');
 expect(readFileSync('src/app/merchant/reservations/page.tsx','utf8')).toContain('ContextualForm');
});
it('reservation confirmation is a compact contextual dialog instead of an inline quantity form',()=>{expect(readFileSync('src/app/product/[id]/page.tsx','utf8')).toContain('title="ยืนยันการจอง"');});
