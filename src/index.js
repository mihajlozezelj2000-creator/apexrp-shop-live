const productPrices = {
  'Vip':10,'Master':20,'Vip 3 Meseca':25,'Master 3 Meseca':45,'Haker':15,'Haker 3 Meseca':35,'Hitmen':20,'Hitmen 3 Meseca':50,
  'Battle Pass':15,'Battle Pass Level':0.5,'Drzavna Organizacija':20,'Custom Mafija sa Enterijerom':45,'Custom Mafija bez Enterijera':30,
  'Suppressor Dodatak':5,'+5 Slotova za Mafiju':5,'Pancir Dodatak':15,'Auto Mafija':20,'Impound Garaza':20,'Helikopter Garaza':20,'Discord Sef Logovi':50,'Prebacivanje Lidera':5,'Skidanje Opomene':5,
  'Vozilo iz Auto Salona preko 1.000.000':10,'Vozilo iz Auto Salona do 1.000.000':7,'Custom Motor iz Auto Salona':20,'Custom Vozilo iz Auto Salona':30,'Custom Vozilo 1/1':40,'Premium Vozilo iz Auto Salona':35,
  'Swift | 4 Sjedista':50,'Frogger | 4 Sjedista':30,'Maverick | 4 Sjedista':40,'Super Volito | 4 Sjedista':35,'Super Volito 2 | 4 Sjedista':40,'Volatus | 4 Sjedista':60,
  'Unjail do 100 Minuta':3,'Unjail do 200 Minuta':6,'Unjail do 300 Minuta':10,'Unjail preko 300 Minuta':15,'Unban':35,'Unban Perma':50,
  'Nova Licna Karta':5,'Random Broj Telefona':3,'Custom Broj Telefona':10,'Skidanje Discord Muted Role':5
};

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  }
});

async function paypalRequest(env, endpoint, options = {}) {
  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) {
    throw new Error('PayPal nalog još nije povezan na serveru.');
  }
  const api = (env.PAYPAL_ENV || 'sandbox').toLowerCase() === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
  const tokenResponse = await fetch(`${api}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  const token = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || !token.access_token) {
    throw new Error('PayPal nije prihvatio podešavanja naloga.');
  }
  const response = await fetch(`${api}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || 'PayPal trenutno nije mogao da obradi uplatu.');
  }
  return data;
}

async function handleApi(request, env, url) {
  const isLive = (env.PAYPAL_ENV || 'sandbox').toLowerCase() === 'live';
  if (request.method === 'GET' && url.pathname === '/api/config') {
    const configured = Boolean(env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET);
    return json({ clientId: configured ? env.PAYPAL_CLIENT_ID : '', configured, environment: isLive ? 'live' : 'sandbox' });
  }

  if (request.method === 'POST' && url.pathname === '/api/orders') {
    const length = Number(request.headers.get('content-length') || 0);
    if (length > 20000) return json({ error: 'Zahtev je prevelik.' }, 413);
    let body;
    try { body = await request.json(); } catch { return json({ error: 'Neispravan zahtev.' }, 400); }
    if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 30 || body.items.some(item => typeof item !== 'string' || !Object.hasOwn(productPrices, item))) {
      return json({ error: 'Korpa sadrži nevažeći proizvod. Osveži stranicu i pokušaj ponovo.' }, 400);
    }
    const total = body.items.reduce((sum, item) => sum + productPrices[item], 0).toFixed(2);
    const order = await paypalRequest(env, '/v2/checkout/orders', {
      method: 'POST',
      headers: { 'PayPal-Request-Id': crypto.randomUUID() },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{ amount: { currency_code: 'EUR', value: total }, description: 'Apex Roleplay prodavnica', custom_id: 'apex-roleplay' }]
      })
    });
    return json({ id: order.id });
  }

  const captureMatch = url.pathname.match(/^\/api\/orders\/([A-Z0-9-]+)\/capture$/i);
  if (request.method === 'POST' && captureMatch) {
    const orderId = captureMatch[1];
    const order = await paypalRequest(env, `/v2/checkout/orders/${encodeURIComponent(orderId)}`);
    const unit = order.purchase_units?.[0];
    if (order.status !== 'APPROVED' || unit?.custom_id !== 'apex-roleplay' || unit?.description !== 'Apex Roleplay prodavnica' || unit?.amount?.currency_code !== 'EUR') {
      return json({ error: 'Ova narudžbina nije važeća. Pokreni plaćanje ponovo.' }, 400);
    }
    const result = await paypalRequest(env, `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
      method: 'POST',
      headers: { 'PayPal-Request-Id': crypto.randomUUID() }
    });
    const capturedAmount = result.purchase_units?.[0]?.payments?.captures?.[0]?.amount;
    if (result.status !== 'COMPLETED' || capturedAmount?.currency_code !== 'EUR' || capturedAmount?.value !== unit.amount.value) {
      return json({ error: 'PayPal još nije potvrdio uplatu.' }, 402);
    }
    return json({ status: result.status });
  }

  return json({ error: 'Nije pronađeno.' }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith('/api/')) return await handleApi(request, env, url);
      if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
      return env.ASSETS.fetch(request);
    } catch (error) {
      return json({ error: error.message || 'Došlo je do greške pri plaćanju.' }, 500);
    }
  }
};
