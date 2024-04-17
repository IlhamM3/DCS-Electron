class __scw {
    init(_list, _startTime) {
        this._SCWs = _list;
        this._startTime = _startTime;
        this._insertId = 0;
        this._currentId = undefined;
        this._steps = [
            {
                auth: [
                    {
                        name: ["leader"],
                        group: 0,
                        alias: undefined,
                    },
                ],
            },
            {
                auth: [
                    {
                        name: ["maintenance"],
                        group: 0,
                        alias: undefined,
                    },
                ],
            },
            {
                auth: [
                    {
                        name: ["maintenance"],
                        group: 0,
                        alias: undefined,
                    },
                ],
            },
            {
                auth: [
                    {
                        name: [["leader", "operator"]],
                        group: 1,
                        alias: "OPERATOR",
                    },
                ],
            },
            {
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
            },
        ];
    }

    details(id) {
        const listSCW = this.list;
        for (const parent of listSCW) {
            for (const data of parent.abnormalityReason) {
                if (data.id === id) {
                    return {
                        ...data,
                        category: parent.category,
                    };
                }
            }
        }
    }

    start(id, lastStepDuration) {
        this._problem = {
            ...this.details(id),
            stepDurations: [lastStepDuration],
            step: 1,
        };

        return this._problem;
    }

    async finish(duration) {
        const data = {
            ...this._problem,
            duration: this.totalDuration,
        };

        this.reset();

        return data;
    }

    nextStep(lastStepDuration) {
        //if Problem is empty throw erro
        if (!this._problem) {
            throw "SCW Problem is empty";
        }

        const len = this._steps.length - 1;

        this._problem.stepDurations.push(lastStepDuration);
        this._problem.onLastStep = this._problem.step >= len - 1;

        if (this._problem.step < len) {
            this._problem.step++;
            return true;
        }

        this._problem.step = len + 1;
        return false;
    }

    current(key) {
        const _current = this._problem ? this._problem : {};

        return key && _current ? _current[key] : _current;
    }

    insertId(id) {
        return (this._insertId = id);
    }

    reset() {
        this._problem = undefined;
        this._currentId = undefined;
    }

    setCurrentId(id){
        this._currentId = id;
    };

    get currentId(){
        return this._currentId;
    };

    get list() {
        return this._SCWs;
    }

    get problem() {
        return this._problem;
    }

    get insertIdBack() {
        return this._insertId;
    }

    get startTime() {
        return this._startTime;
    }
    get totalDuration() {
        return this._problem && this._problem.stepDurations
            ? this._problem.stepDurations.reduce(
                  (acc, val, idx) => acc + val,
                  0
              )
            : 0;
    }

    get authorization() {
        const stepLen = this._steps.length;
        const currentStep = this._problem ? this._problem.step : 0;

        const positions =
            currentStep < stepLen
                ? this._steps[currentStep].auth
                : this._steps[stepLen - 1].auth;

        return positions;
    }
}

module.exports = new __scw();
