
shellwords = require 'shellwords'
ItemPile = require 'itempile'

module.exports = (game, opts) -> new CommandsPlugin game, opts
module.exports.pluginInfo =
  loadAfter: ['voxel-console']

class CommandsPlugin
  constructor: (@game, opts) ->
    @console = @game.plugins?.get 'voxel-console'
    throw 'voxel-commands requires voxel-console' if not @console?
    @registry = @game.plugins?.get 'voxel-registry'
    throw 'voxel-commands requires voxel-registry' if not @registry?

    @handlers =
      undefined: (command, args...) ->
        @console.log "Invalid command #{command} #{args.join ' '}"

      help: () ->
        @console.log "Available commands:" # TODO: help usage
        @console.log ".pos x y z"
        @console.log ".home"
        @console.log ".item name [count [tags]]"
        @console.log ".block name [data]"
        @console.log ".plugins"
        @console.log ".enable plugin"
        @console.log ".disable plugin"

      plugins: () ->
        list = @game.plugins?.list() # TODO: listAll? show disabled in red
        @console.log "Enabled plugins (#{list.length}): " + list.join ' '

      enable: (name) ->
        if @game.plugins?.enable name
          @console.log "Enabled plugin: #{name}"
        else
          @console.log "Failed to enable plugin: #{name}"

      disable: (name) ->
        if @game.plugins.disable name
          @console.log "Disabled plugin: #{name}"
        else
          @console.log "Failed to disable plugin: #{name}"

      pos: (x, y, z) ->
        player = @game.plugins?.get 'voxel-player'
        if player
          player.moveTo x, y, z
          @console.log [player.position.x, player.position.y, player.position.z]

      home: () ->
        @game.plugins?.get('voxel-player')?.home()

      item: (name, count, tags) ->

        props = @registry.getItemProps name
        if not props?
          @console.log "No such item: #{name}"
          return

        count ?= 1
        tags ?= undefined
        pile = new ItemPile(name, count, tags)
        carry = @game.plugins?.get 'voxel-carry'
        if carry
          carry.inventory.give pile
          tags ?= '' # hide no tags for display
          @console.log "Gave #{name} x #{count} #{tags}"
        # TODO: integrate with voxel-inventory-hotbar, move to current slot?

      block: (name, data) ->
        if name?
          index = @registry.getBlockIndex name
          if not index?
            @console.log "No such block: #{name}"
            return

        reachDistance = 8
        hit = @game.raycastVoxels @game.cameraPosition(), @game.cameraVector(), reachDistance # TODO: refactor w/ voxel-highlight, voxel-reach?
        if not hit
          @console.log "No block targetted"
          return
        [x, y, z] = hit.voxel

        oldIndex = hit.value
        oldName = @registry.getBlockName oldIndex

        @game.setBlock hit.voxel, index if name?

        blockdata = @game.plugins?.get 'voxel-blockdata'
        if blockdata?
          oldData = blockdata.get x, y, z
          if data?
            blockdata.set x, y, z, data

        dataInfo = ""
        dataInfo = "#{JSON.stringify oldData} -> " if oldData?
        data ?= oldData
        dataInfo += JSON.stringify(data) if oldData?

        name ?= oldName
        index ?= oldIndex

        @console.log "Set (#{x}, #{y}, #{z}) #{oldName}/#{oldIndex} -> #{name}/#{index}  #{dataInfo}"

    # aliases
    @handlers.p = @handlers.position = @handlers.tp = @handlers.pos
    @handlers.i = @handlers.give = @handlers.item
    @handlers.b = @handlers.setblock = @handlers.set = @handlers.block

    @enable()

  process: (input) ->
    if input.indexOf('.') != 0  # regular text # TODO: send to server?
      @console.log input
      connection = @game.plugins?.get('voxel-client')?.connection
      if connection?
        connection.emit 'chat', {message:input}
      else
        @console.log 'Not connected to server. Type .help for commands'
      return

    input = input.substring(1)

    # split into tokens using shell-based rules (allows quoting)
    # TODO: switch to https://github.com/substack/node-shell-quote?
    words = shellwords.split input
    [command, args...] = words

    handler = @handlers[command]
    if not handler?
      handler = @handlers.undefined
      args.unshift command

    handler.apply(this, args)


  enable: () ->
    @console.widget?.on 'input', @onInput = (input) =>
      @process input

    @game.plugins?.get('voxel-client')?.connection.on 'chat', @onChat = (input) => # TODO: refresh if connection changes?
      @console.log input.message ? input

  disable: () ->
    @console.widget.removeListener 'input', @onInput
    @game.plugins?.get('voxel-client')?.connection.removeListener 'chat', @onChat

