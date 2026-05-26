export async function onRequest(context) {
  const SID = context.env.IMPACT_SID;
  const TOKEN = context.env.IMPACT_TOKEN;

  if (!SID || !TOKEN) {
    return new Response(JSON.stringify({ error: 'Missing credentials' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const credentials = btoa(`${SID}:${TOKEN}`);
  let allCampaigns = [];
  let page = 1;
  let totalPages = 1;

  try {
    while (page <= totalPages) {
      const url = `https://api.impact.com/Mediapartners/${SID}/Campaigns?Page=${page}&PageSize=100`;
      const res = await fetch(url, {
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Accept': 'application/json'
        }
      });

      if (!res.ok) throw new Error(`Impact API error: ${res.status}`);

      const data = await res.json();
      totalPages = data['@numpages'] || 1;
      const campaigns = data.Campaigns || [];
      allCampaigns = allCampaigns.concat(campaigns);
      page++;
    }

    // Filter only active and map to what the frontend needs
    const active = allCampaigns
      .filter(c => c.ContractStatus === 'Active')
      .map(c => ({
        id: c.CampaignId,
        title: c.CampaignName,
        brand: c.AdvertiserName,
        desc: c.CampaignDescription || '',
        link: c.TrackingLink,
        logo: c.CampaignLogoUri || '',
        url: c.CampaignUrl || ''
      }));

    return new Response(JSON.stringify(active), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600'
      }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
