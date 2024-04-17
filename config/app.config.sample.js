module.exports = {
	serial: {
		port: '/dev/ttyUSB0',
		baud: 38400,
	},

    machineId: undefined,

    rfid: {
        ip: "192.168.253.200",
        port: 502,
        id: 255,
        timeout: 1000,
    },

    window : {
		width : 1280,
		height : 800,
		fullscreen : true,
	},

	api: {
		baseurl: 'http://localhost:10000',
		username: 'user',
		password: 'pass',
		isRegistered: true,
	},

	autoreload : true,

	debug : false,
};
