export function createNativeStartupHtml() {
  return `<!doctype html>
<html lang="th">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#ffffff" />
    <meta http-equiv="refresh" content="0;url=/login/index.html" />
    <title>Flow</title>
    <style>
      :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
      * { box-sizing: border-box; }
      body { margin: 0; background: #fff; color: #111; }
      main { min-height: 100dvh; display: grid; place-items: center; padding: 24px; text-align: center; }
      section { width: min(100%, 360px); border: 1.5px solid currentColor; border-radius: 24px; padding: 28px 20px; }
      strong { display: block; font-size: 28px; line-height: 1; }
      strong span { color: #9cc400; }
      p { margin: 18px 0; line-height: 1.6; opacity: .72; }
      a { display: inline-flex; min-height: 48px; align-items: center; justify-content: center; border-radius: 16px; background: #111; color: #fff; padding: 0 20px; font-weight: 700; }
      @media (prefers-color-scheme: dark) {
        body { background: #111; color: #f6f6f1; }
        a { background: #c7ff18; color: #111; }
      }
    </style>
  </head>
  <body>
    <main>
      <section aria-labelledby="flow-startup-title">
        <strong id="flow-startup-title">flow<span>_</span></strong>
        <p>กำลังเปิด Flow… หากหน้านี้ไม่เปลี่ยน คุณยังสามารถเปิดหน้าเข้าสู่ระบบได้โดยตรง</p>
        <a href="/login/index.html">เปิด Flow</a>
      </section>
    </main>
  </body>
</html>
`;
}
