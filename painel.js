/*
 * Painel da Casa — conversa com o Google (ou com o modo demonstração).
 * Os links trazem o código no fim: ...tv.html#k=<código>. O endereço do script vem do config.js
 * (ou do próprio link, em ...#api=<url>&k=<código>).
 * Sem isso a página roda em modo demonstração, com dados de exemplo guardados no próprio navegador.
 * ES5 de propósito (TV LG antiga).
 */
var Painel = (function () {
  var CHAVE_CONEXAO = 'painel_conexao', CHAVE_CACHE = 'painel_estado', CHAVE_DEMO = 'painel_demo3',
    CHAVE_DEMO_VERSAO = 'painel_demo_versao';

  function ler(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function gravar(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sem espaço ou bloqueado */ } }

  function lerHash() {
    var p = {}, partes = location.hash.replace(/^#/, '').split('&');
    for (var i = 0; i < partes.length; i++) {
      var kv = partes[i].split('=');
      if (kv[0]) p[kv[0]] = decodeURIComponent(kv.slice(1).join('='));
    }
    return p;
  }

  function conectar() {
    var h = lerHash(), antes = ler(CHAVE_CONEXAO);
    h.api = h.api || (typeof PAINEL_API !== 'undefined' && PAINEL_API) || '';
    if (!h.api || !h.k) return false;
    if (!antes || antes.api !== h.api || antes.k !== h.k) {
      gravar(CHAVE_CONEXAO, { api: h.api, k: h.k });
      try { localStorage.removeItem(CHAVE_CACHE); } catch (e) { }
    }
    return true;
  }
  var p = lerHash();
  if (p.demo === '1') { try { localStorage.removeItem(CHAVE_CONEXAO); } catch (e) { } }
  else conectar();
  var conexao = ler(CHAVE_CONEXAO);
  var demo = !conexao;

  /* ---------- rede ---------- */

  function pedir(metodo, url, corpo) {
    return new Promise(function (resolve, rejeita) {
      var r = new XMLHttpRequest();
      r.open(metodo, url, true);
      r.timeout = 25000;
      // text/plain evita a checagem extra de CORS que o Apps Script não responde
      if (corpo) r.setRequestHeader('Content-Type', 'text/plain;charset=utf-8');
      r.onload = function () {
        if (r.status < 200 || r.status >= 300) return rejeita(new Error('Erro ' + r.status + ' no servidor'));
        var j;
        try { j = JSON.parse(r.responseText); } catch (e) { return rejeita(new Error('Resposta estranha do Google. O script está publicado para "Qualquer pessoa"?')); }
        if (j.ok === false) return rejeita(new Error(j.erro || 'Erro no servidor'));
        resolve(j);
      };
      r.onerror = r.ontimeout = function () { rejeita(new Error('Sem conexão')); };
      r.send(corpo || null);
    });
  }

  function urlGet(a) { return conexao.api + '?a=' + a + '&k=' + encodeURIComponent(conexao.k) + '&t=' + Date.now(); }

  /* ---------- modo demonstração ---------- */

  function idDemo() { return Math.random().toString(36).slice(2, 10); }
  function agoraTexto() {
    var d = new Date();
    return Nucleo.paraTexto(d) + ' ' + Nucleo.pad(d.getHours()) + ':' + Nucleo.pad(d.getMinutes());
  }

  function sementeDemo() {
    var hoje = Nucleo.paraTexto(new Date());
    return {
      config: { nome_1: 'Julia', nome_2: 'Pedro', cidade: 'Guará, Distrito Federal', modo_noite: '23:00-05:30',
        recado: 'Bom dia! Hoje à noite tem jantar com a turma, não marcar nada depois das 19h.',
        recado_autor: 'Julia', recado_quando: hoje + ' 07:10' },
      rotina: [
        { id: 'r1', tarefa: 'Tirar o lixo', quem: 'p2', dias: 'seg, qua, sex', ativa: true },
        { id: 'r2', tarefa: 'Regar as plantas', quem: 'p1', dias: 'seg, qui', ativa: true },
        { id: 'r3', tarefa: 'Lavar a louça do jantar', quem: 'casal', dias: 'todo dia', ativa: true },
        { id: 'r4', tarefa: 'Tomar o remédio', quem: 'p1', dias: 'todo dia', ativa: true, manha: true },
        { id: 'r5', tarefa: 'Academia', quem: 'p2', dias: 'seg a sex', ativa: true, manha: true },
        { id: 'r6', tarefa: 'Arrumar a cama', quem: 'casal', dias: 'todo dia', ativa: true, manha: true },
        { id: 'r7', tarefa: 'Dar comida ao gato', quem: 'p2', dias: 'todo dia', ativa: true, manha: true },
        { id: 'r9', tarefa: 'Beber um copo de água', quem: 'p1', dias: 'todo dia', ativa: true, manha: true },
        { id: 'r8', tarefa: 'Faxina geral', quem: 'casal', dias: 'sáb', ativa: true }
      ],
      tarefas: [
        { id: 't1', data: Nucleo.somarDias(hoje, -1), tarefa: 'Pagar a conta de luz', quem: 'p1', tipo: 'pontual',
          rotina_id: '', feita: false, feita_em: '', criada_em: '' },
        { id: 't2', data: hoje, tarefa: 'Buscar encomenda na portaria', quem: 'p2', tipo: 'pontual',
          rotina_id: '', feita: false, feita_em: '', criada_em: '' },
        { id: 't3', data: hoje, tarefa: 'Mandar as medidas da cozinha', quem: 'p1', tipo: 'pontual',
          rotina_id: '', feita: false, feita_em: '', criada_em: '' },
        { id: 't4', data: Nucleo.somarDias(hoje, 1), tarefa: 'Mercado da semana', quem: 'casal', tipo: 'pontual',
          rotina_id: '', feita: false, feita_em: '', criada_em: '' }
      ],
      listas: itensDemo(hoje, 'Compras', ['Peito de frango', 'Ovos', 'Arroz', 'Feijão', 'Iogurte natural', 'Banana', 'Brócolis', 'Pão integral'])
        .concat(itensDemo(hoje, 'Casa', ['Trocar a lâmpada da varanda', 'Ligar para o técnico da geladeira', 'Organizar o armário']))
        .concat(itensDemo(hoje, 'Ideias', ['Filme: Duna 3', 'Restaurante novo no Sudoeste', 'Presente de aniversário da Ana'])),
      recompensas: [
        { id: 'k1', nome: 'Escolher o filme da noite', quem: 'p1', custo: 10 },
        { id: 'k2', nome: 'Escolher o restaurante do fim de semana', quem: 'p2', custo: 15 },
        { id: 'k3', nome: 'Massagem de 15 minutos', quem: 'p1', custo: 20 },
        { id: 'k4', nome: 'Massagem de 15 minutos', quem: 'p2', custo: 20 },
        { id: 'k5', nome: 'Passeio de domingo', quem: 'casal', custo: 40 },
        { id: 'k6', nome: 'Jantar fora especial', quem: 'casal', custo: 80 }
      ],
      estrelas: [
        { id: 's1', data: Nucleo.somarDias(hoje, -2), quem: 'p1', qtd: 8, motivo: 'tarefa', ref: 'x1', nome: 'Semana passada', quando: Nucleo.somarDias(hoje, -2) + ' 20:00' },
        { id: 's2', data: Nucleo.somarDias(hoje, -2), quem: 'p2', qtd: 11, motivo: 'tarefa', ref: 'x2', nome: 'Semana passada', quando: Nucleo.somarDias(hoje, -2) + ' 20:00' },
        { id: 's3', data: Nucleo.somarDias(hoje, -1), quem: 'casal', qtd: 23, motivo: 'tarefa', ref: 'x3', nome: 'Semana passada', quando: Nucleo.somarDias(hoje, -1) + ' 20:00' }
      ]
    };
  }

  function itensDemo(hoje, lista, nomes) {
    var l = [];
    for (var i = 0; i < nomes.length; i++) {
      l.push({ id: lista.toLowerCase() + '-' + i, lista: lista, item: nomes[i], feito: false, criado_em: hoje + ' 08:00', feito_em: '' });
    }
    return l;
  }

  /* Plano de exemplo, genérico: o plano de verdade fica só no Google. */
  function planoDemo() {
    var dias = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];
    var cafes = ['Crepioca de queijo', 'Ovos mexidos com pão', 'Overnight oats', 'Tapioca de frango', 'Panqueca de banana', 'Café reforçado', 'Crepioca doce'];
    var almocos = ['Frango com legumes assados', 'Patinho com batata-doce', 'Peixe com lentilha', 'Strogonoff leve', 'Carne com abobrinha', 'Prato livre com regra', 'Almoço de domingo'];
    var lanches = ['Iogurte com morango', 'Shake de banana', 'Sanduíche de atum', 'Bowl de iogurte', 'Torradas com cottage'];
    var jantares = ['Wrap de frango', 'Hambúrguer caseiro', 'Omelete recheada', 'Pizza de rap10', 'Bowl mexicano', 'Noite do hambúrguer', 'Noite da pipoca'];
    var treinos = [
      { title: 'Inferiores A', meta: 'Cerca de 60 minutos', blocks: [['Aquecimento', [['Bike leve', '5 min']]], ['Musculação', [['Elevação pélvica', '3 × 12'], ['Stiff com halteres', '3 × 10'], ['Mesa flexora', '3 × 12'], ['Abdutora', '3 × 15']]], ['Cardio', [['Esteira inclinada', '12 min']]]] },
      { title: 'Superiores A', meta: 'Cerca de 60 minutos', blocks: [['Aquecimento', [['Bike leve', '5 min']]], ['Musculação', [['Puxada na polia', '3 × 12'], ['Remada baixa', '3 × 12'], ['Rosca direta', '3 × 10']]], ['Core', [['Prancha', '3 × 40 s']]]] },
      { title: 'Recuperação ativa', meta: '40 minutos, bem leve', blocks: [['Cardio leve', [['Caminhada', '30 min']]], ['Mobilidade', [['Alongamento geral', '10 min']]]] }
    ];
    var P = { titulo: 'Exemplo', inicio: Nucleo.somarDias(Nucleo.paraTexto(new Date()), -20), fim: Nucleo.somarDias(Nucleo.paraTexto(new Date()), 63),
      semanas: 12, pessoas: { p1: 'a', p2: 'b' }, menu: { a: {}, b: {} }, treino: { a: {}, b: {} },
      fases: { a: [{ w: [1, 12], t: 'Progressão' }], b: [{ w: [1, 12], t: 'Progressão' }] },
      corrida: { b: { dias: ['seg', 'qua', 'sex'], semanas: { 3: '5 × (3 min trotando + 1 min 30 s caminhando)', 4: '4 × (4 min trotando + 1 min 30 s caminhando)' } } },
      compras: ['Peito de frango: 2 kg', 'Ovos: 3 dúzias', 'Arroz', 'Feijão', 'Batata-doce', 'Iogurte natural', 'Frutas da semana'] };
    for (var i = 0; i < dias.length; i++) {
      var fds = i >= 5;
      var base = [
        { t: 'Café', h: fds ? '8h30' : '7h', k: 330, n: cafes[i], i: ['Porção do plano'] },
        { t: 'Almoço', h: fds ? '13h' : '12h30', k: 480, n: almocos[i], i: ['Proteína, arroz e feijão', 'Legumes à vontade', 'Doce do dia'] }
      ];
      if (!fds) base.push({ t: 'Lanche', h: '16h', k: 250, n: lanches[i % lanches.length], i: ['Porção do plano'] });
      base.push({ t: fds ? 'Lanche da noite' : 'Jantar', h: '19h30', k: 380, n: jantares[i], i: ['Porção do plano'] });
      P.menu.a[dias[i]] = { ctx: 'Exemplo de dia do plano.', total: '≈ 1.450 kcal', meals: base };
      P.menu.b[dias[i]] = { ctx: 'Exemplo de dia do plano.', total: '≈ 2.500 kcal', meals: base };
      P.treino.a[dias[i]] = treinos[i === 6 ? 2 : i % 2];
      P.treino.b[dias[i]] = treinos[i === 6 ? 2 : (i + 1) % 2];
    }
    return P;
  }

  function agendaDemo(hoje) {
    var a = {}, d1 = Nucleo.somarDias(hoje, 1), d2 = Nucleo.somarDias(hoje, 2);
    a[hoje] = [
      { titulo: 'Aniversário da Ana', local: '', dia_inteiro: true, inicio: '', fim: '', quem: 'casal' },
      { titulo: 'Visita técnica na obra', local: 'Rua das Palmeiras, 120', dia_inteiro: false, inicio: '08:30', fim: '10:00', quem: 'p1' },
      { titulo: 'Dentista', local: 'Clínica Sorriso', dia_inteiro: false, inicio: '11:00', fim: '12:00', quem: 'p2' },
      { titulo: 'Reunião de projeto', local: 'Online', dia_inteiro: false, inicio: '14:00', fim: '15:30', quem: 'p1' },
      { titulo: 'Jantar com a turma', local: 'Casa do Pedro', dia_inteiro: false, inicio: '20:00', fim: '23:00', quem: 'casal' }
    ];
    a[d1] = [
      { titulo: 'Feira', local: '', dia_inteiro: false, inicio: '09:00', fim: '10:00', quem: 'casal' },
      { titulo: 'Futebol', local: '', dia_inteiro: false, inicio: '16:00', fim: '18:00', quem: 'p2' }
    ];
    a[d2] = [
      { titulo: 'Almoço na casa da família', local: '', dia_inteiro: false, inicio: '12:30', fim: '16:00', quem: 'casal' }
    ];
    return a;
  }

  function dadosDemo() {
    var d = ler(CHAVE_DEMO);
    if (!d) { d = sementeDemo(); gravar(CHAVE_DEMO, d); }
    return d;
  }
  function versaoDemo() { return String(ler(CHAVE_DEMO_VERSAO) || 1); }

  function estadoDemo() {
    var dados = dadosDemo(), hoje = Nucleo.paraTexto(new Date());
    if (Nucleo.garantirRotina(dados, hoje, idDemo)) gravar(CHAVE_DEMO, dados);
    var e = Nucleo.montarEstado(dados, hoje, agendaDemo(hoje), Nucleo.montarPlano(planoDemo(), hoje));
    e.versao = versaoDemo();
    e.demo = true;
    return e;
  }

  /* ---------- API usada pelas páginas ---------- */

  function estado() {
    if (demo) return Promise.resolve(estadoDemo());
    return pedir('GET', urlGet('estado'));
  }

  function versao() {
    if (demo) return Promise.resolve({ ok: true, versao: versaoDemo() });
    return pedir('GET', urlGet('versao'));
  }

  function enviar(acao, dados) {
    var pedido = {};
    for (var k in dados) if (dados.hasOwnProperty(k)) pedido[k] = dados[k];
    pedido.a = acao;
    if (demo) {
      return new Promise(function (resolve, rejeita) {
        setTimeout(function () {  // simula a demora do Google
          try {
            var d = dadosDemo();
            Nucleo.aplicar(d, pedido, agoraTexto(), idDemo);
            gravar(CHAVE_DEMO, d);
            gravar(CHAVE_DEMO_VERSAO, Date.now());
            resolve(estadoDemo());
          } catch (e) { rejeita(e); }
        }, 350);
      });
    }
    pedido.k = conexao.k;
    return pedir('POST', conexao.api, JSON.stringify(pedido));
  }

  /* No modo demonstração, outra aba (TV) avisa na hora; no Google a TV confere a cada 10 s. */
  function aoMudarEmOutraAba(fn) {
    window.addEventListener('storage', function (ev) { if (ev.key === CHAVE_DEMO_VERSAO) fn(); });
  }

  function reiniciarDemo() {
    try { localStorage.removeItem(CHAVE_DEMO); localStorage.removeItem(CHAVE_DEMO_VERSAO); } catch (e) { }
  }

  /* ---------- ajudantes de tela ---------- */

  function esc(t) {
    return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function horaAgora() { var d = new Date(); return Nucleo.pad(d.getHours()) + ':' + Nucleo.pad(d.getMinutes()); }

  return {
    demo: demo,
    estado: estado, versao: versao, enviar: enviar,
    aoMudarEmOutraAba: aoMudarEmOutraAba, reiniciarDemo: reiniciarDemo,
    guardarCache: function (e) { gravar(CHAVE_CACHE, e); },
    lerCache: function () { return ler(CHAVE_CACHE); },
    conectarComLink: function (link) {
      var i = link.indexOf('#');
      if (i < 0) return false;
      location.hash = link.slice(i);
      if (!conectar()) return false;
      location.reload();
      return true;
    },
    esc: esc, horaAgora: horaAgora, agoraTexto: agoraTexto
  };
})();
