import { clamp, statsFor, timeLabel } from './core.mjs';
const W=960,H=540,GROUND=436;
const rand=(n)=>{let x=Math.sin(n*127.1+78.233)*43758.5453;return x-Math.floor(x)};
const rect=(ctx,x,y,w,h,color)=>{ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};

export class ArcadeGame {
  constructor(canvas,{onEnd=()=>{},onHit=()=>{},onStatus=()=>{}}={}) {
    this.canvas=canvas; this.ctx=canvas.getContext('2d',{alpha:false});
    this.onEnd=onEnd; this.onHit=onHit;this.onStatus=onStatus;
    this.phase='idle';this.elapsed=0;this.anim=0;this.last=0;
    this.keys=new Set();this.particles=[];this.floaters=[];this.shake=0;this.flash=0;
    this.hero=null;this.boss=null;this.streak=0;this.bestStreak=0;
    this.sound=false;this.audio=null;this.frameId=requestAnimationFrame(t=>this.frame(t));
  }
  setSound(enabled){this.sound=Boolean(enabled);}
  beep(freq=220,length=.09,type='square',volume=.035){
    if(!this.sound)return;
    try {this.audio ||=new (window.AudioContext||window.webkitAudioContext)();
      if(this.audio.state==='suspended')this.audio.resume();
      const o=this.audio.createOscillator(),g=this.audio.createGain(),now=this.audio.currentTime;
      o.type=type;o.frequency.setValueAtTime(freq,now);o.frequency.exponentialRampToValueAtTime(Math.max(40,freq*.58),now+length);
      g.gain.setValueAtTime(volume,now);g.gain.exponentialRampToValueAtTime(.001,now+length);
      o.connect(g);g.connect(this.audio.destination);o.start(now);o.stop(now+length);
    }catch{/* Audio is optional. */}
  }
  start(heroProfile,bossProfile){
    const hs=statsFor(heroProfile),bs=statsFor(bossProfile);
    this.hero={profile:heroProfile,stats:hs,x:245,hp:100,maxHp:100,energy:25,facing:1,speed:191+hs.speed*3,cooldown:0,hurt:0,attacking:0,move:0,blocking:false,knock:0};
    this.boss={profile:bossProfile,stats:bs,x:727,hp:100,maxHp:100,energy:0,facing:-1,speed:108+bs.speed*3,cooldown:1.1,hurt:0,attacking:0,move:0,blocking:false,knock:0};
    this.phase='fight';this.elapsed=0;this.streak=0;this.bestStreak=0;this.particles=[];this.floaters=[];this.flash=0;this.keys.clear();this.shake=0;
    this.beep(520,.14,'sawtooth');this.onStatus(`FIGHT! @${heroProfile.login} vs @${bossProfile.login}. Use A/D to move, J/K to attack, L for special, Space to block.`);
  }
  setKey(name,active){if(active)this.keys.add(name);else this.keys.delete(name);}
  action(action){
    if(this.phase!=='fight'||!this.hero)return;
    if(action==='punch')this.attack('hero','punch');
    if(action==='heavy')this.attack('hero','heavy');
    if(action==='special')this.attack('hero','special');
  }
  attack(who,kind){
    const a=this[who],b=this[who==='hero'?'boss':'hero'];
    if(!a||!b||a.cooldown>0||a.hurt>0||this.phase!=='fight')return false;
    if(kind==='special'&&a.energy<35){if(who==='hero')this.onStatus('Need at least 35% energy for SPECIAL. Land hits to charge it.');return false;}
    const cfg=kind==='punch'?{range:115,damage:9,cooldown:.29}:kind==='heavy'?{range:139,damage:16,cooldown:.68}:{range:255,damage:23,cooldown:1.05};
    a.cooldown=cfg.cooldown;a.attacking=kind==='punch'?.22:kind==='heavy'?.39:.7;
    a.attackKind=kind;a.facing=b.x>=a.x?1:-1;
    if(kind==='special')a.energy-=35;
    this.beep(kind==='special'?620:kind==='heavy'?155:285,kind==='special'?.29:.09,kind==='special'?'sawtooth':'square',.032);
    const delta=b.x-a.x;
    const hit=Math.abs(delta)<cfg.range && (Math.sign(delta)===a.facing||Math.abs(delta)<42);
    if(hit){
      const blocked=b.blocking;
      const spread=(a.stats.attack-b.stats.guard)*.35;
      const damage=Math.max(2,Math.round((cfg.damage+spread)*(blocked?.24:1)));
      b.hp=clamp(b.hp-damage,0,100);b.hurt=blocked?.08:.22;b.knock=a.facing*(blocked?5:kind==='special'?45:kind==='heavy'?25:13);
      a.energy=clamp(a.energy+(who==='hero'?(kind==='special'?2:12):5),0,100);
      this.shake=kind==='special'?15:kind==='heavy'?9:5;this.flash=kind==='special'?.17:.04;
      this.burst(b.x,GROUND-96,kind==='special'?27:kind==='heavy'?19:12,who==='hero'?'#53e6f6':'#ff5d9e');
      this.floaters.push({x:b.x,y:GROUND-162,text:`-${damage}`,life:.7,color:who==='hero'?'#dbff78':'#ff669a'});
      if(who==='hero') {this.streak++;this.bestStreak=Math.max(this.bestStreak,this.streak);this.onHit({damage,streak:this.streak,kind});} else {this.streak=0;}
      if(b.hp<=0)this.finish(who==='hero'?'win':'loss');
    } else if(who==='hero'){this.streak=0;}
    return hit;
  }
  burst(x,y,n,color){for(let i=0;i<n;i++){const a=rand(i*3+this.anim)*6.283,sp=70+rand(i*9+this.elapsed)*230;this.particles.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-60,life:.35+rand(i*.33)*.45,color,size:3+rand(i+9)*7});}}
  finish(outcome){if(this.phase!=='fight')return;this.phase=outcome;this.beep(outcome==='win'?680:130,.32,'sawtooth',.05);this.onEnd({outcome,hero:this.hero.profile,boss:this.boss.profile,score:Math.floor(this.hero.hp)*100+this.bestStreak*125+Math.ceil(90-this.elapsed)*20,streak:this.bestStreak,elapsed:Math.floor(this.elapsed)});}
  update(dt){
    this.anim+=dt;this.shake=Math.max(0,this.shake-dt*50);this.flash=Math.max(0,this.flash-dt);
    for(const p of this.particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=370*dt;p.life-=dt;}
    this.particles=this.particles.filter(p=>p.life>0);
    for(const p of this.floaters){p.y-=32*dt;p.life-=dt;}
    this.floaters=this.floaters.filter(p=>p.life>0);
    if(this.phase!=='fight')return;
    this.elapsed+=dt;
    if(this.elapsed>=90){this.finish(this.hero.hp>=this.boss.hp?'win':'loss');return;}
    for(const f of [this.hero,this.boss]){f.cooldown=Math.max(0,f.cooldown-dt);f.hurt=Math.max(0,f.hurt-dt);f.attacking=Math.max(0,f.attacking-dt);f.knock*=Math.max(0,1-dt*9);f.x=clamp(f.x+f.knock,55,905);f.move=0;}
    const h=this.hero,b=this.boss;
    h.blocking=this.keys.has('block');
    if(!h.blocking && h.hurt===0){const dir=(this.keys.has('right')?1:0)-(this.keys.has('left')?1:0);h.x=clamp(h.x+dir*h.speed*dt,65,890);h.move=dir;if(dir)h.facing=dir;}
    const dist=h.x-b.x;
    if(b.hurt<=0){
      if(Math.abs(dist)>94){b.move=Math.sign(dist);b.x=clamp(b.x+b.move*b.speed*dt,65,890);}else if(Math.abs(dist)<53){b.move=-Math.sign(dist);b.x=clamp(b.x+b.move*b.speed*.3*dt,65,890);}
      b.facing=h.x>=b.x?1:-1;
      b.blocking=Math.abs(dist)<135 && h.attacking>.05 && rand(Math.floor(this.anim*4)+12)>.68;
      if(b.cooldown<=0 && Math.abs(dist)<131)this.attack('boss',rand(Math.floor(this.anim*13))>.58?'heavy':'punch');
    }
    if(Math.abs(h.x-b.x)<52){const shift=(52-Math.abs(h.x-b.x))*.5;h.x-=Math.sign(b.x-h.x)*shift;b.x+=Math.sign(b.x-h.x)*shift;}
  }
  frame(now){const dt=Math.min(.05,(now-(this.last||now))/1000);this.last=now;this.update(dt);this.draw();this.frameId=requestAnimationFrame(t=>this.frame(t));}
  draw(){const c=this.ctx;c.save();if(this.shake)c.translate((rand(this.anim*170)-.5)*this.shake,(rand(this.anim*245)-.5)*this.shake);this.background(c);if(this.hero&&this.boss){this.character(c,this.hero,false);this.character(c,this.boss,true);this.hud(c);}else this.idleFighters(c);
    for(const p of this.particles)rect(c,p.x,p.y,p.size,p.size,p.color);
    for(const p of this.floaters){c.globalAlpha=Math.min(1,p.life*2);c.fillStyle=p.color;c.font='bold 24px monospace';c.textAlign='center';c.fillText(p.text,p.x,p.y);c.globalAlpha=1;}
    if(this.flash){c.fillStyle=`rgba(255,255,255,${this.flash*.95})`;c.fillRect(0,0,W,H);}c.restore();}
  background(c){
    const grad=c.createLinearGradient(0,0,0,H);grad.addColorStop(0,'#10163c');grad.addColorStop(.65,'#392150');grad.addColorStop(1,'#120f27');c.fillStyle=grad;c.fillRect(0,0,W,H);
    rect(c,0,0,W,3,'#825fe8');
    c.fillStyle='#fc6ba9';c.beginPath();c.arc(480,244,118,0,Math.PI*2);c.fill();
    c.fillStyle='#f69cbc';c.beginPath();c.arc(480,244,97,0,Math.PI*2);c.fill();
    for(let i=0;i<8;i++)rect(c,360,217+i*21,240,Math.min(3+i*1.4,13),'#44244f');
    for(let i=0;i<48;i++){const x=rand(i*8)*W,y=rand(i*8+43)*270;rect(c,x,y,2+(i%3),2+(i%2),i%4===0?'#f7dafa':'#8168bf');}
    for(let i=0;i<30;i++){let x=i*38-18,h=55+rand(i*7)*142;rect(c,x,GROUND-45-h,34,h,'#1b2445');for(let j=0;j<h/20;j++){if(rand(i*57+j*5)>.45)rect(c,x+7+(j%2)*13,GROUND-45-h+j*18+9,5,8,rand(i+j)>.5?'#a461ad':'#396b92');}}
    rect(c,0,GROUND-45,W,14,'#4d3766');rect(c,0,GROUND-31,W,8,'#b65ba5');rect(c,0,GROUND-23,W,130,'#11182e');
    for(let i=0;i<20;i++){let x=i*55+(Math.sin(this.anim*.2+i)*4);rect(c,x,GROUND-16,2,130,'#43345e');}
    for(let j=0;j<7;j++){let y=GROUND+j*j*3.1+8;rect(c,0,y,W,2,'#45305f');}
    rect(c,0,GROUND-23,W,5,'#f479b3');
    // Flickering arena holograms and wiring.
    c.strokeStyle='#65dfff55';c.lineWidth=2;c.strokeRect(25,290,116,86);c.strokeRect(820,290,116,86);
    c.textAlign='center';c.font='bold 13px monospace';c.fillStyle='#81e5e1';c.fillText('GIT://',83,324);c.fillText('FIGHT',83,346);c.fillStyle='#f984b7';c.fillText('OPEN',878,324);c.fillText('SOURCE',878,346);
    for(let i=0;i<6;i++)rect(c,150+i*110,GROUND-24+Math.sin(this.anim*3+i)*1.5,33,2,'#d45d9f');
  }
  idleFighters(c){let a={x:250,profile:{login:'YOU',featured:'OPEN SOURCE'},facing:1,move:0,hurt:0,attacking:0,blocking:false};let b={x:714,profile:{login:'THE BOSS',featured:'THE INTERNET'},facing:-1,move:0,hurt:0,attacking:0,blocking:false};this.character(c,a,false);this.character(c,b,true);}
  character(c,f,enemy){
    const bob=f.move?Math.abs(Math.sin(this.anim*13))*5:Math.sin(this.anim*3+(enemy?2:0))*3;
    const hurt=f.hurt>0&&Math.floor(this.anim*25)%2===0;
    const main=enemy?'#ed4b96':'#48c9ea',dark=enemy?'#97265e':'#176d9b',light=enemy?'#ffaece':'#b0ffff';
    const skin=enemy?'#ffc6bc':'#ffd6ae';
    const x=Math.round(f.x),y=Math.round(GROUND-bob);
    c.save();c.translate(x,y);c.scale(f.facing,1);if(hurt)c.globalAlpha=.57;
    // Shadow, boots, silhouette built in chunky pixel shapes.
    c.fillStyle='#080e2055';c.beginPath();c.ellipse(0,6,62,13,0,0,Math.PI*2);c.fill();
    rect(c,-27,-39,23,38,dark);rect(c,8,-39,23,38,dark);rect(c,-33,-9,34,12,'#0c132d');rect(c,7,-9,34,12,'#0c132d');
    // Back cape on rival.
    if(enemy){rect(c,-41,-130,24,97,'#88246a');rect(c,-50,-93,15,45,'#64245b');}
    rect(c,-35,-133,70,86,dark);rect(c,-27,-124,56,71,main);rect(c,-18,-99,36,10,light);
    rect(c,-26,-167,53,48,'#10152b');rect(c,-22,-167,45,40,skin);
    rect(c,-25,-176,54,19,enemy?'#4f1a52':'#2c4382');rect(c,17,-166,11,20,enemy?'#4f1a52':'#2c4382');
    if(enemy){rect(c,-20,-182,13,11,'#f0d361');rect(c,-5,-193,13,23,'#f0d361');rect(c,11,-182,13,11,'#f0d361');}
    rect(c,-13,-151,9,8,'#14182e');rect(c,11,-151,9,8,'#14182e');rect(c,-3,-137,18,4,enemy?'#a14c6f':'#aa725f');
    rect(c,-43,-121,17,59,main);rect(c,-45,-67,19,17,skin);
    const swing=f.attacking>0?(!enemy?20:29):0;
    if(f.attacking>0){rect(c,31,-122,48+swing,-19-swing,'#281f40');rect(c,40,-121,45+swing,19,main);rect(c,83+swing,-124,24,24,skin);if(f.attackKind==='special'){rect(c,111+swing,-149,60,55,'#6ef5fd');rect(c,130+swing,-135,85,26,'#fbf9c2');}}
    else{rect(c,29,-122,17,61,main);rect(c,28,-66,21,17,skin);}
    if(f.blocking){rect(c,23,-137,20,64,'#dcff75');rect(c,33,-138,5,62,'#fff');}
    if(enemy){rect(c,-9,-110,19,21,'#faf4b3');rect(c,-4,-106,9,13,'#d34a82');}else {rect(c,-10,-112,23,18,'#f5fff8');rect(c,-4,-107,12,8,'#305a8c');}
    c.restore();
    // Floating label above fighter.
    c.textAlign='center';c.font='bold 15px monospace';c.fillStyle=enemy?'#ff96be':'#baf8fd';c.shadowBlur=8;c.shadowColor=enemy?'#9a366d':'#25bcd5';c.fillText(String(f.profile.login).slice(0,20),x,y-207);c.shadowBlur=0;
  }
  hud(c){const h=this.hero,b=this.boss;
    rect(c,18,14,924,104,'#0c1027db');rect(c,18,14,924,2,'#627ba9');
    c.textAlign='left';c.fillStyle='#57e2ed';c.font='bold 14px monospace';c.fillText(`P1  @${h.profile.login.slice(0,16)}`,31,41);
    c.textAlign='right';c.fillStyle='#ff82b1';c.fillText(`@${b.profile.login.slice(0,16)}  P2`,928,41);
    rect(c,32,55,369,22,'#36364b');rect(c,32,55,369*h.hp/100,22,h.hp>33?'#54e5f6':'#ff616a');
    rect(c,559,55,369,22,'#36364b');rect(c,928-369*b.hp/100,55,369*b.hp/100,22,b.hp>33?'#ff5b9e':'#ff616a');
    rect(c,32,88,255,8,'#343d61');rect(c,32,88,255*h.energy/100,8,'#dcff75');
    rect(c,673,88,255,8,'#343d61');rect(c,928-255*b.energy/100,88,255*b.energy/100,8,'#df9e5d');
    c.textAlign='center';c.fillStyle='#f9f5e8';c.font='bold 42px monospace';c.fillText(timeLabel(90-this.elapsed),480,65);
    c.fillStyle='#c5b4e9';c.font='10px monospace';c.fillText('TIME',480,84);
    c.textAlign='left';c.fillStyle='#b1bbd2';c.font='10px monospace';c.fillText(`POWER ${h.stats.power}  |  ${h.profile.featured.slice(0,26)}`,32,113);
    c.textAlign='right';c.fillText(`${b.profile.featured.slice(0,26)}  |  POWER ${b.stats.power}`,928,113);
    if(this.streak>1){c.textAlign='left';c.fillStyle='#dcff75';c.font='bold 28px monospace';c.fillText(`${this.streak} HIT COMBO!`,38,191);}
    if(h.energy>=35){c.textAlign='left';c.fillStyle='#dcff75';c.font='bold 12px monospace';c.fillText('⚡ SPECIAL READY [L]',38,221);}
    if(this.elapsed<1.6){c.textAlign='center';c.globalAlpha=Math.min(1,(1.6-this.elapsed));c.fillStyle='#faffba';c.font='bold 75px Impact,sans-serif';c.fillText('FIGHT!',480,270);c.globalAlpha=1;}
  }
  destroy(){cancelAnimationFrame(this.frameId);this.audio?.close?.();}
}
