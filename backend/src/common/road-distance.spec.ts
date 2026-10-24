import { roadDistanceKm } from './road-distance';

const PARIS = { latitude: 48.8566, longitude: 2.3522 };
const LYON = { latitude: 45.764, longitude: 4.8357 };

describe('roadDistanceKm', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
    delete process.env.ROUTING_URL;
  });

  it("reprend la distance de l'itinéraire routier", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: 'Ok', routes: [{ distance: 465_300 }] }),
    }) as unknown as typeof fetch;
    await expect(roadDistanceKm(PARIS, LYON)).resolves.toBe(465);
  });

  it("retombe sur l'estimation si le service ne répond pas", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('timeout')) as unknown as typeof fetch;
    const km = await roadDistanceKm({ latitude: 48.0, longitude: 2.0 }, { latitude: 45.0, longitude: 5.0 });
    expect(km).toBeGreaterThan(400);
  });

  it('ignore un itinéraire plus court que la ligne droite', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: 'Ok', routes: [{ distance: 10_000 }] }),
    }) as unknown as typeof fetch;
    const km = await roadDistanceKm({ latitude: 43.3, longitude: 5.4 }, { latitude: 47.2, longitude: -1.55 });
    expect(km).toBeGreaterThan(600);
  });

  it("n'appelle rien quand ROUTING_URL=off", async () => {
    process.env.ROUTING_URL = 'off';
    const spy = jest.fn();
    global.fetch = spy as unknown as typeof fetch;
    await roadDistanceKm({ latitude: 50.6, longitude: 3.06 }, { latitude: 44.8, longitude: -0.58 });
    expect(spy).not.toHaveBeenCalled();
  });
});
