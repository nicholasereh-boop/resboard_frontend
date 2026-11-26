// Turns the plain article HTML of an older in-house article (written before the story editor) into an editor document,
// so it can be opened and improved in the new editor. Only the tags the old editor allowed are understood; the rest keeps its text.
import { emptyDoc } from "../../../editor/schema";

const MARK = { strong: "bold", b: "bold", em: "italic", i: "italic", u: "underline" };

function inline(node, marks = []) {
  if (node.nodeType === 3) return node.nodeValue ? [{ type: "text", text: node.nodeValue, ...(marks.length ? { marks } : {}) }] : [];
  if (node.nodeType !== 1) return [];
  const tag = node.nodeName.toLowerCase();
  if (tag === "br") return [{ type: "hardBreak" }];
  let next = marks;
  if (MARK[tag]) next = [...marks, { type: MARK[tag] }];
  if (tag === "a" && /^(https?:|mailto:)/i.test(node.getAttribute("href") || "")) next = [...marks, { type: "link", attrs: { href: node.getAttribute("href") } }];
  return Array.from(node.childNodes).flatMap((c) => inline(c, next));
}

function block(node) {
  if (node.nodeType === 3) return node.nodeValue.trim() ? [{ type: "paragraph", content: inline(node) }] : [];
  if (node.nodeType !== 1) return [];
  const tag = node.nodeName.toLowerCase();
  const kids = () => Array.from(node.childNodes);
  if (/^h[2-4]$/.test(tag)) return [{ type: "heading", attrs: { level: Number(tag[1]) }, content: kids().flatMap((c) => inline(c)) }];
  if (tag === "ul" || tag === "ol") {
    const items = kids().filter((c) => c.nodeName.toLowerCase() === "li").map((li) => ({ type: "listItem", content: [{ type: "paragraph", content: Array.from(li.childNodes).flatMap((c) => inline(c)) }] }));
    return items.length ? [{ type: tag === "ul" ? "bulletList" : "orderedList", content: items }] : [];
  }
  if (tag === "blockquote") return [{ type: "blockquote", content: [{ type: "paragraph", content: kids().flatMap((c) => inline(c)) }] }];
  if (tag === "hr") return [{ type: "horizontalRule" }];
  if (tag === "p") return [{ type: "paragraph", content: kids().flatMap((c) => inline(c)) }];
  return kids().flatMap(block); // unknown wrapper: keep what is inside
}

export function htmlToDoc(html) {
  if (!html || typeof DOMParser === "undefined") return emptyDoc();
  const body = new DOMParser().parseFromString(`<!doctype html><body>${html}`, "text/html").body;
  const content = Array.from(body.childNodes).flatMap(block).filter((n) => n.type !== "paragraph" || (n.content && n.content.length));
  return content.length ? { type: "doc", content } : emptyDoc();
}
