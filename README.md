# voxel-commands

A few basic commands for [voxel-console](https://github.com/deathcap/voxel-console) (voxel.js plugin)

* .pos x y z -- set avatar position (requires [voxel-player](https://github.com/deathcap/voxel-player))
* .home -- set avatar position to home
* .item name [count [tags]] -- give item to player inventory (requires [voxel-carry](https://github.com/deathcap/voxel-carry))
* .clear - wipe inventory (requires [voexl-carry](https://github.com/deathcap/voxel-carry))
* .block name [data] -- set/get block, optionally supports [voxel-blockdata](https://github.com/deathcap/voxel-blockdata)
* .plugins -- list plugins from [voxel-plugins](https://github.com/deathcap/voxel-plugins)
* .enable plugin - enable a plugin
* .disable plugin - disable a plugin

## API

    var commands = game.plugins.get('voxel-commands')

    // other plugins can register their own custom commands
    commands.registerCommand(name, handler, usage, help);
    commands.unregisterCommand(name, handler);

    commands.isConnectedToServer = true; // suppress 'Not connected to server' chat messages

## License

MIT

