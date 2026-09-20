export interface BrushGroupOption {
  key: string;
  label: string;
}

export const MAP_BRUSH_GROUPS: Record<string, BrushGroupOption[]> = {
  'world.json': [
    { key: 'CONTINENT', label: 'Continent' },
    { key: 'REGION_WB', label: 'World Bank Region' },
    { key: 'SUBREGION', label: 'Subregion' },
    { key: 'REGION_UN', label: 'UN Region' },
    { key: 'INCOME_GRP', label: 'Income Group' },
    { key: 'ECONOMY', label: 'Economy Group' },
    { key: 'TYPE', label: 'Feature Type' },
    { key: 'NAME_LEN', label: 'Name Length' },
    { key: 'LONG_LEN', label: 'Long Length' },
    { key: 'ABBREV_LEN', label: 'Abbrev Length' },
  ],
  'world_adm1.json': [],
  'mappa_mundi_hoi4.json': [],
  'world_ecoregions.json': [
    { key: 'REALM', label: 'Realm' },
    { key: 'BIOME', label: 'Biome' },
  ]
};
