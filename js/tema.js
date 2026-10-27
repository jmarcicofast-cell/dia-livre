// Aparência do Dia Livre: temas prontos, cor principal, fonte, tamanho da letra e cantos.
// Cada tema gera as cores do modo claro e do modo escuro a partir de uma cor principal e uma de destaque.

export const TEMAS = {
  calma:   { nome:"Calma",   p:"#1E6C64", a:"#E9A23B" },
  rosa:    { nome:"Rosa",    p:"#B03A6A", a:"#EE8B5E" },
  lavanda: { nome:"Lavanda", p:"#6A4FB3", a:"#E2A93D" },
  oceano:  { nome:"Oceano",  p:"#1F5FA8", a:"#F07B5A" },
  terra:   { nome:"Terra",   p:"#A24F2E", a:"#7A9440" },
  grafite: { nome:"Grafite", p:"#33393D", a:"#D9A441", cinza:true }
};

export const CORES_RAPIDAS = ["#1E6C64","#2B7A3D","#1F5FA8","#0E7C99","#6A4FB3","#9B3FA6","#B03A6A","#C2453C","#A24F2E","#B07A12","#33393D"];

export const FONTES = {
  moderna:  { nome:"Padrão",    d:"Figtree", b:"Figtree", q:"family=Figtree:wght@400;500;600;700;800" },
  expressiva:{ nome:"Expressiva", d:"Bricolage Grotesque", b:"Atkinson Hyperlegible", q:"family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400" },
  redonda:  { nome:"Redonda",   d:"Nunito", b:"Nunito", q:"family=Nunito:wght@400;600;700;800" },
  elegante: { nome:"Elegante",  d:"Fraunces", b:"DM Sans", q:"family=Fraunces:opsz,wght@9..144,600;9..144,700;9..144,800&family=DM+Sans:wght@400;500;700" },
  classica: { nome:"Clássica",  d:"Lora", b:"Source Sans 3", q:"family=Lora:wght@500;600;700&family=Source+Sans+3:wght@400;600;700" },
  alegre:   { nome:"Alegre",    d:"Baloo 2", b:"Nunito Sans", q:"family=Baloo+2:wght@500;700;800&family=Nunito+Sans:wght@400;700" },
  manuscrita:{ nome:"Caderno",  d:"Caveat Brush", b:"Atkinson Hyperlegible", q:"family=Caveat+Brush&family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400" },
  sistema:  { nome:"Do celular", d:"", b:"", q:"" }
};
export const TAMANHOS = { p:{nome:"Pequena", px:15}, m:{nome:"Média", px:16}, g:{nome:"Grande", px:18}, xg:{nome:"Extra", px:20} };
export const CANTOS = { retos:{nome:"Retos", r:6}, medios:{nome:"Médios", r:14}, redondos:{nome:"Redondos", r:22} };
export const MODOS = { auto:"Automático", claro:"Claro", escuro:"Escuro" };

export const VISUAL_PADRAO = () => ({ tema:"calma", cor:"", destaque:"", fonte:"moderna", tam:"m", cantos:"medios", modo:"auto" });

/* ---------- utilidades de cor ---------- */
function hexRgb(h){ h=String(h||"").replace("#",""); if(h.length===3) h=h.split("").map(c=>c+c).join(""); const n=parseInt(h,16); return isNaN(n)?[0,0,0]:[n>>16&255,n>>8&255,n&255]; }
function rgbHex([r,g,b]){ return "#"+[r,g,b].map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,"0")).join(""); }
function rgbHsl([r,g,b]){ r/=255; g/=255; b/=255; const mx=Math.max(r,g,b), mn=Math.min(r,g,b); let h=0,s=0; const l=(mx+mn)/2;
  if(mx!==mn){ const d=mx-mn; s=l>.5?d/(2-mx-mn):d/(mx+mn); h= mx===r?(g-b)/d+(g<b?6:0) : mx===g?(b-r)/d+2 : (r-g)/d+4; h*=60; }
  return [h, s*100, l*100]; }
function hsl(h,s,l){ return `hsl(${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%)`; }
function hslHex(h,s,l){ s/=100; l/=100; const k=n=>(n+h/30)%12, a=s*Math.min(l,1-l), f=n=>l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1))); return rgbHex([f(0)*255,f(8)*255,f(4)*255]); }
function lum(hex){ const c=hexRgb(hex).map(v=>{ v/=255; return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4); }); return .2126*c[0]+.7152*c[1]+.0722*c[2]; }
function mix(a,b,t){ const x=hexRgb(a), y=hexRgb(b); return rgbHex(x.map((v,i)=>v+(y[i]-v)*t)); }
function contraste(a,b){ const A=lum(a)+.05, B=lum(b)+.05; return Math.max(A,B)/Math.min(A,B); }
// Texto que lê bem em cima de uma cor
function tinta(bg){ return contraste(bg,"#FFFFFF") >= contraste(bg,"#151515") ? "#FFFFFF" : "#151515"; }
// Escurece a cor até ter contraste suficiente com o fundo claro (para texto e botões)
function firmar(hex, fundo, alvo){ let [h,s,l]=rgbHsl(hexRgb(hex)); let c=hex; while(contraste(c,fundo)<alvo && l>8){ l-=3; c=hslHex(h,s,l); } return c; }
// Clareia a cor até ler bem no fundo escuro
function acender(hex, fundo, alvo){ let [h,s,l]=rgbHsl(hexRgb(hex)); l=Math.max(l,52); let c=hslHex(h,s,l); while(contraste(c,fundo)<alvo && l<92){ l+=3; c=hslHex(h,s,l); } return c; }

export function paleta(v){
  const t = TEMAS[v.tema] || TEMAS.calma;
  const p0 = v.cor || t.p, a0 = v.destaque || t.a;
  const [h, s0] = rgbHsl(hexRgb(p0));
  const st = t.cinza && !v.cor ? 6 : Math.min(30, Math.max(10, s0*.35));
  const bgL = hslHex(h, st, 95.5);
  const claro = {
    bg: bgL, surface: hslHex(h, st*.6, 99.5), sunk: hslHex(h, st, 91), ink: hslHex(h, Math.min(45,st*2), 13),
    muted: hslHex(h, st*.8, 37), line: hslHex(h, st*.9, 84)
  };
  claro.primary = firmar(p0, claro.surface, 4.6); claro["primary-ink"] = tinta(claro.primary);
  claro.sun = a0; claro["sun-ink"] = tinta(a0); claro["sun-soft"] = mix(a0, "#FFFFFF", .8);
  claro.good = "#2B8A5C"; claro["good-soft"] = "#D7EFE2"; claro.alert = "#C2453C"; claro["alert-soft"] = "#F7DEDA";
  claro.warn = "#B26B00"; claro["warn-soft"] = "#FBEBD0";

  const escuro = {
    bg: hslHex(h, st*.9, 7.5), surface: hslHex(h, st*.8, 11.5), sunk: hslHex(h, st*.8, 16), ink: hslHex(h, st*.6, 91),
    muted: hslHex(h, st*.5, 64), line: hslHex(h, st*.7, 23)
  };
  escuro.primary = acender(p0, escuro.surface, 5.2); escuro["primary-ink"] = tinta(escuro.primary);
  escuro.sun = acender(a0, escuro.surface, 6); escuro["sun-ink"] = tinta(escuro.sun); escuro["sun-soft"] = mix(a0, escuro.bg, .78);
  escuro.good = "#58C18C"; escuro["good-soft"] = "#173527"; escuro.alert = "#EE7E73"; escuro["alert-soft"] = "#3D2220";
  escuro.warn = "#F0B04A"; escuro["warn-soft"] = "#3A2E1A";
  return { claro, escuro };
}

function bloco(o){ return Object.entries(o).map(([k,v])=>`--${k}:${v};`).join(""); }

let fonteCarregada = "";
export function aplicarVisual(v0){
  const v = Object.assign(VISUAL_PADRAO(), v0||{});
  const { claro, escuro } = paleta(v);
  const f = FONTES[v.fonte] || FONTES.moderna;
  const tam = (TAMANHOS[v.tam] || TAMANHOS.m).px;
  const r = (CANTOS[v.cantos] || CANTOS.medios).r;
  const fam = (n, resto) => n ? `"${n}", ${resto}` : resto;
  const tipo = `--display:${fam(f.d,'"Trebuchet MS", system-ui, sans-serif')};--body:${fam(f.b,'system-ui, -apple-system, "Segoe UI", sans-serif')};--fs:${tam}px;--r:${r}px;--r2:${Math.max(4,Math.round(r*.8))}px;`;
  const css = `:root{${bloco(claro)}${tipo}color-scheme:light}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${bloco(escuro)}color-scheme:dark}}
:root[data-theme="dark"]{${bloco(escuro)}color-scheme:dark}`;
  let st = document.getElementById("tema-css");
  if(!st){ st = document.createElement("style"); st.id = "tema-css"; document.head.append(st); }
  st.textContent = css;
  const root = document.documentElement;
  if(v.modo === "claro") root.setAttribute("data-theme","light");
  else if(v.modo === "escuro") root.setAttribute("data-theme","dark");
  else root.removeAttribute("data-theme");
  const escuroAgora = v.modo === "escuro" || (v.modo === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  const meta = document.querySelector('meta[name="theme-color"]');
  if(meta) meta.content = escuroAgora ? escuro.bg : claro.primary;
  if(f.q && fonteCarregada !== f.q){
    fonteCarregada = f.q;
    let l = document.getElementById("fonte-css");
    if(!l){ l = document.createElement("link"); l.rel = "stylesheet"; l.id = "fonte-css"; document.head.append(l); }
    l.href = "https://fonts.googleapis.com/css2?"+f.q+"&display=swap";
  }
}

// Amostra das cores de um tema, para desenhar os cartões de escolha
export function amostra(nomeTema, corExtra){
  const { claro } = paleta(Object.assign(VISUAL_PADRAO(), { tema:nomeTema, cor:corExtra||"" }));
  return claro;
}
export function fonteUrlTodas(){
  return "https://fonts.googleapis.com/css2?"+Object.values(FONTES).filter(f=>f.q).map(f=>f.q).join("&")+"&display=swap&text="+encodeURIComponent("AaBbCcDdEeLlMmNnOoRrSsTtUuVvÍíçãÁá0123456789 ");
}
