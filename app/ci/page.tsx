import { MapPin, Search, Pencil, X, Plus, ArrowRight, ArrowUpRight, Lightbulb, AlertTriangle, CalendarDays, CalendarRange, ListTodo, Map, Sparkles, RefreshCw } from "lucide-react";

export const metadata = { title: "Flow - Design System (CI)" };

function Swatch({ name, hex, use, dark }: { name: string; hex: string; use: string; dark?: boolean }) {
  return (
    <div className="overflow-hidden rounded-xl border-[1.5px] border-[var(--flow-ink)]">
      <div className="flex h-20 items-end p-2" style={{ background: hex }}>
        <span className={`font-grotesk text-[11px] font-semibold ${dark ? "text-white" : "text-[#111]"}`}>{hex.toUpperCase()}</span>
      </div>
      <div className="p-2.5">
        <div className="text-sm font-semibold">{name}</div>
        <div className="text-[11px] text-neutral-500">{use}</div>
      </div>
    </div>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="border-t-[1.5px] border-[var(--flow-ink)] pt-6">
      <div className="mb-4 flex items-baseline gap-2">
        <span className="font-grotesk text-xs text-neutral-400">{n}</span>
        <h2 className="text-xl font-bold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export default function CIPage() {
  return (
    <main className="mx-auto max-w-[920px] px-5 py-10 sm:px-8">
      {/* hero */}
      <header className="mb-10">
        <div className="font-grotesk text-5xl font-bold tracking-tight">flow<span className="text-[var(--flow-lime)]">_</span></div>
        <p className="mt-2 max-w-md text-sm text-neutral-600">ให้คนกรุงเทพคุมวันของตัวเอง ก่อนที่เมืองจะคุมเรา</p>
        <div className="mt-3 inline-block rounded-full border-[1.5px] border-[var(--flow-ink)] px-3 py-1 text-[11px] font-semibold uppercase tracking-widest">Design System · CI</div>
      </header>

      <div className="flex flex-col gap-10">
        {/* 01 logo */}
        <Section n="01" title="โลโก้ / Wordmark">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center justify-center rounded-2xl border-[1.5px] border-[var(--flow-ink)] bg-white p-10">
              <div className="font-grotesk text-4xl font-bold tracking-tight text-[#111]">flow<span className="text-[#9cc400]">_</span></div>
            </div>
            <div className="flex items-center justify-center rounded-2xl bg-[#111] p-10">
              <div className="font-grotesk text-4xl font-bold tracking-tight text-white">flow<span className="text-[var(--flow-lime)]">_</span></div>
            </div>
          </div>
          <ul className="mt-3 space-y-1 text-xs text-neutral-600">
            <li>• ตัวพิมพ์เล็กทั้งหมด · ฟอนต์ <b>Space Grotesk Bold</b> · letter-spacing แน่น (-0.5px)</li>
            <li>• เครื่องหมาย <b>_</b> (underscore) สี lime เสมอ - เป็นสัญลักษณ์ &quot;เคอร์เซอร์/พร้อมรับ input&quot;</li>
            <li>• บนพื้นขาวใช้ underscore เขียวเข้ม <span className="font-grotesk">#9CC400</span> เพื่อให้อ่านออก · บนพื้นดำใช้ lime <span className="font-grotesk">#D6FF3F</span></li>
          </ul>
        </Section>

        {/* 02 color */}
        <Section n="02" title="สี / Color">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Swatch name="Ink" hex="#111111" use="ตัวหนังสือหลัก, เส้นขอบ, ปุ่มหลัก, พื้นเข้ม" dark />
            <Swatch name="Paper" hex="#FFFFFF" use="พื้นหลังหลัก" />
            <Swatch name="Lime (accent)" hex="#D6FF3F" use="ไฮไลต์, accent บนพื้นดำ, underscore" />
            <Swatch name="Lime-dark" hex="#9CC400" use="lime บนพื้นขาว (อ่านง่ายขึ้น)" />
            <Swatch name="Muted" hex="#777777" use="ตัวหนังสือรอง" />
            <Swatch name="Amber (warning)" hex="#F59E0B" use="แจ้งเตือน, จุดต้องเช็ก" dark />
          </div>
          <p className="mt-3 text-xs text-neutral-600">หลัก: ขาว–ดำ + accent เดียว (lime). สี amber ใช้เฉพาะ warning/review เท่านั้น. เทา neutral-200/300/400 สำหรับเส้น/ตัวรอง.</p>
        </Section>

        {/* 03 type */}
        <Section n="03" title="ฟอนต์ / Typography">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border-[1.5px] border-[var(--flow-ink)] p-5">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">ภาษาไทย → MiSans Thai</div>
              <div className="mt-2 text-3xl font-bold">วางแผนวันของคุณ</div>
              <div className="mt-1 text-base">คุมเวลาได้ ไม่ใช่ปล่อยให้เวลาคุมเรา</div>
              <div className="mt-3 flex gap-3 text-sm text-neutral-500">
                <span style={{ fontWeight: 400 }}>Regular</span>
                <span style={{ fontWeight: 500 }}>Medium</span>
                <span style={{ fontWeight: 600 }}>Semibold</span>
                <span style={{ fontWeight: 700 }}>Bold</span>
              </div>
            </div>
            <div className="rounded-2xl border-[1.5px] border-[var(--flow-ink)] p-5">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">Latin / ตัวเลข / สัญลักษณ์ → Space Grotesk</div>
              <div className="font-grotesk mt-2 text-3xl font-bold">flow_ · 12:00</div>
              <div className="font-grotesk mt-1 text-base">0 1 2 3 4 5 6 7 8 9 · 78% · →</div>
              <div className="font-grotesk mt-3 flex gap-3 text-sm text-neutral-500">
                <span style={{ fontWeight: 500 }}>Medium</span>
                <span style={{ fontWeight: 600 }}>Semibold</span>
                <span style={{ fontWeight: 700 }}>Bold</span>
              </div>
            </div>
          </div>
          <div className="mt-3 rounded-xl border-[1.5px] border-amber-400 bg-amber-50 p-3 text-xs font-medium text-amber-700">
            กฎเหล็ก: <b>ข้อความไทยใช้ MiSans Thai เสมอ</b> - Space Grotesk ใช้เฉพาะอักษรละติน ตัวเลข เวลา % และลูกศรเท่านั้น ห้ามเรนเดอร์อักษรไทยด้วย Space Grotesk
          </div>
          {/* scale */}
          <div className="mt-4 flex flex-col gap-1 rounded-2xl border-[1.5px] border-[var(--flow-ink)] p-5">
            <div className="text-3xl font-bold leading-tight">Display · 30/700</div>
            <div className="text-2xl font-bold">H1 · 24/700</div>
            <div className="text-xl font-bold">H2 · 20/700</div>
            <div className="text-sm">Body · 14/400</div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">Label · 10/600 · uppercase · tracking-widest</div>
          </div>
        </Section>

        {/* 04 layout */}
        <Section n="04" title="การจัดวาง / Layout & Tokens">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border-[1.5px] border-[var(--flow-ink)] p-5 text-sm">
              <div className="font-semibold">ระยะ & กรอบ</div>
              <ul className="mt-2 space-y-1 text-xs text-neutral-600">
                <li>• Mobile-first · ความกว้างเนื้อหา <span className="font-grotesk">max 420px</span> กลางจอ</li>
                <li>• เส้นขอบหลัก <span className="font-grotesk">1.5px</span> สี ink (เด่น คม editorial)</li>
                <li>• Radius: <span className="font-grotesk">12px</span> (card เล็ก), <span className="font-grotesk">16px</span> (card ใหญ่/ปุ่ม), <span className="font-grotesk">999px</span> (pill)</li>
                <li>• เว้นที่ขาวเยอะ · จัดชิดซ้าย · type ใหญ่</li>
              </ul>
            </div>
            <div className="rounded-2xl border-[1.5px] border-[var(--flow-ink)] p-5 text-sm">
              <div className="font-semibold">Motion</div>
              <ul className="mt-2 space-y-1 text-xs text-neutral-600">
                <li>• <b>rise</b> - fade + slide ขึ้น (เผยทีละ item, stagger 60–90ms)</li>
                <li>• <b>pop</b> - scale เด้งเข้า (badge/score)</li>
                <li>• <b>bar grow</b> - แถบคะแนนวิ่งจาก 0 (ease 1s)</li>
                <li>• ปุ่มกด <b>press</b> ยุบ scale 0.97 · easing <span className="font-grotesk">cubic-bezier(.22,1,.36,1)</span></li>
              </ul>
            </div>
          </div>
        </Section>

        {/* 05 components */}
        <Section n="05" title="คอมโพเนนต์ / Components">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* buttons */}
            <div className="flex flex-col gap-2 rounded-2xl border-[1.5px] border-[var(--flow-ink)] p-5">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">ปุ่ม</div>
              <button className="flex items-center justify-center gap-2 rounded-2xl bg-[var(--flow-ink)] py-3 text-sm font-semibold text-white">วางแผนวันให้ฉัน <ArrowRight size={16} className="text-[var(--flow-lime)]" /></button>
              <button className="rounded-xl border-[1.5px] border-[var(--flow-ink)] py-2.5 text-sm font-semibold">ปุ่มรอง (outline)</button>
              <div className="flex gap-1.5">
                <span className="rounded-full border-[1.5px] border-[var(--flow-lime)] bg-[var(--flow-lime)] px-2.5 py-1 text-xs font-semibold">เลือกอยู่</span>
                <span className="rounded-full border border-neutral-300 px-2.5 py-1 text-xs text-neutral-400">ไม่เลือก</span>
              </div>
            </div>
            {/* segmented */}
            <div className="flex flex-col gap-2 rounded-2xl border-[1.5px] border-[var(--flow-ink)] p-5">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">Segmented (sliding)</div>
              <div className="relative flex rounded-full border-[1.5px] border-[var(--flow-ink)] p-1 text-xs font-semibold">
                <div className="absolute bottom-1 left-1 top-1 rounded-full bg-[var(--flow-ink)]" style={{ width: "calc(50% - 0.25rem)" }} />
                <span className="relative z-10 flex-1 py-1.5 text-center text-[var(--flow-lime)]">เครียดน้อยสุด</span>
                <span className="relative z-10 flex-1 py-1.5 text-center">เร็วสุด</span>
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">Score bar</div>
              <div className="h-2 overflow-hidden rounded-full bg-neutral-200"><div className="h-full rounded-full bg-[var(--flow-ink)]" style={{ width: "78%" }} /></div>
            </div>
            {/* card */}
            <div className="rounded-2xl border-[1.5px] border-[var(--flow-ink)] p-5">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">Task / Timeline card</div>
              <div className="mt-2 rounded-xl border-[1.5px] border-[var(--flow-ink)] px-3 py-2.5">
                <div className="text-sm font-semibold">ทำงานออฟฟิศ <span className="text-[10px] font-normal text-neutral-400">สยาม</span></div>
                <div className="font-grotesk mt-0.5 text-[11px] text-neutral-500">12:00–14:30</div>
              </div>
            </div>
            {/* risk card */}
            <div className="rounded-2xl border-[1.5px] border-[var(--flow-ink)] p-5">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">Risk card (inverted)</div>
              <div className="mt-2 rounded-xl bg-[var(--flow-ink)] px-3 py-2.5 text-white">
                <div className="flex items-center gap-1.5 text-sm font-semibold"><AlertTriangle size={14} className="text-[var(--flow-lime)]" /> จุดเสี่ยงเครียด</div>
                <div className="mt-0.5 text-[11px] text-[var(--flow-lime)]">ช่วงดึกแน่นเกิน เสี่ยงล้า</div>
              </div>
            </div>
          </div>
        </Section>

        {/* 06 icons */}
        <Section n="06" title="ไอคอน / Iconography">
          <div className="rounded-2xl border-[1.5px] border-[var(--flow-ink)] p-5">
            <p className="text-xs text-neutral-600">ชุด <b>Lucide</b> · เส้น stroke 1.8 (ปกติ) / 2.4 (active) · ขนาด 14–22px</p>
            <div className="mt-3 grid grid-cols-6 gap-4 text-neutral-700 sm:grid-cols-8">
              {[ListTodo, CalendarRange, Map, CalendarDays, MapPin, Search, Pencil, X, Plus, ArrowRight, ArrowUpRight, Lightbulb, AlertTriangle, Sparkles, RefreshCw].map((Icon, i) => (
                <div key={i} className="flex items-center justify-center"><Icon size={22} strokeWidth={1.8} /></div>
              ))}
            </div>
          </div>
        </Section>

        {/* 07 voice */}
        <Section n="07" title="โทนเสียง / Voice">
          <div className="rounded-2xl border-[1.5px] border-[var(--flow-ink)] p-5 text-sm text-neutral-700">
            <p>เป็นกันเอง ตรงไปตรงมา ไม่ตัดสิน · เน้น &quot;คุณคุมได้&quot; (control) ไม่ใช่ &quot;ทำให้ได้มากขึ้น&quot; (productivity).</p>
            <p className="mt-2 text-xs text-neutral-500">เช่น: &quot;เลื่อนคุยน้องไป 19:00 → คุมได้ขึ้นเป็น 88%&quot; · ใช้ emoji น้อย · ตัวเลขเป็น Space Grotesk</p>
          </div>
        </Section>
      </div>

      <footer className="mt-12 border-t-[1.5px] border-[var(--flow-ink)] pt-4 text-xs text-neutral-400">
        Flow · ทีม CAIRO · HacKaTech 2569 - <span className="font-grotesk">/ci</span>
      </footer>
    </main>
  );
}
