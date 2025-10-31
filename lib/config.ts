export const getPublicGoogleMapsKey = (): string => {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) {
    throw new Error('Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY');
  }
  return key;
};

export const getYouApiKey = (): string => {
  const key = process.env.YOU_API_KEY;
  if (!key) {
    throw new Error('Missing YOU_API_KEY');
  }
  return key;
};

export const getYouAgentId = (): string => {
  // RouteGenie - Route Recommendations
  const id = process.env.NEXT_PUBLIC_YOU_AGENT_ID || process.env.YOU_AGENT_ID;
  if (!id) {
    throw new Error('Missing NEXT_PUBLIC_YOU_AGENT_ID or YOU_AGENT_ID');
  }
  return id;
};

export const getRouteAltAgentId = (): string => {
  // RouteAlt - Find fun roads
  const id = process.env.NEXT_PUBLIC_YOU_ROUTE_ID || process.env.YOU_ROUTE_ID;
  if (!id) {
    throw new Error('Missing NEXT_PUBLIC_YOU_ROUTE_ID or YOU_ROUTE_ID');
  }
  return id;
};


