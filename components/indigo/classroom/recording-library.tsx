import Link from "next/link";
import s from "./recording-library.module.css";

type Item = { id: string; title: string; date?: string; href: string; external: boolean; description?: string | null };

function embedFor(href: string) {
  try {
    const url = new URL(href);
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    const youtube = host === "youtu.be" ? url.pathname.slice(1).split("/")[0] : ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(host) ? (url.searchParams.get("v") ?? url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1]) : null;
    if (youtube && /^[\w-]{11}$/.test(youtube)) return { src: `https://www.youtube-nocookie.com/embed/${youtube}`, thumbnail: `https://i.ytimg.com/vi/${youtube}/hqdefault.jpg` };
    if (host === "drive.google.com") {
      const id = url.pathname.match(/^\/file\/d\/([\w-]+)/)?.[1] ?? url.searchParams.get("id");
      if (id && /^[\w-]+$/.test(id)) return { src: `https://drive.google.com/file/d/${id}/preview`, thumbnail: null };
    }
  } catch { /* The existing link remains available as an external action. */ }
  return null;
}

export function RecordingLibrary({ items }: { items: Item[] }) {
  if (!items.length) return <p className={s.empty}>Recordings will appear here once published.</p>;
  return <div className={s.grid}>{items.map((item) => {
    const embed = item.external ? embedFor(item.href) : null;
    const body = <><span className={s.thumbnail} style={embed?.thumbnail ? { backgroundImage: `url("${embed.thumbnail}")` } : undefined}><span aria-hidden="true">&#9654;</span></span><span className={s.content}><strong>{item.title}</strong>{item.date && <small>{item.date}</small>}{item.description && <small>{item.description}</small>}</span></>;
    return embed ? <details key={item.id} className={s.card}><summary>{body}<span className={s.action}>Watch &#8594;</span></summary><div className={s.player}><iframe src={embed.src} title={`Recording: ${item.title}`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" /></div></details> : item.external ? <a key={item.id} className={s.card} href={item.href} target="_blank" rel="noopener noreferrer">{body}<span className={s.action}>Open &#8599;</span></a> : <Link key={item.id} className={s.card} href={item.href}>{body}<span className={s.action}>Watch &#8594;</span></Link>;
  })}</div>;
}
