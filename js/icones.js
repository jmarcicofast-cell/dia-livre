// Ícones de linha do Dia Livre (24x24, traço 1.8). Desenhados para o app, no lugar de emojis.
const P = {
  // navegação
  hoje:      '<circle cx="12" cy="12" r="4"/><path d="M12 3v1.5M12 19.5V21M3 12h1.5M19.5 12H21M5.6 5.6l1.1 1.1M17.3 17.3l1.1 1.1M5.6 18.4l1.1-1.1M17.3 6.7l1.1-1.1"/>',
  gatilhos:  '<path d="M4 20V11M10 20V5M16 20v-6M3 20h18"/>',
  sos:       '<path d="M3 12c2.5-3.5 4.5-3.5 7 0s4.5 3.5 7 0c1.2-1.6 2.4-2.3 4-2"/><path d="M3 17c2.5-3 4.5-3 7 0s4.5 3 7 0"/>',
  dinheiro:  '<rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10.5h18M16 15h2"/>',
  conversa:  '<path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H10l-5 4V6a1 1 0 0 1 1-1z"/>',
  apoio:     '<path d="M12 20s-7-4.3-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.7-7 10-7 10z"/>',
  paleta:    '<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1 0 1.7-.7 1.7-1.6 0-.5-.2-.9-.5-1.2a1.6 1.6 0 0 1 1.2-2.7H16a4.5 4.5 0 0 0 4.5-4.5c0-3.9-3.8-7-8.5-7z"/><circle cx="7.8" cy="11" r="1"/><circle cx="10.5" cy="7.6" r="1"/><circle cx="14.8" cy="7.8" r="1"/>',
  mais:      '<path d="M12 5v14M5 12h14"/>',
  esq:       '<path d="M15 5l-7 7 7 7"/>',
  dir:       '<path d="M9 5l7 7-7 7"/>',
  baixo:     '<path d="M6 9l6 6 6-6"/>',
  fechar:    '<path d="M6 6l12 12M18 6L6 18"/>',
  check:     '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  alerta:    '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17.2v.1"/>',
  relogio:   '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  banco:     '<path d="M3 9.5L12 4l9 5.5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/>',
  cartao:    '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3 10h18M7 15h3"/>',
  atualizar: '<path d="M19.5 8A8 8 0 0 0 5 7.5M4.5 16A8 8 0 0 0 19 16.5"/><path d="M19.5 3.5V8H15M4.5 20.5V16H9"/>',
  sair:      '<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l-4-4 4-4M6 12h10"/>',
  telefone:  '<path d="M6.5 3.5h3l1.5 4.5-2 1.5a11 11 0 0 0 5.5 5.5l1.5-2 4.5 1.5v3a2 2 0 0 1-2 2A16 16 0 0 1 4.5 5.5a2 2 0 0 1 2-2z"/>',
  escudo:    '<path d="M12 3.5l7 3v5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9v-5z"/>',
  carta:     '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="M4 7l8 6 8-6"/>',
  estrela:   '<path d="M12 4l2.4 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6z"/>',
  ia:        '<path d="M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6zM18.5 15.5l.8 2 2 .7-2 .8-.8 2-.7-2-2-.8 2-.7z"/>',
  // categorias
  mercado:   '<path d="M3.5 4.5h2l2 11h10l2-8h-13"/><circle cx="9" cy="19" r="1.2"/><circle cx="16.5" cy="19" r="1.2"/>',
  casa:      '<path d="M4 11l8-6.5 8 6.5M6 9.5V19.5h12V9.5"/><path d="M10 19.5v-5h4v5"/>',
  contas:    '<path d="M13 3.5L5.5 13.5H12l-1 7 7.5-10H12z"/>',
  transporte:'<rect x="5" y="4" width="14" height="13" rx="2.5"/><path d="M5 11h14M8 17v2.5M16 17v2.5"/><circle cx="8.5" cy="14" r=".6"/><circle cx="15.5" cy="14" r=".6"/>',
  comer:     '<path d="M7 3.5v7a2 2 0 0 0 2 2v8M5 3.5v5M9 3.5v5M16.5 20.5v-17c-2 1-3 3.5-3 6.5v3.5h3"/>',
  saude:     '<rect x="3.8" y="9" width="16.4" height="6" rx="3" transform="rotate(-45 12 12)"/><path d="M9.9 9.9l4.2 4.2"/>',
  educacao:  '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15.5H5.5A1.5 1.5 0 0 1 4 18zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v15.5h5.5A1.5 1.5 0 0 0 20 18z"/>',
  lazer:     '<path d="M4 8.5a1.5 1.5 0 0 1 1.5-1.5h13A1.5 1.5 0 0 1 20 8.5V10a2 2 0 0 0 0 4v1.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 15.5V14a2 2 0 0 0 0-4z"/><path d="M14 7.5v9" stroke-dasharray="1.5 2"/>',
  compras:   '<path d="M5.5 8h13l-1 12h-11z"/><path d="M9 10.5V7a3 3 0 0 1 6 0v3.5"/>',
  beleza:    '<path d="M12 4l1.8 4.6L18.5 10l-4.7 1.6L12 16.5l-1.8-4.9L5.5 10l4.7-1.4z"/><path d="M18 16v4M16 18h4"/>',
  assin:     '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8.5 20.5h7M10.5 9l4 2-4 2z"/>',
  familia:   '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9.5" r="2.2"/><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0M14.5 15a4 4 0 0 1 6 3.5"/>',
  dividas:   '<ellipse cx="12" cy="7" rx="6.5" ry="2.8"/><path d="M5.5 7v5c0 1.5 2.9 2.8 6.5 2.8s6.5-1.3 6.5-2.8V7M5.5 12v5c0 1.5 2.9 2.8 6.5 2.8s6.5-1.3 6.5-2.8v-5"/>',
  taxas:     '<path d="M18.5 5.5l-13 13"/><circle cx="7.5" cy="7.5" r="2.3"/><circle cx="16.5" cy="16.5" r="2.3"/>',
  outros:    '<path d="M4 8l8-4 8 4v8l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v8"/>',
  salario:   '<rect x="3.5" y="7.5" width="17" height="12" rx="2"/><path d="M9 7.5V5.5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5.5v2M3.5 12.5h17"/>',
  extra:     '<circle cx="12" cy="12" r="8.5"/><path d="M12 8v8M8 12h8"/>',
  outrasE:   '<path d="M17 7L7 17M7 9v8h8"/>',
  fatura:    '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3 10h18M14 15h3"/>',
  entre:     '<path d="M4 8.5h13l-3-3M20 15.5H7l3 3"/>',
  guardado:  '<path d="M5 11.5a6.5 5.5 0 0 1 11.6-3.4H19v3l1.5.8v3l-2 .6-1.5 2.5v2.5h-3v-1.5h-4v1.5H7v-2.8A5.5 5.5 0 0 1 5 11.5z"/><circle cx="15" cy="11" r=".6"/>',
  tag:       '<path d="M4 4h7.5l8.5 8.5-7.5 7.5L4 11.5z"/><circle cx="8.3" cy="8.3" r="1.3"/>'
};
export function icone(nome, cls){
  const d = P[nome] || P.tag;
  return '<svg class="i'+(cls?" "+cls:"")+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+d+'</svg>';
}
// Cor de cada categoria (identidade fixa, não muda com a posição na lista)
export const COR_CAT = {
  mercado:"#2F9E6B", casa:"#7A5AC9", contas:"#D49A12", transporte:"#2A78D6", comer:"#E0603A", saude:"#1C9EA0",
  educacao:"#5867C9", lazer:"#D2558A", compras:"#B0569C", beleza:"#E07AAB", assin:"#5F7F9E", familia:"#7D9233",
  dividas:"#B5543A", taxas:"#9A6B3A", outros:"#7D8590", salario:"#2B8A5C", extra:"#3C9D6A", outrasE:"#4F9F86",
  fatura:"#6B7280", entre:"#6B7280", guardado:"#3B82A6"
};
