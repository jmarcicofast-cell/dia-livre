
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signInWithCredential, getRedirectResult, signOut } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app-check.js";
import { getAI, getGenerativeModel, GoogleAIBackend } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-ai.js";
import * as CFG from "../config.js";
import { calcular, temConta } from "./calc.js";
import { icone, COR_CAT } from "./icones.js";
import { TEMAS, CORES_RAPIDAS, FONTES, TAMANHOS, CANTOS, MODOS, VISUAL_PADRAO, aplicarVisual, amostra, fonteUrlTodas } from "./tema.js";
const { firebaseConfig, RECAPTCHA_SITE_KEY, GEMINI_MODEL } = CFG;
const PLUGGY_WORKER_URL = CFG.PLUGGY_WORKER_URL || "";
(function(){
"use strict";
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const pad = n => String(n).padStart(2,"0");
const keyOf = d => d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const parseKey = k => { const [y,m,d]=k.split("-").map(Number); return new Date(y,m-1,d); };
const todayKey = () => keyOf(new Date());
const addDays = (k,n) => { const d=parseKey(k); d.setDate(d.getDate()+n); return keyOf(d); };
const diffDays = (a,b) => Math.round((Date.UTC(...b.split("-").map((v,i)=>i===1?v-1:+v)) - Date.UTC(...a.split("-").map((v,i)=>i===1?v-1:+v)))/864e5);
const brl = v => { v=Math.round((+v||0)*100)/100; return "R$ " + v.toLocaleString("pt-BR",{minimumFractionDigits: v%1?2:0, maximumFractionDigits:2}); };
const num = s => { const v = calcular(s); return isFinite(v)&&v>0 ? v : 0; };

const SENT = ["Ansiedade","Tédio","Tristeza","Solidão","Raiva","Euforia","Cansaço","Medo de faltar","Vontade de me dar algo"];
const SIT = ["Sozinha","À noite","Depois de conversa difícil","Recebi oferta","Vi alguém com dinheiro","Fim de semana","Perto do pagamento","No celular sem fazer nada"];
const BARR = [
  ["bloq","Apaguei e bloqueei os contatos de quem empresta"],
  ["grupos","Saí de grupos e listas onde aparecem ofertas"],
  ["contei","Contei para uma pessoa de confiança"],
  ["acordo","Combinei com essa pessoa: antes de pegar, eu ligo pra ela"],
  ["regra","Regra das 24 horas: nenhuma decisão de dinheiro no mesmo dia da vontade"],
  ["psico","Marquei conversa com psicólogo ou CAPS"],
  ["dividas","Listei o que ainda devo e para quem"]
];
const MILES = [1,3,7,14,21,30,60,90,180,365];
const FIN_DEF = () => ({renda:0, contas:[], pagos:{}, dividas:[], lanc:[], orc:{}, cats:[], cartoes:[], fatPagas:{}, auto:true,
  banco:{url:"", items:[], contas:[], ult:0, regras:{}, desde:"", apagados:[], erro:""}});
const DEF = () => ({
  v:1, inicio: todayKey(), recorde:0, dias:{}, vontades:[],
  motivos:["Quero dormir tranquila, sem medo de cobrança.","Meu dinheiro é para a minha família, não para juros.","Eu não preciso desse dinheiro. Eu preciso de calma.","Cada dia livre prova que eu consigo."],
  carta:"", barreiras:{}, contato:{nome:"",tel:""}, taxa:20, chat:[],
  nome:"", objetivos:[], visual:VISUAL_PADRAO(), fin:FIN_DEF()
});
const uid = () => Math.random().toString(36).slice(2,9);
const monthKey = () => todayKey().slice(0,7);

let S = DEF();
let saveRef = null, saving = Promise.resolve(), saveTimer = null, sample = null;

/* ---------- Persistência ---------- */
function setSync(ok){ const e=$("#sync"); e.textContent = ok ? "Sincronizado" : "Neste aparelho"; e.classList.toggle("off",!ok); }
function loadLocal(){ try{ const r = localStorage.getItem("dialivre"); if(r) return JSON.parse(r); }catch(e){} return null; }
function merge(o){
  const d = DEF(); const r = Object.assign(d, o||{});
  r.fin = Object.assign(FIN_DEF(), (o&&o.fin)||{});
  r.fin.banco = Object.assign(FIN_DEF().banco, (o&&o.fin&&o.fin.banco)||{});
  r.visual = Object.assign(VISUAL_PADRAO(), (o&&o.visual)||{});
  r.contato = Object.assign({nome:"",tel:""}, r.contato||{});
  if(!(r.v>=2)){ // versão 2: dívidas guardam quanto falta pagar já com juros
    r.fin.dividas.forEach(dv=>{ if(dv.total==null){ dv.total = (dv.parc && dv.parc>=dv.saldo) ? dv.parc : Math.round(dv.saldo*(1+(dv.juros||0)/100)*100)/100; } });
    r.v = 2;
  }
  r.fin.dividas.forEach(dv=>{ if(!dv.inicio){ dv.inicio=monthKey(); dv.dia=+todayKey().slice(8); } dv.pagMes=dv.pagMes||{}; });
  return r;
}
function save(){
  try{ localStorage.setItem("dialivre", JSON.stringify(S)); }catch(e){}
  if(!saveRef) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(()=>{
    const snap = JSON.parse(JSON.stringify(S));
    saving = saving.then(()=>saveRef.set(snap)).then(()=>{ setSync(true); }).catch(()=>{ setSync(false); });
  }, 700);
}
/* Firebase: login Google, Firestore (users/{uid}) e IA Gemini pelo Firebase AI Logic */
const configured = firebaseConfig && firebaseConfig.apiKey && !/COLE/i.test(firebaseConfig.apiKey);
let auth=null, fs=null;
function geminiSample(model){
  return async (input, opts={}) => {
    let turns = typeof input==="string" ? [{role:"user",content:input}] : input;
    const contents=[];
    turns.forEach(t=>{ const role=t.role==="assistant"?"model":"user"; const last=contents[contents.length-1];
      if(last && last.role===role) last.parts[0].text += "\n\n"+t.content; else contents.push({role, parts:[{text:t.content}]}); });
    let text="";
    // Primeiro tenta a IA pelo servidor da Cloudflare (chave do AI Studio). Se ele ainda não tiver a chave,
    // usa o Firebase AI Logic, como antes.
    const srv=(PLUGGY_WORKER_URL||"").trim().replace(/\/+$/,"");
    if(srv && auth && auth.currentUser){
      let r=null, j={};
      try{ r=await fetch(srv+"/ia",{method:"POST",signal:opts.signal,headers:{"Content-Type":"application/json","Authorization":"Bearer "+await auth.currentUser.getIdToken()},body:JSON.stringify({contents,model:GEMINI_MODEL||"gemini-3.8-flash"})}); j=await r.json().catch(()=>({})); }
      catch(e){ if(opts.signal && opts.signal.aborted) throw {code:"cancelled"}; r=null; }
      if(r && r.ok && j.text && j.text.trim()){ opts.onText && opts.onText({text:j.text, delta:j.text}); return {text:j.text, truncated:false}; }
      if(r && r.status===429) throw {code:"rate_limited", message:j.erro||""};
      if(r && j.erro && !/Falta configurar GEMINI_API_KEY|Rota não encontrada/.test(j.erro)) throw {code:"upstream_error", message:"Servidor: "+j.erro+(r.status===401?await (async()=>{ let x=""; try{ const t=await auth.currentUser.getIdToken(); const pl=JSON.parse(decodeURIComponent(escape(atob(t.split(".")[1].replace(/-/g,"+").replace(/_/g,"/"))))); x=" [projeto: "+pl.aud+", verificado: "+(pl.email_verified?"sim":"não")+", login: "+((pl.firebase&&pl.firebase.sign_in_provider)||"?")+", token: "+t.length+"]"; }catch(_){ x=" [não li o token]"; } return " (Você está no app com: "+(auth.currentUser.email||"e-mail desconhecido")+")"+x; })():"")};
    }
    try{
      const res = await model.generateContentStream({contents});
      for await (const ch of res.stream){
        if(opts.signal && opts.signal.aborted) throw {code:"cancelled", text};
        const d = ch.text(); if(d){ text+=d; opts.onText && opts.onText({text, delta:d}); }
      }
    }catch(e){
      if(e && e.code==="cancelled") throw e;
      const m=String(e&&e.message||e);
      throw {code: /429|quota|RESOURCE_EXHAUSTED/i.test(m) ? "rate_limited" : /permission|403|app.?check|api.*not.*enabled/i.test(m) ? "not_granted" : "upstream_error", message:m, text:text||undefined};
    }
    if(!text.trim()) throw {code:"empty_completion"};
    return {text, truncated:false};
  };
}
async function connect(){
  if(!configured){
    $("#aj-store").textContent="Firebase ainda não configurado: seus registros ficam salvos só neste aparelho.";
    sampleChecked=true; hideAI(); return;
  }
  const app = initializeApp(firebaseConfig);
  if(RECAPTCHA_SITE_KEY){ try{ initializeAppCheck(app,{provider:new ReCaptchaV3Provider(RECAPTCHA_SITE_KEY), isTokenAutoRefreshEnabled:true}); }catch(e){} }
  auth = getAuth(app); auth.languageCode="pt"; fs = getFirestore(app);
  try{ const ai = getAI(app,{backend:new GoogleAIBackend()}); sample = geminiSample(getGenerativeModel(ai,{model:GEMINI_MODEL||"gemini-3.8-flash"})); }catch(e){ sample=null; }
  sampleChecked=true; if(!sample) hideAI();
  const erroLogin = e => {
    const c=(e&&e.code)||"";
    const msg = /popup-closed|cancelled-popup/.test(c) ? "A janela do Google foi fechada antes de terminar. Toque de novo e escolha a conta."
      : /unauthorized-domain/.test(c) ? "Este endereço não está autorizado no Firebase."
      : /network/.test(c) ? "Sem internet. Confira a conexão e tente de novo."
      : /web-storage|storage/.test(c) ? "O navegador bloqueou o login. Abra o Dia Livre no Safari (não pelo atalho da tela inicial) e tente de novo."
      : "Não foi possível entrar. Tente de novo.";
    $("#login-err").textContent = msg + (c ? " ("+c.replace("auth/","")+")" : "");
  };
  // Login direto pelo Google (sem a janela do Firebase). No iPhone, a janela e o redirecionamento do Firebase
  // perdem a resposta porque o Safari isola o domínio dia-livre.firebaseapp.com. Aqui o Google devolve o
  // token para o próprio endereço do app (#id_token=...), e o app entra com ele.
  const VOLTA = location.origin + location.pathname.replace(/index\.html$/,"").replace(/([^/])$/,"$1/"); // sempre .../dia-livre/
  const ls = { get:k=>{ try{ return localStorage.getItem(k); }catch(e){ return null; } }, set:(k,v)=>{ try{ localStorage.setItem(k,v); }catch(e){} }, del:k=>{ try{ localStorage.removeItem(k); }catch(e){} } };
  async function clientIdGoogle(){
    const c=ls.get("dl-gcid"); if(c) return c;
    const r=await fetch("https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key="+encodeURIComponent(firebaseConfig.apiKey),
      {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({providerId:"google.com",continueUri:"https://"+firebaseConfig.authDomain+"/__/auth/handler"})});
    const j=await r.json(); const id=j.authUri && new URL(j.authUri).searchParams.get("client_id");
    if(!id) throw {code:"dl/sem-client-id"}; ls.set("dl-gcid",id); return id;
  }
  async function entrarDireto(){
    const id=await clientIdGoogle();
    const rnd=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,"0")).join("");
    const state=rnd(), nonce=rnd(); ls.set("dl-gstate",state);
    const u=new URL("https://accounts.google.com/o/oauth2/v2/auth");
    Object.entries({client_id:id,redirect_uri:VOLTA,response_type:"id_token",scope:"openid email profile",nonce,state,prompt:"select_account"}).forEach(([k,v])=>u.searchParams.set(k,v));
    location.assign(u.toString());
  }
  if(/[#&](id_token|error)=/.test(location.hash)){
    const h=new URLSearchParams(location.hash.slice(1)); history.replaceState(null,"",VOLTA);
    const esperado=ls.get("dl-gstate"); ls.del("dl-gstate");
    if(h.get("error")) $("#login-err").textContent = h.get("error")==="access_denied" ? "Login cancelado. Toque em Entrar de novo." : "O Google recusou o login ("+h.get("error")+").";
    else if(!esperado || h.get("state")!==esperado) $("#login-err").textContent="O login não foi confirmado. Toque em Entrar de novo.";
    else signInWithCredential(auth, GoogleAuthProvider.credential(h.get("id_token"))).catch(erroLogin);
  }
  // Só confere o retorno do login por redirecionamento se ele foi mesmo usado. Antes, essa conferência
  // ficava pendente e, ao tocar em Entrar, era cancelada pela janela do Google (cancelled-popup-request).
  let viaRedirect=false; try{ viaRedirect = sessionStorage.getItem("dl-redirect")==="1"; sessionStorage.removeItem("dl-redirect"); }catch(e){}
  if(viaRedirect) getRedirectResult(auth).catch(e=>{ if(!/cancelled-popup/.test(e&&e.code||"")) erroLogin(e); });
  const atalhoIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) && (navigator.standalone || matchMedia("(display-mode: standalone)").matches);
  let entrando=false;
  $("#login-btn").onclick = async ()=>{
    if(entrando) return; // um segundo toque cancelava a janela do Google (cancelled-popup-request)
    entrando=true; const btn=$("#login-btn"), txt=btn.textContent; btn.disabled=true; btn.textContent="Abrindo o Google…";
    $("#login-err").textContent="";
    const p=new GoogleAuthProvider(); p.setCustomParameters({prompt:"select_account"});
    // No atalho da tela inicial do iPhone a janela do Google às vezes nunca devolve resposta e o botão ficava
    // preso em "Abrindo o Google…". Depois de 20 s o botão volta e explica o que fazer (se o login chegar depois, entra igual).
    try{ await entrarDireto(); return; }
    catch(e){ /* sem o código do Google: tenta a janela do Firebase, como antes */ }
    let espera; const tempo=new Promise((_,rej)=>{ espera=setTimeout(()=>rej({code:"dl/timeout"}),20000); });
    try{ await Promise.race([signInWithPopup(auth,p), tempo]); }
    catch(e){
      const c=(e&&e.code)||"";
      if(/popup-blocked|operation-not-supported/.test(c)) { try{ try{ sessionStorage.setItem("dl-redirect","1"); }catch(_){} await signInWithRedirect(auth,p); }catch(e2){ erroLogin(e2); } }
      else if(c==="dl/timeout") $("#login-err").textContent = atalhoIOS
        ? "O iPhone não devolveu a resposta do Google para o atalho da tela inicial. Abra o Safari, digite jmarcicofast-cell.github.io/dia-livre e entre por lá. Seus dados são os mesmos."
        : "O Google não respondeu. Feche a janela do Google, se ela estiver aberta, e toque em Entrar de novo.";
      else if(/cancelled-popup/.test(c)) {}
      else if(atalhoIOS && /popup-closed/.test(c)) $("#login-err").textContent="No iPhone, o atalho da tela inicial às vezes não recebe a resposta do Google. Toque em Entrar de novo e espere a janela abrir sem tocar outra vez. Se não der, abra o endereço do Dia Livre no Safari e entre por lá: seus dados são os mesmos.";
      else erroLogin(e);
    }
    finally{ clearTimeout(espera); entrando=false; btn.disabled=false; btn.textContent=txt; }
  };
  $("#logout").onclick = async ()=>{ await saving; saveRef=null; try{ localStorage.removeItem("dialivre"); }catch(e){} S=DEF(); aplicarVisual(S.visual); renderAll(); await signOut(auth); };
  onAuthStateChanged(auth, async user=>{
    $("#login").hidden = !!user; $("#logout").hidden = !user;
    if(!user){ saveRef=null; $("#sync").textContent=""; return; }
    const ref = doc(fs,"users",user.uid);
    try{
      const snap = await getDoc(ref);
      if(snap.exists() && snap.data().estado){ S = merge(snap.data().estado); try{ localStorage.setItem("dialivre", JSON.stringify(S)); }catch(e){} aplicarVisual(S.visual); }
      if(!S.nome && user.displayName) S.nome = user.displayName.split(" ")[0];
      saveRef = { set: d => setDoc(ref, {estado:d, atualizado:Date.now()}) };
      save(); renderAll();
      setSync(true);
      $("#aj-store").textContent="Seus registros ficam salvos na sua conta Google ("+(user.email||"")+"), visíveis só para você.";
      if(S.fin.banco.items.length && Date.now()-(S.fin.banco.ult||0) > 6*3600e3) sincronizar(false);
    }catch(e){ setSync(false); }
  });
}
function hideAI(){
  ["#inc-btn","#pat-btn","#fin-btn"].forEach(s=>{ const el=$(s); if(el) el.hidden = true; });
  $("#c-note").textContent = "A conversa com a IA não está disponível neste aparelho. Use o CVV (188) ou sua pessoa de confiança.";
}

/* ---------- Cálculos ---------- */
function streak(){ const d = diffDays(S.inicio, todayKey()); return Math.max(0,d); }
function best(){ return Math.max(S.recorde||0, streak()); }
function totalLivres(){ return Object.values(S.dias).filter(d=>d&&d.livre).length; }
function resisted(){ return S.vontades.filter(v=>v.res); }

/* ---------- Render: Hoje ---------- */
function renderHoje(){
  const n = streak(); const b = best();
  if(b > (S.recorde||0)){ S.recorde = b; save(); }
  $("#s-num").textContent = n;
  $("#s-lbl").textContent = n===1 ? "dia" : "dias";
  $("#s-sub").textContent = n===0 ? "Seu primeiro dia é hoje." : "Hoje é o seu dia "+(n+1)+".";
  const next = MILES.find(m=>m>n) || n+30;
  const prev = [0,...MILES].filter(m=>m<=n).pop();
  $("#s-ring").style.strokeDashoffset = (326.7*(1-Math.min(1,(n-prev)/(next-prev)))).toFixed(1);
  $("#s-next").textContent = "Faltam "+(next-n)+" "+(next-n===1?"dia":"dias")+" para a meta de "+next+".";
  $("#s-rec").textContent = b + (b===1?" dia":" dias");
  $("#s-tot").textContent = totalLivres();

  // Check-in
  const t = S.dias[todayKey()];
  const box = $("#checkin"); box.textContent=""; box.className = "card" + (t ? " done" : "");
  if(t && t.livre){
    box.innerHTML = '<h2>Hoje eu não peguei</h2><p class="small">Dia marcado no seu calendário.</p>';
    const u = document.createElement("button"); u.className="btn-link"; u.textContent="Desfazer marcação de hoje";
    u.onclick=()=>{ delete S.dias[todayKey()]; save(); renderAll(); }; box.append(u);
  } else if(t && !t.livre){
    box.className="card";
    box.innerHTML = '<h2>Recomeço registrado</h2><p class="small">Uma recaída não apaga o que você já aprendeu. Amanhã começa uma nova contagem, e o seu recorde continua seu.</p>';
    const g = document.createElement("button"); g.className="btn-soft"; g.textContent="Conversar sobre o que aconteceu"; g.dataset.go="conversa"; box.append(g);
  } else {
    box.innerHTML = '<h2>Check-in de hoje</h2>'+
      '<label class="field">Vontade hoje <output id="ci-v">3</output><input type="range" id="ci" min="0" max="10" value="3"></label>'+
      '<div class="scale"><span>Nenhuma</span><span>Muito forte</span></div>'+
      '<div class="stack"><button class="btn-primary btn-block" id="ci-ok">Hoje eu não peguei</button>'+
      '<button class="btn-link" id="ci-fall">Hoje eu peguei</button></div><div id="ci-fall-box" hidden class="stack"></div>';
    $("#ci").oninput = e => $("#ci-v").textContent = e.target.value;
    $("#ci-ok").onclick = () => {
      S.dias[todayKey()] = {livre:true, vontade:+$("#ci").value};
      save(); renderAll(); celebrate();
      toast(pick(["Mais um dia seu. Parabéns!","Você escolheu a sua paz hoje.","Isso é força de verdade.","Dia livre conquistado!"]));
    };
    $("#ci-fall").onclick = () => {
      const fb = $("#ci-fall-box"); fb.hidden=false;
      fb.innerHTML = '<p>Tudo bem contar a verdade aqui. Isso também é cuidado.</p><label class="field">O que aconteceu antes? <span class="opt">opcional</span><textarea id="ci-fall-nota"></textarea></label><button class="btn-soft" id="ci-fall-ok">Registrar e recomeçar amanhã</button>';
      $("#ci-fall-ok").onclick = () => {
        const nota = $("#ci-fall-nota").value.trim();
        S.recorde = best();
        S.dias[todayKey()] = {livre:false, vontade:+$("#ci").value, nota};
        S.vontades.unshift({ts:Date.now(), int:+$("#ci").value, sent:[], sit:[], val:0, nota, res:false});
        S.inicio = addDays(todayKey(),1);
        save(); renderAll();
      };
    };
  }

  // Calendário
  const cal = $("#cal"); cal.textContent="";
  ["D","S","T","Q","Q","S","S"].forEach(h=>{ const e=document.createElement("div"); e.className="h"; e.textContent=h; cal.append(e); });
  const tk = todayKey(); const td = parseKey(tk);
  const start = addDays(tk, -(28 + td.getDay()));
  for(let i=0;i<35;i++){
    const k = addDays(start,i); const e=document.createElement("div"); e.className="d";
    const info = S.dias[k];
    if(diffDays(tk,k)>0) e.classList.add("fut");
    else if(info&&info.livre) e.classList.add("ok");
    else if(info&&!info.livre) e.classList.add("fall");
    if(k===tk) e.classList.add("today");
    e.textContent = parseKey(k).getDate();
    e.setAttribute("aria-label", k + (info ? (info.livre?" dia livre":" recaída") : ""));
    if(diffDays(tk,k)<=0){ e.classList.add("tap"); e.setAttribute("role","button"); e.tabIndex=0;
      if(k===calSel) e.classList.add("sel");
      e.onclick=()=>{ calSel = (calSel===k ? null : k); renderHoje(); }; }
    cal.append(e);
  }

  renderCalEdit();

  // Conquistas
  const bg = $("#badges"); bg.textContent="";
  const extra = [
    ["@check","Primeiro check-in", Object.keys(S.dias).length>0],
    ["@sos","Venci uma vontade", resisted().length>=1],
    ["@estrela","5 vontades vencidas", resisted().length>=5],
    ["@apoio","Motivos escritos", S.motivos.length>=3],
    ["@carta","Carta escrita", (S.carta||"").trim().length>20],
    ["@escudo","Todas as barreiras", BARR.every(([id])=>S.barreiras[id])]
  ];
  MILES.forEach(m=> addBadge(bg, String(m), m===1?"1 dia":m+" dias", b>=m));
  extra.forEach(([ic,t,on])=> addBadge(bg, ic, t, on));
}
/* ---------- Marcar um dia passado pelo calendário ---------- */
let calSel = null;
const MESES=["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
const SEMANA=["domingo","segunda","terça","quarta","quinta","sexta","sábado"];
function recalcInicio(){
  // A contagem recomeça no dia seguinte à recaída mais recente
  const tk=todayKey();
  const quedas=Object.keys(S.dias).filter(k=>S.dias[k]&&!S.dias[k].livre&&diffDays(k,tk)>=0).sort();
  if(quedas.length) S.inicio=addDays(quedas[quedas.length-1],1);
  else { const ks=Object.keys(S.dias).filter(k=>diffDays(k,tk)>=0).sort(); if(ks.length && diffDays(ks[0],S.inicio)>0) S.inicio=ks[0]; }
}
function marcarDia(k, livre){
  const antes=S.dias[k];
  if(livre===null) delete S.dias[k];
  else S.dias[k]={...(antes||{}), livre, vontade:(antes&&antes.vontade!=null)?antes.vontade:null};
  if(livre===false){ S.recorde=best(); if(diffDays(S.inicio,addDays(k,1))>0) S.inicio=addDays(k,1); }
  else if(antes && !antes.livre) recalcInicio();
  if(livre===true && diffDays(k,S.inicio)>0 && !Object.keys(S.dias).some(x=>S.dias[x]&&!S.dias[x].livre&&diffDays(x,S.inicio)>0&&diffDays(k,x)>=0)) {
    // marcou um dia livre antes do início, sem recaída no meio: a contagem passa a começar nele
    let i=k; while(true){ const ant=addDays(i,-1); if(S.dias[ant]&&S.dias[ant].livre) i=ant; else break; }
    S.inicio=i;
  }
  save(); renderAll();
}
function renderCalEdit(){
  const box=$("#cal-edit"); if(!box) return;
  if(!calSel || diffDays(todayKey(),calSel)>0){ box.hidden=true; box.textContent=""; return; }
  const d=parseKey(calSel), info=S.dias[calSel];
  const nome = calSel===todayKey() ? "Hoje" : SEMANA[d.getDay()][0].toUpperCase()+SEMANA[d.getDay()].slice(1)+", "+d.getDate()+" de "+MESES[d.getMonth()];
  box.hidden=false; box.textContent="";
  const h=document.createElement("p"); h.className="cal-edit-t"; h.textContent=nome+(info?(info.livre?" · dia livre":" · recaída"):" · sem marcação"); box.append(h);
  const row=document.createElement("div"); row.className="cal-edit-b";
  const mk=(txt,cls,fn)=>{ const b=document.createElement("button"); b.className=cls; b.textContent=txt; b.onclick=fn; row.append(b); };
  if(!info||!info.livre) mk("Não peguei","btn-primary",()=>{ marcarDia(calSel,true); toast("Dia livre marcado."); });
  if(!info||info.livre) mk("Peguei","btn-soft",()=>{ marcarDia(calSel,false); toast("Dia registrado."); });
  if(info) mk("Limpar","btn-link",()=>{ marcarDia(calSel,null); toast("Marcação removida."); });
  mk("Fechar","btn-link",()=>{ calSel=null; renderHoje(); });
  box.append(row);
}
function addBadge(p, ic, t, on){
  const d=document.createElement("div"); d.className="badge"+(on?" on":"");
  const i=document.createElement("div"); i.className="ic"; if(ic[0]==="@") i.innerHTML=icone(ic.slice(1)); else i.textContent=ic;
  const s=document.createElement("span"); s.textContent=t;
  d.append(i,s); d.title = on ? "Conquistada" : "Ainda não"; p.append(d);
}

/* ---------- Render: Gatilhos ---------- */
const sel = {sent:new Set(), sit:new Set()};
function chips(container, items, set){
  const c=$(container); c.textContent="";
  items.forEach(t=>{ const b=document.createElement("button"); b.type="button"; b.className="chip"; b.textContent=t;
    b.setAttribute("aria-pressed", set.has(t)); b.onclick=()=>{ set.has(t)?set.delete(t):set.add(t); b.setAttribute("aria-pressed", set.has(t)); }; c.append(b); });
}
function bars(container, counts){
  const c=$(container); c.textContent="";
  const arr = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,5);
  if(!arr.length){ c.innerHTML='<p class="muted small">Sem dados ainda.</p>'; return; }
  const max = arr[0][1];
  arr.forEach(([k,v])=>{ const r=document.createElement("div"); r.className="bar";
    const l=document.createElement("span"); l.textContent=k;
    const t=document.createElement("div"); t.className="t"; const i=document.createElement("i"); i.style.width=(v/max*100)+"%"; t.append(i);
    const n=document.createElement("span"); n.className="n"; n.textContent=v; r.append(l,t,n); c.append(r); });
}
function countBy(fn){ const o={}; S.vontades.forEach(v=>fn(v).forEach(k=>{ o[k]=(o[k]||0)+1; })); return o; }
function period(h){ return h<6?"Madrugada":h<12?"Manhã":h<18?"Tarde":"Noite"; }
function renderGatilhos(){
  const n = S.vontades.length;
  $("#g-empty").hidden = n>0; $("#g-stats").hidden = n===0;
  $("#pat-btn").hidden = n<3 || !sample;
  if(n){
    const r = resisted().length;
    $("#g-sum").textContent = n+" vontades registradas, "+r+" vencidas ("+Math.round(r/n*100)+"%).";
    bars("#g-b-sent", countBy(v=>v.sent||[]));
    bars("#g-b-sit", countBy(v=>v.sit||[]));
    bars("#g-b-hr", countBy(v=>[period(new Date(v.ts).getHours())]));
  }
  const log=$("#g-log"); log.textContent="";
  if(!n){ log.innerHTML='<p class="muted small">Nada registrado ainda.</p>'; return; }
  S.vontades.slice(0,15).forEach(v=>{
    const d=document.createElement("div"); d.className="it"+(v.res?" res":"");
    const dt=new Date(v.ts);
    const head = dt.toLocaleDateString("pt-BR",{day:"2-digit",month:"short"})+" às "+pad(dt.getHours())+":"+pad(dt.getMinutes())+" · intensidade "+v.int+" · "+(v.res?"venci":"peguei");
    const b=document.createElement("b"); b.textContent=head; d.append(b);
    const det=[...(v.sent||[]),...(v.sit||[])].join(", ");
    if(det||v.val||v.nota){ const p=document.createElement("p"); p.className="muted"; p.textContent=[det, v.val?brl(v.val):"", v.nota].filter(Boolean).join(" · "); d.append(p); }
    log.append(d);
  });
}
function saveUrge(res){
  const v = {ts:Date.now(), int:+$("#g-int").value, sent:[...sel.sent], sit:[...sel.sit], val:num($("#g-val").value), nota:$("#g-nota").value.trim(), res};
  S.vontades.unshift(v); S.vontades = S.vontades.slice(0,400);
  if(!res){ S.recorde = best(); S.dias[todayKey()] = {livre:false, vontade:v.int, nota:v.nota}; S.inicio = addDays(todayKey(),1); }
  sel.sent.clear(); sel.sit.clear(); $("#g-val").value=""; $("#g-nota").value="";
  chips("#g-sent",SENT,sel.sent); chips("#g-sit",SIT,sel.sit);
  save(); renderAll();
  if(res){ celebrate(); toast("Vontade vencida. Você é mais forte que o impulso."); }
  else toast("Registrado. Amanhã começa uma nova contagem.");
}

/* ================= FINANÇAS ================= */
const OBJ_SUG = ["Reserva de emergência","Quitar uma dívida","Presente para quem eu amo","Viagem","Curso","Algo para a casa"];
const CATS = [
  {id:"mercado",n:"Mercado",ic:"mercado",t:"s"},
  {id:"casa",n:"Casa e aluguel",ic:"casa",t:"s"},
  {id:"contas",n:"Luz, água e internet",ic:"contas",t:"s"},
  {id:"transporte",n:"Transporte",ic:"transporte",t:"s"},
  {id:"comer",n:"Comer fora e delivery",ic:"comer",t:"s"},
  {id:"saude",n:"Saúde e farmácia",ic:"saude",t:"s"},
  {id:"educacao",n:"Educação",ic:"educacao",t:"s"},
  {id:"lazer",n:"Lazer",ic:"lazer",t:"s"},
  {id:"compras",n:"Compras",ic:"compras",t:"s"},
  {id:"beleza",n:"Beleza e cuidados",ic:"beleza",t:"s"},
  {id:"assin",n:"Assinaturas",ic:"assin",t:"s"},
  {id:"familia",n:"Família e filhos",ic:"familia",t:"s"},
  {id:"dividas",n:"Dívidas e empréstimos",ic:"dividas",t:"s"},
  {id:"taxas",n:"Juros e tarifas",ic:"taxas",t:"s"},
  {id:"outros",n:"Outros gastos",ic:"outros",t:"s"},
  {id:"salario",n:"Salário",ic:"salario",t:"e"},
  {id:"extra",n:"Renda extra",ic:"extra",t:"e"},
  {id:"outrasE",n:"Outras entradas",ic:"outrasE",t:"e"},
  {id:"fatura",n:"Pagamento de fatura",ic:"fatura",t:"f"},
  {id:"entre",n:"Entre minhas contas",ic:"entre",t:"f"},
  {id:"guardado",n:"Guardado ou investido",ic:"guardado",t:"f"}
];
const NOMES_MES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
const addMes = (mk,n) => { let [y,m]=mk.split("-").map(Number); m+=n; y+=Math.floor((m-1)/12); m=((m-1)%12+12)%12+1; return y+"-"+pad(m); };
const nomeMes = (mk, ano=true) => NOMES_MES[+mk.slice(5)-1] + (ano ? " de "+mk.slice(0,4) : "");
const mesCurto = mk => NOMES_MES[+mk.slice(5)-1].slice(0,3);
const diasNoMes = mk => new Date(+mk.slice(0,4), +mk.slice(5), 0).getDate();
const diaEm = (mk, dia) => mk+"-"+pad(Math.min(Math.max(1,dia||1), diasNoMes(mk)));
const normDesc = s => String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[0-9*#/\\.-]+/g," ").replace(/\s+/g," ").trim().slice(0,40);
let curMes = monthKey();
let sub = "resumo";

function todasCats(){ return [...CATS, ...(S.fin.cats||[]).map(c=>({...c, t:"s", custom:true}))]; }
function cat(id){ return todasCats().find(c=>c.id===id) || CATS.find(c=>c.id==="outros"); }
function catIc(c){
  const e=el("span","cat-ic");
  const cor = COR_CAT[c.id] || ("hsl("+([...String(c.id)].reduce((a,x)=>a+x.charCodeAt(0),0)*47%360)+" 45% 48%)");
  e.style.setProperty("--c", cor);
  if(c.custom && c.ic && !/^[a-zA-Z]+$/.test(c.ic)){ e.classList.add("emo"); e.textContent=c.ic; } else e.innerHTML=icone(c.custom?"tag":c.ic);
  return e;
}
function cartao(id){ return S.fin.cartoes.find(c=>c.id===id); }

/* Em qual fatura cai uma compra: devolve o mês do vencimento ("2026-11") */
function fatDe(c, data){
  const F = c.fecha||1, V = c.vence||10;
  let mk = data.slice(0,7);
  if(+data.slice(8,10) >= F) mk = addMes(mk,1);
  return V > F ? mk : addMes(mk,1);
}

/* Cada lançamento vira uma ou mais "ocorrências" no mês em que pesa no bolso (parcelas vão para as faturas seguintes) */
let _oc = null;
function ocorrencias(){
  if(_oc) return _oc;
  const out = [];
  S.fin.lanc.forEach(l=>{
    const c = l.conta && cartao(l.conta);
    if(c && l.t==="s"){
      const n = Math.max(1, l.par||1), base = l.fat || fatDe(c, l.d);
      const cada = Math.floor(l.v/n*100)/100;
      for(let i=0;i<n;i++) out.push({l, mes:addMes(base,i), v: i===n-1 ? Math.round((l.v-cada*(n-1))*100)/100 : cada, i:i+1, n, cartao:c.id});
    } else if(c){
      out.push({l, mes: l.fat || fatDe(c, l.d), v:l.v, cartao:c.id});
    } else out.push({l, mes:l.d.slice(0,7), v:l.v});
  });
  // parcelas futuras de compras do banco que ainda não chegaram
  const grupos = {};
  S.fin.lanc.forEach(l=>{ if(l.src==="b" && l.conta && cartao(l.conta) && l.tot>1 && l.inst){
    const k = l.conta+"|"+(l.pd||"")+"|"+(l.ta||"")+"|"+normDesc(l.desc);
    if(!grupos[k] || grupos[k].inst < l.inst) grupos[k] = l; } });
  Object.values(grupos).forEach(l=>{
    const base = l.fat || fatDe(cartao(l.conta), l.d);
    for(let k=l.inst+1;k<=l.tot;k++) out.push({l, mes:addMes(base,k-l.inst), v:l.v, i:k, n:l.tot, cartao:l.conta, proj:true});
  });
  return _oc = out;
}
function sujo(){ _oc = null; }

function totaisMes(mk){
  let ent=0, sai=0; const porCat={};
  ocorrencias().forEach(o=>{ if(o.mes!==mk) return; const c=cat(o.l.cat); if(c.t==="f") return;
    if(o.l.t==="e"){ ent+=o.v; } else { sai+=o.v; porCat[c.id]=(porCat[c.id]||0)+o.v; } });
  return {ent, sai, porCat};
}
function fatura(c, mk){
  let v=0; ocorrencias().forEach(o=>{ if(o.cartao!==c.id || o.mes!==mk) return; if(cat(o.l.cat).t==="f") return; v += o.l.t==="e" ? -o.v : o.v; });
  return Math.round(v*100)/100;
}
function faturaPaga(c, mk){ return !!((S.fin.fatPagas[c.id]||{})[mk]); }

/* Dívidas: d.saldo = quanto pegou; d.total = quanto falta pagar, já com os juros */
/* Parcelado (d.n>1): d.vParc = valor de cada parcela; d.parc = quanto sai por mês */
const r2 = v => Math.round(v*100)/100;
function parcelaPrice(saldo,juros,n){ const i=(juros||0)/100; if(n<=1) return r2(saldo*(1+i)); return r2(i ? saldo*i/(1-Math.pow(1+i,-n)) : saldo/n); }
function totalDivida(d){ if(d.n>1) return r2((d.vParc||parcelaPrice(d.saldo,d.juros,d.n))*d.n);
  if(d.parc && d.parc>=d.saldo) return d.parc; return r2(d.saldo*(1+(d.juros||0)/100)); }
function falta(d){ if(d.total==null) d.total=Math.max(0,totalDivida(d)-(d.pago||0)); return d.total; }

function previsto(){
  const f=S.fin; const mk=monthKey();
  const contas=f.contas.reduce((a,c)=>a+(c.valor||0),0);
  const ativas=f.dividas.filter(d=>falta(d)>0);
  const div=ativas.reduce((a,d)=>a+Math.min(d.parc||totalDivida(d),falta(d)),0);
  const fat=f.cartoes.reduce((a,c)=>a+(faturaPaga(c,mk)?0:Math.max(0,fatura(c,mk))),0);
  return {renda:f.renda||0, contas, div, fat, sobra:(f.renda||0)-contas-div-fat, ativas};
}
function finText(){
  const n=previsto(), t=totaisMes(monthKey());
  if(!n.renda && !S.fin.contas.length && !n.ativas.length && !S.fin.lanc.length) return "";
  const cats = Object.entries(t.porCat).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([k,v])=>cat(k).n+" "+brl(v)+(S.fin.orc[k]?" (limite "+brl(S.fin.orc[k])+")":"")).join("; ");
  return "Finanças dela: renda mensal prevista "+brl(n.renda)+", contas fixas "+brl(n.contas)+", faturas de cartão do mês "+brl(n.fat)+", dívidas a pagar "+brl(n.div)+", sobra prevista "+brl(n.sobra)+". "+
    "Neste mês já entrou "+brl(t.ent)+" e saiu "+brl(t.sai)+". Maiores gastos: "+(cats||"nenhum lançado")+". Dívidas: "+
    (n.ativas.map(d=>d.credor+" pegou "+brl(d.saldo)+", falta pagar "+brl(falta(d))+" (juros de "+d.juros+"% ao mês)").join("; ")||"nenhuma")+". Objetivos: "+(S.objetivos.map(o=>o.nome+" ("+brl(o.guardado)+" de "+brl(o.meta)+")").join("; ")||"nenhum")+".";
}

/* ---------- pecinhas de interface ---------- */
function el(tag, cls, txt){ const e=document.createElement(tag); if(cls) e.className=cls; if(txt!=null) e.textContent=txt; return e; }
function mkItem(cls){ return el("div","item "+(cls||"")); }
function topLine(name, val){ const t=el("div","top"); t.append(el("b",null,name), el("span",null,val)); return t; }
function actLine(ph, label, fn, padrao){
  const a=el("div","acts");
  const i=el("input","valor"); i.inputMode="decimal"; i.placeholder=ph; i.setAttribute("aria-label",ph);
  const b=el("button","btn-primary",label);
  b.onclick=()=>{ const v=num(i.value)||padrao||0; if(v) fn(v); }; a.append(i,b); return a;
}
function delBtn(label, fn){ const x=el("button","del",label); x.onclick=fn; return x; }
function barra(pct, cls){ const g=el("div","gbar "+(cls||"")); const i=el("i"); i.style.width=Math.max(0,Math.min(100,pct))+"%"; g.append(i); return g; }

/* ---------- navegação interna ---------- */
function goSub(n){
  sub = n;
  $$("#v-dinheiro [data-subview]").forEach(v=>v.hidden = v.id!=="s-"+n);
  $$(".subnav button").forEach(b=>b.setAttribute("aria-current", b.dataset.sub===n?"page":"false"));
  const btn=$('.subnav button[data-sub="'+n+'"]'); if(btn) btn.scrollIntoView({inline:"center",block:"nearest"});
  renderDinheiro();
}
function renderDinheiro(){
  sujo();
  $$(".mes-nome").forEach(e=>e.textContent=nomeMes(curMes).replace(/^./,x=>x.toUpperCase()));
  if(sub==="resumo") renderResumo();
  else if(sub==="lanc") renderLanc();
  else if(sub==="orc") renderOrc();
  else if(sub==="cartoes") renderCartoes();
  else if(sub==="agenda") renderAgenda();
  else if(sub==="dividas") renderDividas();
  else if(sub==="banco") renderBanco();
}

/* ---------- Resumo ---------- */
function alertas(){
  const out=[]; const hoje=todayKey(), mk=monthKey();
  const pagos=S.fin.pagos[mk]||{};
  S.fin.contas.forEach(c=>{ if(pagos[c.id]) return; const d=diaEm(mk,c.dia); const dd=diffDays(hoje,d);
    if(dd<0) out.push(["over","!",c.nome+" venceu dia "+(+d.slice(8))+" e ainda não foi marcada como paga ("+brl(c.valor)+")."]);
    else if(dd<=2) out.push(["","•",c.nome+" vence "+(dd===0?"hoje":dd===1?"amanhã":"em 2 dias")+" ("+brl(c.valor)+")."]); });
  S.fin.cartoes.forEach(c=>{ const v=fatura(c,mk); if(v<=0 || faturaPaga(c,mk)) return; const d=diaEm(mk,c.vence); const dd=diffDays(hoje,d);
    if(dd<0) out.push(["over","!","Fatura do "+c.nome+" venceu dia "+(+d.slice(8))+" ("+brl(v)+")."]);
    else if(dd<=5) out.push(["","•","Fatura do "+c.nome+" vence "+(dd===0?"hoje":dd===1?"amanhã":"dia "+(+d.slice(8)))+": "+brl(v)+"."]); });
  itensDoMes(mk).filter(x=>x.tipo==="divida"&&!x.pg).forEach(x=>{ const dd=diffDays(hoje,x.d);
    if(dd<0) out.push(["over","!",x.nome+" venceu dia "+(+x.d.slice(8))+" ("+brl(x.v)+")."]);
    else if(dd<=2) out.push(["","•",x.nome+" vence "+(dd===0?"hoje":dd===1?"amanhã":"em 2 dias")+" ("+brl(x.v)+")."]); });
  const t=totaisMes(mk);
  Object.entries(S.fin.orc).forEach(([k,lim])=>{ if(!lim) return; const g=t.porCat[k]||0;
    if(g>lim) out.push(["over","!",cat(k).n+": passou "+brl(g-lim)+" do limite do mês."]);
    else if(g>=lim*.85) out.push(["","•",cat(k).n+": já usou "+Math.round(g/lim*100)+"% do limite."]); });
  const b=S.fin.banco; if(b.erro) out.push(["over","!","Banco: "+b.erro]);
  return out;
}
function renderResumo(){
  const al=$("#r-alertas"); al.textContent="";
  if(curMes===monthKey()) alertas().forEach(([cls,ic,txt])=>{ const a=el("div","alert "+cls); a.innerHTML=icone(cls==="over"?"alerta":"relogio"); a.append(el("span",null,txt)); al.append(a); });
  const t=totaisMes(curMes);
  $("#r-ent").textContent=brl(t.ent); $("#r-sai").textContent=brl(t.sai);
  const sal=t.ent-t.sai; $("#r-sal").textContent=(sal<0?"− ":"")+brl(Math.abs(sal));
  $("#r-sal-box").classList.toggle("neg", sal<0); $("#r-sal-box").classList.toggle("j", sal>=0);
  $("#r-sal-l").textContent = sal<0 ? "Saiu mais do que entrou" : "Saldo do mês";

  // por categoria
  const cb=$("#r-cats"); cb.textContent="";
  const arr=Object.entries(t.porCat).sort((a,b)=>b[1]-a[1]);
  if(!arr.length){ cb.append(el("p","small muted","Nenhum gasto lançado em "+nomeMes(curMes,false)+". Toque no + para lançar, ou conecte o banco.")); }
  const mostrar = arr.length>8 ? [...arr.slice(0,7), ["__outras", arr.slice(7).reduce((a,x)=>a+x[1],0)]] : arr;
  const maxV = Math.max(...mostrar.map(([k,v])=>Math.max(v, S.fin.orc[k]||0)), 1);
  mostrar.forEach(([k,v])=>{
    const c = k==="__outras" ? {id:"outros", n:"Outras categorias", ic:"outros"} : cat(k);
    const lim = S.fin.orc[k]||0;
    const b=el("button","cb"+(lim && v>lim ? " over" : lim && v>=lim*.85 ? " warn" : ""));
    const top=el("div","between"); const vs=el("span"); vs.append(el("strong",null,brl(v)), (lim?" de "+brl(lim):" · "+Math.round(v/(t.sai||1)*100)+"%")); top.append(el("b",null,c.n), vs);
    const tr=el("div","t"); const i=el("i"); i.style.width=(v/maxV*100)+"%"; tr.append(i);
    if(lim){ const u=el("u"); u.style.left="calc("+(lim/maxV*100)+"% - 1px)"; u.title="Limite"; tr.append(u); }
    const ci=catIc(c); b.style.setProperty("--c", ci.style.getPropertyValue("--c")); b.append(ci,top,tr);
    if(k!=="__outras") b.onclick=()=>{ filtroCat=k; goSub("lanc"); };
    cb.append(b);
  });

  // 6 meses
  const meses=[]; for(let i=5;i>=0;i--) meses.push(addMes(curMes,-i));
  const dados=meses.map(m=>({m, ...totaisMes(m)}));
  graficoMeses($("#r-meses"), dados);
  const tb=el("table","dados"); tb.innerHTML="<tr><th>Mês</th><th>Entrou</th><th>Saiu</th><th>Saldo</th></tr>";
  dados.forEach(d=>{ const tr=el("tr"); [nomeMes(d.m,false), brl(d.ent), brl(d.sai), brl(d.ent-d.sai)].forEach(x=>tr.append(el("td",null,x))); tb.append(tr); });
  $("#r-meses-tbl").textContent=""; $("#r-meses-tbl").append(tb);

  // previsto
  const n=previsto();
  $("#f-renda-v").textContent=brl(n.renda); $("#f-contas-v").textContent=brl(n.contas); $("#f-parc-v").textContent=brl(n.div); $("#f-fat-v").textContent=brl(n.fat);
  $("#f-sobra-v").textContent=(n.sobra<0?"− ":"")+brl(Math.abs(n.sobra)); $("#f-sobra-v").parentElement.classList.toggle("neg", n.sobra<0);
  $("#f-sobra-l").textContent = n.sobra<0 ? "Falta no mês" : "Sobra do mês";
  const top = [...n.ativas].sort((a,b)=>b.juros-a.juros)[0];
  let dica="";
  if(!n.renda) dica="Comece pelo quanto entra por mês. Os outros números aparecem logo acima.";
  else if(n.sobra<0) dica="O mês fecha faltando "+brl(-n.sobra)+". Um novo empréstimo com agiota cobriria hoje e aumentaria esse buraco no mês que vem. Vale renegociar prazos e cortar uma conta antes.";
  else dica="Sobram "+brl(n.sobra)+" no mês."+(top?" A dívida que mais cresce é "+top.credor+" ("+top.juros+"% ao mês): coloque nela o que puder primeiro.":" Separe uma parte para os seus objetivos logo que o dinheiro entrar.");
  $("#f-dica").textContent=dica;
  if(document.activeElement!==$("#f-renda")) $("#f-renda").value = S.fin.renda ? fmt(S.fin.renda) : "";
  $("#fin-btn").hidden = !sample && sampleChecked;
}

/* Gráfico de barras: entrou x saiu nos últimos 6 meses */
function graficoMeses(box, dados){
  box.textContent="";
  const W = Math.max(280, Math.round(box.clientWidth || 320)), H = 170, L = 44, B = 22, T = 8;
  const max = Math.max(...dados.flatMap(d=>[d.ent,d.sai]), 1);
  const passo = Math.pow(10, Math.floor(Math.log10(max))); const topo = Math.ceil(max/passo)*passo;
  const y = v => T + (H-T-B) * (1 - v/topo);
  const ns="http://www.w3.org/2000/svg"; const svg=document.createElementNS(ns,"svg");
  svg.setAttribute("viewBox",`0 0 ${W} ${H}`); svg.setAttribute("role","img");
  svg.setAttribute("aria-label","Entradas e saídas dos últimos 6 meses");
  const mk=(t,a)=>{ const e=document.createElementNS(ns,t); Object.entries(a).forEach(([k,v])=>e.setAttribute(k,v)); return e; };
  [0, topo/2, topo].forEach(v=>{ svg.append(mk("line",{x1:L,x2:W,y1:y(v),y2:y(v),class:"grid"}));
    const tx=mk("text",{x:L-6,y:y(v)+4,"text-anchor":"end",class:"ax"}); tx.textContent=v>=1000?(v/1000).toLocaleString("pt-BR")+" mil":v.toLocaleString("pt-BR"); svg.append(tx); });
  const gw=(W-L)/dados.length, bw=Math.min(18,(gw-14)/2);
  const tip=el("div","tip"); tip.hidden=true;
  dados.forEach((d,i)=>{
    const cx=L+gw*i+gw/2;
    [["ent","var(--s-in)",-1],["sai","var(--s-out)",1]].forEach(([k,cor,lado])=>{
      const v=d[k]; const x=cx+(lado<0?-bw-1:1); const h=Math.max(0,y(0)-y(v));
      const r=Math.min(4,bw/2,h);
      const p = h>0 ? `M${x},${y(0)} V${y(v)+r} Q${x},${y(v)} ${x+r},${y(v)} H${x+bw-r} Q${x+bw},${y(v)} ${x+bw},${y(v)+r} V${y(0)} Z` : "";
      if(p) svg.append(mk("path",{d:p,fill:cor}));
    });
    const lb=mk("text",{x:cx,y:H-6,"text-anchor":"middle",class:"ax"}); lb.textContent=mesCurto(d.m); svg.append(lb);
    const hit=mk("rect",{x:L+gw*i,y:0,width:gw,height:H-B,fill:"transparent"});
    const show=()=>{ tip.hidden=false; tip.textContent=nomeMes(d.m,false)+": entrou "+brl(d.ent)+" · saiu "+brl(d.sai);
      const px=(cx/W)*box.clientWidth; tip.style.left=Math.min(box.clientWidth-80,Math.max(80,px))+"px"; tip.style.top=(y(Math.max(d.ent,d.sai))/H*box.clientWidth*H/W)+"px"; };
    hit.addEventListener("pointerenter",show); hit.addEventListener("pointerdown",show); hit.addEventListener("pointerleave",()=>tip.hidden=true);
    svg.append(hit);
  });
  box.append(svg, tip);
}

/* ---------- Lançamentos ---------- */
let filtroCat="", busca="";
function rotuloConta(l){
  if(!l.conta) return l.src==="b" ? "Banco" : "";
  const c=cartao(l.conta); if(c) return c.nome;
  const a=S.fin.banco.contas.find(x=>x.id===l.conta); return a ? a.nome : "Banco";
}
function renderLanc(){
  const f=$("#l-filtro");
  if(!f.options.length || f.dataset.n!=String(todasCats().length)){
    f.textContent=""; f.append(new Option("Todas as categorias",""));
    todasCats().forEach(c=>f.append(new Option(c.n, c.id))); f.dataset.n=todasCats().length;
  }
  f.value=filtroCat;
  const q=normDesc(busca);
  const lista=ocorrencias().filter(o=>o.mes===curMes && (!filtroCat||o.l.cat===filtroCat) && (!q||normDesc(o.l.desc).includes(q)))
    .sort((a,b)=> b.l.d.localeCompare(a.l.d) || (b.l.ts||0)-(a.l.ts||0));
  let e=0,s=0; lista.forEach(o=>{ if(cat(o.l.cat).t==="f") return; o.l.t==="e"?e+=o.v:s+=o.v; });
  $("#l-tot").textContent = lista.length ? lista.length+" lançamentos · entrou "+brl(e)+" · saiu "+brl(s) : "";
  const box=$("#l-lista"); box.textContent="";
  if(!lista.length){ box.append(el("p","small muted", S.fin.lanc.length ? "Nada encontrado neste mês." : "Nenhum lançamento ainda. Toque no + para lançar um gasto ou uma entrada. Se conectar o banco, as movimentações aparecem aqui sozinhas.")); return; }
  let grupo=null, dia="";
  lista.forEach(o=>{
    if(o.l.d!==dia){ dia=o.l.d; grupo=el("div","dia-grupo");
      const dt=parseKey(dia); const h=el("p","dia",dt.toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long"}));
      grupo.append(h); box.append(grupo); }
    const c=cat(o.l.cat);
    const b=el("button","lanc"+(c.t==="f"?" fora":""));
    const nm=el("span","nm"); nm.append(el("b",null,o.l.desc||c.n));
    const det=[c.n, rotuloConta(o.l), o.n>1?"parcela "+o.i+"/"+o.n:"", o.proj?"prevista":"", o.l.src==="b"&&rotuloConta(o.l)!=="Banco"?"banco":""].filter(Boolean).join(" · ");
    nm.append(el("small",null,det));
    b.append(catIc(c), nm, el("span","vl"+(o.l.t==="e"?" e":""), (o.l.t==="e"?"+ ":"− ")+brl(o.v)));
    b.onclick=()=>abrirLanc(o.l);
    grupo.append(b);
  });
}

/* Folha de lançamento (novo ou editar) */
let editando=null, tipoSel="s", catSel="";
function abrirSheet(id){ const s=$(id); s.hidden=false; document.body.style.overflow="hidden"; const f=s.querySelector("input:not([type=checkbox]),button"); }
function fecharSheets(){ $$(".sheet").forEach(s=>s.hidden=true); document.body.style.overflow=""; }
function catsDoTipo(t){ return todasCats().filter(c=> t==="e" ? c.t==="e"||c.t==="f" : c.t==="s"||c.t==="f"); }
function pintarCats(){
  const box=$("#sl-cats"); box.textContent="";
  catsDoTipo(tipoSel).forEach(c=>{ const b=el("button","chip"); b.innerHTML=(c.custom&&c.ic&&!/^[a-z]+$/i.test(c.ic)?"":icone(c.custom?"tag":c.ic)); b.append(c.n); b.type="button"; b.setAttribute("aria-pressed", c.id===catSel);
    b.onclick=()=>{ catSel=c.id; pintarCats(); }; box.append(b); });
}
function infoLanc(){
  const c=cartao($("#sl-conta").value); const n=+$("#sl-par").value||1; const v=num($("#sl-valor").value);
  $("#sl-par-box").hidden = !c || tipoSel!=="s" || (editando&&editando.src==="b");
  let t="";
  if(c && tipoSel==="s"){ const d=$("#sl-data").value||todayKey(); const f=(editando&&editando.fat)||fatDe(c,d);
    t = n>1 ? n+"x de "+brl(v/n)+" · faturas de "+nomeMes(f,false)+" a "+nomeMes(addMes(f,n-1),false)+"." : "Entra na fatura de "+nomeMes(f,false)+" (vence dia "+c.vence+")."; }
  $("#sl-info").textContent=t;
}
function abrirLanc(l){
  editando=l||null;
  const banco = l && l.src==="b";
  $("#sl-tit").textContent = l ? (banco?"Lançamento do banco":"Editar lançamento") : "Novo lançamento";
  tipoSel = l ? l.t : "s"; catSel = l ? l.cat : "";
  $$("#sl-tipo button").forEach(b=>{ b.setAttribute("aria-pressed", b.dataset.t===tipoSel); b.disabled=banco; });
  $("#sl-valor").value = l ? fmt(l.v) : ""; $("#sl-valor").disabled=banco;
  $("#sl-desc").value = l ? l.desc : "";
  $("#sl-data").value = l ? l.d : todayKey(); $("#sl-data").disabled=banco;
  const sc=$("#sl-conta"); sc.textContent=""; sc.disabled=banco;
  sc.append(new Option("Dinheiro, Pix ou débito",""));
  S.fin.cartoes.forEach(c=>sc.append(new Option("Cartão "+c.nome, c.id)));
  if(banco && l.conta && !cartao(l.conta)) sc.append(new Option(rotuloConta(l), l.conta));
  sc.value = l ? (l.conta||"") : "";
  const sp=$("#sl-par"); if(!sp.options.length) for(let i=1;i<=24;i++) sp.append(new Option(i===1?"À vista":i+"x", i));
  sp.value = l ? (l.par||1) : 1;
  $("#sl-regra-box").hidden=!banco;
  $("#sl-apagar").hidden=!l;
  const dl=$("#sl-sug"); dl.textContent=""; [...new Set(S.fin.lanc.filter(x=>x.src!=="b").slice(-200).map(x=>x.desc).filter(Boolean))].slice(0,40).forEach(d=>dl.append(new Option(d)));
  pintarCats(); infoLanc(); abrirSheet("#sh-lanc");
  if(!l) setTimeout(()=>$("#sl-valor").focus(),60);
}
function salvarLanc(){
  const banco = editando && editando.src==="b";
  const v=num($("#sl-valor").value), desc=$("#sl-desc").value.trim();
  if(!banco && !v){ toast("Coloque o valor."); return; }
  let c=catSel;
  if(!c){ // tenta adivinhar pela descrição
    const r=S.fin.banco.regras[normDesc(desc)]; const igual=S.fin.lanc.find(x=>normDesc(x.desc)===normDesc(desc) && desc);
    c = r || (igual&&igual.cat) || (tipoSel==="e"?"outrasE":"outros");
  }
  if(banco){
    editando.cat=c; editando.desc=desc||editando.desc;
    if($("#sl-regra").checked){ const k=normDesc(editando.dOrig||editando.desc); S.fin.banco.regras[k]=c;
      S.fin.lanc.forEach(x=>{ if(x.src==="b" && normDesc(x.dOrig||x.desc)===k) x.cat=c; }); }
  } else {
    const conta=$("#sl-conta").value; const ehCartao=!!cartao(conta);
    const dados={ t:tipoSel, v, desc, cat:c, d:$("#sl-data").value||todayKey(), conta, par: ehCartao&&tipoSel==="s" ? +$("#sl-par").value||1 : 1 };
    if(editando){ Object.assign(editando, dados); delete editando.fat; }
    else S.fin.lanc.push({id:uid(), ts:Date.now(), src:"m", ...dados});
  }
  fecharSheets(); save(); renderDinheiro();
  toast(editando ? "Lançamento atualizado." : (tipoSel==="e" ? "Entrada lançada." : "Gasto lançado."));
  if(!editando){ const lim=S.fin.orc[c]; if(lim && tipoSel==="s"){ const g=totaisMes(monthKey()).porCat[c]||0; if(g>lim) setTimeout(()=>toast(cat(c).n+": passou do limite do mês."),3300); } }
  editando=null;
}
function apagarLanc(){
  if(!editando) return;
  if(editando.src==="b"){ S.fin.banco.apagados=[...(S.fin.banco.apagados||[]), editando.bid].slice(-3000); }
  if(editando.ref){ const [cid,mk]=editando.ref.split("|"); if(S.fin.pagos[mk]) S.fin.pagos[mk][cid]=false; }
  S.fin.lanc=S.fin.lanc.filter(x=>x!==editando); editando=null;
  fecharSheets(); save(); renderDinheiro(); toast("Lançamento apagado.");
}

/* ---------- Orçamento ---------- */
function renderOrc(){
  const t=totaisMes(curMes);
  const orc=Object.values(S.fin.orc).reduce((a,v)=>a+(v||0),0);
  const gastoOrc=Object.keys(S.fin.orc).filter(k=>S.fin.orc[k]).reduce((a,k)=>a+(t.porCat[k]||0),0);
  $("#o-orc").textContent=brl(orc); $("#o-gasto").textContent=brl(t.sai);
  let d="";
  if(!orc) d="Comece pelas categorias onde o dinheiro mais escapa. Ex.: Comer fora e Compras.";
  else if(S.fin.renda && orc>S.fin.renda) d="O orçamento soma mais do que entra no mês ("+brl(S.fin.renda)+"). Vale diminuir algum limite.";
  else { const ok=Object.keys(S.fin.orc).filter(k=>S.fin.orc[k] && (t.porCat[k]||0)<=S.fin.orc[k]).length; const tot=Object.values(S.fin.orc).filter(Boolean).length;
    d=ok+" de "+tot+" categorias dentro do limite em "+nomeMes(curMes,false)+". Nas categorias com limite, já foi "+brl(gastoOrc)+"."; }
  $("#o-dica").textContent=d;
  const box=$("#o-lista"); box.textContent="";
  const cats=catsDoTipo("s").filter(c=>c.t==="s");
  const com=cats.filter(c=>S.fin.orc[c.id]||t.porCat[c.id]).sort((a,b)=>(t.porCat[b.id]||0)-(t.porCat[a.id]||0));
  const sem=cats.filter(c=>!com.includes(c));
  const linha=c=>{
    const g=t.porCat[c.id]||0, lim=S.fin.orc[c.id]||0;
    const it=mkItem(lim&&g>lim?"hot":"");
    const top=el("div","top"); top.append(el("b",null,c.n), el("span",null, lim ? brl(g)+" de "+brl(lim) : brl(g)));
    it.append(top);
    if(lim){ it.append(barra(g/lim*100, g>lim?"over":g>=lim*.85?"warn":""));
      it.append(el("p","sub", g>lim ? "Passou "+brl(g-lim)+" do limite." : "Ainda pode gastar "+brl(lim-g)+".")); }
    const a=el("div","acts"); const i=el("input","valor"); i.inputMode="decimal"; i.placeholder="Limite por mês (R$)"; i.setAttribute("aria-label","Limite de "+c.n);
    i.value = lim ? fmt(lim) : "";
    const ok=el("button","btn-ghost",lim?"Mudar":"Definir");
    const salvar=()=>{ const v=num(i.value); if(v===(S.fin.orc[c.id]||0)) return false; if(v) S.fin.orc[c.id]=v; else delete S.fin.orc[c.id]; save(); renderOrc(); toast(v?"Limite salvo. Vale para todos os meses.":"Limite removido."); return true; };
    i.onchange=salvar; i.onkeydown=e=>{ if(e.key==="Enter"){ e.preventDefault(); salvar(); } };
    ok.onclick=()=>{ if(!salvar() && num(i.value)) toast("Limite salvo. Vale para todos os meses."); };
    a.append(i,ok); it.append(a);
    if(c.custom) it.append(delBtn("Apagar categoria", ()=>{ S.fin.cats=S.fin.cats.filter(z=>z.id!==c.id); delete S.fin.orc[c.id]; S.fin.lanc.forEach(l=>{ if(l.cat===c.id) l.cat="outros"; }); save(); renderOrc(); }));
    return it;
  };
  com.forEach(c=>box.append(linha(c)));
  if(sem.length){ const d=el("details"); d.append(el("summary","small muted",(com.length?"Outras categorias":"Categorias")+" ("+sem.length+")")); const st=el("div","stack"); st.style.marginTop="10px"; sem.forEach(c=>st.append(linha(c))); d.append(st); if(!com.length) d.open=true; box.append(d); }
}

/* ---------- Cartões ---------- */
let cartaoAberto="";
function renderCartoes(){
  const box=$("#c-lista"); box.textContent="";
  if(!S.fin.cartoes.length){ const c=el("div","card"); c.append(el("p","small muted","Nenhum cartão ainda. Cadastre abaixo com o dia em que a fatura fecha e o dia em que vence: assim o app sabe em qual fatura cai cada compra e cada parcela.")); box.append(c); return; }
  S.fin.cartoes.forEach(c=>{
    const card=el("div","card");
    const aberta=fatDe(c,todayKey());
    const vis=el("div","cartao");
    const t1=el("div","between"); t1.append(el("b",null,c.nome), el("span","small", c.src==="b"?"do banco":"fecha dia "+c.fecha+" · vence dia "+c.vence));
    const vAberta=fatura(c,aberta);
    vis.append(t1, el("span","small","Fatura de "+nomeMes(aberta,false)+" (aberta)"), el("span","vlr",brl(Math.max(0,vAberta))));
    let futuro=0; for(let i=1;i<=24;i++) futuro+=Math.max(0,fatura(c,addMes(aberta,i)));
    if(c.limite){ const usado = c.disp!=null ? c.limite-c.disp : Math.max(0,vAberta)+futuro;
      const l=el("div","lim"); const i=el("i"); i.style.width=Math.min(100,usado/c.limite*100)+"%"; l.append(i);
      vis.append(l, el("span","small","Limite usado: "+brl(usado)+" de "+brl(c.limite))); }
    if(futuro>0) vis.append(el("span","small","Já comprometido nas próximas faturas: "+brl(futuro)));
    card.append(vis);
    // faturas: 2 para trás, aberta e 5 para frente
    const fl=el("div","faturas");
    const meses=[]; for(let i=-2;i<=5;i++) meses.push(addMes(aberta,i));
    const vals=meses.map(m=>fatura(c,m)); const mx=Math.max(...vals,1);
    meses.forEach((m,i)=>{ const v=vals[i]; if(v<=0 && m!==aberta) return;
      const pg=faturaPaga(c,m); const passada=m<aberta;
      const r=el("button","fat"); const tr=el("div","t"); const bi=el("i"); bi.style.width=Math.max(0,v/mx*100)+"%"; tr.append(bi);
      r.append(el("span",null,nomeMes(m,false).replace(/^./,x=>x.toUpperCase())), tr, el("span",null, brl(Math.max(0,v))+(pg?" ✓":passada?" !":"")));
      r.title = pg ? "Paga" : passada ? "Fechada, toque para marcar como paga" : "";
      r.setAttribute("aria-label", nomeMes(m)+": "+brl(v)+(pg?", paga":passada?", não marcada como paga":""));
      r.onclick=()=>{ cartaoAberto = cartaoAberto===c.id+m ? "" : c.id+m; renderCartoes(); };
      fl.append(r);
      if(cartaoAberto===c.id+m){
        const det=el("div","stack"); det.style.padding="4px 0 10px";
        const its=ocorrencias().filter(o=>o.cartao===c.id&&o.mes===m).sort((a,b)=>b.v-a.v);
        its.slice(0,30).forEach(o=>{ const ln=el("div","between small"); ln.append(el("span",null,(o.l.desc||cat(o.l.cat).n)+(o.n>1?" ("+o.i+"/"+o.n+")":"")+(o.proj?" · prevista":"")), el("b",null,(o.l.t==="e"?"− ":"")+brl(o.v))); det.append(ln); });
        if(its.length>30) det.append(el("p","note","e mais "+(its.length-30)+" lançamentos."));
        const pb=el("button","btn-ghost btn-sm", pg?"Desmarcar pagamento":"Marcar fatura como paga");
        pb.onclick=()=>{ S.fin.fatPagas[c.id]=S.fin.fatPagas[c.id]||{}; S.fin.fatPagas[c.id][m]=!pg; save(); renderCartoes(); if(!pg) toast("Fatura marcada como paga."); };
        det.append(pb); fl.append(det);
      }
    });
    card.append(el("h3",null,"Faturas"), fl);
    // editar
    const ed=el("details"); ed.append(el("summary","small muted","Ajustar cartão"));
    const st=el("div","stack"); st.style.marginTop="10px";
    const row=el("div","row"); row.style.flexWrap="nowrap";
    const campo=(lbl,val,cb)=>{ const l=el("label","field"); l.style.flex="1"; l.style.minWidth="0"; l.append(lbl); const i=el("input"); i.inputMode="numeric"; i.value=val||""; i.onchange=()=>cb(i.value); l.append(i); return l; };
    row.append(campo("Fecha dia",c.fecha,v=>{ c.fecha=Math.min(31,Math.max(1,parseInt(v)||1)); save(); renderCartoes(); }),
               campo("Vence dia",c.vence,v=>{ c.vence=Math.min(31,Math.max(1,parseInt(v)||1)); save(); renderCartoes(); }));
    const li=el("label","field"); li.append("Limite (R$)"); const lii=el("input","valor"); lii.inputMode="decimal"; lii.value=c.limite?fmt(c.limite):""; lii.onchange=()=>{ c.limite=num(lii.value); save(); renderCartoes(); }; li.append(lii);
    st.append(row, li);
    if(c.src!=="b") st.append(delBtn("Apagar cartão", ()=>{ if(!confirm("Apagar o cartão "+c.nome+"? As compras lançadas nele passam a contar como pagas no débito.")) return;
      S.fin.cartoes=S.fin.cartoes.filter(z=>z.id!==c.id); S.fin.lanc.forEach(l=>{ if(l.conta===c.id) l.conta=""; }); save(); renderCartoes(); }));
    ed.append(st); card.append(ed);
    box.append(card);
  });
}

/* ---------- Contas (agenda) ---------- */
let diaSel="";
function itensDoMes(mk){
  const hoje=todayKey(); const pagos=S.fin.pagos[mk]||{}; const out=[];
  S.fin.contas.forEach(c=>{ const d=diaEm(mk,c.dia); const pg=!!pagos[c.id]; out.push({tipo:"conta", ref:c, d, nome:c.nome, v:c.valor, pg, atr:!pg&&d<hoje}); });
  S.fin.cartoes.forEach(c=>{ const v=fatura(c,mk); if(v<=0) return; const d=diaEm(mk,c.vence); const pg=faturaPaga(c,mk); out.push({tipo:"fatura", ref:c, d, nome:"Fatura "+c.nome, v, pg, atr:!pg&&d<hoje}); });
  S.fin.dividas.forEach(dv=>{ const k=parcelaNoMes(dv,mk); if(!k) return; const d=diaEm(mk,(dv.diaMes||{})[mk]||dv.dia); const pg=!!(dv.pagMes||{})[mk] || falta(dv)<=0;
    const n=dv.n>1?dv.n:1; const v = n>1 ? dv.vParc : (pg ? (dv.pagMes[mk]||totalDivida(dv)) : falta(dv));
    out.push({tipo:"divida", ref:dv, d, nome:dv.credor+(n>1?" ("+k+"/"+n+")":""), v, pg, atr:!pg&&d<hoje}); });
  return out.sort((a,b)=>a.d.localeCompare(b.d));
}
/* Em qual parcela (1..n) a dívida está no mês mk; 0 se não cai nesse mês */
function parcelaNoMes(dv,mk){ if(!dv.inicio) return 0; const n=dv.n>1?dv.n:1;
  const [y0,m0]=dv.inicio.split("-").map(Number), [y,m]=mk.split("-").map(Number); const i=(y-y0)*12+(m-m0);
  return i>=0&&i<n ? i+1 : 0; }
function marcarDivida(dv, mk, v, pago){
  dv.pagMes=dv.pagMes||{}; const ref="div|"+dv.id+"|"+mk;
  if(pago){ if(dv.pagMes[mk]) return; dv.pagMes[mk]=v; dv.pago=(dv.pago||0)+v; dv.total=Math.max(0,falta(dv)-v);
    if(S.fin.auto) S.fin.lanc.push({id:uid(), ts:Date.now(), src:"div", ref, t:"s", v, desc:"Pagamento: "+dv.credor, cat:"dividas", d:mk===monthKey()?todayKey():diaEm(mk,dv.dia), conta:""});
    if(dv.total<=0){ celebrate(); toast("Dívida quitada! Que conquista."); } }
  else { const pv=dv.pagMes[mk]; if(!pv) return; delete dv.pagMes[mk]; dv.pago=Math.max(0,(dv.pago||0)-pv); dv.total=falta(dv)+pv; S.fin.lanc=S.fin.lanc.filter(l=>l.ref!==ref); }
  save(); renderDinheiro();
}
function linhaItem(it, mk){
  const r=el("label","conta"+(it.pg?" paid":""));
  const ck=el("input"); ck.type="checkbox"; ck.checked=it.pg;
  ck.onchange=()=>{ if(it.tipo==="conta") marcarConta(it.ref, mk, ck.checked); else if(it.tipo==="divida") marcarDivida(it.ref, mk, it.v, ck.checked); else { S.fin.fatPagas[it.ref.id]=S.fin.fatPagas[it.ref.id]||{}; S.fin.fatPagas[it.ref.id][mk]=ck.checked; save(); renderDinheiro(); } if(ck.checked) toast("Paga. Uma preocupação a menos."); };
  const nm=el("span","nm",it.nome); nm.append(el("small",null,(it.atr?"atrasada · ":"")+"vence dia "+(+it.d.slice(8))+(it.tipo==="conta"&&it.ref.cat?" · "+cat(it.ref.cat).n:"")+(it.tipo==="divida"?" · Dívida":"")));
  r.append(ck, nm, el("span","vl",brl(it.v)));
  if(it.tipo==="divida" && !it.pg){ const b=el("button","x","Mudar data"); b.style.fontSize=".8125rem"; b.setAttribute("aria-label","Mudar a data de "+it.nome+" neste mês");
    b.onclick=e=>{ e.preventDefault(); e.stopPropagation(); const sm=nm.querySelector("small"); if(sm.querySelector("input")) return;
      const di=el("input"); di.type="date"; di.min=mk+"-01"; di.max=mk+"-"+pad(diasNoMes(mk)); di.value=it.d; di.style.marginTop="4px";
      const ok=el("button","btn-soft","Salvar"); ok.style.marginLeft="6px";
      ok.onclick=ev=>{ ev.preventDefault(); ev.stopPropagation(); if(!di.value.startsWith(mk)){ toast("Escolha um dia de "+nomeMes(mk,false)+"."); return; }
        const dv=it.ref; dv.diaMes=dv.diaMes||{}; dv.diaMes[mk]=+di.value.slice(8); save(); renderDinheiro(); toast("Data alterada só neste mês."); };
      di.onclick=ev=>ev.stopPropagation(); sm.append(el("br"), di, ok); try{ di.showPicker&&di.showPicker(); }catch(_){} };
    r.append(b); }
  if(it.tipo==="conta"){ const x=el("button","x","✕"); x.setAttribute("aria-label","Remover "+it.nome);
    x.onclick=e=>{ e.preventDefault(); if(!confirm("Remover a conta "+it.nome+"?")) return; S.fin.contas=S.fin.contas.filter(z=>z.id!==it.ref.id); save(); renderDinheiro(); }; r.append(x); }
  return r;
}
function marcarConta(c, mk, pago){
  S.fin.pagos[mk]=S.fin.pagos[mk]||{}; S.fin.pagos[mk][c.id]=pago;
  const ref=c.id+"|"+mk;
  S.fin.lanc=S.fin.lanc.filter(l=>l.ref!==ref);
  if(pago && S.fin.auto){ const hoje=todayKey(); const d = mk===monthKey() ? (diaEm(mk,c.dia)<hoje?diaEm(mk,c.dia):hoje) : diaEm(mk,c.dia);
    S.fin.lanc.push({id:uid(), ts:Date.now(), src:"conta", ref, t:"s", v:c.valor, desc:c.nome, cat:c.cat||"contas", d, conta:""}); }
  save(); renderDinheiro();
}
function renderAgenda(){
  const mk=curMes; const itens=itensDoMes(mk); const hoje=todayKey();
  const cal=$("#a-cal"); cal.textContent="";
  ["D","S","T","Q","Q","S","S"].forEach(h=>cal.append(el("div","h",h)));
  const ini=parseKey(mk+"-01").getDay();
  for(let i=0;i<ini;i++){ const b=el("button","vazio"); b.disabled=true; b.tabIndex=-1; b.setAttribute("aria-hidden","true"); cal.append(b); }
  for(let d=1; d<=diasNoMes(mk); d++){
    const k=mk+"-"+pad(d); const its=itens.filter(x=>x.d===k);
    const b=el("button",(k===hoje?"hoje ":"")+(k===diaSel?"sel":""));
    b.append(el("span",null,d)); const dots=el("span","dots"); its.slice(0,3).forEach(x=>dots.append(el("i",x.pg?"pg":x.atr?"atr":""))); b.append(dots);
    b.setAttribute("aria-label", d+" de "+nomeMes(mk,false)+(its.length?": "+its.map(x=>x.nome).join(", "):""));
    b.onclick=()=>{ diaSel = diaSel===k ? "" : k; renderAgenda(); };
    cal.append(b);
  }
  const ad=$("#a-dia"); ad.textContent="";
  if(diaSel && diaSel.startsWith(mk)){
    const its=itens.filter(x=>x.d===diaSel);
    ad.append(el("h3",null,"Dia "+(+diaSel.slice(8))));
    if(!its.length) ad.append(el("p","small muted","Nada vence neste dia."));
    its.forEach(it=>ad.append(linhaItem(it,mk)));
  } else {
    const prox=itens.filter(x=>!x.pg && (mk!==monthKey() || x.d>=hoje || x.atr)).slice(0,6);
    if(prox.length){ ad.append(el("h3",null, mk===monthKey()?"Próximas a pagar":"A pagar em "+nomeMes(mk,false))); prox.forEach(it=>ad.append(linhaItem(it,mk))); }
  }
  const pagas=itens.filter(x=>x.pg).length;
  $("#f-mes").textContent = itens.length ? pagas+" de "+itens.length+" pagas em "+nomeMes(mk,false)+". Falta pagar "+brl(itens.filter(x=>!x.pg).reduce((a,x)=>a+x.v,0))+"." : "Cadastre aluguel, luz, água, internet... Depois é só marcar quando pagar. Faturas de cartão e parcelas de dívidas aparecem aqui sozinhas.";
  const fc=$("#f-contas"); fc.textContent=""; itens.forEach(it=>fc.append(linhaItem(it,mk)));
  const sc=$("#fc-cat"); if(sc.dataset.n!=String(todasCats().length)){ sc.textContent=""; catsDoTipo("s").filter(c=>c.t==="s").forEach(c=>sc.append(new Option(c.n,c.id))); sc.value="contas"; sc.dataset.n=todasCats().length; }
  $("#fc-auto").checked=!!S.fin.auto;
}

/* ---------- Dívidas e objetivos ---------- */
let divEdit="";
function campo(rotulo, valor, op={}){ const l=el("label","field"); l.style.flex=op.flex||"1"; l.style.minWidth="0"; l.append(rotulo);
  const i=el("input",op.valor?"valor":null); if(op.type) i.type=op.type; if(op.mode) i.inputMode=op.mode; i.value=valor??""; l.append(i); return [l,i]; }
function editorDivida(d){
  const box=el("div","stack sep"); const n0=d.n>1?d.n:1;
  const [lc,ic]=campo("Para quem devo", d.credor);
  const [ls,is]=campo("Peguei (R$)", fmt(d.saldo), {valor:1,mode:"decimal"});
  const [lj,ij]=campo("Juros % ao mês", d.juros||"", {mode:"decimal"});
  const [ln,inn]=campo("Parcelas", n0, {mode:"numeric"});
  const [lv,iv]=campo(n0>1?"Valor de cada parcela":"Vou pagar, com juros", fmt(n0>1?d.vParc:totalDivida(d)), {valor:1,mode:"decimal",flex:"2"});
  const [lm,im]=campo("Começo a pagar em", d.inicio||monthKey(), {type:"month",flex:"2"});
  const [ld,idd]=campo("Vence dia", d.dia||10, {mode:"numeric"});
  const prev=el("p","muted small");
  const ler=()=>calcDivida(num(is.value), num(ij.value), parseInt(inn.value)||1, num(iv.value));
  const atual=()=>{ const x=ler(); lv.firstChild.textContent = x.n>1?"Valor de cada parcela":"Vou pagar, com juros";
    prev.textContent = (x.n>1 ? x.n+"x de "+brl(x.vParc)+" = " : "Total ")+brl(x.total)+" ("+brl(x.total-x.saldo)+" de juros)"+(d.pago?" · já pago "+brl(d.pago):""); };
  // ao mudar juros, peguei ou parcelas, recalcula a parcela sugerida
  [is,ij,inn].forEach(i=>i.addEventListener("input",()=>{ const x=calcDivida(num(is.value),num(ij.value),parseInt(inn.value)||1,0); iv.value=fmt(x.n>1?x.vParc:x.total); atual(); }));
  iv.addEventListener("input",atual);
  const row=(...k)=>{ const r=el("div","row"); r.style.flexWrap="nowrap"; r.append(...k); return r; };
  const ok=el("button","btn-primary","Salvar"); const cancel=el("button","btn-ghost","Cancelar");
  ok.onclick=()=>{ const x=ler(); const nome=ic.value.trim(); if(!nome||!x.saldo){ toast("Preencha para quem deve e quanto pegou."); return; }
    d.credor=nome; aplicarDivida(d,x);
    if(/^\d{4}-\d{2}$/.test(im.value)) d.inicio=im.value; d.dia=Math.min(31,Math.max(1,parseInt(idd.value)||d.dia||10));
    divEdit=""; save(); renderDinheiro(); toast("Dívida atualizada."); };
  cancel.onclick=()=>{ divEdit=""; renderDividas(); };
  const acts=el("div","acts"); acts.append(ok,cancel);
  box.append(lc, row(ls,lj), row(lv,ln), row(lm,ld), prev, acts); atual(); return box;
}
function renderDividas(){
  const fdv=$("#f-dividas"); fdv.textContent="";
  const all=[...S.fin.dividas].sort((a,b)=>(falta(b)>0)-(falta(a)>0) || b.juros-a.juros);
  if(!all.length) fdv.append(el("p","small muted","Nenhuma dívida cadastrada."));
  all.forEach(d=>{
    const quit=falta(d)<=0;
    const it=mkItem(quit?"goal-done":(d.juros>=10?"hot":""));
    it.append(topLine(d.credor, quit?"Quitada":"Falta "+brl(falta(d))));
    if(!quit){ const tot=totalDivida(d); it.append(barra((1-falta(d)/(tot||1))*100)); }
    const parcTxt = d.n>1 ? " · "+d.n+"x de "+brl(d.vParc)+" (pagas: "+Math.min(d.n,Math.floor(((d.pago||0)+0.01)/d.vParc))+" de "+d.n+")" : "";
    it.append(el("p","sub", quit ? "Você quitou essa dívida. Total pago: "+brl(d.pago||0)+"." : "Pegou "+brl(d.saldo)+" · "+d.juros+"% ao mês · total a pagar "+brl(totalDivida(d))+" ("+brl(totalDivida(d)-d.saldo)+" de juros)"+parcTxt+(d.pago?" · já pagou "+brl(d.pago):"")));
    if(!quit && d.inicio){ const n=d.n>1?d.n:1;
      it.append(el("p","sub", (n>1?"Parcelas de "+nomeMes(d.inicio,false)+" a "+nomeMes(addMes(d.inicio,n-1),false):"Pagar em "+nomeMes(d.inicio,false))+", dia "+d.dia+" · aparece em Contas.")); }
    if(divEdit===d.id) it.append(editorDivida(d));
    else { const be=el("button","btn-ghost","Editar"); be.onclick=()=>{ divEdit=d.id; renderDividas(); }; it.append(be); }
    const pad = d.n>1 ? Math.min(d.vParc,falta(d)) : 0;
    if(!quit) it.append(actLine(pad?"Parcela: "+brl(pad):"Valor pago","Registrar pagamento", v=>{ const mkh=monthKey(); if(parcelaNoMes(d,mkh) && !(d.pagMes||{})[mkh]){ marcarDivida(d,mkh,v,true); if(d.total>0) toast("Pagamento registrado. Falta: "+brl(d.total)); return; } d.total=Math.max(0,falta(d)-v); d.pago=(d.pago||0)+v;
      if(S.fin.auto) S.fin.lanc.push({id:uid(), ts:Date.now(), src:"div", t:"s", v, desc:"Pagamento: "+d.credor, cat:"dividas", d:todayKey(), conta:""});
      save(); renderDinheiro();
      if(d.total<=0){ celebrate(); toast("Dívida quitada! Que conquista."); } else toast("Pagamento registrado. Falta: "+brl(d.total)); }, pad));
    it.append(delBtn("Remover", ()=>{ if(!confirm("Remover a dívida com "+d.credor+"?")) return; S.fin.dividas=S.fin.dividas.filter(z=>z.id!==d.id); save(); renderDinheiro(); }));
    fdv.append(it);
  });
  const tot = resisted().reduce((a,v)=>a+(v.val||0),0); const jur = tot*(S.taxa||0)/100;
  $("#m-val").textContent = brl(tot); $("#m-jur").textContent = brl(jur);
  $("#m-jlbl").textContent = "Juros evitados em 1 mês a "+(S.taxa||0)+"%";
  $("#obj-hint").textContent = jur>0 ? "Você já evitou "+brl(jur)+" em juros. Que tal guardar esse valor de verdade em um objetivo?" : "Dê um destino para o dinheiro que não foi para os juros. Quando guardar de verdade, registre aqui.";
  const ob=$("#objetivos"); ob.textContent="";
  if(!S.objetivos.length) ob.append(el("p","small muted","Nenhum objetivo ainda. Escolha uma sugestão abaixo ou crie o seu."));
  S.objetivos.forEach(o=>{
    const done=o.guardado>=o.meta;
    const it=mkItem(done?"goal-done":"");
    it.append(topLine(o.nome, brl(o.guardado)+" de "+brl(o.meta)), barra(o.guardado/o.meta*100));
    it.append(el("p","sub", done ? "Objetivo alcançado!" : Math.round(o.guardado/o.meta*100)+"% · faltam "+brl(o.meta-o.guardado)));
    if(!done) it.append(actLine("Valor guardado","Guardei", v=>{ const was=o.guardado<o.meta; o.guardado+=v; save(); renderDinheiro();
      if(was && o.guardado>=o.meta){ celebrate(); toast("Objetivo alcançado: "+o.nome+"!"); } else toast("Guardado. Seu dinheiro trabalhando para você."); }));
    it.append(delBtn("Remover", ()=>{ S.objetivos=S.objetivos.filter(z=>z.id!==o.id); save(); renderDinheiro(); }));
    ob.append(it);
  });
  const sg=$("#obj-sug"); if(!sg.childElementCount) OBJ_SUG.forEach(t=>{ const b=el("button","chip",t); b.type="button"; b.onclick=()=>{ $("#obj-nome").value=t; $("#obj-meta").focus(); }; sg.append(b); });
}

let sampleChecked=false;
async function planoFin(){
  if(!sample) return;
  const b=$("#fin-btn"), o=$("#fin-out"); b.disabled=true; o.hidden=false; o.textContent="Lendo seus números...";
  try{
    await sample(RULES+"\n"+contextText()+"\n\nCom base nos números de finanças acima, monte um plano simples para este mês em até 8 linhas curtas: quanto separar para contas, faturas, dívidas (priorizando a de juro mais alto, especialmente agiota), objetivos e dia a dia. Aponte a categoria de gasto que mais pesa e um limite realista para ela. Se faltar dinheiro no mês, sugira cortes e renegociação, nunca um novo empréstimo. Se faltarem números, diga quais preencher. Use valores em reais.",
      {onText:({text})=>{ o.textContent=text; }});
  }catch(e){ o.textContent=aiErr(e)||"Tente de novo."; }
  b.disabled=false;
}

/* ================= BANCO (Meu Pluggy, pelo servidor no Cloudflare) ================= */
const PLUGGY_WIDGET = "https://cdn.pluggy.ai/pluggy-connect/v2.7.0/pluggy-connect.js";
const MEU_PLUGGY = 200; // conector do Meu Pluggy: grátis para os seus próprios dados
let sincronizando=false;

function urlServidor(){ return (S.fin.banco.url || PLUGGY_WORKER_URL || "").trim().replace(/\/+$/,""); }
async function chamar(rota, corpo){
  const base=urlServidor(); if(!base) throw new Error("Falta o endereço do servidor da conexão (aba Banco).");
  if(!auth || !auth.currentUser) throw new Error("Entre com a sua conta Google para conectar o banco.");
  const token=await auth.currentUser.getIdToken();
  let r;
  try{ r=await fetch(base+rota,{method:"POST", headers:{"Content-Type":"application/json","Authorization":"Bearer "+token}, body:JSON.stringify(corpo||{})}); }
  catch(e){ throw new Error("Não consegui falar com o servidor. Confira o endereço e a internet."); }
  const j=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(j.erro || ("O servidor respondeu com erro "+r.status+"."));
  return j;
}
function carregarScript(src){ return new Promise((ok,err)=>{ if(window.PluggyConnect) return ok(); const s=document.createElement("script"); s.src=src; s.onload=()=>ok(); s.onerror=()=>err(new Error("Não carregou a janela da Pluggy.")); document.head.append(s); }); }

async function conectarBanco(atualizarItem){
  const msg=$("#b-msg"); msg.textContent="Abrindo a conexão...";
  try{
    const {accessToken}=await chamar("/connect-token", atualizarItem?{itemId:atualizarItem}:{});
    await carregarScript(PLUGGY_WIDGET);
    const pc=new window.PluggyConnect({
      connectToken:accessToken, includeSandbox:false, connectorIds:[MEU_PLUGGY],
      ...(atualizarItem?{updateItem:atualizarItem}:{}),
      onSuccess:({item})=>{ const b=S.fin.banco; if(item && item.id && !b.items.some(i=>i.id===item.id)) b.items.push({id:item.id, nome:(item.connector&&item.connector.name)||"Meu Pluggy", status:item.status||""});
        save(); msg.textContent="Conectado! Buscando suas movimentações..."; sincronizar(true); },
      onError:e=>{ msg.textContent="A conexão não foi concluída. "+((e&&e.message)||""); },
      onClose:()=>{ if(msg.textContent==="Abrindo a conexão...") msg.textContent=""; }
    });
    pc.init(); msg.textContent="";
  }catch(e){ msg.textContent=e.message; }
}

function mapCat(pc, desc, tipo){
  const s=(String(pc||"")+" "+String(desc||"")).toLowerCase();
  const tem=re=>re.test(s);
  if(tem(/credit card payment|pagamento de fatura|pgto fatura|pag fatura/)) return "fatura";
  if(tem(/same person|mesma titularidade|entre contas|own account/)) return "entre";
  if(tem(/investment|investiment|aplica[cç][aã]o|poupan[cç]a|cdb|tesouro/)) return "guardado";
  if(tipo==="e"){
    if(tem(/salary|sal[aá]rio|payroll|wage|proventos/)) return "salario";
    return "outrasE";
  }
  if(tem(/groceries|supermarket|supermercado|mercado|atacad|hortifruti|a[cç]ougue/)) return "mercado";
  if(tem(/food delivery|ifood|rappi|restaurant|restaurante|lanchonete|bakery|padaria|eating|bar\b|caf[eé]/)) return "comer";
  if(tem(/taxi|ride|uber|99app|99 pop|gas station|posto|combust|fuel|parking|estacion|public transport|metr[oô]|[oô]nibus|bilhete|toll|ped[aá]gio|transport/)) return "transporte";
  if(tem(/rent|aluguel|condom|housing|moradia|iptu/)) return "casa";
  if(tem(/electric|energia|light|\bluz\b|enel|light s|water|[aá]gua|cedae|internet|telecom|telephone|celular|vivo|claro|\btim\b|\boi\b|utilities|g[aá]s natural|naturgy/)) return "contas";
  if(tem(/pharmac|farm[aá]c|drogari|health|sa[uú]de|hospital|clinic|cl[ií]nica|dentist|laborat|medic/)) return "saude";
  if(tem(/education|school|escola|faculdade|curso|course|book|livr/)) return "educacao";
  if(tem(/streaming|netflix|spotify|disney|prime video|hbo|globoplay|youtube|subscription|assinatura|digital service/)) return "assin";
  if(tem(/leisure|entertainment|lazer|cinema|show|ingresso|travel|viagem|hotel|airline|turismo|games?/)) return "lazer";
  if(tem(/beauty|beleza|sal[aã]o|cosm[eé]t|personal care|barbear/)) return "beleza";
  if(tem(/interest|juros|tarifa|bank fee|\biof\b|fees|anuidade|tax/)) return "taxas";
  if(tem(/loan|empr[eé]stimo|financ/)) return "dividas";
  if(tem(/shopping|clothing|roupa|eletr[oô]n|electronics|department|loja|marketplace|mercado livre|shopee|amazon|magalu/)) return "compras";
  return "outros";
}
const diaDe = iso => iso ? +String(iso).slice(8,10) : 0;

function aplicarSync(r){
  const b=S.fin.banco;
  // itens e status
  (r.items||[]).forEach(it=>{ const x=b.items.find(i=>i.id===it.id); if(x){ x.status=it.status; x.nome=it.nome||x.nome; x.upd=it.atualizado; x.det=it.detalhe||""; } });
  // contas
  b.contas=(r.accounts||[]).map(a=>({id:a.id, item:a.itemId, tipo:a.type, nome:a.name, num:a.number||"", saldo:a.balance, limite:a.creditLimit, disp:a.availableCreditLimit, fecha:a.closeDate, vence:a.dueDate}));
  b.contas.filter(a=>a.tipo==="CREDIT").forEach(a=>{
    let c=S.fin.cartoes.find(x=>x.acc===a.id);
    if(!c){ c={id:uid(), acc:a.id, src:"b", nome:a.nome||"Cartão", fecha:diaDe(a.fecha)||1, vence:diaDe(a.vence)||10, limite:a.limite||0}; S.fin.cartoes.push(c); }
    c.limite=a.limite||c.limite; c.disp=a.disp; if(diaDe(a.fecha)) c.fecha=diaDe(a.fecha); if(diaDe(a.vence)) c.vence=diaDe(a.vence);
  });
  // movimentações
  const porBid=new Map(S.fin.lanc.filter(l=>l.bid).map(l=>[l.bid,l]));
  const apagados=new Set(b.apagados||[]);
  let novos=0;
  (r.transactions||[]).forEach(t=>{
    if(apagados.has(t.id)) return;
    const conta=b.contas.find(a=>a.id===t.accountId); const ehCartao=conta&&conta.tipo==="CREDIT";
    const c = ehCartao ? S.fin.cartoes.find(x=>x.acc===t.accountId) : null;
    let tipo = t.type==="CREDIT" ? "e" : t.type==="DEBIT" ? "s" : null;
    if(!tipo) tipo = ehCartao ? (t.amount>0?"s":"e") : (t.amount<0?"s":"e");
    const d=String(t.date).slice(0,10), v=Math.abs(+t.amount||0); if(!v) return;
    let fat;
    if(c){ fat = (t.inst>1 && t.purchaseDate) ? addMes(fatDe(c, String(t.purchaseDate).slice(0,10)), t.inst-1) : fatDe(c, d); }
    const x=porBid.get(t.id);
    if(x){ x.v=v; x.d=d; x.t=tipo; if(fat) x.fat=fat; return; }
    const regra=b.regras[normDesc(t.description)];
    S.fin.lanc.push({id:uid(), ts:Date.now(), src:"b", bid:t.id, d, v, t:tipo, desc:t.description||"", dOrig:t.description||"",
      cat: regra || mapCat(t.category, t.description, tipo), conta: c?c.id:t.accountId, ...(fat?{fat}:{}),
      ...(t.inst?{inst:t.inst, tot:t.totalInst, pd:String(t.purchaseDate||"").slice(0,10), ta:t.totalAmount}:{})});
    novos++;
  });
  // limite de tamanho: guarda os 3000 mais recentes do banco
  const doBanco=S.fin.lanc.filter(l=>l.src==="b");
  if(doBanco.length>3000){ const corte=new Set(doBanco.sort((a,b)=>a.d.localeCompare(b.d)).slice(0,doBanco.length-3000)); S.fin.lanc=S.fin.lanc.filter(l=>!corte.has(l)); }
  b.ult=Date.now(); b.erro="";
  return novos;
}

async function sincronizar(manual){
  const b=S.fin.banco; if(sincronizando || !b.items.length || !urlServidor()) return;
  sincronizando=true; const msg=$("#b-msg"); if(manual) msg.textContent="Atualizando...";
  $("#b-sync").disabled=true;
  try{
    const desde = b.ult ? addDays(keyOf(new Date(b.ult)), -10) : (b.desde || addDays(todayKey(), -90));
    const r=await chamar("/sync",{itemIds:b.items.map(i=>i.id), from:desde, refresh:!!manual});
    const n=aplicarSync(r);
    save(); renderDinheiro();
    msg.textContent = n ? n+" movimentações novas." : "Tudo em dia.";
    if(manual) toast(n ? n+" movimentações novas do banco." : "Banco em dia.");
  }catch(e){ b.erro=e.message; msg.textContent=e.message; save(); }
  sincronizando=false; $("#b-sync").disabled=false; if(sub==="banco") renderBanco();
}

const STATUS_ITEM = { UPDATED:"Atualizado", UPDATING:"Atualizando no banco...", LOGIN_ERROR:"Precisa reconectar", OUTDATED:"Desatualizado: tente atualizar ou reconectar", WAITING_USER_INPUT:"Esperando você confirmar no banco", WAITING_USER_ACTION:"Esperando você confirmar no banco" };
function renderBanco(){
  const b=S.fin.banco;
  if(document.activeElement!==$("#b-url")) $("#b-url").value=b.url||PLUGGY_WORKER_URL||"";
  $("#b-desde").value = b.desde || addDays(todayKey(),-90); $("#b-desde").max=todayKey();
  const st=$("#b-status");
  const ruim=b.items.find(i=>/ERROR|OUTDATED|WAITING/.test(i.status||""));
  st.className="status"+(b.items.length?(b.erro||ruim?" err":" on"):"");
  st.querySelector("span").textContent = !b.items.length ? "Nenhum banco conectado" :
    b.erro ? "Erro na última atualização" : ruim ? (STATUS_ITEM[ruim.status]||ruim.status) :
    "Conectado · atualizado "+(b.ult? new Date(b.ult).toLocaleString("pt-BR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}) : "ainda não");
  $("#b-sync").hidden=!b.items.length;
  $("#b-conectar").textContent = b.items.length ? (ruim&&/LOGIN|WAITING/.test(ruim.status)?"Reconectar":"Conectar outro") : "Conectar Meu Pluggy";
  $("#b-desligar").hidden=!b.items.length;
  const box=$("#b-contas"); box.textContent="";
  b.contas.forEach(a=>{ const it=mkItem();
    it.append(topLine((a.nome||(a.tipo==="CREDIT"?"Cartão":"Conta")), a.tipo==="CREDIT" ? (a.disp!=null?"disponível "+brl(a.disp):"") : brl(a.saldo||0)));
    if(a.tipo==="CREDIT" && a.limite) it.append(el("p","sub","Limite "+brl(a.limite)+(a.vence?" · vence dia "+diaDe(a.vence):"")));
    box.append(it); });
  if(!b.items.length && !urlServidor()) box.append(el("p","small muted","Para conectar, primeiro crie o servidor da conexão (passo a passo no README) e cole o endereço dele aqui embaixo."));
}

/* ================= APARÊNCIA ================= */
function setVisual(mud){ S.visual=Object.assign(VISUAL_PADRAO(), S.visual||{}, mud); aplicarVisual(S.visual); save(); renderVisual(); if(!$("#v-dinheiro").hidden) renderDinheiro(); }
function segmento(box, opcoes, atual, cb){
  box.textContent=""; Object.entries(opcoes).forEach(([k,v])=>{ const b=el("button",null,typeof v==="string"?v:v.nome); b.type="button"; b.setAttribute("aria-pressed",k===atual); b.onclick=()=>cb(k); box.append(b); });
}
let fontesPrevia=false;
function renderVisual(){
  const v=Object.assign(VISUAL_PADRAO(), S.visual||{});
  if(!fontesPrevia){ fontesPrevia=true; const l=document.createElement("link"); l.rel="stylesheet"; l.href=fonteUrlTodas(); document.head.append(l); }
  const tb=$("#sv-temas"); tb.textContent="";
  Object.entries(TEMAS).forEach(([k,t])=>{ const a=amostra(k);
    const b=el("button","tema-op"); b.type="button"; b.setAttribute("aria-pressed", k===v.tema);
    const pv=el("div","pv"); pv.style.background=a.bg;
    [[a.primary,26,34],[a.sun,18,22],[a.sunk,18,14]].forEach(([c,w,h])=>{ const i=el("i"); i.style.cssText=`background:${c};width:${w}px;height:${h}px`; pv.append(i); });
    b.append(pv, el("span",null,t.nome)); b.onclick=()=>setVisual({tema:k, cor:"", destaque:""}); tb.append(b); });
  const pintaCores=(box, atual, chave, padrao)=>{
    box.textContent="";
    const auto=el("button","chip","Do tema"); auto.type="button"; auto.setAttribute("aria-pressed", !atual); auto.onclick=()=>setVisual({[chave]:""}); box.append(auto);
    CORES_RAPIDAS.forEach(c=>{ const b=el("button","cor-op"); b.type="button"; b.style.background=c; b.setAttribute("aria-label","Cor "+c); b.setAttribute("aria-pressed", atual.toLowerCase()===c.toLowerCase()); b.onclick=()=>setVisual({[chave]:c}); box.append(b); });
    const lv=el("label","cor-livre"); lv.title="Escolher qualquer cor"; const i=el("input"); i.type="color"; i.value=atual||padrao; i.setAttribute("aria-label","Escolher qualquer cor");
    i.oninput=()=>{ S.visual[chave]=i.value; aplicarVisual(S.visual); }; i.onchange=()=>setVisual({[chave]:i.value}); lv.append(i); box.append(lv);
  };
  pintaCores($("#sv-cores"), v.cor||"", "cor", TEMAS[v.tema].p);
  pintaCores($("#sv-destaques"), v.destaque||"", "destaque", TEMAS[v.tema].a);
  const fb=$("#sv-fontes"); fb.textContent="";
  Object.entries(FONTES).forEach(([k,f])=>{ const b=el("button","fonte-op"); b.type="button"; b.setAttribute("aria-pressed",k===v.fonte);
    const t=el("b",null,f.nome); t.style.fontFamily = f.d ? `"${f.d}", system-ui` : "system-ui"; const s=el("small",null, f.d ? (f.d===f.b?f.d:f.d+" + "+f.b) : "Fonte padrão do aparelho");
    b.append(t,s); b.onclick=()=>setVisual({fonte:k}); fb.append(b); });
  segmento($("#sv-tam"), TAMANHOS, v.tam, k=>setVisual({tam:k}));
  segmento($("#sv-cantos"), CANTOS, v.cantos, k=>setVisual({cantos:k}));
  segmento($("#sv-modo"), MODOS, v.modo, k=>setVisual({modo:k}));
}
function abrirVisual(){ renderVisual(); abrirSheet("#sh-visual"); }

/* ================= CALCULADORA NOS CAMPOS DE VALOR ================= */
const fmt = v => { v=Math.round(v*100)/100; return v.toLocaleString("pt-BR",{minimumFractionDigits: v%1?2:0, maximumFractionDigits:2}); };
let calcBar=null, calcAlvo=null;
function montarCalc(){
  calcBar=el("div","calcbar"); calcBar.setAttribute("role","group"); calcBar.setAttribute("aria-label","Calculadora");
  [["+","+"],["−","-"],["×","*"],["÷","/"],["(","("],[")",")"]].forEach(([t,op])=>{ const b=el("button",null,t); b.type="button"; b.tabIndex=-1;
    b.addEventListener("pointerdown",e=>{ e.preventDefault(); inserir(op==="*"?"x":op); }); b.onclick=e=>{ if(e.detail===0) inserir(op==="*"?"x":op); }; calcBar.append(b); });
  const eq=el("button","eq","="); eq.type="button"; eq.tabIndex=-1;
  eq.addEventListener("pointerdown",e=>{ e.preventDefault(); resolver(); }); eq.onclick=e=>{ if(e.detail===0) resolver(); };
  const out=el("output"); calcBar.append(eq,out);
}
function inserir(t){
  const i=calcAlvo; if(!i) return; const a=i.selectionStart??i.value.length, b=i.selectionEnd??i.value.length;
  i.value=i.value.slice(0,a)+t+i.value.slice(b); try{ i.setSelectionRange(a+t.length,a+t.length); }catch(e){}
  i.dispatchEvent(new Event("input",{bubbles:true}));
}
function resolver(){ const i=calcAlvo; if(!i) return; const v=calcular(i.value); if(isFinite(v)){ i.value=fmt(v); i.dispatchEvent(new Event("input",{bubbles:true})); i.dispatchEvent(new Event("change",{bubbles:true})); } previaCalc(); }
function previaCalc(){
  if(!calcBar||!calcAlvo) return; const o=calcBar.querySelector("output"); const v=calcular(calcAlvo.value);
  o.textContent = temConta(calcAlvo.value) ? (isFinite(v)?"= "+brl(v):"conta incompleta") : "";
}
document.addEventListener("focusin",e=>{
  const i=e.target; if(!(i instanceof HTMLInputElement) || !i.classList.contains("valor")) return;
  if(!calcBar) montarCalc();
  calcAlvo=i; const pai=i.parentElement; (pai && pai.classList.contains("acts") ? pai : i).insertAdjacentElement("afterend", calcBar); previaCalc();
});
document.addEventListener("focusout",e=>{
  if(e.target!==calcAlvo) return;
  const i=calcAlvo;
  setTimeout(()=>{ if(document.activeElement===i) return;
    if(temConta(i.value)){ const v=calcular(i.value); if(isFinite(v)){ i.value=fmt(v); i.dispatchEvent(new Event("input",{bubbles:true})); i.dispatchEvent(new Event("change",{bubbles:true})); } }
    if(calcAlvo===i){ calcBar.remove(); calcAlvo=null; } },120);
});
document.addEventListener("input",e=>{ if(e.target===calcAlvo) previaCalc(); });

/* ---------- Render: Apoio ---------- */
function renderApoio(){
  const ul=$("#motivos"); ul.textContent="";
  S.motivos.forEach((m,i)=>{ const li=document.createElement("li"); const p=document.createElement("p"); p.textContent=m;
    const x=document.createElement("button"); x.textContent="Remover"; x.setAttribute("aria-label","Remover motivo"); x.onclick=()=>{ S.motivos.splice(i,1); save(); renderAll(); };
    li.append(p,x); ul.append(li); });
  if(document.activeElement!==$("#carta")) $("#carta").value = S.carta||"";
  const bx=$("#barreiras"); bx.textContent="";
  BARR.forEach(([id,t])=>{ const l=document.createElement("label"); l.className="check";
    const c=document.createElement("input"); c.type="checkbox"; c.id="b-"+id; c.checked=!!S.barreiras[id];
    c.onchange=()=>{ S.barreiras[id]=c.checked; save(); renderHoje(); if(c.checked) toast("Barreira levantada."); };
    const s=document.createElement("span"); s.textContent=t; l.append(c,s); bx.append(l); });
  const has = S.contato.nome||S.contato.tel;
  $("#ct-show").hidden=!has; $("#ct-name").textContent=S.contato.nome||"Contato"; $("#ct-tel").textContent=S.contato.tel||""; $("#ct-show").href = S.contato.tel ? "tel:"+S.contato.tel.replace(/[^0-9+]/g,"") : "";
  if(document.activeElement!==$("#ct-in-name")) $("#ct-in-name").value=S.contato.nome||"";
  if(document.activeElement!==$("#ct-in-tel")) $("#ct-in-tel").value=S.contato.tel||"";
  if(document.activeElement!==$("#aj-nome")) $("#aj-nome").value = S.nome||"";
  $("#aj-inicio").value = S.inicio; $("#aj-inicio").max = todayKey();
  if(document.activeElement!==$("#aj-taxa")) $("#aj-taxa").value = S.taxa;
}

/* ---------- SOS ---------- */
let rIdx=0, tLeft=900, tInt=null, bInt=null;
function renderSOS(){
  const ms = S.motivos.length ? S.motivos : ["Escreva seus motivos na aba Apoio."];
  $("#reason").textContent = ms[rIdx % ms.length];
  const has=(S.carta||"").trim(); $("#sos-letter").hidden=!has; $("#sos-letter-txt").textContent=S.carta||"";
  const ct=$("#sos-contact"); ct.textContent="";
  if(S.contato.tel){ const p=document.createElement("p"); p.className="contact"; p.innerHTML='<span class="c-ic">'+icone("telefone")+'</span><span class="c-t"><b></b><small>Pessoa de confiança</small></span><a class="num"></a>';
    p.querySelector("b").textContent=S.contato.nome||"Pessoa de confiança"; const nn=p.querySelector(".num"); nn.textContent=S.contato.tel; nn.href="tel:"+S.contato.tel.replace(/[^0-9+]/g,""); ct.append(p); }
  else { const p=document.createElement("p"); p.className="small muted"; p.textContent="Cadastre uma pessoa de confiança na aba Apoio. Se precisar de apoio emocional agora, o CVV atende 24 horas no 188."; ct.append(p); }
}
function clock(){ $("#t-clock").textContent = pad(Math.floor(tLeft/60))+":"+pad(tLeft%60); }
const PH=[["Inspire",4,1],["Segure",4,1],["Solte",6,.6]];
function breathe(){
  const c=$("#circle"), l=$("#breath-lbl"); let i=0;
  const step=()=>{ const [t,s,sc]=PH[i%3]; l.textContent=t; c.style.transitionDuration=s+"s"; c.style.transform="scale("+sc+")"; i++; bInt=setTimeout(step,s*1000); };
  step();
}
function startTimer(){
  if(tInt) return;
  $("#t-start").hidden=true; $("#t-stop").hidden=false;
  tInt=setInterval(()=>{ tLeft--; clock(); if(tLeft%45===0){ rIdx++; renderSOS(); } if(tLeft<=0){ stopTimer(); tLeft=900; $("#t-clock").textContent="Você esperou 15 minutos"; toast("Você atravessou a onda."); celebrate(); } },1000);
  breathe();
}
function stopTimer(){ clearInterval(tInt); tInt=null; clearTimeout(bInt); $("#t-start").hidden=false; $("#t-start").textContent= tLeft<900?"Continuar":"Começar os 15 minutos"; $("#t-stop").hidden=true; $("#breath-lbl").textContent="Pausado"; $("#circle").style.transform="scale(.6)"; }

/* ---------- IA ---------- */
function contextText(){
  const top = o => Object.entries(o).sort((a,b)=>b[1]-a[1]).slice(0,3).map(e=>e[0]).join(", ") || "ainda sem registros";
  const done = BARR.filter(([id])=>S.barreiras[id]).map(b=>b[1]);
  return "Contexto da usuária"+(S.nome?" ("+S.nome+")":"")+": está há "+streak()+" dias sem pegar dinheiro com agiota; recorde de "+best()+" dias; "+resisted().length+" vontades vencidas registradas. "+
    "Ela relata que pega dinheiro emprestado com agiota por compulsão, mesmo sem precisar. "+
    "Seus motivos: "+(S.motivos.join(" | ")||"não escritos")+". Sentimentos mais comuns antes da vontade: "+top(countBy(v=>v.sent||[]))+". Situações mais comuns: "+top(countBy(v=>v.sit||[]))+". "+
    finText()+" Barreiras já feitas: "+(done.join("; ")||"nenhuma ainda")+". Pessoa de confiança cadastrada: "+(S.contato.nome||"nenhuma")+".";
}
const RULES = `Você é a companhia de apoio do app "Dia Livre", que ajuda uma pessoa a parar de pegar dinheiro com agiota por impulso. Responda sempre em português do Brasil, com calor humano, sem julgamento, em mensagens curtas (no máximo 5 frases curtas, porque ela lê no celular).
Como agir:
- Acolha o sentimento primeiro e ajude a nomeá-lo. Faça no máximo uma pergunta por mensagem.
- Na hora da vontade: lembre que a vontade é uma onda que passa em minutos, proponha esperar 15 minutos no botão SOS, respirar devagar, sair do lugar, beber água, ligar para a pessoa de confiança, e relembre os motivos dela.
- Celebre conquistas de forma concreta e calorosa.
- Em recaídas: sem culpa; ajude a entender o que veio antes e qual barreira pode ser reforçada.
- Incentive acompanhamento com psicólogo ou CAPS; você não substitui terapia e não faz diagnóstico.
- Nunca sugira técnicas que causem dor, choque ou desconforto físico.
- Não recomende empréstimos, produtos financeiros ou investimentos.
- Se ela mencionar ameaça, cobrança violenta ou medo pela segurança: oriente ligar 190 e ficar perto de alguém de confiança.
- Se ela mencionar vontade de se machucar ou de morrer: acolha, oriente ligar agora para o CVV (188) ou SAMU (192) e procurar alguém por perto.
`;
function aiErr(e){
  const c=e&&e.code;
  if(c==="not_granted") return "A IA recusou o acesso (falta concluir o App Check no Firebase). Detalhe: "+String(e.message||"").slice(0,160);
  if(c==="rate_limited") return "Muitas mensagens em pouco tempo. Respire um pouco e tente de novo daqui a alguns minutos.";
  if(c==="cancelled") return "";
  const m=String((e&&e.message)||e||"");
  const motivo=(m.split(/\]\s*/).slice(1).join("] ")||m).replace(/https?:\/\/\S+/g,"").trim(); // tira o endereço longo e deixa o motivo
  if(/API key not valid|API_KEY_INVALID/i.test(m)) return "A chave do Firebase foi recusada pela IA. Detalhe: "+motivo.slice(0,300);
  if(/location is not supported/i.test(m)) return "A IA não está liberada para esta região. Detalhe: "+motivo.slice(0,300);
  if(/billing|quota|RESOURCE_EXHAUSTED/i.test(m)) return "A cota gratuita da IA acabou por hoje ou exige faturamento. Detalhe: "+motivo.slice(0,300);
  return "Não consegui responder agora. Detalhe: "+motivo.slice(0,400);
}
async function incentivo(){
  if(!sample) return;
  const b=$("#inc-btn"), o=$("#inc-out"); b.disabled=true; o.hidden=false; o.textContent="Escrevendo...";
  try{
    await sample(RULES+"\n"+contextText()+"\n\nEscreva uma mensagem de incentivo para hoje, com até 3 frases, citando um dos motivos dela e o número de dias. Sem saudação longa.",
      {modelTier:"quick", cache:{gcTime:3600000}, onText:({text})=>{ o.textContent=text; }});
  }catch(e){ o.textContent=aiErr(e) || "Tente de novo."; }
  b.disabled=false; b.textContent="Outro incentivo";
}
async function padrao(){
  if(!sample) return;
  const b=$("#pat-btn"), o=$("#pat-out"); b.disabled=true; o.hidden=false; o.textContent="Lendo seus registros...";
  const reg = S.vontades.slice(0,40).map(v=>{ const d=new Date(v.ts); return d.toLocaleDateString("pt-BR",{weekday:"short"})+" "+pad(d.getHours())+"h, intensidade "+v.int+", "+(v.res?"resistiu":"pegou")+", sentimentos: "+((v.sent||[]).join("/")||"-")+", situação: "+((v.sit||[]).join("/")||"-")+(v.nota?", nota: "+v.nota.slice(0,140):""); }).join("\n");
  try{
    await sample(RULES+"\n"+contextText()+"\n\nRegistros de vontades (mais recentes primeiro):\n"+reg+"\n\nLeia esses registros e responda em até 6 frases curtas: qual padrão aparece (sentimento, situação, horário), o que tem funcionado quando ela resiste, e UMA barreira ou estratégia concreta para testar nesta semana. Não faça diagnóstico.",
      {onText:({text})=>{ o.textContent=text; }});
  }catch(e){ o.textContent=aiErr(e)||"Tente de novo."; }
  b.disabled=false;
}
let ctl=null;
function renderChat(){
  const c=$("#chat"); c.textContent="";
  if(!S.chat.length){ const m=document.createElement("div"); m.className="msg a"; m.textContent="Oi"+(S.nome?", "+S.nome:"")+". Estou aqui com você. Como você está agora?"; c.append(m); }
  S.chat.forEach(t=>{ const m=document.createElement("div"); m.className="msg "+(t.role==="user"?"u":"a"); m.textContent=t.content; c.append(m); });
  $("#quick").hidden = S.chat.length>0;
}
async function send(text){
  text=(text||"").trim(); if(!text) return;
  if(!sample){ $("#c-note").textContent="A conversa com a IA não está disponível neste aparelho. Use o CVV (188) ou sua pessoa de confiança."; return; }
  S.chat.push({role:"user", content:text}); $("#c-in").value=""; renderChat();
  const bubble=document.createElement("div"); bubble.className="msg a"; bubble.textContent="Pensando..."; $("#chat").append(bubble);
  bubble.scrollIntoView({block:"end",behavior:"smooth"});
  $("#c-send").disabled=true; $("#c-stop").hidden=false; $("#c-note").textContent="";
  ctl=new AbortController();
  const turns = S.chat.slice(-16);
  while(turns.length && turns[0].role!=="user") turns.shift();
  try{
    const {text:ans} = await sample([{role:"user",content:RULES+"\n"+contextText()+"\n\nA seguir, a conversa. Responda à última mensagem dela."}, ...turns],
      {cache:false, signal:ctl.signal, onText:({text})=>{ bubble.textContent=text; }});
    S.chat.push({role:"assistant", content:ans});
  }catch(e){
    const partial = e&&e.text;
    if(partial){ S.chat.push({role:"assistant", content:partial}); }
    const msg=aiErr(e); if(msg) $("#c-note").textContent=msg;
  }
  S.chat=S.chat.slice(-40); save(); renderChat();
  $("#c-send").disabled=false; $("#c-stop").hidden=true;
  const last=$("#chat").lastElementChild; if(last) last.scrollIntoView({block:"end",behavior:"smooth"});
}

/* ---------- Efeitos ---------- */
function pick(a){ return a[Math.floor(Math.random()*a.length)]; }
let toastT=null;
function toast(t){ let el=$(".toast"); if(!el){ el=document.createElement("div"); el.className="toast"; el.setAttribute("role","status"); document.body.append(el); }
  el.textContent=t; el.hidden=false; clearTimeout(toastT); toastT=setTimeout(()=>{ el.hidden=true; },3200); }
function celebrate(){ try{ celebrate0(); }catch(e){} }
function celebrate0(){
  if(matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const cv=$("#fx"), x=cv.getContext("2d"); const W=cv.width=innerWidth, H=cv.height=innerHeight;
  const cs=getComputedStyle(document.documentElement);
  const cols=[cs.getPropertyValue("--sun"),cs.getPropertyValue("--primary"),cs.getPropertyValue("--good"),"#ffffff"].map(s=>s.trim()||"#E9A23B");
  const P=Array.from({length:90},()=>({x:W/2,y:H*0.38,vx:(Math.random()-.5)*11,vy:-Math.random()*11-3,s:Math.random()*6+4,c:pick(cols),r:Math.random()*6,vr:(Math.random()-.5)*.3}));
  let f=0; (function loop(){ x.clearRect(0,0,W,H); P.forEach(p=>{ p.vy+=.32; p.x+=p.vx; p.y+=p.vy; p.r+=p.vr; x.save(); x.translate(p.x,p.y); x.rotate(p.r); x.fillStyle=p.c; x.fillRect(-p.s/2,-p.s/4,p.s,p.s/2); x.restore(); });
    if(++f<110) requestAnimationFrame(loop); else x.clearRect(0,0,W,H); })();
}

/* ---------- Navegação ---------- */
const TITULOS={hoje:"Hoje",gatilhos:"Gatilhos",sos:"SOS",dinheiro:"Dinheiro",conversa:"Conversa",apoio:"Apoio"};
function go(tab){
  $("#titulo").textContent=TITULOS[tab]||"Dia Livre";
  $$("[data-view]").forEach(v=>v.hidden = v.id!=="v-"+tab);
  $$("nav.tabs button").forEach(b=>b.setAttribute("aria-current", b.dataset.tab===tab?"page":"false"));
  if(tab==="sos") renderSOS();
  if(tab==="conversa"){ renderChat(); }
  if(tab==="dinheiro"){ renderDinheiro(); }
  scrollTo({top:0});
}
document.addEventListener("click", e=>{
  const t=e.target.closest("[data-tab],[data-go]"); if(!t) return;
  go(t.dataset.tab||t.dataset.go);
  if(t.dataset.go==="conversa" && t.closest("#v-sos") && !S.chat.length){ $("#c-in").value="Estou no SOS, com vontade de pegar dinheiro agora."; }
});

function renderAll(){ renderHoje(); renderDinheiro(); renderGatilhos(); renderApoio(); renderSOS(); renderChat(); }

/* ---------- Eventos ---------- */
$("#g-int").oninput=e=>$("#g-int-v").textContent=e.target.value;
$("#sos-int").oninput=e=>$("#sos-int-v").textContent=e.target.value;
$("#g-save-win").onclick=()=>saveUrge(true);
$("#g-save-fall").onclick=()=>saveUrge(false);
$("#t-start").onclick=startTimer; $("#t-stop").onclick=stopTimer;
$("#reason-next").onclick=()=>{ rIdx++; renderSOS(); };
$("#sos-win").onclick=()=>{
  S.vontades.unshift({ts:Date.now(), int:+$("#sos-int").value, sent:[], sit:["SOS"], val:num($("#sos-val").value), nota:"Venci pelo SOS", res:true});
  $("#sos-val").value=""; stopTimer(); tLeft=900; clock(); $("#t-start").textContent="Começar os 15 minutos";
  save(); renderAll(); celebrate(); toast("Você venceu a onda. Isso é enorme."); go("hoje");
};
$("#inc-btn").onclick=incentivo; $("#pat-btn").onclick=padrao;
$("#c-send").onclick=()=>send($("#c-in").value);
$("#c-in").addEventListener("keydown",e=>{ if(e.key==="Enter"&&!e.shiftKey&&!matchMedia("(pointer:coarse)").matches){ e.preventDefault(); send($("#c-in").value); } });
$("#c-stop").onclick=()=>ctl&&ctl.abort();
$("#c-clear").onclick=()=>{ S.chat=[]; save(); renderChat(); };
$("#quick").addEventListener("click",e=>{ const q=e.target.closest("[data-q]"); if(q) send(q.dataset.q); });
$("#mot-add").onclick=()=>{ const v=$("#mot-in").value.trim(); if(!v) return; S.motivos.push(v); $("#mot-in").value=""; save(); renderAll(); };
$("#mot-in").addEventListener("keydown",e=>{ if(e.key==="Enter"){ e.preventDefault(); $("#mot-add").click(); } });
$("#carta").oninput=e=>{ S.carta=e.target.value; save(); };
$("#carta").onblur=()=>renderHoje();
$("#ct-in-name").oninput=e=>{ S.contato.nome=e.target.value; save(); renderApoio(); };
$("#ct-in-tel").oninput=e=>{ S.contato.tel=e.target.value; save(); renderApoio(); };
$("#aj-inicio").onchange=e=>{ if(e.target.value && diffDays(e.target.value,todayKey())>=0){ S.inicio=e.target.value; save(); renderHoje(); toast("Data atualizada."); } };
$("#aj-nome").oninput=e=>{ S.nome=e.target.value.trim(); save(); };
$("#aj-taxa").oninput=e=>{ S.taxa=num(e.target.value); save(); renderDinheiro(); };

/* ---------- Eventos: finanças, banco e aparência ---------- */
$$(".subnav button").forEach(b=>b.onclick=()=>goSub(b.dataset.sub));
document.addEventListener("click",e=>{
  const g=e.target.closest("[data-sub-go]"); if(g) goSub(g.dataset.subGo);
  const m=e.target.closest("[data-mes]"); if(m){ curMes=addMes(curMes,+m.dataset.mes); diaSel=""; renderDinheiro(); }
  if(e.target.closest("[data-fechar]")) fecharSheets();
  if(e.target.classList && e.target.classList.contains("sheet")) fecharSheets();
  if(e.target.closest("[data-abrir-visual]")) abrirVisual();
});
document.addEventListener("keydown",e=>{ if(e.key==="Escape") fecharSheets(); });
$("#btn-visual").onclick=abrirVisual;
$("#sv-reset").onclick=()=>{ S.visual=VISUAL_PADRAO(); aplicarVisual(S.visual); save(); renderVisual(); toast("Visual original de volta."); };
$("#fab").onclick=()=>abrirLanc(null);
$$("#sl-tipo button").forEach(b=>b.onclick=()=>{ tipoSel=b.dataset.t; $$("#sl-tipo button").forEach(x=>x.setAttribute("aria-pressed",x===b)); if(catSel && !catsDoTipo(tipoSel).some(c=>c.id===catSel)) catSel=""; pintarCats(); infoLanc(); });
["#sl-conta","#sl-par","#sl-data"].forEach(s=>$(s).addEventListener("change",infoLanc));
$("#sl-valor").addEventListener("input",infoLanc);
$("#sl-desc").addEventListener("change",()=>{ if(catSel || editando) return; const d=normDesc($("#sl-desc").value); if(!d) return;
  const igual=[...S.fin.lanc].reverse().find(x=>normDesc(x.desc)===d); const c=S.fin.banco.regras[d] || (igual&&igual.cat);
  if(c && catsDoTipo(tipoSel).some(x=>x.id===c)){ catSel=c; pintarCats(); } });
$("#sl-salvar").onclick=salvarLanc;
$("#sl-apagar").onclick=()=>{ if(confirm("Apagar este lançamento?")) apagarLanc(); };
$("#l-busca").oninput=e=>{ busca=e.target.value; renderLanc(); };
$("#l-filtro").onchange=e=>{ filtroCat=e.target.value; renderLanc(); };
$("#f-renda").oninput=e=>{ S.fin.renda=num(e.target.value); save(); };
$("#f-renda").onchange=()=>renderDinheiro();
$("#fc-add").onclick=()=>{ const nome=$("#fc-nome").value.trim(), valor=num($("#fc-valor").value), dia=Math.min(31,Math.max(0,parseInt($("#fc-dia").value)||0));
  if(!nome||!valor){ toast("Preencha o nome e o valor da conta."); return; }
  S.fin.contas.push({id:uid(),nome,valor,dia,cat:$("#fc-cat").value||"contas"}); $("#fc-nome").value=$("#fc-valor").value=$("#fc-dia").value=""; save(); renderDinheiro(); toast("Conta adicionada."); };
$("#fc-auto").onchange=e=>{ S.fin.auto=e.target.checked; save(); };
/* Com parcelas (n>1) o valor digitado é o de CADA parcela; com 1, é o total */
function calcDivida(saldo,juros,n,dig){ n=Math.max(1,n||1); const vParc = dig ? (n>1 ? dig : r2(dig)) : parcelaPrice(saldo,juros,n);
  return {saldo,juros,n,vParc,total:r2(vParc*n),digitado:!!dig}; }
function aplicarDivida(d,x){ d.saldo=x.saldo; d.juros=x.juros;
  if(x.n>1){ d.n=x.n; d.vParc=x.vParc; d.parc=x.vParc; } else { delete d.n; delete d.vParc; d.parc=x.total; }
  d.total=Math.max(0, r2(x.total-(d.pago||0))); }
function lerDivida(){ return calcDivida(num($("#fd-valor").value), num($("#fd-juros").value), parseInt($("#fd-n").value)||1, num($("#fd-parc").value)); }
function previaDivida(){ const x=lerDivida(), pv=$("#fd-prev");
  $("#fd-parc-lbl").textContent = x.n>1 ? "Valor de cada parcela" : "Vou pagar, com juros";
  $("#fd-parc").placeholder = x.saldo&&!x.digitado ? brl(x.n>1?x.vParc:x.total) : "R$ 0";
  if(x.saldo && x.n>1){ pv.hidden=false; pv.textContent=x.n+"x de "+brl(x.vParc)+" = "+brl(x.total)+" ("+brl(x.total-x.saldo)+" de juros)"; } else pv.hidden=true; }
$("#fd-mes").value=monthKey();
["#fd-valor","#fd-juros","#fd-parc","#fd-n"].forEach(s=>{ $(s).addEventListener("input",previaDivida); $(s).addEventListener("change",previaDivida); });
$("#fd-add").onclick=()=>{ const credor=$("#fd-credor").value.trim(), x=lerDivida();
  if(!credor||!x.saldo){ toast("Preencha para quem deve e quanto pegou."); return; }
  const d={id:uid(),credor,saldo:x.saldo,juros:x.juros,pago:0,pagMes:{},
    inicio:/^\d{4}-\d{2}$/.test($("#fd-mes").value)?$("#fd-mes").value:monthKey(), dia:Math.min(31,Math.max(1,parseInt($("#fd-dia").value)||10))};
  aplicarDivida(d,x);
  S.fin.dividas.push(d); ["#fd-credor","#fd-valor","#fd-juros","#fd-parc","#fd-n","#fd-dia"].forEach(s=>$(s).value=""); $("#fd-mes").value=monthKey(); previaDivida(); save(); renderDinheiro(); };
$("#obj-add").onclick=()=>{ const nome=$("#obj-nome").value.trim(), meta=num($("#obj-meta").value);
  if(!nome||!meta){ toast("Dê um nome e um valor ao objetivo."); return; }
  S.objetivos.push({id:uid(),nome,meta,guardado:0}); $("#obj-nome").value=$("#obj-meta").value=""; save(); renderDinheiro(); toast("Objetivo criado."); };
$("#fin-btn").onclick=planoFin;
$("#o-cat-add").onclick=()=>{ const n=$("#o-cat-nome").value.trim(); if(!n){ toast("Dê um nome à categoria."); return; }
  S.fin.cats.push({id:"c"+uid(), n, ic:"tag"}); $("#o-cat-nome").value=""; save(); renderOrc(); toast("Categoria criada."); };
$("#c-add").onclick=()=>{ const nome=$("#c-nome").value.trim(); if(!nome){ toast("Dê um nome ao cartão."); return; }
  const fecha=Math.min(31,Math.max(1,parseInt($("#c-fecha").value)||1)), vence=Math.min(31,Math.max(1,parseInt($("#c-vence").value)||10));
  S.fin.cartoes.push({id:uid(), nome, fecha, vence, limite:num($("#c-lim").value), src:"m"}); ["#c-nome","#c-fecha","#c-vence","#c-lim"].forEach(s=>$(s).value=""); save(); renderCartoes(); toast("Cartão adicionado."); };
$("#b-url").onchange=e=>{ S.fin.banco.url=e.target.value.trim(); save(); renderBanco(); };
$("#b-desde").onchange=e=>{ S.fin.banco.desde=e.target.value; save(); };
$("#b-conectar").onclick=()=>{ const ruim=S.fin.banco.items.find(i=>/LOGIN|WAITING/.test(i.status||"")); conectarBanco(ruim&&ruim.id); };
$("#b-sync").onclick=()=>sincronizar(true);
$("#b-item-add").onclick=()=>{ const id=$("#b-item").value.trim(); if(!/^[0-9a-f-]{20,}$/i.test(id)){ toast("Esse não parece um ID de item da Pluggy."); return; }
  if(!S.fin.banco.items.some(i=>i.id===id)) S.fin.banco.items.push({id, nome:"Meu Pluggy", status:""}); $("#b-item").value=""; save(); sincronizar(true); };
$("#b-desligar").onclick=()=>{ if(!confirm("Desconectar o banco? As movimentações trazidas do banco serão apagadas do app. Seus lançamentos manuais ficam.")) return;
  const b=S.fin.banco; S.fin.lanc=S.fin.lanc.filter(l=>l.src!=="b"); S.fin.cartoes=S.fin.cartoes.filter(c=>c.src!=="b");
  Object.assign(b,{items:[],contas:[],ult:0,erro:"",apagados:[]}); save(); renderDinheiro(); toast("Banco desconectado."); };
let rsz=null; addEventListener("resize",()=>{ clearTimeout(rsz); rsz=setTimeout(()=>{ if(!$("#v-dinheiro").hidden && sub==="resumo") renderResumo(); },200); });
matchMedia("(prefers-color-scheme: dark)").addEventListener("change",()=>aplicarVisual(S.visual));

/* ---------- Início ---------- */
$$("i[data-ic]").forEach(e=>{ e.outerHTML=icone(e.dataset.ic); });
S = merge(loadLocal());
aplicarVisual(S.visual);
chips("#g-sent",SENT,sel.sent); chips("#g-sit",SIT,sel.sit);
$("#aj-store").textContent="Seus registros ficam salvos neste aparelho.";
clock(); renderAll();
connect();
})();
