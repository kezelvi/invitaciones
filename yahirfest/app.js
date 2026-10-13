(() => {
"use strict";
const EVENT_DATE=new Date("2026-11-21T19:00:00-06:00");
const DEMO_KEY="yahirfest-demo-rsvps";
const config=window.YAHIRFEST_CONFIG||{};
const cloudReady=Boolean(window.supabase&&/^https:\/\/.+/.test(config.supabaseUrl||"")&&(config.supabaseAnonKey||"").length>20&&!String(config.supabaseUrl).includes("PEGA_AQUI")&&!String(config.supabaseAnonKey).includes("PEGA_AQUI"));
const db=cloudReady?window.supabase.createClient(config.supabaseUrl,config.supabaseAnonKey):null;
const $=s=>document.querySelector(s);
const audio=$("#backgroundMusic"),musicToggle=$("#musicToggle"),musicLabel=$("#musicLabel"),form=$("#rsvpForm"),guestName=$("#guestName"),status=$("#rsvpStatus"),submit=$("#submitRsvp");
const choices=[...document.querySelectorAll("[data-attending]")],attendanceField=$("#attendingValue");
let selected=null,saving=false,manuallyPaused=false;
if(audio){audio.loop=true;audio.volume=.78;audio.setAttribute("playsinline","");}
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
audio?.addEventListener("play",()=>updateMusicButton(true));
audio?.addEventListener("pause",()=>updateMusicButton(false));
document.addEventListener("visibilitychange",()=>{if(document.hidden&&audio){audio.pause();}});
window.addEventListener("pagehide",()=>{if(audio){audio.pause();audio.currentTime=0;}updateMusicButton(false);},{once:true});

const photo=$("#clubPhoto");
if(photo){
 photo.addEventListener("contextmenu",e=>e.preventDefault());
 photo.addEventListener("dragstart",e=>e.preventDefault());
 photo.addEventListener("selectstart",e=>e.preventDefault());
}

function setStatus(message,error){status.textContent=message;status.classList.toggle("error",Boolean(error));}
choices.forEach(button=>button.addEventListener("click",()=>{
 selected=button.dataset.attending==="true";attendanceField.value=String(selected);
 choices.forEach(item=>item.setAttribute("aria-pressed",String(item===button)));setStatus("");
}));
function getDemo(){try{return JSON.parse(localStorage.getItem(DEMO_KEY)||"[]");}catch(_){return[];}}
function setDemo(list){try{localStorage.setItem(DEMO_KEY,JSON.stringify(list));}catch(_){}}
form.addEventListener("submit",async event=>{
 event.preventDefault();if(saving)return;
 const name=guestName.value.trim().replace(/\s+/g," ");
 if(selected===null){setStatus("Selecciona «Sí voy a ir» o «No podré ir» para continuar.",true);return;}
 if(name.length<2){setStatus("Escribe tu nombre para registrar la respuesta.",true);guestName.focus();return;}
 if(name.length>80){setStatus("El nombre debe tener máximo 80 caracteres.",true);return;}
 saving=true;submit.disabled=true;submit.style.opacity=".65";submit.querySelector("span").textContent="…";setStatus("Guardando tu respuesta…");
 const row={name,attending:selected};
 try{
  if(db){
   const {error}=await db.from("yahirfest_rsvps").insert([row]);
   if(error){if(error.code==="23505")throw new Error("Ya existe una respuesta con ese nombre. Si necesitas corregirla, contacta al anfitrión.");if(error.code==="42501"||error.code==="PGRST301")throw new Error("La base de datos rechazó el registro. Revisa las políticas de schema.sql.");throw new Error("No se pudo guardar la respuesta. Revisa la conexión e inténtalo de nuevo.");}
   setStatus(row.attending?"¡Listo! Tu asistencia quedó registrada. ✦":"Respuesta registrada. Gracias por avisar. ✦");
  }else{
   const rows=getDemo();if(rows.some(item=>item.name.toLocaleLowerCase()===name.toLocaleLowerCase()))throw new Error("Ese nombre ya está en la lista de prueba de este navegador.");
   rows.unshift({...row,created_at:new Date().toISOString(),id:String(Date.now())});setDemo(rows);
   setStatus("Modo de prueba: la respuesta se guardó solo en este navegador. La lista compartida necesita configurar Supabase.");
  }
  form.reset();selected=null;attendanceField.value="";choices.forEach(button=>button.setAttribute("aria-pressed","false"));
 }catch(error){setStatus(error.message||"No se pudo guardar. Inténtalo de nuevo.",true);}
 finally{saving=false;submit.disabled=false;submit.style.opacity="";submit.querySelector("span").textContent="↗";}
});
})();