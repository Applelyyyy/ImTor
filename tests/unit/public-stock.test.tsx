import {expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
const mocks=vi.hoisted(()=>({stock:0 as number|null}));
vi.mock('next/navigation',()=>({notFound(){throw Error('not found')},useRouter:()=>({refresh(){},push(){}})}));
vi.mock('@/lib/queries',()=>({publicFeatures:async()=>({reservationsEnabled:true,foodRescueEnabled:true}),product:async()=>({id:'p',name:'ข้าว',description:'',imageUrl:'/images/rice.jpg',mode:'REGULAR',reservable:false,stock:mocks.stock,store:{slug:'s',name:'ร้าน'},category:{name:'อาหาร'},price:{current:4500,active:false},open:true})}));
vi.mock('@/components/merchant',()=>({merchantStore:async()=>({id:'s',slug:'s',name:'ร้าน',kind:'PERMANENT',products:[{published:true,archived:false,reservable:false,stock:0},{published:true,archived:false,reservable:false,stock:50},{published:true,archived:false,reservable:false,stock:null}],attendances:[]}),NoStore:()=>null}));
vi.mock('@/lib/db',()=>({db:{reservation:{count:async()=>0}}}));
import ProductPage from '@/app/product/[id]/page';
import Dashboard from '@/app/merchant/page';
it('public quantity distinguishes tracked zero, finite100 and explicitly untracked',async()=>{
 for(const [stock,label] of [[0,'สินค้าหมด'],[100,'100 ชิ้น'],[null,'ไม่ติดตามจำนวน']] as const){mocks.stock=stock;expect(renderToStaticMarkup(await ProductPage({params:Promise.resolve({id:'p'})}))).toContain(label);}
});
it('dashboard excludes display-only tracked zero from ready-to-sell products',async()=>{
 const html=renderToStaticMarkup(await Dashboard());expect(html).toContain('<strong>2</strong><span>สินค้าพร้อมขาย</span>');
});
