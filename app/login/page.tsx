"use client";

import Link from "next/link";
import { ArrowRight, CloudOff, HardDrive, Zap } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

const DEMO_USERNAME = "demo@flow.app";
const DEMO_PASSWORD = "123456";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  function enterGuestMode() {
    router.replace("/app");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    if (
      formData.get("username") === DEMO_USERNAME &&
      formData.get("password") === DEMO_PASSWORD
    ) {
      setError("");
      enterGuestMode();
      return;
    }

    setError("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
  }

  return (
    <main className="min-h-dvh overflow-x-hidden bg-[var(--flow-paper)] text-[var(--flow-ink)]">
      <div className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] sm:justify-center sm:py-10">
        <header className="flow-rise flex items-center justify-between gap-4">
          <div className="font-grotesk text-[26px] font-bold leading-none tracking-tight">
            flow<span className="text-[#9cc400]">_</span>
          </div>
          <span className="font-grotesk rounded-full border-[1.5px] border-[var(--flow-line)] px-3 py-1.5 text-[10px] font-bold tracking-[0.14em]">
            GUEST ACCESS
          </span>
        </header>

        <section
          aria-labelledby="login-heading"
          className="flow-rise mt-14 sm:mt-10"
          style={{ animationDelay: "70ms" }}
        >
          <p className="text-xs font-semibold text-[var(--flow-muted)]">
            พื้นที่วางแผนวันของคุณ
          </p>
          <h1
            id="login-heading"
            className="mt-2 max-w-sm text-[2rem] font-bold leading-[1.2] tracking-tight"
          >
            กลับมาคุมวันของคุณ
          </h1>
          <p className="mt-3 max-w-sm text-sm leading-6 text-[var(--flow-muted)]">
            ให้คนกรุงเทพคุมวันของตัวเอง ก่อนที่เมืองจะคุมเรา
          </p>
        </section>

        <aside
          aria-labelledby="guest-status-heading"
          className="flow-rise mt-7 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-2xl border-[1.5px] border-[var(--flow-line)] p-4"
          style={{ animationDelay: "130ms" }}
        >
          <span className="row-span-2 grid h-11 w-11 place-items-center rounded-xl bg-[var(--flow-lime)] text-[#111111]">
            <HardDrive aria-hidden="true" size={19} />
          </span>
          <h2 id="guest-status-heading" className="text-sm font-bold">
            Guest mode · ข้อมูลอยู่ในอุปกรณ์นี้
          </h2>
          <p className="flex items-center gap-1.5 text-xs leading-5 text-[var(--flow-muted)]">
            <CloudOff aria-hidden="true" size={14} className="shrink-0" />
            Cloud Sync ยังไม่ได้ตั้งค่า
          </p>
        </aside>

        <aside
          aria-labelledby="demo-account-heading"
          className="flow-inverse flow-pop mt-3 overflow-hidden rounded-2xl border-[1.5px] border-[#111111]"
          style={{ animationDelay: "180ms" }}
        >
          <div className="flex items-center justify-between gap-3 border-b border-current/20 px-5 py-3.5">
            <h2 id="demo-account-heading" className="text-sm font-semibold">
              บัญชีสำหรับทดลอง
            </h2>
            <span className="font-grotesk rounded-full bg-[var(--flow-lime)] px-2.5 py-1 text-[10px] font-bold tracking-[0.14em] text-[#111111]">
              PUBLIC DEMO
            </span>
          </div>
          <dl className="grid gap-3 px-5 py-4 text-sm">
            <div className="grid grid-cols-[5.5rem_1fr] items-baseline gap-3">
              <dt className="opacity-65">ชื่อผู้ใช้</dt>
              <dd className="font-grotesk min-w-0 break-all text-right font-semibold text-[var(--flow-lime)]">
                {DEMO_USERNAME}
              </dd>
            </div>
            <div className="grid grid-cols-[5.5rem_1fr] items-baseline gap-3">
              <dt className="opacity-65">รหัสผ่าน</dt>
              <dd className="font-grotesk text-right font-semibold text-[var(--flow-lime)]">
                {DEMO_PASSWORD}
              </dd>
            </div>
          </dl>
        </aside>

        <section
          aria-label="เข้าใช้งาน Flow"
          className="flow-rise mt-3 rounded-2xl border-[1.5px] border-[var(--flow-line)] p-5"
          style={{ animationDelay: "230ms" }}
        >
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2">
              <label htmlFor="username" className="text-sm font-semibold">
                ชื่อผู้ใช้
              </label>
              <input
                id="username"
                name="username"
                type="email"
                required
                autoComplete="username"
                placeholder="demo@flow.app"
                aria-invalid={error ? "true" : undefined}
                aria-describedby={error ? "login-error" : "login-local-note"}
                onInput={() => setError("")}
                className="font-grotesk h-12 w-full min-w-0 rounded-xl border-[1.5px] border-[var(--flow-line)] bg-[var(--flow-paper)] px-3.5 text-base text-[var(--flow-ink)] outline-none transition-[box-shadow,transform] duration-200 placeholder:text-[var(--flow-muted)] focus-visible:-translate-y-px md:text-sm motion-reduce:transition-none"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="password" className="text-sm font-semibold">
                รหัสผ่าน
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••"
                aria-invalid={error ? "true" : undefined}
                aria-describedby={error ? "login-error" : "login-local-note"}
                onInput={() => setError("")}
                className="font-grotesk h-12 w-full min-w-0 rounded-xl border-[1.5px] border-[var(--flow-line)] bg-[var(--flow-paper)] px-3.5 text-base text-[var(--flow-ink)] outline-none transition-[box-shadow,transform] duration-200 placeholder:text-[var(--flow-muted)] focus-visible:-translate-y-px md:text-sm motion-reduce:transition-none"
              />
            </div>

            <p
              id="login-error"
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className={
                error
                  ? "rounded-xl border-[1.5px] border-[var(--flow-line)] bg-[var(--flow-lime)] px-3 py-2.5 text-sm font-semibold text-[#111111]"
                  : "sr-only"
              }
            >
              {error}
            </p>

            <button
              type="submit"
              className="flow-press flow-inverse mt-1 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl px-4 text-base font-semibold outline-none transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 motion-reduce:transition-none"
            >
              เข้าสู่ระบบ
              <ArrowRight
                aria-hidden="true"
                size={18}
                className="text-[var(--flow-lime)]"
              />
            </button>

            <div className="flex items-center gap-3" aria-hidden="true">
              <span className="h-px flex-1 bg-[var(--flow-line)] opacity-20" />
              <span className="text-xs text-[var(--flow-muted)]">หรือ</span>
              <span className="h-px flex-1 bg-[var(--flow-line)] opacity-20" />
            </div>

            <button
              type="button"
              onClick={enterGuestMode}
              aria-describedby="quick-access-note login-local-note"
              className="flow-press flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-[1.5px] border-[var(--flow-line)] bg-[var(--flow-lime)] px-4 text-sm font-semibold text-[#111111] outline-none transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 motion-reduce:transition-none"
            >
              <Zap aria-hidden="true" size={17} className="fill-[#111111]" />
              เข้าใช้งานด่วน
            </button>
            <p
              id="quick-access-note"
              className="-mt-2 text-center text-xs text-[var(--flow-muted)]"
            >
              สำหรับทดลองใช้งานโดยไม่สร้างบัญชี
            </p>
          </form>
        </section>

        <footer
          id="login-local-note"
          className="flow-rise mt-5 text-center text-xs leading-5 text-[var(--flow-muted)]"
          style={{ animationDelay: "290ms" }}
        >
          <p>หน้านี้เป็นเดโม ยังไม่เชื่อมระบบบัญชี</p>
          <p>
            ทั้งสองวิธีเปิด Guest mode เท่านั้น ไม่มีการสร้างบัญชีหรือ Session
          </p>
          <p>ข้อมูลการเข้าสู่เดโมไม่ถูกส่งหรือบันทึก</p>
          <p>การเข้าใช้งานหมายถึงคุณได้รับทราบนโยบายสำหรับเว็บไซต์เดโมนี้</p>
          <Link
            href="/policy"
            className="mt-1 inline-flex min-h-11 items-center rounded-lg px-2 font-semibold text-[var(--flow-ink)] underline decoration-[#9cc400] decoration-2 underline-offset-4"
          >
            อ่านนโยบายการใช้งาน
          </Link>
        </footer>
      </div>
    </main>
  );
}
