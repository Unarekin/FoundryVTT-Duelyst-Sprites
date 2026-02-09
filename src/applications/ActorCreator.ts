import { Unit } from "types";
import { ActorCreatorContext, ActorCreatorConfiguration } from "./types";
import { UnitPresetBrowserApplication } from "./UnitPresetBrowser"

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
      // eslint-disable-next-line @typescript-eslint/unbound-method
      presetBrowser: ActorCreatorApplication.PresetBrowser
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

  static async PresetBrowser(this: ActorCreatorApplication) {
    try {
      const preset = await UnitPresetBrowserApplication.browse();
      if (!preset) return;
      const selector = this.element.querySelector(`select[name="preset"]`);
      if (selector instanceof HTMLSelectElement) {
        selector.value = preset?.id ?? "";
        selector.dispatchEvent(new Event("change"));
      }

    } catch (err) {
      console.error(err);
      if (err instanceof Error) ui.notifications?.error(err.message, { console: false, localize: true });
    }
  }


  getActorData(preset: string): Unit | undefined {
    return CONFIG.DuelystSprites.units[preset] as Unit | undefined;
  }


  static async formHandler(this: ActorCreatorApplication, event: Event | SubmitEvent, form: HTMLFormElement, formData: foundry.applications.ux.FormDataExtended) {
    const data = foundry.utils.expandObject(formData.object) as Record<string, unknown>;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const assetData: Unit = CONFIG.DuelystSprites.units[data.preset as string];
    const fileDir = `modules/${__MODULE_ID__}/assets/units/${assetData.id}`;

    const actorData = {
      name: data.name as string,
      img: `${fileDir}/${assetData.portrait}`,
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
          baseinsert: `${fileDir}/${assetData.theatreInsert ?? ""}`
        }
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const actor = await Actor.create(actorData as any);
    if (actor?.sheet)
      await actor.sheet.render({ force: true })
  }


  protected getPreviewImage(preset: string): string | undefined {
    const data = CONFIG.DuelystSprites.units[preset] as Unit | undefined;
    if (!data) return;
    const idle = data.spriteAnimations.animations.find(anim => anim.name === "idle");
    return idle?.src;
  }

  protected setPreviewImage(preset: string): void {

    const data = CONFIG.DuelystSprites.units[preset] as Unit | undefined;

    const previewElement = this.element.querySelector(`[data-role="actor-preview"]`);
    if (!(previewElement instanceof HTMLElement)) return;
    const idleAnim = data?.spriteAnimations.animations.find(anim => anim.name === "idle");
    previewElement.setAttribute("src", idleAnim?.src ?? "");
    previewElement.style.display = data ? "block" : "none";
  }

  protected async _prepareContext(options: foundry.applications.api.ApplicationV2.RenderOptions): Promise<ActorCreatorContext> {
    const context = await super._prepareContext(options);

    const pickerClass = game.release?.isNewer("13") ? foundry.applications.apps.FilePicker.implementation : FilePicker;

    const picker = await pickerClass.browse("data", `modules/${__MODULE_ID__}/assets/units`);


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
        this.setPreviewImage(presetSelector.value);

      presetSelector.addEventListener("change", () => {
        this.setPreviewImage(presetSelector.value);
      })
    }
  }
}