import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {test} from 'node:test';
import {createContext,runInContext} from 'node:vm';
import {SEASON_NAMES} from '../progression.mjs';
import {messageTemplate} from '../mail-service.mjs';

async function publicSite(){
  const page=createContext({location:{hash:'#casos'},URLSearchParams});
  page.window=page;
  for(const name of ['colecciones','valdemar-catalog','mundos-catalogo','valdemar-plano','mundos-vista']){
    runInContext(await readFile(new URL('../web/'+name+'.js',import.meta.url),'utf8'),page);
  }
  return page;
}

test('la miga de los cuatro mapas vuelve al territorio activo y su nombre se conserva en el selector y el h1',async()=>{
  const page=await publicSite();
  for(const season of page.Colecciones.seasons){
    const route=season.board;
    page.location.hash='#'+route;
    const crumb=page.Colecciones.mapBreadcrumb(route),menu=page.Colecciones.menu(route);
    assert.ok(crumb.includes('href="/#tableros?mundo='+route+'"'));
    assert.ok(crumb.includes(' Tableros</a>'));
    assert.ok(!crumb.includes(season.name));
    assert.ok(menu.includes('href="/#'+route+'" aria-current="page"'));
    const map=route==='mapa'?page.ValdemarPlano.view({}):page.Mundos.view(route);
    const heading=map.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1];
    assert.ok(heading?.includes(season.name));
  }
  assert.equal(page.Colecciones.mapBreadcrumb('casos'),'');
});

test('cada nombre editorial coincide en el catálogo, el mapa, el pase y la invitación al primer caso de su tablero',async()=>{
  const page=await publicSite();
  const names=['Código Valdemar','La ruta prohibida','El tercer jugador','La ira de Ra'];
  assert.deepEqual(SEASON_NAMES,names);
  for(const [index,season] of page.Colecciones.seasons.entries()){
    const name=names[index];
    assert.equal(season.name,name);
    page.location.hash=page.Colecciones.catalogRoute(season.board).replace(/^\//,'');
    assert.ok(page.ValdemarCatalog.list({}).includes('<h1>'+name+'</h1>'));
    const map=index?page.Mundos.view(season.board):page.ValdemarPlano.view({});
    assert.ok(map.includes(name));
    const mail=messageTemplate('case_invitation',{caseId:index*12+1});
    assert.ok(mail.text.includes(name));
    assert.ok(mail.html.includes(name));
  }
});

test('los doce bloques presentan exactamente los 48 destinos, con sus ilustraciones y sus fichas',async()=>{
  const page=await publicSite(),ids=new Set(),assets=new Set();
  for(const [index,season] of page.Colecciones.seasons.entries()){
    for(const block of [1,2,3]){
      page.location.hash=page.Colecciones.catalogRoute(season.board,block).split('#')[1];
      const html=page.ValdemarCatalog.list({month:block});
      assert.ok(html.includes('data-catalog-world="'+season.board+'"'));
      assert.equal((html.match(/class="vd-card"/g)||[]).length,4);
      assert.equal((html.match(/class="vd-card-action"/g)||[]).length,4);
      assert.equal((html.match(/1–2 participantes/g)||[]).length,1);
      assert.doesNotMatch(html,/class="vd-group"|class="vd-card-info"|href="\/#[^"]+-jugar\?id=/);
      for(let pos=1;pos<=4;pos++){
        const local=(block-1)*4+pos,id=index*12+local;
        const game=index?page.Mundos.story(id):page.ValdemarCatalog.get(id);
        const href=index?'/#'+season.board+'?lugar='+local+'&amp;seccion=ficha':page.ValdemarCatalog.path(id);
        assert.ok(html.includes('href="'+href+'"'),href);
        assert.ok(html.includes(game.title),game.title);
        assets.add((game.image||'/mundo-'+id+'.webp').slice(1));
        ids.add(id);
      }
    }
  }
  assert.equal(ids.size,48);
  await Promise.all([...assets].map(file=>access(new URL('../web/'+file,import.meta.url))));
});

test('las 36 fichas enlazan al bloque de origen y conservan los papeles y el acceso del titular',async()=>{
  const page=await publicSite();
  for(const [index,season] of page.Colecciones.seasons.entries()){
    if(!index)continue;
    for(let local=1;local<=12;local++){
      const id=index*12+local,block=Math.ceil(local/4),game=page.Mundos.story(id);
      page.location.hash='#'+season.board+'?lugar='+local+'&seccion=ficha';
      const guest=page.Mundos.view(season.board);
      assert.ok(guest.includes(game.title)&&guest.includes(game.roles[0])&&guest.includes(game.roles[1]));
      assert.ok(guest.includes('<h1 id="md-case-title" tabindex="-1">'+game.title+'</h1>'));
      assert.doesNotMatch(guest,/class="md-map-window"|class="md-directory"/);
      assert.ok(guest.includes('data-md-map-return href="#'+season.board+'?lugar='+local+'"'));
      assert.ok(guest.includes('/#casos?mundo='+season.board+'&amp;mes='+block));
      assert.ok(!guest.includes('href="#mundos-jugar?id='));
      const own=page.Mundos.view(season.board,{seasonAccess:{availableCases:[id],completed:[id]}});
      assert.ok(own.includes('href="#mundos-jugar?id='+id+'">Ver mi desenlace'));
    }
  }
});

test('los expedientes, el plano y el catálogo de Valdemar respetan cada bloque y los accesos antiguos',async()=>{
  const page=await publicSite(),options={canPlay:true,openedMonths:[2],completed:[5]};
  for(let id=1;id<=12;id++){
    page.location.hash='#mapa?lugar='+id;
    const map=page.ValdemarPlano.view(options),detail=page.ValdemarCatalog.detail(id,options);
    assert.ok(map.includes(page.ValdemarCatalog.get(id).title));
    assert.ok(map.includes('data-access="'+(id===5?'done':id>=6&&id<=8?'open':'preview')+'"'));
    if(id===2)assert.ok(detail.includes('data-vd-offhook'));
    if(id===1)assert.ok(detail.includes('id="carta-de-ada"'));
    if(id>=5&&id<=8)assert.ok(detail.includes('/#valdemar-jugar?id='+id));
    else assert.ok(!detail.includes('href="/#valdemar-jugar?id='+id+'"'));
  }
  const list=page.ValdemarCatalog.list({...options,month:2});
  assert.match(list,/Pieza recuperada/);
  assert.match(list,/href="\/#valdemar-jugar\?id=5" aria-label="Ver mi desenlace/);
  assert.match(list,/href="\/#valdemar-jugar\?id=6" aria-label="Jugar/);
  assert.ok(page.Colecciones.menu('umbravia').includes('href="/#mapa"'));
});

test('el catálogo diferencia en una misma fila el acceso, la pieza conservada y la vista previa',async()=>{
  const page=await publicSite();
  page.location.hash='#casos?mundo=expedicion';
  const html=page.ValdemarCatalog.list({month:1,seasonAccess:{availableCases:[13,15],completed:[13,14]}});
  assert.match(html,/class="vd-card-action" href="\/#mundos-jugar\?id=13" aria-label="Ver mi desenlace/);
  assert.match(html,/class="vd-card-action" href="\/#mundos-jugar\?id=15" aria-label="Jugar/);
  assert.doesNotMatch(html,/href="\/#mundos-jugar\?id=(14|16)"/);
  assert.equal((html.match(/class="vd-card-info"/g)||[]).length,2);
});
