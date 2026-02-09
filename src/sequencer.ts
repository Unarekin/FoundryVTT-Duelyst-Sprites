
import db from "./sequencer.json" with {type: "json"};

// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
(Hooks as any).on('sequencerReady', () => {
  Sequencer.Database.registerEntries("duelyst", db)
})