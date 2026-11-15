import { readFile } from 'node:fs/promises';
import { createContext, runInContext } from 'node:vm';
import { createIdentityVerifier, firebaseConfig } from './auth-provider.mjs';
import { createDatabase, databaseConfigured } from './database.mjs';
import { createGameApi } from './game-api.mjs';
import { createBilling } from './billing.mjs';
import { isAdministrator } from './admin-access.mjs';

export async function createRuntimeApi(env=process.env) {
  let saved={};
  try{saved=JSON.parse(await readFile(new URL('./firebase-config.json',import.meta.url),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
  const config=Object.fromEntries(Object.entries(firebaseConfig(env)).map(([key,value])=>[key,value||saved[key]||'']));
  const context=createContext({crypto:globalThis.crypto,structuredClone});context.window=context;
  for(const name of ['stories.js','season.js','engine.js'])runInContext(await readFile(new URL('./public/'+name,import.meta.url),'utf8'),context,{timeout:2000,filename:name});
  const billing=createBilling(env);
  return createGameApi({config,storageReady:databaseConfigured(env),verify:createIdentityVerifier(config),withStore:createDatabase(env),billing,authorizePlay:billing.canPlay,isAdministrator,
    engine:context.GameEngine,stories:context.STORIES,
    origins:(env.APP_ORIGINS||'https://laultimapieza.es,https://www.laultimapieza.es,https://yxkiqfgt3l.c35.airoapp.ai,https://yxkiqfgt3l.preview.c35.airoapp.ai').split(',').map(s=>s.trim()).filter(Boolean)});
}
