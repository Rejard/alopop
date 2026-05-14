import crypto from 'crypto';

type Pet365CareUser = {
  id: string;
  username: string;
  avatar_url?: string | null;
  email?: string | null;
  isAdmin?: boolean;
};

type Pet365CareHandoffPayload = {
  aud: 'pet365care';
  iss: 'alopop';
  exp: number;
  user: Pet365CareUser;
};

function getPet365CareSsoSecret() {
  return (
    process.env.ALOPOP_SSO_SECRET ||
    process.env.PET365CARE_SSO_SECRET ||
    'PET365CARE_LOCAL_SSO_SECRET'
  );
}

function base64UrlEncode(value: string) {
  return Buffer.from(value).toString('base64url');
}

function sign(value: string) {
  return crypto.createHmac('sha256', getPet365CareSsoSecret()).update(value).digest('base64url');
}

export function createPet365CareHandoffToken(user: Pet365CareUser, ttlSeconds = 60) {
  const payload: Pet365CareHandoffPayload = {
    aud: 'pet365care',
    iss: 'alopop',
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    user,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function getPet365CareUrl() {
  return process.env.PET365CARE_URL || process.env.NEXT_PUBLIC_PET365CARE_URL || 'http://localhost:3065';
}
