import {z} from 'zod';
import type {Prisma} from '@/generated/prisma/client';
import {assertAdmin,type Actor} from '@/lib/permissions';
import {invariant} from '@/lib/errors';
import {transaction} from './transactions';
import {InventoryService} from './inventory';

export const deletionKinds=['product','store','user','market','zone','stall','reservation','attendance','report','batch'] as const;
export type DeletionKind=typeof deletionKinds[number];
type Tx=Prisma.TransactionClient;

async function deleteReservations(tx:Tx,where:Prisma.ReservationWhereInput,preserveInventory=true){
  const rows=await tx.reservation.findMany({where,select:{id:true,productId:true,quantity:true,status:true}});
  for(const r of rows){
    if(preserveInventory)await InventoryService.reconcileLedger(tx,await tx.product.findUniqueOrThrow({where:{id:r.productId}}));
    const delta=(await tx.inventoryMovement.aggregate({where:{reservationId:r.id},_sum:{delta:true}}))._sum.delta??0;
    await tx.inventoryMovement.deleteMany({where:{reservationId:r.id}});
    if(preserveInventory){
      if(r.status==='RESERVED'){
        const restored=await tx.product.updateMany({where:{id:r.productId,stock:{not:null}},data:{stock:{increment:r.quantity}}});
        if(!restored.count&&delta!==0)await tx.inventoryMovement.create({data:{productId:r.productId,delta,reason:'BALANCE_ADJUSTMENT'}});
        // Removing a pending debit restores availability; preserve any unrelated correction delta.
        if(restored.count&&delta!==-r.quantity)await tx.inventoryMovement.create({data:{productId:r.productId,delta:delta+r.quantity,reason:'BALANCE_ADJUSTMENT'}});
      }else if(delta!==0){
        // Deleted order details are not archived. Physical sales still reduce available inventory.
        await tx.inventoryMovement.create({data:{productId:r.productId,delta,reason:'SALE'}});
      }
    }
    await tx.reservation.delete({where:{id:r.id}});
  }
}
async function deleteProducts(tx:Tx,where:Prisma.ProductWhereInput){
  const ids=(await tx.product.findMany({where,select:{id:true}})).map(p=>p.id);
  if(!ids.length)return;
  await deleteReservations(tx,{productId:{in:ids}},false);
  await tx.product.deleteMany({where:{id:{in:ids}}}); // DB cascades discounts, reports and remaining inventory movements.
}
async function deleteStores(tx:Tx,where:Prisma.StoreWhereInput){
  const ids=(await tx.store.findMany({where,select:{id:true}})).map(s=>s.id);
  if(!ids.length)return;
  await deleteProducts(tx,{storeId:{in:ids}});
  await tx.store.deleteMany({where:{id:{in:ids}}});
}
export class AdminDeletionService{
  static async remove(actor:Actor,kind:DeletionKind,id:string,input:unknown){
    assertAdmin(actor);z.enum(deletionKinds).parse(kind);z.string().min(1).max(200).parse(id);
    const confirmation=z.object({confirmDelete:z.literal(true).optional(),confirmName:z.string().trim().min(1).max(200).optional()}).refine(v=>v.confirmDelete===true||!!v.confirmName,'กรุณายืนยันการลบ').parse(input);
    return transaction(async tx=>{
      // Destructive operations serialize child writes; a concurrent order cannot become an orphan.
      await tx.$executeRaw`LOCK TABLE "User", "Account", "Session", "Upload", "Store", "StoreMember", "MarketVenue", "MarketZone", "MarketStall", "MarketScheduleRule", "MarketScheduleException", "MarketSession", "StoreAttendance", "StallAssignment", "AttendanceTemplate", "ProductCategory", "Product", "DiscountRule", "Reservation", "InventoryMovement", "Report", "DemoBatch", "SystemSetting" IN SHARE ROW EXCLUSIVE MODE`;
      const current=await tx.user.findUniqueOrThrow({where:{id:actor.id}});assertAdmin(current);
      let name:string;
      switch(kind){
        case 'product':name=(await tx.product.findUniqueOrThrow({where:{id}})).name;break;
        case 'store':name=(await tx.store.findUniqueOrThrow({where:{id}})).name;break;
        case 'user':name=(await tx.user.findUniqueOrThrow({where:{id}})).name??id;break;
        case 'market':name=(await tx.marketVenue.findUniqueOrThrow({where:{id}})).name;break;
        case 'zone':name=(await tx.marketZone.findUniqueOrThrow({where:{id}})).name;break;
        case 'stall':name=(await tx.marketStall.findUniqueOrThrow({where:{id}})).code;break;
        case 'reservation':await tx.reservation.findUniqueOrThrow({where:{id}});name=id;break;
        case 'attendance':await tx.storeAttendance.findUniqueOrThrow({where:{id}});name=id;break;
        case 'report':await tx.report.findUniqueOrThrow({where:{id}});name=id;break;
        case 'batch':name=(await tx.demoBatch.findUniqueOrThrow({where:{id}})).label;break;
      }
      if(confirmation.confirmName)invariant(confirmation.confirmName===name.trim(),'ข้อมูลเปลี่ยนแล้ว กรุณาเปิดรายการใหม่',409);
      switch(kind){
        case 'product':await deleteProducts(tx,{id});break;
        case 'store':await deleteStores(tx,{id});break;
        case 'user':{
          invariant(id!==current.id,'ลบบัญชีที่กำลังใช้งานไม่ได้',409);
          const target=await tx.user.findUniqueOrThrow({where:{id}});
          if(target.role!=='USER')invariant(current.role==='SUPERADMIN','เฉพาะผู้ดูแลสูงสุดที่ลบบัญชีผู้ดูแลได้',403);
          if(target.role==='SUPERADMIN')invariant(await tx.user.count({where:{id:{not:id},role:'SUPERADMIN',suspended:false}})>0,'ต้องมีผู้ดูแลสูงสุดอย่างน้อยหนึ่งคน',409);
          await deleteStores(tx,{ownerId:id});await deleteReservations(tx,{userId:id});
          await tx.user.delete({where:{id}});break;
        }
        case 'market':await deleteProducts(tx,{session:{marketId:id}});await tx.marketVenue.delete({where:{id}});break;
        case 'zone':{
          const zone=await tx.marketZone.findUniqueOrThrow({where:{id},include:{stalls:{select:{code:true}}}});
          await tx.attendanceTemplate.updateMany({where:{marketId:zone.marketId,preferredCode:{in:zone.stalls.map(s=>s.code)}},data:{preferredCode:null}});
          await tx.marketZone.delete({where:{id}});break;
        }
        case 'stall':{
          const stall=await tx.marketStall.findUniqueOrThrow({where:{id}});
          await tx.attendanceTemplate.updateMany({where:{marketId:stall.marketId,preferredCode:stall.code},data:{preferredCode:null}});
          await tx.marketStall.delete({where:{id}});break;
        }
        case 'reservation':await deleteReservations(tx,{id});break;
        case 'attendance':await tx.storeAttendance.delete({where:{id}});break;
        case 'report':await tx.report.delete({where:{id}});break;
        case 'batch':{
          await deleteProducts(tx,{demoBatchId:id});await deleteStores(tx,{demoBatchId:id});
          const remainingProducts=await tx.product.count({where:{session:{demoBatchId:id}}});
          invariant(!remainingProducts,'มีสินค้านอกชุดข้อมูลเชื่อมอยู่ กรุณาย้ายสินค้าก่อนลบ',409);
          await tx.marketVenue.deleteMany({where:{demoBatchId:id}});
          const blocked=await tx.user.count({where:{demoBatchId:id,OR:[{accounts:{some:{}}},{sessions:{some:{}}},{stores:{some:{}}},{reservations:{some:{}}},{uploads:{some:{}}}]}});
          invariant(!blocked,'มีบัญชีที่เชื่อมกับข้อมูลนอกชุด กรุณาตรวจสอบก่อนลบ',409);
          await tx.user.deleteMany({where:{demoBatchId:id}});
          await tx.productCategory.deleteMany({where:{id:{startsWith:id+':category:'},products:{none:{}}}});
          await tx.systemSetting.deleteMany({where:{key:`demo:${id}`}});
          await tx.demoBatch.delete({where:{id}});break;
        }
      }
      // Minimal security event only, not a recoverable copy of the deleted record.
      await tx.auditLog.create({data:{actorId:current.id,action:`${kind.toUpperCase()}_DELETED`,target:id}});
      return{deleted:true,id};
    });
  }
}
