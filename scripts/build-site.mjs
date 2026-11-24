import {cp, mkdir, readdir, readFile, writeFile} from 'node:fs/promises';

const output = 'dist';
const production = process.env.VERCEL_ENV === 'production';
const endpoints = {
  primary: process.env.STAGING_PRIMARY_URL || '',
  secondary: process.env.STAGING_SECONDARY_URL || ''
};
const pattern = /https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec/g;
const secondary = new Set(['index.html','dashboard.html','careers.html']);
const files = (await readdir('.')).filter(name => /\.(html|js|css|png)$/.test(name) || ['manifest.json','app-manifest.json','.well-known'].includes(name));
const pages = new Map();
const live = new Set();
for (const name of files.filter(name => name.endsWith('.html'))) {
  const html = await readFile(name,'utf8');
  pages.set(name,html);
  for (const url of html.match(pattern) || []) live.add(url);
}
if (!production) {
  for (const url of Object.values(endpoints).filter(Boolean)) {
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url) || live.has(url))
      throw Error('Staging requires a separate Apps Script deployment');
  }
  if (endpoints.primary && endpoints.primary === endpoints.secondary) throw Error('Use separate staging deployments');
}
await mkdir(output,{recursive:true});
for (const name of files) {
  if (production || !pages.has(name)) {
    await cp(name,output+'/'+name,{recursive:true});
    continue;
  }
  const service = secondary.has(name) ? 'secondary' : 'primary';
  const url = endpoints[service];
  let html = pages.get(name).replace(pattern,url || '/preview-status.json');
  const policy = "connect-src 'self' " + (url ? url + " https://script.googleusercontent.com" : "") + "; form-action 'self'";
  html = html.replace(/<head\b[^>]*>/i, head => head + '<meta http-equiv="Content-Security-Policy" content="'+policy+'">');
  if (!url) html = html.replace(/<body\b[^>]*>/i, body => body + '<aside dir="rtl" style="padding:8px;text-align:center;background:#fff4cb;color:#382e0b">معاينة الواجهة فقط. الاتصال بقاعدة بيانات الاختبار غير مفعّل.</aside>');
  await writeFile(output+'/'+name,html);
}
if (!production) await writeFile(output+'/preview-status.json',JSON.stringify({success:false,error:'قاعدة بيانات الاختبار غير متصلة'}));
