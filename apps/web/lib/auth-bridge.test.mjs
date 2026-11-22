import {test} from 'node:test';
import assert from 'node:assert/strict';
import {proxyAuth} from './auth-bridge.mjs';
const base='https://trippy-delivery.pages.dev/api/v1/auth/';
test('auth bridge rejects cross-site origins, unsupported routes and oversized bodies',async()=>{
 const send=()=>{throw Error('must not reach upstream');};
 for(const [request,status] of [
   [new Request(base+'session',{method:'POST',headers:{Origin:'https://evil.example'}}),403],
   [new Request(base+'session',{headers:{'Sec-Fetch-Site':'cross-site'}}),403],
   [new Request(base+'../admin'),404],
   [new Request(base+'session',{method:'DELETE'}),405],
   [new Request(base+'signin',{method:'POST',body:'x'.repeat(16001)}),413],
 ])assert.equal((await proxyAuth(request,send)).status,status);
});
test('bridge uses fixed upstream, forwards only session cookie and prevents response caching',async()=>{
 let seen;
 const result=await proxyAuth(new Request(base+'session',{method:'POST',headers:{Cookie:'analytics=private; __Host-trippy_session=opaque',Origin:'https://trippy-delivery.pages.dev'},body:'{}'}),async(url,init)=>{
   seen={url,init};return new Response('{"profile":{}}',{headers:{'Set-Cookie':'__Host-trippy_session=new; Secure; HttpOnly; SameSite=Lax; Path=/','Cache-Control':'public,max-age=3600','Access-Control-Allow-Origin':'*'}});
 });
 assert.equal(seen.url,'https://trippy-delivery-api-dev-1010753880203.asia-south1.run.app/api/v1/auth/session');
 assert.equal(seen.init.headers.get('Cookie'),'__Host-trippy_session=opaque');
 assert.equal(seen.init.headers.get('Origin'),'https://trippy-delivery.pages.dev');
 assert.equal(result.headers.get('Cache-Control'),'no-store');
 assert.equal(result.headers.get('Access-Control-Allow-Origin'),null);
 assert.match(result.headers.get('Set-Cookie'),/HttpOnly/);
});
