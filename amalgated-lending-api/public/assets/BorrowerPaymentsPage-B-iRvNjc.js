import{z as B,r as m,j as e,ae as L,aY as C,b1 as M,ay as E,aL as U}from"./vendor-YyKrDgRZ.js";import{a as y,p as k,f as i,e as g}from"./formatters-CfNdLP9c.js";import{c as z}from"./corporatePrintHeaderHtml-C-paRYIb.js";import{a as t}from"./AdminUi-Bi0HwG3H.js";import{S as R}from"./index-DxD2R_DS.js";function $(a){return`INV-${String(a?.id||"").padStart(6,"0")}`}function F(a){return a?.reference_number||a?.reference_no||`PAY-${a?.id||"N/A"}`}function D(a,s){return a?.borrower_name||a?.borrower?.name||s?.name||s?.full_name||"Borrower"}function S(a){return a?.processed_by_name||a?.encoder_name||a?.recorded_by_user?.name||a?.confirmed_by_user?.name||""}function v(a){return String(a?.processed_by_role||a?.encoder_role||a?.receipt_issued_role||"").trim().replace(/[_-]+/g," ").replace(/\b\w/g,n=>n.toUpperCase())}function _(a){return String(a?.official_receipt_number||a?.or_number||"").trim()}function A(a){return String(a?.acknowledgement_receipt_number||a?.ar_number||"").trim()}function I(a,s){const n=$(a),o=y(a?.paid_at||a?.due_date),d=i(a?.amount_paid||0),l=i(a?.amount_due||0),w=i(a?.penalty_amount||0),x=F(a),f=D(a,s),p=s?.email||a?.borrower_email||"N/A",u=_(a),j=A(a),h=S(a)||"Authorized representative",r=v(a),c=typeof window<"u"?new URL("/amalgated-lending-logo.png",window.location.origin).toString():"/amalgated-lending-logo.png";return`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${n}</title>
  <style>
    * { box-sizing: border-box; }
    @page { size: A4; margin: 14mm; }
    body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"; padding: 28px; color: #0f172a; background: #ffffff; }
    .wrap { max-width: 820px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 14px; padding: 24px; }
    .topbar { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding-bottom: 14px; border-bottom: 1px solid #e5e7eb; margin-top: 4px; }
    .invmeta { text-align: right; }
    .invmeta .label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; }
    .invmeta .value { margin-top: 2px; font-size: 15px; font-weight: 800; }
    .badge { display: inline-flex; align-items: center; justify-content: center; margin-top: 8px; padding: 5px 10px; border-radius: 999px; border: 1px solid #fecaca; background: #fff1f2; color: #b91c1c; font-size: 11px; font-weight: 700; }
    .section { margin-top: 16px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px; background: #ffffff; }
    .card h2 { margin: 0 0 10px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.10em; color: #64748b; }
    .row { display: flex; justify-content: space-between; gap: 10px; margin: 6px 0; font-size: 13px; }
    .row strong { color: #0f172a; }
    .muted { color: #64748b; }
    table { width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 12px; overflow: hidden; border: 1px solid #e5e7eb; border-radius: 12px; }
    th, td { padding: 11px 12px; font-size: 13px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f8fafc; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #475569; }
    tr:last-child td { border-bottom: 0; }
    td.amount { text-align: right; font-variant-numeric: tabular-nums; }
    .totals { margin-top: 14px; display: grid; grid-template-columns: 1fr; gap: 8px; }
    .totalrow { display: flex; justify-content: space-between; gap: 10px; padding: 10px 12px; border: 1px solid #e5e7eb; border-radius: 12px; background: #f8fafc; }
    .totalrow .k { color: #475569; font-weight: 700; }
    .totalrow .v { font-weight: 900; }
    .footer { margin-top: 18px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #64748b; display: flex; justify-content: space-between; gap: 12px; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
    @media print {
      body { padding: 0; }
      .wrap { border: 0; border-radius: 0; padding: 0; }
      .badge { border-color: #fecaca; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    ${z(c,46)}
    <div class="topbar">
      <div style="min-width:0">
        <p style="margin:0;font-size:12px;font-weight:700;color:#991b1b;text-transform:uppercase;letter-spacing:0.06em">Payment invoice / receipt</p>
      </div>
      <div class="invmeta">
        <div class="label">Invoice</div>
        <div class="value mono">${n}</div>
        <div class="badge">PAID</div>
      </div>
    </div>

    <div class="section grid">
      <div class="card">
        <h2>Bill to</h2>
        <div class="row"><strong>Borrower</strong><span>${f}</span></div>
        <div class="row"><strong>Email</strong><span class="mono">${p}</span></div>
      </div>
      <div class="card">
        <h2>Payment details</h2>
        <div class="row"><strong>Payment date</strong><span>${o}</span></div>
        <div class="row"><strong>Reference</strong><span class="mono">${x}</span></div>
        <div class="row"><strong>OR No.</strong><span class="mono">${g(u||"—")}</span></div>
        <div class="row"><strong>AR No.</strong><span class="mono">${g(j||"—")}</span></div>
        <div class="row"><strong>Processed by</strong><span>${g(h)}${r?` - ${g(r)}`:""}</span></div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th style="text-align:right">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>Installment due</td><td class="amount">${l}</td></tr>
        <tr><td>Penalty</td><td class="amount">${w}</td></tr>
      </tbody>
    </table>

    <div class="totals">
      <div class="totalrow">
        <span class="k">Amount paid</span>
        <span class="v">${d}</span>
      </div>
    </div>

    <div class="footer">
      <span>This is a system-generated invoice/receipt.</span>
      <span class="mono">Ref: ${x}</span>
    </div>
  </div>
</body>
</html>`}function P(a){const s=a?.official_receipt_pdf_url;return s&&String(s).trim()?String(s).trim():a?.id&&(a?.receipt_pdf_path||a?.invoice_pdf_path)?`/borrower/payments/${a.id}/official-receipt`:""}async function H(a){const s=P(a);if(!s)throw new Error("Official receipt PDF is not available.");const n={Accept:"application/pdf"},o=M();o&&(n.Authorization=`Bearer ${o}`);for(const d of E()){const l=await fetch(U(s,d),{headers:n});if(!(l.status===404||l.status>=500)){if(!l.ok)throw new Error(`Could not download receipt (HTTP ${l.status}).`);return l.blob()}}throw new Error("Could not download receipt.")}async function O(a,s="view"){const n=await H(a),o=URL.createObjectURL(n);if(s==="download"){const l=document.createElement("a");l.href=o,l.download=`${_(a)||$(a)}.pdf`,document.body.appendChild(l),l.click(),l.remove(),URL.revokeObjectURL(o);return}const d=window.open(o,"_blank","noopener,noreferrer");s==="print"&&d&&d.addEventListener("load",()=>{try{d.print()}catch{}})}function T(a){if(a==null||a==="")return"";const s=String(a).toLowerCase();return{queued:"Confirmation email queued",sent:"Confirmation email sent",failed:"Email failed"}[s]||`Email: ${a}`}function V(a,s){const n=I(a,s),o=new Blob([n],{type:"text/html;charset=utf-8"}),d=URL.createObjectURL(o),l=document.createElement("a");l.href=d,l.download=`${$(a)}.html`,document.body.appendChild(l),l.click(),l.remove(),URL.revokeObjectURL(d)}function Q(){const{user:a}=B(),[s,n]=m.useState("pending"),[o,d]=m.useState([]),[l,w]=m.useState([]),[x,f]=m.useState(!0),[p,u]=m.useState(""),[j,h]=m.useState(null);return m.useEffect(()=>{let r=!0;return(async()=>{f(!0),u("");try{const[b,N]=await Promise.all([C("/borrower/payments"),C("/borrower/payments/history")]);if(!r)return;d(b?.data?.data||[]),w(N?.data?.data||[])}catch(b){r&&u(b.message||"Failed to load payments.")}finally{r&&f(!1)}})(),()=>{r=!1}},[]),e.jsxs("div",{className:"rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-colors duration-300 dark:border-[#1F2937] dark:bg-[#111827] dark:shadow-lg",children:[e.jsxs("div",{className:"flex flex-wrap items-center justify-between gap-3",children:[e.jsx("h2",{className:"text-lg font-semibold text-gray-900 dark:text-gray-100",children:"Payments"}),e.jsxs("div",{className:"rounded-lg border border-gray-200 bg-gray-100 p-1 text-xs dark:border-[#1F2937] dark:bg-[#0F172A]",children:[e.jsx("button",{type:"button",onClick:()=>n("pending"),className:`rounded-md px-3 py-1.5 transition-colors duration-300 ${s==="pending"?"bg-red-600 text-white":`${t.textMuted}`}`,children:"Pending"}),e.jsx("button",{type:"button",onClick:()=>n("history"),className:`rounded-md px-3 py-1.5 transition-colors duration-300 ${s==="history"?"bg-red-600 text-white":`${t.textMuted}`}`,children:"History"})]})]}),x?e.jsxs("div",{className:"mt-4 space-y-3",children:[e.jsx(R,{className:"h-4 w-40"}),e.jsx("div",{className:`${t.tableScroll}`,children:e.jsx("table",{className:`${t.tableBase} ${t.tableMin720}`,children:e.jsx("tbody",{children:Array.from({length:4}).map((r,c)=>e.jsx("tr",{className:t.tbodyRow,children:Array.from({length:5}).map((b,N)=>e.jsx("td",{className:t.tableCell,children:e.jsx(R,{className:"h-3 w-full max-w-[7rem]"})},N))},c))})})})]}):null,p?e.jsx("p",{className:"mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300",children:p}):null,!x&&!p&&s==="pending"&&e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"mt-4 space-y-3 md:hidden",children:o.length?o.map(r=>e.jsxs("div",{className:"rounded-xl border border-gray-200 bg-gray-50/80 p-3 dark:border-[#1F2937] dark:bg-[#0F172A]/50",children:[e.jsxs("div",{className:"flex items-start justify-between gap-3",children:[e.jsx("p",{className:"text-sm font-semibold text-gray-900 dark:text-gray-100",children:y(r.due_date)}),e.jsx("span",{className:`inline-flex rounded-full px-2 py-1 text-xs ring-1 ${k(r.status)}`,children:String(r.status||"").toUpperCase()})]}),e.jsxs("dl",{className:"mt-3 space-y-1.5 text-xs",children:[e.jsxs("div",{className:"flex items-center justify-between gap-2",children:[e.jsx("dt",{className:t.textMuted,children:"Amount due"}),e.jsx("dd",{className:"font-medium text-gray-900 dark:text-gray-100",children:i(r.amount_due)})]}),e.jsxs("div",{className:"flex items-center justify-between gap-2",children:[e.jsx("dt",{className:t.textMuted,children:"Amount paid"}),e.jsx("dd",{className:"font-medium text-gray-900 dark:text-gray-100",children:i(r.amount_paid)})]}),e.jsxs("div",{className:"flex items-center justify-between gap-2",children:[e.jsx("dt",{className:t.textMuted,children:"Penalty"}),e.jsx("dd",{className:"font-medium text-gray-900 dark:text-gray-100",children:i(r.penalty_amount)})]})]})]},r.id)):e.jsx("p",{className:`rounded-xl border border-dashed border-gray-300 px-3 py-6 text-center text-sm ${t.textMuted} dark:border-gray-600`,children:"No pending payments."})}),e.jsx("div",{className:`${t.tableScroll} mt-4 hidden md:block`,children:e.jsxs("table",{className:`${t.tableBase} ${t.tableText} ${t.tableMin720}`,children:[e.jsx("thead",{children:e.jsxs("tr",{className:t.thead,children:[e.jsx("th",{className:`${t.tableCell} text-left`,children:"Due date"}),e.jsx("th",{className:`${t.tableCell} text-left`,children:"Amount due"}),e.jsx("th",{className:`${t.tableCell} text-left`,children:"Amount paid"}),e.jsx("th",{className:`${t.tableCell} text-left`,children:"Penalty"}),e.jsx("th",{className:`${t.tableCell} text-left`,children:"Status"})]})}),e.jsxs("tbody",{children:[o.map(r=>e.jsxs("tr",{className:t.tbodyRow,children:[e.jsx("td",{className:t.tableCell,children:y(r.due_date)}),e.jsx("td",{className:t.tableCell,children:i(r.amount_due)}),e.jsx("td",{className:t.tableCell,children:i(r.amount_paid)}),e.jsx("td",{className:t.tableCell,children:i(r.penalty_amount)}),e.jsx("td",{className:t.tableCell,children:e.jsx("span",{className:`inline-flex rounded-full px-2 py-1 text-xs ring-1 ${k(r.status)}`,children:String(r.status||"").toUpperCase()})})]},r.id)),o.length?null:e.jsx("tr",{children:e.jsx("td",{colSpan:5,className:`${t.tableCell} py-8 text-center ${t.textMuted}`,children:"No pending payments."})})]})]})})]}),!x&&!p&&s==="history"&&e.jsx("div",{className:`${t.tableScroll} mt-4`,children:e.jsxs("table",{className:`${t.tableBase} ${t.tableText} ${t.tableMin640}`,children:[e.jsx("thead",{children:e.jsxs("tr",{className:t.thead,children:[e.jsx("th",{className:`${t.tableCell} text-left`,children:"Date paid"}),e.jsx("th",{className:`${t.tableCell} text-left`,children:"Amount"}),e.jsx("th",{className:`${t.tableCell} text-left`,children:"Reference"}),e.jsx("th",{className:`${t.tableCell} text-left`,children:"OR #"}),e.jsx("th",{className:`${t.tableCell} text-left`,children:"AR #"}),e.jsx("th",{className:`${t.tableCell} text-left`,children:"Proof"}),e.jsx("th",{className:`${t.tableCell} text-left`,children:"Official PDF"}),e.jsx("th",{className:`${t.tableCell} text-left`,children:"Processed By"}),e.jsx("th",{className:`${t.tableCell} text-left`,children:"Email status"}),e.jsx("th",{className:`${t.tableCell} text-left`,children:"Invoice (HTML)"})]})}),e.jsxs("tbody",{children:[l.map(r=>e.jsxs("tr",{className:t.tbodyRow,children:[e.jsx("td",{className:t.tableCell,children:y(r.paid_at||r.due_date)}),e.jsx("td",{className:t.tableCell,children:i(r.amount_paid)}),e.jsx("td",{className:t.tableCell,children:r.reference_number||"-"}),e.jsx("td",{className:`${t.tableCell} font-mono text-xs`,children:_(r)||"-"}),e.jsx("td",{className:`${t.tableCell} font-mono text-xs`,children:A(r)||"-"}),e.jsx("td",{className:t.tableCell,children:r.receipt_path?e.jsx("a",{href:L(r.receipt_path),target:"_blank",rel:"noreferrer",className:"text-red-600 underline dark:text-red-400",children:"View proof"}):"-"}),e.jsx("td",{className:t.tableCell,children:P(r)?e.jsx("div",{className:"flex flex-wrap gap-2",children:["view","download","print"].map(c=>e.jsx("button",{type:"button",disabled:j===r.id,onClick:async()=>{try{h(r.id),await O(r,c)}catch(b){u(b.message||"Could not open receipt.")}finally{h(null)}},className:"rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-[#374151] dark:text-red-300 dark:hover:bg-red-950/30",children:c==="view"?"View":c==="download"?"Download":"Print"},c))}):e.jsx("span",{className:`text-xs ${t.textMuted}`,children:"—"})}),e.jsxs("td",{className:t.tableCell,children:[e.jsx("div",{className:"text-sm font-semibold text-gray-900 dark:text-gray-100",children:S(r)||"—"}),v(r)?e.jsx("small",{className:t.textMuted,children:v(r)}):null]}),e.jsx("td",{className:`${t.tableCell} text-xs ${t.textMuted}`,children:T(r.receipt_email_status)||"—"}),e.jsx("td",{className:t.tableCell,children:e.jsx("div",{className:"flex flex-wrap gap-2",children:e.jsx("button",{type:"button",onClick:()=>V(r,a),className:"rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-[#374151] dark:text-gray-200 dark:hover:bg-white/10",children:"Download HTML"})})})]},r.id)),l.length?null:e.jsx("tr",{children:e.jsx("td",{colSpan:10,className:`${t.tableCell} py-8 text-center ${t.textMuted}`,children:"No completed payments yet."})})]})]})})]})}export{Q as default};
