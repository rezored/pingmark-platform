# @pingmark/sdk

Parse, format and reason about **Pingmark** spatial mentions.

`@` names a person, `#` names a topic, `!@` names a place.

```bash
npm install @pingmark/sdk
```

## Find mentions in text

```ts
import { extractMentions } from '@pingmark/sdk';

extractMentions('Meet me at !@42.6977,23.3219, I am around !@~ (not Pass!@#)');
// [
//   { kind: 'point', lat: 42.6977, lon: 23.3219, precision: 'exact', source: 'token', raw: '!@42.6977,23.3219', index: 11 },
//   { kind: 'here',  precision: 'area', raw: '!@~', index: 42 }
// ]
```

It recognises:

| Form | Example |
|---|---|
| Inline token | `!@42.6977,23.3219`, optionally with `/timestamp` |
| Precision markers | `!@~` (~1 km), `!@~~` (~10 km) |
| Bare "where I am" | `!@`, `!@~`, `!@~~` |
| Resolver links | `https://pingmark.me/42.6977/23.3219` |
| `geo:` URIs (RFC 5870) | `geo:42.6977,23.3219;u=30` |

A token must stand alone, at the start of the text or after whitespace or opening punctuation. `Pass!@#` and `hey!@john` are ignored.

## Privacy levels

```ts
import { coarsen, formatToken } from '@pingmark/sdk';

const p = coarsen({ lat: 42.697712, lon: 23.321934 }, 'area'); // { lat: 42.7, lon: 23.32 }
formatToken(p, 'area'); // '!@~42.7,23.32'
```

| Level | Radius | Token |
|---|---|---|
| `exact` | ~1 m | `!@` (4+ decimals) |
| `street` | ~100 m | `!@` (3 decimals) |
| `area` | ~1 km | `!@~` |
| `city` | ~10 km | `!@~~` |

A token without `~` is never read as more precise than its digits: `!@43.123,25.654` is `street`, and `formatToken` keeps trailing zeros (`!@43.120,25.654`) so the level survives a round trip.

## Geometry and links

```ts
import { distanceMeters, bearingDegrees, compassDirection, toURL, toGeoURI } from '@pingmark/sdk';

distanceMeters({ lat: 42.6977, lon: 23.3219 }, { lat: 43.0842, lon: 25.655 }); // ≈ 194 862
compassDirection(bearingDegrees(a, b)); // 'E'
toURL({ lat: 42.6977, lon: 23.3219 });  // 'https://map.pingmark.me/42.6977/23.3219'
toGeoURI({ lat: 42.6977, lon: 23.3219 }); // 'geo:42.6977,23.3219'
```

## License

MIT © Kalin Dimitrov. Protocol paper: [arXiv:2510.09672](https://doi.org/10.48550/arXiv.2510.09672).
