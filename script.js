/* =========================================================
   MONTAGGIO · script.js
   Sem 
   7. Loop de scroll (hero, marquee, partida, linha do tempo, CTA)
   ========================================================= */
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 1. UTILIDADES ---------- */
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const eOut = t => 1 - Math.pow(1 - t, 4);
  const range = (p, a, b) => clamp((p - a) / (b - a));
  /* progresso 0→1 de uma seção alta com filho sticky */
  const prog = el => { const r = el.getBoundingClientRect(); return clamp(-r.top / (r.height - innerHeight)); };

  /* ---------- 2. ANO NO RODAPÉ ---------- */
  $('#year').textContent = new Date().getFullYear();

  /* ---------- 3. TEXTO POR PALAVRA ----------
     Lê o texto que já está no HTML (edite lá) e envolve cada palavra
     numa máscara. Mantém <em>, <b> e <br>. */
  const splitEl = el => {
    let i = 0;
    const walk = node => {
      [...node.childNodes].forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.append(' '); return; }
            const w = document.createElement('span'); w.className = 'w';
            const inner = document.createElement('i'); inner.style.setProperty('--i', i++); inner.textContent = part;
            w.append(inner); frag.append(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== 'BR' && !n.classList.contains('px')) walk(n);
      });
    };
    walk(el);
  };
  $$('.split').forEach(splitEl);

  /* ---------- 4. REVEALS ---------- */
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: .15, rootMargin: '0px 0px -8% 0px' });
  $$('.rv,.split').forEach(el => io.observe(el));
  /* a promessa entra primeiro; o lead vem logo atrás */
  setTimeout(() => $('#hero-h').classList.add('in'), 60);
  setTimeout(() => $('#heroLead').classList.add('in'), 280);

  /* ---------- 4b. "VIDA" PIXELADA (em movimento contínuo) ----------
     A palavra é rasterizada num canvas minúsculo (1 px = 1 bloco) e ampliada
     com image-rendering: pixelated. Entrada: os blocos acendem em ondas da
     esquerda para a direita. Depois ela fica viva, a 15 fps (degraus, de propósito):
     um brilho diagonal varre a palavra, poucos blocos cintilam e, a cada 6 s,
     a resolução "engasga" por um instante, como num cartucho antigo.
     Os blocos são pequenos o bastante para a palavra ler bem de longe.
     O texto real continua no HTML (transparente) para leitores de tela e seleção.
     Só anima com a palavra na tela. Com movimento reduzido: texto estático (CSS). */
  const px = $('#pxVida');
  const pixelate = (intro = true) => {
    if (reduce) { px.classList.add('done'); return; }
    const cs = getComputedStyle(px), fs = parseFloat(cs.fontSize);
    const pad = Math.round(fs * .12), W = px.offsetWidth + pad * 2, H = px.offsetHeight + pad * 2;
    /* linha de base do texto, para o canvas casar com o texto real */
    const probe = document.createElement('span');
    probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
    px.append(probe); const base = probe.offsetTop + pad; probe.remove();
    const cv = document.createElement('canvas'); cv.setAttribute('aria-hidden', 'true');
    cv.style.left = cv.style.top = -pad + 'px'; px.append(cv);
    const ctx = cv.getContext('2d');
    const fit = g => { cv.width = g.cols; cv.height = g.rows; cv.style.width = g.cols * g.B + 'px'; cv.style.height = g.rows * g.B + 'px'; };
    /* mapa de blocos acesos para um tamanho de bloco B */
    const grid = B => {
      const g = { B, cols: Math.ceil(W / B), rows: Math.ceil(H / B) }; fit(g);
      ctx.setTransform(1 / B, 0, 0, 1 / B, 0, 0);
      ctx.font = `${cs.fontWeight} ${fs}px ${cs.fontFamily}`;
      if ('letterSpacing' in ctx) ctx.letterSpacing = cs.letterSpacing;
      ctx.fillText(px.textContent, pad, base);
      const a = ctx.getImageData(0, 0, g.cols, g.rows).data; g.on = [];
      for (let i = 0; i < g.cols * g.rows; i++) if (a[i * 4 + 3] > 100) g.on.push(i);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      return g;
    };
    const LIME = [212, 255, 58], SHADE = [186, 232, 34], GLOW = [234, 250, 150], FLASH = [243, 238, 228];
    let cur = null;
    const paint = (g, colorOf) => {
      if (cur !== g) { fit(g); cur = g; }
      const img = ctx.createImageData(g.cols, g.rows);
      g.on.forEach(i => { const c = colorOf(i, i % g.cols, (i / g.cols) | 0); if (!c) return; img.data.set(c, i * 4); img.data[i * 4 + 3] = 255; });
      ctx.putImageData(img, 0, 0);
    };
    const B0 = Math.max(4, Math.round(fs / 8));
    /* blocos finos (≈ fs/22) deixam a palavra legível; o "engasgo" usa um meio-termo */
    const coarse = grid(B0), mid = grid(Math.max(4, Math.round(fs / 12))), fine = grid(Math.max(3, Math.round(fs / 22)));
    /* entrada: cada bloco ganha um instante (onda da esquerda p/ direita + ruído) */
    const at = new Map(coarse.on.map(i => [i, ((i % coarse.cols) / coarse.cols) * 380 + Math.random() * 180]));
    const SWEEP = intro ? 620 : 0, TICK = 1000 / 15, SHINE = 2600, GLITCH = 6000, GLITCH_LEN = 120;
    let t0 = null, lastTick = -1, raf = 0;
    const run = now => {
      t0 ??= now; const t = now - t0, tick = Math.floor(t / TICK);
      if (tick !== lastTick) {
        lastTick = tick;
        if (t < SWEEP) {
          paint(coarse, i => { const d = t - at.get(i); return d < 0 ? null : d < 70 ? FLASH : LIME; });
        } else {
          const lt = t - SWEEP;
          if (lt % GLITCH < GLITCH_LEN && lt > GLITCH_LEN) {
            /* engasgo: volta à resolução grossa, com um piscar */
            paint(mid, () => Math.random() < .12 ? FLASH : LIME);
          } else {
            /* brilho diagonal: faixa clara que atravessa a palavra */
            const s = (lt % SHINE) / SHINE * (fine.cols + fine.rows + 16) - 8;
            paint(fine, (i, x, y) => {
              const d = Math.abs(x + y * .6 - s);
              if (d < 1.5) return FLASH;
              if (d < 3.5) return GLOW;
              if (Math.random() < .006) return FLASH;          /* cintilar, discreto */
              return y % 4 === 3 ? SHADE : LIME;               /* linha de varredura leve, a cada 4 */
            });
          }
        }
      }
      raf = requestAnimationFrame(run);
    };
    const start = () => { if (!raf) raf = requestAnimationFrame(run); };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };
    start();
    return { cv, start, stop };
  };
  if (px) {
    let live = null, seen = false, visible = false;
    const boot = intro => { live?.stop(); live?.cv.remove(); live = pixelate(intro); if (live && !visible) live.stop(); };
    const pio = new IntersectionObserver(es => {
      visible = es[0].isIntersecting;
      if (visible && !seen && es[0].intersectionRatio >= .6) {
        seen = true;
        /* espera as palavras do título subirem e a fonte estar pronta */
        /* (com teto de 1,2 s: rede lenta não pode deixar "Vida" invisível) */
        Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1200))])
          .then(() => setTimeout(() => boot(true), reduce ? 0 : 380));
      } else if (live) visible ? live.start() : live.stop();   /* fora da tela, dorme */
    }, { threshold: [0, .6] });
    pio.observe(px);
    /* o tamanho da fonte muda com a tela: refaz a grade (sem repetir a entrada) */
    let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => live && boot(false), 200); });
  }

  /* ---------- 4c. MINI-GAME ----------
     A animação é toda em CSS; aqui só ligamos/desligamos (.on) conforme
     a cena aparece, para não gastar GPU com ela fora da tela. */
  const game = $('#game');
  if (game) new IntersectionObserver(es => game.classList.toggle('on', es[0].isIntersecting)).observe(game);

  /* ---------- 5. CONTADORES ----------
     data-count = valor final · data-from = valor inicial (opcional) */
  const cio = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return; cio.unobserve(e.target);
    const el = e.target, to = +el.dataset.count, from = +(el.dataset.from || 0);
    if (reduce) { el.textContent = to; return; }
    const t0 = performance.now(), dur = 1400;
    (function tick(n) {
      const t = clamp((n - t0) / dur);
      el.textContent = Math.round(lerp(from, to, eOut(t)));
      if (t < 1) requestAnimationFrame(tick);
    })(t0);
  }), { threshold: .6 });
  $$('[data-count]').forEach(el => { if (!reduce) el.textContent = el.dataset.from || 0; cio.observe(el); });

  /* ---------- 6. MARQUEE ---------- */
  const words = ['Joga', 'Lembra', 'Compartilha', 'Volta', 'Compra', 'Ganha'];
  const marq = $('#marq');
  marq.innerHTML = [...words, ...words, ...words].map(w => `${w} <em>✺</em>`).join(' ');

  /* ---------- 7. LOOP DE SCROLL ---------- */
  const hero = $('#topo'), giant = $('#giant'), heroCta = $('#heroCta'), sticker = $('#sticker'), heroP = $('#heroP');
  const match = $('#partida'), matchPin = $('#matchPin'), hand = $('#hand'), clock = $('#clock'), ph = $('#ph');
  const caps = $$('.gc'), stages = $$('.sg'), lives = $$('#lives i'), score = $('#score'), tLeft = $('#tLeft'), stage = $('#stage');
  const tl = $('#tl'), tlLine = $('#tlLine');
  const b1 = $('#b1'), b2 = $('#b2'), cta = $('#contato');

  /* altura do palco do celular → usada na queda dos itens (CSS --stage-h) */
  const setStageH = () => stage.style.setProperty('--stage-h', stage.clientHeight + 'px');
  setStageH(); addEventListener('resize', setStageH);

  /* cores de fundo da partida: pêssego → lima → rosa → lilás → cobalto → tinta */
  const sky = [[0,[255,217,168]],[.2,[212,255,58]],[.4,[255,183,213]],[.6,[169,180,255]],[.8,[42,60,255]],[1,[18,18,18]]];
  const mix = (a, b, t) => a.map((v, i) => Math.round(lerp(v, b[i], t)));
  const skyAt = p => {
    for (let i = 0; i < sky.length - 1; i++) if (p <= sky[i + 1][0]) return mix(sky[i][1], sky[i + 1][1], (p - sky[i][0]) / (sky[i + 1][0] - sky[i][0]));
    return sky[sky.length - 1][1];
  };
  /* vidas acesas por etapa (a etapa 3 é "jogou": gasta vidas) */
  const livesAt = [1, 1, 1, 4, 2, 2, 0];

  const cur = { hero: 0, match: 0 };
  let lastStep = -1, last = performance.now(), running = false;

  function frame(now) {
    const dt = Math.min((now - last) / 1000, .1); last = now;
    const k = reduce ? 1 : 1 - Math.exp(-dt * 9);   /* suavização independente de FPS */
    const t = { hero: prog(hero), match: prog(match) };
    let moving = false;
    for (const key in cur) {
      cur[key] += (t[key] - cur[key]) * k;
      if (Math.abs(t[key] - cur[key]) > .0004) moving = true; else cur[key] = t[key];
    }

    /* hero: título gigante desliza, CTA e lead somem */
    const h = cur.hero;
    if (!reduce) {
      giant.style.transform = `translate3d(${-h * 22}vw,${-h * 6}vh,0) scale(${1 + h * .1})`;
      sticker.style.transform = `translate3d(0,${h * -240}px,0) rotate(${h * 180}deg) scale(${1 + h * .4})`;
      marq.style.transform = `translate3d(${-(scrollY * .5 % (marq.scrollWidth / 3))}px,0,0)`;
    }
    const fade = 1 - eOut(range(h, 0, .5));
    heroCta.style.opacity = fade;
    heroCta.style.transform = reduce ? '' : `translateY(${(1 - fade) * -40}px)`;
    heroCta.style.visibility = fade < .02 ? 'hidden' : '';   /* tira os botões invisíveis do foco/toque */
    heroP.style.opacity = 1 - eOut(range(h, .15, .65));
    sticker.style.opacity = 1 - range(h, .55, .95);

    /* partida de 60 s */
    const p = range(cur.match, .02, .98);
    const c = skyAt(p), lum = c[0] * .299 + c[1] * .587 + c[2] * .114;
    matchPin.style.backgroundColor = `rgb(${c})`;
    matchPin.style.color = lum < 120 ? '#f3eee4' : '#121212';
    const secs = Math.round(p * 60);
    clock.innerHTML = `${String(secs).padStart(2, '0')}<small>s</small>`;
    tLeft.textContent = `${60 - secs} s`;
    const step = clamp(Math.floor(p * caps.length), 0, caps.length - 1);
    if (step !== lastStep) {
      lastStep = step;
      caps.forEach((e, i) => e.classList.toggle('on', i === step));
      stages.forEach((e, i) => e.classList.toggle('on', i === step));
      lives.forEach((e, i) => e.classList.toggle('on', i < livesAt[step]));
    }
    score.textContent = Math.round(eOut(range(p, 3 / 7, 5 / 7)) * 2480).toLocaleString('pt-BR');
    /* ponteiro: uma volta completa = 60 s */
    hand.style.transform = `rotate(${p * 360}deg)`;
    if (!reduce) {
      ph.style.transform = `translateY(${lerp(20, -10, Math.sin(p * Math.PI))}px) rotate(${lerp(-2, 2, p)}deg)`;
    }

    /* linha do tempo: a linha laranja cresce com o scroll */
    const tr = tl.getBoundingClientRect();
    tlLine.style.transform = `scaleY(${clamp((innerHeight * .7 - tr.top) / tr.height)})`;

    /* CTA: bolhas em parallax */
    if (!reduce) {
      const cr = cta.getBoundingClientRect(), cp = clamp(1 - cr.top / innerHeight);
      b1.style.transform = `translate3d(0,${cp * -80}px,0) scale(${.8 + cp * .3})`;
      b2.style.transform = `translate3d(${cp * -60}px,${cp * 60}px,0)`;
    }

    if (moving) requestAnimationFrame(frame); else running = false;
  }

  const kick = () => { if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); } };
  addEventListener('scroll', kick, { passive: true });
  addEventListener('resize', kick);
  kick();

  /* ---------- CARROSSEL "Experimente nossos jogos" (infinito) ----------
     Rolagem nativa com snap (arrastar no celular funciona sozinho).
     A lista é clonada antes e depois: o usuário rola sempre no bloco do meio e,
     quando a rolagem para num bloco clonado, a posição pula para o card igual
     do bloco do meio, sem animação (é a mesma imagem, então o salto não aparece). */
  const pcTrack = document.getElementById('pcTrack');
  if (pcTrack) {
    const pc = pcTrack.parentElement;
    const orig = [...pcTrack.children], n = orig.length;
    const clone = li => {
      const c = li.cloneNode(true);
      c.setAttribute('aria-hidden', 'true'); c.dataset.clone = '';
      c.querySelectorAll('a').forEach(a => a.tabIndex = -1);
      return c;
    };
    orig.forEach(li => pcTrack.appendChild(clone(li)));
    orig.slice().reverse().forEach(li => pcTrack.prepend(clone(li)));

    const items = pcTrack.children;
    const setW = () => items[n].offsetLeft - items[0].offsetLeft;           // largura de um bloco
    const step = () => items[1].offsetLeft - items[0].offsetLeft;           // um card + gap
    const jump = x => {                                                     // reposiciona sem animação
      pcTrack.style.scrollBehavior = 'auto'; pcTrack.style.scrollSnapType = 'none';
      pcTrack.scrollLeft = x;
      pcTrack.offsetLeft;                                                   // força o layout antes de religar
      pcTrack.style.scrollBehavior = ''; pcTrack.style.scrollSnapType = '';
    };
    let cur = 0;                                                            // card do começo da vista (0 a n-1)
    const normalize = () => {
      const w = setW(), x = pcTrack.scrollLeft;
      if (x < w - step() / 2) jump(x + w);
      else if (x >= w * 2 - step() / 2) jump(x - w);
      cur = ((Math.round(pcTrack.scrollLeft / step()) % n) + n) % n;
    };
    jump(setW());

    let t;
    const settle = () => { clearTimeout(t); t = setTimeout(normalize, 140); };
    if ('onscrollend' in window) pcTrack.addEventListener('scrollend', normalize);
    else pcTrack.addEventListener('scroll', settle, { passive: true });
    addEventListener('resize', () => jump(setW() + cur * step()));

    const go = dir => {
      normalize();
      pcTrack.scrollBy({ left: dir * step(), behavior: reduce ? 'auto' : 'smooth' });
    };
    pc.querySelector('.pc-arrow.prev').addEventListener('click', () => go(-1));
    pc.querySelector('.pc-arrow.next').addEventListener('click', () => go(1));
    pc.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); go(e.key === 'ArrowRight' ? 1 : -1); }
    });
  }

  /* ---------- POP-UP DO JOGO ----------
     Clicar num card do carrossel abre um <dialog> com a capa, o QR code (abre o jogo no celular)
     e "Jogar agora". Ctrl/Cmd/Shift/botão do meio continuam abrindo o jogo direto em outra aba.
     O <dialog> nativo já fecha no Esc, prende o foco e devolve o foco ao card. */
  const qm = document.getElementById('qm');
  if (qm && pcTrack && qm.showModal) {
    const QR_V = 1;                                   // troque ao regerar os QR codes (cache do CDN)
    let from = null;
    const close = () => {
      if (!qm.open || qm.classList.contains('closing')) return;
      if (reduce) { qm.close(); return; }
      qm.classList.add('closing');
      setTimeout(() => qm.close(), 150);
    };
    pcTrack.addEventListener('click', e => {
      const a = e.target.closest('a.pg[data-game]');
      if (!a || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      const id = a.dataset.game, img = a.querySelector('.pg-shot img');
      from = a;
      document.getElementById('qmTitle').textContent = a.querySelector('.pg-body b').textContent;
      document.getElementById('qmGenre').textContent = a.querySelector('.pg-body .mono').textContent;
      const cov = document.getElementById('qmCover'); cov.src = img.currentSrc || img.src; cov.alt = img.alt;
      const qr = document.getElementById('qmQr'); qr.src = `assets/qr/${id}.svg?v=${QR_V}`; qr.alt = `QR code que abre ${a.querySelector('.pg-body b').textContent} no celular`;
      document.getElementById('qmNote').hidden = id !== 'drink-as-cegas';
      document.getElementById('qmGo').href = a.href;
      qm.classList.remove('closing');
      document.documentElement.classList.add('qm-lock');
      qm.showModal();
      document.getElementById('qmGo').focus();
    });
    qm.addEventListener('close', () => {
      qm.classList.remove('closing');
      document.documentElement.classList.remove('qm-lock');
      if (from && from.isConnected) from.focus({ preventScroll: true });
    });
    document.getElementById('qmX').addEventListener('click', close);
    qm.addEventListener('click', e => { if (e.target === qm) close(); });   // clique fora do cartão
    document.getElementById('qmGo').addEventListener('click', () => setTimeout(close, 0));
  }
})();
