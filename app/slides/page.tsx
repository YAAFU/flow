"use client";
/* eslint-disable react-hooks/static-components */
import { Fragment, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, LayoutGrid, X, Link2, CalendarCheck, HeartPulse, Timer, Palette, Type, TerminalSquare, Rows3, type LucideIcon } from "lucide-react";

function GithubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.34-5.47-5.96 0-1.32.47-2.39 1.24-3.23-.12-.31-.54-1.53.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.65.24 2.87.12 3.18.77.84 1.24 1.91 1.24 3.23 0 4.63-2.81 5.65-5.49 5.95.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58A12.01 12.01 0 0 0 24 12.5C24 5.87 18.63.5 12 .5z"/>
    </svg>
  );
}

type Slide = {
  kind?: "hero" | "cover" | "end" | "content" | "github" | "bento";
  kicker?: string;
  title?: React.ReactNode;
  lead?: React.ReactNode;                       // cover/hero only
  keywords?: React.ReactNode[];                 // visual chip cards
  kwImgs?: string[];                            // optional screenshot per keyword card (object-contain)
  kwPhotos?: string[];                          // optional concept photo per keyword card (object-cover)
  phoneBg?: boolean;                            // faint full-bleed 3D iphone mockup behind content
  kwIcons?: LucideIcon[];                       // optional icon per keyword card
  dense?: boolean;                              // smaller, left-aligned keyword cards for long text (appendix)
  studies?: { source: React.ReactNode; type: React.ReactNode; finding: React.ReactNode; detail: React.ReactNode }[];
  steps?: { n: string; label: string }[];       // numbered flow
  quote?: { text: React.ReactNode; refs?: React.ReactNode[] };
  bars?: { label: string; arrow: string; stat: string; chart: string }[];
  stats?: { value: React.ReactNode; label: string; source?: React.ReactNode }[];
  bg?: string;                                  // full-bleed background photo
  shot?: string;                                // github repo screenshot
  qr?: string;                                  // qr code image
  repo?: string;                                // repo url text
  link?: string;                                // prominent site badge text
  gallery?: string[];                           // collage of photos (2-4)
  footer?: React.ReactNode;
};

const G = ({ children }: { children: React.ReactNode }) => <span className="font-grotesk">{children}</span>;
const HERO_IMG = "https://cdn.nsys.site/5e905d.png"; // 3D iPhone render of the home page

const SLIDES: Slide[] = [
  {
    kind: "hero",
    lead: <>ให้เราคุมเวลาของตัวเองได้<br />ไม่ใช่ให้เวลามาคุมเรา</>,
    footer: <>ทีม CAIRO · HacKaTech · PEOPLE Track</>,
  },
  {
    kicker: "ลองนึกภาพ",
    title: <>วันที่งานหลายอย่าง<br />ถาโถมเข้ามาพร้อมกัน</>,
    gallery: [
      "https://loremflickr.com/640/640/deadline,work?lock=21",
      "https://loremflickr.com/640/640/clock,time?lock=31",
      "https://loremflickr.com/640/640/traffic,city?lock=41",
      "https://loremflickr.com/640/640/meeting,office?lock=51",
    ],
  },
  {
    kicker: "ใครเจอปัญหานี้",
    title: <>ไม่ใช่แค่<br />เราคนเดียว</>,
    gallery: [
      "https://loremflickr.com/640/640/student,study?lock=12",
      "https://loremflickr.com/640/640/office,worker?lock=22",
      "https://loremflickr.com/640/640/commuter,train?lock=32",
      "https://loremflickr.com/640/640/laptop,cafe?lock=42",
    ],
  },
  {
    kicker: "งานวิจัยบอกอะไร",
    title: "คุมเวลาได้ = เครียดน้อยลง",
    quote: {
      text: <>บริหารเวลาไม่ได้เพิ่มงานที่เสร็จชัด ๆ แต่ช่วย <span className="bg-[var(--flow-lime)] px-1">ลดความเครียด</span> และรู้สึก <span className="bg-[var(--flow-lime)] px-1">คุมชีวิตได้มากขึ้น</span></>,
      refs: [<><G>Therese Macan · 1994</G></>, <><G>Mark Hriemok · 2025</G></>],
    },
    bars: [
      { label: "ผลงานที่เสร็จ", arrow: "≈", stat: "+2%", chart: "0,22 20,20 40,23 60,19 80,22 100,21" },
      { label: "ความเครียด", arrow: "↓", stat: "-46%", chart: "0,7 25,13 50,19 75,28 100,33" },
      { label: "รู้สึกคุมชีวิต", arrow: "↑", stat: "+63%", chart: "0,33 25,27 50,19 75,10 100,4" },
    ],
  },
  {
    kind: "hero",
    title: "นั่นคือที่มาของ",
    lead: "ทำให้ความรู้สึก ‘คุมวันได้’ เป็นเรื่องง่าย ไม่ใช่ภาระเพิ่ม",
  },
  {
    kicker: "Flow คืออะไร",
    kwImgs: ["https://cdn.nsys.site/7325e0.png", "https://cdn.nsys.site/19435b.png", "https://cdn.nsys.site/6f35e4.png"],
    title: <>งาน<br />เวลา<br />เดินทาง<br /><span className="text-neutral-500">รวมในที่เดียว</span></>,
    keywords: ["จัดการงาน", "วางแผนเวลา", "วางแผนเดินทาง"],
  },
  {
    kicker: "Flow ในตัวเลข",
    title: "เครื่องมือเดียว จบทั้งวัน",
    stats: [
      { value: <>3<span className="text-[var(--flow-lime)]">-in-1</span></>, label: "งาน · เวลา · เดินทาง" },
      { value: "2", label: "สไตล์แผน เร็วสุด / เครียดน้อยสุด" },
      { value: <>100<span className="text-[var(--flow-lime)]">%</span></>, label: "โอเพนซอร์ส (MIT)" },
      { value: "2", label: "งานวิจัยรองรับ (1994, 2025)" },
    ],
  },
  {
    kicker: "เพื่อใคร · ช่วยอะไร",
    title: "Flow ช่วยคนกรุงเทพยังไง",
    keywords: ["ลดพลาดนัดหมาย", "ลดความเครียด", "ใช้เวลาคุ้มขึ้น"],
    kwIcons: [CalendarCheck, HeartPulse, Timer],
  },
  {
    kind: "cover",
    kicker: "Working Prototype",
    title: "Demo",
    lead: "ใช้งานได้จริงแล้ววันนี้ที่",
    link: "flow.nsys.site",
    qr: "https://cdn.nsys.site/d5683b.png",
    phoneBg: true,
  },
  {
    kicker: "ทำงานยังไง",
    title: "ใช้ง่ายใน 3 ขั้น",
    steps: [
      { n: "1", label: "เพิ่มงาน" },
      { n: "2", label: "AI จัด flow" },
      { n: "3", label: "ทำตาม & เช็ค" },
    ],
  },
  {
    kicker: "Impact",
    title: <>แก้ปัญหาคนเมือง<br />ได้จริง</>,
    bg: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Twilight_over_the_modern_city_skyline_in_Ratchadamri_district%2C_Bangkok%2C_Thailand%2C_July_2019_-_Flickr_-_sergei.gussev.jpg/1280px-Twilight_over_the_modern_city_skyline_in_Ratchadamri_district%2C_Bangkok%2C_Thailand%2C_July_2019_-_Flickr_-_sergei.gussev.jpg",
  },
  {
    kicker: "Challenges",
    title: "ความท้าทาย & ความเสี่ยง",
    keywords: ["เวลาเดินทางยังไม่เรียลไทม์", "GPS check-in (เดโมจำลอง)", "ต้องใช้ง่ายพอจะทำทุกวัน", "ข้อมูลเก็บในเครื่อง (privacy)"],
  },
  {
    kicker: "Opportunity · Scalability",
    title: "ขยายผลได้ ไม่จำกัดพื้นที่",
    keywords: ["เว็บวันนี้ → ต่อยอดเป็น Mobile App", "ร่วมกับโรงเรียน / องค์กร", "เชื่อมข้อมูลเมือง / ขนส่ง", "Future: ทีม · ปฏิทิน · แจ้งเตือน"],
  },
  {
    kind: "github",
    title: <>โปรเจกต์นี้ <span className="bg-[var(--flow-lime)] px-2 font-grotesk">Open Source</span></>,
    shot: "https://cdn.nsys.site/e3a8ef.png",
    qr: "https://cdn.nsys.site/d5683b.png",
    repo: "github.com/nicenathapong/flow",
  },
  {
    kind: "bento",
    kicker: "Design = Solution",
    title: "ทุกดีเทล ออกแบบมาเพื่อ ‘ลดภาระ ไม่เพิ่มภาระ’",
  },
  {
    kind: "end",
    title: (
      <>
        <span className="mb-3 block sm:mb-5">
          <span className="inline-block rounded-full border-[1.5px] border-[var(--flow-ink)] bg-white/80 px-[0.7em] py-[0.35em] text-[0.26em] font-semibold tracking-wide text-[var(--flow-ink)] backdrop-blur-sm">
            ทีม CAIRO <span className="font-grotesk">flow<span className="font-black text-[#9CC400]">_</span></span> ตามฟีล
          </span>
        </span>
        ขอขอบคุณครับ
      </>
    ),
    footer: "ยินดีตอบคำถาม",
    bg: "https://cdn.nsys.site/a608cd.png",
  },

  // ── appendix: backup data for Q&A ──
  {
    kind: "cover",
    kicker: "Appendix",
    title: "ภาคผนวก",
    lead: "ข้อมูล & งานวิจัยอ้างอิง สำหรับตอบคำถาม",
  },
  {
    kicker: "ภาคผนวก · ปัญหา",
    title: "ปัญหาจริง มีตัวเลขรองรับ",
    stats: [
      { value: <>10<span className="text-[var(--flow-lime)]"> ล้าน</span></>, label: "คนไทยมีปัญหาสุขภาพจิต สูงกว่าค่าเฉลี่ยโลก", source: "กรมสุขภาพจิต" },
      { value: <>7<span className="text-[var(--flow-lime)]">/10</span></>, label: "วัยทำงานกำลัง ‘หมดไฟ’ (burnout)", source: <>Thairath · <G>2567</G></> },
      { value: <>15.4<span className="text-[var(--flow-lime)]">%</span></>, label: "เครียดสูง (จาก 8.5 แสนคน)", source: <>กรมสุขภาพจิต <G>2567</G></> },
      { value: <>110<span className="text-[var(--flow-lime)]"> ชม.</span></>, label: "เวลาที่กรุงเทพเสียกับรถติด/ปี", source: <>TomTom <G>2024</G></> },
    ],
  },
  {
    kicker: "ภาคผนวก · งานวิจัย",
    title: "ทำไม Flow ถึงช่วยได้",
    studies: [
      {
        source: <G>Macan · 1994</G>,
        type: "Process Model",
        finding: <>คุมเวลา <span className="bg-[var(--flow-lime)] px-1.5">ลดเครียด</span></>,
        detail: <>“การรู้สึกคุมเวลา” (perceived control) เป็นตัวกลางสำคัญ → ลดเครียด เพิ่มความพอใจ ไม่ใช่จำนวนงานที่เสร็จ</>,
      },
      {
        source: <G>Häfner & Stock · 2010</G>,
        type: <>RCT · n=<G>71</G></>,
        finding: <><span className="bg-[var(--flow-lime)] px-1.5">เครียด ↓</span> งานเท่าเดิม</>,
        detail: <>เทรน time management → คุมเวลาได้มากขึ้น + ลดความเครียดจริง แต่ performance ไม่เปลี่ยน → ตรงกับ thesis เรา</>,
      },
    ],
  },
  {
    kicker: "ภาคผนวก · แหล่งอ้างอิง",
    title: "References",
    dense: true,
    keywords: [
      <>กรมสุขภาพจิต · รายงานสุขภาพจิตคนไทย <G>2567</G></>,
      <>Thairath · คนไทยเครียดสะสม วัยทำงานหมดไฟ <G>7/10</G></>,
      <><G>TomTom Traffic Index 2024</G> · Bangkok</>,
      <><G>Macan, T. H. (1994)</G> · Time Management: Test of a Process Model</>,
      <><G>Häfner & Stock (2010)</G> · Time Mgmt Training & Perceived Control</>,
      <>สสส. / Hfocus · สุขภาพจิตคนวัยทำงาน</>,
      <><G>MentalHealthCtr</G> · Time Management for Mental Well-being</>,
      <>Chula Digital Repository · วิทยานิพนธ์ (etd)</>,
    ],
  },
];

function SlideView({ s, mini }: { s: Slide; mini?: boolean }) {
  const cover = s.kind === "cover" || s.kind === "end";
  const hero = s.kind === "hero";

  // ── bento: design = solution rationale ──
  if (s.kind === "bento") {
    const cellBase = `flex min-h-0 flex-col border-[1.5px] border-[var(--flow-ink)] ${mini ? "gap-1 rounded-md p-2" : "gap-2.5 rounded-2xl p-4 sm:p-6"}`;
    const probCls = mini ? "text-[5px] leading-tight text-[var(--flow-muted)]" : "text-[11px] leading-snug text-[var(--flow-muted)] sm:text-[15px]";
    const solCls = mini ? "text-[5px] font-semibold leading-tight" : "text-xs font-semibold leading-snug sm:text-lg";
    const Tag = ({ icon: I, children }: { icon: LucideIcon; children: React.ReactNode }) => (
      <span className={`flex items-center font-bold uppercase tracking-widest text-neutral-400 ${mini ? "gap-0.5 text-[5px]" : "gap-1.5 text-[10px] sm:text-xs"}`}>
        <I size={mini ? 6 : 16} strokeWidth={2.4} /> {children}
      </span>
    );
    return (
      <div className={`relative flex h-full w-full flex-col overflow-hidden ${mini ? "gap-1.5 p-3" : "gap-3 p-7 sm:gap-4 sm:p-11"}`}>
        <div className={mini ? "" : "space-y-1.5"}>
          {s.kicker && <div className={`inline-block bg-[var(--flow-lime)] font-bold text-[var(--flow-ink)] ${mini ? "px-1.5 py-0.5 text-[7px]" : "px-2 py-1 text-sm sm:text-lg"}`}>{s.kicker}</div>}
          <h2 className={`font-bold leading-[1.04] tracking-tight ${mini ? "text-[12px]" : "text-2xl sm:text-4xl"}`}>{s.title}</h2>
        </div>
        <div className={`grid min-h-0 flex-1 grid-cols-3 grid-rows-2 ${mini ? "gap-1" : "gap-3 sm:gap-4"}`}>
          {/* color: tall left */}
          <div className={`${cellBase} row-span-2`}>
            <Tag icon={Palette}>สี · Color</Tag>
            <div className={`flex min-h-0 flex-1 ${mini ? "gap-1" : "gap-2"}`}>
              <span className={`flex-1 self-stretch border-[1.5px] border-[var(--flow-ink)] bg-white ${mini ? "rounded-sm" : "rounded-lg"}`} />
              <span className={`flex-1 self-stretch bg-[var(--flow-ink)] ${mini ? "rounded-sm" : "rounded-lg"}`} />
              <span className={`flex-1 self-stretch bg-[var(--flow-lime)] ${mini ? "rounded-sm" : "rounded-lg"}`} />
            </div>
            <div className={`font-grotesk text-neutral-400 ${mini ? "text-[4px]" : "text-[9px] sm:text-xs"}`}>paper · #111111 · #D6FF3F</div>
            <p className={probCls}>ปัญหา: หน้าจอรก ตัวเลือกเยอะ = เครียดเพิ่ม</p>
            <p className={solCls}>ขาว-ดำ สงบเหมือนกระดาษ, lime สีเดียวนำสายตาไป “สิ่งที่ต้องทำตอนนี้”</p>
          </div>
          {/* logo: wide top right */}
          <div className={`${cellBase} col-span-2`}>
            <Tag icon={TerminalSquare}>โลโก้ · Logo</Tag>
            <div className="flex min-h-0 flex-1 items-center gap-5">
              <span className={`font-grotesk font-bold leading-none tracking-tight ${mini ? "text-xl" : "text-5xl sm:text-7xl"}`}>flow<span className="text-[#9CC400]">_</span></span>
              <p className={`${solCls} flex-1`}><span className="font-grotesk font-bold text-[#9CC400]">_</span> คือ cursor “แค่พิมพ์งาน AI จัด flow ให้” เริ่มง่าย · ตัวเล็ก = ไม่กดดัน</p>
            </div>
            <p className={probCls}>ปัญหา: เวลามาคุมเรา เริ่มยาก ฝืน</p>
          </div>
          {/* font */}
          <div className={cellBase}>
            <Tag icon={Type}>ฟอนต์ · Type</Tag>
            <div className={`flex min-h-0 flex-1 items-center gap-2 ${mini ? "text-base" : "text-3xl sm:text-5xl"}`}>
              <span className="font-bold">ก ข</span>
              <span className="font-grotesk font-bold">09:30</span>
            </div>
            <p className={solCls}>ไทยอ่านสบาย · เวลา/ตัวเลขคม “เหลือบตาก็รู้”</p>
          </div>
          {/* card/line */}
          <div className={`${cellBase} justify-between`}>
            <Tag icon={Rows3}>การ์ด · Layout</Tag>
            <div className={`flex w-full items-center gap-1.5 border-[1.5px] border-[var(--flow-ink)] ${mini ? "rounded-sm p-1" : "rounded-lg p-2 sm:p-2.5"}`}>
              <span className={`shrink-0 bg-[var(--flow-lime)] ${mini ? "h-2 w-0.5" : "h-5 w-1 sm:h-6"}`} />
              <span className={`bg-neutral-200 ${mini ? "h-1 flex-1 rounded-full" : "h-2 flex-1 rounded-full"}`} />
            </div>
            <p className={solCls}>1 การ์ด = 1 เรื่อง เส้นคมแบ่งชัด รู้สึกคุมได้</p>
          </div>
        </div>
        <div className={`shrink-0 text-center font-semibold text-[var(--flow-muted)] ${mini ? "text-[5px]" : "text-xs sm:text-base"}`}>Mono Editorial · ดีไซน์ที่ทำให้รู้สึกคุมวันได้ ก่อนเมืองจะคุมเรา</div>
      </div>
    );
  }

  // ── github: headline + repo screenshot + QR/CTA ──
  if (s.kind === "github") {
    return (
      <div className={`relative flex h-full w-full flex-col overflow-hidden ${mini ? "gap-2 p-3" : "gap-6 p-8 sm:gap-7 sm:p-12"}`}>
        <h2 className={`text-center font-bold leading-[1.04] tracking-tight ${mini ? "text-base" : "text-4xl sm:text-6xl"}`}>{s.title}</h2>
        <div className={`flex min-h-0 flex-1 items-center ${mini ? "gap-2" : "gap-6 sm:gap-10"}`}>
          {/* screenshot with lime offset block */}
          <div className="relative flex min-h-0 flex-[1.7] items-center justify-center self-stretch">
            <div className={`absolute bg-[var(--flow-lime)] ${mini ? "-bottom-1 -left-1 h-2/3 w-1/2 rounded" : "-bottom-3 -left-3 h-2/3 w-1/2 rounded-lg sm:-bottom-4 sm:-left-4"}`} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.shot} alt="GitHub repo flow" className={`relative max-h-full w-full border-[1.5px] border-[var(--flow-ink)] object-contain ${mini ? "rounded" : "rounded-lg"}`} />
          </div>
          {/* QR + CTA */}
          <div className={`flex flex-1 flex-col items-center justify-center ${mini ? "gap-1" : "gap-3 sm:gap-4"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.qr} alt="QR github" className={`border-[1.5px] border-[var(--flow-ink)] bg-white object-contain ${mini ? "h-12 w-12 rounded p-0.5" : "h-36 w-36 rounded-lg p-2 sm:h-44 sm:w-44"}`} />
            <GithubMark className={mini ? "h-3 w-3" : "h-7 w-7 sm:h-8 sm:w-8"} />
            <span className={`font-grotesk text-center font-semibold leading-tight ${mini ? "text-[6px]" : "text-sm sm:text-lg"}`}>{s.repo}</span>
            <div className={`bg-[var(--flow-lime)] font-grotesk font-bold tracking-tight text-[var(--flow-ink)] ${mini ? "rounded px-1.5 py-0.5 text-[6px]" : "rounded-lg px-4 py-2 text-base sm:px-6 sm:py-3 sm:text-2xl"}`}>CONTRIBUTE NOW!</div>
          </div>
        </div>
      </div>
    );
  }

  // ── hero: big name + 3D phone ──
  if (hero) {
    return (
      <div className="relative flex h-full w-full items-stretch overflow-hidden">
        <div className="absolute -bottom-6 -left-10 h-2/3 w-2/3 rounded-full bg-[var(--flow-lime)] opacity-20 blur-2xl" />
        <div className={`relative z-10 flex flex-1 flex-col justify-center px-6 sm:px-14 ${mini ? "gap-2" : "gap-5 sm:gap-7"}`}>
          {s.footer && <div className={`font-grotesk font-bold uppercase tracking-widest text-neutral-400 ${mini ? "text-[6px]" : "text-[10px] sm:text-xs"}`}>{s.footer}</div>}
          <div className={mini ? "" : "space-y-1"}>
            {s.title && <p className={`font-semibold text-neutral-500 ${mini ? "text-[9px]" : "text-2xl sm:text-4xl"}`}>{s.title}</p>}
            <h1 className={`font-grotesk font-bold leading-[0.9] tracking-tight ${mini ? "text-4xl" : "text-7xl sm:text-9xl"}`}>flow<span className="text-[var(--flow-lime)]">_</span></h1>
          </div>
          {s.lead && <p className={`font-bold leading-snug text-[var(--flow-ink)] ${mini ? "text-[9px]" : "text-2xl sm:text-4xl"}`}>{s.lead}</p>}
          {s.footer && (
            <div className={`flex items-center gap-2 self-start rounded-full bg-[var(--flow-ink)] font-grotesk font-semibold text-white ${mini ? "mt-0.5 px-2 py-1 text-[8px]" : "mt-2 px-5 py-3 text-lg sm:text-xl"}`}>
              <Link2 size={mini ? 9 : 22} strokeWidth={2.5} className="text-[var(--flow-lime)]" /> flow.nsys.site
            </div>
          )}
        </div>
        <div className={`relative z-10 flex flex-1 items-center justify-center ${mini ? "pr-3" : "pr-8 sm:pr-14"}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={HERO_IMG} alt="หน้าแรกของ Flow บน iPhone" className={`w-auto object-contain drop-shadow-[0_22px_45px_rgba(0,0,0,.28)] ${mini ? "h-[84%]" : "h-[86%]"}`} />
        </div>
      </div>
    );
  }

  // ── cover/end: centered statement ──
  if (cover) {
    return (
      <div className={`relative flex h-full w-full flex-col items-center justify-center overflow-hidden text-center ${mini ? "gap-1 p-4" : "gap-4 p-12"}`}>
        {s.phoneBg && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={HERO_IMG} alt="" className="pointer-events-none absolute left-1/2 top-1/2 h-[150%] w-auto -translate-x-1/2 -translate-y-1/2 opacity-[0.1]" />
            <div className="absolute -bottom-10 left-1/2 h-2/3 w-2/3 -translate-x-1/2 rounded-full bg-[var(--flow-lime)] opacity-[0.12] blur-3xl" />
          </>
        )}
        {s.bg && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.bg} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.6]" />
            <div className="absolute inset-0 bg-white/15" />
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--flow-lime)]/30 via-white/10 to-white/25" />
            <div className="absolute -bottom-16 left-1/2 h-2/3 w-2/3 -translate-x-1/2 rounded-full bg-[var(--flow-lime)] opacity-30 blur-3xl" />
          </>
        )}
        {s.kicker && <div className={`relative inline-block bg-[var(--flow-lime)] font-bold text-[var(--flow-ink)] ${mini ? "px-1.5 py-0.5 text-[7px]" : "px-2 py-1 text-sm sm:text-lg"}`}>{s.kicker}</div>}
        <h2 className={`relative font-black leading-[1.02] tracking-tight ${mini ? "text-xl" : "text-6xl sm:text-8xl"}`}>{s.title}</h2>
        {s.lead && <p className={`relative text-neutral-600 ${mini ? "text-[8px]" : "text-lg sm:text-2xl"}`}>{s.lead}</p>}
        {s.link && (
          <a className={`relative inline-flex items-center font-grotesk font-bold text-white ${mini ? "mt-1 gap-1 rounded-full bg-[var(--flow-ink)] px-2 py-0.5 text-[8px]" : "mt-1 gap-2 rounded-full bg-[var(--flow-ink)] px-5 py-2.5 text-lg sm:text-2xl"}`}>
            <Link2 size={mini ? 9 : 24} strokeWidth={2.5} className="text-[var(--flow-lime)]" />{s.link}
          </a>
        )}
        {s.qr && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={s.qr} alt="QR flow.nsys.site" className={`relative border-[1.5px] border-[var(--flow-ink)] bg-white object-contain ${mini ? "mt-1 h-10 w-10 rounded p-0.5" : "mt-2 h-36 w-36 rounded-lg p-2 sm:h-40 sm:w-40"}`} />
        )}
        {s.footer && (
          s.bg
            ? <div className={`relative inline-block rounded-full bg-[var(--flow-ink)] font-semibold text-white ${mini ? "mt-1 px-1.5 py-0.5 text-[6px]" : "mt-3 px-4 py-1.5 text-xs sm:text-sm"}`}>{s.footer}</div>
            : <div className={`relative text-neutral-400 ${mini ? "mt-1 text-[7px]" : "mt-2 text-xs sm:text-sm"}`}>{s.footer}</div>
        )}
      </div>
    );
  }

  // ── collage slide: multiple photos + title overlaid ──
  if (s.gallery) {
    const g = s.gallery;
    const span = (i: number) => (g.length === 2 ? "row-span-2" : g.length === 3 && i === 0 ? "row-span-2" : "");
    return (
      <div className="relative h-full w-full overflow-hidden bg-[var(--flow-ink)]">
        <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-[3px]">
          {g.map((src, i) => {
            // eslint-disable-next-line @next/next/no-img-element
            return <img key={i} src={src} alt="" className={`h-full w-full object-cover ${span(i)}`} />;
          })}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/10" />
        <div className={`relative z-10 flex h-full flex-col justify-end ${mini ? "gap-1 p-3" : "gap-3 p-10 sm:p-14"}`}>
          {s.kicker && <div className={`inline-block self-start bg-[var(--flow-lime)] font-bold text-[var(--flow-ink)] ${mini ? "px-1.5 py-0.5 text-[7px]" : "px-2.5 py-1 text-sm sm:text-lg"}`}>{s.kicker}</div>}
          <h2 className={`font-bold leading-[1.02] tracking-tight text-white ${mini ? "text-[13px]" : "text-4xl sm:text-7xl"}`}>{s.title}</h2>
          <div className={`bg-[var(--flow-lime)] ${mini ? "h-0.5 w-6" : "h-2 w-24"}`} />
        </div>
      </div>
    );
  }

  // ── full-bleed image slide: photo dominant, title overlaid ──
  if (s.bg) {
    return (
      <div className="relative h-full w-full overflow-hidden bg-neutral-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={s.bg} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/10" />
        <div className={`relative z-10 flex h-full flex-col justify-end ${mini ? "gap-1 p-3" : "gap-3 p-10 sm:p-14"}`}>
          {s.kicker && <div className={`inline-block self-start bg-[var(--flow-lime)] font-bold text-[var(--flow-ink)] ${mini ? "px-1.5 py-0.5 text-[7px]" : "px-2.5 py-1 text-sm sm:text-lg"}`}>{s.kicker}</div>}
          <h2 className={`font-bold leading-[1.02] tracking-tight text-white ${mini ? "text-[13px]" : "text-4xl sm:text-7xl"}`}>{s.title}</h2>
          <div className={`bg-[var(--flow-lime)] ${mini ? "h-0.5 w-6" : "h-2 w-24"}`} />
        </div>
      </div>
    );
  }

  // ── content: title-dominant + visual cards ──
  const kwCols = s.dense ? "grid-cols-1 sm:grid-cols-2" : s.keywords && s.keywords.length <= 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2";

  // ── content with screenshots: title left, phone screens in a row right ──
  if (s.kwImgs && s.keywords) {
    return (
      <div className={`relative flex h-full w-full items-stretch overflow-hidden ${mini ? "gap-2 p-3" : "gap-5 p-8 sm:gap-8 sm:p-12"}`}>
        <div className={`flex flex-[0.6] flex-col justify-center ${mini ? "gap-1" : "gap-4"}`}>
          {s.kicker && <div className={`inline-block self-start bg-[var(--flow-lime)] font-bold text-[var(--flow-ink)] ${mini ? "px-1.5 py-0.5 text-[7px]" : "px-2 py-1 text-sm sm:text-lg"}`}>{s.kicker}</div>}
          <h2 className={`font-bold leading-[1.04] tracking-tight ${mini ? "text-[13px]" : "text-4xl sm:text-5xl"}`}>{s.title}</h2>
          <div className={`bg-[var(--flow-lime)] ${mini ? "h-0.5 w-6" : "h-2 w-24"}`} />
        </div>
        <div className={`flex flex-[1.55] items-stretch ${mini ? "gap-1.5" : "gap-5 sm:gap-7"}`}>
          {s.keywords.map((k, i) => (
            <div key={i} className={`flex min-w-0 flex-1 flex-col ${mini ? "gap-1" : "gap-2 sm:gap-3"}`}>
              <div className={`flex min-h-0 flex-1 items-center justify-center overflow-hidden border-[1.5px] border-[var(--flow-ink)] bg-white ${mini ? "rounded-md p-1" : "rounded-xl p-2 sm:p-3"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.kwImgs![i]} alt="" className="h-full w-full object-contain" />
              </div>
              <div className={`flex shrink-0 items-center justify-center ${mini ? "gap-1" : "gap-2"}`}>
                <span className={`shrink-0 bg-[var(--flow-lime)] ${mini ? "h-2.5 w-1" : "h-5 w-1.5 sm:h-6"}`} />
                <span className={`font-bold leading-tight ${mini ? "text-[7px]" : "text-sm sm:text-xl"}`}>{k}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`relative flex h-full w-full flex-col justify-center overflow-hidden ${mini ? "gap-1 p-4" : s.dense ? "gap-3 p-8 sm:p-10" : "gap-5 p-10 sm:p-16"}`}>
      {s.kicker && (
        <div className={`relative inline-block self-start bg-[var(--flow-lime)] font-bold text-[var(--flow-ink)] ${mini ? "px-1.5 py-0.5 text-[7px]" : "px-2 py-1 text-sm sm:text-lg"}`}>{s.kicker}</div>
      )}
      <div className="relative">
        <h2 className={`font-bold leading-[1.04] tracking-tight ${mini ? "text-[14px]" : s.dense ? "text-2xl sm:text-4xl" : "text-4xl sm:text-6xl"}`}>{s.title}</h2>
        <div className={`mt-3 bg-[var(--flow-lime)] ${mini ? "h-0.5 w-6" : "h-2 w-24"}`} />
      </div>

      {/* study cards: source · big finding · detail */}
      {s.studies && (
        <div className={`grid min-h-0 flex-1 grid-cols-1 sm:grid-cols-2 ${mini ? "mt-1 gap-1" : "mt-3 gap-4 sm:gap-6"}`}>
          {s.studies.map((st, i) => (
            <div key={i} className={`flex flex-col border-[1.5px] border-[var(--flow-ink)] ${mini ? "gap-1 rounded-md p-2" : "gap-3 rounded-2xl p-5 sm:gap-4 sm:p-7"}`}>
              <div className={`flex flex-wrap items-center ${mini ? "gap-1" : "gap-2"}`}>
                <span className={`rounded-full bg-[var(--flow-ink)] font-semibold text-white ${mini ? "px-1.5 py-0.5 text-[6px]" : "px-3 py-1 text-xs sm:text-base"}`}>{st.source}</span>
                <span className={`rounded-full border-[1.5px] border-[var(--flow-ink)] font-semibold ${mini ? "px-1.5 py-0.5 text-[6px]" : "px-3 py-1 text-xs sm:text-base"}`}>{st.type}</span>
              </div>
              <div className={`font-bold leading-tight ${mini ? "text-sm" : "text-2xl sm:text-4xl"}`}>{st.finding}</div>
              <p className={`text-[var(--flow-muted)] ${mini ? "mt-auto text-[6px] leading-tight" : "mt-auto text-sm leading-snug sm:text-lg"}`}>{st.detail}</p>
            </div>
          ))}
        </div>
      )}

      {/* keyword cards */}
      {s.keywords && (
        <div className={`grid ${kwCols} ${mini ? "mt-1 gap-1" : "mt-2 gap-3 sm:gap-4"}`}>
          {s.keywords.map((k, i) => {
            const Icon = s.kwIcons?.[i];
            if (Icon) return (
              <div key={i} className={`flex flex-col border-[1.5px] border-[var(--flow-ink)] ${mini ? "gap-1 p-2" : "gap-4 p-5 sm:p-7"}`}>
                <span className={`flex items-center justify-center rounded-xl bg-[var(--flow-lime)] text-[var(--flow-ink)] ${mini ? "h-5 w-5" : "h-14 w-14 sm:h-16 sm:w-16"}`}>
                  <Icon size={mini ? 12 : 32} strokeWidth={2.2} />
                </span>
                <span className={`font-bold leading-tight ${mini ? "text-[8px]" : "text-base sm:text-2xl"}`}>{k}</span>
              </div>
            );
            if (s.dense) return (
            <div key={i} className={`flex items-start gap-2 border-[1.5px] border-[var(--flow-ink)] ${mini ? "p-1.5" : "p-2.5 sm:p-3.5"}`}>
              <span className={`mt-0.5 shrink-0 bg-[var(--flow-lime)] ${mini ? "h-2.5 w-1" : "h-4 w-1.5"}`} />
              <span className={`font-semibold leading-snug ${mini ? "text-[6px]" : "text-[10px] sm:text-[13px]"}`}>{k}</span>
            </div>
            );
            return (
            <div key={i} className={`flex items-center gap-2.5 border-[1.5px] border-[var(--flow-ink)] ${mini ? "p-1.5" : "p-4 sm:p-5"}`}>
              <span className={`shrink-0 bg-[var(--flow-lime)] ${mini ? "h-3 w-1" : "h-7 w-1.5 sm:h-8"}`} />
              <span className={`font-bold leading-tight ${mini ? "text-[8px]" : "text-base sm:text-2xl"}`}>{k}</span>
            </div>
            );
          })}
        </div>
      )}

      {/* numbered steps */}
      {s.steps && (
        <div className={`flex items-stretch ${mini ? "mt-1 gap-1" : "mt-2 gap-3 sm:gap-4"}`}>
          {s.steps.map((st, i) => (
            <Fragment key={i}>
              <div className={`flex flex-1 flex-col gap-2 border-[1.5px] border-[var(--flow-ink)] ${mini ? "p-1.5" : "p-5 sm:p-7"}`}>
                <span className={`font-grotesk flex items-center justify-center rounded-full bg-[var(--flow-ink)] font-bold text-[var(--flow-lime)] ${mini ? "h-4 w-4 text-[8px]" : "h-12 w-12 text-2xl"}`}>{st.n}</span>
                <span className={`font-bold leading-tight ${mini ? "text-[8px]" : "text-lg sm:text-2xl"}`}>{st.label}</span>
              </div>
              {i < s.steps!.length - 1 && <div className="flex items-center"><ArrowRight className="text-neutral-300" size={mini ? 10 : 28} /></div>}
            </Fragment>
          ))}
        </div>
      )}

      {/* big quote */}
      {s.quote && (
        <div className={`relative ${mini ? "mt-1" : "mt-2"}`}>
          <p className={`font-bold leading-snug ${mini ? "text-[9px]" : "text-xl sm:text-3xl"}`}>“{s.quote.text}”</p>
          {s.quote.refs && (
            <div className={`flex flex-wrap ${mini ? "mt-1 gap-1" : "mt-5 gap-2"}`}>
              {s.quote.refs.map((r, i) => (
                <span key={i} className={`rounded-full border-[1.5px] border-[var(--flow-ink)] font-semibold ${mini ? "px-1.5 py-0.5 text-[6px]" : "px-3 py-1 text-sm sm:text-lg"}`}>{r}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* comparison bars */}
      {s.bars && (
        <div className={`grid grid-cols-3 ${mini ? "mt-1 gap-1" : "mt-5 gap-3 sm:gap-4"}`}>
          {s.bars.map((b, i) => (
            <div key={i} className={`relative overflow-hidden border-[1.5px] border-[var(--flow-ink)] ${mini ? "p-1.5" : "p-3 sm:p-4"}`}>
              {/* graph bg */}
              <svg viewBox="0 0 100 40" preserveAspectRatio="none" className={`absolute inset-x-0 bottom-0 w-full ${mini ? "h-1/2" : "h-3/5"}`} aria-hidden>
                <polygon points={`0,40 ${b.chart} 100,40`} fill="var(--flow-lime)" opacity="0.22" />
                <polyline points={b.chart} fill="none" stroke="var(--flow-lime)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              </svg>
              <div className="relative flex items-baseline gap-1">
                <span className={`font-grotesk font-bold ${mini ? "text-xs" : "text-2xl sm:text-3xl"}`}>{b.arrow}</span>
                <span className={`font-grotesk font-bold leading-none tracking-tight ${mini ? "text-base" : "text-4xl sm:text-6xl"}`}>{b.stat}</span>
              </div>
              <div className={`relative font-semibold leading-tight text-[var(--flow-muted)] ${mini ? "mt-0.5 text-[7px]" : "mt-1.5 text-sm sm:text-lg"}`}>{b.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* stats */}
      {s.stats && (
        <div className={`grid grid-cols-2 ${mini ? "mt-1 gap-1" : "mt-2 gap-3 sm:grid-cols-4 sm:gap-4"}`}>
          {s.stats.map((st, i) => (
            <div key={i} className={`flex flex-col border-[1.5px] border-[var(--flow-ink)] ${mini ? "p-1.5" : "p-4 sm:p-5"}`}>
              <div className={`font-grotesk font-bold leading-none tracking-tight ${mini ? "text-base" : "text-4xl sm:text-6xl"}`}>{st.value}</div>
              <div className={`text-neutral-600 ${mini ? "mt-0.5 text-[7px] leading-tight" : "mt-2 text-xs sm:text-sm"}`}>{st.label}</div>
              {st.source && (
                <div className={`inline-flex items-center self-start rounded-full bg-[var(--flow-ink)] font-semibold text-white ${mini ? "mt-auto px-1 py-0.5 text-[5px]" : "mt-3 px-2.5 py-1 text-[10px] sm:text-xs"}`}>
                  <span className={mini ? "mr-0.5" : "mr-1 text-[var(--flow-lime)]"}>ที่มา</span>{st.source}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SlidesPage() {
  const [active, setActive] = useState<number | null>(null);
  const n = SLIDES.length;

  useEffect(() => {
    if (active === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setActive((i) => (i === null ? i : Math.min(n - 1, i + 1)));
      else if (e.key === "ArrowLeft") setActive((i) => (i === null ? i : Math.max(0, i - 1)));
      else if (e.key === "Escape") setActive(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, n]);

  if (active === null) {
    return (
      <main className="mx-auto max-w-[1100px] px-5 py-10 sm:px-8">
        <header className="mb-8">
          <div className="font-grotesk text-3xl font-bold tracking-tight">flow<span className="text-[var(--flow-lime)]">_</span> <span className="text-base font-semibold text-neutral-400">Pitch deck</span></div>
          <p className="mt-1 text-sm text-neutral-500">คลิกสไลด์เพื่อเข้าโหมดนำเสนอ · ใช้ลูกศร ← → สลับหน้า</p>
        </header>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SLIDES.map((s, i) => (
            <button key={i} onClick={() => setActive(i)}
              className="flow-press group overflow-hidden border-[1.5px] border-[var(--flow-ink)] bg-white text-left transition-shadow hover:shadow-[0_8px_30px_rgba(0,0,0,.1)]">
              <div className="font-grotesk relative aspect-video w-full">
                <SlideView s={s} mini />
                <span className="font-grotesk absolute bottom-1.5 right-2 text-[9px] font-semibold text-neutral-300">{i + 1}/{n}</span>
              </div>
            </button>
          ))}
        </div>
      </main>
    );
  }

  const s = SLIDES[active];
  return (
    <main className="flex min-h-screen flex-col bg-neutral-100">
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={() => setActive(null)} className="flow-press flex items-center gap-1.5 text-sm font-semibold text-neutral-600"><LayoutGrid size={16} /> หน้ารวม</button>
        <span className="font-grotesk text-sm font-bold">{active + 1} <span className="text-neutral-400">/ {n}</span></span>
        <button onClick={() => setActive(null)} className="flow-press text-neutral-500"><X size={20} /></button>
      </div>
      <div className="flex flex-1 items-center gap-2 px-2 pb-4 sm:px-6">
        <button onClick={() => setActive(Math.max(0, active - 1))} disabled={active === 0}
          className="flow-press flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-[1.5px] border-[var(--flow-ink)] bg-white disabled:opacity-30"><ArrowLeft size={20} /></button>
        <div className="font-grotesk mx-auto aspect-video w-full max-w-[1000px] overflow-hidden border-[1.5px] border-[var(--flow-ink)] bg-white shadow-[0_12px_50px_rgba(0,0,0,.12)]">
          <SlideView s={s} />
        </div>
        <button onClick={() => setActive(Math.min(n - 1, active + 1))} disabled={active === n - 1}
          className="flow-press flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-[1.5px] border-[var(--flow-ink)] bg-white disabled:opacity-30"><ArrowRight size={20} /></button>
      </div>
    </main>
  );
}
