import { searchAddresses } from './address-search';

describe('searchAddresses', () => {
  const fetchMock = jest.fn();
  beforeAll(() => { global.fetch = fetchMock as unknown as typeof fetch; });
  beforeEach(() => fetchMock.mockReset());

  it('France : adresse officielle (BAN) avec code postal et ville', async () => {
    fetchMock.mockImplementation(async (url: string) => ({
      ok: true,
      json: async () =>
        url.includes('api-adresse')
          ? { features: [
              { geometry: { coordinates: [4.83, 45.76] }, properties: { label: '12 Rue de la République 69002 Lyon', name: '12 Rue de la République', postcode: '69002', city: 'Lyon', type: 'housenumber' } },
              { geometry: { coordinates: [4.8, 45.7] }, properties: { label: 'Lyon', name: 'Lyon', type: 'municipality' } },
            ] }
          : { features: [] },
    }));
    const r = await searchAddresses('12 rue de la republique', 'FR', 'Lyon');
    expect(r).toEqual([{ label: '12 Rue de la République, 69002 Lyon', line: '12 Rue de la République', postalCode: '69002', city: 'Lyon', country: 'FR', latitude: 45.76, longitude: 4.83 }]);
    expect(String(fetchMock.mock.calls[0][0])).toContain(encodeURIComponent('12 rue de la republique Lyon'));
  });

  it('Afrique : OpenStreetMap, limité au pays demandé', async () => {
    fetchMock.mockImplementation(async () => ({
      ok: true,
      json: async () => ({ features: [
        { geometry: { coordinates: [-17.45, 14.7] }, properties: { street: 'Avenue Cheikh Anta Diop', housenumber: '5', city: 'Dakar', countrycode: 'SN', type: 'house' } },
        { geometry: { coordinates: [2, 6] }, properties: { street: 'Avenue Cheikh Anta Diop', city: 'Cotonou', countrycode: 'BJ', type: 'street' } },
      ] }),
    }));
    const r = await searchAddresses('5 avenue cheikh anta diop', 'SN');
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ line: '5 Avenue Cheikh Anta Diop', city: 'Dakar', country: 'SN', label: '5 Avenue Cheikh Anta Diop, Dakar' });
  });

  it('service indisponible : liste vide, la saisie libre reste possible', async () => {
    fetchMock.mockRejectedValue(new Error('timeout'));
    expect(await searchAddresses('3 place bellecour', 'FR')).toEqual([]);
  });
});
