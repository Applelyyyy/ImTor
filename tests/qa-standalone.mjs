// Test-only bootstrap for the unchanged standalone image. Never used by deployment.
// The only configuration difference is an allowlisted loopback image origin.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const db = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid/invalid');
if (process.env.IMTOR_LOCAL_QA !== 'true' || !db.pathname.endsWith('_test') ||
    !['127.0.0.1','localhost'].includes(db.hostname) || process.env.HOSTNAME !== '127.0.0.1' ||
    process.env.APP_URL !== 'http://localhost:3100' ||
    process.env.S3_PUBLIC_BASE_URL !== 'http://127.0.0.1:59000/imtor-test')
  throw new Error('Isolated loopback *_test configuration required');
process.env.NODE_ENV = 'production';
process.chdir('/app');
const config = JSON.parse(readFileSync('/app/.next/required-server-files.json','utf8')).config;
config.images = {...config.images, dangerouslyAllowLocalIP:true, remotePatterns:[
  {protocol:'http',hostname:'127.0.0.1',port:'59000',pathname:'/imtor-test/**'},
]};
process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify(config);
const require = createRequire('/app/server.js');
require('next');
const {startServer} = require('next/dist/server/lib/start-server');
await startServer({dir:'/app',isDev:false,config,hostname:'127.0.0.1',port:3100,allowRetry:false});
