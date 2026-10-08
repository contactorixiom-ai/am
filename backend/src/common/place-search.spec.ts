import { searchPlaces } from './place-search';

describe('searchPlaces', () => {
  const fetchMock = jest.fn();
  beforeAll(() => { global.fetch = fetchMock as unknown as typeof fetch; });
  beforeEach(() => fetchMock.mockReset());

  function respond(byHost: Record<string, unknown>) {
    fetchMock.mockImplementation(async (url: string) => {
      const host = Object.keys(byHost).find((h) => url.includes(h));
      return { ok: true, json: async () => (host ? byHost[host] : { features: [] }) };
    });
  }

  it('trouve une commune française hors catalogue avec ses coordonnées', async () => {
    respond({
      'api-adresse.data.gouv.fr': {
        features: [{ geometry: { coordinates: [5.0415, 47.3220] }, properties: { city: 'Dijon', postcode: '21000' } }],
      },
      'photon.komoot.io': {
        features: [
          { geometry: { coordinates: [5.04, 47.32] }, properties: { name: 'Dijon', countrycode: 'FR' } },
          { geometry: { coordinates: [-74, 40] }, properties: { name: 'Dijon', countrycode: 'US' } },
        ],
      },
    });
    const r = await searchPlaces('Dijon');
    expect(r).toEqual([
      { city: 'Dijon', postalCode: '21000', country: 'FR', latitude: 47.322, longitude: 5.0415, region: 'EU' },
    ]);
  });

  it('se limite à l\'Afrique quand on le demande', async () => {
    respond({
      'photon.komoot.io': {
        features: [{ geometry: { coordinates: [-16.93, 14.79] }, properties: { name: 'Thiès', countrycode: 'SN' } }],
      },
    });
    const r = await searchPlaces('Thiès', 'AFRICA');
    expect(r.map((p) => [p.city, p.country, p.region])).toEqual([['Thiès', 'SN', 'AFRICA']]);
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('data.gouv'))).toBe(false);
  });

  it('retombe sur le catalogue si les services sont injoignables', async () => {
    fetchMock.mockRejectedValue(new Error('réseau'));
    const r = await searchPlaces('Mars');
    expect(r.map((p) => p.city)).toContain('Marseille');
  });
});
