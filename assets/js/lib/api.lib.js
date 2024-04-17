const eventEmitter = require("events");
const dns = require("dns").promises;
const axios = require("axios");
const date = require("date-and-time");
const fs = require("fs");
const __ws = require(`${__basedir}/assets/js/lib/ws.lib.js`);

const helper = require(`${__basedir}/class/helper.class`);
const _transformError = (error) => {
    return {
        code: error.code,
        errno: error.errno,
        syscall: error.syscall,
        url: error.request && error.request._currentUrl,
        response: error.response,
    };
};

class __api extends eventEmitter {
    constructor(config, debug = false) {
        super();
        this.init(config, debug);
    }

    init(config, debug = false) {
        this.config = config;
        this.baseURL = config.api.baseurl;
        this.debug = debug;
        this.delayBetweenLoginAttempt = 2000;

        this.certificate =
            this.config &&
            this.config.api &&
            this.config.api.certificate &&
            fs.existsSync(this.config.api.certificate)
                ? Buffer.from(
                      fs.readFileSync(this.config.api.certificate, "ascii")
                  ).toString("Base64")
                : null;

        this.options = {
            baseURL: this.baseURL + "/api/",
            headers: {
                "content-type": "application/json",
                Accept: "application/json",
            },
            timeout: 7500,
            transformResponse: [
                function (_response) {
                    const response = JSON.parse(_response);

                    if (!response.status) {
                        throw response.error;
                    }

                    return response.data;
                },
            ],
        };

        this._login = {
            status: false,
            timestamp: 0,
        };
        this.websocket = new __ws(`${this.baseURL}/ws`, debug);
    }

    /**
     *	emit data if only there is at least 1 listener
     *	@private
     *	@param {string} eventName - event name to be emitted
     *	@param {*} value - event data, any datatype can be emitted
     * */
    _emit(eventName, value) {
        const self = this;
        if (self.listenerCount(eventName) > 0) {
            self.emit(eventName, value);
            return true;
        }

        return false;
    }

    async _checkConnectivity() {
        const self = this;

        // check internet connectivity with cloudfare dns
        const internet = await dns
            .lookupService("1.1.1.1", 80)
            .then((data) => {
                return {
                    status: true,
                    data,
                };
            })
            .catch((error) => {
                if (self.debug) {
                    console.error("_checkConnectivity error", error);
                }

                return {
                    status: false,
                    error,
                };
            });

        let serverAddress = self.baseURL.match(
            /^(http|https)\:\/\/([a-z0-9\-\.\:]+)/
        );

        if (!serverAddress) {
            return {
                status: false,
                error: {
                    internet: internet.error,
                    server: "Server address is not defined",
                },
                data: {
                    internet: internet.data,
                    server: undefined,
                },
            };
        }

        serverAddress = serverAddress[2].split(":");
        const address = serverAddress[0];
        const port = parseInt(serverAddress[1]);
        const isIPv4 = address.match(
            /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
        );

        const server = await (async () => {
            if (isIPv4) {
                // if address is an ipv4 address check connectivity with lookup service
                return dns
                    .lookupService(address, port ? port : 80)
                    .then((data) => {
                        return {
                            status: true,
                            data,
                        };
                    })
                    .catch((error) => {
                        if (self.debug) {
                            console.error("_checkConnectivity error", error);
                        }

                        return {
                            status: false,
                            error,
                        };
                    });
            } else {
                // just use lookup if address is hostname
                return dns
                    .lookup(address)
                    .then((data) => {
                        return {
                            status: true,
                            data,
                        };
                    })
                    .catch((error) => {
                        if (self.debug) {
                            console.error("_checkConnectivity error", error);
                        }

                        return {
                            status: false,
                            error,
                        };
                    });
            }
        })();

        return {
            status: Boolean(internet.status & server.status),
            error: {
                internet: internet.error,
                server: server.error,
            },
            data: {
                internet: internet.data,
                server: server.data,
            },
        };
    }

    _setHeaders(key, val) {
        this.options.headers[key] = val;
    }

    _rewriteConfig(_config) {
        if (!_config instanceof Object) {
            return false;
        }

        const config = JSON.stringify(_config, null, "\t");
        return fs.promises
            .writeFile(
                `${__basedir}/config/app.config.js`,
                `module.exports = ${config};`
            )
            .then((success) => true)
            .catch((error) => false);
    }

    register() {
        const self = this;

        // already registered, proceed no further and return config
        if (self.config.api.isRegistered) {
            return self.config;
        }

        const { execSync } = require("child_process");
        self.config.api.username =
            "FM_" + execSync("cat /etc/machine-id").toString("utf8").trim();
        self.config.api.password = self.randomString;

        self._setHeaders(`Authorization`, `Bearer ${self.certificate}`);

        const options = {
            url: "/device/register",
            method: "post",
            data: {
                username: self.config.api.username,
                password: self.config.api.password,
                truckNumber: self.config.api.truckNumber,
            },
            ...self.options,
        };

        return axios(options)
            .then((response) => {
                if (self.debug) {
                    console.log("api register Success:", response);
                    console.log("After Register", self.config.api);
                }

                // removing certificate
                fs.unlinkSync(self.config.api.certificate);
                self.certificate = null;
                self.config.api.certificate = null;

                // return entire config if success
                return self.config;
            })
            .catch((error) => {
                if (self.debug) {
                    console.error(
                        "api register Error:",
                        error,
                        _transformError(error)
                    );
                }

                return null;
            });
    }

    _reloginLoop(forced = false, caller = undefined) {
        const self = this;

        if (!self._alreadyLooping || forced) {
            self._alreadyLooping = true;
            setTimeout(async () => {
                self._login = await self.login(false);
                self._reloginLoop(
                    self.delayBetweenLoginAttempt,
                    true,
                    "_reloginLoop"
                );
            }, self.delayBetweenLoginAttempt);
        } else {
            return null;
        }
    }

    async login(doInfiniteLoop = true, refreshTokenMs = 600000) {
        const self = this;

        if (
            self._login.timestamp &&
            Date.now() - self._login.timestamp < self.delayBetweenLoginAttempt
        ) {
            return new Promise((resolve) => {
                setTimeout(() => {
                    resolve(self._login);
                }, self.delayBetweenLoginAttempt / 1.25);
            });
        }

        self._login.timestamp = Date.now();

        self.delayBetweenLoginAttempt = 2000;
        const connectivity = await self._checkConnectivity();

        if (!connectivity.status) {
            // No Internet connection, break process and re run login
            if (doInfiniteLoop) {
                self._reloginLoop(
                    self.delayBetweenLoginAttempt,
                    false,
                    "connectivity"
                );
            }

            if (self.debug) {
                console.error("connectivity Error", connectivity);
            }

            return {
                status: false,
                error: "No Connectivity",
            };
        }

        if (!self.config.api.isRegistered) {
            const register = await self.register();

            if (register) {
                self.config.api.isRegistered = true;
                await self._rewriteConfig(self.config);
                self.config = register;
            } else {
                if (self.debug) {
                    console.error("register Error", register);
                }

                // break process, because if registering is failed nothing can be done
                return {
                    status: false,
                    error: "Failed at Registering device.",
                };
            }
        }

        const options = {
            url: "/auth/login",
            method: "post",
            data: {
                username: self.config.api.username,
                password: self.config.api.password,
            },
            ...self.options,
        };

        return axios(options)
            .then((response) => {
                const data = response.data;

                if (data.token) {
                    self._token = data.token;
                    self.websocket.setToken(data.token);
                    self._setHeaders(`Authorization`, `Bearer ${data.token}`);

                    const JWTs = data.token.split(".");
                    const jwtPayload = JSON.parse(
                        Buffer.from(JWTs[1], "Base64").toString()
                    );
                    const timeLeft = jwtPayload.exp * 1000 - Date.now();
                    self.delayBetweenLoginAttempt = timeLeft - refreshTokenMs;

                    if (doInfiniteLoop) {
                        self._reloginLoop(false, "axios then");
                    }

                    if (!self.websocket._ws) {
                        self.websocket.connect();
                    }

                    if (self.debug) {
                        console.log(
                            "===== jwtPayload =====\n",
                            jwtPayload,
                            date.format(
                                new Date(jwtPayload.exp * 1000),
                                "YYYY-MM-DD HH:mm:ss.SSS"
                            ),
                            helper.msToHms(timeLeft),
                            "\n======================"
                        );
                    }

                    if (self.debug) {
                        console.log(
                            "===== jwtPayload =====\n",
                            jwtPayload,
                            date.format(
                                new Date(jwtPayload.exp * 1000),
                                "YYYY-MM-DD HH:mm:ss.SSS"
                            ),
                            helper.msToHms(timeLeft),
                            "\n======================"
                        );
                    }
                }

                return response;
            })
            .catch((error) => {
                // attempt to re-login on failed attempt
                if (doInfiniteLoop) {
                    self.delayBetweenLoginAttempt = 2000;
                    self._reloginLoop(false, "axios catch");
                }

                if (self.debug) {
                    console.error("api login Error:", _transformError(error));
                }

                return {
                    status: false,
                    error,
                };
            });
    }

    /**
     * Get Not Good list
     * @returns NG list from back end Scrap
     * */
    async getNGProdlists() {
        const self = this;
        const options = {
            url: "/log-production-inject/scrap/list",
            method: "get",
            headers: {
                Authorization: `Bearer ${self._token}`,
            },
            ...self.options,
        };
        return axios(options)
            .then((response) => {
                const data = response.data;
                return data;
            })
            .catch((error) => error);
    }
    /**
     * Get Dandori list
     * from postman "Get References All Dandori"
     * @returns Dandori list
     * */
    async getDandoriLists() {
        const self = this;
        const options = {
            url: "/dandori/list/inject",
            method: "get",
            ...self.options,
        };
        return axios(options)
            .then((response) => {
                const data = response.data;
                return data;
            })
            .catch((error) => error);
    }
    /**
     * Get list of available Parts
     *
     * @example
     * returns part which group name is "D12"
     * api.listPart({
     *     group: {
     *        name: "D12"
     *     }
     * });
     *
     * @example
     *  returns part which group name is "D12" and material id is 1
     * api.listPart({
     *     group: {
     *        name: "D12"
     *     },
     *     material: {
     *        id: 1
     *     }
     * });
     * @returns list of parts
     * */
    async PartLists({ group, material }) {
        const self = this;

        // request body
        const data = {
            group,
            material,
        };

        // insert request body into axios options
        // POST, PUT, DELETE might have request body
        const options = {
            url: `/v1/parts/list`,
            method: "post",
            data,
            ...self.options,
        };

        return axios(options)
            .then((response) => {
                const { error, data } = response;

                return {
                    status: true,
                    error,
                    data,
                };
            })
            .catch((response) => {
                const { error, data } = response;

                return {
                    status: false,
                    error,
                    data,
                };
            });
    }

    getAllQueueInject(machineId) {
        const self = this;

        const options = {
            url: `/queue-inject/list/${machineId}`,
            method: "post",
            data: {
                shiftDate: date.format(new Date(), "YYYY-MM-DD HH:mm:ss"),
            },
            ...self.options,
        };

        return axios(options)
            .then((response) => {
                const { error, data } = response;
                return {
                    status: true,
                    error,
                    data,
                };
            })
            .catch((response) => {
                return {
                    status: false,
                    error: response,
                };
            });
    }

    SetDoneQueueInject(id, operatorId) {
        const self = this;

        const options = {
            url: `/queue-inject/done/${id}`,
            method: "put",
            data: {
                machineId: config.machineId,
                shiftDate: date.format(new Date(), "YYYY-MM-DD HH:mm:ss"),
                operatorId,
            },
            ...self.options,
        };

        return axios(options)
            .then((response) => {
                const { error, data } = response;
                return {
                    status: true,
                    error,
                    data,
                };
            })
            .catch((response) => {
                return {
                    status: false,
                    error: response,
                };
            });
    }
    verifyRFID(id) {
        const self = this;

        const options = {
            url: `/employee/verify/${id}`,
            method: "get",
            ...self.options,
        };

        return axios(options)
            .then((response) => {
                const { data } = response;

                return {
                    status: true,
                    data: Array.isArray(data) ? data[0] : data,
                };
            })
            .catch((error) => {
                return {
                    status: false,
                    error,
                };
            });
    }


    getSCWlists() {
        const self = this;

        const options = {
            url: `/log-production-inject/abnormality/list`,
            method: "get",
            ...self.options,
        };

        return axios(options)
            .then((response) => {
                const { error, data } = response;

                return {
                    status: true,
                    error,
                    data,
                };
            })
            .catch((response) => {
                const { error, data } = response;

                return {
                    status: false,
                    error,
                    data,
                };
            });
    }

    getUtilityScw() {
        const self = this;

        const options = {
            url: `/log-production-inject/abnormality-utility/list`,
            method: "get",
            ...self.options,
        };

        return axios(options)
            .then((response) => {
                const { error, data } = response;

                return {
                    status: true,
                    error,
                    data,
                };
            })
            .catch((response) => {
                const { error, data } = response;

                return {
                    status: false,
                    error,
                    data,
                };
            });
    }

    addAbnormalityUtility(id, data) {
        const self = this;
        const options = {
            url: `/abnormality-inject/utility-update/${id}`,
            method: "put",
            data,
            ...self.options,
        };

        return axios(options)
            .then((response) => {
                const { data } = response;

                return {
                    status: true,
                    data,
                };
            })
            .catch((error) => {
                if (self.debug) {
                    console.error(error);
                }

                return {
                    status: false,
                    error,
                };
            });
    }


    NGList(id = "") {
        const self = this;

        const options = {
            url: `/log-production-inject/scrap/list`,
            method: "get",
            ...self.options,
        };

        return axios(options)
            .then((response) => {
                const { data } = response;

                return {
                    status: true,
                    data,
                };
            })
            .catch((error) => {
                if (self.debug) {
                    console.error(error);
                }

                return {
                    status: false,
                    error,
                };
            });
    }

    /**
     *	get session for current shiftId and queueId
     *	@param {Object} data - data
     *	@param {number} data.shiftId - shift id
     *	@param {number} data.queueId - queue id
     * */
    currentQueueSession(data = {}, cb) {
        const self = this;

        const options = {
            url: `/log-production-inject/queue/session`,
            method: "post",
            data,
            ...self.options,
        };

        return axios(options)
            .then((response) => {
                const { data } = response;

                if (cb instanceof Function) {
                    cb(data);
                }

                return {
                    status: true,
                    data,
                };
            })
            .catch((error) => {
                if (self.debug) {
                    console.error(error);
                }

                return {
                    status: false,
                    error,
                };
            });
    }

    startShift(machineId, operatorId) {
        const self = this;

        const options = {
            url: `/shift/start-inject`,
            method: "post",
            data: {
                machineId,
                operatorId,
                start: date.format(new Date(), "YYYY-MM-DD HH:mm:ss"),
            },
            ...self.options,
        };

        return axios(options)
            .then((response) => {
                const { data } = response;

                return {
                    status: true,
                    data,
                };
            })
            .catch((error) => {
                if (self.debug) {
                    console.error(error);
                }

                return {
                    status: false,
                    error,
                };
            });
    }

    finishShift(shiftId) {
        const self = this;
        const options = {
            url: `/shift/finish-inject/${shiftId}`,
            method: "put",
            data: {
                finish: date.format(new Date(), "YYYY-MM-DD HH:mm:ss"),
            },
            ...self.options,
        };

        return axios(options)
            .then((response) => {
                const { data } = response;

                return {
                    status: true,
                    data,
                };
            })
            .catch((error) => {
                if (self.debug) {
                    console.error(error);
                }

                return {
                    status: false,
                    error,
                };
            });
    }

    saveScrap(shiftId, scrapId, queueId, partId) {
        const self = this;

        const options = {
            url: `/scrap-production-inject/add `,
            method: "post",
            data: {
                shiftId,
                scrapId,
                queueId,
                partId,
            },
            ...self.options,
        };

        return axios(options)
            .then((response) => {
                const { data } = response;

                return {
                    status: true,
                    data,
                };
            })
            .catch((error) => {
                if (self.debug) {
                    console.error(error);
                }

                return {
                    status: false,
                    error,
                };
            });
    }

    saveLog(data) {
        const self = this;

        const options = {
            url: `/log-production-inject/add`,
            method: "post",
            data,
            ...self.options,
        };

        return axios(options)
            .then((response) => {
                const { data } = response;

                return {
                    status: true,
                    data,
                };
            })
            .catch((error) => {
                if (self.debug) {
                    console.error(error);
                }

                return {
                    status: false,
                    error,
                };
            });
    }

    dandoriStart(shiftId, dandoriId, start = null, partId, queueId) {
        const self = this;

        const options = {
            url: `/dandori-production-inject/start`,
            method: "post",
            data: {
                shiftId,
                dandoriId,
                partId,
                queueId,
                start: start || helper.formatDate(new Date()),
            },
            ...self.options,
        };

        return axios(options)
            .then((response) => {
                const { data } = response;

                return {
                    status: true,
                    data,
                };
            })
            .catch((error) => {
                if (self.debug) {
                    console.error(error);
                }

                return {
                    status: false,
                    error,
                };
            });
    }

    dandoriFinish(id, finish = null) {
        const self = this;

        const options = {
            url: `/dandori-production-inject/finish/${id}`,
            method: "put",
            data: {
                finish: finish || helper.formatDate(new Date()),
            },
            ...self.options,
        };

        return axios(options)
            .then((response) => {
                const { data } = response;

                return {
                    status: true,
                    data,
                };
            })
            .catch((error) => {
                if (self.debug) {
                    console.error(error);
                }

                return {
                    status: false,
                    error,
                };
            });
    }

    dandoriSCWStart(data) {
        const self = this;

        const options = {
            url: `/dandori-production-inject/abnormality/start`,
            method: "post",
            data,
            ...self.options,
        };

        return axios(options)
            .then((response) => {
                const { data } = response;

                return {
                    status: true,
                    data,
                };
            })
            .catch((error) => {
                if (self.debug) {
                    console.error(error);
                }

                return {
                    status: false,
                    error,
                };
            });
    }

    dandoriSCWFinish(id, finish = null) {
        const self = this;

        const options = {
            url: `/dandori-production-inject/abnormality/finish/${id}`,
            method: "put",
            data: {
                finish: finish || helper.formatDate(new Date()),
            },
            ...self.options,
        };

        return axios(options)
            .then((response) => {
                const { data } = response;

                return {
                    status: true,
                    data,
                };
            })
            .catch((error) => {
                if (self.debug) {
                    console.error(error);
                }

                return {
                    status: false,
                    error,
                };
            });
    }

    scwStart(data) {
        const self = this;

        const options = {
            url: `/abnormality-inject/start`,
            method: "post",
            data,
            ...self.options,
        };

        return axios(options)
            .then((response) => {
                const { data } = response;

                return {
                    status: true,
                    data,
                };
            })
            .catch((error) => {
                if (self.debug) {
                    console.error(error);
                }

                return {
                    status: false,
                    error,
                };
            });
    }

    scwFinish(id, finish = null) {
        const self = this;

        const options = {
            url: `/abnormality-inject/done/${id}`,
            method: "put",
            data: {
                finish: finish || helper.formatDate(new Date()),
            },
            ...self.options,
        };

        return axios(options)
            .then((response) => {
                const { data } = response;

                return {
                    status: true,
                    data,
                };
            })
            .catch((error) => {
                if (self.debug) {
                    console.error(error);
                }

                return {
                    status: false,
                    error,
                };
            });
    }

    setConfirmationAbnormality(id, data) {
        const self = this;

        const options = {
            url: `/abnormality-inject/confirmation/${id}`,
            method: "put",
            data,
            ...self.options,
        };

        return axios(options)
            .then((response) => {
                const { error, data } = response;

                return {
                    status: true,
                    error,
                    data,
                };
            })
            .catch((response) => {
                const { error, data } = response;

                return {
                    status: false,
                    error,
                    data,
                };
            });
    }

    startBreak(data) {
        const self = this;

        const options = {
            url: `/break/start`,
            method: "post",
            data,
            ...self.options,
        };

        return axios(options)
            .then((response) => {
                const { data } = response;

                return {
                    status: true,
                    data,
                };
            })
            .catch((error) => {
                if (self.debug) {
                    console.error(error);
                }

                return {
                    status: false,
                    error,
                };
            });
    }

    finishBreak(id, finish = null) {
        const self = this;

        const options = {
            url: `/break/finish/${id}`,
            method: "put",
            data: {
                finish: finish || helper.formatDate(new Date()),
            },
            ...self.options,
        };

        return axios(options)
            .then((response) => {
                const { data } = response;

                return {
                    status: true,
                    data,
                };
            })
            .catch((error) => {
                if (self.debug) {
                    console.error(error);
                }

                return {
                    status: false,
                    error,
                };
            });
    }

    getMachineId(machineId, cb) {
        const self = this;

        const options = {
            url: `/machine/detail/${machineId}`,
            method: "get",
            data: { machineId },
            ...self.options,
        };

        return axios(options)
            .then((response) => {
                const { data } = response;

                if (cb instanceof Function) {
                    cb(data);
                }

                return {
                    status: true,
                    data,
                };
            })
            .catch((error) => {
                if (self.debug) {
                    console.error(error);
                }

                return {
                    status: false,
                    error,
                };
            });
    }

    async getEmployeeName(data) {
		const self = this;
		const options = {
			url: `/employee/list`,
			method: "post",
			data,
			...self.options,
		};

		return axios(options)
			.then((response) => {
				const { data } = response;

				return {
					status: true,
					data,
				};
			})
			.catch((error) => {
				if (self.debug) {
					console.error(error);
				}

				return {
					status: false,
					error,
				};
			});
	}

	async getEmployeePosition(data) {
		const self = this;
		const options = {
			url: `/employee/list/position`,
			method: "get",
			data,
			...self.options,
		};

		return axios(options)
			.then((response) => {
				const { data } = response;

				return {
					status: true,
					data,
				};
			})
			.catch((error) => {
				if (self.debug) {
					console.error(error);
				}

				return {
					status: false,
					error,
				};
			});
	}

    get token() {
        return this._token;
    }

    get randomString() {
        return encodeURIComponent(
            require("crypto").randomBytes(32).toString("Base64")
        );
    }
}

module.exports = __api;
