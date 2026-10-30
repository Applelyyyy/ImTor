import './guard';
import { afterAll,beforeAll,describe,expect,it } from 'vitest';
import { db } from '../../src/lib/db';
import { InventoryService } from '../../src/services/inventory';
import { ReservationService } from '../../src/services/reservations';
import { seedPresentation,validatePresentation,genuineFingerprint } from '../../scripts/seed-presentation-demo';
import { PRESENTATION_BATCH as B } from '../../scripts/presentation-data';
import type { DemoMedia } from '../../scripts/presentation-media';

const assets=['basil-rice','chicken-rice','fried-rice','tom-yum-noodles','seeded-bread','hot-latte','hot-milk-tea','mixed-fruit','notebook','gel-pens','canvas-tote','hair-scrunchies','small-layout','large-layout'].map((subject,i)=>({subject,key:`approved/${B}/${i}.jpg`,url:`https://media.imtor.applely.dev/approved/${B}/${i}.jpg`,sha256:'0'.repeat(64),bytes:100,file:'test-only',uploaded:false,provenance:'Test fixture, never uploaded'} satisfies DemoMedia));
const admin={id:'presentation-seed-test-operator',role:'SUPERADMIN',suspended:false};
async function removeTestBatch(){
  // This helper is reachable only behind the local _test DB guard, never the live CLI.
  await db.inventoryMovement.deleteMany({where:{product:{demoBatchId:B}}});
  await db.reservation.deleteMany({where:{demoBatchId:B}});
  await db.product.deleteMany({where:{demoBatchId:B}});
  await db.store.deleteMany({where:{demoBatchId:B}});
  await db.marketVenue.deleteMany({where:{demoBatchId:B}});
  await db.user.deleteMany({where:{demoBatchId:B}});
  await db.productCategory.deleteMany({where:{id:{startsWith:B+':'},products:{none:{}}}});
  await db.systemSetting.deleteMany({where:{key:`demo:${B}`}});
  await db.auditLog.deleteMany({where:{OR:[{target:{startsWith:B}},{actorId:admin.id}]}});
  await db.demoBatch.deleteMany({where:{id:B}});
}
describe('compact presentation graph in isolated PostgreSQL',()=>{
 beforeAll(async()=>{expect(await db.demoBatch.count({where:{id:B}})).toBe(0);});
 afterAll(async()=>{await removeTestBatch();await db.$disconnect();});
 it('seeds through midnight without recurrence, with coherent FK/stock/prices and no genuine changes',async()=>{
  const before=await genuineFingerprint();
  const result=await seedPresentation(assets,new Date('2026-10-30T16:59:59Z'));
  expect(result).toMatchObject({created:true,stores:12,products:36,reservations:24,zones:4,stalls:24,inventoryBalanced:true,reservationStatuses:{COMPLETED:6,CANCELLED:6,RESERVED:12}});
  expect(await genuineFingerprint()).toEqual(before);
  const sessions=await db.marketSession.findMany({where:{demoBatchId:B},orderBy:{startsAt:'asc'}});
  expect(sessions[0].endsAt.toISOString()).toBe('2026-10-30T17:00:00.000Z');
  expect(sessions[2].startsAt.toISOString()).toBe('2026-10-30T17:00:00.000Z');
  expect(await db.product.count({where:{demoBatchId:B,sessionId:null}})).toBe(36);
  expect(await db.discountRule.count({where:{product:{demoBatchId:B}}})).toBe(12);
  const graph=JSON.stringify({products:await db.product.findMany({where:{demoBatchId:B},orderBy:{id:'asc'}}),reservations:await db.reservation.findMany({where:{demoBatchId:B},orderBy:{id:'asc'}})});
  const replay=await seedPresentation(assets);expect(replay.created).toBe(false);
  expect(JSON.stringify({products:await db.product.findMany({where:{demoBatchId:B},orderBy:{id:'asc'}}),reservations:await db.reservation.findMany({where:{demoBatchId:B},orderBy:{id:'asc'}})})).toBe(graph);
  const setting=await db.systemSetting.findUniqueOrThrow({where:{key:`demo:${B}`}});expect(setting.value).toMatchObject({config:{visitorReservations:false}});
  expect(await genuineFingerprint()).toEqual(before);
 });
 it('rerun preserves real service transitions and inventory edits rather than resetting presentation activity',async()=>{
  await removeTestBatch();await seedPresentation(assets,new Date());
  const rows=await db.reservation.findMany({where:{demoBatchId:B,status:'RESERVED'},orderBy:{id:'asc'}});
  await ReservationService.transition(admin,rows[0].id,'COMPLETED',rows[0].pickupCode);
  const old=(await db.product.findUniqueOrThrow({where:{id:rows[1].productId}})).stock!;
  await ReservationService.transition(admin,rows[1].id,'CANCELLED');
  expect((await db.product.findUniqueOrThrow({where:{id:rows[1].productId}})).stock).toBe(old+rows[1].quantity);
  await InventoryService.adjust(admin,rows[0].productId,{operation:'add',quantity:3,idempotencyKey:'presentation-integration'});
  const stock=(await db.product.findUniqueOrThrow({where:{id:rows[0].productId}})).stock;
  const result=await seedPresentation(assets);
  expect(result).toMatchObject({created:false,reservationStatuses:{COMPLETED:7,CANCELLED:7,RESERVED:10},inventoryBalanced:true});
  expect((await db.product.findUniqueOrThrow({where:{id:rows[0].productId}})).stock).toBe(stock);
  expect(await validatePresentation()).toMatchObject({inventoryBalanced:true,syntheticIdentitiesLocked:true});
 });
 it('repairs only legacy demo path IDs and preserves related reservation history',async()=>{
  const p=await db.product.findFirstOrThrow({where:{demoBatchId:B},orderBy:{id:'asc'}});
  const market=await db.marketVenue.findFirstOrThrow({where:{demoBatchId:B},orderBy:{id:'asc'}});
  const n=Number(p.id.split('-product-')[1]),m=Number(market.id.split('-market-')[1]);
  const before=await genuineFingerprint();const stock=p.stock;
  await db.product.update({where:{id:p.id},data:{id:`${B}:product:${n}`}});
  await db.marketVenue.update({where:{id:market.id},data:{id:`${B}:market:${m}`}});
  const result=await seedPresentation(assets);expect(result).toMatchObject({created:false,repairedProductPaths:1,repairedMarketPaths:1,inventoryBalanced:true});
  expect((await db.product.findUniqueOrThrow({where:{id:p.id}})).stock).toBe(stock);expect(await genuineFingerprint()).toEqual(before);
 });
 it('rolls back the full graph on a missing media subject',async()=>{
  await removeTestBatch();const before=await genuineFingerprint();
  const invalid=assets.map(a=>a.subject==='notebook'?{...a,subject:'missing'}:a);
  await expect(seedPresentation(invalid)).rejects.toThrow();
  expect(await db.demoBatch.count({where:{id:B}})).toBe(0);expect(await db.user.count({where:{demoBatchId:B}})).toBe(0);expect(await genuineFingerprint()).toEqual(before);
 });
 it('does not overwrite an incomplete pre-existing batch',async()=>{
  await db.user.create({data:{id:`${B}:user:0`,name:'Partial batch',email:`partial@${B}.invalid`,suspended:true,demoBatchId:B}});
  await expect(seedPresentation(assets)).rejects.toThrow('Partial batch');
  expect(await db.user.count({where:{demoBatchId:B}})).toBe(1);expect(await db.demoBatch.count({where:{id:B}})).toBe(0);
 });
});
