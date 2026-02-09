# Quality Control (RFIM, OSD, MRV)

## Description

The quality module manages material inspection requests (RFIM), damage/shortage/overage reporting (OSD), and material returns (MRV). It ensures defective or incorrect materials are properly documented, rejected, and claimed from suppliers.

**Why it exists**: To maintain quality standards, protect the company from accepting defective materials, and provide documentation for supplier claims and returns.

## User Flow

### RFIM (Request for Inspection of Materials) Lifecycle

#### 1. Auto-Creation from MRRV
- When MRRV is created with `rfimRequired = true`
- On MRRV submit (draft → pending_qc)
- System auto-creates RFIM:
  - Links to MRRV via `mrrvId`
  - Auto-assigns RFIM-YYYY-NNNN
  - Request Date = MRRV submit date
  - Status: pending

#### 2. Manual Creation (Alternative)
- QC Officer can manually create RFIM (rare)
- Links to existing MRRV or standalone
- Status: pending

#### 3. Assign Inspector
- QC Officer or Warehouse Supervisor assigns QC Officer to RFIM
- Updates `inspectorId` field
- Status remains: pending

#### 4. Perform Inspection
- Assigned QC Officer reviews MRRV materials
- Checks:
  - Physical condition (damage, corrosion, defects)
  - Quantity match (invoice vs. received)
  - Specifications compliance (drawings, certs, COC)
  - Packaging adequacy
- Updates RFIM:
  - `inspectionDate`
  - `inspectionResult` (approved/rejected/partial)
  - `findings` (free text notes)
  - Status: pending → in_progress

#### 5. Complete Inspection
- QC Officer marks RFIM as completed
- Status: in_progress → completed
- If result = "rejected":
  - MRRV cannot proceed to "qc_approved"
  - Materials must be returned to supplier or disposed
- If result = "approved":
  - MRRV can be marked "qc_approved"
- If result = "partial":
  - Some items approved, some rejected
  - OSD Report created for rejected portion

### OSD (Over/Short/Damage) Report Lifecycle

#### 1. Auto-Creation from MRRV
- When MRRV submitted and any line has `qtyDamaged > 0`
- System auto-creates OSD Report:
  - Links to MRRV via `mrrvId`
  - Auto-assigns OSD-YYYY-NNNN
  - Includes damaged line items
  - Report Types: ["damage"]
  - Status: draft

#### 2. Manual Creation
- Warehouse staff discovers discrepancy after receiving
- Creates OSD Report manually
- Report Types (can select multiple):
  - **overage**: Received more than ordered
  - **shortage**: Received less than ordered
  - **damage**: Physical damage to materials
  - **wrong_item**: Incorrect item received
  - **quality_issue**: Specifications not met

#### 3. Complete OSD Report
- Warehouse Supervisor reviews damage
- Enters:
  - For each line:
    - `qtyInvoice` (ordered quantity)
    - `qtyReceived` (actual received)
    - `qtyOver`, `qtyShort`, `qtyDamaged`
    - Damage Type (physical/water/rust/packaging/other)
    - Estimated Loss (SAR)
  - Attachments (photos, videos)
  - Root Cause Analysis
- Status: draft → under_review

#### 4. Submit Claim to Supplier
- Logistics Manager reviews OSD
- Prepares claim letter/email
- Updates OSD:
  - `claimNumber` (reference)
  - `claimDate`
  - `claimAmount` (total SAR)
  - Status: under_review → claim_sent

#### 5. Supplier Response
- Supplier acknowledges claim
- Status: claim_sent → awaiting_response
- Supplier may:
  - Accept claim → issue credit note
  - Dispute claim → negotiate
  - Ignore claim → escalate

#### 6. Negotiation (If Disputed)
- Status: awaiting_response → negotiating
- Multiple rounds of communication
- May involve:
  - Insurance company
  - Third-party inspection
  - Legal team (for high-value claims)

#### 7. Resolution
- Claim settled (full/partial/rejected)
- Status: negotiating → resolved
- Records:
  - `settlementAmount` (final agreed amount)
  - `settlementDate`
  - `settlementMethod` (credit_note/replacement/cash_refund)

#### 8. Close OSD
- After financial settlement complete
- Status: resolved → closed
- OSD is archived

### MRV (Material Return Voucher) Lifecycle

#### 1. Create MRV
- Site Engineer creates MRV for:
  - Excess materials (over-ordered)
  - Unused materials after project completion
  - Defective materials (not caught at receiving)
  - Wrong materials issued
- Enters:
  - Project (source)
  - To Warehouse (destination)
  - From Warehouse (if applicable, e.g., project site warehouse)
  - Return Reason
  - Original MIRV (if returning previously issued materials)
- Adds line items: Item, Quantity, UOM, Condition, Notes
- Auto-assigns MRV-YYYY-NNNN
- Status: draft

#### 2. Submit for Approval
- Site Engineer submits
- Status: draft → pending
- Warehouse Supervisor reviews

#### 3. Physical Return + Inspection
- Materials physically returned to warehouse
- Warehouse staff inspects condition
- Updates MRV:
  - `receivedById` (warehouse staff who accepted return)
  - `receivedDate`
  - For each line: Condition (good/damaged/defective)
- Status: pending → received

#### 4. Add to Inventory (If Good Condition)
- Warehouse staff marks MRV as completed
- Status: received → completed
- System calls `addStock()` for each line with condition = "good"
- Creates new inventory lot
- Stock becomes available for future MIRVs

#### 5. Rejection (If Unacceptable)
- If materials too damaged to accept
- Warehouse Supervisor rejects MRV
- Status: received → rejected
- Materials disposed or returned to site
- No inventory impact

## API Endpoints

### RFIM Routes
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/rfim` | List RFIMs (filter by status) |
| GET | `/api/rfim/:id` | Get single RFIM with linked MRRV |
| PUT | `/api/rfim/:id` | Update RFIM (assign inspector, set result, enter findings) |
| POST | `/api/rfim/:id/start` | Start inspection (pending → in_progress) |
| POST | `/api/rfim/:id/complete` | Complete inspection (in_progress → completed) |

**RBAC**: Create (auto via MRRV). Update/start/complete require `qc_officer`, `warehouse_supervisor`, `manager`, `admin`.

### OSD Routes
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/osd` | List OSD Reports (filter by status) |
| GET | `/api/osd/:id` | Get single OSD with lines, linked MRRV |
| POST | `/api/osd` | Create new OSD (draft) |
| PUT | `/api/osd/:id` | Update OSD header/lines (draft/under_review only) |
| POST | `/api/osd/:id/submit-claim` | Submit claim to supplier (under_review → claim_sent) |
| POST | `/api/osd/:id/update-status` | Update status (claim_sent → awaiting_response → negotiating → resolved) |
| POST | `/api/osd/:id/close` | Close OSD (resolved → closed) |

**RBAC**: Create/update require `warehouse_supervisor`, `manager`, `admin`. Submit claim requires `logistics_coordinator`, `manager`, `admin`.

### MRV Routes
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/mrv` | List MRVs (filter by status) |
| GET | `/api/mrv/:id` | Get single MRV with lines |
| POST | `/api/mrv` | Create new MRV (draft) |
| PUT | `/api/mrv/:id` | Update MRV header/lines (draft only) |
| POST | `/api/mrv/:id/submit` | Submit for approval (draft → pending) |
| POST | `/api/mrv/:id/receive` | Mark as received (pending → received) |
| POST | `/api/mrv/:id/complete` | Complete (received → completed, add inventory for good-condition items) |
| POST | `/api/mrv/:id/reject` | Reject (received → rejected, no inventory impact) |

**RBAC**: Create/submit require `site_engineer`, `warehouse_supervisor`, `manager`, `admin`. Receive/complete/reject require `warehouse_supervisor`, `manager`, `admin`.

## Validations

### RFIM Validations
- `mrrvId` must be valid MRRV ID
- `inspectorId` must be employee with role `qc_officer`
- `inspectionResult` must be one of: approved, rejected, partial
- Status transitions:
  - Only "pending" can start inspection
  - Only "in_progress" can be completed
- Cannot complete without:
  - `inspectionDate`
  - `inspectionResult`
  - `findings` (required if result = rejected/partial)

### OSD Validations
- At least 1 line item required
- `reportTypes` must be non-empty array
- For each line:
  - `qtyInvoice`, `qtyReceived` must be >= 0
  - `qtyOver`, `qtyShort`, `qtyDamaged` must be >= 0
  - One of (qtyOver, qtyShort, qtyDamaged) must be > 0
  - `damageType` required if `qtyDamaged > 0`
  - `unitCost` must be >= 0
  - `estimatedLoss = (qtyShort + qtyDamaged) × unitCost`
- `claimAmount` must be <= sum of all line `estimatedLoss`
- Status transitions:
  - Only "draft" can be updated
  - Only "under_review" can submit claim
  - Only "claim_sent" can update to "awaiting_response"
  - Only "resolved" can be closed

### MRV Validations
- At least 1 line item required
- `qtyReturned` must be > 0
- `returnReason` required (one of: excess, defective, project_complete, wrong_item, other)
- Status transitions:
  - Only "draft" can be updated or submitted
  - Only "pending" can be received
  - Only "received" can be completed or rejected
- Inventory impact validation:
  - Only lines with `condition = 'good'` are added to inventory
  - Damaged/defective items are NOT added

## Edge Cases

### 1. RFIM Partial Approval
- MRRV has 10 line items
- RFIM inspector approves 8 items, rejects 2
- Result: "partial"
- Actions:
  - Accept 8 items → MRRV marked "qc_approved" for those lines
  - Reject 2 items → Create OSD for rejected items
  - MRRV split into 2 documents (future enhancement)
- Current: Manual handling required

### 2. OSD with Multiple Discrepancy Types
- Ordered 100 units, received 90 (shortage = 10)
- Of 90 received, 15 are damaged
- OSD Report:
  - Report Types: ["shortage", "damage"]
  - Line: `qtyInvoice=100, qtyReceived=90, qtyShort=10, qtyDamaged=15`
  - Total claim: (10 × unitCost) + (15 × unitCost) = 25 units worth

### 3. OSD Overage (Received More Than Ordered)
- Ordered 100 units, received 120 (overage = 20)
- Company policy:
  - Accept overage if same price → bonus stock
  - Reject overage if charged extra → refuse acceptance
- OSD Report:
  - Report Types: ["overage"]
  - Line: `qtyInvoice=100, qtyReceived=120, qtyOver=20`
  - Claim: 0 (or negative if refusing to pay for extra)

### 4. OSD Claim Escalation
- Claim sent, supplier ignores for 30 days
- Status: awaiting_response
- Actions:
  - Email reminders (manual)
  - Escalate to supplier's management
  - Involve insurance company (if insured shipment)
  - Legal action (for high-value claims > 100K SAR)
  - Blacklist supplier (if repeatedly unresponsive)
- Current: No auto-escalation (manual process)

### 5. MRV for Unused Materials After Project
- Project completes, 50K SAR worth of materials unused
- Site Engineer creates MRV to return to central warehouse
- Warehouse receives, inspects → all in good condition
- MRV completed → 50K SAR added back to inventory
- Materials available for other projects

### 6. MRV for Defective Materials (Discovered Late)
- Materials issued via MIRV, used on site
- Site Engineer discovers materials are defective (e.g., wrong specs)
- Creates MRV with reason "defective"
- Warehouse receives → condition marked "defective"
- MRV completed but NO inventory added (defective items)
- Warehouse creates OSD to claim from supplier

### 7. RFIM Delayed Completion
- RFIM created when MRRV submitted
- QC Officer busy, does not complete RFIM for 7 days
- MRRV stuck in "pending_qc" status
- Materials physically in warehouse but not usable
- Workaround: Warehouse Supervisor can skip RFIM and directly approve QC (policy violation)

### 8. OSD Partial Settlement
- Claim amount: 10,000 SAR
- Supplier offers 6,000 SAR (60% settlement)
- Company accepts
- OSD updated:
  - `claimAmount = 10,000`
  - `settlementAmount = 6,000`
  - `settlementMethod = credit_note`
  - Status: resolved
- Finance team applies 6,000 SAR credit to next invoice

### 9. MRV Rejected Due to Damage
- Site Engineer returns materials, claims they are in good condition
- Warehouse inspects → finds severe damage (not usable)
- Warehouse Supervisor rejects MRV
- Materials sent back to project site or disposed
- Project charged for material loss (financial adjustment)

### 10. RFIM for Non-MRRV Inspections
- QC Officer wants to inspect materials already in warehouse (spot check)
- Creates standalone RFIM (no `mrrvId`)
- Result: "approved" (stock remains) or "rejected" (quarantine/dispose)
- Current: Not supported (future enhancement for cycle inspections)

## Business Rules

### 1. RFIM Required For
- High-value shipments (> 50,000 SAR)
- Critical items (safety equipment, structural steel)
- New suppliers (first 3 deliveries)
- Items with history of quality issues
- Shipments from overseas (international imports)
- User-selected via `rfimRequired` checkbox on MRRV

### 2. RFIM Inspection Criteria
QC Officer checks:
- **Quantity**: Matches invoice and PO
- **Quality**: Meets specifications, no defects
- **Packaging**: Adequate protection, no damage
- **Documentation**: Certificates of Compliance, test reports, manuals
- **Labeling**: Correct part numbers, markings
- **Storage**: Appropriate for item type (temperature, humidity)

### 3. OSD Report Types
- **shortage**: Received less than invoiced (supplier error or theft in transit)
- **overage**: Received more than invoiced (supplier error, usually favorable)
- **damage**: Physical damage (packaging failure, handling damage)
- **wrong_item**: Incorrect item shipped (supplier error)
- **quality_issue**: Item does not meet specifications (manufacturing defect)

### 4. OSD Financial Threshold
- Claims < 1,000 SAR: Warehouse Supervisor can waive (write off)
- Claims 1,000-10,000 SAR: Logistics Manager approves claim submission
- Claims 10,000-50,000 SAR: Operations Director approves
- Claims > 50,000 SAR: CEO approval required
- Current: No threshold enforcement (future RBAC enhancement)

### 5. OSD Settlement Methods
- **credit_note**: Supplier issues credit for future purchases
- **replacement**: Supplier ships replacement materials (no charge)
- **cash_refund**: Supplier refunds cash (rare, usually for cancelled orders)
- **partial_settlement**: Negotiated compromise (e.g., 60% credit)
- **rejected**: Supplier refuses claim (company absorbs loss or escalates)

### 6. MRV Return Reasons
- **excess**: Over-ordered materials (planning error)
- **defective**: Materials discovered to be defective after issue
- **project_complete**: Unused materials after project finished
- **wrong_item**: Incorrect item issued (warehouse error)
- **other**: Free-text explanation required

### 7. MRV Inventory Impact
- Only materials with `condition = 'good'` are added to inventory
- Damaged materials:
  - Not added to inventory
  - Require OSD Report for disposal/claim
  - Or sent to repair/reconditioning vendor
- Defective materials:
  - Not added to inventory
  - Return to supplier via OSD claim

### 8. RFIM Inspector Assignment
- Must be employee with role `qc_officer`
- Inspector cannot inspect own work (conflict of interest)
- For high-value/critical items, may require external third-party inspector
- Current: No conflict-of-interest validation (manual enforcement)

### 9. OSD Claim Timeframe
- Must submit claim within 30 days of MRRV receive date
- Contractual requirement (supplier terms)
- After 30 days, claim may be rejected by supplier
- Current: No auto-alert for approaching deadline (future enhancement)

### 10. MRV Approval Requirement
- MRV > 5,000 SAR value requires manager approval
- MRV < 5,000 SAR can be submitted directly
- Prevents unauthorized return of high-value materials
- Current: No value-based approval (all MRVs same workflow)

### 11. Quality Hold (Quarantine)
- Materials fail RFIM inspection
- Status: "rejected"
- Materials should be tagged and moved to quarantine area
- Cannot be issued via MIRV until:
  - Re-inspected and approved
  - Returned to supplier
  - Disposed per policy
- Current: No "quarantine" inventory status (manual tracking)

### 12. OSD Root Cause Categories
- Supplier error (wrong item, poor quality, under-shipment)
- Freight forwarder error (damage in transit)
- Warehouse error (miscounting, mishandling)
- Force majeure (weather damage, accidents)
- Unknown (requires investigation)
- Used for supplier performance metrics and corrective action

### 13. RFIM Sampling Strategy
- For large quantities (> 1000 units), inspection uses sampling
- Sample size: Square root of lot size (e.g., 100 units from 10,000)
- If sample fails, entire lot rejected
- If sample passes, entire lot accepted
- Current: No sampling logic (inspector decides manually)

### 14. MRV Linkage to Original MIRV
- `originalMirvId` field links MRV to MIRV that issued the materials
- Helps track:
  - Why materials were issued
  - Which project returned them
  - Time gap (issue date vs. return date)
- Used for project cost reconciliation

### 15. OSD Attachments
- Photos of damaged materials (required for damage claims)
- Delivery note showing shortage (required for shortage claims)
- Supplier invoice vs. packing list comparison (for overage claims)
- Lab test reports (for quality issue claims)
- Current: Attachments stored separately (future: S3/file upload integration)
