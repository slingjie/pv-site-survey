# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

勘探报告工具 (Survey Report Tool) - A mobile-first web app for creating and managing on-site survey reports for PV/storage projects. Users can systematically record plant overview, building roofs, electrical facilities, and document collection, then generate printable HTML reports locally.

**Current Architecture**: Migrated from Supabase to Cloudflare Pages Functions + D1 + R2 (completed 2026-02-18).

## Development Commands

```bash
# Local development (frontend only)
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview

# Deploy to Cloudflare Pages (includes build)
npm run deploy

# Local development with Cloudflare Pages Functions
npm run preview:cf
```

## Architecture

### Frontend
- **Framework**: React 19 + TypeScript + Vite
- **Styling**: Tailwind utility classes (via CDN in index.html)
- **State**: React hooks, no external state management
- **Entry**: `index.tsx` → `App.tsx` (routing & top-level state)

### Backend (Cloudflare Pages Functions)
- **Single catch-all handler**: `functions/api/[[route]].ts` (~157 lines)
  - Handles ALL API routes via path parsing
  - Includes `ensureTable()` for auto-creating D1 tables on first request
  - CORS enabled for all endpoints
- **Database**: D1 (SQLite) - binding name `DB`
- **Storage**: R2 bucket `tk-report-images` - binding name `IMAGES`

### API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/projects` | List all projects (summary only) |
| POST | `/api/projects` | Create project with reportData |
| GET | `/api/projects/:id` | Get project + full reportData |
| PUT | `/api/projects/:id` | Update project/reportData |
| PATCH | `/api/projects/:id/status` | Update status only |
| DELETE | `/api/projects/:id` | Delete project |
| POST | `/api/upload` | Upload image to R2 (FormData: file, projectId, fieldKey) |
| GET | `/api/images/*` | Retrieve image from R2 |

## Core Data Model

Defined in `types.ts`:

- **Project**: Basic project info (id, name, location, status, surveyDate, surveyors, projectType)
- **ReportData**: Complete survey report containing:
  - `plantOverview`: Plant overview (address, coordinates, traffic, risk zones, power/property info)
  - `buildingRoofs`: Array of roof records (area, type, orientation, obstructions, structure)
  - `electricalFacilities`: Electrical equipment and grid connection details
  - `documentCollection`: Document checklist (key-value status tracking)

Form field configs and enums are centralized in `services/formConfigs.ts`.

## Key Files

- `App.tsx` - Entry component, routing, top-level state (projects list, current project)
- `components/views/ReportEditor.tsx` - Main editor with tab navigation
- `components/editor/` - Individual survey module editors (PlantOverview, BuildingRoofs, etc.)
- `services/projectApi.ts` - All API calls (fetch-based, no Supabase)
- `functions/api/[[route]].ts` - Backend catch-all handler

## Important Notes

### Pages Functions Architecture
- **Single-file catch-all pattern required**: Pages Functions cannot resolve cross-directory imports of `_` prefixed files
- All API logic consolidated in `functions/api/[[route]].ts` instead of separate route files
- Route matching done via path segment parsing (`url.pathname.split("/")`)

### Database
- D1 table auto-created via `ensureTable()` on every request (no manual migration needed)
- `projects` table schema: id, name, location, status, survey_date, surveyors, project_type, report_data (JSON as TEXT), created_at, updated_at

### Image Handling
- Images uploaded as data URLs from frontend
- Backend converts to File/Blob and stores in R2 with key: `{projectId}/{fieldKey}/{timestamp}-{random}.{ext}`
- Returns public URL: `/api/images/{key}`
- `prepareReportDataWithUploadedImages()` in `projectApi.ts` handles batch upload before save

### Migration History
- Originally planned multi-file Functions structure - changed to single catch-all due to import resolution issues
- Price/TOU module mentioned in docs but doesn't exist in codebase - only project CRUD + image upload implemented
- Production: https://tk-report.pages.dev

