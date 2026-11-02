import { BASE_DEMO, cleanLogin, normalizeProfile, REPO_URL, shareUrl, validLogin } from './core.mjs';
import { ArcadeGame } from './game.mjs';
const $=id=>document.getElementById(id);
const form=$('battle-form'),heroInput=$('hero-input'),bossInput=$('boss-input'),start=$('start-btn'),status=$('status');
const loading=$('loading-overlay'),idle=$('idle-overlay'),end=$('end-overlay'),dataMode=$('data-mode');
let current={...BASE_DEMO},lastResult=null,activeRequest=0;
let mute=false;const game=new ArcadeGame($('arena'),{
  onStatus:message=>{status.textContent=message;},
  onHit:({damage,streak})=>{if(streak>1)status.textContent=`${streak} HIT COMBO! Dealt ${damage} damage. Keep going!`;},
  onEnd:result=>{
    lastResult=result;
    $('result-title').textContent=result.outcome==='win'?'YOU WIN!':'GAME OVER';
    $('result-title').style.color=result.outcome==='win'?'#dcff75':'#ff5b9e';
    $('result-kicker').textContent=`${result.outcome==='win'?'BOSS DEFEATED':'BOSS SURVIVED'} // SCORE ${Math.max(0,result.score)}`;
    $('result-subtitle').textContent=result.outcome==='win'?`@${result.hero.login} defeated @${result.boss.login} in ${result.elapsed}s.`:`@${result.boss.login} wins. Every boss has a weakness — rematch!`;
    end.hidden=false;
    status.textContent=`${result.outcome==='win'?'Victory':'Defeat'}! Download your card or challenge a friend.`;
  }
});

// Public unauthenticated GitHub REST API: cached briefly to reduce rate-limit usage.
async function readJSON(url){
  const key=`bossrush:${url}`;
  try{const cached=JSON.parse(sessionStorage.getItem(key)||'null');if(cached&&Date.now()-cached.saved<600000)return cached.data;}catch{}
  const response=await fetch(url,{headers:{Accept:'application/vnd.github+json'}});
  if(!response.ok){if(response.status===403||response.status===429)throw new Error('GitHub API rate limit reached. Try again later or use offline demo.');if(response.status===404)throw new Error('One of these GitHub usernames does not exist.');throw new Error(`GitHub API error (${response.status}).`);}
  const data=await response.json();try{sessionStorage.setItem(key,JSON.stringify({saved:Date.now(),data}));}catch{}return data;
}
async function fetchProfile(login){
  const clean=cleanLogin(login);if(!clean)throw new Error(`Invalid GitHub username: ${login}`);
  const u=encodeURIComponent(clean);
  const user=await readJSON(`https://api.github.com/users/${u}`);
  const repos=await readJSON(`https://api.github.com/users/${u}/repos?per_page=100&sort=updated`);
  return normalizeProfile(user,repos);
}
function modeText(isDemo){dataMode.textContent=isDemo?'OFFLINE DEMO DATA':'● LIVE GITHUB PROFILES';dataMode.style.color=isDemo?'#dcff75':'#57eac7';}
function begin(h,b,isDemo=false){current={hero:h,boss:b};lastResult=null;idle.hidden=true;loading.hidden=true;end.hidden=true;modeText(isDemo);game.start(h,b);const u=new URL(location.href);u.searchParams.set('hero',h.login);u.searchParams.set('boss',b.login);history.replaceState({},'',u.toString());$('arena').scrollIntoView({behavior:'smooth',block:'center'});}
async function launch(event){event?.preventDefault();const h=cleanLogin(heroInput.value),b=cleanLogin(bossInput.value);
  if(!validLogin(h)||!validLogin(b)){status.textContent='Use valid GitHub usernames (1–39 letters, digits or internal hyphens).';return;}
  if(h.toLowerCase()===b.toLowerCase()){status.textContent='Choose two different GitHub accounts to fight.';return;}
  const request=++activeRequest;start.disabled=true;$('start-label').textContent='LOADING...';idle.hidden=true;end.hidden=true;loading.hidden=false;
  try{const [hero,boss]=await Promise.all([fetchProfile(h),fetchProfile(b)]);if(request===activeRequest)begin(hero,boss,false);}
  catch(e){if(request!==activeRequest)return;loading.hidden=true;idle.hidden=false;modeText(true);status.textContent=`${e.message} You can still play the offline demo below.`;const demo=document.createElement('button');demo.type='button';demo.className='preset';demo.textContent='▶ PLAY OFFLINE DEMO';demo.addEventListener('click',()=>{demo.remove();begin({...BASE_DEMO.hero},{...BASE_DEMO.boss},true);});status.append(' ',demo);}
  finally{if(request===activeRequest){start.disabled=false;$('start-label').textContent='START BATTLE';}}
}
form.addEventListener('submit',launch);
$('intro-play').addEventListener('click',()=>form.requestSubmit());
for(const el of document.querySelectorAll('[data-boss]'))el.addEventListener('click',()=>{bossInput.value=el.dataset.boss;bossInput.focus();});
$('rematch-btn').addEventListener('click',()=>begin(current.hero,current.boss,current.hero.demo||current.boss.demo));
$('sound-toggle').addEventListener('click',()=>{mute=!mute;game.setSound(mute);$('sound-toggle').textContent=mute?'♫ SOUND ON':'♪ SOUND OFF';$('sound-toggle').setAttribute('aria-pressed',String(mute));});
const bindings={KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',Space:'block',KeyJ:'punch',KeyK:'heavy',KeyL:'special'};
document.addEventListener('keydown',e=>{
  if(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.metaKey||e.ctrlKey||e.altKey)return;
  const key=bindings[e.code];if(!key)return;e.preventDefault();
  if(['left','right','block'].includes(key))game.setKey(key,true);else if(!e.repeat)game.action(key);
});
document.addEventListener('keyup',e=>{const key=bindings[e.code];if(key)game.setKey(key,false);});
window.addEventListener('blur',()=>{for(const name of ['left','right','block'])game.setKey(name,false);});
for(const btn of document.querySelectorAll('[data-control]')){
  const action=btn.dataset.control;
  btn.addEventListener('pointerdown',e=>{e.preventDefault();try{btn.setPointerCapture(e.pointerId);}catch{}if(['left','right','block'].includes(action))game.setKey(action,true);else game.action(action);});
  for(const ev of ['pointerup','pointercancel','lostpointercapture'])btn.addEventListener(ev,()=>game.setKey(action,false));
}
function link(){return shareUrl(heroInput.value,bossInput.value,location.href);}
async function copy(){const url=link();try{await navigator.clipboard.writeText(url);status.textContent='Challenge link copied. Send it to your rival!';}catch{window.prompt('Copy your challenge link:',url);}}
$('copy-link').addEventListener('click',copy);
function card(){
  const c=document.createElement('canvas');c.width=1200;c.height=630;const ctx=c.getContext('2d');
  const g=ctx.createLinearGradient(0,0,1200,630);g.addColorStop(0,'#121c40');g.addColorStop(1,'#4d1d59');ctx.fillStyle=g;ctx.fillRect(0,0,1200,630);
  ctx.strokeStyle='#303960';ctx.lineWidth=1;for(let x=0;x<=1200;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,630);ctx.stroke();}for(let y=0;y<=630;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(1200,y);ctx.stroke();}
  ctx.fillStyle='#dcff75';ctx.font='bold 26px monospace';ctx.fillText('◆ GITHUB BOSS RUSH',68,75);
  ctx.fillStyle='#f9f8ff';ctx.font='bold 86px Impact, sans-serif';ctx.fillText(lastResult?.outcome==='win'?'BOSS DEFEATED!':lastResult?.outcome==='loss'?'BOSS SURVIVED!':'CHALLENGE ACCEPTED',64,187);
  ctx.font='bold 34px monospace';ctx.fillStyle='#53e5f6';ctx.fillText('@'+current.hero.login.slice(0,24),70,310);
  ctx.fillStyle='#dcff75';ctx.fillText('VS',70,370);
  ctx.fillStyle='#ff5b9e';ctx.fillText('@'+current.boss.login.slice(0,24),70,430);
  ctx.fillStyle='#c6b6ea';ctx.font='22px monospace';ctx.fillText(lastResult?`SCORE ${Math.max(0,lastResult.score)}   //   BEST COMBO ${lastResult.streak}`:'WHO WINS? ONLY ONE WAY TO FIND OUT.',70,510);
  ctx.fillStyle='#13182e';ctx.fillRect(0,565,1200,65);ctx.fillStyle='#dcff75';ctx.font='bold 19px monospace';ctx.fillText('PLAY FREE • OPEN SOURCE • GITHUB.COM/Berserk-hub150/GITHUB-BOSS-RUSH',46,605);
  const a=document.createElement('a');a.download=`boss-rush-${current.hero.login}-vs-${current.boss.login}.png`;a.href=c.toDataURL('image/png');a.click();status.textContent='Battle card downloaded. Share your rivalry!';
}
$('download-card').addEventListener('click',card);$('result-download').addEventListener('click',card);
const params=new URL(location.href).searchParams;
const h=cleanLogin(params.get('hero')),b=cleanLogin(params.get('boss'));
if(h)heroInput.value=h;if(b)bossInput.value=b;
status.textContent=h&&b?`Challenge loaded: @${h} vs @${b}. Press START BATTLE.`:'Ready for battle. Choose a rival and press START BATTLE.';
modeText(true);
// Prevent broken controls on iOS if the touch is cancelled.
document.addEventListener('visibilitychange',()=>{if(document.hidden)for(const key of ['left','right','block'])game.setKey(key,false);});
