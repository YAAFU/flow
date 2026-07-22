import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "นโยบายการใช้งานเว็บไซต์ - Flow",
  description: "นโยบายการใช้งานและข้อมูลสำหรับเว็บไซต์เดโม Flow",
};

const sections = [
  {
    id: "status",
    title: "สถานะของเว็บไซต์",
    items: [
      <><span className="font-grotesk">Flow</span> เป็นเว็บไซต์เดโมสำหรับทดลองการวางแผนวัน</>,
      <>เว็บไซต์ยังไม่มีระบบบัญชีหรือ <span className="font-grotesk">Authentication</span> จริง</>,
      <><span className="font-grotesk">Demo Account</span> ที่แสดงบนหน้าเข้าสู่ระบบเป็นข้อมูลสาธารณะและไม่ใช่ข้อมูลลับ</>,
    ],
  },
  {
    id: "login",
    title: <><span>ข้อมูลบนหน้า </span><span className="font-grotesk">Login</span></>,
    items: [
      <><span className="font-grotesk">Username</span> และ <span className="font-grotesk">Password</span> ถูกตรวจสอบภายใน <span className="font-grotesk">browser</span> เท่านั้น</>,
      <>ไม่มีการส่ง บันทึก หรือสร้าง <span className="font-grotesk">session</span> จากข้อมูล <span className="font-grotesk">Login</span></>,
      <>หน้า <span className="font-grotesk">Login</span> ไม่สร้าง <span className="font-grotesk">cookie</span> หรือ <span className="font-grotesk">token</span></>,
    ],
  },
  {
    id: "app-data",
    title: "ข้อมูลภายในแอป",
    items: [
      <>รายการงาน วันที่และเวลาของงาน สถานที่หรือพิกัด ป้ายวัน คะแนน และการตั้งค่าบางส่วนอาจถูกเก็บไว้ใน <span className="font-grotesk">localStorage</span> ของเบราว์เซอร์บนอุปกรณ์นี้</>,
      <>Flow จะขอสิทธิ์ตำแหน่งเมื่อผู้ใช้กดปุ่มใช้ตำแหน่งปัจจุบันเท่านั้น ใช้ข้อมูลแบบครั้งเดียว และไม่ติดตามตำแหน่งเบื้องหลัง</>,
      <>ผู้ใช้สามารถลบข้อมูลดังกล่าวได้ด้วยการล้างข้อมูลเว็บไซต์ในเบราว์เซอร์</>,
      <>ฟีเจอร์ <span className="font-grotesk">AI</span>, แผนที่, <span className="font-grotesk">geocoding</span> หรือ <span className="font-grotesk">routing</span> อาจส่งข้อมูลที่จำเป็น เช่น รายละเอียดงาน ข้อความสนทนา คำค้นหา สถานที่ หรือพิกัด ไปยังบริการภายนอกเพื่อประมวลผล</>,
      <>ไม่ควรกรอกข้อมูลส่วนบุคคล ข้อมูลลับ หรือข้อมูลสำคัญลงในเว็บไซต์เดโม</>,
    ],
  },
  {
    id: "limitations",
    title: "ข้อจำกัด",
    items: [
      <>ผลลัพธ์จาก <span className="font-grotesk">AI</span> เวลาเดินทาง และเส้นทางอาจคลาดเคลื่อน</>,
      "ผู้ใช้ควรตรวจสอบข้อมูลก่อนนำไปใช้จริง",
      "เว็บไซต์ไม่มีการรับประกันความพร้อมใช้งานหรือความถูกต้องของผลลัพธ์",
    ],
  },
  {
    id: "changes",
    title: "การเปลี่ยนแปลงนโยบาย",
    items: [
      <>หากมีการเพิ่ม <span className="font-grotesk">Auth</span> ฐานข้อมูล หรือการเก็บข้อมูลจริง ต้องปรับปรุงนโยบายนี้ก่อนเปิดใช้งาน</>,
      <>นโยบายฉบับนี้อธิบายเฉพาะการทำงานของเว็บไซต์เดโมในปัจจุบัน และไม่ได้กล่าวอ้างการรับรองตาม <span className="font-grotesk">PDPA</span> หรือ <span className="font-grotesk">GDPR</span></>,
    ],
  },
] as const;

export default function PolicyPage() {
  return (
    <main className="min-h-screen bg-[var(--flow-paper)] text-[var(--flow-ink)]">
      <div className="mx-auto w-full max-w-[420px] px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] sm:py-10">
        <header className="flow-rise">
          <div className="font-grotesk text-[26px] font-bold leading-none tracking-tight">
            flow<span className="text-[#9cc400]">_</span>
          </div>
          <nav aria-label="การนำทางนโยบาย">
            <Link
              href="/login"
              className="flow-press mt-8 inline-flex min-h-11 items-center gap-1.5 rounded-xl border-[1.5px] border-[var(--flow-ink)] px-3 py-2 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[var(--flow-ink)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--flow-lime)]"
            >
              <ArrowLeft aria-hidden="true" size={17} />
              กลับหน้าเข้าสู่ระบบ
            </Link>
          </nav>
        </header>

        <article
          aria-labelledby="policy-heading"
          className="flow-rise mt-10"
          style={{ animationDelay: "80ms" }}
        >
          <p className="font-grotesk text-[10px] font-semibold uppercase tracking-widest text-[var(--flow-muted)]">
            WEB POLICY
          </p>
          <h1 id="policy-heading" className="mt-2 text-3xl font-bold leading-tight">
            นโยบายการใช้งานเว็บไซต์
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[var(--flow-muted)]">
            นโยบายนี้อธิบายการทำงานและข้อจำกัดของ <span className="font-grotesk">Flow</span> ในฐานะเว็บไซต์เดโม
            เพื่อให้คุณตัดสินใจก่อนทดลองใช้งาน
          </p>
          <p className="mt-3 text-xs text-[var(--flow-muted)]">
            ปรับปรุงล่าสุด: <span className="font-grotesk">21</span> กรกฎาคม{" "}
            <span className="font-grotesk">2569</span>
          </p>

          <ol className="flow-stagger mt-8 flex flex-col gap-4">
            {sections.map((section, index) => (
              <li
                key={section.id}
                className="flow-card rounded-2xl p-5"
              >
                <section aria-labelledby={`policy-section-${section.id}`}>
                  <div className="flex items-baseline gap-2">
                    <span className="font-grotesk text-xs font-semibold text-[#9cc400]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <h2
                      id={`policy-section-${section.id}`}
                      className="text-lg font-bold"
                    >
                      {section.title}
                    </h2>
                  </div>
                  <ul className="mt-4 flex flex-col gap-2 text-sm leading-relaxed text-[var(--flow-muted)]">
                    {section.items.map((item, itemIndex) => (
                      <li key={`${section.id}-${itemIndex}`} className="flex gap-2">
                        <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--flow-ink)]" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              </li>
            ))}
          </ol>

          <div className="flow-inverse mt-6 rounded-2xl p-5">
            <p className="text-sm font-semibold">ก่อนกลับไปทดลองใช้งาน</p>
            <p className="mt-1 text-xs leading-relaxed opacity-70">
              อย่ากรอกข้อมูลส่วนบุคคลหรือข้อมูลลับ และตรวจสอบผลลัพธ์ทุกครั้งก่อนนำไปใช้จริง
            </p>
          </div>

          <Link
            href="/login"
            className="flow-press flow-inverse mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-2xl px-4 text-base font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[var(--flow-ink)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--flow-lime)]"
          >
            <ArrowLeft aria-hidden="true" size={18} className="text-[var(--flow-lime)]" />
            กลับหน้าเข้าสู่ระบบ
          </Link>
        </article>
      </div>
    </main>
  );
}
