/** Batch-scoped presentation copy/timing preparation. Never removes genuine data or resets inventory. */
import assert from 'node:assert/strict';
import{mkdir,writeFile,copyFile}from'node:fs/promises';
import{constants}from'node:fs';
import{formatInTimeZone,fromZonedTime}from'date-fns-tz';
import{z}from'zod';
import{db}from'../src/lib/db';
import{type Prisma}from'../src/generated/prisma/client';
import{PRESENTATION_BATCH as B,presentationShops}from'./presentation-data';
import{type DemoMedia,uploadMedia,mediaManifestPath}from'./presentation-media';
import{assertSeedTarget,genuineFingerprint}from'./seed-presentation-demo';
const directory='artifacts/presentation-ready';
const clean=(name:string)=>name.replace(/^\[(?:สาธิต|ตัวอย่าง)\]\s*/u,'').trim();
const marked=(value:string|null)=>!!value&&/สาธิต|ตัวอย่าง|สมมติ|จำลอง/u.test(value);
const object=(value:Prisma.JsonValue|undefined):Prisma.JsonObject=>{assert(value&&typeof value==='object'&&!Array.isArray(value));return value;};
export async function presentationIntegrity(tx:Prisma.TransactionClient=db){
 const products=await tx.product.findMany({where:{demoBatchId:B},include:{movements:true}});
 for(const p of products){assert(p.stock!==null&&p.stock>=0);assert.equal(p.stock,p.movements.reduce((sum,m)=>sum+m.delta,0));assert(!marked(p.name));assert(p.pickupStart&&p.pickupEnd&&p.pickupStart<p.pickupEnd);}
 const stores=await tx.store.findMany({where:{demoBatchId:B}});assert(stores.every(s=>!marked(s.name)));
 const markets=await tx.marketVenue.findMany({where:{demoBatchId:B},include:{sessions:true}});assert(markets.every(m=>!marked(m.name)&&m.latitude===null&&m.longitude===null));
 const setting=await tx.systemSetting.findUniqueOrThrow({where:{key:`demo:${B}`}});const value=object(setting.value),policy=object(value.config);assert.equal(policy.visitorReservations,true);
 return{batch:B,stores:stores.length,products:products.length,markets:markets.length,reservations:await tx.reservation.count({where:{demoBatchId:B}}),inventoryBalanced:true,visitorReservationsEnabled:true,window:value.presentation,marketSessions:markets.map(m=>({id:m.id,name:m.name,sessions:m.sessions.map(s=>({id:s.id,date:s.date,startsAt:s.startsAt.toISOString(),endsAt:s.endsAt.toISOString()}))}))};
}
export async function preparePresentationDay(assets:DemoMedia[],day='2026-11-01'){
 z.iso.date().parse(day);await assertSeedTarget();
 const pickupStart=fromZonedTime(`${day}T08:00:00`,'Asia/Bangkok'),pickupEnd=fromZonedTime(`${day}T20:00:00`,'Asia/Bangkok');assert(pickupEnd>new Date(),'Presentation day has already ended');
 return db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${B}))::text`;
  const before=await genuineFingerprint(tx);
  const row=await tx.systemSetting.findUniqueOrThrow({where:{key:`demo:${B}`}}),state=object(row.value),config=object(state.config);
  if(state.presentation&&object(state.presentation).version===1&&object(state.presentation).date===day)return{changed:false,...await presentationIntegrity(tx)};
  const shops=await tx.store.findMany({where:{demoBatchId:B},include:{attendances:{include:{session:true,assignment:true}}}});const markets=await tx.marketVenue.findMany({where:{demoBatchId:B},include:{sessions:true}});const products=await tx.product.findMany({where:{demoBatchId:B},include:{discounts:true,category:true}});
  assert.equal(shops.length,12);assert.equal(products.length,36);assert.equal(markets.length,2);
  // Ensure tomorrow has a persisted session and the same configured store/stall relationships.
  for(const [marketIndex,market] of markets.entries()){
   let target=market.sessions.find(session=>session.date===day);
   if(!target)target=await tx.marketSession.create({data:{id:`${B}-presentation-${marketIndex}-${day}`,marketId:market.id,date:day,startsAt:pickupStart,endsAt:pickupEnd,status:'SCHEDULED',demoBatchId:B}});
   assert.equal(target.demoBatchId,B,'Target session belongs to a different data source');
   for(const shop of shops){
    if(shop.attendances.some(a=>a.sessionId===target.id))continue;
    const previous=shop.attendances.find(a=>a.session.marketId===market.id&&a.assignment);
    if(!previous?.assignment)continue;
    const attendance=await tx.storeAttendance.create({data:{id:`${B}:presentation-attendance:${marketIndex}:${shop.id.split(':store:')[1]}:${day}`,storeId:shop.id,sessionId:target.id,status:'OPEN',authorized:true,expectedArrival:'08:00',sellingUntil:'20:00',assignment:{create:{id:`${B}:presentation-assignment:${marketIndex}:${shop.id.split(':store:')[1]}:${day}`,stallId:previous.assignment.stallId,startsAt:pickupStart,endsAt:pickupEnd,verified:false}}},include:{session:true,assignment:true}});
    shop.attendances.push(attendance);
   }
  }
  for(const shop of shops){const index=Number(shop.id.split(':store:')[1]),catalog=presentationShops[index];assert(catalog);
   await tx.store.update({where:{id:shop.id},data:{name:clean(shop.name),description:marked(shop.description)?catalog.description:shop.description,address:marked(shop.address)?'':shop.address}});
   for(const attendance of shop.attendances){
    if(attendance.session.demoBatchId!==B||attendance.session.date<formatInTimeZone(new Date(),'Asia/Bangkok','yyyy-MM-dd'))continue;
    const session=attendance.session,start=fromZonedTime(`${session.date}T08:00:00`,'Asia/Bangkok'),end=fromZonedTime(`${session.date}T20:00:00`,'Asia/Bangkok');
    await tx.marketSession.update({where:{id:session.id},data:{startsAt:start,endsAt:end,status:'SCHEDULED'}});
    await tx.storeAttendance.update({where:{id:attendance.id},data:{status:'OPEN',expectedArrival:'08:00',sellingUntil:'20:00'}});
    if(attendance.assignment)await tx.stallAssignment.update({where:{id:attendance.assignment.id},data:{startsAt:start,endsAt:end}});
   }
  }
  for(const market of markets){const asset=assets.find(a=>a.subject===(market.type==='SMALL'?'small-layout':'large-layout'));assert(asset);
   await tx.marketVenue.update({where:{id:market.id},data:{name:clean(market.name),description:marked(market.description)?'':market.description,address:marked(market.address)?'':market.address,entrance:marked(market.entrance)?'':market.entrance,layoutImage:asset.url}});
   const zones=await tx.marketZone.findMany({where:{marketId:market.id}});for(const zone of zones)if(marked(zone.name))await tx.marketZone.update({where:{id:zone.id},data:{name:zone.name.match(/^[AB]/)?.[0]??clean(zone.name)}});
   await tx.marketStall.updateMany({where:{marketId:market.id,directions:{contains:'สมมติ'}},data:{directions:''}});
  }
  for(const p of products){
   const index=Number(p.id.split('-product-')[1]);assert(Number.isInteger(index));
   const rescue=[6,18].includes(index)&&p.category.food;
   await tx.product.update({where:{id:p.id},data:{name:clean(p.name),description:marked(p.description)?'':p.description,allergens:marked(p.allergens)?'สอบถามร้านเกี่ยวกับส่วนผสม':p.allergens,storage:marked(p.storage)?'รับสินค้าภายในเวลาที่ระบุ':p.storage,pickupStart,pickupEnd,...(rescue?{mode:'RESCUE'}:{})}});
   for(const rule of p.discounts){const scheduled=Math.floor(index/3)%2===1;await tx.discountRule.update({where:{id:rule.id},data:{startsAt:scheduled?fromZonedTime(`${day}T15:00:00`,'Asia/Bangkok'):pickupStart,endsAt:pickupEnd,...(rescue?{value:30,kind:'PERCENT_OFF'}:{})}});}
  }
  const categories=await tx.productCategory.findMany({where:{id:{startsWith:B+':category:'}}});for(const category of categories)await tx.productCategory.update({where:{id:category.id},data:{name:clean(category.name)}});
  const users=await tx.user.findMany({where:{demoBatchId:B}});for(const user of users)if(user.name)await tx.user.update({where:{id:user.id},data:{name:clean(user.name)}});
  await tx.reservation.updateMany({where:{demoBatchId:B,status:'RESERVED'},data:{expiresAt:pickupEnd}});
  const presentation={version:1,date:day,opens:'08:00',closes:'20:00',timezone:'Asia/Bangkok',pickupStart:pickupStart.toISOString(),pickupEnd:pickupEnd.toISOString(),preparedAt:new Date().toISOString()};
  await tx.systemSetting.update({where:{key:`demo:${B}`},data:{value:{...state,config:{...config,visitorReservations:true},presentation,media:assets.map(({subject,key,url,sha256})=>({subject,key,url,sha256}))}}});
  await tx.demoBatch.update({where:{id:B},data:{label:'ชุมชนมหาวิทยาลัย'}});
  await tx.auditLog.create({data:{id:`${B}:presentation-ready:1:${day}`,actorId:'PRESENTATION_PREPARATION_SCRIPT',action:'PRESENTATION_PREPARED',target:B,changes:{date:day,opens:'08:00',closes:'20:00',timezone:'Asia/Bangkok'}}});
  assert.deepEqual(await genuineFingerprint(tx),before,'Genuine records changed; rollback required');
  return{changed:true,...await presentationIntegrity(tx)};
 },{isolationLevel:'Serializable',timeout:120_000,maxWait:10_000});
}
if(import.meta.main){
 await mkdir(directory,{recursive:true});
 try{
  await assertSeedTarget();
  if(process.argv[2]==='--verify'){const result={at:new Date(),...await presentationIntegrity(),genuine:await genuineFingerprint()};await writeFile(`${directory}/data-verified.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result));}
  else if(process.argv[2]==='--apply'){
   const day=process.argv[3]??'2026-11-01';z.iso.date().parse(day);
   // Backup both the data and original media manifest before this explicit one-time preparation.
   await copyFile(mediaManifestPath,`${directory}/media-before.json`,constants.COPYFILE_EXCL).catch(error=>{if(error.code!=="EEXIST")throw error;});
   const assets=await uploadMedia();
   const result=await preparePresentationDay(assets,day);await writeFile(`${directory}/data-prepared.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
  }else throw Error('Usage: bun --env-file=.env.presentation-seed scripts/prepare-presentation-day.ts --apply 2026-11-01 | --verify');
 }finally{await db.$disconnect();}
}
