export async function onRequest(context) {
  const SID = context.env.IMPACT_SID;
  const TOKEN = context.env.IMPACT_TOKEN;

  if (!SID || !TOKEN) {
    return new Response(JSON.stringify({ error: 'Missing IMPACT_SID / IMPACT_TOKEN' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  const credentials = btoa(`${SID}:${TOKEN}`);
  let allCatalogs = [];
  let page = 1;
  let totalPages = 1;

  try {
    while (page <= totalPages) {
      const url = `https://api.impact.com/Mediapartners/${SID}/Catalogs?Page=${page}&PageSize=100`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Basic ${credentials}`, 'Accept': 'application/json' }
      });
      if (!res.ok) throw new Error(`Catalogs API error: ${res.status}`);
      const data = await res.json();
      totalPages = data['@numpages'] || 1;
      const catalogs = data.Catalogs || data['Catalogs'] || [];
      allCatalogs = allCatalogs.concat(catalogs);
      page++;
    }

    // Mapeo limpio para el frontend
    const cleaned = allCatalogs.map(c => ({
      catalogId: c.CatalogId || c.Id,
      catalogName: c.CatalogName || c.Name,
      campaignId: c.CampaignId,
      campaignName: c.CampaignName || '',
      productCount: c.NumberOfProducts || c.Products || 0,
      lastUpdated: c.LastUpdated || c['Last Upload'] || ''
    })).sort((a,b) => b.productCount - a.productCount);

    return new Response(JSON.stringify(cleaned), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=1800'
      }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
