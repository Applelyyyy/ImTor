import {AdminDeleteButton} from '@/components/admin-delete-button';
export function MarketDeleteControl({id,name}:{id:string;name:string}){
  return <AdminDeleteButton endpoint={`/api/admin/markets/${id}`} name={`ตลาด ${name}`} related />;
}
