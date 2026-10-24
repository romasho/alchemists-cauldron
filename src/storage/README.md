# Persistence

`save.ts` saves unfinished runs and restores validated catalogue data in paused state. Missing, malformed and unavailable storage never throw into gameplay. New games replace unfinished saves; game over and Exit to Menu clear them. `leaderboard.ts` keeps a Top-10 per difficulty and preserves the original Medium storage key.
