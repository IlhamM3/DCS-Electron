const __basedir = process.cwd();
const date = require('date-and-time');
const helper = require(__basedir + '/class/helper.class');

class __breaks{
	constructor(){
		this._breaks = [];
		this.auth = {
				name : [['leader','operator']],
				group : 1,
				alias : 'OPERATOR',
			};
	}

	update(options = {}){
		if(options && options.start && options.finish){
			this._breaks = [{...options}];

			return this._breaks;
		}

		return null;
	};

	list(redo = false){
		if(redo || !this._breaks.list){
			this._breaks.list = this._breaks.map(item=>{
				return {
						...item,
						duration : helper.clockHMSDiff(item.start, item.finish),
					};
			});
		}

		return this._breaks.list;
	};

	totalDuration(redo = false){
		if(redo || !this._breaks.totalDuration){
			this._breaksTotalDuration = 0;
			for(const item of this._breaks){
				this._breaksTotalDuration += (helper.clockHMSDiff(item.start, item.finish));
			}

		}

		return this._breaksTotalDuration;
	};
}

module.exports = __breaks;
