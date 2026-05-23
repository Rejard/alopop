import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";

const loginSource = readFileSync(new URL("../app/login/page.tsx", import.meta.url), "utf8");
const inviteSource = readFileSync(new URL("../app/invite/[code]/page.tsx", import.meta.url), "utf8");
const routeSource = readFileSync(new URL("../app/api/auth/google/route.ts", import.meta.url), "utf8");

for (const [name, source] of [
  ["login page", loginSource],
  ["invite page", inviteSource],
]) {
  assert.doesNotMatch(
    source,
    /useGoogleLogin|GoogleOAuthProvider|flow:\s*['"]implicit['"]|ux_mode:\s*['"]popup['"]/,
    `${name} should not use popup-based Google OAuth.`
  );

  assert.match(
    source,
    /accounts\.google\.com\/o\/oauth2\/v2\/auth/,
    `${name} should navigate the browser to Google's redirect authorization endpoint.`
  );

  assert.match(
    source,
    /const GOOGLE_OAUTH_STATE_KEY = ['"]alo_google_oauth_state['"][\s\S]*sessionStorage\.setItem\(GOOGLE_OAUTH_STATE_KEY/,
    `${name} should store an OAuth state value before redirecting.`
  );

  assert.doesNotMatch(
    source,
    /window\.location\.origin|NEXT_PUBLIC_APP_URL/,
    `${name} should not derive the Google redirect URI from local, preview, or environment origins.`
  );

  assert.match(
    source,
    /const GOOGLE_REDIRECT_URI = ['"]https:\/\/alopop\.alonics\.com\/login['"]/,
    `${name} should always target the production Google redirect URI.`
  );
}

assert.match(
  loginSource,
  /searchParams\.get\(['"]code['"]\)/,
  "Login page should consume the returned authorization code."
);

assert.doesNotMatch(
  inviteSource,
  /searchParams\.get\(['"]code['"]\)/,
  "Invite page should not use dynamic invite URLs as Google redirect callbacks."
);

assert.match(
  inviteSource,
  /return GOOGLE_REDIRECT_URI/,
  "Invite page should use the fixed production login page as the Google redirect URI."
);

assert.match(
  loginSource,
  /parsedState\.inviteCode[\s\S]{0,500}\/api\/friends/,
  "Login page should complete invite friend linking after redirect login."
);

assert.match(
  routeSource,
  /const\s+\{\s*credential,\s*code,\s*redirectUri\s*\}/,
  "Google auth API should accept an authorization code and redirect URI."
);

assert.match(
  routeSource,
  /GOOGLE_CLIENT_SECRET/,
  "Google auth API should use a server-side Google client secret for auth-code exchange."
);

assert.match(
  routeSource,
  /getToken\(/,
  "Google auth API should exchange the authorization code for tokens server-side."
);
