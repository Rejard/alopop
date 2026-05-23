import { existsSync, readFileSync } from "node:fs";
import { strict as assert } from "node:assert";

const pageSource = readFileSync(new URL("../app/pet365care/social/page.tsx", import.meta.url), "utf8");
const postsRouteSource = readFileSync(new URL("../app/api/pet365care/social/posts/route.ts", import.meta.url), "utf8");

assert.match(
  postsRouteSource,
  /const sort = searchParams\.get\('sort'\)/,
  "Posts API should accept a sort query parameter."
);

assert.match(
  postsRouteSource,
  /sort === 'hot'/,
  "Posts API should support hot sorting."
);

assert.match(
  postsRouteSource,
  /commentCount \* 3[\s\S]*likeCount \* 2/,
  "Hot sorting should weight comments and likes."
);

assert.match(
  pageSource,
  /const \[hotPost, setHotPost\] = useState<Post \| null>\(null\)/,
  "Social page should keep a dedicated hot post state for the hero."
);

assert.match(
  pageSource,
  /sort", "hot"[\s\S]*limit", "1"/,
  "Social page hero should fetch the top hot post."
);

assert.doesNotMatch(
  pageSource,
  /토요일 아침 대형견 산책 모임/,
  "Hero should not be a hard-coded walking meetup."
);

for (const category of ["daily", "walk", "health", "funny", "local", "mate"]) {
  const assetPath = new URL(`../public/pet365care/social-fallbacks/${category}.svg`, import.meta.url);
  assert.ok(existsSync(assetPath), `Missing fallback illustration for ${category}.`);
  assert.match(
    pageSource,
    new RegExp(`${category}: "/pet365care/social-fallbacks/${category}\\.svg"`),
    `Social page should map ${category} to its fallback illustration.`
  );
}
