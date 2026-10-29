/**
 * FC MANAGER — Harness de renderização da UI (sem navegador, sem dependências).
 *
 * Carrega domain.js + main.js reais dentro de um sandbox `vm` com um DOM mínimo
 * simulado, força o fallback offline (window.FALLBACK_CAREER_DATA) e imprime em JSON
 * o que a interface efetivamente escreveu nos elementos-chave.
 *
 * Uso: node tests/ui_harness.js <caminho-para-json-de-dados>
 */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const dataPath = process.argv[2];
const data = JSON.parse(fs.readFileSync(dataPath, "utf-8"));

function makeElement(id) {
  const el = {
    id,
    textContent: "",
    innerHTML: "",
    value: "",
    className: "",
    disabled: false,
    onclick: null,
    style: {},
    dataset: {},
    children: [],
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {},
    removeEventListener() {},
    setAttribute() {},
    getAttribute() { return null; },
    removeAttribute() {},
    appendChild(child) { el.children.push(child); return child; },
    remove() {},
    focus() {},
    click() {},
    querySelector() { return makeElement(null); },
    querySelectorAll() { return []; },
    closest() { return null; }
  };
  return el;
}

const elements = new Map();
const domListeners = {};
const document = {
  activeElement: null,
  body: makeElement("body"),
  getElementById(id) {
    if (!elements.has(id)) elements.set(id, makeElement(id));
    return elements.get(id);
  },
  querySelector() { return makeElement(null); },
  querySelectorAll() { return []; },
  createElement(tag) { return makeElement(tag); },
  addEventListener(evt, fn) { (domListeners[evt] = domListeners[evt] || []).push(fn); }
};

const sandbox = {
  console,
  document,
  setTimeout,
  clearTimeout,
  alert() {},
  confirm() { return true; },
  // Simula GitHub Pages sem API local e sem JSON: força o bundle offline.
  fetch: () => Promise.reject(new Error("offline (harness)")),
  location: { reload() {}, href: "http://localhost/" },
  localStorage: { getItem() { return null; }, setItem() {} },
  FALLBACK_CAREER_DATA: data
};
sandbox.window = sandbox;
sandbox.self = sandbox;
vm.createContext(sandbox);

for (const rel of ["assets/js/domain.js", "assets/js/main.js"]) {
  const code = fs.readFileSync(path.join(ROOT, rel), "utf-8");
  vm.runInContext(code, sandbox, { filename: rel });
}

(async () => {
  for (const fn of domListeners.DOMContentLoaded || []) await fn();
  await new Promise(r => setTimeout(r, 20));

  const get = id => (elements.has(id) ? elements.get(id) : makeElement(id));
  const heroBtn = get("hero-match-btn");
  if (typeof heroBtn.onclick === "function") heroBtn.onclick();

  const out = {
    error: get("state-error-message").textContent,
    hero: {
      dateComp: get("hero-match-date-comp").textContent,
      home: get("hero-match-home").textContent,
      score: get("hero-match-score").textContent,
      away: get("hero-match-away").textContent
    },
    leagueRecord: get("stat-league-record").textContent,
    totalRecord: get("stat-total-record").textContent,
    matchesGridHtml: get("matches-grid-container").innerHTML,
    matchModalTitle: get("modal-match-title").textContent,
    matchModalBody: get("modal-match-body").innerHTML
  };
  process.stdout.write(JSON.stringify(out));
})().catch(err => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
