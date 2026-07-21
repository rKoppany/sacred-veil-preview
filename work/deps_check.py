import importlib.util
for m in ['docx','reportlab','pdfplumber','pypdf','PIL']:
    print(m, bool(importlib.util.find_spec(m)))
