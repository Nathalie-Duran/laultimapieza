import {Readable,Writable} from 'node:stream';

// Exercise the actual HTTP request handler without opening a network socket.
export function request(server,url,options={}) {
  return new Promise((resolve,reject)=>{
    const chunks=[],headers=new Map();
    const response=new Writable({write(chunk,encoding,done){chunks.push(Buffer.from(chunk));done();}});
    response.statusCode=200;
    response.setHeader=(key,value)=>headers.set(key.toLowerCase(),String(value));
    response.writeHead=(status,values={})=>{response.statusCode=status;for(const [key,value]of Object.entries(values))response.setHeader(key,value);return response;};
    response.on('error',reject);
    response.on('finish',()=>{
      const bytes=Buffer.concat(chunks);
      resolve({status:response.statusCode,headers,text:async()=>bytes.toString('utf8'),json:async()=>JSON.parse(bytes.toString('utf8')),arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)});
    });
    const input=Readable.from(options.body?[Buffer.from(options.body)]:[]);
    input.url=url;input.method=options.method||'GET';input.headers=Object.fromEntries(Object.entries(options.headers||{}).map(([key,value])=>[key.toLowerCase(),value]));
    server.emit('request',input,response);
  });
}
