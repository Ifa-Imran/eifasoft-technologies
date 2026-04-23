const fs = require('fs');
const raw = fs.readFileSync('C:/Users/imran/.qoder/cache/projects/KAIRODAO-157a1cfd/agent-tools/bbb92b72/534f1d46.txt', 'utf8');
const data = JSON.parse(raw);
const arr = Array.isArray(data) ? data : [data];
for (const svc of arr) {
  if (svc.service === 'backend-1') {
    const entries = svc.entries || [];
    console.log(`Total backend entries: ${entries.length}`);
    entries.slice(-40).forEach(e => {
      const ts = (e.timestamp || '').slice(11, 19);
      console.log(ts, e.line);
    });
  }
}
