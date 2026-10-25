import { ResourceAmount, ResourceHelp } from '../components/ResourceVisibility';
import { GameSelect } from '../components/GameSelect';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Wallet } from 'lucide-react';
import { useGame } from '../lib/api';
import { resourceName, shortMoney } from '../../shared/math';
import type { Resource } from '../../shared/types';
import { Empty, PageTitle, Section } from '../components/ui';
export default function FinancePage() {
  const { state, club, available } = useGame();
  const [filter, setFilter] = useState<Resource>('money'),
    [details, setDetails] = useState(false);
  const entries = state.ledger.filter((l) => l.clubId === club.id && l.resource === filter);
  const incomes = entries.filter((e) => e.amount > 0).reduce((n, e) => n + e.amount, 0),
    expenses = -entries.filter((e) => e.amount < 0).reduce((n, e) => n + e.amount, 0);
  return (
    <>
      <PageTitle
        eyebrow="CADA EURO TIENE UN PROPÓSITO"
        title="La salud de tu club"
        subtitle="Una cuenta. Todos tus recursos. Con los detalles que tú decidas consultar."
      />
      <div className="balance-card">
        <span className="eyebrow">TESORERÍA DEL CLUB</span>
        <strong>
          <ResourceAmount>{shortMoney(club.resources.money)}</ResourceAmount>
        </strong>
        <span>
          Disponible <ResourceAmount>{shortMoney(available)}</ResourceAmount>
        </span>
        <div>
          <Wallet size={16} />
          <span>
            Reservado en pujas:{' '}
            <ResourceAmount>{shortMoney(club.resources.money - available)}</ResourceAmount>
          </span>
        </div>
      </div>
      <div className="padded">
        <div className="finance-resources">
          {Object.entries(club.resources)
            .filter(([k]) => k !== 'money')
            .map(([key, n]) => (
              <button
                key={key}
                className={filter === key ? 'active' : ''}
                onClick={() => setFilter(key as Resource)}
              >
                <span>{resourceName[key as Resource]}</span>
                <b>
                  {['development', 'medals'].includes(key) ? (
                    <ResourceAmount>{n}</ResourceAmount>
                  ) : (
                    n
                  )}
                </b>
              </button>
            ))}
        </div>
      </div>
      <Section title="El flujo de tu temporada">
        <ResourceHelp />
        <div className="income-expense">
          <div>
            <ArrowDownLeft size={19} />
            <span>Ingresos de {resourceName[filter]}</span>
            <strong>
              <ResourceAmount>
                {filter === 'money' ? shortMoney(incomes) : incomes.toLocaleString('es-ES')}
              </ResourceAmount>
            </strong>
          </div>
          <div>
            <ArrowUpRight size={19} />
            <span>Gastos de {resourceName[filter]}</span>
            <strong>
              <ResourceAmount>
                {filter === 'money' ? shortMoney(expenses) : expenses.toLocaleString('es-ES')}
              </ResourceAmount>
            </strong>
          </div>
        </div>
      </Section>
      <Section eyebrow="LIBRO MAYOR AUDITABLE" title="Cada movimiento cuenta">
        <label>
          Recurso
          <GameSelect value={filter} onChange={(e) => setFilter(e.target.value as Resource)}>
            {Object.entries(resourceName).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </GameSelect>
        </label>
        {club.hideResources && (
          <button className="button secondary" onClick={() => setDetails(!details)}>
            {details ? 'Ocultar detalles' : 'Consultar detalles de movimientos'}
          </button>
        )}
        {(!club.hideResources || details) && (
          <div className="ledger-list">
            {entries.length ? (
              entries
                .toReversed()
                .slice(0, 120)
                .map((e) => (
                  <div className="ledger-row" key={e.id}>
                    <span className={`ledger-icon ${e.amount >= 0 ? 'credit' : 'debit'}`}>
                      {e.amount >= 0 ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}
                    </span>
                    <div className="grow">
                      <strong>{e.reason}</strong>
                      <span>
                        {new Date(e.at).toLocaleString('es-ES', {
                          timeZone: 'Europe/Madrid',
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        · Saldo {filter === 'money' ? shortMoney(e.balance) : e.balance}
                      </span>
                    </div>
                    <b className={e.amount >= 0 ? 'positive' : 'negative'}>
                      {e.amount > 0 ? '+' : ''}
                      {filter === 'money' ? shortMoney(e.amount) : e.amount}
                    </b>
                  </div>
                ))
            ) : (
              <Empty title="Sin movimientos de este recurso" />
            )}
          </div>
        )}
      </Section>
      <Section title="Compromisos pendientes">
        <div className="card">
          {state.loans
            .filter((l) => l.clubId === club.id && !l.settled)
            .map((l) => (
              <div className="definition-row" key={l.id}>
                <span>Devolución tras J{l.dueRound}</span>
                <strong>{shortMoney(l.repay)}</strong>
              </div>
            ))}
          {!state.loans.some((l) => l.clubId === club.id && !l.settled) && (
            <p>No tienes préstamos pendientes.</p>
          )}
          <Link to="/institution" className="text-link">
            Centro de financiación <ArrowRight size={14} />
          </Link>
        </div>
      </Section>
    </>
  );
}
