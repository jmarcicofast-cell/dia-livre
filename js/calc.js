// Calculadora dos campos de valor: aceita "120+45,90-10", "3x25", "1.500/3", parênteses.
// Não usa eval: lê os números no formato brasileiro e resolve as contas na ordem certa.

function lerNumero(txt){
  let s = txt;
  if(s.includes(",")) s = s.replace(/\./g,"").replace(",", ".");
  else if(/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g,"");
  const v = parseFloat(s);
  return isFinite(v) ? v : NaN;
}

function tokens(expr){
  const out = [];
  const s = String(expr||"").replace(/\s+/g,"").replace(/R\$/gi,"").replace(/[×xX*]/g,"*").replace(/[÷:]/g,"/").replace(/[−–]/g,"-");
  let i = 0;
  while(i < s.length){
    const c = s[i];
    if(/[\d.,]/.test(c)){
      let j = i; while(j < s.length && /[\d.,]/.test(s[j])) j++;
      const v = lerNumero(s.slice(i,j)); if(isNaN(v)) return null;
      out.push(v); i = j;
    } else if("+-*/()".includes(c)){ out.push(c); i++; }
    else return null;
  }
  return out;
}

// Resolve a expressão. Devolve número ou NaN se não der para entender.
export function calcular(expr){
  const t = tokens(expr); if(!t || !t.length) return NaN;
  let p = 0;
  const peek = () => t[p];
  function fator(){
    const k = t[p];
    if(k === "-"){ p++; return -fator(); }
    if(k === "+"){ p++; return fator(); }
    if(k === "("){ p++; const v = soma(); if(t[p] === ")") p++; return v; }
    if(typeof k === "number"){ p++; return k; }
    throw 0;
  }
  function produto(){
    let v = fator();
    while(peek() === "*" || peek() === "/"){
      const op = t[p++]; const w = fator();
      v = op === "*" ? v*w : (w === 0 ? NaN : v/w);
    }
    return v;
  }
  function soma(){
    let v = produto();
    while(peek() === "+" || peek() === "-"){
      const op = t[p++]; const w = produto();
      v = op === "+" ? v+w : v-w;
    }
    return v;
  }
  try{
    const v = soma();
    if(p !== t.length) return NaN;
    return isFinite(v) ? Math.round(v*100)/100 : NaN;
  }catch(e){ return NaN; }
}

// Diz se o texto tem conta (operador entre números), para mostrar o resultado ao lado.
export function temConta(expr){ return /\d\s*[-+*/x×÷:]\s*[\d(]/i.test(String(expr||"")); }
