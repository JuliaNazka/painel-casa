/*
 * Painel da Casa — conversa com o Google (ou com o modo demonstração).
 * Os links trazem o código no fim: ...tv.html#k=<código>. O endereço do script vem do config.js
 * (ou do próprio link, em ...#api=<url>&k=<código>).
 * Sem isso a página roda em modo demonstração, com dados de exemplo guardados no próprio navegador.
 * ES5 de propósito (TV LG antiga).
 */
var Painel = (function () {
  var CHAVE_CONEXAO = 'painel_conexao', CHAVE_CACHE = 'painel_estado', CHAVE_DEMO = 'painel_demo',
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
      ]
    };
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
    var e = Nucleo.montarEstado(dados, hoje, agendaDemo(hoje));
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
