import { FX } from "types";
import { Unit, Faction } from "../types";


declare module '*.scss';

declare global {

  declare const __DEV__: boolean;
  declare const __MODULE_TITLE__: string;
  // declare const __MODULE_ID__: string;
  const __MODULE_ID__ = "duelyst-sprites";
  declare const __MODULE_VERSION__: string;


  interface CONFIG {
    DuelystSprites: {
      units: Record<string, Unit>,
      factions: Record<number, Faction>,
      fx: Record<string, FX>
    }
  }
}