const __basedir = process.cwd();
const date = require("date-and-time");
const helper = require(__basedir + "/class/helper.class");

function __KANBAN__() {
    this.part = {
        id: null,
        number: null,
        partName: null,
        partNumber: null,
        moldNumber: null,
    };
    this.ct = 0; //in ms
    this.cavity = 1;
    this.target = 0;
    this.qty = 0;
    this.planKanban = 0;
    this.actKanban = 0;
}

class __production {
    constructor() {
        this.kanban = null;
        this.startTime = null;
        this._offsetStartTime = 0;
        this._duration = undefined;
        this.details = null;
        this.operator = null;

        this._ngLogs = [];
        this._cb = {};
        this._total = {
            pcs: 0,
            ng: 0,
        };

        this._ngPerKanban = 0;
        this._pcsPerKanban = 0;
        this._orderId = 0;
        this._lastKanbanId = 0;
    }

    reset() {
        this.startTime = null;
        this._total = {
            pcs: 0,
            ng: 0,
        };

        this._ngLogs = [];

        if (this._cb.onReset instanceof Function) {
            this._cb.onReset(this.summary);
        }
    }

    incPcs(count = 1) {
        if (!this.startTime) {
            return this.summary;
        }

        this._total.pcs += count * this.kanban.cavity;
        this._pcsPerKanban += count * this.kanban.cavity;

        if (this._cb.onProximity instanceof Function) {
            this._cb.onProximity(this.details, this.summary);
        }

        return this.summary;
    }

    incNG(id, count = 1) {
        if (!this.startTime || this.summary.ok - count < 0) {
            return this.summary;
        }

        this._total.ng += count;
        if (this._increment - count <= 0) {
            if (this._total.pcs - this._total.ng === 0) {
                this._increment = this._total.pcs - this._total.ng;
            } else {
                this._increment = this.kanban.qty;
            }
        } else {
            this._increment -= count;
        }
        this._ngPerKanban += count;
        this._ngLogs.push({
            id,
            timestamp: date.format(new Date(), "YYYY-MM-DD HH:mm:dd"),
        });

        if (this._cb.onProximity instanceof Function) {
            this._cb.onProximity(this.details, this.summary);
        }

        return this.summary;
    }

    updateKanban(partInfo) {
        const self = this;

        if (!self.kanban) {
            self.kanban = new __KANBAN__();
        }

        const { idQueue, part, summary, lastKanbanId, total } = partInfo;
        self.kanban.part = {
            id: part.id,
            number: part.number,
            partName: part.name,
            partNumber: part.number,
            moldNumber: part.moldNumber,
        };
        self.kanban.ct = part.ct * 1000;
        self.kanban.cavity = part.cavity;
        self.kanban.qty = part.qty_per_kbn;
        self.kanban.planKanban = summary.plan;
        self.kanban.actKanban = 0;

        (self.kanban.queueId = idQueue), (this._orderId = idQueue);

        this._ngPerKanban = 0;
        this._pcsPerKanban = 0;
        this._lastKanbanId = lastKanbanId;

        this._total.pcs = total?.pcs ?? 0;
        this._total.ng = total?.ng ?? 0;
    }

    offsetStart(ms = 0){
		if(ms && ms > 0){
			this._offsetStartTime = ms;
		}
	}

    get ok() {
        return this._total.pcs - this._total.ng;
    }
    get okPerKanban() {
        return this._pcsPerKanban - this._ngPerKanban;
    }

    get duration() {
        return this._duration;
    }

    get ct() {
        return this.ok > 0 && this.duration > 30000
            ? this.duration / this.ok
            : this.kanban?.ct;
    }

    get kanbanDone() {
        return Math.floor(this.ok / this.kanban?.qty);
    }

    get summaryPerKanban() {
        return {
            ng: this._ngPerKanban,
            ok: this.okPerKanban,
            pcs: this._pcsPerKanban,
            orderId: this._orderId,
            lastKanbanId: this._lastKanbanId,
        };
    }

    get summary() {
        return {
            ...this._total,
            ok: this.ok,
            ct: this.ct,
            kanbanDone: this.kanbanDone,
            duration: this.duration,
            kanban: this.kanban,
            orderId: this._orderId,
        };
    }
}

module.exports = __production;
