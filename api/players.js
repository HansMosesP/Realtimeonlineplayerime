// api/players.js
const GATES = [
  { name: "Main Gate", url: "http://main.imeroleplay.com:30120" },
  { name: "International Gate", url: "http://inter.imeroleplay.com:30120" }
];

async function getJSON(url) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(8000),
    headers: {
      Accept: "application/json",
      "User-Agent": "IME-Web-Monitor/1.0"
    }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export default async function handler(req, res) {
  // Cache di edge Vercel 15 detik → hemat fetch ke gate IME
  res.setHeader("Cache-Control", "s-maxage=15, stale-while-revalidate=45");

  let lastError = null;

  for (const gate of GATES) {
    try {
      const [players, dynamic] = await Promise.all([
        getJSON(`${gate.url}/players.json`),
        getJSON(`${gate.url}/dynamic.json`)
      ]);

      if (!Array.isArray(players)) throw new Error("Invalid players.json");

      const cleaned = players.map((p) => ({
        id: p.id,
        name: String(p.name || "Unknown").slice(0, 100),
        ping: p.ping ?? 0
      }));

      return res.status(200).json({
        ok: true,
        gate: gate.name,
        online: Number(dynamic.clients ?? cleaned.length),
        max: Number(dynamic.sv_maxclients ?? 2048),
        players: cleaned,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      lastError = err;
      console.warn(`[${gate.name}] gagal: ${err.message}`);
    }
  }

  return res.status(502).json({
    ok: false,
    error: "Semua gate IME tidak bisa dihubungi",
    detail: lastError?.message ?? null
  });
}
