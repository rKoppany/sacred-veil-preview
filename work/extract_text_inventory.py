import json
import re
from html.parser import HTMLParser
from pathlib import Path
from datetime import datetime

PROJECT = Path(r"C:\Users\rolan\Desktop\Astro Website")
DIST = PROJECT / "dist"
SRC = PROJECT / "src"
WORK = PROJECT / "work"
WORK.mkdir(exist_ok=True)

PAGES = {
    "index.html": "Főoldal",
    "rolunk.html": "Rólunk",
    "szolgaltatasok.html": "Csomagok",
    "portfolio.html": "Portfólió",
    "kapcsolat.html": "Kapcsolat",
    "aszf.html": "ÁSZF",
}

TEXT_TAGS = {"a", "p", "h1", "h2", "h3", "h4", "h5", "h6", "li", "label", "button", "span", "small", "strong", "option", "title", "textarea"}
SKIP_TAGS = {"script", "style", "svg", "path", "g"}

source_files = list((SRC).rglob("*.astro")) + list((SRC).rglob("*.ts")) + [PROJECT / "tailwind.config.mjs", SRC / "styles" / "global.css"]
source_texts = {}
for p in source_files:
    if p.exists():
        source_texts[str(p)] = p.read_text(encoding="utf-8", errors="ignore")

src_global = (SRC / "styles" / "global.css").read_text(encoding="utf-8")
dist_css_path = next((DIST / "_astro").glob("*.css"))
dist_css = dist_css_path.read_text(encoding="utf-8")

class Node:
    def __init__(self, tag="document", attrs=None, parent=None):
        self.tag = tag
        self.attrs = dict(attrs or [])
        self.parent = parent
        self.children = []
        self.text_parts = []
        if parent:
            parent.children.append(self)
    def text(self):
        parts = []
        def walk(n):
            parts.extend(n.text_parts)
            for c in n.children:
                if c.tag not in SKIP_TAGS:
                    walk(c)
        walk(self)
        return normalize(" ".join(parts))
    def direct_text(self):
        return normalize(" ".join(self.text_parts))
    def classes(self):
        return [c for c in self.attrs.get("class", "").split() if c]
    def path(self):
        out = []
        n = self
        while n and n.tag != "document":
            cls = n.classes()
            label = n.tag
            if n.attrs.get("id"):
                label += f"#{n.attrs['id']}"
            if cls:
                label += "." + ".".join(cls[:3])
                if len(cls) > 3:
                    label += "..."
            out.append(label)
            n = n.parent
        return " > ".join(reversed(out))

class Parser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node()
        self.current = self.root
    def handle_starttag(self, tag, attrs):
        node = Node(tag.lower(), attrs, self.current)
        if tag.lower() not in {"meta", "link", "img", "input", "br", "hr"}:
            self.current = node
    def handle_endtag(self, tag):
        tag = tag.lower()
        n = self.current
        while n.parent and n.tag != tag:
            n = n.parent
        if n.parent:
            self.current = n.parent
    def handle_data(self, data):
        if self.current.tag not in SKIP_TAGS:
            self.current.text_parts.append(data)

def normalize(s):
    return re.sub(r"\s+", " ", s or "").strip()

def iter_nodes(root):
    for c in root.children:
        yield c
        yield from iter_nodes(c)

def find_source(text):
    if not text:
        return []
    candidates = []
    # Exact first, then prefix/template hints for generated portfolio alts.
    for path, content in source_texts.items():
        idx = content.find(text)
        if idx >= 0:
            line = content[:idx].count("\n") + 1
            candidates.append({"file": path, "line": line, "match": "exact"})
    if candidates:
        return candidates[:3]
    simplified = text
    for pattern, hint in [
        (r"Sacred Veil portfóliófotó \d+ megnyitása", "Sacred Veil portfóliófotó ${index + 1} megnyitása"),
        (r"Sacred Veil portfóliófotó \d+", "Sacred Veil portfóliófotó ${index + 1}"),
        (r".* előnézet", "${title} előnézet"),
        (r".* hangulatkép", "${service.title} hangulatkép"),
    ]:
        if re.fullmatch(pattern, simplified):
            for path, content in source_texts.items():
                idx = content.find(hint)
                if idx >= 0:
                    line = content[:idx].count("\n") + 1
                    return [{"file": path, "line": line, "match": "template"}]
    # Search words for generated arrays if no exact.
    words = [w for w in re.findall(r"[\wÁÉÍÓÖŐÚÜŰáéíóöőúüű]{4,}", text) if w.lower() not in {"sacred", "veil"}]
    if len(words) >= 2:
        for path, content in source_texts.items():
            if all(w in content for w in words[:3]):
                idx = content.find(words[0])
                line = content[:idx].count("\n") + 1 if idx >= 0 else 1
                candidates.append({"file": path, "line": line, "match": "partial"})
    return candidates[:3]

def parse_css_rules(css):
    rules = []
    i = 0
    n = len(css)
    def skip_ws_comments(i):
        while i < n:
            if css.startswith("/*", i):
                j = css.find("*/", i + 2)
                i = n if j < 0 else j + 2
            elif css[i].isspace():
                i += 1
            else:
                break
        return i
    def find_close(open_idx):
        depth = 1; j = open_idx + 1; quote = None
        while j < n:
            ch = css[j]
            if quote:
                if ch == "\\": j += 2; continue
                if ch == quote: quote = None
                j += 1; continue
            if css.startswith("/*", j):
                k = css.find("*/", j + 2); j = n if k < 0 else k + 2; continue
            if ch in "'\"": quote = ch; j += 1; continue
            if ch == "{": depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0: return j
            j += 1
        return n - 1
    def rec(block, media=""):
        local_rules = []
        j = 0; L = len(block)
        while j < L:
            if block.startswith("/*", j):
                k = block.find("*/", j+2); j = L if k < 0 else k+2; continue
            if block[j].isspace(): j += 1; continue
            start = j; quote = None
            while j < L:
                ch = block[j]
                if quote:
                    if ch == "\\": j += 2; continue
                    if ch == quote: quote = None
                    j += 1; continue
                if block.startswith("/*", j):
                    k = block.find("*/", j+2); j = L if k < 0 else k+2; continue
                if ch in "'\"": quote = ch; j += 1; continue
                if ch in "{;}": break
                j += 1
            if j >= L: break
            if block[j] in ";}": j += 1; continue
            pre = block[start:j].strip()
            # find close in local block
            depth=1; k=j+1; quote=None
            while k < L:
                ch=block[k]
                if quote:
                    if ch == "\\": k += 2; continue
                    if ch == quote: quote=None
                    k += 1; continue
                if block.startswith("/*", k):
                    q=block.find("*/", k+2); k=L if q<0 else q+2; continue
                if ch in "'\"": quote=ch; k+=1; continue
                if ch == "{": depth += 1
                elif ch == "}":
                    depth -= 1
                    if depth == 0: break
                k += 1
            inner = block[j+1:k]
            if pre.startswith("@media"):
                local_rules.extend(rec(inner, pre))
            elif not pre.startswith("@"):
                props = {}
                for decl in inner.split(";"):
                    if ":" in decl:
                        key, val = decl.split(":", 1)
                        props[key.strip()] = normalize(val)
                local_rules.append({"selector": pre, "props": props, "media": media})
            j = k + 1
        return local_rules
    return rec(css)

src_rules = parse_css_rules(src_global)
dist_rules = parse_css_rules(dist_css)

def selector_mentions_class(selector, class_name):
    # Good enough for generated Tailwind/custom selectors.
    escaped = class_name.replace(":", "\\:").replace("/", "\\/").replace("[", "\\[").replace("]", "\\]").replace(".", "\\.")
    return f".{class_name}" in selector or f".{escaped}" in selector

def class_rule_summary(classes, max_rules=9):
    selected = []
    for cls in classes:
        # prefer source custom css, then dist utilities
        for origin, rules in [("src/styles/global.css", src_rules), ("dist/_astro CSS (Tailwind build)", dist_rules)]:
            for rule in rules:
                if selector_mentions_class(rule["selector"], cls):
                    if any(k in rule["props"] for k in ["font-family","font-size","font-weight","line-height","letter-spacing","text-transform","color","margin-top","margin-bottom","padding","padding-top","padding-bottom","padding-left","padding-right","text-align","display","gap","background","border","border-radius"]):
                        selected.append({"class": cls, "origin": origin, "selector": rule["selector"], "props": rule["props"], "media": rule["media"]})
                        break
            if any(r["class"] == cls and r["origin"] == origin for r in selected):
                break
        if len(selected) >= max_rules:
            break
    return selected

TAILWIND_FONT = {
    "font-display": '"Cormorant Garamond", Georgia, serif',
    "font-body": 'Inter, "Segoe UI", sans-serif',
}
TAILWIND_COLORS = {
    "text-ink": "#22201d", "text-taupe": "#6f6860", "text-rosegold": "#7d3042", "text-champagne": "#b08a4d", "text-ivory": "#fbfaf6", "text-white": "#ffffff",
    "bg-ink": "#22201d", "bg-ivory": "#fbfaf6", "bg-veil": "#f1eee6", "bg-white": "#ffffff"
}
TAILWIND_SIZES = {
    "text-xs": "0.75rem / line-height 1rem", "text-sm": "0.875rem / line-height 1.25rem", "text-lg": "1.125rem / line-height 1.75rem",
    "text-3xl": "1.875rem / line-height 2.25rem", "text-4xl": "2.25rem / line-height 2.5rem", "md:text-5xl": "3rem / line-height 1"
}
TAILWIND_WEIGHT = {"font-semibold":"600", "font-bold":"700", "font-extrabold":"800"}

def style_summary(node):
    classes = node.classes()
    bits = []
    for cls in classes:
        if cls in TAILWIND_FONT: bits.append(f"{cls}: {TAILWIND_FONT[cls]}")
        if cls in TAILWIND_SIZES: bits.append(f"{cls}: {TAILWIND_SIZES[cls]}")
        if cls in TAILWIND_WEIGHT: bits.append(f"{cls}: font-weight {TAILWIND_WEIGHT[cls]}")
        if cls in TAILWIND_COLORS: bits.append(f"{cls}: {TAILWIND_COLORS[cls]}")
        if cls.startswith("text-") and "/" in cls: bits.append(f"{cls}: Tailwind opacity color utility")
        if cls.startswith("tracking-"): bits.append(f"{cls}: letter-spacing utility")
        if cls == "uppercase": bits.append("uppercase: text-transform uppercase")
        if cls.startswith("mt-") or cls.startswith("mb-") or cls.startswith("mx-") or cls.startswith("pt-") or cls.startswith("pb-") or cls.startswith("px-") or cls.startswith("py-") or cls.startswith("p-"):
            bits.append(f"{cls}: Tailwind spacing utility")
    for rule in class_rule_summary(classes, 7):
        props = rule["props"]
        keep = [f"{k}: {v}" for k, v in props.items() if k in {"font-family","font-size","font-weight","line-height","letter-spacing","text-transform","color","margin-top","margin-bottom","padding","padding-top","padding-bottom","padding-left","padding-right","text-align","display","gap","background","border","border-radius"}]
        if keep:
            bits.append(f"{rule['selector']} [{rule['origin']}]: " + "; ".join(keep[:6]))
    if not bits:
        bits.append("Nincs közvetlen tipográfiai class; öröklés főként: body -> Inter, color var(--taupe), line-height 1.65.")
    return bits[:12]

def container_for(node):
    n = node.parent
    preferred = ["button", "a", "article", "form", "section", "nav", "footer", "header", "div"]
    while n and n.tag != "document":
        cls = n.classes()
        if n.tag in preferred and (n.tag in {"button", "a", "article", "form", "section", "nav", "footer", "header"} or any(c in cls for c in ["container","section","package-card","package-promo","package-print","media-frame","portfolio-card","button","rounded-lg","grid","flex","hero-copy"])):
            return n
        n = n.parent
    return node.parent

def container_summary(node):
    c = container_for(node)
    if not c:
        return {"descriptor":"-", "classes":"", "rules":[], "note":""}
    rules = class_rule_summary(c.classes(), 7)
    directions = []
    for cls in c.classes():
        if cls.startswith("px-"): directions.append(f"{cls}: bal+jobb padding")
        elif cls.startswith("py-"): directions.append(f"{cls}: felső+alsó padding")
        elif cls.startswith("pt-"): directions.append(f"{cls}: felső padding")
        elif cls.startswith("pb-"): directions.append(f"{cls}: alsó padding")
        elif cls.startswith("pl-"): directions.append(f"{cls}: bal padding")
        elif cls.startswith("pr-"): directions.append(f"{cls}: jobb padding")
        elif cls.startswith("p-"): directions.append(f"{cls}: minden oldal padding")
        elif cls.startswith("gap-"): directions.append(f"{cls}: gyermekek közötti térköz")
        elif cls.startswith("mt-"): directions.append(f"{cls}: felső külső margó")
        elif cls.startswith("mb-"): directions.append(f"{cls}: alsó külső margó")
        elif cls.startswith("mx-"): directions.append(f"{cls}: bal+jobb külső margó")
        elif cls.startswith("max-w-"): directions.append(f"{cls}: maximális szélesség")
        elif cls in {"text-center"}: directions.append("text-center: szöveg középre igazítás")
        elif cls in {"grid", "flex", "inline-flex"}: directions.append(f"{cls}: elrendezési mód")
    return {"descriptor": c.path(), "classes":" ".join(c.classes()), "rules": rules[:5], "note":"; ".join(directions[:10]) or "Nincs közvetlen irány szerinti spacing class a választott konténeren."}

def unique_slug(page, tag, index):
    base = page.replace(".html", "").replace("szolgaltatasok", "csomagok")
    return f"{base}-{tag}-text-{index:02d}"

def suggested_selector(entry):
    cls = unique_slug(entry["page_file"], entry["tag"], entry["index"])
    original_classes = entry.get("classes", "")
    if original_classes:
        html = f'<{entry["tag"]} class="{original_classes} {cls}">...'
    else:
        html = f'<{entry["tag"]} class="{cls}">...'
    return {"class": cls, "html": html, "css": f".{cls} {{\n  /* külön formázás ide */\n}}"}

entries_by_page = {}
meta_by_page = {}
for file, page_name in PAGES.items():
    html_path = DIST / file
    html = html_path.read_text(encoding="utf-8")
    parser = Parser(); parser.feed(html)
    entries = []
    # title/meta description
    title = re.search(r"<title>(.*?)</title>", html, re.S|re.I)
    desc = re.search(r'<meta name="description" content="([^"]*)"', html, re.I)
    meta_by_page[file] = {"title": normalize(title.group(1)) if title else "", "description": normalize(desc.group(1)) if desc else ""}
    idx = 1
    for node in iter_nodes(parser.root):
        if node.tag in SKIP_TAGS:
            continue
        texts = []
        direct = node.direct_text()
        if node.tag in TEXT_TAGS and direct:
            texts.append(("látható szöveg", direct))
        for attr, label in [("placeholder", "placeholder"), ("aria-label", "aria-label"), ("alt", "alt szöveg")]:
            if node.attrs.get(attr):
                texts.append((label, normalize(node.attrs.get(attr))))
        if node.tag == "input" and node.attrs.get("value"):
            texts.append(("input value", normalize(node.attrs.get("value"))))
        for kind, txt in texts:
            if not txt:
                continue
            if node.tag == "option" and txt in ["Válasszatok", "Még nem tudjuk", "Jegyesfotózás", "Polgári fotózás", "Esküvői fotózás", "Több szolgáltatás", "Spark csomag", "Glow csomag", "Ethereal csomag", "Blessed csomag", "Sacred csomag"]:
                pass
            entry = {
                "index": idx,
                "page": page_name,
                "page_file": file,
                "kind": kind,
                "text": txt,
                "tag": node.tag,
                "id": node.attrs.get("id", ""),
                "classes": " ".join(node.classes()),
                "href": node.attrs.get("href", ""),
                "name": node.attrs.get("name", ""),
                "path": node.path(),
                "style_origin": "HTML class attribútum + src/styles/global.css / Tailwind build" if node.classes() else "Örökölt alapstílus vagy attribútumszöveg",
                "style_summary": style_summary(node),
                "container": container_summary(node),
                "source_matches": find_source(txt),
            }
            entry["suggestion"] = suggested_selector(entry)
            entries.append(entry); idx += 1
    entries_by_page[file] = entries

# Shared style reference blocks.
def global_selector(selector):
    for rule in src_rules:
        if rule["selector"].strip() == selector:
            return rule["props"]
    return {}
shared_styles = []
for selector in ["body", "a", ".eyebrow", ".display-title", ".page-title", ".section-title", ".button", ".button-primary", ".button-secondary", ".section", ".container", ".hero-copy", ".package-card h3", ".package-price span", ".package-facts", ".portfolio-card", ".lightbox-control", ".lightbox-stage img"]:
    props = global_selector(selector)
    if props:
        shared_styles.append({"selector": selector, "props": props, "source": str(SRC / "styles" / "global.css")})

result = {
    "generated_at": datetime.now().isoformat(timespec="seconds"),
    "project": str(PROJECT),
    "dist_css": str(dist_css_path),
    "pages": PAGES,
    "meta": meta_by_page,
    "entries": entries_by_page,
    "shared_styles": shared_styles,
    "tailwind": {
        "fonts": {
            "font-display": 'Cormorant Garamond, Georgia, serif',
            "font-body/body": 'Inter, Segoe UI, sans-serif'
        },
        "colors": TAILWIND_COLORS,
        "source": str(PROJECT / "tailwind.config.mjs")
    }
}
out = WORK / "text-style-inventory.json"
out.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
print(str(out))
for file, entries in entries_by_page.items():
    print(file, len(entries))
