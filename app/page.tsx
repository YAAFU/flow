"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { BarChart3, CalendarDays, ChevronLeft, ChevronRight, Clock3, Focus, LayoutList, ListTodo, LogOut, Map as MapIcon, Plus, Search, Settings, Sparkles, Undo2, WifiOff } from "lucide-react";
import { GuidedTour, type GuidedTourMode, type GuidedTourView } from "@/components/GuidedTour";
import { InteractiveQuickStart } from "@/components/onboarding/InteractiveQuickStart";
import { MonthGrid } from "@/components/MonthGrid";
import { TaskInput } from "@/components/TaskInput";
import { PwaRegister } from "@/components/PwaRegister";
import { DashboardPanel } from "@/components/planner/DashboardPanel";
import { DayTimeline } from "@/components/planner/DayTimeline";
import { FocusPanel } from "@/components/planner/FocusPanel";
import { SearchPanel } from "@/components/planner/SearchPanel";
import { SettingsPanel } from "@/components/planner/SettingsPanel";
import { AIPlannerDialog, type PlannerAppendInput, type PlannerApplyInput, type PlannerDraftTask, type PlannerGenerateInput, type PlannerParseInput } from "@/components/planner/AIPlannerDialog";
import { TaskDatePicker } from "@/components/planner/TaskDatePicker";
import { TaskListView } from "@/components/planner/TaskListView";
import { TodayPulse } from "@/components/planner/TodayPulse";
import { FlowDialog as Modal } from "@/components/ui/flow-dialog";
import { replaceFlow } from "@/lib/flow-store";
import { buildLocalParsedTasks, ParsedTasksResponseSchema, type ParsedTasksResponse } from "@/lib/ai-parse";
import { appendPlannerDrafts, mergeScheduleIntoTasks, plannerDraftTaskId, plannerDraftToTask } from "@/lib/ai-task-merge";
import { buildLocalPlan } from "@/lib/local-planner";
import { DEFAULT_QUICK_LOCATIONS, hasCoordinates, taskLocationFromFlat, type TaskLocation } from "@/lib/location";
import { lockedTimesFromTasks } from "@/lib/planning-context";
import { getDueReminders, type DueReminder } from "@/lib/reminders";
import { mergeOccurrences, occurrencesForRange } from "@/lib/recurrence";
import {
  completeQuickStart,
  createDefaultOnboardingState,
  markExistingUserGuidance,
  recordQuickStartTask,
  resetOnboardingState,
  restartQuickStart,
  setTourStatus,
  skipQuickStart,
  type QuickStartState,
} from "@/lib/onboarding";
import { trackProductEvent } from "@/lib/product-analytics";
import { addDaysToDateKey, endTime, formatThaiTaskDate, localDateKey, localTimeKey } from "@/lib/time";
import { addTaskToDate, removeTaskFromDate, updateTaskInDate } from "@/lib/task-state";
import type { RepeatDraft } from "@/lib/task-form";
import { PlanResultSchema, TaskSchema, type FlowState, type FocusSession, type PlanResult, type RecurrenceRule, type Task } from "@/lib/types";
import { useFlowStore } from "@/hooks/useFlowStore";

type Tab = "today" | "calendar" | "dashboard" | "search" | "settings";
type DayView = "list" | "timeline" | "focus" | "map";
type TaskFlow = { mode: "choosingDate" } | { mode: "addingTask"; date: string } | { mode: "editingTask"; date: string; taskId: string };

const THAI_MONTHS=["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
const pad=(value:number)=>String(value).padStart(2,"0");
const dateKey=(year:number,month:number,day:number)=>`${year}-${pad(month+1)}-${pad(day)}`;
const NAV_TOUR:Partial<Record<Tab,string>>={calendar:"calendar-nav",dashboard:"dashboard-nav",search:"search-nav",settings:"settings-nav"};
const FlowMap=dynamic(()=>import("@/components/FlowMap").then(module=>module.FlowMap),{ssr:false,loading:()=> <div className="flow-surface grid min-h-72 place-items-center rounded-2xl border border-[var(--flow-line)] text-sm text-[var(--flow-muted)]">กำลังเปิดแผนที่…</div>});

function dateParts(value:string){const [year,month,day]=value.split("-").map(Number);return{year,month:month-1,day};}
function isDateKey(value:string|null):value is string{return Boolean(value&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(`${value}T00:00:00`)));}
function uid(prefix:string){return `${prefix}-${crypto.randomUUID()}`;}
function materializeTasksForDate(state:FlowState,date:string){const base=state.tasksByDay[date]??[];const templates=Object.values(state.tasksByDay).flat();const generated=state.recurrenceRules.flatMap(rule=>{const template=templates.find(task=>task.id===rule.taskId);return template?occurrencesForRange(template,rule,date,date):[];});return mergeOccurrences(base,generated);}
function attachPlannerRecurrences(date:string,tasks:Task[],drafts:PlannerDraftTask[],existingRules:RecurrenceRule[],now:string){const rules=[...existingRules];let next=[...tasks];for(const draft of drafts){if(draft.repeat==="none")continue;const taskId=plannerDraftTaskId(draft.draftId);if(!next.some(task=>task.id===taskId)||rules.some(rule=>rule.taskId===taskId))continue;const ruleId=uid("series");const dateValue=dateParts(date);const weekday=new Date(Date.UTC(dateValue.year,dateValue.month,dateValue.day)).getUTCDay();rules.push({id:ruleId,taskId,frequency:draft.repeat,interval:1,weekdays:draft.repeat==="weekly"?[weekday]:[],startDate:date,excludedDates:[],createdAt:now,updatedAt:now});next=next.map(task=>task.id===taskId?{...task,seriesId:ruleId,occurrenceDate:date}:task);}return{tasks:next,rules};}

export default function Home(){
  const router=useRouter();
  const {state,hydrated,updateFlow}=useFlowStore();
  const today=localDateKey();
  const [tab,setTab]=useState<Tab>("today");
  const [dayView,setDayView]=useState<DayView>("list");
  const [selectedDate,setSelectedDate]=useState(today);
  const parts=dateParts(selectedDate);
  const [monthCursor,setMonthCursor]=useState({year:parts.year,month:parts.month});
  const [undo,setUndo]=useState<{label:string;state:FlowState}|null>(null);
  const [online,setOnline]=useState(true);
  const [aiOpen,setAiOpen]=useState(false);
  const aiAbortRef=useRef<AbortController|null>(null);
  const [activeReminder,setActiveReminder]=useState<DueReminder|null>(null);
  const [carryOpen,setCarryOpen]=useState(false);
  const [taskFlow,setTaskFlow]=useState<TaskFlow|null>(null);
  const [tourMode,setTourMode]=useState<GuidedTourMode|null>(null);
  const [onboardingSuccessOpen,setOnboardingSuccessOpen]=useState(false);
  const [quickStart,setQuickStart]=useState<QuickStartState>(()=>createDefaultOnboardingState().quickStart);
  const [quickStartSuccessOpen,setQuickStartSuccessOpen]=useState(false);
  const quickStartSuccessPendingRef=useRef(false);
  const [guideNotice,setGuideNotice]=useState("");
  const addTaskTriggerRef=useRef<HTMLButtonElement>(null);
  const dayViewAnchorRef=useRef<HTMLDivElement>(null);
  const entryHandledRef=useRef(false);
  const timelineTrackedRef=useRef(false);
  const baseTasks=useMemo(()=>state.tasksByDay[selectedDate]??[],[selectedDate,state.tasksByDay]);
  const tasks=useMemo(()=>{
    const templates=Object.values(state.tasksByDay).flat();
    const generated=state.recurrenceRules.flatMap(rule=>{const template=templates.find(task=>task.id===rule.taskId);return template?occurrencesForRange(template,rule,selectedDate,selectedDate):[];});
    return mergeOccurrences(baseTasks,generated);
  },[baseTasks,selectedDate,state.recurrenceRules,state.tasksByDay]);
  const hasScheduledTasks=tasks.some(task=>Boolean(task.fixedTime)&&!task.allDay);
  const hasStartableScheduledTask=selectedDate===today&&tasks.some(task=>{
    if(task.done||task.allDay||!task.fixedTime)return false;
    return task.durationMin!=null?endTime(task.fixedTime,task.durationMin)>localTimeKey():task.fixedTime>=localTimeKey();
  });
  const totalTaskCount=Object.values(state.tasksByDay).flat().length;
  const taskQuickLocations=useMemo(()=>{
    const recent=Object.values(state.tasksByDay).flat()
      .filter(task=>Boolean(task.place)||task.lat!=null)
      .sort((left,right)=>Date.parse(right.updatedAt??right.createdAt??"")-Date.parse(left.updatedAt??left.createdAt??""))
      .map(taskLocationFromFlat)
      .filter((location):location is TaskLocation=>location!==null)
      // A previous one-shot location is a reusable suggestion, not a new live capture.
      .map(location=>({name:location.name,latitude:location.latitude,longitude:location.longitude,source:"quick" as const}));
    const savedHome=recent.find(location=>location.name.trim().toLocaleLowerCase("th-TH")==="บ้าน"&&location.latitude!=null&&location.longitude!=null);
    const home=savedHome??DEFAULT_QUICK_LOCATIONS.find(location=>location.name==="บ้าน");
    const ordered=[...(home?[home]:[]),...recent,...DEFAULT_QUICK_LOCATIONS.filter(location=>location.name!=="บ้าน")];
    const seen=new Set<string>();
    return ordered.filter(location=>{const key=location.name.trim().toLocaleLowerCase("th-TH");if(seen.has(key))return false;seen.add(key);return true;}).slice(0,10);
  },[state.tasksByDay]);

  useEffect(()=>{const sync=()=>setOnline(navigator.onLine);sync();window.addEventListener("online",sync);window.addEventListener("offline",sync);return()=>{window.removeEventListener("online",sync);window.removeEventListener("offline",sync);};},[]);
  useEffect(()=>{const root=document.documentElement;const dark=state.settings.theme==="dark"||(state.settings.theme==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);root.dataset.theme=dark?"dark":"light";},[state.settings.theme]);
  useEffect(()=>{
    if(!hydrated||entryHandledRef.current)return;
    const timer=window.setTimeout(()=>{
      if(entryHandledRef.current)return;
       entryHandledRef.current=true;
       const params=new URLSearchParams(window.location.search);
       const guidance=markExistingUserGuidance(window.localStorage,totalTaskCount>0);
       setQuickStart(guidance.quickStart);
      const requestedDate=params.get("date");
      if(isDateKey(requestedDate)){
        setSelectedDate(requestedDate);
        const next=dateParts(requestedDate);
        setMonthCursor({year:next.year,month:next.month});
        updateFlow(previous=>previous.selectedDate===requestedDate?previous:{...previous,selectedDate:requestedDate});
      }
      const requestedView=params.get("view");
      if(requestedView==="timeline"||requestedView==="focus"||requestedView==="list"||requestedView==="map"){
        setTab("today");
        setDayView(requestedView);
      }
      if(params.get("onboarding")==="success"){
        setOnboardingSuccessOpen(true);
        timelineTrackedRef.current=true;
        trackProductEvent("first_timeline_viewed",{entryPoint:"guide"});
      }
       if(params.get("quickStart")==="1"&&guidance.quickStart.status==="started"){
         setTab("today");
         setDayView("list");
       }
       if(params.size>0)window.history.replaceState(window.history.state,"",window.location.pathname);
    },0);
    return()=>window.clearTimeout(timer);
  },[hydrated,totalTaskCount,updateFlow]);
  useEffect(()=>{if(!hydrated||state.selectedDate===selectedDate)return;const frame=requestAnimationFrame(()=>{setSelectedDate(state.selectedDate);const next=dateParts(state.selectedDate);setMonthCursor({year:next.year,month:next.month});});return()=>cancelAnimationFrame(frame);},[hydrated,selectedDate,state.selectedDate]);
  useEffect(()=>{if(!undo)return;const timer=window.setTimeout(()=>setUndo(null),8000);return()=>window.clearTimeout(timer);},[undo]);
  useEffect(()=>{if(!guideNotice)return;const timer=window.setTimeout(()=>setGuideNotice(""),5000);return()=>window.clearTimeout(timer);},[guideNotice]);
  useEffect(()=>{if(!hydrated||dayView!=="timeline"||!tasks.length||timelineTrackedRef.current)return;timelineTrackedRef.current=true;trackProductEvent("first_timeline_viewed",{entryPoint:"today"});},[dayView,hydrated,tasks.length]);
  useEffect(()=>{if(!state.settings.notificationsEnabled)return;const check=()=>{const notified=new Set(state.reminderLog.map(item=>item.id));const due=getDueReminders(state.tasksByDay,new Date(),notified);if(!due.length)return;setActiveReminder(due[0]);due.forEach(item=>{if(Notification.permission==="granted")new Notification(item.task.title,{body:`เริ่ม ${item.task.fixedTime} · ${item.task.place||"ไม่มีสถานที่"}`,tag:item.id});});updateFlow(previous=>({...previous,reminderLog:[...previous.reminderLog,...due.map(item=>({id:item.id,taskId:item.task.id,occurrenceDate:item.date,offsetMin:item.offsetMin,notifiedAt:new Date().toISOString()}))]}));};const timer=window.setInterval(check,30_000);return()=>window.clearInterval(timer);},[state.settings.notificationsEnabled,state.reminderLog,state.tasksByDay,updateFlow]);

  const commit=(recipe:(previous:FlowState)=>FlowState,label?:string)=>{const snapshot=state;updateFlow(recipe);if(label)setUndo({label,state:snapshot});};
  const addTaskForDate=(date:string,task:Task,repeat:RepeatDraft)=>{const now=new Date().toISOString();commit(previous=>{const recurrenceRules=[...previous.recurrenceRules];let nextTask=task;if(repeat.frequency!=="none"){const ruleId=uid("series");const dateValue=dateParts(date);const weekday=new Date(Date.UTC(dateValue.year,dateValue.month,dateValue.day)).getUTCDay();recurrenceRules.push({id:ruleId,taskId:task.id,frequency:repeat.frequency,interval:1,weekdays:repeat.frequency==="weekly"?[weekday]:[],startDate:date,excludedDates:[],createdAt:now,updatedAt:now});nextTask={...task,seriesId:ruleId,occurrenceDate:date};}return{...previous,selectedDate:date,tasksByDay:addTaskToDate(previous.tasksByDay,date,TaskSchema.parse(nextTask)),recurrenceRules};},"เพิ่มงานแล้ว");};
  const updateTask=(next:Task)=>commit(previous=>{if(!(previous.tasksByDay[selectedDate]??[]).some(task=>task.id===next.id))return previous;return{...previous,tasksByDay:updateTaskInDate(previous.tasksByDay,selectedDate,next)};},"อัปเดตงานแล้ว");
  const removeTask=(id:string)=>commit(previous=>({...previous,tasksByDay:removeTaskFromDate(previous.tasksByDay,selectedDate,id)}),"ลบงานแล้ว");
  const toggleTask=(id:string)=>commit(previous=>{const existing=(previous.tasksByDay[selectedDate]??[]).find(task=>task.id===id);if(!existing)return previous;const now=new Date();const next=TaskSchema.parse({...existing,done:!existing.done,completedAt:!existing.done?now.toISOString():undefined,updatedAt:now.toISOString()});return{...previous,tasksByDay:updateTaskInDate(previous.tasksByDay,selectedDate,next,now)};},"อัปเดตงานแล้ว");
  const showDate=(date:string)=>{setSelectedDate(date);const next=dateParts(date);setMonthCursor({year:next.year,month:next.month});setTab("today");};
  const selectDate=(date:string)=>{showDate(date);try{updateFlow(previous=>previous.selectedDate===date?previous:{...previous,selectedDate:date});}catch{/* การเลือกวันยังทำงานได้ แม้เบราว์เซอร์ปฏิเสธการเขียนค่าหน้าปัจจุบัน */}};
  const changeDay=(offset:number)=>selectDate(addDaysToDateKey(selectedDate,offset));
  const openTaskCreator=()=>setTaskFlow(tab==="today"?{mode:"addingTask",date:selectedDate}:{mode:"choosingDate"});
  const pickTaskDate=(date:string)=>{selectDate(date);setDayView("list");setTaskFlow({mode:"addingTask",date});};
  const saveNewTask=async(task:Task,repeat:RepeatDraft={frequency:"none"})=>{if(taskFlow?.mode!=="addingTask")throw new Error("ไม่มีวันที่สำหรับงานใหม่");const date=taskFlow.date;const isFirstTask=totalTaskCount===0;addTaskForDate(date,task,repeat);if(isFirstTask)trackProductEvent("first_task_created",{entryPoint:"today"});if(quickStart.status==="started"&&quickStart.stage==="add_task"){const next=recordQuickStartTask(window.localStorage,task.id,Boolean(task.fixedTime));setQuickStart(next.quickStart);trackProductEvent("quick_start_task_created");if(task.fixedTime)setQuickStartSuccessOpen(true);}showDate(date);setDayView("list");setTaskFlow(null);};
  const saveEditedTask=async(task:Task)=>{if(taskFlow?.mode!=="editingTask")throw new Error("ไม่พบงานที่กำลังแก้ไข");const date=taskFlow.date;updateFlow(previous=>({...previous,selectedDate:date,tasksByDay:updateTaskInDate(previous.tasksByDay,date,task)}));if(quickStart.status==="started"&&quickStart.stage==="schedule_task"&&quickStart.taskId===task.id&&task.fixedTime){const next=recordQuickStartTask(window.localStorage,task.id,true);setQuickStart(next.quickStart);setQuickStartSuccessOpen(true);}showDate(date);setDayView("list");setTaskFlow(null);};
  const openTaskEditor=(id:string)=>{if((state.tasksByDay[selectedDate]??[]).some(task=>task.id===id))setTaskFlow({mode:"editingTask",date:selectedDate,taskId:id});};
  const focusComplete=(session:FocusSession,updateDuration:boolean)=>commit(previous=>({...previous,focusSessions:[...previous.focusSessions,session],tasksByDay:updateDuration&&session.taskId?Object.fromEntries(Object.entries(previous.tasksByDay).map(([date,items])=>[date,items.map(task=>task.id===session.taskId?{...task,durationMin:session.actualMin||task.durationMin,updatedAt:new Date().toISOString()}:task)])):previous.tasksByDay}),"บันทึก Focus แล้ว");
  const monthLoad=useMemo(()=>Object.fromEntries(Object.entries(state.tasksByDay).filter(([date,items])=>date.startsWith(`${monthCursor.year}-${pad(monthCursor.month+1)}`)&&items.length>0).map(([date,items])=>[Number(date.slice(-2)),Math.min(1,items.length/6)])),[state.tasksByDay,monthCursor]);
  const monthStatus=useMemo(()=>Object.fromEntries(Object.entries(state.tasksByDay).filter(([date,items])=>date.startsWith(`${monthCursor.year}-${pad(monthCursor.month+1)}`)&&items.length>0).map(([date,items])=>[Number(date.slice(-2)),items.every(task=>task.done)?"done":date<today?"miss":"pending"])) as Record<number,"done"|"miss"|"pending">,[state.tasksByDay,monthCursor,today]);
  const pastUnfinished=Object.entries(state.tasksByDay).filter(([date])=>date<today).flatMap(([date,items])=>items.filter(task=>!task.done).map(task=>({date,task}))).slice(0,20);
  const editingTask=taskFlow?.mode==="editingTask"?(state.tasksByDay[taskFlow.date]??[]).find(task=>task.id===taskFlow.taskId)??null:null;

  const requestNotifications=async()=>{if(!("Notification" in window))return;const permission=await Notification.requestPermission();if(permission==="granted")updateFlow(previous=>({...previous,settings:{...previous.settings,notificationsEnabled:true}}));};
  const requestAiJson=async(path:string,body:unknown,timeoutMs:number)=>{aiAbortRef.current?.abort();const controller=new AbortController();aiAbortRef.current=controller;let timedOut=false;const timer=window.setTimeout(()=>{timedOut=true;controller.abort();},timeoutMs);try{const response=await fetch(path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),signal:controller.signal});if(!response.ok)throw new Error(`request_${response.status}`);return await response.json() as unknown;}catch(error){if(controller.signal.aborted){if(timedOut)throw new Error("request_timeout");const cancelled=new Error("cancelled");cancelled.name="AbortError";throw cancelled;}throw error;}finally{window.clearTimeout(timer);if(aiAbortRef.current===controller)aiAbortRef.current=null;}};
  const parsePlannerInput=async(input:PlannerParseInput):Promise<ParsedTasksResponse>=>{try{return ParsedTasksResponseSchema.parse(await requestAiJson("/api/parse",{text:input.text,nowIso:new Date().toISOString(),timezone:"Asia/Bangkok",selectedDate:input.targetDate},25_000));}catch(error){if(error instanceof Error&&error.name==="AbortError")throw error;return ParsedTasksResponseSchema.parse({tasks:buildLocalParsedTasks(input.text,input.targetDate),mode:"local"});}};
  const plannerTasks=(input:PlannerGenerateInput)=>{const now=new Date().toISOString();const draftTasks=input.drafts.map((draft,index)=>plannerDraftToTask(draft,input.currentTasks.length+index,state.categories,now));const ids=new Set(input.currentTasks.map(task=>task.id));for(const task of draftTasks){if(ids.has(task.id))throw new Error("พบงานฉบับร่างซ้ำ กรุณาสร้างฉบับร่างใหม่");ids.add(task.id);}return[...input.currentTasks,...draftTasks];};
  const generatePlannerPlan=async(input:PlannerGenerateInput):Promise<PlanResult>=>{const nextTasks=plannerTasks(input);if(!nextTasks.length)throw new Error("ยังไม่มีงานสำหรับจัดแผน");const constraints={dayStart:input.dayStart,dayEnd:input.dayEnd,breakMin:input.breakMinutes};const startLocation=input.startLocation&&hasCoordinates(input.startLocation)?{name:input.startLocation.name,latitude:input.startLocation.latitude,longitude:input.startLocation.longitude,source:input.startLocation.source,accuracy:input.startLocation.accuracy,capturedAt:input.startLocation.capturedAt}:undefined;const planningContext={date:input.targetDate,timezone:"Asia/Bangkok",energyLevel:input.energyLevel,startLocation,tasks:nextTasks,lockedTimes:lockedTimesFromTasks(nextTasks)};try{return PlanResultSchema.parse(await requestAiJson("/api/plan",{planningContext,...constraints},32_000));}catch(error){if(error instanceof Error&&error.name==="AbortError")throw error;return PlanResultSchema.parse(buildLocalPlan(nextTasks,{...constraints,energyLevel:input.energyLevel,startLocation}));}};
  const revealPlannerDate=(date:string)=>{showDate(date);setDayView("list");updateFlow(previous=>previous.selectedDate===date?previous:{...previous,selectedDate:date});};
  const appendAiDrafts=({targetDate,drafts}:PlannerAppendInput)=>{const now=new Date().toISOString();commit(previous=>{const appended=appendPlannerDrafts(previous.tasksByDay[targetDate]??[],drafts,previous.categories,now);const withRecurrence=attachPlannerRecurrences(targetDate,appended,drafts,previous.recurrenceRules,now);return{...previous,selectedDate:targetDate,tasksByDay:{...previous.tasksByDay,[targetDate]:withRecurrence.tasks.map(task=>TaskSchema.parse(task))},recurrenceRules:withRecurrence.rules};},"เพิ่มงานจากฉบับร่างแล้ว");revealPlannerDate(targetDate);};
  const applyPlannerPlan=(input:PlannerApplyInput)=>{const now=new Date().toISOString();const schedule=input.plan.plans[input.variant].schedule;const merged=mergeScheduleIntoTasks({existing:input.allCurrentTasks,drafts:input.drafts,schedule,categories:state.categories,now,createId:()=>uid("ai-plan")});commit(previous=>{const withRecurrence=attachPlannerRecurrences(input.targetDate,merged.tasks,merged.includedDrafts,previous.recurrenceRules,now);return{...previous,selectedDate:input.targetDate,tasksByDay:{...previous.tasksByDay,[input.targetDate]:withRecurrence.tasks.map(task=>TaskSchema.parse(task))},recurrenceRules:withRecurrence.rules};},`ใช้แผน ${input.variant} แล้ว`);if(quickStart.status==="started"&&quickStart.stage==="schedule_task"&&quickStart.taskId&&schedule.some(item=>item.taskId===quickStart.taskId)){const next=recordQuickStartTask(window.localStorage,quickStart.taskId,true);setQuickStart(next.quickStart);quickStartSuccessPendingRef.current=true;trackProductEvent("quick_start_plan_applied",{plannerMode:input.plan.mode??"local"});}revealPlannerDate(input.targetDate);};
  const cancelPlannerRequest=()=>{aiAbortRef.current?.abort();aiAbortRef.current=null;};
  const navigateTour=(view:GuidedTourView)=>{
    if(view==="today"){setTab("today");setDayView("list");return;}
    if(view==="timeline"||view==="focus"){setTab("today");setDayView(view);return;}
    setTab(view);
  };
  const reopenTour=(mode:GuidedTourMode)=>{setTaskFlow(null);setAiOpen(false);setQuickStartSuccessOpen(false);setTourMode(mode);trackProductEvent("tour_reopened",{entryPoint:"settings"});};
  const changeActiveFocus=(active:FlowState["activeFocusSession"])=>{if(active&&!state.activeFocusSession)trackProductEvent("first_focus_started",{entryPoint:"today"});updateFlow(previous=>({...previous,activeFocusSession:active}));};
  const resetGuidance=()=>{const next=resetOnboardingState(window.localStorage);quickStartSuccessPendingRef.current=false;setQuickStart(next.quickStart);setQuickStartSuccessOpen(false);setTourMode(null);setGuideNotice("รีเซ็ตคำแนะนำแล้ว งานและการตั้งค่าเดิมยังอยู่ครบ");};
  const openQuickStartTask=()=>{setTourMode(null);setTab("today");setDayView("list");setTaskFlow({mode:"addingTask",date:selectedDate});};
  const openQuickStartPlanner=()=>{setTourMode(null);setTab("today");setAiOpen(true);trackProductEvent("quick_start_planner_opened");};
  const skipActiveQuickStart=()=>{const next=skipQuickStart(window.localStorage);quickStartSuccessPendingRef.current=false;setQuickStart(next.quickStart);setQuickStartSuccessOpen(false);trackProductEvent("quick_start_skipped",{entryPoint:"today"});};
  const restartQuickStartFromSettings=()=>{const next=restartQuickStart(window.localStorage);setQuickStart(next.quickStart);setTourMode(null);setAiOpen(false);setTaskFlow(null);setTab("today");setDayView("list");trackProductEvent("quick_start_started",{entryPoint:"settings"});};
  const finishQuickStart=()=>{if(quickStart.status==="completed")return;const next=completeQuickStart(window.localStorage);setQuickStart(next.quickStart);trackProductEvent("quick_start_completed",{completionStatus:"success"});};
  const closeTour=(outcome:"completed"|"skipped")=>{if(tourMode)setTourStatus(window.localStorage,tourMode,outcome);setTourMode(null);};
  const primaryOpensFocus=Boolean(state.activeFocusSession)||hasStartableScheduledTask;
  const primaryFocusLabel=state.activeFocusSession?"กลับไปโหมดโฟกัส":hasStartableScheduledTask?"เริ่มงานถัดไป":selectedDate===today?"ดู Timeline ของวันนี้":"ดู Timeline ของวันนั้น";

  const title=tab==="today"?"วันนี้":tab==="calendar"?"ปฏิทิน":tab==="dashboard"?"ภาพรวม":tab==="search"?"ค้นหา":"ตั้งค่า";
  return <main className="min-h-dvh bg-[var(--flow-paper)] pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)] text-[var(--flow-ink)]"><PwaRegister/><div className="mx-auto w-full max-w-[420px] px-4 pt-5">
    <header className="flow-rise mb-5 flex items-center justify-between"><div><Link href="/app" className="font-grotesk inline-flex min-h-11 items-center text-[22px] font-bold tracking-[-0.04em]">flow<span className="text-[var(--flow-lime-dark)]">_</span></Link><h1 className="-mt-0.5 text-[26px] font-bold leading-tight tracking-[-0.02em]">{title}</h1></div><div className="flex items-center gap-1.5">{!online&&<span className="flex min-h-9 items-center gap-1 rounded-full border border-[var(--flow-line)] px-2 text-xs"><WifiOff size={13}/>ออฟไลน์</span>}<Link href="/login" aria-label="ออกจาก Guest mode และกลับหน้าเข้าสู่ระบบ" className="flow-press flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--flow-line)] px-2.5 text-xs font-semibold"><span className="font-grotesk">GUEST</span><LogOut size={14} aria-hidden /></Link></div></header>

    {tab==="today"&&<>
      <div className="flow-inverse mb-3 flex items-center justify-between rounded-2xl border-[1.5px] border-[#111111] p-2 shadow-[var(--flow-shadow-small)]"><button aria-label="วันก่อนหน้า" className="grid h-11 w-11 place-items-center rounded-xl hover:bg-white/10" onClick={()=>changeDay(-1)}><ChevronLeft/></button><button className="min-h-11 rounded-xl px-4 text-center hover:bg-white/10" onClick={()=>selectDate(today)}><strong className="block">{selectedDate===today?"วันนี้":formatThaiTaskDate(selectedDate)}</strong><span className="font-grotesk text-xs text-[var(--flow-lime)]">{selectedDate}</span></button><button aria-label="วันถัดไป" className="grid h-11 w-11 place-items-center rounded-xl hover:bg-white/10" onClick={()=>changeDay(1)}><ChevronRight/></button></div>
      {hasScheduledTasks&&<TodayPulse date={selectedDate} tasks={tasks} startHour={state.settings.timelineStartHour} endHour={state.settings.timelineEndHour} primaryLabel={primaryFocusLabel} primaryIcon={primaryOpensFocus?"play":"timeline"} onOpenTimeline={()=>setDayView("timeline")} onStartFocus={()=>setDayView(primaryOpensFocus?"focus":"timeline")}/>}
  {tasks.length>0&&<section data-tour="ai-planner" data-quick-start="schedule-task" aria-labelledby="flow-planner-heading" className={`flow-card overflow-hidden rounded-[22px] ${hasScheduledTasks?"my-4":"mb-4"}`}><div className="border-b flow-hairline px-5 py-4"><div className="flex items-center justify-between gap-3"><p className="font-grotesk text-[10px] font-bold tracking-[0.14em] text-[var(--flow-lime-dark)]">FLOW PLANNER</p><span className="rounded-full bg-[var(--flow-lime)] px-2.5 py-1 text-[10px] font-semibold text-[#111111]">{online?"ใช้ AI หรือจัดในเครื่อง":"จัดในเครื่อง"}</span></div><h2 id="flow-planner-heading" className="mt-2 text-xl font-bold">{hasScheduledTasks?"อยากปรับแผนของวันนี้?":"มีงานแล้ว ให้ Flow ช่วยจัดเวลา"}</h2><p className="mt-1 text-sm leading-6 text-[var(--flow-muted)]">Flow จะเสนอเวลา ตรวจช่วงชน และให้คุณเลือกแผนก่อนบันทึกจริง</p></div><div className="p-3"><button data-tour={hasScheduledTasks?undefined:"primary-action"} type="button" onClick={()=>setAiOpen(true)} className={`flow-press flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl px-4 font-semibold ${hasScheduledTasks?"border-[1.5px] border-[var(--flow-line)]":"flow-inverse"}`}><Sparkles size={18} aria-hidden className="text-[var(--flow-lime-dark)]"/>{hasScheduledTasks?"จัดแผนใหม่":"ให้ Flow จัดวัน"}</button><p className="mt-2 text-center text-xs text-[var(--flow-muted)]">ถ้า AI ใช้ไม่ได้ ระบบจะจัดแผนในเครื่องให้ต่อได้ทันที</p></div></section>}
      {pastUnfinished.length>0&&selectedDate===today&&<button className="mb-3 min-h-12 w-full rounded-xl border-[1.5px] border-amber-500 px-3 text-left text-sm font-semibold" onClick={()=>setCarryOpen(true)}>มีงานค้าง {pastUnfinished.length} งาน · เลือกย้ายมาวันนี้</button>}
      {tasks.length>0&&<div ref={dayViewAnchorRef} data-tour="day-view-switcher" role="tablist" aria-label="รูปแบบการดูวัน" className="flow-surface mb-4 grid grid-cols-4 scroll-mt-4 rounded-2xl border border-[var(--flow-line)] p-1">{[["list","รายการ",LayoutList],["timeline","เวลา",Clock3],["focus","โฟกัส",Focus],["map","แผนที่",MapIcon]].map(([value,label,Icon])=><button key={String(value)} role="tab" aria-selected={dayView===value} aria-label={`ดูแบบ${String(label)}`} onClick={()=>setDayView(value as DayView)} className={`relative flex min-h-11 items-center justify-center gap-1 rounded-xl text-xs ${dayView===value?"bg-[var(--flow-ink)] text-[var(--flow-paper)] shadow-[var(--flow-shadow-small)]":"text-[var(--flow-muted)]"}`}><Icon size={15}/>{String(label)}{dayView===value&&<span aria-hidden className="absolute inset-x-3 -bottom-1 h-0.5 rounded-full bg-[var(--flow-lime)]"/>}</button>)}</div>}
      <div key={`${dayView}-${selectedDate}`} className="flow-view">
        {dayView==="timeline"&&<DayTimeline date={selectedDate} tasks={tasks} categories={state.categories} startHour={state.settings.timelineStartHour} endHour={state.settings.timelineEndHour} onChange={updateTask} onDelete={removeTask} onToggle={toggleTask}/>}
        {dayView==="list"&&<TaskListView tasks={tasks} categories={state.categories} onToggle={toggleTask} onEdit={openTaskEditor} onDelete={removeTask} onAdd={()=>setTaskFlow({mode:"addingTask",date:selectedDate})} onTryExample={()=>router.push("/guide?start=templates")} onOpenGuide={()=>router.push("/guide?restart=1")}/>}
        {dayView==="focus"&&<FocusPanel tasks={tasks} sessions={state.focusSessions} active={state.activeFocusSession} onActiveChange={changeActiveFocus} onComplete={focusComplete}/>}
        {dayView==="map"&&(online?<FlowMap items={tasks.filter(task=>task.fixedTime).map(task=>({taskId:task.id,title:task.title,placeLabel:task.place,start:task.fixedTime??"00:00",end:task.fixedTime&&task.durationMin?endTime(task.fixedTime,task.durationMin):task.fixedTime??"00:00",travelFromPrevMin:0,aiAdded:task.aiAdded}))} coords={Object.fromEntries(tasks.filter(task=>task.lat!=null&&task.lng!=null).map(task=>[task.id,{lat:task.lat!,lng:task.lng!}]))}/>:<p className="flow-surface rounded-2xl border p-5 text-sm">แผนที่และเส้นทางใช้งานไม่ได้ขณะออฟไลน์</p>)}
      </div>
    </>}

    {tab==="calendar"&&<section className="flow-rise"><div className="mb-4 flex items-center justify-between"><button aria-label="เดือนก่อน" className="grid h-11 w-11 place-items-center" onClick={()=>setMonthCursor(current=>current.month===0?{year:current.year-1,month:11}:{...current,month:current.month-1})}><ChevronLeft/></button><h2 className="font-bold">{THAI_MONTHS[monthCursor.month]} <span className="font-grotesk">{monthCursor.year+543}</span></h2><button aria-label="เดือนถัดไป" className="grid h-11 w-11 place-items-center" onClick={()=>setMonthCursor(current=>current.month===11?{year:current.year+1,month:0}:{...current,month:current.month+1})}><ChevronRight/></button></div><MonthGrid year={monthCursor.year} month={monthCursor.month} load={monthLoad} status={monthStatus} today={today.startsWith(`${monthCursor.year}-${pad(monthCursor.month+1)}`)?Number(today.slice(-2)):undefined} selected={selectedDate.startsWith(`${monthCursor.year}-${pad(monthCursor.month+1)}`)?Number(selectedDate.slice(-2)):undefined} onPick={day=>selectDate(dateKey(monthCursor.year,monthCursor.month,day))}/></section>}
    {tab==="dashboard"&&<DashboardPanel state={state}/>} 
    {tab==="search"&&<SearchPanel tasksByDay={state.tasksByDay} categories={state.categories} onOpen={selectDate}/>} 
  {tab==="settings"&&<SettingsPanel state={state} onReplace={next=>{localStorage.setItem("flow_state_backup_v1",JSON.stringify(state));replaceFlow(next);}} onSettings={settings=>updateFlow(previous=>({...previous,settings}))} onAddCategory={name=>updateFlow(previous=>({...previous,categories:[...previous.categories,{id:uid("category"),name,createdAt:new Date().toISOString()}]}))} onDeleteCategory={id=>commit(previous=>({...previous,categories:previous.categories.filter(category=>category.id!==id),tasksByDay:Object.fromEntries(Object.entries(previous.tasksByDay).map(([date,items])=>[date,items.map(task=>task.categoryId===id?{...task,categoryId:undefined}:task)]))}),"ลบหมวดหมู่แล้ว")} onStartCoreTour={()=>reopenTour("core")} onStartFullTour={()=>reopenTour("full")} onTrySampleDay={()=>router.push("/guide?start=templates")} onShowCalendarComparison={()=>router.push("/guide?start=comparison")} onRestartGuide={()=>router.push("/guide?restart=1")} onRestartQuickStart={restartQuickStartFromSettings} onResetGuidance={resetGuidance}/>}
    {tab==="settings"&&!state.settings.notificationsEnabled&&<button className="mt-4 min-h-12 w-full rounded-xl bg-[var(--flow-lime)] px-3 font-semibold text-[#111]" onClick={requestNotifications}>เปิดการแจ้งเตือนบนอุปกรณ์นี้</button>}
  </div>
  {(tab==="calendar"||tab==="dashboard"||(tab==="today"&&tasks.length>0&&dayView==="list"))&&!taskFlow&&!aiOpen&&!carryOpen&&<div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-40 mx-auto h-16 max-w-[420px]"><button ref={addTaskTriggerRef} data-quick-start={tab==="today"?"add-task":undefined} type="button" aria-label={tab==="today"?`เพิ่มงานใน ${formatThaiTaskDate(selectedDate)}`:"เลือกวันเพื่อเพิ่มงาน"} onClick={openTaskCreator} className="flow-press flow-inverse pointer-events-auto absolute right-4 grid h-14 w-14 place-items-center rounded-2xl border-[1.5px] border-[#111111] shadow-[var(--flow-shadow)]"><Plus aria-hidden size={25} className="text-[var(--flow-lime)]" /></button></div>}
  <nav aria-label="เมนูหลัก" className="fixed inset-x-0 bottom-0 z-30 mx-auto flex min-h-20 max-w-[420px] items-start justify-around border-t border-[var(--flow-line)] bg-[color-mix(in_srgb,var(--flow-paper)_92%,transparent)] px-2 pt-2 pb-[max(.5rem,env(safe-area-inset-bottom))] shadow-[0_-10px_30px_rgba(17,17,17,.06)] backdrop-blur-xl">{[["today","วันนี้",ListTodo],["calendar","ปฏิทิน",CalendarDays],["dashboard","ภาพรวม",BarChart3],["search","ค้นหา",Search],["settings","ตั้งค่า",Settings]].map(([value,label,Icon])=><button key={String(value)} data-tour={NAV_TOUR[value as Tab]} onClick={()=>setTab(value as Tab)} aria-current={tab===value?"page":undefined} className={`relative flex min-h-14 min-w-14 flex-col items-center justify-center gap-1 rounded-xl text-[10px] ${tab===value?"font-bold text-[var(--flow-ink)]":"text-[var(--flow-muted)]"}`}><span className={`grid h-7 w-9 place-items-center rounded-lg ${tab===value?"bg-[var(--flow-ink)] text-[var(--flow-lime)]":""}`}><Icon size={18} strokeWidth={tab===value?2.5:1.8}/></span>{String(label)}{tab===value&&<span aria-hidden className="absolute -top-2 h-1 w-7 rounded-b-full bg-[var(--flow-lime-dark)]"/>}</button>)}</nav>
  {hydrated&&tourMode&&<GuidedTour active mode={tourMode} onNavigate={navigateTour} onClose={closeTour} returnFocus={()=>document.querySelector<HTMLElement>('nav[aria-label="เมนูหลัก"] button[aria-current="page"]')}/>}
  {hydrated&&<InteractiveQuickStart state={quickStart} active={tab==="today"} blocked={Boolean(taskFlow)||aiOpen||Boolean(tourMode)||Boolean(activeReminder)||carryOpen} showSuccess={quickStartSuccessOpen} onAddTask={openQuickStartTask} onScheduleTask={openQuickStartPlanner} onSkip={skipActiveQuickStart} onSuccessShown={finishQuickStart} onViewTimeline={()=>{setQuickStartSuccessOpen(false);setTab("today");setDayView("timeline");window.requestAnimationFrame(()=>dayViewAnchorRef.current?.scrollIntoView({block:"start",behavior:"smooth"}));}} onStartFocus={()=>{setQuickStartSuccessOpen(false);setTab("today");setDayView("focus");window.requestAnimationFrame(()=>dayViewAnchorRef.current?.scrollIntoView({block:"start",behavior:"smooth"}));}}/>}
  {taskFlow?.mode==="choosingDate"&&<TaskDatePicker initialDate={selectedDate<today?today:selectedDate} today={today} tasksByDay={state.tasksByDay} onPick={pickTaskDate} onClose={()=>setTaskFlow(null)} returnFocusRef={addTaskTriggerRef}/>}
  {taskFlow?.mode==="addingTask"&&<Modal title={`งานใหม่ · ${formatThaiTaskDate(taskFlow.date)}`} description={`เพิ่มงานสำหรับวันที่ ${formatThaiTaskDate(taskFlow.date)}`} onClose={()=>setTaskFlow(null)} returnFocusRef={addTaskTriggerRef}><TaskInput key={`add-${taskFlow.date}`} date={taskFlow.date} categories={state.categories} quickLocations={taskQuickLocations} order={(state.tasksByDay[taskFlow.date]??[]).length} onAdd={saveNewTask}/></Modal>}
  {taskFlow?.mode==="editingTask"&&editingTask&&<Modal title={`แก้ไขงาน · ${formatThaiTaskDate(taskFlow.date)}`} description={`แก้ไขรายละเอียด ${editingTask.title}`} onClose={()=>setTaskFlow(null)}><TaskInput key={`edit-${editingTask.id}`} date={taskFlow.date} categories={state.categories} quickLocations={taskQuickLocations} editing={editingTask} order={editingTask.order} onAdd={saveNewTask} onSave={saveEditedTask} onCancel={()=>setTaskFlow(null)}/></Modal>}
  {undo&&<div role="status" className="flow-fade flow-inverse fixed bottom-24 left-1/2 z-50 flex w-[calc(100%-32px)] max-w-[388px] -translate-x-1/2 items-center justify-between rounded-2xl p-3 shadow-[var(--flow-shadow)]"><span>{undo.label}</span><button className="flex min-h-11 items-center gap-1 px-2 font-semibold text-[var(--flow-lime)]" onClick={()=>{replaceFlow(undo.state);setUndo(null);}}><Undo2 size={16}/>ย้อนกลับ</button></div>}
  {activeReminder&&<Modal role="alertdialog" title="ถึงเวลาแล้ว" onClose={()=>setActiveReminder(null)}><div className="rounded-2xl bg-[var(--flow-lime)] p-4 text-[#111111]"><h3 className="font-bold">{activeReminder.task.title}</h3><p className="font-grotesk mt-1 text-xs">{activeReminder.date} · {activeReminder.task.fixedTime}</p></div><div className="mt-3 grid grid-cols-3 gap-2"><button className="min-h-11 rounded-xl bg-[#111111] px-2 text-xs font-semibold text-white" onClick={()=>{updateFlow(previous=>({...previous,tasksByDay:{...previous.tasksByDay,[activeReminder.date]:(previous.tasksByDay[activeReminder.date]??[]).map(task=>task.id===activeReminder.task.id?{...task,done:true,completedAt:new Date().toISOString()}:task)}}));setActiveReminder(null);}}>เสร็จแล้ว</button><button className="min-h-11 rounded-xl border border-[var(--flow-line)] px-2 text-xs font-semibold" onClick={()=>{const reminder=activeReminder;setActiveReminder(null);window.setTimeout(()=>setActiveReminder(reminder),5*60_000);}}>เลื่อน 5 นาที</button><button className="min-h-11 rounded-xl border border-[var(--flow-line)] px-2 text-xs font-semibold" onClick={()=>{selectDate(activeReminder.date);setActiveReminder(null);}}>เปิดงาน</button></div></Modal>}
  {onboardingSuccessOpen&&<Modal title="วันแรกพร้อมแล้ว" description="ตอนนี้คุณเห็นทั้งงาน เวลา และช่วงว่างในที่เดียว" onClose={()=>setOnboardingSuccessOpen(false)}><div className="rounded-2xl bg-[var(--flow-lime)] p-4 text-[#111111]"><p className="text-sm leading-6">แผนถูกบันทึกในอุปกรณ์นี้แล้ว คุณยังแก้เวลาและรายละเอียดได้ทุกเมื่อ</p></div><div className="mt-4 grid gap-2"><button type="button" className="flow-press flow-inverse min-h-12 rounded-xl px-3 font-semibold" onClick={()=>{setOnboardingSuccessOpen(false);setTab("today");setDayView("timeline");window.requestAnimationFrame(()=>dayViewAnchorRef.current?.scrollIntoView({block:"start",behavior:"smooth"}));}}>ดูแผนของฉัน</button><div className="grid grid-cols-2 gap-2"><button type="button" className="flow-press min-h-12 rounded-xl border border-[var(--flow-line)] px-2 text-sm font-semibold" onClick={()=>{setOnboardingSuccessOpen(false);setTaskFlow({mode:"addingTask",date:selectedDate});}}>เพิ่มงานอีก</button><button type="button" className="flow-press min-h-12 rounded-xl border border-[var(--flow-line)] bg-[var(--flow-lime)] px-2 text-sm font-semibold text-[#111111]" onClick={()=>{setOnboardingSuccessOpen(false);setDayView("focus");window.requestAnimationFrame(()=>dayViewAnchorRef.current?.scrollIntoView({block:"start",behavior:"smooth"}));}}>เริ่มโฟกัส</button></div></div></Modal>}
  {aiOpen&&<AIPlannerDialog selectedDate={selectedDate} currentTasks={tasks} getTasksForDate={date=>materializeTasksForDate(state,date)} getEnergyForDate={date=>state.dayMetaByDay[date]?.energy??"medium"} onEnergyChange={(date,energy)=>updateFlow(previous=>({...previous,dayMetaByDay:{...previous.dayMetaByDay,[date]:{date,energy,note:previous.dayMetaByDay[date]?.note??""}}}))} quickLocations={taskQuickLocations} preferredMode={online?"ai":"local"} onClose={()=>{cancelPlannerRequest();setAiOpen(false);if(quickStartSuccessPendingRef.current){quickStartSuccessPendingRef.current=false;window.requestAnimationFrame(()=>setQuickStartSuccessOpen(true));}}} onParse={parsePlannerInput} onGeneratePlan={generatePlannerPlan} onAppendDrafts={appendAiDrafts} onApplyPlan={applyPlannerPlan} onCancelPending={cancelPlannerRequest}/>}
  {carryOpen&&<Modal title="งานค้าง" onClose={()=>setCarryOpen(false)}><p className="text-sm text-[var(--flow-muted)]">เลือกงานเพื่อย้ายมาวันนี้ เวลาที่ผ่านแล้วจะถูกนำออกและอยู่ในส่วนยังไม่กำหนดเวลา</p><div className="flow-stagger">{pastUnfinished.map(({date,task})=><article key={`${date}-${task.id}`} className="flow-surface mt-2 flex items-center gap-2 rounded-xl border border-[var(--flow-line)] p-3"><div className="min-w-0 flex-1"><p className="break-words font-semibold">{task.title}</p><p className="font-grotesk text-xs">{date} · {task.fixedTime??"—"}</p></div><button className="flow-press flow-inverse min-h-11 rounded-xl px-3" onClick={()=>{const now=new Date();const today=localDateKey(now);const current=state.tasksByDay[today]??[];const past=task.fixedTime&&task.fixedTime<localTimeKey(now);commit(previous=>({...previous,tasksByDay:{...previous.tasksByDay,[date]:(previous.tasksByDay[date]??[]).filter(item=>item.id!==task.id),[today]:[...current,TaskSchema.parse({...task,fixedTime:past?undefined:task.fixedTime,originalDate:task.originalDate??date,movedCount:(task.movedCount??0)+1,updatedAt:now.toISOString()})]}}),"ย้ายงานแล้ว");}}>ย้าย</button></article>)}</div></Modal>}
  {guideNotice&&<div role="status" className="flow-fade flow-inverse fixed bottom-24 left-1/2 z-50 w-[calc(100%-32px)] max-w-[388px] -translate-x-1/2 rounded-2xl p-3 text-sm shadow-[var(--flow-shadow)]">{guideNotice}</div>}
  </main>;
}
