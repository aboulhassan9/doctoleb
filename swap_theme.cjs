const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        if (file.includes('node_modules')) return;
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(fullPath));
        } else {
            if (fullPath.endsWith('.jsx') || fullPath.endsWith('.js')) {
                results.push(fullPath);
            }
        }
    });
    return results;
}

const files = walk(__dirname + '/src');

const replacements = [
    [/bg-blue-50/g, 'bg-primary/5'],
    [/bg-blue-100/g, 'bg-primary/10'],
    [/bg-blue-200/g, 'bg-primary/20'],
    [/bg-blue-500/g, 'bg-primary'],
    [/bg-blue-600/g, 'bg-primary-hover'],
    [/bg-blue-700/g, 'text-primary'], // Usually used for backgrounds, but we'll map to hover or primary-hover if needed. Wait. Let's be exact.

    // Exact component maps:
    [/bg-blue-(?:50|100) text-blue-(?:600|700)/g, 'bg-primary/10 text-primary'],
    [/bg-emerald-(?:50|100) text-emerald-(?:600|700)/g, 'bg-success/10 text-success'],
    [/bg-amber-(?:50|100) text-amber-(?:600|700)/g, 'bg-warning/10 text-warning'],
    [/bg-rose-(?:50|100) text-rose-(?:600|700)/g, 'bg-critical/10 text-critical'],
    [/bg-red-(?:50|100) text-red-(?:600|700)/g, 'bg-critical/10 text-critical'],
    [/bg-indigo-(?:50|100) text-indigo-(?:600|700)/g, 'bg-secondary/10 text-secondary'],
    [/bg-purple-(?:50|100) text-purple-(?:600|700)/g, 'bg-secondary/10 text-secondary'],

    // Text colors
    [/text-blue-(?:500|600|700)/g, 'text-primary'],
    [/text-emerald-(?:500|600|700)/g, 'text-success'],
    [/text-amber-(?:500|600|700)/g, 'text-warning'],
    [/text-rose-(?:500|600|700)/g, 'text-critical'],
    [/text-red-(?:500|600|700)/g, 'text-critical'],

    // Border colors
    [/border-blue-500/g, 'border-primary'],
    [/border-emerald-500/g, 'border-success'],
    [/border-amber-500/g, 'border-warning'],
    [/border-rose-500/g, 'border-critical'],
    [/border-red-500/g, 'border-critical'],

    [/border-blue-[12]00/g, 'border-primary/20'],
    [/border-emerald-[12]00/g, 'border-success/20'],
    [/border-amber-[12]00/g, 'border-warning/20'],
    
    // Loose backgrounds
    [/bg-blue-(?:50|100)/g, 'bg-primary/10'],
    [/bg-emerald-(?:50|100)/g, 'bg-success/10'],
    [/bg-amber-(?:50|100)/g, 'bg-warning/10'],
    [/bg-rose-(?:50|100)/g, 'bg-critical/10'],
    
    // Badges / pills specific fixes
    [/'bg-blue-100', 'text-blue-700'/g, "'bg-primary/10', 'text-primary'"],
    [/'bg-emerald-100', 'text-emerald-700'/g, "'bg-success/10', 'text-success'"]
];

let changedFiles = 0;

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    for (const [regex, replacement] of replacements) {
        content = content.replace(regex, replacement);
    }

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        changedFiles++;
        console.log('Updated:', path.relative(__dirname, file));
    }
}

console.log(`\nSuccessfully updated ${changedFiles} files to Clinical Medical Themes!`);
