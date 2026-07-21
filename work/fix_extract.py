from pathlib import Path
p=Path(r'C:\Users\rolan\Desktop\Astro Website\work\extract_text_inventory.py')
s=p.read_text(encoding='utf-8')
s=s.replace('''        html = f'<{entry["tag"]} class="{original_classes} {cls}">...'</nospan>\n''', '''        html = f'<{entry["tag"]} class="{original_classes} {cls}">...'\n''')
s=s.replace('''        html = f'<{entry["tag"]} class="{cls}">...'</nospan>\n''', '''        html = f'<{entry["tag"]} class="{cls}">...'\n''')
s=s.replace('''    return {"class": cls, "html": html.replace("</nospan>", ""), "css": f".{cls} {{\\n  /* külön formázás ide */\\n}}"}\n''', '''    return {"class": cls, "html": html, "css": f".{cls} {{\\n  /* külön formázás ide */\\n}}"}\n''')
p.write_text(s, encoding='utf-8')
