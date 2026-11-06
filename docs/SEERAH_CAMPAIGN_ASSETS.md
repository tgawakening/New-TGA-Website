# Sīrah campaign artwork and video delivery

The campaign assets from `e92170a` are preserved. `/seerah` uses `public/Seerah new/hero banner page.png`; the homepage promotion uses `hero banner home.png` and links to `/seerah`. Desktop copy sits on the dark left area; mobile copy precedes a right-positioned doorway image.

The ten topic illustrations use the exact source filenames in `course-config.ts`, with editable titles, questions, focus, source-examination text and reflection prompts. Gallery frames are 8:5, showing three cards on desktop, two on tablet and one plus a partial next card on mobile. The smartphone, mothers/children and drone images are explicitly contextualised as comparisons or thematic/contemporary illustrations, not documentary historical depictions.

## Videos

Both original Git LFS objects were retrieved and probed as real playable H.264/AAC video, 2160×3840:

| Original | Language | Duration | Original size | Web delivery |
| --- | --- | --- | --- | --- |
| `public/Seerah new/Comp 1.mp4` | English | 50.25 seconds | 284,857,208 bytes | `/videos/sirah-preview-en.mp4` — 8,348,385 bytes |
| `public/Seerah new/Comp 1r2.mp4` | Urdu | 51.32 seconds | 290,110,980 bytes | `/videos/sirah-preview-ur.mp4` — 8,137,804 bytes |

The delivery copies retain the complete 9:16 frame at 720×1280, H.264/AAC, with fast-start MP4 metadata. They are ordinary Git files, so hosting does not depend on downloading LFS objects during the build. The original LFS assets remain untouched. Separate extracted JPEG thumbnails are used; no made-up captions are attached. Playback uses native controls and click-to-play, and no video is downloaded before play. Changing language pauses/removes the previous player. Pakistan suggests Urdu; other countries suggest English. An explicit language choice is remembered independently from country.

Recreate a delivery copy with installed FFmpeg (English example):

```sh
ffmpeg -i 'public/Seerah new/Comp 1.mp4' -vf scale=720:1280 -c:v libx264 -preset fast -crf 25 -c:a aac -b:a 96k -movflags +faststart public/videos/sirah-preview-en.mp4
```

## Interaction and registration

Short entrance/hover transitions respect reduced motion and never require animation to reveal readable content. Section navigation identifies the section in view. Topic exploration reveals the historical question, study focus and a contemporary reflection. The five-step teaching method uses keyboard-accessible buttons with inline explanations, stacked on mobile.

All primary course registration actions link to the existing `/seerah/register` route. Country and plan are passed as query preferences and validated on the server-rendered page; they never set a payable amount. Eurozone/other-market or invalid country preferences require selection of an actual billing country rather than inventing a residence. Orientation remains a separate action until its configured expiry. Unapproved checkout and Pakistan recurring routes remain disabled.

## Verification

- Browser checks passed at 360, 390, 768, 1024 and 1440 px: no page overflow, keyboard-accessible exploration/stepper, registration preferences, independent/persistent language, and WCAG A/AA checks in the main content.
- Both delivery videos reached `canplay` in Chromium and preserved their portrait dimensions. All ten topic images decoded successfully; hero, thumbnails and homepage artwork were checked in the browser.
- Five campaign/asset tests and 24 database workflow tests passed. The latter include pre-migration readiness without changing legacy records.
- Public-host verification must separately confirm an MP4 response (`ftyp`, video content type), byte-range support and playback after deployment. A GitHub push alone is not proof that DigitalOcean finished deploying.

Screenshots: [desktop](sirah-registration/campaign-1440.png), [mobile](sirah-registration/campaign-390.png).

Database migration and payment activation instructions: [registration workflow guide](SIRAH_REGISTRATION_WORKFLOW.md#digitalocean-activation-steps-tga-app).
