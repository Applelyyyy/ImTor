import {ApiButton} from '@/components/forms';
export function AdminDeleteButton({endpoint,name,related=false}:{endpoint:string;name:string;related?:boolean}){
  return <ApiButton endpoint={endpoint} method="DELETE" body={{confirmDelete:true}} variant="destructive"
    confirmMessage={`ลบ${name}ถาวร${related?'และข้อมูลที่เกี่ยวข้อง':''}?`}>ลบ</ApiButton>;
}
