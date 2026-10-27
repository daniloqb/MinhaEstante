import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import JSZip from 'jszip';
import { WebOpfsStorageProvider } from '../services/storage/digital/web';
import { AndroidSafStorageProvider } from '../services/storage/digital/android';
import type { AndroidSafBridge, AndroidManagedStorageBridge } from '../services/storage/digital/android/bridge';
import { DigitalFileStorageService } from '../services/storage/digital/DigitalFileStorageService';
import { libraryLocationReference, sourceFileReference } from '../services/storage/digital/validation';
import { storageFailure, storageSuccess } from '../services/storage/digital/errors';
import type { AttachmentFormat } from '../types/digitalMedia';
import type { StoredDigitalFile, StorageResult } from '../services/storage/digital/contracts';
import { TestFiles, TestRecords, testLocks } from './helpers/OpfsTestBackend';

// Shared assertions against OPFS doubles and an Android bridge double. NOT native SAF evidence.
const value=<T>(r:StorageResult<T>)=>{if(r.status!=='success')throw new Error('Synthetic test failure');return r.value;};
async function setup(kind:'android-bridge-double'|'opfs-double') {
 const bytes=new WebOpfsStorageProvider({records:new TestRecords(),files:new TestFiles(),lock:testLocks(),available:()=>true});
 value(await bytes.interaction.requestConfiguration({interaction:'user-initiated'}));
 const selected=new Map<string,ReturnType<typeof bytes.registerSource>>(),stored=new Map<string,StoredDigitalFile>();
 const nativeFile=(r:StoredDigitalFile)=>({...r,file:{...r.file,storageProvider:'saf_document'}});
 const bridge={
  getConfiguration:async()=>storageSuccess({configuration:{state:'configured',permission:'granted',location:libraryLocationReference('saf_document','synthetic-location')},state:'accessible',read:true,write:true,persistedRead:true,persistedWrite:true,canCreate:true,needsReconfiguration:false}),
  checkSourceAccess:async()=>storageSuccess({accessible:true}),
  importFile:async(r:{sourceReference:string;operationId:string;type:'ebook'|'audiobook';format:AttachmentFormat})=>{
   const out=await bytes.importFile({operationId:r.operationId,selected:selected.get(r.sourceReference)!,type:r.type,format:r.format});
   if(out.status!=='success')return out;stored.set(out.value.file.storageReference,out.value);return storageSuccess(nativeFile(out.value));
  },
  verifyManagedFile:async(r:{storageReference:string})=>{const row=stored.get(r.storageReference);return row?bytes.verifyIntegrity(row.file,row.integrity):storageFailure('INVALID_REFERENCE');},
  getManagedMetadata:async(r:{storageReference:string})=>{const row=stored.get(r.storageReference);return row?storageSuccess({file:nativeFile(row).file,metadata:row.metadata}):storageFailure('INVALID_REFERENCE');},
  checkManagedAccess:async(r:{storageReference:string})=>stored.has(r.storageReference)?storageSuccess({accessible:true}):storageFailure('INVALID_REFERENCE'),
  recoverImport:async(r:{operationId:string})=>{const out=await bytes.recoverImport(r.operationId);return out.status==='success'?storageSuccess(nativeFile(out.value)):out;},
 } as unknown as AndroidSafBridge & AndroidManagedStorageBridge;
 const provider=kind==='opfs-double'?bytes:new AndroidSafStorageProvider(bridge,()=>true),service=new DigitalFileStorageService([provider]);
 function register(blob:Blob,format:AttachmentFormat,unknown=false){const web=bytes.registerSource(blob,`synthetic.${format}`);selected.set(web.source.sourceReference,web);return {...web,source:sourceFileReference(provider.id,web.source.sourceReference),...(unknown?{sizeBytes:undefined}:{})};}
 return {service,provider,register,bytes};
}
async function fixture(format:AttachmentFormat) {
 if(format==='epub'){const zip=new JSZip();zip.file('mimetype','application/epub+zip',{compression:'STORE'});zip.file('META-INF/container.xml','<container/>');return new Blob([new Uint8Array(await zip.generateAsync({type:'uint8array'})).buffer]);}
 if(format==='pdf')return new Blob(['%PDF-1.4\nsynthetic\n%%EOF\n']);
 if(format==='mp3')return new Blob(['ID3',new Uint8Array(128)]);
 return new Blob([new Uint8Array([0,0,0,24,102,116,121,112,77,52,65,32,0,0,0,0,105,115,111,109,109,112,52,50])]);
}
describe.each(['android-bridge-double','opfs-double'] as const)('shared storage contracts: %s',kind=>{
 it.each(['epub','pdf','mp3','m4a','m4b'] as const)('imports %s with independently verified SHA-256 and stable recovery',async format=>{
  const h=await setup(kind),blob=await fixture(format),selected=h.register(blob,format),type=format==='epub'||format==='pdf'?'ebook':'audiobook';
  const stored=value(await h.service.importFile({operationId:`contract-${format}`,selected,type,format}));
  expect(stored.integrity.checksum.value).toBe(createHash('sha256').update(new Uint8Array(await blob.arrayBuffer())).digest('hex'));
  value(await h.service.verifyIntegrity(stored.file,stored.integrity));value(await h.service.getMetadata(stored.file));
  const first=value(await h.provider.recoverImport(`contract-${format}`)),second=value(await h.provider.recoverImport(`contract-${format}`));
  expect(first.file).toEqual(stored.file);expect(second).toEqual(first);
 });
 it('rejects invalid content without a confirmed file',async()=>{const h=await setup(kind);expect(await h.service.importFile({operationId:'invalid',selected:h.register(new Blob(['invalid']),'epub'),type:'ebook',format:'epub'})).toEqual(storageFailure('INVALID_FILE'));});
 it('accepts unknown declared size and returns verified actual size',async()=>{const h=await setup(kind),blob=await fixture('pdf');const out=value(await h.service.importFile({operationId:'unknown-size',selected:h.register(blob,'pdf',true),type:'ebook',format:'pdf'}));expect(out.integrity.sizeBytes).toBe(blob.size);});
 it('does not accept references from the other platform',async()=>{const h=await setup(kind);expect((await h.service.checkAccess({kind:'managed',storageProvider:kind==='opfs-double'?'saf_document':'web_digital',storageReference:'foreign-token' as any})).status).toBe('error');});
});
