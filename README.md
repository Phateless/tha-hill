# Tha Hill — Broken Hill Everything Dashboard

> thahill.com.au · Passion project · Open to community contributions

A comprehensive community dashboard for Broken Hill, NSW. Everything about the Silver City in one place.

## Sections

| Section | Status | Live data source (planned) |
|---|---|---|
| Home overview | ✅ Built | BOM API, news RSS |
| Council Finance Audit | ✅ Built | BHCC Annual Reports, GIPA |
| Mining & Geology | ✅ Built | NSW DPIE MINVIEW, Geoscience Australia |
| Events Calendar | ✅ Built | Palace Cinemas scraper, council events |
| Real Estate | ✅ Built | realestate.com.au, domain.com.au |
| Weather & Climate | ✅ Built | BOM API (api.weather.bom.gov.au) |
| Water & Energy | ✅ Built | WaterNSW, SA Power Networks |
| Dust & Air Quality | ✅ Built | EPA NSW AQI API |
| Crime & Courts | ✅ Built | NSW Online Registry, NSW Police media |
| Buy/Swap/Sell | ✅ Built | Gumtree scraper + community form |
| Tourism & History | ✅ Built | Static + Trove |
| Film History | ✅ Built | IMDB datasets, Wikipedia |
| Local Radio | ✅ Built | Static |
| Oral History Archive | ✅ Built | Community submissions |
| Business Obituaries | ✅ Built | Community sourced |
| On This Day | ✅ Built | Trove API |

## Running locally

```bash
# No build step needed — open directly
open index.html

# Or serve with Python
python3 -m http.server 8080
# Visit: http://localhost:8080
```

## Deployment (GitHub Pages)

```bash
# 1. Push to GitHub
git init
git add .
git commit -m "Initial: Tha Hill dashboard"
git remote add origin https://github.com/YOUR_USERNAME/tha-hill.git
git push -u origin main

# 2. In GitHub Settings → Pages → Source: main branch
# Site will be live at: https://YOUR_USERNAME.github.io/tha-hill/
```

## Project structure

```
tha-hill/
├── index.html          # Main dashboard (all sections)
├── css/
│   └── style.css       # Complete design system
├── js/
│   └── main.js         # Navigation, charts, map, filters
├── data/               # (future) JSON data files
└── README.md
```

## Next build phase (Claude Code tasks)

### Python scrapers
```bash
# Install
pip install scrapy playwright requests beautifulsoup4 schedule

# Scrapers to build:
# scrapers/bom_weather.py        — BOM API current conditions
# scrapers/realestate_au.py      — realestate.com.au Broken Hill
# scrapers/gumtree.py            — Gumtree Broken Hill category
# scrapers/palace_cinema.py      — Palace Cinemas session times
# scrapers/nsw_police_media.py   — NSW Police media releases RSS
# scrapers/court_listings.py     — NSW Online Registry parser
# scrapers/council_annual.py     — BHCC Annual Report PDF parser
# scrapers/trove_api.py          — Trove "on this day" stories
# scrapers/epa_aqi.py            — EPA NSW air quality
# scrapers/waternsw.py           — WaterNSW lake levels
```

### Database (Postgres)
```sql
-- Key tables to build:
-- events, listings, council_spend, mine_operations,
-- court_listings, police_releases, oral_history,
-- business_obituaries, property_listings, aqi_readings
```

### APIs to integrate
| API | Data | Auth |
|---|---|---|
| api.weather.bom.gov.au | Weather, climate | Free |
| api.trove.nla.gov.au | Historical newspapers | Free key |
| portal.spatial.nsw.gov.au | MINVIEW mining data | Free |
| data.waternsw.com.au | Lake levels, flow | Free |
| airquality.environment.nsw.gov.au | AQI, PM2.5 | Free |
| maps.six.nsw.gov.au | Planning/cadastre | Free |

## Legal notes
- All data from public sources only
- Facebook group scraping NOT implemented (Meta ToS)
- Newspaper paywall bypass NOT implemented (copyright)
- Court listings exclude suppressed matters
- Crime section: officially published information only
- Privacy: no personal data stored without consent

## Branding
- Name: **Tha Hill**
- Domain suggestion: thahill.com.au
- Aesthetic: desert industrial — dark coal, rust orange, Bebas Neue
- Monetisation: Community/passion project. Tasteful banner ads if/when traffic warrants.

## Contributing
Community submissions welcome via the oral history and business obituary forms built into the site.
