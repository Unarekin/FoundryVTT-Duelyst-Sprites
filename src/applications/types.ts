import { AnimationConfig, MeshAdjustmentConfig } from "../../node_modules/SpriteAnimations/types/interfaces";

export interface ActorCreatorContext extends foundry.applications.api.ApplicationV2.RenderContext {
  actorSelect: Record<string, string>;
  actorTypeSelect: Record<string, string>;
  hasFolders: boolean;
  folderSelect: Record<string, string>;
  buttons: foundry.applications.api.ApplicationV2.FormFooterButton[];
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ActorCreatorConfiguration extends foundry.applications.api.ApplicationV2.Configuration {

}

export interface ActorData {
  theatreInsert?: string;
  portrait?: string;
  spriteAnimations?: {
    animations: AnimationConfig[],
    meshAdjustments: MeshAdjustmentConfig
  }
}
