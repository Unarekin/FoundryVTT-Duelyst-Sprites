import { DeepPartial, Faction, Unit } from "types";
import { TypeContext, UnitContext, UnitPresetConfiguration, UnitPresetContext } from "./types";


// export class ActorCreatorApplication extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2<ActorCreatorContext, ActorCreatorConfiguration>) {

export class UnitPresetBrowserApplication extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2<UnitPresetContext, UnitPresetConfiguration>) {
  public static PARTS: Record<string, foundry.applications.api.HandlebarsApplicationMixin.HandlebarsTemplatePart> = {
    main: {
      template: `modules/${__MODULE_ID__}/templates/presetBrowser.hbs`
    },
    footer: {
      template: `templates/generic/form-footer.hbs`
    }
  }

  public static DEFAULT_OPTIONS: DeepPartial<UnitPresetConfiguration> = {
    window: {
      title: "DUELYSTSPRITES.PRESETBROWSER.TITLE",
      icon: "fa-solid fa-person",
      contentClasses: ["standard-form"]
    },
    form: {
      closeOnSubmit: true
    },
    position: {
      width: 725
    },
    actions: {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      cancel: UnitPresetBrowserApplication.Cancel,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      confirm: UnitPresetBrowserApplication.Confirm
    }
  }

  // eslint-disable-next-line no-unused-private-class-members
  #submitted = false;

  static async Confirm(this: UnitPresetBrowserApplication) {
    this.#submitted = true;
    await this.close();
  }

  static async Cancel(this: UnitPresetBrowserApplication) {
    this.#submitted = false;
    await this.close();
  }

  protected _onClose(options: foundry.applications.api.ApplicationV2.RenderOptions): void {
    super._onClose(options);
    if (this.#browseResolve) this.#browseResolve();
  }

  // #region Browse Promise

  #browsePromise: Promise<Unit | undefined> | undefined = undefined;
  #browseResolve: ((unit?: Unit) => void) | undefined = undefined;

  public async browse(): Promise<Unit | undefined> {
    if (!this.#browsePromise) {
      this.#browsePromise = new Promise(resolve => {
        this.#browseResolve = resolve;
      });
    }
    await this.render({ force: true });
    return this.#browsePromise;
  }

  static async browse(): Promise<Unit | undefined> {
    const browser = new UnitPresetBrowserApplication();
    return browser.browse();
  }

  // #endregion

  #currentFilters: Record<string, Record<string, boolean>> = {}

  protected getUnitTooltip(unit: Unit, key: string): string {
    const src = unit.spriteAnimations.animations.find(anim => anim.name === "idle")?.src ?? `modules/${__MODULE_ID__}/assets/units/${key}/${unit.icon}`;
    const vidPreview = src.endsWith(".webm") ? `<video src='${src}' width='512' autoplay muted loop></video>` : `<img src='${src}' width='512'>`;
    const faction = CONFIG.DuelystSprites.factions[unit.factionId] as Faction | undefined;
    const factionDesc = faction ? `<b>${faction.name}</b>` : '';

    return `
      <div class='toolclip themed theme-dark' style='text-align:center;'>
        ${vidPreview}
        <hr>
        <h4>${unit.name}</h4>
        ${factionDesc}
      </div>
    `;
  }

  protected getFilteredUnits(): UnitContext[] {
    return Object.entries(CONFIG.DuelystSprites.units)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .filter(([key, unit]: [string, Unit]) => {
        if (!this.#currentFilters.faction[unit.factionId]) return false;
        if (unit.type && !this.#currentFilters.type[unit.type]) return false;
        return true;
      }).map(([key, unit]: [string, Unit]) => ({
        id: key,
        src: `modules/${__MODULE_ID__}/assets/units/${key}/${unit.icon}`,
        label: unit.name,
        tooltip: this.getUnitTooltip(unit, key)
        // tooltip: `<h4>${unit.name}</h4><img src='${unit.spriteAnimations.animations.find(item => item.name === "idle")?.src ?? `modules/${__MODULE_ID__}/assets/units/${key}/${unit.icon}`}'>`
      })).sort((a, b) => a.label.localeCompare(b.label));
  }

  protected async _prepareContext(options: foundry.applications.api.ApplicationV2.RenderOptions): Promise<UnitPresetContext> {
    const context = await super._prepareContext(options);
    context.units = this.getFilteredUnits();

    context.unitTypes = (Object.values(CONFIG.DuelystSprites.units).reduce((prev: TypeContext[], curr: Unit) => {

      const index = prev.findIndex(item => item.value === curr.type);
      if (index === -1) {
        return [
          ...prev,
          {
            value: curr.type,
            label: game.i18n?.localize(`DUELYSTSPRITES.UNITTYPES.${curr.type.toUpperCase()}`) ?? "",
            filterEnabled: this.#currentFilters.type[curr.type]
          }
        ];
      } else {
        return prev;
      }

    }, []) as TypeContext[])
      .sort((a, b) => a.label.localeCompare(b.label))


    context.filters = foundry.utils.deepClone(this.#currentFilters);
    context.factions = Object.entries(CONFIG.DuelystSprites.factions).map(([key, value]: [string, Faction]) => ({
      ...value,
      id: parseInt(key),
      name: game.i18n?.localize(`DUELYSTSPRITES.FACTIONS.${value.abbr.toUpperCase()}`) ?? "",
      filterEnabled: this.#currentFilters.faction[key]
    }))
      .sort((a, b) => a.name.localeCompare(b.name));


    context.buttons = [
      { type: "button", label: "Cancel", action: "cancel" },
      { type: "submit", label: "Confirm", action: "confirm" }
    ];

    return context;
  }

  protected buildFilters() {
    // Build filters
    this.#currentFilters = {
      faction: Object.fromEntries(Object.keys(CONFIG.DuelystSprites.factions).map(key => [key, true])),
      type: {}
    };

    const unitTypes = Object.values(CONFIG.DuelystSprites.units).reduce((prev: string[], curr: Unit) => {
      if (curr.type && !prev.includes(curr.type)) return [...prev, curr.type];
      else return prev;
    }, [] as string[]) as string[];

    this.#currentFilters.type = Object.fromEntries(unitTypes.map(type => [type, true]));
  }

  async _onRender(context: UnitPresetContext, options: foundry.applications.api.ApplicationV2.RenderOptions) {
    await super._onRender(context, options);

    const filterElements: HTMLInputElement[] = Array.from(this.element.querySelectorAll(`[data-filter-type]:not([data-filter-type=""])`));
    for (const filterElement of filterElements) {
      filterElement.addEventListener("change", () => {
        const filterType = filterElement.dataset.filterType;
        const filterValue = filterElement.dataset.filterValue;
        if (filterType && filterValue) {
          this.#currentFilters[filterType][filterValue] = filterElement.checked;
        }
        void this.render();
      })
    }

  }

  constructor(options?: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    super(options);

    this.buildFilters();
  }
}