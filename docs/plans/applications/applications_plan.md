# Feature: Application Tracker — Log and Manage Sent Applications

Users need a central place to record every job application they send, track its status, and manage follow-ups — all inside the same tool they use to write applications.
This feature is split into 3 sub-features that build on each other.

---

## Sub-feature 1: Application Schema and Domain Class

**Why:**
Before the UI exists, the data model must be defined. An application has a lifecycle (drafted → sent → interview → offer → rejected/withdrawn) and enough metadata to be useful without having to open the original chat.

**What:**

**New DB table — `Application`:**

| Column | Type | Notes |
|---|---|---|
| `id` | int | PK, auto-increment |
| `chat_id` | int / null | FK → Chat.id (nullable — allows manual entries not linked to a chat) |
| `company` | str | company name |
| `job_title` | str | position title |
| `job_url` | str / null | link to the original job posting |
| `status` | str | `'drafted'`, `'sent'`, `'interview'`, `'offer'`, `'rejected'`, `'withdrawn'` |
| `date_applied` | date / null | date the application was actually sent |
| `notes` | TEXT / null | free-form notes |
| `created_at` | datetime | set automatically |
| `updated_at` | datetime | updated on every status change |

Index on `status` for filtering. FK `chat_id → Chat.id` with `ON DELETE SET NULL` so deleting a chat does not delete the application record.

**Schema addition in `backend/models.py`:**
```python
class Application(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    chat_id: int | None = Field(default=None, foreign_key="chat.id", index=True)
    company: str
    job_title: str
    job_url: str | None = None
    status: str = "drafted"
    date_applied: date | None = None
    notes: str | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
```

**Domain class in `backend/application.py`:**
```python
class ApplicationRecord:
    @staticmethod
    async def create(company: str, job_title: str, chat_id: int | None = None, ...) -> "ApplicationRecord": ...
    @staticmethod
    async def get_all(status: str | None = None) -> list["ApplicationRecord"]: ...
    @staticmethod
    async def get_by_id(app_id: int) -> "ApplicationRecord | None": ...
    async def update(self, **fields) -> None: ...
    async def delete(self) -> None: ...
```

**New API endpoints:**
```
GET    /api/applications              ?status=sent   → list applications (optional filter)
POST   /api/applications              body: { company, job_title, job_url?, status?, chat_id?, notes? }
GET    /api/applications/{id}         → single application
PATCH  /api/applications/{id}         body: partial update (any field)
DELETE /api/applications/{id}
```

**Key files:**
- `backend/models.py` — add `Application` table
- `backend/application.py` *(new)* — `ApplicationRecord` domain class
- `backend/main.py` — add five application endpoints

**Missing / open questions:**
- **Auto-create on chat:** When the LLM generates an application letter inside a chat, should an `Application` row be created automatically? That requires detecting the intent from the LLM response — out of scope here. For now, users create entries manually or via the chat "save" button (Sub-feature 3).
- **`updated_at` trigger:** SQLite has no `ON UPDATE` trigger. Either update `updated_at` explicitly in the domain class on every `update()` call, or use a SQLite trigger. The domain class approach is simpler.
- **Date vs. datetime for `date_applied`:** A plain `date` is sufficient and avoids timezone ambiguity.

**Acceptance criteria:**
- [ ] `Application` table created on startup
- [ ] `POST /api/applications` returns the created record with `id` and `created_at`
- [ ] `GET /api/applications` returns all records; `?status=sent` returns only sent ones
- [ ] `PATCH /api/applications/{id}` updates `updated_at` on every call
- [ ] Deleting a linked Chat sets `chat_id` to NULL (not delete the application)
- [ ] Deleting an Application via `DELETE /api/applications/{id}` removes only that row

**Out of scope:**
- Attachments (CV PDF, cover letter file)
- Application reminders / notifications
- Calendar integration

**How to test:**
Use `TestClient` with in-memory SQLite. Create an application, list it, update status, delete it. Separately: create a Chat linked to an application, delete the Chat, assert `chat_id` is now NULL on the application row.

---

## Sub-feature 2: Applications Table UI

**Why:**
A table view gives the user a bird's-eye view of all their applications — sortable by date or status, filterable, and with quick status updates inline.

**What:**

A new top-level page or sidebar section "Bewerbungen" (Applications). The main content area shows a table:

| # | Company | Position | Status | Date Applied | Chat | Actions |
|---|---|---|---|---|---|---|

**Table behavior:**
- Default sort: `date_applied` descending (newest first). Null dates appear at the bottom.
- Status column: a colored badge. Clicking it opens an inline dropdown to change status directly from the table (no modal needed).
- Chat column: a link icon that opens the linked chat, or "—" if no chat is linked.
- Actions column: "Edit" opens a slide-over panel; "Delete" shows an inline confirmation ("Are you sure?") before calling `DELETE`.
- A filter bar above the table: status pills (All / Drafted / Sent / Interview / Offer / Rejected / Withdrawn). Clicking a pill applies `?status=` to the fetch.
- Column headers are clickable to sort (company A-Z, date asc/desc, status alphabetical).

**Status badge colors:**
| Status | Color |
|---|---|
| drafted | gray |
| sent | blue |
| interview | yellow |
| offer | green |
| rejected | red |
| withdrawn | gray |

**New page:**
`frontend/app/applications/page.tsx` — fetches from `GET /api/applications` on mount, re-fetches after every status change or delete.

**Key files:**
- `frontend/app/applications/page.tsx` *(new)* — applications page
- `frontend/components/ApplicationsTable.tsx` *(new)* — table with sort, filter, inline status change
- `frontend/components/StatusBadge.tsx` *(new)* — colored badge + dropdown
- `frontend/components/ApplicationSlideOver.tsx` *(new)* — edit panel

**Missing / open questions:**
- **Pagination:** If the user has hundreds of applications, all-at-once fetch will be slow. For now, fetch all and paginate client-side. Add server-side pagination if needed later.
- **Navigation:** How does the user reach the Applications page? Add a nav item to the sidebar next to the chat list.

**Acceptance criteria:**
- [ ] Table loads and shows all applications on mount
- [ ] Status filter pills correctly narrow the table
- [ ] Clicking a status badge updates it via `PATCH` and re-renders without full reload
- [ ] Clicking column headers sorts the table
- [ ] Delete shows confirmation inline, then removes the row
- [ ] Navigating to a linked chat from the Chat column opens that chat

**Out of scope:**
- Bulk status updates
- Export to CSV / Excel
- Search within the table (text search)

**How to test:**
Manual: create several applications via `POST`, open the Applications page, verify they appear. Test filter, sort, inline status change, and delete. Automated: render `ApplicationsTable` with mocked data and assert filter/sort behavior.

---

## Sub-feature 3: Application Management Conveniences

**Why:**
Creating an application entry manually after writing it in the chat is extra friction. This sub-feature adds shortcuts: save-from-chat, notes, and a quick "create" flow.

**What:**

**"Save as application" button in chat:**
After the LLM generates a cover letter, a "Save as application" button appears below the message. Clicking it opens a small form (company, job title, URL, date) pre-filled where possible, then calls `POST /api/applications` with `chat_id` linked. The button only appears on messages that contain a generated letter (detected by message metadata or a simple heuristic — message is from role `model` in a chat that has the application-writing context).

**Quick-create in the Applications page:**
A "+ New application" button opens the same slide-over panel as edit, but empty — for manually logging applications not written with the bot.

**Notes field:**
The edit slide-over includes a `notes` textarea. Useful for logging recruiter name, interview date, salary discussed, etc.

**Status history (lightweight):**
When `status` changes via `PATCH`, append a line to `notes` automatically: `[2026-04-29] Status → interview`. This gives a rough audit trail without a separate history table.

**Key files:**
- `frontend/components/ChatMessage.tsx` — add "Save as application" button on model messages
- `frontend/components/ApplicationSlideOver.tsx` — add notes textarea, handle both create and edit modes
- `backend/main.py` — `PATCH /api/applications/{id}` appends status-change note

**Missing / open questions:**
- **Detecting "application letter" messages:** The heuristic (show button on every model message) may be too broad. Alternatively, only show it when the user has explicitly asked the bot to write a letter — detectable by checking the chat's linked ApplicationRecord. Decide before implementing.
- **Pre-filling company/job title:** If the user pasted a job description into the chat, the LLM could extract company and title. That requires an extra LLM call or a prompt change — defer to the User Profile feature (relevance engine).

**Acceptance criteria:**
- [ ] "Save as application" button appears on model messages and creates an `Application` row with the correct `chat_id`
- [ ] "+ New application" on the Applications page opens an empty slide-over
- [ ] Notes field saves and reloads correctly
- [ ] A status change appends a timestamped line to `notes`

**Out of scope:**
- Automatic extraction of company/title from chat content
- Reminders or scheduled follow-up prompts
- Attachments

**How to test:**
Manual: write a message in a chat, click "Save as application", fill the form, submit — assert the row appears in the Applications table with the correct `chat_id`. Test notes persistence by editing and reloading.
