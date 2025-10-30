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
  const id = process.env.YOU_AGENT_ID;
  if (!id) {
    throw new Error('Missing YOU_AGENT_ID');
  }
  return id;
};


