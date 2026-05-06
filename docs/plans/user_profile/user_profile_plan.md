# Feature: User Profile and Writing Intelligence

The LLM needs to know who it is writing for. This feature stores a structured profile of the user (CV data, skills, experience) and uses it to inject relevant context into every LLM prompt — along with a writing-style preference and a per-application relevance engine that decides which parts of the profile to surface for a given job.
This feature is split into 4 sub-features that build on each other.

---

## Sub-feature 1: Profile Storage

**Why:**
The LLM currently receives no background about the user. Without a stored profile, every application starts from scratch and the user must re-enter their experience in every chat. A structured profile, persisted to the database, solves this.

**What:**

The profile is stored as a single JSON blob in a new `UserProfile` table. Using a JSON column (rather than many typed columns) allows the profile shape to evolve without schema migrations. The backend exposes get/set endpoints; the frontend owns validation.

**New DB table — `UserProfile`:**

| Column | Type | Notes |
|---|---|---|
| `id` | int | PK (single row — id is always 1) |
| `data` | TEXT | JSON blob |
| `updated_at` | datetime | updated on every save |

**Profile JSON shape:**
```json
{
  "personal": {
    "name": "",
    "email": "",
    "phone": "",
    "location": "",
    "linkedin": "",
    "website": ""
  },
  "summary": "",
  "experience": [
    {
      "company": "",
      "title": "",
      "start": "2022-01",
      "end": null,
      "description": ""
    }
  ],
  "education": [
    {
      "institution": "",
      "degree": "",
      "field": "",
      "start": "2018-09",
      "end": "2022-06"
    }
  ],
  "skills": ["Python", "FastAPI"],
  "languages": [
    { "language": "Deutsch", "level": "Muttersprache" },
    { "language": "English", "level": "C1" }
  ],
  "certificates": [
    { "name": "", "issuer": "", "date": "" }
  ],
  "writing_style": {
    "tone": "formal",
    "person": "first",
    "length": "medium",
    "custom_instructions": ""
  }
}
```

`writing_style` is colocated here because it describes how the profile should be presented, not separate from it.

**Domain class in `backend/profile.py`:**
```python
class UserProfile:
    @staticmethod
    async def get() -> dict:  # returns DEFAULTS merged with stored data
    @staticmethod
    async def save(data: dict) -> None:  # upserts the single row
```

**New API endpoints:**
```
GET  /api/profile   → returns current profile (empty defaults if none saved)
PUT  /api/profile   → accepts full or partial profile, deep-merges, saves
```

**Key files:**
- `backend/models.py` — add `UserProfile` table
- `backend/profile.py` *(new)* — `UserProfile` domain class
- `backend/main.py` — add `GET /api/profile` and `PUT /api/profile`

**Missing / open questions:**
- **Single-user assumption:** The table has one row (id=1). Multi-user support would require user authentication and per-user rows — out of scope.
- **Deep merge vs. replace:** `PUT` should deep-merge arrays (`experience`, `skills`) rather than replace them, so the frontend can update one field without re-sending everything. Alternatively, the frontend always sends the full document and the backend replaces. The full-document approach is simpler and avoids merge-conflict edge cases. Decide before implementing.
- **CV import:** Parsing an existing PDF CV to pre-populate the profile is a valuable convenience but requires a separate sub-feature (likely using an LLM to extract structured fields from the PDF text).

**Acceptance criteria:**
- [ ] `GET /api/profile` returns defaults when no profile exists yet
- [ ] `PUT /api/profile` persists data and updates `updated_at`
- [ ] Profile survives a backend restart
- [ ] All fields are optional — partial profiles are valid

**Out of scope:**
- PDF CV import
- Multiple profiles / personas
- Profile versioning / history

**How to test:**
`TestClient`: `GET` before any save → defaults returned. `PUT` with a partial object → `GET` returns merged result. Restart (re-init adapter) → data still present.

---

## Sub-feature 2: Profile Editor UI

**Why:**
Users need a form to fill in their CV data and writing preferences — structured enough to validate inputs but flexible enough to add free-form notes.

**What:**

A new "Profil" section in the settings panel (or a dedicated `/profile` page — see open question).

The editor is divided into collapsible sections matching the profile JSON shape:
- **Persönliche Daten** — name, email, phone, location, LinkedIn, website
- **Über mich** — free-text summary textarea
- **Berufserfahrung** — list of entries; "+ Eintrag hinzufügen" adds a new row; each row has company, title, start/end (month-year picker), description
- **Ausbildung** — same list pattern as experience
- **Fähigkeiten** — tag input (type and press Enter to add a skill; click × to remove)
- **Sprachen** — list with language name + level dropdown
- **Zertifikate** — list with name, issuer, date
- **Schreibstil** — four controls:
  - Ton: Formal / Informell
  - Person: Erste Person ("Ich schreibe...") / Dritte Person ("Der Bewerber...")
  - Länge: Kurz / Mittel / Ausführlich
  - Individuelle Anweisungen: free-text textarea ("Verwende nie das Wort 'leidenschaftlich'")

**Save behavior:** auto-save on blur (each field saves independently via `PUT /api/profile`). A subtle "Gespeichert" indicator confirms persistence without interrupting flow.

**Key files:**
- `frontend/app/profile/page.tsx` *(new)* — profile editor page
- `frontend/components/profile/PersonalSection.tsx` *(new)*
- `frontend/components/profile/ExperienceList.tsx` *(new)*
- `frontend/components/profile/SkillsInput.tsx` *(new)*
- `frontend/components/profile/WritingStyleSection.tsx` *(new)*

**Missing / open questions:**
- **Settings panel vs. dedicated page:** The profile is substantial enough to warrant its own page (`/profile`) rather than a settings sub-section. Sidebar navigation should include both "Chats", "Bewerbungen", and "Profil".
- **Validation:** Required fields for writing (at minimum: name, one experience entry) should be flagged with a soft warning, not a hard block.
- **CV PDF import button:** A placeholder button "CV hochladen" can appear now; the actual import logic is a follow-up.

**Acceptance criteria:**
- [ ] All profile sections render and submit to `PUT /api/profile`
- [ ] Reloading the page restores all saved values
- [ ] Experience and education entries can be added and removed
- [ ] Skills tag input supports add-on-enter and remove-on-click
- [ ] Writing style preferences persist and reload

**Out of scope:**
- CV PDF import
- Profile completeness score / progress bar
- Rich-text formatting in description fields

**How to test:**
Manual: fill every section, reload, assert values are restored. Automated: render `ExperienceList` with mocked data, assert add/remove interactions call `PUT` with the correct payload.

---

## Sub-feature 3: Relevance Engine

**Why:**
A software engineer applying for a data science role should not have their unrelated internship at a law firm prominently featured. The relevance engine reads the job description and scores each profile section, so the LLM prompt includes only what matters for that specific application.

**What:**

**Input:** the job description text (pasted by the user into the chat or the application form).
**Output:** a filtered subset of the profile — same JSON shape, but with irrelevant experience entries removed, skills reordered by relevance, and a short "relevance summary" the LLM can use as a preamble.

**Approach — LLM-based scoring:**
Send the job description and the full profile to the LLM with a structured prompt asking it to return a JSON object scoring each section. Using the LLM (rather than keyword matching) handles synonyms, German/English mixing, and implicit requirements.

**Backend endpoint:**
```
POST /api/profile/relevance
Body: { "job_description": "..." }
Response: {
  "filtered_profile": { ... },   # same shape as profile, but trimmed
  "relevance_summary": "...",    # 2-3 sentence preamble for the LLM
  "scores": {                    # optional: for UI display
    "experience": [0.9, 0.2, 0.7],
    "skills": [0.8, 0.1, ...]
  }
}
```

**Prompt template (stored in `backend/prompts/relevance.txt`):**
```
You are helping tailor a job application.

Job description:
{job_description}

Full applicant profile (JSON):
{profile_json}

Return a JSON object with:
- "filtered_profile": the profile with irrelevant experience entries removed (keep entries with score >= 0.5) and skills sorted by relevance descending
- "relevance_summary": 2-3 sentences describing why this applicant is a strong match for this role
- "scores": { "experience": [float per entry], "skills": [float per skill] }

Return only valid JSON. No explanation.
```

**Caching:** The result is cached in memory keyed by `hash(job_description + profile_updated_at)`. The cache is invalidated when the profile is updated.

**Key files:**
- `backend/relevance.py` *(new)* — relevance engine (calls LLM, parses response, caches)
- `backend/prompts/relevance.txt` *(new)* — prompt template
- `backend/main.py` — add `POST /api/profile/relevance`

**Missing / open questions:**
- **LLM availability:** This endpoint requires a configured LLM (Sub-feature 3 of the LLM plan). If no LLM is configured, return the full profile unfiltered with a warning.
- **JSON parsing failures:** LLMs sometimes return malformed JSON despite instructions. Wrap the parse in a try/except and fall back to the full profile on failure.
- **Score threshold:** 0.5 is a starting point. Consider exposing this as a setting or letting the user drag a "focus level" slider in the UI.
- **German job descriptions:** Ensure the prompt works well for German-language job postings. The LLM handles this natively; no translation needed.

**Acceptance criteria:**
- [ ] `POST /api/profile/relevance` returns `filtered_profile`, `relevance_summary`, and `scores`
- [ ] Experience entries with score < 0.5 are removed from `filtered_profile`
- [ ] Skills are reordered by score descending
- [ ] Result is cached; second call with same inputs does not call the LLM again
- [ ] If LLM is unavailable, returns full unfiltered profile with `{ "warning": "LLM not configured" }`

**Out of scope:**
- User-adjustable score threshold (UI slider)
- Saving relevance results per application
- Keyword highlighting in the job description

**How to test:**
Unit test: mock the LLM response with known scores, assert `filtered_profile` contains only entries above threshold and skills are reordered. Integration test: point at a real LLM, send a real job description and profile, assert the response is valid JSON matching the schema.

---

## Sub-feature 4: Context Injection into LLM Prompts

**Why:**
Having a profile and a relevance engine is useless unless the profile actually reaches the LLM when writing an application. This sub-feature wires the profile into the system prompt so every application letter is written with full knowledge of the user's background.

**What:**

**Updated prompt construction in the backend:**
When the user sends a message in a chat, the backend:
1. Loads the user profile via `UserProfile.get()`
2. If the chat has a linked `Application` with a `job_description`, calls the relevance engine to get `filtered_profile` and `relevance_summary`
3. Otherwise uses the full profile
4. Builds a system prompt that includes the profile and writing-style instructions
5. Prepends the system prompt to the LLM call

**System prompt template (`backend/prompts/system.txt`):**
```
Du bist ein professioneller Bewerbungsassistent.

Profil des Bewerbers:
{profile_summary}

Schreibstil-Vorgaben:
- Ton: {tone}
- Person: {person}
- Länge: {length}
{custom_instructions}

Schreibe ausschließlich auf Basis dieser Angaben. Erfinde keine Informationen.
```

`profile_summary` is a human-readable rendering of the filtered profile (not raw JSON) — a function `render_profile_as_text(profile: dict) -> str` produces this.

**Writing-style application:**
The `writing_style` fields from the profile translate into concrete prompt instructions:
| Setting | Prompt addition |
|---|---|
| `tone: formal` | "Verwende einen formellen, professionellen Ton." |
| `tone: informal` | "Verwende einen freundlichen, persönlichen Ton." |
| `person: first` | "Schreibe in der ersten Person (Ich-Form)." |
| `person: third` | "Schreibe in der dritten Person (Er/Sie-Form)." |
| `length: short` | "Halte das Anschreiben auf maximal 3 Absätze." |
| `length: medium` | "Das Anschreiben sollte etwa 4-5 Absätze umfassen." |
| `length: long` | "Schreibe ein ausführliches Anschreiben mit 6 oder mehr Absätzen." |
| `custom_instructions` | appended verbatim |

**Key files:**
- `backend/prompts/system.txt` *(new)* — system prompt template
- `backend/profile.py` — add `render_profile_as_text(profile: dict) -> str`
- `backend/main.py` — update message-send endpoint to prepend system prompt

**Missing / open questions:**
- **Context window limits:** A verbose profile + relevance summary + conversation history may exceed the model's context window for smaller models. The relevance engine's filtering already helps. Additionally, truncate the profile summary to a max character count if needed.
- **Job description input:** For the relevance engine to run, the backend needs the job description. The user may paste it in the chat or in the Application record. Define a clear UX for where to paste it — probably the Application's `notes` field or a dedicated `job_description` column (not in this sub-feature, but referenced here).
- **Language of the system prompt:** The system prompt above is in German. If `settings.language == "en"`, the system prompt should switch to English. Wire the language setting here.

**Acceptance criteria:**
- [ ] System prompt is prepended to every LLM call, not just application-letter chats
- [ ] Profile fields appear correctly rendered in the system prompt (not raw JSON)
- [ ] Writing style instructions match the user's `writing_style` settings
- [ ] When a linked job description exists, the filtered profile (not the full one) is used
- [ ] When no profile is saved, the system prompt is sent without a profile section (no crash)

**Out of scope:**
- Per-message profile override
- Showing the system prompt to the user in the UI
- System prompt versioning

**How to test:**
Unit test `render_profile_as_text()` with a known profile dict — assert the output contains expected strings. Integration test the message-send endpoint with a mocked LLM: assert the first message in the `messages` array has role `system` and contains the profile text.
