import {readFile,writeFile,mkdir} from 'node:fs/promises';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {postalArchive,documentSvg} from './postal-archive.mjs';
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function wrap(s,width=44){const lines=[];let line='';for(const word of s.split(/\s+/)){if((line+' '+word).trim().length>width&&line){lines.push(line);line='';}line+=(line?' ':'')+word;}if(line)lines.push(line);return lines;}
const text=(s,x,y,size=23,color='#172b36')=>`<text x="${x}" y="${y}" font-size="${size}" fill="${color}">${escape(s)}</text>`;
function svg(id,d){
 if(d.kind==='letters'){
  const cards=d.cards.map((card,i)=>{const x=44+(i%2)*578,y=172+Math.floor(i/2)*520;let content=`<g transform="translate(${x} ${y})"><rect x="7" y="9" width="548" height="486" rx="6" fill="#000" opacity=".15"/><rect width="548" height="486" rx="6" fill="#f4ead5" stroke="#b9a484"/><path d="M0 154 L274 252 L548 154" fill="none" stroke="#cab99d"/><path d="M0 154 H548" stroke="#cab99d"/><rect x="422" y="26" width="88" height="94" fill="#d6c9b1" stroke="#8d7259" stroke-dasharray="3 3"/><path d="M437 92l28-42 28 42z" fill="none" stroke="#7b6852"/>${text(card[0],24,42,19,'#775c47')}${text('CLARA MONTES → GABRIEL VIDAL',24,76,16,'#765e48')}`;card[1].split(' · ').forEach((stamp,k)=>{content+=`<g transform="translate(${28+k*190} 88)"><rect width="174" height="44" rx="22" fill="none" stroke="${k?'#866d68':'#35525b'}" stroke-width="2"/>${text(stamp,12,28,18,k?'#866d68':'#35525b')}</g>`;});content+=`<rect x="22" y="178" width="504" height="282" fill="#fffaf0" stroke="#d8cab4"/>${text('EXTRACTO DEL ORIGINAL',44,207,14,'#8e7761')}<g font-family="Georgia, serif">${text(card[2],44,249,22,'#384348')}`;wrap(card[3],34).forEach((line,k)=>{content+=text(line,44,296+k*34,24,'#233641');});return content+'</g></g>';}).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1250" viewBox="0 0 1200 1250" role="img" aria-labelledby="title desc"><title id="title">${escape(d.title)}</title><desc id="desc">${escape(d.cards.map(c=>c.join('. ')).join('\n'))}</desc><rect width="1200" height="1250" fill="#172a31"/><g font-family="Arial,sans-serif">${text('VALDEMAR / CUATRO ORIGINALES / COPIA DE CONSULTA',44,58,20,'#ceb58a')}${text('Las palabras llegaron. Su orden, no.',44,112,35,'#fff7e4')}${cards}${text('Marcas y extractos reproducidos con fidelidad · Documento de ficción',44,1220,18,'#c7d0cd')}</g></svg>`;
 }
 let content='',bottom=220;
 if(d.kind==='grid'){
  for(let i=0;i<5;i++)for(let j=0;j<5;j++){const x=56+j*216,y=180+i*115;content+=`<rect x="${x}" y="${y}" width="206" height="105" rx="8" fill="#fffdf5" stroke="#73887c"/>`+text(String.fromCharCode(65+i)+(j+1),x+12,y+28,21,'#385a4a');wrap(d.grid[i][j],18).forEach((s,k)=>content+=text(s,x+12,y+57+k*24,20));}bottom=780;content+=text('N ↑   ·   O ←   ·   E →   ·   S ↓',60,bottom,25);bottom+=50;
 }else if(d.kind==='seating'){
  content+='<rect x="180" y="285" width="840" height="190" rx="36" fill="#34594c"/>'+text('MESA 13',510,390,34,'#ffffff');
  [[1,290,220],[2,590,220],[3,890,220],[6,290,550],[5,590,550],[4,890,550]].forEach(([n,x,y])=>content+=`<rect x="${x-52}" y="${y-40}" width="104" height="80" rx="12" fill="#fffdf5" stroke="#7e5b38"/>`+text(String(n),x-10,y+10,34));content+=text('NORTE ↑',55,165,24);bottom=650;
 }else if(d.kind==='board'){
  content+='<path d="M360 180 H880 V575 H360 V535 A25 25 0 0 0 360 485 Z" fill="#ba926a" stroke="#634c34" stroke-width="6"/>';
  content+='<rect x="555" y="295" width="140" height="64" fill="none" stroke="#283f49" stroke-width="4"/>'+text('CR-6',582,337,32);
  content+='<path d="M315 510 H220 V560" fill="none" stroke="#bf4534" stroke-width="4"/>'+text('Muesca',90,590,24)+text('inferior izquierda',90,620,24)+text('46 cm',585,155,24)+text('38 cm',910,380,24);bottom=700;
 }else if(d.kind==='folio'){
  content+='<rect x="180" y="170" width="820" height="440" fill="#fffdf5" stroke="#b7aa86"/>';
  for(let i=1;i<=12;i++){const y=205+i*29;content+=`<path d="M210 ${y+6} H970" stroke="#d6d0bd"/>`+text(String(i).padStart(2,'0'),215,y,18,'#7a8078');if(i===7)content+=text('R7  ·  presente  ·  NR',300,y,22);}
  content+=text('AZ-14',825,202,26,'#375b4b');bottom=680;
 }else if(d.kind==='envelope'){
  content+='<rect x="230" y="170" width="740" height="440" fill="#fffdf5" stroke="#95866b" stroke-width="3"/>';
  for(let i=0;i<12;i++){const x=290+(i%4)*154,y=230+Math.floor(i/4)*90;content+=`<rect x="${x}" y="${y}" width="130" height="70" fill="none" stroke="#8e9b93"/>`+text(String(i+1).padStart(2,'0'),x+10,y+25,18,'#66796e');}
  content+=text('RESPONSABLE DE CUSTODIA: INÉS',285,565,24);bottom=680;
 }
 const cols=d.cards.length>1?2:1,cardWidth=cols===1?1088:532;
 d.cards.forEach((card,i)=>{const col=i%cols,row=Math.floor(i/cols),x=56+col*556;let y=(d.kind==='cards'?180:bottom)+row*310;content+=`<rect x="${x}" y="${y}" width="${cardWidth}" height="285" rx="10" fill="#fffdf5" stroke="#a7b4a6"/>`;let yy=y+39;card.forEach((line,k)=>{for(const part of wrap(line,cols===1?83:39)){content+=text(part,x+24,yy,k===0?23:21,k===0?'#47654f':'#24343b');yy+=32;}});});
 const height=Math.max(600,(d.kind==='cards'?180:bottom)+Math.ceil(d.cards.length/cols)*310+90);
 const description=[...d.cards.map(c=>c.join('. ')),...(d.grid||[]).map((r,i)=>r.map((v,j)=>String.fromCharCode(65+i)+(j+1)+' '+v).join('; '))].join('. ');
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="${height}" viewBox="0 0 1200 ${height}" role="img" aria-labelledby="title desc"><title id="title">${escape(d.title)}</title><desc id="desc">${escape(description)}</desc><rect width="1200" height="${height}" fill="#e9e4d6"/><g font-family="Arial, sans-serif">${text('LA ÚLTIMA PIEZA · DOCUMENTO DE FICCIÓN',56,58,20,'#536959')}${text(d.title,56,110,36)}${content}${text('Examina los detalles. Cruza esta fuente con las otras pruebas del caso.',56,height-34,20,'#536959')}</g></svg>`;
}
export async function buildEvidence(){
 const c=vm.createContext({});for(const name of ['cartas-case.js','cartas-hour.js','evidence-design.js'])vm.runInContext(await readFile(new URL('./web/'+name,import.meta.url),'utf8'),c);
 const dir=new URL('./public/evidence/',import.meta.url);await mkdir(dir,{recursive:true});
 for(const [id,d] of Object.entries(c.EvidenceDesign.cases)){
  await writeFile(new URL(id+'.svg',dir),svg(id,d.image));
  if(id==='cartas-medianoche'){
   await writeFile(new URL(id+'.html',dir),postalArchive(d.web));
   for(const doc of c.CartasCase.documents)await writeFile(new URL('cartas-'+doc.id+'.svg',dir),documentSvg(doc));
   continue;
  }
  const sections=d.web.sections.map(([title,paragraphs],i)=>`<section id="record-${i}"><span class="record">REGISTRO ${String(i+1).padStart(2,'0')}</span><h2>${escape(title)}</h2>${paragraphs.map(p=>`<p>${escape(p)}</p>`).join('')}</section>`).join('');
  await writeFile(new URL(id+'.html',dir),`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(d.web.title)} · Archivo ficticio</title><style>*{box-sizing:border-box}body{margin:0;background:#f4f0e6;color:#233b3b;font:18px/1.7 Georgia,serif}header{background:#183d37;color:#fff;padding:36px max(24px,calc((100% - 900px)/2))}header small,.record{font:12px/1.5 Arial,sans-serif;letter-spacing:2px;color:#8fc5af}h1{font-size:clamp(28px,5vw,44px);line-height:1.15}main{max-width:948px;margin:0 auto;padding:28px 24px}nav{display:flex;gap:12px;flex-wrap:wrap;margin:20px 0}nav a{color:#175847;font:16px Arial;padding:10px;border:1px solid #b4c6b7;border-radius:6px}section{background:#fffdf7;border:1px solid #d5ddce;border-left:5px solid #57816b;padding:24px;margin:24px 0;scroll-margin-top:20px}section .record{color:#56765d}h2{font:700 24px/1.3 Arial;margin-top:8px}footer{font:14px/1.5 Arial;border-top:1px solid #b4c6b7;padding:20px 0}a:focus-visible{outline:3px solid #bd662c}p{overflow-wrap:anywhere}</style><header><small>FUENTE DEL CASO · ARCHIVO DE FICCIÓN</small><h1>${escape(d.web.title)}</h1><p>Copia de consulta. Cada registro conserva su procedencia.</p></header><main><nav aria-label="Registros">${d.web.sections.map(([title],i)=>`<a href="#record-${i}">${escape(title)}</a>`).join('')}</nav>${sections}<footer>La última pieza · Este sitio pertenece al universo ficticio del juego. No contiene información sobre personas o servicios reales. Vuelve a la pestaña de la partida para contrastar las otras fuentes.</footer></main></html>`);
 }
}

function posterSvg(story,mark){const themes=[['#142531','#a66c4b','#f2d9ad'],['#251e27','#ac6768','#f2d2ab'],['#1e302c','#638d78','#efe1b8'],['#162936','#658d9b','#eacfa3']];const index=(story.episode||1)-1;const [bg,ink,light]=themes[index%4]||themes[0];const title=wrap(story.title,18);const words=title.map((line,i)=>`<text x="80" y="${255+i*78}" fill="#fff1d9" font-family="serif" font-size="68">${escape(line)}</text>`).join('');const issue=story.season===1?'CASO '+String(story.episode).padStart(2,'0'):'CASO ADICIONAL';return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="${bg}"/><path d="M0 520L1200 330M0 535L1200 345" stroke="${ink}" opacity=".35"/><g transform="rotate(-7 950 325)"><rect x="780" y="82" width="319" height="449" rx="4" fill="${ink}"/><rect x="798" y="69" width="319" height="449" rx="4" fill="${light}"/><rect x="816" y="87" width="283" height="413" rx="2" fill="none" stroke="${ink}" stroke-width="2"/><circle cx="958" cy="277" r="110" fill="none" stroke="${ink}" stroke-width="3"/><circle cx="958" cy="277" r="98" fill="none" stroke="${ink}" stroke-dasharray="3 9" stroke-width="2"/><g transform="translate(892 211) scale(5.5)" stroke="${bg}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="${mark}"/></g><path d="M873 422h169m-134 13h100" stroke="${ink}" stroke-width="2"/></g><path d="M80 98h54" stroke="${light}" stroke-width="4"/><text x="151" y="106" fill="${light}" font-family="sans-serif" font-size="25" letter-spacing="3">LA ÚLTIMA PIEZA</text>${words}<text x="80" y="479" fill="${light}" font-family="serif" font-size="35" font-style="italic">¿Con quién lo resolverías?</text><text x="80" y="566" fill="${light}" font-family="sans-serif" font-size="20" letter-spacing="2">${issue} · MISTERIO PARA UNO O DOS</text></svg>`;}

export async function buildInvitations(){const {Resvg}=await import('@resvg/resvg-js');const fontFiles=['DejaVuSans.ttf','DejaVuSerif.ttf','DejaVuSerif-Italic.ttf'].map(name=>fileURLToPath(import.meta.resolve('dejavu-fonts-ttf/ttf/'+name)));const publicDir=new URL('./public/',import.meta.url);const source=await readFile(new URL('./web/index.html',import.meta.url),'utf8');const ctx=vm.createContext({structuredClone,crypto:globalThis.crypto});ctx.window=ctx;for(const file of ['stories.js','season.js','retos-temporada.js','valdemar-catalog.js','colecciones.js','experience-ui.js'])vm.runInContext(await readFile(new URL(file,publicDir),'utf8'),ctx,{filename:file,timeout:3000});const stories=ctx.STORIES.filter(s=>s.season===1);const base='https://www.laultimapieza.es';
const head=(title,desc,url,image)=>`<link rel="canonical" href="${escape(url)}"><meta property="og:type" content="website"><meta property="og:locale" content="es_ES"><meta property="og:site_name" content="La última pieza"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(desc)}"><meta property="og:url" content="${escape(url)}"><meta property="og:image" content="${escape(image)}"><meta property="og:image:type" content="${image.endsWith('.webp')?'image/webp':image.endsWith('.jpg')?'image/jpeg':'image/png'}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${escape(title)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escape(title)}"><meta name="twitter:description" content="${escape(desc)}"><meta name="twitter:image" content="${escape(image)}">`;
for(const s of stories){if(!/^[a-z0-9-]+$/.test(s.id))throw Error('Identificador de caso no válido');const path='/caso/'+s.id+'/';const dir=new URL('.'+path,publicDir);await mkdir(dir,{recursive:true});const png=new Resvg(posterSvg(s,ctx.ExperienceUI.artworkPath(s)),{font:{loadSystemFonts:false,fontFiles,defaultFontFamily:'DejaVu Sans',serifFamily:'DejaVu Serif',sansSerifFamily:'DejaVu Sans'}}).render().asPng();await writeFile(new URL('portada.png',dir),png);
// Preserve links already shared while sending new visits to the single current catalogue.
 const replacement=ctx.ValdemarCatalog.items.find(item=>item.title===s.title);
 const destination=replacement?ctx.ValdemarCatalog.path(replacement.id):'/#casos';
 const title='Juegos de misterio · La Última Pieza';
 const meta=head(title,'Explora los juegos de La Última Pieza.',base+destination,base+'/atlas-cuatro-mundos.webp').replace(/<meta property="og:image:(?:width|height)"[^>]*>/g,'');
 const html='<!doctype html><html lang="es"><meta charset="utf-8"><title>'+title+'</title><meta name="robots" content="noindex,follow">'+meta+'<script>location.replace(location.hash ? "/"+location.hash : '+JSON.stringify(destination)+')</script><noscript><meta http-equiv="refresh" content="0;url='+destination+'"></noscript><a href="'+destination+'">Ver los juegos</a></html>';
 await writeFile(new URL('index.html',dir),html);
}
const main='<main id="main" tabindex="-1">';
const valdemarPaths = [];
for (const item of ctx.ValdemarCatalog.items) {
  const path = ctx.ValdemarCatalog.path(item.id);
  const directory = new URL('.'+path, publicDir);
  const title = item.title+' · Código Valdemar · La Última Pieza';
  const metadata = head(title, item.question, base+path, base+item.image)
    .replace(/<meta property="og:image:(?:width|height)"[^>]*>/g, '');
  const html = source
    .replace(/<title>.*?<\/title>/, () => '<title>'+escape(title)+'</title>')
    .replace(/<meta name="description"[^>]*>/, () => '<meta name="description" content="'+escape(item.question)+'">')
    .replace('</head>', () => metadata+'</head>')
    .replace('<body ', () => '<body data-valdemar-case="'+item.id+'" ')
    .replace(main+'</main>', () => main+ctx.ValdemarCatalog.detail(item.id,{})+'</main>');
  await mkdir(directory,{recursive:true});
  await writeFile(new URL('index.html',directory),html);
  valdemarPaths.push(path);
}
const landingTitle = source.match(/<title>([^<]+)<\/title>/)?.[1];
const landingDescription = source.match(/<meta name="description" content="([^"]+)"/)?.[1];
if (!landingTitle || !landingDescription) throw Error('Faltan el título o la descripción de la portada');
const landing = source
  .replace('</head>', () => head(landingTitle, landingDescription, base+'/', base+'/atlas-cuatro-mundos.webp').replace(/<meta property="og:image:(?:width|height)"[^>]*>/g,'')+'</head>')
  .replace(main+'</main>', () => main+ctx.ExperienceUI.home({stories,canPlay:false,sessions:[]})+'</main>');
await writeFile(new URL('index.html',publicDir),landing);
const publicPaths = ['/', '/cinta-87.html', ...valdemarPaths];
const sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n'
  + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
  + publicPaths.map(path => '  <url><loc>'+escape(base+path)+'</loc></url>').join('\n')
  + '\n</urlset>\n';
await writeFile(new URL('sitemap.xml', publicDir), sitemap);
await writeFile(new URL('robots.txt', publicDir), 'User-agent: *\nDisallow: /api/\nDisallow: /__/\nSitemap: '+base+'/sitemap.xml\n');
if(stories.length<12)throw Error('Faltan invitaciones para la temporada');console.log('Invitaciones generadas: '+stories.length);}
