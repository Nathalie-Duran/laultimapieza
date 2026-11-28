import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {createContext,runInContext} from 'node:vm';

async function gallery(){
  const ctx=createContext({location:{hash:'#desafios'},URLSearchParams});
  ctx.window=ctx;
  for(const file of ['valdemar-catalog','mundos-catalogo','retos-temporada','editorial-challenges','colecciones']){
    runInContext(await readFile(new URL('../web/'+file+'.js',import.meta.url),'utf8'),ctx);
  }
  return ctx;
}
const boards=['mapa','expedicion','umbravia','necropolis'];
const galleryHref=b=>'/#desafios?mundo='+b;
const room='/#desafios?seccion=sala';

test('los cuatro directorios fotográficos son enlaces directos y el calendario conserva su entrada',async()=>{
  const ctx=await gallery(),html=ctx.Colecciones.challenges();
  assert.match(html,/juegos opcionales/);
  assert.match(html,/llaves para pedir pistas/);
  assert.match(html,/Sala de Ada \(6 minijuegos\) \+ 11 retos/);
  assert.doesNotMatch(html,/seccion=reto|<mansion-arcade|data-action="page-section"/);
  for(const [i,season] of ctx.Colecciones.seasons.entries()){
    assert.ok(html.includes('href="'+galleryHref(boards[i])+'"'));
    assert.ok(html.includes('src="/extras-'+boards[i]+'.webp"'));
    assert.ok(html.includes('>'+season.name+'</h2>'));
  }
  assert.ok(html.includes('href="/#desafios?seccion=calendario"'));
  assert.match(html,/data-action="auth-login"/);
  ctx.GameAccountBridge={isSignedIn:()=>true};
  assert.match(ctx.Colecciones.challenges({availableCases:[1]}),/1 aventura abierta/);
  assert.match(ctx.Colecciones.challenges(),/href="\/#archivo"/);
});

test('cada temporada presenta doce fichas de reto con foto, acción, premio y acceso correctos',async()=>{
  const ctx=await gallery(),member={availableCases:[2,14,28,48]};
  for(const [i,board] of boards.entries()){
    const base=12*i,open=member.availableCases[i];
    ctx.location.hash='#desafios?mundo='+board;
    const html=ctx.Colecciones.challenges(member),guest=ctx.Colecciones.challenges();
    const cards=html.match(/<li><a class="extras-tile"[\s\S]*?<\/a><\/li>/g);
    assert.equal(cards.length,12);
    for(const [j,card] of cards.entries()){
      const id=base+j+1,info=ctx.RetosTemporada.ficha(id);
      assert.ok(card.includes('src="'+info.photo+'"'),id);
      assert.ok(card.includes('>'+info.title+'</h2>'),id);
      assert.ok(card.includes(info.action),id);
      const href=id===1?room:id===open?'/#'+(i===0?'valdemar':'mundos')+'-jugar?id='+id+'&amp;seccion=reto':galleryHref(board)+'&amp;reto='+id;
      assert.ok(card.includes('href="'+href+'"'),id);
      if(id===open)assert.ok(card.includes('data-reto-premio="'+id+'">'+(id===48?'2 llaves':'1 llave')));
    }
    assert.doesNotMatch(guest,/seccion=reto/);
    assert.match(guest,/Ver ficha del reto/);
    assert.ok(!guest.includes('<mansion-arcade>'));
    assert.equal((guest.match(/seccion=sala/g)||[]).length,i===0?1:0);
  }
});

test('las fichas enfocadas distinguen jugar, consultar la aventura o abrir la suscripción',async()=>{
  const ctx=await gallery();
  for(const [i,board] of boards.entries()){
    const id=12*i+2,info=ctx.RetosTemporada.ficha(id);
    ctx.location.hash='#desafios?mundo='+board+'&reto='+id;
    const guest=ctx.Colecciones.challenges(),member=ctx.Colecciones.challenges({availableCases:[id]});
    assert.ok(guest.includes('<h1>'+info.title+'</h1>'));
    assert.ok(guest.includes('src="'+info.photo+'"'));
    assert.ok(guest.includes('href="'+galleryHref(board)+'"'));
    assert.ok(guest.includes('href="/#planes"'));
    const story=i===0?ctx.ValdemarCatalog.path(id):'/#'+board+'?lugar=2&amp;seccion=ficha';
    assert.ok(guest.includes('href="'+story+'"'));
    assert.doesNotMatch(guest,/seccion=reto/);
    assert.ok(member.includes('-jugar?id='+id+'&amp;seccion=reto'));
    ctx.location.hash='#desafios?mundo='+board+'&reto=99';
    assert.match(ctx.Colecciones.challenges(),/class="extras-list"/);
  }
  ctx.location.hash='#desafios?seccion=calendario';
  const calendar=ctx.Colecciones.challenges();
  assert.match(calendar,/<h1>Calendario de juego<\/h1>/);
  assert.match(calendar,/Desafío diario/);
  assert.match(calendar,/Misión semanal/);
  ctx.location.hash='#desafios?seccion=sala';
  assert.match(ctx.Colecciones.challenges(),/<mansion-arcade>/);
});
