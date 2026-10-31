const SERVER = "http://haven.arkya.app:30132";

export default async () => {
  let body = { online: false };
  try {
    const res = await fetch(`${SERVER}/dynamic.json`, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const data = await res.json();
      body = {
        online: true,
        players: Number(data.clients) || 0,
        maxPlayers: Number(data.sv_maxclients) || null,
      };
    }
  } catch {
    // Server unreachable: report as offline
  }

  return Response.json(body, {
    headers: { "Cache-Control": "public, max-age=0, s-maxage=30" },
  });
};

export const config = { path: "/api/haven-status" };