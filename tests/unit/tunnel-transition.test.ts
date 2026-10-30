import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';
it('refuses old Caddy, old DB networks and published DB ports before mode conversion',()=>{
 const dir=mkdtempSync(join(tmpdir(),'imtor-tunnel-guard-'));
 try {
  writeFileSync(join(dir,'docker'),`#!/bin/bash
case "$*" in
 *compose.service=caddy*) [[ "$TEST_CADDY" != yes ]] || echo test-caddy;;
 *compose.service=db*) echo test-db;;
 *NetworkSettings.Networks*) printf '%s\\n' "$TEST_NETWORK";;
 *PortBindings*) echo "$TEST_PORT_COUNT";;
 *) exit 99;;
esac
exit 0
`,{mode:0o700});
  const run=(extra:Record<string,string>={})=>spawnSync('bash',['-c','source scripts/_common.sh; validate_tunnel_transition'],{cwd:resolve('.'),encoding:'utf8',env:{NODE_ENV:'test',PATH:dir+':'+process.env.PATH,IMTOR_ENV_FILE:resolve('tests/fixtures-compose.env'),COMPOSE_MODE:'tunnel',TEST_NETWORK:'imtor-internal',TEST_PORT_COUNT:'0',...extra}});
  expect(run().status).toBe(0);
  const cases: Record<string,string>[] = [{TEST_CADDY:'yes'},{TEST_NETWORK:'imtor_default'},{TEST_PORT_COUNT:'1'}];
  for(const extra of cases){
   const result=run(extra);expect(result.status).toBe(1);expect(result.stderr).toContain('controlled');
  }
 }finally{rmSync(dir,{recursive:true,force:true});}
});
