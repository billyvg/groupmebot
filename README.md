# groupmebot

GroupMe bot

## Getting Started
Install the module with: `npm install groupmebot`

## Documentation
_(Coming soon)_

## Examples
```javascript
var Bot = require('groupmebot').Bot;
var bot = new Bot({
  groups: ['groupId1', 'groupId2'],
  botName: 'botName',
  userId: 'your userId',
  accessToken: 'accessToken'
});
bot.connect();

bot.on('connect', function() {
  this.message('Hello, world');
});

```

## Contributing
In lieu of a formal styleguide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint and test your code using [grunt](https://github.com/gruntjs/grunt).

## Release History
_(Nothing yet)_

## License
Copyright (c) 2013 Billy Vong  
Licensed under the MIT license.
