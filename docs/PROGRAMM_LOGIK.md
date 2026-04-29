# BewerbungsBot - Programm Logik & Datei-Übersicht

## 📋 Datei-Wichtigkeit Tabelle

| # | Datei | Wichtigkeit | Kategorie | Beschreibung |
|---|-------|-------------|-----------|-------------|
| **KRITISCH (Source Code - Du schreibst diese Dateien)** |
| 1 | `backend/main.py` | 🔴 KRITISCH | Logik | FastAPI Backend-Server. Definiert REST-API Endpoints wie `/api/chats/count` und `/health`. Handelt CORS-Konfiguration. Startpunkt für Backend-Prozess |
| 2 | `electron/main.ts` | 🔴 KRITISCH | Logik | Electron Main Process. Startet Python-Backend automatisch. Erstellt Browser Window. Handelt IPC-Kommunikation zwischen Frontend und Backend. Port-Discovery und Python-Pfad-Auflösung |
| 3 | `electron/preload.ts` | 🔴 KRITISCH | Logik | Security Bridge zwischen Frontend (Renderer) und Electron. Exposet `electronApi` mit `apiRequest()` und `getBackendPort()`. Ermöglicht sichere IPC-Kommunikation |
| 4 | `frontend/app/page.tsx` | 🔴 KRITISCH | Logik | Haupt-UI-Komponente. Verwaltet Chat-State (Chats Array). Ruft Backend auf zum Fetch von Chat-Count. Kontrolliert Sidebar und ChatInterface |
| 5 | `frontend/lib/api/factory.ts` | 🔴 KRITISCH | Logik | **API-Adapter-Pattern**. Singleton-Factory für ApiClient. Wählt automatisch HttpAdapter (Dev) oder IpcAdapter (Prod) basierend auf `NEXT_PUBLIC_API_MODE` Environment Variable. Zentrale Logik für API-Switching |
| 6 | `frontend/lib/api/types.ts` | 🔴 KRITISCH | Logik | TypeScript-Interfaces für API-Kommunikation. Definiert `ApiClient` (abstrakt), `ApiResponse`. Alle API-Adapter implementieren diese Interfaces |
| 7 | `frontend/lib/api/httpAdapter.ts` | 🔴 KRITISCH | Logik | HTTP-API-Adapter für Development-Mode. Nutzt `fetch()` um mit Backend auf `localhost:8000` zu sprechen. Implementiert `ApiClient` Interface mit GET, POST, PUT, DELETE, PATCH, uploadFile |
| 8 | `frontend/lib/api/ipcAdapter.ts` | 🔴 KRITISCH | Logik | IPC-API-Adapter für Production-Mode (Electron). Nutzt `window.electronApi` aus Preload-Script. Übersetzt HTTP-Methods zu IPC-Requests. Implementiert `ApiClient` Interface |
| 9 | `frontend/lib/api.ts` | 🔴 KRITISCH | Logik | High-Level API-Funktionen. `fetchChatCount()` nutzt Factory um Backend zu kontaktieren. `apiRequest()` - generischer Request-Handler. Abstraktion über der Factory |
| 10 | `frontend/components/ChatInterface.tsx` | 🔴 KRITISCH | Logik | Chat-UI-Komponente. Rendert Messages. Handelt User-Input. `simulateResponse()` - Simulation von KI-Antwort mit Typing-Effekt. Styled mit Tailwind |
| 11 | `frontend/components/Sidebar.tsx` | 🔴 KRITISCH | Logik | Sidebar-Komponente. Liste von Chats. Add/Delete Chat Buttons. Zeigt Server-Chat-Count. Chat-Navigation |
| 12 | `frontend/app/layout.tsx` | 🔴 KRITISCH | Logik | Root-Layout für Next.js. Global CSS, HTML-Structure |
| 13 | `frontend/app/globals.css` | 🔴 KRITISCH | Styling | Global Stylesheet. Tailwind directives |
| **WICHTIG/SINNVOLL (Build & Config - Notwendig, aber auto-generiert/konfiguriert)** |
| 14 | `package.json` (Root) | 🟡 WICHTIG | Build / Config | Root-Konfiguration für npm-Scripts. Orchestriert Backend + Frontend + Electron. Definiert alle Build- und Dev-Kommandos |
| 15 | `backend/requirements.txt` | 🟡 WICHTIG | Build / Config | Python-Dependencies für Backend (FastAPI, Uvicorn, PyInstaller). Spezifiziert Versions-Anforderungen |
| 16 | `frontend/package.json` | 🟡 WICHTIG | Build / Config | Frontend-Dependencies (Next.js, React, Tailwind). Definiert Build-Scripts mit Umgebungsvariablen für HTTP/IPC-Mode |
| 17 | `electron/tsconfig.json` | 🟡 WICHTIG | Build / Config | TypeScript-Konfiguration speziell für Electron Main Process. Ermöglicht TypeScript in Electron zu kompilieren |
| 18 | `frontend/tsconfig.json` | 🟡 WICHTIG | Build / Config | TypeScript-Konfiguration für Frontend/Next.js. Path Mapping, strict mode, lib definitions |
| 19 | `frontend/next.config.ts` | 🟡 WICHTIG | Build / Config | Next.js-Konfiguration. Output-Mode auf `standalone` für Electron Bundling |
| 20 | `frontend/eslint.config.mjs` | 🟡 WICHTIG | Build / Config | ESLint Konfiguration. Code-Linting Regeln für Frontend-Code Quality |
| 21 | `frontend/postcss.config.mjs` | 🟡 WICHTIG | Build / Config | PostCSS Config für Tailwind CSS Processing |
| 22 | `backend/build.ps1` | 🟡 WICHTIG | Build / Config | PowerShell-Script um Backend mit PyInstaller zu kompilieren. Erzeugt `app.exe` für Production |
| 23 | `backend/pyinstaller.spec` | 🟡 WICHTIG | Build / Config | PyInstaller-Spezifikation. Definiert welche Files in den Build gehören, Entry-Points, Hooks |
| 24 | `electron-builder.yml` | 🟡 WICHTIG | Build / Config | Electron-Builder Konfiguration. Definiert Installer, Icons, App-Metadata für Windows/Mac/Linux Builds |
| **UNKRITISCH (Automatisch generiert - Können gelöscht werden)** |
| 25 | `.venv/` | ⚪ UNKRITISCH | Autogen | Python Virtual Environment. Von `pip install -r requirements.txt` erstellt. Nur Laufzeit-Abhängigkeiten |
| 26 | `node_modules/` | ⚪ UNKRITISCH | Autogen | Node.js Dependencies. Von `npm install` erstellt. Nur Laufzeit-Abhängigkeiten |
| 27 | `dist/`, `build/`, `.next/`, `out/` | ⚪ UNKRITISCH | Autogen | Build-Outputs. Von Build-Scripts generiert. Können jederzeit neu gebaut werden |
| 28 | `frontend/public/*` | ⚪ UNKRITISCH | Assets | Public Assets wie Icons, Logos, Bilder. Optional, können auch extern gehostet werden |
| **DOKUMENTATION (Hilfreich, aber optional)** |
| 29 | `START_HERE.md` | 📄 DOKU | Docs | Anleitung zum Setup und Starten des Projekts. Schnell-Start Guide |
| 30 | `SETUP_CHECKLIST.md` | 📄 DOKU | Docs | Checkliste für Projekt-Setup. Installation von Dependencies |
| 31 | `QUICK_START.md` | 📄 DOKU | Docs | Kurz-Anleitung für schnellen Start |
| 32 | `VERIFICATION_REPORT.md` | 📄 DOKU | Docs | Verification Report von Fehler-Fixes |
| 33 | `VERIFICATION_FINAL.md` | 📄 DOKU | Docs | Finale Verification Report |
| 34 | `FIXES_APPLIED.md` | 📄 DOKU | Docs | Dokumentation von angewendeten Fixes |
| 35 | `ELECTRON.md` | 📄 DOKU | Docs | Dokumentation über Electron-Setup und IPC |

---

## 🏗️ Architektur-Übersicht

### Schichten:

```
┌─────────────────────────────────────────┐
│  Electron Main Process (electron/main.ts)
│  - Startet Python Backend               │
│  - Erstellt BrowserWindow               │
│  - Handelt IPC-Messages                 │
└────────────┬────────────────────────────┘
             │ IPC Bridge (preload.ts)
             ▼
┌─────────────────────────────────────────┐
│  Frontend (Next.js/React)               │
│  - UI Components (ChatInterface, etc)   │
│  - API-Factory Pattern (factory.ts)     │
│  - HttpAdapter oder IpcAdapter          │
└────────────┬────────────────────────────┘
             │ HTTP / IPC
             ▼
┌─────────────────────────────────────────┐
│  Backend (FastAPI - main.py)            │
│  - REST Endpoints (/api/chats/count)    │
│  - CORS Middleware                      │
│  - Uvicorn Server (Port 8000)           │
└─────────────────────────────────────────┘
```

---

## 🔄 Datenfluss

### Development Mode (HTTP):
```
User Input (ChatInterface)
  → page.tsx
  → fetchChatCount() (lib/api.ts)
  → factory.ts getApiClient() → HttpAdapter
  → fetch("http://localhost:8000/api/chats/count")
  → Backend Endpoint
  → JSON Response
  → State Update in page.tsx
```

### Production Mode (Electron + IPC):
```
User Input (ChatInterface)
  → page.tsx
  → fetchChatCount() (lib/api.ts)
  → factory.ts getApiClient() → IpcAdapter
  → window.electronApi.apiRequest()
  → preload.ts → ipcRenderer.invoke('api:request')
  → Electron Main Process (main.ts)
  → HTTP fetch zu lokalem Backend
  → Response zurück via IPC
  → State Update in page.tsx
```

---

## 🔑 Wichtigste Konzepte

### 1. **Adapter Pattern (factory.ts)**
Das Kernstück der Architektur. Ermöglicht zwei verschiedene Implementierungen (`HttpAdapter`, `IpcAdapter`) mit gleichem Interface (`ApiClient`). Automatische Auswahl basierend auf Environment Variable `NEXT_PUBLIC_API_MODE`.

**Warum wichtig:** 
- Entwicklung mit HTTP (schnell, einfach zu debuggen)
- Production mit IPC (sichere, schnelle Kommunikation ohne Netzwerk)
- Kein Code-Change nötig beim Umschalten

### 2. **Electron IPC Bridge (preload.ts)**
Sichere Kommunikation zwischen Renderer (Frontend) und Main Process. Nutzt Electron's Context Bridge um nur spezifische APIs zu exponieren.

**Warum wichtig:** 
- Sicherheit (keine direkten Filesystem/System-Zugriffe vom Frontend)
- IPC-basierte Kommunikation ist schneller als HTTP für lokale Prozesse

### 3. **Automatisches Backend-Starten (main.ts)**
Der Electron Main Process startet automatisch den Python-Backend-Server. Nutzt Port-Discovery um verfügbaren Port zu finden.

**Warum wichtig:** 
- User klickt "Run" → Alles startet automatisch
- Kein manuelles Starten von Backend und Frontend nötig
- Robuste Python-Path-Auflösung für venv

### 4. **Dual-Mode Build**
Unterschiedliche Environment Variables für Dev/Production:
- **Dev:** `NEXT_PUBLIC_API_MODE=http` (HTTP Adapter)
- **Prod:** `NEXT_PUBLIC_API_MODE=ipc` (IPC Adapter)

---

## 📦 Deployment Pipeline

```
npm run electron:build
  ├─ npm run build:backend
  │  └─ PyInstaller kompiliert main.py → app.exe
  ├─ npm run build:frontend
  │  └─ Next.js build (NEXT_PUBLIC_API_MODE=ipc)
  └─ npm run build:electron
     └─ TypeScript kompiliert electron/main.ts

npm run electron:package
  ├─ electron:build (s.o.)
  └─ electron-builder erstellt Installer (electron-builder.yml)
```

---

## 🚀 Kritische Abhängigkeiten

| Dependency | Nutzen | Kritikalität |
|------------|--------|-------------|
| **FastAPI** | REST API Framework für Backend | ⭐⭐⭐ |
| **Uvicorn** | ASGI Server um FastAPI zu hosten | ⭐⭐⭐ |
| **Next.js** | React Framework für Production-Ready Frontend | ⭐⭐⭐ |
| **React** | UI Library | ⭐⭐⭐ |
| **Electron** | Desktop App Wrapper | ⭐⭐⭐ |
| **Tailwind CSS** | Styling | ⭐⭐ |
| **TypeScript** | Type Safety für TS-Dateien | ⭐⭐ |
| **PyInstaller** | Kompiliert Python zu Standalone .exe | ⭐⭐ (nur Production) |
| **electron-builder** | Erzeugt Windows/Mac/Linux Installer | ⭐⭐ (nur Production) |

---

## ✅ Zusammenfassung

### 🔴 **KRITISCH - Dein Application Code** (13 Dateien)
Das ist der Code, den du schreibst und änderst. Ohne diese funktioniert die App nicht.

**Backend (2 Dateien):**
- `backend/main.py` - API Endpoints
- (Abhängig von: `backend/requirements.txt`)

**Electron (2 Dateien):**
- `electron/main.ts` - Desktop App Wrapper, Backend-Starter
- `electron/preload.ts` - IPC-Bridge

**Frontend (9 Dateien):**
- `frontend/app/page.tsx` - Haupt-Screen
- `frontend/app/layout.tsx` - Root-Layout
- `frontend/components/ChatInterface.tsx` - Chat UI
- `frontend/components/Sidebar.tsx` - Sidebar UI
- `frontend/app/globals.css` - Global Styles
- `frontend/lib/api/factory.ts` - Adapter-Pattern
- `frontend/lib/api/types.ts` - API Types
- `frontend/lib/api/httpAdapter.ts` - HTTP Implementation
- `frontend/lib/api/ipcAdapter.ts` - IPC Implementation
- `frontend/lib/api.ts` - API Wrapper

### 🟡 **WICHTIG/SINNVOLL - Build & Config** (11 Dateien)
Diese Dateien sind notwendig, aber automatisch generiert oder deklarativ (Dependencies, Config). Du änderst diese, wenn du:
- Dependencies hinzufügst (`package.json`, `requirements.txt`)
- TypeScript/Build-Settings anpasst (`tsconfig.json`, `next.config.ts`)
- Production-Build konfigurierst

**Dependencies & Config:**
- `package.json` (Root)
- `backend/requirements.txt`
- `frontend/package.json`
- `electron/tsconfig.json`, `frontend/tsconfig.json`
- `frontend/next.config.ts`
- `frontend/eslint.config.mjs`, `frontend/postcss.config.mjs`

**Build & Deployment:**
- `backend/build.ps1`
- `backend/pyinstaller.spec`
- `electron-builder.yml`

### ⚪ **UNKRITISCH - Auto-Generated** (3 Kategorien)
Diese werden vom System generiert und können gelöscht werden (werden neu erstellt):
- `.venv/` - Erstellt von `pip install`
- `node_modules/` - Erstellt von `npm install`
- Build-Outputs (`dist/`, `build/`, `.next/`, `out/`)

### 📄 **DOKUMENTATION** (7 Dateien)
Optional aber hilfreich zum Verstehen und Setup.
