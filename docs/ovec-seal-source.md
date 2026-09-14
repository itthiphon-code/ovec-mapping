# OVEC seal correction

The masthead uses the unchanged seal PNG from [Sakon Nakhon Vocational College's identity download page](https://snkvc.ac.th/?page_id=1586), retrieved on 2026-09-14.

- Asset: `public/images/ovec-official-seal.png` (2063 x 2065).
- Thai name: สำนักงานคณะกรรมการการอาชีวศึกษา.
- Inner motto: ทุ. ส. นิ. ม.
- The original seal overlays the generated seal in `components/ovec-masthead.tsx`; responsive coordinates refer to the existing 1983 x 793 banner with its blank bands hidden.
- `/header` reuses the same component so the full-size view shows the corrected seal. Social previews use the original seal directly.
- Two built-in image_gen edits were inspected and rejected because their small lettering remained inaccurate. Neither generated edit is shipped. The source PNG is not redrawn or modified.

## Final attempted image_gen prompt

Use case: compositing, precise-object-edit. Image 1 is the edit target: the existing OVEC Mapping banner. Image 2 is the authoritative seal reference downloaded from a vocational college's official identity download page. Replace ONLY the upper-left circular seal in Image 1 (approximately x=58,y=47,width=250,height=248 on the 1983x793 canvas) with the circular seal from Image 2. Copy its faithful typography and emblem, including the exact upper-ring Thai 'สำนักงานคณะกรรมการการอาชีวศึกษา', lower-ring English 'VOCATIONAL EDUCATION COMMISSION', and small gold Thai motto 'ทุ. ส. นิ. ม.' underneath the emblem. DO NOT retain the malformed gold characters from Image 1. Use Image 2's exact circle design scaled down cleanly; no square white background around the seal. Leave EVERY other pixel/element of Image 1 unchanged: headline, people, faces, infographic, labels, colors, background, positions. Maintain the exact original 1983x793 canvas and its 37px top and 34px bottom blank strips. Surgical official-logo replacement only; no redesign, no new text, no zooming or cropping.

