const fs = require('fs');
const code = fs.readFileSync('src/components/MapCanvas.tsx', 'utf8');

let stack = [];
let i = 0;
for (; i < code.length; i++) {
  const c = code[i];
  if (c === '{' || c === '(' || c === '[') {
    stack.push(c);
  } else if (c === '}' || c === ')' || c === ']') {
    const top = stack.pop();
    if (c === '}' && top !== '{') { console.log('Mismatch at', i, top, c); break; }
    if (c === ')' && top !== '(') { console.log('Mismatch at', i, top, c); break; }
    if (c === ']' && top !== '[') { console.log('Mismatch at', i, top, c); break; }
  }
}
console.log("Stack depth:", stack.length);
