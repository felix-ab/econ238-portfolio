"""Build nyc-homes/data/{tracts,factors,pins}.json from the research files in this folder.
Household CO2 per tract = driving (BTS LATCH weekday VMT, annualised, x EPA g/mile)
                        + home energy (ACS housing-type mix x EIA RECS 2020 Middle Atlantic use by type x eGRID / EPA factors)."""
import csv, json, sys, os, math, collections
H = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1]
FX = json.load(open(os.path.join(H, 'site_factors.json')))   # verified constants (see that file for sources)
RECS = json.load(open(os.path.join(H, 'recs_microdata_by_type.json')))['Middle Atlantic']

def f(x):
    try: return float(x)
    except: return None

# --- home energy CO2 by housing type and grid region (t/yr) ---
KG_PER_MMBTU = FX['fuel_kg_per_mmbtu']  # ng, fo, lp
def home_t(typ, region):
    r = RECS[typ]; lb_mwh = FX['egrid_lb_per_mwh'][region]
    elec = r['KWH'] / 1000 * lb_mwh * 0.453592 / 1000
    fuel = (r['BTUNG'] * KG_PER_MMBTU['ng'] + r['BTUFO'] * KG_PER_MMBTU['fo'] + r['BTULP'] * KG_PER_MMBTU['lp']) / 1000 / 1000
    return elec + fuel
TYPES = [('units_sfd', 'single_family_detached'), ('units_sfa', 'single_family_attached'), ('units_2_4', 'apartment_2_4_units'),
         ('units_5_19', 'apartment_5plus_units'), ('units_20plus', 'apartment_5plus_units'), ('units_mobile', 'mobile_home')]
NYC = {'36005', '36047', '36061', '36081', '36085'}
def region(county):
    if county in NYC or county == '36119': return 'NYCW'
    if county in ('36059', '36103'): return 'NYLI'
    if county.startswith('36'): return 'NYUP'
    if county.startswith('09'): return 'NEWE'
    return 'RFCE'

# --- driving: LATCH 2017 (2010 tracts) ---
latch = {}
for r in csv.DictReader(open(os.path.join(H, 'latch.csv'))):
    v = f(r['hh_vmt_weekday'])
    if v is not None: latch[r['geoid10']] = v
ANNUAL = FX['latch_annual_factor']; G_MI = FX['vehicle_g_co2_per_mile']

# --- NYC new homes since 2015 by 2020 tract (DCP Housing Database) ---
BORO = {'1': '36061', '2': '36005', '3': '36047', '4': '36081', '5': '36085'}
new = collections.Counter()
for r in csv.DictReader(open(os.path.join(H, 'nyc_new_units.csv'))):
    y, u, b = f(r['completion_year']), f(r['units_net']), r['bct2020']
    if y and y >= FX['new_units_since'] and u and u > 0 and b and len(b) == 7: new[BORO[b[0]] + b[1:]] += u

names = {}
for r in csv.DictReader(open(os.path.join(H, '2020_Gaz_counties_national.txt'), encoding='latin-1'), delimiter='\t'):
    names[r['GEOID']] = r['NAME'] + ', ' + {'36': 'NY', '34': 'NJ', '09': 'CT', '42': 'PA'}.get(r['GEOID'][:2], r['USPS'])
names.update({'36005': 'Bronx', '36047': 'Brooklyn', '36061': 'Manhattan', '36081': 'Queens', '36085': 'Staten Island'})

rows = list(csv.DictReader(open(os.path.join(H, 'tracts.csv')), ))
for r in rows: r['county'] = r['geoid'][:5]
cols = collections.defaultdict(list); vmt_missing = 0; county_vmt = collections.defaultdict(lambda: [0, 0])
for r in rows:  # county VMT fallback
    v = latch.get(r['geoid']) or latch.get(r['geoid'][:9] + '00'); hh = f(r['households']) or 0
    if v and hh: county_vmt[r['county']][0] += v * hh; county_vmt[r['county']][1] += hh
for r in rows:
    hh = f(r['households']) or 0
    if hh <= 0: continue
    geo = r['acs_geoid'] if r['state'].zfill(2) == '09' and r.get('acs_geoid') else r['geoid']
    v = latch.get(r['geoid']) or latch.get(r['geoid'][:9] + '00')
    if v is None:
        vmt_missing += 1; c = county_vmt[r['county']]; v = c[0] / c[1] if c[1] else None
    if v is None: continue
    vmt_year = v * ANNUAL
    # transit commuting: riders per household x round trip x work days x EPA kg CO2 per passenger-mile
    riders = (f(r['transit']) or 0) / hh; miles = (f(r['mean_commute_km']) or 0) * 0.621371
    ftr = riders * miles * 2 * FX['work_days'] * FX['transit_kg_per_pmi']['subway' if r['county'] in NYC else 'commuter_rail'] / 1000
    tot = sum((f(r[k]) or 0) for k, _ in TYPES) or 1
    fh = sum((f(r[k]) or 0) / tot * home_t(t, region(r['county'])) for k, t in TYPES)
    workers = f(r['workers']) or 0
    cols['geoid'].append(geo); cols['county'].append(r['county']); cols['nyc'].append(1 if r['in_nyc'] in ('1', 'True', 'true') else 0)
    cols['hh'].append(round(hh)); cols['workers'].append(round(workers)); cols['jobs'].append(round(f(r['jobs_nyc']) or 0))
    cols['young'].append(round(f(r['sa01']) or 0)); cols['low'].append(round((f(r['se01']) or 0) + (f(r['se02']) or 0)))
    cols['drive'].append(round(((f(r['drove_alone']) or 0) + (f(r['carpool']) or 0)) / workers, 3) if workers else 0); cols['km'].append(round(f(r['mean_commute_km']) or 0, 1)); cols['transit'].append(round((f(r['transit']) or 0) / workers, 3) if workers else 0)
    cols['vmt'].append(round(vmt_year)); cols['ft'].append(round(vmt_year * G_MI / 1e6 + ftr, 3)); cols['fh'].append(round(fh, 3))
    cols['land'].append(round(f(r['aland_km2']) or 0, 4)); cols['newUnits'].append(round(new.get(r['geoid'], 0)))
    cols['lat'].append(round(f(r['lat']), 4)); cols['lon'].append(round(f(r['lon']), 4))
cols['countyNames'] = {c: names.get(c, c) for c in set(cols['county'])}
json.dump(cols, open(os.path.join(OUT, 'tracts.json'), 'w'), separators=(',', ':'))

# apartment in a new NYC building: RECS 5+ units on the NYC grid
FX_site = dict(FX['site'])
FX_site['newApartmentHomeCO2'] = round(home_t('apartment_5plus_units', 'NYCW'), 3)
json.dump(FX_site, open(os.path.join(OUT, 'factors.json'), 'w'), indent=1, ensure_ascii=False)

# pins: county facts computed from the same data
idx = collections.defaultdict(list)
for i, c in enumerate(cols['county']): idx[c].append(i)
core = [i for i in range(len(cols['hh'])) if cols['nyc'][i] and cols['drive'][i] <= FX_site['coreDriveMax']]
core_f = sum((cols['ft'][i] + cols['fh'][i]) * cols['hh'][i] for i in core) / sum(cols['hh'][i] for i in core)
core_vmt = sum(cols['vmt'][i] * cols['hh'][i] for i in core) / sum(cols['hh'][i] for i in core)
pins = []
for c, views in FX['pin_counties']:
    ii = idx.get(c);
    if not ii: continue
    jobs = sum(cols['jobs'][i] for i in ii); hh = sum(cols['hh'][i] for i in ii)
    w = [cols['jobs'][i] for i in ii]; sw = sum(w) or 1
    F = sum((cols['ft'][i] + cols['fh'][i]) * wi for i, wi in zip(ii, w)) / sw
    vm = sum(cols['vmt'][i] * wi for i, wi in zip(ii, w)) / sw
    km = sum(cols['km'][i] * wi for i, wi in zip(ii, w)) / sw
    lat = sum(cols['lat'][i] * wi for i, wi in zip(ii, w)) / sw; lon = sum(cols['lon'][i] * wi for i, wi in zip(ii, w)) / sw
    nm = cols['countyNames'][c]; short = nm.split(',')[0]
    pins.append({'id': c, 'place': nm, 'lat': lat, 'lon': lon, 'views': views,
                 'title': f'{jobs:,.0f} NYC jobs',
                 'text': f'{jobs:,.0f} people living in {short} hold jobs in New York City, with a typical straight-line commute of {km:.0f} km. Their households drive about {vm:,.0f} miles a year and emit about {F:.1f} t of CO₂ from driving and home energy, against {core_f:.1f} t and {core_vmt:,.0f} miles for a household already living in the city’s car-light core.',
                 'source_label': 'Census LODES 2023 · BTS LATCH 2017 · EIA RECS 2020 · ACS 2020–24'})
pins += FX.get('policy_pins', [])
json.dump(pins, open(os.path.join(OUT, 'pins.json'), 'w'), indent=1, ensure_ascii=False)
print('tracts', len(cols['hh']), 'vmt fallback', vmt_missing, 'core F', round(core_f, 2), 'core vmt', round(core_vmt), 'apt CO2', FX_site['newApartmentHomeCO2'])
for t in ['single_family_detached', 'single_family_attached', 'apartment_2_4_units', 'apartment_5plus_units']:
    print(t, {r: round(home_t(t, r), 2) for r in FX['egrid_lb_per_mwh']})
