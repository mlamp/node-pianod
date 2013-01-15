var util = require('util'),
	EventEmitter = require('events').EventEmitter,
	net = require('net'),
	deferred = require('deferred');



var Pianod = module.exports = function(options) {
	'use strict';

	if (!(this instanceof Pianod)) {
		return new Pianod(options);
	}

	this.PLAYBACK_TYPES = {
		PLAYING: "playing",
		PAUSED: "paused",
		STOPPED: "stopped",
		BETWEEN_SONGS: "between_songs"
	};

	this.playback = this.PLAYBACK_TYPES.STOPPED;
	this.playbackPausedAt = null;
	this.playing = {
		type: null,
		name: null
	};

	this.init();
	this.parseOpts(options);
	//this.stream.on('', this.handlePianobarDataIn.bind(this));

	EventEmitter.call(this);
};

util.inherits(Pianod, EventEmitter);

Pianod.prototype.init = function() {
	'use strict';

	this.songInfo = {
		id: 'No ID',
		artist: 'Noname',
		title: 'No Title',
		album: 'No Album',
		station: {
			name: 'No Station'
		},
		startTime : null,
		totalTime: {
			minutes: 0, seconds: 0
		}
	};
};

Pianod.prototype.parseOpts = function (options) {
	'use strict';

	options = options || {};
	this.options = {};
	this.options.host = options.host || 'localhost';
	this.options.port = options.port || 4445;
	this.options.username = options.username || 'admin';
	this.options.password = options.password || 'admin';
};

Pianod.prototype.connect = function(host, port) {
	'use strict';

	var self = this;
	host = host || self.options.host;
	port = port || self.options.port;
	self.tcpClient = net.connect({host: host, port: port});

	self.sendPianodRequest(null, [200]);
	self.status();

	//self.tcpClient.on('data', self.handleClientRuntime.bind(this));

	//self.status();
//	self.tcpClient.on('end', function(something) {
//		console.log('ENDEEEERRRR', something);
//	});
};


Pianod.prototype.status = function() {
	'use strict';

	var self = this,
		stopCodes = [204],
		def = deferred();

	self.sendPianodRequest('STATUS', stopCodes).then(function(response) {
		//console.log('STATUS_VALUE', response);
		response.forEach(function(packet) {
			packet.forEach(function(line) {
				switch (line.code) {
					case 111: //id
					case 112: //album
					case 113: //artist
					case 114: //title
					case 115: //station
					case 116: //rating
					case 117: //seeAlso
					case 118: //coverArt
						var splittedMessage = line.message.split(': ');
						var key = splittedMessage.slice(0,1);
						var value = splittedMessage.slice(1).join(': ');
						self.setSongInfo(line.code, value);
						break;
				}
			});
		});
		def.resolve({error: false, data: {songInfo: self.getSongInfo()}});
	});
	return def.promise;
};

Pianod.prototype.skip = function() {
	'use strict';

	var self = this,
		stopCodes = [200],
		def = deferred();

	self.sendPianodRequest('SKIP', stopCodes).then(function(response) {
		var hasError = true;
		response.forEach(function(packet) {
			packet.forEach(function(line) {
				if (line.code === 200) {
					hasError = false;
				}
			});
		});
		def.resolve({error: hasError});
	});
	return def.promise;
};


Pianod.prototype.user = function(username, password) {
	'use strict';

	var self = this,
		stopCodes = [200],
		def = deferred();
	this.sendPianodRequest('USER ' + username + ' ' + password, stopCodes).then(function(response) {
		var hasError = true;
		response.forEach(function(packet) {
			packet.forEach(function(line) {
				if (line.code === 200) {
					hasError = false;
				}
			});
		});
		def.resolve({error: hasError});
	});
	return def.promise;
};


Pianod.prototype.stations = function() {
	'use strict';

	var self = this,
		stopCodes = [204],
		def = deferred();
	this.sendPianodRequest('STATIONS', stopCodes).then(function(response) {
		self.stationList = [];
		response.forEach(function(packet) {
			packet.forEach(function(line) {
				if (line.code === 115) {
					var splittedMessage = line.message.split(': ');
					var key = splittedMessage.slice(0,1);
					var value = splittedMessage.slice(1).join(': ');
					self.stationList.push(value);
				}
			});
		});
		def.resolve({error: false, data: {stations: self.stationList}});
	});
	return def.promise;
};


Pianod.prototype.pause = function() {
	'use strict';

	var self = this,
		stopCodes = [200],
		def = deferred();
	this.sendPianodRequest('PAUSE', stopCodes).then(function(response) {
		var hasError = true;
		response.forEach(function(packet) {
			packet.forEach(function(line) {
				if (line.code === 200) {
					hasError = false;
				}
			});
		});
		def.resolve({error: hasError});
	});
	return def.promise;
};

Pianod.prototype.play = function() {
	'use strict';

	var self = this,
		stopCodes = [200],
		def = deferred();
	this.sendPianodRequest('PLAY', stopCodes).then(function(response) {
		var hasError = true;
		response.forEach(function(packet) {
			packet.forEach(function(line) {
				if (line.code === 200) {
					hasError = false;
				}
			});
		});
		def.resolve({error: hasError});
	});
	return def.promise;
};

Pianod.prototype.stop = function(now) {
	'use strict';

	now = now || false;
	var self = this,
		stopCodes = [200],
		def = deferred();
	this.sendPianodRequest('STOP' + (now ? ' NOW' : '' ) , stopCodes).then(function(response) {
		var hasError = true;
		response.forEach(function(packet) {
			packet.forEach(function(line) {
				if (line.code === 200) {
					hasError = false;
				}
			});
		});
		def.resolve({error: hasError});
	});
	return def.promise;
};

Pianod.prototype.playStation = function(station) {
	'use strict';

	station = station || '';
	var self = this,
		stopCodes = [200, 204, 404],
		def = deferred();
	this.sendPianodRequest('PLAY STATION "' + station.replace(/[\\"]/g, '\\$&').replace(/\u0000/g, '\\0') + '"', stopCodes).then(function(response) {
		var hasError = true;
		response.forEach(function(packet) {
			packet.forEach(function(line) {
				if (line.code === 200) {
					hasError = false;
					self.playing = {type: 'station', name: station};
				}
			});
		});
		def.resolve({error: hasError, data: {playing: self.playing}});
	});
	return def.promise;
};


Pianod.prototype.sendPianodRequest = deferred.gate(function(command, stopCodes) {
	'use strict';

	var def = deferred();

	this.packet = [];
	this.tempPacket = [];
	this.tcpClient.removeAllListeners('data');
	this.doSendPianodRequest(command, stopCodes).then(function(value) {
		def.resolve(value);
	});

	return def.promise;
}, 1);

Pianod.prototype.doSendPianodRequest = function(command, stopCodes) {
	'use strict';

	var self = this,
		def = deferred();

	if (command) {
		self.tcpClient.write(command + "\n");
	}
	self.tcpClient.on('data', function(data) {
		self.handleResponse(data, stopCodes).then(function (response) {
			def.resolve(response);
		});
	});
	return def.promise;
};

Pianod.prototype.handleResponse = function(tcpData, stopCodes) {
	'use strict';

	//console.log('handleResponse', tcpData.toString());
	var self = this,
		def = deferred();

	var lines = tcpData.toString().split("\n");
	var lineIterator = 0;
	lines.forEach(function(line) {
		lineIterator = lineIterator+1;
		line = line.trim();
		var messageMatch = line.match(new RegExp('([0-9]{3}) (.+)', 'i'));
		if (messageMatch !== null) {
			var code = parseInt(messageMatch[1], 10);
			var message = messageMatch[2];

			if(code === 203) {
				self.packet.push(self.tempPacket);
				self.tempPacket = [];
			}
			else {
				self.tempPacket.push({code: code, message: message});
			}

			if (stopCodes.indexOf(code) !== -1) {
				// It's end, as we got stop code
				self.tcpClient.removeAllListeners('data');
				self.tcpClient.on('data', self.handleClientRuntime.bind(self));

				self.packet.push(self.tempPacket);
				if (lines.length !== lineIterator) {
					self.handleClientRuntime(lines.slice(lineIterator).join("\n"));
				}
				def.resolve(self.packet);
			}
		}
	});
	return def.promise;
};

Pianod.prototype.handleClientRuntime = function(tcpData) {
	'use strict';

	var self = this;
	//console.log('---------START-----------' + "\n", tcpData.toString().trim(), "\n" + '------------END------------');
	var lines = tcpData.toString().split("\n");
	var packet = {};

	lines.forEach(function(line) {
		line = line.trim();
		var messageMatch = line.match(new RegExp('([0-9]{3}) (.+)', 'i'));
		if (messageMatch !== null) {
			var code = parseInt(messageMatch[1], 10);
			var message = messageMatch[2];
			switch (code) {
				case 101:
					var timeMatch = message.match(new RegExp('([0-9]{2})\\:([0-9]{2})/([0-9]{2})\\:([0-9]{2})/\\-([0-9]{2})\\:([0-9]{2})', 'i'));
					if (timeMatch !== null) {
						this.songInfo.totalTime = {
							minutes: parseInt(timeMatch[3], 10),
							seconds: parseInt(timeMatch[4], 10)
						};
						var timeNow = new Date();
						var playedTime = {
							minutes: parseInt(timeMatch[1], 10),
							seconds: parseInt(timeMatch[2], 10)
						};
						self.songInfo.startTime = new Date(timeNow.getTime() - (playedTime.minutes * 60 * 1000 + playedTime.seconds * 1000));
					}
					self.changePlayback(self.PLAYBACK_TYPES.PLAYING);
					break;
				case 102:
					self.changePlayback(self.PLAYBACK_TYPES.PAUSED);
					break;
				case 103:
					self.changePlayback(self.PLAYBACK_TYPES.STOPPED);
					break;
				case 104:
					self.changePlayback(self.PLAYBACK_TYPES.BETWEEN_SONGS);
					break;
				case 105:
					self.nextEmit('songComplete', self.getSongInfo());
					self.changePlayback(self.PLAYBACK_TYPES.BETWEEN_SONGS);
					break;
				case 111: //id
				case 112: //album
				case 113: //artist
				case 114: //title
				case 115: //station
				case 116: //rating
				case 117: //seeAlso
				case 118: //coverArt
					var splittedMessage = message.split(': ');
					var key = splittedMessage.slice(0,1);
					var value = splittedMessage.slice(1).join(': ');
					self.setSongInfo(code, value);
					break;
			}
		}
	});
};

Pianod.prototype.changePlayback = function(playbackType) {
	'use strict';

	var currentPlayback = this.playback;
	if (currentPlayback !== playbackType) {
		this.playback = playbackType;
		this.nextEmit('plabackChange', playbackType);
		if (
			(currentPlayback === this.PLAYBACK_TYPES.BETWEEN_SONGS || currentPlayback === this.PLAYBACK_TYPES.STOPPED)
				&& playbackType === this.PLAYBACK_TYPES.PLAYING) {
			this.nextEmit('songStart', this.getSongInfo());
		}
		else if (currentPlayback === this.PLAYBACK_TYPES.PAUSED && playbackType === this.PLAYBACK_TYPES.PLAYING) {
			this.playbackPausedAt = null;
			this.nextEmit('playbackResume', this.getSongInfo());
		}
		else if (playbackType === this.PLAYBACK_TYPES.PAUSED) {
			this.playbackPausedAt = new Date();
			this.nextEmit('playbackPause', this.getSongInfo());
		}
	}

};

Pianod.prototype.getPlayerInfo = function() {
	'use strict';
	return {playback : this.playback};
};

Pianod.prototype.setSongInfo = function(code, value) {
	'use strict';

	var codeToFieldName = {
		'111' : 'id',
		'112' : 'album',
		'113' : 'artist',
		'114' : 'title',
		'115' : 'station',
		'116' : 'rating',
		'117' : 'seeAlso',
		'118' : 'coverArt'
	};
	if (typeof codeToFieldName[code] !== 'undefined') {
		this.songInfo[codeToFieldName[code]] = value;
	}
};

Pianod.prototype.getSongInfo = function() {
	'use strict';

	var songInfo = this.songInfo;
	if (songInfo.startTime) {
		var timeNow = new Date();

		var remainingTime = 0;

		if (this.playback === this.PLAYBACK_TYPES.PLAYING) {
			remainingTime = songInfo.startTime.getTime() + songInfo.totalTime.minutes * 60 * 1000 + songInfo.totalTime.seconds * 1000 - timeNow.getTime();
		}
		else if (this.playback === this.PLAYBACK_TYPES.PAUSED && this.playbackPausedAt) {
			remainingTime = songInfo.startTime.getTime() + (songInfo.totalTime.minutes * 60 * 1000)
				+ songInfo.totalTime.seconds * 1000 - this.playbackPausedAt.getTime();
		}

		songInfo.playback = this.playback;

		if (remainingTime < 0) {
			songInfo.remainingTime = {
				minutes: 0,
				seconds: 0
			};
		}
		else {
			var remianingTimeInSeconds = Math.round(remainingTime / 1000);
			var remainingTimeSeconds = remianingTimeInSeconds % 60;
			var remainingTimeMinutes = (remianingTimeInSeconds - remainingTimeSeconds) / 60;

			songInfo.remainingTime = {
				minutes: remainingTimeMinutes,
				seconds: remainingTimeSeconds
			};
		}
	}
	else {
		songInfo.remainingTime = {
			minutes: 0,
			seconds: 0
		};
	}
	return songInfo;
};

Pianod.prototype.nextEmit = function () {
	'use strict';

	var self = this;
	var args = [].slice.call(arguments);
	process.nextTick(function(){
		self.emit.apply(self, args);
	});
};


function pianod (options, callback) {
	'use strict';

	if ('function' === typeof options) {
		callback = options;
		options = {};
	}
	var p = new Pianod(options);
	p._setCallback(callback);
	return p;
}



