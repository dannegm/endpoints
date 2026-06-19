import React from 'react';

const getLangForeground = hex => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55 ? '#1a1a1a' : '#ffffff';
};

const ICON_SIZE = 58;
const ICON_OVERLAP = -19;

const LangDot = ({ icon, i }) => {
    const shared = {
        borderRadius: '50%',
        border: '3px solid #09090b',
        marginLeft: i === 0 ? 0 : ICON_OVERLAP,
        background: icon.color,
        flexShrink: 0,
        width: `${ICON_SIZE}px`,
        height: `${ICON_SIZE}px`,
    };

    if (icon.uri) {
        return <img src={icon.uri} width={ICON_SIZE} height={ICON_SIZE} style={{ ...shared, padding: '8px' }} />;
    }

    return (
        <div
            style={{
                ...shared,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '19px',
                fontWeight: 700,
                color: getLangForeground(icon.color),
                fontFamily: 'Geist',
            }}
        >
            {icon.label[0]}
        </div>
    );
};

export function BinPreview({ binId, title, authorName, accentColor, fileCount, views, languageIcons, extraLangs, avatarUri }) {
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                width: '1200px',
                height: '630px',
                background: '#09090b',
                padding: '64px 72px',
                fontFamily: 'Geist',
            }}
        >
            {/* Title + avatar row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flex: 1 }}>
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        flex: 1,
                        paddingRight: '64px',
                        paddingLeft: '32px',
                        borderLeft: `4px solid ${accentColor}`,
                    }}
                >
                    {binId && (
                        <div style={{ fontSize: '32px', color: '#52525b', fontFamily: 'Geist Mono', marginBottom: '12px' }}>
                            {binId}
                        </div>
                    )}
                    <div
                        style={{
                            fontSize: '68px',
                            fontWeight: 600,
                            color: '#fafafa',
                            lineHeight: 1.1,
                            letterSpacing: '-2px',
                            overflow: 'hidden',
                            maxHeight: '150px',
                        }}
                    >
                        {title.length > 50 ? `${title.slice(0, 50).trimEnd()}…` : title}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', marginTop: '20px', gap: '14px' }}>
                        <div
                            style={{
                                width: '14px',
                                height: '14px',
                                borderRadius: '50%',
                                background: accentColor,
                                flexShrink: 0,
                            }}
                        />
                        <div style={{ fontSize: '44px', color: '#d4d4d8', fontWeight: 400 }}>{authorName}</div>
                    </div>
                </div>

                {avatarUri && (
                    <img
                        src={avatarUri}
                        width={140}
                        height={140}
                        style={{
                            borderRadius: '50%',
                            border: `4px solid ${accentColor}`,
                            flexShrink: 0,
                        }}
                    />
                )}
            </div>

            {/* Bottom bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {/* Stacked language icons + file count */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        {languageIcons.map((icon, i) => (
                            <LangDot key={i} icon={icon} i={i} />
                        ))}
                        {extraLangs > 0 && (
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: `${ICON_SIZE}px`,
                                    height: `${ICON_SIZE}px`,
                                    borderRadius: '50%',
                                    border: '3px solid #09090b',
                                    marginLeft: ICON_OVERLAP,
                                    background: '#1c1c1e',
                                    fontSize: '14px',
                                    color: '#71717a',
                                    fontFamily: 'Geist Mono',
                                    flexShrink: 0,
                                }}
                            >
                                {`+${extraLangs}`}
                            </div>
                        )}
                    </div>
                    <div style={{ fontSize: '22px', color: '#a1a1aa', fontFamily: 'Geist Mono' }}>
                        {`${fileCount} ${fileCount === 1 ? 'file' : 'files'}`}
                    </div>
                </div>

                {/* Views + branding */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                    <div style={{ fontSize: '22px', color: '#a1a1aa', fontFamily: 'Geist Mono' }}>
                        {`${views.toLocaleString()} views`}
                    </div>
                    <div style={{ fontSize: '26px', color: accentColor, fontWeight: 600, letterSpacing: '-0.5px' }}>
                        bins.hckr.mx
                    </div>
                </div>
            </div>
        </div>
    );
}
