# Apex RP — besplatno objavljivanje

Ovaj folder je pripremljena Cloudflare Workers + Static Assets verzija sajta. Statičke stranice se služe kao fajlovi, a `/api/*` pozivi za PayPal rade kroz Worker. Worker ne uspavljuje aplikaciju posle perioda bez poseta.

## Važno pre objavljivanja

- `.env` i PayPal tajni ključ nisu kopirani u ovaj folder.
- U Cloudflare dashboardu se `PAYPAL_CLIENT_ID` i `PAYPAL_CLIENT_SECRET` unose kao Worker **Secrets**. Nikad ih ne stavljaj u `public/`, kod, GitHub ili obične `vars`.
- Besplatni Workers plan ima dnevnu kvotu za dinamičke zahteve i nema ugovorenu garanciju neprekidnog rada. Ako kvota bude premašena, API pozivi mogu privremeno prestati da rade.
- Povezivanje `apexrp.com` zahteva kontrolu nad domenom i njegovim DNS-om. DNS trenutno postoji; pre povezivanja proveri da je domen tvoj i dostupan u tvom Cloudflare nalogu.
- Google indeksiranje može da se zatraži kroz Search Console nakon što domen radi javno. Pozicija broj 1 ne može da se obeća.

## Objavljivanje

1. Napravi Cloudflare nalog i otvori Workers & Pages.
2. Instaliraj Node.js, otvori terminal u ovom folderu i pokreni `npm install`.
3. Pokreni `npx wrangler login`, pa `npm run deploy`.
4. U Worker Settings → Variables and Secrets dodaj `PAYPAL_ENV=live` kao promenljivu, zatim dodaj `PAYPAL_CLIENT_ID` i `PAYPAL_CLIENT_SECRET` kao **Secrets**.
5. Kada se potvrdi da je `apexrp.com` u tvom Cloudflare nalogu, dodaj ga u Worker → Settings → Domains & Routes.
6. U Google Search Console dodaj domen i pošalji sitemap kada se doda. Google odlučuje da li i gde će prikazati rezultat.

Nemoj unositi niti slati PayPal Live ključeve dok ne vidiš da si u svom Cloudflare nalogu i da su u poljima označenim kao Secrets.
