# Logistics Operations (Job Orders, Kanban, SLA Tracking, Fleet, Payments)

## Description

The logistics module manages all transportation and equipment-related work orders through a unified Job Order (JO) system supporting 7 types (Transport, Equipment, Rental Monthly, Rental Daily, Scrap, Generator Rental, Generator Maintenance). Features a drag-and-drop Kanban board for visual workflow management, 4-level approval workflow based on value, SLA tracking with stop-the-clock support, fleet management, and payment tracking.

**Why it exists**: To centralize all logistics requests, control costs through approvals, visualize work progress, meet SLA commitments, and track payments to suppliers/vendors.

## User Flow

### Job Order Lifecycle (All 7 Types)

#### 1. Create Job Order
- User navigates to "Logistics" → "Job Orders" → "New Job Order"
- Selects JO Type:
  - **Transport**: Material/equipment movement between locations
  - **Equipment**: Request for construction equipment (crane, forklift, etc.)
  - **Rental Monthly**: Monthly equipment rental
  - **Rental Daily**: Daily equipment rental
  - **Scrap**: Scrap material disposal/sale
  - **Generator Rental**: Rent diesel generator
  - **Generator Maintenance**: Generator servicing/repair
- Enters header data:
  - Project
  - Entity (business unit)
  - Supplier/Vendor (if known)
  - Request Date, Required Date
  - Priority (low/normal/high/urgent)
  - Description
  - Notes
- Enters type-specific details:
  - **Transport**: From Location, To Location, Distance, Cargo Type, Estimated Weight
  - **Rental**: Start Date, End Date, Daily/Monthly Rate, Deposit Amount
  - **Generator**: Generator ID, Capacity (KVA), Fuel Type, Runtime Hours
  - **Equipment**: Equipment Type, Operator Required, Shift Hours, Equipment Lines (type, quantity, duration)
  - **Scrap**: Scrap Type, Estimated Weight, Estimated Value
- System calculates `estimatedCost`:
  - Transport: Distance × rate per km
  - Rental: Duration × daily/monthly rate
  - Equipment: Hours × hourly rate
  - Scrap: Manual entry (expected sale price)
- Auto-assigns JO-YYYY-NNNN
- Status: draft

#### 2. Submit for Approval
- User clicks "Submit for Approval"
- Status: draft → pending_approval
- System determines approval level based on `estimatedCost`:
  - **Level 1** (<5K SAR): Logistics Coordinator, SLA 4 hours
  - **Level 2** (5-20K SAR): Logistics Manager, SLA 8 hours
  - **Level 3** (20-100K SAR): Operations Director, SLA 24 hours
  - **Level 4** (>100K SAR): CEO, SLA 48 hours
- Creates approval record in `approvals` table
- Creates SLA tracking record
- Sends notification to approver's role

#### 3. Multi-Level Approval
- Approver reviews JO details
- Options:
  - **Approve**: If final level → status: approved; else create next approval
  - **Reject**: status: rejected, workflow ends
  - **Request Quote**: status: pending_approval → quoted (pause for supplier quote)

#### 4. Quotation (Optional)
- Logistics Coordinator requests quotes from suppliers
- Receives quotes, selects best option
- Updates JO:
  - `supplierId` (selected vendor)
  - `quotedCost` (actual quote amount)
  - `quotationDate`
- If `quotedCost` exceeds approval threshold, restart approval flow at higher level
- Status: quoted → pending_approval (resume approval)

#### 5. Assignment
- After approval, Logistics Coordinator assigns JO:
  - For Transport: Assign driver, vehicle
  - For Equipment: Assign equipment fleet items
  - For Rental: Finalize contract with supplier
- Status: approved → assigned
- Records `assignedDate`, `assignedTo` (employee or supplier)

#### 6. Execution
- Work begins
- Status: assigned → in_progress
- Records `startDate`
- For Transport JOs:
  - Driver updates delivery status
  - Photos uploaded (proof of delivery)
- For Rental JOs:
  - Equipment deployed to site
  - Daily/monthly usage logged

#### 7. Hold (If Needed)
- If work paused (site not ready, weather delay, etc.)
- Status: in_progress → on_hold
- SLA clock pauses (stop-the-clock)
- Records `holdReason`, `holdDate`

#### 8. Resume from Hold
- When work can resume
- Status: on_hold → in_progress
- SLA clock resumes from where it paused

#### 9. Completion
- Work finished
- Status: in_progress → completed
- Records `completedDate`, `completedById`
- For Transport:
  - Delivery confirmed, POD (Proof of Delivery) uploaded
- For Equipment:
  - Equipment returned, hours logged
- For Rental:
  - Rental period ended, equipment returned
- For Scrap:
  - Scrap sold, payment received

#### 10. Invoicing
- Supplier submits invoice
- Finance team receives and verifies
- Status: completed → invoiced
- Records:
  - `invoiceNumber`
  - `invoiceAmount`
  - `invoiceDate`
- Payment tracked separately in `jo_payments` table

#### 11. Cancellation (Before Completion)
- Can cancel from any status except completed/invoiced
- Status: any → cancelled
- Records `cancellationReason`, `cancelledDate`
- If assignment made, notify assigned party

### Kanban Board Interaction

#### 1. View Kanban
- User navigates to "Transport" → "Kanban Board"
- Board displays 4 columns:
  - **New**: draft, pending_approval, rejected
  - **Assigning**: approved, assigned, quoted
  - **In Progress**: in_progress, on_hold
  - **Completed**: completed, invoiced

#### 2. Drag-and-Drop Status Change
- User drags JO card from "New" column to "Assigning" column
- System detects drop event
- Validates allowed transition:
  - New → Assigning: draft → approved (requires approval first, shows error)
  - Assigning → In Progress: assigned → in_progress (allowed)
  - In Progress → Completed: in_progress → completed (allowed)
- If valid, updates JO status via API
- If invalid, shows toast error: "Cannot move directly. Please follow approval workflow."

#### 3. Kanban Card Info
Each card shows:
- JO Number
- Project Name
- JO Type icon
- Priority badge
- Estimated Cost
- SLA status (at-risk if remaining < 4 hours)
- Assigned To (if assigned)

#### 4. Quick Actions from Kanban
- Click card → opens JO detail modal
- Actions available:
  - View Details
  - Approve (if user has permission)
  - Assign (if status = approved)
  - Mark Completed (if status = in_progress)
  - Cancel

### SLA Tracking

#### 1. SLA Start
- SLA clock starts when JO status changes to "pending_approval"
- Calculates `slaDueDate` based on approval level:
  - Level 1: Now + 4 hours
  - Level 2: Now + 8 hours
  - Level 3: Now + 24 hours
  - Level 4: Now + 48 hours

#### 2. SLA Monitoring
- Dashboard shows "At-Risk JOs" widget
- Query: `WHERE status = 'pending_approval' AND slaDueDate < NOW() + INTERVAL '4 hours'`
- JOs approaching SLA deadline highlighted in red

#### 3. Stop-the-Clock (On Hold)
- When JO status changes to "on_hold"
- SLA paused: `slaPausedAt = NOW()`
- When resumed (on_hold → in_progress):
  - Calculate pause duration: `pauseDuration = NOW() - slaPausedAt`
  - Extend due date: `slaDueDate += pauseDuration`

#### 4. SLA Completion
- When JO status changes to "approved" (final approval)
- Records `slaCompletedAt = NOW()`
- Calculates `slaMet = (slaCompletedAt <= slaDueDate)`
- If SLA missed, flags for review

### Payment Tracking

#### 1. Add Payment Record
- Finance team receives supplier invoice
- Clicks "Add Payment" on completed JO
- Enters:
  - Invoice Number
  - Invoice Receipt Date
  - Invoice Amount
  - Payment Due Date
  - Payment Status (pending/partial/paid/overdue)
- Creates record in `jo_payments` table

#### 2. Record Payment
- When payment made to supplier
- Updates payment record:
  - Payment Date
  - Amount Paid
  - Payment Method (bank_transfer/check/cash)
  - Payment Reference (transaction ID)
- If `amountPaid < invoiceAmount`: status = partial
- If `amountPaid = invoiceAmount`: status = paid

#### 3. Overdue Tracking
- Scheduled job checks payments with `paymentDueDate < NOW()` and status = pending
- Auto-updates status to "overdue"
- Sends alert to finance team

## API Endpoints

### Job Order Routes
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/job-orders` | List JOs (filter by status, joType, projectId) |
| GET | `/api/job-orders/:id` | Get single JO with all subtables (transportDetails, rentalDetails, etc.) |
| POST | `/api/job-orders` | Create new JO (draft) + type-specific details |
| PUT | `/api/job-orders/:id` | Update JO header (draft only) |
| POST | `/api/job-orders/:id/submit` | Submit for approval (draft → pending_approval, create approval + SLA) |
| POST | `/api/job-orders/:id/approve` | Approve current level (multi-level routing) |
| POST | `/api/job-orders/:id/reject` | Reject (pending_approval → rejected) |
| POST | `/api/job-orders/:id/assign` | Assign (approved → assigned, set assignedTo) |
| POST | `/api/job-orders/:id/start` | Start work (assigned → in_progress, set startDate) |
| POST | `/api/job-orders/:id/hold` | Pause work (in_progress → on_hold, pause SLA) |
| POST | `/api/job-orders/:id/resume` | Resume work (on_hold → in_progress, resume SLA) |
| POST | `/api/job-orders/:id/complete` | Mark completed (in_progress → completed, set completedDate) |
| POST | `/api/job-orders/:id/invoice` | Mark invoiced (completed → invoiced) |
| POST | `/api/job-orders/:id/cancel` | Cancel (any → cancelled, except completed/invoiced) |
| POST | `/api/job-orders/:id/payments` | Add payment record |
| PUT | `/api/job-orders/:id/payments/:pid` | Update payment record |

**RBAC**: Create/submit require `logistics_coordinator`, `site_engineer`, `manager`, `admin`. Approve requires role matching approval level. Assign/start/complete require `logistics_coordinator`, `manager`, `admin`.

## Validations

### Job Order Validations
- `joType` must be one of 7 valid types
- `estimatedCost` must be >= 0
- `requestDate` <= `requiredDate`
- Type-specific validations:
  - **Transport**: `fromLocation`, `toLocation`, `distance` required
  - **Rental**: `startDate`, `endDate`, `dailyRate` OR `monthlyRate` required
  - **Generator**: `generatorId`, `capacityKva` required
  - **Equipment**: At least 1 equipment line required
- Status transitions:
  - Only "draft" can be updated or submitted
  - Only "pending_approval" can be approved/rejected
  - Only "approved" can be assigned
  - Only "assigned" can start
  - Only "in_progress" can hold/complete
  - Only "on_hold" can resume
  - Cannot cancel if status = completed/invoiced

### Approval Validations
- Approver's role must match required level
- Cannot approve own JO (creator ≠ approver)
- Cannot skip approval levels

### Payment Validations
- `invoiceAmount` must be > 0
- `paymentDueDate` >= `invoiceReceiptDate`
- `amountPaid` cannot exceed `invoiceAmount`
- Payment status auto-calculated:
  - pending: amountPaid = 0
  - partial: 0 < amountPaid < invoiceAmount
  - paid: amountPaid = invoiceAmount

## Edge Cases

### 1. JO Quoted Cost Exceeds Approval Level
- Approved at Level 2 (5-20K)
- Quote received: 25K SAR (Level 3 threshold)
- System creates new Level 3 approval
- Requires higher authority re-approval

### 2. Kanban Drag from New to Completed
- User tries to drag draft JO directly to Completed column
- System blocks: "Cannot complete a draft JO. Please submit for approval first."
- No status change

### 3. SLA Calculation with Multiple Holds
- JO approved, SLA due: 4 hours (Level 1)
- After 1 hour: on_hold (weather delay) for 3 days
- After 3 days: resume
- New SLA due: Original + 3 days (clock paused during hold)

### 4. JO Cancellation After Assignment
- JO assigned to driver
- Project cancelled, JO cancelled
- Notification sent to driver
- Driver availability restored (if fleet tracking implemented)

### 5. Payment Partial Settlement
- Invoice amount: 10,000 SAR
- Company pays 8,000 SAR (dispute on 2,000)
- Payment status: partial
- Finance tracks outstanding 2,000 separately

### 6. Generator JO with Maintenance History
- Generator rented for 3 months
- Maintenance performed mid-rental
- Creates linked JO (type: Generator Maintenance)
- Tracks downtime (affects rental billing)

### 7. Transport JO with Multiple Trips
- Single JO for 10 deliveries (same route)
- Each trip logged separately (future: `transport_trips` table)
- Current: Uses notes field to track trip count

### 8. Equipment JO Overbooking
- Request for crane on specific date
- Fleet shows crane already assigned to another JO (conflict)
- Logistics Coordinator must:
  - Reject request
  - Find alternative equipment
  - Reschedule JO

### 9. Scrap JO Sale Price Variance
- Estimated value: 5,000 SAR
- Actual sale price: 3,500 SAR
- Variance recorded in payment record
- Finance reconciles difference

### 10. Rental JO Early Termination
- Monthly rental for 6 months
- Project completes after 4 months
- Rental ends early
- Invoice adjusted (pro-rated billing)
- Payment reflects actual duration

## Business Rules

### 1. JO 4-Level Approval Thresholds
Defined in `@nit-scs/shared/constants.ts`:
```
Level 1: 0-5K SAR, Logistics Coordinator, 4h SLA
Level 2: 5-20K SAR, Logistics Manager, 8h SLA
Level 3: 20-100K SAR, Operations Director, 24h SLA
Level 4: >100K SAR, CEO, 48h SLA
```

### 2. JO Type-Specific Master Data
- **Transport**: Uses `projects`, `warehouses` for from/to locations
- **Equipment**: Uses `equipment_types`, `equipment_fleet` tables
- **Generator**: Uses `generator_fleet` table
- **Rental**: Uses `suppliers` (rental vendors)
- **Scrap**: Uses `scrap_types` (steel, copper, mixed, hazardous)

### 3. SLA Business Days vs. Calendar Days
- Current: SLA calculated in calendar hours (24/7)
- Future: May switch to business hours (exclude weekends/holidays)

### 4. Transport JO Distance Calculation
- Manual entry (driver estimates)
- Future: Google Maps API integration for auto-calculation
- Used for cost estimation: `distance × rate_per_km`

### 5. Rental JO Billing Periods
- **Daily**: Charged per calendar day (midnight to midnight)
- **Monthly**: Charged per 30-day period
- Partial days rounded up (e.g., 2.5 days = 3 days)

### 6. Generator Rental Fuel Cost
- Rental rate includes equipment only (NOT fuel)
- Fuel charged separately based on runtime hours
- Formula: `fuelCost = runtimeHours × fuelConsumptionRate × fuelPricePerLiter`
- Tracked in `generatorDetails.fuelConsumed`

### 7. Equipment JO Operator Cost
- If `operatorRequired = true`, operator hourly rate added to total cost
- Operator from NIT employee pool or external vendor
- Tracked in `equipmentLines.operatorCost`

### 8. Scrap JO Approval Threshold
- Scrap sale < 10K SAR: Warehouse Supervisor approves disposal
- Scrap sale > 10K SAR: Requires management approval (asset disposal)
- Hazardous scrap: Always requires environmental compliance approval

### 9. Fleet Management Integration
- `equipment_fleet` table tracks all company-owned equipment
- Fields: equipmentCode, equipmentType, status (available/in_use/maintenance/retired)
- When JO assigned, fleet item status → in_use
- When JO completed, fleet item status → available
- Future: Full fleet utilization dashboard

### 10. Payment Terms
- Default: Net 30 days (due 30 days after invoice receipt)
- Some suppliers: Net 60 or Net 90
- Stored in `suppliers.paymentTerms`
- `paymentDueDate = invoiceReceiptDate + paymentTerms`

### 11. JO Priority Handling
- **Urgent**: Bypass approval (emergency exception) - NOT implemented
- **High**: Approver notified via SMS (not just email) - NOT implemented
- **Normal**: Standard workflow
- **Low**: Can be batched (weekly approvals) - NOT implemented
- Current: Priority is informational only (no workflow impact)

### 12. Kanban Column Status Mapping
Backend statuses grouped into UI columns:
```
New: draft, pending_approval, rejected
Assigning: approved, assigned, quoted
In Progress: in_progress, on_hold
Completed: completed, invoiced
```

### 13. At-Risk SLA Definition
- SLA due within 4 hours or less → flagged as at-risk
- Dashboard widget shows count
- Auto-sends reminder notification to approver
- Current: Reminder not implemented (manual monitoring)

### 14. JO Attachments
- Transport: POD (Proof of Delivery), delivery photos
- Equipment: Equipment inspection reports
- Rental: Rental agreement contract
- Scrap: Weighbridge slips, scrap sale receipts
- Current: Attachments stored separately (future: S3 integration)

### 15. JO Clone Feature
- Create new JO from existing template
- Useful for recurring JOs (e.g., monthly generator rental)
- Copies all header + type-specific details
- Resets status to "draft", new JO number assigned
- Future: Auto-recurring JOs (subscription model)
