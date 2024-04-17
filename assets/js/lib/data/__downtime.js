const __basedir = process.cwd();
const date = require('date-and-time');
const helper = require(__basedir + '/class/helper.class');

function __DOWNTIME__(group){
	this.group = group;
	this.id = undefined;
	this.category = {
		id: undefined,
		name: undefined,
		parent: {
			id: undefined,
			name: undefined,
		},
	},
	this._time = {
		start: undefined,
		finish: undefined
	};
	this.type = undefined;
	this.plan = {
		duration: undefined,
	};
}

class __downtime{
	constructor(type){
		this._type = type;
		this._current = undefined;
		this._shift = undefined;
		this._cb = {};
	}

	_setShift(shift){
		this._shift = shift;
	};

	init({id, name, parent, type, plan}){
		this._current = new __DOWNTIME__(this._type);

		this._current.category.id = id;
		this._current.category.name = name;
		this._current.category.parent = parent || {};
		this._current.type = type || 'B';
		this._current.plan = plan || {};

		return this.current;
	};

	setId(id){
		this._current.id = id;
		return this.current;
	};

	start(){
		this._current._time.start = new Date();

		if(this._cb.onStart instanceof Function){
			this._cb.onStart(this.current);
		}

		return this.current;
	};

	finish(){
		this._current._time.finish = new Date();

		if(this._cb.onFinish instanceof Function){
			this._cb.onFinish(this.current);
		}

		return this.current;
	};

	setCallback(event, fn){
		if(fn instanceof Function){
			this._cb[event] = fn;
			return this;
		}

		return false;
	};

	get current(){
		return {
			...this._current,
			id: this._current.id,
			category: {...this._current.category},
			shift: {
				id: this._shift.id,
				date: this._shift.date,
				number: this._shift.number,
			},
			time: {
				start: helper.formatDate(this._current._time.start),
				finish: helper.formatDate(this._current._time.finish),
				duration: helper.msToHms(
					this._current._time.finish
						? this._current._time.finish - this._current._time.start
						: 0,
					),
			},
			plan: this._current.plan,
			type: this._current.type,
		}
	};
}

module.exports = __downtime;
