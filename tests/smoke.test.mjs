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
