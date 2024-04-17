const __basedir = process.cwd();
const date = require("date-and-time");
const helper = require(__basedir + "/class/helper.class");

const __downtime = require(`${__basedir}/assets/js/lib/data/__downtime.js`);
const __production = require(`${__basedir}/assets/js/lib/data/__production.js`);
const __breaks = require(`${__basedir}/assets/js/lib/data/__breaks.js`);

function __SHIFT__() {
	this.id = undefined;
	this.number = undefined;
	this.date = undefined;
	this.name = undefined;
	this.plan = {
		time: {
			date: undefined,
			start: undefined,
			finish: undefined,
		},
		kanban: {},
	};
	this.breaks = [
		{
			start: "11:45:00",
			finish: "11:45:30",
    },
  ];
}

class __shift {
	init(options = {}) {
		const { interval, synchronize } = options;
		this._data = new __SHIFT__();
		this._interval = interval || 200;
		this._synchronize = synchronize || 600000; // default Server synchronization in ms

		this.breaks = new __breaks();
		this.production = new __production();
		this.dandori = new __downtime("dandori");
		this.scw = new __downtime("scw");

		this._cb = {};
	}

	start(startTime) {
		this.production.reset();
		this.production.startTime = startTime;
		this.production.details = this.details;

		if (this._cb.onStart instanceof Function) {
			this._cb.onStart(
				this.details,
				this.production.summary,
				this.production.summaryPerKanban
			);
		}

		if (this._cb.onInterval instanceof Function) {
			this._onInterval = setInterval(() => {
				this._cb.onInterval(
					this.details,
					this.production.summary,
					this.production.summaryPerKanban
				);
			}, this._interval);
		}

		if (this._cb.onSynchronize instanceof Function) {
			this._onSynchronize = setInterval(() => {
				this._cb.onSynchronize(
					this.details,
					this.production.summary,
					this.production.summaryPerKanban
				);
			}, this._synchronize);
		}
	}

	stop(){
		this.production.reset();
	};

	synchronize(_clearInterval = true) {
		if (this._cb.onSynchronize instanceof Function) {
			this._cb.onSynchronize(
				this.details,
				this.production.summary,
				this.production.summaryPerKanban
			);

			if (_clearInterval) {
				clearInterval(this._onSynchronize);
			}

			this._onSynchronize = setInterval(() => {
				this._cb.onSynchronize(
					this.details,
					this.production.summary,
					this.production.summaryPerKanban
				);
			}, this._synchronize);
		}
	}

	setCallback(event, fn) {
		if (fn instanceof Function) {
			this._cb[event] = fn;
			this.production._cb[event] = fn;
			return this;
		}

		return false;
	}

	updateShift(shiftDetails) {
		const self = this;

		self._data.id = shiftDetails && shiftDetails.id;
		self._data.date = shiftDetails && shiftDetails.date;
		self._data.number = shiftDetails && shiftDetails.number;

		self._data.plan.date = shiftDetails && shiftDetails.date;
		self._data.plan.start =
			shiftDetails && shiftDetails.plan && shiftDetails.plan.start;
		self._data.plan.finish =
			shiftDetails && shiftDetails.plan && shiftDetails.plan.finish;

		self.dandori._setShift(self._data);
		self.scw._setShift(self._data);

		self.breaks.update(shiftDetails && shiftDetails.break);
	}

	setDuration(value){
		this.production._duration = value;
	}

	get details() {
		return {
			id: this._data.id,
			name: this._data.name,
			...this._data,
		};
	}

	get operator() {
		return this.production.operator;
	}

	set operator(operator) {
		this.production.operator = operator;
	}
}

module.exports = new __shift();
