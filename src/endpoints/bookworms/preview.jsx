import React from 'react';

const BRAND   = '#b5621a';
const BRAND2  = '#d97c3a';
const BG      = '#f8f4ee';
const PANEL   = '#ede8e0';
const FG      = '#1e1610';
const MUTED   = '#7a6b5a';
const BORDER  = '#d0c8bc';

export function BookPreview({ title, authors, published, pagecount, serieName, serieSequence, labels, coverUri }) {
    const truncatedTitle = title.length > 64 ? `${title.slice(0, 64).trimEnd()}…` : title;
    const authorsText = authors.slice(0, 3).map(a => a.name).join(', ');
    const truncatedAuthors = authorsText.length > 55 ? `${authorsText.slice(0, 55).trimEnd()}…` : authorsText;
    const truncatedSerie = serieName && serieName.length > 38 ? `${serieName.slice(0, 38).trimEnd()}…` : serieName;
    const serieText = serieName ? (serieSequence ? `Book ${serieSequence} of ${truncatedSerie}` : truncatedSerie) : null;
    const metaLine = [published, pagecount ? `${pagecount} pages` : null, serieText].filter(Boolean).join('  ·  ');
    const topLabels = (labels ?? []).slice(0, 3);

    // Bottom meta items — built as array to avoid null children
    const metaItems = [];

    if (topLabels.length > 0) {
        metaItems.push(
            React.createElement(
                'div',
                { key: 'labels', style: { display: 'flex', gap: 8 } },
                ...topLabels.map((label, i) =>
                    React.createElement(
                        'div',
                        { key: i, style: { display: 'flex', background: 'rgba(181,98,26,0.10)', borderRadius: 100, padding: '4px 14px', border: `1px solid rgba(181,98,26,0.25)` } },
                        React.createElement(
                            'span',
                            { style: { fontFamily: 'Noto Sans', fontWeight: 600, fontSize: 17, color: BRAND } },
                            label,
                        ),
                    ),
                ),
            ),
        );
    }

    const coverEl = coverUri
        ? React.createElement('img', {
              src: coverUri,
              width: 248,
              height: 372,
              style: { borderRadius: 6, objectFit: 'cover', boxShadow: '0 16px 48px rgba(30,22,16,0.30), 0 4px 12px rgba(30,22,16,0.15)' },
          })
        : React.createElement(
              'div',
              { style: { width: 248, height: 372, borderRadius: 6, background: `linear-gradient(135deg, ${BRAND} 0%, ${BRAND2} 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center' } },
              React.createElement(
                  'span',
                  { style: { color: 'rgba(255,255,255,0.9)', fontSize: 106, fontFamily: 'Merriweather', fontWeight: 700 } },
                  title[0] ?? 'B',
              ),
          );

    return (
        <div style={{ width: 1200, height: 630, display: 'flex', background: BG, fontFamily: 'Noto Sans', overflow: 'hidden' }}>

            {/* ── Left panel ─────────────────────────────── */}
            <div style={{ width: 400, height: 630, background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', paddingLeft: '54px' }}>
                {/* Decorative large circle behind cover */}
                <div style={{ position: 'absolute', width: 340, height: 340, borderRadius: '50%', background: '#ece7df', left: 57, top: 145 }} />
                {/* Small accent dot bottom-right */}
                <div style={{ position: 'absolute', width: 80, height: 80, borderRadius: '50%', background: 'rgba(181,98,26,0.12)', right: 20, bottom: 40 }} />
                <div style={{ position: 'absolute', width: 48, height: 48, borderRadius: '50%', background: 'rgba(181,98,26,0.18)', right: 56, bottom: 80 }} />
                {/* Cover */}
                {coverEl}
                {/* Left accent stripe */}
                <div style={{ position: 'absolute', left: 0, top: 0, width: 5, height: 630, background: BRAND }} />
            </div>

            {/* ── Right panel ────────────────────────────── */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '52px 64px', position: 'relative', overflow: 'hidden' }}>

                {/* Decorative rings — top right corner */}
                <div style={{ position: 'absolute', right: -100, top: -100, width: 280, height: 280, borderRadius: '50%', border: '1px solid rgba(181,98,26,0.10)' }} />
                <div style={{ position: 'absolute', right: -65, top: -65, width: 210, height: 210, borderRadius: '50%', border: '1px solid rgba(181,98,26,0.16)' }} />
                <div style={{ position: 'absolute', right: -30, top: -30, width: 140, height: 140, borderRadius: '50%', border: '1.5px solid rgba(181,98,26,0.22)' }} />

                {/* Watermark */}
                <div style={{ position: 'absolute', top: 18, left: 48, display: 'flex' }}>
                    <span style={{ fontFamily: 'Merriweather', fontWeight: 700, fontSize: 142, color: BRAND, opacity: 0.06, letterSpacing: '6px' }}>
                        BOOKWORMS
                    </span>
                </div>

                {/* Decorative dot — bottom left */}
                <div style={{ position: 'absolute', left: 64, bottom: 48, width: 6, height: 6, borderRadius: '50%', background: BRAND }} />
                <div style={{ position: 'absolute', left: 78, bottom: 48, width: 6, height: 6, borderRadius: '50%', background: BRAND, opacity: 0.5 }} />
                <div style={{ position: 'absolute', left: 92, bottom: 48, width: 6, height: 6, borderRadius: '50%', background: BRAND, opacity: 0.25 }} />

                {/* ── Content ── */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>

                    {/* Logo row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
                        <div style={{ display: 'flex', width: 3, height: 18, background: BRAND, borderRadius: 2 }} />
                        <span style={{ fontFamily: 'Merriweather', fontWeight: 700, fontSize: 18, color: BRAND, letterSpacing: '2.5px' }}>
                            BOOKWORMS
                        </span>
                    </div>

                    {/* Title */}
                    <div style={{ display: 'flex', maxHeight: 200, marginBottom: 14 }}>
                        <span style={{ fontFamily: 'Merriweather', fontWeight: 700, fontSize: 62, color: FG, lineHeight: 1.18 }}>
                            {truncatedTitle}
                        </span>
                    </div>

                    {/* Authors */}
                    <div style={{ display: 'flex', marginBottom: 32 }}>
                        <span style={{ fontFamily: 'Noto Sans', fontWeight: 400, fontSize: 25, color: MUTED }}>
                            {truncatedAuthors}
                        </span>
                    </div>

                    {/* Separator */}
                    <div style={{ display: 'flex', alignSelf: 'stretch', height: 1, background: BORDER, marginBottom: 22 }} />

                    {/* Year · Pages */}
                    {metaLine ? (
                        <div style={{ display: 'flex', marginBottom: 14 }}>
                            <span style={{ fontFamily: 'Noto Sans', fontWeight: 600, fontSize: 19, color: MUTED, letterSpacing: '0.5px' }}>
                                {metaLine}
                            </span>
                        </div>
                    ) : React.createElement('span', { key: 'empty-meta' })}

                    {/* Serie + Labels */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {metaItems}
                    </div>

                </div>
            </div>
        </div>
    );
}
