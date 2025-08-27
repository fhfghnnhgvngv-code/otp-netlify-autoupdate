// netlify/functions/otp.js
const cheerio = require('cheerio');

// ENV переменные задашь в Netlify: Site settings → Environment variables
const XSRF = process.env.XSRF_TOKEN || '';
const LARAVEL = process.env.LARAVEL_SESSION || '';
const EXTRA = process.env.EXTRA_COOKIE || ''; // BKhWIi8bk...

exports.handler = async () => {
  if (!XSRF || !LARAVEL) {
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: 'Missing env vars: XSRF_TOKEN, LARAVEL_SESSION (+ EXTRA_COOKIE optional)' }),
    };
  }

  try {
    const res = await fetch('https://lamanche.money/notify/cards/3d-codes', {
      method: 'GET',
      headers: {
        'user-agent': 'Mozilla/5.0',
        'accept-language': 'ru',
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'upgrade-insecure-requests': '1',
        'referer': 'https://lamanche.money/',
        'cookie': `XSRF-TOKEN=${XSRF}; laravel_session=${LARAVEL}; ${EXTRA ? 'BKhWIi8bkJWPDvgxciRQl5bbZyFMmpDvuJENFix7=' + EXTRA + ';' : ''}`
      }
    });

    if (!res.ok) {
      return { statusCode: res.status, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ error: 'Upstream HTTP ' + res.status }) };
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    const now = new Date();
    const rows = [];

    $('tr').each((_, tr) => {
      const tds = $(tr).find('td');
      if (tds.length >= 7) {
        const date = $(tds[0]).text().trim();       // DD.MM.YYYY HH:MM
        const user = $(tds[1]).text().trim();
        const amount = $(tds[2]).text().trim();
        const card = $(tds[3]).text().trim();
        const otp = $(tds[4]).text().trim();
        const merchant = $(tds[5]).text().trim();
        const type = $(tds[6]).text().trim();

        const [d, m, rest] = date.split('.');
        if (!rest) return;
        const [y, hm] = rest.split(' ');
        if (!hm) return;
        const [hh, mm] = hm.split(':');
        const dt = new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm));

        const diff = now - dt;
        if (diff >= 0 && diff <= 60 * 60 * 1000) {
          rows.push({ date, user, amount, card, otp, merchant, type });
        }
      }
    });

    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
      body: JSON.stringify(rows),
    };
  } catch (e) {
    return { statusCode: 500, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ error: e.message }) };
  }
};
