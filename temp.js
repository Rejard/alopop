const fs = require('fs');
const code = fs.readFileSync('C:\\Users\\lemai\\AppData\\Roaming\\npm\\node_modules\\openclaw\\openclaw.mjs', 'utf8');
const wsPaths = code.match(/\/api\/[a-z_A-Z0-9\-\/]+/g) || [];
const wsPaths2 = code.match(/\/ws\/[a-z_A-Z0-9\-\/]+/g) || [];
const wsPaths3 = code.match(/\/session[a-z_A-Z0-9\-\/]+/g) || [];
const all = [...wsPaths, ...wsPaths2, ...wsPaths3];
console.log([...new Set(all)]);