import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanLogin, validLogin, statsFor, normalizeProfile, shareUrl, timeLabel } from '../src/core.mjs';
test('GitHub usernames are validated',()=>{
  for(const value of ['x','foo-bar','Z123','a'.repeat(39)]) assert.equal(validLogin(value),true);
  for(const value of ['','-abc','abc-','a b','a_b','a'.repeat(40),'a/b'])assert.equal(validLogin(value),false);
  assert.equal(cleanLogin(' @foo-bar '),'foo-bar');
  assert.equal(cleanLogin('../whoops'),'');
});
test('Public GitHub payload normalizes and selects a featured repository',()=>{
  const p=normalizeProfile({login:'someone',followers:22,public_repos:2},[
    {name:'small',fork:false,stargazers_count:3},{name:'big',fork:false,stargazers_count:42},{name:'fork',fork:true,stargazers_count:900}]);
  assert.equal(p.stars,45);assert.equal(p.featured,'big');assert.equal(p.demo,false);
});
test('Derived combat stats are capped and finite',()=>{
  for(const p of [{followers:0,public_repos:0,stars:0},{followers:1e9,public_repos:1e8,stars:1e10}]){
    const s=statsFor(p);for(const value of Object.values(s))assert.ok(Number.isFinite(value));assert.ok(s.power<=99);assert.ok(s.speed<=9);
  }
});
test('Challenge URLs are stable and safe',()=>{
  const uri=shareUrl('foo','bar','https://example.com/GITHUB-BOSS-RUSH/?old=true#hi');
  assert.equal(uri,'https://example.com/GITHUB-BOSS-RUSH/?hero=foo&boss=bar');
});
test('Game timer is padded',()=>{assert.equal(timeLabel(9.2),'10');assert.equal(timeLabel(-3),'00');});
