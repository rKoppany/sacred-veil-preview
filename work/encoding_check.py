from pathlib import Path
p=Path(r'C:\Users\rolan\Desktop\Astro Website\dist\index.html')
s=p.read_text(encoding='utf-8')
print(s[:200].encode('unicode_escape').decode('ascii'))
for needle in ['Esküvői', 'Főoldal', 'Árajánlatot']:
    print(needle.encode('unicode_escape').decode('ascii'), needle in s)
