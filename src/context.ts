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

Hooks.on("getActorContextOptions", (app: foundry.applications.sidebar.tabs.ActorDirectory, entries: foundry.applications.ux.ContextMenu.Entry<HTMLLIElement>[]) => {
  entries.push({
    name: "DUELYSTSPRITES.CONTEXT.ASSIGN",
    icon: `<i class="fa-solid fa-user-pen"></i>`,
    callback: (li: HTMLLIElement) => {
      if (!li.dataset.entryId) return;
      const actor = game.actors?.get(li.dataset.entryId);
      if (!actor) return;

      let selectedUnit: Unit | undefined = undefined;

      UnitPresetBrowserApplication
        .browse()
        .then(unit => {
          if (unit) {
            selectedUnit = unit;
            return confirmOverrideSections(unit, actor);
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

          return actor.update(updates);
        })
        .catch(err => {
          console.error(err);
          if (err instanceof Error) ui.notifications?.error(err.message, { console: false, localize: true });
        });
    }
  })
});

