import { UnitPresetBrowserApplication } from "applications/UnitPresetBrowser";
import { Unit } from "types";

interface ActorOverrides {
  name: boolean;
  img: boolean;
  theatreInsert: boolean;
  spriteAnimations: boolean;
  tokenImage: boolean;
}


async function confirmOverrideSections(unit: Unit, actor: Actor): Promise<ActorOverrides> {
  const content = await foundry.applications.handlebars.renderTemplate(`modules/${__MODULE_ID__}/templates/assignActorConfirm.hbs`, {
    idPrefix: foundry.utils.randomID(),
    unit,
    actor
  });

  return foundry.applications.api.DialogV2.input({
    window: {
      title: "DUELYSTSPRITES.CONTEXT.ASSIGN",
      contentClasses: ["standard-form"]
    },
    content
  }) as unknown as ActorOverrides;
}

Hooks.on("renderCompendium", (compendium: foundry.applications.sidebar.apps.Compendium, html: HTMLElement) => {
  const listItems = Array.from<HTMLElement>(html.querySelectorAll(`li.entry.actor`));
  listItems.forEach(li => {
    const entryId = li.dataset.entryId;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const packId = (compendium as any).collection?.metadata?.id;

    if (typeof entryId === "string" && typeof packId === "string") {
      li.dataset.packId = packId;
    }
  })
});

Hooks.on("getActorContextOptions", (app: foundry.applications.sidebar.tabs.ActorDirectory, entries: foundry.applications.ux.ContextMenu.Entry<HTMLLIElement>[]) => {
  entries.push({
    name: "DUELYSTSPRITES.CONTEXT.ASSIGN",
    icon: `<i class="fa-solid fa-user-pen"></i>`,
    callback: (li: HTMLLIElement) => {
      if (!li.dataset.entryId) return;

      let actor: Actor | undefined = undefined;
      let selectedUnit: Unit | undefined = undefined;


      // const actor = game.actors?.get(li.dataset.entryId);

      (() => {
        if (li.dataset.packId)
          return fromUuid(`Compendium.${li.dataset.packId}.Actor.${li.dataset.entryId}`);
        else
          return Promise.resolve(game.actors?.get(li.dataset.entryId));
      })().then(item => {
        if (item) actor = item;
        if (!item) throw new Error("Actor not found");
        return UnitPresetBrowserApplication.browse()
      })
        .then(unit => {
          if (unit) {
            selectedUnit = unit;
            return confirmOverrideSections(unit, actor!);
          }
        })
        .then((overrides?: ActorOverrides | null) => {
          if (!overrides) return;
          if (!selectedUnit) return;

          const dir = `modules/${__MODULE_ID__}/assets/units/${selectedUnit.id}`;

          const updates: Record<string, unknown> = {};
          // Name
          if (overrides.name)
            updates.name = selectedUnit.name;

          // Portrait image
          if (overrides.img)
            updates.img = `${dir}/${selectedUnit.portrait}`;

          // Token image
          if (overrides.tokenImage)
            foundry.utils.setProperty(updates, "prototypeToken.texture.src", `${dir}/idle.webm`);

          if (overrides.theatreInsert && selectedUnit.theatreInsert)
            foundry.utils.setProperty(updates, "flags.theatre.baseinsert", `${dir}/${selectedUnit.theatreInsert}`);

          if (overrides.spriteAnimations)
            foundry.utils.setProperty(updates, "flags.sprite-animations", selectedUnit.spriteAnimations);

          return actor!.update(updates);
        })
        .catch(err => {
          console.error(err);
          if (err instanceof Error) ui.notifications?.error(err.message, { console: false, localize: true });
        });
    }
  })
});

