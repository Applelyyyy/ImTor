import { it,expect } from 'vitest';
import { globSync,readFileSync } from 'node:fs';
it('each admin page authorizes independently before loading private records',()=>{
 for(const path of globSync('src/app/admin/**/page.tsx')) {
  const source=readFileSync(path,'utf8');
  const guard=source.indexOf('await requireAdmin()');
  expect(guard,`${path} requires its own guard; layouts do not protect streamed child records`).toBeGreaterThan(-1);
  const query=source.indexOf('await db.');
  if(query>=0)expect(guard,`${path} must authorize before querying`).toBeLessThan(query);
 }
});
