pianod
===========
Pianod is wrapper library for talking with pianod server: http://deviousfish.com/pianod/index.html

## Requirements

- [deferred](https://github.com/medikoo/deferred)

## Installation

```bash
npm install pianod
```

## Usage

### pianod.connect()

## Examples

```javascript
var pianod = require('pianod')();

pianod.connect({host: 'localhost', port: 4445});
pianod.user('admin', 'adminpassword').then(function(response) {
  if (!response.error) {
    console.log('Logged in.');
  }
  else {
    console.error('Not good, probably wrong username/password');
  }
});

pianod.status().then(function(response) {
  if (!response.error) {
    console.log(response.songInfo);
  }
  else {
    //handle error
  }
});

//more exampled without error handling etc

pianod.pause().then(function(response){});
pianod.play().then(function(response){});
pianod.stop(true/* true if stop now, false if end of track (default) */).then(function(response){  });


```
### Use as an EventEmitter


```javascript
pianod.on('songStart', function(songInfo) {
  console.log('Song started, info about song:', songInfo);
});

pianod.on('playbackPause', function(songInfo) {
  console.log('Song paused, info about song:', songInfo);
});

pianod.on('playbackResume', function(songInfo) {
  console.log('Song playback resumed, info about song:', songInfo);
});

pianod.on('songComplete', function(songInfo) {
  console.log('End of song (track complete), info about song which just played:', songInfo);
});

```
