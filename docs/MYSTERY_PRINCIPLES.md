# What Makes a Good Mystery

The principles every MysteryTrove case is held to. Reference this when
writing or reviewing a mystery; the playtest gates
(docs/MYSTERY_STUDIO.md, `pnpm playtest --sweep`) encode the measurable
ones. CASE_AUTHORING.md covers *how* to express these in a definition;
this doc covers *what* to aim for.

## 1. The crime must matter

Stakes are relational, not absolute. A stolen skateboard carries a case
if it is the center of a kid's world; a murder falls flat if the victim
is a prop. The victim needs as much authoring as the suspects, even
though they never speak: who loved them, who feared them, who is
hurting now.

Test: name who is hurting because of this crime and what happens to
them if it is never solved. If there is no answer, the case has no
heart. The denouement must pay these stakes off, so the reveal lands as
a moral event, not a quiz answer.

## 2. The solution is a magic trick

The player watches everything happen and still cannot explain it. Not
knowing gnaws; the desire to KNOW is the engine of the game.

Two obligations come with the trick:

- **The reveal must be checkable.** Fair play means misdirection is
  attention management, never information hiding. After the reveal,
  the player replays the case in their head and sees that every clue
  was on the table. "Ah, of course" is the sound of a trick honestly
  performed. A solution that depends on facts the player could not
  have reached is not a mystery, it is a lie.
- **The solution is underdetermined at the start.** The opening scene
  must not contain enough to explain itself. The detective's job is to
  find the missing details and context; without them there is simply
  not enough information for a solution. If the opening supports a
  complete accusation, the case is broken (this is exactly what the
  first Blackwood playtests exposed).

Pacing corollary: early discoveries should widen the mystery (new
questions), late discoveries should narrow it (answers). If questions
never widen, the case solves too fast and feels thin.

## 3. Every suspect must remain plausibly suspectable

Multiple suspects is not a headcount, it is a property each character
must earn. A good player treats everyone as a possibility; the case has
to reward that instinct by giving suspicion somewhere to live on each
of them.

Suspicion does not require lying. Only the villain *must* deceive.
Every other suspect stays suspectable through some honest route:

- motive without deed (they wanted it, they did not do it)
- opportunity without alibi (truthful, but cannot prove where they were)
- unexplained behavior (the wet shoes have an innocent reason the
  player has not found yet)
- reluctance (withholding something embarrassing, which reads as guilt)
- the villain's staging pointing at them (the frame)

Each suspect needs an authored answer to two questions: *why would
suspicion fall on this person?* and *what can the player discover that
resolves it?* Resolving a suspicion should feel like a mini-solve,
whether it exonerates or condemns. A character with no possible
suspicion and no resolution path is dead weight in the cast.

## 4. Deflection: the staged story vs the true story

A great mystery contains two authored stories:

- the **true story**: what actually happened (`solution`, `canon`)
- the **staged story**: what the villain arranged the scene to look
  like — an accident, a burglary, a different culprit

Villains are smart. They know how things will look, so they set things
up to look like something else. The detective's real work is noticing
the seams where reality poked through the villain's script. That is
what a clue *is*: a contradiction between the two stories. The wet
boot print matters because the staged story says nobody came through
the east door.

Write the staged story explicitly before writing clues. Every clue
should answer: which story does this belong to, and which seam does it
expose?

## 5. It is a battle of wits — and the villain can keep playing

The real contest is player versus villain; the player just does not
know who the opponent is yet. On this platform the villain does not
have to finish deceiving before turn one: they can act *during* the
investigation — nudge suspicion toward the patsy, destroy evidence,
get nervous as the player closes in. Use beats, clocks, and
world-to-player effects for this. The single most satisfying moment
the medium can produce is catching the villain in the act of
deflecting.

## 6. Reversals

The natural first suspect should usually be wrong — but the player
must *travel* through suspecting them. Wrong, then right, is the
heartbeat of a mystery; wrong, right, wrong again is even better when
the case can support it. And periodically, let the obvious suspect
really be guilty ("it truly was his political opponent") so players
can never meta-game the genre itself.

## 7. Knowing is not proving

The mid-game sweet spot is a player who is 80% sure who did it and
cannot make it stick. Engagement peaks at confrontation, so design for
that gap: the *who* should become suspectable well before the *how*
and *why* become provable. The accuse gate presses on the player's own
stated gaps ("And how was it done, Inspector?"); the content must make
chasing those gaps worthwhile.

## 8. Obligations of the interactive medium

Novels only need the detective to be clever. Here the player IS the
detective, so:

- **Deduction is performable.** Clues are presented as physical
  observations; the game never states what a clue implies. The player
  does the connecting, or there is no satisfaction to be had.
- **Multiple valid investigation orders.** Any reasonable approach
  (rooms first, people first, victim first) must make progress. Never
  gate the case on reading the author's mind.
- **Pacing bands are design targets.** Too fast cheats the itch; too
  long kills momentum. Declare them per case (`meta.playtest`) and
  hold the case to them with playtest sweeps.
- **Endings honor effort.** Earned solves, lucky guesses, partial
  cases, and failures each deserve distinct endings that acknowledge
  how the player got there.

## Author's checklist

Before publishing, answer honestly:

1. Who hurts because of this crime, and does the player feel it?
2. Can the opening scene alone justify a full accusation? (It must not.)
3. Does every suspect have a reason suspicion falls on them AND a
   discoverable resolution for it?
4. What is the staged story? Which clue exposes each seam in it?
5. Does the villain act during the investigation, at least once?
6. Where is the reversal — what belief does the player hold at mid-game
   that turns out wrong?
7. After the reveal, could the player replay the case and see every
   clue was available? (No withheld information.)
8. Do the playtest gates pass — pacing band, evidence coverage, no
   leaks, fun median?

## How the platform encodes these

| Principle | Mechanism |
|---|---|
| Crime matters | victim authoring, briefing stakes, denouement templates |
| Checkable reveal | fair-play engine: sealed solution, default-deny knowledge, closed world |
| Underdetermined opening | rubric facets gated behind discovery; de-guessed matchHints |
| Suspectable suspects | per-character knowledge ladders, gates (`requiresEvidenceIds`, trust, willingness) |
| Staged story | authored beats + planted evidence (deception layer: candidate schema addition) |
| Villain keeps playing | beats, clocks, world→player effects reacting to `accused_*` / progress flags |
| Knowing ≠ proving | accuse gate with `missing` gaps; `identity_plus_one`+ policies |
| Deduction performable | performer rule 9b: observations, never conclusions |
| Pacing bands | `meta.playtest` targets + `pnpm playtest --sweep` gates |
