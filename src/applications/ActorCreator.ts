import { ActorCreatorContext, ActorCreatorConfiguration, ActorData } from "./types";

export class ActorCreatorApplication extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2<ActorCreatorContext, ActorCreatorConfiguration>) {

  static DEFAULT_OPTIONS = {
    window: {
      title: "DUELYSTSPRITES.ACTORCREATOR.TITLE",
      icon: "fa-solid fa-person",
      contentClasses: ["standard-form"]
    },
    position: { width: 600 },
    tag: "form",
    form: {
      closeOnSubmit: true,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      handler: ActorCreatorApplication.formHandler
    },
    closeOnSubmit: true,
    actions: {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      cancel: ActorCreatorApplication.Cancel,

    }
  }

  static PARTS: Record<string, foundry.applications.api.HandlebarsApplicationMixin.HandlebarsTemplatePart> = {
    "base": {
      template: `modules/${__MODULE_ID__}/templates/actorCreator.hbs`
    },
    footer: {
      template: `templates/generic/form-footer.hbs`
    }
  }

  static async Cancel(this: ActorCreatorApplication) {
    await this.close();
  }

  async getActorData(preset: string): Promise<ActorData> {
    const data: ActorData = {};
    const fileDir = `modules/${__MODULE_ID__}/assets/units/${preset}`;
    const picker = await foundry.applications.apps.FilePicker.implementation.browse("data", fileDir);

    const portrait = picker.files.find(file => file.endsWith("portrait.webp"));
    if (portrait) data.portrait = portrait;
    else data.portrait = `${fileDir}/idle.webp`;

    const insert = picker.files.find(file => file.endsWith("theatre-insert.webp"));
    if (insert) data.theatreInsert = insert;
    else data.theatreInsert = `${fileDir}/idle.gif`;

    const animConfig = picker.files.find(file => file.endsWith("SpriteAnimationConfig.json"));
    if (animConfig) {
      const configContent = await fetch(animConfig);
      const json = await configContent.json() as Record<string, unknown>;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      if (json) data.spriteAnimations = json as any;
    }

    return data;
  }


  static async formHandler(this: ActorCreatorApplication, event: Event | SubmitEvent, form: HTMLFormElement, formData: foundry.applications.ux.FormDataExtended) {
    const data = foundry.utils.expandObject(formData.object) as Record<string, unknown>;

    const fileDir = `modules/${__MODULE_ID__}/assets/units/${data.preset as string}`;
    const assetData = await this.getActorData(data.preset as string);

    const actorData = {
      name: data.name as string,
      img: assetData.portrait,
      type: data.type,
      ...(data.folder as string ? { folder: data.folder as string } : {}),
      prototypeToken: {
        texture: {
          src: `${fileDir}/idle.webm`
        }
      },
      flags: {
        "sprite-animations": assetData.spriteAnimations,
        "theatre": {
          baseinsert: assetData.theatreInsert ?? ""
        }
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await Actor.create(actorData as any);
  }


  protected async getPreviewImage(preset: string): Promise<string | undefined> {
    const picker = await foundry.applications.apps.FilePicker.implementation.browse("data", `modules/${__MODULE_ID__}/assets/units/${preset}`);
    // const portraitIndex = picker.files.findIndex(file => file.endsWith("portrait.webp"));
    // if (portraitIndex !== -1) return picker.files[portraitIndex];

    const idleIndex = picker.files.findIndex(file => file.endsWith("idle.webm"));
    if (idleIndex !== -1) return picker.files[idleIndex];

    return undefined;
  }

  protected async setPreviewImage(preset: string): Promise<void> {

    const picker = await foundry.applications.apps.FilePicker.implementation.browse("data", `modules/${__MODULE_ID__}/assets/units/${preset}`);

    const idleAnimation = picker.files.find(file => file.endsWith("idle.webm"));
    const animationConfig = picker.files.find(file => file.endsWith("SpriteAnimationConfig.json"));
    const theatreInsert = picker.files.find(file => file.endsWith("theatre-insert.webp"));

    const previewElement = this.element.querySelector(`[data-role="actor-preview"]`)
    if (previewElement && idleAnimation) previewElement.setAttribute("src", idleAnimation);

    const animationHint = this.element.querySelector(`[data-role="sprite-animation-hint"]`);
    if (animationHint instanceof HTMLElement) animationHint.style.display = animationConfig ? "block" : "none";

    const insertHint = this.element.querySelector(`[data-role="theatre-inserts-hint"]`);
    if (insertHint instanceof HTMLElement) {
      insertHint.style.display = theatreInsert ? "block" : "none";
      const link = insertHint.querySelector("a");
      if (link instanceof HTMLElement) link.dataset.tooltip = `<h3>${preset}</h3><img src="${theatreInsert}" style='width:512px'>`
    }

  }

  protected async _prepareContext(options: foundry.applications.api.ApplicationV2.RenderOptions): Promise<ActorCreatorContext> {
    const context = await super._prepareContext(options);

    const picker = await foundry.applications.apps.FilePicker.implementation.browse("data", `modules/${__MODULE_ID__}/assets/units`);
    const dirs = picker.dirs.map(dir => {
      const split = dir.split("/");
      return split[split.length - 1];
    });

    context.actorSelect = Object.fromEntries(dirs.map(dir => [decodeURI(dir), decodeURI(dir)]));

    context.actorTypeSelect = Object.fromEntries(
      (game?.documentTypes?.Actor ?? []).filter(key => key !== CONST.BASE_DOCUMENT_TYPE).map(key => [key, game.i18n?.localize(CONFIG.Actor.typeLabels[key]) ?? key])
    );

    // context.hasFolders = !!game.folders?.some(folder => folder.type === Actor.documentName)
    const actorFolders = game.folders?.filter(folder => folder.type === Actor.documentName) ?? [];
    context.hasFolders = actorFolders.length > 0;

    context.folderSelect = Object.fromEntries(
      (game.actors?._formatFolderSelectOptions() ?? []).map(data => [data.id, data.name])
    );

    context.buttons = [
      { action: "cancel", type: "button", icon: "fa-solid fa-times", label: game.i18n?.localize("Cancel") },
      { action: "create", type: "submit", icon: "fa-solid fa-check", label: game.i18n?.format("DOCUMENT.Create", { type: game.i18n?.localize("DOCUMENT.Actor") ?? "" }) ?? "" }
    ]

    return context;
  }

  protected async _onRender(context: ActorCreatorContext, options: foundry.applications.api.HandlebarsApplicationMixin.RenderOptions) {
    await super._onRender(context, options);

    const presetSelector = this.element.querySelector(`select[name="preset"]`);
    if (presetSelector instanceof HTMLSelectElement) {
      if (presetSelector.value)
        void this.setPreviewImage(presetSelector.value).catch(console.error);

      presetSelector.addEventListener("change", () => {
        void this.setPreviewImage(presetSelector.value).catch(console.error);
      })
    }
  }
}