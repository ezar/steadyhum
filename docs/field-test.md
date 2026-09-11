# Field test protocol

Manual protocol for the maker's own appliances (section 6.8). Runs once the
engine is wired up; the app's history and export are what make it reproducible.

## Setup

1. Pick two appliances with different acoustics, e.g. a washing machine and a
   fridge.
2. Note the phone position in the appliance's placement note, precisely enough
   to repeat it: shelf, height, orientation, distance.
3. Enroll each appliance: at least 3 sessions, at least 180 clean seconds,
   spread across different moments of the cycle.

## Two weeks of baseline

- One check per day per appliance, same position, same time of day where the
  machine's schedule allows.
- Record every verdict. A `Different` with the machine genuinely fine is a false
  positive; the target is under 1 per appliance per week.
- Answer the feedback chips honestly — that is what tunes the margin.

## Injected anomalies

Five checks per injection, each with the machine otherwise healthy:

| Injection                            | Expected                                                              |
| ------------------------------------ | --------------------------------------------------------------------- |
| A coin in the drum                   | `Slightly different` or `Different`, with a periodic-onset descriptor |
| A towel partly blocking a fan intake | `Slightly different` or `Different`                                   |
| Phone at double the usual distance   | Level guard message, capped at `Slightly different`                   |
| TV on in the same room               | `Unusable`, no verdict                                                |

Target: 4 of 5 caught for the first two rows.

## Recording results

Export each appliance's profile before and after the run and keep both JSON
files with the notes. Write the outcome up as a decision record if any threshold
or default in section 6 has to change.
