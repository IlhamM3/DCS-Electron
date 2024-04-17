const eventEmitter = require('events');

const __pcsc = require('pcsclite');
let pcsc;

const _CONSTANTS = {
	HEADERS: {
		read: [0xFF, 0xB0, 0x00],
		write: [0xFF, 0xD6, 0x00],
	},
	status: [0xFF, 0x00, 0x00, 0x00, 0x02, 0xD4, 0x04],
	timeout: [0xFF, 0x00, 0x41, 0x01, 0x00],
	loadKey: [0xFF, 0x82, 0x00, 0x00, 0x06, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0],
	authenticate: [0xFF, 0x86, 0x00, 0x00, 0x05, 0x01, 0x00, 16, 0x61, 0x00],
	authentication: function(blockNumber){
		const header = [...this.authenticate];
		header[7] = blockNumber;
		return header;
	}
};

function sleep(ms){
	return new Promise(resolve => setTimeout(resolve, ms))
};

function formatStatus(status){
	status = status.readUInt16BE();

	if(status == 0x9000){
		return true;
	}

	if(status == 0x6300){
		return false;
	}

	return null;
}

function formatReceived(received){
	const length = received.length;
	const data = received.slice(0, length-2);
	const status = formatStatus(received.slice(length-2, length));

	return {status, data};
}

class __pcsc_helper extends eventEmitter{
	constructor(){
		super();
		this.init();
	}

	init(){
		const self = this;

		pcsc = __pcsc();

		self._reader = undefined;
		self._protocol = undefined;

		self._expectedLength = 128;
		self._bytePerBlock = 0x10;
		self._delayms = 50;

		pcsc.on('reader', function(reader) {
			self._reader = reader;

			reader.on('error', function(err) {
				self.emit('error', err);
			});

			reader.on('status', function(status) {
				self.emit('status', status);

				const changes = this.state ^ status.state;
				if (changes) {
					if ((changes & this.SCARD_STATE_EMPTY) && (status.state & this.SCARD_STATE_EMPTY)) {
						reader.disconnect(reader.SCARD_LEAVE_CARD, function(err) {
							if (err) {
								console.log(err);
							} else {
								self.emit('removed');
								self._protocol = undefined;
							}
						});
					} else if ((changes & this.SCARD_STATE_PRESENT) && (status.state & this.SCARD_STATE_PRESENT)) {
						reader.connect({ share_mode : this.SCARD_SHARE_SHARED }, function(err, protocol) {
							if (err) {
								console.log(err);
								self.emit('error', err);
							} else {
								self._protocol = protocol;
								self.emit('inserted', protocol);
							}
						});
					}
				}
			});

			reader.on('end', function() {
				console.log('Reader',  this.name, 'removed');
				self.emit('end');
			});
		});

		pcsc.on('error', function(err) {
			console.log('PCSC error', err.message);
			self.emit('error', err);
		});
	};

	_padBuffer(_buffer){
		const _modulo = _buffer.length % 0x10;

		if(_modulo === 0){
			return _buffer;
		}

		const padLength = 0x10 - _modulo;
		const _padder = [];
		for(let counter = 0; counter < padLength; counter++){
			_padder.push(0x00);
		}

		return Buffer.from([..._buffer, ..._padder]);
	}

	_restart(){
		const self = this;

		if(!self._reader || !self._protocol){
			return -1;
		}

		console.error('restart');

		self._reader.close();
		pcsc.close();

		self.init();
	};

	_write(data, _startingBlock = 0x04){
		const self = this;

		if(!self._reader || !self._protocol){
			return -1;
		}

		data = self._padBuffer(Buffer.from(data));
		const length = data.length;
		const expectedLength = length + 2;

		return new Promise(resolve => {
			self._reader.transmit(Buffer.from([ ..._CONSTANTS.HEADERS.write, _startingBlock, length, ...data]), 2, self._protocol, function(err, data) {
					if (err) {
						console.log(err);
						self._restart();
						resolve([-1, err]);
					} else {
						const value = {action: 'write', ...formatReceived(data)};
						self.emit('data', value);
						resolve(value);
					}
				});
		});
	};

	_read(length = 16, _startingBlock = 0x04){
		const self = this;

		if(!self._reader || !self._protocol){
			return -1;
		}

		const expectedLength = length + 2;
		return new Promise(resolve => {
			self._reader.transmit(Buffer.from([ ..._CONSTANTS.HEADERS.read, _startingBlock, length]), expectedLength, self._protocol, function(err, data) {
					if (err) {
						console.log(err);
						self._restart();
						resolve([-1, err]);
					} else {
						const value = {action: 'read', ...formatReceived(data)};
						self.emit('data', value);
						resolve(value);
					}
				});
		});
	};

	async writeBlocks(data = '', _startingBlock = 4, _maxLength = 48){
		const self = this;

		let _buffer = Buffer.from(data);
		const length = _buffer.length;
		const blockIndex = {
				current: _startingBlock,
				max: _startingBlock + Math.ceil(length / self._bytePerBlock),
			};

		const response = {
			status: true,
			data: [],
		};

		for(let index = 0; index < length, blockIndex.current < blockIndex.max; blockIndex.current++){
			if(blockIndex.current % 4 === 0){
				await self._authenticate(blockIndex.current);
			}

			if(blockIndex.current % 4 === 3){
				++blockIndex.max;
				continue;
			}

			const _block = _buffer.slice(index, index + self._bytePerBlock);
			const write = await self._write(_block, blockIndex.current);

			response.status = response.status && write.status;
			response.data.push(_block);

			index += self._bytePerBlock;

			await sleep(self._delayms);
		}

		return response;
	};

	async readBlocks(_startingBlock = 4, length = 0){
		const self = this;

		if(length <= 0){
			length = 4;
		}

		const blockIndex = {
				current: _startingBlock,
				max: _startingBlock + length,
			};

		const response = {
			status: true,
			data: '',
		};

		for(; blockIndex.current < blockIndex.max; blockIndex.current++){
			if(blockIndex.current % 4 === 0){
				await self._authenticate(blockIndex.current);
			}

			if(blockIndex.current % 4 === 3){
				continue;
			}

			const read = await self._read(0x10, blockIndex.current);
			response.status = response.status && read.status;
			response.data += read.data.toString();

			await sleep(self._delayms);
		}

		response.data = response.data.replace(/[^\x01-\x7F]/g,"");

		try{
			response.data = JSON.parse(response.data);
		} catch(error) {
			console.error('not JSON', error);
		} finally {
			return response;
		}
	};

	_authenticate(blockNumber = 4){
		const self = this;

		if(!self._reader || !self._protocol){
			return -1;
		}

		return new Promise(resolve => {
			self._reader.transmit(Buffer.from(_CONSTANTS.authentication(blockNumber)), self._expectedLength, self._protocol, function(err, data) {
					if (err) {
						console.log(err);
						self._restart();
						resolve([-1, err]);
					} else {
						const value = {action: 'auth', ...formatReceived(data)};
						console.log('auth', value);
						self.emit('data', value);

						resolve(value);
					}
				});
		});
	};

	_setTimeout(val = 0){
		const self = this;

		if(!self._reader || !self._protocol){
			return -1;
		}

		const payload = _CONSTANTS.timeout;
		payload[3] = val;
		return new Promise(resolve => {
			self._reader.transmit(Buffer.from(payload), self._expectedLength, self._protocol, function(err, data) {
					if (err) {
						console.log(err);
						self._restart();
						resolve([-1, err]);
					} else {
						const value = {action: 'setTimeout', ...formatReceived(data)};
						console.log('setTimeout', data);
						self.emit('data', value);

						resolve(value);
					}
				});
		});
	};

	_status(blockNumber = 4){
		const self = this;

		if(!self._reader || !self._protocol){
			return -1;
		}

		return new Promise(resolve => {
			self._reader.transmit(Buffer.from(_CONSTANTS.status), self._expectedLength, self._protocol, function(err, data) {
					if (err) {
						console.log(err);
						self._restart();
						resolve([-1, err]);
					} else {
						const value = {action: 'status', ...formatReceived(data)};
						self.emit('data', value);

						resolve(value);
					}
				});
		});
	};

	_loadKey(blockNumber = 4){
		const self = this;

		if(!self._reader || !self._protocol){
			return -1;
		}

		return new Promise(resolve => {
			self._reader.transmit(Buffer.from(_CONSTANTS.loadKey), self._expectedLength, self._protocol, function(err, data) {
					if (err) {
						console.log(err);
						self._restart();
						resolve([-1, err]);
					} else {
						const value = {action: 'loadKey', ...formatReceived(data)};
						self.emit('data', value);

						resolve(value);
					}
				});
		});
	};

	bytesToBlockLength(byteLength = 0){

	};
};

module.exports = new __pcsc_helper();
