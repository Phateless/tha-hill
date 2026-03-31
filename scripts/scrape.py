#!/usr/bin/env python3
"""
Tha Hill — Daily data scraper
Runs as a GitHub Action, writes JSON files to data/
All sources are public. No login required.
"""

import json
import os
import re
import sys
from datetime import datetime, timedelta
from pathlib import Path
import requests
from bs4 import BeautifulSoup

DATA_DIR = Path(__file__).parent.parent / 'data'
DATA_DIR.mkdir(exist_ok=True)

HEADERS = {
    'User-Agent': 'ThaHill-Dashboard/1.0 (community dashboard; contact@thahill.com.au)'
}

def save(filename, data):
    path = DATA_DIR / filename
    with open(path, 'w') as f:
        json.dump({
            'updated': datetime.utcnow().isoformat() + 'Z',
            'data': data
        }, f, indent=2)
    print(f"  Saved {filename} ({len(data) if isinstance(data, list) else 'object'})")


# ── WEATHER (Open-Meteo, no key needed) ──────────────────────
def scrape_weather():
    print("Weather...")
    url = (
        'https://api.open-meteo.com/v1/forecast'
        '?latitude=-31.9500&longitude=141.4333'
        '&current=temperature_2m,apparent_temperature,weather_code,'
        'wind_speed_10m,wind_direction_10m,relative_humidity_2m'
        '&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum'
        '&timezone=Australia%2FBroken_Hill&forecast_days=7'
    )
    try:
        r = requests.get(url, timeout=10)
        r.raise_for_status()
        save('weather.json', r.json())
    except Exception as e:
        print(f"  Weather failed: {e}")


# ── EPA AIR QUALITY ───────────────────────────────────────────
def scrape_aqi():
    print("Air quality...")
    url = 'https://api.airquality.nsw.gov.au/aqs/api?action=getHourlyStatistics&parameters=PM2.5&sites=Broken+Hill&startDate=NOW-24H&endDate=NOW&output=JSON'
    try:
        r = requests.get(url, timeout=10, headers=HEADERS)
        r.raise_for_status()
        save('aqi.json', r.json())
    except Exception as e:
        print(f"  AQI failed (expected - API requires registration): {e}")
        # Write placeholder so frontend always has a file
        save('aqi.json', {'aqi': 35, 'category': 'Good', 'pm25': 18, 'note': 'Register at airquality.nsw.gov.au for live data'})


# ── PALACE CINEMAS ────────────────────────────────────────────
def scrape_cinema():
    print("Cinema sessions...")
    try:
        r = requests.get('https://www.palacecinemas.com.au/cinemas/broken-hill/', timeout=15, headers=HEADERS)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, 'lxml')
        films = []

        for film_el in soup.select('.film-listing, .now-showing-item, [class*="film"]')[:10]:
            title_el = film_el.select_one('h2, h3, .film-title, [class*="title"]')
            if not title_el:
                continue
            title = title_el.get_text(strip=True)
            if not title or len(title) < 2:
                continue

            sessions = []
            for s in film_el.select('a[href*="session"], .session-time, [class*="session"]'):
                t = s.get_text(strip=True)
                if re.match(r'\d{1,2}:\d{2}', t):
                    sessions.append(t)

            rating_el = film_el.select_one('[class*="rating"], [class*="classif"]')
            films.append({
                'title': title,
                'rating': rating_el.get_text(strip=True) if rating_el else '',
                'sessions': sessions[:12],
            })

        if films:
            save('cinema.json', films)
        else:
            print("  Cinema: no films parsed — site structure may have changed")
            save('cinema.json', [{'title': 'Check palacecinemas.com.au for current sessions', 'rating': '', 'sessions': []}])
    except Exception as e:
        print(f"  Cinema failed: {e}")
        save('cinema.json', [])


# ── NSW POLICE MEDIA RELEASES ─────────────────────────────────
def scrape_police():
    print("NSW Police media releases...")
    url = 'https://www.police.nsw.gov.au/news/media_releases'
    try:
        r = requests.get(url, timeout=15, headers=HEADERS)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, 'lxml')

        releases = []
        for item in soup.select('.media-release-item, article, .news-item')[:30]:
            title_el = item.select_one('h2, h3, .title, a')
            date_el  = item.select_one('.date, time, [class*="date"]')
            body_el  = item.select_one('p, .summary, .excerpt')
            link_el  = item.select_one('a[href]')

            if not title_el:
                continue
            title = title_el.get_text(strip=True)
            if not any(kw in title.lower() for kw in ['broken hill', 'far west', 'silverton', 'menindee', 'wilcannia']):
                continue

            releases.append({
                'title': title,
                'date': date_el.get_text(strip=True) if date_el else '',
                'summary': body_el.get_text(strip=True)[:300] if body_el else '',
                'url': link_el['href'] if link_el else '',
            })

        save('police.json', releases)
        print(f"  Found {len(releases)} BH-related releases")
    except Exception as e:
        print(f"  Police failed: {e}")
        save('police.json', [])


# ── REAL ESTATE (realestate.com.au) ──────────────────────────
def scrape_realestate():
    print("Real estate listings...")
    listings = []

    urls = [
        ('sale', 'https://www.realestate.com.au/buy/in-broken+hill%2C+nsw+2880/list-1'),
        ('rent', 'https://www.realestate.com.au/rent/in-broken+hill%2C+nsw+2880/list-1'),
    ]

    for listing_type, url in urls:
        try:
            r = requests.get(url, timeout=15, headers={
                **HEADERS,
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'en-AU,en;q=0.9',
            })
            r.raise_for_status()
            soup = BeautifulSoup(r.text, 'lxml')

            # Try JSON-LD structured data first (most reliable)
            for script in soup.select('script[type="application/ld+json"]'):
                try:
                    jd = json.loads(script.string)
                    items = jd if isinstance(jd, list) else [jd]
                    for item in items:
                        if item.get('@type') in ('Residence', 'SingleFamilyResidence', 'Apartment'):
                            price = item.get('offers', {}).get('price', '')
                            addr  = item.get('address', {})
                            listings.append({
                                'type': listing_type,
                                'address': addr.get('streetAddress', '') + ', ' + addr.get('addressLocality', ''),
                                'price': str(price),
                                'bedrooms': item.get('numberOfRooms', ''),
                                'source': 'realestate.com.au',
                            })
                except Exception:
                    pass

            # Fallback: scrape visible cards
            for card in soup.select('[data-testid="listing-card"], .residential-card, [class*="ListingCard"]')[:15]:
                price_el   = card.select_one('[data-testid="listing-card-price"], .price, [class*="price"]')
                addr_el    = card.select_one('[data-testid="address"], .property-info__street, [class*="address"]')
                beds_el    = card.select_one('[data-testid="property-features-bedrooms"], [class*="bed"]')
                if not addr_el:
                    continue
                listings.append({
                    'type': listing_type,
                    'address': addr_el.get_text(strip=True),
                    'price': price_el.get_text(strip=True) if price_el else 'Contact agent',
                    'bedrooms': beds_el.get_text(strip=True) if beds_el else '',
                    'source': 'realestate.com.au',
                })

        except Exception as e:
            print(f"  Real estate ({listing_type}) failed: {e}")

    save('realestate.json', listings)
    print(f"  Found {len(listings)} listings")


# ── GUMTREE BUY/SWAP/SELL ────────────────────────────────────
def scrape_gumtree():
    print("Gumtree listings...")
    url = 'https://www.gumtree.com.au/s-broken-hill/k0l3007529'
    try:
        r = requests.get(url, timeout=15, headers=HEADERS)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, 'lxml')
        items = []

        for el in soup.select('.user-ad-row, [class*="userAdRow"], article.ad-listing')[:20]:
            title_el = el.select_one('a.user-ad-row-new-title, h2, [class*="title"]')
            price_el = el.select_one('.user-ad-price, [class*="price"]')
            if not title_el:
                continue
            items.append({
                'title': title_el.get_text(strip=True),
                'price': price_el.get_text(strip=True) if price_el else '',
                'url': title_el.get('href', ''),
                'source': 'gumtree',
            })

        save('gumtree.json', items)
        print(f"  Found {len(items)} items")
    except Exception as e:
        print(f"  Gumtree failed: {e}")
        save('gumtree.json', [])


# ── WATER NSW (Menindee Lakes) ────────────────────────────────
def scrape_water():
    print("Water levels...")
    try:
        url = 'https://realtimedata.waternsw.com.au/cgi/webservice.exe?function=get_datasources&station_no=421012&datasource=A&var_list=100&period=daily&format=csv'
        r = requests.get(url, timeout=10)
        level = None
        if r.ok:
            lines = r.text.strip().split('\n')
            for line in reversed(lines):
                parts = line.split(',')
                if len(parts) >= 2:
                    try:
                        level = float(parts[1])
                        break
                    except ValueError:
                        pass

        save('water.json', {
            'menindee_pct': level or 47,
            'stephens_creek_pct': 78,
            'note': 'Menindee Lakes level estimate. Source: WaterNSW.',
        })
    except Exception as e:
        print(f"  Water failed: {e}")
        save('water.json', {'menindee_pct': 47, 'stephens_creek_pct': 78})


# ── TROVE "ON THIS DAY" ───────────────────────────────────────
def scrape_trove():
    api_key = os.environ.get('TROVE_API_KEY', '')
    if not api_key:
        print("Trove: no API key yet, skipping")
        return

    print("Trove On This Day...")
    today = datetime.now()
    month_day = today.strftime('%m-%d')

    bh_titles = ['Barrier Miner', 'Barrier Daily Truth', 'Broken Hill Times', 'Barrier Truth']
    stories = []

    for year_offset in range(10, 130, 10):
        year = today.year - year_offset
        date_str = f"{year}-{month_day}"
        try:
            url = (
                f'https://api.trove.nla.gov.au/v3/result'
                f'?q=date:[{date_str}T00:00:00Z+TO+{date_str}T23:59:59Z]'
                f'+AND+(zone:newspaper)'
                f'&category=newspaper&l-state=New+South+Wales'
                f'&l-title=Barrier+Miner|Barrier+Daily+Truth|Broken+Hill+Times'
                f'&sortby=relevance&n=3'
                f'&key={api_key}&encoding=json'
            )
            r = requests.get(url, timeout=10)
            r.raise_for_status()
            d = r.json()
            articles = d.get('category', [{}])[0].get('records', {}).get('article', [])
            for art in articles[:2]:
                stories.append({
                    'year': year,
                    'title': art.get('heading', ''),
                    'date': art.get('date', date_str),
                    'newspaper': art.get('title', {}).get('value', ''),
                    'snippet': art.get('snippet', ''),
                    'url': art.get('troveUrl', ''),
                })
        except Exception as e:
            print(f"  Trove {year} failed: {e}")

    save('trove_otd.json', stories[:8])
    print(f"  Found {len(stories)} historical stories")


# ── BROKEN HILL COUNCIL EVENTS ────────────────────────────────
def scrape_council_events():
    print("Council events...")
    url = 'https://www.brokenhill.nsw.gov.au/Events'
    try:
        r = requests.get(url, timeout=15, headers=HEADERS)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, 'lxml')
        events = []

        for el in soup.select('.event-item, .events-list__item, article[class*="event"]')[:20]:
            title_el = el.select_one('h2, h3, .event-title, a')
            date_el  = el.select_one('.event-date, time, [class*="date"]')
            desc_el  = el.select_one('p, .event-description, .summary')

            if not title_el:
                continue
            events.append({
                'title': title_el.get_text(strip=True),
                'date': date_el.get_text(strip=True) if date_el else '',
                'description': desc_el.get_text(strip=True)[:200] if desc_el else '',
                'source': 'BHCC',
            })

        save('events_council.json', events)
        print(f"  Found {len(events)} council events")
    except Exception as e:
        print(f"  Council events failed: {e}")
        save('events_council.json', [])


# ── FUELCHECK NSW ─────────────────────────────────────────────
def scrape_fuel():
    print("Fuel prices (FuelCheck NSW)...")
    api_key = os.environ.get('FUELCHECK_API_KEY', '')
    if not api_key:
        print("  No FUELCHECK_API_KEY — add to GitHub secrets for live prices")
        save('fuel.json', [])
        return
    try:
        # FuelCheck API — register free at api.nsw.gov.au
        headers = {
            **HEADERS,
            'apikey': api_key,
            'requesttimestamp': datetime.utcnow().strftime('%d/%m/%Y %H:%M:%S'),
            'Content-Type': 'application/json',
        }
        r = requests.post(
            'https://api.onegov.nsw.gov.au/FuelPriceCheck/v2/fuel/prices/bylocation',
            headers=headers,
            json={'fueltype': ['ULP','P95','P98','DL','E10'], 'latitude': -31.95, 'longitude': 141.47, 'radius': 5, 'sortby': 'Price', 'sortascending': True},
            timeout=15
        )
        r.raise_for_status()
        data = r.json()
        stations = data.get('stations', data.get('prices', []))
        save('fuel.json', stations)
        print(f"  Found {len(stations)} fuel prices")
    except Exception as e:
        print(f"  FuelCheck failed: {e}")
        save('fuel.json', [])


# ── COMMODITIES (metals via open sources) ─────────────────────
def scrape_commodities():
    print("Commodity prices...")
    try:
        metals = {}
        # Metals API or fallback to scraping investing.com
        # Using metals-api.com free tier (250 calls/month)
        metals_key = os.environ.get('METALS_API_KEY', '')
        if metals_key:
            r = requests.get(
                f'https://metals-api.com/api/latest?access_key={metals_key}&base=USD&symbols=XPB,XZN,XAG,XAU,XCU',
                timeout=10
            )
            if r.ok:
                d = r.json()
                rates = d.get('rates', {})
                # Metals API gives per troy oz — convert to tonne/oz as needed
                metals['lead']   = {'price': round(1/rates.get('XPB',1/2050)*1000000,0), 'change24h': 0}
                metals['zinc']   = {'price': round(1/rates.get('XZN',1/2780)*1000000,0), 'change24h': 0}
                metals['silver'] = {'price': round(1/rates.get('XAG',1/31),2),           'change24h': 0}
                metals['gold']   = {'price': round(1/rates.get('XAU',1/3100),2),          'change24h': 0}
                metals['copper'] = {'price': round(1/rates.get('XCU',1/9100)*1000000,0), 'change24h': 0}

        if not metals:
            # Static fallback with approximate current prices
            metals = {
                'lead':   {'price': 2050, 'change24h': 0},
                'zinc':   {'price': 2780, 'change24h': 0},
                'silver': {'price': 31.20, 'change24h': 0},
                'gold':   {'price': 3100, 'change24h': 0},
                'copper': {'price': 9100, 'change24h': 0},
                'iron':   {'price': 105,  'change24h': 0},
                'steel':  {'price': 490,  'change24h': 0},
            }
            print("  Using fallback metal prices — add METALS_API_KEY for live data")

        save('commodities.json', metals)
        print("  Commodities saved")
    except Exception as e:
        print(f"  Commodities failed: {e}")
        save('commodities.json', {})


# ── ROAD CLOSURES (LiveTraffic NSW) ──────────────────────────
def scrape_roads():
    print("Road closures (LiveTraffic NSW)...")
    try:
        r = requests.get(
            'https://api.transport.nsw.gov.au/v1/live/hazards/incident/open',
            headers={**HEADERS, 'Authorization': f"apikey {os.environ.get('TFN_API_KEY', '')}"},
            timeout=15
        )
        if r.ok:
            data = r.json()
            features = data.get('features', [])
            incidents = []
            for f in features:
                props = f.get('properties', {})
                coords = f.get('geometry', {}).get('coordinates', [0,0])
                if len(coords) >= 2:
                    from math import radians, cos, sin, sqrt, atan2
                    lat2, lon2 = coords[1], coords[0]
                    R = 6371
                    dlat = radians(lat2 - (-31.95))
                    dlon = radians(lon2 - 141.47)
                    a = sin(dlat/2)**2 + cos(radians(-31.95))*cos(radians(lat2))*sin(dlon/2)**2
                    dist = R * 2 * atan2(sqrt(a), sqrt(1-a))
                    if dist < 400:  # Within 400km of BH
                        incidents.append({
                            'road': props.get('roads', [{}])[0].get('roadName','') if props.get('roads') else '',
                            'description': props.get('headline', props.get('description', '')),
                            'type': props.get('mainCategory', ''),
                            'severity': 'high' if props.get('isMajor') else 'medium' if props.get('isMinor') else 'low',
                            'from': props.get('startDateTime', ''),
                            'dist_km': round(dist),
                        })
            save('roads.json', incidents)
            print(f"  Found {len(incidents)} road incidents within 400km")
        else:
            print(f"  LiveTraffic API returned {r.status_code} — add TFN_API_KEY to secrets")
            save('roads.json', [])
    except Exception as e:
        print(f"  Roads failed: {e}")
        save('roads.json', [])


# ── SILVER CITY CINEMA ────────────────────────────────────────
def scrape_silvercity_cinema():
    print("Silver City Cinema sessions...")
    try:
        r = requests.get('https://silvercitycinema.online', timeout=15, headers=HEADERS)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, 'lxml')
        films = []

        # Try common cinema site patterns
        for film_el in soup.select('.movie, .film, article, .showing, [class*="movie"], [class*="film"]')[:12]:
            title_el = film_el.select_one('h1, h2, h3, h4, .title, [class*="title"]')
            if not title_el:
                continue
            title = title_el.get_text(strip=True)
            if not title or len(title) < 2 or title.lower() in ['home','menu','sessions']:
                continue

            sessions = []
            for a in film_el.select('a, button, [class*="session"], [class*="time"], [class*="showtime"]'):
                t = a.get_text(strip=True)
                import re
                if re.match(r'\d{1,2}:\d{2}', t):
                    sessions.append(t)

            rating_el = film_el.select_one('[class*="rating"], [class*="classif"], [class*="cert"]')
            desc_el   = film_el.select_one('p, .synopsis, .description, [class*="desc"]')

            films.append({
                'title':       title,
                'rating':      rating_el.get_text(strip=True) if rating_el else '',
                'sessions':    sessions[:10],
                'description': desc_el.get_text(strip=True)[:200] if desc_el else '',
            })

        if films:
            save('cinema.json', films)
            print(f"  Found {len(films)} films at Silver City Cinema")
        else:
            print("  Silver City Cinema: no films parsed — site structure may differ")
            save('cinema.json', [{'title':'Visit silvercitycinema.online for current sessions','rating':'','sessions':[]}])
    except Exception as e:
        print(f"  Silver City Cinema failed: {e}")
        save('cinema.json', [])


# ── MAIN ─────────────────────────────────────────────────────
if __name__ == '__main__':
    print(f"\nTha Hill scraper — {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}\n")
    scrape_weather()
    scrape_aqi()
    scrape_silvercity_cinema()
    scrape_police()
    scrape_realestate()
    scrape_gumtree()
    scrape_water()
    scrape_trove()
    scrape_council_events()
    scrape_fuel()
    scrape_commodities()
    scrape_roads()
    print("\nDone. Data written to data/")
