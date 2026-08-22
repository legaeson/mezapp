async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
        if (!token) {
            return res.status(503).json({ error: 'TELEGRAM_BOT_TOKEN не настроен в Environment Variables на Vercel' });
        }

        let body = req.body;
        if (typeof body === 'string') {
            try {
                body = JSON.parse(body);
            } catch (e) {
                body = {};
            }
        }
        body = body || {};

        const amount = parseInt(body.amount, 10);
        if (!amount || amount < 1 || amount > 10000) {
            return res.status(400).json({ error: `Неверная сумма пожертвования: ${body.amount}` });
        }

        const tgUrl = `https://api.telegram.org/bot${token}/createInvoiceLink`;
        const payload = {
            title: 'Поддержка проекта LezgiMez',
            description: `Добровольное пожертвование ${amount} ⭐️ на развитие LezgiMez`,
            payload: `donation_${amount}_stars_${Date.now()}`,
            provider_token: '',
            currency: 'XTR',
            prices: [{ label: 'Stars', amount: amount }]
        };

        const response = await fetch(tgUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        
        if (!data.ok) {
            return res.status(502).json({ 
                error: `Ошибка Telegram Bot API: ${data.description || 'Неизвестная ошибка'} (${data.error_code || 'нет кода'})`, 
                details: data 
            });
        }

        return res.status(200).json({ ok: true, invoiceLink: data.result });
    } catch (err) {
        return res.status(500).json({ error: `Ошибка сервера: ${err.message}` });
    }
}

module.exports = handler;
module.exports.default = handler;


