import { ActorCreatorApplication } from "./applications"

Hooks.on("init", () => {
  (game as Record<string, unknown>).DuelystSprites = {
    ActorCreatorApplication
  }
})