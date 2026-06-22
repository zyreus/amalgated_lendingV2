import{j as e,ak as C,v as E,r as l,al as b,n as R}from"./vendor-CABphWFP.js";import{a as r}from"./AdminUi-DdbgSkkv.js";import{C as $,a as F}from"./corporatePrintHeaderHtml-C-paRYIb.js";import{a as I}from"./amalgated-lending-logo-B7He0mzn.js";function O({logoSrc:i="/amalgated-lending-logo.png",className:a=""}){return e.jsxs("header",{className:`corp-letterhead w-full ${a||""}`,children:[e.jsx("div",{className:"flex items-center",children:e.jsxs("div",{className:"flex min-w-0 items-center gap-3",children:[e.jsx("div",{className:"flex shrink-0 items-center justify-center rounded-full border-[3px] border-[#b91c1c] bg-white p-1",style:{width:56,height:56},children:e.jsx("img",{src:i,alt:"",className:"h-11 w-11 object-contain",width:44,height:44})}),e.jsxs("div",{className:"min-w-0",children:[e.jsx("p",{className:"text-[15px] font-extrabold uppercase leading-tight tracking-wide text-black",children:$}),e.jsxs("p",{className:"mt-1 font-serif text-sm italic leading-snug text-black",children:["“",F,"”"]})]})]})}),e.jsx("div",{className:"mt-3 h-px w-full bg-black","aria-hidden":!0})]})}function j(i){if(!i)return"";const a=new Date(i);return Number.isNaN(a.getTime())?"":a.toISOString().slice(0,10)}function M({className:i}){return e.jsx("svg",{className:i,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2","aria-hidden":!0,children:e.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",d:"M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"})})}function N(i){if(!i)return"—";const a=new Date(i);return Number.isNaN(a.getTime())?"—":a.toLocaleString(void 0,{dateStyle:"long",timeStyle:"short"})}function y(i){if(!i)return"—";const a=new Date(i);return Number.isNaN(a.getTime())?"—":a.toLocaleDateString(void 0,{dateStyle:"long"})}const u="financial-report-print-page-size";function H(){if(document.getElementById(u))return;const i=document.createElement("style");i.id=u,i.textContent="@media print { @page { size: A4 landscape; margin: 12mm; } }",document.head.appendChild(i)}function B(){document.getElementById(u)?.remove()}function J(){const{showToast:i}=C(),{user:a}=E(),[o,v]=l.useState(()=>j(new Date(Date.now()-90*864e5))),[c,w]=l.useState(()=>j(new Date)),[n,S]=l.useState(null),[s,k]=l.useState(null),[m,f]=l.useState(!0),[h,g]=l.useState(!1),[L,P]=l.useState(""),x=async()=>{f(!0);try{const t=new URLSearchParams;o&&t.set("from",o),c&&t.set("to",c);const p=await b(`/reports/summary?${t}`);S(p.summary),k(p.period)}catch(t){i(t.message,"error")}finally{f(!1)}};l.useEffect(()=>{x()},[]);const d=t=>typeof t=="number"?`₱${t.toLocaleString(void 0,{maximumFractionDigits:2})}`:"—",A=a?.name?.trim()||a?.username?.trim()||a?.email?.trim()||"—",_=Array.isArray(a?.roles)&&a.roles.length>0?a.roles.map(t=>t.name||t.slug).join(", "):a?.role?String(a.role).replace(/_/g," "):"—",D=m||h||!o||!c||!n,T=async()=>{if(!o||!c){i("Select both from and to dates before printing.","error");return}if(!n){i("Load the summary first using Apply Date Range.","error");return}g(!0);try{await b("/reports/print-log",{method:"POST",body:JSON.stringify({from:o,to:c})}),R.flushSync(()=>{P(new Date().toLocaleString(void 0,{dateStyle:"long",timeStyle:"short"}))}),H();const t=()=>{B(),window.removeEventListener("afterprint",t)};window.addEventListener("afterprint",t),requestAnimationFrame(()=>{try{window.print()}catch{t()}})}catch(t){i(t.message||"Could not authorize print. Please try again.","error")}finally{g(!1)}},z=n&&!n.applications_submitted&&!n.loans_disbursed&&!Number(n.principal_disbursed)&&!Number(n.collections);return e.jsxs("div",{className:"w-full min-w-0 space-y-8",children:[e.jsxs("div",{children:[e.jsx("h1",{className:r.pageTitle,children:"Reports"}),e.jsx("p",{className:r.pageSubtitle,children:"Financial summary for the selected period. Use print for a controlled, audit-logged paper copy — no file downloads."})]}),e.jsxs("div",{className:`flex flex-wrap items-end gap-3 p-4 sm:p-6 ${r.cardNoHover}`,children:[e.jsxs("div",{children:[e.jsx("label",{className:`block text-xs font-medium ${r.textMuted}`,htmlFor:"rep-from",children:"From"}),e.jsx("input",{id:"rep-from",type:"date",value:o,onChange:t=>v(t.target.value),className:`mt-1 ${r.input}`})]}),e.jsxs("div",{children:[e.jsx("label",{className:`block text-xs font-medium ${r.textMuted}`,htmlFor:"rep-to",children:"To"}),e.jsx("input",{id:"rep-to",type:"date",value:c,onChange:t=>w(t.target.value),className:`mt-1 ${r.input}`})]}),e.jsx("button",{type:"button",onClick:x,disabled:m,className:r.btnPrimary,children:m?"Loading…":"Apply Date Range"}),e.jsxs("button",{type:"button",onClick:T,disabled:D,title:"Print current financial summary",className:`${r.btnSecondary} inline-flex min-h-[2.5rem] items-center justify-center gap-2 sm:min-w-[10rem]`,children:[e.jsx(M,{className:"h-4 w-4 shrink-0 opacity-80"}),h?"Preparing…":"Print Report"]})]}),s&&e.jsxs("p",{className:`text-xs ${r.textMuted}`,children:["Period: ",new Date(s.from).toLocaleString()," — ",new Date(s.to).toLocaleString()]}),z&&!m&&e.jsx("p",{className:"rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100",children:"No activity in this range — the printed report will still list zeros for your records."}),m?e.jsx("div",{className:"grid gap-4 sm:grid-cols-2 xl:grid-cols-4",children:[1,2,3,4].map(t=>e.jsxs("div",{className:`${r.cardNoHover} animate-pulse p-6`,children:[e.jsx("div",{className:"h-3 w-28 rounded bg-gray-200 dark:bg-[#1F2937]"}),e.jsx("div",{className:"mt-4 h-8 w-24 rounded bg-gray-200 dark:bg-[#1F2937]"})]},t))}):e.jsx("div",{className:"grid gap-4 sm:grid-cols-2 xl:grid-cols-4",children:[["Applications submitted",n?.applications_submitted],["Loans disbursed",n?.loans_disbursed],["Principal disbursed",d(n?.principal_disbursed)],["Collections",d(n?.collections)]].map(([t,p])=>e.jsxs("div",{className:`${r.card} p-6`,children:[e.jsx("p",{className:`text-sm font-medium ${r.textMuted}`,children:t}),e.jsx("p",{className:"mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100",children:p??"—"})]},t))}),e.jsxs("div",{id:"financial-report-print-root",className:"print-only-amalg financial-print-doc",children:[e.jsx("div",{className:"financial-print-watermark","aria-hidden":!0,children:"CONFIDENTIAL"}),e.jsxs("header",{className:"financial-print-header",children:[e.jsx("div",{className:"financial-print-corp",children:e.jsx(O,{logoSrc:I})}),e.jsx("h2",{className:"financial-print-title",children:"Financial summary report"}),e.jsxs("dl",{className:"financial-print-meta",children:[e.jsxs("div",{children:[e.jsx("dt",{children:"Period covered"}),e.jsx("dd",{children:s?`${y(s.from)} – ${y(s.to)}`:"—"})]}),e.jsxs("div",{children:[e.jsx("dt",{children:"Generated"}),e.jsx("dd",{children:L||"—"})]}),e.jsxs("div",{children:[e.jsx("dt",{children:"Printed by"}),e.jsx("dd",{children:A})]}),e.jsxs("div",{children:[e.jsx("dt",{children:"Role / capacity"}),e.jsx("dd",{children:_})]})]})]}),e.jsx("section",{className:"financial-print-cards","aria-label":"Summary metrics",children:[["Applications submitted",n?.applications_submitted],["Loans disbursed",n?.loans_disbursed],["Principal disbursed",d(n?.principal_disbursed)],["Collections",d(n?.collections)]].map(([t,p])=>e.jsxs("div",{className:"financial-print-card",children:[e.jsx("p",{className:"financial-print-card-label",children:t}),e.jsx("p",{className:"financial-print-card-value",children:p??"—"})]},String(t)))}),e.jsxs("table",{className:"financial-print-table",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{scope:"col",children:"Metric"}),e.jsx("th",{scope:"col",className:"financial-print-num",children:"Value"})]})}),e.jsxs("tbody",{children:[e.jsxs("tr",{children:[e.jsx("td",{children:"Applications submitted"}),e.jsx("td",{className:"financial-print-num",children:n?.applications_submitted??"—"})]}),e.jsxs("tr",{children:[e.jsx("td",{children:"Loans disbursed"}),e.jsx("td",{className:"financial-print-num",children:n?.loans_disbursed??"—"})]}),e.jsxs("tr",{children:[e.jsx("td",{children:"Principal disbursed"}),e.jsx("td",{className:"financial-print-num",children:d(n?.principal_disbursed)})]}),e.jsxs("tr",{children:[e.jsx("td",{children:"Total collections"}),e.jsx("td",{className:"financial-print-num",children:d(n?.collections)})]})]}),e.jsx("tfoot",{children:e.jsx("tr",{children:e.jsxs("td",{colSpan:2,className:"financial-print-tfoot",children:[e.jsxs("p",{children:[e.jsx("strong",{children:"Confidential — internal use only."})," System-generated from live data for the period"," ",s?`${N(s.from)} through ${N(s.to)}`:"shown above","."]}),e.jsx("p",{className:"financial-print-tfoot-sub",children:"This document is not a negotiable instrument. Retain according to your records retention policy. For page numbers, use your browser's print option to include headers and footers."}),e.jsxs("div",{className:"financial-print-signature",children:[e.jsx("p",{className:"financial-print-signature-label",children:"Authorized signature (optional)"}),e.jsx("div",{className:"financial-print-signature-line"})]})]})})})]})]}),e.jsx("style",{children:`
        .financial-print-doc {
          position: relative;
          box-sizing: border-box;
          padding: 10mm 12mm 12mm;
          font-family: Inter, system-ui, sans-serif;
          font-size: 11pt;
          line-height: 1.45;
          color: #000;
          background: #fff;
        }
        .financial-print-watermark {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 48pt;
          font-weight: 800;
          letter-spacing: 0.08em;
          color: #000;
          opacity: 0.05;
          transform: rotate(-32deg);
          pointer-events: none;
          user-select: none;
        }
        .financial-print-header {
          padding-bottom: 10pt;
          margin-bottom: 14pt;
        }
        .financial-print-corp {
          margin-bottom: 10pt;
        }
        .financial-print-title {
          margin: 0 0 10pt;
          font-size: 14pt;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #7f1d1d;
        }
        .financial-print-meta {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8pt 16pt;
          margin: 0;
        }
        .financial-print-meta dt {
          margin: 0;
          font-size: 8pt;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #444;
        }
        .financial-print-meta dd {
          margin: 2pt 0 0;
          font-size: 10pt;
          font-weight: 600;
        }
        .financial-print-cards {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10pt;
          margin: 0 0 14pt;
          break-inside: avoid;
        }
        .financial-print-card {
          border: 1px solid #000;
          border-radius: 4pt;
          padding: 10pt 8pt;
          background: #fafafa;
        }
        .financial-print-card-label {
          margin: 0 0 6pt;
          font-size: 8pt;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #444;
        }
        .financial-print-card-value {
          margin: 0;
          font-size: 15pt;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
        }
        .financial-print-table {
          width: 100%;
          border-collapse: collapse;
          break-inside: auto;
        }
        .financial-print-table thead {
          display: table-header-group;
        }
        .financial-print-table tfoot {
          display: table-footer-group;
        }
        .financial-print-table th,
        .financial-print-table td {
          border: 1px solid #000;
          padding: 8pt 10pt;
          vertical-align: top;
        }
        .financial-print-table th {
          background: #f0f0f0;
          text-align: left;
          font-size: 9pt;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .financial-print-num {
          text-align: right;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }
        .financial-print-tfoot {
          font-size: 9pt;
          line-height: 1.4;
          background: #fafafa;
        }
        .financial-print-tfoot p {
          margin: 0 0 6pt;
        }
        .financial-print-tfoot-sub {
          font-size: 8pt;
          color: #333;
        }
        .financial-print-signature {
          margin-top: 12pt;
          break-inside: avoid;
        }
        .financial-print-signature-label {
          margin: 0 0 4pt;
          font-size: 8pt;
          color: #333;
        }
        .financial-print-signature-line {
          max-width: 220pt;
          border-bottom: 1px solid #000;
          height: 28pt;
        }
        tr {
          break-inside: avoid;
          break-after: auto;
        }
      `})]})}export{J as default};
