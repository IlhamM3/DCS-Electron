const SerialPort = require('serialport');
const Readline = require('@serialport/parser-readline');
const EventEmitter = require('events');

function splitStringAtInterval(string, interval) {
	const result = [];
	for (var i = 0; i < string.length; i += interval) {
		result.push(string.substring(i, i + interval));
	}

	return result;
}


function determineData(data){
	if(Array.isArray(data)){
		return Buffer.from(data);
	}

	if(Number.isInteger(data)){
		return Buffer.from([data]);
	}

	if(data === undefined || data === null || data === false){
		return Buffer.from([0]);
	}

	if(data === true){
		return Buffer.from([1]);
	}

	return String(data);
}

'use strict;'
class serial extends EventEmitter {
	constructor( port, baud, com_type='ascii' ) {
		super();
		const self = this;

		// if first parameter is an Object, assigned it into self.config, otherwise manually assign each parameter
		if(port instanceof Object){
			self.conf = port;
		}
		else{
			self.conf = {
					port:port,
					baud:baud,
					com_type:com_type,
				};
		}

		this.connect();
	}

	write(data){
		const self = this;

		try{
			self.port.write(determineData(data));
			return true;
		}
		catch(error){
			console.error('serial write error : ', error);
			return false;
		}
	};

	print(msg){
		const self = this;
		self.write(msg);
	}

	println(msg){
		const self = this;
		self.print(msg+'\n');
	}

	connect(){
		const self = this;

		self.port = new SerialPort(self.conf.port, {
					baudRate: parseInt(self.conf.baud)
				},

				function (err) {
					if (err) {
						const msg = 'Error: '+ err.message;

						// trying to reconnect after 5secs on failed attempt
						if(self.conf.autoreconnect === true || self.conf.autoreconnect === undefined){
							setTimeout(()=>{
									console.error('Attempting to reconnect' + ` ${self.conf.port}[${self.conf.baud}bps] ` + '...');
									self.connect();
								},5000);
						}

						self.emit('error',msg);
						return;
					}
				}
			);

		self.port.on('close', function () {
			self.emit('error', self.conf.port + ' is closed');
		});

		self.port.on('open', function () {
			self.emit('open', 'Connected to:' + self.conf.port + ' baudrate:' + self.conf.baud + 'bps');
		});

		if(self.conf.com_type==='hex'){
			self.port.on('data', (data) => {
				// remove trailing whitespace
				data = data.trim();

				const raw = data.toString('hex');
				const ascii = data.toString('utf8');
				const received = splitStringAtInterval(raw,2);
				const response = {
					status:true,
					received,
					ascii,
					raw:Buffer.from(received),
					length:received.length
				};

				self.emit('data',response);
			});
		}
		else{
			self.lineStream = self.port.pipe(new Readline('\n'));
			self.lineStream.on('data', (data) => {
				let response = {};

				// remove trailing whitespace
				data = data.trim();

				try {
					response = {
							status : true,
							data : JSON.parse(data),
						};
				}
				catch (err) {
					response = {
						status : true,
						data : data,
						ascii : Buffer.from(data),
					}
				}

				// only emit data if it's not empty or if it's an integer (cos 0 means false too)
				/** somehow '' means false in JS **/
				if(response.data || Number.isInteger(response.data)){
					self.emit('data',response);
				}
			});
		}
	}
}

module.exports = serial;
