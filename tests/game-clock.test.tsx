// @vitest-environment jsdom
import { act, render, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { GameClock, remainingTime, useServerNow } from '../src/components/GameClock';
function ReadClock() {
  return <span data-testid="clock">{remainingTime(100000, useServerNow())}</span>;
}
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it('un solo ticker interpola el reloj del servidor, comparte el tiempo y se resincroniza', () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'performance'] });
  const view = render(
    <GameClock now={10000}>
      <ReadClock />
      <ReadClock />
    </GameClock>,
  );
  expect(view.getAllByTestId('clock').map((el) => el.textContent)).toEqual([
    '00:01:30',
    '00:01:30',
  ]);
  expect(vi.getTimerCount()).toBe(1);
  act(() => vi.advanceTimersByTime(5000));
  expect(view.getAllByTestId('clock').map((el) => el.textContent)).toEqual([
    '00:01:25',
    '00:01:25',
  ]);
  view.rerender(
    <GameClock now={25000}>
      <ReadClock />
      <ReadClock />
    </GameClock>,
  );
  expect(view.getAllByTestId('clock').map((el) => el.textContent)).toEqual([
    '00:01:15',
    '00:01:15',
  ]);
  view.unmount();
  expect(vi.getTimerCount()).toBe(0);
  expect(remainingTime(100, 200)).toBe('00:00:00');
});
