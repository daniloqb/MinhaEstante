import type { ConformanceHarness } from './conformance';
import type { SafDiagnosticController } from '../saf/controller';
import type { SelectedDigitalFile } from '../../services/storage/digital/contracts';
export async function nativeConformanceHarness(api: SafDiagnosticController): Promise<ConformanceHarness> {
  const selected=new Map<string,SelectedDigitalFile>();let unknown=false;
  for(const variant of ['base','different'] as const){
    const fixtures=await api.generateSources(false,variant);
    for(const fixture of fixtures){const file=api.selectFixture(fixture.index);if(file)selected.set(`${variant}:${fixture.fixture}:${fixture.format}`,file);}
  }
  return {
    createBook:()=>api.createBook(),
    async select(format,variant='base',large=false,unknownSize=false){
      unknown=unknownSize;
      if(large&&!selected.has('large')){const list=await api.generateSources(true);const fixture=list.find(f=>f.fixture==='large')!;selected.set('large',api.selectFixture(fixture.index)!);}
      const file=large?selected.get('large'):selected.get(`${variant==='invalid'?'base':variant}:${variant==='invalid'?'invalid':'valid'}:${format}`);
      if(!file)throw new Error('Missing synthetic native fixture');api.setSelected(unknown?{...file,sizeBytes:undefined}:file);
    },
    async import(id,options={}){
      const fault=options.cancel?'slow-copy':options.interrupt?'write-failure':unknown?'unknown-size':undefined;
      const result=await api.importSelected({id,link:options.link,replace:options.replace,positionDecision:options.decision,
        failCommit:options.failCommit,failFinalize:options.failFinalize,cancelOnProgress:options.cancel,fault,faultAfterBytes:options.interrupt?0:undefined});
      if(fault)await api.clearFault(id);
      return {imported:result.imported,linked:result.link};
    },
    snapshot:()=>api.snapshot(),seedPosition:(type='ebook')=>api.seedPosition(type),seedHistory:()=>api.seedHistory(),
    detach:(type,decision)=>api.detach(type,decision),recover:id=>api.recover(id),verify:id=>api.verify(id),
  };
}
