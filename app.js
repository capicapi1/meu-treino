
// Personalização da saudação
function getGreeting(){
  return localStorage.getItem("capiGreeting") || "Bem-vindo";
}
function saveGreeting(value){
  const v = (value || "").trim();
  localStorage.setItem("capiGreeting", v || "Bem-vindo");
}


/* CAPI_STRONG_BEEP_V3 */
let capiAudioCtx = null;
let capiAudioReady = false;

function capiInitAudio(){
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!capiAudioCtx) capiAudioCtx = new AC();
    if (capiAudioCtx.state === "suspended") capiAudioCtx.resume();
    capiAudioReady = true;
  } catch(e) {}
}

function capiTone(freq, duration=0.16, volume=0.95, delay=0){
  if (!capiAudioCtx) return;
  const t = capiAudioCtx.currentTime + delay;
  const osc = capiAudioCtx.createOscillator();
  const gain = capiAudioCtx.createGain();
  osc.type = "square";
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain);
  gain.connect(capiAudioCtx.destination);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

function capiRestFinishedSound(){
  capiInitAudio();
  if (!capiAudioReady) return;
  // Three attention beeps, followed by a longer, stronger final alert.
  capiTone(1250, 0.13, 0.9, 0.00);
  capiTone(1250, 0.13, 0.9, 0.20);
  capiTone(1250, 0.13, 0.9, 0.40);
  capiTone(900,  0.55, 1.0, 0.72);
}

// Unlock/resume Web Audio from a real user gesture.
document.addEventListener("touchstart", capiInitAudio, {passive:true});
document.addEventListener("pointerdown", capiInitAudio, {passive:true});
document.addEventListener("click", capiInitAudio, {passive:true});

const KEY = "meuTreinoStateV1";
const PHOTO_DB = "meuTreinoPhotosV1";
let state = loadState();
let currentWorkoutId = null;
let currentEditorId = null;
let timer = null;
let seconds = 0;
let timerExerciseId = null;
let completed = new Set();
let audioContext = null;

const colors = {
  Azul:"#007AFF", Amarelo:"#FFCC00", Roxo:"#AF52DE",
  Verde:"#34C759", Vermelho:"#FF3B30", Rosa:"#FF2D55"
};

function uid(){ return crypto.randomUUID ? crypto.randomUUID() : Date.now()+"-"+Math.random(); }
function loadState(){
  try{
    const s=JSON.parse(localStorage.getItem(KEY));
    if(s) return s;
  }catch(e){}
  return {configured:false,userName:"",theme:"Azul",workouts:[
    {id:uid(),name:"Treino A",exercises:[
      {id:uid(),name:"Supino reto",sets:4,reps:10,weight:20,rest:60,photoKey:uid()}
    ]}
  ]};
}
function saveState(){localStorage.setItem(KEY,JSON.stringify(state));}
function accent(){return colors[state.theme]||colors.Azul}
function esc(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function toast(msg){const t=document.querySelector("#toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),1800)}
function setTheme(){document.documentElement.style.setProperty("--accent",accent())}
function render(){setTheme(); state.configured ? renderHome() : renderWelcome()}

function renderWelcome(){
  app.innerHTML=`<section class="welcome">
    <div class="logo">🏋️</div>
    <h1>Bem-vindo!</h1>
    <p>Monte seus treinos e acompanhe cada série.</p>
    <label class="label">Seu nome</label>
    <input id="welcomeName" type="text" placeholder="Seu nome" value="${esc(state.userName)}">
    <label class="label">Cor favorita</label>
    <div class="segmented">${Object.keys(colors).map(c=>`<button class="${state.theme===c?'active':''}" data-theme="${c}">${c}</button>`).join("")}</div>
    <button class="primary full" id="start">Começar</button>
  </section>`;
  document.querySelectorAll("[data-theme]").forEach(b=>b.onclick=()=>{state.theme=b.dataset.theme;saveState();renderWelcome();});
  document.querySelector("#start").onclick=()=>{
    state.userName=(document.querySelector("#welcomeName").value||"Atleta").trim();
    if(!state.userName)state.userName="Atleta"; state.configured=true; saveState(); render();
  };
}

function renderHome(){
  app.innerHTML=`<header class="header">
    <div class="header-copy"><h1>Bem-vindo, ${esc(state.userName||"Atleta")}</h1><p>Qual treino vamos fazer hoje?</p></div>
    <button class="icon-btn" id="menuBtn">⚙️</button>
  </header>
  <section>${state.workouts.length?state.workouts.map(w=>`<button class="workout-card" data-workout="${w.id}">
    <span class="dumbbell">🏋️</span><span class="name">${esc(w.name)}</span><span class="count">${w.exercises.length} exercício${w.exercises.length===1?'':'s'}</span>
  </button>`).join(""):`<div class="empty">Nenhum treino ainda.</div>`}</section>`;
  document.querySelectorAll("[data-workout]").forEach(b=>b.onclick=()=>openSession(b.dataset.workout));
  document.querySelector("#menuBtn").onclick=openMenu;
}

function openMenu(){
  showModal(`<div class="modal-header"><h2>Configurações</h2><button class="close" onclick="closeModal()">×</button></div>
    <button class="secondary full" onclick="openManage()">Gerenciar treinos</button>
    <div class="spacer"></div>
    <button class="secondary full" onclick="openSettings()">Personalização</button>`);
}

function showModal(content){let x=document.createElement("div");x.id="modal";x.className="modal-backdrop";x.innerHTML=`<div class="modal">${content}</div>`;document.body.appendChild(x)}
function closeModal(){document.querySelector("#modal")?.remove()}

function openSession(id){
  const w=state.workouts.find(x=>x.id===id); if(!w)return;
  currentWorkoutId=id; completed=new Set(); seconds=0; timerExerciseId=null;
  showModal(`<div class="modal-header"><h2>${esc(w.name)}</h2><button class="close" onclick="closeModal()">×</button></div>
  ${w.exercises.map(ex=>exerciseHTML(ex)).join("")}
  <button class="primary full" onclick="closeModal()">Finalizar treino</button>`);
  hydratePhotos();
}
function exerciseHTML(ex){
  return `<article class="exercise">
    <h3>${esc(ex.name)}</h3>
    <div id="photo-${ex.id}"></div>
    <div class="meta">${ex.sets} séries • ${ex.reps} repetições • ${ex.weight} kg</div>
    <div id="rest-${ex.id}"></div>
    ${Array.from({length:ex.sets},(_,i)=>{const k=ex.id+"-"+(i+1);return `<button class="set-btn ${completed.has(k)?'done':''}" data-set="${k}" data-ex="${ex.id}"><span>Série ${i+1}</span><span>${completed.has(k)?"Feita ✓":"Marcar"}</span></button>`}).join("")}
  </article>`;
}
async function hydratePhotos(){
  const w=state.workouts.find(x=>x.id===currentWorkoutId);if(!w)return;
  for(const ex of w.exercises){
    const data=await getPhoto(ex.photoKey);
    if(data){const box=document.querySelector("#photo-"+ex.id);if(box)box.innerHTML=`<img src="${data}" alt="">`;}
  }
}
document.addEventListener("click",async e=>{
  const b=e.target.closest("[data-set]"); if(!b)return;
  const [eid,set]=b.dataset.set.split("-");
  completed.add(b.dataset.set); b.classList.add("done"); b.querySelector("span:last-child").textContent="Feita ✓";
  const w=state.workouts.find(x=>x.id===currentWorkoutId), ex=w?.exercises.find(x=>x.id===b.dataset.ex);
  if(ex){await startRest(ex.id,ex.rest)}
});

function getAudioContext(){
  if(!audioContext){
    const Ctx=window.AudioContext||window.webkitAudioContext;
    if(!Ctx)return null;
    audioContext=new Ctx();
  }
  return audioContext;
}
async function unlockAudio(){
  const ctx=getAudioContext(); if(!ctx)return false;
  try{
    if(ctx.state==='suspended') await ctx.resume();
    return ctx.state==='running';
  }catch(e){ return false; }
}
async function playBeep(){
  const ctx=getAudioContext(); if(!ctx)return false;
  try{
    if(ctx.state==='suspended') await ctx.resume();
    if(ctx.state!=='running')return false;
    const start=ctx.currentTime+0.03;
    // Three loud, short tones designed to be easy to hear from a nearby iPhone.
    [0,0.28,0.56].forEach((delay,i)=>{
      const now=start+delay;
      const osc=ctx.createOscillator();
      const gain=ctx.createGain();
      osc.type='square';
      osc.frequency.setValueAtTime([740,880,1046][i],now);
      gain.gain.setValueAtTime(0.0001,now);
      gain.gain.exponentialRampToValueAtTime(0.42,now+0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001,now+0.22);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(now); osc.stop(now+0.24);
    });
    return true;
  }catch(e){ return false; }
}
async function startRest(exId,s){
  clearInterval(timer);
  timerExerciseId=exId;
  seconds=Math.max(0,Number(s)||0);
  // This is called directly from the user's tap on the series button.
  // Unlocking audio here gives iOS the user gesture it needs.
  await unlockAudio();
  updateRest();
  if(seconds===0)return;
  timer=setInterval(()=>{
    if(seconds>0){
      seconds--;
      updateRest();
      if(seconds===0){
        clearInterval(timer);
        timer=null;
        capiRestFinishedSound();
      }
    }else{
      clearInterval(timer);
      timer=null;
    }
  },1000);
}
function skipRest(){
  clearInterval(timer);
  timer=null;
  seconds=0;
  updateRest();
}
function updateRest(){
  const box=document.querySelector("#rest-"+timerExerciseId); if(!box)return;
  if(seconds<=0){box.innerHTML="";return}
  const m=String(Math.floor(seconds/60)).padStart(2,"0"),s=String(seconds%60).padStart(2,"0");
  box.innerHTML=`<div class="rest"><strong>Descanso ${m}:${s}</strong><div class="rest-actions"><button onclick="playBeep()">🔊 Testar</button><button onclick="skipRest()">Pular</button></div></div>`;
}

function openManage(){
  closeModal();
  showModal(`<div class="modal-header"><h2>Gerenciar treinos</h2><button class="close" onclick="closeModal()">×</button></div>
    <div id="workoutList">${state.workouts.map(w=>`<div class="list-row"><button onclick="openEditor('${w.id}')">${esc(w.name)}</button><button class="secondary danger" onclick="deleteWorkout('${w.id}')">Excluir</button></div>`).join("")}</div>
    <div class="spacer"></div><button class="primary full" onclick="addWorkout()">Adicionar treino</button>`);
}
function addWorkout(){
  const w={id:uid(),name:"Novo treino",exercises:[{id:uid(),name:"Novo exercício",sets:3,reps:12,weight:0,rest:60,photoKey:uid()}]};
  state.workouts.push(w);saveState();openEditor(w.id);
}
function deleteWorkout(id){if(!confirm("Excluir este treino?"))return;state.workouts=state.workouts.filter(w=>w.id!==id);saveState();openManage()}

function openEditor(id){
  const w=state.workouts.find(x=>x.id===id);if(!w)return;currentEditorId=id;
  showModal(`<div class="modal-header"><h2>Editar treino</h2><button class="close" onclick="closeModal()">×</button></div>
    <label class="label">Nome do treino</label><input id="editWorkoutName" type="text" value="${esc(w.name)}">
    <div id="editorExercises">${w.exercises.map(editorExerciseHTML).join("")}</div>
    <div class="actions"><button class="secondary" onclick="addExercise()">Adicionar exercício</button><button class="primary" onclick="saveEditor()">Salvar</button></div>`);
}
function editorExerciseHTML(ex){
 return `<section class="form-section" data-editor-ex="${ex.id}">
   <h3>${esc(ex.name)}</h3>
   <label class="label">Nome</label><input class="ex-name" type="text" value="${esc(ex.name)}">
   <label class="label">Foto do exercício</label><input class="photo-input" type="file" accept="image/*" data-photo="${ex.photoKey}">
   <div id="preview-${ex.id}"></div>
   <div class="form-row">
    <div><label class="label">Séries</label><input class="ex-sets" type="number" min="1" max="10" value="${ex.sets}"></div>
    <div><label class="label">Repetições</label><input class="ex-reps" type="number" min="1" max="50" value="${ex.reps}"></div>
    <div><label class="label">Carga (kg)</label><input class="ex-weight" type="number" min="0" max="300" value="${ex.weight}"></div>
    <div><label class="label">Descanso (s)</label><input class="ex-rest" type="number" min="0" max="300" step="15" value="${ex.rest}"></div>
   </div>
 </section>`;
}
async function addExercise(){
 const w=state.workouts.find(x=>x.id===currentEditorId);w.exercises.push({id:uid(),name:"Novo exercício",sets:3,reps:12,weight:0,rest:60,photoKey:uid()});openEditor(w.id);
}
document.addEventListener("change",async e=>{
 const input=e.target.closest(".photo-input");if(!input||!input.files[0])return;
 const data=await fileToDataURL(input.files[0]);
 await savePhoto(input.dataset.photo,data);
 const sec=input.closest("[data-editor-ex]");
 const preview=sec?.querySelector("#preview-"+sec.dataset.editorEx);
 if(preview) preview.innerHTML=`<img class="photo-preview" src="${data}" alt="Foto do exercício">`;
 toast("Foto salva");
});
async function saveEditor(){
 const w=state.workouts.find(x=>x.id===currentEditorId);if(!w)return;
 w.name=document.querySelector("#editWorkoutName").value.trim()||"Novo treino";
 document.querySelectorAll("[data-editor-ex]").forEach(sec=>{
  const ex=w.exercises.find(x=>x.id===sec.dataset.editorEx);if(!ex)return;
  ex.name=sec.querySelector(".ex-name").value.trim()||"Novo exercício";
  ex.sets=Math.max(1,Number(sec.querySelector(".ex-sets").value)||1);
  ex.reps=Math.max(1,Number(sec.querySelector(".ex-reps").value)||1);
  ex.weight=Math.max(0,Number(sec.querySelector(".ex-weight").value)||0);
  ex.rest=Math.max(0,Number(sec.querySelector(".ex-rest").value)||0);
 });
 saveState();closeModal();toast("Treino salvo");openManage();
}
function openSettings(){
 if(document.getElementById("capi-greeting")) saveGreeting(document.getElementById("capi-greeting").value);
    closeModal();
 showModal(`
<div class="setting-row">
  <label for="capi-greeting">Saudação</label>
  <input id="capi-greeting" type="text" maxlength="30"
         value="${esc(getGreeting())}" placeholder="Bem-vindo">
</div>
<div class="modal-header"><h2>Personalização</h2><button class="close" onclick="closeModal()">×</button></div>
 <label class="label">Seu nome</label><input id="settingsName" type="text" value="${esc(state.userName)}">
 <div class="spacer"></div><label class="label">Cor principal</label>
 <div class="segmented">${Object.keys(colors).map(c=>`<button class="${state.theme===c?'active':''}" data-settings-theme="${c}">${c}</button>`).join("")}</div>
 <div class="spacer"></div><button class="primary full" onclick="saveSettings()">Pronto</button>`);
 document.querySelectorAll("[data-settings-theme]").forEach(b=>b.onclick=()=>{state.theme=b.dataset.settingsTheme;saveState();openSettings()});
}
function saveSettings(){state.userName=(document.querySelector("#settingsName").value||"Atleta").trim()||"Atleta";saveState();closeModal();render()}

function fileToDataURL(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file)})}
function photoDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open(PHOTO_DB,1);r.onupgradeneeded=()=>r.result.createObjectStore("photos");r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function savePhoto(key,data){
  const db=await photoDB();
  return new Promise((res,rej)=>{
    const tx=db.transaction("photos","readwrite");
    tx.objectStore("photos").put(data,key);
    tx.oncomplete=res;
    tx.onerror=()=>rej(tx.error);
  });
}
async function getPhoto(key){const db=await photoDB();return new Promise((res,rej)=>{const tx=db.transaction("photos","readonly");const q=tx.objectStore("photos").get(key);q.onsuccess=()=>res(q.result||null);q.onerror=()=>rej(q.error)})}

if("serviceWorker" in navigator) window.addEventListener("load",()=>navigator.serviceWorker.register("service-worker.js").catch(()=>{}));
render();

let refreshing=false;
navigator.serviceWorker?.addEventListener("controllerchange",()=>{
  if(refreshing)return;
  refreshing=true;
  window.location.reload();
});
