const { runPipeline } = require('./agent');

(async () => {
  const q = process.argv.slice(2).join(' ') || 'category:grocery last 24 hours over 10000';
  const out = await runPipeline(q);
  console.log(JSON.stringify(out, null, 2));
})();
