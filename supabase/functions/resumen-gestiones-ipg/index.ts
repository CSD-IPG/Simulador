type Pending = { email: string; periodo: string; ficha: string; plazo: string | null; motivo: string };

Deno.serve(async (req: Request) => {
  const token = Deno.env.get('IPG_DIGEST_TOKEN');
  if (!token || req.method !== 'POST' || req.headers.get('x-ipg-digest-token') !== token) {
    return new Response(null, { status: 403 });
  }
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('IPG_ALERT_FROM');
  if (!apiKey || !from) return Response.json({ error: 'Remitente pendiente de configuración' }, { status: 503 });

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const data = await fetch(Deno.env.get('SUPABASE_URL') + '/rest/v1/rpc/gestiones_pendientes_aviso_ipg', {
    method: 'POST',
    headers: { apikey: serviceKey, Authorization: 'Bearer ' + serviceKey, 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!data.ok) return Response.json({ error: 'No se pudieron consultar las gestiones' }, { status: 502 });
  const groups = new Map<string, Pending[]>();
  for (const row of await data.json() as Pending[]) {
    const cases = groups.get(row.email) ?? [];
    cases.push(row);
    groups.set(row.email, cases);
  }
  if (groups.size > 100) return Response.json({ error: 'El resumen excede la cuota diaria gratuita' }, { status: 409 });

  const day = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Santiago' }).format(new Date());
  let accepted = 0;
  for (const [email, cases] of groups) {
    const lines = cases.map((item, index) => {
      const link = new URL('https://csd-ipg.github.io/Simulador/escuela/seguimiento/');
      link.hash = new URLSearchParams({ ciclo: item.periodo, ficha: item.ficha }).toString();
      return `Ficha ${index + 1} · ${item.motivo}${item.plazo ? ' · Plazo ' + item.plazo : ''}\n${link.href}`;
    });
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email));
    const recipient = Array.from(new Uint8Array(hash), value => value.toString(16).padStart(2, '0')).join('');
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'ipg-seguimiento/' + day + '/' + recipient,
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: 'Seguimiento Académico IPG | Gestiones pendientes (' + cases.length + ')',
        text: 'Revise sus gestiones asignadas y registre el avance en el tablero.\n\n' + lines.join('\n\n'),
      }),
    }).catch(() => null);
    if (response?.ok) accepted++;
  }
  return Response.json({ destinatarios: groups.size, aceptados: accepted }, { status: accepted === groups.size ? 200 : 502 });
});
