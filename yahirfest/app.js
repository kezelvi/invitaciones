(() => {
"use strict";
const EVENT_DATE = new Date("2026-11-21T19:00:00-06:00");
const REMINDER_DATE = new Date(EVENT_DATE.getTime() - 86400000);
const DEMO_KEY = "yahirfest-demo-rsvps";
const REMINDER_KEY = "yahirfest-local-reminders";
const config = window.YAHIRFEST_CONFIG || {};
const hasCloudConfig = Boolean(window.supabase && /^https:\/\/.+/.test(config.supabaseUrl || "") && (config.supabaseAnonKey || "").length > 20 && !String(config.supabaseUrl).includes("PEGA_AQUI") && !String(config.supabaseAnonKey).includes("PEGA_AQUI"));
const db = hasCloudConfig ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey) : null;
const $ = (selector) => document.querySelector(selector);
const musicToggle = $("#musicToggle"), musicLabel = $("#musicLabel"), rsvpForm = $("#rsvpForm"), guestName = $("#guestName"), reminderInput = $("#reminder"), statusNode = $("#rsvpStatus"), submitButton = $("#submitRsvp");
const choiceButtons = [...document.querySelectorAll("[data-attending]")];
const attendingValue = $("#attendingValue");
let selectedAttendance = null, submitting = false;

function updateCountdown() {
  const remaining = Math.max(0, EVENT_DATE.getTime() - Date.now());
  $("#days").textContent = String(Math.floor(remaining / 86400000)).padStart(2,"0");
  $("#hours").textContent = String(Math.floor((remaining % 86400000) / 3600000)).padStart(2,"0");
  $("#minutes").textContent = String(Math.floor((remaining % 3600000) / 60000)).padStart(2,"0");
  $("#seconds").textContent = String(Math.floor((remaining % 60000) / 1000)).padStart(2,"0");
  if (remaining === 0) $("#countdownCaption").textContent = "¡ES HOY! · YAHIR-FEST";
}
updateCountdown(); window.setInterval(updateCountdown,1000);

// Loop musical sintetizado localmente con Web Audio: no necesita MP3 ni se ejecuta en segundo plano.
let audioContext = null, masterGain = null, scheduler = null, musicOn = false, beatStep = 0, noiseBuffer = null;
const bpm = 112, stepDuration = 60 / bpm / 4;
function ensureAudio() {
  if (audioContext && audioContext.state !== "closed") return;
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) throw new Error("Este navegador no permite generar la música.");
  audioContext = new AudioCtor();
  masterGain = audioContext.createGain(); masterGain.gain.value = .22;
  const compressor = audioContext.createDynamicsCompressor();
  compressor.threshold.value = -20; compressor.knee.value = 18; compressor.ratio.value = 4;
  masterGain.connect(compressor); compressor.connect(audioContext.destination);
  noiseBuffer = audioContext.createBuffer(1,audioContext.sampleRate,audioContext.sampleRate);
  const channel = noiseBuffer.getChannelData(0);
  for (let i=0;i<channel.length;i++) channel[i] = Math.random()*2-1;
}
function envelope(gain,start,attack,peak,end) {
  gain.gain.setValueAtTime(.0001,start);
  gain.gain.exponentialRampToValueAtTime(Math.max(.0002,peak),start+attack);
  gain.gain.exponentialRampToValueAtTime(.0001,end);
}
function synthTone(frequency,start,duration,wave,volume,cutoff) {
  const osc=audioContext.createOscillator(), gain=audioContext.createGain(), filter=audioContext.createBiquadFilter();
  osc.type=wave||"sawtooth"; osc.frequency.setValueAtTime(frequency,start); filter.type="lowpass"; filter.frequency.setValueAtTime(cutoff||1800,start); filter.Q.value=.6;
  envelope(gain,start,Math.min(.04,duration/4),volume,start+duration); osc.connect(filter);filter.connect(gain);gain.connect(masterGain);osc.start(start);osc.stop(start+duration+.04);
}
function kick(start) {
  const osc=audioContext.createOscillator(),gain=audioContext.createGain();osc.type="sine";osc.frequency.setValueAtTime(125,start);osc.frequency.exponentialRampToValueAtTime(43,start+.13);
  gain.gain.setValueAtTime(.36,start);gain.gain.exponentialRampToValueAtTime(.0001,start+.24);osc.connect(gain);gain.connect(masterGain);osc.start(start);osc.stop(start+.25);
}
function noiseHit(start,duration,volume,highpass,lowpass) {
  const source=audioContext.createBufferSource(),filter=audioContext.createBiquadFilter(),low=audioContext.createBiquadFilter(),gain=audioContext.createGain();
  source.buffer=noiseBuffer;filter.type="highpass";filter.frequency.value=highpass||1000;low.type="lowpass";low.frequency.value=lowpass||12000;
  envelope(gain,start,.003,volume,start+duration);source.connect(filter);filter.connect(low);low.connect(gain);gain.connect(masterGain);source.start(start);source.stop(start+duration+.01);
}
function scheduleStep() {
  if(!audioContext||audioContext.state!=="running")return;
  const t=audioContext.currentTime+.035,s=beatStep;
  if(s===0||s===8)kick(t);
  if(s===4||s===12){noiseHit(t,.19,.09,900,8000);synthTone(190,t,.12,"triangle",.04,900);}
  if(s%2===0)noiseHit(t,.045,s%4===0?.027:.016,6500,15000);
  const bass=[46.25,46.25,55,46.25,41.2,41.2,49,41.2,43.65,43.65,52,43.65,38.89,38.89,46.25,38.89];
  if([0,3,4,7,8,11,12,15].includes(s))synthTone(bass[s],t,stepDuration*1.6,"triangle",.13,330);
  const arp=[369.99,440,554.37,493.88,329.63,440,493.88,659.25,369.99,440,554.37,493.88,293.66,369.99,440,554.37];
  if([2,6,10,14].includes(s))synthTone(arp[s],t,stepDuration*1.7,"sine",.045,2400);
  if(s===0)[185,233.08,277.18].forEach((note,i)=>synthTone(note,t,1.7,"sawtooth",.018+i*.004,650));
  beatStep=(beatStep+1)%16;
}
async function startMusic() {
  try {
    ensureAudio();await audioContext.resume();if(musicOn)return;musicOn=true;beatStep=0;scheduleStep();scheduler=window.setInterval(scheduleStep,stepDuration*1000);
    musicToggle.setAttribute("aria-pressed","true");musicToggle.setAttribute("aria-label","Pausar música");musicLabel.textContent="MÚSICA ON";musicToggle.querySelector(".music-symbol").textContent="Ⅱ";
  } catch(error) { setStatus("No se pudo iniciar el audio en este navegador. Prueba con otro toque.",true); }
}
function pauseMusic(closeContext) {
  musicOn=false;if(scheduler)window.clearInterval(scheduler);scheduler=null;
  musicToggle.setAttribute("aria-pressed","false");musicToggle.setAttribute("aria-label","Reproducir música");musicLabel.textContent="MÚSICA OFF";musicToggle.querySelector(".music-symbol").textContent="♫";
  if(audioContext&&audioContext.state!=="closed"){if(closeContext){audioContext.close().catch(()=>{});audioContext=null;masterGain=null;noiseBuffer=null;}else audioContext.suspend().catch(()=>{});}
}
musicToggle.addEventListener("click",()=>musicOn?pauseMusic(false):startMusic());
function userInteraction(event){if(event.target instanceof Element&&event.target.closest("#musicToggle"))return;if(!musicOn)startMusic();}
document.addEventListener("pointerdown",userInteraction,{passive:true,capture:true});
document.addEventListener("keydown",(event)=>{if(["INPUT","TEXTAREA"].includes(document.activeElement?.tagName)){if(event.key==="Tab")userInteraction(event);return;}if(!["Shift","Control","Alt","Meta"].includes(event.key))userInteraction(event);},{capture:true});
document.addEventListener("visibilitychange",()=>{if(document.hidden)pauseMusic(false);});
window.addEventListener("pagehide",()=>pauseMusic(true),{once:true});

function setStatus(message,error){statusNode.textContent=message;statusNode.classList.toggle("error",Boolean(error));}
choiceButtons.forEach((button)=>button.addEventListener("click",()=>{selectedAttendance=button.dataset.attending==="true";attendingValue.value=String(selectedAttendance);choiceButtons.forEach((item)=>item.setAttribute("aria-pressed",String(item===button)));setStatus("");}));
reminderInput.addEventListener("change",async()=>{if(reminderInput.checked&&"Notification"in window&&Notification.permission==="default"){try{await Notification.requestPermission();}catch(_){}}if(reminderInput.checked&&!("Notification"in window))setStatus("Tu navegador no admite notificaciones. La preferencia puede guardarse de todas formas.",true);});
function readLocal(key){try{return JSON.parse(localStorage.getItem(key)||"[]");}catch(_){return[];}}
function writeLocal(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch(_){}}
function saveLocalReminder(name){const list=readLocal(REMINDER_KEY).filter((item)=>item.name.toLocaleLowerCase()!==name.toLocaleLowerCase());list.push({name,remindAt:REMINDER_DATE.getTime(),eventAt:EVENT_DATE.getTime(),sent:false});writeLocal(REMINDER_KEY,list);}
async function requestReminderPermission(){if(!("Notification"in window))return false;if(Notification.permission==="granted")return true;if(Notification.permission==="denied")return false;try{return(await Notification.requestPermission())==="granted";}catch(_){return false;}}
function startLocalReminderWatcher(){
  const check=()=>{if(document.hidden||!("Notification"in window)||Notification.permission!=="granted")return;const now=Date.now(),list=readLocal(REMINDER_KEY);let changed=false;
    list.forEach((item)=>{if(!item.sent&&now>=item.remindAt&&now<item.eventAt){try{new Notification("Mañana es Yahir-fest ✦",{body:"Tu recordatorio para la noche de alberca y neón. Nos vemos a las 7:00 PM.",tag:"yahirfest-"+item.name.toLocaleLowerCase()});item.sent=true;changed=true;}catch(_){}}});
    if(changed)writeLocal(REMINDER_KEY,list);
  };check();window.setInterval(check,60000);
}
startLocalReminderWatcher();

rsvpForm.addEventListener("submit",async(event)=>{
  event.preventDefault();if(submitting)return;
  const name=guestName.value.trim().replace(/\s+/g," ");
  if(selectedAttendance===null){setStatus("Selecciona «Sí voy a ir» o «No podré ir» para continuar.",true);return;}
  if(name.length<2){setStatus("Escribe tu nombre completo para registrar la respuesta.",true);guestName.focus();return;}
  if(name.length>80){setStatus("El nombre debe tener máximo 80 caracteres.",true);return;}
  submitting=true;submitButton.disabled=true;submitButton.style.opacity=".65";submitButton.querySelector("span").textContent="…";setStatus("Guardando tu respuesta…");
  const record={name,attending:selectedAttendance,reminder:reminderInput.checked};
  try{
    if(db){
      const {error}=await db.from("yahirfest_rsvps").insert([record]);
      if(error){if(error.code==="23505")throw new Error("Ya existe una respuesta con ese nombre. Si necesitas corregirla, contacta al anfitrión.");if(error.code==="42501"||error.code==="PGRST301")throw new Error("La base de datos rechazó el registro. Revisa las políticas del archivo schema.sql.");throw new Error("No se pudo guardar en la lista compartida. Revisa la conexión e inténtalo otra vez.");}
      if(record.reminder&&await requestReminderPermission())saveLocalReminder(name);
      setStatus(record.attending?"¡Listo! Tu asistencia quedó registrada en la lista de Yahir-fest. ✦":"Respuesta registrada. Gracias por avisar; te extrañaremos. ✦");
    }else{
      const list=readLocal(DEMO_KEY);if(list.some((item)=>item.name.toLocaleLowerCase()===name.toLocaleLowerCase()))throw new Error("Ese nombre ya está en la lista de prueba de este navegador.");
      list.unshift({...record,created_at:new Date().toISOString(),id:String(Date.now())});writeLocal(DEMO_KEY,list);
      if(record.reminder&&await requestReminderPermission())saveLocalReminder(name);
      setStatus("Modo de prueba: respuesta guardada solo en este navegador. La lista compartida se activa al configurar Supabase.");
    }
    rsvpForm.reset();selectedAttendance=null;attendingValue.value="";choiceButtons.forEach((button)=>button.setAttribute("aria-pressed","false"));
  }catch(error){setStatus(error.message||"Ocurrió un error al guardar. Inténtalo de nuevo.",true);}
  finally{submitting=false;submitButton.disabled=false;submitButton.style.opacity="";submitButton.querySelector("span").textContent="↗";}
});
})();