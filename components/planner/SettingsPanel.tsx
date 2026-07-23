"use client";

import { useRef, useState } from "react";
import { BookOpen, CalendarPlus, GitCompareArrows, Map, RotateCcw, Sparkles, Trash2, Upload } from "lucide-react";
import type { AppSettings, FlowState } from "@/lib/types";
import { exportState, importState } from "@/lib/storage";
import { toCsv, toIcs } from "@/lib/calendar-export";

function download(name:string,content:string,type:string){const url=URL.createObjectURL(new Blob([content],{type}));const anchor=document.createElement("a");anchor.href=url;anchor.download=name;anchor.click();URL.revokeObjectURL(url);}

export type SettingsPanelProps = {
  state: FlowState;
  onReplace: (state: FlowState) => void;
  onSettings: (settings: AppSettings) => void;
  onAddCategory: (name: string) => void;
  onDeleteCategory: (id: string) => void;
  onStartCoreTour?: () => void;
  onStartFullTour?: () => void;
  onTrySampleDay?: () => void;
  onShowCalendarComparison?: () => void;
  onRestartGuide?: () => void;
  onRestartQuickStart?: () => void;
  /** Must reset onboarding/help state only. Task data remains owned by the caller. */
  onResetGuidance?: () => void | Promise<void>;
};

function HelpAction({ icon, label, description, onClick, featured = false }: {
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick?: () => void;
  featured?: boolean;
}) {
  return <button type="button" disabled={!onClick} onClick={onClick} className={`flow-press flex min-h-14 w-full items-start gap-3 rounded-xl border p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--flow-lime-dark)] disabled:cursor-not-allowed disabled:opacity-45 ${featured ? "border-[var(--flow-ink)] bg-[var(--flow-lime)] text-[#111111]" : "border-[var(--flow-line)]"}`}>
    <span aria-hidden className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${featured ? "bg-[#111111] text-[var(--flow-lime)]" : "bg-[var(--flow-surface)]"}`}>{icon}</span>
    <span className="min-w-0"><span className="block text-sm font-semibold">{label}</span><span className={`mt-0.5 block text-xs leading-5 ${featured ? "text-[#343434]" : "text-[var(--flow-muted)]"}`}>{description}</span></span>
  </button>;
}

export function SettingsPanel({
  state,
  onReplace,
  onSettings,
  onAddCategory,
  onDeleteCategory,
  onStartCoreTour,
  onStartFullTour,
  onTrySampleDay,
  onShowCalendarComparison,
  onRestartGuide,
  onRestartQuickStart,
  onResetGuidance,
}: SettingsPanelProps) {
  const file=useRef<HTMLInputElement>(null); const [preview,setPreview]=useState<FlowState|null>(null); const [importSource,setImportSource]=useState(""); const [mode,setMode]=useState<"merge"|"replace">("merge"); const [category,setCategory]=useState("");
  const [confirmingReset,setConfirmingReset]=useState(false); const [resetting,setResetting]=useState(false); const [resetError,setResetError]=useState("");

  const confirmGuidanceReset=async()=>{
    if(!onResetGuidance||resetting)return;
    setResetting(true);setResetError("");
    try{await onResetGuidance();setConfirmingReset(false);}
    catch(reason){setResetError(reason instanceof Error&&reason.message?reason.message:"รีเซ็ตคำแนะนำไม่สำเร็จ กรุณาลองอีกครั้ง");}
    finally{setResetting(false);}
  };

  return <div className="flow-form flow-stagger space-y-5">
    <section className="flow-card rounded-2xl p-4"><h2 className="font-bold">หน้าตาและเวลา</h2><label className="mt-3 block text-sm">ธีม<select value={state.settings.theme} onChange={e=>onSettings({...state.settings,theme:e.target.value as AppSettings["theme"]})} className="mt-1 h-12 w-full rounded-xl border border-[var(--flow-line)] bg-[var(--flow-paper)] px-3"><option value="system">ตามระบบ</option><option value="light">สว่าง</option><option value="dark">มืด</option></select></label><div className="mt-3 grid grid-cols-2 gap-2 [&>*]:min-w-0"><label className="text-sm">เริ่มไทม์ไลน์<input type="number" min="0" max={state.settings.timelineEndHour-1} value={state.settings.timelineStartHour} onChange={e=>onSettings({...state.settings,timelineStartHour:Math.min(Number(e.target.value),state.settings.timelineEndHour-1)})} className="font-grotesk mt-1 h-12 w-full rounded-xl border px-3"/></label><label className="text-sm">จบไทม์ไลน์<input type="number" min={state.settings.timelineStartHour+1} max="24" value={state.settings.timelineEndHour} onChange={e=>onSettings({...state.settings,timelineEndHour:Math.max(Number(e.target.value),state.settings.timelineStartHour+1)})} className="font-grotesk mt-1 h-12 w-full rounded-xl border px-3"/></label></div></section>
    <section className="flow-card rounded-2xl p-4"><h2 className="font-bold">หมวดหมู่</h2><div className="mt-3 flex gap-2"><input value={category} onChange={e=>setCategory(e.target.value)} placeholder="ชื่อหมวดหมู่" aria-label="ชื่อหมวดหมู่ใหม่" className="h-12 min-w-0 flex-1 rounded-xl border border-[var(--flow-line)] bg-transparent px-3"/><button type="button" className="flow-press flow-inverse h-12 rounded-xl px-4 font-semibold" onClick={()=>{if(category.trim()){onAddCategory(category.trim());setCategory("");}}}>เพิ่ม</button></div><ul className="mt-2">{state.categories.map(c=><li key={c.id} className="flex min-h-11 items-center justify-between border-b flow-hairline"><span>{c.name}</span><button type="button" aria-label={`ลบหมวด ${c.name}`} className="flow-press grid h-11 w-11 place-items-center rounded-xl" onClick={()=>onDeleteCategory(c.id)}><Trash2 size={16}/></button></li>)}</ul></section>
    <section className="flow-card scroll-mt-4 rounded-2xl p-4" aria-labelledby="flow-help-heading">
      <p className="font-grotesk text-[10px] font-bold tracking-[0.14em] text-[var(--flow-lime-dark)]">HELP &amp; ONBOARDING</p>
      <h2 id="flow-help-heading" className="mt-1 font-bold">วิธีใช้ Flow</h2>
      <p className="mt-1 text-sm leading-6 text-[var(--flow-muted)]">กลับมาดูวิธีจัดวันหรือลองตัวอย่างได้ทุกเมื่อ โดยไม่กระทบงานที่บันทึกไว้</p>
      <div className="mt-3 grid gap-2">
        <HelpAction featured icon={<Sparkles size={17}/>} label="เริ่ม Quick Start ใหม่" description="เพิ่มงานจริง แล้วให้ Flow จัดเวลาด้วยขั้นตอนแบบลงมือทำ" onClick={onRestartQuickStart}/>
        <HelpAction icon={<BookOpen size={17}/>} label="เริ่ม Product Guide ใหม่" description="ดูคำแนะนำ 3 หน้าโดยไม่ลบงานหรือการตั้งค่าเดิม" onClick={onRestartGuide}/>
        <HelpAction icon={<Sparkles size={17}/>} label="เปิด Core Tour" description="ดู Now / Next การจัดวัน Timeline และ Focus แบบสั้น" onClick={onStartCoreTour}/>
        <HelpAction icon={<Map size={17}/>} label="เปิด Full Tour" description="ทำความรู้จัก Today, ปฏิทิน ภาพรวม ค้นหา และตั้งค่า" onClick={onStartFullTour}/>
        <HelpAction icon={<CalendarPlus size={17}/>} label="ลองสร้างวันตัวอย่าง" description="เลือกตัวอย่าง แก้รายการ และยืนยันก่อนเพิ่มงานจริง" onClick={onTrySampleDay}/>
        <HelpAction icon={<GitCompareArrows size={17}/>} label="Flow ต่างจากปฏิทินอย่างไร" description="ดูว่า Flow ช่วยเปลี่ยนรายการงานให้เป็นแผนของวันอย่างไร" onClick={onShowCalendarComparison}/>
      </div>
      {!confirmingReset
        ? <button type="button" disabled={!onResetGuidance} onClick={()=>{setResetError("");setConfirmingReset(true);}} className="flow-press mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--flow-line)] px-3 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[var(--flow-lime-dark)] disabled:cursor-not-allowed disabled:opacity-45"><RotateCcw aria-hidden size={16}/>รีเซ็ตสถานะคำแนะนำ</button>
        : <div role="group" aria-label="ยืนยันรีเซ็ตสถานะคำแนะนำ" className="mt-3 rounded-xl border-[1.5px] border-[var(--flow-ink)] p-3">
          <p className="text-sm font-semibold">เริ่มคำแนะนำทั้งหมดใหม่?</p>
          <p className="mt-1 text-xs leading-5 text-[var(--flow-muted)]">ระบบจะล้างเฉพาะความคืบหน้า Guide และทัวร์ ไม่ลบงาน หมวดหมู่ Focus Session หรือการตั้งค่าอื่น</p>
          {resetError&&<p role="alert" className="mt-2 text-xs font-semibold text-[var(--flow-warning)]">{resetError}</p>}
          <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" disabled={resetting} onClick={()=>{setConfirmingReset(false);setResetError("");}} className="flow-press min-h-11 rounded-xl border border-[var(--flow-line)] px-3 text-sm font-semibold disabled:opacity-45">ยกเลิก</button><button type="button" disabled={resetting} onClick={confirmGuidanceReset} className="flow-press flow-inverse min-h-11 rounded-xl px-3 text-sm font-semibold disabled:opacity-45">{resetting?"กำลังรีเซ็ต…":"ยืนยันรีเซ็ต"}</button></div>
        </div>}
    </section>
    <section className="flow-card rounded-2xl p-4"><h2 className="font-bold">ข้อมูลของฉัน</h2><p className="mt-1 text-xs text-[var(--flow-muted)]">ข้อมูลอยู่ใน browser เครื่องนี้ โปรด export สำรองไว้ก่อนล้างข้อมูลเว็บไซต์</p><div className="mt-3 grid grid-cols-3 gap-2"><button type="button" className="flow-press min-h-12 rounded-xl border border-[var(--flow-line)] text-sm" onClick={()=>download("flow-data.json",exportState(state),"application/json")}>JSON</button><button type="button" className="flow-press min-h-12 rounded-xl border border-[var(--flow-line)] text-sm" onClick={()=>download("flow-tasks.csv",toCsv(state),"text/csv")}>CSV</button><button type="button" className="flow-press min-h-12 rounded-xl border border-[var(--flow-line)] text-sm" onClick={()=>download("flow-calendar.ics",toIcs(state),"text/calendar")}>ICS</button></div><input ref={file} type="file" accept="application/json,.json" className="sr-only" onChange={async e=>{const selected=e.target.files?.[0];if(selected){const source=await selected.text();setImportSource(source);setPreview(importState(source,state,mode));}}}/><button type="button" className="flow-press flow-inverse mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl font-semibold" onClick={()=>file.current?.click()}><Upload size={17}/>นำเข้า JSON</button>{preview&&<div className="flow-expand mt-3 rounded-xl bg-[var(--flow-lime)] p-3 text-[#111111]"><p className="font-semibold">ตัวอย่างก่อนนำเข้า: <span className="font-grotesk">{Object.values(preview.tasksByDay).flat().length}</span> งาน</p><select value={mode} onChange={e=>{const nextMode=e.target.value as "merge"|"replace";setMode(nextMode);if(importSource)setPreview(importState(importSource,state,nextMode));}} className="mt-2 h-11 w-full rounded-lg border bg-[var(--flow-paper)] px-2 text-[var(--flow-ink)]"><option value="merge">รวมกับข้อมูลเดิม</option><option value="replace">แทนที่ข้อมูลเดิม (มี backup ก่อน)</option></select><button type="button" className="flow-press mt-2 h-11 w-full rounded-lg bg-[#111111] font-semibold text-white" onClick={()=>{onReplace(preview);setPreview(null);setImportSource("");}}>ยืนยันนำเข้า</button></div>}</section>
    <section className="flow-surface rounded-2xl border-[1.5px] border-[var(--flow-line)] p-4"><h2 className="font-bold">การเชื่อมต่อ</h2><p className="mt-2 text-sm"><strong>Cloud Sync:</strong> ยังไม่ได้ตั้งค่า Supabase — ขณะนี้เป็น Guest mode และเก็บข้อมูลในเครื่อง</p><p className="mt-2 text-sm"><strong>Google Calendar:</strong> ยังไม่ได้ตั้งค่า OAuth — ใช้ ICS export ด้านบนได้</p><p className="mt-2 text-xs text-[var(--flow-muted)]">เราไม่สร้างระบบจำลองและไม่ส่ง API key จากฝั่ง client</p></section>
    <a href="/policy" className="flex min-h-11 items-center underline">นโยบายการใช้งานเว็บไซต์</a>
  </div>;
}
