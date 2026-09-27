import { MAX_DS, MAX_PENNIES, NPC_MAX_PENNIES_DEFAULT, NPC_MAX_PENNIES_MIN, NS } from "./constants.js";

const fields = foundry.data.fields;

/**
 * What a row on the scoreboard knows about itself. Characters and NPCs share
 * the shape; they differ in whether they are on the board by default and in
 * how many pennies they can hold (`maxPennies`), which is also the hand a
 * failed flip kills them with.
 *
 * In 14.365 a NumberField CLAMPS to its min and max when it is cleaned
 * (common/data/fields.mjs, NumberField._cleanType), so an out-of-range write
 * is rounded into range, not rejected; every writer still clamps before it
 * writes, so nothing on the board relies on that. The schema's
 * range is the larger hand for both types, so an NPC left over from a
 * bigger limit still loads; `prepareBaseData` folds it down to its own. The
 * stored number is kept, so raising the limit again gives the pennies back.
 */
export class PennyActorModel extends foundry.abstract.TypeDataModel {
  static ON_BOARD_INITIAL = true;
  static MAX_PENNIES = MAX_PENNIES;

  static defineSchema() {
    return {
      pennies: new fields.NumberField({
        required: true, nullable: false, integer: true, min: 1, max: MAX_PENNIES, initial: 1,
      }),
      dead: new fields.BooleanField({ initial: false }),
      onBoard: new fields.BooleanField({ initial: this.ON_BOARD_INITIAL }),
      challenge: new fields.SchemaField({
        ds: new fields.NumberField({ required: true, nullable: true, integer: true, min: 1, max: MAX_DS, initial: null }),
        issuedBy: new fields.StringField({ required: true, blank: true, initial: "" }),
        // Doubles as the challenge token: a flip that was rolled against an
        // older issuedAt is refused, which is what makes two owners safe.
        issuedAt: new fields.NumberField({ required: true, nullable: true, integer: true, initial: null }),
        // The token of the last challenge whose flip result was written here.
        // Set in the same write as the pennies, so the chat request can say
        // "flipped" the moment the board changes, with nothing else to wait for.
        resolved: new fields.NumberField({ required: true, nullable: true, integer: true, initial: null }),
      }),
    };
  }

  /**
   * For a few hours the Director could set the maximum DS as high as 10. A
   * challenge left pending above 5 from then is dropped on load, rather than
   * clamped to 5 and left pending at a DS nobody asked for, now that the DS
   * is fixed at 5 again. Only a full record is migrated: core also runs
   * migrations on the changes of an update (`partial`), and an update must
   * not be turned into a clear of the whole challenge; the field clamps the
   * number, as it does any other.
   * @override
   */
  static migrateData(source, options = {}) {
    const ds = source?.challenge?.ds;
    if (!options.partial && Number.isFinite(ds) && ds > MAX_DS) {
      source.challenge = { ...source.challenge, ds: null, issuedBy: "", issuedAt: null };
    }
    return super.migrateData(source, options);
  }

  get hasChallenge() {
    return this.challenge.ds !== null;
  }

  /** The most pennies this row can hold; a failure with this many is death. */
  get maxPennies() {
    return this.constructor.MAX_PENNIES;
  }

  get atMax() {
    return this.pennies >= this.maxPennies;
  }

  prepareBaseData() {
    super.prepareBaseData();
    this.pennies = Math.min(this.pennies, this.maxPennies);
  }
}

/** A player's character: on the board from the moment it is created, until the Director takes it off. */
export class CharacterModel extends PennyActorModel {
  static ON_BOARD_INITIAL = true;
}

/**
 * An NPC: on the board only when the Director puts it there. Its hand is the
 * Director's `npcMaxPennies` setting, one number for every NPC.
 */
export class NpcModel extends PennyActorModel {
  static ON_BOARD_INITIAL = false;

  get maxPennies() {
    let n = NPC_MAX_PENNIES_DEFAULT;
    try {
      n = Number(game.settings.get(NS, "npcMaxPennies"));
    } catch {
      // Not registered yet: the default stands.
    }
    return Number.isInteger(n) ? Math.clamp(n, NPC_MAX_PENNIES_MIN, MAX_PENNIES) : NPC_MAX_PENNIES_DEFAULT;
  }
}

export const ACTOR_DATA_MODELS = { character: CharacterModel, npc: NpcModel };
