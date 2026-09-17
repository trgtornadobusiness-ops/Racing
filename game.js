const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

let W = 1280, H = 720, running = false, finished = false;
let keys = {};
let last = 0, raceTime = 0, countdown = 4;
const TOTAL_LAPS = 10;
const AI_COUNT = 23;
const TRACK = {
  cx: 0, cy: 0, outerX: 560, outerY: 285, innerX: 270, innerY: 135
};
const cars = [];
const player = { id:0, player:true, lane:0, s:0, speed:0, lap:0, finished:false, color:"#ff334f" };

function resize() {
  W = canvas.width = innerWidth * devicePixelRatio;
  H = canvas.height = innerHeight * devicePixelRatio;
  ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
  W = innerWidth; H = innerHeight;
}
addEventListener("resize", resize); resize();

addEventListener("keydown", e => {
  keys[e.key.toLowerCase()] = true;
  if(["arrowup","arrowdown","arrowleft","arrowright"," "].includes(e.key.toLowerCase())) e.preventDefault();
});
addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);

function makeCars() {
  cars.length = 0;
  player.s = 0.04; player.lane = 0; player.speed = 0; player.lap = 0; player.finished = false;
  cars.push(player);
  const colors = ["#1e8fff","#ffd43b","#27d17f","#a970ff","#ff8a2b","#f1f1f1","#ff4f9a","#28d8d8"];
  for(let i=1;i<=AI_COUNT;i++) {
    cars.push({
      id:i, player:false, lane:(i%3)-1, s:-0.012*i, speed:0.72+Math.random()*0.12,
      base:0.76+Math.random()*0.13, lap:0, finished:false,
      color:colors[i%colors.length], phase:Math.random()*Math.PI*2
    });
  }
}

function trackPoint(s, lane) {
  const a = (s % 1) * Math.PI*2;
  // lane is -1 (low), 0 (middle), +1 (high)
  const tx = lane * 47, ty = lane * 25;
  const rx = 410 + tx, ry = 210 + ty;
  return {x:W/2 + Math.cos(a)*rx, y:H/2 + Math.sin(a)*ry};
}

function drawTrack() {
  ctx.clearRect(0,0,W,H);
  // sky / infield
  const g = ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,"#111822"); g.addColorStop(1,"#070a0d");
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);

  // track shadow
  ctx.save();
  ctx.translate(W/2,H/2);
  ctx.fillStyle="rgba(0,0,0,.45)";
  ctx.beginPath(); ctx.ellipse(0,8,TRACK.outerX+12,TRACK.outerY+12,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle="#24282d";
  ctx.beginPath(); ctx.ellipse(0,0,TRACK.outerX,TRACK.outerY,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle="#0b0f12";
  ctx.beginPath(); ctx.ellipse(0,0,TRACK.innerX,TRACK.innerY,0,0,Math.PI*2); ctx.fill();

  // apron / infield
  ctx.fillStyle="#193d27";
  ctx.beginPath(); ctx.ellipse(0,0,TRACK.innerX-12,TRACK.innerY-12,0,0,Math.PI*2); ctx.fill();

  // racing surface lane lines
  ctx.strokeStyle="rgba(255,255,255,.18)"; ctx.lineWidth=2;
  [315,362,409].forEach((r,i)=>{
    ctx.beginPath(); ctx.ellipse(0,0,r,r*.512,0,0,Math.PI*2); ctx.stroke();
  });

  // outside wall
  ctx.strokeStyle="#dfe3e8"; ctx.lineWidth=10;
  ctx.beginPath(); ctx.ellipse(0,0,TRACK.outerX,TRACK.outerY,0,0,Math.PI*2); ctx.stroke();
  ctx.strokeStyle="#e9344f"; ctx.lineWidth=4;
  ctx.beginPath(); ctx.ellipse(0,0,TRACK.outerX-6,TRACK.outerY-6,0,0,Math.PI*2); ctx.stroke();

  // inside curb
  ctx.strokeStyle="#fff"; ctx.lineWidth=8;
  ctx.beginPath(); ctx.ellipse(0,0,TRACK.innerX+5,TRACK.innerY+5,0,0,Math.PI*2); ctx.stroke();

  // start/finish
  ctx.save();
  ctx.rotate(0);
  for(let y=-45;y<45;y+=15) for(let x=-8;x<8;x+=8) {
    ctx.fillStyle=((y/15+x/8)%2===0)?"#fff":"#111";
    ctx.fillRect(x,y,8,15);
  }
  ctx.restore();

  // infield text
  ctx.fillStyle="rgba(255,255,255,.14)";
  ctx.font="900 34px Arial";
  ctx.textAlign="center";
  ctx.fillText("RACING K",0,10);
  ctx.restore();
}

function drawCar(c, scale=1) {
  const p = trackPoint(c.s,c.lane);
  const a = (c.s%1)*Math.PI*2 + Math.PI/2;
  ctx.save();
  ctx.translate(p.x,p.y);
  ctx.rotate(a);
  ctx.scale(scale,scale);
  ctx.shadowColor="rgba(0,0,0,.65)"; ctx.shadowBlur=8; ctx.shadowOffsetY=5;

  // wheels
  ctx.fillStyle="#08090a";
  [[-15,-12],[15,-12],[-15,12],[15,12]].forEach(([x,y])=>{
    ctx.fillRect(x-4,y-5,8,10);
  });

  // open wheel body
  ctx.fillStyle=c.color;
  ctx.beginPath();
  ctx.moveTo(0,-26); ctx.lineTo(6,-10); ctx.lineTo(20,-7); ctx.lineTo(25,0);
  ctx.lineTo(13,4); ctx.lineTo(8,20); ctx.lineTo(-8,20); ctx.lineTo(-13,4);
  ctx.lineTo(-25,0); ctx.lineTo(-20,-7); ctx.lineTo(-6,-10); ctx.closePath(); ctx.fill();

  ctx.fillStyle="#15181d";
  ctx.beginPath(); ctx.ellipse(0,-2,7,12,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle="#fff";
  ctx.fillRect(-25,-2,50,4);
  ctx.fillStyle="rgba(255,255,255,.75)";
  ctx.fillRect(-3,-23,6,10);
  ctx.restore();
}

function update(dt) {
  if(!running || finished) return;
  raceTime += dt;
  if(countdown > 0) {
    countdown -= dt;
    if(countdown <= 0) document.getElementById("message").textContent="GO!";
    return;
  }
  document.getElementById("message").textContent="OVAL GRAND PRIX";

  // player
  const accel = keys["w"]||keys["arrowup"];
  const brake = keys["s"]||keys["arrowdown"];
  const left = keys["a"]||keys["arrowleft"];
  const right = keys["d"]||keys["arrowright"];

  if(accel) player.speed += 0.65*dt;
  else player.speed -= 0.12*dt;
  if(brake) player.speed -= 0.85*dt;
  player.speed = Math.max(0,Math.min(1.02,player.speed));
  if(left) player.lane -= 0.85*dt;
  if(right) player.lane += 0.85*dt;
  player.lane = Math.max(-1,Math.min(1,player.lane));

  const oldS = player.s;
  player.s += player.speed * dt * 0.085;
  if(player.s >= 1) { player.s -= 1; player.lap++; }
  if(player.lap >= TOTAL_LAPS) finishRace();

  // AI
  for(const c of cars) if(!c.player) {
    const target = c.base + Math.sin(raceTime*0.7+c.phase)*0.035;
    c.speed += (target-c.speed)*dt*1.4;
    // small lane changes to create side-by-side traffic
    c.lane += Math.sin(raceTime*.35+c.phase)*dt*.025;
    c.lane = Math.max(-1,Math.min(1,c.lane));
    c.s += c.speed * dt * 0.085;
    if(c.s >= 1) { c.s -= 1; c.lap++; }
    if(c.lap >= TOTAL_LAPS) c.finished=true;
  }

  updateHUD();
}

function updateHUD() {
  const order = [...cars].sort((a,b)=>{
    const ap = a.lap + a.s, bp = b.lap + b.s;
    return bp-ap;
  });
  const pos = order.indexOf(player)+1;
  document.getElementById("pos").textContent=pos;
  document.getElementById("lap").textContent=`${Math.min(player.lap+1,TOTAL_LAPS)}/${TOTAL_LAPS}`;
  document.getElementById("speed").textContent=Math.round(player.speed*205);
  const ahead=order[pos-2];
  if(ahead) {
    const diff=(ahead.lap+ahead.s)-(player.lap+player.s);
    document.getElementById("gap").textContent=(diff*2.4).toFixed(2)+"s";
  } else document.getElementById("gap").textContent="—";
}

function finishRace() {
  finished=true;
  running=false;
  const order=[...cars].sort((a,b)=>(b.lap+b.s)-(a.lap+a.s));
  const pos=order.indexOf(player)+1;
  document.getElementById("result").innerHTML=`You finished <b>#${pos}</b> out of ${cars.length}<br><small>Race time: ${raceTime.toFixed(1)} seconds</small>`;
  document.getElementById("finish-screen").classList.remove("hidden");
}

function render() {
  drawTrack();
  // draw far-to-near based on simple y depth
  const sorted=[...cars].sort((a,b)=>trackPoint(a.s,a.lane).y-trackPoint(b.s,b.lane).y);
  for(const c of sorted) drawCar(c,c.player?1.12:.72);
  if(countdown>0 && running) {
    ctx.fillStyle="#fff"; ctx.font="900 100px Arial"; ctx.textAlign="center";
    ctx.fillText(countdown>3?"3":countdown>2?"2":countdown>1?"1":"GO!",W/2,H/2-70);
  }
}

function loop(t) {
  const dt=Math.min(.035,(t-last)/1000||0); last=t;
  update(dt); render(); requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

function startRace() {
  makeCars(); running=true; finished=false; raceTime=0; countdown=4;
  document.getElementById("start-screen").classList.add("hidden");
  document.getElementById("finish-screen").classList.add("hidden");
  document.getElementById("message").textContent="GET READY";
}
document.getElementById("start-btn").onclick=startRace;
document.getElementById("restart-btn").onclick=startRace;
makeCars();
