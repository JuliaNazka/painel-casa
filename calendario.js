/*
 * Painel da Casa — calendário no estilo Google Agenda (mês, semana e dia), usado pela TV e pelo celular.
 * Só monta o HTML; cada página tem o seu CSS para as classes cal-*.
 * Semana começa no domingo, como o Google Agenda em português.
 * ES5 de propósito (TV LG).
 */
var Calendario = (function () {
  var MESES = Nucleo.MESES;
  var CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  var SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  var pad = Nucleo.pad, somar = Nucleo.somarDias;

  function esc(t) {
    return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function cap(t) { return t.charAt(0).toUpperCase() + t.slice(1); }
  function partes(s) { var p = String(s).split('-'); return { a: +p[0], m: +p[1], d: +p[2] }; }
  function inicioSemana(s) { return somar(s, -Nucleo.diaDaSemana(s)); }
  function ultimoDoMes(s) { var p = partes(s); return Nucleo.paraTexto(new Date(p.a, p.m, 0)); }

  function dias(de, ate) {
    var l = [];
    for (var d = de; d <= ate && l.length < 50; d = somar(d, 1)) l.push(d);
    return l;
  }

  /* Que dias a visão mostra e o título do topo. */
  function periodo(vista, ref) {
    if (vista === 'dia') return { de: ref, ate: ref, titulo: cap(Nucleo.dataPorExtenso(ref)) };
    if (vista === 'semana') {
      var ini = inicioSemana(ref), fim = somar(ini, 6), a = partes(ini), b = partes(fim);
      var t = a.m === b.m ? a.d + ' – ' + b.d + ' de ' + MESES[a.m - 1] + ' de ' + a.a :
        a.d + ' de ' + CURTOS[a.m - 1] + ' – ' + b.d + ' de ' + CURTOS[b.m - 1] + (a.a !== b.a ? ' de ' + b.a : '');
      return { de: ini, ate: fim, titulo: t };
    }
    var primeiro = ref.slice(0, 8) + '01', p = partes(ref);
    return { de: inicioSemana(primeiro), ate: somar(inicioSemana(ultimoDoMes(ref)), 6),
      titulo: cap(MESES[p.m - 1]) + ' de ' + p.a, mes: ref.slice(0, 7) };
  }

  /* ‹ e › : um dia, uma semana ou um mês. */
  function mover(vista, ref, n) {
    if (vista === 'dia') return somar(ref, n);
    if (vista === 'semana') return somar(ref, 7 * n);
    var p = partes(ref);
    return Nucleo.paraTexto(new Date(p.a, p.m - 1 + n, 1));
  }

  function filtrar(lista, filtro) {
    var l = [];
    for (var i = 0; i < (lista || []).length; i++) if (!filtro || filtro[lista[i].quem] !== false) l.push(lista[i]);
    return l;
  }

  function minutos(hhmm) { var p = String(hhmm).split(':'); return +p[0] * 60 + (+p[1] || 0); }
  function hm(m) { return pad(Math.floor(m / 60) % 24) + ':' + pad(m % 60); }
  function tempos(e) {
    var ini = e.inicio ? minutos(e.inicio) : 0;
    var fim = e.termina_outro_dia ? 1440 : e.fim ? minutos(e.fim) : ini + 60;
    if (fim <= ini) fim = Math.min(1440, ini + 30);
    return { ini: ini, fim: fim };
  }
  function horario(e) {
    if (e.dia_inteiro) return 'Dia todo';
    if (!e.inicio) return 'até ' + e.fim;
    return e.inicio + (e.fim ? ' – ' + (e.termina_outro_dia ? 'dia seguinte' : e.fim) : '');
  }

  /* Eventos que se cruzam ficam lado a lado, como no Google Agenda. */
  function arrumar(evs) {
    var itens = [], saida = [], grupo = [], fimGrupo = -1, i;
    for (i = 0; i < evs.length; i++) {
      if (evs[i].dia_inteiro) continue;
      var t = tempos(evs[i]);
      itens.push({ e: evs[i], ini: t.ini, fim: t.fim });
    }
    itens.sort(function (a, b) { return (a.ini - b.ini) || (b.fim - a.fim); });
    function fechar() {
      var fins = [];
      for (var j = 0; j < grupo.length; j++) {
        var c = 0;
        while (fins[c] > grupo[j].ini) c++;
        grupo[j].col = c; fins[c] = grupo[j].fim;
      }
      for (j = 0; j < grupo.length; j++) { grupo[j].cols = fins.length; saida.push(grupo[j]); }
      grupo = []; fimGrupo = -1;
    }
    for (i = 0; i < itens.length; i++) {
      if (grupo.length && itens[i].ini >= fimGrupo) fechar();
      grupo.push(itens[i]);
      fimGrupo = Math.max(fimGrupo, itens[i].fim);
    }
    fechar();
    return saida;
  }

  /* Faixa de horas da grade: no mínimo 7h às 22h, cresce se houver evento fora disso. */
  function faixa(lista, porDia, filtro) {
    var de = 7 * 60, ate = 22 * 60;
    for (var i = 0; i < lista.length; i++) {
      var evs = filtrar(porDia[lista[i]], filtro);
      for (var j = 0; j < evs.length; j++) {
        if (evs[j].dia_inteiro) continue;
        var t = tempos(evs[j]);
        de = Math.min(de, Math.floor(t.ini / 60) * 60);
        ate = Math.max(ate, Math.min(1440, Math.ceil(t.fim / 60) * 60));
      }
    }
    return { de: de, ate: ate };
  }

  /* ---------- mês ---------- */

  /* o: { hoje, filtro, max (eventos por dia), compacto (só pontinhos), selecionado } */
  function htmlMes(p, porDia, o) {
    var html = '<div class="cal-mes"><div class="cal-mes-cab">';
    for (var s = 0; s < 7; s++) html += '<div>' + SEMANA[s] + '</div>';
    html += '</div><div class="cal-mes-grade">';
    var lista = dias(p.de, p.ate), max = o.max || 3;
    for (var i = 0; i < lista.length; i++) {
      var d = lista[i], evs = filtrar(porDia[d], o.filtro);
      if (i % 7 === 0) html += '<div class="cal-semana">';
      html += '<div class="cal-cel' + (d.slice(0, 7) !== p.mes ? ' fora' : '') + (d === o.hoje ? ' hoje' : '') +
        (d === o.selecionado ? ' sel' : '') + '" data-cal-dia="' + d + '"><div class="cal-num"><span>' + partes(d).d + '</span></div>';
      if (o.compacto) {
        html += '<div class="cal-pontos">';
        for (var k = 0; k < evs.length && k < 4; k++) html += '<i class="q-' + evs[k].quem + '"></i>';
        html += '</div>';
      } else {
        for (k = 0; k < evs.length && k < max; k++) {
          var e = evs[k];
          html += e.dia_inteiro ? '<div class="cal-ev inteiro q-' + e.quem + '">' + esc(e.titulo) + '</div>' :
            '<div class="cal-ev"><i class="q-' + e.quem + '"></i><span class="h">' + esc(e.inicio || '') + '</span>' + esc(e.titulo) + '</div>';
        }
        if (evs.length > max) html += '<div class="cal-mais">+ ' + (evs.length - max) + ' mais</div>';
      }
      html += '</div>';
      if (i % 7 === 6) html += '</div>';
    }
    return html + '</div></div>';
  }

  /* ---------- semana e dia (grade de horários) ---------- */

  /* o: { hoje, filtro, agora (minutos), altura (px por hora; vazio = ocupa a altura da caixa), detalhes } */
  function htmlGrade(lista, porDia, o) {
    var fx = faixa(lista, porDia, o.filtro), span = fx.ate - fx.de, i, j;
    var pct = function (m) { return (100 * (m - fx.de) / span).toFixed(3) + '%'; };
    var html = '<div class="cal-grade' + (lista.length === 1 ? ' um-dia' : '') + '"><div class="cal-g-cab"><div class="cal-g-canto"></div>';
    for (i = 0; i < lista.length; i++) {
      var d = lista[i];
      html += '<div class="cal-g-dia' + (d === o.hoje ? ' hoje' : '') + '" data-cal-dia="' + d + '"><span>' + SEMANA[Nucleo.diaDaSemana(d)] +
        '</span><b>' + partes(d).d + '</b></div>';
    }
    html += '</div>';
    // linha de dia inteiro, só se houver algum
    var temInteiro = false, linha = '<div class="cal-g-inteiro"><div class="cal-g-canto">dia todo</div>';
    for (i = 0; i < lista.length; i++) {
      var evs = filtrar(porDia[lista[i]], o.filtro), n = 0;
      linha += '<div class="cal-g-cel">';
      for (j = 0; j < evs.length; j++) {
        if (!evs[j].dia_inteiro) continue;
        temInteiro = true;
        if (n++ < 2) linha += '<div class="cal-ev inteiro q-' + evs[j].quem + '">' + esc(evs[j].titulo) + '</div>';
      }
      if (n > 2) linha += '<div class="cal-mais">+ ' + (n - 2) + '</div>';
      linha += '</div>';
    }
    if (temInteiro) html += linha + '</div>';
    // corpo com horas
    html += '<div class="cal-g-corpo"' + (o.altura ? ' style="height:' + Math.round(o.altura * span / 60) + 'px"' : '') + '><div class="cal-g-horas">';
    for (var h = fx.de; h < fx.ate; h += 60) html += '<div class="cal-g-hora" style="top:' + pct(h) + '"><span>' + hm(h) + '</span></div>';
    html += '</div><div class="cal-g-colunas">';
    for (h = fx.de; h < fx.ate; h += 60) html += '<div class="cal-g-linha" style="top:' + pct(h) + '"></div>';
    for (i = 0; i < lista.length; i++) {
      var dia = lista[i], blocos = arrumar(filtrar(porDia[dia], o.filtro));
      html += '<div class="cal-g-col' + (dia === o.hoje ? ' hoje' : '') + '">';
      for (j = 0; j < blocos.length; j++) {
        var b = blocos[j], e = b.e, curto = b.fim - b.ini < 75;
        html += '<div class="cal-bloco q-' + e.quem + (curto ? ' curto' : '') + '" style="top:' + pct(b.ini) + ';height:' + (100 * (b.fim - b.ini) / span).toFixed(3) +
          '%;left:' + (100 * b.col / b.cols).toFixed(2) + '%;width:' + (100 / b.cols).toFixed(2) + '%"><b>' + esc(e.titulo) + '</b>' +
          '<span>' + esc(horario(e)) + '</span>' + (o.detalhes && e.local ? '<span>' + esc(e.local) + '</span>' : '') + '</div>';
      }
      if (dia === o.hoje && o.agora >= fx.de && o.agora <= fx.ate) html += '<div class="cal-agora" style="top:' + pct(o.agora) + '"></div>';
      html += '</div>';
    }
    return html + '</div></div></div>';
  }

  return { periodo: periodo, mover: mover, dias: dias, htmlMes: htmlMes, htmlGrade: htmlGrade, filtrar: filtrar, horario: horario,
    inicioSemana: inicioSemana };
})();
