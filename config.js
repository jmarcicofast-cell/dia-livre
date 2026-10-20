// Configuração do Firebase do Dia Livre.
// Cole aqui o bloco firebaseConfig que o console do Firebase mostra ao criar o app web.
// Estes valores não são senhas: identificam o projeto. Quem protege os dados são as regras do Firestore.
export const firebaseConfig = {
  apiKey: "COLE_AQUI",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

// Chave de site do reCAPTCHA Enterprise usada pelo App Check (protege a IA contra uso indevido).
// Veja o passo 5 do README. Deixe vazio enquanto não tiver.
export const RECAPTCHA_SITE_KEY = "";

// Modelo Gemini usado pela IA de apoio (Firebase AI Logic, Gemini Developer API).
export const GEMINI_MODEL = "gemini-3.8-flash";
