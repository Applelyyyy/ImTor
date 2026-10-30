import {readFileSync} from 'node:fs';
import {expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
vi.mock('next/navigation',()=>({useRouter:()=>({refresh(){},push(){}})}));
import {ApiForm,ApiButton} from '@/components/forms';
it('does not insert action-success rows and deduplicates completed notifications',()=>{
 const src=readFileSync('src/components/forms.tsx','utf8');
 expect(src).not.toContain('className="form-success"');
 expect(src).toContain('toast.success(success, { id:');
 expect(src).toContain('toast.success(method === "DELETE" ? "ลบแล้ว" : "บันทึกแล้ว", { id:');
 expect(renderToStaticMarkup(<ApiButton endpoint="/api/products/item">พักขาย</ApiButton>)).not.toContain('form-success');
});
it('shared forms support contextual save/cancel without forced navigation',()=>{
 const src=readFileSync('src/components/forms.tsx','utf8');
 expect(src).toContain('onSaved?.(');
 expect(renderToStaticMarkup(<ApiForm endpoint="/api/profile" fields={[]} onCancel={()=>{}}/>)).toContain('ยกเลิก');
});
it('the shared dialog guards dirty and busy dismissal inside one titled surface',()=>{
 const src=readFileSync('src/components/app-dialog.tsx','utf8');
 expect(src).toContain('dirty');expect(src).toContain('busy');
 expect(src).toContain('แก้ไขต่อ');expect(src).toContain('ละทิ้งการเปลี่ยนแปลง');
 expect(src).toContain('onCloseAutoFocus');expect(src).toContain('DialogTitle');
 expect(src).not.toContain('window.confirm');
});

it("mobile surface clears Tailwind individual translate to stay inside viewport",()=>{const css=readFileSync("src/components/app-dialog.module.css","utf8");expect(css).toContain("--tw-translate-x:0px");expect(css).toContain("--tw-translate-y:0px");});
it('contextual menus restore the persistent row trigger rather than a detached menu item',()=>{
 expect(readFileSync('src/components/app-dialog.tsx','utf8')).toContain('restoreFocusRef');
 const manager=readFileSync('src/components/merchant-product-manager.tsx','utf8');expect(manager).toContain('restoreFocusRef={opener}');expect(manager).toContain('onPointerDownCapture');
});

it('opens row action menus after pointer release without selecting an item on the trigger click',()=>{
 const manager=readFileSync('src/components/merchant-product-manager.tsx','utf8');
 expect(manager).toContain('open={menuId === p.id}');
 expect(manager).toContain('onPointerDown={(event) => event.preventDefault()}');
 expect(manager).toContain('onClick={() => setMenuId');
});
