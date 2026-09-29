// Turns the single-file production build (dist/index.html) into page content for a claude.ai Artifact:
// the host wraps it in its own doctype/head/body, so we emit <title>, <style>, the app markup and the
// inline module script only. Usage: npm run build:artifact  ->  dist/sepak-takraw.html
import fs from 'node:fs';
const src = fs.readFileSync('dist/index.html', 'utf8');
const pick = (re, what) => { const m = src.match(re); if (!m) throw new Error('artifact build: could not find ' + what); return m; };
const title = pick(/<title>[\s\S]*?<\/title>/, 'title')[0];
const styles = [...src.matchAll(/<style[^>]*>[\s\S]*?<\/style>/g)].map((m) => m[0]);
const scripts = [...src.matchAll(/<script[^>]*>[\s\S]*?<\/script>/g)].map((m) => m[0].replace(/\scrossorigin(="[^"]*")?/, ''));
const body = pick(/<body[^>]*>([\s\S]*?)<\/body>/, 'body')[1].replace(/<script[\s\S]*?<\/script>/g, '').trim();
if (!scripts.length || !styles.length) throw new Error('artifact build: expected inline script and style');
const out = [title, '<meta name="theme-color" content="#050813">', ...styles, body, ...scripts].join('\n');
fs.writeFileSync('dist/sepak-takraw.html', out);
console.log(`dist/sepak-takraw.html  ${(out.length / 1024).toFixed(0)} kB  (title at byte ${out.indexOf('<title>')})`);
