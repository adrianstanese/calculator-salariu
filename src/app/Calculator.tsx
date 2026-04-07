"use client";
import { useState, useCallback, useEffect } from "react";

/* ═══════════════════════════════════════════════════════════════
   CALCULATOR SALARIU — V3 FULL FEATURES
   - Tichete de masă (nr + valoare)
   - Funcție de bază toggle
   - Scutit impozit (handicap, construcții, agricultură)
   - Afișare EUR (curs BNR live via API)
   - Fluturaș de salariu (printable)
   - Deducere personală Art. 77 Cod Fiscal (graded brackets)
   - 3 fiscal regimes (Jul-Dec 2026, Jan-Jun 2026, 2025)
   - 3 themes (light, dark, pink)
   - 3 languages (RO, EN, FR) with flag toggles
   ═══════════════════════════════════════════════════════════════ */

// ─── Tax Regimes ─────────────────────────────────────────────
const REGIMES = {
  jul2026: { label: "IUL – DEC 2026", CAS: 0.25, CASS: 0.10, TAX: 0.10, CAM: 0.0225, DP_PCTS: [20,25,30,35,45], MIN_BRUT: 4325, PRAG_OVER: 2000 },
  jan2026: { label: "IAN – IUN 2026", CAS: 0.25, CASS: 0.10, TAX: 0.10, CAM: 0.0225, DP_PCTS: [20,25,30,35,45], MIN_BRUT: 4050, PRAG_OVER: 2000 },
  "2025":  { label: "IAN – DEC 2025", CAS: 0.25, CASS: 0.10, TAX: 0.10, CAM: 0.0225, DP_PCTS: [20,25,30,35,45], MIN_BRUT: 4050, PRAG_OVER: 2000 },
};

// ─── Deducere Personală — Art. 77 Cod Fiscal ─────────────────
// Percentage-based, decreasing in 0.5pp steps per 200 RON bracket above MIN_BRUT
function calcDeducerePersonala(brut, depCount, regime) {
  const minBrut = regime.MIN_BRUT;
  const pragMax = minBrut + regime.PRAG_OVER; // e.g., 6325 for jul2026
  if (brut > pragMax) return 0;
  const pctMax = regime.DP_PCTS[Math.min(depCount, 4)];
  if (brut <= minBrut) {
    return Math.ceil((pctMax / 100) * minBrut / 10) * 10;
  }
  const overMin = brut - minBrut;
  const brackets = Math.floor(overMin / 200);
  const pctReduction = brackets * 0.5;
  const pct = Math.max(0, pctMax - pctReduction);
  if (pct <= 0) return 0;
  return Math.ceil((pct / 100) * brut / 10) * 10;
}

// ─── Calculation Engine ──────────────────────────────────────
function calcFromBrut(brut, opts, regime) {
  const { depCount, functieBaza, scutitImpozit, nrTichete, valTichet } = opts;
  const valTicheteTotal = nrTichete * valTichet;
  // For deducere calculation, include tichete in brut
  const brutPentruDeducere = brut + valTicheteTotal;
  const cas = Math.round(brut * regime.CAS);
  const cass = Math.round(brut * regime.CASS);
  let deducere = 0;
  if (functieBaza) {
    deducere = calcDeducerePersonala(brutPentruDeducere, depCount, regime);
  }
  const bazaImpozabila = Math.max(0, brut - cas - cass - deducere);
  // Impozit pe tichete
  const impozitTichete = Math.round(valTicheteTotal * regime.TAX);
  let impozitSalariu = scutitImpozit ? 0 : Math.round(bazaImpozabila * regime.TAX);
  const impozitTotal = impozitSalariu + impozitTichete;
  const net = brut - cas - cass - impozitSalariu;
  const netCuTichete = net + valTicheteTotal - impozitTichete;
  const cam = Math.round(brut * regime.CAM);
  const costTotal = brut + cam;
  return { brut, net, netCuTichete, cas, cass, deducere, bazaImpozabila, impozitSalariu, impozitTichete, impozitTotal, cam, costTotal, valTicheteTotal };
}

function calcFromNet(targetNet, opts, regime) {
  let lo = targetNet, hi = targetNet * 3;
  for (let i = 0; i < 200; i++) {
    const mid = Math.round((lo + hi) / 2);
    const r = calcFromBrut(mid, opts, regime);
    if (r.net === targetNet) return r;
    if (r.net < targetNet) lo = mid + 1; else hi = mid - 1;
  }
  return calcFromBrut(Math.round((lo + hi) / 2), opts, regime);
}

function calcFromCost(targetCost, opts, regime) {
  const brut = Math.round(targetCost / (1 + regime.CAM));
  return calcFromBrut(brut, opts, regime);
}

const fmt = n => n.toLocaleString("ro-RO");
const parseNum = s => parseInt(s.replace(/[^\d]/g, ""), 10) || 0;
// EUR rate — fetched from our API route (server-side BNR fetch, no CORS)
let _eurRate = 5.0978; // Fallback: BNR rate Apr 2026
async function fetchBnrRate() {
  try {
    const res = await fetch("/api/bnr-rate");
    const data = await res.json();
    if (data?.rate) _eurRate = data.rate;
  } catch { /* keep fallback */ }
  return _eurRate;
}
const toEur = n => (n / _eurRate).toFixed(2);

// ─── Themes ──────────────────────────────────────────────────
const TH = {
  light: { name:"Light", bg:"#f5f7fb", bgCard:"#fff", bgInput:"#f8fafc", bgSidebar:"#fff", bgHeader:"#fff", bgTab:"#f5f7fb", bgTabAct:"#fff", pri:"#1d4ed8", priL:"#f0f4ff", text:"#1a2236", tm:"#64748b", tf:"#94a3b8", bor:"#e8ecf1", infoBg:"#f0f9ff", infoBor:"#bae6fd", infoTx:"#0284c7", grn:"#16a34a", grnBg:"#f0fdf4", shd:"0 1px 3px rgba(0,0,0,.04),0 4px 12px rgba(0,0,0,.03)", btnG:"linear-gradient(135deg,#3b82f6,#1d4ed8)", btnS:"0 4px 14px rgba(29,78,216,.3)", la:"#1a2236", cb:"#1d4ed8", gl:"rgba(255,255,255,.55)", glB:"rgba(255,255,255,.7)" },
  dark: { name:"Dark", bg:"#0f172a", bgCard:"#1e293b", bgInput:"#0f172a", bgSidebar:"#1e293b", bgHeader:"#1e293b", bgTab:"#0f172a", bgTabAct:"#334155", pri:"#60a5fa", priL:"rgba(96,165,250,.1)", text:"#f1f5f9", tm:"#94a3b8", tf:"#64748b", bor:"#334155", infoBg:"rgba(96,165,250,.08)", infoBor:"#334155", infoTx:"#60a5fa", grn:"#4ade80", grnBg:"rgba(74,222,128,.1)", shd:"0 1px 3px rgba(0,0,0,.2),0 4px 12px rgba(0,0,0,.15)", btnG:"linear-gradient(135deg,#3b82f6,#2563eb)", btnS:"0 4px 14px rgba(59,130,246,.3)", la:"#f1f5f9", cb:"#60a5fa", gl:"rgba(30,41,59,.6)", glB:"rgba(148,163,184,.2)" },
  pink: { name:"Pink", bg:"#fdf2f8", bgCard:"#fff", bgInput:"#fdf2f8", bgSidebar:"#fff", bgHeader:"#fff", bgTab:"#fce7f3", bgTabAct:"#fff", pri:"#db2777", priL:"#fce7f3", text:"#1a2236", tm:"#9d174d", tf:"#be185d", bor:"#fbcfe8", infoBg:"#fdf2f8", infoBor:"#f9a8d4", infoTx:"#db2777", grn:"#16a34a", grnBg:"#f0fdf4", shd:"0 1px 3px rgba(219,39,119,.06),0 4px 12px rgba(219,39,119,.04)", btnG:"linear-gradient(135deg,#ec4899,#db2777)", btnS:"0 4px 14px rgba(219,39,119,.3)", la:"#1a2236", cb:"#db2777", gl:"rgba(255,255,255,.55)", glB:"rgba(252,231,243,.8)" },
};

// ─── i18n ────────────────────────────────────────────────────
const L = {
  ro: {
    title: "Calculator Salariu", legUpd: "LEGISLAȚIE UPDATE", regLbl: "REGIM FISCAL", brand: "Calculator Salariu", brandS: "Romania",
    nav: { calc:"Calculator", hist:"Istoric", leg:"Legislație", set:"Setări" },
    input: "INTRODU SUMA", modes: { n2b:"Net → Brut", b2n:"Brut → Net", cost:"Cost Angajator" },
    cards: { net:"SALARIU NET", brut:"SALARIU BRUT", cost:"COST TOTAL" },
    adv: "Opțiuni Avansate", dep: "Persoane în întreținere", depO: ["(fără)","pers.","pers.","pers.","pers."],
    funcBaza: "Funcție de bază", funcBazaH: "Contract principal — necesar pentru deducere personală",
    scutit: "Scutit impozit", scutitO: { none:"Nu", handicap:"Handicap", constructii:"Construcții", agricultura:"Agricultură" },
    scutitNote: "Scutirea IT a fost eliminată din ian. 2025",
    tichete: "Tichete de masă", ticNr: "Număr tichete/lună", ticVal: "Valoare tichet (RON)",
    showEur: "Afișare EUR", recalc: "Recalculează",
    info: (p, l, m) => `Calculat conform pragului de ${p} RON (${l}). Salariu minim brut: ${m} RON.`,
    ledger: "Taxe", salBrut: "Salariu Brut", deduceri: "Deducere Personală", bazaImp: "BAZĂ IMPOZABILĂ",
    impozit: "Impozit pe venit", impTich: "Impozit tichete", contrA: "CONTRIBUȚII ANGAJATOR",
    totalC: "TOTAL COST COMPANIE", totalCD: "Suma totală cheltuită de angajator",
    netTich: "NET + TICHETE", netTichD: "Venit efectiv lunar",
    flutur: "Fluturaș Salariu", fluturBtn: "Generează Fluturaș",
    histT: "Istoric Calcule", del: "Șterge tot", noHist: "Niciun calcul efectuat încă.",
    legT: "Legislație Fiscală", legN: "Notă",
    legR: tx => `CAS: ${tx.CAS*100}%, CASS: ${tx.CASS*100}%, Impozit: ${tx.TAX*100}%, CAM: ${tx.CAM*100}%. Deducere conform Art. 77 Cod Fiscal.`,
    setT: "Setări", setTh: "Tema Vizuală", support: "Suport",
    minB: "Min brut", dedS: "Deducere", pragS: "Prag",
    legs: [
      {t:"OUG 168/2022",d:"Modificări Cod Fiscal — contribuții sociale",y:"2022"},
      {t:"Legea 296/2023",d:"Bugetul de stat — praguri fiscale",y:"2023"},
      {t:"OUG 156/2024",d:"Eliminare scutire impozit IT din ian. 2025",y:"2024"},
      {t:"OG 16/2025",d:"Actualizare deduceri personale și praguri",y:"2025"},
      {t:"OUG 31/2026",d:"Regim fiscal Iulie–Decembrie 2026",y:"2026"},
    ],
  },
  en: {
    title: "Salary Calculator", legUpd: "LEGISLATION UPDATE", regLbl: "TAX REGIME", brand: "Calculator Salariu", brandS: "Romania",
    nav: { calc:"Calculator", hist:"History", leg:"Legislation", set:"Settings" },
    input: "ENTER AMOUNT", modes: { n2b:"Net → Gross", b2n:"Gross → Net", cost:"Employer Cost" },
    cards: { net:"NET SALARY", brut:"GROSS SALARY", cost:"TOTAL COST" },
    adv: "Advanced Options", dep: "Dependants", depO: ["(none)","dep.","dep.","dep.","dep."],
    funcBaza: "Primary employment", funcBazaH: "Main contract — required for personal deduction",
    scutit: "Tax exempt", scutitO: { none:"No", handicap:"Disability", constructii:"Construction", agricultura:"Agriculture" },
    scutitNote: "IT exemption removed from Jan 2025",
    tichete: "Meal vouchers", ticNr: "Vouchers/month", ticVal: "Voucher value (RON)",
    showEur: "Show EUR", recalc: "Recalculate",
    info: (p, l, m) => `Calculated per ${p} RON threshold (${l}). Minimum gross salary: ${m} RON.`,
    ledger: "Taxes", salBrut: "Gross Salary", deduceri: "Personal Deduction", bazaImp: "TAXABLE BASE",
    impozit: "Income Tax", impTich: "Voucher tax", contrA: "EMPLOYER CONTRIBUTIONS",
    totalC: "TOTAL COMPANY COST", totalCD: "Total amount spent by employer",
    netTich: "NET + VOUCHERS", netTichD: "Effective monthly income",
    flutur: "Pay Slip", fluturBtn: "Generate Pay Slip",
    histT: "Calculation History", del: "Clear all", noHist: "No calculations yet.",
    legT: "Tax Legislation", legN: "Note",
    legR: tx => `CAS: ${tx.CAS*100}%, CASS: ${tx.CASS*100}%, Tax: ${tx.TAX*100}%, CAM: ${tx.CAM*100}%. Deduction per Art. 77 Tax Code.`,
    setT: "Settings", setTh: "Visual Theme", support: "Support",
    minB: "Min gross", dedS: "Deduction", pragS: "Threshold",
    legs: [
      {t:"GEO 168/2022",d:"Tax Code amendments — social contributions",y:"2022"},
      {t:"Law 296/2023",d:"State budget — fiscal thresholds",y:"2023"},
      {t:"GEO 156/2024",d:"IT tax exemption removed from Jan 2025",y:"2024"},
      {t:"GO 16/2025",d:"Personal deductions and thresholds update",y:"2025"},
      {t:"GEO 31/2026",d:"Tax regime July–December 2026",y:"2026"},
    ],
  },
  fr: {
    title: "Calculateur de Salaire", legUpd: "LÉGISLATION À JOUR", regLbl: "RÉGIME FISCAL", brand: "Calculator Salariu", brandS: "Romania",
    nav: { calc:"Calculateur", hist:"Historique", leg:"Législation", set:"Paramètres" },
    input: "ENTREZ LE MONTANT", modes: { n2b:"Net → Brut", b2n:"Brut → Net", cost:"Coût Employeur" },
    cards: { net:"SALAIRE NET", brut:"SALAIRE BRUT", cost:"COÛT TOTAL" },
    adv: "Options Avancées", dep: "Personnes à charge", depO: ["(aucun)","pers.","pers.","pers.","pers."],
    funcBaza: "Emploi principal", funcBazaH: "Contrat principal — requis pour la déduction",
    scutit: "Exonéré d'impôt", scutitO: { none:"Non", handicap:"Handicap", constructii:"Construction", agricultura:"Agriculture" },
    scutitNote: "Exonération IT supprimée depuis jan. 2025",
    tichete: "Tickets repas", ticNr: "Tickets/mois", ticVal: "Valeur ticket (RON)",
    showEur: "Afficher EUR", recalc: "Recalculer",
    info: (p, l, m) => `Calculé selon le seuil de ${p} RON (${l}). Salaire brut minimum: ${m} RON.`,
    ledger: "Taxes", salBrut: "Salaire Brut", deduceri: "Déduction Personnelle", bazaImp: "BASE IMPOSABLE",
    impozit: "Impôt sur le revenu", impTich: "Impôt tickets", contrA: "COTISATIONS EMPLOYEUR",
    totalC: "COÛT TOTAL ENTREPRISE", totalCD: "Montant total dépensé par l'employeur",
    netTich: "NET + TICKETS", netTichD: "Revenu mensuel effectif",
    flutur: "Bulletin de paie", fluturBtn: "Générer Bulletin",
    histT: "Historique des Calculs", del: "Tout effacer", noHist: "Aucun calcul effectué.",
    legT: "Législation Fiscale", legN: "Note",
    legR: tx => `CAS: ${tx.CAS*100}%, CASS: ${tx.CASS*100}%, Impôt: ${tx.TAX*100}%, CAM: ${tx.CAM*100}%. Déduction Art. 77 Code Fiscal.`,
    setT: "Paramètres", setTh: "Thème Visuel", support: "Support",
    minB: "Brut min", dedS: "Déduction", pragS: "Seuil",
    legs: [
      {t:"OUG 168/2022",d:"Modifications Code Fiscal — cotisations sociales",y:"2022"},
      {t:"Loi 296/2023",d:"Budget de l'État — seuils fiscaux",y:"2023"},
      {t:"OUG 156/2024",d:"Suppression exonération IT dès jan. 2025",y:"2024"},
      {t:"OG 16/2025",d:"Mise à jour des déductions et seuils",y:"2025"},
      {t:"OUG 31/2026",d:"Régime fiscal Juillet–Décembre 2026",y:"2026"},
    ],
  },
};

// ─── Flags ───────────────────────────────────────────────────
const FR = () => <svg width="22" height="16" viewBox="0 0 22 16" style={{borderRadius:3}}><rect width="7.33" height="16" fill="#002B7F"/><rect x="7.33" width="7.34" height="16" fill="#FCD116"/><rect x="14.67" width="7.33" height="16" fill="#CE1126"/></svg>;
const FU = () => <svg width="22" height="16" viewBox="0 0 60 30" style={{borderRadius:3}}><clipPath id="s"><path d="M0,0 v30 h60 v-30z"/></clipPath><clipPath id="t"><path d="M30,15 h30 v15z v15 h-30z h-30 v-15z v-15 h30z"/></clipPath><g clipPath="url(#s)"><path d="M0,0 v30 h60 v-30z" fill="#012169"/><path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6"/><path d="M0,0 L60,30 M60,0 L0,30" clipPath="url(#t)" stroke="#C8102E" strokeWidth="4"/><path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10"/><path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6"/></g></svg>;
const FF = () => <svg width="22" height="16" viewBox="0 0 22 16" style={{borderRadius:3}}><rect width="7.33" height="16" fill="#002395"/><rect x="7.33" width="7.34" height="16" fill="#FFF"/><rect x="14.67" width="7.33" height="16" fill="#ED2939"/></svg>;
const FLAGS = { ro: FR, en: FU, fr: FF };

// ─── Glass styles ────────────────────────────────────────────
const gc = t => ({ background:t.gl, backdropFilter:"blur(20px) saturate(1.6)", WebkitBackdropFilter:"blur(20px) saturate(1.6)", borderRadius:18, border:`1px solid ${t.glB}`, boxShadow:`0 2px 16px rgba(0,0,0,.04),inset 0 1px 1px rgba(255,255,255,.3)`, transition:"all .3s" });
const gb = (t, a) => ({ padding:"8px 18px", borderRadius:14, border:`1px solid ${a?t.pri:t.glB}`, background:a?t.gl:"transparent", backdropFilter:a?"blur(16px) saturate(1.8)":"none", WebkitBackdropFilter:a?"blur(16px) saturate(1.8)":"none", boxShadow:a?"0 2px 12px rgba(0,0,0,.06),inset 0 1px 1px rgba(255,255,255,.4)":"none", color:a?t.text:t.tf, fontWeight:a?600:500, fontSize:13, cursor:"pointer", fontFamily:"inherit", transition:"all .25s" });

// ─── Fluturaș Generator ─────────────────────────────────────
function genFluturas(r, opts, regime, lang) {
  const l = L[lang];
  const d = new Date().toLocaleDateString(lang === "ro" ? "ro-RO" : lang === "fr" ? "fr-FR" : "en-GB");
  const lines = [
    `═══════════════════════════════════════════`,
    `  ${l.flutur.toUpperCase()}`,
    `  ${l.brand} — ${regime.label}`,
    `  ${d}`,
    `═══════════════════════════════════════════`,
    ``,
    `  ${l.salBrut}:              ${fmt(r.brut)} RON`,
    `  ─────────────────────────────────────`,
    `  CAS (${regime.CAS*100}%):              - ${fmt(r.cas)} RON`,
    `  CASS (${regime.CASS*100}%):             - ${fmt(r.cass)} RON`,
    `  ${l.deduceri}:     - ${fmt(r.deducere)} RON`,
    `  ─────────────────────────────────────`,
    `  ${l.bazaImp}:        ${fmt(r.bazaImpozabila)} RON`,
    `  ${l.impozit} (${regime.TAX*100}%): - ${fmt(r.impozitSalariu)} RON`,
  ];
  if (r.valTicheteTotal > 0) {
    lines.push(`  ${l.tichete}:           + ${fmt(r.valTicheteTotal)} RON`);
    lines.push(`  ${l.impTich} (${regime.TAX*100}%):   - ${fmt(r.impozitTichete)} RON`);
  }
  lines.push(`  ─────────────────────────────────────`);
  lines.push(`  ${l.cards.net}:             ${fmt(r.net)} RON`);
  if (r.valTicheteTotal > 0) lines.push(`  ${l.netTich}:        ${fmt(r.netCuTichete)} RON`);
  lines.push(``);
  lines.push(`  ${l.contrA}:`);
  lines.push(`  CAM (${regime.CAM*100}%):             ${fmt(r.cam)} RON`);
  lines.push(`  ─────────────────────────────────────`);
  lines.push(`  ${l.totalC}:    ${fmt(r.costTotal)} RON`);
  lines.push(``);
  if (opts.funcBaza) lines.push(`  ✓ ${l.funcBaza}`);
  if (opts.scutitImpozit) lines.push(`  ✓ ${l.scutit}`);
  lines.push(`  ${l.dep}: ${opts.depCount}`);
  lines.push(``);
  lines.push(`═══════════════════════════════════════════`);
  lines.push(`  ${l.brand} — ${l.brandS}`);
  const text = lines.join("\n");
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `fluturas_${r.brut}_RON.txt`; a.click();
  URL.revokeObjectURL(url);
}

// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════
export default function Calculator() {
  const [pg, setPg] = useState("calc");
  const [mode, setMode] = useState("n2b");
  const [inp, setInp] = useState("10000");
  const [depCount, setDepCount] = useState(0);
  const [funcBaza, setFuncBaza] = useState(true);
  const [scutit, setScutit] = useState("none");
  const [nrTich, setNrTich] = useState(0);
  const [valTich, setValTich] = useState(40);
  const [showEur, setShowEur] = useState(false);
  const [showAdv, setShowAdv] = useState(false);
  const [result, setResult] = useState(null);
  const [sbOpen, setSbOpen] = useState(false);
  const [regK, setRegK] = useState("jul2026");
  const [showReg, setShowReg] = useState(false);
  const [thK, setThK] = useState("light");
  const [lang, setLang] = useState("ro");
  const [hist, setHist] = useState([]);
  const [eurRate, setEurRate] = useState(_eurRate);

  const tx = REGIMES[regK];
  const t = TH[thK];
  const l = L[lang];

  const opts = { depCount, funcBaza, scutitImpozit: scutit !== "none", nrTichete: nrTich, valTichet: valTich };

  // Fetch live BNR rate on mount
  useEffect(() => {
    fetchBnrRate().then(rate => setEurRate(rate));
  }, []);

  const calculate = useCallback(() => {
    const v = parseNum(inp); if (v <= 0) return;
    const ct = REGIMES[regK];
    const o = { depCount, funcBaza, scutitImpozit: scutit !== "none", nrTichete: nrTich, valTichet: valTich };
    const r = mode==="n2b" ? calcFromNet(v,o,ct) : mode==="b2n" ? calcFromBrut(v,o,ct) : calcFromCost(v,o,ct);
    setResult(r);
    setHist(p => [{ ...r, mode, ts: new Date().toLocaleString("ro-RO"), id: Date.now(), reg: ct.label }, ...p].slice(0,20));
  }, [inp, mode, depCount, funcBaza, scutit, nrTich, valTich, regK]);

  useEffect(() => { calculate(); }, []);
  useEffect(() => { calculate(); }, [regK]);

  const eurLabel = showEur ? v => ` (€${(v / eurRate).toFixed(2)})` : () => "";

  const navItems = [
    { id:"calc", lb: l.nav.calc, ic:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="10" y2="10"/><line x1="14" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="10" y2="14"/><line x1="14" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="16" y2="18"/></svg> },
    { id:"hist", lb: l.nav.hist, ic:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
    { id:"leg", lb: l.nav.leg, ic:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg> },
    { id:"set", lb: l.nav.set, ic:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="3"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg> },
  ];

  const selSt = { padding:"6px 12px", borderRadius:10, border:`1px solid ${t.glB}`, fontSize:13, fontFamily:"inherit", color:t.text, background:t.bgInput, backdropFilter:"blur(8px)" };
  const togSt = (on) => ({ width:44, height:24, borderRadius:12, background:on?t.pri:t.tf, border:"none", cursor:"pointer", position:"relative", transition:"background .2s" });
  const togDot = (on) => ({ width:18, height:18, borderRadius:9, background:"#fff", position:"absolute", top:3, left:on?23:3, transition:"left .2s", boxShadow:"0 1px 3px rgba(0,0,0,.15)" });
  const rowSt = { display:"flex", alignItems:"center", justifyContent:"space-between", gap: 8 };
  const lblSt = { fontSize:13, color:t.tm, fontWeight:500 };

  return (
    <div style={{ minHeight:"100vh", background:t.bg, fontFamily:"'DM Sans',-apple-system,sans-serif", display:"flex", flexDirection:"column", transition:"background .3s" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=DM+Serif+Display&display=swap" rel="stylesheet" />

      {/* Header */}
      <header style={{ background:t.bgHeader, borderBottom:`1px solid ${t.bor}`, padding:"0 24px", height:56, display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:100, transition:"all .3s" }}>
        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          <button onClick={() => setSbOpen(!sbOpen)} className="mob-btn" style={{ display:"none", background:"none", border:"none", cursor:"pointer", padding:4, color:t.text }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg></button>
          <span style={{ fontWeight:700, fontSize:18, color:t.text }}>{l.title}</span>
          <span style={{ fontSize:11, fontWeight:700, color:t.grn, background:t.grnBg, padding:"3px 10px", borderRadius:4, letterSpacing:".05em" }}>{l.legUpd}</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ display:"flex", gap:4, ...gc(t), padding:"4px 6px", borderRadius:12 }}>
            {["ro","en","fr"].map(lg => { const Fl = FLAGS[lg]; return <button key={lg} onClick={() => setLang(lg)} style={{ padding:"4px 8px", borderRadius:8, border:"none", cursor:"pointer", background:lang===lg?t.priL:"transparent", opacity:lang===lg?1:.5, transition:"all .2s", display:"flex", alignItems:"center" }}><Fl/></button>; })}
          </div>
          <div style={{ position:"relative" }}>
            <button onClick={() => setShowReg(!showReg)} style={{ ...gb(t,true), display:"flex", alignItems:"center", gap:8, fontSize:12, letterSpacing:".02em" }}>
              {l.regLbl}: {tx.label}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform:showReg?"rotate(180deg)":"none", transition:"transform .2s" }}><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            {showReg && <div style={{ position:"absolute", top:"calc(100% + 8px)", right:0, ...gc(t), boxShadow:"0 8px 32px rgba(0,0,0,.12)", zIndex:200, overflow:"hidden", minWidth:260 }}>
              {Object.entries(REGIMES).map(([k,r]) => (
                <button key={k} onClick={() => { setRegK(k); setShowReg(false); }} style={{ display:"flex", flexDirection:"column", gap:2, width:"100%", textAlign:"left", padding:"12px 16px", border:"none", background:regK===k?t.priL:"transparent", cursor:"pointer", fontFamily:"inherit", borderBottom:`1px solid ${t.bor}`, transition:"background .15s" }}>
                  <span style={{ fontSize:13, fontWeight:600, color:regK===k?t.pri:t.text }}>{r.label}</span>
                  <span style={{ fontSize:11, color:t.tf }}>{l.minB}: {fmt(r.MIN_BRUT)} • {l.pragS}: {fmt(r.MIN_BRUT + r.PRAG_OVER)} RON</span>
                </button>
              ))}
            </div>}
          </div>
        </div>
      </header>

      <div style={{ display:"flex", flex:1, position:"relative" }}>
        {/* Sidebar */}
        <aside className={`sidebar ${sbOpen?"open":""}`} style={{ width:220, background:t.bgSidebar, borderRight:`1px solid ${t.bor}`, padding:"24px 16px", display:"flex", flexDirection:"column", justifyContent:"space-between", flexShrink:0, position:"sticky", top:56, height:"calc(100vh - 56px)", overflowY:"auto", transition:"all .3s" }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:32, padding:"0 8px" }}>
              <div style={{ width:40, height:40, borderRadius:10, background:t.priL, display:"flex", alignItems:"center", justifyContent:"center", color:t.pri }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 21h18M3 7v1a3 3 0 0 0 6 0V7m0 1a3 3 0 0 0 6 0V7m0 1a3 3 0 0 0 6 0V7H3l2-4h14l2 4M5 21V10.87M19 21V10.87"/></svg>
              </div>
              <div><div style={{ fontWeight:700, fontSize:14, color:t.text }}>{l.brand}</div><div style={{ fontSize:11, color:t.tf }}>{l.brandS}</div></div>
            </div>
            <nav style={{ display:"flex", flexDirection:"column", gap:2 }}>
              {navItems.map(n => <button key={n.id} onClick={() => { setPg(n.id); setSbOpen(false); }} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 12px", borderRadius:8, border:"none", background:"transparent", color:pg===n.id?t.pri:t.tm, fontWeight:pg===n.id?600:500, fontSize:14, cursor:"pointer", borderLeft:`3px solid ${pg===n.id?t.pri:"transparent"}`, transition:"all .15s", fontFamily:"inherit", textAlign:"left", width:"100%" }}>{n.ic}{n.lb}</button>)}
            </nav>
          </div>
          <button style={{ display:"flex", alignItems:"center", gap:8, background:"none", border:"none", color:t.tf, fontSize:13, cursor:"pointer", padding:"4px 8px", fontFamily:"inherit" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>{l.support}
          </button>
        </aside>

        {/* Main */}
        <main style={{ flex:1, padding:"28px clamp(16px,3vw,36px)", overflowY:"auto", minWidth:0 }}>

          {/* CALCULATOR */}
          {pg === "calc" && <div style={{ display:"flex", gap:24, flexWrap:"wrap", maxWidth:1100, margin:"0 auto" }}>
            <div style={{ flex:"1 1 500px", minWidth:320 }}>
              <div style={{ ...gc(t), padding:"clamp(20px,3vw,32px)" }}>
                {/* Mode tabs */}
                <div style={{ display:"inline-flex", ...gc(t), padding:4, marginBottom:28, gap:4, borderRadius:16 }}>
                  {[{id:"n2b",lb:l.modes.n2b},{id:"b2n",lb:l.modes.b2n},{id:"cost",lb:l.modes.cost}].map(m =>
                    <button key={m.id} onClick={() => setMode(m.id)} style={gb(t,mode===m.id)}>{m.lb}</button>
                  )}
                </div>

                <label style={{ display:"block", fontSize:10, fontWeight:700, color:t.tf, letterSpacing:".12em", marginBottom:10 }}>{l.input}</label>
                <div style={{ background:t.gl, backdropFilter:"blur(12px) saturate(1.4)", WebkitBackdropFilter:"blur(12px) saturate(1.4)", borderRadius:16, padding:"20px 24px", display:"flex", alignItems:"center", gap:8, border:`1px solid ${t.glB}`, boxShadow:"inset 0 1px 2px rgba(255,255,255,.2)", marginBottom:28, transition:"all .3s" }}>
                  <input type="text" inputMode="numeric" value={inp ? fmt(parseNum(inp)) : ""} onChange={e => setInp(e.target.value.replace(/[^\d]/g,""))} onKeyDown={e => e.key==="Enter" && calculate()}
                    style={{ flex:1, background:"transparent", border:"none", outline:"none", fontSize:"clamp(32px,5vw,44px)", fontWeight:700, color:t.text, fontFamily:"inherit", letterSpacing:"-.02em", width:"100%", minWidth:0 }} placeholder="0" />
                  <span style={{ fontSize:20, fontWeight:500, color:t.tf }}>RON</span>
                </div>

                {/* Result cards */}
                {result && <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:24 }}>
                  {[{lb:l.cards.net, v:result.net, h:true},{lb:l.cards.brut, v:result.brut},{lb:l.cards.cost, v:result.costTotal, h:true}].map(c =>
                    <div key={c.lb} style={{ ...gc(t), padding:"14px 16px" }}>
                      <div style={{ fontSize:9, fontWeight:700, color:t.tf, letterSpacing:".1em", marginBottom:6 }}>{c.lb}</div>
                      <div style={{ fontSize:"clamp(18px,2.5vw,24px)", fontWeight:700, color:c.h?t.pri:t.text }}>{fmt(c.v)}{eurLabel(c.v)}</div>
                    </div>
                  )}
                </div>}

                {/* Net + tichete row */}
                {result && result.valTicheteTotal > 0 && <div style={{ ...gc(t), padding:"12px 16px", marginBottom:16, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div><div style={{ fontSize:9, fontWeight:700, color:t.tf, letterSpacing:".1em" }}>{l.netTich}</div><div style={{ fontSize:11, color:t.tf }}>{l.netTichD}</div></div>
                  <div style={{ fontSize:22, fontWeight:700, color:t.grn }}>{fmt(result.netCuTichete)} RON{eurLabel(result.netCuTichete)}</div>
                </div>}

                <hr style={{ border:"none", borderTop:`1px solid ${t.bor}`, margin:"20px 0" }} />

                {/* Advanced */}
                <button onClick={() => setShowAdv(!showAdv)} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", width:"100%", background:"none", border:"none", cursor:"pointer", padding:"8px 0", fontFamily:"inherit" }}>
                  <span style={{ display:"flex", alignItems:"center", gap:10, fontSize:14, fontWeight:600, color:t.pri }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/><circle cx="8" cy="6" r="2" fill={t.pri}/><circle cx="16" cy="12" r="2" fill={t.pri}/><circle cx="10" cy="18" r="2" fill={t.pri}/></svg>
                    {l.adv}
                  </span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.pri} strokeWidth="2" style={{ transform:showAdv?"rotate(180deg)":"none", transition:"transform .2s" }}><polyline points="6 9 12 15 18 9"/></svg>
                </button>

                {showAdv && <div style={{ padding:"16px 0 8px", display:"flex", flexDirection:"column", gap:14 }}>
                  {/* Dependenti */}
                  <div style={rowSt}><label style={lblSt}>{l.dep}</label>
                    <select value={depCount} onChange={e => setDepCount(+e.target.value)} style={selSt}>{[0,1,2,3,4].map(n => <option key={n} value={n}>{n} {l.depO[n]}</option>)}</select>
                  </div>
                  {/* Functie de baza */}
                  <div style={rowSt}><div><label style={lblSt}>{l.funcBaza}</label><div style={{ fontSize:11, color:t.tf }}>{l.funcBazaH}</div></div>
                    <button onClick={() => setFuncBaza(!funcBaza)} style={togSt(funcBaza)}><div style={togDot(funcBaza)}/></button>
                  </div>
                  {/* Scutit impozit */}
                  <div style={rowSt}><div><label style={lblSt}>{l.scutit}</label><div style={{ fontSize:11, color:t.tf, fontStyle:"italic" }}>{l.scutitNote}</div></div>
                    <select value={scutit} onChange={e => setScutit(e.target.value)} style={selSt}>
                      {Object.entries(l.scutitO).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  {/* Tichete de masa */}
                  <div style={{ ...gc(t), padding:"12px 16px" }}>
                    <div style={{ fontSize:12, fontWeight:600, color:t.text, marginBottom:10 }}>{l.tichete}</div>
                    <div style={{ display:"flex", gap:12 }}>
                      <div style={{ flex:1 }}>
                        <label style={{ fontSize:11, color:t.tf, display:"block", marginBottom:4 }}>{l.ticNr}</label>
                        <input type="number" min="0" max="23" value={nrTich} onChange={e => setNrTich(Math.max(0,Math.min(23,+e.target.value||0)))} style={{ ...selSt, width:"100%", boxSizing:"border-box" }} />
                      </div>
                      <div style={{ flex:1 }}>
                        <label style={{ fontSize:11, color:t.tf, display:"block", marginBottom:4 }}>{l.ticVal}</label>
                        <input type="number" min="0" max="100" value={valTich} onChange={e => setValTich(Math.max(0,+e.target.value||0))} style={{ ...selSt, width:"100%", boxSizing:"border-box" }} />
                      </div>
                    </div>
                  </div>
                  {/* EUR toggle */}
                  <div style={rowSt}><div><label style={lblSt}>{l.showEur}</label><div style={{ fontSize:11, color:t.tf }}>1 EUR = {eurRate.toFixed(4)} RON (BNR)</div></div>
                    <button onClick={() => setShowEur(!showEur)} style={togSt(showEur)}><div style={togDot(showEur)}/></button>
                  </div>
                </div>}

                <button onClick={calculate} style={{ width:"100%", padding:"16px 24px", borderRadius:16, border:"none", background:t.btnG, color:"#fff", fontSize:16, fontWeight:700, cursor:"pointer", fontFamily:"inherit", marginTop:20, boxShadow:`${t.btnS},inset 0 1px 1px rgba(255,255,255,.2)`, backdropFilter:"blur(8px)", transition:"transform .1s" }}
                  onMouseDown={e => e.currentTarget.style.transform="scale(.98)"} onMouseUp={e => e.currentTarget.style.transform="scale(1)"}>{l.recalc}</button>
              </div>
              <div style={{ marginTop:20, ...gc(t), padding:"14px 20px", display:"flex", alignItems:"flex-start", gap:12, borderColor:t.infoBor }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.infoTx} strokeWidth="1.5" style={{ flexShrink:0, marginTop:1 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                <span style={{ fontSize:13, color:t.tm, lineHeight:1.5 }}>{l.info(fmt(tx.MIN_BRUT + tx.PRAG_OVER), tx.label, fmt(tx.MIN_BRUT))}</span>
              </div>
            </div>

            {/* Tax Ledger */}
            {result && <div style={{ flex:"0 1 340px", minWidth:280 }}>
              <div style={{ ...gc(t), padding:24 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20 }}>
                  <div style={{ width:4, height:24, borderRadius:2, background:t.la }} />
                  <h3 style={{ fontSize:20, fontWeight:700, color:t.text, fontFamily:"'DM Serif Display',serif" }}>{l.ledger}</h3>
                </div>
                {[
                  {lb:l.salBrut, v:result.brut},
                  {lb:`CAS (${tx.CAS*100}%)`, v:result.cas},
                  {lb:`CASS (${tx.CASS*100}%)`, v:result.cass},
                  {lb:l.deduceri, v:result.deducere, c:t.grn, p:"- "},
                ].map(i => <div key={i.lb} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0" }}>
                  <span style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, color:t.tm }}><span style={{ width:6, height:6, borderRadius:3, background:i.c||t.la }}/>{i.lb}</span>
                  <span style={{ fontSize:14, fontWeight:700, color:i.c||t.text }}>{i.p||""}{fmt(i.v)} RON{eurLabel(i.v)}</span>
                </div>)}
                <hr style={{ border:"none", borderTop:`1px solid ${t.bor}`, margin:"8px 0" }} />
                <div style={{ display:"flex", justifyContent:"space-between", padding:"10px 0" }}>
                  <span style={{ fontSize:10, fontWeight:700, color:t.tf, letterSpacing:".08em" }}>{l.bazaImp}</span>
                  <span style={{ fontSize:14, fontWeight:700, color:t.text }}>{fmt(result.bazaImpozabila)} RON</span>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", padding:"8px 0" }}>
                  <span style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, color:t.tm }}><span style={{ width:6, height:6, borderRadius:3, background:t.la }}/>{l.impozit} ({tx.TAX*100}%){scutit !== "none" ? " ✓" : ""}</span>
                  <span style={{ fontSize:14, fontWeight:700, color:scutit!=="none"?t.grn:t.text }}>{fmt(result.impozitSalariu)} RON</span>
                </div>
                {result.valTicheteTotal > 0 && <div style={{ display:"flex", justifyContent:"space-between", padding:"8px 0" }}>
                  <span style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, color:t.tm }}><span style={{ width:6, height:6, borderRadius:3, background:t.la }}/>{l.impTich}</span>
                  <span style={{ fontSize:14, fontWeight:700, color:t.text }}>{fmt(result.impozitTichete)} RON</span>
                </div>}
                <hr style={{ border:"none", borderTop:`1px solid ${t.bor}`, margin:"8px 0" }} />
                <div style={{ padding:"8px 0" }}><span style={{ fontSize:10, fontWeight:700, color:t.tf, letterSpacing:".08em" }}>{l.contrA}</span></div>
                <div style={{ display:"flex", justifyContent:"space-between", padding:"8px 0" }}>
                  <span style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, color:t.tm }}><span style={{ width:6, height:6, borderRadius:3, background:t.la }}/>CAM ({tx.CAM*100}%)</span>
                  <span style={{ fontSize:14, fontWeight:700, color:t.text }}>{fmt(result.cam)} RON</span>
                </div>
                <div style={{ marginTop:16, borderRadius:14, border:`2px solid ${t.cb}`, padding:16, display:"flex", alignItems:"center", justifyContent:"space-between", background:t.gl, backdropFilter:"blur(8px)" }}>
                  <div><div style={{ fontSize:10, fontWeight:700, letterSpacing:".08em", color:t.text, marginBottom:4 }}>{l.totalC}</div><div style={{ fontSize:11, color:t.tf, lineHeight:1.4 }}>{l.totalCD}</div></div>
                  <div style={{ fontSize:"clamp(22px,3vw,28px)", fontWeight:700, color:t.text, whiteSpace:"nowrap" }}>{fmt(result.costTotal)} <span style={{ fontSize:14, color:t.tf, fontWeight:500 }}>RON</span></div>
                </div>
              </div>
              {/* Fluturas button */}
              <button onClick={() => result && genFluturas(result, opts, tx, lang)} style={{ marginTop:16, width:"100%", ...gc(t), padding:"14px 20px", border:`1px solid ${t.glB}`, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8, fontFamily:"inherit", fontSize:14, fontWeight:600, color:t.pri, background:t.gl }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                {l.fluturBtn}
              </button>
            </div>}
          </div>}

          {/* ISTORIC */}
          {pg === "hist" && <div style={{ maxWidth:700, margin:"0 auto" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
              <h2 style={{ fontFamily:"'DM Serif Display',serif", fontSize:24, color:t.text }}>{l.histT}</h2>
              {hist.length > 0 && <button onClick={() => setHist([])} style={gb(t,false)}>{l.del}</button>}
            </div>
            {hist.length === 0 ? <div style={{ textAlign:"center", padding:64, color:t.tf }}><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ margin:"0 auto 16px" }}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><p>{l.noHist}</p></div>
            : hist.map(h => <div key={h.id} style={{ ...gc(t), padding:"16px 20px", marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div><div style={{ fontSize:14, fontWeight:600, marginBottom:4, color:t.text }}>Brut: {fmt(h.brut)} → Net: {fmt(h.net)} RON</div><div style={{ fontSize:12, color:t.tf }}>{h.reg} • {h.ts}</div></div>
              <div style={{ fontSize:16, fontWeight:700, color:t.pri }}>{fmt(h.costTotal)} RON</div>
            </div>)}
          </div>}

          {/* LEGISLAȚIE */}
          {pg === "leg" && <div style={{ maxWidth:700, margin:"0 auto" }}>
            <h2 style={{ fontFamily:"'DM Serif Display',serif", fontSize:24, marginBottom:24, color:t.text }}>{l.legT}</h2>
            {l.legs.map((lg,i) => <div key={i} style={{ ...gc(t), padding:"16px 20px", marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div><div style={{ fontSize:14, fontWeight:600, marginBottom:4, color:t.text }}>{lg.t}</div><div style={{ fontSize:13, color:t.tm }}>{lg.d}</div></div>
              <span style={{ ...gb(t,false), fontSize:12, padding:"4px 10px", whiteSpace:"nowrap" }}>{lg.y}</span>
            </div>)}
            <div style={{ marginTop:24, ...gc(t), padding:20, borderColor:t.infoBor }}><p style={{ fontSize:13, color:t.tm, lineHeight:1.6 }}><strong style={{ color:t.text }}>{l.legN}:</strong> {l.legR(tx)}</p></div>
          </div>}

          {/* SETĂRI */}
          {pg === "set" && <div style={{ maxWidth:500, margin:"0 auto" }}>
            <h2 style={{ fontFamily:"'DM Serif Display',serif", fontSize:24, marginBottom:24, color:t.text }}>{l.setT}</h2>
            <div style={{ ...gc(t), padding:24 }}>
              <h3 style={{ fontSize:14, fontWeight:700, color:t.text, marginBottom:20 }}>{l.setTh}</h3>
              <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
                {Object.entries(TH).map(([k,th]) => <button key={k} onClick={() => setThK(k)} style={{ flex:"1 1 120px", padding:16, borderRadius:14, border:`2px solid ${thK===k?t.pri:t.bor}`, background:th.bg, cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:10, transition:"all .2s", fontFamily:"inherit", backdropFilter:"blur(12px)" }}>
                  <div style={{ width:48, height:32, borderRadius:8, background:th.gl, border:`1px solid ${th.glB}`, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 1px 4px rgba(0,0,0,.08),inset 0 1px 1px rgba(255,255,255,.3)" }}><div style={{ width:20, height:4, borderRadius:2, background:th.pri }}/></div>
                  <span style={{ fontSize:13, fontWeight:thK===k?700:500, color:thK===k?t.pri:t.tm }}>{th.name}</span>
                  {thK===k && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.pri} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>}
                </button>)}
              </div>
            </div>
          </div>}
        </main>
      </div>

      {sbOpen && <div onClick={() => setSbOpen(false)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.3)", zIndex:49 }} />}
      <style>{`@media(max-width:768px){.mob-btn{display:block!important}.sidebar{position:fixed!important;top:56px!important;left:-260px;width:240px!important;height:calc(100vh - 56px)!important;z-index:50;transition:left .25s ease;box-shadow:4px 0 16px rgba(0,0,0,.1)}.sidebar.open{left:0!important}}`}</style>
    </div>
  );
}
