(() => {
"use strict";
const EVENT_DATE=new Date("2026-11-21T19:00:00-06:00");
const DEMO_KEY="yahirfest-demo-rsvps";
const CLIENT_ID_KEY="yahirfest-client-id-v1";
const SUBMITTED_KEY="yahirfest-rsvp-submitted-v1";
let memoryClientId=null;
const config=window.YAHIRFEST_CONFIG||{};
const cloudReady=Boolean(window.supabase&&/^https:\/\/.+/.test(config.supabaseUrl||"")&&(config.supabaseAnonKey||"").length>20&&!String(config.supabaseUrl).includes("PEGA_AQUI")&&!String(config.supabaseAnonKey).includes("PEGA_AQUI"));
const db=cloudReady?window.supabase.createClient(config.supabaseUrl,config.supabaseAnonKey):null;
const $=s=>document.querySelector(s);
const audio=$("#backgroundMusic"),musicToggle=$("#musicToggle"),musicLabel=$("#musicLabel"),form=$("#rsvpForm"),guestName=$("#guestName"),status=$("#rsvpStatus"),submit=$("#submitRsvp");
const choices=[...document.querySelectorAll("[data-attending]")],attendanceField=$("#attendingValue");
let selected=null,saving=false,manuallyPaused=false;
if(audio){audio.loop=true;audio.volume=.78;audio.setAttribute("playsinline","");}

// Actualiza explícitamente el ángulo RGB para navegadores donde la interpolación CSS
// de propiedades personalizadas puede no animarse de forma consistente.
const dateCard=document.querySelector(".date-card");
if(dateCard){
 let lastFrame=0;
 const animateRgbFrame=now=>{
  if(!document.hidden&&now-lastFrame>=30){
   dateCard.style.setProperty("--rgb-angle",(((now%5200)/5200)*360).toFixed(2)+"deg");
   lastFrame=now;
  }
  requestAnimationFrame(animateRgbFrame);
 };
 requestAnimationFrame(animateRgbFrame);
}

function updateCountdown(){
 const remaining=Math.max(0,EVENT_DATE.getTime()-Date.now());
 $("#days").textContent=String(Math.floor(remaining/86400000)).padStart(2,"0");
 $("#hours").textContent=String(Math.floor(remaining%86400000/3600000)).padStart(2,"0");
 $("#minutes").textContent=String(Math.floor(remaining%3600000/60000)).padStart(2,"0");
 $("#seconds").textContent=String(Math.floor(remaining%60000/1000)).padStart(2,"0");
 if(!remaining)$("#countdownCaption").textContent="¡ES HOY! · YAHIR-FEST";
}
updateCountdown();window.setInterval(updateCountdown,1000);
function updateMusicButton(playing){
 musicToggle.setAttribute("aria-pressed",String(playing));
 musicToggle.setAttribute("aria-label",playing?"Pausar música":"Activar música");
 musicLabel.textContent=playing?"MÚSICA ACTIVA":"MÚSICA PAUSADA";
 musicToggle.querySelector(".music-symbol").textContent=playing?"Ⅱ":"♫";
}
function startMusicFromGesture(event){
 if(event&&event.target instanceof Element&&event.target.closest("#musicToggle"))return;
 if(!audio||manuallyPaused||!audio.paused)return;
 // play() se llama directamente desde el gesto táctil para respetar la política de Safari en iPhone.
 const result=audio.play();
 if(result&&typeof result.then==="function"){
   result.then(()=>updateMusicButton(true)).catch(()=>updateMusicButton(false));
 }else updateMusicButton(!audio.paused);
}
musicToggle.addEventListener("click",()=>{
 if(!audio)return;
 if(!audio.paused){manuallyPaused=true;audio.pause();updateMusicButton(false);}
 else{manuallyPaused=false;startMusicFromGesture();}
});
document.addEventListener("pointerdown",startMusicFromGesture,{passive:true,capture:true});
document.addEventListener("touchstart",startMusicFromGesture,{passive:true,capture:true});
document.addEventListener("touchmove",startMusicFromGesture,{passive:true,capture:true});
document.addEventListener("wheel",startMusicFromGesture,{passive:true,capture:true});
document.addEventListener("keydown",event=>{
 if(!["INPUT","TEXTAREA"].includes(document.activeElement?.tagName)&&!["Shift","Control","Alt","Meta"].includes(event.key))startMusicFromGesture(event);
},{capture:true});

function clearSystemMediaControls(){
  try{
    if("mediaSession" in navigator){
      navigator.mediaSession.metadata=null;
      navigator.mediaSession.playbackState="none";
      ["play","pause","stop","seekbackward","seekforward","previoustrack","nexttrack"].forEach(action=>{
        try{navigator.mediaSession.setActionHandler(action,null);}catch(_){}
      });
    }
  }catch(_){}
}
function unloadAudioOnExit(){
  if(audio){
    try{audio.pause();audio.currentTime=0;audio.removeAttribute("src");audio.load();}catch(_){}
  }
  clearSystemMediaControls();
  updateMusicButton(false);
}
function restoreAudioSource(){
  if(audio&&!audio.getAttribute("src")){
    audio.setAttribute("src","./musica_yahirfest.mp3");
    audio.loop=true;
    audio.load();
  }
}

audio?.addEventListener("play",()=>updateMusicButton(true));
audio?.addEventListener("pause",()=>updateMusicButton(false));
document.addEventListener("visibilitychange",()=>{
  if(document.hidden)unloadAudioOnExit();
  else restoreAudioSource();
});
window.addEventListener("pagehide",unloadAudioOnExit);
window.addEventListener("pageshow",restoreAudioSource);

const heroCta=document.querySelector(".hero-cta");
if(heroCta){
  heroCta.addEventListener("click",event=>{
    const target=document.querySelector("#confirmar");
    if(!target)return;
    event.preventDefault();
    const start=window.scrollY;
    const delta=target.getBoundingClientRect().top;
    const duration=760;
    const began=performance.now();
    const previousBehavior=document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior="auto";
    const step=now=>{
      const progress=Math.min(1,(now-began)/duration);
      const eased=1-Math.pow(1-progress,3);
      window.scrollTo(0,start+delta*eased);
      if(progress<1)requestAnimationFrame(step);
      else document.documentElement.style.scrollBehavior=previousBehavior;
    };
    requestAnimationFrame(step);
  });
}
const photo=$("#clubPhoto"), photoFrame=$(".club-photo");
[photo,photoFrame].filter(Boolean).forEach(element=>{
 element.addEventListener("contextmenu",e=>e.preventDefault());
 element.addEventListener("dragstart",e=>e.preventDefault());
 element.addEventListener("selectstart",e=>e.preventDefault());
});

function setStatus(message,error){status.textContent=message;status.classList.toggle("error",Boolean(error));}
function getClientId(){
 try{
  let value=localStorage.getItem(CLIENT_ID_KEY);
  if(value)return value;
  if(window.crypto&&typeof crypto.randomUUID==="function")value=crypto.randomUUID();
  else if(window.crypto&&typeof crypto.getRandomValues==="function"){
   const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);
   value=Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
  }else value="yf-"+Math.random().toString(36).slice(2)+Date.now().toString(36);
  localStorage.setItem(CLIENT_ID_KEY,value);
  return value;
 }catch(_){
  if(!memoryClientId)memoryClientId="yf-"+Math.random().toString(36).slice(2)+Date.now().toString(36);
  return memoryClientId;
 }
}
function hasAlreadySubmitted(){
 try{return localStorage.getItem(SUBMITTED_KEY)==="1";}catch(_){return false;}
}
function lockRsvpForm(message){
 choices.forEach(button=>button.disabled=true);
 guestName.disabled=true;
 submit.disabled=true;
 submit.style.opacity=".55";
 setStatus(message,true);
}
if(hasAlreadySubmitted())lockRsvpForm("Este navegador ya registró una respuesta. Solo se permite una confirmación por navegador.");
window.addEventListener("storage",event=>{
 if(event.key===SUBMITTED_KEY&&event.newValue==="1")lockRsvpForm("Este navegador ya registró una respuesta. Solo se permite una confirmación por navegador.");
});
choices.forEach(button=>button.addEventListener("click",()=>{
 selected=button.dataset.attending==="true";attendanceField.value=String(selected);
 choices.forEach(item=>item.setAttribute("aria-pressed",String(item===button)));setStatus("");
}));
function getDemo(){try{return JSON.parse(localStorage.getItem(DEMO_KEY)||"[]");}catch(_){return[];}}
function setDemo(list){try{localStorage.setItem(DEMO_KEY,JSON.stringify(list));}catch(_){}}
form.addEventListener("submit",async event=>{
 event.preventDefault();if(saving)return;
 if(hasAlreadySubmitted()){lockRsvpForm("Este navegador ya registró una respuesta. Solo se permite una confirmación por navegador.");return;}
 const name=guestName.value.trim().replace(/\s+/g," ");
 if(selected===null){setStatus("Selecciona «Sí voy a ir» o «No podré ir» para continuar.",true);return;}
 if(name.length<2){setStatus("Escribe tu nombre para registrar la respuesta.",true);guestName.focus();return;}
 if(name.length>80){setStatus("El nombre debe tener máximo 80 caracteres.",true);return;}
 saving=true;submit.disabled=true;submit.style.opacity=".65";submit.querySelector("span").textContent="…";setStatus("Guardando tu respuesta…");
 const row={name,attending:selected,client_id:getClientId()};
 try{
  if(db){
   const {error}=await db.from("yahirfest_rsvps").insert([row]);
   if(error){if(error.code==="23505")throw new Error("Ya se registró una respuesta desde este navegador o ese nombre ya está en la lista. Solo se permite una confirmación por navegador.");if(error.code==="42501"||error.code==="PGRST301")throw new Error("La base de datos rechazó el registro. Revisa las políticas de schema.sql.");throw new Error("No se pudo guardar la respuesta. Revisa la conexión e inténtalo de nuevo.");}
   setStatus(row.attending?"¡Listo! Tu asistencia quedó registrada. ✦":"Respuesta registrada. Gracias por avisar. ✦");
  }else{
   const rows=getDemo();if(rows.some(item=>item.name.toLocaleLowerCase()===name.toLocaleLowerCase()))throw new Error("Ese nombre ya está en la lista de prueba de este navegador.");if(rows.some(item=>item.client_id&&item.client_id===row.client_id))throw new Error("Este navegador ya registró una respuesta. Solo se permite una confirmación por navegador.");
   rows.unshift({...row,created_at:new Date().toISOString(),id:String(Date.now())});setDemo(rows);
   setStatus("Modo de prueba: la respuesta se guardó solo en este navegador. La lista compartida necesita configurar Supabase.");
  }
  try{localStorage.setItem(SUBMITTED_KEY,"1");}catch(_){}
  form.reset();selected=null;attendanceField.value="";choices.forEach(button=>button.setAttribute("aria-pressed","false"));
  choices.forEach(button=>button.disabled=true);guestName.disabled=true;submit.disabled=true;submit.style.opacity=".55";
  setStatus("Respuesta guardada. Este navegador ya no puede enviar otra confirmación.",false);
 }catch(error){setStatus(error.message||"No se pudo guardar. Inténtalo de nuevo.",true);}
 finally{saving=false;submit.disabled=false;submit.style.opacity="";submit.querySelector("span").textContent="↗";}
});
})();