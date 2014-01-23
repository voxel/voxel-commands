module.exports = (game, opts) -> new CommandsPlugin game, opts
module.exports.pluginInfo =
  loadAfter: ['voxel-console']

class CommandsPlugin 
  constructor: (@game, opts) ->
    @console = @game.plugins?.get('voxel-console')
    throw 'voxel-commands requires voxel-console' if not @console?

    @enable()

  enable: () ->
    @console.widget.on 'input', @onInput = (input) ->
      console.log 'IN', input

  disable: () ->
    @console.widget.removeListener 'input', @onInput

