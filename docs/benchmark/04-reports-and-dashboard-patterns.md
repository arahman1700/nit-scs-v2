# 04 — أنماط التقارير ولوحات المراقبة

> تاريخ التحليل: فبراير 2026
> الأنظمة المشمولة: 18 نظام WMS/TMS/Inventory عبر 3 مستويات (Tier 1-3)

---

## جدول المحتويات

1. [أنماط بطاقات KPI (KPI Card Patterns)](#1-أنماط-بطاقات-kpi)
2. [أنماط الشبكات التشغيلية (Operational Grid Patterns)](#2-أنماط-الشبكات-التشغيلية)
3. [سلوك التنقل التفصيلي (Drill-Down Behavior)](#3-سلوك-التنقل-التفصيلي)
4. [العروض المحفوظة والفلاتر الشخصية (Saved Views / Personal Filters)](#4-العروض-المحفوظة-والفلاتر-الشخصية)
5. [نماذج التنبيهات والعتبات (Alert/Threshold Models)](#5-نماذج-التنبيهات-والعتبات)
6. [إمكانيات التصدير (Export Capabilities)](#6-إمكانيات-التصدير)
7. [جدول مقارنة شامل (Comprehensive Comparison)](#7-جدول-مقارنة-شامل)

---

## 1. أنماط بطاقات KPI

تُعد بطاقات المؤشرات الرئيسية (KPI Cards) العنصر البصري الأول الذي يراه المستخدم عند دخول أي لوحة مراقبة. تتباين الأنظمة في تصميم هذه البطاقات وعمقها المعلوماتي.

### 1.1 هرمية مؤشرات الأداء (KPI Hierarchy)

تتبع أنظمة Tier 1 نمطًا ثلاثي المستويات:

```
المستوى الاستراتيجي (Executive)
  |-- التكلفة الإجمالية لكل وحدة مشحونة
  |-- معدل الطلب المثالي (Perfect Order Rate)
  |-- دوران المخزون (Inventory Turns)
  |-- استغلال السعة (Capacity Utilization %)
  |
المستوى التكتيكي (Manager/Supervisor)
  |-- زمن الاستلام حتى التخزين (Dock-to-Stock Time)
  |-- دورة الطلب (Order Cycle Time)
  |-- دقة الالتقاط (Pick Accuracy %)
  |-- إنتاجية العمالة (Labor Productivity — units/hour)
  |-- معدل الطلبات المتأخرة (Backorder Rate)
  |
المستوى التشغيلي (Floor)
  |-- المهام في قائمة الانتظار (Tasks in Queue)
  |-- مهام المستودع النشطة (Active Warehouse Tasks)
  |-- استغلال المواقع (Bin Utilization)
  |-- معدل الإنتاجية الحالي (Current Throughput Rate)
  |-- تنبيهات الاستثناءات (Exception Alerts)
```

### 1.2 أنماط تصميم بطاقات KPI عبر الأنظمة

| نمط التصميم | الوصف | الأنظمة |
|-------------|-------|---------|
| **قيمة + اتجاه + مقارنة** (Value + Trend + Comparison) | رقم كبير + سهم اتجاه + مقارنة مع الفترة السابقة | SAP Fiori KPI Tiles, NetSuite KPI Snapshots, D365 Workspace Tiles, **NIT-SCS-V2 KpiCard** |
| **قيمة + مخطط صغير** (Value + Sparkline) | رقم مع مخطط بياني مصغر يظهر الاتجاه الزمني | Manhattan Active dashboards, Blue Yonder dashboards, Infor Birst |
| **قيمة + شريط تقدم** (Value + Progress Bar) | رقم مع شريط يوضح النسبة من الهدف | Acumatica dashboards, Korber dashboards |
| **قيمة + ترميز لوني** (Value + Color Coding) | رقم مع خلفية لونية تشير للحالة (أخضر/أصفر/أحمر) | Oracle Fusion, Odoo dashboards, Zoho dashboards |
| **بطاقة تفاعلية** (Interactive Card) | بطاقة قابلة للنقر مع tooltip وdrill-down فوري | SAP Analytics Cloud, Manhattan SCI, Power BI embedded |

### 1.3 عدد مؤشرات الأداء الجاهزة

| النظام | عدد KPIs الجاهزة | BI Platform | مؤشرات مخصصة |
|--------|-----------------|-------------|---------------|
| SAP EWM | 90+ dashboard, 465+ reports | SAP Analytics Cloud + BW/4HANA | نعم (CDS views) |
| SAP TM | 50+ | SAP Analytics Cloud | نعم (CDS views) |
| Oracle Fusion WM | 30+ | Oracle Analytics Cloud + OTBI | نعم |
| Oracle OTM | 40+ | Oracle Analytics | نعم |
| NetSuite WMS | 75+ | SuiteAnalytics + saved searches | نعم (SuiteScript) |
| D365 WM/TM | 30+ | Power BI + SSRS | نعم (Power BI) |
| Manhattan Active WM/TM | 50+ | Supply Chain Intelligence (SCI) | نعم (SCI module) |
| Blue Yonder WMS/TMS | 40+ | Crystal/Jasper/Qlikview | نعم |
| Infor WMS/TMS | 30+ | Birst Analytics | نعم (Birst) |
| Korber WMS | 20+ | Built-in analytics | نعم |
| Odoo Inventory | 15+ | Odoo Studio + pivot tables | نعم (Studio) |
| Acumatica WMS | 20+ | Generic Inquiries + Power BI | نعم (GI + BI) |
| Fishbowl | 200+ reports (ليست KPIs تفاعلية) | Built-in + AI Insights | محدود |
| Zoho Inventory | 10+ | Zoho Analytics | نعم (Zoho Analytics) |
| **NIT-SCS-V2** | 15+ KPIs عبر 6 dashboards | Dashboard Builder + Report Builder | نعم (Custom Data Sources + Widget Builder) |

### 1.4 موقع NIT-SCS-V2 في بطاقات KPI

NIT-SCS-V2 يتبع نمط **Value + Trend + Comparison** عبر مكون `KpiCard` مع glass-card design:
- 6 لوحات مراقبة متخصصة بالأدوار (Admin, Manager, Warehouse, QC, Engineer, Operations)
- مصادر بيانات مخصصة (Custom Data Sources — 5 أنواع تجميع)
- Widget Builder قابل للتكوين

**الفجوة:** لا يوجد sparkline مدمج، عدد KPIs أقل من NetSuite (75+) و SAP (90+). فرصة لإضافة مؤشرات أداء جاهزة أكثر.

---

## 2. أنماط الشبكات التشغيلية

الشبكات التشغيلية (Operational Grids) هي الأداة الأساسية لإدارة العمليات اليومية. تتنوع في ثلاثة أنماط رئيسية:

### 2.1 قوائم الاستثناءات (Exception Queues)

**الوصف:** عرض المهام التي تحتاج تدخلاً بشريًا — مهام متعطلة، طلبات متأخرة، تنبيهات السعة.

| النظام | جودة Exception Queue | التفاصيل |
|--------|---------------------|----------|
| SAP EWM | **ممتاز** | Warehouse Monitor (`/SCWM/MON`) — يجمع الاستثناءات حسب النوع (stuck tasks, overdue, capacity); ترميز لوني (أحمر/أصفر/أخضر); إجراءات بنقرة واحدة (reassign, escalate, cancel, retry); عتبات قابلة للتكوين |
| Manhattan Active WM | **ممتاز** | Unified Control screens — exception-only intervention مع order streaming; digital warehouse map يعرض bottlenecks |
| Blue Yonder WMS | **جيد جدًا** | AI-driven exception prioritization — الذكاء الاصطناعي يرتب الاستثناءات حسب التأثير |
| Oracle OTM | **جيد جدًا** | Delayed shipments, cost overruns, failed tenders, missing POD — مع severity indicators |
| D365 WM | **جيد** | Workspace exception tiles — drill into filtered exception lists |
| Infor WMS | **جيد** | Event monitors مع alert-based actions; 3D visualization للاختناقات |
| Korber WMS | **جيد** | Process-based event monitors مع configurable thresholds |
| NetSuite WMS | **متوسط** | Saved search-based alerts — يتطلب إعدادًا يدويًا |
| Odoo | **أساسي** | Automated replenishment alerts فقط |
| **NIT-SCS-V2** | **أساسي-متوسط** | Chain notifications (12 قاعدة) + Pending Approvals page — ينقصه dedicated exception queue |

### 2.2 قوائم المهام (Task Lists)

**الوصف:** إدارة المهام المعينة للعاملين — الالتقاط، التوضيب، الجرد.

| النظام | نمط قائمة المهام | التفاصيل |
|--------|-----------------|----------|
| SAP EWM | **Warehouse Task queue** | مهام موجهة بالنظام مع أولوية وموارد مخصصة; task interleaving |
| Manhattan Active | **Order streaming** | تدفق مستمر بدون waves — المهام تُخصص ديناميكيًا باستخدام AI |
| Blue Yonder | **AI task prioritization** | المهام تُرتب وتُخصص بذكاء اصطناعي |
| D365 WM | **Wave-based task lists** | مهام تُنشأ من Wave release; قابلة للتصفية بالعامل/المنطقة |
| Infor WMS | **Work distribution engine** | توزيع تلقائي مع labor management مدمج |
| NetSuite WMS | **Pick task lists** | مهام الالتقاط مع تعيين للمشغل; wave/single/multi-order |
| Korber | **RF task queue** | مهام على أجهزة RF مع task interleaving |
| Odoo | **Operations list** | قوائم عمليات (receipt, delivery, internal) مع حالات |
| Acumatica | **Smart panel tasks** | مهام مع barcode scanning على mobile |
| **NIT-SCS-V2** | **Tasks page** | صفحة مهام مركزية — ينقصها wave-based generation و AI task assignment |

### 2.3 مراقبة المستودع (Warehouse Monitors)

**الوصف:** عرض حي لحالة المستودع — المواقع المشغولة، الحركة، الاختناقات.

| النظام | نوع المراقبة | التفاصيل |
|--------|-------------|----------|
| SAP EWM | **Warehouse Monitor** (`/SCWM/MON`) | أداة مركزية شاملة — filter/select/evaluate all EWM objects; direct actions |
| Manhattan Active | **Digital Warehouse Map** | خريطة رقمية تفاعلية — drill to facility, zone, worker, task level |
| Infor WMS | **3D Visual Warehouse** | **فريد في السوق** — عرض ثلاثي الأبعاد للمستودع مع تحديد الاختناقات |
| Blue Yonder | **Operational Dashboard** | لوحة مراقبة تشغيلية مع AI predictive analytics |
| D365 WM | **Workspaces** | Inbound/Outbound/Inventory workspaces مع real-time tiles |
| Oracle Fusion WM | **Operational Dashboard** | Real-time warehouse operations monitoring |
| NetSuite WMS | **Warehouse Management Center** | Dashboard مركزي مع KPI widgets وtask queue overview |
| Korber | **Real-time dashboard** | At-a-glance KPI view مع event monitors |
| **NIT-SCS-V2** | **WarehouseDashboard + SensorDashboard** | لوحة مراقبة المستودع + مستشعرات; YardDashboard; InventoryDashboard — 4 لوحات متخصصة |

---

## 3. سلوك التنقل التفصيلي

التنقل التفصيلي (Drill-Down) هو القدرة على الانتقال من مؤشر مُجمَّع إلى تفاصيل المعاملات الفردية. يختلف عمق وسلوك الـ drill-down بشكل كبير:

### 3.1 مستويات التفصيل (Levels of Detail)

| النظام | عدد المستويات | المسار النموذجي |
|--------|--------------|-----------------|
| SAP EWM | **3 مستويات** | KPI Tile → Warehouse Monitor (filtered list) → Individual warehouse task/document (full audit trail) |
| SAP TM | **4 مستويات** | Dashboard → Shipment list → Freight order detail → Event history |
| Oracle Fusion WM | **3 مستويات** | Dashboard → Exception list → Transaction detail |
| Oracle OTM | **4 مستويات** | Dashboard → Shipment list → Order detail → Event history |
| NetSuite WMS | **3 مستويات** | KPI widget → Saved search report → Transaction record |
| D365 WM/TM | **3 مستويات** | Workspace tile → Filtered list → Record detail |
| Manhattan Active | **4 مستويات** | Network overview → Facility → Zone/Worker → Task detail |
| Blue Yonder | **3 مستويات** | KPI chart → Alert list → Transaction |
| Infor WMS | **4 مستويات** | 3D overview → Zone → Location → Transaction |
| Korber | **3 مستويات** | Dashboard → Metric drill-down → Transaction |
| Odoo | **3 مستويات** | Dashboard → Pivot table → Record form |
| Acumatica | **3 مستويات** | KPI widget → Generic Inquiry → Transaction |
| Fishbowl | **2 مستويات** | Report → Transaction detail |
| Zoho | **2-3 مستويات** | Summary → Detail view → Transaction |
| **NIT-SCS-V2** | **2-3 مستويات** | KPI card → Resource list (filtered) → Document form |

### 3.2 سلوك وراثة الفلاتر (Filter Inheritance)

ميزة مهمة — هل ينتقل الفلتر تلقائيًا عند الـ drill-down؟

| السلوك | الأنظمة | التفاصيل |
|--------|---------|----------|
| **وراثة كاملة** (Full inheritance) | SAP EWM/TM, Manhattan Active, Oracle OTM | الفلتر ينتقل تلقائيًا من المستوى الأعلى إلى الأدنى — لا حاجة لإعادة التصفية |
| **وراثة جزئية** (Partial inheritance) | D365, Blue Yonder, Infor, NetSuite | بعض الفلاتر تنتقل (التاريخ, المستودع) والبعض لا (الحالة, المستخدم) |
| **بدون وراثة** (No inheritance) | Odoo, Acumatica, Fishbowl, Zoho | كل مستوى يتطلب إعادة تطبيق الفلاتر يدويًا |
| **NIT-SCS-V2** | **جزئي** | فلاتر التاريخ والمشروع تنتقل عبر URL params — فرصة لتحسين وراثة الفلاتر |

### 3.3 أنماط التنقل التفصيلي

| النمط | الوصف | الأنظمة |
|-------|-------|---------|
| **Click-Through** | النقر على KPI يفتح صفحة جديدة بتفاصيل مصفاة | الأكثر شيوعًا — جميع الأنظمة |
| **Slide-Out Panel** | لوحة جانبية تنزلق من الحافة مع التفاصيل | Manhattan Active, D365 (FactBox) |
| **Modal/Dialog** | نافذة منبثقة فوق اللوحة الحالية | Odoo, Acumatica, NetSuite |
| **In-Place Expansion** | توسيع الصف في الجدول لعرض التفاصيل | SAP EWM Monitor, Blue Yonder |
| **Map-Based** | drill-down على خريطة جغرافية أو مخطط المستودع | Infor 3D, Manhattan Digital Map, SAP TM route map |

---

## 4. العروض المحفوظة والفلاتر الشخصية

### 4.1 العروض الشخصية (Personal Views)

| النظام | نوع العروض | التفاصيل |
|--------|-----------|----------|
| SAP EWM/TM | **Fiori Personalization + Variants** | My Views على مستوى المستخدم; variant management للشاشات; personalized KPI tiles على Launchpad |
| Oracle Fusion WM | **Saved Searches** | قابلة للحفظ والمشاركة; role-based defaults |
| Oracle OTM | **Configurable Views** | User-level filter persistence |
| NetSuite WMS | **Dashboard Personalization + Saved Searches** | كل مستخدم يخصص dashboard portlets; saved search variants قابلة للمشاركة |
| D365 WM/TM | **Saved Views** | Microsoft saved views framework — personal/shared/organizational levels; default view per role |
| Manhattan Active | **User Preferences** | Configurable control screens per user |
| Blue Yonder | **Configurable KPI Charts** | Per-warehouse alert configuration |
| Infor WMS | **Birst Personal Dashboards** | BI-level personalization |
| Korber | **Event Monitor Configuration** | User-configurable event monitors |
| Odoo | **Favorites + Filters** | Save any search as a favorite; share with team |
| Acumatica | **Generic Inquiries + Dashboard** | مستخدم يحفظ GI كـ dashboard widget |
| Fishbowl | **Custom Report Parameters** | حفظ parameters للتقارير المعتادة |
| Zoho | **Custom Views** | إنشاء عروض مخصصة مع فلاتر |
| **NIT-SCS-V2** | **Dashboard Builder** | بناء لوحات مخصصة بالسحب والإفلات — يدعم widgets مخصصة |

### 4.2 العروض المشتركة (Shared Views)

| مستوى المشاركة | الأنظمة | التفاصيل |
|----------------|---------|----------|
| **على مستوى المؤسسة** (Organization-wide) | SAP (Fiori content), D365 (Published views), Manhattan | المسؤول ينشر عروض موحدة لجميع المستخدمين |
| **على مستوى الفريق** (Team/Role-based) | NetSuite (shared saved searches), Oracle, Odoo (shared favorites) | مشاركة مع مجموعة محددة أو دور |
| **شخصي فقط** (Personal only) | Fishbowl, Zoho | لا توجد إمكانية مشاركة |
| **NIT-SCS-V2** | **Dashboard Builder (Admin)** | المسؤول يبني ويشارك — فرصة لإضافة user-level saved views |

### 4.3 العروض الافتراضية حسب الدور (Role-Based Default Views)

| النظام | يدعم Defaults حسب الدور | التفاصيل |
|--------|------------------------|----------|
| SAP EWM | نعم | Fiori Launchpad groups per role; default KPI tiles |
| NetSuite WMS | نعم | 8+ أدوار مع dashboard defaults مختلفة |
| D365 | نعم | Published views يمكن تعيينها كـ default per security role |
| Manhattan Active | نعم | Role-based control screens |
| Acumatica | نعم | Role-based dashboard widgets |
| **NIT-SCS-V2** | **نعم** | 6 dashboards متخصصة (Admin, Manager, Warehouse, QC, Engineer, Operations) + 10 أدوار مع nav مختلفة |

---

## 5. نماذج التنبيهات والعتبات

### 5.1 التنبيهات المبنية على العتبات (Threshold-Based Alerts)

| النظام | نوع العتبات | أمثلة |
|--------|------------|-------|
| SAP EWM | **متقدم** | عتبات قابلة للتكوين لكل KPI; capacity alerts, overdue task alerts, stock level alerts; ترميز لوني تلقائي |
| Oracle OTM | **متقدم** | Cost overrun thresholds, delay thresholds, tender deadline alerts |
| Manhattan Active | **متقدم** | Dynamic thresholds تتكيف مع AI; exception severity ranking |
| D365 WM | **جيد** | Application Insights telemetry; configurable alert rules via Power Automate |
| Blue Yonder | **جيد** | AI-predicted thresholds مع agentic AI |
| NetSuite | **جيد** | Saved search-based alerts مع email triggers |
| Infor WMS | **جيد** | Event monitors مع configurable thresholds |
| Korber | **جيد** | Event-based monitoring مع configurable thresholds |
| Odoo | **أساسي** | Reorder point alerts, stock rules |
| Acumatica | **أساسي** | Business event notifications |
| Fishbowl | **أساسي** | Reorder alerts فقط |
| Zoho | **أساسي** | Low stock alerts, reorder notifications |
| **NIT-SCS-V2** | **متوسط** | Chain notification rules (12 قاعدة); workflow rules مع conditions — ينقصه KPI-based threshold alerts |

### 5.2 التنبيهات المبنية على الأحداث (Event-Based Alerts)

| النظام | الأحداث المدعومة | آلية الإرسال |
|--------|-----------------|-------------|
| SAP EWM/TM | Document status change, task completion, exception occurrence, timer expiry | SAP Event Mesh (pub/sub), email, Fiori notification |
| Oracle Fusion/OTM | Status change, milestone events, GPS events, exception events | Oracle notifications, email, mobile push |
| D365 | Record create/update/delete, workflow status change, Power Automate triggers | Power Automate (email, Teams, SMS, custom), business events |
| Manhattan Active | Status change, exception, capacity threshold, SLA breach | Platform notifications, email |
| NetSuite | SuiteFlow workflow triggers, SuiteScript user events | Email, dashboard notifications, SuiteScript custom |
| Odoo | Automated actions on create/update, scheduled server actions | Email, in-app notification, Discuss (chat) |
| **NIT-SCS-V2** | **Document chain events (8 chains), workflow rule triggers, Socket.IO real-time** | **Email templates (15), Socket.IO push, in-app notification** |

### 5.3 أنماط التصعيد (Escalation Patterns)

| النظام | يدعم التصعيد | التفاصيل |
|--------|-------------|----------|
| SAP EWM/TM | نعم (متقدم) | Multi-level escalation مع timeouts; auto-reassign; manager notification chains |
| Oracle | نعم | Approval escalation rules; timeout-based escalation |
| D365 | نعم | Workflow escalation مع configurable timeouts; Power Automate escalation flows |
| Manhattan | نعم | Exception escalation مع severity-based routing |
| NetSuite | نعم | SuiteFlow escalation actions; scheduled escalation |
| Odoo | جزئي | Manual escalation; no built-in timeout escalation |
| Acumatica | نعم | Approval map escalation مع thresholds |
| **NIT-SCS-V2** | **جزئي** | Approval levels (3 levels for MI) — ينقصه timeout-based auto-escalation |

### 5.4 قنوات الإشعار (Notification Channels)

| القناة | SAP | Oracle | D365 | Manhattan | NetSuite | Odoo | NIT-SCS-V2 |
|--------|-----|--------|------|-----------|----------|------|------------|
| Email | نعم | نعم | نعم | نعم | نعم | نعم | **نعم (15 template)** |
| In-App | نعم (Fiori) | نعم | نعم | نعم | نعم | نعم (Discuss) | **نعم (Socket.IO)** |
| Mobile Push | نعم | نعم | نعم (Power Automate) | نعم | جزئي | نعم | لا |
| SMS | جزئي | جزئي | نعم (Power Automate) | لا | جزئي | جزئي | لا |
| Teams/Slack | جزئي (BTP) | لا | **نعم (native Teams)** | لا | لا | لا | لا |
| Webhook | نعم (Event Mesh) | نعم | نعم (Business Events) | نعم (REST) | نعم (RESTlet) | نعم | لا (فرصة) |

---

## 6. إمكانيات التصدير

### 6.1 صيغ التصدير (Export Formats)

| النظام | PDF | Excel | CSV | API/JSON | تقارير مجدولة | توزيع بالبريد |
|--------|-----|-------|-----|----------|--------------|--------------|
| SAP EWM/TM | نعم (Adobe Forms) | نعم | نعم | نعم (OData) | نعم (batch jobs) | نعم |
| Oracle Fusion/OTM | نعم | نعم | نعم | نعم (REST) | نعم | نعم |
| NetSuite | نعم | نعم (Workbook) | نعم | نعم (SuiteTalk) | نعم (saved search scheduling) | نعم |
| D365 WM/TM | نعم (SSRS) | نعم | نعم | نعم (OData) | نعم (batch/Power Automate) | نعم (Power Automate) |
| Manhattan Active | نعم | نعم | نعم | نعم (REST ~20K endpoints) | نعم (SCI) | نعم |
| Blue Yonder | نعم | نعم | نعم | نعم (REST) | نعم | نعم |
| Infor WMS/TMS | نعم | نعم | نعم | نعم (REST) | نعم (Birst) | نعم |
| Korber | نعم | نعم | نعم | نعم (REST/SOAP) | نعم | جزئي |
| Odoo | نعم | نعم (XLSX) | نعم | نعم (JSON-RPC) | نعم (scheduled email reports) | نعم |
| Acumatica | نعم | نعم | نعم | نعم (REST/OData) | نعم | نعم |
| Fishbowl | نعم | نعم | نعم | نعم (REST) | محدود | محدود |
| Zoho | نعم | نعم | نعم | نعم (REST) | نعم (Zoho Analytics) | نعم |
| **NIT-SCS-V2** | **نعم (pdfExport)** | **لا (فجوة)** | **لا (فجوة)** | **نعم (REST API)** | **لا (فجوة)** | **لا (فجوة)** |

### 6.2 جدولة التقارير (Report Scheduling)

| النظام | يدعم الجدولة | التفاصيل |
|--------|-------------|----------|
| SAP EWM/TM | نعم | Background job scheduling; periodic report distribution |
| Oracle | نعم | Scheduled reports مع OTBI/Analytics Cloud |
| D365 | نعم | Recurring data jobs + Power Automate scheduled flows |
| Manhattan | نعم | SCI module scheduled reports |
| NetSuite | نعم | Saved search scheduling مع email distribution |
| Blue Yonder | نعم | BI tool-based scheduling |
| Infor | نعم | Birst scheduled dashboards |
| Odoo | نعم | Scheduled email reports (pivot tables, charts) |
| Acumatica | نعم | Scheduled Generic Inquiry exports |
| Korber | نعم | Event-triggered report generation |
| Fishbowl | محدود | Manual report generation primarily |
| Zoho | نعم (via Zoho Analytics) | Scheduled dashboard emails |
| **NIT-SCS-V2** | **لا** | فرصة واضحة — يمكن تنفيذها عبر scheduled-rule-runner.ts + email templates |

### 6.3 أدوات بناء التقارير (Report Builder Capabilities)

| المستوى | الأنظمة | القدرات |
|---------|---------|---------|
| **متقدم** (Full BI platform) | SAP Analytics Cloud, Power BI (D365), Manhattan SCI, Birst (Infor) | Drag-and-drop, calculated fields, data blending, predictive analytics, AI insights |
| **جيد** (Built-in builder) | NetSuite SuiteAnalytics, Oracle OTBI, Odoo Studio, Acumatica GI | Query builder, pivot tables, chart types, formula fields, scheduled delivery |
| **أساسي** (Pre-built + filters) | Blue Yonder (3rd-party BI), Korber (built-in), Fishbowl (200+ reports), Zoho (basic + Analytics) | Parameter-based reports, basic charts, CSV/PDF export |
| **NIT-SCS-V2** | **Report Builder + Dashboard Builder** | Custom data sources, widget types, drag-and-drop — مستوى "جيد" يقارب NetSuite |

---

## 7. جدول مقارنة شامل

### 7.1 مقارنة قدرات التقارير ولوحات المراقبة

| المعيار | SAP EWM | SAP TM | Oracle Fusion WM | Oracle OTM | NetSuite WMS | D365 WM | D365 TM | Manhattan WM | Manhattan TM | BY WMS | BY TMS | Infor WMS | Infor TMS | Korber | Odoo | Acumatica | Fishbowl | Zoho |
|---------|---------|--------|-----------------|------------|-------------|---------|---------|-------------|-------------|--------|--------|-----------|-----------|--------|------|-----------|----------|------|
| **عدد KPIs** | 90+ | 50+ | 30+ | 40+ | 75+ | 30+ | 20+ | 50+ | 30+ | 40+ | 30+ | 30+ | 20+ | 20+ | 15+ | 20+ | 200+ rpt | 10+ |
| **KPI Hierarchy** | 3 مستويات | 3 | 3 | 3 | 3 | 2-3 | 2-3 | 3 | 3 | 3 | 3 | 3 | 2-3 | 2-3 | 2 | 2-3 | 1-2 | 1-2 |
| **Exception Queue** | ممتاز | جيد جدًا | جيد | جيد جدًا | متوسط | جيد | جيد | ممتاز | جيد | جيد جدًا | جيد | جيد | متوسط | جيد | أساسي | أساسي | لا | لا |
| **Drill-Down Levels** | 3 | 4 | 3 | 4 | 3 | 3 | 3 | 4 | 3 | 3 | 3 | 4 | 3 | 3 | 3 | 3 | 2 | 2-3 |
| **Filter Inheritance** | كامل | كامل | جزئي | جزئي | جزئي | جزئي | جزئي | كامل | كامل | جزئي | جزئي | جزئي | جزئي | جزئي | لا | لا | لا | لا |
| **Saved Views** | نعم (variants) | نعم | نعم | نعم | نعم (searches) | نعم (3 levels) | نعم | نعم | نعم | نعم | نعم | نعم (Birst) | نعم | جزئي | نعم (favorites) | نعم (GI) | محدود | نعم |
| **Shared Views** | نعم (org) | نعم | نعم | نعم | نعم (team) | نعم (org/team) | نعم | نعم | نعم | نعم | نعم | نعم | نعم | جزئي | نعم (team) | جزئي | لا | لا |
| **Role-Based Default** | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | جزئي | جزئي | نعم | لا | لا |
| **Threshold Alerts** | متقدم | متقدم | جيد | متقدم | جيد | جيد | جيد | متقدم | جيد | جيد | جيد | جيد | جيد | جيد | أساسي | أساسي | أساسي | أساسي |
| **Event Alerts** | نعم (Event Mesh) | نعم | نعم | نعم | نعم (SuiteScript) | نعم (Power Automate) | نعم | نعم | نعم | نعم | نعم | نعم (ION) | نعم | نعم | نعم | نعم | محدود | محدود |
| **Escalation** | نعم (multi-level) | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | جزئي | جزئي | نعم | لا | لا |
| **PDF Export** | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم |
| **Excel Export** | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم |
| **CSV Export** | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم |
| **Report Scheduling** | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | محدود | نعم |
| **Email Distribution** | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | جزئي | نعم | نعم | محدود | نعم |
| **BI Platform** | SAC + BW | SAC | OAC + OTBI | OAC | SuiteAnalytics | Power BI | Power BI | SCI | SCI | 3rd-party | 3rd-party | Birst | Birst | Built-in | Studio | GI + BI | AI Insights | Z-Analytics |
| **Real-Time** | نعم (HANA) | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | جزئي | جزئي |
| **AI/ML Analytics** | Predictive (SAC) | ML ETA | AI Agents (2026) | ML ETA, AI | Rule-based | Copilot | Copilot | GenAI | GenAI | Agentic AI | GenAI | Basic | Basic | AI Planning | لا | لا | AI Insights | لا |

### 7.2 خلاصة الموقع التنافسي لـ NIT-SCS-V2

| البُعد | التصنيف | النقاط الإيجابية | الفجوات |
|--------|---------|-----------------|---------|
| **بطاقات KPI** | جيد | 6 dashboards متخصصة, KpiCard component, Custom Data Sources (5 aggregation types) | عدد KPIs أقل من السوق (15+ مقابل 30-90+); لا يوجد sparkline |
| **الشبكات التشغيلية** | متوسط | 4 warehouse monitors (Warehouse, Sensor, Yard, Inventory), SmartGrid component | لا يوجد dedicated exception queue; لا يوجد 3D visualization |
| **التنقل التفصيلي** | متوسط | 2-3 مستويات drill-down, URL-based filter passing | وراثة فلاتر جزئية; لا يوجد slide-out panel أو in-place expansion |
| **العروض المحفوظة** | جيد | Dashboard Builder (admin), role-based defaults (6 dashboards, 10 roles) | لا يوجد user-level saved views; لا يوجد shared team views |
| **التنبيهات** | متوسط-جيد | 12 chain notification rules, 15 email templates, Socket.IO real-time, Workflow rules مع conditions | لا يوجد KPI threshold alerts; لا يوجد timeout escalation; لا يوجد mobile push |
| **التصدير** | أساسي | PDF export (pdfExport utility), REST API (JSON) | **لا يوجد Excel/CSV export** — فجوة حرجة; لا يوجد report scheduling; لا يوجد email distribution |
| **أدوات التقارير** | جيد | Report Builder + Dashboard Builder + Custom Data Sources | ينقصه calculated fields, data blending, predictive analytics |
| **AI Analytics** | متوسط | AI module (behind flag) — 4 suggestion engines, natural language query | Not production-ready; ينقصه predictive forecasting مقارنة بـ Manhattan/Blue Yonder |

### 7.3 أولويات التطوير المقترحة

بناءً على فجوات التصدير والتنبيهات:

| الأولوية | الفجوة | التأثير | التعقيد |
|---------|-------|---------|---------|
| **1 - حرج** | Excel/CSV export | كل الأنظمة المنافسة تدعمه — مطلب أساسي للمستخدمين | منخفض |
| **2 - عالي** | Exception queue dashboard | ميزة تشغيلية أساسية في Tier 1-2 | متوسط |
| **3 - عالي** | Report scheduling + email distribution | مطلب إداري شائع — البنية التحتية موجودة (scheduled-rule-runner + email templates) | متوسط |
| **4 - متوسط** | KPI threshold alerts | تعزيز proactive monitoring — يمكن البناء على chain notifications | متوسط |
| **5 - متوسط** | User-level saved views | تحسين تجربة المستخدم — Dashboard Builder يحتاج per-user persistence | منخفض-متوسط |
| **6 - منخفض** | Sparkline في KPI cards | تحسين بصري — القيمة الإضافية محدودة | منخفض |
| **7 - منخفض** | Mobile push notifications | يتطلب native app أو PWA service worker | عالي |

---

*تم التحليل استنادًا إلى بيانات بحثية من فبراير 2026. قد تتغير الميزات مع التحديثات المستقبلية للأنظمة.*
