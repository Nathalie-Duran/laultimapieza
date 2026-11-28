import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {runInNewContext} from 'node:vm';

const script=await readFile(new URL('../web/valdemar-catalog.js',import.meta.url),'utf8');
const ids=[1,2,3,4];
function page(bridge) {
  const definitions=new Map();
  const window={GameAccountBridge:bridge,HTMLElement:class {},customElements:{
    get:name=>definitions.get(name),define:(name,element)=>definitions.set(name,element)
  }};
  runInNewContext(script,{window});
  return {catalog:window.ValdemarCatalog,Progress:definitions.get('vd-block-progress')};
}
const header=html=>html.match(/<header class="vd-file-hero">([\s\S]*?)<\/header>/)[1];

test('las cuatro rutas públicas ofrecen una misma ficha con foto propia, duración, modos, acceso y regreso',async()=>{
  const {catalog}=page(),photos=new Set();
  const shelf=catalog.list({});
  for(const id of ids){
    const item=catalog.get(id),html=catalog.detail(id),hero=header(html);
    assert.equal(catalog.path(id),'/valdemar/0'+id+'/');
    assert.ok(hero.includes('Código Valdemar · Bloque 1'));
    assert.ok(hero.includes('<h1 tabindex="-1">'+item.title+'</h1>'));
    assert.ok(hero.includes(item.question)&&hero.includes(item.coverAlt));
    assert.equal(item.duration,id===1?'75–90 min':'60 min');
    assert.ok(hero.includes(item.duration+' estimados')&&hero.includes('A solas o en pareja'));
    assert.ok(hero.includes('class="vd-cta" href="/#planes">Ver la suscripción</a>'));
    assert.ok(hero.includes('/cinta-87.html?caso=0'+id));
    assert.ok(html.includes('href="/#casos?mes=1">Volver al bloque 1</a>'));
    assert.ok(html.includes(item.roleA)&&html.includes(item.roleB));
    assert.ok(!html.includes('data-vd-play=')&&!hero.includes('Atender la llamada')&&!hero.includes('Abrir la carta'));
    assert.ok(shelf.includes(item.image)&&shelf.includes(item.duration)&&shelf.includes(catalog.path(id)));
    const bytes=await readFile(new URL('../web'+item.image,import.meta.url));
    assert.equal(bytes.toString('ascii',0,4),'RIFF');
    assert.equal(bytes.toString('ascii',8,12),'WEBP');
    photos.add(item.image);
  }
  assert.equal(photos.size,ids.length);
  assert.equal((catalog.detail(2).match(/Atender la llamada/g)||[]).length,1);
  assert.equal((catalog.detail(1).match(/Abrir la carta de Ada/g)||[]).length,1);
  assert.ok(catalog.detail(1).includes('id="carta-de-ada"'));
  assert.ok(catalog.mansionCover().includes('/valdemar/01/?carta=1'));
});

test('ficha y tarjeta respetan acceso por episodio, partidas nuevas, pausadas y terminadas',()=>{
  const {catalog}=page();
  const opts={canPlay:true,openedMonths:[1],seasonAccess:{availableCases:[1,2,4],completed:[4]},
    games:[{id:1,mode:'solo',edition:'legacy',finished:true},{id:2,mode:'duo',current:0},{id:4,finished:true}]};
  const shelf=catalog.list(opts);
  for(const [id,label,href] of [[1,'Jugar','/#valdemar-jugar?id=1'],[2,'Continuar','/#valdemar-jugar?id=2&amp;retomar=1'],[4,'Ver mi desenlace','/#valdemar-jugar?id=4']]){
    const expected='href="'+href+'" aria-label="'+label+' · '+catalog.get(id).title+'"';
    assert.ok(header(catalog.detail(id,opts)).includes(expected));
    assert.ok(shelf.includes(expected));
  }
  assert.ok(header(catalog.detail(3,opts)).includes('href="/#suscripcion">Ver mi suscripción'));
  assert.ok(!shelf.includes('data-vd-play="3"'));
  const finalFromCalendar=header(catalog.detail(4,{canPlay:true,openedMonths:[1],completed:[4]}));
  assert.ok(finalFromCalendar.includes('Ver mi desenlace'));
  assert.ok(header(catalog.detail(3,{admin:true})).includes('data-vd-play="3"'));
});

test('una única lectura restaura el enlace de cada partida sin tocar otra cuenta ni consultar al visitante',async()=>{
  const calls=[],bridge={isSignedIn:()=>true,playerId:()=>41,request:async url=>{
    calls.push(url);
    return {games:[{id:2,current:2,mode:'solo'},{id:3,finished:true}]};
  }};
  const {Progress}=page(bridge);
  const links=ids.map(id=>({dataset:{vdPlay:String(id)},setAttribute(name,value){this[name]=value;}}));
  const mounted=Object.assign(new Progress(),{isConnected:true,hasAttribute:()=>false,querySelectorAll:()=>links});
  await Promise.all([mounted.connectedCallback(),mounted.connectedCallback()]);
  assert.deepEqual(calls,['/api/valdemar/partidas']);
  assert.deepEqual(links.map(link=>link.textContent),['Jugar','Continuar','Ver mi desenlace','Jugar']);
  assert.equal(links[1].href,'/#valdemar-jugar?id=2&retomar=1');
  bridge.request=async()=>{bridge.playerId=()=>42;return {games:[]};};
  await mounted.connectedCallback();
  assert.equal(links[1].textContent,'Continuar');
  bridge.request=async()=>assert.fail('lectura de cuenta inesperada');
  bridge.isSignedIn=()=>false;
  await mounted.connectedCallback();
  bridge.isSignedIn=()=>true;
  mounted.querySelectorAll=()=>[];
  await mounted.connectedCallback();
});
