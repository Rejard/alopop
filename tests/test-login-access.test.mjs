import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";

const pageSource = readFileSync(new URL("../app/testlogin/page.tsx", import.meta.url), "utf8");
const routeSource = readFileSync(new URL("../app/api/auth/test-login/route.ts", import.meta.url), "utf8");

assert.match(
  pageSource,
  /fetch\(['"]\/api\/auth\/test-login['"]/,
  "Test login page should post credentials to the test-login API."
);

assert.match(
  pageSource,
  /test01[\s\S]*test10/,
  "Test login page should expose test01 through test10."
);

assert.match(
  pageSource,
  /localStorage\.setItem\(['"]alo_user['"]/,
  "Test login page should store the returned user like the normal login flow."
);

assert.match(
  routeSource,
  /const TEST_USERNAMES = \[[\s\S]*test01[\s\S]*test10[\s\S]*\]/,
  "Test login API should allow only test01 through test10."
);

assert.match(
  routeSource,
  /friendship\.upsert\([\s\S]*userId_friendId[\s\S]*status: 'ACTIVE'/,
  "Test login API should make the test accounts active friends with each other."
);

assert.match(
  routeSource,
  /password !== ['"]1234['"]/,
  "Test login API should require password 1234."
);

assert.match(
  routeSource,
  /setSessionCookie\(response, user\.id\)/,
  "Test login API should issue the normal httpOnly Alopop session cookie."
);

assert.match(
  routeSource,
  /test-login:\$\{username\}/,
  "Test login API should isolate test accounts with a deterministic non-Google id namespace."
);

assert.doesNotMatch(
  routeSource,
  /OAuth2Client|GOOGLE_CLIENT_SECRET|accounts\.google\.com/,
  "Test login API should not depend on Google OAuth."
);
