import fs from 'node:fs';

const page = fs.readFileSync('app/pet365care/hospitals/page.tsx', 'utf8');
const layoutCss = fs.readFileSync('app/pet365care/pet365-layout.css', 'utf8');

const checks = [
  {
    name: 'map page calls Kakao relayout after the map is created',
    pass: page.includes('.relayout()'),
  },
  {
    name: 'map page listens for viewport changes while map view is active',
    pass: page.includes('visualViewport') && page.includes('resize'),
  },
  {
    name: 'map container does not force GPU transform',
    pass: !page.includes("transform: 'translateZ(0)'") && !page.includes("willChange: 'transform'"),
  },
  {
    name: 'map wrapper does not use Webkit mask clipping',
    pass: !page.includes('WebkitMaskImage'),
  },
  {
    name: 'pet365 scroll container does not transform all children',
    pass: !/\.pet365-content\s*\{[^}]*transform\s*:/s.test(layoutCss),
  },
];

let failed = false;
for (const check of checks) {
  if (check.pass) {
    console.log(`PASS ${check.name}`);
  } else {
    failed = true;
    console.error(`FAIL ${check.name}`);
  }
}

if (failed) process.exit(1);
