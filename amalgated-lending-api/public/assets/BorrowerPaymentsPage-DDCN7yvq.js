import{h as k,r as x,j as e,D as _,av as j}from"./vendor-DSUyKc9p.js";import{a as g,p as N,f as n,e as v}from"./formatters-CfNdLP9c.js";import{c as S}from"./corporatePrintHeaderHtml-C-paRYIb.js";import{a as t}from"./AdminUi-BeYU-0Rg.js";import{S as w}from"./index-CTS2xe1j.js";function C(s){return`INV-${String(s?.id||"").padStart(6,"0")}`}function R(s){return s?.reference_number||s?.reference_no||`PAY-${s?.id||"N/A"}`}function A(s,r){return s?.borrower_name||s?.borrower?.name||r?.name||r?.full_name||"Borrower"}function P(s,r){const d=C(s),o=g(s?.paid_at||s?.due_date),i=n(s?.amount_paid||0),l=n(s?.amount_due||0),h=n(s?.penalty_amount||0),c=R(s),p=A(s,r),m=r?.email||s?.borrower_email||"N/A",b=String(s?.official_receipt_number??"").trim(),a=String(s?.acknowledgement_receipt_number??"").trim(),u=typeof window<"u"?new URL("/amalgated-lending-logo.png",window.location.origin).toString():"/amalgated-lending-logo.png";return`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${d}</title>
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
    ${S(u,46)}
    <div class="topbar">
      <div style="min-width:0">
        <p style="margin:0;font-size:12px;font-weight:700;color:#991b1b;text-transform:uppercase;letter-spacing:0.06em">Payment invoice / receipt</p>
      </div>
      <div class="invmeta">
        <div class="label">Invoice</div>
        <div class="value mono">${d}</div>
        <div class="badge">PAID</div>
      </div>
    </div>

    <div class="section grid">
      <div class="card">
        <h2>Bill to</h2>
        <div class="row"><strong>Borrower</strong><span>${p}</span></div>
        <div class="row"><strong>Email</strong><span class="mono">${m}</span></div>
      </div>
      <div class="card">
        <h2>Payment details</h2>
        <div class="row"><strong>Payment date</strong><span>${o}</span></div>
        <div class="row"><strong>Reference</strong><span class="mono">${c}</span></div>
        <div class="row"><strong>OR No.</strong><span class="mono">${v(b||"—")}</span></div>
        <div class="row"><strong>AR No.</strong><span class="mono">${v(a||"—")}</span></div>
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
        <tr><td>Penalty</td><td class="amount">${h}</td></tr>
      </tbody>
    </table>

    <div class="totals">
      <div class="totalrow">
        <span class="k">Amount paid</span>
        <span class="v">${i}</span>
      </div>
    </div>

    <div class="footer">
      <span>This is a system-generated invoice/receipt.</span>
      <span class="mono">Ref: ${c}</span>
    </div>
  </div>
</body>
</html>`}function $(s){const r=s?.official_receipt_pdf_url;return r&&String(r).trim()?String(r).trim():s?.invoice_pdf_path?_(s.invoice_pdf_path):""}function M(s){if(s==null||s==="")return"";const r=String(s).toLowerCase();return{queued:"Confirmation email queued",sent:"Confirmation email sent",failed:"Email failed"}[r]||`Email: ${s}`}function L(s,r){const d=P(s,r),o=new Blob([d],{type:"text/html;charset=utf-8"}),i=URL.createObjectURL(o),l=document.createElement("a");l.href=i,l.download=`${C(s)}.html`,document.body.appendChild(l),l.click(),l.remove(),URL.revokeObjectURL(i)}function U(){const{user:s}=k(),[r,d]=x.useState("pending"),[o,i]=x.useState([]),[l,h]=x.useState([]),[c,p]=x.useState(!0),[m,b]=x.useState("");return x.useEffect(()=>{let a=!0;return(async()=>{p(!0),b("");try{const[f,y]=await Promise.all([j("/borrower/payments"),j("/borrower/payments/history")]);if(!a)return;i(f?.data?.data||[]),h(y?.data?.data||[])}catch(f){a&&b(f.message||"Failed to load payments.")}finally{a&&p(!1)}})(),()=>{a=!1}},[]),e.jsxs("div",{className:"rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-colors duration-300 dark:border-[#1F2937] dark:bg-[#111827] dark:shadow-lg",children:[e.jsxs("div",{className:"flex flex-wrap items-center justify-between gap-3",children:[e.jsx("h2",{className:"text-lg font-semibold text-gray-900 dark:text-gray-100",children:"Payments"}),e.jsxs("div",{className:"rounded-lg border border-gray-200 bg-gray-100 p-1 text-xs dark:border-[#1F2937] dark:bg-[#0F172A]",children:[e.jsx("button",{type:"button",onClick:()=>d("pending"),className:`rounded-md px-3 py-1.5 transition-colors duration-300 ${r==="pending"?"bg-red-600 text-white":`${t.textMuted}`}`,children:"Pending"}),e.jsx("button",{type:"button",onClick:()=>d("history"),className:`rounded-md px-3 py-1.5 transition-colors duration-300 ${r==="history"?"bg-red-600 text-white":`${t.textMuted}`}`,children:"History"})]})]}),c?e.jsxs("div",{className:"mt-4 space-y-3",children:[e.jsx(w,{className:"h-4 w-40"}),e.jsx("div",{className:`${t.tableScroll}`,children:e.jsx("table",{className:`${t.tableBase} ${t.tableMin720}`,children:e.jsx("tbody",{children:Array.from({length:4}).map((a,u)=>e.jsx("tr",{className:t.tbodyRow,children:Array.from({length:5}).map((f,y)=>e.jsx("td",{className:t.tableCell,children:e.jsx(w,{className:"h-3 w-full max-w-[7rem]"})},y))},u))})})})]}):null,m?e.jsx("p",{className:"mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300",children:m}):null,!c&&!m&&r==="pending"&&e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"mt-4 space-y-3 md:hidden",children:o.length?o.map(a=>e.jsxs("div",{className:"rounded-xl border border-gray-200 bg-gray-50/80 p-3 dark:border-[#1F2937] dark:bg-[#0F172A]/50",children:[e.jsxs("div",{className:"flex items-start justify-between gap-3",children:[e.jsx("p",{className:"text-sm font-semibold text-gray-900 dark:text-gray-100",children:g(a.due_date)}),e.jsx("span",{className:`inline-flex rounded-full px-2 py-1 text-xs ring-1 ${N(a.status)}`,children:String(a.status||"").toUpperCase()})]}),e.jsxs("dl",{className:"mt-3 space-y-1.5 text-xs",children:[e.jsxs("div",{className:"flex items-center justify-between gap-2",children:[e.jsx("dt",{className:t.textMuted,children:"Amount due"}),e.jsx("dd",{className:"font-medium text-gray-900 dark:text-gray-100",children:n(a.amount_due)})]}),e.jsxs("div",{className:"flex items-center justify-between gap-2",children:[e.jsx("dt",{className:t.textMuted,children:"Amount paid"}),e.jsx("dd",{className:"font-medium text-gray-900 dark:text-gray-100",children:n(a.amount_paid)})]}),e.jsxs("div",{className:"flex items-center justify-between gap-2",children:[e.jsx("dt",{className:t.textMuted,children:"Penalty"}),e.jsx("dd",{className:"font-medium text-gray-900 dark:text-gray-100",children:n(a.penalty_amount)})]})]})]},a.id)):e.jsx("p",{className:`rounded-xl border border-dashed border-gray-300 px-3 py-6 text-center text-sm ${t.textMuted} dark:border-gray-600`,children:"No pending payments."})}),e.jsx("div",{className:`${t.tableScroll} mt-4 hidden md:block`,children:e.jsxs("table",{className:`${t.tableBase} ${t.tableText} ${t.tableMin720}`,children:[e.jsx("thead",{children:e.jsxs("tr",{className:t.thead,children:[e.jsx("th",{className:`${t.tableCell} text-left`,children:"Due date"}),e.jsx("th",{className:`${t.tableCell} text-left`,children:"Amount due"}),e.jsx("th",{className:`${t.tableCell} text-left`,children:"Amount paid"}),e.jsx("th",{className:`${t.tableCell} text-left`,children:"Penalty"}),e.jsx("th",{className:`${t.tableCell} text-left`,children:"Status"})]})}),e.jsxs("tbody",{children:[o.map(a=>e.jsxs("tr",{className:t.tbodyRow,children:[e.jsx("td",{className:t.tableCell,children:g(a.due_date)}),e.jsx("td",{className:t.tableCell,children:n(a.amount_due)}),e.jsx("td",{className:t.tableCell,children:n(a.amount_paid)}),e.jsx("td",{className:t.tableCell,children:n(a.penalty_amount)}),e.jsx("td",{className:t.tableCell,children:e.jsx("span",{className:`inline-flex rounded-full px-2 py-1 text-xs ring-1 ${N(a.status)}`,children:String(a.status||"").toUpperCase()})})]},a.id)),o.length?null:e.jsx("tr",{children:e.jsx("td",{colSpan:5,className:`${t.tableCell} py-8 text-center ${t.textMuted}`,children:"No pending payments."})})]})]})})]}),!c&&!m&&r==="history"&&e.jsx("div",{className:`${t.tableScroll} mt-4`,children:e.jsxs("table",{className:`${t.tableBase} ${t.tableText} ${t.tableMin640}`,children:[e.jsx("thead",{children:e.jsxs("tr",{className:t.thead,children:[e.jsx("th",{className:`${t.tableCell} text-left`,children:"Date paid"}),e.jsx("th",{className:`${t.tableCell} text-left`,children:"Amount"}),e.jsx("th",{className:`${t.tableCell} text-left`,children:"Reference"}),e.jsx("th",{className:`${t.tableCell} text-left`,children:"Proof"}),e.jsx("th",{className:`${t.tableCell} text-left`,children:"Official PDF"}),e.jsx("th",{className:`${t.tableCell} text-left`,children:"Email status"}),e.jsx("th",{className:`${t.tableCell} text-left`,children:"Invoice (HTML)"})]})}),e.jsxs("tbody",{children:[l.map(a=>e.jsxs("tr",{className:t.tbodyRow,children:[e.jsx("td",{className:t.tableCell,children:g(a.paid_at||a.due_date)}),e.jsx("td",{className:t.tableCell,children:n(a.amount_paid)}),e.jsx("td",{className:t.tableCell,children:a.reference_number||"-"}),e.jsx("td",{className:t.tableCell,children:a.receipt_path?e.jsx("a",{href:_(a.receipt_path),target:"_blank",rel:"noreferrer",className:"text-red-600 underline dark:text-red-400",children:"View proof"}):"-"}),e.jsx("td",{className:t.tableCell,children:$(a)?e.jsx("a",{href:$(a),target:"_blank",rel:"noreferrer",className:"text-sm font-medium text-red-600 underline dark:text-red-400",children:"Download PDF"}):e.jsx("span",{className:`text-xs ${t.textMuted}`,children:"—"})}),e.jsx("td",{className:`${t.tableCell} text-xs ${t.textMuted}`,children:M(a.receipt_email_status)||"—"}),e.jsx("td",{className:t.tableCell,children:e.jsx("div",{className:"flex flex-wrap gap-2",children:e.jsx("button",{type:"button",onClick:()=>L(a,s),className:"rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-[#374151] dark:text-gray-200 dark:hover:bg-white/10",children:"Download HTML"})})})]},a.id)),l.length?null:e.jsx("tr",{children:e.jsx("td",{colSpan:7,className:`${t.tableCell} py-8 text-center ${t.textMuted}`,children:"No completed payments yet."})})]})]})})]})}export{U as default};
