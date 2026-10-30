/** Reusable, content-addressed demo media only. Never changes R2 policy, CORS, or Worker. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { S3Client, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { PRESENTATION_BATCH, existingImageSources, presentationStalls } from './presentation-data';

export const mediaManifestPath = 'artifacts/presentation-demo/media/manifest.json';
export type DemoMedia = { subject:string; key:string; url:string; sha256:string; bytes:number; file:string; uploaded:boolean; provenance:string };
export const digest = (bytes:Uint8Array|string) => createHash('sha256').update(bytes).digest('hex');
function layout(index:number){
  const slots=presentationStalls(index);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="800" viewBox="0 0 1440 800">
  <rect width="1440" height="800" rx="24" fill="#faf6ec"/><rect x="28" y="28" width="1384" height="100" rx="20" fill="#204d3a"/>
  <text x="720" y="91" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="32" fill="white">${index===0?'SMALL':'LARGE'} MARKET</text>
  <text x="720" y="104" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#d3e8d4"></text>
  <rect x="70" y="145" width="1300" height="535" rx="26" fill="#e7ede2" stroke="#b6c4ad" stroke-width="3"/>
  ${index===0?'<path d="M720 145V680 M70 290H1370 M70 505H1370" stroke="#fffdf5" stroke-width="65"/>':'<path d="M475 145V680 M965 145V680 M70 382H1370" stroke="#fffdf5" stroke-width="65"/>'}
  ${slots.map(s=>`<rect x="${s.x*1440-80}" y="${s.y*800-34}" width="160" height="68" rx="12" fill="${s.zone===0?'#cce0cc':'#eddbc4'}" stroke="#a0b49a" stroke-width="2"/>`).join('')}
  <text x="720" y="723" text-anchor="middle" font-family="sans-serif" font-size="24" fill="#204d3a">ZONE A / ZONE B</text>
  <text x="720" y="765" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#5b6457"></text></svg>`;
}
export async function prepareMedia(){
  await mkdir('artifacts/presentation-demo/media',{recursive:true});
  const assets:DemoMedia[]=[];
  const base=process.env.S3_PUBLIC_BASE_URL?.replace(/\/$/,'');
  if(!base||new URL(base).hostname!=='media.imtor.applely.dev')throw Error('Expected configured ImTor public media host');
  for(const [subject,source] of [...Object.entries(existingImageSources),['small-layout','schematic'],['large-layout','schematic']]){
    const schematic=source==='schematic';
    const input=schematic?Buffer.from(layout(subject==='small-layout'?0:1)):await readFile(source);
    // The existing deployed media Worker accepts approved JPEGs only; do not redeploy it.
    const bytes=await sharp(input).rotate().resize(schematic?1440:800,schematic?800:1000,{fit:schematic?'fill':'cover'}).jpeg({quality:85,mozjpeg:true}).toBuffer();
    const hash=digest(bytes),uuid=`${hash.slice(0,8)}-${hash.slice(8,12)}-${hash.slice(12,16)}-${hash.slice(16,20)}-${hash.slice(20,32)}`,key=`approved/${PRESENTATION_BATCH}/${uuid}.jpg`;
    const file=`artifacts/presentation-demo/media/${subject}.jpg`;
    await writeFile(file,bytes);
    assets.push({subject,key,url:`${base}/${key}`,sha256:hash,bytes:bytes.length,file,uploaded:false,
      provenance:schematic?'Original fictional schematic; no real geography':source.startsWith('public/demo-library/')?'Original AI photograph; public/demo-library/manifest.json':`Existing Unsplash photograph: ${source}; public/images/README.md`});
  }
  if(new Set(assets.map(a=>a.key)).size!==14)throw Error('Unexpected duplicated media');
  return assets;
}
export async function uploadMedia(){
  if(process.env.S3_BUCKET!=='imtor-images'||!process.env.S3_ENDPOINT?.endsWith('.r2.cloudflarestorage.com'))throw Error('Unexpected R2 target');
  const s3=new S3Client({endpoint:process.env.S3_ENDPOINT,region:process.env.S3_REGION??'auto',forcePathStyle:process.env.S3_FORCE_PATH_STYLE==='true',requestChecksumCalculation:'WHEN_REQUIRED',credentials:{accessKeyId:process.env.S3_ACCESS_KEY_ID!,secretAccessKey:process.env.S3_SECRET_ACCESS_KEY!}});
  const assets=await prepareMedia();
  for(const asset of assets){
    let exists=false;
    try{const head=await s3.send(new HeadObjectCommand({Bucket:'imtor-images',Key:asset.key}));
      if(head.Metadata?.sha256!==asset.sha256||head.ContentLength!==asset.bytes)throw Error('Existing immutable asset does not match manifest');exists=true;
    }catch(error){if((error as {$metadata?:{httpStatusCode?:number}}).$metadata?.httpStatusCode!==404)throw error;}
    if(!exists){await s3.send(new PutObjectCommand({Bucket:'imtor-images',Key:asset.key,Body:await readFile(asset.file),ContentType:'image/jpeg',CacheControl:'public, max-age=31536000, immutable',Metadata:{sha256:asset.sha256,'demo-batch':PRESENTATION_BATCH}}));asset.uploaded=true;}
    const response=await fetch(asset.url);
    if(!response.ok||!response.headers.get('content-type')?.startsWith('image/jpeg')||digest(new Uint8Array(await response.arrayBuffer()))!==asset.sha256)throw Error(`Public media verification failed: ${asset.subject} HTTP ${response.status}`);
    await writeFile(mediaManifestPath,JSON.stringify({batch:PRESENTATION_BATCH,verifiedAt:new Date(),assets},null,2));
    console.log(JSON.stringify({subject:asset.subject,uploaded:asset.uploaded,publicStatus:response.status,bytes:asset.bytes}));
  }
  return assets;
}
if(import.meta.main){if(process.argv[2]!=='--upload')throw Error('Usage: bun --env-file=.env.presentation-seed scripts/presentation-media.ts --upload');await uploadMedia();}
