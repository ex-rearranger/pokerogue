import BattleScene, { Button } from "../battle-scene";
import PokemonSpecies, { allSpecies, getPokemonSpecies, speciesStarters as speciesStarterValues } from "../data/pokemon-species";
import { Species } from "../data/species";
import { TextStyle, addTextObject, getTextColor } from "./text";
import { Mode } from "./ui";
import MessageUiHandler from "./message-ui-handler";
import { Gender, getGenderColor, getGenderSymbol } from "../data/gender";
import { abilities } from "../data/ability";
import { GameMode } from "../game-mode";
import { Unlockables } from "../system/unlockables";
import { GrowthRate, getGrowthRateColor } from "../data/exp";
import { DexAttr, DexEntry } from "../system/game-data";
import * as Utils from "../utils";
import { Stat, getStatName } from "../data/pokemon-stat";

export type StarterSelectCallback = (starters: Starter[]) => void;

export interface Starter {
  species: PokemonSpecies;
  dexAttr: bigint;
  pokerus: boolean;
}

const ivChartSize = 24;
const ivChartStatCoordMultipliers = [ [ 0, 1 ], [ 0.825, 0.5 ], [ 0.825, -0.5 ], [ 0, -1 ], [ -0.825, -0.5 ], [ -0.825, 0.5 ] ];
const defaultIvChartData = new Array(12).fill(null).map(() => 0);

export default class StarterSelectUiHandler extends MessageUiHandler {
    private starterSelectContainer: Phaser.GameObjects.Container;
    private starterSelectGenIconContainers: Phaser.GameObjects.Container[];
    private pokemonNumberText: Phaser.GameObjects.Text;
    private pokemonSprite: Phaser.GameObjects.Sprite;
    private pokemonNameText: Phaser.GameObjects.Text;
    private pokemonGrowthRateLabelText: Phaser.GameObjects.Text;
    private pokemonGrowthRateText: Phaser.GameObjects.Text;
    private pokemonGenderText: Phaser.GameObjects.Text;
    private pokemonAbilityLabelText: Phaser.GameObjects.Text;
    private pokemonAbilityText: Phaser.GameObjects.Text;
    private instructionsText: Phaser.GameObjects.Text;
    private starterSelectMessageBoxContainer: Phaser.GameObjects.Container;
    private statsContainer: Phaser.GameObjects.Container;
    private ivChart: Phaser.GameObjects.Polygon;
    private ivStatValueTexts: Phaser.GameObjects.Text[];

    private genMode: boolean;
    private statsMode: boolean;
    private statsIvsCache: integer[];
    private dexAttrCursor: bigint = 0n;
    private genCursor: integer = 0;

    private genSpecies: PokemonSpecies[][] = [];
    private lastSpecies: PokemonSpecies;
    private speciesLoaded: Map<Species, boolean> = new Map<Species, boolean>();
    private starterGens: integer[] = [];
    private starterCursors: integer[] = [];
    private pokerusGens: integer[] = [];
    private pokerusCursors: integer[] = [];
    private starterAttr: bigint[] = [];
    private speciesStarterDexEntry: DexEntry;
    private canCycleShiny: boolean;
    private canCycleForm: boolean;
    private canCycleGender: boolean;
    private canCycleAbility: boolean;
    private value: integer = 0;

    private assetLoadCancelled: Utils.BooleanHolder;
    private cursorObj: Phaser.GameObjects.Image;
    private starterCursorObjs: Phaser.GameObjects.Image[];
    private pokerusCursorObjs: Phaser.GameObjects.Image[];
    private starterIcons: Phaser.GameObjects.Sprite[];
    private genCursorObj: Phaser.GameObjects.Image;
    private genCursorHighlightObj: Phaser.GameObjects.Image;
    private valueLimitLabel: Phaser.GameObjects.Text;
    private startCursorObj: Phaser.GameObjects.NineSlice;
    private starterValueLabels: Phaser.GameObjects.Text[];
    private shinyIcons: Phaser.GameObjects.Image[];

    private starterSelectCallback: StarterSelectCallback;
  
    constructor(scene: BattleScene) {
      super(scene, Mode.STARTER_SELECT);
    }
  
    setup() {
      const ui = this.getUi();
  
      this.starterSelectContainer = this.scene.add.container(0, -this.scene.game.canvas.height / 6);
      this.starterSelectContainer.setVisible(false);
      ui.add(this.starterSelectContainer);

      const bgColor = this.scene.add.rectangle(0, 0, this.scene.game.canvas.width / 6, this.scene.game.canvas.height / 6, 0x006860);
      bgColor.setOrigin(0, 0);
      this.starterSelectContainer.add(bgColor);

      const starterSelectBg = this.scene.add.image(1, 1, 'starter_select_bg');
      starterSelectBg.setOrigin(0, 0);
      this.starterSelectContainer.add(starterSelectBg);

      this.pokemonNumberText = addTextObject(this.scene, 17, 1, '000', TextStyle.SUMMARY);
      this.pokemonNumberText.setOrigin(0, 0);
      this.starterSelectContainer.add(this.pokemonNumberText);

      this.pokemonNameText = addTextObject(this.scene, 6, 112, '', TextStyle.SUMMARY);
      this.pokemonNameText.setOrigin(0, 0);
      this.starterSelectContainer.add(this.pokemonNameText);

      this.pokemonGrowthRateLabelText = addTextObject(this.scene, 8, 103, 'Growth Rate:', TextStyle.SUMMARY, { fontSize: '48px' });
      this.pokemonGrowthRateLabelText.setOrigin(0, 0);
      this.pokemonGrowthRateLabelText.setVisible(false);
      this.starterSelectContainer.add(this.pokemonGrowthRateLabelText);

      this.pokemonGrowthRateText = addTextObject(this.scene, 44, 103, '', TextStyle.SUMMARY_RED, { fontSize: '48px' });
      this.pokemonGrowthRateText.setOrigin(0, 0);
      this.starterSelectContainer.add(this.pokemonGrowthRateText);

      this.pokemonGenderText = addTextObject(this.scene, 96, 112, '', TextStyle.SUMMARY);
      this.pokemonGenderText.setOrigin(0, 0);
      this.starterSelectContainer.add(this.pokemonGenderText);

      this.pokemonAbilityLabelText = addTextObject(this.scene, 6, 126, 'Ability:', TextStyle.SUMMARY, { fontSize: '64px' });
      this.pokemonAbilityLabelText.setOrigin(0, 0);
      this.pokemonAbilityLabelText.setVisible(false);
      this.starterSelectContainer.add(this.pokemonAbilityLabelText);

      this.pokemonAbilityText = addTextObject(this.scene, 38, 126, '', TextStyle.SUMMARY, { fontSize: '64px' });
      this.pokemonAbilityText.setOrigin(0, 0);
      this.starterSelectContainer.add(this.pokemonAbilityText);

      const genText = addTextObject(this.scene, 115, 6, 'I\nII\nIII\nIV\nV', TextStyle.WINDOW);
      genText.setLineSpacing(16);
      this.starterSelectContainer.add(genText);

      this.starterSelectGenIconContainers = new Array(5).fill(null).map((_, i) => {
        const container = this.scene.add.container(149, 9);
        if (i)
          container.setVisible(false);
        this.starterSelectContainer.add(container);
        return container;
      });

      this.pokerusCursorObjs = new Array(3).fill(null).map(() => {
        const cursorObj = this.scene.add.image(0, 0, 'starter_select_cursor_pokerus');
        cursorObj.setVisible(false);
        cursorObj.setOrigin(0, 0);
        this.starterSelectContainer.add(cursorObj);
        return cursorObj;
      });

      this.starterCursorObjs = new Array(3).fill(null).map(() => {
        const cursorObj = this.scene.add.image(0, 0, 'starter_select_cursor_highlight');
        cursorObj.setVisible(false);
        cursorObj.setOrigin(0, 0);
        this.starterSelectContainer.add(cursorObj);
        return cursorObj;
      });

      this.cursorObj = this.scene.add.image(0, 0, 'starter_select_cursor');
      this.cursorObj.setOrigin(0, 0);
      this.starterSelectContainer.add(this.cursorObj);

      this.genCursorHighlightObj = this.scene.add.image(111, 5, 'starter_select_gen_cursor_highlight');
      this.genCursorHighlightObj.setOrigin(0, 0);
      this.starterSelectContainer.add(this.genCursorHighlightObj);

      this.genCursorObj = this.scene.add.image(111, 5, 'starter_select_gen_cursor');
      this.genCursorObj.setVisible(false);
      this.genCursorObj.setOrigin(0, 0);
      this.starterSelectContainer.add(this.genCursorObj);
      
      this.valueLimitLabel = addTextObject(this.scene, 124, 150, '0/10', TextStyle.TOOLTIP_CONTENT);
      this.valueLimitLabel.setOrigin(0.5, 0);
      this.starterSelectContainer.add(this.valueLimitLabel);

      const startLabel = addTextObject(this.scene, 124, 162, 'Start', TextStyle.TOOLTIP_CONTENT);
      startLabel.setOrigin(0.5, 0);
      this.starterSelectContainer.add(startLabel);

      this.startCursorObj = this.scene.add.nineslice(111, 160, 'starter_select_cursor', null, 26, 15, 1, 1, 1, 1);
      this.startCursorObj.setVisible(false);
      this.startCursorObj.setOrigin(0, 0);
      this.starterSelectContainer.add(this.startCursorObj);

      const starterSpecies: Species[] = [];
      
      for (let g = 0; g < this.starterSelectGenIconContainers.length; g++) {
        let s = 0;
        this.genSpecies.push([]);

        for (let species of allSpecies) {
          if (species.generation > 5)
            break;
          if (!speciesStarterValues.hasOwnProperty(species.speciesId) || species.generation !== g + 1)
            continue;
          starterSpecies.push(species.speciesId);
          this.speciesLoaded.set(species.speciesId, false);
          this.genSpecies[g].push(species);
          const defaultDexAttr = this.scene.gameData.getSpeciesDefaultDexAttr(species);
          const defaultProps = this.scene.gameData.getSpeciesDexAttrProps(species, defaultDexAttr);
          species.generateIconAnim(this.scene, defaultProps.female, defaultProps.formIndex);
          const x = (s % 9) * 18;
          const y = Math.floor(s / 9) * 18;
          const icon = this.scene.add.sprite(x, y, species.getIconAtlasKey(defaultProps.formIndex));
          icon.setScale(0.5);
          icon.setOrigin(0, 0);
          icon.play(species.getIconKey(defaultProps.female, defaultProps.formIndex)).stop();
          icon.setTintFill(0);
          this.starterSelectGenIconContainers[g].add(icon);
          s++;
        }
      }

      this.scene.anims.create({
        key: 'pkmn_icon__000',
        frames: this.scene.anims.generateFrameNames('pokemon_icons_0', { prefix: `000_`, zeroPad: 2, suffix: '.png', start: 1, end: 34 }),
        frameRate: 128,
        repeat: -1
      });

      this.starterIcons = new Array(3).fill(null).map((_, i) => {
        const icon = this.scene.add.sprite(115, 95 + 16 * i, 'pokemon_icons_0');
        icon.setScale(0.5);
        icon.setOrigin(0, 0);
        icon.play('pkmn_icon__000');
        this.starterSelectContainer.add(icon);
        return icon;
      });

      this.starterValueLabels = new Array(81).fill(null).map((_, i) => {
        const x = (i % 9) * 18;
        const y = Math.floor(i / 9) * 18;
        const ret = addTextObject(this.scene, x + 150, y + 11, '0', TextStyle.WINDOW, { fontSize: '32px' });
        ret.setShadowOffset(2, 2);
        ret.setOrigin(0, 0);
        ret.setVisible(false);
        this.starterSelectContainer.add(ret);
        return ret;
      });

      this.shinyIcons = new Array(81).fill(null).map((_, i) => {
        const x = (i % 9) * 18;
        const y = Math.floor(i / 9) * 18;
        const ret = this.scene.add.image(x + 161, y + 11, 'shiny_star');
        ret.setOrigin(0, 0);
        ret.setScale(0.5);
        ret.setVisible(false);
        this.starterSelectContainer.add(ret);
        return ret;
      });

      this.pokemonSprite = this.scene.add.sprite(53, 63, `pkmn__sub`);
      this.starterSelectContainer.add(this.pokemonSprite);

      this.instructionsText = addTextObject(this.scene, 4, 140, '', TextStyle.PARTY, { fontSize: '42px' });
      this.starterSelectContainer.add(this.instructionsText);

      this.starterSelectMessageBoxContainer = this.scene.add.container(0, this.scene.game.canvas.height / 6);
      this.starterSelectMessageBoxContainer.setVisible(false);
      this.starterSelectContainer.add(this.starterSelectMessageBoxContainer);

      const starterSelectMessageBox = this.scene.add.image(0, 0, 'starter_select_message');
      starterSelectMessageBox.setOrigin(0, 1);
      this.starterSelectMessageBoxContainer.add(starterSelectMessageBox);

      this.message = addTextObject(this.scene, 8, -8, '', TextStyle.WINDOW, { maxLines: 1 });
      this.message.setOrigin(0, 1);
      this.starterSelectMessageBoxContainer.add(this.message);

      const date = new Date();
      date.setUTCHours(0, 0, 0, 0);

      this.scene.executeWithSeedOffset(() => {
        for (let c = 0; c < 3; c++) {
          let randomSpeciesId: Species;
          let species: PokemonSpecies;
          let pokerusCursor: integer;

          const generateSpecies = () => {
            randomSpeciesId = Phaser.Math.RND.pick(starterSpecies);
            species = getPokemonSpecies(randomSpeciesId);
            pokerusCursor = this.genSpecies[species.generation - 1].indexOf(species);
          };
          
          let dupe = false;

          do {
            generateSpecies();

            for (let pc = 0; pc < c; pc++) {
              if (this.pokerusGens[pc] === species.generation -1 && this.pokerusCursors[pc] === pokerusCursor) {
                dupe = true;
                break;
              }
            }
          } while (dupe);

          this.pokerusGens.push(species.generation - 1);
          this.pokerusCursors.push(pokerusCursor);
          this.pokerusCursorObjs[c].setPosition(148 + 18 * (pokerusCursor % 9), 10 + 18 * Math.floor(pokerusCursor / 9));
        }
      }, 0, date.getTime().toString());

      this.statsContainer = this.scene.add.container(6, 16);

      const ivChartBgData = new Array(6).fill(null).map((_, i: integer) => [ ivChartSize * ivChartStatCoordMultipliers[i][0], ivChartSize * ivChartStatCoordMultipliers[i][1] ] ).flat();

      const ivChartBg = this.scene.add.polygon(48, 44, ivChartBgData, 0xd8e0f0, 0.625);
      ivChartBg.setOrigin(0, 0);

      const ivChartBorder = this.scene.add.polygon(ivChartBg.x, ivChartBg.y, ivChartBgData)
        .setStrokeStyle(1, 0x484050);
      ivChartBorder.setOrigin(0, 0);

      const ivChartBgLines = [ [ 0, -1, 0, 1 ], [ -0.825, -0.5, 0.825, 0.5 ], [ 0.825, -0.5, -0.825, 0.5 ] ].map(coords => {
        const line = new Phaser.GameObjects.Line(this.scene, ivChartBg.x, ivChartBg.y, ivChartSize * coords[0], ivChartSize * coords[1], ivChartSize * coords[2], ivChartSize * coords[3], 0xffffff)
          .setLineWidth(0.5);
        line.setOrigin(0, 0);
        return line;
      });

      this.ivChart = this.scene.add.polygon(ivChartBg.x, ivChartBg.y, defaultIvChartData, 0x98d8a0, 0.75);
      this.ivChart.setOrigin(0, 0);

      this.statsContainer.add(ivChartBg);
      ivChartBgLines.map(l => this.statsContainer.add(l));
      this.statsContainer.add(this.ivChart);
      this.statsContainer.add(ivChartBorder);

      this.ivStatValueTexts = [];

      new Array(6).fill(null).map((_, i: integer) => {
        const statLabel = addTextObject(this.scene, ivChartBg.x + (ivChartSize) * ivChartStatCoordMultipliers[i][0] * 1.325, ivChartBg.y + (ivChartSize) * ivChartStatCoordMultipliers[i][1] * 1.325 - 4, getStatName(i as Stat), TextStyle.TOOLTIP_CONTENT);
        statLabel.setOrigin(0.5);

        this.ivStatValueTexts[i] = addTextObject(this.scene, statLabel.x, statLabel.y + 8, '0', TextStyle.TOOLTIP_CONTENT);
        this.ivStatValueTexts[i].setOrigin(0.5)

        this.statsContainer.add(statLabel);
        this.statsContainer.add(this.ivStatValueTexts[i]);
      });

      this.statsContainer.setVisible(false);

      this.starterSelectContainer.add(this.statsContainer);

      this.updateInstructions();
    }
  
    show(args: any[]): void {
      if (args.length >= 1 && args[0] instanceof Function) {
        super.show(args);

        for (let g = 0; g < this.genSpecies.length; g++) {
          this.genSpecies[g].forEach((species, s) => {
            const dexEntry = this.scene.gameData.dexData[species.speciesId];
            const icon = this.starterSelectGenIconContainers[g].getAt(s) as Phaser.GameObjects.Sprite;
            if (dexEntry.caughtAttr)
              icon.clearTint();
          });
        }

        this.starterSelectCallback = args[0] as StarterSelectCallback;

        this.starterSelectContainer.setVisible(true);

        this.setGenMode(false);
        this.setCursor(0);
        this.setGenMode(true);
        this.setCursor(0);
      }
    }

    showText(text: string, delay?: integer, callback?: Function, callbackDelay?: integer, prompt?: boolean, promptDelay?: integer) {
      super.showText(text, delay, callback, callbackDelay, prompt, promptDelay);

      this.starterSelectMessageBoxContainer.setVisible(true);
    }
  
    processInput(button: Button): boolean {
      const ui = this.getUi();

      let success = false;
      let error = false;
  
      if (this.startCursorObj.visible) {
        switch (button) {
          case Button.ACTION:
            if (this.tryStart())
              success = true;
            else
              error = true;
            break;
          case Button.UP:
            this.startCursorObj.setVisible(false);
            this.setGenMode(true);
            success = true;
            break;
          case Button.RIGHT:
            this.startCursorObj.setVisible(false);
            this.setGenMode(false);
            success = true;
            break;
        }
      } else if (this.genMode) {
        switch (button) {
          case Button.UP:
            if (this.genCursor)
              success = this.setCursor(this.genCursor - 1);
            break;
          case Button.DOWN:
            if (this.genCursor < 4)
              success = this.setCursor(this.genCursor + 1);
            else {
              this.startCursorObj.setVisible(true);
              this.setGenMode(true);
              success = true;
            }
            break;
          case Button.RIGHT:
            success = this.setGenMode(false);
            break;
        }
      } else {
        if (button === Button.ACTION) {
          if (!this.speciesStarterDexEntry?.caughtAttr)
            error = true;
          else if (this.starterCursors.length < 3) {
            ui.setModeWithoutClear(Mode.OPTION_SELECT, 'Add to Party', () => {
              ui.setMode(Mode.STARTER_SELECT);
              let isDupe = false;
              for (let s = 0; s < this.starterCursors.length; s++) {
                if (this.starterGens[s] === this.genCursor && this.starterCursors[s] === this.cursor) {
                  isDupe = true;
                  break;
                }
              }
              const species = this.genSpecies[this.genCursor][this.cursor];
              if (!isDupe && this.tryUpdateValue(speciesStarterValues[species.speciesId])) {
                const cursorObj = this.starterCursorObjs[this.starterCursors.length];
                cursorObj.setVisible(true);
                cursorObj.setPosition(this.cursorObj.x, this.cursorObj.y);
                const defaultDexAttr = this.scene.gameData.getSpeciesDefaultDexAttr(species);
                const defaultProps = this.scene.gameData.getSpeciesDexAttrProps(species, defaultDexAttr);
                this.starterIcons[this.starterCursors.length].play(species.getIconKey(defaultProps.female, defaultProps.formIndex));
                this.starterGens.push(this.genCursor);
                this.starterCursors.push(this.cursor);
                this.starterAttr.push(this.dexAttrCursor);
                if (this.speciesLoaded.get(species.speciesId))
                  species.cry(this.scene);
                if (this.starterCursors.length === 3)
                  this.tryStart();
                this.updateInstructions();
                ui.playSelect();
              } else
                ui.playError();
            }, 'Toggle IVs', () => {
              this.toggleStatsMode();
              ui.setMode(Mode.STARTER_SELECT);
            });
            success = true;
          }
        } else if (button === Button.CANCEL) {
          if (this.statsMode) {
            this.toggleStatsMode(false);
            success = true;
          } else if (this.starterCursors.length) {
            this.popStarter();
            success = true;
            this.updateInstructions();
          }
        } else {
          const genStarters = this.starterSelectGenIconContainers[this.genCursor].getAll().length;
          const rows = Math.ceil(genStarters / 9);
          const row = Math.floor(this.cursor / 9);
          const props = this.scene.gameData.getSpeciesDexAttrProps(this.lastSpecies, this.dexAttrCursor);
          switch (button) {
            case Button.CYCLE_SHINY:
              if (this.canCycleShiny) {
                this.setSpeciesDetails(this.lastSpecies, !props.shiny, undefined, undefined, undefined);
                if (this.dexAttrCursor & DexAttr.SHINY)
                  this.scene.playSound('sparkle');
                else
                  success = true;
              }
              break;
            case Button.CYCLE_FORM:
              if (this.canCycleForm) {
                const formCount = this.lastSpecies.forms.length;
                let newFormIndex = props.formIndex;
                do {
                  newFormIndex = (newFormIndex + 1) % formCount;
                  if (this.speciesStarterDexEntry.caughtAttr & this.scene.gameData.getFormAttr(newFormIndex))
                    break;
                } while (newFormIndex !== props.formIndex);
                this.setSpeciesDetails(this.lastSpecies, undefined, newFormIndex, undefined, undefined);
                success = true;
              }
              break;
            case Button.CYCLE_GENDER:
              if (this.canCycleGender) {
                this.setSpeciesDetails(this.lastSpecies, undefined, undefined, !props.female, undefined);
                success = true;
              }
              break;
            case Button.CYCLE_ABILITY:
              if (this.canCycleAbility) {
                const abilityCount = this.lastSpecies.getAbilityCount();
                let newAbilityIndex = props.abilityIndex;
                do {
                  newAbilityIndex = (newAbilityIndex + 1) % abilityCount;
                  if (!newAbilityIndex) {
                    if (this.speciesStarterDexEntry.caughtAttr & DexAttr.ABILITY_1)
                      break;
                  } else if (newAbilityIndex === 1) {
                    if (this.speciesStarterDexEntry.caughtAttr & (this.lastSpecies.ability2 ? DexAttr.ABILITY_2 : DexAttr.ABILITY_HIDDEN))
                      break;
                  } else {
                    if (this.speciesStarterDexEntry.caughtAttr & DexAttr.ABILITY_HIDDEN)
                      break;
                  }
                } while (newAbilityIndex !== props.abilityIndex);
                this.setSpeciesDetails(this.lastSpecies, undefined, undefined, undefined, newAbilityIndex);
                success = true;
              }
              break;
            case Button.UP:
              if (row)
                success = this.setCursor(this.cursor - 9);
              break;
            case Button.DOWN:
              if (row < rows - 2 || (row < rows - 1 && this.cursor % 9 <= (genStarters - 1) % 9))
                success = this.setCursor(this.cursor + 9);
              break;
            case Button.LEFT:
              if (this.cursor % 9)
                success = this.setCursor(this.cursor - 1);
              else {
                if (row >= Math.min(5, rows - 1))
                  this.startCursorObj.setVisible(true);
                success = this.setGenMode(true);
              }
              break;
            case Button.RIGHT:
              if (this.cursor % 9 < (row < rows - 1 ? 8 : (genStarters - 1) % 9))
                success = this.setCursor(this.cursor + 1);
              break;
          }
        }
      }
    
      if (success)
        ui.playSelect();
      else if (error)
        ui.playError();

      return success || error;
    }
    
    updateInstructions(): void {
      let instructionLines = [
        'Arrow Keys/WASD: Move'
      ];
      let cycleInstructionLines = [];
      if (!this.genMode)
        instructionLines.push('A/Space/Enter: Select');
      if (this.starterCursors.length)
        instructionLines.push('X/Backspace/Esc: Undo');
      if (this.speciesStarterDexEntry?.caughtAttr) {
        if (this.canCycleShiny)
          cycleInstructionLines.push('R: Cycle Shiny');
        if (this.canCycleForm)
          cycleInstructionLines.push('F: Cycle Form');
        if (this.canCycleGender)
          cycleInstructionLines.push('G: Cycle Gender');
        if (this.canCycleAbility)
          cycleInstructionLines.push('E: Cycle Ability');
      }

      if (cycleInstructionLines.length > 2) {
        cycleInstructionLines[0] += ' | ' + cycleInstructionLines.splice(1, 1);
        if (cycleInstructionLines.length > 2)
          cycleInstructionLines[1] += ' | ' + cycleInstructionLines.splice(2, 1);
      }

      for (let cil of cycleInstructionLines)
        instructionLines.push(cil);

      this.instructionsText.setText(instructionLines.join('\n'));
    }
  
    setCursor(cursor: integer): boolean {
      let changed = false;

      if (this.genMode) {
        changed = this.genCursor !== cursor;

        if (this.genCursor !== undefined)
          this.starterSelectGenIconContainers[this.genCursor].setVisible(false);
        this.cursor = 0;
        this.genCursor = cursor;
        this.genCursorObj.setY(5 + 17 * this.genCursor);
        this.genCursorHighlightObj.setY(this.genCursorObj.y);
        this.starterSelectGenIconContainers[this.genCursor].setVisible(true);

        for (let s = 0; s < this.starterCursorObjs.length; s++)
          this.starterCursorObjs[s].setVisible(this.starterGens[s] === cursor);
        for (let s = 0; s < this.pokerusCursorObjs.length; s++)
          this.pokerusCursorObjs[s].setVisible(this.pokerusGens[s] === cursor);

        const genLimit = this.genSpecies[this.genCursor].length;
        for (let s = 0; s < 81; s++) {
          const slotVisible = s < genLimit && !!(this.scene.gameData.dexData[this.genSpecies[this.genCursor][s].speciesId].caughtAttr);
          this.starterValueLabels[s].setText(slotVisible ? speciesStarterValues[this.genSpecies[this.genCursor][s].speciesId] : 0);
          this.starterValueLabels[s].setVisible(slotVisible);
          this.shinyIcons[s].setVisible(slotVisible && !!(this.scene.gameData.dexData[this.genSpecies[this.genCursor][s].speciesId].caughtAttr & DexAttr.SHINY));
        }
      } else {
        changed = super.setCursor(cursor);

        this.cursorObj.setPosition(148 + 18 * (cursor % 9), 10 + 18 * Math.floor(cursor / 9));

        this.setSpecies(this.genSpecies[this.genCursor][cursor]);

        this.updateInstructions();
      }
  
      return changed;
    }

    setGenMode(genMode: boolean): boolean {
      this.genCursorObj.setVisible(genMode && !this.startCursorObj.visible);
      this.cursorObj.setVisible(!genMode && !this.startCursorObj.visible);
      
      if (genMode !== this.genMode) {
        this.genMode = genMode;

        this.setCursor(genMode ? this.genCursor : this.cursor);
        if (genMode)
          this.setSpecies(null);

        return true;
      }

      return false;
    }

    setSpecies(species: PokemonSpecies) {
      this.speciesStarterDexEntry = species ? this.scene.gameData.dexData[species.speciesId] : null;
      this.dexAttrCursor = species ? this.scene.gameData.getSpeciesDefaultDexAttr(species) : 0n;

      if (this.statsMode) {
        if (this.speciesStarterDexEntry?.caughtAttr) {
          this.statsContainer.setVisible(true);
          this.showStats();
        } else {
          this.statsContainer.setVisible(false);
          this.ivChart.setTo((this.statsIvsCache = defaultIvChartData));
        }
      }

      if (this.lastSpecies) {
        const dexAttr = this.scene.gameData.getSpeciesDefaultDexAttr(this.lastSpecies);
        const props = this.scene.gameData.getSpeciesDexAttrProps(this.lastSpecies, dexAttr);
        const lastSpeciesIcon = (this.starterSelectGenIconContainers[this.lastSpecies.generation - 1].getAt(this.genSpecies[this.lastSpecies.generation - 1].indexOf(this.lastSpecies)) as Phaser.GameObjects.Sprite);
        lastSpeciesIcon.play(this.lastSpecies.getIconKey(props.female, props.formIndex)).stop();
      }

      this.lastSpecies = species;

      if (species && this.speciesStarterDexEntry?.caughtAttr) {
        this.pokemonNumberText.setText(Utils.padInt(species.speciesId, 3));
        this.pokemonNameText.setText(species.name);
        this.pokemonGrowthRateText.setText(Utils.toReadableString(GrowthRate[species.growthRate]));
        this.pokemonGrowthRateText.setColor(getGrowthRateColor(species.growthRate));
        this.pokemonGrowthRateText.setShadowColor(getGrowthRateColor(species.growthRate, true));
        this.pokemonGrowthRateLabelText.setVisible(true);
        this.pokemonAbilityLabelText.setVisible(true);

        const defaultDexAttr = this.scene.gameData.getSpeciesDefaultDexAttr(species);
        const props = this.scene.gameData.getSpeciesDexAttrProps(species, defaultDexAttr);
        
        this.setSpeciesDetails(species, props.shiny, props.formIndex, props.female, props.abilityIndex);
      } else {
        this.pokemonNumberText.setText(Utils.padInt(0, 3));
        this.pokemonNameText.setText(species ? '???' : '');
        this.pokemonGrowthRateText.setText('');
        this.pokemonGrowthRateLabelText.setVisible(false);
        this.pokemonAbilityLabelText.setVisible(false);

        this.setSpeciesDetails(species, false, 0, false, 0);
      }
    }

    setSpeciesDetails(species: PokemonSpecies, shiny: boolean, formIndex: integer, female: boolean, abilityIndex: integer): void {
      const oldProps = species ? this.scene.gameData.getSpeciesDexAttrProps(species, this.dexAttrCursor) : null;
      this.dexAttrCursor = 0n;

      if (species) {
        this.dexAttrCursor |= (shiny !== undefined ? !shiny : !(shiny = oldProps.shiny)) ? DexAttr.NON_SHINY : DexAttr.SHINY;
        this.dexAttrCursor |= (female !== undefined ? !female : !(female = oldProps.female)) ? DexAttr.MALE : DexAttr.FEMALE;
        this.dexAttrCursor |= (abilityIndex !== undefined ? !abilityIndex : !(abilityIndex = oldProps.abilityIndex)) ? DexAttr.ABILITY_1 : species.ability2 && abilityIndex === 1 ? DexAttr.ABILITY_2 : DexAttr.ABILITY_HIDDEN;
        this.dexAttrCursor |= this.scene.gameData.getFormAttr(formIndex !== undefined ? formIndex : (formIndex = oldProps.formIndex));
      }

      this.pokemonSprite.setVisible(false);

      if (this.assetLoadCancelled) {
        this.assetLoadCancelled.value = true;
        this.assetLoadCancelled = null;
      }

      if (species) {
        const dexEntry = this.scene.gameData.dexData[species.speciesId];
        if (!dexEntry.caughtAttr) {
          const props = this.scene.gameData.getSpeciesDexAttrProps(species, this.scene.gameData.getSpeciesDefaultDexAttr(species));
          if (shiny === undefined || shiny !== props.shiny)
            shiny = props.shiny;
          if (formIndex === undefined || formIndex !== props.formIndex)
            formIndex = props.formIndex;
          if (female === undefined || female !== props.female)
            female = props.female;
          if (abilityIndex === undefined || abilityIndex !== props.abilityIndex)
            abilityIndex = props.abilityIndex;
        }

        if (this.speciesStarterDexEntry?.caughtAttr) {
          const assetLoadCancelled = new Utils.BooleanHolder(false);
          this.assetLoadCancelled = assetLoadCancelled;

          species.loadAssets(this.scene, female, formIndex, shiny, true).then(() => {
            if (assetLoadCancelled.value)
              return;
            this.assetLoadCancelled = null;
            this.speciesLoaded.set(species.speciesId, true);
            this.pokemonSprite.play(species.getSpriteKey(female, formIndex, shiny));
            this.pokemonSprite.setVisible(!this.statsMode);
          });

          species.generateIconAnim(this.scene, female, formIndex);
          (this.starterSelectGenIconContainers[this.genCursor].getAt(this.cursor) as Phaser.GameObjects.Sprite).play(species.getIconKey(female, formIndex));

          this.canCycleShiny = !!(dexEntry.caughtAttr & DexAttr.NON_SHINY && dexEntry.caughtAttr & DexAttr.SHINY);
          this.canCycleGender = !!(dexEntry.caughtAttr & DexAttr.MALE && dexEntry.caughtAttr & DexAttr.FEMALE);
          this.canCycleAbility = [ dexEntry.caughtAttr & DexAttr.ABILITY_1, dexEntry.caughtAttr & DexAttr.ABILITY_2, dexEntry.caughtAttr & DexAttr.ABILITY_HIDDEN ].filter(a => a).length > 1;
          this.canCycleForm = species.forms.map((_, f) => dexEntry.caughtAttr & this.scene.gameData.getFormAttr(f)).filter(a => a).length > 1;
        }

        if (dexEntry.caughtAttr && species.malePercent !== null) {
          const gender = !female ? Gender.MALE : Gender.FEMALE;
          this.pokemonGenderText.setText(getGenderSymbol(gender));
          this.pokemonGenderText.setColor(getGenderColor(gender));
          this.pokemonGenderText.setShadowColor(getGenderColor(gender, true));
        } else
          this.pokemonGenderText.setText('');

        if (dexEntry.caughtAttr) {
          const ability = this.lastSpecies.getAbility(abilityIndex);
          this.pokemonAbilityText.setText(abilities[ability].name);

          const isHidden = ability === this.lastSpecies.abilityHidden;
          this.pokemonAbilityText.setColor(getTextColor(!isHidden ? TextStyle.SUMMARY : TextStyle.SUMMARY_GOLD));
          this.pokemonAbilityText.setShadowColor(getTextColor(!isHidden ? TextStyle.SUMMARY : TextStyle.SUMMARY_GOLD, true));
        } else
          this.pokemonAbilityText.setText('');
      } else {
        this.pokemonGenderText.setText('');
        this.pokemonAbilityText.setText('');
      }

      this.updateInstructions();
    }

    popStarter(): void {
      this.starterGens.pop();
      this.starterCursors.pop();
      this.starterAttr.pop();
      this.starterCursorObjs[this.starterCursors.length].setVisible(false);
      this.starterIcons[this.starterCursors.length].play('pkmn_icon__000');
      this.tryUpdateValue();
    }

    tryUpdateValue(add?: integer): boolean {
      const value = this.starterGens.reduce((total: integer, gen: integer, i: integer) => total += speciesStarterValues[this.genSpecies[gen][this.starterCursors[i]].speciesId], 0);
      const newValue = value + (add || 0);
      const overLimit = newValue > 10;
      this.valueLimitLabel.setText(`${newValue}/10`);
      this.valueLimitLabel.setColor(getTextColor(!overLimit ? TextStyle.TOOLTIP_CONTENT : TextStyle.SUMMARY_RED));
      this.valueLimitLabel.setShadowColor(getTextColor(!overLimit ? TextStyle.TOOLTIP_CONTENT : TextStyle.SUMMARY_RED, true));
      if (overLimit) {
        this.scene.time.delayedCall(Utils.fixedInt(500), () => this.tryUpdateValue());
        return false;
      }
      this.value = newValue;
      return true;
    }

    tryStart(): boolean {
      if (!this.starterGens.length)
        return false;

      const ui = this.getUi();

      const cancel = () => {
        ui.setMode(Mode.STARTER_SELECT);
        this.popStarter();
        this.clearText();
      };

      ui.showText('Begin with these Pokémon?', null, () => {
        ui.setModeWithoutClear(Mode.CONFIRM, () => {
          const startRun = (gameMode: GameMode) => {
            this.scene.gameMode = gameMode;
            ui.setMode(Mode.STARTER_SELECT);
            const thisObj = this;
            const originalStarterSelectCallback = this.starterSelectCallback;
            this.starterSelectCallback = null;
            originalStarterSelectCallback(new Array(this.starterGens.length).fill(0).map(function (_, i) {
              const starterSpecies = thisObj.genSpecies[thisObj.starterGens[i]][thisObj.starterCursors[i]];
              return {
                species: starterSpecies,
                dexAttr: thisObj.starterAttr[i],
                pokerus: !![ 0, 1, 2 ].filter(n => thisObj.pokerusGens[n] === starterSpecies.generation - 1 && thisObj.pokerusCursors[n] === thisObj.genSpecies[starterSpecies.generation - 1].indexOf(starterSpecies)).length
              };
            }));
          };
          if (this.scene.gameData.unlocks[Unlockables.ENDLESS_MODE]) {
            ui.setMode(Mode.STARTER_SELECT);
            ui.showText('Select a game mode.', null, () => ui.setModeWithoutClear(Mode.GAME_MODE_SELECT, startRun, cancel));
          } else
            startRun(GameMode.CLASSIC);
        }, cancel);
      });

      return true;
    }

    toggleStatsMode(on?: boolean): void {
      if (on === undefined)
        on = !this.statsMode;
      if (on) {
        this.showStats();
        this.statsMode = true;
        this.pokemonSprite.setVisible(false);
      } else {
        this.statsMode = false;
        this.statsContainer.setVisible(false);
        this.pokemonSprite.setVisible(!!this.speciesStarterDexEntry?.caughtAttr);
        this.ivChart.setTo((this.statsIvsCache = defaultIvChartData));
      }
    }
    
    showStats(): void {
      if (!this.speciesStarterDexEntry)
        return;

      this.statsContainer.setVisible(true);

      const ivs = this.speciesStarterDexEntry.ivs;
      const ivChartData = new Array(6).fill(null).map((_, i) => [ (ivs[i] / 31) * ivChartSize * ivChartStatCoordMultipliers[i][0], (ivs[i] / 31) * ivChartSize * ivChartStatCoordMultipliers[i][1] ] ).flat();
      const lastIvChartData = this.statsIvsCache || defaultIvChartData;
      this.statsIvsCache = ivChartData.slice(0);
      
      this.ivStatValueTexts.map((t: Phaser.GameObjects.Text, i: integer) => t.setText(ivs[i].toString()));

      this.scene.tweens.addCounter({
        from: 0,
        to: 1,
        duration: 1000,
        ease: 'Cubic.easeOut',
        onUpdate: (tween: Phaser.Tweens.Tween) => {
          const progress = tween.getValue();
          const interpolatedData = ivChartData.map((v: number, i: integer) => v * progress + (lastIvChartData[i] * (1 - progress)));
          this.ivChart.setTo(interpolatedData);
        }
      });
    }

    clearText() {
      this.starterSelectMessageBoxContainer.setVisible(false);
      super.clearText();
    }
  
    clear(): void {
      super.clear();
      this.cursor = -1;
      this.starterSelectContainer.setVisible(false);

      while (this.starterCursors.length)
        this.popStarter();

      if (this.statsMode)
        this.toggleStatsMode(false);
    }
  }  