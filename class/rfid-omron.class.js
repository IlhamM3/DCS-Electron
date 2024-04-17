const { rejects } = require('assert');
const EventEmitter = require('events');
const { resolve } = require('path');
const __modbus = require("./modbusRTU.class");

class rfid extends EventEmitter{
    constructor(rfidConfig, length = 56,interval = null){
        super();
        const self = this;

        self.config = {
            ip : rfidConfig.ip,
            port : rfidConfig.port,
            id : rfidConfig.id,
            byteOrder : [0,1,2,3],
            debug : true,
            timeout : rfidConfig.timeout
        };
        self.rfid = new __modbus(self.config);
        self.length = length;
        self.dataNol=[];
        self.interval = interval ||  100;

        self.loop(0, length);
    };

    read(){
        const self = this;
        return new Promise(async function(resolve,reject){
            const data = await self.rfid.readHoldingRegisters(0,self.length);
            let str = data.toString('utf8')
            str = str.replace(/\u0000/g,"")
            const field = str.split(',')
            self.emit('RFID',field);
            resolve(field);
        })
    };

    async write(id,name){
        const self = this;

        const data = `${id},${name}`; // concat id and name delimited with ','
        const buffer = new Uint16Array(Buffer.from(data, 'utf8')); // convert into Array
        const bTulis = await self.rfid.writeRegisters(0,buffer); //write data into RFID

        return self.read();
    };

    async loop(addr, length){
	    const self = this;

	    const tagContent = await self.rfid.readHoldingRegisters(addr, length);

	    if(tagContent){
		const content = tagContent.toString('utf8');
	    	self.emit('RFID', content.replace(/\u0000/g,'').split(','));
	    }

	    setTimeout(()=>{
	    	self.loop(addr, length);
	    }, self.interval);
    }
}

module.exports = rfid;
