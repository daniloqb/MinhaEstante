import type { ConformanceHarness } from './conformance';
import type { OpfsCheckpoint } from '../../services/storage/digital/web';
import type { OpfsDiagnostic } from '../opfs/main';
export function webConformanceHarness(api: OpfsDiagnostic): ConformanceHarness {
  return {
    async createBook(){const configured=await api.configure();if(configured.status!=='success')throw new Error('Diagnostic configuration unavailable');return api.createBook();},
    async select(format,variant='base',large=false,unknown=false) {
      if(variant==='invalid'){api.selectInvalid();return;}
      await api.selectFixture(format,`synthetic ${variant}`,large?1024*1024:0,unknown);
    },
    async import(id,options={}) {
      if(options.failCommit)api.failNextCommit();
      if(options.failFinalize)api.setFailure('complete');
      if(options.interrupt){await api.selectFixture('pdf',`interrupted ${id}`);api.setFailure('writing' as OpfsCheckpoint);}
      try{return await api.import(id,options);}finally{api.setFailure();}
    },
    snapshot:()=>api.snapshot(),seedPosition:(type='ebook')=>api.seedPosition(type),seedHistory:()=>api.seedHistory(),
    detach:(type,decision)=>api.detach(type,decision),recover:id=>api.recover(id),
    async verify(id){const r=await api.library.provider.getOperation(id);if(r.status!=='success'||!r.value.stored)return r;return api.library.service.verifyIntegrity(r.value.stored.file,r.value.stored.integrity);},
  };
}
