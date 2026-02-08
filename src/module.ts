import { ActorCreatorApplication } from "./applications"
import "./types";

import config from "./index.json" with { type: "json"};

Hooks.on("init", () => {
  (game as Record<string, unknown>).DuelystSprites = {
    ActorCreatorApplication,
  };
  (CONFIG as unknown as Record<string, unknown>).DuelystSprites = config;



})