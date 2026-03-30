const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('page.tsx')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('c:/saversureV2/consumer/src/app');
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;
  // We want to replace pt-14 and pt-16 with pt-[100px] to be safe, but only in the main wrapper divs.
  // The grep showed `<div className="pt-16">` and `<div className="pt-14">` and `<div className="pt-14 relative z-0">`.
  content = content.replace(/className="pt-14"/g, 'className="pt-24"');
  content = content.replace(/className="pt-16"/g, 'className="pt-24"');
  content = content.replace(/className="pt-14 relative z-0"/g, 'className="pt-24 relative z-0"');
  content = content.replace(/className="pt-16 flex flex-col/g, 'className="pt-24 flex flex-col');
  
  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
  }
});
