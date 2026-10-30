/** Open the existing presentation batch for today's hands-on checks, without resetting stock or history. */
import assert from 'node:assert/strict';
import{addDays}from'date-fns';
import{formatInTimeZone,fromZonedTime}from'date-fns-tz';
import{mkdir,writeFile}from'node:fs/promises';
import{db}from'../src/lib/db';
import type{Prisma}from'../src/generated/prisma/client';
import{PRESENTATION_BATCH as B}from'./presentation-data';
import{assertSeedTarget,genuineFingerprint}from'./seed-presentation-demo';
import{presentationIntegrity}from'./prepare-presentation-day';
function object(v:Prisma.JsonValue|undefined):Prisma.JsonObject{assert(v&&typeof v==='object'&&!Array.isArray(v));return v;}
export async function openPresentationPreview(now=new Date()){
 await assertSeedTarget();
 const today=formatInTimeZone(now,'Asia/Bangkok','yyyy-MM-dd'),tomorrow=formatInTimeZone(addDays(now,1),'Asia/Bangkok','yyyy-MM-dd');
 const startsAt=fromZonedTime(`${today}T00:00:00`,'Asia/Bangkok'),endsAt=fromZonedTime(`${tomorrow}T20:00:00`,'Asia/Bangkok');
 return db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${B}))::text`;
  const before=await genuineFingerprint(tx),setting=await tx.systemSetting.findUniqueOrThrow({where:{key:`demo:${B}`}}),state=object(setting.value),presentation=object(state.presentation),config=object(state.config);
  if(presentation.preview&&object(presentation.preview).version===1&&object(presentation.preview).date===today)return{changed:false,...await presentationIntegrity(tx)};
  assert.equal(await tx.marketSession.count({where:{demoBatchId:B,date:today}}),2,'Expected both prepared campus-market sessions today');
  assert.equal(await tx.marketSession.count({where:{demoBatchId:B,date:tomorrow}}),2,'Expected both presentation sessions tomorrow');
  assert.equal(await tx.product.count({where:{demoBatchId:B,sessionId:{not:null},session:{demoBatchId:{not:B}}}}),0,'Do not change products bound to an unrelated market session');
  const baselineOpening=fromZonedTime(`${String(presentation.date)}T08:00:00`,'Asia/Bangkok');
  await tx.product.updateMany({where:{demoBatchId:B},data:{pickupStart:startsAt,pickupEnd:endsAt}});
  await tx.discountRule.updateMany({where:{product:{demoBatchId:B},startsAt:baselineOpening},data:{startsAt}});
  const sessions=await tx.marketSession.findMany({where:{demoBatchId:B,date:today}});
  const closesToday=fromZonedTime(`${today}T20:00:00`,'Asia/Bangkok');
  for(const session of sessions){
   await tx.marketSession.update({where:{id:session.id},data:{startsAt,endsAt:closesToday}});
   await tx.storeAttendance.updateMany({where:{store:{demoBatchId:B},sessionId:session.id},data:{expectedArrival:'00:00',sellingUntil:'20:00'}});
   await tx.stallAssignment.updateMany({where:{attendance:{store:{demoBatchId:B},sessionId:session.id}},data:{startsAt,endsAt:closesToday}});
  }
  const preview={version:1,date:today,openedAt:now.toISOString(),pickupStart:startsAt.toISOString(),pickupEnd:endsAt.toISOString(),timezone:'Asia/Bangkok'};
  await tx.systemSetting.update({where:{key:setting.key},data:{value:{...state,config:{...config,visitorReservations:true},presentation:{...presentation,pickupStart:startsAt.toISOString(),pickupEnd:endsAt.toISOString(),preview}}}});
  await tx.auditLog.create({data:{actorId:'PRESENTATION_PREVIEW_SCRIPT',action:'PRESENTATION_PREVIEW_OPENED',target:B,changes:preview}});
  assert.deepEqual(await genuineFingerprint(tx),before,'Genuine records changed; transaction rolled back');
  return{changed:true,...await presentationIntegrity(tx)};
 },{isolationLevel:'Serializable',timeout:120_000,maxWait:10_000});
}
if(import.meta.main){
 try{
  assert.equal(process.argv[2],'--apply','Usage: bun --env-file=.env.presentation-seed scripts/open-presentation-preview.ts --apply');
  const result=await openPresentationPreview();await mkdir('artifacts/chrome-preview',{recursive:true});await writeFile('artifacts/chrome-preview/preview-opened.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await db.$disconnect()}
}
