import { ActorCreatorApplication } from "./applications"
import "./sequencer";
import "./types";

// import config from "./index.json" with { type: "json"};

import units from "./index.units.json" with {type: "json"};
import fx from "./index.fx.json" with { type: "json"};
import factions from "./index.factions.json" with {type: "json"};

const config = {
  units,
  fx,
  factions
};

Hooks.on("init", () => {
  (game as Record<string, unknown>).DuelystSprites = {
    ActorCreatorApplication,
  };
  (CONFIG as unknown as Record<string, unknown>).DuelystSprites = config;



});