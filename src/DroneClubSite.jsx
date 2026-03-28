import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

/* ─── helpers ─────────────────────────────────────────────────────────── */
function easeIn(t)    { return t * t; }
function easeOut(t)   { return 1-(1-t)*(1-t); }
function easeInOut(t) { return t<.5?2*t*t:-1+(4-2*t)*t; }
function lerp(a,b,t)  { return a+(b-a)*t; }
function sub(t,t0,t1) { return Math.max(0,Math.min(1,(t-t0)/(t1-t0))); }

/* ─── data ─────────────────────────────────────────────────────────────── */
const CHALLENGES = [
  { id:"roll",      name:"360° Barrel Roll",   icon:"↻", diff:"Beginner",     dc:"#00e5ff", dur:"2 sec",  pts:100, animate:"roll",
    desc:"A full lateral rotation around the longitudinal axis. The entry point for freestyle pilots.",
    tips:["Enter level and controlled","Apply full aileron smoothly","Maintain throttle throughout","Return to level cleanly"] },
  { id:"flip",      name:"Backflip",            icon:"↑", diff:"Beginner",     dc:"#00e5ff", dur:"1.5 sec",pts:120, animate:"flip",
    desc:"A complete backward loop in the pitch axis. Clean entry and exit are everything.",
    tips:["Gain altitude first","Punch full rear pitch","Catch throttle at bottom","Stay smooth on exit"] },
  { id:"split_s",   name:"Split-S",             icon:"⤵", diff:"Intermediate", dc:"#a8ff3e", dur:"3 sec",  pts:200, animate:"splitS",
    desc:"Roll inverted then pull a half-loop to reverse direction. A staple racing manoeuvre.",
    tips:["Roll to inverted quickly","Pull through in a smooth arc","You lose altitude fast","Time it for the next gate"] },
  { id:"powerloop", name:"Power Loop",          icon:"⟳", diff:"Intermediate", dc:"#a8ff3e", dur:"2.5 sec",pts:250, animate:"powerLoop",
    desc:"Dive through a gap then vertical-loop back through from the other side.",
    tips:["Target the gap and dive","Pull up aggressively","Full throttle over the top","Re-enter on descent"] },
  { id:"matty",     name:"Matty Flip",          icon:"⤾", diff:"Advanced",     dc:"#ff6b35", dur:"3 sec",  pts:400, animate:"mattyFlip",
    desc:"Forward flip combined with 180° yaw simultaneously. A signature freestyle move.",
    tips:["Enter fast and level","Flip and yaw at the same time","Throttle management is critical","Practice each axis separately first"] },
  { id:"landing",   name:"Precision Landing",   icon:"⬇", diff:"Advanced",     dc:"#ff6b35", dur:"8 sec",  pts:450, animate:"landing",
    desc:"Fast approach, controlled deceleration, and precision touchdown on a 30cm pad.",
    tips:["Come in fast, brake late","Level attitude 2m above pad","Cut throttle cleanly","No bounce — motors off on contact"] },
  { id:"gatesprint",name:"Gate Sprint",         icon:"⛶", diff:"Racing",       dc:"#bf5fff", dur:"30 sec", pts:600, animate:"gateRun",
    desc:"Thread 5 gates at maximum speed. The drone flies into the scene through each one.",
    tips:["Cut the apex of every gate","Brake late, accelerate early","Smooth inputs beat corrections","Read 2 gates ahead"] },
  { id:"drag",      name:"Drag Race",           icon:"⇒", diff:"Racing",       dc:"#bf5fff", dur:"5 sec",  pts:300, animate:"dragRace",
    desc:"100-metre sprint from standing start — the drone rockets from the distance toward camera.",
    tips:["Pre-spin motors on arm","Launch at exact start signal","Keep pitch shallow for low drag","Brake before the line"] },
];

const COMPONENTS = {
  frame:    { label:"Carbon Fiber Frame",  icon:"⬡", color:"#00e5ff", specs:[{k:"Material",v:"T700 Carbon Fiber"},{k:"Weight",v:"142g"},{k:"Diagonal",v:"220mm"},{k:"Thickness",v:"3mm arms"}],    desc:"Aerospace-grade carbon fiber X-frame. Rigid, light, built to survive crashes at 120 km/h." },
  motor_fl: { label:"Motor – Front Left",  icon:"⚙", color:"#ff6b35", specs:[{k:"Model",v:"2306 2450KV"},{k:"Max Thrust",v:"1,100g"},{k:"Current",v:"35A peak"},{k:"Rotation",v:"CCW"}],             desc:"Brushless outrunner with N52 neodymium magnets. CCW rotation to balance torque across the airframe." },
  motor_fr: { label:"Motor – Front Right", icon:"⚙", color:"#ff6b35", specs:[{k:"Model",v:"2306 2450KV"},{k:"Max Thrust",v:"1,100g"},{k:"Current",v:"35A peak"},{k:"Rotation",v:"CW"}],              desc:"CW motor paired diagonally with rear-left. Counter-rotation cancels yaw torque for stable hover." },
  motor_bl: { label:"Motor – Back Left",   icon:"⚙", color:"#ff6b35", specs:[{k:"Model",v:"2306 2450KV"},{k:"Max Thrust",v:"1,100g"},{k:"Current",v:"35A peak"},{k:"Rotation",v:"CW"}],              desc:"Rear-left CW motor. Operates at slightly higher RPM during forward flight to maintain pitch trim." },
  motor_br: { label:"Motor – Back Right",  icon:"⚙", color:"#ff6b35", specs:[{k:"Model",v:"2306 2450KV"},{k:"Max Thrust",v:"1,100g"},{k:"Current",v:"35A peak"},{k:"Rotation",v:"CCW"}],             desc:"CCW rear motor completes the torque-balancing layout. All four share identical stators for easy maintenance." },
  prop_fl:  { label:"Prop – Front Left",   icon:"✦", color:"#a8ff3e", specs:[{k:"Size",v:'5"×4.3"'},{k:"Material",v:"Polycarbonate"},{k:"Pitch",v:"4.3 inches"},{k:"Blades",v:"3-blade"}],           desc:"Tri-blade PC propeller optimised for mid-range efficiency. Aggressive pitch for punchy acceleration." },
  prop_fr:  { label:"Prop – Front Right",  icon:"✦", color:"#a8ff3e", specs:[{k:"Size",v:'5"×4.3"'},{k:"Material",v:"Polycarbonate"},{k:"Pitch",v:"4.3 inches"},{k:"Blades",v:"3-blade"}],           desc:"CW prop matched to its motor. Swept-back tips reduce tip vortex losses by ~8% vs flat-tipped designs." },
  prop_bl:  { label:"Prop – Back Left",    icon:"✦", color:"#a8ff3e", specs:[{k:"Size",v:'5"×4.3"'},{k:"Material",v:"Polycarbonate"},{k:"Pitch",v:"4.3 inches"},{k:"Blades",v:"3-blade"}],           desc:"Rear props operate in wake of front props during forward flight. Profile tuned for turbulent inflow." },
  prop_br:  { label:"Prop – Back Right",   icon:"✦", color:"#a8ff3e", specs:[{k:"Size",v:'5"×4.3"'},{k:"Material",v:"Polycarbonate"},{k:"Pitch",v:"4.3 inches"},{k:"Blades",v:"3-blade"}],           desc:"All four props balanced to ±0.01g to minimise vibration reaching the FC IMU." },
  fc:       { label:"Flight Controller",   icon:"◈", color:"#bf5fff", specs:[{k:"Processor",v:"STM32H743"},{k:"Gyro",v:"ICM-42688-P"},{k:"Firmware",v:"Betaflight 4.4"},{k:"Loop Rate",v:"8 kHz"}],  desc:"The brain. Runs an 8 kHz PID loop processing gyro data 8,000 times per second." },
  esc:      { label:"4-in-1 ESC Stack",    icon:"▦", color:"#ffcc00", specs:[{k:"Rating",v:"45A continuous"},{k:"Protocol",v:"DSHOT 600"},{k:"BEC",v:"5V/3A"},{k:"Firmware",v:"BLHeli_32"}],         desc:"Four ESCs on a single PCB. DSHOT digital protocol eliminates timing jitter of analogue PWM." },
  battery:  { label:"LiPo Battery",        icon:"▬", color:"#ff3e3e", specs:[{k:"Config",v:"6S 1300mAh"},{k:"Voltage",v:"22.2V nominal"},{k:"Discharge",v:"120C burst"},{k:"Weight",v:"195g"}],      desc:"6S raises bus voltage to cut current draw and heat. Always store at 3.8V/cell when not in use." },
  camera:   { label:"FPV Camera",          icon:"◉", color:"#00e5ff", specs:[{k:"Sensor",v:'1/3" STARVIS 2'},{k:"Resolution",v:"1200TVL"},{k:"FOV",v:"165° wide"},{k:"Latency",v:"< 1ms"}],         desc:"Sony STARVIS 2 with ultra-low latency. Wide FOV gives full situational awareness at speed." },
  vtx:      { label:"Video Transmitter",   icon:"▲", color:"#ff6b35", specs:[{k:"Protocol",v:"DJI O3/Analog"},{k:"Power",v:"0–1000mW"},{k:"Frequency",v:"5.8 GHz"},{k:"Range",v:"Up to 10km"}],     desc:"Dual-mode VTX for analogue and digital HD. Adjustable power to 1W. Built-in pit mode." },
  rx:       { label:"RC Receiver",         icon:"◆", color:"#a8ff3e", specs:[{k:"Protocol",v:"ELRS 2.4GHz"},{k:"Latency",v:"< 4ms"},{k:"Range",v:"> 30km LOS"},{k:"Antenna",v:"Diversity 2×"}],    desc:"ExpressLRS: class-leading latency and link budget. Dual-antenna diversity for robust signal." },
};

const MEMBERS = [
  { name:"Alex Chen",    role:"Club President",     level:"Expert",       flights:1240, spec:"Freestyle",   avatar:"AC", color:"#00e5ff" },
  { name:"Priya Sharma", role:"Safety Officer",     level:"Advanced",     flights:890,  spec:"Long Range",  avatar:"PS", color:"#a8ff3e" },
  { name:"Jordan Lee",   role:"Tech Lead",          level:"Expert",       flights:2100, spec:"Racing",      avatar:"JL", color:"#ff6b35" },
  { name:"Sam Rivera",   role:"Event Coordinator",  level:"Intermediate", flights:340,  spec:"Cinematics",  avatar:"SR", color:"#bf5fff" },
  { name:"Mia Kowalski", role:"Training Lead",      level:"Advanced",     flights:670,  spec:"Freestyle",   avatar:"MK", color:"#ffcc00" },
  { name:"Rahul Gupta",  role:"Member",             level:"Beginner",     flights:45,   spec:"Racing",      avatar:"RG", color:"#00e5ff" },
  { name:"Chloe Martin", role:"Member",             level:"Intermediate", flights:210,  spec:"Cinematics",  avatar:"CM", color:"#a8ff3e" },
  { name:"Tom Fischer",  role:"Member",             level:"Advanced",     flights:520,  spec:"Freestyle",   avatar:"TF", color:"#ff6b35" },
];

/* ─── maneuver keyframes (t: 0→1 once) ──────────────────────────────── */
const MANEUVERS = {
  idle: (t) => ({
    pos:{x:0, y:Math.sin(t*Math.PI*2)*0.06, z:0},
    rot:{x:-0.05, y:t*0.3, z:Math.sin(t*Math.PI*2)*0.02},
  }),
  roll: (t) => ({
    pos:{x:0, y:0, z:lerp(2.5,-6,easeInOut(t))},
    rot:{x:-0.18, y:0, z:t>0.2&&t<0.8 ? sub(t,0.2,0.8)*Math.PI*2 : 0},
  }),
  flip: (t) => {
    const ft=sub(t,0.3,0.7);
    return { pos:{x:0, y:Math.sin(ft*Math.PI)*0.7, z:lerp(2.5,-6,easeInOut(t))},
             rot:{x:ft*Math.PI*2, y:0, z:0} };
  },
  splitS: (t) => ({
    pos:{x:0, y:t>0.4 ? -Math.sin(sub(t,0.4,0.8)*Math.PI)*0.6 : 0, z:lerp(2.5,-5,easeInOut(t))},
    rot:{x:-sub(t,0.4,0.8)*Math.PI, y:0, z:sub(t,0.1,0.4)*Math.PI},
  }),
  powerLoop: (t) => {
    const lt=sub(t,0.15,0.75);
    return { pos:{x:0, y:Math.sin(lt*Math.PI*2)*0.9, z:lerp(2.5,-5,easeInOut(t))+Math.cos(lt*Math.PI*2)*0.4},
             rot:{x:lt*Math.PI*2, y:0, z:0} };
  },
  mattyFlip: (t) => {
    const ft=sub(t,0.25,0.65);
    return { pos:{x:0, y:Math.sin(ft*Math.PI)*0.5, z:lerp(2.5,-6,easeInOut(t))},
             rot:{x:ft*Math.PI*2, y:ft*Math.PI, z:0} };
  },
  landing: (t) => {
    // Drone starts close (z=1.5), flies away fast, slows, descends onto pad at z=-2
    const z = t<0.5 ? lerp(1.5,-7,easeIn(sub(t,0,0.5))) : lerp(-7,-2,easeOut(sub(t,0.5,0.85)));
    const y = t<0.5 ? 0.1 : t<0.85 ? lerp(0.1,-0.65,easeIn(sub(t,0.5,0.85))) : lerp(-0.65,-0.72,sub(t,0.85,1));
    const pitch = t<0.5 ? lerp(-0.18,-0.45,easeIn(sub(t,0,0.3))) : lerp(-0.45,0,sub(t,0.5,0.75));
    return { pos:{x:0,y,z}, rot:{x:pitch, y:0, z:0} };
  },
  gateRun: (t) => {
    const GZ=[1.5,-0.5,-2.5,-4.5,-6.5,-8.5];
    const GX=[0, 0.35,-0.3, 0.45,-0.2, 0];
    const GY=[0, 0.2,-0.1, 0.15, 0,   0];
    const progress=t*5; const gi=Math.min(Math.floor(progress),4); const gt=easeInOut(progress-gi);
    const xd=(GX[gi+1]||0)-GX[gi];
    return { pos:{x:lerp(GX[gi],GX[gi+1]||0,gt), y:lerp(GY[gi],GY[gi+1]||0,gt), z:lerp(GZ[gi],GZ[gi+1]||-8.5,gt)},
             rot:{x:-0.2, y:0, z:Math.atan2(xd,2)*1.1*easeInOut(Math.min(gt*2,1))} };
  },
  dragRace: (t) => ({
    pos:{x:0, y:t>0.85?lerp(0,0.15,easeOut(sub(t,0.85,1))):0, z:t<0.8?lerp(1.8,-11,easeIn(sub(t,0,0.8))):lerp(-11,-10.5,easeOut(sub(t,0.8,1)))},
    rot:{x:t<0.06?lerp(-0.18,-0.52,t/0.06):t<0.8?-0.52:lerp(-0.52,-0.1,easeOut(sub(t,0.8,1))), y:0, z:0},
  }),
};

/* ─── build gate ─────────────────────────────────────────────────────── */
function buildGate(scene, x, y, z, color=0x00e5ff) {
  const g=new THREE.Group();
  const w=1.0, h=0.85, r=0.028;
  const m=()=>new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:0.9,roughness:0.1,metalness:0.4});
  [[w,r,r,0,h/2,0],[w,r,r,0,-h/2,0],[r,h+r*2,r,-w/2,0,0],[r,h+r*2,r,w/2,0,0]].forEach(([bw,bh,bd,bx,by,bz])=>{
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(bw,bh,bd),m()); mesh.position.set(bx,by,bz); g.add(mesh);
  });
  [[w/2,h/2],[-w/2,h/2],[w/2,-h/2],[-w/2,-h/2]].forEach(([cx,cy])=>{
    const bolt=new THREE.Mesh(new THREE.SphereGeometry(0.04,8,8),m()); bolt.position.set(cx,cy,0); g.add(bolt);
  });
  const halo=new THREE.Mesh(new THREE.PlaneGeometry(w*0.92,h*0.92),new THREE.MeshBasicMaterial({color,transparent:true,opacity:0.07,side:THREE.DoubleSide}));
  g.add(halo);
  g.position.set(x,y,z); scene.add(g); return g;
}

/* ─── build drone geometry ───────────────────────────────────────────── */
function buildDrone(scene, clickables) {
  const matC  = new THREE.MeshStandardMaterial({color:0x1a1a1a,roughness:0.3,metalness:0.6});
  const matA  = new THREE.MeshStandardMaterial({color:0x888888,roughness:0.2,metalness:0.9});
  const matAcc= new THREE.MeshStandardMaterial({color:0x444444,roughness:0.3,metalness:0.8});
  const matP  = new THREE.MeshStandardMaterial({color:0x111111,roughness:0.4,metalness:0.3,transparent:true,opacity:0.92});
  const matB  = new THREE.MeshStandardMaterial({color:0x222266,roughness:0.5,metalness:0.2});
  const matG  = new THREE.MeshStandardMaterial({color:0xffcc00,roughness:0.3,metalness:0.8});
  const matPu = new THREE.MeshStandardMaterial({color:0x7722cc,roughness:0.3,metalness:0.5});

  const drone = new THREE.Group();
  const add   = (mesh, key) => { if(key){ mesh.userData.componentKey=key; if(clickables) clickables.push(mesh); } drone.add(mesh); return mesh; };

  // Body
  const body=new THREE.Mesh(new THREE.BoxGeometry(0.32,0.06,0.28),matC); body.castShadow=true; add(body,"frame");
  const top=new THREE.Mesh(new THREE.BoxGeometry(0.28,0.012,0.24),matC); top.position.y=0.036; add(top,"frame");


  // Arms
  // Arms — one cylinder per arm, centered halfway between body and motor tip
  const armData=[
    {mx:0.72, mz: 0.52},
    {mx:-0.72,mz: 0.52},
    {mx:0.72, mz:-0.52},
    {mx:-0.72,mz:-0.52},
  ];
  armData.forEach(({mx,mz})=>{
    const armLen=Math.sqrt(mx*mx+mz*mz); // exact distance from center to motor
    const angle=Math.atan2(mx,mz);        // yaw angle toward motor
    const ag=new THREE.CylinderGeometry(0.026,0.032,armLen,8);
    ag.rotateX(Math.PI/2);               // cylinder now points along Z
    const arm=new THREE.Mesh(ag,matC);
    arm.position.set(mx/2,0,mz/2);       // center = midpoint between body and motor
    arm.rotation.y=angle;                // rotate to point at motor
    add(arm,"frame");
  });

  // Motors + Props
  const motorPos=[[0.72,0.04,0.52],[-0.72,0.04,0.52],[0.72,0.04,-0.52],[-0.72,0.04,-0.52]];
  const propKeys=["prop_fl","prop_fr","prop_bl","prop_br"];
  const motorKeys=["motor_fl","motor_fr","motor_bl","motor_br"];
  const propGroups=[];

  motorPos.forEach((pos,i)=>{
    const mg=new THREE.Group(); mg.position.set(...pos);
    const base=new THREE.Mesh(new THREE.CylinderGeometry(0.065,0.07,0.06,16),matA); base.castShadow=true; base.userData.componentKey=motorKeys[i]; if(clickables) clickables.push(base); mg.add(base);
    const bell=new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.055,0.072,16),matA); bell.position.y=0.065; bell.userData.componentKey=motorKeys[i]; if(clickables) clickables.push(bell); mg.add(bell);
    const shaft=new THREE.Mesh(new THREE.CylinderGeometry(0.009,0.009,0.09,8),matG); shaft.position.y=0.11; mg.add(shaft);
    for(let w=0;w<9;w++){
      const coil=new THREE.Mesh(new THREE.BoxGeometry(0.012,0.05,0.022),new THREE.MeshStandardMaterial({color:0xcc4400,roughness:0.8}));
      coil.position.y=0.01; coil.rotation.y=(w/9)*Math.PI*2; coil.position.x=Math.sin((w/9)*Math.PI*2)*0.048; coil.position.z=Math.cos((w/9)*Math.PI*2)*0.048; mg.add(coil);
    }
    drone.add(mg);

    const pg=new THREE.Group(); pg.position.set(pos[0],pos[1]+0.14,pos[2]);
    for(let b=0;b<3;b++){
      const blade=new THREE.Mesh(new THREE.BoxGeometry(0.52,0.008,0.055),matP.clone());
      blade.rotation.y=(b/3)*Math.PI*2; blade.rotation.z=0.12; blade.userData.componentKey=propKeys[i]; if(clickables) clickables.push(blade); pg.add(blade);
    }
    pg.add(new THREE.Mesh(new THREE.CylinderGeometry(0.022,0.022,0.018,12),matA));
    const blur=new THREE.Mesh(new THREE.CylinderGeometry(0.27,0.27,0.003,40),new THREE.MeshStandardMaterial({color:0x333344,transparent:true,opacity:0,side:THREE.DoubleSide}));
    blur.userData.isBlurDisc=true; pg.add(blur);
    pg.userData.dir=i===0||i===3?-1:1; propGroups.push(pg); drone.add(pg);
  });
  drone.userData.propGroups=propGroups;

  // FC + ESC
  const fc=new THREE.Mesh(new THREE.BoxGeometry(0.14,0.012,0.14),matPu); fc.position.set(0,0.048,0); add(fc,"fc");
  const esc=new THREE.Mesh(new THREE.BoxGeometry(0.14,0.01,0.14),matG); esc.position.set(0,0.024,0); add(esc,"esc");
  for(const[x,z] of[[-0.03,-0.03],[0.03,-0.03],[-0.03,0.03],[0.03,0.03]]){
    const chip=new THREE.Mesh(new THREE.BoxGeometry(0.025,0.006,0.025),new THREE.MeshStandardMaterial({color:0x111111})); chip.position.set(x,0.055,z); add(chip,"fc");
  }

  // Battery
  const bat=new THREE.Mesh(new THREE.BoxGeometry(0.34,0.05,0.16),matB); bat.position.set(0,-0.055,0); add(bat,"battery");
  for(const z of[-0.05,0.05]){ const strap=new THREE.Mesh(new THREE.BoxGeometry(0.36,0.008,0.012),new THREE.MeshStandardMaterial({color:0xcc0000,roughness:0.9})); strap.position.set(0,-0.028,z); add(strap,"battery"); }
  const lbl=new THREE.Mesh(new THREE.BoxGeometry(0.2,0.002,0.06),new THREE.MeshStandardMaterial({color:0x333366,roughness:0.5})); lbl.position.set(0,-0.029,0); add(lbl,"battery");

  // Camera
  const cmount=new THREE.Mesh(new THREE.BoxGeometry(0.045,0.07,0.012),matC); cmount.position.set(0,0.01,0.146); add(cmount,"camera");
  const cbody=new THREE.Mesh(new THREE.BoxGeometry(0.04,0.04,0.05),matA); cbody.position.set(0,0.012,0.162); add(cbody,"camera");
  const lens=new THREE.Mesh(new THREE.CylinderGeometry(0.016,0.018,0.028,16),new THREE.MeshStandardMaterial({color:0x001133,roughness:0,metalness:1})); lens.rotation.x=Math.PI/2; lens.position.set(0,0.012,0.188); add(lens,"camera");

  // VTX + RX
  const vtxBase=new THREE.Mesh(new THREE.BoxGeometry(0.035,0.015,0.035),matAcc.clone()); vtxBase.position.set(0.1,0.052,-0.08); add(vtxBase,"vtx");
  const ant=new THREE.Mesh(new THREE.CylinderGeometry(0.004,0.004,0.14,6),new THREE.MeshStandardMaterial({color:0x333333})); ant.position.set(0.1,0.125,-0.08); add(ant,"vtx");
  const antEnd=new THREE.Mesh(new THREE.CylinderGeometry(0.009,0.009,0.03,8),new THREE.MeshStandardMaterial({color:0xcc2222})); antEnd.position.set(0.1,0.21,-0.08); add(antEnd,"vtx");
  const rxm=new THREE.Mesh(new THREE.BoxGeometry(0.045,0.008,0.028),new THREE.MeshStandardMaterial({color:0x113300,roughness:0.4,metalness:0.3})); rxm.position.set(-0.06,-0.025,-0.1); add(rxm,"rx");
  for(const s of[-1,1]){ const wire=new THREE.Mesh(new THREE.CylinderGeometry(0.002,0.002,0.12,4),new THREE.MeshStandardMaterial({color:0xffff00})); wire.position.set(-0.06+s*0.025,-0.025,-0.165); wire.rotation.x=Math.PI/6; add(wire,"rx"); }

  // Landing legs
  [[0.12,-0.085,0.1],[-0.12,-0.085,0.1],[0.12,-0.085,-0.1],[-0.12,-0.085,-0.1]].forEach(([x,y,z])=>{ const leg=new THREE.Mesh(new THREE.CylinderGeometry(0.007,0.007,0.06,6),matC); leg.position.set(x,y,z); add(leg,"frame"); });

  drone.rotation.x=-0.2;
  scene.add(drone);
  return drone;
}

/* ─── spin props helper ──────────────────────────────────────────────── */
function spinProps(drone, propSpeed) {
  const blurR = propSpeed/0.55;
  (drone.userData.propGroups||[]).forEach(pg=>{
    pg.rotation.y += propSpeed*pg.userData.dir;
    pg.children.forEach(c=>{
      if(c.userData?.isBlurDisc){ c.material.opacity=blurR*0.45; c.visible=blurR>0.15; }
      else if(c.isMesh&&c.material?.transparent) c.material.opacity=Math.max(0.08,0.92-blurR*0.84);
    });
  });
}

/* ─── lights helper ──────────────────────────────────────────────────── */
function addLights(scene) {
  scene.add(new THREE.AmbientLight(0xffffff, 1.4));
  const k=new THREE.DirectionalLight(0xffffff,2.8); k.position.set(3,6,4); k.castShadow=true; scene.add(k);
  const f=new THREE.DirectionalLight(0xffffff,0.3); f.position.set(-4,2,-3); scene.add(f);
  const r=new THREE.DirectionalLight(0xffffff,0.5); r.position.set(0,-2,-5); scene.add(r);
}

/* ═══════════════════════════════════════════════════════════════════════
   COMPONENTS PAGE (interactive 3D drone with click-to-inspect)
═══════════════════════════════════════════════════════════════════════ */
function ComponentsPage() {
  const mountRef  = useRef(null);
  const camRef    = useRef(null);
  const clickRef  = useRef([]);
  const rotRef    = useRef({y:0.4,x:-0.2});
  const dragRef   = useRef({down:false,lx:0,ly:0,pdx:0,pdy:0});
  const rafRef    = useRef(null);
  const [sel, setSel]  = useState(null);
  const [hov, setHov]  = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  const zoomRef = useRef(3.2); // camera distance

  useEffect(()=>{
    const el=mountRef.current; if(!el) return;
    const W=el.clientWidth, H=el.clientHeight;
    const scene=new THREE.Scene(); scene.background=new THREE.Color(0x252540); 
    const camera=new THREE.PerspectiveCamera(45,W/H,0.1,100); camera.position.set(0,1.2,3.2); camera.lookAt(0,0,0); camRef.current=camera;
    const renderer=new THREE.WebGLRenderer({canvas:el,antialias:true}); renderer.setSize(W,H); renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.6; renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    addLights(scene);
    
    const clickables=[]; clickRef.current=clickables;
    const drone=buildDrone(scene,clickables);
    let propSpeed=0, t=0;
    const animate=()=>{ rafRef.current=requestAnimationFrame(animate); t+=0.01; propSpeed=Math.min(propSpeed+0.008,0.55);
      if(!dragRef.current.down){ rotRef.current.y+=0.004; } else { rotRef.current.y+=dragRef.current.pdx; rotRef.current.x+=dragRef.current.pdy; dragRef.current.pdx*=0.85; dragRef.current.pdy*=0.85; }
      // Apply zoom — move camera closer/further along its axis
      const z=zoomRef.current;
      camera.position.set(0,z*0.375,z); camera.lookAt(0,0,0);
      drone.rotation.y=rotRef.current.y; drone.rotation.x=rotRef.current.x+Math.sin(t*0.5)*0.012; drone.position.y=Math.sin(t*0.7)*0.04;
      spinProps(drone,propSpeed); renderer.render(scene,camera); };
    animate();
    const onR=()=>{ const nw=el.clientWidth,nh=el.clientHeight; camera.aspect=nw/nh; camera.updateProjectionMatrix(); renderer.setSize(nw,nh); };
    window.addEventListener("resize",onR);
    return()=>{ cancelAnimationFrame(rafRef.current); window.removeEventListener("resize",onR); renderer.dispose(); };
  },[]);

  const getHit=(clientX,clientY)=>{
    const el=mountRef.current; if(!el||!camRef.current) return null;
    const rect=el.getBoundingClientRect();
    const ray=new THREE.Raycaster();
    ray.setFromCamera({x:((clientX-rect.left)/rect.width)*2-1,y:-((clientY-rect.top)/rect.height)*2+1},camRef.current);
    const hits=ray.intersectObjects(clickRef.current);
    return hits.length?hits[0].object.userData.componentKey:null;
  };

  const getXY=(e)=>{
    if(e.changedTouches&&e.changedTouches.length>0) return{x:e.changedTouches[0].clientX,y:e.changedTouches[0].clientY};
    if(e.touches&&e.touches.length>0) return{x:e.touches[0].clientX,y:e.touches[0].clientY};
    return{x:e.clientX,y:e.clientY};
  };

  const pinchRef = useRef(null); // stores initial pinch distance
  const pointerDownPos=useRef({x:0,y:0});

  const onDown=(e)=>{
    const{x,y}=getXY(e);
    dragRef.current={down:true,lx:x,ly:y,pdx:0,pdy:0};
    pointerDownPos.current={x,y};
    pinchRef.current=null;
  };

  const onMove=(e)=>{
    // Pinch zoom — two fingers
    if(e.touches&&e.touches.length===2){
      dragRef.current.down=false;
      const dx=e.touches[0].clientX-e.touches[1].clientX;
      const dy=e.touches[0].clientY-e.touches[1].clientY;
      const dist=Math.sqrt(dx*dx+dy*dy);
      if(pinchRef.current!==null){
        const delta=(pinchRef.current-dist)*0.012;
        zoomRef.current=Math.max(1.2,Math.min(7,zoomRef.current+delta));
      }
      pinchRef.current=dist;
      return;
    }
    pinchRef.current=null;
    const{x,y}=getXY(e);
    const d=dragRef.current;
    if(!d.down){const k=getHit(x,y);setHov(k||null);return;}
    d.pdx=(x-d.lx)*0.01; d.pdy=(y-d.ly)*0.01;
    rotRef.current.y+=d.pdx; rotRef.current.x+=d.pdy;
    d.lx=x; d.ly=y;
  };

  const onUp=(e)=>{
    const{x,y}=getXY(e);
    const d=dragRef.current;
    const moved=Math.abs(x-pointerDownPos.current.x)>8||Math.abs(y-pointerDownPos.current.y)>8;
    d.down=false;
    if(!moved){const k=getHit(x,y); if(k) setSel(p=>p===k?null:k); else setSel(null);}
  };

  // Mouse wheel zoom
  const onWheel=(e)=>{
    e.preventDefault();
    zoomRef.current=Math.max(1.2,Math.min(7,zoomRef.current+e.deltaY*0.005));
  };

  const comp=sel?COMPONENTS[sel]:null;
  const hovComp=hov&&!sel?COMPONENTS[hov]:null;

  const Panel=({comp,onClose})=>(
    <div style={{padding:isMobile?"16px 16px 28px":"68px 22px 22px",overflowY:"auto",flex:1,WebkitOverflowScrolling:"touch"}}>
      {!isMobile&&<button onClick={onClose} style={{position:"absolute",top:16,right:16,background:"none",border:`1px solid ${comp.color}66`,borderRadius:4,color:comp.color,width:28,height:28,cursor:"pointer",fontSize:14}}>×</button>}
      <div style={{fontSize:isMobile?26:34,color:comp.color,marginBottom:6,filter:`drop-shadow(0 0 10px ${comp.color}88)`}}>{comp.icon}</div>
      <div style={{fontSize:8,letterSpacing:4,color:comp.color,textTransform:"uppercase",marginBottom:4,opacity:0.7}}>Component</div>
      <div style={{fontSize:isMobile?14:17,fontWeight:700,color:"#fff",marginBottom:14,lineHeight:1.3}}>{comp.label}</div>
      <div style={{height:1,background:`linear-gradient(90deg,${comp.color}66,transparent)`,marginBottom:14}}/>
      <p style={{color:"#667788",fontSize:12,lineHeight:1.7,marginBottom:18}}>{comp.desc}</p>
      <div style={{fontSize:8,letterSpacing:4,color:comp.color,textTransform:"uppercase",marginBottom:10,opacity:0.7}}>Specifications</div>
      {comp.specs.map(s=>(
        <div key={s.k} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
          <span style={{color:"#667788",fontSize:10,letterSpacing:1}}>{s.k.toUpperCase()}</span>
          <span style={{color:"#fff",fontSize:12,fontWeight:600}}>{s.v}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{width:"100%",height:"100vh",background:"#252540",fontFamily:"'Courier New',monospace",overflow:"hidden",position:"relative",touchAction:"none"}}>
      {/* Header */}
      <div style={{position:"absolute",top:0,left:0,right:0,zIndex:10,padding:isMobile?"10px 14px":"16px 26px",background:"rgba(37,37,64,0.97)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div>
          <div style={{fontSize:isMobile?8:10,letterSpacing:4,color:"#00e5ff",textTransform:"uppercase",marginBottom:2}}>Interactive · Click any part</div>
          <div style={{fontSize:isMobile?15:20,fontWeight:700,color:"#fff",letterSpacing:2}}>FPV RACING DRONE</div>
        </div>
        <div style={{textAlign:"right",fontSize:isMobile?8:9,color:"#445566",letterSpacing:1}}>
          <div>DRAG TO ROTATE</div><div>{isMobile?"PINCH TO ZOOM · TAP":"SCROLL TO ZOOM · CLICK"} TO INSPECT</div>
        </div>
      </div>

      {/* Canvas */}
      <canvas ref={mountRef} style={{width:"100%",height:"100%",display:"block",cursor:hov?"pointer":"grab",touchAction:"none"}}
        onMouseMove={onMove} onMouseDown={onDown} onMouseUp={onUp} onMouseLeave={()=>{dragRef.current.down=false;setHov(null);}}
        onWheel={onWheel}
        onTouchStart={(e)=>{e.preventDefault();onDown(e);}} onTouchMove={(e)=>{e.preventDefault();onMove(e);}} onTouchEnd={(e)=>{e.preventDefault();onUp(e);}}
      />

      {/* Hover tooltip desktop */}
      {!isMobile&&hovComp&&(
        <div style={{position:"fixed",left:(dragRef.current.lx||0)+14,top:(dragRef.current.ly||0)-14,background:"rgba(37,37,64,0.93)",border:`1px solid ${hovComp.color}`,borderRadius:6,padding:"7px 13px",color:hovComp.color,fontSize:11,letterSpacing:1,pointerEvents:"none",zIndex:100,whiteSpace:"nowrap",boxShadow:`0 0 16px ${hovComp.color}44`}}>
          {hovComp.icon} {hovComp.label}<div style={{color:"#667788",fontSize:9,marginTop:2}}>Click for details</div>
        </div>
      )}

      {/* Desktop side panel */}
      {!isMobile&&(
        <div style={{position:"absolute",right:0,top:0,bottom:0,width:comp?310:0,overflow:"hidden",transition:"width 0.3s cubic-bezier(0.4,0,0.2,1)",zIndex:20,background:"rgba(37,37,64,0.97)",borderLeft:comp?`1px solid ${comp?.color}33`:"none",display:"flex",flexDirection:"column"}}>
          {comp&&<Panel comp={comp} onClose={()=>setSel(null)}/>}
        </div>
      )}

      {/* Mobile bottom sheet */}
      {isMobile&&(
        <>
          {comp&&<div onClick={()=>setSel(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:25,backdropFilter:"blur(2px)"}}/>}
          <div style={{position:"fixed",left:0,right:0,bottom:0,height:comp?"58vh":0,transition:"height 0.35s cubic-bezier(0.4,0,0.2,1)",zIndex:30,background:"rgba(37,37,64,0.98)",borderTop:comp?`1px solid ${comp?.color}44`:"none",borderRadius:"18px 18px 0 0",display:"flex",flexDirection:"column",overflow:"hidden"}}>
            <div style={{display:"flex",justifyContent:"center",padding:"10px 0 4px",flexShrink:0}}><div style={{width:38,height:4,borderRadius:2,background:"rgba(255,255,255,0.14)"}}/></div>
            {comp&&<div style={{display:"flex",justifyContent:"flex-end",padding:"0 14px 0",flexShrink:0}}><button onClick={()=>setSel(null)} style={{background:"none",border:`1px solid ${comp.color}55`,borderRadius:4,color:comp.color,width:26,height:26,cursor:"pointer",fontSize:13}}>×</button></div>}
            {comp&&<Panel comp={comp} onClose={()=>setSel(null)}/>}
          </div>
        </>
      )}

      {/* Legend */}
      {!sel&&(
        <div style={{position:"absolute",bottom:isMobile?14:22,left:isMobile?"50%":22,transform:isMobile?"translateX(-50%)":"none",display:"flex",flexDirection:isMobile?"row":"column",flexWrap:"wrap",gap:isMobile?4:5,zIndex:10,justifyContent:isMobile?"center":"flex-start",maxWidth:isMobile?"95vw":"none"}}>
          {[["frame","Frame"],["motor_fl","Motors"],["prop_fl","Props"],["fc","FC"],["esc","ESC"],["battery","Battery"],["camera","Camera"],["vtx","VTX"],["rx","Receiver"]].map(([k,l])=>(
            <button key={k} onClick={()=>setSel(s=>s===k?null:k)} style={{display:"flex",alignItems:"center",gap:isMobile?4:7,background:isMobile?"rgba(37,37,64,0.7)":"none",border:isMobile?"1px solid rgba(255,255,255,0.06)":"none",borderRadius:isMobile?20:0,padding:isMobile?"3px 9px":"2px 0",cursor:"pointer"}}>
              <div style={{width:7,height:7,borderRadius:"50%",flexShrink:0,background:COMPONENTS[k].color,boxShadow:`0 0 5px ${COMPONENTS[k].color}`}}/>
              <span style={{color:"#445566",fontSize:isMobile?8:9,letterSpacing:1.5,textTransform:"uppercase"}}>{l}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   CHALLENGES PAGE — one-shot maneuvers, real gates
═══════════════════════════════════════════════════════════════════════ */
function ChallengesPage() {
  const mountRef   = useRef(null);
  // Use a ref to communicate with the animation loop — avoids stale closure
  const animState  = useRef({ mode:"idle", t:0, key:"idle", returnT:0, returnFrom:{pos:{x:0,y:0,z:0},rot:{x:-0.05,y:0,z:0}}, gates:[], drone:null, propGroups:[], raf:null });
  const [active,   setActive]   = useState(null);   // selected card id
  const [performing,setPerforming]=useState(null);  // card currently animating
  const onDoneRef  = useRef(null);

  // Exposed callback so 3D loop can call React state update
  onDoneRef.current = () => setPerforming(null);

  function triggerManeuver(key) {
    const s = animState.current;
    s.key  = key;
    s.t    = 0;
    s.mode = "running";
    s.gates.forEach(g=>{g.visible=key==="gateRun";});
  }

  useEffect(()=>{
    const el=mountRef.current; if(!el) return;
    const W=el.clientWidth, H=el.clientHeight;
    const scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(52,W/H,0.05,80); camera.position.set(0,0.5,4.2); camera.lookAt(0,0,0);
    const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true}); renderer.setSize(W,H); renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.6;
    el.appendChild(renderer.domElement);
    addLights(scene);

    // Grid + landing pad
    
    const padM=new THREE.MeshStandardMaterial({color:0xff6b35,emissive:0x331100,roughness:0.6});
    const pad=new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.22,0.01,32),padM); pad.position.set(0,-0.75,-2); scene.add(pad);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(0.22,0.014,8,32),new THREE.MeshStandardMaterial({color:0xff6b35,emissive:0xff2200,emissiveIntensity:0.5})); ring.rotation.x=Math.PI/2; ring.position.set(0,-0.74,-2); scene.add(ring);

    // Gates
    const gateCfg=[{x:0,y:0,z:0.5,c:0x00e5ff},{x:0.35,y:0.18,z:-1.5,c:0xa8ff3e},{x:-0.28,y:-0.1,z:-3.5,c:0x00e5ff},{x:0.42,y:0.12,z:-5.5,c:0xa8ff3e},{x:-0.18,y:0,z:-7.5,c:0x00e5ff}];
    const gates=gateCfg.map(({x,y,z,c})=>buildGate(scene,x,y,z,c));
    gates.forEach(g=>{g.visible=false;});
    animState.current.gates=gates;

    // Trail
    const TC=80; const trailPos=new Float32Array(TC*3);
    const trailGeo=new THREE.BufferGeometry(); trailGeo.setAttribute("position",new THREE.BufferAttribute(trailPos,3));
    const trailMat=new THREE.PointsMaterial({color:0x00e5ff,size:0.03,transparent:true,opacity:0});
    const trail=new THREE.Points(trailGeo,trailMat); scene.add(trail);
    const trailHist=Array.from({length:TC},()=>({x:0,y:0,z:0}));

    // Drone
    const drone=buildDrone(scene,null);
    animState.current.drone=drone;
    animState.current.propGroups=drone.userData.propGroups||[];
    drone.position.set(0,0,0); drone.rotation.set(-0.05,0,0);

    let propSpeed=0;
    const SPEED=0.007; // ~8s per maneuver at 60fps

    const animate=()=>{
      animState.current.raf=requestAnimationFrame(animate);
      propSpeed=Math.min(propSpeed+0.01,0.55);
      const s=animState.current;
      let tp,tr;

      if(s.mode==="idle"){
        const it=(Date.now()/4200)%1;
        const r=MANEUVERS.idle(it); tp=r.pos; tr=r.rot;
      } else if(s.mode==="running"){
        s.t=Math.min(s.t+SPEED,1);
        const fn=MANEUVERS[s.key]||MANEUVERS.idle;
        const r=fn(s.t); tp=r.pos; tr=r.rot;
        if(s.t>=1){
          s.returnFrom={pos:{x:drone.position.x,y:drone.position.y,z:drone.position.z},rot:{x:drone.rotation.x,y:drone.rotation.y,z:drone.rotation.z}};
          s.returnT=0; s.mode="returning";
          s.gates.forEach(g=>{g.visible=false;});
          onDoneRef.current&&onDoneRef.current();
        }
      } else { // returning
        s.returnT=Math.min(s.returnT+0.013,1);
        const it=(Date.now()/4200)%1;
        const ir=MANEUVERS.idle(it);
        const et=easeInOut(s.returnT);
        tp={x:lerp(s.returnFrom.pos.x,ir.pos.x,et),y:lerp(s.returnFrom.pos.y,ir.pos.y,et),z:lerp(s.returnFrom.pos.z,ir.pos.z,et)};
        tr={x:lerp(s.returnFrom.rot.x,ir.rot.x,et),y:lerp(s.returnFrom.rot.y,ir.rot.y,et),z:lerp(s.returnFrom.rot.z,ir.rot.z,et)};
        if(s.returnT>=1) s.mode="idle";
      }

      const SM=0.13;
      drone.position.x+=(tp.x-drone.position.x)*SM;
      drone.position.y+=(tp.y-drone.position.y)*SM;
      drone.position.z+=(tp.z-drone.position.z)*SM;
      drone.rotation.x+=(tr.x-drone.rotation.x)*SM;
      drone.rotation.y+=(tr.y-drone.rotation.y)*SM;
      drone.rotation.z+=(tr.z-drone.rotation.z)*SM;

      // Trail
      trailHist.pop(); trailHist.unshift({x:drone.position.x,y:drone.position.y,z:drone.position.z});
      const pa=trailGeo.attributes.position; trailHist.forEach((p,i)=>pa.setXYZ(i,p.x,p.y,p.z)); pa.needsUpdate=true;
      trailMat.opacity=s.mode==="idle"?0:0.5;

      // Props — slow down on landing return
      const effSpeed=s.mode==="returning"&&s.key==="landing"?propSpeed*Math.max(0,1-s.returnT*1.8):propSpeed;
      spinProps(drone,effSpeed);

      // Gate glow pulse
      gates.forEach((g,i)=>{ if(!g.visible) return; g.children.forEach(c=>{ if(c.material?.emissiveIntensity!==undefined) c.material.emissiveIntensity=0.6+Math.sin(Date.now()*0.005+i)*0.35; }); });

      renderer.render(scene,camera);
    };
    animate();

    const onR=()=>{ const nw=el.clientWidth,nh=el.clientHeight; camera.aspect=nw/nh; camera.updateProjectionMatrix(); renderer.setSize(nw,nh); };
    window.addEventListener("resize",onR);
    return()=>{ cancelAnimationFrame(animState.current.raf); window.removeEventListener("resize",onR); if(el.contains(renderer.domElement)) el.removeChild(renderer.domElement); renderer.dispose(); };
  },[]);

  const ch=CHALLENGES.find(c=>c.id===active);
  const detailRef=useRef(null);

  function handleSelect(id) {
    if (performing===id) return;
    const ch=CHALLENGES.find(c=>c.id===id);
    setActive(id);
    setPerforming(id);
    triggerManeuver(ch?.animate||"idle");
    // On mobile, scroll the detail panel into view after a short delay
    setTimeout(()=>{ detailRef.current?.scrollIntoView({behavior:"smooth",block:"nearest"}); },50);
  }

  return (
    <div style={{minHeight:"100vh",background:"#252540",paddingTop:60,position:"relative",overflow:"hidden",fontFamily:"monospace"}}>
      {/* 3D scene fills background */}
      <div ref={mountRef} style={{position:"fixed",inset:0,zIndex:0}}/>
      <div style={{position:"fixed",inset:0,background:"rgba(37,37,64,0.15)",pointerEvents:"none",zIndex:1}}/>

      <div style={{position:"relative",zIndex:2,padding:"36px 22px 80px",maxWidth:1200,margin:"0 auto"}}>
        <div style={{textAlign:"center",marginBottom:40}}>
          <div style={{fontSize:9,letterSpacing:5,color:"#00e5ff",textTransform:"uppercase",marginBottom:10}}>Live 3D Preview</div>
          <h2 style={{fontFamily:"monospace",fontWeight:900,fontSize:"clamp(26px,4vw,46px)",color:"#fff",marginBottom:10}}>Club <span style={{color:"#00e5ff"}}>Challenges</span></h2>
          <p style={{color:"#667788",fontSize:13,maxWidth:460,margin:"0 auto"}}>Click any challenge — the drone performs the manoeuvre once, then returns to hover.</p>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(250px,1fr))",gap:12}}>
          {CHALLENGES.map(c=>{
            const isAct=active===c.id, isPerf=performing===c.id;
            return (
              <div key={c.id} style={{display:"flex",flexDirection:"column"}}>
                <button onClick={()=>handleSelect(c.id)} style={{background:isAct?"rgba(0,0,0,0.25)":"rgba(255,255,255,0.03)",border:`1px solid ${isAct?c.dc+"88":"rgba(255,255,255,0.07)"}`,borderRadius:isAct?"10px 10px 0 0":10,padding:"18px",cursor:isPerf?"wait":"pointer",textAlign:"left",transition:"all .22s",boxShadow:isAct?`0 0 20px ${c.dc}22`:"none"}}
                  onMouseEnter={e=>{if(!isAct)e.currentTarget.style.borderColor=c.dc+"44";}} onMouseLeave={e=>{if(!isAct)e.currentTarget.style.borderColor="rgba(255,255,255,0.07)";}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                    <span style={{fontSize:26,color:c.dc,textShadow:isAct?`0 0 14px ${c.dc}`:"none"}}>{c.icon}</span>
                    <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:3}}>
                      <span style={{fontSize:8,letterSpacing:2,color:c.dc,border:`1px solid ${c.dc}33`,borderRadius:3,padding:"2px 7px"}}>{c.diff.toUpperCase()}</span>
                      <span style={{fontSize:9,color:"#a8ff3e"}}>★ {c.pts}</span>
                    </div>
                  </div>
                  <div style={{fontWeight:700,fontSize:13,color:"#fff",marginBottom:5,letterSpacing:0.5}}>{c.name}</div>
                  <div style={{fontSize:10,color:"#445566",letterSpacing:1}}>⏱ {c.dur}</div>
                  {isPerf&&<div style={{marginTop:9,fontSize:8,letterSpacing:2,color:c.dc,display:"flex",alignItems:"center",gap:5}}><span style={{width:5,height:5,borderRadius:"50%",background:c.dc,boxShadow:`0 0 5px ${c.dc}`,display:"inline-block",animation:"pulse 0.7s infinite"}}/>PERFORMING NOW</div>}
                  {isAct&&!isPerf&&<div style={{marginTop:9,fontSize:8,letterSpacing:2,color:"#445566"}}>↩ Click to replay</div>}
                </button>
                {/* Inline detail panel — expands right below the card */}
                {isAct&&(
                  <div style={{background:"rgba(0,0,0,0.2)",border:`1px solid ${c.dc}44`,borderTop:"none",borderRadius:"0 0 10px 10px",padding:"16px 18px",animation:"fadeUp .25s ease"}}>
                    <p style={{color:"#667788",fontSize:12,lineHeight:1.7,marginBottom:12}}>{c.desc}</p>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                      {c.tips.map((tip,i)=><div key={i} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:5,padding:"4px 9px",fontSize:10,color:"#667788"}}>💡 {tip}</div>)}
                    </div>
                    <div style={{display:"flex",gap:12,marginTop:12,flexWrap:"wrap"}}>
                      <span style={{fontSize:9,color:"#667788"}}>⏱ {c.dur}</span>
                      <span style={{fontSize:9,color:"#a8ff3e"}}>★ {c.pts} pts</span>
                      <span style={{fontSize:9,color:c.dc,border:`1px solid ${c.dc}33`,borderRadius:3,padding:"1px 7px",letterSpacing:1}}>{c.diff.toUpperCase()}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   HOME PAGE
═══════════════════════════════════════════════════════════════════════ */
function HomeScene() {
  const ref=useRef(null);
  useEffect(()=>{
    const el=ref.current; if(!el) return;
    const W=el.clientWidth,H=el.clientHeight;
    const scene=new THREE.Scene(); scene.background=new THREE.Color(0x252540);
    // Camera distance scales with screen — bigger screen = closer drone = bigger
    const getDist=()=>{ const w=el.clientWidth; return w>1400?3.0:w>1024?3.5:w>768?4.2:5.5; };
    const camera=new THREE.PerspectiveCamera(45,W/H,0.1,100);
    camera.position.set(0,getDist()*0.32,getDist()); camera.lookAt(0,0,0);
    const renderer=new THREE.WebGLRenderer({canvas:el,antialias:true}); renderer.setSize(W,H); renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.6;
    addLights(scene);
    const drone=buildDrone(scene,null);
    let t=0,propSpeed=0,rotY=0.4; const raf={id:null};
    const animate=()=>{ raf.id=requestAnimationFrame(animate); t+=0.01; propSpeed=Math.min(propSpeed+0.008,0.55); rotY+=0.004; drone.rotation.y=rotY; drone.rotation.x=-0.18+Math.sin(t*0.5)*0.03; drone.position.y=Math.sin(t*0.7)*0.04; spinProps(drone,propSpeed); renderer.render(scene,camera); };
    animate();
    const onR=()=>{ const nw=el.clientWidth,nh=el.clientHeight; const d=getDist(); camera.position.set(0,d*0.32,d); camera.aspect=nw/nh; camera.updateProjectionMatrix(); renderer.setSize(nw,nh); };
    window.addEventListener("resize",onR);
    return()=>{ cancelAnimationFrame(raf.id); window.removeEventListener("resize",onR); renderer.dispose(); };
  },[]);
  return <canvas ref={ref} style={{position:"absolute",inset:0,width:"100%",height:"100%"}}/>;
}

function HomePage({setPage}) {
  const [vis,setVis]=useState(false);
  useEffect(()=>{setTimeout(()=>setVis(true),80);},[]);
  const fade=(d=0)=>({opacity:vis?1:0,transform:vis?"none":"translateY(18px)",transition:`all .7s ease ${d}s`});
  return (
    <div style={{height:"100vh",position:"relative",overflow:"hidden",background:"#252540"}}>
      <HomeScene/>
      <div style={{position:"absolute",inset:0,background:"rgba(37,37,64,0.6)",pointerEvents:"none"}}/>
      <div style={{position:"absolute",left:0,top:0,bottom:0,width:"clamp(280px,50%,600px)",display:"flex",flexDirection:"column",justifyContent:"center",padding:"0 clamp(20px,4vw,56px)"}}>
        <div style={{...fade(0.1),fontSize:"clamp(7px,1vw,11px)",letterSpacing:"clamp(2px,0.5vw,5px)",color:"#00e5ff",textTransform:"uppercase",marginBottom:"clamp(8px,1.5vh,18px)"}}>Saint Leo University Drone Club<br/>✦ Est. 2026</div>
        <h1 style={{...fade(0.2),fontFamily:"monospace",fontWeight:900,fontSize:"clamp(26px,5vw,72px)",lineHeight:1.05,color:"#fff",marginBottom:"clamp(12px,2vh,22px)",letterSpacing:-1}}>
          Master The<br/><span style={{color:"#00e5ff",textShadow:"0 0 40px #00e5ff88"}}>Sky</span>
        </h1>
        <p style={{...fade(0.3),color:"#667788",fontSize:"clamp(11px,1.3vw,16px)",lineHeight:1.8,marginBottom:"clamp(20px,3vh,38px)",maxWidth:"clamp(240px,32vw,420px)"}}>
          From first hover to racing through gates at 120 km/h — SLU Drone Club is where university pilots level up, compete, and build real-world skills.
        </p>
        <div style={{...fade(0.4),display:"flex",gap:"clamp(8px,1vw,14px)",flexWrap:"wrap",marginBottom:"clamp(28px,5vh,56px)"}}>
          <button onClick={()=>setPage("challenges")} style={{padding:"clamp(9px,1.2vh,14px) clamp(14px,2vw,28px)",background:"#00e5ff",color:"#252540",border:"none",borderRadius:6,fontFamily:"monospace",fontWeight:700,fontSize:"clamp(8px,0.9vw,11px)",letterSpacing:2,cursor:"pointer",boxShadow:"0 0 22px #00e5ff55",transition:"all .2s",whiteSpace:"nowrap"}} onMouseEnter={e=>e.currentTarget.style.transform="translateY(-2px)"} onMouseLeave={e=>e.currentTarget.style.transform="none"}>VIEW CHALLENGES →</button>
          <button onClick={()=>setPage("components")} style={{padding:"clamp(9px,1.2vh,14px) clamp(14px,2vw,28px)",background:"none",color:"#00e5ff",border:"1px solid #00e5ff44",borderRadius:6,fontFamily:"monospace",fontWeight:700,fontSize:"clamp(8px,0.9vw,11px)",letterSpacing:2,cursor:"pointer",transition:"all .2s",whiteSpace:"nowrap"}} onMouseEnter={e=>e.currentTarget.style.background="rgba(0,229,255,0.1)"} onMouseLeave={e=>e.currentTarget.style.background="none"}>EXPLORE DRONE</button>
          <button onClick={()=>setPage("join")} style={{padding:"clamp(9px,1.2vh,14px) clamp(14px,2vw,28px)",background:"none",color:"#667788",border:"1px solid rgba(255,255,255,0.08)",borderRadius:6,fontFamily:"monospace",fontWeight:700,fontSize:"clamp(8px,0.9vw,11px)",letterSpacing:2,cursor:"pointer",transition:"all .2s",whiteSpace:"nowrap"}} onMouseEnter={e=>e.currentTarget.style.color="#fff"} onMouseLeave={e=>e.currentTarget.style.color="#667788"}>JOIN THE CLUB</button>
        </div>
        <div style={{...fade(0.6),display:"flex",gap:"clamp(18px,3vw,40px)"}}>
          {[["50+","Members"],["300+","Flights"],["8","Challenges"],["#1","Ranked"]].map(([n,l])=>(
            <div key={l}>
              <div style={{fontFamily:"monospace",fontWeight:900,fontSize:"clamp(18px,2.5vw,30px)",color:"#fff",textShadow:"0 0 20px #00e5ff44"}}>{n}</div>
              <div style={{fontSize:"clamp(7px,0.7vw,9px)",letterSpacing:3,color:"#445566",textTransform:"uppercase",marginTop:2}}>{l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   MEMBERS PAGE
═══════════════════════════════════════════════════════════════════════ */
function MembersPage() {
  const [filter,setFilter]=useState("All");
  const levels=["All","Expert","Advanced","Intermediate","Beginner"];
  const filtered=filter==="All"?MEMBERS:MEMBERS.filter(m=>m.level===filter);
  return (
    <div style={{minHeight:"100vh",background:"#252540",paddingTop:60,fontFamily:"monospace"}}>
      <div style={{maxWidth:1100,margin:"0 auto",padding:"44px 22px 80px"}}>
        <div style={{textAlign:"center",marginBottom:44}}>
          <div style={{fontSize:9,letterSpacing:5,color:"#00e5ff",textTransform:"uppercase",marginBottom:10}}>The Crew</div>
          <h2 style={{fontWeight:900,fontSize:"clamp(26px,4vw,46px)",color:"#fff",marginBottom:10}}>Our <span style={{color:"#00e5ff"}}>Members</span></h2>
          <p style={{color:"#667788",fontSize:13,maxWidth:420,margin:"0 auto"}}>Pilots at every level, united by one obsession.</p>
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:36,flexWrap:"wrap"}}>
          {levels.map(l=><button key={l} onClick={()=>setFilter(l)} style={{background:filter===l?"#00e5ff":"rgba(255,255,255,0.65)",border:`1px solid ${filter===l?"#00e5ff":"rgba(255,255,255,0.08)"}`,borderRadius:20,padding:"6px 18px",color:filter===l?"#252540":"#667788",fontSize:9,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",fontFamily:"monospace",fontWeight:filter===l?700:400,transition:"all .2s"}}>{l}</button>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(230px,1fr))",gap:14}}>
          {filtered.map(m=>(
            <div key={m.name} style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${m.color}22`,borderRadius:12,padding:22,transition:"all .22s",cursor:"default"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=m.color+"66";e.currentTarget.style.transform="translateY(-4px)";e.currentTarget.style.boxShadow=`0 8px 28px ${m.color}18`;}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=m.color+"22";e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="none";}}>
              <div style={{width:52,height:52,borderRadius:"50%",background:`linear-gradient(135deg,${m.color}33,${m.color}88)`,border:`2px solid ${m.color}66`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:15,color:"#fff",marginBottom:14,boxShadow:`0 0 18px ${m.color}33`}}>{m.avatar}</div>
              <div style={{fontWeight:700,fontSize:14,color:"#fff",marginBottom:3}}>{m.name}</div>
              <div style={{fontSize:8,letterSpacing:2,color:m.color,marginBottom:12,textTransform:"uppercase"}}>{m.role}</div>
              <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:12}}>
                <span style={{fontSize:8,color:"#445566",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:4,padding:"2px 7px",letterSpacing:1}}>{m.level}</span>
                <span style={{fontSize:8,color:"#445566",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:4,padding:"2px 7px",letterSpacing:1}}>{m.spec}</span>
              </div>
              <div style={{height:1,background:`linear-gradient(90deg,${m.color}33,transparent)`,marginBottom:10}}/>
              <div style={{fontSize:10,color:"#667788"}}>✈ <span style={{color:"#667788",fontWeight:600}}>{m.flights.toLocaleString()}</span> flights</div>
            </div>
          ))}
        </div>
        <div style={{marginTop:52,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:1,background:"rgba(0,229,255,0.08)",border:"1px solid rgba(0,229,255,0.12)",borderRadius:12,overflow:"hidden"}}>
          {[["50+","Total Members"],["4,200+","Combined Flights"],["3","Skill Levels"],["5","Disciplines"]].map(([n,l])=>(
            <div key={l} style={{padding:"24px 18px",textAlign:"center",borderRight:"1px solid rgba(0,229,255,0.08)"}}>
              <div style={{fontWeight:900,fontSize:26,color:"#fff",marginBottom:5}}>{n}</div>
              <div style={{fontSize:8,letterSpacing:2,color:"#445566",textTransform:"uppercase"}}>{l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   JOIN PAGE
═══════════════════════════════════════════════════════════════════════ */
function JoinPage() {
  const [form,setForm]=useState({name:"",email:"",course:"",experience:"none",why:"",availability:[]});
  const [submitted,setSubmitted]=useState(false);
  const [errors,setErrors]=useState({});
  const days=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const expLevels=[{id:"none",label:"No experience",desc:"Never flown before"},{id:"beginner",label:"Beginner",desc:"A few flights on toy drones"},{id:"intermediate",label:"Intermediate",desc:"Own a drone, flown regularly"},{id:"advanced",label:"Advanced",desc:"FPV / racing / freestyle"}];
  const toggle=(day)=>setForm(f=>({...f,availability:f.availability.includes(day)?f.availability.filter(d=>d!==day):[...f.availability,day]}));
  const validate=()=>{ const e={}; if(!form.name.trim())e.name="Required"; if(!form.email.match(/^[^@]+@[^@]+\.[^@]+$/))e.email="Valid email required"; if(!form.course.trim())e.course="Required"; if(!form.why.trim())e.why="Tell us about yourself"; return e; };
  const handleSubmit=()=>{ const e=validate(); if(Object.keys(e).length){setErrors(e);return;} setSubmitted(true); };
  const inp=(field,ph,type="text",multi=false)=>{ const Tag=multi?"textarea":"input"; return (
    <div style={{marginBottom:18}}>
      <label style={{display:"block",fontSize:8,letterSpacing:3,color:errors[field]?"#ff4444":"#445566",textTransform:"uppercase",marginBottom:7}}>{ph}{errors[field]?` — ${errors[field]}`:""}</label>
      <Tag type={type} value={form[field]} onChange={e=>{setForm(f=>({...f,[field]:e.target.value}));setErrors(er=>({...er,[field]:undefined}));}}
        style={{width:"100%",background:"rgba(255,255,255,0.04)",border:`1px solid ${errors[field]?"#ff444466":"rgba(255,255,255,0.1)"}`,borderRadius:7,padding:"11px 14px",color:"#fff",fontSize:12,fontFamily:"monospace",outline:"none",resize:multi?"vertical":"none",minHeight:multi?90:"auto",transition:"border-color .2s"}}
        onFocus={e=>e.target.style.borderColor="#00e5ff66"} onBlur={e=>e.target.style.borderColor=errors[field]?"#ff444466":"rgba(255,255,255,0.1)"}/>
    </div>);};

  if(submitted) return (
    <div style={{minHeight:"100vh",background:"#252540",paddingTop:60,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"monospace"}}>
      <div style={{textAlign:"center",maxWidth:420,padding:40}}>
        <div style={{fontSize:60,marginBottom:22,animation:"pulse 2s infinite"}}>✦</div>
        <div style={{fontSize:8,letterSpacing:5,color:"#00e5ff",textTransform:"uppercase",marginBottom:14}}>Application Received</div>
        <h2 style={{fontWeight:900,fontSize:30,color:"#fff",marginBottom:14}}>Welcome to the <span style={{color:"#00e5ff"}}>Club!</span></h2>
        <p style={{color:"#667788",fontSize:13,lineHeight:1.8,marginBottom:28}}>We'll reach out to <span style={{color:"#00e5ff"}}>{form.email}</span> within 48 hours with next steps.</p>
        <div style={{background:"rgba(0,229,255,0.07)",border:"1px solid rgba(0,229,255,0.2)",borderRadius:10,padding:"18px 22px",fontSize:11,color:"#667788",lineHeight:2}}>
          📅 First session: <span style={{color:"#fff"}}>Saturday 10:00 AM</span><br/>
          📍 Location: <span style={{color:"#fff"}}>Field G, Campus North</span><br/>
          🎧 Discord: <span style={{color:"#00e5ff"}}>discord.gg/sludrone</span>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:"#252540",paddingTop:60,fontFamily:"monospace"}}>
      <div style={{maxWidth:660,margin:"0 auto",padding:"44px 22px 80px"}}>
        <div style={{textAlign:"center",marginBottom:44}}>
          <div style={{fontSize:8,letterSpacing:5,color:"#00e5ff",textTransform:"uppercase",marginBottom:10}}>Applications Open</div>
          <h2 style={{fontWeight:900,fontSize:"clamp(26px,4vw,42px)",color:"#fff",marginBottom:10}}>Join <span style={{color:"#00e5ff"}}>SLU Drone</span></h2>
          <p style={{color:"#667788",fontSize:12,maxWidth:380,margin:"0 auto"}}>All skill levels welcome. We'll get you flying.</p>
        </div>
        <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,padding:"32px 28px"}}>
          {inp("name","Full Name")} {inp("email","University Email","email")} {inp("course","Course / Department")}
          <div style={{marginBottom:18}}>
            <label style={{display:"block",fontSize:8,letterSpacing:3,color:"#445566",textTransform:"uppercase",marginBottom:9}}>Flying Experience</label>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {expLevels.map(l=><button key={l.id} onClick={()=>setForm(f=>({...f,experience:l.id}))} style={{background:form.experience===l.id?"rgba(0,229,255,0.12)":"rgba(255,255,255,0.03)",border:`1px solid ${form.experience===l.id?"#00e5ff66":"rgba(255,255,255,0.08)"}`,borderRadius:7,padding:"10px 12px",cursor:"pointer",textAlign:"left",transition:"all .2s"}}>
                <div style={{fontSize:11,fontWeight:600,color:form.experience===l.id?"#00e5ff":"#fff",marginBottom:2}}>{l.label}</div>
                <div style={{fontSize:9,color:"#445566"}}>{l.desc}</div>
              </button>)}
            </div>
          </div>
          <div style={{marginBottom:18}}>
            <label style={{display:"block",fontSize:8,letterSpacing:3,color:"#445566",textTransform:"uppercase",marginBottom:9}}>Weekly Availability</label>
            <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
              {days.map(d=><button key={d} onClick={()=>toggle(d)} style={{background:form.availability.includes(d)?"#00e5ff":"rgba(255,255,255,0.65)",border:`1px solid ${form.availability.includes(d)?"#00e5ff":"rgba(255,255,255,0.08)"}`,borderRadius:6,padding:"7px 12px",color:form.availability.includes(d)?"#252540":"#667788",fontSize:10,fontWeight:form.availability.includes(d)?700:400,cursor:"pointer",fontFamily:"monospace",transition:"all .15s"}}>{d}</button>)}
            </div>
          </div>
          {inp("why","Why do you want to join? What are your goals?","text",true)}
          <button onClick={handleSubmit} style={{width:"100%",padding:"14px",background:"#00e5ff",color:"#252540",border:"none",borderRadius:7,fontFamily:"monospace",fontWeight:900,fontSize:12,letterSpacing:3,cursor:"pointer",boxShadow:"0 0 22px #00e5ff44",transition:"all .2s"}} onMouseEnter={e=>{e.currentTarget.style.boxShadow="0 0 38px #00e5ff88";e.currentTarget.style.transform="translateY(-1px)";}} onMouseLeave={e=>{e.currentTarget.style.boxShadow="0 0 22px #00e5ff44";e.currentTarget.style.transform="none";}}>SUBMIT APPLICATION →</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:12,marginTop:28}}>
          {[["🗓","Sessions","Saturdays 10AM–1PM, Field G"],["💸","Cost","£0 — student-union funded"],["🛠","Equipment","Club drones for beginners"],["📡","Training","Sim sessions Wed 6PM"]].map(([icon,title,desc])=>(
            <div key={title} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:9,padding:"14px 16px"}}>
              <div style={{fontSize:20,marginBottom:7}}>{icon}</div>
              <div style={{fontSize:10,fontWeight:700,color:"#fff",marginBottom:3}}>{title}</div>
              <div style={{fontSize:9,color:"#445566",lineHeight:1.6}}>{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   NAV + ROOT APP
═══════════════════════════════════════════════════════════════════════ */
function Nav({page,setPage}) {
  const [open,setOpen]=useState(false);
  const links=["home","challenges","components","members","join"];
  return (
    <nav style={{position:"fixed",top:0,left:0,right:0,zIndex:200,padding:"0 24px",height:58,display:"flex",alignItems:"center",justifyContent:"space-between",background:"rgba(37,37,64,0.93)",backdropFilter:"blur(12px)",borderBottom:"1px solid rgba(0,229,255,0.1)"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}} onClick={()=>setPage("home")}>
        <div style={{width:30,height:30,background:"conic-gradient(#00e5ff,#0033aa,#00e5ff)",clipPath:"polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%)",boxShadow:"0 0 12px #00e5ff88"}}/>
        <span style={{fontFamily:"monospace",fontWeight:700,fontSize:14,letterSpacing:3,color:"#fff"}}>SLU<span style={{color:"#00e5ff"}}>DRONE</span></span>
      </div>
      <div className="desktop-nav" style={{display:"flex",gap:2}}>
        {links.map(l=><button key={l} onClick={()=>setPage(l)} style={{background:page===l?"rgba(0,229,255,0.12)":"none",border:page===l?"1px solid #00e5ff44":"1px solid transparent",borderRadius:6,padding:"5px 16px",color:page===l?"#00e5ff":"#556677",fontSize:10,letterSpacing:2.5,textTransform:"uppercase",cursor:"pointer",fontFamily:"monospace",transition:"all .2s"}}>{l}</button>)}
      </div>
      <button className="hamburger" onClick={()=>setOpen(o=>!o)} style={{display:"none",background:"none",border:"1px solid #00e5ff44",borderRadius:6,color:"#00e5ff",width:34,height:34,cursor:"pointer",fontSize:15,alignItems:"center",justifyContent:"center"}}>☰</button>
      {open&&<div style={{position:"fixed",top:58,left:0,right:0,background:"rgba(37,37,64,0.98)",borderBottom:"1px solid #00e5ff22",zIndex:300,display:"flex",flexDirection:"column"}}>
        {links.map(l=><button key={l} onClick={()=>{setPage(l);setOpen(false);}} style={{background:"none",border:"none",borderBottom:"1px solid rgba(255,255,255,0.05)",color:page===l?"#00e5ff":"#8899aa",fontSize:12,letterSpacing:3,textTransform:"uppercase",cursor:"pointer",fontFamily:"monospace",padding:"15px 26px",textAlign:"left"}}>{l}</button>)}
      </div>}
    </nav>
  );
}

export default function App() {
  const [page,setPage]=useState("home");
  return (
    <div style={{background:"#252540",minHeight:"100vh",color:"#fff"}}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;}
        body{background:#e8eef8;overflow-x:hidden;}
        ::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-track{background:#e8eef8;}::-webkit-scrollbar-thumb{background:#0a2a3a;border-radius:4px;}
        input,textarea,button{font-family:monospace;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.55;transform:scale(1.25)}}
        @media(max-width:768px){.desktop-nav{display:none!important;}.hamburger{display:flex!important;}}
        @media(min-width:769px){.hamburger{display:none!important;}.desktop-nav{display:flex!important;}}
      `}</style>
      <Nav page={page} setPage={setPage}/>
      {page==="home"       && <HomePage setPage={setPage}/>}
      {page==="challenges" && <ChallengesPage/>}
      {page==="components" && <ComponentsPage/>}
      {page==="members"    && <MembersPage/>}
      {page==="join"       && <JoinPage/>}
      <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:500,padding:"6px 20px",background:"rgba(37,37,64,0.85)",backdropFilter:"blur(8px)",borderTop:"1px solid rgba(255,255,255,0.04)",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:4}}>
        <span style={{fontFamily:"monospace",fontSize:9,color:"#2a4a3a",letterSpacing:1}}><span style={{color:"#3a6a52"}}>ramadan bregu</span> · <a href="mailto:ramadanbregu7@gmail.com" style={{color:"#3a6a52",textDecoration:"none"}}>ramadanbregu7@gmail.com</a></span>
        <span style={{fontFamily:"monospace",fontSize:9,color:"#2a4a3a",letterSpacing:1}}>vp president of pentest club · 2026</span>
      </div>
    </div>
  );
}
