const helper = require(`${__basedir}/class/helper.class.js`);

const EventEmitter = require("events");

class __authorization extends EventEmitter {
	/**********
	 * Init variables.
	 * ********/
	constructor() {
		super();
		this._positions = {};
		this._required = {};
		this._verification = {
			_limit: 0,
			_counter: 0,
		};
		this._cb = {};
	}

	/**********
	 *	Insert new id, name, and level into _positions
	 *	@param {number} id - Position id
	 *	@param {string} name - position name
	 *	@param {number} level - position level
	 * 	@returns {boolean} if created id is not unique or parameters are null will returns false, otherwise true
	 * ********/
	_addToList(id, name, level) {
		if (id != null && name != null && level != null) {
			if (!this._positions[id]) {
				this._positions[id] = {
					id,
					level: +level,
					name: name.toUpperCase()
						.trim(),
				};

				return true;
			}

			console.error(`id '${id}' already exists`, id, name, level);
			return false;
		}

		console.error(`Invalid 'position' object`, id, name, level);
		return false;
	}

	/**********
	 *	Returns array of positions in the same group
	 *	@param {Object} position - _required Object with specific id, should be passed like this._required[id]
	 * 	@returns {Object[]} array of positions in the same group if group is truthy, else returns undefined
	 * ********/
	_getSameGroup(position) {
		const group = position.group;

		if (group == null) {
			// if group is undefined, return _positions with same id
			return [this._positions[position.id]];
		}

		const _list = [];
		for (const key in this._required) {
			const _required = this._required[key];
			if (_required.group != null && group === _required.group) {
				_list.push(this._positions[_required.id]);
			}
		}

		return _list;
	}

	/**********
	 *	Drop user with assigned group from list
	 *	@param {number} group - group id to be dropped
	 * ********/
	_removeGroup(group) {
		for (const key in this._required) {
			//remove all position with same group, if only group isnt null
			if (
				this._required[key].group != null &&
				group === this._required[key].group
			) {
				delete this._required[key];
			}
		}
	}

	/**********
	 *	Sets auth session, for marking which part current authorization is needed. session will be deleted once list is clear
	 *	@param {string} sessName - session to be set
	 * 	@returns {Object} - this class so it can be chained
	 * 	@throws Will return false if session already exist, can't be chained
	 * ********/
	use(sessName) {
		if (!this._session) {
			this._session = sessName;
		} else if (this._session != sessName) {
			// if session is already set, but the name provided is different, return false
			return false;
		}

		return this;
	}

	/**********
	 *	List registered positions
	 *	@param {boolean} asArray - if true, returns object as array
	 *	@returns {(Object|Object[])}
	 * ********/
	listPosition(asArray = true) {
		return asArray
			? Object.keys(this._positions)
				.map((key) => this._positions[key])
			: this._positions;
	}

	/**********
	 *	Returns list in _required
	 *	@param {boolean} asArray - if true, returns object as array
	 *	@returns {(Object|Object[])}
	 * ********/
	listRequired(asArray = true) {
		return asArray ?
			Object.keys(this._required)
			.map((key) => this._required[key]) :
			this._required;
	}

	/**********
	 *	Reset _required list and execute callback if defined
	 * ********/
	resetRequired() {
		const _session = this.session;
		this._required = {};
		this._verification = {
			_limit: 0,
			_counter: 0,
		};

		this.emit(this.session);
		delete this._session;

		if (this._cb && this._cb.onReset) {
			this._cb.onReset(this.listPosition(), _session);
		}

		return this;
	}

	/**********
	 *	Insert new positions. If array is passed, it will stop once meets an error
	 *	@param {Object} needle - the object containing element id,name,level
	 *	@param {Object[]} needle - the array containing list of objects with element id,name,level
	 * 	@returns {Object} this class so it can be chained
	 * 	@throws will return false if _addToList false
	 * ********/
	insert(position) {
		if (Array.isArray(position)) {
			for (const item of position) {
				if (!this._addToList(item.id, item.name, item.level)) {
					return false;
				}
			}
		}
		else {
			const item = position;
			if (!this._addToList(item.id, item.name, item.level)) {
				return false;
			}
		}

		return this;
	}

	/**********
	 *	Alias for insert(array). will do nothing if positions is not array
	 *	@param {Object[]} needle - the array containing list of objects with element id,name,level
	 * 	@returns {(Object|boolean)} if needle is not array, will return false, otherwise will return what this.insert returns
	 * ********/
	init(positions) {
		if (Array.isArray(positions)) {
			return this.insert(positions);
		}

		return false;
	}

	/**********
	 *	find positions on _positions
	 *	@param {Object} needle - the object containing element id,name,level. null/undefined value would be considered not needle
	 *	@param {boolean} returnFirstOnly - if set to true, will returns the first element only
	 * 	@returns {(Object|Object[])}
	 * 	@throws Will return null if needle is not found
	 * ********/
	find(needle, returnFirstOnly = false) {
		const found = [];

		for (const key in this._positions) {
			const item = this._positions[key];
			let status = false;

			if (needle.id != null && item.id === needle.id) {
				status |= true;
			}

			if (
				needle.name != null &&
				item.name === needle.name.toUpperCase()
				.trim()
			) {
				status |= true;
			}

			if (needle.level != null && item.level === needle.level) {
				status |= true;
			}

			if (status) {
				found.push(item);
			}
		}

		return found.length <= 0 ?
			null :
			returnFirstOnly && found[0] ?
			found[0] :
			found;
	}

	/**********
	 *	add required verification, will trigger callback function if defined
	 *	@param {number} id - id should match this on verification
	 *	@param {boolean} matchPos - if true verification must match required pos, otherwise will match level greater or equal to required level
	 *	@returns {Object} this class so it can be chained
	 *	@throws Will return false and can't be chained, if id doesnt exist in _positions
	 * ********/
	addRequired(id, matchPos = false, group, alias) {
		if (id.id != null && id.group != null) {
			group = group ?? id.group;
			alias = alias ?? id.alias;
			id = id.id;
		}

		// add only if id isn't already registered
		if (this._positions[id] && !this._required[id]) {
			this._required[id] = {
				...this._positions[id],
				matchPos,
				group,
				alias,
				_done: false,
			};

			if (this._cb && this._cb.onAdded) {
				this._cb.onAdded(this.listRequired(), this.session);
			}

			return this;
		}

		return false;
	}

	/**********
	 *	add required verification by name
	 *	@param {string|string[]|Object} name - name of _positions.
	 *	@param {boolean} matchPos - if true verification must match required pos, otherwise will match level greater or equal to required level
	 *	@returns {Object} this class so it can be chained
	 *	@throws Will return false and can't be chained, if id doesnt exist in _positions
	 * ********/
	addRequiredByName(name, matchPos = false, group, alias) {
		if (name.name != null && name.group != null) {
			group = group ?? name.group;
			alias = alias ?? name.alias;
			name = name.name;
		}

		console.log("add:", name, group, alias);

		if (Array.isArray(name)) {
			let __add;
			for (const tmp of name) {
				__add = this.addRequiredByName(tmp, matchPos, group, alias);

				if (__add === false) {
					break;
				}
			}

			return __add;
		}

		const position = this.find({ name }, true);

		// add only if position found
		if (position) {
			return this.addRequired(position.id, matchPos, group, alias);
		}

		return false;
	}

	/**********
	 *	Verify if id is matched with required position, and execute callbacks if defined
	 *	@param {number} id - id to be matched
	 *	@returns {boolean} status verification found or not
	 * ********/
	verify(id) {
		const needle = this._positions[id];

		if (!needle) {
			console.error(`id '${id}' is not found`, needle, this._positions);
			if (this._cb && this._cb.onFailed) {
				this._cb.onFailed(this._positions[id], this.session);
			}
			return false;
		}

		let status = false;
		for (const key in this._required) {
			const item = this._required[key];
			if (!item._done) {
				const matched = item.matchPos ?
					needle.id === item.id :
					needle.level >= item.level;

				status |= matched;
				item._done |= matched;

				if (matched) {
					++this._verification._counter;

					if (this._cb && this._cb.onVerified) {
						this._cb.onVerified(item, this.session);
					}

					const group = this._required[key].group;

					//drop from list
					delete this._required[key];
					//drop all position with same group
					this._removeGroup(group);
				}
			}
		}

		// if _required is already empty, run callback if it has been set
		if (!this.status) {
			this.resetRequired();
		}

		//if status still false, meaning verification failed. Run callbak if it's been set
		if (this.status && !status && this._cb && this._cb.onFailed) {
			this._cb.onFailed(this._positions[id], this.session);
		}

		return status;
	}

	/**********
	 *	Verify if position name is matched with required position
	 *	@param {string} name - position name to be matched
	 *	@returns {boolean} status verification found or not
	 * ********/
	verifyByName(name) {
		const position = this.find({ name }, true);

		// verify only if position found
		if (position) {
			return this.verify(position.id);
		}

		return false;
	}

	/**********
	 *	Set callback to be executed on defined event
	 *	@param {string} event - event's name to mark when callback would be executed, accept only verified & reset for now
	 *	@param {function} fn - callback function
	 *	@returns {boolean} status success or not
	 * ********/
	setCallback(event, fn) {
		if (fn instanceof Function) {
			this._cb[event] = fn;
			return true;
		}

		return false;
	}

	/**********
	 *	To hold next execution until list is cleared
	 *	@param {function} fnWait - callback function to be executed when not resolved
	 *	@param {function} fnFinish - callback function to be executed once resolved
	 *	@param {number} interval - interval between waiting
	 *	@param {boolean} onFirstTime - set to true if run for the firs time, i.e. when called from external
	 *	@returns {Promise} will resolve if list is clear
	 * ********/
	async waitForAuth(fnFinish, fnWait, interval = 5, onFirstTime = true) {
		const self = this;
		const currentSession = self.session;

		// if waitForAuth is run for the first time, delete _clearWait
		if (onFirstTime) {
			delete self._clearWait;
		}

		while(true){
			const isDifferentSession = currentSession != self.session && self.session != null;
			if (self._clearWait	|| isDifferentSession) {
				// session is forcefuly changed or ended
				return false;
			}

			if (self.status) {
				// set onFirstTime to false, because it's already run
				onFirstTime = false;

				if (fnWait instanceof Function) {
					fnWait();
				}

				// sleep to slow down the loop
				await helper.sleep(interval);

				continue;
			} else {
				if (fnFinish instanceof Function) {
					fnFinish();
				}

				delete self._clearWait;

				// session is authorized and ended gracefully
				return true;
			}
		}
	}

	/**********
	 *	Stop waitForAuth()
	 * 	@returns {Object} this class so it can be chained
	 * ********/
	clearWaitForAuth() {
		this._clearWait = true;
		this.resetRequired();
		return this;
	}

	/**********
	 *	Returns current session
	 * 	@returns {string}
	 * ********/
	get session() {
		return this._session;
	}

	/**********
	 *	Returns 'true' if there's item in _required
	 * 	@returns {boolean}
	 * ********/
	get status() {
		return Object.keys(this._required)
			.length !== 0;
	}
}

module.exports = new __authorization();
