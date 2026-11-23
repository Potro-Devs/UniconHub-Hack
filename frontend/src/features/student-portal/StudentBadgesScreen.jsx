import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { APP_NAME, COLORS, LEVELS, getLevelIndex } from '@/config/brand';
import { Mascot } from '@/features/mascot';
import { SKILL_GLYPHS, SKILLS, STUDENTS } from '@/shared/data/seedData';
import { useAppUi } from '@/shared/state/AppUiContext';
import { MilestoneOverlay } from './MilestoneOverlay';

const AXI_COLORS = [
  ['rosa', 'Rosa'],
  ['azul', 'Azul'],
  ['amarillo', 'Amarillo'],
  ['lila', 'Lila'],
];

/**
 * Pantalla 17: Mis sellos y selector de color de Axi.
 */
export function StudentBadgesScreen() {
  const navigate = useNavigate();
  const { stuIdx, axiColor, setAxiColor } = useAppUi();
  const [showMilestone, setShowMilestone] = useState(false);
  const [skipAnim, setSkipAnim] = useState(false);

  const stu = STUDENTS[stuIdx ?? 0];

  const badges = SKILLS.map((k) => {
    const v = k.id === 'fractions' ? 58 : k.id === 'problem_solving' ? 88 : stu.sc[k.id];
    const kk = getLevelIndex(v);
    return {
      id: k.id,
      name: k.name,
      glyph: SKILL_GLYPHS[k.id],
      isMastered: kk === 3,
      state: kk === 3 ? 'Sello Dominado' : kk === 2 ? 'Sello Logrado' : 'En camino',
      ring: kk === 3 ? 'oklch(0.85 0.15 88)' : kk === 2 ? 'oklch(0.72 0.13 165)' : COLORS.bg,
      border: kk >= 2 ? '0' : '3px dashed #B9C2D4',
      fg: kk === 3 ? 'oklch(0.45 0.12 75)' : kk === 2 ? 'oklch(0.42 0.1 165)' : COLORS.mutedLight,
      tagBg: kk >= 2 ? LEVELS[kk].bg : COLORS.bg,
      tagFg: kk >= 2 ? LEVELS[kk].fg : COLORS.muted,
    };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '12px' }}>
        <div style={{ flex: '1 1 260px' }}>
          <h1 className="font-display" style={{ margin: 0, fontWeight: 800, fontSize: '34px', lineHeight: 1.1 }}>
            Mis sellos
          </h1>
          <div style={{ fontSize: '17px', marginTop: '4px' }}>
            Los sellos no se pierden. Cada uno cuenta algo que ya sabes hacer.
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate('/alumno/resumen')}
          style={{
            height: '48px',
            padding: '0 18px',
            borderRadius: '16px',
            border: 0,
            background: '#fff',
            fontFamily: "'Baloo 2', sans-serif",
            fontWeight: 700,
            fontSize: '17px',
            lineHeight: 1,
            cursor: 'pointer',
          }}
        >
          ← Volver
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
          gap: '12px',
        }}
      >
        {badges.map((b) => (
          <div
            key={b.id}
            role={b.isMastered ? 'button' : undefined}
            tabIndex={b.isMastered ? 0 : undefined}
            onClick={() => {
              if (b.isMastered) {
                setSkipAnim(false);
                setShowMilestone(true);
              }
            }}
            onKeyDown={(e) => {
              if (b.isMastered && e.key === 'Enter') {
                setSkipAnim(false);
                setShowMilestone(true);
              }
            }}
            style={{
              background: '#fff',
              borderRadius: '24px',
              padding: '18px 12px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px',
              textAlign: 'center',
              cursor: b.isMastered ? 'pointer' : 'default',
            }}
          >
            <div
              style={{
                width: '92px',
                height: '92px',
                borderRadius: '50%',
                background: b.ring,
                border: b.border,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                className="font-display"
                style={{
                  width: '66px',
                  height: '66px',
                  borderRadius: '50%',
                  background: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '26px',
                  lineHeight: 1,
                  color: b.fg,
                }}
              >
                {b.glyph}
              </div>
            </div>
            <div style={{ fontSize: '16px', fontWeight: 700, lineHeight: 1.2 }}>{b.name}</div>
            <span
              style={{
                padding: '4px 10px',
                borderRadius: '999px',
                fontSize: '13px',
                fontWeight: 700,
                background: b.tagBg,
                color: b.tagFg,
              }}
            >
              {b.state}
            </span>
          </div>
        ))}
      </div>

      <div
        style={{
          background: '#fff',
          borderRadius: '26px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
          <div className="font-display" style={{ fontWeight: 700, fontSize: '22px', lineHeight: 1.2 }}>
            Elige el color de {APP_NAME}
          </div>
          <span
            style={{
              padding: '4px 10px',
              borderRadius: '999px',
              background: 'oklch(0.94 0.08 90)',
              color: 'oklch(0.4 0.09 75)',
              fontSize: '12px',
              fontWeight: 700,
            }}
          >
            Roadmap
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
            gap: '10px',
          }}
        >
          {AXI_COLORS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setAxiColor(id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
                padding: '12px 8px',
                borderRadius: '20px',
                border: `4px solid ${axiColor === id ? COLORS.ink : 'transparent'}`,
                background: '#F8FAFD',
                cursor: 'pointer',
                fontFamily: "'Baloo 2', sans-serif",
                fontWeight: 700,
                fontSize: '16px',
                lineHeight: 1,
              }}
            >
              <Mascot size={84} color={id} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {showMilestone && (
        <MilestoneOverlay
          axiColor={axiColor}
          skip={skipAnim}
          onSkip={() => setSkipAnim(true)}
          onViewBadges={() => setShowMilestone(false)}
        />
      )}
    </div>
  );
}
