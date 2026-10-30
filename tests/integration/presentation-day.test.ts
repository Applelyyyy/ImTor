import './guard';
import{beforeAll,afterAll,it,expect,vi}from'vitest';
import{readFile}from'node:fs/promises';
import{db}from'@/lib/db';
import{seedPresentation,genuineFingerprint}from'../../scripts/seed-presentation-demo';
import{preparePresentationDay,presentationIntegrity}from'../../scripts/prepare-presentation-day';
import{PRESENTATION_BATCH as B}from'../../scripts/presentation-data';
import{AdminDeletionService}from'@/services/admin-deletion';
import type{DemoMedia}from'../../scripts/presentation-media';
let assets:DemoMedia[],admin:Awaited<ReturnType<typeof db.user.create>>;
beforeAll(async()=>{expect(await db.demoBatch.findUnique({where:{id:B}})).toBeNull();assets=JSON.parse(await readFile('artifacts/presentation-demo/media/manifest.json','utf8')).assets;admin=await db.user.create({data:{name:'presentation-day-fixture',role:'SUPERADMIN'}});await seedPresentation(assets,new Date('2026-10-29T17:05:00Z'));});
afterAll(async()=>{if(await db.demoBatch.findUnique({where:{id:B}}))await AdminDeletionService.remove(admin,'batch',B,{confirmDelete:true});await db.auditLog.deleteMany({where:{OR:[{actorId:admin.id},{target:{startsWith:B}}]}});await db.user.delete({where:{id:admin.id}});await db.$disconnect();});
it('prepares tomorrow08-20 Bangkok, supplies missing sessions, preserves stock/history and reruns without resetting edits',async()=>{
 const before=await genuineFingerprint(),stocks=await db.product.findMany({where:{demoBatchId:B},select:{id:true,stock:true},orderBy:{id:'asc'}}),orders=await db.reservation.findMany({where:{demoBatchId:B},select:{id:true,unitPrice:true,status:true,completedAt:true},orderBy:{id:'asc'}});
 const result=await preparePresentationDay(assets,'2026-11-01');expect(result).toMatchObject({changed:true,products:36,stores:12,visitorReservationsEnabled:true,inventoryBalanced:true});
 const sessions=await db.marketSession.findMany({where:{demoBatchId:B,date:'2026-11-01'},include:{attendances:{include:{assignment:true}}}});expect(sessions).toHaveLength(2);
 for(const session of sessions){expect(session.startsAt.toISOString()).toBe('2026-11-01T01:00:00.000Z');expect(session.endsAt.toISOString()).toBe('2026-11-01T13:00:00.000Z');expect(session.attendances).toHaveLength(6);expect(session.attendances.every(a=>a.assignment&&a.status==='OPEN')).toBe(true);}
 expect(await db.product.findMany({where:{demoBatchId:B},select:{id:true,stock:true},orderBy:{id:'asc'}})).toEqual(stocks);expect(await db.reservation.findMany({where:{demoBatchId:B},select:{id:true,unitPrice:true,status:true,completedAt:true},orderBy:{id:'asc'}})).toEqual(orders);expect(await genuineFingerprint()).toEqual(before);
 expect(await db.product.count({where:{demoBatchId:B,mode:'RESCUE'}})).toBe(2);
 const p=stocks[0];await db.product.update({where:{id:p.id},data:{name:'ชื่อที่แก้ภายหลัง'}});expect((await preparePresentationDay(assets,'2026-11-01')).changed).toBe(false);expect((await db.product.findUniqueOrThrow({where:{id:p.id}})).name).toBe('ชื่อที่แก้ภายหลัง');expect(await presentationIntegrity()).toMatchObject({inventoryBalanced:true});
});

it('opens actual booking, discounts and pickup today without resetting stock, history or tomorrow schedules',async()=>{
 const {openPresentationPreview}=await import('../../scripts/open-presentation-preview');
 const {ReservationService}=await import('@/services/reservations');
 await preparePresentationDay(assets,'2026-11-01');
 const before=await genuineFingerprint(),stock=await db.product.findMany({where:{demoBatchId:B},select:{id:true,stock:true},orderBy:{id:'asc'}});
 const now=new Date('2026-10-30T18:30:00Z');
 expect((await openPresentationPreview(now)).changed).toBe(true);
 expect(await genuineFingerprint()).toEqual(before);
 expect(await db.product.findMany({where:{demoBatchId:B},select:{id:true,stock:true},orderBy:{id:'asc'}})).toEqual(stock);
 expect(await db.discountRule.count({where:{product:{demoBatchId:B},startsAt:{lte:now},endsAt:{gt:now}}})).toBe(6);
 const today=await db.marketSession.findMany({where:{demoBatchId:B,date:'2026-10-31'}});
 expect(today.every(s=>s.startsAt<=now&&s.endsAt>now)).toBe(true);
 const tomorrow=await db.marketSession.findMany({where:{demoBatchId:B,date:'2026-11-01'}});
 expect(tomorrow.every(s=>s.startsAt.toISOString()==='2026-11-01T01:00:00.000Z')).toBe(true);
 const p=await db.product.findFirstOrThrow({where:{demoBatchId:B,reservable:true,stock:{gte:2}}});
 vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(now);
 try{
  const r=await ReservationService.create(admin,p.id,1,'preview-day');
  await expect(ReservationService.transition(admin,r!.id,'COMPLETED','WRONG')).rejects.toThrow();
  await expect(ReservationService.transition(admin,r!.id,'COMPLETED',r!.pickupCode)).resolves.toMatchObject({status:'COMPLETED'});
  const after=await db.product.findUniqueOrThrow({where:{id:p.id}});expect(after.stock).toBe(p.stock!-1);
  expect((await openPresentationPreview(now)).changed).toBe(false);
  expect((await db.product.findUniqueOrThrow({where:{id:p.id}})).stock).toBe(after.stock);
  expect((await presentationIntegrity()).inventoryBalanced).toBe(true);
 }finally{vi.useRealTimers();}
});
