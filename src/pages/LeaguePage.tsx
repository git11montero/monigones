import { GameSelect } from '../components/GameSelect';
import { BuildingArt } from '../components/City';
import { BUILDINGS, RULES } from '../../shared/config';
import { PlayerCard } from '../components/PlayerCard';
import { ClubBadge } from '../components/PlayerPortrait';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, CalendarDays, Shield, Flag, Trophy, Users } from 'lucide-react';
import { shortMoney } from '../../shared/math';
import { clubById } from '../../shared/sports';
import { useGame } from '../lib/api';
import { Badge, Countdown, Crest, Empty, PageTitle, Section } from '../components/ui';
export default function LeaguePage() {
  const { state, club } = useGame();
  const [sort, setSort] = useState('general');
  const ranking = state.clubs.toSorted((a, b) =>
    sort === 'general'
      ? b.totalPoints - a.totalPoints
      : sort === 'round'
        ? b.roundPoints - a.roundPoints
        : sort === 'money'
          ? b.resources.money - a.resources.money
          : sort === 'prestige'
            ? b.resources.prestige - a.resources.prestige
            : sort === 'stadium'
              ? b.buildings.stadium - a.buildings.stadium
              : sort === 'achievements'
                ? b.trophies.length - a.trophies.length
                : b.resources.money +
                  state.contracts
                    .filter((ct) => ct.clubId === b.id)
                    .reduce(
                      (n, ct) => n + state.players.find((p) => p.id === ct.playerId)!.value,
                      0,
                    ) -
                  (a.resources.money +
                    state.contracts
                      .filter((ct) => ct.clubId === a.id)
                      .reduce(
                        (n, ct) => n + state.players.find((p) => p.id === ct.playerId)!.value,
                        0,
                      )),
  );
  const value = (c: typeof club) =>
    sort === 'general'
      ? (c.totalPoints / 100).toFixed(2)
      : sort === 'round'
        ? (c.roundPoints / 100).toFixed(2)
        : sort === 'money'
          ? shortMoney(c.resources.money)
          : sort === 'prestige'
            ? c.resources.prestige
            : sort === 'stadium'
              ? `Nv. ${c.buildings.stadium}`
              : sort === 'achievements'
                ? c.trophies.length
                : shortMoney(
                    c.resources.money +
                      state.contracts
                        .filter((ct) => ct.clubId === c.id)
                        .reduce(
                          (n, ct) => n + state.players.find((p) => p.id === ct.playerId)!.value,
                          0,
                        ),
                  );
  return (
    <>
      <PageTitle
        eyebrow="AQUÍ SE ESCRIBE LA HISTORIA"
        title="La liga está en juego"
        subtitle={state.name}
      />
      <div className="league-hero">
        <Shield size={33} />
        <Badge kind="gold">TEMPORADA {String(state.season).padStart(2, '0')}</Badge>
        <h2>{ranking[0]?.name}</h2>
        <p>
          {state.currentRound > 1
            ? 'Al frente de la clasificación'
            : 'Todo por decidir. Todo por ganar.'}
        </p>
        <div>
          <span>
            <Users size={15} />
            {state.clubs.length} clubes
          </span>
          <span>
            <Flag size={15} />
            Jornada {state.currentRound}
          </span>
        </div>
      </div>
      <div className="padded">
        <label>
          Clasificación
          <GameSelect value={sort} onChange={(e) => setSort(e.target.value)}>
            {[
              ['general', 'General de temporada'],
              ['round', 'Última jornada'],
              ['money', 'Clubes más ricos'],
              ['assets', 'Patrimonio'],
              ['prestige', 'Prestigio'],
              ['stadium', 'Estadios'],
              ['achievements', 'Logros'],
            ].map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </GameSelect>
        </label>
      </div>
      <div className="ranking-table">
        <div className="ranking-label">
          <span>POS. / CLUB</span>
          <span>{['general', 'round'].includes(sort) ? 'PUNTOS' : 'VALOR'}</span>
        </div>
        {ranking.map((c, i) => (
          <Link
            key={c.id}
            to={`/museum/${c.id}`}
            className={`ranking-row ${c.id === club.id ? 'is-me' : ''}`}
          >
            <span className={`rank-number rank-${i + 1}`}>
              {i === 0 ? <Shield size={17} /> : String(i + 1).padStart(2, '0')}
            </span>
            <Crest
              size={31}
              color={c.color}
              label={c.name
                .split(' ')
                .map((n) => n[0])
                .join('')}
            />
            <span className="ranking-club">
              <strong>
                {c.name}
                {c.id === club.id && <small>TÚ</small>}
              </strong>
              <span>
                {c.trophies.length} trofeos ·{' '}
                {state.contracts.filter((ct) => ct.clubId === c.id).length} jugadores
              </span>
            </span>
            <b>{value(c)}</b>
          </Link>
        ))}
      </div>
      <Section title="El siguiente capítulo">
        <Link to="/matchday" className="card access-link">
          <span>
            <b>Jornada {state.currentRound}</b>
            <small>Encuentros, resultados e informe económico</small>
          </span>
          <ArrowRight size={20} />
        </Link>
        <Link to="/archive" className="card access-link">
          <span>Archivo de temporadas</span>
          <ArrowRight size={20} />
        </Link>
        <Link to="/chat" className="card access-link">
          <span>El vestuario de la liga</span>
          <ArrowRight size={20} />
        </Link>
      </Section>
    </>
  );
}
export function MatchdayPage() {
  const { state, club, act } = useGame();
  const [roundNo, setRoundNo] = useState(state.currentRound);
  const round = state.rounds.find((r) => r.number === roundNo) || state.rounds.at(-1)!;
  const report = round.reports[club.id];
  return (
    <>
      <PageTitle
        back
        eyebrow="EL FÚTBOL DECIDE"
        title={`Jornada ${round.number}`}
        subtitle="Calendario, resultados y convocatorias de tu liga."
      />
      <div className="padded">
        <label>
          Consultar jornada
          <GameSelect value={round.number} onChange={(e) => setRoundNo(Number(e.target.value))}>
            {state.rounds.map((r) => (
              <option key={r.number} value={r.number}>
                Jornada {r.number} ·{' '}
                {r.settled ? 'Liquidada' : r.status === 'live' ? 'En juego' : 'Próxima'}
              </option>
            ))}
          </GameSelect>
        </label>
      </div>
      <div
        className={`matchday-stage ${round.status === 'live' ? 'is-live' : ''}`}
        data-match-status={round.status}
      >
        <span className="matchday-status">
          {round.settled
            ? 'JORNADA FINALIZADA'
            : round.status === 'live'
              ? '● EN JUEGO'
              : 'LA PREVIA'}
        </span>
        <BuildingArt
          building={BUILDINGS.find((b) => b.id === 'stadium')!}
          level={club.buildings.stadium}
        />
        <h2>{club.name}</h2>
        <strong>
          {(
            (report?.points ??
              club.selection.starters.reduce(
                (n, slot) => n + (round.scores[slot.playerId || '']?.points || 0),
                0,
              )) / 100
          ).toFixed(2)}
        </strong>
        <small>
          {report ? ' puntos liquidados' : ' puntos base disponibles · aún sin liquidar'}
        </small>
      </div>
      <Section
        eyebrow={round.settled ? 'EL ONCE DEL INFORME' : 'TU CONVOCATORIA'}
        title="Los protagonistas"
      >
        <div className="matchday-cards">
          {(report
            ? report.detail.map((d) => ({
                playerId: d.playerId,
                position: d.position,
                quality: RULES.qualityBonus.indexOf(d.quality),
                points: d.final,
              }))
            : club.selection.starters.map((slot) => ({
                ...slot,
                points: round.scores[slot.playerId || '']?.points,
              }))
          ).map((slot, i) => {
            const p = state.players.find((p) => p.id === slot.playerId);
            return (
              <div className="matchday-slot" key={i}>
                {p ? (
                  <Link to={`/player/${p.id}`}>
                    <PlayerCard
                      player={p}
                      size="compact"
                      points={slot.points}
                      quality={Math.max(0, slot.quality)}
                    />
                  </Link>
                ) : (
                  <div className="empty-state">
                    <small>{slot.position}</small>Casilla vacía
                  </div>
                )}
                <small>
                  {p
                    ? round.scores[p.id]
                      ? `${round.scores[p.id].minutes} min · ${round.scores[p.id].goals} goles`
                      : 'Sin estadísticas todavía'
                    : '−5,00 puntos'}
                </small>
              </div>
            );
          })}
        </div>
      </Section>
      {!round.settled && (
        <Section title="El banquillo también juega">
          <div className="matchday-bench">
            {club.selection.bench.map((id) => {
              const p = state.players.find((p) => p.id === id)!;
              return (
                <Link to={`/player/${p.id}`} key={id}>
                  <PlayerCard player={p} size="compact" points={round.scores[id]?.points} />
                </Link>
              );
            })}
          </div>
          {!club.selection.bench.length && (
            <p className="hint">Todavía no has convocado suplentes.</p>
          )}
          <Link className="button secondary" to="/squad">
            {club.selection.locked ? 'Gestionar cambios manuales' : 'Preparar once y banquillo'} →
          </Link>
        </Section>
      )}
      {!round.settled && (
        <Section
          title={club.selection.locked ? 'La convocatoria está cerrada' : 'La grada también juega'}
        >
          <div className="card">
            <div className="row spread">
              <span>Cierre de convocatoria</span>
              <Countdown to={round.locksAt} now={state.now} />
            </div>
            <label>
              Política de entradas
              <GameSelect
                value={club.ticketPolicy}
                disabled={club.selection.locked}
                onChange={(e) =>
                  void act(
                    { type: 'ticket', policy: e.target.value },
                    'Política de entradas guardada.',
                  )
                }
              >
                <option value="economic">Económica · ×0,75 precio · +12 ocupación · +2 fama</option>
                <option value="standard">Estándar · precio y ocupación base</option>
                <option value="premium">Premium · ×1,35 precio · -10 ocupación · -2 fama</option>
              </GameSelect>
            </label>
            <p className="hint">
              Se congela una hora antes del primer encuentro. Saldo negativo o dinero insuficiente
              invalidan la convocatoria.
            </p>
            <Link className="text-link" to="/squad">
              Preparar mi once <ArrowRight size={15} />
            </Link>
          </div>
        </Section>
      )}
      <Section eyebrow="EN LA JORNADA" title="Sobre el césped">
        <div className="matches">
          {round.matches.map((m) => (
            <div className="match-row" key={m.id}>
              <span className="match-home">
                <ClubBadge clubId={m.home} size={20} />
                {clubById(m.home).short}
              </span>
              <strong>
                {m.status === 'finished' ? (
                  `${m.homeGoals} — ${m.awayGoals}`
                ) : m.status === 'live' ? (
                  <span className="live-label">EN JUEGO</span>
                ) : (
                  new Date(m.startsAt).toLocaleTimeString('es-ES', {
                    timeZone: 'Europe/Madrid',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                )}
              </strong>
              <span className="match-away">
                {clubById(m.away).short}
                <ClubBadge clubId={m.away} size={20} />
              </span>
              <small>
                {new Date(m.startsAt).toLocaleDateString('es-ES', {
                  timeZone: 'Europe/Madrid',
                  day: 'numeric',
                  month: 'short',
                })}
                {m.status === 'finished' ? ' · Finalizado' : ''}
              </small>
            </div>
          ))}
        </div>
      </Section>
      {report && round.settled && (
        <>
          <Section
            eyebrow="INFORME DE JORNADA"
            title={`${(report.points / 100).toFixed(2)} puntos para tu historia`}
          >
            <div className="card">
              {report.invalid && (
                <p className="error-text">
                  Convocatoria invalidada por saldo o validación. No hay puntos ni taquilla.
                </p>
              )}
              {[
                ['Convocatoria', -report.salary],
                ['Taquilla', report.stadium],
                ['Conciertos', report.concerts],
                ['Merchandising', report.merchandising],
                ['Televisión', report.television],
                ['Mantenimiento', -report.maintenance],
              ].map(([label, n]) => (
                <div className="definition-row" key={label as string}>
                  <span>{label}</span>
                  <strong className={Number(n) >= 0 ? 'positive' : 'negative'}>
                    {Number(n) >= 0 ? '+' : ''}
                    {shortMoney(Number(n))}
                  </strong>
                </div>
              ))}
            </div>
          </Section>
          <Section title="Los puntos, explicados">
            <div className="card">
              {report.detail.map((d, i) => (
                <div className="score-detail" key={i}>
                  <span>
                    <small>{d.position}</small>
                    {state.players.find((p) => p.id === d.playerId)?.name || 'Posición vacía'}
                    <em>
                      Base {(d.base / 100).toFixed(2)} · Casilla +{d.quality / 100}% · Extra +
                      {d.additional / 100}%
                    </em>
                  </span>
                  <b>{(d.final / 100).toFixed(2)}</b>
                </div>
              ))}
              {report.substitutions.map((sub, i) => (
                <p className="hint" key={i}>
                  {sub.manual ? 'Cambio manual' : 'Cambio automático'}:{' '}
                  {state.players.find((p) => p.id === sub.out)?.name} →{' '}
                  {state.players.find((p) => p.id === sub.in)?.name}
                </p>
              ))}
            </div>
          </Section>
        </>
      )}
      <Section title="Clasificación de la jornada">
        <div className="card">
          {state.clubs
            .toSorted(
              (a, b) => (round.reports[b.id]?.points || 0) - (round.reports[a.id]?.points || 0),
            )
            .map((c, i) => (
              <div className="definition-row" key={c.id}>
                <span>
                  {i + 1}. {c.name}
                </span>
                <b>{((round.reports[c.id]?.points || 0) / 100).toFixed(2)} pts</b>
              </div>
            ))}
        </div>
      </Section>
    </>
  );
}
export function MuseumPage() {
  const { state, club } = useGame();
  const { clubId } = useParams();
  const target = state.clubs.find((c) => c.id === (clubId || club.id)) || club;
  const own = target.id === club.id;
  return (
    <>
      <PageTitle
        back
        eyebrow="LAS TEMPORADAS PASAN. EL LEGADO QUEDA."
        title="Un lugar en la historia"
        subtitle={target.name}
      />
      <div className="museum-hero">
        <Crest
          color={target.color}
          size={81}
          label={target.name
            .split(' ')
            .map((n) => n[0])
            .join('')}
        />
        <h2>{target.name}</h2>
        <p>{own ? 'Tu museo de recuerdos y victorias' : 'Museo público del club'}</p>
        <div className="museum-count">
          <Trophy size={21} />
          {target.trophies.length} hitos para recordar
        </div>
      </div>
      <Section title="La vitrina del club">
        {target.trophies.length ? (
          <div className="trophy-grid">
            {target.trophies.toReversed().map((t) => (
              <div className="trophy-card" key={t.id}>
                <Trophy size={37} />
                <Badge kind="gold">TEMPORADA {t.season}</Badge>
                <h3>{t.title}</h3>
                <p>{t.detail}</p>
              </div>
            ))}
          </div>
        ) : (
          <Empty title="Las grandes historias empiezan así" icon={Trophy}>
            Gana una jornada o completa un evento para conseguir tu primer trofeo.
          </Empty>
        )}
      </Section>
      <Section title="Radiografía del club">
        <div className="card">
          {[
            ['Puntos de temporada', (target.totalPoints / 100).toFixed(2)],
            ['Prestigio', target.resources.prestige],
            ['Fama', target.resources.fame],
            ['Estadio', `Nivel ${target.buildings.stadium}`],
            ['Patrimonio monetario', shortMoney(target.resources.money)],
          ].map(([k, v]) => (
            <div className="definition-row" key={k}>
              <span>{k}</span>
              <b>{v}</b>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
export function ArchivePage() {
  const { state } = useGame();
  return (
    <>
      <PageTitle back eyebrow="NADA SE OLVIDA" title="Archivo de temporadas" />
      {state.archives.length ? (
        state.archives.toReversed().map((a) => (
          <Section key={a.season} title={`Temporada ${a.season}`}>
            <div className="card">
              {a.ranking.map((c, i) => (
                <div className="definition-row" key={c.id}>
                  <span>
                    {i + 1}. {c.name}
                  </span>
                  <b>{(c.points / 100).toFixed(2)} pts</b>
                </div>
              ))}
            </div>
          </Section>
        ))
      ) : (
        <Empty title="La primera historia sigue en juego" icon={CalendarDays}>
          Al reiniciar una temporada, su clasificación quedará archivada aquí.
        </Empty>
      )}
    </>
  );
}
