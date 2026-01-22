# UI guidelines (v1)

This app uses a medium-density, card-based enterprise PMS style. These guidelines document the *current* conventions so we can standardize incrementally.

## 1) Spacing scale

Use only these spacing values:
- 4px, 8px, 12px, 16px, 24px, 32px

Tailwind mapping:
- 4px → `1`
- 8px → `2`
- 12px → `3`
- 16px → `4`
- 24px → `6`
- 32px → `8`

Rules:
- Default section spacing: `space-y-6`
- Card padding: `p-4` or `p-6`
- Page header spacing: `mb-6`

## 2) Typography hierarchy

- Page title: `text-xl font-semibold`
- Section title: `text-sm font-semibold text-slate-700`
- Body text: `text-sm text-slate-900`
- Muted/meta: `text-xs text-slate-500`

Rule: avoid random sizes; stick to these.

## 3) Color roles (Tailwind defaults)

- Primary action: `bg-blue-600 text-white hover:bg-blue-700`
- Secondary action: `bg-white border border-slate-300 text-slate-900 hover:bg-slate-50`
- Danger: `bg-red-600 text-white hover:bg-red-700`

Status (badges):
- Success: green
- Warning: amber
- Error: red
- Neutral: slate

## 4) Surfaces / cards

Default card:
- `bg-white rounded-lg border border-slate-200 p-4`

Section card:
- Use `p-6` for larger sections

Rule: prefer borders over heavy shadows.

## 5) Buttons

Primary:
- `inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700`

Secondary:
- `inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50`

Ghost/link:
- `inline-flex items-center text-sm font-medium text-blue-600 hover:underline`

## 6) Tables (rules only)

- Header: `text-xs font-medium text-slate-500 uppercase`
- Rows: `text-sm`
- Primary column: `font-medium`
- Status cells use badges
