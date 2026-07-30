"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { TaskInput } from "@/components/TaskInput";
import { FlowDialog } from "@/components/ui/flow-dialog";
import type { RepeatDraft } from "@/lib/task-form";
import type { Category, Task } from "@/lib/types";

export type { RepeatDraft } from "@/lib/task-form";

/**
 * Compatibility trigger for older call sites. The actual form, validation,
 * location picker and duration logic live in the same canonical TaskInput used
 * by the FAB add/edit flow.
 */
export function TaskComposer({ categories, date, order, onAdd }: {
  categories: Category[];
  date: string;
  order: number;
  onAdd: (task: Task, repeat: RepeatDraft) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="flow-press flow-inverse flex h-14 w-full items-center justify-center gap-2 rounded-2xl border-[1.5px] border-[#111111] font-semibold shadow-[var(--flow-shadow-small)]" onClick={() => setOpen(true)}>
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--flow-lime)] text-[#111111]"><Plus size={18} aria-hidden /></span>
        เพิ่มงาน
      </button>
      {open && (
        <FlowDialog title="เพิ่มงานในวัน" description="ใช้ฟอร์มเพิ่มงานหลักร่วมกับปุ่มเพิ่มงาน" onClose={() => setOpen(false)}>
          <TaskInput
            categories={categories}
            date={date}
            order={order}
            onAdd={async (task, repeat) => {
              await onAdd(task, repeat);
              setOpen(false);
            }}
          />
        </FlowDialog>
      )}
    </>
  );
}
