/*
 * Painel da Casa — regras compartilhadas.
 * O mesmo arquivo roda no navegador (TV e celular) e no Google Apps Script (copiado como Nucleo.gs).
 * Escrito em JavaScript antigo (ES5) de propósito: o navegador de TVs LG mais velhas não entende o moderno.
 *
 * Datas sempre como texto "aaaa-mm-dd". Pessoas: "p1", "p2" e "casal".
 */
var Nucleo = (function () {
  var SIGLAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
  var SIGLAS_BONITAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  var DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto',
    'setembro', 'outubro', 'novembro', 'dezembro'];
  var QUEM = ['p1', 'p2', 'casal'];

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function paraData(s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function paraTexto(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function somarDias(s, n) { var d = paraData(s); d.setDate(d.getDate() + n); return paraTexto(d); }
  function diaDaSemana(s) { return paraData(s).getDay(); }

  function semAcento(t) {
    return String(t || '').toLowerCase()
      .replace(/[áàâã]/g, 'a').replace(/[éèê]/g, 'e').replace(/[íì]/g, 'i')
      .replace(/[óòôõ]/g, 'o').replace(/[úù]/g, 'u').replace(/ç/g, 'c');
  }

  /* "seg, qua, sex" · "seg a sex" · "todo dia" · "dias úteis" · "fim de semana" → [1,3,5] */
  function lerDias(texto) {
    var t = semAcento(texto).trim();
    if (!t) return [];
    if (/todo|diari/.test(t)) return [0, 1, 2, 3, 4, 5, 6];
    var dias = {};
    if (/uteis/.test(t)) { dias[1] = dias[2] = dias[3] = dias[4] = dias[5] = true; t = t.replace(/(dias\s+)?uteis/, ''); }
    if (/fds|fim de semana/.test(t)) { dias[0] = dias[6] = true; t = t.replace(/fds|fim de semana/, ''); }
    t = t.replace(/\s+a\s+/g, '-').replace(/\s*-\s*/g, '-');
    var partes = t.split(/[,;\/\s]+|\se\s/);
    for (var i = 0; i < partes.length; i++) {
      var p = partes[i].replace(/[^a-z\-]/g, '');
      if (!p || p === 'e') continue;
      if (p.indexOf('-') > 0) {
        var ab = p.split('-'), a = SIGLAS.indexOf(ab[0].slice(0, 3)), b = SIGLAS.indexOf(ab[1].slice(0, 3));
        if (a < 0 || b < 0) continue;
        for (var d = a, guarda = 0; guarda < 7; d = (d + 1) % 7, guarda++) { dias[d] = true; if (d === b) break; }
      } else {
        var k = SIGLAS.indexOf(p.slice(0, 3));
        if (k >= 0) dias[k] = true;
      }
    }
    var lista = [];
    for (var n = 0; n < 7; n++) if (dias[n]) lista.push(n);
    return lista;
  }

  function textoDias(texto) {
    var l = lerDias(texto), s = l.join(',');
    if (l.length === 7) return 'todo dia';
    if (s === '1,2,3,4,5') return 'seg a sex';
    if (s === '0,6') return 'sáb e dom';
    if (!l.length) return 'nenhum dia';
    var nomes = [];
    for (var i = 0; i < l.length; i++) nomes.push(SIGLAS_BONITAS[l[i]]);
    return nomes.join(', ');
  }

  function dataPorExtenso(s) {
    var d = paraData(s);
    return DIAS[d.getDay()] + ', ' + d.getDate() + ' de ' + MESES[d.getMonth()];
  }

  function copiar(o) { var c = {}; for (var k in o) if (o.hasOwnProperty(k)) c[k] = o[k]; return c; }
  function vale(r, dia) { return r.ativa !== false && lerDias(r.dias).indexOf(diaDaSemana(dia)) >= 0; }

  /* Cria as tarefas de rotina do dia que ainda não existem. Devolve quantas criou. */
  function garantirRotina(dados, hoje, novoId) {
    var criadas = 0;
    for (var i = 0; i < dados.rotina.length; i++) {
      var r = dados.rotina[i];
      if (!vale(r, hoje)) continue;
      var existe = false;
      for (var j = 0; j < dados.tarefas.length; j++) {
        var t = dados.tarefas[j];
        if (t.rotina_id === r.id && t.data === hoje) { existe = true; break; }
      }
      if (existe) continue;
      dados.tarefas.push({ id: novoId(), data: hoje, tarefa: r.tarefa, quem: r.quem, tipo: 'rotina',
        rotina_id: r.id, feita: false, feita_em: '', criada_em: hoje });
      criadas++;
    }
    return criadas;
  }

  /* O que a TV e o celular mostram. agendaPorDia = { "aaaa-mm-dd": [eventos] } */
  function montarEstado(dados, hoje, agendaPorDia) {
    agendaPorDia = agendaPorDia || {};
    var lista = [], i, t, manha = {};
    for (i = 0; i < dados.rotina.length; i++) if (dados.rotina[i].manha) manha[dados.rotina[i].id] = true;
    for (i = 0; i < dados.tarefas.length; i++) {
      t = dados.tarefas[i];
      // pontual não feita de dia anterior passa para hoje como atrasada; se foi feita hoje, continua na lista
      var atrasada = t.tipo === 'pontual' && t.data < hoje;
      var entra = t.data === hoje || (atrasada && (!t.feita || String(t.feita_em).slice(0, 10) === hoje));
      if (!entra) continue;
      var c = copiar(t); c.atrasada = atrasada; c.manha = !!manha[t.rotina_id]; c._ordem = i;
      lista.push(c);
    }
    lista.sort(function (a, b) {
      return (a.feita - b.feita) || (b.atrasada - a.atrasada) || (b.manha - a.manha) ||
        (a.data < b.data ? -1 : a.data > b.data ? 1 : 0) ||
        (a._ordem - b._ordem);
    });
    var progresso = {};
    for (i = 0; i < QUEM.length; i++) progresso[QUEM[i]] = { feitas: 0, total: 0 };
    for (i = 0; i < lista.length; i++) {
      delete lista[i]._ordem;
      var p = progresso[lista[i].quem] || progresso.casal;
      p.total++; if (lista[i].feita) p.feitas++;
    }

    var proximos = [];
    for (var n = 1; n <= 2; n++) {
      var dia = somarDias(hoje, n), tarefas = [];
      for (i = 0; i < dados.rotina.length; i++) {
        var r = dados.rotina[i];
        if (vale(r, dia)) tarefas.push({ tarefa: r.tarefa, quem: r.quem, tipo: 'rotina' });
      }
      for (i = 0; i < dados.tarefas.length; i++) {
        t = dados.tarefas[i];
        if (t.tipo === 'pontual' && t.data === dia) tarefas.push({ tarefa: t.tarefa, quem: t.quem, tipo: 'pontual' });
      }
      proximos.push({ data: dia, tarefas: tarefas, agenda: agendaPorDia[dia] || [] });
    }

    var rotina = [];
    for (i = 0; i < dados.rotina.length; i++) {
      var rc = copiar(dados.rotina[i]); rc.dias_texto = textoDias(rc.dias); rotina.push(rc);
    }
    var cfg = dados.config || {};
    return {
      ok: true,
      hoje: hoje,
      nomes: { p1: cfg.nome_1 || 'Pessoa 1', p2: cfg.nome_2 || 'Pessoa 2', casal: 'Casal' },
      cidade: cfg.cidade || '',
      noite: lerFaixa(cfg.modo_noite, '23:00-05:30'),
      bom_dia: lerFaixa(cfg.bom_dia, '05:30-06:10'),
      recado: { texto: cfg.recado || '', autor: cfg.recado_autor || '', quando: cfg.recado_quando || '' },
      tarefas: lista,
      progresso: progresso,
      agenda: agendaPorDia[hoje] || [],
      proximos: proximos,
      rotina: rotina
    };
  }

  /* "23:00-05:30" ou "23h às 5h30" → { de: 1380, ate: 330 } em minutos do dia; texto vazio desliga */
  function lerFaixa(texto, padrao) {
    var t = String(texto == null ? padrao : texto).toLowerCase();
    var m = t.match(/(\d{1,2})(?:[:h]\s*(\d{2})?)?\s*(?:-|até|às|as|a)\s*(\d{1,2})(?:[:h]\s*(\d{2})?)?/);
    return m ? { de: +m[1] * 60 + (+m[2] || 0), ate: +m[3] * 60 + (+m[4] || 0) } : null;
  }

  function achar(lista, id) {
    for (var i = 0; i < lista.length; i++) if (lista[i].id === id) return i;
    return -1;
  }
  function exigir(cond, msg) { if (!cond) throw new Error(msg); }
  function limpar(t) { return String(t || '').replace(/\s+/g, ' ').trim().slice(0, 140); }

  /* Muda os dados conforme o pedido do celular. agora = "aaaa-mm-dd hh:mm" */
  function aplicar(dados, pedido, agora, novoId) {
    var a = pedido.a, i;
    var hoje = agora.slice(0, 10);
    if (a === 'marcar') {
      i = achar(dados.tarefas, pedido.id);
      exigir(i >= 0, 'Tarefa não encontrada. Atualize a página.');
      dados.tarefas[i].feita = !!pedido.feita;
      dados.tarefas[i].feita_em = pedido.feita ? agora : '';
    } else if (a === 'nova') {
      exigir(limpar(pedido.tarefa), 'Escreva a tarefa.');
      exigir(QUEM.indexOf(pedido.quem) >= 0, 'Escolha para quem é a tarefa.');
      dados.tarefas.push({ id: novoId(), data: pedido.data || hoje, tarefa: limpar(pedido.tarefa), quem: pedido.quem,
        tipo: 'pontual', rotina_id: '', feita: false, feita_em: '', criada_em: agora });
    } else if (a === 'editar') {
      i = achar(dados.tarefas, pedido.id);
      exigir(i >= 0, 'Tarefa não encontrada. Atualize a página.');
      exigir(dados.tarefas[i].tipo === 'pontual', 'Tarefa de rotina se edita pela rotina.');
      exigir(limpar(pedido.tarefa), 'Escreva a tarefa.');
      exigir(QUEM.indexOf(pedido.quem) >= 0, 'Escolha para quem é a tarefa.');
      dados.tarefas[i].tarefa = limpar(pedido.tarefa);
      dados.tarefas[i].quem = pedido.quem;
      if (pedido.data) dados.tarefas[i].data = pedido.data;
    } else if (a === 'rotina_editar') {
      i = achar(dados.rotina, pedido.id);
      exigir(i >= 0, 'Rotina não encontrada. Atualize a página.');
      exigir(limpar(pedido.tarefa), 'Escreva a tarefa.');
      exigir(QUEM.indexOf(pedido.quem) >= 0, 'Escolha para quem é a tarefa.');
      exigir(lerDias(pedido.dias).length, 'Escolha pelo menos um dia.');
      var r = dados.rotina[i];
      r.tarefa = limpar(pedido.tarefa); r.quem = pedido.quem; r.dias = pedido.dias; r.manha = !!pedido.manha;
      // a de hoje ainda não feita acompanha a mudança; se hoje saiu dos dias, ela sai da lista
      for (var k = dados.tarefas.length - 1; k >= 0; k--) {
        var tr = dados.tarefas[k];
        if (tr.rotina_id !== r.id || tr.data < hoje || tr.feita) continue;
        if (vale(r, tr.data)) { tr.tarefa = r.tarefa; tr.quem = r.quem; } else dados.tarefas.splice(k, 1);
      }
    } else if (a === 'apagar') {
      i = achar(dados.tarefas, pedido.id);
      exigir(i >= 0, 'Tarefa não encontrada. Atualize a página.');
      exigir(dados.tarefas[i].tipo === 'pontual', 'Tarefa de rotina sai apagando a rotina.');
      dados.tarefas.splice(i, 1);
    } else if (a === 'recado') {
      dados.config.recado = limpar(pedido.texto);
      dados.config.recado_autor = dados.config.recado ? (pedido.autor || '') : '';
      dados.config.recado_quando = dados.config.recado ? agora : '';
    } else if (a === 'rotina_nova') {
      exigir(limpar(pedido.tarefa), 'Escreva a tarefa.');
      exigir(QUEM.indexOf(pedido.quem) >= 0, 'Escolha para quem é a tarefa.');
      exigir(lerDias(pedido.dias).length, 'Escolha pelo menos um dia.');
      dados.rotina.push({ id: novoId(), tarefa: limpar(pedido.tarefa), quem: pedido.quem, dias: pedido.dias, ativa: true,
        manha: !!pedido.manha });
    } else if (a === 'rotina_apagar') {
      i = achar(dados.rotina, pedido.id);
      exigir(i >= 0, 'Rotina não encontrada. Atualize a página.');
      dados.rotina.splice(i, 1);
      // tira a de hoje se ainda não foi feita; as já feitas ficam no histórico
      for (var j = dados.tarefas.length - 1; j >= 0; j--) {
        var t = dados.tarefas[j];
        if (t.rotina_id === pedido.id && t.data >= hoje && !t.feita) dados.tarefas.splice(j, 1);
      }
    } else {
      throw new Error('Pedido desconhecido: ' + a);
    }
  }

  return {
    SIGLAS: SIGLAS, SIGLAS_BONITAS: SIGLAS_BONITAS, DIAS: DIAS, MESES: MESES, QUEM: QUEM,
    pad: pad, paraData: paraData, paraTexto: paraTexto, somarDias: somarDias, diaDaSemana: diaDaSemana,
    lerDias: lerDias, textoDias: textoDias, dataPorExtenso: dataPorExtenso, lerFaixa: lerFaixa,
    garantirRotina: garantirRotina, montarEstado: montarEstado, aplicar: aplicar
  };
})();
