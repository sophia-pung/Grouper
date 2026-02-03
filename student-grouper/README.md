# Student Grouper (CSV → Groups of 4)

A tiny, browser-only tool to upload a class roster CSV and generate **groups of 4** with roles:

- **Lead Idea**
- **Support Idea**
- **Cynic**
- **Organizer**

Nothing is uploaded anywhere — parsing and grouping happen locally in your browser.

## Quick start (recommended)

Clipboard access (Copy button) is most reliable when you run a local web server.

From this folder:

```bash
cd "/Users/sophiapung/Projects/Group/student-grouper"
python3 -m http.server 5173
```

Then open `http://localhost:5173` in your browser.

## CSV format

- The **first row must be headers**
- Include a **Name** column (required)
- Include an **ID** column (optional)

Example:

```csv
Name,ID
Ada Lovelace,1001
Alan Turing,1002
Grace Hopper,1003
Katherine Johnson,1004
```

## How it works

- Upload your CSV
- Choose which column is **Name** (and optionally **ID**)
- Review the roster (search / remove students)
- Click **Generate groups**
- Use:
  - **Copy** to copy a readable group list
  - **Download CSV** to export in a spreadsheet-friendly format

## Leftovers

If the total student count isn’t divisible by 4, you can either:

- Create an **Extras** list (default), or
- Allow a **smaller last group**

