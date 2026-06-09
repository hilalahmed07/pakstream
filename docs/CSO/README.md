# PakStream — CSO Documentation

Formal CSO deliverables for the **PakStream** platform (secure media streaming &
document management system). All documents are generated as Microsoft Word (`.docx`)
files in this folder.

## Deliverables

| # | Document | File |
|---|----------|------|
| 1 | Project Plan | [01_Project_Plan.docx](01_Project_Plan.docx) |
| 2 | Software Requirements Specification (SRS) | [02_SRS.docx](02_SRS.docx) |
| 3 | Design Document | [03_Design_Document.docx](03_Design_Document.docx) |
| 4 | Prototype Document | [04_Prototype_Document.docx](04_Prototype_Document.docx) |
| 5 | Use Case Document | [05_Use_Case_Document.docx](05_Use_Case_Document.docx) |
| 6 | Test Cases | [06_Test_Cases.docx](06_Test_Cases.docx) |

## Regenerating the documents

The `.docx` files are produced from a single script so they can be regenerated or edited:

```bash
python3 docs/CSO/generate_docs.py
```

Requires [`python-docx`](https://python-docx.readthedocs.io/) (`pip install python-docx`).
The Prototype document embeds the screenshots found in the repository's `demo/` folder.

## Notes

- Each document opens with a cover page (project, title, version `1.0`, date).
- To insert an automatic Table of Contents in Word: open a document, then
  **References → Table of Contents → Automatic Table** (the headings are already styled).
- Content is derived from the actual codebase (`README.md`, `PROJECT_ARCHITECTURE.md`,
  backend models/routes/services), so it reflects real features rather than boilerplate.
