# Student Grouper (CSV → Groups of 4 + Roles)

This is a small, browser-only tool for professors/instructors to upload a class roster CSV and generate **groups of 4** with rotating discussion roles:

- **Lead Idea**
- **Support Idea**
- **Cynic**
- **Organizer**

**Privacy:** nothing is uploaded anywhere — parsing and grouping happen locally in your browser.

## What you’ll do (workflow)

1. Open the app in a browser
2. Upload your roster CSV
3. Select which column contains **Name** (and optional **ID**)
4. Review the roster (search / remove any students)
5. Click **Generate groups**
6. Export:
   - **Copy**: copies a readable group list (good for email / LMS announcement)
   - **Download CSV**: exports a spreadsheet-friendly file (good for saving / printing)

## Start the app

### Recommended (reliable “Copy” button)

Run a local web server from the `student-grouper` folder:

```bash
cd "/Users/sophiapung/Projects/Group/student-grouper"
python3 -m http.server 5173
```

Then open `http://localhost:5173`.

### If you just double-click `index.html`

It usually works, but **some browsers block clipboard access** on `file://` pages. If the **Copy** button fails, use the “Recommended” method above.

## CSV format (roster)

Requirements:

- The **first row must be headers**
- A **Name** column is required
- An **ID** column is optional (recommended if you have it)

Example:

```csv
Name,ID
Ada Lovelace,1001
Alan Turing,1002
Grace Hopper,1003
Katherine Johnson,1004
```

Notes:

- If your headers are different (e.g., `Student`, `Full Name`, `SIS ID`), that’s fine — after upload, you’ll choose which column is **Name**.
- Duplicate students are automatically de-duplicated using **ID** (if selected) or **name** (if no ID).

## Grouping rules

- Groups are randomized.
- For groups of 4, each group gets **one of each role** (Lead / Support / Cynic / Organizer).
- **Shuffle seed (optional):** enter any text (e.g., `Period2-Feb3`). Same roster + same seed → same grouping.

## If your class size isn’t divisible by 4

In “If not divisible by 4…” choose:

- **Create an “Extras” list** (default): leftover students appear in a separate list
- **Allow smaller last group**: the final group may have 1–3 students

## Troubleshooting

- **“No header row found”**: your CSV must include column names in the first row.
- **Names look blank / missing**: pick the correct **Name column** after upload.
- **Copy button says it failed**: use the local server method (`python3 -m http.server ...`) and open `http://localhost:5173`.

