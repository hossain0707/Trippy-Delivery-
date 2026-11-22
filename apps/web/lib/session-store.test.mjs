import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSessionStore,safeReturnPath} from './session-store.mjs';

test('deduplicates simultaneous restores across pages and notifies subscribers',async()=>{
 let count=0;const s=createSessionStore(async()=>{count++;return {credential:'short-access'};});
 let observed;const unsubscribe=s.subscribe(v=>observed=v);
 const [a,b]=await Promise.all([s.restore(),s.restore()]);
 assert.equal(count,1);assert.equal(a,b);assert.equal(observed,a);
 unsubscribe();s.set(null);assert.equal(observed,a);assert.equal(s.get(),null);
});
test('late restoration cannot undo logout or replace a newer login',async()=>{
 let finish;const s=createSessionStore(()=>new Promise(r=>finish=r));
 const pending=s.restore();await Promise.resolve();s.set(null);finish({credential:'stale'});
 await assert.rejects(pending,/changed/);assert.equal(s.get(),null);
 const second=s.restore();await Promise.resolve();s.set({credential:'new-login'});finish({credential:'old'});
 await assert.rejects(second,/changed/);assert.equal(s.get().credential,'new-login');
});
test('failed restore can retry without locking out the account',async()=>{
 let fail=true;const s=createSessionStore(async()=>{if(fail)throw Error('offline');return {credential:'ok'};});
 await assert.rejects(s.restore(),/offline/);fail=false;assert.equal((await s.restore()).credential,'ok');
});
test('return destinations cannot send customers to external or script URLs',()=>{
 for(const path of ['https://evil.example','//evil.example','/\\evil.example','javascript:alert(1)','/sign-in','/administer'])assert.equal(safeReturnPath(path),'/account');
 assert.equal(safeReturnPath('/cart'),'/cart');assert.equal(safeReturnPath('/orders?id=123'),'/orders?id=123');
});
