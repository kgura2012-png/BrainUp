# Catalog artwork refresh — 2026-11-17

The manifest records each source page, original image URL and SHA-256. The locally packaged WebP files preserve transparent character renders, are at most 768px (Wave Rider retains its larger extraction), and are encoded at quality 86 (Wave Rider: 96). `sourceDigest` identifies the untouched source; `digest` identifies the delivered file. No screenshot crops are used for these replacements.

The Wave Rider asset was extracted from the actual product render on PetPatch, using background removal. No other character or gear was substituted.

Full-size original mutation PNGs and Tirilikalika are pinned to their documented Fandom image URLs. The optional source route uses a strict host allowlist, size/type checks and the site's R2 cache. Production verification found these upstream originals unavailable. The browser therefore immediately renders mutation materials on the newly packaged normal character model, with no failed external request or timeout. Tirilikalika retains its existing image. Original source downloads are not represented as locally verified.

Cupid's Wings and Rainbow Hammer retain existing cutouts: the additional images found were either an incorrect item or a low-resolution image with background and captions. The admin PNG editor can replace these, as well as every other catalog item.

Game character art belongs to its respective creators. Source attribution is retained per item in manifest.json.
