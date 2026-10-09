/**
 * /api/items?catalogId=4639&campaignId=9634&pageSize=500
 * Trae productos REALES con precio, imagen y link reales para FB/IG
 * Soporta API keys por marca via env: BRAND_9634_APIKEY, BRAND_12108_APIKEY, etc.
 * Si no hay brand key, usa IMPACT_SID/TOKEN global
 */
export async function onRequest(context) {
  const url = new URL(context.request.url);
  const catalogId = url.searchParams.get('catalogId');
  const campaignId = url.searchParams.get('campaignId');
  const pageSize = parseInt(url.searchParams.get('pageSize') || '500');
  const maxItems = parseInt(url.searchParams.get('maxItems') || '5000'); // limite por request para no tronar

  if (!catalogId) {
    return new Response(JSON.stringify({ error: 'Missing catalogId' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  // 1. Determinar credenciales: ¿hay API key especifica para esta campaña/marca?
  let SID = context.env.IMPACT_SID;
  let TOKEN = context.env.IMPACT_TOKEN;

  if (campaignId) {
    const brandSidKey = `BRAND_${campaignId}_SID`;
    const brandTokenKey = `BRAND_${campaignId}_TOKEN`;
    const brandApiKey = `BRAND_${campaignId}_APIKEY`; // formato alternativo user:pass en uno
    if (context.env[brandSidKey] && context.env[brandTokenKey]) {
      SID = context.env[brandSidKey];
      TOKEN = context.env[brandTokenKey];
    } else if (context.env[brandApiKey]) {
      // Si guardaste "user:pass" en una sola variable
      const parts = context.env[brandApiKey].split(':');
      if (parts.length === 2) {
        SID = parts[0];
        TOKEN = parts[1];
      }
    }
  }

  if (!SID || !TOKEN) {
    return new Response(JSON.stringify({ error: 'Missing credentials for this brand' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  const credentials = btoa(`${SID}:${TOKEN}`);
  let allItems = [];
  let page = 1;
  let totalPages = 1;

  try {
    while (page <= totalPages && allItems.length < maxItems) {
      const apiUrl = `https://api.impact.com/Mediapartners/${SID}/Catalogs/${catalogId}/Items?Page=${page}&PageSize=${pageSize}`;
      const res = await fetch(apiUrl, {
        headers: { 'Authorization': `Basic ${credentials}`, 'Accept': 'application/json' }
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Items API ${res.status}: ${txt.slice(0,300)}`);
      }
      const data = await res.json();
      totalPages = data['@numpages'] || 1;
      const items = data.Items || data['Items'] || [];
      allItems = allItems.concat(items);
      if (items.length < pageSize) break; // última página
      page++;
    }

    // 2. Normalizar para Facebook Commerce
    const adultKeywords = ['bestvibe','seekheart','bodyotics','penchant','fofana','ulike','oyrosy','nudco','condom','lube','vibrator','adult toy','sex toy'];
    const cleaned = allItems.map(it => {
      // Impact puede devolver campos diferentes segun marca
      const priceRaw = it.CurrentPrice || it.Price || it.SalePrice || it.RetailPrice || 0;
      const priceNum = parseFloat(String(priceRaw).replace(/[^0-9.]/g,'')) || 0;
      const price = priceNum > 0 ? `${priceNum.toFixed(2)} USD` : '29.99 USD';
      const title = it.ProductName || it.Name || it.Title || 'Producto';
      const desc = (it.Description || it.LongDescription || title).slice(0, 500);
      const image = it.ImageUrl || it.Image || it.OriginalImageUrl || '';
      const link = it.ProductUrl || it.Url || it.DeepLink || '';
      const brand = it.Brand || it.Manufacturer || '';
      const category = it.Category || it.GoogleProductCategory || 'General';
      const sku = it.Sku || it.Id || it.ProductId || '';

      const isAdult = adultKeywords.some(k => (title+' '+desc+' '+category).toLowerCase().includes(k));

      return {
        id: String(sku || `${catalogId}-${Math.random().toString(36).slice(2,8)}`),
        title,
        description: desc,
        availability: 'in stock',
        condition: 'new',
        price,
        link,
        image_link: image,
        brand,
        google_product_category: mapCategory(category),
        quantity_to_sell_on_facebook: 100,
        custom_label_0: campaignId || '',
        _isAdult: isAdult,
        _catalogId: catalogId
      };
    }).filter(p => !p._isAdult && p.image_link && p.link && parseFloat(p.price) > 5); // Filtro anti-baneo

    return new Response(JSON.stringify({ catalogId, campaignId, totalFetched: allItems.length, filteredCount: cleaned.length, items: cleaned }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=900'
      }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message, catalogId }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

function mapCategory(raw) {
  const r = String(raw).toLowerCase();
  if (r.includes('laptop') || r.includes('computer') || r.includes('lenovo') || r.includes('pc')) return 'Electronics > Computers > Laptops';
  if (r.includes('phone') || r.includes('mobile') || r.includes('oneplus')) return 'Electronics > Communications > Telephony > Mobile Phones';
  if (r.includes('beauty') || r.includes('skincare') || r.includes('cosmetic') || r.includes('stylevana')) return 'Health & Beauty > Personal Care > Cosmetics';
  if (r.includes('home') || r.includes('bluetti') || r.includes('power station')) return 'Electronics > Power > Batteries';
  if (r.includes('fashion') || r.includes('apparel') || r.includes('clothing')) return 'Apparel & Accessories > Clothing';
  if (r.includes('software') || r.includes('sentry')) return 'Software > Computer Software > Security Software';
  return 'Shopping > General';
}
