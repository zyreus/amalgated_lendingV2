function c(e){if(e==null)return"";const t=String(e);return t.includes('"')||t.includes(",")||t.includes(`
`)?`"${t.replace(/"/g,'""')}"`:t}function s(e,t,a){const r=[];r.push(t.map(c).join(",")),a.forEach(d=>{r.push(d.map(c).join(","))});const n=new Blob([r.join(`
`)],{type:"text/csv;charset=utf-8;"}),i=URL.createObjectURL(n),o=document.createElement("a");o.href=i,o.download=e,document.body.appendChild(o),o.click(),document.body.removeChild(o),URL.revokeObjectURL(i)}function p(e,t,a,r){const n=window.open("","_blank","noopener,noreferrer,width=1000,height=800");if(!n)return!1;const i=a.map(d=>`<th>${d}</th>`).join(""),o=r.map(d=>`<tr>${d.map(l=>`<td>${String(l??"")}</td>`).join("")}</tr>`).join("");return n.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${e}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
      h1 { margin: 0 0 6px; font-size: 22px; }
      p { margin: 0 0 16px; color: #444; font-size: 12px; }
      table { border-collapse: collapse; width: 100%; font-size: 12px; }
      th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
      th { background: #f4f4f4; }
      .meta { margin-top: 16px; font-size: 11px; color: #666; }
    </style>
  </head>
  <body>
    <h1>${e}</h1>
    <p>${t}</p>
    <table>
      <thead><tr>${i}</tr></thead>
      <tbody>${o}</tbody>
    </table>
    <div class="meta">Generated: ${new Date().toLocaleString()}</div>
  </body>
</html>`),n.document.close(),n.focus(),n.print(),!0}export{s as d,p as o};
