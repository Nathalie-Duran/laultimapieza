(() => {
  'use strict';
  const modes = {solo:'En solitario',duo:'En pareja',legacy:'Sin modalidad elegida'};
  function element(tag, value, className) {
    const node = document.createElement(tag);
    if (value != null) node.textContent = value;
    if (className) node.className = className;
    return node;
  }
  function caseInfo(id) {
    return id<=12 ? window.ValdemarCatalog?.get(id) : window.Mundos?.story(id);
  }
  function gameLink(id) {
    return '#'+(id<=12?'valdemar-jugar':'mundos-jugar')+'?id='+id;
  }
  function actionLink(label,url,context) {
    const a=element('a',label,'sa-action');a.href=url;
    if(context)a.setAttribute('aria-label',label+' · '+context);
    return a;
  }
  function caseCard(game,featured,report,games) {
    const first = game.id <= 12;
    const catalogStory = caseInfo(game.id);
    const story = catalogStory && game.title ? {...catalogStory,title:game.title,...(game.edition==='legacy'?{image:'/valdemar-art-01.webp'}:{})} : catalogStory;
    if (!story) return null;
    const season=window.Colecciones.seasons[Math.floor((game.id-1)/12)];
    const item = element('li', null, featured?'sa-card sa-featured':'sa-card');
    item.dataset.seasonCase = game.id;
    const cover = element('img');
    cover.src = first ? story.image : '/mundo-'+game.id+'.webp';
    cover.alt = ''; cover.loading = featured?'eager':'lazy'; cover.decoding = 'async';
    const info = element('div', null, 'sa-card-info');
    info.append(element('small',season.name),element('h4',story.title));
    const stage = game.finished ? 'Desenlace guardado' :
      game.current >= game.total ? 'Pendiente de desenlace' : 'Etapa '+(game.current+1)+' de '+game.total;
    info.append(element('p',(window.PlayerNotebook?.teamLabel?.(game)||modes[game.mode]||modes.legacy)+' · '+stage));
    if(!game.finished){
      const meter=element('progress',null,'sa-progress');
      meter.max=game.total;meter.value=game.current;meter.setAttribute('aria-label','Etapas completadas de '+story.title);
      info.append(meter);
    }
    if(featured){
      const checkpoint=game.checkpoint;
      if(checkpoint?.title)info.append(element('strong',checkpoint.title,'sa-stage-title'));
      const objective=checkpoint?.task || (game.current>=game.total?'Contrasta tu deducción y guarda el desenlace de esta historia.':story.question);
      if(objective)info.append(element('p',objective,'sa-objective'));
    }
    const actions=element('div',null,'sa-actions');
    if(game.available){
      const href=gameLink(game.id)+(game.finished?'':'&retomar=1');
      actions.append(actionLink(game.finished?'Ver desenlace':'Continuar',href,story.title));
    }else info.append(element('small','Requiere acceso'));
    const hasRecap=game.finished && report?.career?.caseResults?.[game.id] && window.PlayerNotebook?.caseRecap;
    if(game.finished && !hasRecap){
      const local=(game.id-1)%12+1;
      actions.append(actionLink('Ver mi sello','#'+season.board+'?lugar='+local+'&seccion=sello',season.seal));
    }
    item.append(cover,info,actions);
    if(hasRecap){
      const details=element('details',null,'sa-recap'), summary=element('summary','Resumen de la aventura');
      details.append(summary);
      details.addEventListener('toggle',()=>{
        if(!details.open || details.childElementCount>1)return;
        const view=element('div');view.innerHTML=window.PlayerNotebook.caseRecap(game.id,report,games,{inArchive:true});details.append(view);
      });
      item.append(details);
    }
    return item;
  }
  function nextVisit(games,access) {
    const last=games.filter(game=>game.finished)
      .sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0)||b.id-a.id)[0];
    if(!last || !Array.isArray(access?.availableCases) || !Array.isArray(access?.completed))return null;
    const seasonNumber=Math.ceil(last.id/12),season=window.Colecciones.seasons[seasonNumber-1];
    const earned=new Set(access.completed);
    const allowed=access.availableCases.filter(id=>!earned.has(id)).sort((a,b)=>a-b);
    const same=allowed.filter(id=>Math.ceil(id/12)===seasonNumber);
    const seal=access.seasons?.find(s=>s.number===seasonNumber)?.seal;
    const completedSeason=seal?.complete===true;
    const next=same.find(id=>id>last.id)||same[0]||(completedSeason?allowed.find(id=>Math.ceil(id/12)===seasonNumber+1):null);
    const story=next?caseInfo(next):null;
    const sealLink='#'+season.board+'?lugar='+((last.id-1)%12+1)+'&seccion=sello';
    const card=element('section',null,'sa-upnext');
    if(story){
      card.append(element('small','Siguiente caso disponible'),element('h3',story.title),element('p',story.question),
        actionLink('Jugar a este caso',gameLink(next),story.title));
    }else if(completedSeason){
      card.append(element('small',season.name),element('h3','Tu sello está completo'),
        actionLink('Ver el sello y su epílogo',sealLink,season.seal));
    }else if([4,8].includes(seal?.earned?.length) && access.availableCases.some(id=>Math.ceil(id/12)===seasonNumber)){
      card.append(element('small',season.name),element('h3',seal.earned.length+' de 12 piezas reunidas'),
        element('p','Has terminado los casos que tienes abiertos. El siguiente bloque del pase añade cuatro historias.'),
        actionLink('Ver las piezas del sello',sealLink,season.seal));
    }else{
      return null;
    }
    return card;
  }
  class SeasonArchive extends HTMLElement {
    connectedCallback() { this.load(); }
    disconnectedCallback() { this.requestId = null; }
    async load() {
      const bridge = window.GameAccountBridge;
      if (!bridge?.isSignedIn()) return;
      const requestId = this.requestId = Symbol();
      this.setAttribute('aria-busy','true');
      const status = element('p','Cargando tus partidas de temporada…','sa-message');
      status.setAttribute('role','status');
      this.replaceChildren(status);
      try {
        const report=await bridge.request('/api/valdemar/partidas');
        if(this.requestId!==requestId || !bridge.isSignedIn())return;
        const games=window.PlayerNotebook?.pairedGames?await window.PlayerNotebook.pairedGames(report.games,bridge):report.games;
        const {access}=report;
        if (this.requestId !== requestId || !bridge.isSignedIn()) return;
        if (!games.length) {
          this.replaceChildren();
          if (!this.hasAttribute('data-with-classic')) {
            const next=window.PlayerNotebook?.nextAdventure?.(games,access);
            const empty = element('p',next?'Tu primer caso está disponible.':'Todavía no tienes partidas guardadas.','sa-message');
            const link = element('a',next?'Empezar '+next.title:'Explorar los casos','button primary');
            link.href = next?'#'+next.route:'#casos';
            this.append(empty,link);
          }
          return;
        }
        this.draw(games,access,report);
      } catch {
        if (this.requestId !== requestId || !bridge.isSignedIn()) return;
        status.textContent = 'No se han podido cargar tus partidas de temporada.';
        const retry = element('button','Volver a intentar','button');
        retry.type = 'button'; retry.addEventListener('click', () => this.load());
        this.append(retry);
      } finally {
        if (this.requestId === requestId) this.removeAttribute('aria-busy');
      }
    }
    draw(games,access,report) {
      const ordered=[...games].sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0)||b.current-a.current||a.id-b.id);
      const head = element('div',null,'sa-head');
      head.append(element('h2','Temporadas'));
      const body = element('div');
      const visibleModes = new Set(games.map(game=>game.mode || 'legacy'));
      let mode='all',board=0;
      const groups = () => {
        body.replaceChildren();
        const visible = ordered.filter(game => (mode==='all' || (game.mode || 'legacy')===mode) && (!board || Math.ceil(game.id/12)===board));
        if(!visible.length){body.append(element('p','No hay partidas guardadas con estos filtros.','sa-message'));return;}
        const resume=visible.find(game=>game.available&&!game.finished);
        if(resume){
          const card=caseCard(resume,true,report,games);
          if(card){
            const group=element('section',null,'sa-group'),list=element('ul',null,'sa-list');
            list.append(card);group.append(element('h3','Retomar la investigación'),list);body.append(group);
          }
        }else if(mode==='all' && !board && !this.hasAttribute('data-classic-ongoing')){
          const suggestion=nextVisit(ordered,access);
          if(suggestion)body.append(suggestion);
        }
        for (const complete of [false,true]) {
          const items = visible.filter(game=>game!==resume && Boolean(game.finished)===complete).map(game=>caseCard(game,false,report,games)).filter(Boolean);
          if (!items.length) continue;
          const group = element('section',null,'sa-group');
          const heading = element('h3',complete ? 'Terminadas' : 'En curso');
          const list = element('ul',null,'sa-list');
          list.append(...items); group.append(heading,list); body.append(group);
        }
        if(visible.some(g=>!g.available) && !this.hasAttribute('data-classic-locked'))body.append(actionLink('Consultar mi pase','#planes'));
      };
      if (visibleModes.size > 1) {
        const filter = element('label',null,'sa-filter');
        const select = element('select');
        const all = element('option','Todas'); all.value='all'; select.append(all);
        for (const [id,label] of Object.entries(modes)) {
          if (!visibleModes.has(id)) continue;
          const option = element('option',label); option.value=id; select.append(option);
        }
        filter.append(element('span','Modalidad'),select); head.append(filter);
        select.addEventListener('change',()=>{mode=select.value;groups();});
      }
      const playedBoards=[...new Set(games.map(g=>Math.ceil(g.id/12)))].sort((a,b)=>a-b);
      if(playedBoards.length>1){
        const filter=element('label',null,'sa-filter'),select=element('select'),all=element('option','Todos');all.value='0';select.append(all);
        for(const n of playedBoards){const opt=element('option',window.Colecciones.seasons[n-1].name);opt.value=String(n);select.append(opt);}
        filter.append(element('span','Tablero'),select);head.append(filter);
        select.addEventListener('change',()=>{board=Number(select.value);groups();});
      }
      groups(); this.replaceChildren(head,body);
    }
  }
  customElements.define('season-archive',SeasonArchive);
})();
