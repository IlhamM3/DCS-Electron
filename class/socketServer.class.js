const net = require('net');
const fs = require('fs');
const EventEmitter = require('events');
const ipRangeCheck = require('ip-range-check');
const JSON5 = require('json5');

class __server extends EventEmitter {
	constructor(path, port = 0, whitelist, debug = false){
		super();
		this._isTCP = net.isIP(path) ? true : false;
		this._path = path;
		this._port = port;
		this._whitelist = whitelist
			? Array.isArray(whitelist) ? whitelist : [whitelist]
			: undefined;
		this._clients = {};
		this._aliases = {};
		this._debug = debug;

		// create server
		this._create();
	}

	/**
	 *	Create socket server TCP or UNIX socket
	 * */
	_create(){
		const self = this;

		self.server = net.createServer(function(socket) {
			socket.pipe(socket);
		});

		if(self._isTCP){
			self.server.listen(self._port, self._path);
		} else{
			self.server.listen(self._path);
		}

		self.server.on('listening', function() {
			console.log('Server : Listening to ', self.server.address());
		});

		self.server.on('connection', function(socket) {
			if(self._isTCP && self._whitelist){
				let isAllowed = false;
				for(const allowed of self._whitelist){
					const __check = ipRangeCheck(socket.remoteAddress, allowed);
					isAllowed |= __check;
				}

				if(!isAllowed){
					if(self._debug){
						console.error(`${socket.remoteAddress}:${socket.remotePort} is not in whitelist. Connection blocked.`);
					}

					socket.end();
					socket.destroy();
					return;
				}
			}

			if(self._isTCP){
				//for TCP connecntion, use remote IP and port as id
				const clientId = `${socket.remoteAddress}:${socket.remotePort}`;
				self._clients[clientId] = socket;
				socket.id = clientId;
			} else{
				// generate random number as client id
				const randomId = Math.round(Math.random() * (10 ** 10));
				socket.id = randomId;
				// add to connected clients
				self._clients[randomId] = socket;
				// send generated id to client
				socket.write(JSON5.stringify({
						code : 1,
						id : randomId,
					})
				);
			}

			if(self._debug){
				console.log('Connection established.', self._isTCP ? `From ${socket.remoteAddress}:${socket.remotePort}` : ``);
			}

			socket.on('data', function(chunk) {
				const data = chunk.toString().replace(/[^\x20-\x7E]+/g, "").trim();

				try{
					const obj = JSON5.parse(data);

					// reserved {code : 1}, as a message to acknowledge between server and clients
					if(+obj.code === 1){
						if(obj.alias != null){
							self._aliases[obj.alias] = `${socket.remoteAddress}:${socket.remotePort}`;
						}
					} else{
						self.emit('json', obj);
						//always emit 'data'
						self.emit('data', data);
					}
				}
				catch(error){
					//always emit 'data'
					self.emit('data', data);
				}
			});

			socket.on('end', function() {
				if(self._debug){
					console.log('Closing connection with the client ', socket.remoteAddress ?? self._isTCP);
				}
			});

			socket.on('error', function(err) {
				console.error(socket.id,':',err);
				if (err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED') {
					self._deleteClient(socket.id);
				}
			});
		});

		self.server.on('error', function(err) {
			if (err.code === 'EADDRINUSE') {
				if(self._debug){
					console.error('Address in use, retrying...');
				}

				setTimeout(() => {
					self.server.close();

					if(self._isTCP){
						self.server.listen(self._port, self._host);
					} else{
						fs.unlinkSync(self._path);
						self.server.listen(self._path);
					}
				}, 500);
			}
		});
	};

	/**
	 * Delete client with particular id from list clients
	 * */
	_deleteClient(id){
		const self = this;

		self._clients[id].end();
		self._clients[id].destroy();
		delete self._clients[id];

		for(const key in self._aliases){
			if(self._aliases[key] === id){
				delete self._aliases[key];
				break;
			}
		}
	};

	/**
	 * Write data to one of connected clients
	 * @param {string} dest - can be client's alias or IP:port/unique client id
	 * @returns {boolean} write status
	 * */
	send(dest, msg){
		const self = this;

		if(self._aliases[dest]){
			dest = self._aliases[dest];
		}

		return self._clients[dest].write(msg instanceof Object ? JSON5.stringify(msg) : msg);
	};

	/**
	 * Returns list of connected clients
	 * @returns {Object[]} connected clients
	 * */
	getConnectedClients(){
		const self = this;
		const list = [];
		const _aliases = {};

		for(const key in self._aliases){
			_aliases[self._aliases[key]] = key;
		}

		for(const key in self._clients){
			if(_aliases[key]){
				list.push({id:key, alias:_aliases[key]});
			} else {
				list.push({id:key});
			}
		}

		return list;
	};
}

module.exports = __server;
