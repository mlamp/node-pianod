var util = require('util'),
	EventEmitter = require('events').EventEmitter,
	net = require('net'),
	deferred = require('deferred')
	;



var Pianod = module.exports = function(options) {
	if (!(this instanceof Pianod)) return new Pianod(options);
	
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
	}
	
	this.init();
	this.parseOpts(options);
	//this.stream.on('', this.handlePianobarDataIn.bind(this));
	
	EventEmitter.call(this);
}

util.inherits(Pianod, EventEmitter);

Pianod.prototype.init = function() {
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
		},
	};
}

Pianod.prototype.parseOpts = function (options) {
	options = options || {};
	this.options = {};
	this.options.host = options.host || 'localhost';
	this.options.port = options.port || 4445;
	this.options.username = options.username || 'admin';
	this.options.password = options.password || 'admin';
};

Pianod.prototype.connect = function(host, port) {
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
}


Pianod.prototype.status = function() {
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
}

Pianod.prototype.skip = function() {
	var self = this,
		stopCodes = [200],
		def = deferred();

	self.sendPianodRequest('SKIP', stopCodes).then(function(response) {
		var hasError = true;
		response.forEach(function(packet) {
			packet.forEach(function(line) {
				if (line.code == 200) {
					hasError = false;
				}
			});
		});
		def.resolve({error: hasError});
	});
	return def.promise;
}


Pianod.prototype.user = function(username, password) {
	var self = this,
		stopCodes = [200],
		def = deferred();
	this.sendPianodRequest('USER ' + username + ' ' + password, stopCodes).then(function(response) {
		var hasError = true;
		response.forEach(function(packet) {
			packet.forEach(function(line) {
				if (line.code == 200) {
					hasError = false;
				}
			});
		});
		def.resolve({error: hasError});
	});
	return def.promise;
}


Pianod.prototype.stations = function() {
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
}


Pianod.prototype.stop = function(now) {
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
		def.resolve({error: false});
	});
	return def.promise;
}

Pianod.prototype.playStation = function(station) {
	var self = this,
		stopCodes = [200, 204, 404],
		def = deferred();
	this.sendPianodRequest('PLAY STATION "' + (station + '').replace(/[\\"]/g, '\\$&').replace(/\u0000/g, '\\0') + '"', stopCodes).then(function(response) {
		var hasError = true;
		response.forEach(function(packet) {
			packet.forEach(function(line) {
				if (line.code === 200) {
					hasError = false;
					self.playing = {type: 'station', name: station};
				}
			});
		});
		def.resolve({error: false, data: {playing: self.playing}});
	});
	return def.promise;
}


Pianod.prototype.sendPianodRequest = deferred.gate(function(command, stopCodes) {
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
	var self = this,
		def = deferred();

	if (command) {
		self.tcpClient.write(command + "\n");
	}
	self.tcpClient.on('data', function(data) {
		self.handleResponse(data, stopCodes, def.resolve);
	});
	return def.promise;
}

Pianod.prototype.handleResponse = function(tcpData, stopCodes, callback) {
	//console.log('handleResponse', tcpData.toString());
	var self = this;
	callback = callback || function() {};
	var lines = tcpData.toString().split("\n");
	var lineIterator = 0;
	lines.forEach(function(line) {
		++lineIterator;
		line = line.trim();
		if (messageMatch = line.match(new RegExp('([0-9]{3}) (.+)', 'i'))) {
			var code = parseInt(messageMatch[1]);
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
				
				callback(self.packet);
			}
		}
	});
}

Pianod.prototype.handleClientRuntime = function(tcpData) {
	var self = this;
	//console.log('---------START-----------' + "\n", tcpData.toString().trim(), "\n" + '------------END------------');
	var lines = tcpData.toString().split("\n");
	var packet = {};
	
	lines.forEach(function(line) {
		line = line.trim();
		if (messageMatch = line.match(new RegExp('([0-9]{3}) (.+)', 'i'))) {
			var code = parseInt(messageMatch[1]);
			var message = messageMatch[2];
			switch (code) {
				case 101:
					if (timeMatch = message.match(new RegExp('([0-9]{2})\:([0-9]{2})/([0-9]{2})\:([0-9]{2})/\-([0-9]{2})\:([0-9]{2})', 'i'))) {
						self.songInfo.totalTime = {minutes:parseInt( timeMatch[3]), seconds: parseInt(timeMatch[4])};
						var timeNow = new Date();
						var playedTime = {minutes: parseInt(timeMatch[1]), seconds: parseInt(timeMatch[2])};
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
				case 105:
					self.nextEmit('songComplete');
					break;
			}
		}
	});
}
Pianod.prototype.changePlayback = function(playbackType) {
	if (this.playback !== playbackType) {
		this.nextEmit('plabackChange', playbackType);
		if (this.playback === this.PLAYBACK_TYPES.BETWEEN_SONGS && playbackType === this.PLAYBACK_TYPES.PLAYING) {
			this.nextEmit('songStart', this.getSongInfo());
		}
		else if (playbackType === this.PLAYBACK_TYPES.PAUSED) {
			this.playbackPausedAt = new Date();
			this.nextEmit('playbackPause', this.getSongInfo());
		}
		this.playback = playbackType;
	}
	
}

Pianod.prototype.getPlayerInfo = function() {
	return {playback : this.playback};
}

Pianod.prototype.setSongInfo = function(code, value) {
	var codeToFieldName = {
		'111' : 'id',
		'112' : 'album',
		'113' : 'artist',
		'114' : 'title',
		'115' : 'station',
		'116' : 'rating',
		'117' : 'seeAlso',
		'118' : 'coverArt',
	};
	if (typeof codeToFieldName[code] !== 'undefined') {
		this.songInfo[codeToFieldName[code]] = value;
	} 
}

Pianod.prototype.getSongInfo = function() {
	var songInfo = this.songInfo;
	if (songInfo.startTime) {
		var timeNow = new Date();
		
		var remainingTime = 0;
		
		if (this.playback === this.PLAYBACK_TYPES.PLAYING) {
			remainingTime = songInfo.startTime.getTime() + songInfo.totalTime.minutes * 60 * 1000 + songInfo.totalTime.seconds * 1000 - timeNow.getTime();
		}
		else if (this.playback === this.PLAYBACK_TYPES.PAUSED && this.playbackPausedAt) {
			remainingTime = songInfo.startTime.getTime() + songInfo.totalTime.minutes * 60 * 1000 + songInfo.totalTime.seconds * 1000 - this.playbackPausedAt.getTime();
		}
		
		
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
}

Pianod.prototype.nextEmit = function () {
	var self = this;
	var args = [].slice.call(arguments);
	process.nextTick(function(){
		self.emit.apply(self, args);
	});
};


function pianod (options, callback) {
	if ('function' === typeof options) {
		callback = options;
		options = {};
	}
	var p = new Pianod(options);
	p._setCallback(callback);
	return p;
}



