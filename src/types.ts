import { AnimationConfig, MeshAdjustmentConfig } from "SpriteAnimations/types/interfaces";

export type IsObject<T> = T extends Readonly<Record<string, any>>
  ? T extends AnyArray | AnyFunction
  ? false
  : true
  : false;

/**
 * Recursively sets keys of an object to optional. Used primarily for update methods
 * @internal
 */
export type DeepPartial<T> = T extends unknown
  ? IsObject<T> extends true
  ? {
    [P in keyof T]?: DeepPartial<T[P]>;
  }
  : T
  : T;

export type AnyArray = readonly unknown[];
export type AnyFunction = (arg0: never, ...args: never[]) => unknown;

export const UnitTypes = ["general", "minion", ""] as const;
export type UnitType = typeof UnitTypes[number];

export interface Unit {
  description: string;
  factionId: number;
  icon: string;
  name: string;
  portrait: string;
  tags: string[];
  theatreInsert: string;
  type: UnitType;
  spriteAnimations: {
    animations: AnimationConfig[],
    meshAdjustments: MeshAdjustmentConfig
  }
}

export interface Faction {
  id: number;
  name: string;
  abbr: string;
  description: string;
}

