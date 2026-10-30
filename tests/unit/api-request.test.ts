import {afterEach,expect,it,vi} from 'vitest';
import {request,RequestError} from '@/lib/api-request';
afterEach(()=>vi.unstubAllGlobals());
it.each(['{','null','{}','{"data":null}'])('does not confirm a truncated/missing success payload %s',async body=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(body,{status:201,headers:{'Content-Type':'application/json'}})));
 try{await request('/api/reservations','POST',{});throw new Error('confirmed invalid response');}
 catch(error){expect(error).toBeInstanceOf(RequestError);expect((error as RequestError).status).toBeUndefined();}
});
it('returns confirmed data only from the complete success envelope',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({data:{id:'reservation'}})));
 expect(await request('/api/reservations','POST',{})).toEqual({id:'reservation'});
});
it('retains definite status and server error for a rejected request',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({error:{message:'สินค้าไม่พอ'}},{status:409})));
 await expect(request('/api/reservations','POST',{})).rejects.toMatchObject({message:'สินค้าไม่พอ',status:409});
});
