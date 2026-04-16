# Normalization App

Browser-based CSV cleaning and normalization tool. All processing happens locally in the browser — no data is sent to any server.

## Features

- **Text Processing** — Uppercase conversion (smart URL/email exclusion), whitespace and punctuation cleanup
- **Company Name Cleaning** — Remove legal entity suffixes (LLC, Inc, Corp...), replace abbreviations, group by cleaned name
- **Address Parsing** — Combine address fields, standardize abbreviations (Street > ST, Avenue > AVE)
- **City & State Validation** — Validate against a reference CSV, normalize state names to abbreviations
- **Phone Normalization** — 5 formats: E164, National, International, Dots, Dashes
- **Email/Website Cleaning** — Normalize, extract domains, strip protocols
- **Duplicate Detection** — Configurable column-based grouping, keeps the most complete row
- **Word Frequency Analysis** — Analyze token frequency across selected columns
- **Data Quality Scoring** — Completeness, validity, consistency, uniqueness metrics per column
- **Configuration Management** — Save/load/share processing configs via localStorage

## Usage

1. Upload a CSV
2. Select the main entity/company name column
3. Configure processing options (left panel)
4. Optionally upload a city/state reference CSV for validation
5. Click **Process**
6. Review results, export cleaned CSV or original-vs-cleaned audit file

## Reference File Format

For city/state validation, upload a CSV with columns: `city`, `state` (abbreviation), optionally `City_State`.

## Project Structure

```
app/
  page.tsx            Main application page
  layout.tsx          Root layout
  globals.css         Obsidian theme styles
components/           UI components (~20 files)
lib/
  dataProcessing.ts   Core processing engine
  types.ts            TypeScript interfaces
  storage.ts          LocalStorage utilities
  utils.ts            Helper functions
```

## Development

```bash
npm install
npm run dev
```

Open http://localhost:3000
