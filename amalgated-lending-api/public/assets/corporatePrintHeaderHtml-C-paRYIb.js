const a="AMALGATED LENDING INC.",r="Lending Hope, Building Futures.",d=a,o=r;function s(l,n=52){const t=Math.max(32,Number(n)||52),i=Math.max(2,Math.round(t*.07)),e=Math.max(22,t-i*2-6);return`
<div class="corp-hdr-wrap" style="width:100%;margin:0 0 12px;">
  <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border-collapse:collapse;margin:0;padding:0;">
    <tr>
      <td style="width:100%;vertical-align:middle;padding:0;border:0;">
        <table cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;margin:0;padding:0;">
          <tr>
            <td style="width:${t+16}px;padding:0 12px 0 0;vertical-align:middle;border:0;">
              <div style="width:${t}px;height:${t}px;border:${i}px solid #b91c1c;border-radius:999px;text-align:center;background:#fff;box-sizing:border-box;padding:3px;">
                <img src="${l}" alt="" width="${e}" height="${e}" style="width:${e}px;height:${e}px;display:block;margin:2px auto 0;object-fit:contain;" />
              </div>
            </td>
            <td style="vertical-align:middle;padding:0;border:0;">
              <p style="margin:0;font-family:ui-sans-serif,system-ui,Arial,Helvetica,sans-serif;font-size:15px;font-weight:800;color:#000;letter-spacing:0.04em;text-transform:uppercase;line-height:1.15;">${a}</p>
              <p style="margin:5px 0 0;font-family:Georgia,'Times New Roman',Times,serif;font-size:12px;font-style:italic;color:#000;line-height:1.25;">&ldquo;${r}&rdquo;</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  <div style="height:1px;background:#000;margin:10px 0 12px;"></div>
</div>`}export{d as C,o as a,s as c};
