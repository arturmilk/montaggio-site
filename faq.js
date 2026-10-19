/* link direto para uma pergunta (ex.: perguntas-frequentes.html#cerveja) já abre a resposta.
   Fica num arquivo (e não inline) para a CSP da página aceitar só scripts do próprio site. */
const openHash = () => { const q = document.getElementById(location.hash.slice(1)); if (q && q.tagName === 'DETAILS') q.open = true; };
openHash(); addEventListener('hashchange', openHash);
