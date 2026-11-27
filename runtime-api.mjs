import { readFile } from 'node:fs/promises';
import { createContext, runInContext } from 'node:vm';
import { createIdentityVerifier, firebaseConfig } from './auth-provider.mjs';
import { createDatabase, databaseConfigured } from './database.mjs';
import { createGameApi } from './game-api.mjs';
import { createBilling } from './billing.mjs';
import { isAdministrator } from './admin-access.mjs';
import { createMailer } from './mail-service.mjs';

export async function createRuntimeApi(env=process.env) {
  let saved={};
  try{saved=JSON.parse(await readFile(new URL('./firebase-config.json',import.meta.url),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
  const config=Object.fromEntries(Object.entries(firebaseConfig(env)).map(([key,value])=>[key,value||saved[key]||'']));
  if(config.projectId==='la-ultima-pieza')config.authDomain='laultimapieza.es';
  const context=createContext({crypto:globalThis.crypto,structuredClone});context.window=context;
  for(const name of ['stories.js','season.js','engine.js'])runInContext(await readFile(new URL('./public/'+name,import.meta.url),'utf8'),context,{timeout:2000,filename:name});
  const billing=createBilling(env);
  const withStore=createDatabase(env),mailer=createMailer(env);
  const api=createGameApi({config,storageReady:databaseConfigured(env),verify:createIdentityVerifier(config),withStore,billing,authorizePlay:billing.canPlay,isAdministrator,
    engine:context.GameEngine,stories:context.STORIES,
    origins:(env.APP_ORIGINS||'https://laultimapieza.es,https://www.laultimapieza.es,https://yxkiqfgt3l.c35.airoapp.ai,https://yxkiqfgt3l.preview.c35.airoapp.ai').split(',').map(s=>s.trim()).filter(Boolean)});
  api.processMail=async()=>{
    if(!mailer.enabled)return;
    await withStore(store=>store.queueActivePublications());
    await withStore(store=>store.queueDueReminders());
    await mailer.process(withStore);
  };
  let pricingBusy=false,backfillComplete=false;
  api.processPartnerOffers=async()=>{
    if(pricingBusy||!databaseConfigured(env))return;
    pricingBusy=true;
    try{
      try{
        if(!backfillComplete)backfillComplete=await withStore(store=>store.backfillPartnerOffers());
        await withStore(store=>store.expireOfferPurchases());
        await withStore(store=>store.scheduleChangedPartners());
      }finally{
        await billing.processPartnerOffers(withStore);
      }
    }finally{pricingBusy=false;}
  };
  return api;
}
