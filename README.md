# flow_

เว็บวางแผนวันแบบ local-first สำหรับจัดงาน เวลา การเตือน งานซ้ำ Timeline แผนที่ และภาพรวม โดยใช้ CI แบบ Mono Editorial ของ Flow

## เริ่มใช้งาน

```bash
pnpm install
Copy-Item .env.example .env.local
pnpm dev
```

เปิด `http://localhost:3000` ระบบจะพาไปหน้า `/login` โดยอัตโนมัติ ใช้บัญชีเดโม `demo@flow.app` / `123456` หรือเลือก “เข้าใช้งานด่วน” ผู้ใช้ครั้งแรกจะไป `/guide` เพื่อสร้างแผนวันแรก ส่วนผู้ที่จบหรือข้าม Guide แล้วจะเข้า Planner ที่ `/app`

หน้า Login เป็นทางเข้า Guest mode เท่านั้น ไม่มี Authentication, session, cookie หรือ Cloud Sync จริง ผู้ใช้ที่เปิด `/app` ตรงในครั้งแรกจะถูกพาไป Product Guide ก่อน ส่วนผู้ที่จบหรือข้าม Guide เวอร์ชันปัจจุบันแล้วจะเข้า Planner ได้ทันที หน้า Settings สามารถเปิด Guide, Core/Full Tour และ Quick Start ซ้ำได้โดยไม่ลบงาน

## การตั้งค่าแผนที่

แผนที่ใช้ MapLibre GL และค่าเริ่มต้นคือ CARTO Positron (`https://basemaps.cartocdn.com/gl/positron-gl-style/style.json`) หากต้องการใช้ style อื่น ให้กำหนด URL สาธารณะใน `NEXT_PUBLIC_MAP_STYLE_URL` ของ `.env.local` แล้วเริ่มเซิร์ฟเวอร์ใหม่ ค่าที่ขึ้นต้นด้วย `NEXT_PUBLIC_` จะรวมอยู่ใน client bundle จึงห้ามใส่ API key หรือ secret ในตัวแปรนี้

ปล่อยค่าเป็นว่างเพื่อใช้ style เริ่มต้นได้ตามปกติ Style ที่นำมาใช้แทนต้องเป็น MapLibre-compatible, อนุญาตการใช้งานตามเงื่อนไขของผู้ให้บริการ และมี attribution ที่ถูกต้อง ตัวควบคุม attribution ของ MapLibre ยังคงเปิดอยู่ แผนที่พื้นฐาน, Nominatim geocoding และ OSRM routing ต้องใช้เครือข่าย; ความขัดข้องของ geocoding หรือ routing ไม่ควรลบข้อมูลงานที่เก็บอยู่ในเครื่อง

## คำสั่งตรวจสอบ

```bash
pnpm lint
pnpm exec tsc --noEmit
pnpm test
pnpm build
```

## การเก็บข้อมูล

- state หลัก: `flow_state_v2`
- สถานะ Guide แบบมีเวอร์ชัน: `flow_onboarding_v2` (แยกจากข้อมูลงาน)
- migration source: `flow_tasks_v1`
- backup ก่อน migration/import: `flow_state_backup_v1`
- Zod schemas อยู่ใน `lib/types.ts`
- export ได้เป็น JSON, CSV และ ICS โดยไม่รวม secret/token

หาก state v2 เสีย ระบบจะ salvage เฉพาะข้อมูลที่ตรวจผ่าน schema และจะไม่ลบ legacy backup อัตโนมัติ

## โครงสร้างหลัก

- `app/page.tsx` — app shell และ navigation (แสดงผ่าน route `/app`)
- `app/login/page.tsx` — ทางเข้า Guest mode และบัญชีเดโมแบบ local-only
- `app/guide/page.tsx` — Product Guide และ Quick Start แบบยืนยันก่อนบันทึก
- `components/GuidedTour.tsx` — Core Tour 4 ขั้นและ Full Tour แบบเลือกเปิดภายหลัง
- `components/planner/` — task composer, timeline, dashboard, search, settings
- `hooks/useFlowStore.ts` — React binding สำหรับ local-first store
- `lib/storage.ts` — load/save/migrate/import/export/clear
- `lib/recurrence.ts`, `reminders.ts`, `statistics.ts`, `time.ts` — domain logic ที่มี tests
- `app/api/*` — AI/geocoding/routing ผ่าน server routes
- `supabase/migrations/` — RLS migration สำหรับ cloud adapter

รายละเอียด Anthropic, Supabase, Google Calendar, PWA/offline และข้อจำกัดอยู่ที่ [docs/integrations.md](docs/integrations.md)

## ข้อจำกัดที่แสดงตามจริง

- ถ้าไม่มี `ANTHROPIC_API_KEY` หรือออฟไลน์ การจัดวันยังจบ flow ได้ด้วย Local Planner และจะแจ้งโหมดตามจริง
- Supabase และ Google Calendar ยังไม่แสดงว่าเชื่อมต่อจนกว่าจะมี adapter/OAuth จริง
- Offline ใช้แก้ข้อมูลงานและจัดแผนแบบ local ได้ แต่ AI ภายนอก แผนที่ geocoding routing และ sync ต้องใช้เครือข่าย
- Notification เป็น best effort และไม่ได้อ้างว่าเป็น Web Push เบื้องหลัง
