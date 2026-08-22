export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const token = (env.TELEGRAM_BOT_TOKEN || '').trim();
        
        const headers = { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*' 
        };

        if (!token) {
            return new Response(JSON.stringify({ error: 'Payment backend is not configured' }), { 
                status: 503,
                headers
            });
        }

        const body = await request.json();
        const amount = parseInt(body.amount);

        if (!amount || amount < 1 || amount > 10000) {
            return new Response(JSON.stringify({ error: 'Invalid amount' }), { 
                status: 400,
                headers
            });
        }

        const tgUrl = `https://api.telegram.org/bot${token}/createInvoiceLink`;
        const payload = {
            title: 'Поддержка проекта',
            description: `Добровольное пожертвование ${amount} ⭐️ на развитие LezgiMez`,
            payload: `donation_${amount}_stars_${Date.now()}`,
            provider_token: '',
            currency: 'XTR',
            prices: [{ label: 'Stars', amount: amount }]
        };

        const res = await fetch(tgUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        
        if (!data.ok) {
            return new Response(JSON.stringify({ error: 'Telegram API error', details: data }), {
                status: 502,
                headers
            });
        }

        return new Response(JSON.stringify({ ok: true, invoiceLink: data.result }), {
            status: 200,
            headers
        });

    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*' 
            }
        });
    }
}

export async function onRequestOptions(context) {
    return new Response(null, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '86400',
        },
    });
}
