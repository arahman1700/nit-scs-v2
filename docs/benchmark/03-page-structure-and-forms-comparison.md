# 03 — مقارنة هيكل الصفحات والنماذج

> تاريخ التحليل: فبراير 2026
> الأنظمة المشمولة: 18 نظام WMS/TMS/Inventory عبر 3 مستويات (Tier 1-3)

---

## جدول المحتويات

1. [أنماط هندسة المعلومات (Information Architecture Patterns)](#1-أنماط-هندسة-المعلومات)
2. [أنماط التنقل (Navigation Patterns)](#2-أنماط-التنقل)
3. [أنماط تصميم النماذج (Form Design Patterns)](#3-أنماط-تصميم-النماذج)
4. [أنماط التدفق التشغيلي (Operational Flow Patterns)](#4-أنماط-التدفق-التشغيلي)
5. [أنماط آلة الحالة (State Machine Patterns)](#5-أنماط-آلة-الحالة)
6. [جدول مقارنة شامل (Comprehensive Comparison Table)](#6-جدول-مقارنة-شامل)

---

## 1. أنماط هندسة المعلومات

تتباين أنظمة إدارة المستودعات والنقل بشكل جوهري في كيفية تنظيم هندسة المعلومات (Information Architecture). يمكن تصنيف الأنماط السائدة إلى ثلاث فئات رئيسية:

### 1.1 النمط المسطح (Flat Navigation)

يعتمد هذا النمط على قائمة واحدة من العناصر دون تداخل هرمي عميق. يناسب الأنظمة ذات عدد محدود من الوحدات.

**أنظمة تتبع هذا النمط:**
- **Zoho Inventory**: قائمة جانبية مسطحة (Items, Sales, Purchases, Warehouses, Reports) — عمق مستوى واحد فقط
- **Fishbowl**: تنقل مسطح مع modules أفقية (Manufacturing, Inventory, Shipping, Receiving) — عمق 1-2 مستويات
- **Odoo Inventory**: شريط علوي مسطح لكل module مع sub-menus — عمق 2 مستويات كحد أقصى

### 1.2 النمط الهرمي (Hierarchical Navigation)

يعتمد على شجرة تنقل متعددة المستويات، حيث تتفرع القوائم إلى أقسام فرعية.

**أنظمة تتبع هذا النمط:**
- **SAP EWM**: هيكل Fiori Launchpad — 4 مستويات (Group > Category > Tile > Transaction) مع 8+ أقسام رئيسية (Inbound, Outbound, Internal, Inventory, Yard, Monitoring, Labor, Master Data)
- **SAP TM**: هيكل مماثل — 7 أقسام (Planning, Execution, Tendering, Settlement, Carrier, Analytics, Configuration)
- **Oracle Fusion WM**: هيكل هرمي — 3-4 مستويات مع تنقل قائم على الأدوار (Role-based navigation)
- **Oracle OTM**: هيكل هرمي عميق مع Redwood UX transition — 4+ مستويات
- **Manhattan Active WM/TM**: هيكل unified platform — 3 مستويات مع digital warehouse map كنقطة دخول

### 1.3 النمط المختلط (Hybrid Navigation)

يجمع بين القوائم المسطحة للمهام اليومية والهيكل الهرمي للإعدادات والتقارير.

**أنظمة تتبع هذا النمط:**
- **Microsoft D365 WM/TM**: Workspaces مسطحة للعمليات اليومية + تنقل هرمي للإعدادات والتقارير
- **NetSuite WMS**: Dashboard مسطح + قوائم هرمية (Inbound, Inventory, Outbound, Reports, Setup)
- **Blue Yonder WMS/TMS**: Control tower مسطح + drill-down هرمي
- **Infor WMS**: 3D Visual Warehouse كنقطة دخول + قوائم هرمية تقليدية
- **Acumatica WMS**: Role-based dashboards مسطحة + generic inquiries هرمية
- **Korber WMS**: HTML5 web UI مع event monitors مسطحة + configuration هرمي

### جدول مقارنة أنماط هندسة المعلومات

| النظام | النمط | عمق التنقل | تصفية حسب الدور | بحث سريع | مسار التنقل (Breadcrumbs) | استجابة الجوال |
|--------|-------|------------|----------------|----------|---------------------------|----------------|
| SAP EWM | هرمي | 4 مستويات | نعم (Fiori roles) | نعم (Fiori search) | نعم | جزئي (Fiori responsive) |
| SAP TM | هرمي | 4 مستويات | نعم | نعم | نعم | جزئي |
| Oracle Fusion WM | هرمي | 3-4 مستويات | نعم | نعم | نعم | جزئي (RF mobile) |
| Oracle OTM | هرمي | 4+ مستويات | نعم | نعم (Redwood NLP) | نعم | جزئي |
| NetSuite WMS | مختلط | 2-3 مستويات | نعم (8+ أدوار) | نعم (Global search) | نعم | نعم (mobile app) |
| D365 WM | مختلط | 2-3 مستويات | نعم (Workspaces) | نعم | نعم | نعم (WMS app) |
| D365 TM | مختلط | 2-3 مستويات | نعم | نعم | نعم | جزئي (Power Apps) |
| Manhattan Active WM | هرمي | 3 مستويات | نعم | نعم | نعم | نعم (WM Mobile) |
| Manhattan Active TM | هرمي | 3 مستويات | نعم | نعم | نعم | نعم (Driver app) |
| Blue Yonder WMS | مختلط | 3 مستويات | نعم | نعم | نعم | نعم |
| Blue Yonder TMS | مختلط | 3 مستويات | نعم | نعم | نعم | نعم (Driver app) |
| Infor WMS | مختلط | 3 مستويات | نعم | نعم | نعم | نعم (iOS app) |
| Infor Nexus TMS | مختلط | 2-3 مستويات | نعم | نعم | نعم | نعم |
| Korber WMS | مختلط | 2-3 مستويات | نعم | نعم | نعم | نعم (HTML5) |
| Odoo Inventory | مسطح | 2 مستويات | جزئي | نعم (Command palette) | نعم | نعم (responsive) |
| Acumatica WMS | مختلط | 2-3 مستويات | نعم (Role dashboards) | نعم (GI search) | نعم | نعم (native app) |
| Fishbowl | مسطح | 1-2 مستويات | لا | محدود | لا | جزئي (Fishbowl Go) |
| Zoho Inventory | مسطح | 1 مستوى | لا | نعم | محدود | نعم (mobile app) |

**ملاحظة رئيسية:** الأنظمة المؤسسية (Tier 1) تميل إلى 4+ مستويات تنقل مع تصفية قوية حسب الأدوار، بينما أنظمة SMB (Tier 3) تفضل البساطة مع 1-2 مستويات. النمط المختلط هو الأكثر شيوعًا في Tier 2 حيث يوازن بين العمق والبساطة.

---

## 2. أنماط التنقل

### 2.1 أنماط القائمة الجانبية (Sidebar Patterns)

| النمط | الوصف | الأنظمة |
|-------|-------|---------|
| **Mega Menu** | قائمة كبيرة تعرض جميع الأقسام مرة واحدة | SAP Fiori Launchpad, Oracle Fusion |
| **Collapsible Sidebar** | قائمة جانبية قابلة للطي مع أيقونات | D365, Acumatica, NIT-SCS-V2 |
| **Top Navigation Bar** | شريط علوي أفقي | Odoo, Zoho |
| **Tab-Based** | تبويبات أفقية لكل وحدة | NetSuite, Fishbowl |
| **Control Tower** | لوحة مركزية مع drill-down | Manhattan Active, Blue Yonder |
| **3D Visual Entry** | خريطة مرئية ثلاثية الأبعاد كنقطة دخول | Infor WMS (فريد في السوق) |

### 2.2 البحث والتنقل السريع

تتمايز الأنظمة بشكل واضح في قدرات البحث السريع:

- **أفضل الممارسات**: SAP Fiori Enterprise Search, Oracle Redwood NLP Search, Odoo Command Palette (Ctrl+K)
- **المستوى المتوسط**: D365 Global Search, NetSuite Global Search, Acumatica Generic Inquiries
- **المستوى الأساسي**: Fishbowl (بحث داخل كل module فقط), Zoho (بحث بسيط)

### 2.3 التنقل المتخصص للأدوار

| مستوى التخصص | الأنظمة | التفاصيل |
|--------------|---------|----------|
| **عالي** (8+ أدوار مختلفة) | SAP EWM, NetSuite WMS, NIT-SCS-V2 | كل دور يرى navigation مختلف تمامًا |
| **متوسط** (3-5 أدوار) | D365, Manhattan, Blue Yonder, Infor | مجموعات أدوار رئيسية مع تخصيص |
| **أساسي** (admin/user) | Odoo, Fishbowl, Zoho | تقسيم ثنائي بين مدير ومستخدم |

---

## 3. أنماط تصميم النماذج

تُعد النماذج (Forms) العنصر الأكثر تفاعلاً في أنظمة سلسلة التوريد. تتنوع أنماط تصميم النماذج بشكل ملحوظ عبر الأنظمة:

### 3.1 نمط الرأس + البنود (Header-Line Pattern)

**الوصف:** نموذج مقسم إلى قسم رأس (Header) يحتوي على البيانات الرئيسية (المورد، التاريخ، المستودع) وجدول بنود (Line Items) للمواد والكميات.

**الأنظمة التي تستخدمه:** جميع الأنظمة الـ 18 تستخدم هذا النمط كنمط أساسي — فهو المعيار الصناعي لمستندات سلسلة التوريد (PO, GRN, MI, MR, etc.).

| النظام | تفاصيل التنفيذ |
|--------|----------------|
| SAP EWM/TM | Header fields + item table مع tabs للتفاصيل (Partners, Texts, Status) |
| Oracle Fusion/OTM | Multi-tab header + scrollable line grid |
| NetSuite WMS | Custom form layout — header body/column fields + subtab lines |
| D365 WM/TM | FastTabs (collapsible sections) + line grid |
| Manhattan Active | Streamlined header + dynamic line table |
| Blue Yonder | Header + configurable line columns |
| Infor WMS | Header + line grid مع inline editing |
| Korber | Configurable header + line item grid |
| Odoo | Chatter-enabled header + line items مع inline editing |
| Acumatica | Tab-based header + grid lines مع smart panel |
| Fishbowl | Simple header + item lines |
| Zoho | Clean header + item table |
| **NIT-SCS-V2** | `useDocumentForm` hook + `LineItemsTable` component مع `formConfigs.ts` |

### 3.2 نمط المعالج المتعدد الخطوات (Multi-Step Wizard)

**الوصف:** تقسيم العملية إلى خطوات متتابعة مع شريط تقدم (Progress Bar).

| النظام | يستخدم المعالج | حالات الاستخدام |
|--------|----------------|-----------------|
| SAP EWM | نعم | Goods Receipt wizard, Packing station wizard |
| SAP TM | نعم | Freight order creation wizard, Tendering wizard |
| Oracle Fusion WM | نعم | Wave creation, Receiving wizard |
| Oracle OTM | نعم | Shipment planning wizard |
| NetSuite WMS | نعم | Wave release wizard, Cycle count setup |
| D365 WM | نعم | Load building wizard, Wave template setup |
| Manhattan Active WM | محدود | Streamlined single-page preference — "order streaming" يقلل الحاجة للمعالجات |
| Blue Yonder WMS | نعم | Configuration wizards |
| Infor WMS | نعم | Setup wizards |
| Korber WMS | نعم | Configuration wizards |
| Odoo | نعم | Multi-step receipt/ship configuration (1/2/3 خطوات) |
| Acumatica | نعم | Setup wizards, Import wizards |
| Fishbowl | محدود | Basic setup wizard |
| Zoho | محدود | Getting started wizard فقط |
| **NIT-SCS-V2** | لا (حاليًا) | Header-Line pattern فقط — فرصة تحسين للعمليات المعقدة |

### 3.3 نمط علامات التبويب (Tabbed Forms)

**الوصف:** تقسيم النموذج الواحد إلى tabs تحتوي على معلومات مختلفة.

| النظام | عدد الـ Tabs النموذجي | أمثلة |
|--------|---------------------|-------|
| SAP EWM | 5-8 tabs | Header, Items, Partners, Texts, Status, Handling Units, Quality |
| Oracle Fusion WM | 4-6 tabs | General, Lines, Shipping, Status, Attachments |
| D365 WM | 6-10 FastTabs | General, Lines, Financial, Delivery, Administration, Warehouse |
| Manhattan Active | 3-4 tabs | Core data, Details, History |
| Acumatica | 4-6 tabs | Summary, Details, Financial, Approvals, Activities |
| Odoo | 3-5 tabs | Operations, Additional Info, Notes |
| **NIT-SCS-V2** | 1-2 tabs (ضمن SectionLandingPage) | فرصة لإضافة tabs داخل النماذج |

### 3.4 نمط المسح الضوئي (Scan-Driven)

**الوصف:** نماذج مصممة أساسًا للعمل عبر المسح الضوئي (barcode/RFID) على الأجهزة المحمولة.

| النظام | جودة تجربة المسح | التفاصيل |
|--------|------------------|----------|
| SAP EWM | ممتاز | RF framework + Fiori mobile — scan-and-confirm workflow |
| Manhattan Active WM | ممتاز | Modern mobile app — scan-driven بالكامل |
| Blue Yonder WMS | جيد جدًا | RF scanning + voice picking |
| D365 WM | جيد جدًا | Dedicated WMS mobile app مع camera scanning |
| Infor WMS | جيد جدًا | iOS app + Web RF |
| NetSuite WMS | جيد | Mobile scan app (keyboard-wedge) |
| Korber WMS | جيد | HTML5 RF interface |
| Odoo | جيد | Barcode app مع zero-latency scanning |
| Oracle Fusion WM | جيد | RF mobile application |
| Acumatica | متوسط | Native app scanning — مراجعات مختلطة |
| Fishbowl | أساسي | Fishbowl Go مع camera scanning |
| Zoho | أساسي | Camera-based barcode scanning فقط |
| **NIT-SCS-V2** | متوسط | MobileGrnReceive, MobileMiIssue, MobileWtTransfer — 3 صفحات mobile |

### 3.5 نمط الاستثناءات (Exception-Driven)

**الوصف:** نماذج تظهر فقط عند وجود انحراف عن المسار الطبيعي — لا تتطلب تدخلاً يدويًا في الحالة العادية.

| النظام | يدعم هذا النمط | أمثلة |
|--------|----------------|-------|
| SAP EWM | نعم (متقدم) | Exception queue في Warehouse Monitor — مهام stuck, overdue, capacity alerts |
| Manhattan Active WM | نعم (متقدم) | Order streaming مع exception-only intervention |
| Blue Yonder WMS | نعم | AI-driven exception prioritization |
| Oracle OTM | نعم | Delayed shipment queues, cost overrun alerts |
| D365 WM | نعم | Workspace exception tiles |
| Infor WMS | نعم | Event monitors مع alert-based intervention |
| Korber WMS | نعم | Event monitors |
| NetSuite WMS | جزئي | Saved search-based alerts |
| Odoo | جزئي | Automated replenishment alerts |
| **NIT-SCS-V2** | جزئي | Chain notifications (12 rules) — فرصة لتوسيع Exception queues |

---

## 4. أنماط التدفق التشغيلي

### 4.1 تدفق الاستلام (Receiving Flow)

| المرحلة | SAP EWM | Oracle Fusion | D365 WM | Manhattan | NetSuite | Odoo | NIT-SCS-V2 |
|---------|---------|---------------|---------|-----------|----------|------|------------|
| ASN/إشعار مسبق | نعم | نعم | نعم | نعم | اختياري | لا | لا |
| موعد الاستلام | نعم (Yard) | نعم | جزئي | نعم (Yard) | لا | لا | لا |
| تفريغ | نعم (HU tasks) | نعم (LPN) | نعم | نعم | نعم | نعم | نعم (GRN) |
| فحص الجودة | نعم (QIE) | نعم (Hold) | نعم (QM) | نعم (QC rules) | جزئي | نعم | نعم (QCI auto) |
| التوضيب | نعم (POSC) | نعم (directed) | نعم (directives) | نعم (AI) | نعم (rules) | نعم (rules) | جزئي |
| تحديث المخزون | فوري (HANA) | فوري | فوري | فوري | فوري | فوري (double-entry) | فوري |
| تقرير التلف | نعم | نعم | نعم | نعم | جزئي | نعم | نعم (DR auto) |

**موقع NIT-SCS-V2:** يغطي التدفق الأساسي (GRN → QCI → DR auto-chain) لكن ينقصه: ASN, Appointment Scheduling, Yard Management, AI-directed putaway.

### 4.2 تدفق الإصدار (Issuing Flow)

| المرحلة | SAP EWM | Oracle Fusion | D365 WM | Manhattan | NetSuite | Odoo | NIT-SCS-V2 |
|---------|---------|---------------|---------|-----------|----------|------|------------|
| طلب المواد | Delivery Request | Fulfillment | Release | Order Stream | Wave | Delivery Order | MR → MI |
| Wave Management | نعم (متقدم) | نعم | نعم | اختياري (waveless) | نعم | لا | لا |
| استراتيجيات الالتقاط | Zone/Cluster/Batch | Zone/Batch/Cluster | Zone/Batch/Cluster | AI-optimized | Zone/Batch | FIFO/FEFO/LIFO | FIFO |
| التعبئة | نعم (Packing station) | نعم | نعم | نعم | نعم | نعم | لا |
| التدريج | نعم (Staging area) | نعم | نعم | نعم | نعم | اختياري | لا |
| إصدار البوابة | نعم | نعم | نعم | نعم | نعم | نعم | نعم (GatePass auto) |
| تحديث المخزون | فوري | فوري | فوري | فوري | فوري | فوري | فوري (FIFO lots) |

**موقع NIT-SCS-V2:** يدعم MR → MI → GatePass chain لكن ينقصه Wave Management, Packing Station, Staging Area.

### 4.3 تدفق المرتجعات (Returns Flow)

| المرحلة | SAP EWM | Oracle Fusion | D365 WM | Manhattan | Odoo | NIT-SCS-V2 |
|---------|---------|---------------|---------|-----------|------|------------|
| استلام المرتجع | Return Delivery | Return Receipt | RMA | Returns WC | Reverse Transfer | MRN |
| الفحص | نعم (QIE) | نعم | نعم (Quarantine) | نعم | نعم | نعم (QCI auto) |
| قرار التصرف | 4+ خيارات (Restock/Rework/Scrap/Vendor Return) | 3+ خيارات | 3+ خيارات (Disposition codes) | 3+ خيارات | 3 خيارات | نعم (active/blocked lots) |
| إعادة التخزين | نعم (putaway) | نعم | نعم | نعم | نعم | نعم (FIFO lots) |
| التخلص | نعم (Scrap process) | نعم | نعم | نعم | نعم | نعم (Scrap workflow) |

**موقع NIT-SCS-V2:** تغطية قوية — MRN complete → restocks good (active) + damaged (blocked lots) + auto-creates QCI.

### 4.4 تدفق الجرد (Cycle Counting Flow)

| المرحلة | SAP EWM | Oracle Fusion | D365 WM | Manhattan | NetSuite | NIT-SCS-V2 |
|---------|---------|---------------|---------|-----------|----------|------------|
| خطط الجرد | نعم (ABC-driven) | نعم | نعم (Cycle count plans) | نعم (perpetual) | نعم | لا (يدوي فقط) |
| الجرد المستمر | نعم | نعم | نعم (Spot counting) | نعم | لا | لا |
| الجرد بالمسح | نعم (RF) | نعم (RF) | نعم (Mobile) | نعم (Mobile) | نعم (Mobile) | جزئي |
| تسوية الفروقات | نعم (auto-adjust) | نعم | نعم | نعم | نعم | جزئي |
| Zero-stock checks | نعم | نعم | نعم | نعم | لا | لا |

**موقع NIT-SCS-V2:** فجوة واضحة — لا توجد Cycle Count Plans أو ABC analysis أو perpetual counting.

### 4.5 تدفق الشحن (Shipping Flow)

| المرحلة | SAP TM | Oracle OTM | D365 TM | Manhattan TM | Blue Yonder TMS | NIT-SCS-V2 |
|---------|--------|------------|---------|--------------|-----------------|------------|
| تخطيط النقل | نعم (Multi-modal) | نعم (Multi-modal) | نعم | نعم (Continuous) | نعم (AI) | لا |
| تحسين الحمولة | نعم (3D) | نعم | نعم | نعم (3D) | نعم (3D) | لا |
| اختيار الناقل | نعم (BRF+ rules) | نعم (Rules) | نعم (Rating engine) | نعم | نعم (AI) | يدوي |
| تتبع الشحنة | نعم (ML ETA) | نعم (ML ETA) | نعم | نعم | نعم | نعم (Shipment status) |
| إثبات التسليم (POD) | نعم (Mobile) | نعم (Mobile) | نعم (Power Apps) | نعم (Driver app) | نعم (Mobile) | نعم (Shipment deliver) |
| تسوية الشحن | نعم (Automated) | نعم (Automated) | يدوي | نعم | نعم (Automated) | لا |

**موقع NIT-SCS-V2:** يدعم Shipment tracking والتسليم (deliver → auto-creates GRN) لكن ينقصه Transport Planning, Load Optimization, Carrier Selection, Freight Audit.

---

## 5. أنماط آلة الحالة

تختلف الأنظمة في نماذج آلة الحالة (State Machine) المستخدمة لإدارة دورة حياة المستندات:

### 5.1 تصنيف أنماط آلة الحالة

| النمط | الوصف | الأنظمة |
|-------|-------|---------|
| **خطي (Linear)** | تقدم من حالة إلى التالية بترتيب ثابت | Zoho, Fishbowl — draft → confirmed → shipped/received |
| **متفرع (Branching)** | نقاط قرار تؤدي إلى مسارات مختلفة | NetSuite (SuiteFlow), D365, Odoo, Acumatica, **NIT-SCS-V2** |
| **متوازي (Parallel)** | حالات متعددة تعمل بالتوازي | SAP EWM (warehouse task + delivery status), Manhattan Active, Oracle Fusion |
| **تكيفي (Adaptive)** | آلة حالة تتغير ديناميكيًا بناءً على السياق | Manhattan Active (order streaming), Blue Yonder (agentic AI) |

### 5.2 عدد الحالات لكل نوع مستند

| نوع المستند | SAP EWM | Oracle Fusion | D365 | NetSuite | Odoo | NIT-SCS-V2 |
|-------------|---------|---------------|------|----------|------|------------|
| أمر الاستلام (GRN) | 6-8 حالات | 5-7 | 5-6 | 4-5 | 3-4 (draft, waiting, done) | 5 (draft, submitted, qc_pending, qc_approved, completed) |
| أمر الإصدار (MI) | 6-8 | 5-7 | 5-6 | 4-5 | 3-4 | 5 (draft, submitted, approved, issued, completed) |
| طلب المواد (MR) | 5-7 | 4-6 | 4-5 | 3-4 | 3-4 | 4 (draft, submitted, approved, completed) |
| المرتجعات (MRN) | 5-7 | 4-6 | 4-5 | 3-4 | 3-4 | 4 (draft, submitted, completed, cancelled) |
| الشحن (Shipment) | 8-10 | 6-8 | 5-7 | 4-5 | 3-4 | 5 (draft, confirmed, in_transit, delivered, completed) |
| أمر النقل (Freight Order) | 10-12 | 8-10 | 5-7 | — | — | — |

### 5.3 سلاسل المستندات (Document Chains)

ميزة رئيسية تميز NIT-SCS-V2 — سلاسل مستندات تلقائية:

| السلسلة | SAP | Oracle | D365 | Manhattan | NIT-SCS-V2 |
|---------|-----|--------|------|-----------|------------|
| GRN → QCI | نعم (QIE trigger) | نعم (Hold trigger) | نعم (QM trigger) | نعم (QC rules) | **نعم (auto-create)** |
| GRN → DR (تلف) | نعم | نعم | نعم | نعم | **نعم (auto-create)** |
| MI → GatePass | جزئي (manual) | جزئي | جزئي | جزئي | **نعم (auto-create)** |
| MRN → QCI (تالف) | نعم | نعم | نعم | نعم | **نعم (auto-create)** |
| Shipment → GRN | نعم (auto) | نعم (auto) | نعم (auto) | نعم (auto) | **نعم (auto-create draft)** |
| IMSF → WT | جزئي | جزئي | جزئي | نعم | **نعم (auto-create)** |
| QCI pass → GRN update | نعم | نعم | نعم | نعم | **نعم (auto qc_approved)** |
| QCI fail → DR | نعم | نعم | نعم | نعم | **نعم (auto-create)** |

**ملاحظة:** NIT-SCS-V2 يتفوق في سلاسل المستندات التلقائية — 8 سلاسل auto-create مقارنة بـ 5-6 في الأنظمة المؤسسية التي تتطلب عادةً تكوينًا يدويًا لبعض السلاسل.

### 5.4 آلة الحالة في NIT-SCS-V2 مقارنة بالسوق

| الميزة | Enterprise (SAP/Oracle/Manhattan) | Mid-Market (D365/BY/Infor) | NIT-SCS-V2 |
|--------|----------------------------------|---------------------------|------------|
| عدد الحالات | 6-12 لكل مستند | 4-7 | 4-5 |
| فروع الحالة | متعددة + متوازية | متعددة | متعددة (branching) |
| سلاسل تلقائية | 5-6 (configurable) | 3-4 | **8 سلاسل** |
| الموافقات | متعدد المستويات + متوازي | متعدد المستويات | متعدد المستويات (3 مستويات MI) |
| Custom workflows | نعم (visual builder) | نعم (visual builder) | نعم (Workflow Builder + templates) |
| Dynamic document types | لا (schema-bound) | لا | **نعم (DynamicDocumentType)** |

---

## 6. جدول مقارنة شامل

### مقارنة شاملة — هيكل الصفحات والنماذج

| المعيار | SAP EWM | SAP TM | Oracle Fusion WM | Oracle OTM | NetSuite WMS | D365 WM | D365 TM | Manhattan WM | Manhattan TM | BY WMS | BY TMS | Infor WMS | Infor TMS | Korber | Odoo | Acumatica | Fishbowl | Zoho |
|---------|---------|--------|-----------------|------------|-------------|---------|---------|-------------|-------------|--------|--------|-----------|-----------|--------|------|-----------|----------|------|
| **نمط التنقل** | هرمي | هرمي | هرمي | هرمي | مختلط | مختلط | مختلط | هرمي | هرمي | مختلط | مختلط | مختلط | مختلط | مختلط | مسطح | مختلط | مسطح | مسطح |
| **عمق التنقل** | 4 | 4 | 3-4 | 4+ | 2-3 | 2-3 | 2-3 | 3 | 3 | 3 | 3 | 3 | 2-3 | 2-3 | 2 | 2-3 | 1-2 | 1 |
| **Header-Line** | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم |
| **Multi-Step Wizard** | نعم | نعم | نعم | نعم | نعم | نعم | نعم | محدود | محدود | نعم | نعم | نعم | نعم | نعم | نعم | نعم | محدود | محدود |
| **Tabbed Forms** | 5-8 | 5-8 | 4-6 | 4-6 | 3-5 | 6-10 | 5-8 | 3-4 | 3-4 | 3-5 | 3-5 | 3-5 | 3-4 | 3-4 | 3-5 | 4-6 | 2-3 | 2-3 |
| **Scan-Driven** | ممتاز | — | جيد | — | جيد | جيد جدًا | — | ممتاز | — | جيد جدًا | — | جيد جدًا | — | جيد | جيد | متوسط | أساسي | أساسي |
| **Exception-Driven** | متقدم | متقدم | نعم | نعم | جزئي | نعم | نعم | متقدم | نعم | نعم | نعم | نعم | نعم | نعم | جزئي | جزئي | لا | لا |
| **Role-Based Nav** | 8+ أدوار | 7 أدوار | نعم | نعم | 8+ أدوار | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | نعم | جزئي | نعم | لا | لا |
| **Mobile Forms** | متقدم | أساسي | جيد | أساسي | جيد | جيد جدًا | جزئي | جيد جدًا | جيد | جيد جدًا | جيد | جيد جدًا | جيد | جيد | جيد | متوسط | أساسي | أساسي |
| **State Machine** | متوازي | متوازي | متوازي | متوازي | متفرع | متفرع | متفرع | تكيفي | تكيفي | تكيفي | تكيفي | متفرع | متفرع | متفرع | متفرع | متفرع | خطي | خطي |
| **Avg States/Doc** | 6-8 | 8-10 | 5-7 | 6-8 | 4-5 | 5-6 | 5-7 | 5-7 | 5-7 | 5-7 | 5-7 | 5-6 | 4-5 | 4-5 | 3-4 | 4-5 | 3-4 | 3-4 |
| **Auto Chains** | 5-6 | 3-4 | 4-5 | 3-4 | 2-3 | 3-4 | 2-3 | 4-5 | 3-4 | 3-4 | 2-3 | 3-4 | 2-3 | 2-3 | 2-3 | 2-3 | 1-2 | 1 |

### خلاصة الموقع التنافسي لـ NIT-SCS-V2

| البُعد | التصنيف | الملاحظات |
|--------|---------|----------|
| هندسة المعلومات | **جيد** | 10 أقسام sidebar مع role-based nav لـ 10 أدوار — يقارن بـ D365 و NetSuite |
| تصميم النماذج | **متوسط-جيد** | Header-Line pattern قوي عبر 15 نوع مستند — ينقصه Multi-Step Wizards و Tabbed Forms |
| تجربة المسح | **أساسي-متوسط** | 3 صفحات mobile فقط — فجوة مقارنة بـ SAP/Manhattan/D365 |
| التدفقات التشغيلية | **جيد** | 8 document chains تلقائية — يتفوق على أنظمة Tier 2 في auto-chain depth |
| آلة الحالة | **جيد** | Branching state machine مع 4-5 حالات/مستند — مناسب للمشاريع الإنشائية |
| Dynamic Documents | **متفوق** | ميزة فريدة (DynamicDocumentType) — لا يوجد مقابل مباشر إلا في أنظمة no-code |

---

*تم التحليل استنادًا إلى بيانات بحثية من فبراير 2026. قد تتغير الميزات مع التحديثات المستقبلية للأنظمة.*
