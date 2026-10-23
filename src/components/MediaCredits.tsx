import { AUTHORIZED_PHOTOS, CLUB_ASSETS } from '../../shared/sports-assets';
import { useGame } from '../lib/api';
import { Badge, PageTitle, Section } from './ui';
import { PlayerCard } from './PlayerCard';
import { PhotoCredit } from './PlayerPortrait';
export default function MediaCredits() {
  const { state } = useGame(),
    real = state.players.filter((p) => !p.simulated),
    available = real.filter((p) => AUTHORIZED_PHOTOS.some((a) => a.playerId === p.id));
  return (
    <>
      <PageTitle
        back
        eyebrow="RECURSOS DEPORTIVOS Y CRÉDITOS"
        title="Caras con nombre y fuente"
        subtitle={`${available.length}/${real.length} fotografías reales autorizadas · ${state.players.length - real.length} identidades ficticias con retrato original.`}
      />
      <Section title="Fotografías disponibles">
        <p>
          Las fotos identifican al futbolista; algunas muestran equipaciones de selecciones o
          temporadas anteriores. No implican colaboración con el juego. Los puntos, estados y
          valores siguen siendo simulados.
        </p>
        <div className="sports-card-grid credits-grid">
          {available.map((p) => (
            <div key={p.id}>
              <PlayerCard player={p} />
              <PhotoCredit player={p} />
            </div>
          ))}
        </div>
      </Section>
      <Section title="Emblemas de los clubes">
        <Badge kind="gold">0 / {CLUB_ASSETS.length} ESCUDOS OFICIALES AUTORIZADOS</Badge>
        <p>
          Los clubes están asociados por ID y temporada. Se muestran emblemas alternativos
          originales, marcados ALT. Los escudos oficiales están pendientes de autorización
          verificable; no se presentan los emblemas como oficiales.
        </p>
      </Section>
      <Section title="Arte y sonido originales">
        <p>
          Arquitecturas, paisaje de acceso y atlas ilustrados creados para MONIGONES mediante
          imagegen. Terreno, instalaciones, retratos alternativos y emblemas dibujados para este
          proyecto. Música y efectos originales sintetizados con Web Audio. El catálogo de fuentes y
          licencias está documentado en docs/SPORTS_ASSETS.md y docs/BUILDING_ASSETS.md.
        </p>
      </Section>
    </>
  );
}
