const {chromium}=require('playwright');const SP=process.cwd();
const VPS=[[1920,1080],[1440,900],[1180,820],[1024,768],[768,1024],[390,844]];
(async()=>{const b=await chromium.launch();const issues=[];
for(const theme of ['dark','light'])for(const [w,h] of VPS){
 const ctx=await b.newContext({viewport:{width:w,height:h},colorScheme:theme});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.route(/fonts\.|wikipedia|wikidata|overpass/,r=>r.abort());
 for(const page of ['site/index.html','site/desk/index.html']){
  await pg.goto('file://'+SP+'/'+page);await pg.waitForTimeout(page.includes('desk')?3800:1800);
  const r=await pg.evaluate(()=>{const W=innerWidth,out=[];document.querySelectorAll('body *').forEach(e=>{const s=getComputedStyle(e);if(s.position==='fixed'||s.display==='none'||s.visibility==='hidden')return;const b=e.getBoundingClientRect();if(b.width&&b.right>W+2&&!e.closest('canvas,svg,[aria-hidden],.hero,.marquee,#loadingOverlay,.road-toast')){let p=e.parentElement,clipped=false;while(p&&p!==document.body){const ps=getComputedStyle(p);if(/(hidden|auto|scroll|clip)/.test(ps.overflowX)){clipped=true;break}p=p.parentElement}if(!clipped)out.push((e.id||e.className||e.tagName).toString().slice(0,50)+' r='+Math.round(b.right))}});
   return {sw:document.documentElement.scrollWidth,W,over:[...new Set(out)].slice(0,8)}});
  if(r.sw>r.W+2||r.over.length)issues.push(`${theme} ${w}x${h} ${page}: scrollWidth ${r.sw}>${r.W}; ${r.over.join(', ')}`);
  if(w===390||w===1024)await pg.screenshot({path:`${SP}/test/sw_${page.includes('desk')?'desk':'land'}_${theme}_${w}.png`,fullPage:false});
 }
 if(errs.length)issues.push(theme+' '+w+' errors: '+errs.join(';'));await ctx.close();}
console.log(issues.join('\n')||'no overflow issues');await b.close();})();
