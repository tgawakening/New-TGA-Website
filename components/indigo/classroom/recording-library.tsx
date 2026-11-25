"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import s from "./recording-library.module.css";
import { RecordingPlayer } from "./recording-player";
import { Rosette } from "@/components/indigo/ornaments";

type Item = { id: string; title: string; date?: string; href: string; external: boolean; player?: { src: string; kind: "VIDEO" | "AUDIO" }; description?: string | null; resources?: { id: string; title: string; href: string }[] };

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

function RecordingThumbnail({ title, thumbnail }: { title: string; thumbnail?: string | null }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className={s.thumbnail} aria-hidden="true">
      {thumbnail && !failed ? (
        // The provider serves its own thumbnails; a broken image falls back to the branded card.
        // eslint-disable-next-line @next/next/no-img-element
        <img className={s.thumbnailImage} src={thumbnail} alt="" onError={() => setFailed(true)} />
      ) : (
        <span className={s.fallback}>
          <Rosette className={s.rosette} />
          <span className={s.fallbackLabel}>Sīrah · Beyond Chronology</span>
          <span className={s.fallbackTitle}>{title}</span>
        </span>
      )}
      <span className={s.play}>&#9654;</span>
    </span>
  );
}

export function RecordingLibrary({ items }: { items: Item[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<Item | null>(null);
  if (!items.length) return <p className={s.empty}>Recordings will appear here once published.</p>;
  const embed = selected?.external ? embedFor(selected.href) : null;
  return <>
    <div className={s.grid}>{items.map((item) => {
      const preview = item.external ? embedFor(item.href) : null;
      const body = <><RecordingThumbnail title={item.title} thumbnail={preview?.thumbnail} /><span className={s.content}><strong>{item.title}</strong>{item.date && <small>{item.date}</small>}{item.description && <small>{item.description}</small>}</span></>;
      return (item.player || (item.external && (preview || item.resources?.length))) ? <button key={item.id} type="button" className={s.card} onClick={() => { setSelected(item); dialog.current?.showModal(); }} aria-haspopup="dialog">{body}<span className={s.action}>Watch &#8594;</span></button> : item.external ? <a key={item.id} className={s.card} href={item.href} target="_blank" rel="noopener noreferrer">{body}<span className={s.action}>Open &#8599;</span></a> : <Link key={item.id} className={s.card} href={item.href}>{body}<span className={s.action}>Watch &#8594;</span></Link>;
    })}</div>
    <dialog ref={dialog} className={s.dialog} onClose={() => setSelected(null)} aria-labelledby="recording-player-title">
      {selected && <><header className={s.dialogHeader}><h2 id="recording-player-title">{selected.title}</h2><form method="dialog"><button className={s.close} aria-label="Close recording">Close &#215;</button></form></header>
        {selected.player ? <div className={s.player}><RecordingPlayer src={selected.player.src} kind={selected.player.kind} title={selected.title} /></div> : embed ? <div className={s.player}><iframe src={embed.src} title={`Recording: ${selected.title}`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /></div> : <p className={s.dialogContent}><a href={selected.href} target="_blank" rel="noopener noreferrer">Open recording &#8599;</a></p>}
        {(embed || selected.player) && <p className={s.dialogContent}><a href={selected.href} target={selected.external ? "_blank" : undefined} rel={selected.external ? "noopener noreferrer" : undefined}>Open recording separately &#8599;</a></p>}
        {selected.resources?.length ? <div className={s.dialogContent}><strong>Tasks and resources</strong><ul>{selected.resources.map((resource) => <li key={resource.id}><a href={resource.href} target="_blank" rel="noopener noreferrer">{resource.title}</a></li>)}</ul></div> : null}
      </>}
    </dialog>
  </>;
}
