(() => {
"use strict";
const DEMO_KEY="yahirfest-demo-rsvps",config=window.YAHIRFEST_CONFIG||{};
const ready=Boolean(window.supabase&&/^https:\/\/.+/.test(config.supabaseUrl||"")&&(config.supabaseAnonKey||"").length>20&&!String(config.supabaseUrl).includes("PEGA_AQUI")&&!String(config.supabaseAnonKey).includes("PEGA_AQUI"));
const db=ready?window.supabase.createClient(config.supabaseUrl,config.supabaseAnonKey):null;
const $=s=>document.querySelector(s);
const configNotice=$("#configNotice"),loginPanel=$("#loginPanel"),dashboard=$("#dashboard"),loginStatus=$("#loginStatus"),connectionStatus=$("#connectionStatus"),guestRows=$("#guestRows"),toast=$("#toast");
let currentRows=[],realtimeChannel=null,toastTimer=null,isDemo=!ready;
if(isDemo){configNotice.hidden=false;loginPanel.hidden=true;dashboard.hidden=false;connectionStatus.textContent="Modo de prueba · solo este navegador";renderRows(readDemoRows());}else checkSession();
function readDemoRows(){try{return JSON.parse(localStorage.getItem(DEMO_KEY)||"[]");}catch(_){return[];}}
function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));}
function showToast(message){toast.textContent=message;toast.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove("show"),5200);}
function setLoginMessage(message,error){loginStatus.textContent=message||"";loginStatus.classList.toggle("error",Boolean(error));}
async function checkSession(){loginPanel.hidden=false;dashboard.hidden=true;configNotice.hidden=true;if(!db)return;const {data,error}=await db.auth.getSession();if(error){setLoginMessage("No se pudo comprobar la sesión. Revisa la configuración de Supabase.",true);return;}if(data.session)showDashboard();}
$("#loginForm").addEventListener("submit",async e=>{e.preventDefault();if(!db)return;const email=$("#adminEmail").value.trim(),password=$("#adminPassword").value,button=$("#loginButton");button.disabled=true;setLoginMessage("Validando acceso…");const {error}=await db.auth.signInWithPassword({email,password});button.disabled=false;if(error){setLoginMessage("No se pudo iniciar sesión. Verifica correo y contraseña.",true);return;}setLoginMessage("");showDashboard();});
async function showDashboard(){isDemo=false;loginPanel.hidden=true;dashboard.hidden=false;configNotice.hidden=true;connectionStatus.textContent="Conectando con la lista…";await loadRows();subscribeRealtime();}
async function loadRows(){if(isDemo){renderRows(readDemoRows());return;}const {data,error}=await db.from("yahirfest_rsvps").select("id,name,attending,created_at").order("created_at",{ascending:false});if(error){connectionStatus.textContent="Error al leer la lista";showToast("No se pudo consultar la lista. Revisa los permisos y la sesión administrativa.");return;}connectionStatus.textContent="Lista sincronizada · en vivo";renderRows(data||[]);}
function renderRows(rows){
 currentRows=Array.isArray(rows)?rows:[];
 const yes=currentRows.filter(row=>row.attending===true).length,no=currentRows.filter(row=>row.attending===false).length;
 $("#yesCount").textContent=String(yes);$("#noCount").textContent=String(no);
 const filter=($("#searchGuests").value||"").trim().toLocaleLowerCase(),filtered=currentRows.filter(row=>String(row.name||"").toLocaleLowerCase().includes(filter));
 if(!filtered.length){guestRows.innerHTML='<tr><td colspan="3" class="empty-cell">'+(currentRows.length?"No hay coincidencias con esa búsqueda.":"Todavía no hay respuestas registradas.")+"</td></tr>";return;}
 guestRows.innerHTML=filtered.map(row=>{
  const yes=row.attending===true,date=row.created_at?new Date(row.created_at):null;
  const dateText=date&&!Number.isNaN(date.getTime())?date.toLocaleString("es-MX",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}):"—";
  return "<tr><td class=\"guest-name\">"+escapeHtml(row.name)+"</td><td><span class=\"attendance-badge "+(yes?"yes":"no")+"\">"+(yes?"● Sí":"● No")+"</span></td><td class=\"registered-date\">"+escapeHtml(dateText)+"</td></tr>";
 }).join("");
}
$("#searchGuests").addEventListener("input",()=>renderRows(currentRows));
$("#refreshButton").addEventListener("click",()=>isDemo?renderRows(readDemoRows()):loadRows());
function subscribeRealtime(){if(!db||realtimeChannel)return;realtimeChannel=db.channel("yahirfest-rsvp-feed").on("postgres_changes",{event:"INSERT",schema:"public",table:"yahirfest_rsvps"},payload=>{
 loadRows();const name=payload.new?.name||"Un invitado",message=name+(payload.new?.attending===true?" confirmó que sí asistirá.":" avisó que no podrá ir.");showToast("Nueva respuesta · "+message);
 if("Notification"in window&&Notification.permission==="granted"){try{new Notification("Yahir-fest · nueva respuesta",{body:message,tag:"yahirfest-admin-"+(payload.new?.id||Date.now())});}catch(_){}}
}).subscribe(state=>{const dot=document.querySelector(".live-dot");if(state==="SUBSCRIBED"){connectionStatus.textContent="Lista sincronizada · en vivo";dot?.classList.add("online");}else if(state==="CHANNEL_ERROR"||state==="TIMED_OUT"){connectionStatus.textContent="Sin conexión en vivo · usa Actualizar";dot?.classList.remove("online");}});}
$("#notificationsButton").addEventListener("click",async()=>{if(!("Notification"in window)){showToast("Este navegador no admite avisos de escritorio.");return;}if(Notification.permission==="granted"){showToast("Los avisos del navegador están activados. Mantén este panel abierto para recibirlos.");return;}const permission=await Notification.requestPermission();showToast(permission==="granted"?"Avisos activados. Llegarán mientras el panel esté abierto.":"No se concedió permiso para los avisos.");});
$("#logoutButton").addEventListener("click",async()=>{if(realtimeChannel&&db){await db.removeChannel(realtimeChannel);realtimeChannel=null;}if(db)await db.auth.signOut();loginPanel.hidden=false;dashboard.hidden=true;$("#adminPassword").value="";setLoginMessage("Sesión cerrada.");});
window.addEventListener("storage",event=>{if(event.key===DEMO_KEY&&isDemo)renderRows(readDemoRows());});
})();