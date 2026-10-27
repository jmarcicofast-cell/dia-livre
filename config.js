// Configuração do Firebase do Dia Livre.
// Cole aqui o bloco firebaseConfig que o console do Firebase mostra ao criar o app web.
// Estes valores não são senhas: identificam o projeto. Quem protege os dados são as regras do Firestore.
export const firebaseConfig = {
  apiKey: "AIzaSyCuzgGhUTWDvpd4nbL1a51rM0CpvMOeyYw",
  authDomain: "dia-livre.firebaseapp.com",
  projectId: "dia-livre",
  storageBucket: "dia-livre.firebasestorage.app",
  messagingSenderId: "399867087665",
  appId: "1:399867087665:web:ecceb35b7fc9698ecffe10"
};

// Chave de site do reCAPTCHA v3 usada pelo App Check (protege a IA contra uso indevido).
// Veja o passo 5 do README. Deixe vazio enquanto não tiver.
export const RECAPTCHA_SITE_KEY = "6Ld0GfktAAAAAAJBuqv8fAtumRJV6mq0clrmM1Lq";

// Modelo Gemini usado pela IA de apoio (Firebase AI Logic, Gemini Developer API).
export const GEMINI_MODEL = "gemini-3.8-flash";

// Endereço do servidor da conexão com o banco (Cloudflare Worker). Também dá para colar na aba Dinheiro > Banco.
export const PLUGGY_WORKER_URL = "";
