
const fs = require('fs');
let content = fs.readFileSync('src/app/page.tsx', 'utf8');

// Use string replaceAll to avoid regex slash escaping issues
content = content.replaceAll('bg-[#030712]', 'bg-[#010a05]');
content = content.replaceAll('bg-[#0b0f19]', 'bg-[#020e07]');
content = content.replaceAll('bg-slate-950', 'bg-[#010a05]');
content = content.replaceAll('bg-slate-900', 'bg-[#020e07]');
content = content.replaceAll('bg-[#02050e]', 'bg-[#010603]');
content = content.replaceAll('bg-[#0a0f1d]', 'bg-[#020a05]');
content = content.replaceAll('bg-[#050810]', 'bg-[#010804]');

content = content.replaceAll('indigo-', 'emerald-');
content = content.replaceAll('teal-', 'emerald-');
content = content.replaceAll('cyan-', 'emerald-');
content = content.replaceAll('blue-', 'emerald-');

// Convert solid backgrounds to subtle dark green (except the 'bg-emerald-500/10' ones which become very subtle)
content = content.replaceAll('bg-emerald-500', 'bg-emerald-800');
content = content.replaceAll('bg-emerald-400', 'bg-emerald-700');
content = content.replaceAll('border-emerald-500', 'border-emerald-800/50');
content = content.replaceAll('border-emerald-400', 'border-emerald-700/50');

content = content.replaceAll('hover:bg-emerald-400', 'hover:bg-emerald-700');
content = content.replaceAll('from-emerald-500', 'from-emerald-900');
content = content.replaceAll('from-emerald-400', 'from-emerald-800');
content = content.replaceAll('to-emerald-500', 'to-emerald-900');
content = content.replaceAll('to-emerald-400', 'to-emerald-800');
content = content.replaceAll('via-emerald-500', 'via-emerald-900');
content = content.replaceAll('via-emerald-400', 'via-emerald-800');

// blobs
content = content.replaceAll('from-emerald-800/10', 'from-emerald-900/20');
content = content.replaceAll('from-emerald-800/8', 'from-emerald-900/15');
content = content.replaceAll('from-emerald-800/6', 'from-emerald-900/15');

content = content.replaceAll('shadow-emerald-500', 'shadow-emerald-900/30');

// text colors
content = content.replaceAll('text-gray-100', 'text-emerald-50/90');
content = content.replaceAll('text-gray-400', 'text-emerald-200/50');
content = content.replaceAll('text-gray-500', 'text-emerald-600/60');
content = content.replaceAll('text-gray-300', 'text-emerald-100/70');
content = content.replaceAll('text-white', 'text-emerald-50');

fs.writeFileSync('src/app/page.tsx', content);
console.log('Colors replaced successfully!');

