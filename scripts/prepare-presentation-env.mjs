/** Read only the existing demo deployment; write a temporary gitignored mode600 host environment. */
import {execFileSync} from 'node:child_process';import{writeFileSync}from'node:fs';
const app=JSON.parse(execFileSync('docker',['inspect','imtor-demo-app-1'],{encoding:'utf8'}))[0];const db=JSON.parse(execFileSync('docker',['inspect','imtor-demo-db-1'],{encoding:'utf8'}))[0];
const env=Object.fromEntries(app.Config.Env.map(x=>{const n=x.indexOf('=');return[x.slice(0,n),x.slice(n+1)];}));
if(env.DEMO_MODE!=='true'||env.ENABLE_DEMO_GENERATOR!=='true')throw Error('Configured demo flags required');
const url=new URL(env.DATABASE_URL);if(url.pathname!=='/imtor_demo')throw Error('Expected deployed demo database');
const ip=db.NetworkSettings.Networks['imtor-demo-internal']?.IPAddress;if(!ip)throw Error('Expected isolated deployment network');url.hostname=ip;env.DATABASE_URL=url.toString();
const keys=['DATABASE_URL','DEMO_MODE','ENABLE_DEMO_GENERATOR','APP_URL','NEXTAUTH_URL','S3_ENDPOINT','S3_REGION','S3_BUCKET','S3_ACCESS_KEY_ID','S3_SECRET_ACCESS_KEY','S3_PUBLIC_BASE_URL','S3_FORCE_PATH_STYLE','S3_PROVIDER','TZ'];
if(env.S3_BUCKET!=='imtor-images'||!new URL(env.S3_ENDPOINT).hostname.endsWith('.r2.cloudflarestorage.com'))throw Error('Expected configured R2 bucket');
writeFileSync('.env.presentation-seed',keys.filter(k=>env[k]!==undefined).map(k=>`${k}=${JSON.stringify(env[k])}`).join('\n')+'\n',{mode:0o600,flag:'wx'});
console.log('Private seed environment prepared; existing containers and configuration unchanged');
