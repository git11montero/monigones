import { CLUB_ASSETS } from '../../shared/sports-assets';
import { playerAsset } from '../../shared/football-assets';
import { useFootballCatalog } from '../lib/football-media';
import { useGame } from '../lib/api';
import { Badge, PageTitle, Section } from './ui';
import { PlayerCard } from './PlayerCard';
import { PhotoCredit } from './PlayerPortrait';
export default function MediaCredits() {
  const { state } = useGame(),
    media = useFootballCatalog(),
    real = state.players.filter((p) => !p.simulated),
    available = real.filter((p) => media.data?.[playerAsset(p).photo]?.kind === 'licensed');
  return (
    <>
      <PageTitle
        back
        eyebrow="RECURSOS DEPORTIVOS Y CRÉDITOS"
        title="Imágenes y créditos"
        subtitle={`${available.length}/${real.length} fotografías autorizadas verificadas · ${state.players.length} imágenes PNG locales.`}
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
          La entrega incluye veinte escudos genéricos. Puedes sustituir sus PNG por imágenes que
          tengas derecho a utilizar. Las sustituciones manuales no se verifican ni se presentan
          automáticamente como escudos oficiales autorizados.
        </p>
      </Section>
      <Section title="Arte y sonido originales">
        <p>
          Arquitecturas, paisaje de acceso y atlas ilustrados creados para MONIGONES mediante
          imagegen. Siluetas genéricas y escudos neutros originales. Las identidades ficticias
          conservan siluetas, sin fotografías de otras personas. Música y efectos originales
          sintetizados con Web Audio. La guía de imágenes y la documentación gráfica están
          disponibles junto al proyecto.
        </p>
      </Section>
    </>
  );
}
