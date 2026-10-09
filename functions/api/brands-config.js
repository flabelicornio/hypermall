/**
 * Configuración de API Keys por marca
 * En Cloudflare Pages > Settings > Environment Variables agrega:
 * IMPACT_SID = tu SID global (IRVZiy...)
 * IMPACT_TOKEN = tu TOKEN global
 * 
 * Y para cada marca que te da API key propia (opcional):
 * BRAND_9634_SID = SID de Lenovo
 * BRAND_9634_TOKEN = TOKEN de Lenovo
 * BRAND_12108_APIKEY = IRVZiy...:emHK... (formato user:pass en una sola var)
 * 
 * Este endpoint te lista qué marcas tienen key custom configurada
 */
export async function onRequest(context) {
  const env = context.env;
  const globalSet = !!(env.IMPACT_SID && env.IMPACT_TOKEN);
  
  const brandKeys = [];
  for (const key of Object.keys(env)) {
    if (key.startsWith('BRAND_') && (key.endsWith('_SID') || key.endsWith('_TOKEN') || key.endsWith('_APIKEY'))) {
      const parts = key.split('_');
      const campaignId = parts[1];
      if (!brandKeys.find(b => b.campaignId === campaignId)) {
        brandKeys.push({
          campaignId,
          hasSid: !!env[`BRAND_${campaignId}_SID`] || !!env[`BRAND_${campaignId}_APIKEY`],
          hasToken: !!env[`BRAND_${campaignId}_TOKEN`] || !!env[`BRAND_${campaignId}_APIKEY`],
          envVars: [`BRAND_${campaignId}_SID`, `BRAND_${campaignId}_TOKEN`, `BRAND_${campaignId}_APIKEY`].filter(k => !!env[k])
        });
      }
    }
  }

  return new Response(JSON.stringify({
    globalApiConfigured: globalSet,
    customBrandKeys: brandKeys,
    totalCustomBrands: brandKeys.length,
    instructions: "Agrega más en Cloudflare Pages > Settings > Variables: BRAND_<CampaignId>_SID y BRAND_<CampaignId>_TOKEN"
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
