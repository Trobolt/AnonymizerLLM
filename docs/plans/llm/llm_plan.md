# Feature: LLM Pipeline — Anonymizer + Cloud LLM

User messages in BewerbungsBot contain real personal data (names, email addresses, phone numbers, employer details).
Sending this raw text to a cloud LLM creates a privacy risk. This feature inserts a local anonymization step before
any text leaves the machine, lets the user verify and correct the detected spans, sends the scrubbed text to a cloud
LLM, and de-anonymizes the response before displaying it.
This feature is split into 5 sub-features that build on each other.

---

## Sub-feature 1: Anonymizer Adapter

**Why:**
Different anonymization backends have different accuracy profiles and resource requirements.
`openai/privacy-filter` is the first implementation, but a German-language NER model (e.g. `deepset/bert-base-german-cased-ner`),
a rule-based engine (Microsoft Presidio), or a future fine-tuned model should all be usable with no changes to the
calling code. An adapter isolates the backend from the choice of model.

**What:**

**Module layout:**
```
backend/llm/
  anonymizer/
    __init__.py        # factory: reads ANONYMIZER_BACKEND env var, returns right adapter
    interface.py       # abstract base class + shared data types
    privacy_filter.py  # openai/privacy-filter implementation (first impl)
```

**Shared data types in `interface.py`:**
```python
from dataclasses import dataclass

@dataclass
class AnonymizedEntity:
    label: str        # e.g. "NAME", "EMAIL", "PHONE", "ORG", "CITY"
    original: str     # the original text that was replaced
    placeholder: str  # e.g. "[NAME_1]", "[CITY_2]" — shared across all spans with the same value
    start: int        # char offset in the original text
    end: int          # exclusive end offset in the original text
    source: str       # "model" or "user" — set by the anonymizer; overrideable by frontend

@dataclass
class AnonymizationResult:
    original: str                   # unchanged original text
    anonymized: str                 # text with all entities replaced by placeholders
    entities: list[AnonymizedEntity]
```

**`interface.py` abstract base class:**
```python
from abc import ABC, abstractmethod

class AnonymizerAdapter(ABC):
    @abstractmethod
    def anonymize(self, text: str) -> AnonymizationResult:
        ...
        # Synchronous — callers must wrap in run_in_executor for async contexts.
        # Returns AnonymizationResult with entities sorted by start offset ascending.
```

**`privacy_filter.py` implementation:**

The key design decision: placeholders are assigned per *unique value*, not per *occurrence*.
Two spans with the same normalized text (case-insensitive) share the same placeholder number.
Numbers are assigned in order of first appearance left-to-right.

```
"kai lives in Berlin, mary lives in Berlin and tom lives in Munich"
 ^^^                   ^^^^                   ^^^
 NAME_1                NAME_2                 NAME_3

                 ^^^^^^^             ^^^^^^^           ^^^^^^
                 CITY_1              CITY_1            CITY_2
```

```python
from transformers import pipeline as hf_pipeline
from .interface import AnonymizerAdapter, AnonymizationResult, AnonymizedEntity

class PrivacyFilterAnonymizer(AnonymizerAdapter):
    _pipe = None  # lazy-loaded on first call

    def _get_pipe(self):
        if self._pipe is None:
            self._pipe = hf_pipeline(
                "token-classification",
                model="openai/privacy-filter",
                aggregation_strategy="simple",
            )
        return self._pipe

    def anonymize(self, text: str) -> AnonymizationResult:
        pipe = self._get_pipe()
        raw_entities = pipe(text)
        # Process left-to-right so "first appearance" numbering is deterministic
        raw_entities.sort(key=lambda e: e["start"])

        # Maps (label, normalized_value) -> placeholder assigned on first occurrence
        value_to_placeholder: dict[tuple[str, str], str] = {}
        label_counts: dict[str, int] = {}
        entities: list[AnonymizedEntity] = []

        for ent in raw_entities:
            label = ent["entity_group"]
            span = text[ent["start"]:ent["end"]]
            key = (label, span.lower().strip())

            if key not in value_to_placeholder:
                count = label_counts.get(label, 0) + 1
                label_counts[label] = count
                value_to_placeholder[key] = f"[{label}_{count}]"

            placeholder = value_to_placeholder[key]
            entities.append(AnonymizedEntity(
                label=label,
                original=span,
                placeholder=placeholder,
                start=ent["start"],
                end=ent["end"],
                source="model",
            ))

        # Build anonymized text by replacing spans in reverse order (preserves offsets)
        result = list(text)
        for ent in sorted(entities, key=lambda e: e.start, reverse=True):
            result[ent.start:ent.end] = list(ent.placeholder)

        return AnonymizationResult(
            original=text,
            anonymized="".join(result),
            entities=entities,  # sorted by start ascending (raw_entities was sorted)
        )
```

**Factory in `__init__.py`:**
```python
import os
from .interface import AnonymizerAdapter
from .privacy_filter import PrivacyFilterAnonymizer

def get_anonymizer() -> AnonymizerAdapter:
    backend = os.environ.get("ANONYMIZER_BACKEND", "privacy_filter")
    if backend == "privacy_filter":
        return PrivacyFilterAnonymizer()
    raise ValueError(f"Unknown ANONYMIZER_BACKEND: {backend!r}")
```

**Key files:**
- `backend/llm/anonymizer/__init__.py` *(new)* — factory
- `backend/llm/anonymizer/interface.py` *(new)* — `AnonymizerAdapter`, `AnonymizationResult`, `AnonymizedEntity`
- `backend/llm/anonymizer/privacy_filter.py` *(new)* — `PrivacyFilterAnonymizer`
- `backend/requirements.txt` — add `transformers`, `torch` (CPU wheel: `--index-url https://download.pytorch.org/whl/cpu`)

**Missing / open questions:**
- **German accuracy:** `openai/privacy-filter` was trained primarily on English text. BewerbungsBot processes German CVs.
  Evaluate accuracy on a few German samples before committing. If insufficient, add a second adapter wrapping
  `deepset/bert-base-german-cased-ner` and switch via `ANONYMIZER_BACKEND=deepset_german`.
- **`torch` bundle size:** ~200 MB CPU wheel. For a packaged Electron app consider the ONNX path:
  export the model to ONNX and use `onnxruntime` instead — same accuracy, much smaller footprint.
- **Case normalization edge cases:** Grouping uses `span.lower().strip()` as the key, so "Berlin" and "berlin"
  share `[CITY_1]`. But "New York" and "new york" also share a placeholder. This is almost always correct.
  The edge case is a text with two genuinely different entities that happen to normalize to the same string —
  this should not occur for NER-detected spans of different types (different labels are separate keys).
- **User-added entities and grouping:** When the user manually adds a span in Sub-feature 3, the frontend
  assigns the placeholder. For consistency, the frontend must apply the same grouping rule: if the user marks
  "Berlin" as `[CITY]` and a `[CITY_1]` placeholder already exists for "berlin", the new span should reuse
  `[CITY_1]`, not create `[CITY_3]`. The frontend needs to check the existing entity list before assigning.
- **Threading:** `transformers` pipelines are synchronous. All callers use `run_in_executor` — not the adapter itself.

**Acceptance criteria:**
- [ ] `anonymize("kai lives in Berlin, mary lives in Berlin and tom lives in Munich")` produces
  `[NAME_1] lives in [CITY_1], [NAME_2] lives in [CITY_1] and [NAME_3] lives in [CITY_2]`
- [ ] Both "Berlin" spans share the placeholder `[CITY_1]`; "Munich" gets `[CITY_2]`
- [ ] Placeholder numbers reflect order of *first* appearance left-to-right (not alphabetical)
- [ ] Case difference alone does not create a new placeholder group ("Berlin" and "berlin" → same group)
- [ ] Two different names get different placeholders even if they share a label
- [ ] A single occurrence still uses `[NAME_1]`, not `[NAME]` — the format is always `[LABEL_N]`
- [ ] Entities are sorted by `start` offset ascending in the result
- [ ] Model is lazy-loaded on first call; second call does not reload it
- [ ] Switching `ANONYMIZER_BACKEND` to an unknown value raises `ValueError` immediately at startup

**Out of scope:**
- GPU acceleration
- Per-entity-type configuration (choosing which types to redact)
- Confidence thresholds
- Fuzzy matching (grouping "Max" and "Max Mustermann" as the same person — strict exact-match normalization only)
- Any fine-tuning (Sub-feature 5)

**How to test:**
Call `PrivacyFilterAnonymizer().anonymize(text)` directly in a Python REPL or unit test — no HTTP server needed.

Key test cases:
1. `"kai lives in Berlin, mary lives in Berlin and tom lives in Munich"` →
   three distinct name placeholders, two Berlin spans share `[CITY_1]`, Munich gets `[CITY_2]`
2. `"Berlin and berlin"` → both spans share one placeholder (case-insensitive grouping)
3. `"Max Mustermann, max@example.com"` → `[NAME_1]` and `[EMAIL_1]` (different labels, independent counters)
4. `"no PII here"` → empty entities, `anonymized == original`
5. Call `anonymize()` twice — mock `hf_pipeline` constructor and assert it is called only once (lazy-load)

---

## Sub-feature 2: Cloud LLM Adapter

**Why:**
The cloud LLM provider will change over time — from OpenAI to Groq to a self-hosted model — and different
deployments may need different providers. An adapter allows provider-switching via environment variables
with no code changes, following the same pattern as the database adapter in the database plan.

**What:**

**Module layout:**
```
backend/llm/
  cloud/
    __init__.py          # factory: reads LLM_BACKEND env var, returns right adapter
    interface.py         # abstract base class
    openai_compat.py     # OpenAI-compatible implementation (OpenAI, Groq, Together, Ollama)
```

**`interface.py`:**
```python
from abc import ABC, abstractmethod
from typing import AsyncIterator

class CloudLLMAdapter(ABC):
    @abstractmethod
    async def stream(self, prompt: str) -> AsyncIterator[str]:
        ...
        # Yields text tokens as they arrive from the provider.
        # Raises on authentication failure, network error, or quota exhaustion.
```

**`openai_compat.py`:**
```python
import os
from openai import AsyncOpenAI
from typing import AsyncIterator
from .interface import CloudLLMAdapter

class OpenAICompatAdapter(CloudLLMAdapter):
    _client: AsyncOpenAI | None = None

    def _get_client(self) -> AsyncOpenAI:
        if self._client is None:
            self._client = AsyncOpenAI(
                api_key=os.environ["LLM_API_KEY"],
                base_url=os.environ.get("LLM_BASE_URL"),
            )
        return self._client

    async def stream(self, prompt: str) -> AsyncIterator[str]:
        model = os.environ.get("LLM_MODEL", "gpt-4o-mini")
        response = await self._get_client().chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            stream=True,
        )
        async for chunk in response:
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta
```

**Provider table (env vars only, no code change):**

| Provider | `LLM_API_KEY` | `LLM_BASE_URL` | `LLM_MODEL` |
|---|---|---|---|
| OpenAI | OpenAI key | *(unset)* | `gpt-4o-mini` |
| Groq | Groq key | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` |
| Together AI | Together key | `https://api.together.xyz/v1` | `mistralai/Mistral-7B-Instruct-v0.2` |
| Local Ollama | `ollama` | `http://localhost:11434/v1` | `llama3.2` |

**Factory in `__init__.py`:**
```python
import os
from .interface import CloudLLMAdapter
from .openai_compat import OpenAICompatAdapter

def get_cloud_llm() -> CloudLLMAdapter:
    backend = os.environ.get("LLM_BACKEND", "openai_compat")
    if backend == "openai_compat":
        return OpenAICompatAdapter()
    raise ValueError(f"Unknown LLM_BACKEND: {backend!r}")
```

**Key files:**
- `backend/llm/cloud/__init__.py` *(new)* — factory
- `backend/llm/cloud/interface.py` *(new)* — `CloudLLMAdapter`
- `backend/llm/cloud/openai_compat.py` *(new)* — `OpenAICompatAdapter`
- `backend/requirements.txt` — add `openai`
- `backend/.env.example` *(new)* — document `LLM_BACKEND`, `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`, `ANONYMIZER_BACKEND`

**Missing / open questions:**
- **System prompt:** Currently only the user message is sent. A job-application-specific system prompt belongs in a
  config file or environment variable — the `messages` list in `stream()` is the extension point.
- **Error surface:** `openai.AuthenticationError`, `openai.RateLimitError`, `openai.APIConnectionError` all
  propagate as-is. Structured error handling belongs in Sub-feature 4.
- **Anthropic SDK:** The Anthropic API is not OpenAI-compatible. A second adapter `anthropic.py` can be added
  later; `get_cloud_llm()` would route on `LLM_BACKEND=anthropic`.

**Acceptance criteria:**
- [ ] Factory raises `ValueError` for unknown `LLM_BACKEND` at call time
- [ ] `OpenAICompatAdapter.stream()` yields tokens incrementally (verified via Groq or Ollama)
- [ ] Switching provider requires only changing env vars — no code change
- [ ] Missing `LLM_API_KEY` raises `KeyError` immediately (at client construction), not silently mid-request

**Out of scope:**
- Multi-turn conversation history (single-turn for now; history added in Sub-feature 4)
- Retry / fallback logic
- Cost tracking or token counting

**How to test:**
Mock `AsyncOpenAI` and assert `stream()` yields the expected tokens. Integration test: point at a local Ollama
instance (`LLM_BASE_URL=http://localhost:11434/v1`) and verify tokens stream incrementally.

---

## Sub-feature 3: Frontend Verification UI

**Why:**
The anonymizer is not perfect. It will miss some PII (false negatives — user must add them manually)
and wrongly redact non-PII spans (false positives — user must remove them). Before sending text to the cloud LLM
the user must be able to see what was detected, correct mistakes, and confirm the final anonymized version.

**What:**

**New API endpoint — preview anonymization:**
```
POST /api/chats/{chat_id}/message/preview
Body:  { "message": "kai lives in Berlin, mary lives in Berlin and tom lives in Munich" }
Response: {
  "original": "kai lives in Berlin, mary lives in Berlin and tom lives in Munich",
  "anonymized": "[NAME_1] lives in [CITY_1], [NAME_2] lives in [CITY_1] and [NAME_3] lives in [CITY_2]",
  "entities": [
    { "label": "NAME", "original": "kai",   "placeholder": "[NAME_1]", "start": 0,  "end": 3,  "source": "model" },
    { "label": "CITY", "original": "Berlin","placeholder": "[CITY_1]", "start": 13, "end": 19, "source": "model" },
    { "label": "NAME", "original": "mary",  "placeholder": "[NAME_2]", "start": 21, "end": 25, "source": "model" },
    { "label": "CITY", "original": "Berlin","placeholder": "[CITY_1]", "start": 35, "end": 41, "source": "model" },
    { "label": "NAME", "original": "tom",   "placeholder": "[NAME_3]", "start": 46, "end": 49, "source": "model" },
    { "label": "CITY", "original": "Munich","placeholder": "[CITY_2]", "start": 59, "end": 65, "source": "model" }
  ]
}
```

Notice: both "Berlin" entities share `[CITY_1]`. The frontend must render two separate chips for them
(one per span), but they display the same placeholder text and are visually grouped.

The frontend calls this endpoint immediately after the user presses Send, before showing the message in the chat.

**Frontend component — `MessageVerificationView`:**

Renders the original text as inline segments, with entity spans replaced by interactive chips:
- **Yellow chip** — model-detected span (`source: "model"`). Tooltip shows: original text + label.
  Clicking a yellow chip removes it (de-anonymizes that span → user is saying the model was wrong → becomes a tracked false positive).
- **Red chip** — user-added correction (`source: "user"`). Tooltip shows: original text + label.
  Clicking a red chip removes it.
- **Grouped chips:** Multiple chips with the same `placeholder` (e.g. two "Berlin" chips both showing `[CITY_1]`)
  are visually linked with a subtle shared border or identical badge. Removing one chip removes only that span —
  the other span with the same placeholder stays. If the user removes all chips of a given placeholder, that
  placeholder will appear literally in the LLM response rather than being de-anonymized (acceptable behavior).
- **Text selection + "Mark as PII" toolbar:** User selects any plain text in the preview →
  a small toolbar appears with PII type options (`NAME`, `EMAIL`, `PHONE`, `ORG`, `CITY`, `OTHER`).
  Before assigning a new placeholder number, the frontend checks the current entity list for an existing
  entity with the same label and the same normalized value (case-insensitive). If one exists, the new span
  reuses that placeholder; otherwise a new `[LABEL_N]` is assigned with the next available counter.
  The new chip renders red.

**State shape in the frontend:**
```typescript
type EntitySource = "model" | "user";

interface Entity {
  label: string;
  original: string;
  placeholder: string;
  start: number;
  end: number;
  source: EntitySource;
}

interface VerificationState {
  original: string;
  entities: Entity[]; // mutable — user adds/removes items
}
```

**Confirm flow:**
A "Send" button in the verification view triggers `POST /api/chats/{chat_id}/message/send` (Sub-feature 4)
with the full `VerificationState`. The verification view is dismissed and replaced by the streaming response.

**Rendering the annotated text:**
Reconstruct the display text from `original` and `entities` by walking character offsets. Each entity span
becomes a `<span>` with background colour (`yellow` for model, `red` for user). Plain text between spans
renders as-is.

**Key files:**
- `backend/main.py` — add `POST /api/chats/{chat_id}/message/preview` endpoint
- `frontend/components/MessageVerificationView.tsx` *(new)* — annotated text + chip interaction
- `frontend/components/PIIToolbar.tsx` *(new)* — floating toolbar on text selection
- `frontend/hooks/useVerification.ts` *(new)* — state management for entities (add / remove)

**Missing / open questions:**
- **Overlapping spans:** What if the user selects a range that partially overlaps an existing chip?
  The simplest rule: reject overlapping selections. Surface a tooltip: "deselect the highlighted area first."
- **Partial chip removal with grouping:** If two "Berlin" chips share `[CITY_1]` and the user removes one,
  the other stays anonymized. The LLM will receive one `[CITY_1]` in the text. The de-anonymization will
  still work (replaces `[CITY_1]` → "Berlin" everywhere in the LLM output). The removed chip becomes a
  false-positive record in the corrections table (Sub-feature 5), recording that the model wrongly tagged
  this particular "Berlin" — not the other one.
- **Long messages:** The verification view shows the full message. If the message is several paragraphs,
  the view may be tall. Consider a scrollable modal or inline expansion — not decided yet.
- **Keyboard accessibility:** The chip removal and text-selection toolbar should be keyboard-accessible.
  Scope this to mouse-only for now; keyboard support is a follow-up.
- **Empty entity list:** If the anonymizer finds nothing, show the verification view anyway with a note
  "No PII detected — review before sending." The user can still add manual spans.

**Acceptance criteria:**
- [ ] `POST /api/chats/{chat_id}/message/preview` returns `original`, `anonymized`, and `entities` with correct offsets and shared placeholders for same-value spans
- [ ] Model-detected spans render as yellow chips; user-added spans render as red chips
- [ ] Two chips with the same `placeholder` value are visually grouped (shared border or badge)
- [ ] Clicking one chip of a shared group removes only that span; the other chip remains
- [ ] Selecting plain text and choosing a PII type adds a red chip; if the same value already exists in the entity list, the new chip reuses the existing placeholder
- [ ] Clicking any chip removes it
- [ ] "Send" button is disabled until the user has reviewed (enabled after at least one interaction OR explicit "looks good" click)
- [ ] Verification view is dismissed once the user confirms and the streaming response begins

**Out of scope:**
- Chip reclassification (change label without removing and re-adding)
- "Remove all occurrences of this placeholder" bulk action
- Undo/redo for entity edits
- Keyboard accessibility
- Mobile / touch support

**How to test:**
Render `MessageVerificationView` with a fixed `VerificationState` in Storybook or a test harness.

Key test cases:
1. Two entities with the same `placeholder` → two chips render, both with a grouping indicator
2. Remove one of the two grouped chips → the other remains; the removed span shows as plain text
3. Select plain text matching an existing entity value → toolbar assigns the existing placeholder, not a new one
4. Select plain text with a new value → new `[LABEL_N]` placeholder assigned with correct counter
5. Backend endpoint: POST `"kai lives in Berlin, mary lives in Berlin"` → two `[CITY_1]` entities in response

---

## Sub-feature 4: Backend Pipeline Logic

**Why:**
The current `send_message` endpoint is a stub that echoes input. This sub-feature wires the full pipeline:
receive verified entities from the frontend → build the anonymized prompt → call the cloud LLM →
stream back a de-anonymized response → persist both messages.

**What:**

**Full pipeline per user message:**
```
1. Frontend sends  POST /api/chats/{chat_id}/message/send
   Body: { original, anonymized, entities: [...] }

2. Backend persists the original user message (Message row, role="user")

3. Backend builds the prompt from `anonymized` text

4. Backend calls CloudLLMAdapter.stream(prompt)

5. Tokens stream back to the frontend as ndjson: { "token": "..." }

6. As tokens arrive, accumulate them in memory

7. After stream ends: run de-anonymization on the full accumulated response

8. Persist de-anonymized response as Message row (role="model")

9. Return a final ndjson frame: { "done": true }
```

**De-anonymization:**
Build a replacement map from the verified entities. Because multiple entities can share the same
placeholder (e.g. two "Berlin" spans both mapped to `[CITY_1]`), the map is keyed by placeholder
and contains one original value per key — all entities sharing a placeholder have the same `original`
by definition of the grouping rule, so there is no ambiguity.

```python
def deanonymize(text: str, entities: list[AnonymizedEntity]) -> str:
    # Deduplicate by placeholder — same placeholder always maps to the same original value
    placeholder_to_original = {e.placeholder: e.original for e in entities}
    for placeholder, original in placeholder_to_original.items():
        text = text.replace(placeholder, original)
    return text
```

The LLM's response may reference placeholders (e.g. "Dear [NAME_1], I see you live in [CITY_1]...").
Each placeholder is replaced by the original value from the entity list the frontend confirmed.
Because `[CITY_1]` was used for all "Berlin" occurrences in the input, a single `replace()` call
restores all occurrences in the output. Placeholders the LLM invented that are not in the entity
list are left as-is (treated as literal text).

**Updated endpoint:**
```
POST /api/chats/{chat_id}/message/send
Body: {
  "original": "I am Max Mustermann...",
  "anonymized": "I am [NAME]...",
  "entities": [{ "label": "NAME", "original": "Max Mustermann", "placeholder": "[NAME]",
                 "start": 5, "end": 19, "source": "model" | "user" }]
}
Streams: ndjson  { "token": "..." }  per token, then  { "done": true }
```

**Correction capture (feeds Sub-feature 5):**
Before streaming, compare the frontend's final entity list against what the anonymizer originally returned
(from the preview step). Differences are corrections:
- Entity present in original but absent in final → false positive (user removed a model chip)
- Entity in final with `source: "user"` → false negative (user added a red chip)

Write these to the `AnonymizerCorrection` table (defined in Sub-feature 5) synchronously before streaming begins.

**Key files:**
- `backend/main.py` — add `POST /api/chats/{chat_id}/message/send`; update `POST /api/chats/{chat_id}/message/preview`
- `backend/llm/__init__.py` *(new)* — re-exports `get_anonymizer`, `get_cloud_llm`
- `backend/llm/deanonymize.py` *(new)* — `deanonymize(text, entities) -> str`
- `backend/chat.py` *(from database plan)* — used here to persist user + model messages

**Missing / open questions:**
- **Preview state on the backend:** The preview endpoint anonymizes text and returns it. The send endpoint
  receives the result back from the frontend. The backend does not store preview state between the two calls.
  This is intentional — the frontend is the source of truth for the verified entities, and statelessness
  simplifies horizontal scaling. Downside: if the user modifies the original text between preview and send,
  the offsets may be stale. For now, the UI should disable editing the original text once the preview is shown.
- **De-anonymization in the stream vs. at the end:** Streaming token-by-token de-anonymization is complex
  because a placeholder like `[NAME]` may arrive split across two tokens (`[NA` + `ME]`). The plan accumulates
  the full response first, de-anonymizes, then sends the final text as a single block. This means the user sees
  a loading indicator during streaming, then the full de-anonymized response. If incremental display is needed,
  buffer until each `[...]` token is complete before flushing — out of scope for now.
- **Multi-turn history:** Currently only the current user message is sent as the prompt. Conversation
  history (previous messages) should be prepended — this is a follow-up task.
- **Error handling:** If `CloudLLMAdapter.stream()` raises, the streaming response must close cleanly and
  report the error. Catch `Exception` in `token_generator`, yield `{ "error": str(e) }`, then close.

**Acceptance criteria:**
- [ ] `POST /api/chats/{chat_id}/message/send` streams tokens to the browser
- [ ] The streamed content is the de-anonymized LLM response (placeholders replaced with originals)
- [ ] The original user message is persisted (role="user") before streaming starts
- [ ] The full de-anonymized model response is persisted (role="model") after streaming ends
- [ ] `{ "done": true }` frame is sent as the final ndjson entry
- [ ] Corrections (false positives and false negatives from the verification step) are written to the DB

**Out of scope:**
- Multi-turn history in the prompt
- Error recovery / retry
- Streaming de-anonymization (placeholder-boundary buffering)

**How to test:**
Integration test using `TestClient` with a mocked `CloudLLMAdapter` that yields known tokens.
Assert: (1) user message row exists in DB after the request; (2) model message row exists with de-anonymized
content; (3) streamed tokens match expected output; (4) `{ "done": true }` is the last frame;
(5) corrections table has the expected rows when a false positive and a false negative were submitted.

---

## Sub-feature 5: Fine-tuning Data Collection

**Why:**
Every user correction in the verification UI is a labeled training example: the model got something wrong,
the user fixed it. Storing these corrections in a dedicated table builds a dataset for fine-tuning a
better anonymizer over time — without requiring any separate annotation tooling.

**What:**

**New DB table — `AnonymizerCorrection`:**

| Column | Type | Notes |
|---|---|---|
| `id` | int | PK, auto-increment |
| `message_id` | int | FK → Message.id (the user message this correction belongs to) |
| `correction_type` | str | `'false_positive'` or `'false_negative'` |
| `span_text` | TEXT | the exact text span that was wrong |
| `model_label` | str / null | the label the model assigned (null for false negatives — model missed it) |
| `correct_label` | str / null | the label the user assigned (null for false positives — user removed the chip, no correct label) |
| `context` | TEXT | the full original message text, for surrounding context during fine-tuning |
| `created_at` | datetime | set automatically on insert |

**Schema addition in `backend/models.py`:**
```python
class AnonymizerCorrection(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    message_id: int = Field(foreign_key="message.id", index=True)
    correction_type: str  # 'false_positive' | 'false_negative'
    span_text: str
    model_label: str | None = None
    correct_label: str | None = None
    context: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
```

**Domain class addition in `backend/chat.py`:**
```python
class AnonymizerCorrectionRecord:
    @staticmethod
    async def create(
        message_id: int,
        correction_type: str,
        span_text: str,
        model_label: str | None,
        correct_label: str | None,
        context: str,
    ) -> "AnonymizerCorrectionRecord": ...
```

**When corrections are written (in Sub-feature 4's send endpoint):**
```python
original_entities = {e.placeholder: e for e in preview_entities}  # from preview
final_entities = {e.placeholder: e for e in verified_entities}     # from frontend send body

# False positives: model detected, user removed
for placeholder, entity in original_entities.items():
    if placeholder not in final_entities:
        await AnonymizerCorrectionRecord.create(
            message_id=user_message.id,
            correction_type="false_positive",
            span_text=entity.original,
            model_label=entity.label,
            correct_label=None,
            context=original_text,
        )

# False negatives: user added, model missed
for entity in verified_entities:
    if entity.source == "user":
        await AnonymizerCorrectionRecord.create(
            message_id=user_message.id,
            correction_type="false_negative",
            span_text=entity.original,
            model_label=None,
            correct_label=entity.label,
            context=original_text,
        )
```

**Export for fine-tuning:**
Add a CLI command `python -m backend.export_corrections` that dumps the table as JSONL to stdout —
one record per line — suitable for use as training data:
```json
{ "text": "<full original message>", "span": "berlin", "label": "CITY", "type": "false_negative" }
```
This is a one-shot script, not a web endpoint.

**Key files:**
- `backend/models.py` — add `AnonymizerCorrection` table
- `backend/chat.py` — add `AnonymizerCorrectionRecord` domain class
- `backend/export_corrections.py` *(new)* — CLI export script
- `backend/db/` — no changes needed (generic adapter already handles new tables)

**Missing / open questions:**
- **Preview state needed for diff:** Sub-feature 4's send endpoint must receive the original preview
  entity list (what the model returned) alongside the final verified list (what the user confirmed).
  Two options: (a) the frontend sends both, or (b) the backend caches the preview result server-side.
  Option (a) is simpler and stateless — include a `preview_entities` field in the send request body.
- **Correction deduplication:** If a user submits the same message twice, the same corrections are
  written twice. A unique constraint on `(message_id, span_text, correction_type)` prevents this —
  but `message_id` changes each time, so dedup must happen at a higher level during export, not in the DB.
- **Minimum dataset size for fine-tuning:** Fine-tuning a token-classification model typically needs
  hundreds of annotated examples per entity type. The export script should report the count per type
  so the user knows when they have enough data.
- **Privacy of the correction data:** The `context` column stores the full original message (with PII).
  This table is in the same encrypted database as the rest of the chats (Sub-feature: Security).
  No additional handling is required, but document that exporting corrections exports raw user text.

**Acceptance criteria:**
- [ ] `AnonymizerCorrection` table created on startup alongside the existing `Chat` and `Message` tables
- [ ] A false positive (user removes a model chip) creates one `false_positive` row with `model_label` set
- [ ] A false negative (user adds a red chip) creates one `false_negative` row with `correct_label` set
- [ ] A message with no corrections creates no rows in `AnonymizerCorrection`
- [ ] `python -m backend.export_corrections` prints valid JSONL to stdout
- [ ] FK `AnonymizerCorrection.message_id → Message.id` is defined with `ON DELETE CASCADE`

**Out of scope:**
- Automated fine-tuning pipeline (model retraining, evaluation, deployment)
- Web UI for reviewing corrections
- Per-user correction data isolation
- Active learning loop

**How to test:**
Use an in-memory SQLite adapter. Simulate the Sub-feature 4 send endpoint with a known set of
preview entities and a modified final entity list. Assert the correct rows exist in `AnonymizerCorrection`.
Test the export script by pointing it at a seeded in-memory DB and asserting the JSONL output matches
the expected records.
