'use strict';

const shellwords = require('shellwords');
const ItemPile = require('itempile');

module.exports = (game, opts) => new CommandsPlugin(game, opts);
module.exports.pluginInfo = {
  loadAfter: ['voxel-console']
};

class CommandsPlugin {
  constructor(game, opts) {
    this.game = game;
    this.console = this.game.plugins.get('voxel-console');
    if (!this.console) throw new Error('voxel-commands requires voxel-console');
    this.registry = this.game.plugins.get('voxel-registry');
    if (!this.registry) throw new Error('voxel-commands requires voxel-registry');

    // can be set to suppress 'Not connected to server' chat messages
    this.isConnectedToServer = false;

    this.usages = {
      pos: "x y z",
      home: "",
      item: "name [count [tags]]",
      clear: "",
      block: "name [data]",
      plugins: "",
      enable: "plugin",
      disable: "plugin"
    };

    this.handlers = {
      undefined: (command, ...args) => {
        this.console.log(`Invalid command ${command} ${args.join(' ')}`);
      },

      help: () => {
        this.console.log("Available commands:");
        //for name of this.handlers # TODO: include all commands, but this extraneously includes aliases, too
        for (let name in this.usages) { // only documented commands
          const usage = this.usages[name];
          if (usage === undefined) usage = '';
          this.console.log(`.${name} ${usage}`);
        }
      },

      plugins: () => {
        const list = this.game.plugins.list(); // TODO: listAll? show disabled in red
        this.console.log(`Enabled plugins (${list.length}): ` + list.join(' '));
      },

      enable: (name) => {
        if (this.game.plugins.enable(name))  {
          this.console.log(`Enabled plugin: ${name}`);
        } else {
          this.console.log(`Failed to enable plugin: ${name}`);
        }
      },

      disable: (name) => {
        if (this.game.plugins.disable(name)) {
          this.console.log(`Disabled plugin: ${name}`);
        } else {
          this.console.log(`Failed to disable plugin: ${name}`);
        }
      },

      pos: (x, y, z) => {
        const player = this.game.plugins.get('voxel-player');
        if (player) {
          player.moveTo(x, y, z);
          this.console.log([player.position.x, player.position.y, player.position.z]);
        }
      },

      home: () => {
        if (this.game.plugins.get('voxel-player')) {
          this.game.plugins.get('voxel-player').home();
        }
      },

      item: (name, count, tagsStr) => {
        const props = this.registry.getItemProps(name);
        if (!props) {
          this.console.log(`No such item: ${name}`);
          return;
        }

        let tags;
        if (tagsStr !== undefined) {
          try {
            tags = JSON.parse(tagsStr);
          } catch(e) {
            this.console.log(`Invalid JSON ${tagsStr}: ${e}`);
            return;
          }
        } else {
          tags = undefined;
        }

        if (count !== undefined) count = 1;
        count = parseInt(count, 10);
        if (isNaN(count)) count = 1;
        const pile = new ItemPile(name, count, tags);
        const carry = this.game.plugins.get('voxel-carry');
        if (carry) {
          carry.inventory.give(pile);
          this.console.log(`Gave ${name} x ${count} ${ (tags !== undefined) ? JSON.stringify(tags) : ''}`);
        }
        // TODO: integrate with voxel-inventory-hotbar, move to current slot?
      },

      clear: () => { // TODO: optionally list item types to clear only those
        const carry = this.game.plugins.get('voxel-carry');
        if (carry) {
          carry.inventory.clear();
          this.console.log("Cleared inventory");
        }
      },

      block: (name, data) => {
        if (name !== undefined) {
          const index = this.registry.getBlockIndex(name);
          if (index !== undefined) {
            this.console.log(`No such block: ${name}`);
            return;
          }
        }

        const reachDistance = 8;
        const hit = this.game.raycastVoxels(this.game.cameraPosition(), this.game.cameraVector(), reachDistance); // TODO: refactor w/ voxel-highlight, voxel-reach?
        if (!hit) {
          this.console.log("No block targetted");
          return;
        }
        const x = hit.voxel[0];
        const y = hit.voxel[1];
        const z = hit.voxel[2];

        const oldIndex = hit.value;
        const oldName = this.registry.getBlockName(oldIndex);

        if (name !== undefined) {
          this.game.setBlock(hit.voxel, index);
        }

        const blockdata = this.game.plugins.get('voxel-blockdata');
        let oldData;
        if (blockdata !== undefined) {
          oldData = blockdata.get(x, y, z);
          if (data !== undefined) {
            blockdata.set(x, y, z, data);
          }
        }

        let dataInfo = "";
        if (oldData !== undefined) {
          dataInfo = `${JSON.stringify(oldData)} -> `;
        } 
        if (data === undefined) data = oldData;
        if (oldData !== undefined) {
          dataInfo += JSON.stringify(data);
        }

        if (name === undefined) name = oldName;
        if (index === undefined) index = oldIndex;

        this.console.log(`Set (${x}, ${y}, ${z}) ${oldName}/${oldIndex} -> ${name}/${index}  ${dataInfo}`);
      }
    };

    // aliases
    this.handlers.p = this.handlers.position = this.handlers.tp = this.handlers.pos;
    this.handlers.i = this.handlers.give = this.handlers.item;
    this.handlers.b = this.handlers.setblock = this.handlers.set = this.handlers.block;

    this.enable();
  }

  process(input) {
    if (input.indexOf('.') !== 0) { // regular text
      if (!this.isConnectedToServer) { // (or send to server)
        this.console.log(input);
        let connection;
        if (this.game.plugins.get('voxel-client')) {
          connection = this.game.plugins.get('voxel-client').connection;
        }
        if (connection !== undefined) {
          connection.emit('chat', {message:input});
        } else {
          this.console.log('Not connected to server. Type .help for commands');
        }
      }
      return; // no local echo
    }

    input = input.substring(1);

    // split into tokens using shell-based rules (allows quoting)
    // TODO: switch to https://github.com/substack/node-shell-quote?
    const words = shellwords.split(input);
    const command = words[0];
    const args = words.slice(1);

    let handler = this.handlers[command];
    if (handler === undefined) {
      handler = this.handlers.undefined;
      args.unshift(command);
    }

    handler.apply(this, args);
  }

  enable() {
    if (this.console.widget) {
      this.console.widget.on('input', this.onInput = (input) => {
        this.process(input);
      });
    }

    if (this.game.plugins.get('voxel-client')) {
      this.game.plugins.get('voxel-client').connection.on('chat', this.onChat = (input) => { // TODO: refresh if connection changes?
        this.console.log(input.message !== undefined ? input.message : input);
      });
    }
  }

  disable() {
    this.console.widget.removeListener('input', this.onInput);
    if (this.game.plugins.get('voxel-client')) {
      this.game.plugins.get('voxel-client').connection.removeListener('chat', this.onChat);
    }
  }

  registerCommand(name, handler, usage, help) {
    if (name in this.handlers) {
      throw new Error(`voxel-commands duplicate command registration: ${name} for ${handler}`);
    }

    this.handlers[name] = handler;
    this.usages[name] = `${usage} -- ${help}`;
  }

  unregisterCommand(name, handler) {
    if (this.handlers[name] !== handler) {
      throw new Error(`voxel-commands attempted to unregister mismatched command: ${name} was ${this.handlers[name]} not ${handler}`); // TODO: is this a good idea? like removeListener..
    }

    delete this.handlers[name];
    delete this.usages[name];
  }
}

