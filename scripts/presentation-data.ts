/** Data-only, fictional campus presentation catalog. No real merchant identities. Prices are satang. */
export const PRESENTATION_BATCH = "rd-kmitl-presentation-20261030-v1";
export const PRESENTATION_CONFIG = {version:1, stores:12,products:36,customers:8,reservations:24,markets:2,zones:4,stalls:24};
export const presentationShops = [
 {name:"ครัวกะเพราหลังเลกเชอร์",description:"ข้าวจานเดียวสำหรับวันเรียน",category:"อาหารจานเดียว",food:true,items:[['ข้าวกะเพราหมูไข่ดาว','basil-rice',5500],['ข้าวมันไก่ต้ม','chicken-rice',5000],['ข้าวผัดหมู','fried-rice',5000]]},
 {name:"ข้าวมันไก่บ้านอุ่น",description:"ข้าวมันไก่และข้าวกล่องมื้ออิ่ม",category:"อาหารจานเดียว",food:true,items:[['ข้าวมันไก่ต้ม กล่องปกติ','chicken-rice',4500],['ข้าวมันไก่ต้ม กล่องพิเศษ','chicken-rice',6000],['ข้าวผัดหมูไข่','fried-rice',5000]]},
 {name:"เส้นเล็กริมสมุด",description:"ก๋วยเตี๋ยวหมูต้มยำเป็นชุด",category:"ก๋วยเตี๋ยว",food:true,items:[['ก๋วยเตี๋ยวหมูต้มยำ','tom-yum-noodles',5000],['ก๋วยเตี๋ยวต้มยำ เพิ่มหมู','tom-yum-noodles',6500],['ก๋วยเตี๋ยวต้มยำ ชุดสองชาม','tom-yum-noodles',9500]]},
 {name:"เตาอบเช้าวันใหม่",description:"ขนมปังธัญพืชอบเป็นรอบ",category:"เบเกอรีและของว่าง",food:true,items:[['ขนมปังธัญพืชสองแผ่น','seeded-bread',2500],['ขนมปังธัญพืชครึ่งก้อน','seeded-bread',4500],['ขนมปังธัญพืชหนึ่งก้อน','seeded-bread',8000]]},
 {name:"กาแฟคาบว่าง",description:"ลาเต้ร้อนสำหรับช่วงพัก",category:"กาแฟ",food:true,items:[['ลาเต้ร้อน แก้วเล็ก','hot-latte',4000],['ลาเต้ร้อน แก้วใหญ่','hot-latte',5000],['ลาเต้ร้อนสองแก้ว','hot-latte',7500]]},
 {name:"ชาชื่นใจ",description:"ชานมร้อนพร้อมคุกกี้",category:"ชาและของว่าง",food:true,items:[['ชานมร้อนพร้อมคุกกี้','hot-milk-tea',3500],['ชานมร้อน ชุดคุกกี้เพิ่ม','hot-milk-tea',4500],['ชานมร้อนพร้อมคุกกี้สองชุด','hot-milk-tea',6500]]},
 {name:"ผลไม้ตะกร้ายิ้ม",description:"ชุดผลไม้รวมตามภาพประกอบ",category:"ผลไม้",food:true,items:[['ชุดผลไม้รวมขนาดเล็ก','mixed-fruit',3500],['ชุดผลไม้รวมขนาดกลาง','mixed-fruit',6000],['ตะกร้าผลไม้รวมสำหรับแบ่งกัน','mixed-fruit',9900]]},
 {name:"สมุดของเพื่อน",description:"สมุดปกคราฟต์ไว้จดเลกเชอร์",category:"เครื่องเขียน",food:false,items:[['สมุดโน้ตปกคราฟต์ A5','notebook',3500],['สมุดโน้ตปกคราฟต์ A5 สองเล่ม','notebook',6500],['สมุดโน้ตปกคราฟต์ A5 สามเล่ม','notebook',9500]]},
 {name:"ปากกาพร้อมเรียน",description:"ปากกาเจลสีดำ น้ำเงิน และแดง",category:"เครื่องเขียน",food:false,items:[['ปากกาเจลสามสี หนึ่งชุด','gel-pens',4500],['ปากกาเจลสามสี สองชุด','gel-pens',8500],['ปากกาเจลสามสี สามชุด','gel-pens',12000]]},
 {name:"ผ้าฝ้ายวันสบาย",description:"กระเป๋าผ้าแคนวาสสีธรรมชาติ",category:"ของใช้และกระเป๋า",food:false,items:[['กระเป๋าผ้าแคนวาสหนึ่งใบ','canvas-tote',12900],['กระเป๋าผ้าแคนวาสคู่เพื่อน','canvas-tote',24900],['กระเป๋าผ้าแคนวาสแพ็กสามใบ','canvas-tote',35900]]},
 {name:"มุมผ้าสีพาสเทล",description:"ยางรัดผมผ้าเป็นชุดสีพาสเทล",category:"ของใช้และเครื่องประดับ",food:false,items:[['ยางรัดผมผ้าพาสเทลสามชิ้น','hair-scrunchies',3500],['ยางรัดผมผ้าพาสเทลหกชิ้น','hair-scrunchies',6500],['ยางรัดผมผ้าพาสเทลเก้าชิ้น','hair-scrunchies',9500]]},
 {name:"จานด่วนเพื่อนเรียน",description:"ข้าวกล่องมื้ออิ่มหลังเลิกเรียน",category:"อาหารจานเดียว",food:true,items:[['ข้าวผัดหมูกล่องอิ่ม','fried-rice',4500],['ข้าวกะเพราหมูไข่ดาวกล่องอิ่ม','basil-rice',5500],['ข้าวมันไก่ต้มกล่องอิ่ม','chicken-rice',5000]]},
] as const;
export const existingImageSources:Record<string,string>={
 'basil-rice':'public/demo-library/basil-rice.webp','chicken-rice':'public/demo-library/chicken-rice.webp','fried-rice':'public/demo-library/fried-rice.webp','tom-yum-noodles':'public/demo-library/tom-yum-noodles.webp',
 'seeded-bread':'public/images/bakery.jpg','hot-latte':'public/images/coffee.jpg','hot-milk-tea':'public/images/tea.jpg','mixed-fruit':'public/images/fruit.jpg',
 'notebook':'public/demo-library/notebook.webp','gel-pens':'public/demo-library/gel-pens.webp','canvas-tote':'public/demo-library/canvas-tote.webp','hair-scrunchies':'public/demo-library/hair-scrunchies.webp',
};
export function presentationStalls(market:number){return Array.from({length:12},(_,s)=>{const columns=market===0?4:3,col=s%columns,row=Math.floor(s/columns);const zone=market===0?(col<2?0:1):(row<2?0:1);return{index:s,zone,code:`${zone===0?'A':'B'}${String(s+1).padStart(2,'0')}`,x:market===0?.14+col*.24:.18+col*.32,y:market===0?.23+row*.26:.18+row*.2};});}
export function presentationWindow(asOf:Date){if(!Number.isFinite(asOf.getTime()))throw Error('Invalid presentation clock');return{startsAt:new Date(asOf.getTime()-10*60_000),endsAt:new Date(asOf.getTime()+12*3600_000)};}
