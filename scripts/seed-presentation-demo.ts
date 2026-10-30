/** Data-only compact presentation seed. No real account/session, infrastructure or application changes. */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { db } from '../src/lib/db';
import { type Prisma } from '../src/generated/prisma/client';
import { PricingService } from '../src/services/pricing';
import { shiftCalendarDate } from '../src/services/schedule';
import { PRESENTATION_BATCH as B, PRESENTATION_CONFIG, presentationShops, presentationStalls } from './presentation-data';
import { type DemoMedia, digest, mediaManifestPath } from './presentation-media';

// Public product routes in the deployed runtime require URL-safe identifiers.
const id=(kind:string,index:number|string)=>['product','market'].includes(kind)?`${B}-${kind}-${index}`:`${B}:${kind}:${index}`;
const marker='สาธิต · ร้านและสินค้าเป็นเรื่องสมมติ ไม่มีการซื้อขายหรือจุดรับสินค้าจริง';
type Client=Prisma.TransactionClient;
export async function assertSeedTarget(){
  const [row]=await db.$queryRaw<{name:string}[]>`SELECT current_database() AS name`;
  const url=new URL(process.env.DATABASE_URL!);
  const localTest=row.name.endsWith('_test')&&['localhost','127.0.0.1'].includes(url.hostname);
  if(!localTest&&(row.name!=='imtor_demo'||process.env.DEMO_MODE!=='true'||process.env.ENABLE_DEMO_GENERATOR!=='true'))throw Error('Seed requires the configured imtor_demo environment or a separate local _test database');
  return row.name;
}
export async function genuineFingerprint(tx:Client=db){
  // No secrets, OAuth tokens, session tokens or private contact fields enter the snapshot.
  const state={
    users:await tx.user.findMany({where:{demoBatchId:null},orderBy:{id:'asc'},select:{id:true,role:true,suspended:true,createdAt:true}}),
    stores:await tx.store.findMany({where:{demoBatchId:null},orderBy:{id:'asc'}}),
    products:await tx.product.findMany({where:{demoBatchId:null},orderBy:{id:'asc'}}),
    markets:await tx.marketVenue.findMany({where:{demoBatchId:null},orderBy:{id:'asc'}}),
    reservations:await tx.reservation.findMany({where:{demoBatchId:null},orderBy:{id:'asc'}}),
  };
  return {sha256:digest(JSON.stringify(state)),counts:Object.fromEntries(Object.entries(state).map(([key,rows])=>[key,rows.length]))};
}
export async function validatePresentation(tx:Client=db){
  const users=await tx.user.findMany({where:{demoBatchId:B},include:{accounts:true,sessions:true,uploads:true}});
  const stores=await tx.store.findMany({where:{demoBatchId:B},include:{attendances:{include:{session:true,assignment:{include:{stall:{include:{zone:true}}}}}}}});
  const markets=await tx.marketVenue.findMany({where:{demoBatchId:B},include:{zones:true,stalls:true,sessions:true}});
  const products=await tx.product.findMany({where:{demoBatchId:B},include:{discounts:true,movements:true,reservations:true}});
  const reservations=await tx.reservation.findMany({where:{demoBatchId:B},include:{movements:true}});
  assert.equal(users.length,20);assert.equal(stores.length,12);assert.equal(markets.length,2);assert.equal(products.length,36);assert.equal(reservations.length,24);
  assert(users.every(u=>u.id.startsWith(B+':')&&u.suspended&&u.email?.endsWith('.invalid')&&!u.accounts.length&&!u.sessions.length&&!u.uploads.length));
  const userIds=new Set(users.map(u=>u.id)),storeIds=new Set(stores.map(s=>s.id)),productIds=new Set(products.map(p=>p.id));
  let attendanceCount=0,assignmentCount=0;
  for(const m of markets){
    assert.equal(m.latitude,null);assert.equal(m.longitude,null);assert.equal(m.zones.length,2);assert.equal(m.stalls.length,12);assert.equal(m.sessions.length,2);
    assert(m.description.includes('สมมติ')&&m.layoutImage);
    const sessions=[...m.sessions].sort((a,b)=>a.startsAt.getTime()-b.startsAt.getTime());
    assert.equal(sessions[0].endsAt.getTime(),sessions[1].startsAt.getTime());
    for(const s of sessions){assert(s.startsAt<s.endsAt);assert.equal(s.date,formatInTimeZone(s.startsAt,'Asia/Bangkok','yyyy-MM-dd'));assert.equal(s.demoBatchId,B);}
    for(const s of m.stalls){assert(s.id.startsWith(B+':'));assert(s.x>=0&&s.x<=1&&s.y>=0&&s.y<=1);assert(m.zones.some(z=>z.id===s.zoneId));}
  }
  const assignments:{stallId:string;startsAt:Date;endsAt:Date}[]=[];
  for(const s of stores){
    assert(userIds.has(s.ownerId)&&s.name.startsWith('[สาธิต]')&&!s.hidden&&!s.suspended);
    assert.equal(s.attendances.length,2);
    for(const a of s.attendances){attendanceCount++;assert(a.id.startsWith(B+':')&&a.authorized&&a.session.demoBatchId===B);const pos=a.assignment;assert(pos);assignmentCount++;assert.equal(pos.stall.marketId,a.session.marketId);assert.equal(pos.stall.zone.marketId,a.session.marketId);assert.equal(+pos.startsAt,+a.session.startsAt);assert.equal(+pos.endsAt,+a.session.endsAt);assert.equal(pos.verified,false);assignments.push(pos);}
  }
  for(let i=0;i<assignments.length;i++)for(let j=i+1;j<assignments.length;j++){const a=assignments[i],b=assignments[j];assert(a.stallId!==b.stallId||a.startsAt>=b.endsAt||a.endsAt<=b.startsAt,'Overlapping stall assignments');}
  for(const p of products){
    assert(storeIds.has(p.storeId)&&p.categoryId.startsWith(B+':')&&p.sessionId===null&&p.published&&!p.archived&&p.name.startsWith('[สาธิต]'));
    assert(Number.isSafeInteger(p.price)&&p.price>0&&p.stock!==null&&p.stock>=0);
    assert.equal(p.movements.filter(m=>m.reason==='DEMO_OPENING').length,1);
    assert.equal(p.stock,p.movements.reduce((n,m)=>n+m.delta,0),'Inventory ledger mismatch');
    assert(p.imageUrl.startsWith(`https://media.imtor.applely.dev/approved/${B}/`));
    for(const r of p.reservations){assert.equal(r.demoBatchId,B);assert(userIds.has(r.userId));}
    PricingService.calculate(p.price,p.discounts);
  }
  for(const r of reservations){
    assert(productIds.has(r.productId)&&userIds.has(r.userId)&&r.quantity>0&&r.unitPrice<=r.originalPrice);
    const p=products.find(p=>p.id===r.productId)!;assert(p.reservable);assert(p.pickupStart&&p.pickupEnd&&r.createdAt>=p.createdAt&&r.createdAt>=p.pickupStart&&r.createdAt<r.expiresAt&&r.expiresAt<=p.pickupEnd);
    const quote=PricingService.calculate(p.price,p.mode==='REGULAR'?[]:p.discounts,r.createdAt);assert.equal(r.unitPrice,quote.current);
    assert.equal(r.movements.filter(m=>m.reason==='RESERVED'&&m.delta===-r.quantity).length,1);
    const returned=r.movements.filter(m=>['CANCELLED','NO_SHOW','EXPIRED'].includes(m.reason));
    assert.equal(returned.reduce((sum,m)=>sum+m.delta,0),['CANCELLED','NO_SHOW','EXPIRED'].includes(r.status)?r.quantity:0);
    if(r.status==='COMPLETED')assert(r.completedAt&&r.completedAt>=r.createdAt&&r.completedAt<r.expiresAt);
  }
  return{batch:B,stores:stores.length,products:products.length,fictionalUsers:users.length,markets:markets.length,zones:markets.reduce((n,m)=>n+m.zones.length,0),stalls:markets.reduce((n,m)=>n+m.stalls.length,0),sessions:4,attendances:attendanceCount,assignments:assignmentCount,reservations:reservations.length,reservationStatuses:reservations.reduce<Record<string,number>>((out,r)=>(out[r.status]=(out[r.status]??0)+1,out),{}),inventoryBalanced:true,syntheticIdentitiesLocked:true,marketCoordinatesIntentionallyNull:true};
}
export async function seedPresentation(assets:DemoMedia[],asOf=new Date()){
  await assertSeedTarget();assert.equal(assets.length,14);assert.equal(new Set(assets.map(a=>a.key)).size,14);
  const asset=(subject:string)=>{const a=assets.find(a=>a.subject===subject);assert(a&&a.url.startsWith(`https://media.imtor.applely.dev/approved/${B}/`));return a.url;};
  return db.$transaction(async(tx)=>{
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${B}))::text`;
    const before=await genuineFingerprint(tx);
    const existing=await tx.demoBatch.findUnique({where:{id:B}});
    if(existing){
      // Narrow, reversible repair of this seed's first-run path IDs. FK cascades preserve stock/history.
      let repairedProductPaths=0;
      for(let n=0;n<36;n++){
        const oldId=`${B}:product:${n}`,newId=id('product',n);
        const old=await tx.product.findUnique({where:{id:oldId}});
        if(!old)continue;
        assert.equal(old.demoBatchId,B);assert.equal(await tx.product.count({where:{id:newId}}),0);
        assert.equal(await tx.reservation.count({where:{productId:oldId,OR:[{demoBatchId:null},{demoBatchId:{not:B}}]}}),0,'Foreign reservation blocks path repair');
        await tx.product.update({where:{id:oldId},data:{id:newId}});repairedProductPaths++;
      }
      let repairedMarketPaths=0;
      for(let n=0;n<2;n++){
        const oldId=`${B}:market:${n}`,newId=id('market',n);
        const old=await tx.marketVenue.findUnique({where:{id:oldId}});
        if(!old)continue;
        assert.equal(old.demoBatchId,B);assert.equal(await tx.marketVenue.count({where:{id:newId}}),0);
        assert.equal(await tx.marketSession.count({where:{marketId:oldId,OR:[{demoBatchId:null},{demoBatchId:{not:B}}]}}),0,'Foreign session blocks path repair');
        await tx.marketVenue.update({where:{id:oldId},data:{id:newId}});repairedMarketPaths++;
      }
      const validated=await validatePresentation(tx);
      assert.deepEqual(await genuineFingerprint(tx),before,'Genuine records changed; path repair must roll back');
      return{created:false,repairedProductPaths,repairedMarketPaths,...validated};
    }
    assert.equal(await tx.user.count({where:{id:{startsWith:B}}}),0,'Partial batch must be reviewed, never overwritten');
    const today=formatInTimeZone(asOf,'Asia/Bangkok','yyyy-MM-dd'),tomorrow=shiftCalendarDate(today,1);
    const midnight=fromZonedTime(`${today}T00:00:00`,'Asia/Bangkok'),nextMidnight=fromZonedTime(`${tomorrow}T00:00:00`,'Asia/Bangkok');
    const startsAt=new Date(Math.max(+midnight,+asOf-10*60_000));
    const endsAt=fromZonedTime(`${tomorrow}T20:00:00`,'Asia/Bangkok');
    assert(startsAt<asOf&&asOf<nextMidnight&&endsAt>nextMidnight);
    await tx.demoBatch.create({data:{id:B,label:'[สาธิต] ชุมชนมหาวิทยาลัยสมมติ · ชุดนำเสนอขนาดเล็ก',createdAt:startsAt}});
    const names=['พิมพ์ใจ','ธนกร','มะลิ','นที','ขวัญข้าว','อรุณ','พลอย','ภูมิ','น้ำฝน','ต้นกล้า','ปาล์ม','เมษา','ฟ้า','กันต์','ใบเตย','นนท์','บัว','วิน','แพรว','ดิว'];
    await tx.user.createMany({data:names.map((name,i)=>({id:id('user',i),name:`[สาธิต] ${i<12?'ผู้ค้า':'ลูกค้า'}${name}`,email:`presentation-${i}@${B}.invalid`,suspended:true,demoBatchId:B,createdAt:startsAt}))});
    const categories=[...new Set(presentationShops.map(s=>s.category))];
    await tx.productCategory.createMany({data:categories.map((name,i)=>({id:id('category',i),name:`[สาธิต] ${name}`,food:presentationShops.find(s=>s.category===name)!.food}))});
    for(let m=0;m<2;m++){
      const title=m===0?'ตลาดเล็ก':'ตลาดใหญ่';
      await tx.marketVenue.create({data:{id:id('market',m),slug:`presentation-${m===0?'small':'large'}-${B}`,name:`[สาธิต] ${title}`,type:m===0?'SMALL':'LARGE',description:`ผัง${title}สมมติสำหรับการนำเสนอเท่านั้น ไม่ใช่ตลาดจริงของ สจล. ตำแหน่งล็อก ร้านค้า การเข้าร่วม และเวลาทั้งหมดเป็นข้อมูลจำลอง`,address:'ผังจำลอง ไม่มีพิกัดหรือจุดรับสินค้าจริง',entrance:'ทางเข้าบนภาพเป็นตัวอย่าง ไม่ใช่ทางเข้าตลาดจริง',layoutImage:asset(m===0?'small-layout':'large-layout'),demoBatchId:B}});
      await tx.marketZone.createMany({data:[0,1].map(z=>({id:id(`zone-${m}`,z),marketId:id('market',m),name:`${z===0?'A':'B'} · โซนสมมติ`}))});
      await tx.marketStall.createMany({data:presentationStalls(m).map(s=>({id:id(`stall-${m}`,s.index),marketId:id('market',m),zoneId:id(`zone-${m}`,s.zone),code:s.code,x:s.x,y:s.y,directions:'ตำแหน่งบนผังสมมติเท่านั้น ไม่ใช่ล็อกตลาดจริง'}))});
      await tx.marketSession.createMany({data:[{id:id(`session-${m}`,0),marketId:id('market',m),date:today,startsAt,endsAt:nextMidnight,status:'SCHEDULED',demoBatchId:B},{id:id(`session-${m}`,1),marketId:id('market',m),date:tomorrow,startsAt:nextMidnight,endsAt,status:'SCHEDULED',demoBatchId:B}]});
    }
    const quotes=new Map<string,{price:number;mode:string;discounts:{kind:string;value:number;startsAt:Date;endsAt:Date}[]}>();
    const bookable:string[]=[];
    for(const [s,shop] of presentationShops.entries()){
      const market=s%2,slot=Math.floor(s/2),slotIndex=market===0?[0,1,2,3,8,9][slot]:[0,1,2,6,7,8][slot];
      await tx.store.create({data:{id:id('store',s),slug:`presentation-shop-${s+1}-${B}`,name:`[สาธิต] ${shop.name}`,description:`${shop.description}\n${marker} ไม่ใช่ธุรกิจจริงของ สจล. ภาพเป็นภาพประกอบสินค้า ไม่ใช่ภาพหน้าร้านจริง`,imageUrl:asset(shop.items[0][1]),ownerId:id('user',s),kind:'MARKET',address:'ตำแหน่งบนผังตลาดสมมติเท่านั้น',open:true,verified:false,demoBatchId:B,createdAt:startsAt}});
      for(let day=0;day<2;day++){
        const start=day===0?startsAt:nextMidnight,end=day===0?nextMidnight:endsAt;
        // Future attendance is scheduled, never presented as a real check-in.
        await tx.storeAttendance.create({data:{id:id(`attendance-${s}`,day),storeId:id('store',s),sessionId:id(`session-${market}`,day),status:day===0?'OPEN':'SCHEDULED',authorized:true,expectedArrival:formatInTimeZone(start,'Asia/Bangkok','HH:mm'),sellingUntil:formatInTimeZone(end,'Asia/Bangkok','HH:mm'),assignment:{create:{id:id(`assignment-${s}`,day),stallId:id(`stall-${market}`,slotIndex),startsAt:start,endsAt:end,verified:false}}}});
      }
      for(const [j,item]of shop.items.entries()){
        const index=s*3+j,productId=id('product',index),price=item[2],mode=(s%2===0&&j===0)||(s%2===1&&j===1)?'DISCOUNT':'REGULAR';
        const discounts=mode==='REGULAR'?[]:[{kind:'PERCENT_OFF',value:s%2===0?10:15,startsAt:s%2===0?startsAt:new Date(+asOf+3600_000),endsAt}];
        const opening=12+(index*7)%24;quotes.set(productId,{price,mode,discounts});
        if(j<2)bookable.push(productId);
        await tx.product.create({data:{id:productId,storeId:id('store',s),categoryId:id('category',categories.indexOf(shop.category)),name:`[สาธิต] ${item[0]}`,description:`${marker} ภาพประกอบแสดงลักษณะสินค้า ปริมาณเป็นแพ็กตามชื่อรายการ ไม่รับซื้อขายจริง`,imageUrl:asset(item[1]),price,mode,reservable:j<2,stock:opening,pickupStart:startsAt,pickupEnd:endsAt,allergens:shop.food?'ข้อมูลสมมติ: โปรดสอบถามส่วนผสมจริงจากผู้ขาย ไม่ใช้ข้อมูลนี้เพื่อการแพ้อาหาร':null,storage:shop.food?'ภาพและข้อมูลเพื่อสาธิตเท่านั้น ไม่มีอาหารจริงให้รับ':null,demoBatchId:B,createdAt:startsAt,discounts:{create:discounts.map((d,k)=>({...d,id:id(`discount-${index}`,k)}))},movements:{create:{id:id('opening',index),delta:opening,reason:'DEMO_OPENING',createdAt:startsAt}}}});
      }
    }
    for(let n=0;n<24;n++){
      const productId=bookable[n],quantity=n%3===0?2:1,quote=quotes.get(productId)!;
      const createdAt=new Date(+startsAt+Math.max(1,Math.floor((+asOf-+startsAt)*(n+1)/60)));
      const status=n<6?'COMPLETED':n<12?'CANCELLED':'RESERVED';
      const reservationId=id('reservation',n),unitPrice=PricingService.calculate(quote.price,quote.discounts,createdAt).current;
      await tx.reservation.create({data:{id:reservationId,userId:id('user',12+n%8),productId,quantity,unitPrice,originalPrice:quote.price,productMode:quote.mode,status,pickupCode:digest(`${B}:pickup:${n}`).slice(0,16).toUpperCase(),expiresAt:endsAt,completedAt:status==='COMPLETED'?new Date(+createdAt+Math.floor((+asOf-+createdAt)/2)):null,demoBatchId:B,createdAt,movements:{create:[{id:id('reserved',n),productId,delta:-quantity,reason:'RESERVED',createdAt},...(status==='CANCELLED'?[{id:id('returned',n),productId,delta:quantity,reason:'CANCELLED',createdAt:new Date(+createdAt+Math.floor((+asOf-+createdAt)/2))}]:[])]}}});
      if(status!=='CANCELLED')await tx.product.update({where:{id:productId},data:{stock:{decrement:quantity}}});
    }
    await tx.systemSetting.create({data:{key:`demo:${B}`,value:{kind:'compact-presentation-v1',config:{...PRESENTATION_CONFIG,visitorReservations:false},createdAt:startsAt.toISOString(),windowEndsAt:endsAt.toISOString(),media:assets.map(({subject,key,url,sha256})=>({subject,key,url,sha256})),research:'artifacts/presentation-demo/kmitl-landmarks.research.json',fictional:true}}});
    await tx.auditLog.create({data:{id:id('audit','seed'),actorId:'PRESENTATION_SEED_SCRIPT',action:'DEMO_GENERATED',target:B,changes:{...PRESENTATION_CONFIG,fictional:true,source:'scripts/seed-presentation-demo.ts'}}});
    assert.deepEqual(await genuineFingerprint(tx),before,'Genuine records changed; transaction must roll back');
    return {created:true,...await validatePresentation(tx)};
  },{isolationLevel:'Serializable',timeout:120_000,maxWait:10_000});
}
if(import.meta.main){
  await mkdir('artifacts/presentation-demo',{recursive:true});
  try{
    const database=await assertSeedTarget();
    if(process.argv[2]==='--verify'){const result={database,verifiedAt:new Date(),...await validatePresentation(),genuine:await genuineFingerprint()};await writeFile('artifacts/presentation-demo/seed-verified.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));}
    else if(process.argv[2]==='--apply-demo'){
      const {assets}=JSON.parse(await readFile(mediaManifestPath,'utf8')) as {assets:DemoMedia[]};
      for(const a of assets){const response=await fetch(a.url);assert(response.ok&&digest(new Uint8Array(await response.arrayBuffer()))===a.sha256,'Media must be publicly verified before database writes');}
      const before=await genuineFingerprint();const result=await seedPresentation(assets);assert.deepEqual(await genuineFingerprint(),before);await writeFile(`artifacts/presentation-demo/seed-${result.created?'applied':'rerun'}.json`,JSON.stringify({database,asOf:new Date(),...result,genuine:before},null,2));console.log(JSON.stringify(result));
    }else throw Error('Usage: bun --env-file=.env.presentation-seed scripts/seed-presentation-demo.ts --apply-demo | --verify');
  }finally{await db.$disconnect();}
}
