import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "index.html"), "utf8");

test("botao de favoritar usa SVG, nao o glifo de coracao da fonte", () => {
  assert.ok(!html.includes("♥"), "nenhum coracao em glifo de fonte");
  const favBtn = html.match(/<button id="c-fav"[^>]*>([\s\S]*?)<\/button>/);
  assert.ok(favBtn, "botao c-fav existe");
  assert.ok(favBtn[1].includes("<svg"), "c-fav contem SVG");
  assert.ok(html.includes('class="heart-ico"'), "classe do icone presente");
});

test("vinhetas geradas por IA existem e estao ligadas nas radios", () => {
  for (const key of ["jonas", "tiktok", "hits2010", "alltime", "disney", "spotify", "bed"]) {
    const f = join(root, "assets", "vinhetas", `${key}.mp3`);
    assert.ok(existsSync(f), `${key}.mp3 existe`);
    assert.ok(statSync(f).size > 20000, `${key}.mp3 tem audio real (>20KB)`);
  }
  for (const key of ["jonas", "tiktok", "hits2010", "alltime", "disney", "spotify"]) {
    assert.ok(html.includes(`assets/vinhetas/${key}.mp3`), `radio ${key} ligada a vinheta gerada`);
  }
  assert.ok(html.includes('id="vinheta-audio"'), "player de vinheta presente");
  assert.ok(html.includes("function speakVinheta"), "speakVinheta presente");
});

test("importacao de playlist e prefetch continuam presentes", () => {
  assert.ok(html.includes('id="f-loadplaylist"'), "botao carregar playlist");
  assert.ok(html.includes("function fetchPlaylistTracks"), "fetchPlaylistTracks presente");
  assert.ok(html.includes("function startVinhetaTransition"), "vinheta com fade presente");
});

test("busca no youtube inteiro com acoes de tocar/fila/radio", () => {
  assert.ok(html.includes("function searchYoutube"), "searchYoutube presente");
  assert.ok(html.includes('id="yt-results"'), "area de resultados do youtube");
  assert.ok(html.includes("function playNow"), "tocar agora presente");
  assert.ok(html.includes("function queueAdd"), "adicionar a fila presente");
  assert.ok(html.includes("function openAddToStation"), "adicionar a radio presente");
  assert.ok(html.includes("function matchTitle"), "matchTitle (evita musica errada) presente");
  assert.ok(html.includes("function isGenericTitle"), "isGenericTitle presente");
  // "fila" = toca em seguida (na frente), nao no fim do shuffle
  const qa = html.match(/function queueAdd\(track\)\{[\s\S]*?\n\}/);
  assert.ok(qa, "queueAdd presente");
  assert.ok(qa[0].includes("queue.unshift(track)"), "fila insere na frente (toca em seguida)");
});

test("ponte local com o terminal presente no site e no cli", () => {
  assert.ok(html.includes("function startBridge"), "startBridge no site");
  assert.ok(html.includes("function runBridgeCommand"), "runBridgeCommand no site");
  assert.ok(html.includes('id="bridge-status"'), "indicador da ponte no waybar");
  const cli = readFileSync(join(root, "cli", "radio"), "utf8");
  assert.ok(cli.includes("cmd_bridge"), "cmd_bridge no cli");
  assert.ok(cli.includes("bridge_active"), "roteamento pela ponte no cli");
  assert.ok(cli.includes("/health") || cli.includes("bridge_health"), "health check da ponte");
});

test("autoplay bloqueado nao derruba a radio e tem botao de liberar som", () => {
  assert.ok(html.includes("function probePlayback"), "probePlayback presente");
  assert.ok(html.includes("function startMuted"), "inicio mudo presente (padrao youtube)");
  assert.ok(html.includes("function showAutoplayBar"), "aviso de autoplay presente");
  assert.ok(html.includes("function activateAudio"), "liberar som por clique presente");
  assert.ok(html.includes('id="autoplay-bar"'), "barra de ativar som no html");
  assert.ok(html.includes("NotAllowedError"), "trata NotAllowedError do autoplay");
  assert.ok(html.includes('"touchstart"'), "destrava o som tambem no toque do celular");
  assert.ok(html.includes("else if(current && currentStation)"), "re-toca a faixa se o player nao estava pronto");
  const cli = readFileSync(join(root, "cli", "radio"), "utf8");
  assert.ok(/^cmd_resume\(\)/m.test(cli), "cmd_resume no cli");
  assert.ok(cli.includes("play|retoma|continua|despausa"), "comando radio play existe");
  assert.ok(cli.includes('\\"blocked\\"') || cli.includes('"blocked"'), "estado informa bloqueio de autoplay");
});

test("radios publicadas aparecem em qualquer navegador (admin local tem precedencia)", () => {
  assert.ok(existsSync(join(root, "custom-stations.js")), "custom-stations.js existe");
  const cs = readFileSync(join(root, "custom-stations.js"), "utf8");
  assert.ok(cs.includes("window.CUSTOM_STATIONS"), "CUSTOM_STATIONS definido");
  assert.ok(html.includes('src="custom-stations.js"'), "site carrega custom-stations.js");
  assert.ok(html.includes("const PUBLISHED"), "PUBLISHED presente");
  assert.ok(html.includes("published:true"), "publicadas marcadas");
  assert.ok(html.includes("send-stations"), "site envia radios pra ponte publicar");
  const sw = readFileSync(join(root, "sw.js"), "utf8");
  assert.ok(sw.includes("custom-stations.js"), "SW cacheia custom-stations.js");
  const cli = readFileSync(join(root, "cli", "radio"), "utf8");
  assert.ok(/^cmd_publish\(\)/m.test(cli), "cmd_publish no cli");
  assert.ok(cli.includes("publicar|publish"), "dispatch radio publicar");
  assert.ok(cli.includes('"/stations"') || cli.includes("/stations"), "ponte /stations presente");
});

test("dados: toda radio oficial e publicada tem 100+ faixas validas e unicas", () => {
  const load = (file) => {
    const w = {};
    new Function("window", readFileSync(join(root, file), "utf8"))(w);
    return w;
  };
  const td = load("tracks-data.js").TRACKS_DATA;
  for (const [key, tracks] of Object.entries(td)) {
    assert.ok(tracks.length >= 100, `${key} tem 100+ faixas (${tracks.length})`);
    const ids = tracks.map(t => t[2]);
    assert.equal(new Set(ids).size, ids.length, `${key} sem IDs duplicados`);
    assert.ok(ids.every(id => /^[A-Za-z0-9_-]{11}$/.test(id)), `${key} so IDs validos`);
  }
  const cs = load("custom-stations.js").CUSTOM_STATIONS;
  assert.ok(cs.length >= 2, "Natal e Olivia publicadas");
  for (const s of cs) {
    assert.ok(s.tracks.length >= 100, `${s.name} tem 100+ faixas (${s.tracks.length})`);
    const ids = s.tracks.map(t => t.id);
    assert.equal(new Set(ids).size, ids.length, `${s.name} sem IDs duplicados`);
    assert.ok(ids.every(id => /^[A-Za-z0-9_-]{11}$/.test(id)), `${s.name} so IDs validos`);
  }
});

test("faixa adicionada numa radio publicada nao se perde (extraTracks aplicado)", () => {
  const applies = (html.match(/tracks:s\.tracks\.concat\(extraTracks\[s\.id\]\|\|\[\]\)/g) || []).length;
  assert.ok(applies >= 2, "extraTracks aplicado nas oficiais E nas publicadas");
  assert.ok(html.includes("function sanitizeImportedTracks"), "importacao por link valida as faixas");
});

test("prefetch sem ads expira e SW so cacheia resposta boa", () => {
  assert.ok(html.includes("entry.at"), "prefetch guarda quando foi resolvido");
  assert.ok(html.includes("PREFETCH_TTL"), "prefetch tem validade");
  const sw = readFileSync(join(root, "sw.js"), "utf8");
  assert.ok(/res\.ok|status===200/.test(sw), "SW nao cacheia 404/erro");
});

test("terminal toca Natal e Olivia (radios publicadas), nao so as oficiais", () => {
  const cli = readFileSync(join(root, "cli", "radio"), "utf8");
  assert.ok(cli.includes("custom-stations.js"), "CLI baixa as radios publicadas");
  assert.ok(cli.includes("oliviarodrigo"), "atalho olivia no CLI");
  assert.ok(cli.includes("CUSTOM_CACHE"), "CLI cacheia as publicadas");
});

test("radio on sorteia entre tops, tiktok e natal", () => {
  const cli = readFileSync(join(root, "cli", "radio"), "utf8");
  assert.ok(/^cmd_radio_on\(\)/m.test(cli), "cmd_radio_on presente");
  assert.ok(cli.includes("on|aleatoria|aleatorio|random"), "radio on no dispatch");
  assert.ok(cli.includes("alltime tiktok natal"), "candidatas tops/tiktok/natal");
  assert.ok(cli.includes("natal|natalino"), "atalho natal no station_key");
  assert.ok(cli.includes("station_has_tracks"), "checa se a radio existe no terminal");
  assert.ok(html.includes("function findStation"), "site acha radio pelo nome (radios custom)");
});

test("radios novas Disney Channel e Top Hits Hoje no Spotify", () => {
  assert.ok(html.includes('id:"disney"'), "radio Disney no site");
  assert.ok(html.includes('id:"spotify"'), "radio Spotify no site");
  const cli = readFileSync(join(root, "cli", "radio"), "utf8");
  assert.ok(cli.includes("disney|disneychannel"), "atalho disney no CLI");
  assert.ok(cli.includes("spotify|tophits"), "atalho spotify no CLI");
  assert.ok(cli.includes('echo "Disney Channel"'), "nome Disney no CLI");
  assert.ok(cli.includes('echo "Top Hits Hoje no Spotify"'), "nome Spotify no CLI");
  const td = (() => { const w = {}; new Function("window", readFileSync(join(root, "tracks-data.js"), "utf8"))(w); return w.TRACKS_DATA; })();
  assert.ok(td.disney && td.disney.length >= 140, `disney 140+ faixas (${td.disney.length})`);
  assert.ok(td.spotify && td.spotify.length >= 100, `spotify 100+ faixas (${td.spotify.length})`);
});

test("fonte alternativa tem instancia viva e embed desabilitado nao marca como falha real", () => {
  assert.ok(html.includes("yt.chocolatemoo53.com"), "instancia viva na lista de fallback");
  assert.ok(html.includes("ytLastError"), "guarda o codigo de erro do youtube");
  assert.ok(html.includes("ytLastError===101||ytLastError===150"), "embed desabilitado (101/150) tratado como soft");
  assert.ok(html.includes("30*60*1000"), "marca temporaria de 30min pra embed desabilitado");
  assert.ok(html.includes("function markBad(id,ttl)") || /function markBad\(id,ttl\)/.test(html), "markBad aceita TTL");
});
