import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const source=await readFile(new URL('../web/sala-cooperativa.js',import.meta.url),'utf8');
function participant(){
  let Panel;const sent=[];
  const window={GameAccountBridge:{request:async(path,payload)=>{sent.push({path,payload});return {correct:true,coop:room.coop};}}};
  const room={coop:{partnerId:'vinculo',partnerName:'Bea',role:'A',stations:{}}};
  class Element {constructor(){this.isConnected=true;}addEventListener(){}querySelector(){return null;}contains(){return false;}}
  runInNewContext(source,{window,document:{activeElement:null},HTMLElement:Element,customElements:{define(_tag,cls){Panel=cls;}}});
  const component=new Panel();component.configure({id:'luces',endpoint:'/api/valdemar/salas/2',room});
  return {component,sent,room};
}
test('se juega a solas hasta aceptar; una ronda compartida exige preparación y envía la solución con su vínculo',async()=>{
  const {component,sent,room}=participant(),proposal=['norte','sur'];
  await component.solve(proposal);assert.equal(sent[0].payload.coop,undefined);
  room.coop.stations.luces={joined:true,phase:'prepare',round:'ronda',prepared:false};
  assert.throws(()=>component.solve(proposal),/ambos/);
  assert.equal(sent.length,1);
  room.coop.stations.luces.phase='play';
  await component.solve(proposal);
  assert.equal(sent[1].payload.coop.op,'solve');assert.equal(sent[1].payload.coop.round,'ronda');
  assert.equal(sent[1].payload.coop.partnerId,'vinculo');assert.deepEqual(sent[1].payload.attempt,proposal);
});
test('un logro remoto actualiza una vez la estación y una ronda nueva ofrece su propia preparación',()=>{
  const {component,room}=participant();let solved=0,replayed=0;
  component.options.onSolved=()=>solved++;component.options.onReplay=()=>replayed++;
  const next=(round,phase)=>({...room.coop,stations:{luces:{round,phase,joined:true}}});
  component.adopt(next('a','play'),true);component.adopt(next('a','solved'),true);component.adopt(next('a','solved'),true);
  assert.equal(solved,1);
  component.adopt(next('b','waiting'),true);assert.equal(replayed,1);
});
