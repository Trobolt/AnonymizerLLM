# Feature: Settings — Appearance, Language, and LLM Configuration

Users need a persistent way to configure how the app looks and which LLM backend to use, without editing environment variables or restarting the process.
This feature is split into 3 sub-features that build on each other.

---

## Sub-feature 1: Settings Storage

**Why:**
Settings need to survive restarts. They are not relational data — a flat JSON file in the OS app-data folder is simpler than a DB table and avoids the migration complexity.

**What:**

A `backend/settings.py` module that reads and writes a single `settings.json` file.
On first launch the file does not exist; defaults are used and written on the first save.

**File location:**
| Mode | Path |
|---|---|
| Electron desktop | `%APPDATA%/BewerbungsBot/settings.json` |
| Dev | `./data/settings.json` |

`electron/main.ts` passes `SETTINGS_PATH` as an env var when spawning the Python process, mirroring how `DATABASE_URL` is set.

**Schema (settings.json):**
```json
{
  "theme": "system",
  "language": "de",
  "llm_backend": "openai_compat",
  "llm_api_key": "",
  "llm_base_url": "",
  "llm_model": "gpt-4o-mini",
  "anonymizer_backend": "privacy_filter"
}
```

`theme` accepts `"light"`, `"dark"`, or `"system"`.
`language` is a BCP-47 tag — initially `"de"` and `"en"` are supported.

**`backend/settings.py`:**
```python
import json, os
from pathlib import Path
from dataclasses import dataclass, asdict

DEFAULTS = {
    "theme": "system",
    "language": "de",
    "llm_backend": "openai_compat",
    "llm_api_key": "",
    "llm_base_url": "",
    "llm_model": "gpt-4o-mini",
    "anonymizer_backend": "privacy_filter",
}

def _path() -> Path:
    return Path(os.environ.get("SETTINGS_PATH", "./data/settings.json"))

def load() -> dict:
    p = _path()
    if not p.exists():
        return dict(DEFAULTS)
    with p.open() as f:
        data = json.load(f)
    return {**DEFAULTS, **data}  # fill in any missing keys added after initial release

def save(settings: dict) -> None:
    p = _path()
    p.parent.mkdir(parents=True, exist_ok=True)
    with p.open("w") as f:
        json.dump(settings, f, indent=2)
```

**New API endpoints:**
```
GET  /api/settings          → returns current settings dict (api_key is redacted: "***" if set)
PUT  /api/settings          → accepts partial or full settings dict, merges, saves, returns updated settings
```

The `llm_api_key` is never returned in plain text — the GET response replaces a non-empty key with `"***"` so the frontend can show "key is set" without exposing the value. The PUT endpoint writes the key only when the submitted value is not `"***"`.

**Key files:**
- `backend/settings.py` *(new)* — load/save helpers
- `backend/main.py` — add `GET /api/settings` and `PUT /api/settings`
- `electron/main.ts` — pass `SETTINGS_PATH` env var

**Missing / open questions:**
- **LLM config currently comes from env vars** (see `docs/plans/llm/llm_plan.md` Sub-feature 2). Once this settings feature is implemented, the LLM adapter factory should check settings first and fall back to env vars. Decide whether to do that in this sub-feature or in an update to the LLM plan.
- **API key security:** Storing the key in a plain JSON file on the user's filesystem is reasonable for a local desktop app but not for a shared server. If a server deployment is ever needed, revisit (vault, env var injection, etc.).

**Acceptance criteria:**
- [ ] `GET /api/settings` returns defaults on first launch (no file yet)
- [ ] `PUT /api/settings` with `{ "theme": "dark" }` persists only that key; other keys are unchanged
- [ ] `GET /api/settings` after setting a non-empty `llm_api_key` returns `"***"` for that field
- [ ] `PUT /api/settings` with `llm_api_key: "***"` does not overwrite the stored key
- [ ] Settings survive a backend restart

**Out of scope:**
- Per-chat settings overrides
- Settings import/export
- Multiple user profiles

**How to test:**
Call `settings.load()` / `settings.save()` directly against a temp directory. HTTP-level tests: use `TestClient`, call `PUT` then `GET`, assert persistence. Test the redaction logic separately.

---

## Sub-feature 2: Appearance and Language UI

**Why:**
Users need a visible way to switch between light mode, dark mode, and language — the most common preference settings.

**What:**

The existing `frontend/components/Settings.tsx` placeholder becomes a real settings panel with two sections: Appearance and Language.

**Appearance section:**
Three buttons (or a segmented control): Light / Dark / System. Selecting one calls `PUT /api/settings` with `{ "theme": "..." }` and immediately applies the Tailwind dark-mode class to `<html>`.

Tailwind config already ships with `darkMode: 'class'`. The root layout (`frontend/app/layout.tsx`) reads the setting on load and applies `class="dark"` to `<html>` accordingly. A React context (`ThemeContext`) broadcasts theme changes so all components react without a full page reload.

**Language section:**
A dropdown with supported languages (`Deutsch`, `English`). Selecting one calls `PUT /api/settings` with `{ "language": "..." }` and stores the preference. Actual UI string localization (i18n) is out of scope for this sub-feature — only the preference is saved here.

**Key files:**
- `frontend/components/Settings.tsx` — replace placeholder with real UI
- `frontend/app/layout.tsx` — read theme setting on mount, apply `dark` class
- `frontend/contexts/ThemeContext.tsx` *(new)* — broadcast theme state

**Missing / open questions:**
- **i18n library:** Language preference is stored here, but translating UI strings needs a library (e.g. `next-intl` or `react-i18next`). That is a separate sub-feature or a follow-up. For now only the preference is persisted.
- **System theme detection:** `prefers-color-scheme` media query handles `"system"` — confirm this works inside Electron's webview.

**Acceptance criteria:**
- [ ] Switching to Dark applies `class="dark"` to `<html>` immediately, without reload
- [ ] Switching to System follows the OS preference
- [ ] Theme preference persists across reloads (fetched from `GET /api/settings` on mount)
- [ ] Language selection is saved and re-selected on reload

**Out of scope:**
- UI string localization / translations
- Per-component theme overrides
- Custom color themes

**How to test:**
Manual: open settings, switch theme, reload — assert theme is restored. Automated: render `Settings.tsx` in a test harness, simulate button clicks, assert `PUT /api/settings` is called with the correct payload.

---

## Sub-feature 3: LLM Configuration UI

**Why:**
Users should be able to point the bot at any OpenAI-compatible endpoint (Groq, Ollama, Claude, etc.) without editing env vars or JSON files manually. The settings panel exposes all four LLM knobs from the LLM plan.

**What:**

A new "LLM" section in the settings panel with four fields:

| Field | Input type | Default |
|---|---|---|
| Provider | Dropdown: OpenAI / Groq / Together AI / Ollama / Custom | OpenAI |
| API Key | Password input (shows `•••` if set) | — |
| Base URL | Text input (disabled unless Custom or Ollama) | — |
| Model | Text input | `gpt-4o-mini` |

Selecting a preset provider auto-fills Base URL and suggests a default model. Selecting "Custom" unlocks the Base URL field.

A "Test connection" button sends a minimal request to the configured endpoint and shows a success or error badge inline — no modal.

**Key files:**
- `frontend/components/Settings.tsx` — add LLM section
- `frontend/components/LLMConnectionTest.tsx` *(new)* — inline test-connection badge

**Missing / open questions:**
- **Test connection endpoint:** Needs a `POST /api/settings/test-llm` backend endpoint that sends a minimal prompt and returns `{ "ok": true }` or `{ "error": "..." }`. Define in this sub-feature or as part of the LLM plan.
- **Anonymizer backend selector:** The `anonymizer_backend` setting (from the LLM plan) could live here too. Defer until anonymizer options are finalized.

**Acceptance criteria:**
- [ ] Selecting "Ollama" preset fills Base URL with `http://localhost:11434/v1` and suggests `llama3.2`
- [ ] API key field shows `•••` when a key is already stored; submitting unchanged `•••` does not overwrite
- [ ] "Test connection" button shows green checkmark on success and red error text on failure
- [ ] All four LLM fields persist and reload correctly

**Out of scope:**
- Anonymizer backend configuration UI
- Per-chat model overrides
- Token usage display

**How to test:**
Manual: configure Ollama locally, enter settings, click "Test connection" — assert green badge. Automated: mock `PUT /api/settings`, assert the correct payload is sent on save.
