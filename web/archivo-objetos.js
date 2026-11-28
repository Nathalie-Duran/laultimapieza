(() => {
  'use strict';
  const motifs=[
    [/negativ|fotograma|pel[ií]cula|diapositiva/i,6],
    [/foto|postal|retrato|instant[aá]nea/i,0],
    [/croquis|plano|mapa|itinerario|cartograf|trazado/i,2],
    [/bobina|grabaci[oó]n|casete|cassette|carrete|cinta/i,3],
    [/carta\b|sobre\b|correspondencia|telegrama/i,4],
    [/billete|boleto|resguardo|tal[oó]n|entrada numerada/i,5],
    [/calco|impronta|carboncillo|boceto/i,7],
    [/estela|relieve|losa|arenisca|piedra|dintel/i,8],
    [/engranaje|rueda dentada|pi[nñ][oó]n|relojer[ií]a/i,9],
    [/herbario|helecho|hoja seca|hoja prensada/i,10],
    [/micr[oó]fono|entrevista|testimonio|locuci[oó]n/i,11],
    [/cuaderno|libro|diario|registro manuscrito/i,1]
  ];
  const formats={audio:'audio',visual:'lamina',web:'web',ledger:'registro',testimony:'testimonio',text:'documento'};
  function thumbnail(item){
    const image=document.createElement('span');
    image.className='archivo-objeto';
    image.setAttribute('aria-hidden','true');
    const motif=motifs.find(([pattern])=>pattern.test(item.label||'')) ||
      motifs.find(([pattern])=>pattern.test(String(item.id||'').replace(/[-_]/g,' ')));
    if(motif){
      const cell=motif[1];
      image.style.setProperty('--archivo-x',(cell%4)*100/3+'%');
      image.style.setProperty('--archivo-y',Math.floor(cell/4)*50+'%');
    }else{
      const kind=formats[item.kind]||'documento';
      image.classList.add('archivo-formato');
      image.style.backgroundImage='url("/prueba-'+kind+'.webp")';
    }
    return image;
  }
  const desks=[
    [2,'hotel-investigacion'],[4,'tren-radio-investigacion'],[12,'valdemar-investigaciones'],
    [24,'ruta-expediciones'],[36,'tercer-jugador-investigaciones'],[48,'ra-excavaciones']
  ];
  const assets=new URL('.',document.currentScript.src);
  const version=new URL(document.currentScript.src).search;
  const loads=new Map();
  function load(name,style){
    const path=name+(style?'.css':'.js')+version;
    if(!loads.has(path)){
      const pending=new Promise((resolve,reject)=>{
        const asset=document.createElement(style?'link':'script');
        if(style){asset.rel='stylesheet';asset.href=new URL(path,assets).href;}
        else asset.src=new URL(path,assets).href;
        asset.onload=resolve;
        asset.onerror=()=>{
          asset.remove();loads.delete(path);
          reject(new Error('No se ha podido cargar la mesa de investigación. Vuelve a abrir el juego.'));
        };
        document.head.append(asset);
      });
      loads.set(path,pending);
    }
    return loads.get(path);
  }
  function open(caseId){
    if(caseId<2||caseId>48)return;
    const [,name]=desks.find(([last])=>caseId<=last);
    const sheets=[name],scripts=[name];
    if(caseId===3||caseId===4){sheets.push('tren-radio-fuentes');scripts.push('tren-radio-fuentes');}
    if(caseId>=5&&caseId<=12){
      const evidence=caseId===11?'valdemar-rifa':'valdemar-evidencias';
      sheets.push(evidence);scripts.push(evidence);
    }
    if(caseId>=25&&caseId<=36)scripts.push('tercer-jugador-evidencias');
    return Promise.all([...sheets.map(file=>load(file,true)),...scripts.map(file=>load(file,false))]);
  }
  window.ArchivoObjetos=Object.freeze({thumbnail,open});
})();
