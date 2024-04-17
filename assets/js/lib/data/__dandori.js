class __dandori {
    init(_list) {
        this.dandori = _list;
        this._insertId = 0;
        this._dandoriScw = 0;
        this._scw = {
            status: false,
            auth: [
                {
                    name: ["maintenance"],
                    group: 0,
                    alias: undefined,
                },
                {
                    name: [["leader", "operator"]],
                    group: 1,
                    alias: "OPERATOR",
                },
            ],
            duration: 0,
        };
    }

    insertId(id) {
        return (this._insertId = id);
    }

    get insertIdBack() {
        return this._insertId;
    }

    insertIdDandoriSCW(id) {
        return (this._dandoriScw = id);
    }

    get insertIdBackDandoriSCW() {
        return this._dandoriScw;
    }

    get scw() {
        return this._scw.status ? this._scw : null;
    }

    get list() {
        return this.dandori;
    }

    details(id) {
        for (const item of this.dandori) {
            if (item.id === id) {
                return item;
            }
        }
    }

    startSCW() {
        this._scw.status = true;

        // this.problem = {
        //   ...this.problem,
        //   scw: this._scw,
        // };

        return this._scw;
    }

    start(id) {
        this.problem = {
            ...this.details(id),
        };

        return this.problem;
    }

    current(key) {
        const _current = this.problem ? this.problem : {};

        return key && _current ? _current[key] : _current;
    }

    async finish(duration) {
        const data = {
            ...this.problem,
            duration,
        };

        delete this.problem;

        return data;
    }
}

module.exports = new __dandori();
