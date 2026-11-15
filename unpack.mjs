import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import { inflateRawSync } from 'node:zlib';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Extract only the versioned application bundle, never user-supplied archives.
const root = fileURLToPath(new URL('./public/', import.meta.url));
const zip = await readFile(new URL('./public.zip', import.meta.url));
let eocd = -1;
for (let i = zip.length - 22; i >= Math.max(0,zip.length-65557); i--) {
  if (zip.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
}
if (eocd < 0 || zip.readUInt16LE(eocd+4) !== 0 || zip.readUInt16LE(eocd+6) !== 0) throw Error('Paquete ZIP no compatible');
let cursor = zip.readUInt32LE(eocd+16), total = 0;
const count = zip.readUInt16LE(eocd+10);
const seen = new Set();
for (let i=0; i<count; i++) {
  if (zip.readUInt32LE(cursor)!==0x02014b50) throw Error('Índice ZIP no válido');
  const flags=zip.readUInt16LE(cursor+8), method=zip.readUInt16LE(cursor+10);
  const compressed=zip.readUInt32LE(cursor+20), size=zip.readUInt32LE(cursor+24);
  const nameSize=zip.readUInt16LE(cursor+28), extraSize=zip.readUInt16LE(cursor+30), commentSize=zip.readUInt16LE(cursor+32);
  const local=zip.readUInt32LE(cursor+42);
  const name=zip.subarray(cursor+46,cursor+46+nameSize).toString('utf8');
  cursor+=46+nameSize+extraSize+commentSize;
  if (flags&1 || ![0,8].includes(method) || !/^[a-zA-Z0-9_./-]+$/.test(name) || name.split('/').some(p=>p==='..') || name.startsWith('/') || seen.has(name)) throw Error('Entrada ZIP no válida');
  seen.add(name);
  const file=resolve(root,name);
  if(!file.startsWith(resolve(root)+sep)) throw Error('Ruta fuera de public');
  total+=size;
  if(total>100*1024*1024) throw Error('Paquete demasiado grande');
  if(name.endsWith('/')) {await mkdir(file,{recursive:true});continue;}
  if(zip.readUInt32LE(local)!==0x04034b50) throw Error('Cabecera ZIP no válida');
  const start=local+30+zip.readUInt16LE(local+26)+zip.readUInt16LE(local+28);
  const data=zip.subarray(start,start+compressed);
  const output=method===0?data:inflateRawSync(data,{maxOutputLength:size||1});
  if(output.length!==size) throw Error('Archivo incompleto: '+name);
  await mkdir(dirname(file),{recursive:true});
  await writeFile(file,output);
}
// Tracked text sources override the historical bundle; media remain in public.zip.
try { await cp(new URL('./web/',import.meta.url),root,{recursive:true}); }
catch(error) { if(error.code!=='ENOENT') throw error; }
console.log(`Aplicación preparada: ${count} archivos y fuentes web actuales.`);
