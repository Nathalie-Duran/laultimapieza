import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const source=await readFile(new URL('../web/editorial-challenges.js',import.meta.url),'utf8');
function harness(editions){
  let focus;
  class Node {
    constructor(){this.nodes={};this.events={};this.dataset={};this.isConnected=true;this.textContent='';}
    querySelector(selector){return this.nodes[selector]??null;}
    querySelectorAll(selector){return selector==='details'?cards:selector==='form[data-challenge]'?cards.map(card=>card.form):[];}
    addEventListener(name,fn){this.events[name]=fn;}
    focus(){focus=this;}
    dispatchEvent(event){events.push(event.type);}
    fire(name){return this.events[name]?.({target:this,preventDefault(){}});}
  }
  const events=[],requests=[],tables=[],panel=new Node(),list=new Node(),status=new Node(),periods=new Node();
  const questionList=(owner)=>{
    const node=new Node();
    Object.defineProperty(node,'innerHTML',{set(value){
      node.markup=value;const opts=[...value.matchAll(/type="radio" value="(\d+)"/g)].map(m=>Object.assign(new Node(),{value:m[1]}));
      node.nodes={'input':opts[0],'button[type="submit"]':new Node()};owner.options=opts;
    }});
    return node;
  };
  let cards=[],items=editions,nextReply=async()=>{throw Error('Unexpected POST');};
  Object.defineProperty(list,'innerHTML',{set(markup){
    list.markup=markup;
    for(const card of cards)card.form.isConnected=false;
    cards=[...markup.matchAll(/<form data-challenge="([^"]+)">/g)].map(([,id])=>{
      const details=new Node(),form=new Node(),host=new Node(),summary=new Node(),saved=new Node(),review=new Node();
      form.dataset.challenge=id;const fields=questionList(details);
      form.nodes={'[role=status]':new Node(),'[data-question]':fields};form.closest=()=>details;
      details.nodes={'form':form,'summary':summary,'[data-mesa-reto]':host,'[data-repasar]':review};
      summary.nodes['[data-reto-progreso]']=saved;
      return Object.assign(details,{form,host,summary,saved,fields,review,open:false,choose(index){fields.nodes['input:checked']=this.options[index];}});
    });
  }});
  panel.nodes={'[role=status]':status,'[data-challenges]':list,'.reto-periodos':periods};
  const calendar=editions[0].id==='calendar';
  const primaryId=calendar?'calendar-challenges':'published-challenges';
  const win={GameAccountBridge:{isSignedIn:()=>true,request:async(path,input,method)=>{
    if(method==='POST'){requests.push({path,input:{...input}});return nextReply(input);}
    return {items};
  }},MesaDeJuego:{mount(host,state){
    const goal=new Node(),next=new Node(),table={state};
    host.nodes={'.mj-goal':goal,'.mj-next':next};
    table.update=val=>{table.state={...table.state,...val};};tables.push(table);return table;
  }}};
  class Event {constructor(type,properties){this.type=type;Object.assign(this,properties);}}
  runInNewContext(source,{window:win,document:{getElementById:id=>id===primaryId?panel:null},CustomEvent:Event});
  return {mount:()=>win.EditorialChallenges.mount(),list,status,events,requests,tables,get cards(){return cards;},get focus(){return focus;},
    respond(fn){nextReply=fn;},replaceItems(value){items=value;},open(card){card.open=true;card.fire('toggle');}};
}
const base={id:'calendar',title:'Turno en el archivo',caseId:1,revision:3,index:0,total:3,prompt:'Primer enunciado',options:['Primera','Segunda','Tercera'],prize:2,solved:false,
  schedule:{kind:'weekly',startsOn:'2026-11-23',endsOn:'2026-11-29'}};

test('una misión semanal monta la mesa al abrirse y conserva intento, avance, confirmación y repaso',async()=>{
  const game=harness([base]);await game.mount();const card=game.cards[0];
  assert.equal(game.tables.length,0);game.open(card);game.open(card);assert.equal(game.tables.length,1);
  const table=game.tables[0];
  assert.equal(table.state.family,'reto');assert.equal(table.state.help.context,'reto');
  assert.equal(table.state.objective,'Primer enunciado');
  assert.ok(card.fields.markup.includes('aria-describedby="reto-objetivo-calendar"'));
  assert.ok(!card.fields.markup.includes('Primer enunciado'));
  table.state.next.run();assert.equal(game.focus,card.options[0]);
  card.choose(1);game.respond(async()=>({correct:false}));await card.form.fire('submit');
  assert.match(table.state.result,/no encaja/);assert.equal(card.saved.textContent,'');
  assert.deepEqual(game.requests[0].input,{id:'calendar',revision:3,index:0,option:1});
  for(const index of [1,2]){
    game.respond(async()=>({correct:true,explanation:'Explicación de la prueba.',next:{...base,index,prompt:'Enunciado '+index}}));
    await card.form.fire('submit');
    assert.equal(table.state.objective,'Enunciado '+index);assert.equal(card.saved.textContent,' · Guardado '+index+' de 3');
    assert.equal(game.focus,card.options[0]);card.choose(0);
  }
  const solved={...base,index:2,solved:true};
  game.respond(async()=>({correct:true,explanation:'Explicación final.',next:solved}));
  await card.form.fire('submit');
  assert.equal(card.fields.hidden,true);assert.match(table.state.progress,/3 de 3 pruebas resueltas/);
  assert.equal(card.saved.textContent,' · Resuelto');assert.equal(game.focus,card.host.nodes['.mj-next']);
  assert.deepEqual(game.events,['editorial-challenge-solved']);
  card.review.fire('click');assert.equal(card.fields.hidden,false);card.choose(0);await card.form.fire('submit');
  assert.deepEqual(game.events,['editorial-challenge-solved']);
  table.state.next.run();assert.equal(card.open,false);assert.equal(game.focus,card.summary);
});

test('diarios, eventos y ediciones permanentes reanudan desde la pregunta que devuelve el servidor',async()=>{
  for(const [id,kind] of [['calendar','daily'],['published','event'],['published','always']]){
    const initial={...base,id,total:1,index:0,solved:true,schedule:{...base.schedule,kind}};
    const game=harness([initial]);await game.mount();const card=game.cards[0];game.open(card);
    assert.equal(card.fields.hidden,true);
    assert.equal(game.tables[0].state.progress,'1 de 1 prueba resuelta');
    assert.equal(game.requests.length,0);card.review.fire('click');card.choose(0);
    game.respond(async()=>({correct:false}));await card.form.fire('submit');
    assert.equal(game.requests[0].path,id==='calendar'?'/api/calendar-challenges':'/api/published-challenges');
    assert.equal(game.events.length,0);
  }
});

test('una edición que cambia al responder recupera el listado y no concede premios espurios',async()=>{
  const game=harness([base]);await game.mount();
  const old=game.cards[0];game.open(old);old.choose(0);
  game.replaceItems([{...base,revision:4,index:1}]);
  game.respond(async()=>{throw Object.assign(Error('Edición revisada'),{status:409});});
  await old.form.fire('submit');
  assert.equal(old.form.isConnected,false);assert.equal(game.focus,game.cards[0].summary);
  game.open(game.cards[0]);assert.equal(game.tables[1].state.progress,'Prueba 2 de 3');
  assert.deepEqual(game.events,[]);
});
