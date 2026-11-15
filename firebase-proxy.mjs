// Firebase's supported reverse proxy for popup/redirect helpers on our domain.
// Fixed upstream and reserved paths only: never a general URL proxy.
export async function firebaseAuthProxy(request,fetcher=fetch){
  const url=new URL(request.url);
  if(!/^\/__\/auth\/[a-zA-Z0-9_-]+(?:\.js)?$/.test(url.pathname)&&url.pathname!=='/__/firebase/init.json')return new Response('No encontrado',{status:404});
  if(!['GET','HEAD','POST'].includes(request.method))return new Response('Metodo no permitido',{status:405});
  const headers=new Headers();
  for(const key of ['content-type','accept','accept-language'])if(request.headers.has(key))headers.set(key,request.headers.get(key));
  const response=await fetcher('https://la-ultima-pieza.firebaseapp.com'+url.pathname+url.search,{
    method:request.method,headers,redirect:'manual',signal:AbortSignal.timeout(15000),
    ...(!['GET','HEAD'].includes(request.method)?{body:await request.arrayBuffer()}:{})
  });
  const outgoing=new Headers(response.headers);
  for(const key of ['content-length','content-encoding','transfer-encoding','connection','set-cookie'])outgoing.delete(key);
  outgoing.set('Cache-Control','no-store');outgoing.set('X-Content-Type-Options','nosniff');
  const location=outgoing.get('location');
  if(location?.startsWith('https://la-ultima-pieza.firebaseapp.com/__/auth/'))outgoing.set('location',location.replace('https://la-ultima-pieza.firebaseapp.com',url.origin));
  return new Response(request.method==='HEAD'?null:await response.arrayBuffer(),{status:response.status,headers:outgoing});
}
