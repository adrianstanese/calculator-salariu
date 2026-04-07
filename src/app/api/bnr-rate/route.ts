import { NextResponse } from "next/server";

let cachedRate: number | null = null;
let cachedAt: number = 0;
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

export async function GET() {
  const now = Date.now();

  // Return cached if fresh
  if (cachedRate && now - cachedAt < CACHE_TTL) {
    return NextResponse.json({ rate: cachedRate, source: "bnr", cached: true });
  }

  try {
    // Fetch BNR official XML
    const res = await fetch("https://www.bnr.ro/nbrfxrates.xml", {
      next: { revalidate: 14400 }, // 4 hours
    });
    const txt = await res.text();
    const match = txt.match(/<Rate currency="EUR">([0-9.]+)<\/Rate>/);
    if (match) {
      cachedRate = parseFloat(match[1]);
      cachedAt = now;
      return NextResponse.json({ rate: cachedRate, source: "bnr", cached: false });
    }
  } catch {
    // BNR failed
  }

  // Fallback: Frankfurter API (ECB data)
  try {
    const res = await fetch("https://api.frankfurter.app/latest?from=EUR&to=RON");
    const data = await res.json();
    if (data?.rates?.RON) {
      cachedRate = data.rates.RON;
      cachedAt = now;
      return NextResponse.json({ rate: cachedRate, source: "ecb", cached: false });
    }
  } catch {
    // ECB also failed
  }

  // Ultimate fallback
  return NextResponse.json({ rate: 5.0978, source: "fallback", cached: false });
}
