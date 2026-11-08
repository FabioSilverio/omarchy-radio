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
  for (const key of ["jonas", "tiktok", "hits2010", "alltime", "bed"]) {
    const f = join(root, "assets", "vinhetas", `${key}.mp3`);
    assert.ok(existsSync(f), `${key}.mp3 existe`);
    assert.ok(statSync(f).size > 20000, `${key}.mp3 tem audio real (>20KB)`);
  }
  for (const key of ["jonas", "tiktok", "hits2010", "alltime"]) {
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
