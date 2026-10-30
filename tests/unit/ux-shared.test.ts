import {readFileSync}from'node:fs';import{expect,it}from'vitest';
it('uses accessible asynchronous confirmation instead of blocking browser dialogs',()=>{const f=readFileSync('src/components/forms.tsx','utf8');expect(f).not.toContain('window.confirm');expect(f).toContain('AlertDialogContent');expect(f).toContain('aria-describedby');});
it('has bounded portal overlays and consistent product photographs',()=>{const css=readFileSync('src/app/globals.css','utf8');expect(css).toContain('--text-caption: 0.875rem');expect(css).toContain('aspect-ratio: 4 / 5');expect(css).toContain('[data-slot="dialog-content"]');});

it("keeps hidden upload inputs independent from full-width input primitives",()=>{const f=readFileSync("src/components/forms.tsx","utf8");expect(f).toMatch(/<input\s+ref=\{inputRef\}/);});
