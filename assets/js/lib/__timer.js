/**
 *	Creates a TIMER.
 *	@class
 */
function TIMER(interval){
	this.isRunning = false;
	this.isPaused = false;
	this.msBase = Date.now();
	this.pause = {
			base : 0,
			current : 0,
			value : 0,
		};
	this.value = Date.now() - this.msBase;
	this.msLast = 0;
	this.interval = interval;
	this._cb = {};
	this.loop = null;
	this.msTotal = 0;
}

/** Object containing all registered timers */
const timer = {};

/**
 *	Exports new instance of class _timer
 *	@class
 */
class _timer{
	/**
	 *	Check if _name has been setor not.
	 *	@private
	 *	@returns {string} selected name
	 *	@throws Will throw an error if _name is not set yet
	 */
	_check(){
		if(!this._name || !timer[this._name]){
			delete this._name;
			throw 'ERROR : timer name is not defined';
		};

		return this._name;
	};

	/**
	 *	Clear selected name
	 *	@private
	 *	@returns {(Object|string)} passed paramater
	 */
	_clear(result){
		delete this._name;
		return result;
	};

	/**
	 *	Register new timer
	 *	@param {string} name - timer's name
	 *	@param {number} [interval=50] - update interval in ms.
	 *	@returns {Object} this class, so it can be chained
	 *	@throws return undefined and cant be chained, if name already exists
	 */
	register(name, interval = 50){
		if(timer[name]){
			console.error(`Error: Timer ${name} is already exist.`);
			return undefined;
		}

		timer[name] = new TIMER(interval);

		timer[name].loop = setInterval(()=>{
				if(timer[name].isRunning === true){
					timer[name].value = Date.now() - timer[name].pause.value - timer[name].msBase;

					if(timer[name]._cb && timer[name]._cb.onUpdate){
						timer[name]._cb.onUpdate(
								timer[name].value,
								timer[name].value + timer[name].msTotal
							);
					}
				}

				if(timer[name].isPaused){
					timer[name].pause.current = Date.now() - timer[name].pause.base;
				}

			},timer[name].interval);

		return this.use(name);
	};

	/**
	 *	Set timer's name to be executed in chained method
	 *	@param {string} name - timer's name
	 *	@example
	 *	// start a timer
	 *	_timer.use('name').start();
	 *	_timer.use('name').status();
	 *	@returns {Object} this class, so it can be chained
	 */
	use(name){
		this._name = name;
		return this;
	};

	/**
	 *	Returns registered timers
	 *	@returns {Object} object containing registered timers
	 */
	list(){
		return timer;
	};

	/**
	 *	Returns selected timer status
	 *	@returns {boolean} true if timer is running, otherwise false
	 */
	status(){
		const name = this._check();
		return this._clear(timer[name].isRunning && !timer[name].isPaused);
	};

	/**
	 *	Starts selected timer
	 *	@param {string} [resetTotal=false] - if true will reset total elapsed time to 0
	 */
	start(resetTotal = false){
		const name = this._check();

		// if timer is resumed from pause, dont overwrite msBase with new one
		if(!timer[name].isPaused){
			timer[name].msBase = Date.now();
		}

		timer[name].isRunning = true;
		timer[name].isPaused = false;
		timer[name].pause.value += timer[name].pause.current;

		if(resetTotal){
			//if resetTotal is set, total is reset to 0
			//in order to get total for every time timer is started
			//otherwise total is cumulative of all timer start
			timer[name].msTotal = 0;
		}

		if(timer[name]._cb && timer[name]._cb.onStart){
			timer[name]._cb.onStart(
					timer[name].value,
					timer[name].value + timer[name].msTotal
				);
		}

		this._clear();
	};

	/**
	 *	Stops selected timer
	 *	@param {string} [resetTotal=false] - if true will reset total elapsed time to 0
	 */
	stop(resetTotal = false){
		const name = this._check();

		timer[name].isRunning = false;
		timer[name].isPaused = false;
		this.reset(resetTotal);

		if(timer[name]._cb && timer[name]._cb.onStop){
			timer[name]._cb.onStop(
					timer[name].msLast,
					timer[name].value + timer[name].msTotal, resetTotal
				);
		}

		this._clear();
	};

	/**
	 *	Adds selected timer elapsed time or current value
	 *	@param {number} val - number to be added to elapsed time or current value
	 *	@param {string} [type=total] - 'total' : elapsed, 'current' : current value
	 */
	add(val, type = 'total'){
		const name = this._check();

		switch(type){
			case 'total' :
				timer[name].msTotal += val;
				break;

			case 'current' :
				timer[name].value += val;
				break;

			default : break;
		}

		if(timer[name]._cb && timer[name]._cb.onUpdate){
			timer[name]._cb.onUpdate(timer[name].value, timer[name].value+timer[name].msTotal);
		}

		this._clear();
	};

	/**
	 *	Pauses selected timer
	 */
	pause(){
		const name = this._check();

		timer[name].isRunning = false;
		timer[name].isPaused = true;
		timer[name].pause.base = Date.now();

		if(timer[name]._cb && timer[name]._cb.onPause){
			timer[name]._cb.onPause(timer[name].value, timer[name].value+timer[name].msTotal);
		}

		this._clear();
	};

	/**
	 *	Resets selected timer
	 *	@param {string} [resetTotal=false] - if true will reset total elapsed time to 0, otherwise will keep elapsed time
	 */
	reset(resetTotal = false){
		const name = this._check();

		if(resetTotal){
			timer[name].msTotal = 0;
		} else{
			timer[name].msTotal += timer[name].value;
		}

		timer[name].msBase = Date.now();
		timer[name].msLast = timer[name].value;
		timer[name].value = 0;
		timer[name].pause = {
			base : 0,
			current : 0,
			value : 0,
		};

		this._clear();
	};

	/**
	 *	Removes selected timer
	 */
	destroy(){
		const name = this._check();

		//stop setInterval from running ...
		clearInterval(timer[name].loop);

		//...then delete the object
		delete timer[name];

		this._clear();
	};

	/**
	 *	Sets callback function  on selected timer, to be executed on particular event
	 *	@typedef {"onUpdate" | "onStop"} timerEvents
	 *	@param {timerEvents} event - if true will reset total elapsed time to 0
	 *	@callback fn - the callback that handles the event
	 */
	setCallback(event, fn){
		const name = this._check();

		if(fn instanceof Function){
			timer[name]._cb[event] = fn;
		}

		this._clear();

		return this.use(name);
	};

	/**
	 *	Returns selected timer total elapsed time
	 *	@returns {number} elapsed time in ms
	 */
	getTotal(){
		const name = this._check();
		return this._clear(timer[name].msTotal + timer[name].value);
	};

	/**
	 *	Returns selected timer current running time
	 *	@returns {number} current running time in ms
	 */
	value(current = true){
		const name = this._check();
		return this._clear(current ? timer[name].value : timer[name].msLast);
	};
}

module.exports = new _timer();
