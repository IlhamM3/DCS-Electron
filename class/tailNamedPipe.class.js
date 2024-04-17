const fs = require('fs');
const net = require('net');
const EventEmitter = require('events');
const { exec } = require('child_process');

//this class created based on this question : https://stackoverflow.com/questions/52608586/node-js-fs-open-hangs-after-trying-to-open-more-than-4-named-pipes-fifos
class __tailNamedPipe extends EventEmitter{
	constructor(path, writePath = null, separator = /\r?\n/gm){
		super();
		this.__path = path;
		this.__writePath = writePath;
		this.__separator = separator; //must be a regexp

		//flags
		this.__isRunning = false;
		this.__isAlreadyRunning = false;
	}

	create(){
		const self = this;

		for(const path of [self.__path, self.__writePath]){
			if(path){
				if(!fs.existsSync(path)){
					exec('mkfifo ' + path, (error)=>{
						if(error){
							throw error;
						}

						return;
					});
				}
			}
		}
	};

	async __read(){
		const self = this;

		//convert callback into promise, so it can be used in async-await
		return new Promise((resolve, reject) => {
			fs.open(this.__path, fs.constants.O_RDONLY | fs.constants.O_NONBLOCK, (error, fd) => {
				if(error){
					reject({
							code : 500, // 500 : error in fs execution
							error,
						});
				}

				//create a stream that can be used for reading from the FIFO.
				const pipe = new net.Socket({ fd });

				pipe.on('data', (data) => {
					//remove all listener and destroy pipe, avoiding memory leaks
					self.removeAllListeners('__ABORT__');
					pipe.destroy();

					//if separator is defined, assumes data is in string and trim id, otherwise just resolve data as it is
					resolve(this.__separator ? data.toString().trim() : data);
				});

				//if __ABORT__ is emitted, cancel all connection and reject
				self.on('__ABORT__', ()=>{
					//set flags to initial state
					self.__isRunning = false;
					self.__isAlreadyRunning = false;

					//remove all listener and destroy pipe, avoiding memory leaks
					self.removeAllListeners('__ABORT__');
					pipe.destroy();

					reject({
							code : 0,
							error : 'ABORTED',
						});
				});
			});
		});
	};

	async start(run = true){
		const self = this;

		//handling if start already run, do nothing
		if(self.__isAlreadyRunning){
			return;
		}

		self.__isRunning = run;

		if(self.__isRunning === true){
			self.__isAlreadyRunning = self.__isRunning;
			try{
				const read = await self.__read();

				//emits only if at least there is a listener
				if(self.listenerCount('data') > 0){
					//split by defined separator, if in example there is only 1 line, it should yield a single element array
					if(this.__separator){
						const lines = read.split(this.__separator);

						for(const line of lines){
							self.emit('data', line);
						}
					}
					//unless separator is falsy, emit everything at once
					else{
						self.emit('data', read);
					}
				}
			}
			catch(error){
				// code 0 means closed
				if(error.code === 0){
					if(self.listenerCount('closed') > 0){
						self.emit('closed', error);
					}
				} else{
					console.error('Encountered Error, reading process is stopped.');

					//set __isRunning to false, preventing next reading process
					self.__isRunning = false;

					//emits only if at least there is a listener
					if(self.listenerCount('error') > 0){
						self.emit('error', error);
					} else{
						console.error(error);
					}
				}
			}
			finally{
				//set __isAlreadyRunning to false to be able to start
				//__isAlreadyRunning handles multiple calls from external source only, not from inside
				self.__isAlreadyRunning = false;

				//recursively call itself until stopped
				self.start(self.__isRunning);
			}
		}
	};

	stop(){
		const self = this;

		//emits abort in case there's still a reading process
		self.emit('__ABORT__', false);
		self.start(false);
		self.removeAllListeners('__ABORT__');
	};

	write(data){
		const self = this;

		// writing to different pipe is better, cos writing to pipe without listener will block the process
		// but use path instead if writePath is not defined, although it's not a good practice
		return fs.promises.writeFile(self.__writePath || self.__path, data)
			.then(res => true)
			.catch(error => {
				return {
						code : 500, // 500 : error in fs execution
						msg : 'Tail write to \''+self.__writePath || self.__path+'\'',
						error,
					};
			});
	};
}

module.exports = __tailNamedPipe;
